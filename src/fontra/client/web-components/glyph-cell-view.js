import * as html from "/core/html-utils.js";
import { translate } from "/core/localization.js";
import { difference, intersection, symmetricDifference, union } from "/core/set-ops.js";
import { arrowKeyDeltas, assert, enumerate } from "/core/utils.js";
import { GlyphCell } from "/web-components/glyph-cell.js";
import { Accordion } from "/web-components/ui-accordion.js";

export class GlyphCellView extends HTMLElement {
  constructor(fontController, settingsController, options) {
    super();

    this.fontController = fontController;
    this.settingsController = settingsController;
    this.locationKey = options?.locationKey || "fontLocationSourceMapped";
    this.glyphSelectionKey = options?.glyphSelectionKey || "glyphSelection";

    this._magnification = 1;

    this._resetSelectionHelpers();

    this.settingsController.addKeyListener(this.glyphSelectionKey, (event) => {
      const selection = event.newValue;
      const diff = symmetricDifference(selection, event.oldValue);
      this.forEachGlyphCell((glyphCell) => {
        if (diff.has(glyphCell.glyphName)) {
          glyphCell.selected = selection.has(glyphCell.glyphName);
        }
      });
    });

    this.settingsController.addKeyListener(this.locationKey, (event) => {
      this._cellCenterForArrowUpDown = null;
    });

    this.fontController.addChangeListener({ glyphMap: null }, (event) => {
      this.glyphSelection = intersection(
        this.glyphSelection,
        Object.keys(this.fontController.glyphMap)
      );
    });

    this._intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0) {
          this._intersectionObserver.unobserve(entry.target);
          entry.target.onBecomeVisible?.();
        } else {
        }
      });
    });

    this.appendChild(this.getContentElement());

    this.addEventListener("keydown", (event) => this.handleKeyDown(event));
  }

  _resetSelectionHelpers() {
    this._firstClickedCell = null;
    this._secondClickedCell = null;
    this._cellCenterForArrowUpDown = null;
  }

  getContentElement() {
    this.accordion = new Accordion();

    this.accordion.appendStyle(`
    .placeholder-label {
      font-size: 0.9em;
      opacity: 40%;
    }

    .font-overview-accordion-item {
      height: 100%;
      width: 100%;
      overflow-y: auto;
      white-space: normal;
    }

    .glyph-count {
      font-weight: normal;
      opacity: 50%;
    }
    `);

    return html.div({}, [this.accordion]); // wrap in div for scroll behavior
  }

  setGlyphSections(glyphSections) {
    this._resetSelectionHelpers();
    this.glyphSections = glyphSections;

    let sectionIndex = 0;
    const accordionItems = glyphSections.map((section) => ({
      label: html.span({}, [
        section.label,
        html.span({ class: "glyph-count" }, [
          " ",
          makeGlyphCountString(section.glyphs, this.fontController.glyphMap),
        ]),
      ]),
      open: true,
      content: html.div({ class: "font-overview-accordion-item" }, []),
      glyphs: section.glyphs,
      sectionIndex: sectionIndex++,
      nextCellIndex: 0,
    }));

    this.accordion.items = accordionItems;

    // `results` is in preparation for https://github.com/googlefonts/fontra/issues/1887
    const results = [];

    for (const item of this.accordion.items) {
      this._updateAccordionItem(item).then((itemHasGlyphs) => {
        this.accordion.showHideAccordionItem(item, itemHasGlyphs);
        results.push(itemHasGlyphs);
      });
    }
  }

  async _updateAccordionItem(item) {
    const element = item.content;

    element.innerHTML = "";

    element.appendChild(
      html.span({ class: "placeholder-label" }, [
        translate("sidebar.related-glyphs.loading"), // TODO: general loading key.
      ])
    );

    const glyphs = await item.glyphs;
    const itemHasGlyphs = !!glyphs?.length;

    element.innerHTML = "";

    if (itemHasGlyphs) {
      item.glyphsToAdd = [...glyphs];
      this._addCellsIfNeeded(item);
      // At least in Chrome, we need to reset the scroll position, but it doesn't
      // work if we do it right away, only after the next event iteration.
      setTimeout(() => {
        element.scrollTop = 0;
      }, 0);
    }

    return itemHasGlyphs;
  }

  _addCellsIfNeeded(item) {
    if (!item.glyphsToAdd.length) {
      return;
    }
    const CHUNK_SIZE = 200;
    const ADD_CELLS_TRIGGER_INDEX = 150;
    const chunkOfGlyphs = item.glyphsToAdd.splice(0, CHUNK_SIZE);
    const documentFragment = document.createDocumentFragment();
    for (const [index, { glyphName, codePoints }] of enumerate(chunkOfGlyphs)) {
      const glyphCell = new GlyphCell(
        this.fontController,
        glyphName,
        codePoints,
        this.settingsController,
        this.locationKey
      );
      glyphCell._sectionIndex = item.sectionIndex;
      glyphCell._cellIndex = item.nextCellIndex++;

      glyphCell.onclick = (event) => {
        this.handleSingleClick(event, glyphCell);
      };
      glyphCell.ondblclick = (event) => this.onCellDoubleClick?.(event, glyphCell);

      glyphCell.selected = this.glyphSelection.has(glyphName);

      if (index == ADD_CELLS_TRIGGER_INDEX) {
        glyphCell.onBecomeVisible = () => {
          this._addCellsIfNeeded(item);
        };
        this._intersectionObserver.observe(glyphCell);
      }

      documentFragment.appendChild(glyphCell);
    }
    item.content.appendChild(documentFragment);
  }

  getSelectedGlyphInfo() {
    const glyphSelection = this.glyphSelection;
    return this.glyphSections
      .map((section) =>
        section.glyphs.filter((glyphInfo) => glyphSelection.has(glyphInfo.glyphName))
      )
      .flat();
  }

  get glyphSelection() {
    return this.settingsController.model[this.glyphSelectionKey];
  }

  set glyphSelection(selection) {
    this.settingsController.model[this.glyphSelectionKey] = selection;
  }

  findFirstSelectedCell() {
    let firstSelectedCell = undefined;
    if (!this.glyphSelection.size) {
      return firstSelectedCell;
    }
    for (const glyphCell of this.iterGlyphCells()) {
      if (this.glyphSelection.has(glyphCell.glyphName)) {
        firstSelectedCell = glyphCell;
        break;
      }
    }
    return firstSelectedCell;
  }

  findLastSelectedCell() {
    let lastSelectedCell = undefined;
    if (!this.glyphSelection.size) {
      return lastSelectedCell;
    }
    for (const glyphCell of this.iterGlyphCells()) {
      if (this.glyphSelection.has(glyphCell.glyphName)) {
        lastSelectedCell = glyphCell;
      }
    }
    return lastSelectedCell;
  }

  forEachGlyphCell(func) {
    for (const glyphCell of this.iterGlyphCells()) {
      func(glyphCell);
    }
  }

  *iterGlyphCells() {
    for (const glyphCell of this.accordion.querySelectorAll("glyph-cell")) {
      yield glyphCell;
    }
  }

  handleSingleClick(event, glyphCell) {
    if (event.detail > 1) {
      // Part of a double click, we should do nothing and let handleDoubleClick
      // deal with the event
      clearTimeout(this._selectionTimerID);
      return;
    }

    if (event.shiftKey) {
      return this.handleSingleClickShift(event, glyphCell);
    }

    this._firstClickedCell = glyphCell;
    this._cellCenterForArrowUpDown = null;

    const glyphName = glyphCell.glyphName;

    if (this.glyphSelection.has(glyphName)) {
      if (event.metaKey) {
        this._resetSelectionHelpers();
        this.glyphSelection = difference(this.glyphSelection, [glyphName]);
      } else if (this.glyphSelection.size > 1) {
        // The user clicked on a selected glyph that's part of a larger
        // selection. We want the selection to be the clicked glyph only,
        // but we need to do this after a delay, or else we can't double-click
        // on a selection > 1. The delay should ideally match the double-click
        // time (which is user-configurable), but instead we take 500ms, which
        // should be default-ish in many cases.
        // If indeed a double-click comes, the timer is cancelled.
        this._selectionTimerID = setTimeout(() => {
          this.glyphSelection = new Set([glyphName]);
        }, 500);
      }
    } else {
      if (event.metaKey) {
        this.glyphSelection = union(this.glyphSelection, [glyphName]);
      } else {
        this.glyphSelection = new Set([glyphName]);
      }
    }
  }

  handleSingleClickShift(event, glyphCell) {
    this.extendSelection(glyphCell);
  }

  extendSelection(glyphCell) {
    this.ensureFirstClickedCell(glyphCell);

    let selection = this.glyphSelection;

    if (this._secondClickedCell) {
      selection = difference(
        selection,
        this.getGlyphNamesForRange(this._firstClickedCell, this._secondClickedCell)
      );
    }

    const newRange = this.getGlyphNamesForRange(this._firstClickedCell, glyphCell);
    selection = union(selection, newRange);
    this.glyphSelection = selection;
    this._secondClickedCell = glyphCell;
  }

  ensureFirstClickedCell(glyphCell) {
    if (!this._firstClickedCell) {
      if (!this.glyphSelection.size) {
        this._firstClickedCell = this.getFirstGlyphCell();
      } else {
        const firstSelectedCell = this.findFirstSelectedCell();
        const lastSelectedCell = this.findLastSelectedCell();
        this._firstClickedCell =
          cellCompare(lastSelectedCell, glyphCell) < 0
            ? firstSelectedCell
            : lastSelectedCell;
      }
    }
  }

  getGlyphNamesForRange(firstCell, secondCell) {
    if (cellCompare(firstCell, secondCell) < 0) {
      [secondCell, firstCell] = [firstCell, secondCell];
    }
    const glyphSelection = new Set([firstCell.glyphName]);
    let cell = firstCell;
    while (cell && cell !== secondCell) {
      cell = nextGlyphCellHorizontal(cell, 1);
      if (cell) {
        glyphSelection.add(cell.glyphName);
      }
    }
    return glyphSelection;
  }

  handleKeyDown(event) {
    if (event.key in arrowKeyDeltas) {
      this.handleArrowKeys(event);
    }
  }

  handleArrowKeys(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const referenceCell = this._firstClickedCell
      ? this._secondClickedCell
        ? this._secondClickedCell
        : this._firstClickedCell
      : this.findFirstSelectedCell();

    let nextCell;

    if (!referenceCell) {
      nextCell = this.getFirstGlyphCell();
      if (!nextCell) {
        // There are no glyphs whatsoever, so there is nowehere to go
        return;
      }
    } else {
      const [deltaX, deltaY] = arrowKeyDeltas[event.key];
      if (deltaX) {
        this._cellCenterForArrowUpDown = null;
        nextCell = nextGlyphCellHorizontal(referenceCell, deltaX);
      } else {
        if (this._cellCenterForArrowUpDown === null) {
          this._cellCenterForArrowUpDown = boundsCenterX(
            referenceCell.getBoundingClientRect()
          );
        }

        nextCell = nextGlyphCellVertical(
          referenceCell,
          -deltaY,
          this._cellCenterForArrowUpDown
        );
      }

      if (!nextCell) {
        // Fallback
        nextCell = referenceCell;
      }
    }

    assert(nextCell);

    if (event.shiftKey) {
      this.extendSelection(nextCell);
    } else {
      this._firstClickedCell = nextCell;
      this._secondClickedCell = null;
      this.glyphSelection = new Set([nextCell.glyphName]);
    }

    nextCell.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
  }

  getFirstGlyphCell() {
    const itemContent = this.accordion.items[0].content;
    return itemContent.firstElementChild;
  }

  get magnification() {
    return this._magnification;
  }

  set magnification(magnification) {
    this._magnification = magnification;
    this.style.setProperty("--glyph-cell-scale-factor-override", magnification);
  }
}

