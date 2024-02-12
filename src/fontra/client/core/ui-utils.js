import { addStyleSheet } from "./html-utils.js";
import { zip } from "./utils.js";
const containerClassName = "fontra-ui-sortable-list-container";
const draggingClassName = "fontra-ui-sortable-list-dragging";

addStyleSheet(`
.${draggingClassName} {
  opacity: 0.3;
}
`);

export function setupSortableList(listContainer) {
  listContainer.classList.add(containerClassName);
  let originalItems;
  // We need to compare the vertical middle of the dragged item with the sibling,
  // independently of where the user grabbed the item, so on dragstart we calculate
  // the difference between the middle of the dragged item and clientY
  let clientYOffset;

  listContainer.addEventListener("dragover", (event) => {
    event.preventDefault();
    const draggingItem = listContainer.querySelector(
      `.${containerClassName} > .${draggingClassName}`
    );

    // Getting all items except currently dragging and making array of them
    const siblings = [
      ...listContainer.querySelectorAll(
        `.${containerClassName} > [draggable="true"]:not(.${draggingClassName})`
      ),
    ];

    // Finding the sibling after which the dragging item should be placed
    const nextSibling = siblings.find((sibling) => {
      return (
        event.clientY + clientYOffset <= sibling.offsetTop + sibling.offsetHeight / 2
      );
    });

    // Inserting the dragging item before the found sibling
    listContainer.insertBefore(draggingItem, nextSibling);
  });

  listContainer.addEventListener("dragenter", (event) => event.preventDefault());

  listContainer.addEventListener("dragstart", (event) => {
    setTimeout(() => {
      event.target.classList.add(draggingClassName);
    }, 0);
    originalItems = [
      ...listContainer.querySelectorAll(`.${containerClassName} > [draggable="true"]`),
    ];
    // Calculate the difference between the middle of the dragged item and clientY
    clientYOffset =
      event.target.offsetTop + event.target.offsetHeight / 2 - event.clientY;
  });

  listContainer.addEventListener("dragend", (event) => {
    const draggingItem = listContainer.querySelector(
      `.${containerClassName} > .${draggingClassName}`
    );
    draggingItem.classList.remove(draggingClassName);

    const currentItems = [
      ...listContainer.querySelectorAll(`.${containerClassName} > [draggable="true"]`),
    ];
    if (didReorder(originalItems, currentItems)) {
      const event = new CustomEvent("reordered", {
        bubbles: false,
        detail: listContainer,
      });
      listContainer.dispatchEvent(event);
    }

    originalItems = undefined;
  });
}

function didReorder(a, b) {
  for (const [itemA, itemB] of zip(a, b)) {
    if (itemA !== itemB) {
      return true;
    }
  }
  return false;
}