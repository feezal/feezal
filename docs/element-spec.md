# feezal Element Authoring Specification

This document is the single reference for building, publishing, and configuring `feezal-element-*` packages. Read it in full before writing a new element.

**Licensing:** the element base class `@feezal/feezal-element` and the viewer runtime your element runs inside are MIT-licensed — subclassing the base class does **not** place your element under feezal's AGPL (which covers only the server and editor). You may license and distribute your element packages under any terms you choose; the official `create-feezal-element` scaffolding defaults to MIT.

---

## 1. Package conventions

| Rule | Detail |
|---|---|
| npm scope | Must be published under an npm scope, e.g. `@yourscope/feezal-element-mywidget` |
| Element name | `feezal-element-<category>-<name>`, e.g. `feezal-element-basic-gauge` |
| Reserved categories | `basic` and `paper` are owned by the feezal project |
| One element per package | The package name, filename and custom-element tag name must all be identical. **Exception:** multi-element family packages, see §1.1. |
| Entry point | `package.json` `"main"` must point to the JS file that calls `customElements.define(…)` |
| Versioning | Bump the **patch** version in `package.json` with every change. Major versions are lockstep across all `@feezal/*` packages; minor/patch are independent. |

### 1.1 Multi-element family packages (N29 Phase B)

A themed element *family* may ship as **one package defining many custom-element tags**. The package is named with the **plural** prefix — `feezal-elements-<family>` (e.g. `@feezal/feezal-elements-metro`) — and declares its exposed tags in a load-bearing manifest in `package.json`:

```json
{
  "name": "@feezal/feezal-elements-metro",
  "main": "index.js",
  "keywords": ["feezal", "feezal-element", "feezal-elements", "mqtt", "dashboard"],
  "feezal": {
    "type": "elements",
    "elements": [
      "feezal-element-metro-tile",
      "feezal-element-metro-live-tile",
      "feezal-element-metro-appbar"
    ]
  }
}
```

- The entry point imports every element module and `customElements.define()`s **all** listed tags; a shared family base class is bundled once (the point of this shape over per-element packages).
- `feezal.elements` lists the **tag names** the bundle defines. This manifest is how the editor palette, the `window.feezal.elements` registry and export tree-shaking learn which tags the package exposes — a tag not listed there is invisible to the editor.
- The individual tags keep the standard `feezal-element-<category>-<name>` form; each element follows every other rule in this spec unchanged.
- `feezal.type` must be `"elements"`. (`"bundle"` is the N29 Phase A *aggregator* shape: a code-less package whose `feezal.elements` lists member **package names** installed separately.)
- Keywords: carry **both** `feezal-element` and `feezal-elements` so the package is found under the Elements and Sets filters of the in-editor package search.

See [element-families.md](element-families.md) for the family repo layout, publishing and dev workflow.

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
        validator: v => Boolean(v), // Optional; return false to mark input invalid
        // ── U39: structured inspector (all optional) ──
        section:  'Connection',   // Collapsible group heading (see §3.2.2)
        advanced: false,          // Tuck behind the section's "Advanced" disclosure
        visibleWhen: {attr: 'payload-mode', equals: 'separate'} // Conditional visibility (§3.2.2)
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
| `'objectList'` | Generic list editor for JSON-array attributes (U35) — see §3.2.1 |

Auto-detection rules (when `type` is omitted):
- Attribute name contains `color` → colour picker
- Attribute name is `subscribe`, `publish`, or contains `topic` → MQTT topic autocomplete
- Lit `static properties` declares the property as `Boolean` → checkbox
- Otherwise → text input

#### 3.2.1 `objectList` attributes (U35)

For attributes holding a **JSON array**, declare `type: 'objectList'` to get a comfortable list editor in the inspector — one row per item, ＋ add, per-row ✕ delete, drag-handle reordering — instead of a raw JSON string input:

```js
{name: 'options', type: 'objectList',
 itemFields: [{key: 'value'}, {key: 'label'}],
 help: 'One row per option.'}
```

