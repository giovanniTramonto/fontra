import { SimpleElement, createTemplate } from "/core/html-utils.js";

export default class Panel extends SimpleElement {
  panelStyles = `
    .panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 0.5em;
    }
    .panel__section {
      padding: 1em;
    }
    .panel__section--flex {
      flex: 1;
    }
    .panel__section--scrollable {
      overflow: hidden auto;
    }
  `;

  get templateHTML() {}

  constructor(editorController) {
    super();
    this.editorController = editorController;
    this._appendStyle(this.panelStyles);
    this.contentElement = this.getContentElement();
    if (this.templateHTML) {
      this.shadowRoot.appendChild(this.getTemplate().content);
    } else {
      this.shadowRoot.appendChild(this.contentElement);
    }
  }

  getTemplate() {
    return createTemplate(this.templateHTML);
  }

  getContentElement() {}

  async toggle(on, focus) {}
}