customElements.define("glyph-cell-view", GlyphCellView);

function nextGlyphCellHorizontal(glyphCell, direction) {
  let nextCell = nextSibling(glyphCell, direction);
  if (!nextCell) {
    const accordionItem = glyphCell.parentNode.parentNode.parentNode;
    assert(accordionItem.classList.contains("ui-accordion-item"));

    let nextAccordionItem = accordionItem;

    while (true) {
      nextAccordionItem = nextSibling(nextAccordionItem, direction);
      if (!nextAccordionItem) {
        break;
      }
      if (!nextAccordionItem.classList.contains("ui-accordion-item-closed")) {
        // Skip closed items
        break;
      }
    }

    if (nextAccordionItem) {
      nextCell = nextAccordionItem.querySelector(
        `glyph-cell:${direction == 1 ? "first" : "last"}-child`
      );
    }
  }
  return nextCell;
}

function nextSibling(element, direction) {
  return direction == 1 ? element.nextElementSibling : element.previousElementSibling;
}

function nextGlyphCellVertical(firstCell, direction, cellCenter) {
  const firstCellBounds = firstCell.getBoundingClientRect();
  let nextCell = firstCell;

  const matches = [];
  while (true) {
    nextCell = nextGlyphCellHorizontal(nextCell, direction);
    if (!nextCell) {
      break;
    }

    const nextCellBounds = nextCell.getBoundingClientRect();
    const overlap = horizontalOverlap(firstCellBounds, nextCellBounds);

    if (overlap) {
      matches.push({ cell: nextCell, center: boundsCenterX(nextCellBounds) });
    } else if (matches.length) {
      break;
    }
  }
  matches.sort(
    (a, b) => Math.abs(cellCenter - a.center) - Math.abs(cellCenter - b.center)
  );
  nextCell = matches[0]?.cell;
  if (!nextCell) {
    nextCell = findFirstLastGlyphCell(firstCell, direction);
  }
  return nextCell;
}