- **`itemFields`** names the per-item fields and their input types: `{key, type?, options?, placeholder?}` with `type` one of `'string'` (default), `'number'` (emits numbers), `'color'` (text + swatch picker), `'select'` (requires `options`). Omitted → the canonical `[{key:'label'},{key:'value'}]` pair.
- **Bare-string arrays** (`["low","high"]`): declare a single field with an empty key — `itemFields: [{key: '', placeholder: 'preset'}]`.
- **The attribute stays the single source of truth:** the control parses/serializes the same JSON string attribute — source mode, MQTT `setattribute`, and saved views are untouched. An unparseable existing value falls back to a raw text input (never destroyed).
- The legacy `list: true` + `columns: ['a','b']` form still works (columns map to string-typed `itemFields`).

#### 3.2.2 Structured inspector — sections, conditional visibility, advanced (U39)

Attribute-heavy elements (dual-mode climate/cover cards, …) get a flat wall of ~25 fields, half irrelevant at any time. Three **optional** descriptor fields structure the standard inspector — no per-element UI code, and elements that omit them render exactly as before (one flat list).

- **`section: 'Name'`** — groups the attribute under a collapsible heading. Attributes without a `section` stay in a leading, header-less group (so a partly-annotated element still looks natural). Groups appear in first-appearance order. Sections named **`Availability`** or **`Advanced`** (case-insensitive) **start collapsed**; all others start expanded. Collapse state is per-selection (not persisted).
- **`advanced: true`** — moves the field into its section's **"Advanced"** disclosure (collapsed), for rarely-touched knobs like the `message-property-*` twins.
- **`visibleWhen`** — show the field only when another attribute has a given value. Shape:
  ```js
  visibleWhen: {attr: 'payload-mode', equals: 'separate'}   // single value
  visibleWhen: {attr: 'mode', equals: ['heat', 'auto']}      // any-of (array)
  visibleWhen: [{attr: 'payload-mode', equals: 'separate'},  // array of conditions = AND
                {attr: 'show-valve',  equals: true}]
  ```
  `equals` is compared against the controlling attribute's **effective** value (its inline value, else its descriptor `default`), with boolean/number coercion (`true`/`'true'`, `1`/`'1'` match). A section with no currently-visible fields is not rendered. Re-evaluated live as the user edits the controlling attribute.

**Multi-select** (U17): grouping/visibility operate on the already-intersected attribute set, evaluated against the primary element's values.

**Reference:** `glass-climate` — `payload-mode` gates the json vs separate topic sets via `visibleWhen`, the `message-property-*` twins are `advanced`, and Setpoint/Display/Availability sections tidy the rest.

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

#### Style groups — custom style editors (N34)

A `styles` entry may declare a **virtual group** instead of a single property. The Style inspector then renders a custom editor widget in place of a value row — the CSS counterpart of the §3.8 custom attribute inspector:

```js
styles: ['top', 'left', 'width', 'height',
    {group: 'background', editor: 'feezal-style-editor-background', label: 'Background'}]
```

- `group` — a virtual id, **not** a real CSS property. The entry owns a whole CSS longhand *family*.
- `editor` — the custom-element tag the inspector mounts (`document.createElement(tag)`, exactly like §3.8). The widget receives the selection via `.elements` (primary element in `.element`) and should surface a "mixed" state on multi-select rather than silently showing the first element's values.
- `label` — heading shown above the widget (defaults to the group id).
- `covers` *(optional)* — the longhand properties the group owns. Usually omitted: the editor class declares them via `static covers = [...]`; an explicit descriptor list wins.

The inspector **suppresses** the covered longhands everywhere else — they don't appear as stray custom-property rows and the "Add CSS property" field refuses them. The widget emits a **multi-property** change event applied atomically to every selected element (one history checkpoint):

```js
this.dispatchEvent(new CustomEvent('feezal-style-changed', {
    detail: {props: {'background-image': "url('/a.jpg')", 'background-size': 'cover', 'background-color': null}},
    bubbles: true, composed: true,
}));   // null/'' removes the property
```

Only longhands should be written (never a shorthand) so the values round-trip cleanly back into the widget's fields on re-select. When the inspector detects an out-of-band change to a covered longhand it calls the widget's optional `refresh()` method.

