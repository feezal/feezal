# feezal Element Authoring Specification

This document is the single reference for building, publishing, and configuring `feezal-element-*` packages. Read it in full before writing a new element.

---

## 1. Package conventions

| Rule | Detail |
|---|---|
| npm scope | Must be published under an npm scope, e.g. `@yourscope/feezal-element-mywidget` |
| Element name | `feezal-element-<category>-<name>`, e.g. `feezal-element-basic-gauge` |
| Reserved categories | `basic` and `paper` are owned by the feezal project |
| One element per package | The package name, filename and custom-element tag name must all be identical |
| Entry point | `package.json` `"main"` must point to the JS file that calls `customElements.define(…)` |
| Versioning | Bump the **patch** version in `package.json` with every change. Major versions are lockstep across all `@feezal/*` packages; minor/patch are independent. |

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

- `addSubscription(topic, callback)` — subscribe to an MQTT topic; automatically cleaned up on `disconnectedCallback`.
- `getProperty(msg, propertyPath)` — extract a nested value from an MQTT message object using dot-notation (e.g. `'payload.state'`).
- `_payloadCast(type, payload)` — coerce a raw MQTT string payload to a JS type.
- `this.messageProperty` — the resolved global message-property attribute (default: `'payload'`).
- Standard MQTT lifecycle: subscribes on `connectedCallback`, unsubscribes on `disconnectedCallback`.

Pseudo-elements (navigation, connection status overlays) that don't use MQTT may extend `LitElement` directly instead.

---

## 3. The `static get feezal()` descriptor

This is the single source of truth the editor uses to render the palette, attribute inspector, and style inspector. It must be a static getter returning a plain object.