function findFirstLastGlyphCell(firstCell, direction) {
  let firstLastCell = firstCell;
  while (true) {
    const nextCell = nextGlyphCellHorizontal(firstLastCell, direction);
    if (!nextCell) {
      break;
    }
    firstLastCell = nextCell;
  }
  return firstLastCell;
}

function horizontalOverlap(rect1, rect2) {
  const left = Math.max(rect1.left, rect2.left);
  const right = Math.min(rect1.right, rect2.right);
  return left < right ? right - left : 0;
}

function boundsCenterX(rect) {
  return rect.left + rect.width / 2;
}

function cellCompare(cellA, cellB) {
  if (cellA == cellB) {
    return 0;
  }
  return cellA._sectionIndex < cellB._sectionIndex ||
    (cellA._sectionIndex == cellB._sectionIndex && cellA._cellIndex <= cellB._cellIndex)
    ? 1
    : -1;
}

function makeGlyphCountString(glyphs, glyphMap) {
  const numGlyphs = glyphs.length;
  const numDefinedGlyphs = glyphs.filter(
    (glyph) => glyphMap[glyph.glyphName] !== undefined
  ).length;

  return numGlyphs === numDefinedGlyphs
    ? `(${numGlyphs})`
    : `(${numDefinedGlyphs} of ${numGlyphs})`;
}