**First consumer:** `feezal-view` declares the `background` group; `feezal-style-editor-background` (editor bundle, `www/src/`) renders a unified Background editor with the modes Solid colour (default — a free value input accepting hex/named/`var(--…)` plus a resolving swatch, like the element colour-var rows; empty = theme default `var(--primary-background-color)`) / Image (size/repeat/3×3 position anchors) / Gradient (linear/radial builder with ordered colour stops and live preview). Built-in group editors are authoring UI and live in `www/src/` — an element package may also ship its own editor tag (it resolves through `customElements` just like §3.8 inspectors).

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

#### Topic fields: use `feezal-topic-input` (B28)

Every MQTT-topic field in a custom inspector must offer the same server-backed autocompletion as the generic attribute inspector. Don't wire that up per element — use the shared component from the base package:

```js
import '@feezal/feezal-element/feezal-topic-input.js';
```

```js
html`<feezal-topic-input size="small" label="Subscribe"
    placeholder="mqtt/topic"
    value="${this._val('subscribe')}"
    @sl-change="${e => this._emit('subscribe', e.target.value)}"></feezal-topic-input>`
```

It wraps an `sl-input` and adds the completion dropdown (debounced fetch of `/api/topics/completions`, arrow-key navigation, Enter to pick, descend on intermediate `topic/` completions, Escape/Tab to dismiss). `value` is kept in sync and composed `sl-input`/`sl-change` events are re-emitted, so handlers reading `e.target.value` work exactly as with a plain `sl-input`. Pass `label` for an sl-input label, or keep rendering your own `<label>` above it and omit the attribute.

---

## 4. MQTT topic binding

### 4.0 Naming convention: the `subscribe` attribute

Every element's **primary** MQTT subscription **must** use the attribute named `subscribe` — the one inherited from `FeezalElement`. This name is not arbitrary: `FeezalElement._subscribe()` uses it for two things:

1. **Primary state** — a message on the exact `<subscribe>` topic sets the element's `baseAttribute` (see below).
2. **A reserved runtime-control channel** — a small set of **distinct, exact** sub-topics that let any attribute, style property or CSS class be changed at runtime via MQTT:

   | Topic | Payload | Effect |
   |---|---|---|
   | `<subscribe>/setattribute` | object, e.g. `{ "icon":"wifi", "label":"Kitchen" }` | `setAttribute` for each key |
   | `<subscribe>/removeattribute` | `"icon"` or `["icon","label"]` | `removeAttribute` for each name |
   | `<subscribe>/setstyle` | object, e.g. `{ "color":"red", "opacity":"0.5" }` | merged into the element's inline style |
   | `<subscribe>/removestyle` | `"color"` or `["color","opacity"]` | removes each style property |
   | `<subscribe>/addclass` | `"name"` | `classList.add` |
   | `<subscribe>/removeclass` | `"name"` | `classList.remove` |

   The payload is read through `message-property` (default `payload`), so these honour the same extraction path as the primary topic. Because every control topic is an **exact** subscription (there is **no `<subscribe>/#` wildcard**), device telemetry published on sibling topics that happen to share the base topic — e.g. `<subscribe>/linkquality`, `<subscribe>/power`, `<subscribe>/update/...` — is **never** ingested and can never pollute the element.

> **Editor behaviour.** In the editor these subscriptions are gated by the *Editor settings → "Prevent MQTT element manipulation in editor"* toggle (default **on**), so live broker values are never written onto elements and serialized into the saved view. In the viewer they are always active.

This derived mechanism only works when the primary topic is stored in the base-class `subscribe` property.

| ✅ Correct | ❌ Wrong |
|---|---|
| `{name: 'subscribe', type: 'mqttTopic', ...}` | `{name: 'subscribe-state', ...}` |
| `{name: 'subscribe', type: 'mqttTopic', ...}` | `{name: 'subscribe-src', ...}` |
| `{name: 'subscribe', type: 'mqttTopic', ...}` | `{name: 'subscribe-value', ...}` |

**Single-topic elements** declare only `subscribe` as their MQTT attribute. **Multi-topic elements** use `subscribe` for the primary / most-important topic and `subscribe-<suffix>` for secondary topics.

When an element supports multiple modes (e.g. a JSON base-topic mode and a per-property separate-topic mode), the `subscribe` attribute must carry the primary topic in **both** modes. Its `help` text must clearly describe the role in each mode — for example: `'JSON mode: base topic carrying the full state object. Separate mode: on/off state topic.'`