```js
static get feezal() {
    return {
        palette:     { … },   // Editor palette entry (required)
        attributes:  [ … ],   // Attribute inspector fields
        styles:      [ … ],   // Style inspector fields
        description: '',      // Optional element-level help text
        links:       [ … ],   // Optional links shown in the help panel
        restrict:    { … },   // Optional resize constraints
        defaultStyle: { … },  // Optional initial inline styles applied on drop
        discovery:   { … },   // Optional HA MQTT autodiscovery descriptor (§3.7)
        inspector:   '…',     // Optional custom inspector tag name (§3.8)
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

**Palette categories** render in this fixed order in the sidebar: **Basic → Device → System → Material → Paper**.

| Category | Use for |
|---|---|
| `Basic` | General-purpose display and input widgets |
| `Device` | Device-control cards (light, climate, cover, lock, fan, …) |
| `System` | Infrastructure: connection status, navigation, availability |
| `Material` | MD3-themed display/input widgets that are not device-control cards |
| `Paper` | Paper-themed layout elements |

> The palette category is a plain string — it only controls grouping. The element tag may start with `feezal-element-material-*` while its `palette.category` is `'Device'`. Use `'Device'` for anything that represents and controls a physical device.

### 3.2 `attributes`

An array of attribute descriptors. Each entry may be either a plain string (attribute name only, text input, no extra config) or an object:

```js
attributes: [
    'subscribe',          // plain string — basic text input
    {
        name:     'my-attr',      // HTML attribute name (kebab-case), REQUIRED
        type:     'string',       // Control type — see table below
        options:  ['a', 'b'],     // Required when type is 'select'
        default:  '',             // Default value shown as placeholder in inspector
        help:     'Tooltip text shown next to the attribute label.',
        tooltip:  'HTML title on the input field.',
        min:      0,              // For type:'number' inputs
        max:      100,
        step:     1,
        textarea: false,          // Use a multi-line textarea instead of sl-input
        template: false,          // Store value in a <template> child, not as an attribute
        list:     false,          // Render as an editable key/value list (see §3.2.1)
        columns:  ['key','val'],  // Column names when list:true
        validator: v => Boolean(v) // Optional; return false to mark input invalid
    }
]
```

**Supported `type` values:**

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

Set `list: true` and `columns: ['col1', 'col2']` to render a sortable list of key/value rows. The value is stored as a JSON array string on the element attribute.

### 3.3 `styles`

An array of CSS property names (strings) or CSS custom property descriptors that the Style inspector exposes for this element.

```js
styles: [
    'top', 'left', 'width', 'height',        // position / size (always include these)
    'font-size', 'color', 'background',       // standard CSS property strings
    {
        property: '--feezal-widget-color',    // CSS custom property (see §5.2)
        type:     'color',
        default:  'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
        help:     'Accent colour for this element.'
    }
]
```

Properties in `CSS_ENUMS` (display, flex-direction, align-items, etc.) are automatically rendered as dropdowns.

**Every element that has meaningful colours should expose those colours as `--feezal-*` descriptors here** (see §5.2 for the full pattern and naming conventions).

### 3.4 `description` and `links`

Optional element-level documentation shown in a collapsible **Help** panel at the bottom of the Attributes inspector:

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

Inline CSS properties (camelCase) applied immediately when the element is dropped onto the canvas:

```js
defaultStyle: { width: '80px', height: '40px', textAlign: 'right' }
```

### 3.7 `discovery` — HA MQTT autodiscovery

Declare a `discovery` key to enable the feezal editor to auto-wire the element from a Home Assistant MQTT autodiscovery config message. This is what already-implemented elements like `feezal-element-material-switch` and `feezal-element-material-checkbox` use.

```js
discovery: {
    component: 'switch',               // HA discovery component type (string or string[])
    map: {
        // discovery key  →  element attribute name (string shorthand)
        //               or  {attr: 'name'} object form
        //               or  {attr: 'name', transform: 'transformName'}
        state_topic:    {attr: 'subscribe'},
        command_topic:  {attr: 'publish'},
        payload_on:     {attr: 'payload-on'},
        payload_off:    {attr: 'payload-off'},
        name:           'label',        // string shorthand = attribute name directly
        value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
    }
}
```

**Map value forms:**
- `'attr-name'` — string shorthand: discovery value written directly to the named attribute
- `{attr: 'attr-name'}` — explicit object form, same result
- `{attr: 'attr-name', transform: 'transformName'}` — apply a named transform before writing

**Available transforms:**
- `valueTemplateToPath` — converts a Jinja2 `value_template` (e.g. `{{ value_json.state }}`) to a dot-notation path (`state`). Always map `value_template → message-property` with this transform.

Map **only the attributes the element actually uses**. Discovery is applied as a one-time snapshot; the element persists a `discovery-id` attribute (a `reflect: true` Lit property) for future re-sync.

### 3.8 `inspector` — custom inspector

For elements with complex, repeating, or visual-layout configuration, replace the flat attribute form with a custom Web Component:

```js
inspector: 'feezal-element-my-widget-inspector'   // custom element tag name
```

The tag must be defined via `customElements.define` in the **same package file** — no separate registration needed. The style inspector (position, size, background, etc.) is still rendered below it automatically. The selected element reference is passed as a `.element` reactive property. Changes are written back by dispatching `feezal-attribute-changed` custom events:

```js
this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
    bubbles: true, composed: true,
    detail: { name: 'series', value: JSON.stringify(newSeries) }
}));
```

See §8.3 for custom inspector design guidelines.

---

## 4. MQTT topic binding

### 4.1 Subscribing

Override `connectedCallback` and call `addSubscription`:

```js
connectedCallback() {
    super.connectedCallback();
    if (!feezal.isEditor && this.subscribe) {
        this.addSubscription(this.subscribe, msg => {
            this._value = this.getProperty(msg, this.messageProperty);
        });
    }
}
```

`this.subscribe` is the inherited `subscribe` attribute from `FeezalElement`. Unsubscription is handled automatically on `disconnectedCallback`.

### 4.2 Publishing

Use `feezal.connection.pub(topic, payload)`:

```js
_onClick() {
    if (this.publish) {
        feezal.connection.pub(this.publish, this._on ? 'OFF' : 'ON');
    }
}
```

### 4.3 `message-property` — single-topic elements

Every element that subscribes to a topic must include the `message-property` attribute. It lets users extract a value from a nested JSON payload using dot-notation. The `FeezalElement` base class exposes this as `this.messageProperty` (default: `'payload'`).

```js
// In feezal() attributes:
{name: 'message-property', type: 'string', default: 'payload',
    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},

