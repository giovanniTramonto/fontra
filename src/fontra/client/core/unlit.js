// This is a tiny subset of a few things that Lit does, except it uses
// object notation to construct dom elements instead of HTML.

export class SimpleElement extends HTMLElement {
  constructor() {
    super();
    this._additionalStyles = [];
    this.attachShadow({ mode: "open" });
    this._postInit();
  }

  _postInit() {
    this._attachStyles();
  }

  _attachStyles() {
    if (this.constructor.styles) {
      this._appendStyle(this.constructor.styles);
    }
    for (const style of this._additionalStyles) {
      this._appendStyle(style);
    }
  }

  _appendStyle(cssText) {
    const styleElement = document.createElement("style");
    styleElement.textContent = cssText;
    this.shadowRoot.appendChild(styleElement);
  }

  appendStyle(cssText) {
    this._additionalStyles.push(cssText);
  }
}

export class UnlitElement extends SimpleElement {
  _postInit() {
    this._setupProperties();
    this.requestUpdate();
  }

  _setupProperties() {
    this._propertyValues = {};
    for (const [prop, description] of Object.entries(
      this.constructor.properties || {}
    )) {
      Object.defineProperty(this, prop, {
        get: () => {
          return this._propertyValues[prop];
        },
        set: (value) => {
          if (
            description.type &&
            !(
              value.constructor === description.type ||
              value instanceof description.type
            )
          ) {
            throw new TypeError(
              `expected instance of ${description.type.name}, got ${value.constructor.name}`
            );
          }
          this._propertyValues[prop] = value;
          this.requestUpdate();
        },
      });
    }
  }

  requestUpdate() {
    if (this._requestedUpdate) {
      return;
    }
    this._requestedUpdate = true;
    setTimeout(() => this._render(), 0);
  }

  render() {
    //
    // Override, but don't call super().
    //
    // It should return a DOM Element, or an array of DOM Elements,
    // or arrays of arrays of DOM Elements, etc.
    //
    // Use createDomElement() to conveniently construct DOM Elements.
    //
  }

  async _render() {
    this._requestedUpdate = false;

    this.shadowRoot.innerHTML = "";
    this._attachStyles();

    let elements = await this.render();
    if (!elements) {
      return;
    }

    if (!Array.isArray(elements)) {
      elements = [elements];
    }
    elements = elements.flat();
    for (const element of elements) {
      this.shadowRoot.append(element);
    }
  }
}

const attrExceptions = { for: "htmlFor", class: "className", tabindex: "tabIndex" };

export function createDomElement(tagName, attributes, children) {
  const element = document.createElement(tagName);
  for (const [key, value] of Object.entries(attributes || {})) {
    element[attrExceptions[key] || key] = value;
  }
  for (const child of children || []) {
    element.append(child);
  }
  return element;
}

// Convenience shortcuts
export const br = createDomElement.bind(null, "br");
export const div = createDomElement.bind(null, "div");
export const input = createDomElement.bind(null, "input");
export const label = createDomElement.bind(null, "label");
export const span = createDomElement.bind(null, "span");
export const hr = createDomElement.bind(null, "hr");
// Let's add more once needed