**`baseAttribute`** ties messages arriving on the plain `<subscribe>` topic (no sub-path) to a specific element attribute. Declare it in `static get feezal()` when the primary topic sets something other than a generic reactive state (e.g. `baseAttribute: 'value'` for a number display element, `baseAttribute: 'src'` for a camera / image element).

### 4.1 Subscribing

Override `connectedCallback` and call `addSubscription`:

```js
connectedCallback() {
    super.connectedCallback();
    if (this.subscribe) {
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
// In feezal() attributes.
// Primary topic always uses 'subscribe' (inherited from FeezalElement base class).
// message-property is the paired path extractor for the primary topic.
{name: 'subscribe',                   type: 'mqttTopic', help: 'Primary state topic.'},
{name: 'message-property',            type: 'string',    default: 'payload',
    help: 'Dot-notation path within primary messages. Default: payload'},
// Secondary topics use subscribe-<suffix>:
{name: 'subscribe-brightness',        type: 'mqttTopic', help: 'Brightness topic.'},
{name: 'message-property-brightness', type: 'string',    default: 'payload',
    help: 'Dot-notation path within brightness messages. Default: payload'},
```

#### Lit property declaration

```js
static properties = {
    // subscribe and messageProperty are inherited from FeezalElement — no need to re-declare
    // unless you need to override their default attribute name (you should not).
    subscribeBrightness: {type: String, reflect: true, attribute: 'subscribe-brightness'},
    msgPropBrightness:   {type: String, reflect: true, attribute: 'message-property-brightness'},
};
```

#### Subscription usage — per-topic override with global fallback

