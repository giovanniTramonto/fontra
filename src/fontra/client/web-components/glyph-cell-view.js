import * as html from "/core/html-utils.js";
import { translate } from "/core/localization.js";
import { ObservableController } from "/core/observable-object.js";
import { difference, intersection, symmetricDifference, union } from "/core/set-ops.js";
import { enumerate } from "/core/utils.js";
import { GlyphCell } from "/web-components/glyph-cell.js";
import { Accordion } from "/web-components/ui-accordion.js";

export class GlyphCellView extends HTMLElement {
  constructor(fontController, locationController) {
    super();

    this.fontController = fontController;
    this.locationController = locationController;

    this.glyphSelectionController = new ObservableController({ selection: new Set() });
    this.glyphSelectionController.addKeyListener("selection", (event) => {
      const selection = event.newValue;
      const diff = symmetricDifference(selection, event.oldValue);
      this.forEachGlyphCell((glyphCell) => {
        if (diff.has(glyphCell.glyphName)) {
          glyphCell.selected = selection.has(glyphCell.glyphName);
        }
      });
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
      overflow-y: scroll;
      white-space: normal;
    }
    `);

    // TODO: refactor this if we implement different sections. For now only one section.
    this.accordion.items = [
      {
        label: "Glyphs",
        open: true,
        content: html.div({ class: "font-overview-accordion-item" }, []),
        section: "Glyphs",
      },
    ];

    return html.div({}, [this.accordion]); // wrap in div for scroll behavior
  }

  setGlyphItems(glyphs) {
    this.glyphs = glyphs;
    const results = [];
    for (const item of this.accordion.items) {
      this._updateAccordionItem(item).then((hasResult) => {
        this.accordion.showHideAccordionItem(item, hasResult);
        results.push(hasResult);
      });
    }
  }

  async _updateAccordionItem(item) {
    const element = item.content;

    element.innerHTML = "";
    let hideAccordionItem = true;

    element.appendChild(
      html.span({ class: "placeholder-label" }, [
        translate("sidebar.related-glyphs.loading"), // TODO: general loading key.
      ])
    );
    const glyphs = await this.getGlyphs(item.section);

    item.glyphsToAdd = [...glyphs];

    if (glyphs?.length) {
      element.innerHTML = "";
      this._addCellsIfNeeded(item);
      // At least in Chrome, we need to reset the scroll position, but it doesn't
      // work if we do it right away, only after the next event iteration.
      setTimeout(() => {
        element.scrollTop = 0;
      }, 0);

      hideAccordionItem = false;
    } else {
      element.innerHTML = "";
    }

    return !hideAccordionItem;
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
        this.locationController,
        "fontLocationSourceMapped"
      );
      glyphCell.onclick = (event) => {
        this.handleSingleClick(event, glyphCell);
      };

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
    return this.glyphs.filter((glyphInfo) =>
      this.glyphSelection.has(glyphInfo.glyphName)
    );
  }

  get glyphSelection() {
    return this.glyphSelectionController.model.selection;
  }

  set glyphSelection(selection) {
    this.glyphSelectionController.model.selection = selection;
  }

  forEachGlyphCell(func) {
    for (const glyphCell of this.iterGlyphCells()) {
      func(glyphCell);
    }
  }

  *iterGlyphCells() {
    for (const glyphCell of this.accordion.shadowRoot.querySelectorAll("glyph-cell")) {
      yield glyphCell;
    }
  }

  handleSingleClick(event, glyphCell) {
    if (event.detail > 1) {
      // Part of a double click, we should do nothing and let handleDoubleClick
      // deal with the event
      return;
    }

    const glyphName = glyphCell.glyphName;

    if (this.glyphSelection.has(glyphName)) {
      if (event.shiftKey) {
        this.glyphSelection = difference(this.glyphSelection, [glyphName]);
      }
    } else {
      if (event.shiftKey) {
        this.glyphSelection = union(this.glyphSelection, [glyphName]);
      } else {
        this.glyphSelection = new Set([glyphName]);
      }
    }
  }

  async getGlyphs(section) {
    // TODO: section. For now return all glyphs
    return this.glyphs;
  }
}

customElements.define("glyph-cell-view", GlyphCellView);
