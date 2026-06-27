# Implemented and archived Items of ROADMAP.md

## Bugs

### B3 — Event listener leak on disconnectedCallback ✅ fixed
Components do not clean up MQTT subscriptions and event listeners when removed. In long-running sessions this will accumulate stale listeners.
- `feezal-app-editor.js`: copy/paste/cut document handlers now stored as named instance properties and removed in `disconnectedCallback` ✅
- `feezal-sidebar-inspector.js`: `connected` event handler stored as `_onConnected` and removed in `disconnectedCallback`; `_keyboard()` guarded by `_keyboardBound` flag so only one keydown listener is ever registered; `_keyHandler` stored and removed on disconnect ✅

### B5 — Snapping does not work during resize ✅ fixed
Root cause: `.resizable()` was using the `snap` modifier instead of `snapSize`. The `snap` modifier passes pointer coordinates, but `_snapSize()` expected element dimensions (width/height). Switched to `snapSize` modifier — the logic in `_snapSize` was already correct for that input format.

### B6 — feezal-element-basic-view renders content invisible ✅ fixed
`_viewChanged()` used `view.outerHTML` to clone the target `feezal-view` into the element's shadow DOM. Since inactive views have `style="display: none"` set on them by `feezal-site.updateVisibility()`, the clone inherited that inline style and rendered blank. Fixed by switching to `cloneNode(true)` and clearing `display` on the clone before insertion.

### B7 — Clicking empty canvas space does not deselect elements ✅ fixed
Clicking on an unoccupied area of the view canvas does not clear the current selection. Expected behaviour: a click on empty canvas space deselects all elements, reverts the inspector to the view's own attributes/styles, and restores the view as the "selected" context (same state as just after switching to a view with no prior selection). Currently the selection remains sticky after such a click.

### B9 — Snap helper lines: misalignment, broken 2-axis snap, and UX clutter ✅ fixed

Three related problems with the element-alignment helper lines shown during drag:

**1 — Line misplacement**
Helper lines sometimes appear at the wrong pixel position — they do not align with the actual edge or centre of the reference element they are supposed to represent. Likely caused by the helper-line coordinates being computed in one coordinate space (e.g. relative to the view element) but rendered in another (e.g. relative to the viewport or the editor chrome), without accounting for scroll offset or the view's own `getBoundingClientRect()` offset.