```js
connectedCallback() {
    super.connectedCallback();
    const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
    // Primary topic (subscribe + message-property are inherited):
    sub(this.subscribe, msg => {
        this._state = this.getProperty(msg, this.messageProperty);
    });
    // Secondary topics:
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

### 4.5 Availability (N31) — free for every element

Device availability is **base-class machinery** — every element inherits it from `FeezalElement`, no element-level subscription code needed. The base subscribes, tracks per-topic status and combines it into the reactive **`this._available`** flag; in the viewer it additionally reflects an **`unavailable`** host attribute as a pure-CSS styling hook (never in the editor, where it would be serialized into the saved HTML). Rendering stays element business: which badge is shown and where is decided per family.

| Attribute | Default | Meaning |
|---|---|---|
| `subscribe-availability` | — | One topic (plain string), **or** a JSON array of topics / `{topic, property}` objects (the modern HA discovery form: bridge state + device availability) |
| `availability-mode` | `all` | `all` = every topic must report available; `any` = at least one |
| `payload-available` / `payload-unavailable` | `online` / `offline` | Payload matching; JSON `{"state": "..."}` payloads are unwrapped automatically (zigbee2mqtt) |
| `message-property-availability` | — | Dot-path fallback for all entries; a per-entry `property` wins |

Rules for element authors:

- **Never hand-roll an availability subscription** — read `this._available` in `render()` and show your family's badge. The optional shared helpers keep looks consistent: `import {feezalAvailabilityStyles, availabilityBadge} from '@feezal/feezal-element'` — compose `feezalAvailabilityStyles` into `static styles` and call `${availabilityBadge(this._available)}` in the template (themable via `--feezal-unavailable-*`).
- Declare the availability attributes in your `feezal.attributes` descriptor **only if** the element should show the fields in the inspector — the machinery works either way (discovery and source mode can always set them).
- **Discovery maps availability automatically**: the server normalises all HA wire forms (scalar `availability_topic`, the `availability` array, `availability_mode`) into a canonical record, and dropping a discovered device onto *any* element wires `subscribe-availability`/`availability-mode`/payloads without a single line in the element's `discovery.map`. Do not add `availability_topic` lines to new descriptors.
- Availability topics rewire live when the attributes change (base `updated()` handles it) and are independent of `_subscribe()` — elements that suppress the base subscription path still get availability.

### 4.6 Per-element conditions (E50) — free for every element

Every element (Lit **and** Polymer base) automatically supports a `conditions` attribute — a JSON list of rows that declaratively bind the element's **visibility, CSS classes, inline styles or attributes** to MQTT topics. There is **nothing an element author needs to do**: the shared engine (`feezal-conditions.js` in `@feezal/feezal-element`) subscribes, evaluates and applies effects on the host element. Authors should merely be aware that:

- any attribute they declare can be driven by a condition row (`action: "attribute"` uses plain `setAttribute`/`removeAttribute`, so Lit reflection applies it like an inspector edit);
- an attribute the element itself also rewrites at runtime is **last-writer-wins** — don't fight the engine, document the behaviour;
- effects are **viewer-only**; in the editor a badge (👁) marks conditioned elements and the Conditions inspector tab edits the rows;
- condition subscriptions follow the same `visible` / `dynamic-subscriptions` gating as regular ones.

Row schema and semantics (operators `=`, `!=`, `>`, `<`, `>=`, `<=`, `matches`; actions `show`/`hide` (AND-combined, optional `keep-layout`), `class`, `style`, `attribute`; unmatched rows revert to the element's pristine value; later matching rows win on conflicts) are documented in the header of `feezal-conditions.js`.

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

### 6.4 Guard publishes against editor mode

Elements **subscribe freely** in both editor and viewer mode — this is what drives the live WYSIWYG canvas. However, **publish / action methods must never fire in the editor**. Guard every handler that calls `feezal.connection.pub` or triggers side-effects:

```js
_onClick() {
    if (feezal.isEditor) return;   // ← guard publishes, not subscriptions
    if (this.publish) feezal.connection.pub(this.publish, this._on ? 'OFF' : 'ON');
}
```

Apply the same guard to any method that sends MQTT, triggers navigation, starts timers with side-effects, etc.

---

## 7. Editor vs. viewer mode

Since **N14 (live elements in editor)**, feezal elements subscribe and render live content in both editor and viewer mode. The canvas is a true WYSIWYG preview.

### What to do

- **Subscribe freely** — remove all `if (feezal.isEditor) return;` / `if (!feezal.isEditor && …)` guards from `connectedCallback` and subscription calls.
- **Render one unified template** — remove separate `if (feezal.isEditor)` render branches. The live template is the only template.
- **Unconfigured-state hints** — use null-coalescing to show a meaningful default when no MQTT data has arrived yet:
  ```js
  // Shows midpoint while unconfigured; real data takes priority
  const value = this._value ?? (feezal.isEditor ? 50 : null);
  ```
- **Guard publishes** — keep `if (feezal.isEditor) return;` inside every publish / action handler (§6.4).

### What NOT to do

- Do **not** add `if (feezal.isEditor)` branches in `connectedCallback` to skip subscriptions.
- Do **not** render a static placeholder instead of your element's real template.
- Do **not** use `feezal.isEditor` to substitute fake data for the entire render — only use it for unconfigured-state hints.

### Exception: `feezal-element-layout-view`

`feezal-element-layout-view` keeps its `isEditor` check to avoid recursive canvas rendering — embedding a live sub-view inside the editor would create an editing loop.

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
- [ ] **Registered in `www/package.json` `dependencies`** as `"@feezal/feezal-element-...": "*"` (sorted alphabetically). Missing this entry means Vite will not bundle the element.
- [ ] `customElements.define('feezal-element-…', …)` called in that file, exported as a named export.
- [ ] `static get feezal()` present with at minimum `palette.name`, `palette.category`, `palette.color`.
- [ ] Extends `FeezalElement` (or `LitElement` for pseudo-elements).
- [ ] **All reactive properties initialised in the constructor, not as class fields** (§6.1).
- [ ] camelCase properties mapping to kebab-case attributes declare `attribute: 'kebab-name'` (§6.3).
- [ ] Every `subscribe-*` attribute has a corresponding `message-property-*` attribute, all with `default: 'payload'` (§4.4).
- [ ] `--feezal-*` CSS custom properties declared in `styles` array and initialised in `:host` (§5.2).
- [ ] No `if (feezal.isEditor)` render branch — single unified template; unconfigured-state hints use null-coalescing (§7).
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
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    render() {
        return html`
            <button class="${this._on ? 'on' : ''}" @click="${this._toggle}">
                ${this.label || 'Toggle'}
            </button>`;
    }

    _toggle() {
        if (feezal.isEditor) return;   // never publish in editor
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }
}

customElements.define('feezal-element-my-toggle', FeezalElementMyToggle);
export { FeezalElementMyToggle };
```