// In connectedCallback:
this.addSubscription(this.subscribe, msg => {
    const v = this.getProperty(msg, this.messageProperty);
    // …
});
```

### 4.4 Per-topic `message-property-*` — multi-topic elements

Elements with **multiple subscribe topics** must add a dedicated `message-property-<suffix>` attribute **for each topic**, alongside the global `message-property` which serves as a fallback.

#### Attribute declaration pattern

```js
// In feezal() attributes — always place message-property-* immediately after its subscribe-*:
{name: 'subscribe-state',             type: 'mqttTopic', help: 'State topic.'},
{name: 'message-property-state',      type: 'string',    default: 'payload',
    help: 'Dot-notation path within state messages. Default: payload'},
{name: 'subscribe-brightness',        type: 'mqttTopic', help: 'Brightness topic.'},
{name: 'message-property-brightness', type: 'string',    default: 'payload',
    help: 'Dot-notation path within brightness messages. Default: payload'},
```

#### Lit property declaration

```js
static properties = {
    subscribeState:      {type: String, reflect: true, attribute: 'subscribe-state'},
    msgPropState:        {type: String, reflect: true, attribute: 'message-property-state'},
    subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
    msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
};
```

#### Subscription usage — per-topic override with global fallback

```js
connectedCallback() {
    super.connectedCallback();
    if (feezal.isEditor) return;
    const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
    sub(this.subscribeState, msg => {
        this._state = this.getProperty(msg, this.msgPropState || this.messageProperty);
    });
    sub(this.subscribeBrightness, msg => {
        this._brightness = this.getProperty(msg, this.msgPropBrightness || this.messageProperty);
    });
}
```

#### Rules

- All `message-property-*` descriptors must have `default: 'payload'` — **never** `default: ''`.
- The global `message-property` acts as a site-wide default; per-topic attributes override it per channel.
- Place each `message-property-<suffix>` descriptor immediately after its `subscribe-<suffix>` in the attributes array for clarity.
- Add `message-property` to every element that subscribes, even simple single-topic ones.

---

## 5. CSS custom property conventions

### 5.1 Available theme variables

feezal themes and the Home Assistant theme integration inject these CSS custom properties:

| Variable | Purpose |
|---|---|
| `--primary-color` | HA-compatible primary accent colour |
| `--primary-text-color` | HA-compatible primary text colour |
| `--secondary-text-color` | HA-compatible secondary / muted text |
| `--primary-background-color` | HA-compatible page background |
| `--secondary-background-color` | HA-compatible card / panel background |
| `--accent-color` | HA-compatible secondary accent |
| `--error-color` | Error / alert state colour |
| `--warning-color` | Warning state colour |
| `--success-color` | Success / good state colour |
| `--info-color` | Informational state colour |
| `--feezal-color` | feezal primary text colour |
| `--feezal-bg` | feezal panel / element background |
| `--feezal-border` | feezal border colour |
| `--sl-color-primary-600` | Shoelace accent colour (fallback when HA theme vars are absent) |

Always use these variables as defaults rather than hardcoding hex values.

### 5.2 Exposing `--feezal-*` custom properties

Every element with meaningful colours must expose them as `--feezal-<element>-<role>` CSS custom properties so users can override them from the Style inspector and so they respond to the active feezal theme.

**Three-step pattern:**

**Step 1 — Declare in the `styles` array** (inspector shows a colour picker):

```js
styles: [
    'top', 'left', 'width', 'height',
    {property: '--feezal-widget-color', type: 'color',
     default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
     help: 'Accent colour for this element.'},
]
```

**Step 2 — Initialise in `:host`** with a fallback chain `(theme var → Shoelace var → literal)`:

```css
:host {
    --feezal-widget-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
}
```

**Step 3 — Wire all hardcoded colours** to the feezal var. For MD3 wrapper elements, route the MD system token:

```css
:host {
    --feezal-widget-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
    --md-sys-color-primary: var(--feezal-widget-color);   /* do NOT use sl-color directly here */
}
```

**Naming conventions:**

| Role | Suggested name suffix | Recommended default |
|---|---|---|
| Primary accent | `-color` | `var(--primary-color, var(--sl-color-primary-600, #0284c7))` |
| Active / on state | `-on-color` | `var(--primary-color, var(--sl-color-primary-600, #0284c7))` |
| Inactive / off state | `-off-color` | `var(--secondary-text-color, #9e9e9e)` |
| Idle / standby | `-idle-color` | `var(--secondary-text-color, #9e9e9e)` |
| Error / fault | `-error-color` | `var(--error-color, #d32f2f)` |
| Warning | `-warn-color` | `var(--warning-color, #ff9800)` |
| Text | `-text-color` | `var(--primary-text-color, var(--feezal-color, #333))` |
| Surface / background | `-surface-color` | `var(--feezal-bg, #fff)` |
| Border | `-border-color` | `var(--feezal-border, #e0e0e0)` |
| Badge / notification dot | `-color` (e.g. `--feezal-badge-color`) | `var(--error-color, #d32f2f)` |
| Icon | `-icon-color` | `var(--primary-text-color, var(--feezal-color, #555))` |

Keep the set **minimal and state-aware** — 2–5 vars per element is typically enough. Don't create a var for every visual detail.

### 5.3 Editor placeholder colours

Editor render-branch placeholders must use feezal vars rather than hardcoded hex values:

```css
/* WRONG */
.editor-ph { color: #1565c0; border: 1px solid #1565c0; background: rgba(21,101,192,0.06); }

/* CORRECT */
.editor-ph {
    color: var(--feezal-widget-color);
    border: 1px solid var(--feezal-widget-color);
    background: color-mix(in srgb, var(--feezal-widget-color) 8%, transparent);
}
```

Use `color-mix(in srgb, var(--feezal-widget-color) N%, transparent)` for subtle transparent tints of a CSS variable.

---

## 6. Lit 3 patterns and gotchas

### 6.1 Reactive properties — always initialise in the constructor

**Never** initialise reactive properties with class field syntax. Class fields run after the constructor and shadow Lit's prototype-level reactive setters, silently breaking reactivity.

```js
// ❌ WRONG — class field shadows the reactive setter
class MyEl extends LitElement {
    myProp = 'default';
}

// ✓ CORRECT — initialise in the constructor
constructor() {
    super();
    this.myProp = 'default';
}
```

This applies to **every** property listed in `static properties` — including `{state: true}` internal state properties. The `super()` call must come first.

### 6.2 `static properties` is a class field — that's fine

`static properties = { … }` is a static class field (on the class object, not on instances). It is **not** affected by the instance-field shadowing issue above. Using `static properties = { … }` and `static styles = [ … ]` is correct and idiomatic Lit 3.

### 6.3 camelCase ↔ kebab-case attribute mapping

Declare `attribute: 'kebab-name'` in `static properties` whenever the JS property name differs from the HTML attribute name:

```js
static properties = {
    msgPropState:  {type: String, reflect: true, attribute: 'message-property-state'},
    payloadOn:     {type: String, reflect: true, attribute: 'payload-on'},
    showLegend:    {type: Boolean, reflect: true, attribute: 'show-legend'},
};
```

Attribute names in `feezal.attributes` are always **kebab-case**. Lit property names and JS variable names may be camelCase.

### 6.4 Guard subscriptions against editor mode

Never call `addSubscription` in editor mode. The standard guard:

```js
connectedCallback() {
    super.connectedCallback();
    if (feezal.isEditor) return;
    // … addSubscription calls …
}
```

---

## 7. Editor vs. viewer mode

Use `feezal.isEditor` to branch between editor (placeholder) and viewer (live) rendering:

```js
render() {
    if (feezal.isEditor) {
        return html`
            <div class="editor-ph">
                <span style="font-family:'Material Icons'">widgets</span>
                ${this.label || 'My Widget'}
            </div>`;
    }
    // Live viewer rendering
    return html`…`;
}
```

The editor placeholder should:
- Give a clear visual cue of what the element will look like and what it does.
- Use `feezal.isEditor` conditionals to skip MQTT logic entirely.
- Use `--feezal-*` CSS vars for all colours (§5.3).

---

## 8. Best practices (lessons learned)

### 8.1 `message-property` discipline

- Add `message-property` to **every** element that subscribes, even simple single-topic ones. Users regularly publish JSON objects to topics that were previously plain values.
- For multi-topic elements, add `message-property-<suffix>` per topic immediately after its `subscribe-<suffix>` in the attributes array.
- **All** `default:` values on message-property attributes must be `'payload'` — never `''`.
- The fallback chain `this.msgPropX || this.messageProperty` ensures the global attribute works as a site-wide default while allowing per-topic overrides.
- Map `value_template → message-property` in the `discovery` descriptor using the `valueTemplateToPath` transform — this is the correct HA-to-feezal mapping.

### 8.2 Theme awareness

- **Never hardcode brand colours** (hex values or `--sl-color-*` vars) directly in styles. Always route through a `--feezal-*` custom property (§5.2).
- Expose meaningful colours in the `styles` descriptor array so users can override them from the inspector.
- Keep the CSS var set small and state-aware. The light element has 5 vars (on / off / surface / text / error) — enough to fully theme every visual state without overwhelming the inspector.
- Test the element under both light and dark feezal themes before publishing.

### 8.3 Custom inspectors

- **Build the custom inspector together with the initial element, never retrofit it** after the attributes list has grown. The flat form becomes unusable past ~8–10 attributes.
- A two-tab layout (**Topics** + **Config**) works well: *Topics* for subscribe/publish wiring, *Config* for behaviour settings (thresholds, payload mappings, display options).
- Use collapsible sections gated on **capability presence** (i.e. whether any topic attribute in that section is non-empty). Do not add `has-brightness` boolean toggles — derive section visibility from `subscribeBrightness !== ''`.
- Custom inspectors do **not** inherit the sidebar's Shoelace theming. Replicate the `::part(base|combobox|input|form-control-label)` CSS overrides used by the standard inspector to get correct dark-mode rendering.
- Set `autocomplete="off"` on every `sl-input` inside the custom inspector.
- The selected element is passed via a `.element` reactive property immediately after the inspector is inserted into the DOM. React to it in Lit as a standard reactive property.
- Dispatch `feezal-attribute-changed` events (bubbles, composed, `detail: {name, value}`) to write changes back — the sidebar handles them identically to built-in controls.

### 8.4 Device-control cards

A device-control card is an element that represents and controls a physical or virtual device (light, climate, cover, lock, fan, …). Checklist for building one from scratch:

1. **Category is `Device`** in `palette.category`, even if the element tag starts with `feezal-element-material-*`.
2. **Ship a custom inspector from day one** (§8.3). Two tabs, capability-gated collapsible sections. Never retrofit.
3. **Per-topic `message-property-*`** for every `subscribe-*` attribute (§4.4).
4. **Declare `discovery`** for the relevant HA MQTT component so auto-wiring works without user friction (§3.7).
5. **Expose `--feezal-<elem>-*` CSS vars** for each meaningful state (on, off, idle, error, text). Default to theme vars; never hardcode hex (§5.2).
6. **Availability badge (optional)**: `subscribe-availability` + `payload-available` / `payload-unavailable` drives a small corner badge. **Never disable interactive controls** when the device is unavailable — the card stays usable.
7. **Ground the design in a real device.** Connect to an actual device (e.g. via zigbee2mqtt) and model the real topic shapes, payload formats, and edge cases. This surfaces nuances (nested JSON, unit conversions, missing fields) that a theoretical design misses.

### 8.5 HA autodiscovery descriptor

The `discovery` descriptor lets the editor auto-wire the element from a retained HA config topic. Keep it accurate and minimal:

- Map only the attributes the element actually consumes.
- Always include `value_template → {attr: 'message-property', transform: 'valueTemplateToPath'}` for subscribing elements.
- Use `{attr: 'subscribe'}` not just `'subscribe'` when the map value needs to be explicit about writing to an attribute; the string shorthand works equally well for simple cases.
- `discovery-id` must be a `reflect: true` Lit property so it persists across saves.

---

## 9. Publishing checklist

Before committing or publishing a new or modified element, verify:

- [ ] `package.json` name follows `@scope/feezal-element-category-name`.
- [ ] `"main"` points to the element JS file.
- [ ] `customElements.define('feezal-element-…', …)` called in that file, exported as a named export.
- [ ] `static get feezal()` present with at minimum `palette.name`, `palette.category`, `palette.color`.
- [ ] Extends `FeezalElement` (or `LitElement` for pseudo-elements).
- [ ] **All reactive properties initialised in the constructor, not as class fields** (§6.1).
- [ ] camelCase properties mapping to kebab-case attributes declare `attribute: 'kebab-name'` (§6.3).
- [ ] Every `subscribe-*` attribute has a corresponding `message-property-*` attribute, all with `default: 'payload'` (§4.4).
- [ ] `--feezal-*` CSS custom properties declared in `styles` array and initialised in `:host` (§5.2).
- [ ] Editor placeholder `render()` branch exists and uses feezal CSS vars for colour (§5.3).
- [ ] `discovery` declared if the element can be auto-wired from HA MQTT autodiscovery (§3.7).
- [ ] `palette.category` is `'Device'` for device-control cards (§3.1).
- [ ] Patch version bumped in `package.json`.

---

## 10. Worked example — toggle button

A complete, minimal element demonstrating all required patterns.

```js
/* global feezal */
import { FeezalElement, feezalBaseStyles, html, css } from '@feezal/feezal-element';

class FeezalElementMyToggle extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Toggle', category: 'Basic', color: '#4a6080', icon: 'toggle_on'},
            description: 'A toggle button that subscribes to and publishes ON/OFF.',
            attributes: [
                {name: 'subscribe',        type: 'mqttTopic', help: 'Topic to read the current state from.'},
                {name: 'message-property', type: 'string',    default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'publish',          type: 'mqttTopic', help: 'Topic to publish ON or OFF to.'},
                {name: 'label',            type: 'string',    help: 'Button label text.'},
                {name: 'payload-on',       type: 'string',    help: 'Payload for ON state. Default: ON'},
                {name: 'payload-off',      type: 'string',    help: 'Payload for OFF state. Default: OFF'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-toggle-color', type: 'color',
                 default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                 help: 'Active state colour.'},
            ],
            defaultStyle: {width: '100px', height: '40px'},
        };
    }

    static properties = {
        label:      {type: String,  reflect: true},
        publish:    {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        _on:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            --feezal-toggle-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
        }
        button {
            flex: 1; cursor: pointer;
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; font: inherit;
        }
        button.on {
            background: var(--feezal-toggle-color);
            border-color: var(--feezal-toggle-color);
            color: #fff;
        }
        .editor-ph {
            flex: 1; display: flex; align-items: center; justify-content: center;
            border: 1px solid var(--feezal-toggle-color); border-radius: 4px;
            font-size: 13px; color: var(--feezal-toggle-color);
            background: color-mix(in srgb, var(--feezal-toggle-color) 8%, transparent);
        }
    `];

    constructor() {
        super();
        // All reactive properties MUST be initialised here, never as class fields
        this.label      = 'Toggle';
        this.publish    = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this._on        = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph">${this.label || 'Toggle'}</div>`;
        }
        return html`
            <button class="${this._on ? 'on' : ''}" @click="${this._toggle}">
                ${this.label || 'Toggle'}
            </button>`;
    }

    _toggle() {
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }
}

customElements.define('feezal-element-my-toggle', FeezalElementMyToggle);
export { FeezalElementMyToggle };
```