**2 — 2-axis snap does not work simultaneously**
When the dragged element is close to a snap position on both axes at the same time (e.g. aligned to another element's left edge *and* its top edge simultaneously), only one axis snaps — the other drifts freely. The two snap constraints must be evaluated and applied independently for each axis so both can be active at the same time. interact.js supports multiple modifiers stacked; the current implementation likely applies a single combined snap that races between axes.

**3 — Helper line UX clutter at small grid sizes**
When many elements are present on the canvas or the grid size is small, too many candidate helper lines appear simultaneously, making the canvas visually noisy and the intended snap target ambiguous. 

**Target UX behaviour:**
- Show at most **one horizontal and one vertical helper line at a time** — the nearest snap candidate on each axis independently.
- Apply a **minimum pixel distance threshold** (configurable, default ~4 px on screen) below which a snap candidate is ignored rather than shown as a faint noisy line.
- **Fade out** helper lines when the drag pointer moves away from the snap zone (CSS opacity transition), rather than popping them on/off instantly.
- Helper lines must extend **across the full canvas width/height**, not just to the bounding box of the reference element, so they are readable regardless of zoom or scroll position.

**Files to investigate:** `feezal-sidebar-inspector.js` — the drag `move` event handler and helper-line rendering logic.

---

## Near-term Improvements

### N1 — Attribute & style editor: autocomplete and smart controls ✅ done
- **MQTT topic autocomplete** (hierarchical) ✅
- **Enum dropdowns**: properties with a known value set show a `<select>` ✅
- **Color fields**: colour picker + CSS var autocomplete in style inspector ✅
- **Boolean Attributes and Properties**: render a checkbox ✅
- **CSS property name autocomplete**: 'Add CSS property' input at the bottom of the Styles tab with a dropdown of ~80 common property names ✅
- **Custom style persistence**: custom properties added via 'Add CSS property' survive re-selection and page reload (rehydrated by parsing the element's `style` attribute) ✅
- **Remove button**: each custom style row has a × button that removes the property from the element and the inspector ✅
- **Half-width pairing**: `top`/`left` and `width`/`height` render side-by-side in the Styles tab ✅
- **Reserved property filter**: `cursor` and `z-index` are hidden from the inspector (editor-internal properties) ✅

### N2 — Repeater element (MVP) ✅ done
A wrapper element that appears in the editor as a **single opaque block**. Its inspector lets you configure a child element type and an attribute mapping from payload keys to element attributes.

**Runtime behaviour:**
The repeater subscribes to a configured `subscribe`. Whenever a new message arrives on that topic its payload (an array of objects) replaces the current child list — old children are destroyed, new ones are created. This makes the list fully live: push an updated lamp array from your automation and the dashboard reflects it immediately with no page reload.

```
subscribeTopic: "lamps"  →  payload: [
  { subscribeTopic: "lamp/1/state", publishTopic: "lamp/1/set", label: "Kitchen" },
  { subscribeTopic: "lamp/2/state", publishTopic: "lamp/2/set", label: "Living room" }
]
```

Each item in the array is mapped to attributes on the child element via a configurable key→attribute map stored as a JSON attribute on the repeater in `views.html`. Child elements are standard feezal elements — they receive their own `subscribeTopic` / `publishTopic` and wire up to MQTT independently.

**Diffing:** on payload update the repeater diffs the new array against the current children by a configurable key field (e.g. `id`, `subscribeTopic`) to avoid unnecessary destroy/recreate cycles for unchanged items.

**Editor:** at edit time with no live payload flowing, a configurable preview count renders placeholder children so you can see the approximate layout.

### N3 — More dashboard themes ✅ done
Extend the built-in theme collection with additional colour palettes:
- **Gruvbox Dark** — warm retro dark colours (`feezal-theme-gruvbox-dark`) ✅
- **Gruvbox Light** — warm retro light colours (`feezal-theme-gruvbox-light`) ✅
- **Solarized Dark** — Ethan Schoonover's precision colour scheme, dark variant (`feezal-theme-solarized-dark`) ✅
- **Dark Orange** — dark theme with orange accent (`feezal-theme-dark-orange`) ✅
- **Light Orange** — light theme with orange accent (`feezal-theme-light-orange`) ✅

Each theme ships as a CSS file that defines the full set of `--feezal-*` custom properties used by all built-in elements and the viewer chrome. The theme switcher in the sidebar automatically picks them up — no code changes needed in the editor.

### N5 — Asset Manager ✅ done
Upload and manage images, icons, and other static assets (SVG, audio) from within the editor. Assets are stored under `<dataDir>/assets/` and served at `/feezal/assets/`. As the main focus are images i would like to have a tile view and a directory picker above. we need to separate assets into 2 categories: global and site. global assets should be available for every site and be bundled into every export. site assets should be specific to a site and only bundled in export for this site. the paths which is used in e.g. the img src attribute should be global/img.png or assets/img.png. second step: a new feezal-element-basic-image and the possibility to just drag&drop a image from the asset manager on a view, it should the create the feezal-element-basic-image with correct src path. asset manager should have a nice treeview, the possibility to move files/folders by drag&drop, renaming, deletion, ...


### N7 — MQTT connection configuration UI ✅ implemented
Replaced the free-form URL input in the Connection sidebar with a structured form: **Protocol** (sl-select: mqtt/mqtts/ws/wss), **Host**, **Port**, **Username**, **Password** (masked). The URI is derived from these fields and still stored as `connection.uri` for backward compatibility. Advanced fields (Last Will, On Connect) remain in collapsible sections below the broker details.


## Element Ecosystem

### E1 — Migrate feezal-element-basic-* from Polymer to Lit ✅ implemented
`datetime`, `iframe`, `number`, `template`, `view` — all still on Polymer 3.
Because we don't want to break the polymer based elements lets refine how we can do this


### E2 — New modern element set ✅ implemented
Supplement the `paper-*` set (kept for back-compat) with a new generation of elements built on **`@material/web`** (Material Design 3) + custom Lit.

**Why `@material/web`:**
- Literally built on `LitElement` — same class hierarchy, zero architecture friction.
- Material Design 3 aesthetic: modern, polished, "hip" without being heavy or opinionated about layout.
- Tree-shakeable — each component is a separate import; only what's used ends up in the bundle.
- Provides all interactive primitives out of the box: `md-switch`, `md-slider`, `md-button`, `md-checkbox`, `md-outlined-text-field`, `md-select`, `md-chip`, `md-dialog`, …
- Theming via CSS custom properties (`--md-sys-color-*`) maps cleanly into feezal's existing theme system.

**Division of labour:**
- **`@material/web`**: interactive controls (switch, slider, button, input, select, chip, badge).
- **Custom Lit**: dashboard-specific display elements (value tile, gauge, status light, sparkline, progress ring) that have no good analogue in any component library.

`paper-*` elements remain available and loaded only when actually used on a site — no forced removal.

### E3 — Element authoring template / CLI ✅ done
A scaffolding tool (`pnpm create feezal-element my-element`) that generates a minimal element package with the correct `static get feezal()` descriptor, Lit base class, and a README.

### E5 — Connection status element ⚡ high priority  ✅ implemented
A **pseudo-element** dropped onto the canvas like any other element. In the editor it renders as an invisible placeholder (labelled "Connection Status") — position and size on the canvas are irrelevant. In the viewer it renders a disconnection overlay anchored to the viewport, not to its canvas position.

**Decided:** user-placed, configurable. Inspector exposes the following attributes:

| Attribute | Type | Default | Description |
|---|---|---|---|
| `display` | `banner` \| `dialog` | `banner` | Layout style of the notification |
| `position` | `top` \| `bottom` | `top` | Banner attachment edge (ignored for dialog) |
| `backdrop` | boolean | `false` | Show a semi-transparent overlay behind the notification |
| `backdrop-opacity` | number 0–1 | `0.5` | Opacity of the backdrop |
| `backdrop-color` | color | `#000000` | Color of the backdrop |
| `block-interaction` | boolean | `true` | Prevent clicks reaching the dashboard while disconnected |
| `title` | string | `Connection lost` | Heading text |
| `message` | string | `Reconnecting…` | Body text; `{countdown}` is replaced with the live reconnect countdown in seconds |
| `show-countdown` | boolean | `true` | Show the live reconnect countdown |
| `animate` | `none` \| `fade` \| `slide` | `fade` | Entry/exit animation |

The element subscribes to internal connection lifecycle events (connected / disconnected / reconnecting) — not an MQTT topic — so it fires even when the broker is completely unreachable. It disappears automatically when the connection is restored. Viewer-only; not active in the editor. Addresses A3.

### E6 — Chart element ✅ implemented (`feezal-element-basic-chart`)
Pure-SVG sparkline / line chart. Buffers incoming MQTT numeric payloads (up to `history` data points, default 50). Renders a polyline with an optional area fill and most-recent-value dot. Attributes: `subscribe`, `history`, `color`, `label`, `min`, `max`, `show-dots`, `fill`. No external library dependency.

### E8 — Navigation element ✅ implemented (`feezal-element-navigation`)
A visible canvas element that renders navigation buttons for switching between views. Editor shows a labelled placeholder. Viewer renders clickable buttons — one per view (filtered by `views` attribute). Responds to `hashchange` events, highlights the active view. Attributes: `views`, `orientation` (horizontal/vertical), `active-color`, `hide-tabbar`.

Configurable attributes:

| Attribute | Type | Default | Description |
|---|---|---|---|
| `views` | ordered list | *(all views)* | Which views appear as nav items and in what order |
| `orientation` | `horizontal` \| `vertical` | `horizontal` | Tab-bar style vs. sidebar style |
| `show-icons` | boolean | `false` | Show a configurable icon per view item |
| `show-labels` | boolean | `true` | Show the view name as label |
| `active-color` | color | *(theme accent)* | Highlight color for the active item |
| `hide-tabbar` | boolean | `false` | Automatically hides the built-in view tab bar when this element is present |

Each view entry in `views` can carry an optional icon name (Material icon or URL). The element highlights the currently active view and updates when the view changes by any means (swipe, URL hash change, programmatic switch).

### E16 — Light control element (`feezal-element-material-light`) ✅ implemented

A rich light-control element covering the full range of smart-light capabilities: on/off, brightness, colour temperature, and RGB colour.

**Visual concept:** a circular control combining a brightness arc (outer ring, draggable) with a colour temperature or RGB area in the centre. The ring colour tints to reflect the current light colour. A tap/click area in the centre toggles on/off. For lights that support only brightness (no colour), the centre shows the brightness percentage as text.

**Control modes (via `mode` attribute):** `brightness` / `color_temp` / `rgb` / `hs`.

**Controls implemented:** on/off toggle (centre tap), brightness ring drag (publishes on release), colour temperature gradient slider below circle (draggable, publishes on release), RGB/HS colour wheel in centre (tap to pick colour), RGBW/RGBWW white sliders (`md-slider`), effect selector (`md-outlined-select`).

**Default size:** 180×220 px.

---

## Editor UX

### U2 — Keyboard shortcuts ✅ done
`Delete` ✅, `Escape` ✅, `Ctrl+Z` undo ✅, `Ctrl+A` select all ✅, `Ctrl+C/V/X` copy/paste/cut ✅, arrow-key nudge ✅, `Ctrl+D` duplicate ✅, `?` shortcut-reference modal ✅. Still missing: `Ctrl+G` group (requires U3 grouping).

### U4 — Grid / snap settings ✅ implemented
Configurable grid size, snap-to-grid (off / elements / grid), and grid overlay toggle are all present in `feezal-sidebar-editor.js` and wired through `feezal-app-editor.js`.

### U5 — Copy/cut/paste elements ✅ implemented
Copy/paste toolbar buttons and `Ctrl+C` / `Ctrl+V` keyboard shortcuts are implemented in `feezal-app-editor.js` via an internal clipboard template. Cross-view paste works; cross-site paste is out of scope.

### U7 — Element help panel ✅ implemented
Each element's `static get feezal()` can carry a `description` and `links` field. When present, the Attributes tab shows a collapsible "Help" section with the description text and optional links. `feezal-element-connection-status` ships with an example description + link.

### U15 — CSS colour variable overrides panel ✅ done
A collapsible **"Colour overrides"** section in `feezal-sidebar-themes.js`, rendered directly below the theme dropdown. Lets users override the nine canonical CSS custom properties without editing any files.

**Variables exposed (in order):**
`--primary-background-color`, `--secondary-background-color`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--divider-color`, `--error-color`, `--primary-color`, `--accent-color`

**UX behaviour:**
- The section is **disabled** (inputs grayed out, tooltip "Select a theme first") when `currentTheme === 'default'`, because there are no theme-level defaults to show as placeholders.
- The collapsible title reads **"Colour overrides"** normally and **"Colour overrides · N active"** (with a coloured dot) when N variables have been overridden. The count lives in the title so the state is visible without expanding.
- Each row: label + `sl-input` (text) + `input[type=color]` colour picker (same pattern as the attribute inspector's color fields). When a value is set, a **× clear button** appears inline. While empty, the input shows the current theme's value as `placeholder` text (not pre-filled — so the field looks empty for "no override").
- Overrides are applied **live** (debounced ~150 ms) via `feezal.site.style.setProperty(varName, value)`. Inline style on `feezal-site` wins over class-level definitions by CSS specificity — no injection or class manipulation needed.
- **Theme switching preserves overrides.** The placeholder text refreshes to show the new theme's baseline value, but active overrides remain. This is intentional: the warning badge tells the user overrides are still active.
- Overrides are **cleared explicitly** only via the × buttons (per-variable) or a future "Reset all" link.

**Placeholder resolution:**
Extend `_sampleColors()` to read all 9 vars (not just the 3 for swatches). Store as `this._themeVars = { 'feezal-theme-solarized-dark': {'--primary-background-color': '#002b36', ...}, ... }`. Re-read when the theme changes. Must temporarily apply the theme class without active overrides to get the pure theme value — remove inline style properties first, read, then restore.

**Storage — `viewer.json`:**
`_deploy()` already serialises `{viewer: {theme: '...'}}`. Extend to:
```json
{
  "viewer": {
    "theme": "feezal-theme-solarized-dark",
    "themeOverrides": {
      "--primary-background-color": "#111111",
      "--primary-color": "#e94560"
    }
  }
}
```
`themesSidebar.theme` getter already exists; add `themesSidebar.themeOverrides` getter returning the active overrides object (or `{}` if none).

**Application in the viewer route (`server/src/app.js`):**
After the existing theme-class injection, read `config.viewer.themeOverrides` and inject:
```html
<style>feezal-site { --primary-background-color: #111111; --primary-color: #e94560; }</style>
```
into the `<head>` of the generated viewer HTML. Sanitise values (strip semicolons, quotes) before injection.

**Application in static export (`server/src/build/export.js`):**
`createExport()` already reads `config.viewer.theme` and patches the HTML. Add the same `<style>` injection immediately after. The CSS block is self-contained in the ZIP's `index.html` — no extra files needed.

**Loading saved overrides back into the editor:**
`siteReady()` in `feezal-sidebar-themes.js` (called after `getSite`) already sets `currentTheme`. Add: read `viewerConfig.themeOverrides`, apply each via `feezal.site.style.setProperty(...)`, and seed `this._overrides` state so the UI reflects the saved values.

**MD3 bridge (prerequisite / related):**
Add a base rule to the viewer bundle CSS (e.g. `www/src/viewer-main.js` or a shared CSS file imported by both editor and viewer bundles):
```css
feezal-site {
    --md-sys-color-primary:    var(--primary-color,             #1976d2);
    --md-sys-color-secondary:  var(--accent-color,              #ff5722);
    --md-sys-color-background: var(--primary-background-color,  #ffffff);
    --md-sys-color-surface:    var(--secondary-background-color,#f5f5f5);
    --md-sys-color-on-primary: var(--primary-text-color,        #212121);
    --md-sys-color-on-surface: var(--primary-text-color,        #212121);
    --md-sys-color-error:      var(--error-color,               #b00020);
}
```
This makes theme overrides propagate automatically to MD3 (`@material/web`) elements via the chain — no separate MD3 override fields needed in the UI.

### U16 — User-defined themes saved to `dataDir` ✅ done
Once U15 is working, add a **"Save as theme…"** button inside the overrides panel. Clicking it prompts for a theme name and POSTs the current 9-variable values to a new server endpoint, persisting them as a named theme in the data directory — decoupled from `www/node_modules/`.

**Storage — `dataDir/themes/<slug>.css`:**
Pure CSS, no JS wrapper:
```css
.feezal-theme-my-corporate {
    --primary-background-color: #1a1a2e;
    --primary-color: #e94560;
    /* remaining 7 vars */
}
```
Filename is derived from the name the user enters: lowercase, spaces→hyphens, prefix `feezal-theme-`. Class name matches filename slug.

**Server discovery (`server/src/build/elements.js` or `app.js` startup):**
Scan `dataDir/themes/*.css` alongside `www/node_modules/@feezal/feezal-theme-*/`. Serve user themes at `/feezal/themes/<slug>.css`. In the viewer route, inject `<link rel="stylesheet" href="/feezal/themes/<slug>.css">` before the `<style>` overrides block when the active theme is a user theme.

**Editor discovery:**
The `feezal.themes` array (populated at startup from `GET /api/elements`) should include user themes. Add a visual distinction in the dropdown (e.g. a small pencil icon or "custom" badge) to distinguish user-defined themes from npm themes.

**Export handling:**
When a user theme is active, `createExport()` must read `dataDir/themes/<slug>.css` and inline it as a `<style>` block in `index.html` — the ZIP must be self-contained. No `<link>` tag, since there's no server to serve it from.

**Management:**
- Rename / delete user themes from the theme dropdown (small ⋮ or pencil icon per custom theme entry).
- Editing a user theme re-opens the overrides panel pre-seeded with that theme's values; saving updates the CSS file.

### ✅ U17 — Multi-select inspector: attribute intersection + mixed-value display

When multiple elements are selected, both the **Attributes** and **Styles** inspector tabs should reflect the full selection rather than silently showing only the first element's state.

#### Attribute inspector (`feezal-sidebar-inspector-attributes.js`)

**Which attributes to show — intersection:**
`_rebuildItems()` currently reads `cls.feezal.attributes` from `selectedElems[0]` only. With multi-select, compute the intersection of attribute names across all selected element classes:
```js
const allAttrSets = selectedElems.map(el =>
    new Set((window.customElements.get(el.localName)?.feezal?.attributes || [])
        .map(a => typeof a === 'string' ? a : a.name)));
const sharedNames = allAttrSets.reduce((acc, set) => new Set([...acc].filter(n => set.has(n))));
```
Use the attribute *spec* (control type, options, help text) from the first element that declares it — shared attributes like `subscribe`/`publish` are always spec-compatible across elements. The injected `locked` attribute is always shown (it exists on every non-view element by definition).

**Value display — mixed state:**
After computing the intersection, read each attribute's value from *all* selected elements. Add a `mixed: boolean` flag to each item in `this.items`:
```js
const values = selectedElems.map(el => el.getAttribute(attrName) ?? (isBool ? 'false' : ''));
const mixed = values.some(v => v !== values[0]);
const value = mixed ? null : values[0];
```

**Mixed visual treatment per control type:**
| Control | Mixed rendering |
|---|---|
| `sl-input` / `sl-textarea` | Empty value + `placeholder="— varies —"` + faint amber left border |
| `sl-select` (dropdown) | No selected option + placeholder visible |
| `sl-checkbox` | `?indeterminate="${item.mixed}"` — renders a dash square (native browser behaviour, Shoelace supports this) |
| Color picker | Text input shows `— varies —`, color swatch shows neutral `#808080` |
| MQTT topic input | Same as `sl-input` |

Add a CSS rule for the mixed state (separate from `.invalid`):
```css
.attr.mixed sl-input::part(base),
.attr.mixed sl-select::part(combobox),
.attr.mixed sl-textarea::part(textarea) {
    border-color: var(--feezal-border, #ccc);   /* neutral, not red */
    opacity: 0.75;
}
```

**Editing from mixed state:**
- User types a value and commits → `setAttribute(attr, value)` on **all** selected elements (existing `_change()` loop already does this — no change needed).
- User clears the field (commits empty string) → `removeAttribute(attr)` on all selected elements. Explicit empty = "remove from all". This is the intended design decision.
- After any edit the `mixed` flag is cleared on that item and the value is shown normally.

#### Style inspector (`feezal-sidebar-inspector-styles.js`)

`setStyle()` already performs an `allEqual` check during drag and blanks the field when values differ — this is partial infrastructure. `_selectedElemsChanged()` still reads only from `selectedElems[0]` on initial load.

**Which style properties to show:**
- **Declared styles** (`cls.feezal.styles`): intersection across all selected element classes.
- **Inline custom properties** (properties parsed from the element's `style` attribute beyond the declared set): **union** of properties present on *any* selected element. Show with `mixed: true` for properties not present on all elements. Rationale: hiding them would mean you might not realise you can set/clear them across the selection from one place.

**Value reading on load:**
Extend `_selectedElemsChanged()`:
```js
const allVals = selectedElems.map(el => el.style.getPropertyValue(prop).trim());
const mixed = allVals.some(v => v !== allVals[0]);
const value = mixed ? '' : allVals[0];
// store mixed flag alongside value in the items array
```

`setStyle()` (called during drag) already does the same `allEqual` → blank logic; extend it to also set/clear the `mixed` flag on those items.

**Mixed visual treatment:** same amber-left-border + `placeholder="— varies —"` pattern as the attribute inspector. Enum `sl-select` fields show no selection.

**"Add property" row:** unchanged — adding a new CSS property always applies to all selected elements (already correct).

### U18 — CSS Classes ✅ done *(supersedes U8 Style Mixins)*

Redesign of the existing localStorage-based mixin system into a proper CSS-class mechanism. User-facing name throughout the UI: **"Classes"**.

#### Concept

Each class is a named bundle of CSS properties stored in `viewer.json`. At runtime a `<style>` block is injected (in the editor and in the viewer) with one rule per class:
```css
.feezal-class-card      { border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
.feezal-class-danger-bg { background: #c62828; color: #fff; }
```
Applying a class to an element adds the corresponding CSS class name to the element's `class` attribute. Removing it removes the class name. Inline styles win over class rules by normal CSS specificity — no `!important` needed.

**Conflict handling on apply:** when a class is applied, any inline style properties that the class also defines are removed from the element's `style` attribute. This lets the class value show through immediately. The user can re-add an inline override afterward to customise a single element. A brief info note in the inspector confirms the removal: *"Inline styles for properties controlled by this class have been cleared."*

#### Storage — `viewer.json`

```json
{
  "viewer": {
    "theme": "feezal-theme-solarized-dark",
    "themeOverrides": { ... },
    "classes": {
      "card":      { "border-radius": "8px", "box-shadow": "0 2px 6px rgba(0,0,0,.2)" },
      "danger-bg": { "background": "#c62828", "color": "#fff" }
    }
  }
}
```

Replaces `localStorage` key `feezal-mixins-<siteName>`. Existing localStorage mixins are silently dropped on upgrade (one-time migration cost accepted). Classes are saved on deploy and loaded in `siteReady()`.

#### Class editor — themes page (`feezal-sidebar-themes.js`)

New collapsible section **"Classes"** below "Colour overrides" (U15). The section contains:
- A list of existing classes, each as an expandable card: **class name** as header, CSS property rows inside (same add/edit/remove UX as the style inspector's custom properties section — reuse or extract a shared `FeezalCssPropEditor` component).
- **"+ New class"** button: shows a name input, then opens an empty card.
- Rename and delete (× button) per class card.
- Live preview: editing a class property updates the injected `<style>` rule immediately; all canvas elements carrying that class reflect the change in real time.

The CSS property editor inside each card is the same as the style inspector's custom properties:
- Property name input with autocomplete (`CSS_PROP_NAMES` list + `--` CSS-var autocomplete)
- Value input with CSS-var autocomplete dropdown
- Color picker swatch for color properties
- × remove row button

#### Class selector — style inspector (`feezal-sidebar-inspector-styles.js`)

Replace the current "Style Mixins" section with a compact **"Classes"** row:
- `sl-select` with `multiple` enabled, listing all available class names.
- Currently-applied classes (read from the element's `class` attribute, filtered for `feezal-class-*` entries) are pre-selected.
- Selecting a class → apply (add CSS class, strip conflicting inline styles, show info note).
- Deselecting a class → remove CSS class name from the element.
- The `+ Save` / save-current-styles-as-mixin flow is **removed** (class authoring lives on the themes page only).

#### Viewer route + export (`server/src/app.js`, `server/src/build/export.js`)

Both already inject theme and override styles. Add class injection in the same location:
```html
<style>
  .feezal-class-card { border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
</style>
```
Read from `config.viewer.classes`, generate the `<style>` block, inject into `<head>`. Sanitise property names and values (strip semicolons, reject anything outside `[-\w]` for property names). Export inlines this block in `index.html` — self-contained, no external files needed.

#### Element class attribute on save

When deploying, the element's `class` attribute retains `feezal-class-*` entries alongside any other classes. The `_clean()` method in `feezal-app-editor.js` must **not** strip `feezal-class-*` classes (it currently strips `feezal-editable`, `feezal-selected`, `ds-selectable` — leave class names alone).

### U8 — Style Mixins ✅ done *(superseded by U18)*
Save a named set of style attribute values ("primary card", "danger button") and apply them to any element with one click. Mixins are stored in `localStorage` under `feezal-mixins-<siteName>`, editable in the Styles inspector tab (save current styles as a named mixin, apply or delete saved mixins).

### U14 — Element context menu & copy-to-view ✅ implemented
Right-click on any canvas element shows a context menu with: **Cut, Copy, Paste, Duplicate** (Ctrl+D), **Copy to view…** (flyout submenu listing all other views), **Move to view…**, **Delete**, **Select All**. Right-clicking empty canvas shows reduced options (Paste, Select All). Duplicate also bound to `Ctrl+D` keyboard shortcut.

**Initial menu items:**
| Action | Notes |
|---|---|
| Cut | Same as `Ctrl+X` |
| Copy | Same as `Ctrl+C` |
| Paste | Same as `Ctrl+V` (grayed out when clipboard is empty) |
| Duplicate | Clone element in place (`Ctrl+D`) |
| **Copy to view…** | Opens a submenu or picker listing all other views; copies the element (preserving all attributes and styles) into the target view at the same canvas position |
| **Move to view…** | Like "Copy to view" but removes it from the current view after placing it in the target |
| Delete | Same as `Delete` key |
| Lock / Unlock | Toggle move/resize lock (see U3) |

**Copy / move to view behaviour:**
- If a view with the same element already exists at that position, offset the pasted copy by one grid unit to make it visible.
- The operation is undoable via `Ctrl+Z`.
- When multiple elements are selected the entire selection is copied/moved together.

The context menu should also appear on right-clicking an empty canvas area with a reduced set of actions (Paste, Select All).

### U11 — View tab bar: scroll overflow ⚡ high priority  ✅ implemented
When the number of views exceeds the tab bar width, the bar should not wrap or truncate silently. Instead:
- Show narrow `‹` / `›` scroll buttons at the **left and right ends, always visible** — greyed out (not hidden) when there is nothing to scroll in that direction. Avoids layout jumps when overflow state changes.
- Mouse-wheel scrolling when the pointer is over the tab bar (`wheel` event → `scrollLeft` delta).
- After a view is activated (programmatically or via search), scroll the bar so the active tab is fully visible.

**Decided:** editor is mouse-only; no touch/swipe handling needed here. Touch support is a viewer-side concern (see U13).

### U12 — View tab bar: view search ⚡ high priority  ✅ implemented
A search icon/button at the right end of the tab bar (outside the scrollable area). Clicking it opens an inline search field with live-filtered results as the user types. Matching view names are listed as a small dropdown; clicking a result:
1. Activates that view.
2. Closes the search field.
3. Scrolls the tab bar so the newly active tab is visible (see U11).

### U13 — Viewer: mobile / touch support - NEEDS REFINEMENT
The editor is intentionally mouse-only. The **viewer** must work well on phones and tablets:
- Touch-friendly tap targets on all interactive elements.
- View tab bar supports swipe-to-scroll on touch devices.
- Viewer layout adapts to small screens (see also A4 — responsive breakpoint layouts).
- No horizontal overflow / no need to pinch-zoom to use a dashboard on mobile.
- Test matrix: Chrome/Safari on iOS, Chrome on Android.

### U9 — Editor dark / light mode ✅ implemented
The editor chrome should respect `prefers-color-scheme` by default and offer a manual toggle in the settings panel. All editor CSS custom properties are already the right abstraction point — dark mode is a matter of defining an alternate set of values. No element package styles are affected (those are dashboard themes, separate concern).

### U10 — Site management UI ⚡ high priority  ✅ implemented
See A2 — this is the editor-facing surface of site management. Tracked here as a UX item: the interaction design (toolbar placement, modal vs. sidebar, keyboard navigation) matters as much as the backend wiring.

### U19 — Keyboard shortcut for lock toggle (`Ctrl+L`) ✅ done
Add `Ctrl+L` as a keyboard shortcut that toggles the locked state of all currently selected elements — mirrors the right-click context menu "Lock / Unlock" action.

**Changes required:**
- `feezal-sidebar-inspector.js` `_keyHandler`: add a `case 'l'` branch (with `ctrlKey` guard) that iterates `selectedElems`, toggles the `locked` attribute on each, and calls `this.setLocked(el, willLock)`.
- Context menu item for Lock/Unlock: append the hint `Ctrl+L` to the label (same style as other shortcut hints in the menu).
- Shortcut help popup (`?` modal): add a row for `Ctrl+L — Lock / unlock selected elements`.

### U20 — Version display + update availability indicator ✅ done
Show the running feezal version in a small, unobtrusive location in the editor UI (next to the feezal title / wordmark). When a newer version is available on npm, show a compact badge or dot next to it.

**Version source:**
Read from `server/package.json` at startup (`"version": "0.11.0"`). Expose via a new `GET /api/version` endpoint that returns `{ version: "0.11.0", latest: "0.12.0" | null }`.

**Update check:**
The server queries `https://registry.npmjs.org/feezal/latest` once at startup (non-blocking, fire-and-forget). Result is cached in memory. No polling — one check per server restart is enough. If the request fails (offline, timeout) `latest` is `null` and no indicator is shown. The check must not block the editor loading or any other operation.

**UI:**
- Version string rendered in small muted text (`opacity: 0.5`, `font-size: 0.7em`) directly after the feezal wordmark in the editor toolbar or site header.
- When an update is available: a small coloured dot (or `↑` arrow) appears next to the version. Hovering it shows a tooltip: *"feezal 0.12.0 is available on npm"*. No intrusive banners or modals.

### U22 — Improve update check with semantic version comparison

The current update indicator compares the npm `latest` tag string directly against the running version. This can produce false positives (e.g. when `latest` is a pre-release or when the strings differ in formatting). Replace with a proper semantic version comparison using [`semantic-compare`](https://github.com/hobbyquaker/semantic-compare) so the `↑` indicator only appears when the published version is strictly greater than the running one.

**Changes required:**
- `server/package.json`: add `semantic-compare` as a dependency.
- `server/src/routes/api.js`: import `semanticCompare` and gate the `latest` field in the `/api/version` response — only set it when `semanticCompare(latestVersion, currentVersion) > 0`; otherwise return `latest: null`.

### U21 — View rename / delete: context menu + dark-mode-aware dialog ✅ done
**Current behaviour:** double-clicking a view tab opens a browser-native `prompt()` / `confirm()` for rename and delete. These dialogs are styled by the OS / browser and ignore the editor's dark or light mode.

**Target behaviour:**
- Right-clicking (or long-pressing) a view tab shows a small context menu with: **Rename**, **Duplicate**, **Delete**. The existing double-click rename shortcut can be kept for convenience.
- All dialogs use Shoelace `sl-dialog` so they automatically inherit the editor's Shoelace theme and respect dark / light mode. No OS-native dialogs.
- Rename dialog: `sl-input` pre-filled with the current name, `sl-button` confirm/cancel, Enter key confirms.
- Delete dialog: compact confirmation message listing the view name, destructive-style confirm button.
- The tab bar's click / double-click handling must be adjusted so the right-click event opens the new context menu instead of triggering drag-scroll (if any pointer handling is registered there).

---

## Architecture & Infrastructure

### A2 — Site management UI in editor  ✅ implemented
**Decided:**

- **Placement**: compact site picker in the **toolbar** — a dropdown showing the current site name, opens a small popover listing all sites. Keeps the toolbar uncluttered.
- **Switching**: **full page navigation** — the URL changes to the new site (`/editor/#/siteName`), triggering a normal load. Simple, predictable, no in-place state juggling.
- **New site**: minimal **"enter name" dialog** only. Optional checkbox: *"Copy connection settings from: [site dropdown]"* — pre-fills the new site's connection config from an existing site without duplicating its content.
- **Duplicate site**: dedicated action (toolbar popover or context menu on a site in the list) — copies both `views.html` and `viewer.json` of an existing site to a new name. Useful for creating variants of an existing dashboard.
- **Rename / delete**: accessible from the site list popover with confirmation on delete.

The toolbar popover site list should be keyboard-navigable and filterable by name (type to filter) for installations with many sites.

### A5 — Testing & CI ✅ done
**Implemented:**
- `server/test/topic-match.test.js` — 12 unit tests for the MQTT wildcard matcher.
- `server/test/storage.test.js` — 9 unit tests for `FilesystemStorage` (CRUD, clone, rename).
- `server/test/api.test.js` — 10 integration tests for all REST API endpoints via `supertest`.
- `vitest` + `@vitest/coverage-v8` + `supertest` added as dev dependencies to `server/`.
- `npm test` / `npm run test:coverage` scripts added to `server/package.json`.
- Root workspace `pnpm lint` (XO) and `pnpm test` scripts added.

**GitHub Actions workflows (`.github/workflows/`):**
- `ci.yml` — triggers on every push/PR: install deps → lint → test.
- `release-npm.yml` — triggers on `v*` tag: lint → test → build www → `npm publish --provenance` (OIDC provenance attestation; npm auth via `NPM_TOKEN` secret).
- `release-docker.yml` — triggers on `v*` tag: multi-platform build (`linux/amd64`, `linux/arm64`), pushes to `ghcr.io/feezal/feezal`; GHCR auth uses `GITHUB_TOKEN` (OIDC-backed, no extra secret needed).

### A6 — Remove `/feezal` path prefix ⚡ high priority  ✅ implemented
Currently all routes are scoped under `/feezal/` (editor at `/feezal/editor/`, API at `/feezal/api/`, Socket.IO at `/feezal/socket.io`). This is a Node-RED era artefact (the node was mounted as a sub-path inside Node-RED's Express instance).

Target URL structure:
```
http://localhost:3000/editor/#/view1
http://localhost:3000/api/sites
http://localhost:3000/view/mysite
```

Scope of change:
- Express route prefixes in `server/src/app.js` and `routes/`.
- Vite `base` config in `www/vite.config.js` (currently `'/feezal/'`).
- Socket.IO `path` option.
- Any hardcoded `/feezal/` references in frontend source.
- Add a redirect from `/feezal/*` → `/*` for existing bookmarks.

**Breaking change** — coordinate with any downstream deployments.

---

### A10 â€” npm packaging: `npm install -g feezal` + GitHub Actions publishing âš¡ high priority

The project is not yet ready for proper npm publication. Several structural issues must be addressed before `npm install -g feezal` works end-to-end and before `publish.sh` can be retired.

#### Problems with the current setup

**`wwwDir` is hardcoded to `../../www` (the repo path):**
`server/bin/feezal.js` resolves `wwwDir` as `path.join(__dirname, '..', '..', 'www')`. This path only exists inside the monorepo checkout. After a global npm install the `www/` directory does not exist and the server crashes immediately.

**Built frontend assets are not inside the `server/` package:**
The Vite build output (`www/dist/`) lives outside `server/`. Nothing copies it in, and `server/package.json` has no `files` field. A published `feezal` package would contain only the Node.js server code â€” no HTML/JS/CSS to serve.

**`findElements` writes to `www/editor/feezal-elements.js` at every startup:**
The server generates this file by scanning `wwwDir/node_modules/@feezal/` for installed element and theme packages. The real problem is not that it runs at startup â€” that behaviour must be preserved so users can install additional elements without rebuilding feezal â€” but *where* the output goes: after a global npm install, `wwwDir` points to the read-only installed `dist/` directory. The fix is to serve the generated module as a **dynamic Express route** (`GET /editor/feezal-elements.js`) rather than writing it to disk, eliminating the file-write entirely.

**Element discovery after a global install:**
After `npm install -g feezal`, users need a writable, well-known location to drop additional element packages. The server must scan two locations at startup: (1) bundled elements inside the installed package (`<wwwDir>/packages/@feezal/`, see npm issue below), and (2) user-installed elements in `<data-dir>/elements/`. No CLI flag or global-module scanning is needed â€” the data directory is always writable and already exists.

**npm strips `node_modules/` from published packages:**
npm unconditionally excludes any directory named `node_modules/` during `npm publish`, even if it lives inside a directory listed in the `files` field. Copying element packages to `server/dist/node_modules/@feezal/` would therefore result in an empty install â€” the packages would be stripped before upload. Fix: copy element packages to `server/dist/packages/@feezal/` (renamed) and update `app.use('/node_modules', express.static(...))` to read from `packages/` instead. The browser-facing URLs (`/node_modules/@feezal/â€¦`) remain unchanged.

**`publish.sh` only publishes elements, not the server:**
There is no step to publish the `feezal` (server) package itself. And a shell script driven by hand is fragile and error-prone.

#### Versioning strategy

The `feezal` server package and all `@feezal/*` element/theme packages use **lockstep major versions**: when a major version is bumped, every package must receive the same major bump in the same release. Minor and patch versions are **independent** â€” an element package may be at `1.3.0` while the server is at `1.5.2`. This allows element packages to ship fixes without requiring a server release, while preventing major API incompatibilities across the ecosystem.

#### Required changes

**1. Bundle the built frontend into `server/`**

Add a pre-publish build step:
- `cd www && npm run build` â†’ produces `www/dist/`
- Copy `www/dist/` â†’ `server/dist/`
- Copy `www/node_modules/@feezal/` â†’ `server/dist/packages/@feezal/` (**not** `dist/node_modules/` â€” npm strips that; see problem above)
- Add `"files": ["bin/", "src/", "dist/"]` to `server/package.json`

Update `app.js` to serve element packages from the renamed directory:
```js
// was: express.static(path.join(wwwDir, 'node_modules'))
app.use('/node_modules', express.static(path.join(wwwDir, 'packages')));
```
Browser-facing URLs are unchanged â€” element files are still fetched from `/node_modules/@feezal/â€¦`.

**2. Fix `wwwDir` resolution**

Change `server/bin/feezal.js` to default `wwwDir` to `path.join(__dirname, '..', 'dist')` (the bundled copy inside the installed package). For development, running `npm run build` first is sufficient â€” the dev startup script (e.g. a root `package.json` `"start"` script) passes `--www-dir ../www/dist` explicitly. No runtime fallback logic needed in the binary itself.

**3. Serve `feezal-elements.js` as a dynamic Express route**

Keep `findElements` scanning at every startup â€” this is intentional and necessary for user-installed elements. Instead of writing the generated module to disk, register an Express route that returns it as an HTTP response:

```js
app.get('/editor/feezal-elements.js', (_req, res) => {
    res.type('text/javascript').send(generateElementsModule(discoveredElements));
});
```

The server scans two locations on startup and caches the result in memory:
1. **Bundled elements** â€” `<wwwDir>/packages/@feezal/` (element packages copied here by step 1; served via `/node_modules/` static route)
2. **User-installed elements** â€” `<data-dir>/elements/` (user-owned drop-in directory; served via a new static route `app.use('/user-elements', express.static(path.join(dataDir, 'elements')))`)

User element installation is simply:
```
<data-dir>/elements/
  feezal-element-custom-gauge/
    package.json
    feezal-element-custom-gauge.js
```
The server picks it up on next restart â€” no rebuild, no npm link.

**Import paths must be absolute, not bare specifiers.** The current `findElements` emits `import '@feezal/feezal-element-basic-number'`. Bare specifiers only resolve in browsers that have an import map â€” which Vite's dev server provides but a plain Express response does not. The `generateElementsModule()` function must emit absolute paths using `el.main` (already read from `package.json` by `_scan`):
```js
// bundled element
import '/node_modules/@feezal/feezal-element-basic-number/feezal-element-basic-number.js';
// user element
import '/user-elements/feezal-element-custom-gauge/feezal-element-custom-gauge.js';
```
These work in both dev (Vite proxies `/node_modules` and `/editor/feezal-elements.js` to Express) and prod (served directly by Express).

**Vite must not bundle `feezal-elements.js` into the editor chunk.** Currently, because `editor/index.html` has `<script type="module" src="feezal-elements.js">`, Vite processes the file at build time and bakes all element imports into the editor chunk. With the dynamic route approach, elements are loaded at runtime instead. The build-time file can be replaced with an empty stub so Vite produces no element chunk; the runtime `<script>` tag in the built HTML will fetch the real module from the Express route. The existing `optimizeDeps.exclude` list in `vite.config.js` (which already excludes all `@feezal/*` packages from pre-bundling) confirms this direction was anticipated.

**Scope: editor only.** `viewer-main.js` also imports `feezal-elements.js` today, so the viewer bundle currently has all elements baked in. The dynamic route approach does not change the viewer â€” it stays as a monolithic bundle until A8 (per-site tree-shaking) is implemented. A8's per-element IIFE chunks will supersede the dynamic route for the viewer entirely.

> **Future:** A `POST /api/admin/rescan-elements` endpoint would allow adding user elements without a full server restart. Low priority â€” for Docker deployments, a restart is trivial.

**4. Replace `publish.sh` with GitHub Actions**

Drop `publish.sh` entirely. All npm publishing must happen in CI via a GitHub Actions workflow triggered by a `v*` tag push. The repo uses `pnpm`, so all install steps use `pnpm`. The workflow:
1. Install deps (`pnpm install`)
2. **Generate `www/editor/feezal-elements.js`** â€” run a standalone script (extracted from `findElements`) that scans `www/node_modules/@feezal/` and writes the file. This must happen before the Vite build because `viewer-main.js` imports it. Do not start the full Express server; a thin Node.js script is sufficient.
3. Build `www/` (`cd www && npm run build`)
4. Copy `www/dist/` into `server/dist/`; copy `www/node_modules/@feezal/` into `server/dist/packages/@feezal/`
5. For `feezal` (server): check if version already on registry (`npm view feezal@<version> version 2>/dev/null`); publish only if not already present (`cd server && npm publish --access public --provenance`)
6. For each `@feezal/*` package under `www/node_modules/@feezal/`: read its `package.json` version, check registry with the same pattern, skip if already published, otherwise `npm publish --access public --provenance`
7. Auth via `NPM_TOKEN` secret; OIDC provenance attestation

This makes the workflow **idempotent**: re-running the same tag after a partial failure is safe. Packages whose version did not change are simply skipped.

The existing `release-npm.yml` stub in `A5` covers the broad strokes but does not yet handle the multi-package publish loop, the `www/dist/` copy step, or the version pre-check.

---

## Documentation

### D1 — Element spec (highest priority) ✅ done
`element-spec.md` fully rewritten. Covers: package & naming conventions, `FeezalElement` base class API, `static get feezal()` descriptor in full (palette, attributes with all supported types + `help`/`tooltip`, styles, description, links, restrict, defaultStyle), MQTT subscribe/publish contract, CSS custom property conventions, editor vs viewer mode, publishing checklist, and a complete worked example (toggle button).

### D3 — User guide ✅ done
`docs/user-guide.md` written. Covers: installation & CLI flags, editor layout overview, working with views, placing & configuring elements, right-click context menu, attribute & style inspector, MQTT data binding patterns (basic display, publish, wildcard, dynamic subscriptions, common use-case table), themes, connection settings, site management, static export, asset manager, and keyboard shortcut reference.
