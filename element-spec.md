# feezal Element Authoring Specification

This document describes how to build, publish and configure a `feezal-element-*` package so that feezal's editor, attribute inspector and viewer can fully work with it.

---

## 1. Package conventions

| Rule | Detail |
|---|---|
| npm scope | Must be published under an npm scope, e.g. `@yourscope/feezal-element-mywidget` |
| Element name | `feezal-element-<category>-<name>`, e.g. `feezal-element-basic-gauge` |
| Reserved categories | `basic` and `paper` are owned by the feezal project |
| One element per package | The package name, filename and custom-element tag name must all be identical |
| Entry point | `package.json` `"main"` / `"module"` must point to the JS file that calls `customElements.define(…)` |

---

## 2. Base class

Import and extend `FeezalElement` from `@feezal/feezal-element`:

```js
import { FeezalElement, feezalBaseStyles, html, css } from '@feezal/feezal-element';

class FeezalElementMyWidget extends FeezalElement {
    static styles = [feezalBaseStyles, css`
        /* your element styles */
    `];
    // …
}
customElements.define('feezal-element-my-widget', FeezalElementMyWidget);
export { FeezalElementMyWidget };
```

`FeezalElement` extends Lit's `LitElement` and provides:

- `addSubscription(topic, callback)` — subscribe to an MQTT topic; subscription is automatically cleaned up on `disconnectedCallback`.
- `getProperty(msg, propertyPath)` — extract a nested value from an MQTT message object using dot-notation.
- `_payloadCast(type, payload)` — coerce a raw MQTT string payload to a JS type.
- `throttle(fn, limit)` — throttle a function call.
- Standard MQTT lifecycle: subscribes on `connectedCallback`, unsubscribes on `disconnectedCallback`.

---

## 3. The `static get feezal()` descriptor

This is the single source of truth the editor uses. It must be a static getter returning a plain object.

```js
static get feezal() {
    return {
        palette:    { … },   // Editor palette entry
        attributes: [ … ],   // Attribute inspector fields
        styles:     [ … ],   // Style inspector fields
        description: '',     // Optional element-level help text
        links:      [ … ],   // Optional links shown in the help panel
        restrict:   { … },   // Optional resize constraints
        defaultStyle: { … }  // Optional initial inline styles applied on drop
    };
}
```

### 3.1 `palette`

Controls how the element appears in the editor palette sidebar.

```js
palette: {
    name:     'My Widget',     // Display name (required)
    category: 'Basic',         // Group heading in the palette (required)
    color:    '#4a6080',       // Swatch background colour (required, hex)
    icon:     'widgets'        // Optional Material Icons ligature name
}
```

### 3.2 `attributes`

An array of attribute descriptors. Each entry may be either a plain string (attribute name, no extra config) or an object:

```js
attributes: [
    'subscribe',          // plain string — basic text input, no extra config
    {
        name:     'my-attr',      // HTML attribute name (kebab-case), REQUIRED
        type:     'string',       // Control type — see table below
        options:  ['a', 'b'],     // Required when type is 'select'
        default:  '',             // Default value (informational only)
        help:     'Tooltip text shown next to the attribute label in the inspector.',
        tooltip:  'HTML title on the input field.',
        min:      0,              // For type:'number' inputs
        max:      100,
        step:     1,
        textarea: false,          // Use a multi-line textarea instead of sl-input
        template: false,          // Store value in a <template> child, not as an attribute
        list:     false,          // Render as an editable key/value list (see §3.2.1)
        columns:  ['key','val'],  // Column names when list:true
        validator: v => Boolean(v) // Optional function; return false to mark invalid
    }
]
```

**Supported `type` values and the control they produce:**

| `type` | Control rendered |
|---|---|
| `'string'` (default) | Text input |
| `'number'` | Number input |
| `'boolean'` | Checkbox |
| `'color'` | Text input + native colour picker |
| `'select'` | Dropdown — requires `options` array |
| `'mqttTopic'` | Text input with live MQTT topic autocomplete |

Auto-detection rules (when `type` is omitted):
- Attribute name contains `color` → colour picker
- Attribute name is `subscribe`, `publish`, or contains `topic` → MQTT topic autocomplete
- Lit `static properties` declares the property as `Boolean` → checkbox
- Otherwise → text input

#### 3.2.1 `list` attributes

Set `list: true` and `columns: ['col1', 'col2']` to render a sortable list of key/value rows. The value is stored as a JSON array.

### 3.3 `styles`

An array of CSS property names (or property descriptor objects) that the Style inspector will expose for this element:

```js
styles: [
    'top', 'left', 'width', 'height',       // position / size (half-width inputs)
    'font-size', 'color', 'background',      // plain property name strings
    { property: 'border-radius', type: 'color' }  // object form; type:'color' adds a colour picker
]
```

Properties in `CSS_ENUMS` (display, flex-direction, align-items, etc.) are automatically rendered as dropdowns.

### 3.4 `description` and `links`

Optional element-level documentation shown in a collapsible **Help** panel at the bottom of the Attributes tab when the element is selected:

```js
description: 'Shows a numeric value received over MQTT.',
links: [
    { label: 'MQTT topic format docs', url: 'https://example.com/docs' }
]
```

### 3.5 `restrict`

Minimum size constraints applied by the resize handle:

```js
restrict: { minWidth: 40, minHeight: 20 }
```

### 3.6 `defaultStyle`

An object of inline CSS properties applied to the element immediately after it is dropped onto the canvas. Use camelCase keys:

```js
defaultStyle: { width: '80px', height: '40px', textAlign: 'right' }
```

---

## 4. MQTT topic binding contract

### 4.1 Subscribing

The `subscribe` attribute (inherited from `FeezalElement`) is the primary MQTT topic. The base class subscribes to `<topic>/#` and dispatches incoming messages using `addSubscription`.

For most elements, override `connectedCallback` and call `addSubscription`:

```js
connectedCallback() {
    super.connectedCallback();
    if (!feezal.isEditor && this.subscribe) {
        this.addSubscription(this.subscribe, msg => this._onMessage(msg));
    }
}

_onMessage(msg) {
    // msg.topic   — the full MQTT topic string
    // msg.payload — the decoded payload (string, number, object, boolean)
    this.value = this.getProperty(msg, this.messageProperty);
}
```

Unsubscription is handled automatically by `FeezalElement.disconnectedCallback`.

### 4.2 Publishing

Use `feezal.connection.pub(topic, payload)` to publish:

```js
_onClick() {
    if (this.publish) {
        feezal.connection.pub(this.publish, this.value ? 'OFF' : 'ON');
    }
}
```

### 4.3 Message property path

The `messageProperty` attribute (default `'payload'`) lets users configure which key to read from the MQTT message object. Use `this.getProperty(msg, this.messageProperty)` to resolve it.

---

## 5. CSS custom property conventions

feezal themes inject a set of CSS custom properties into every element's shadow root:

| Variable | Purpose |
|---|---|
| `--feezal-bg` | Panel/element background |
| `--feezal-bg-sub` | Secondary background (sidebars, sub-panels) |
| `--feezal-color` | Primary text colour |
| `--feezal-border` | Border colour |
| `--primary-text-color` | Polymer-compat text colour |
| `--primary-background-color` | Polymer-compat background colour |
| `--sl-color-primary-600` | Shoelace accent colour |

Use these in your element's shadow DOM CSS to ensure the element respects the active feezal theme:

```css
:host {
    background: var(--feezal-bg, white);
    color: var(--feezal-color, #333);
    border: 1px solid var(--feezal-border, #ccc);
}
```

---

## 6. Editor vs. viewer mode

Use `feezal.isEditor` to branch between editor (placeholder) and viewer (live) rendering:

```js
render() {
    if (feezal.isEditor) {
        return html`
            <div class="editor-placeholder">
                <span style="font-family:'Material Icons'">widgets</span>
                My Widget
            </div>`;
    }
    // Live viewer rendering
    return html`…`;
}
```

Pseudo-elements (navigation, connection status overlays) extend `LitElement` directly rather than `FeezalElement` because they do not subscribe to MQTT.

---

## 7. Publishing checklist

1. `package.json` name follows `@scope/feezal-element-category-name` convention.
2. `"main"` / `"module"` points to the element JS file.
3. `customElements.define('feezal-element-…', …)` is called in that file.
4. `static get feezal()` is present with at minimum `palette.name`, `palette.category`, `palette.color`.
5. The element extends `FeezalElement` (or `LitElement` for pseudo-elements).
6. All reactive properties listed in `static properties` are initialised in the constructor (not as class fields — class fields shadow Lit's reactive prototype setters).
7. camelCase properties that map to kebab-case HTML attributes declare `attribute: 'kebab-name'` in `static properties`.

---

## 8. Worked example — toggle button

```js
import { FeezalElement, feezalBaseStyles, html, css } from '@feezal/feezal-element';

class FeezalElementMyToggle extends FeezalElement {
    static get feezal() {
        return {
            palette: { name: 'Toggle', category: 'Basic', color: '#4a6080' },
            description: 'A toggle button that publishes ON/OFF to an MQTT topic.',
            attributes: [
                { name: 'subscribe', type: 'mqttTopic', help: 'Topic to read the current state from.' },
                { name: 'publish',   type: 'mqttTopic', help: 'Topic to publish ON or OFF to.' },
                { name: 'label',     type: 'string',    help: 'Button label text.' }
            ],
            styles: ['top', 'left', 'width', 'height', 'font-size'],
            defaultStyle: { width: '80px', height: '36px' }
        };
    }

    static properties = {
        label:   { type: String,  reflect: true },
        publish: { type: String,  reflect: true },
        _on:     { state: true }
    };

    static styles = [feezalBaseStyles, css`
        :host { display: flex; }
        button {
            flex: 1; cursor: pointer;
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; font: inherit;
        }
        button.on { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
    `];

    constructor() {
        super();
        this.label   = 'Toggle';
        this.publish = '';
        this._on     = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const val = this.getProperty(msg, this.messageProperty);
                this._on = val === 'ON' || val === true || val === 1;
            });
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<button>${this.label || 'Toggle'}</button>`;
        }
        return html`
            <button class="${this._on ? 'on' : ''}" @click="${this._toggle}">
                ${this.label || 'Toggle'}
            </button>`;
    }

    _toggle() {
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? 'ON' : 'OFF');
        }
    }
}

customElements.define('feezal-element-my-toggle', FeezalElementMyToggle);
export { FeezalElementMyToggle };
```
