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

### N6 — Custom element inspectors ✅ implemented
An element can declare `inspector: 'feezal-element-<name>-inspector'` in `static get feezal()` to replace the generic attribute form with a fully custom Web Component. `feezal-sidebar-inspector-attributes.js` renders the named inspector, passes the selected element as `.element`, and listens for `feezal-attribute-changed` events dispatched by the inspector. Used by `feezal-element-material-light`, `feezal-element-material-climate`, `feezal-element-material-cover`, and others. Full spec in `docs/element-spec.md` §3.8.

### N12 — MQTT auto-discovery (HA / zigbee2mqtt) ✅ implemented
Server-side discovery registry (`server/src/mqtt/discovery.js`) subscribes to HA-format discovery wildcards, expands abbreviations, normalises payloads, and maintains an in-memory entity cache. REST endpoint `GET /api/discovery/devices` exposes the cache. The inspector shows: (a) a reactive "Auto-configure" banner when a typed topic matches a discovered entity, and (b) a proactive device-picker dropdown for elements that declare a `discovery` descriptor in `static get feezal()`. Discovery descriptors shipped for: `light`, `switch`, `fan`, `lock`, `climate`, `cover`, `binary_sensor` (contact/motion), `checkbox`, `paper-switch`, `paper-checkbox`. Full spec in `docs/element-spec.md` §3.7 and §8.5.


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

### E33 — Webpage / iframe element ✅ implemented (`feezal-element-basic-iframe`)
A generic `<iframe>` canvas element with `src`, `subscribe-src` (MQTT-driven URL), `refresh` (auto-reload interval), `scrolling`, `sandbox`, and `zoom` attributes. Part of the Polymer-to-Lit migration (E1); the new implementation uses `FeezalElement`.

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

### E35 — Light element: dual-payload + N6 custom inspector + auto-discovery retrofit (`feezal-element-material-light`) ✅ done

> **Shipped notes / deviations from the original spec below:**
> - **Availability badge added (extension beyond original spec).** The spec marked availability "out of scope", but per request the element now subscribes to an optional `subscribe-availability` topic (with `payload-available` / `payload-unavailable`, defaults `online` / `offline`) and shows a small red cloud-off badge in the top-right corner when the device reports unavailable. **Controls are never disabled** — the element stays fully usable regardless of availability state.
> - **Discovery descriptor is json-focused.** The extended descriptor maps only to attributes the element actually consumes: `schema`→`payload-mode`, `state_topic`→`subscribe` / `command_topic`→`publish` (both `onlyWhen schema:json`), `brightness_scale`→`brightness-max`, `supported_color_modes`→`mode` (via a new `colorMode` transform: `xy`→`hs`, `rgb*`→`rgb`, `color_temp`→`color_temp`, else `brightness`), `min_mireds`/`max_mireds`→`color-temp-max`/`color-temp-min` (mired→kelvin), `effect_list`→`effects` (`join` transform), `availability_topic`→`subscribe-availability`, `name`→`label`. The `has-brightness` / `has-effects` boolean attrs from the spec were dropped (section enablement is derived from topic presence instead).
> - `_applyDiscovery()` in `feezal-sidebar-inspector-attributes.js` gained `onlyWhen` guards and the `join` / `colorMode` transforms.
> - The element overrides the base `_subscribe()` as a no-op and manages its own subscriptions (availability always; single JSON topic in `json` mode; per-topic in `separate` mode).

The light element currently has **30 flat attributes** — far too many for the generic attribute form. This item retrofits it with three cross-cutting capabilities: a custom N6 inspector that tames the attribute count, dual-payload (`json`) mode, and a complete auto-discovery descriptor for N12. The discovery descriptor (separate-mode, no JSON) and the N12 hook in `static get feezal()` were shipped in N12 and are already present — this item completes them.

> **Conventions:** dual-payload ✓ (this item adds it) · auto-discovery: `light` (descriptor already present, this item extends it) · custom inspector: `feezal-element-material-light-inspector` (this item adds it).

#### Real-world reference (this device)

Grounded in a real **Philips Hue white and color ambiance E27** exposed via **zigbee2mqtt** (base topic `zigbee2mqtt/licht_hobbyraum`). This one device exhibits every nuance the retrofit must handle: a separate per-property topic stream, a consolidated base-topic JSON object with nested `color`, and a `schema: json` auto-discovery config pointing at the JSON form (`brightness_scale 254`, `supported_color_modes ["xy","color_temp"]`, `min_mireds 153`/`max_mireds 500`, an `effect_list`). Discovery always points at the JSON form, so an auto-configured light defaults to `payload-mode: json`.

#### 1. N6 Custom Inspector

A **two-tab custom inspector** registered as `feezal-element-material-light-inspector` in `static get feezal().inspector`, replacing the unusable 30-attribute flat list. **Tab 1 — Topics:** an always-on State section plus capability-gated, collapsible sections (Brightness, Color Temperature, Color, White/RGBW, Effects); a section is enabled when any of its topic attributes is non-empty, and toggling off clears them. In `json` mode the per-feature groups collapse into a single State & Control section (just `subscribe` + `publish`). **Tab 2 — Config:** Mode, Payload mode, State payloads, Brightness scale, Color Temperature range, Effects, Availability, Display. Defined in the same element JS file; uses `<sl-tab-group>`/`<sl-input>`/`<sl-select>`/`<sl-switch>`; every change dispatches `feezal-attribute-changed` with `{name, value}` (the standard N6 contract).

#### 2. Dual payload mode (`payload-mode`)

- **`separate` (default):** per-topic wiring — unchanged, back-compat preserved.
- **`json`:** a single `subscribe` / `publish` topic pair. Incoming JSON is parsed and mapped to internal state (state/brightness scaled by `brightness-max`/color_temp mired→kelvin/nested `color` object → hs or rgb or xy→rgb/effect); outgoing changes are merged into one JSON object published to `publish`. A `json-map` attribute (JSON string) overrides the default key map.

#### 3. Extended auto-discovery descriptor + 4. `discovery-id`

See the shipped-notes above for the final mapping. `discovery-id` is declared in `static properties` (`reflect: true, attribute: 'discovery-id'`) so Lit serialises it to the HTML.

#### Compatibility

`payload-mode` defaults to `separate`, so all existing dashboards continue to work. The `inspector` key activates the new inspector only in the editor — no runtime behaviour change for the element itself.


### E4 — Camera element ✅ implemented
Renders a live camera stream on the dashboard canvas. Targets three source types:
- **MJPEG**: a plain `<img>` with a streaming URL — works anywhere, no codec negotiation.
- **WebRTC**: for low-latency feeds from cameras that support it (Frigate, go2rtc, etc.). Requires an SDP/signalling integration.
- **HLS / RTSP-over-HTTP**: via a `<video>` element with an HLS.js adapter for browsers that don't natively support HLS.

Configurable attributes: `src`, `type` (mjpeg / webrtc / hls), `fit` (cover / contain), `muted`, `autoplay`. Falls back to a placeholder frame when the stream is unreachable.

### E11 — Climate element ✅ implemented (`feezal-element-material-climate`)

A self-contained climate control that wraps several sub-elements into a single cohesive canvas element. Targets typical smart-home thermostats and HVAC devices (e.g. Homematic, Z-Wave, MQTT climate, ESPHome climate, zigbee2mqtt TRVs). **Palette category: `Device`** (sibling of Light).

> **Conventions:** dual-payload ✓ (`json` is the discovery default) · auto-discovery: `climate` · custom inspector: **N6 required** (two-tab Topics/Config, capability-gated sections). See [Element platform conventions](#element-platform-conventions) and **[Lessons from the Light element](#lessons-from-the-light-element-e16--e35) — all eight apply here.** Element-specific discovery conversions: `schema` → `payload-mode`, `temperature_state_topic`/`temperature_command_topic` → `subscribe`/`publish` (json mode), `modes` (string array) → `modes` attribute (auto-coerced to `[{value,label}]`), `temp_step` → `step`, `min_temp`/`max_temp` → `min`/`max`, `temperature_unit` (C/F) → `unit` (°C/°F), `availability_topic` → `subscribe-availability`, `payload_available`/`payload_not_available` mapped, `name` → `label`.

> **Real-device grounding (do this first):** model a concrete climate device — e.g. a **zigbee2mqtt TRV** (Sonoff TRVZB / Eurotronic Spirit) — which emits a consolidated base-topic JSON object (`local_temperature`, `current_heating_setpoint`, `system_mode`, `running_state`, `position` for valve %) *and* a `schema: json` `climate` discovery config. Discovery points at the JSON form, so an auto-configured climate element defaults to `payload-mode: json`.

**Visual concept:** a large circular arc slider (custom SVG/Canvas, similar to the Nest/ecobee UI) for setting the target temperature. Current actual temperature shown prominently in the centre of the arc. Supporting data rendered below or around the circle. An availability badge appears in a corner when the device is unavailable; **controls stay enabled** regardless.

**Sub-elements composed internally (not separate canvas elements):**
- **Set-temperature arc slider** — circular arc spanning ~240°. Drag handle on the arc sets `setpoint`. Min/max configurable (e.g. 5 °C – 30 °C). Snaps to `step` increments. Publishes to the setpoint topic on pointer release.
- **Actual temperature display** — large text in the arc centre. Subscribes to `subscribe-actual`. Unit shown below (°C / °F, configurable).
- **Mode selector** — optional horizontal radio chip row (uses `md-filter-chip` internally). Modes are configurable via a JSON `modes` attribute (e.g. `[{"value":"heat","label":"Heat","icon":"local_fire_department"},...]`). Selected mode published to the mode topic; current mode read back. Hidden when `modes` is empty.
- **Valve opening** — optional small percentage bar or arc segment fill (e.g. amber fill on the arc proportional to valve %). Subscribes to `subscribe-valve`. Hidden when its topic is absent.
- **Humidity** — optional secondary value row below the arc (`subscribe-humidity`). Shown as `💧 52%`.

**Payload mode:**
- **`separate` (default for hand-wiring):** the per-topic attributes below.
- **`json`:** a single `subscribe` / `publish` topic pair carrying the climate JSON object; an optional `json-map` overrides the default key map. Override the base `_subscribe()` as a no-op and manage subscriptions directly (single JSON topic in `json` mode, per-topic in `separate`, availability always).

**N6 inspector (required):** two tabs. **Topics** — an always-on Setpoint/Actual section plus capability-gated, collapsible sections (Mode, Valve, Humidity, Availability); each enabled when its topic(s) are non-empty, toggling off clears them; in `json` mode the per-feature groups collapse to a single State & Control section (`subscribe` + `publish`). **Config** — Payload mode, Min/Max/Step, Unit, Modes builder, colours, Display. Replicate the standard inspector's `::part()` Shoelace theming and `autocomplete="off"`; the shell adds the discovery device picker automatically.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `payload-mode` | select | `separate` | `separate` (per-topic) or `json` (single object) |
| `subscribe` | mqttTopic | — | *(json mode)* topic carrying the climate JSON object |
| `publish` | mqttTopic | — | *(json mode)* topic to publish merged climate JSON to |
| `json-map` | string | `""` | *(json mode)* JSON key-map override |
| `subscribe-setpoint` | mqttTopic | — | *(separate)* topic to read current setpoint from |
| `publish-setpoint` | mqttTopic | — | *(separate)* topic to publish new setpoint to |
| `subscribe-actual` | mqttTopic | — | Topic for actual measured temperature |
| `subscribe-mode` | mqttTopic | — | Topic for current mode (e.g. `"heat"`) |
| `publish-mode` | mqttTopic | — | Topic to publish selected mode to |
| `subscribe-valve` | mqttTopic | — | Topic for valve opening percentage (0–100) |
| `subscribe-humidity` | mqttTopic | — | Topic for relative humidity (0–100) |
| `subscribe-availability` | mqttTopic | — | *Optional* — device availability topic |
| `payload-available` | string | `online` | Availability "online" payload |
| `payload-unavailable` | string | `offline` | Availability "offline" payload |
| `min` | number | `5` | Minimum setpoint value |
| `max` | number | `30` | Maximum setpoint value |
| `step` | number | `0.5` | Setpoint step size |
| `unit` | string | `°C` | Temperature unit label |
| `modes` | string | `""` | JSON array of `{value, label, icon}` mode objects |
| `label` | string | — | Optional card title |
| `discovery-id` | string | — | *(reflected)* linked auto-discovery entity id |

**Colour tokens (theme-aware, state-aware):** instead of fixed colour attributes, expose CSS custom properties that default to theme vars and appear in the style inspector as placeholders — e.g. `--feezal-thermostat-heat-color` (heating), `--feezal-thermostat-cool-color` (cooling / below setpoint), `--feezal-thermostat-idle-color`, `--feezal-thermostat-text-color`, `--feezal-thermostat-error-color`. Keep the set minimal.

**Editor preview:** renders the arc with a static midpoint handle and placeholder temperature labels; modes shown as non-interactive chips.

**Default size:** 240×280 px.

*Research note: HA's built-in thermostat card and Mushroom's climate card (5k ★) both confirm this pattern. The key differentiator for feezal is the larger circular arc UI — HA's cards use a simpler radial dial; Mushroom uses a compact icon chip. A full arc slider is more appropriate for wall-mounted dashboards where precision matters over screen real estate.*

### E12 — Shutter / Blinds element ✅ implemented (`feezal-element-material-shutter`)

A window-visualisation element for controlling roller shutters, blinds, or awnings. Targets cover/shutter devices (e.g. Homematic, MQTT Shelly, Zigbee covers). **Palette category: `Device`** (sibling of Light).

> **Conventions:** dual-payload ✓ (`json` is the discovery default) · auto-discovery: `cover` · custom inspector: **N6 recommended** (tames the topic count, gates the optional tilt/slat section). See [Element platform conventions](#element-platform-conventions) and **[Lessons from the Light element](#lessons-from-the-light-element-e16--e35).** Element-specific discovery conversions: `position_topic`/`set_position_topic` → position topics, `command_topic` + `payload_open`/`payload_close`/`payload_stop` → command + payloads, `position_open`/`position_closed` → position scale, `tilt_*` → slat-angle topics/range, `availability_topic` → `subscribe-availability`, `name` → `label`.

> **Real-device grounding (do this first):** model a concrete cover device — e.g. a **zigbee2mqtt venetian blind** (Zemismart / Tuya) that reports `position` (0–100) and `tilt`, or a **Shelly 2.5 in roller mode** — and a `schema: json` `cover` discovery config. Discovery points at the JSON form, so an auto-configured shutter defaults to `payload-mode: json`.

**Visual concept:** a stylised window outline (SVG) with a shutter panel that slides up and down proportionally to the current opening percentage. The shutter slats are rendered as horizontal lines whose density can be configured. Touch/mouse drag directly on the shutter panel sets a new position. An availability badge appears in a corner when unavailable; **controls stay enabled**.

**Controls:**
- **Up / Stop / Down button row** — three `md-icon-button` elements (`keyboard_arrow_up`, `stop`, `keyboard_arrow_down`) that publish configurable payloads to `publish-command`.
- **Opening percentage display** — numeric label below the window showing the current position (from `subscribe-position`).
- **Direct position input** — optional: tap the percentage label to open a small inline `md-slider` overlay (0–100 %) for precise setting.

**Payload mode:**
- **`separate` (default for hand-wiring):** the per-topic attributes below.
- **`json`:** a single `subscribe` / `publish` topic pair carrying the cover JSON object (`position`, `tilt`, `state`); an optional `json-map` overrides the default key map. Override the base `_subscribe()` as a no-op and manage subscriptions directly.

**N6 inspector (recommended):** two tabs. **Topics** — an always-on Position/Command section plus a capability-gated, collapsible **Tilt/Slat** section (enabled when a tilt topic is set, toggling off clears it) and an Availability section; in `json` mode the groups collapse to a single State & Control section. **Config** — Payload mode, command payloads, invert, slat count, colours, Display. Replicate the standard inspector's `::part()` theming and `autocomplete="off"`; the shell adds the discovery device picker automatically.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `payload-mode` | select | `separate` | `separate` (per-topic) or `json` (single object) |
| `subscribe` | mqttTopic | — | *(json mode)* topic carrying the cover JSON object |
| `publish` | mqttTopic | — | *(json mode)* topic to publish merged cover JSON to |
| `json-map` | string | `""` | *(json mode)* JSON key-map override |
| `subscribe-position` | mqttTopic | — | *(separate)* current position (0 = closed, 100 = fully open) |
| `publish-position` | mqttTopic | — | *(separate)* topic to publish a target position to |
| `publish-command` | mqttTopic | — | Topic for up/stop/down commands |
| `payload-up` | string | `UP` | Payload sent by the Up button |
| `payload-stop` | string | `STOP` | Payload sent by the Stop button |
| `payload-down` | string | `DOWN` | Payload sent by the Down button |
| `invert` | boolean | `false` | Invert position scale (0 = fully open instead of closed) |
| `show-position` | boolean | `true` | Show the numeric position label |
| `slat-count` | number | `6` | Number of shutter slat lines rendered in the SVG |
| `slat-angle` | mqttTopic | — | *Optional* — venetian-blind tilt: topic carrying slat angle (0–100 or 0–180°) |
| `publish-slat-angle` | mqttTopic | — | Topic to publish a new slat angle to |
| `subscribe-availability` | mqttTopic | — | *Optional* — device availability topic |
| `payload-available` | string | `online` | Availability "online" payload |
| `payload-unavailable` | string | `offline` | Availability "offline" payload |
| `label` | string | — | Optional card title |
| `discovery-id` | string | — | *(reflected)* linked auto-discovery entity id |

**Colour tokens (theme-aware):** replace the fixed `color-frame` / `color-shutter` attributes with CSS custom properties that default to theme vars and appear in the style inspector as placeholders — e.g. `--feezal-shutter-frame-color` (defaults to `--primary-text-color`), `--feezal-shutter-panel-color` (defaults to `--secondary-background-color`), `--feezal-shutter-error-color`.

**Touch optimisation:** the shutter SVG panel itself is a drag target — dragging up/down sets a proportional position without needing the slider overlay. Supports both pointer and touch events.

**Slat angle:** when `slat-angle` (subscribe) is configured, the SVG slat lines rotate to reflect the current tilt, and a second horizontal drag gesture (left/right) on the shutter panel adjusts the angle. ioBroker Jaeger Design and Homematic venetian blind actuators use this feature extensively.

**Default size:** 120×160 px.

### E13 — Door lock element ✅ implemented (`feezal-element-material-door-lock`)

A door / lock control element for smart locks and door entry systems. Targets lock devices (e.g. Nuki, Danalock, Yale, Zigbee door locks).

> **Conventions:** dual-payload ✓ · auto-discovery: `lock` · custom inspector: not required. See [Element platform conventions](#element-platform-conventions). Element-specific: discovery `payload_lock`/`payload_unlock`/`state_locked`/`state_unlocked` → the payload attributes.

**Visual concept:** a front-door silhouette SVG with a large lock icon (`lock` / `lock_open`) in the centre. The door outline changes colour based on state (locked / unlocked / open / jammed). Primary action is a single prominent `md-fab`-style button that toggles the lock.

**States and colours:**

| State payload | Icon | Door colour |
|---|---|---|
| `locked` | `lock` | `--primary-color` (teal/blue) |
| `unlocked` | `lock_open` | `--accent-color` (amber/orange) |
| `open` | `door_open` | `#4caf50` (green) |
| `jammed` | `error` | `#f44336` (red) |

**Controls:**
- **Primary action button** — large central tap area. In locked state publishes `payload-unlock`; in unlocked state publishes `payload-lock`. Renders as `md-fab` with appropriate icon.
- **Open fully button** — optional secondary `md-icon-button` (`door_open`); publishes `payload-open`. Visible only when `show-open-button` is true.
- **Status label** — text below the door showing the current state label (configurable via `state-labels` JSON map).

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | Topic for current lock state |
| `publish-command` | mqttTopic | — | Topic to publish lock commands to |
| `payload-lock` | string | `lock` | Payload to send for locking |
| `payload-unlock` | string | `unlock` | Payload to send for unlocking |
| `payload-open` | string | `open` | Payload to send for opening fully |
| `show-open-button` | boolean | `false` | Show the "open fully" secondary button |
| `state-labels` | string | `{}` | JSON map of `{statepayload: "display label"}` overrides |
| `confirm-unlock` | boolean | `false` | Show a confirmation dialog before sending unlock/open commands |

**Security note:** the `confirm-unlock` attribute adds a Shoelace `sl-dialog` confirmation step before publishing unlock or open commands — recommended for publicly accessible dashboards.

**Default size:** 120×160 px.

### E18 — Fan control element ✅ implemented (`feezal-element-material-fan`)

A fan control element for smart fans and air circulators. Covers on/off, speed percentage, preset mode (low/medium/high/auto), and optional oscillation and direction.

> **Conventions:** dual-payload ✓ · auto-discovery: `fan` · custom inspector: N6 (preset-mode list). See [Element platform conventions](#element-platform-conventions). Element-specific: discovery `percentage_command_topic`/`preset_modes` → speed ring and preset chips.

**Visual concept:** a circular SVG fan blade illustration that rotates continuously when the fan is on (CSS animation speed proportional to the current percentage). A large central toggle. Speed shown as a percentage arc ring (same as E16 brightness ring) or as a preset-mode chip row. The rotation animation pauses when off.

**Controls:**
- **On/Off** — tap/click the centre of the fan SVG. Publishes to `publish-state`.
- **Speed percentage ring** — drag handle on the outer arc; publishes to `publish-percentage` on release. Shown only when `show-percentage` is true.
- **Preset mode chips** — `md-filter-chip` row (low / medium / high / auto or configurable); publishes to `publish-preset`. Shown when `modes` is non-empty.
- **Oscillation toggle** — `md-icon-button` (`air`) that toggles oscillation; publishes `on`/`off` to `publish-oscillation`.
- **Direction toggle** — `md-icon-button` (`sync_alt`) that publishes `forward`/`reverse` to `publish-direction`. Optional, hidden by default.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | On/off state (`on`/`off`) |
| `publish-state` | mqttTopic | — | Topic for on/off |
| `payload-on` | string | `on` | — |
| `payload-off` | string | `off` | — |
| `subscribe-percentage` | mqttTopic | — | Current speed (0–100 %) |
| `publish-percentage` | mqttTopic | — | Topic to publish speed |
| `subscribe-preset` | mqttTopic | — | Current preset mode |
| `publish-preset` | mqttTopic | — | Topic to publish preset |
| `modes` | string | `""` | Comma-separated preset mode names |
| `subscribe-oscillation` | mqttTopic | — | Oscillation state (`on`/`off`) |
| `publish-oscillation` | mqttTopic | — | Topic for oscillation toggle |
| `subscribe-direction` | mqttTopic | — | Direction (`forward`/`reverse`) |
| `publish-direction` | mqttTopic | — | Topic for direction |
| `show-percentage` | boolean | `true` | Show the speed percentage ring |
| `show-oscillation` | boolean | `true` | Show oscillation toggle button |
| `show-direction` | boolean | `false` | Show direction toggle button |
| `label` | string | `""` | Optional label below the icon |

**Default size:** 160×200 px.

### E24 — Clock element ✅ implemented (`feezal-element-material-clock`)

A dedicated clock display element. Distinct from `feezal-element-basic-datetime` (which renders a formatted text string) — this element renders a visual clock face: either an **analog SVG clock** or a **7-segment digital display**. Popular in ioBroker.vis material widgets (analog 1, analog 2, digital 1, digital 2 variants).

**Modes** (controlled by `mode` attribute):

| Mode | Appearance |
|---|---|
| `analog` | Classic round clock face, SVG hands (hour, minute, optional second), configurable face style |
| `analog-minimal` | Hands only, no face/numerals — just the dial outline and tick marks |
| `digital` | 7-segment LCD-style display — hours:minutes[:seconds], optional AM/PM |
| `digital-clean` | Clean sans-serif digital readout — uses MD3 typography |

By default the clock shows the **browser's local time**. Optionally it can subscribe to an MQTT topic carrying a Unix timestamp or ISO 8601 string to display a remote device's time (e.g. a server in a different timezone).

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `mode` | select | `analog` | Clock display mode |
| `subscribe-time` | mqttTopic | — | Optional: MQTT topic carrying a timestamp; overrides local time |
| `timezone` | string | `""` | IANA timezone string (e.g. `America/New_York`) for display offset |
| `show-seconds` | boolean | `false` | Show the seconds hand (analog) or seconds digits (digital) |
| `show-date` | boolean | `false` | Show today's date below the clock face |
| `color-face` | color | `--secondary-background-color` | Analog clock face fill |
| `color-hands` | color | `--primary-text-color` | Hour/minute hands colour |
| `color-second` | color | `--accent-color` | Second hand / digit colour |
| `color-digits` | color | `--primary-text-color` | 7-segment digit colour |
| `color-background` | color | `--primary-background-color` | 7-segment background colour |
| `label` | string | `""` | Optional timezone or location label below the clock |

**Default size:** 160×160 px (analog); 200×80 px (digital).

### E26 — Fluid level / tank element ✅ implemented (`feezal-element-material-tank`)

An SVG tank / fluid-level visualisation. Popular in ioBroker.vis for water tanks, heating oil tanks, rain-water collectors, and swimming pool fill levels. Shows fill as a rising animated fluid body inside a configurable tank outline.

**Visual concept:** a vertically-oriented SVG container (rectangular or cylindrical profile). The fluid fill rises/falls with animated CSS transition as the MQTT value changes. Configurable fill colour (can change at threshold levels — e.g. blue → amber → red as level drops). Numeric level label inside or below the tank. Optional wave animation on the fluid surface.

**Tank shapes** (controlled by `shape`):
- `rect` — rectangular tank with flat top
- `cylinder` — rounded top/bottom caps (ellipses) for a barrel look
- `round` — fully circular tank (for round cisterns)

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Current fill level topic |
| `min` | number | `0` | Value at 0 % fill |
| `max` | number | `100` | Value at 100 % fill |
| `unit` | string | `%` | Unit label shown with the numeric value |
| `shape` | `rect` \| `cylinder` \| `round` | `rect` | Tank outline shape |
| `color-fluid` | color | `#42a5f5` | Normal fill colour |
| `color-warn` | color | `#ff9800` | Fill colour when level ≤ `warn-threshold` |
| `color-crit` | color | `#f44336` | Fill colour when level ≤ `crit-threshold` |
| `warn-threshold` | number | `25` | Level (in value units) below which warn colour applies |
| `crit-threshold` | number | `10` | Level below which critical colour applies |
| `color-tank` | color | `--primary-text-color` | Tank outline/stroke colour |
| `animate-wave` | boolean | `true` | Animate a gentle wave on the fluid surface |
| `show-value` | boolean | `true` | Show numeric value inside the tank |
| `show-percent` | boolean | `false` | Show percentage instead of raw value |
| `label` | string | `""` | Label below the tank (e.g. "Rainwater") |

**Default size:** 80×180 px.

### E27 — Window / door contact element ✅ implemented (`feezal-element-material-contact`)

A simple SVG sensor indicator for window and door contacts (reed switches, magnetic sensors). Shows open/closed state with a clear visual — a stylised window or door outline that "opens" when the sensor fires. Very widely used in ioBroker and HA security dashboards for a room-overview panel.

> **Conventions:** dual-payload — (per-topic only) · auto-discovery: `binary_sensor` (device_class `window`/`door` → `type`) · custom inspector: N6 (multi-contact list builder). See [Element platform conventions](#element-platform-conventions).

**Visual concept:** a minimal SVG of a window frame (two panes + frame outline) or a door outline. When the contact is `open`, the window/door visually ajar with an amber or red fill; when `closed`, the outline is closed and coloured normally. Optional alarm/alert animation (pulsing red glow) when a configured alarm state is active.

**Display types** (`type` attribute):
- `window` — two-pane window frame SVG; one pane rotates open
- `door` — door outline SVG with handle; door swings open
- `generic` — a simple coloured icon (`sensor_window` / `door_open`) using MD3 icon — less visual but more compact

**Multi-contact mode:** a single element can display up to 8 contacts from separate topics (e.g. all windows in one room). Each contact is a dot/icon in a grid; the overall element background turns amber if any contact is open. Useful for a compact room-security overview without placing 8 separate elements.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Contact state topic (`open`/`closed` or configurable) |
| `payload-open` | string | `open` | Payload value meaning open |
| `payload-closed` | string | `closed` | Payload value meaning closed |
| `type` | `window` \| `door` \| `generic` | `window` | Visual type |
| `alarm-state` | string | `""` | Payload value (on `subscribe`) that triggers alarm animation (e.g. `alarm`) |
| `contacts` | string | `[]` | JSON array of `{subscribe, label}` for multi-contact mode |
| `color-open` | color | `#ff9800` | SVG accent colour when open |
| `color-closed` | color | `--primary-text-color` | SVG outline colour when closed |
| `label` | string | `""` | Label below the element |

**Default size:** 60×80 px (single contact); 160×80 px (multi-contact grid of 4).

*Research note: ioBroker.vis-2-widgets-material includes Buttons/Switches, Clock (4 variants), Simple state, Thermostat, Actual value with chart, Security control, Player, Map, Camera, HTML, Blinds, Color Lamp (RGBW), Door lock, and Vacuum. The Map and Clock widgets fill genuine gaps in the feezal roadmap. The fluid-level tank and window/door contact patterns are ubiquitous across all ioBroker vis widget sets (jqui-mfd, basic, material) and represent a clear demand. The Time picker is unique to scheduling dashboards.*

### E31 — Plant / flower monitor ✅ implemented (`feezal-element-material-plant`)

A plant-health element modelled on the popular flower-card pattern. Shows a plant's current sensor readings against configured healthy ranges, with a clear at-a-glance "needs attention" state. Targets soil/plant sensors (e.g. Xiaomi/MiFlora via MQTT, Ecowitt, custom ESPHome soil probes).

**Visual concept:** a header row with an optional plant photo/icon and name, followed by a compact row of metric badges — **moisture**, **light/illuminance**, **temperature**, **conductivity/fertility**, **humidity** — each shown as a small bar or pill that turns amber/red when the reading falls outside its `min`/`max` range. An overall status dot summarises (green = all OK, amber = one out of range, red = critical).

**Metric slots** (each optional, enabled by setting its topic):

| Slot | Topic attr | Range attrs | Unit |
|---|---|---|---|
| Moisture | `subscribe-moisture` | `moisture-min`/`max` | % |
| Illuminance | `subscribe-light` | `light-min`/`max` | lx |
| Temperature | `subscribe-temperature` | `temp-min`/`max` | °C |
| Conductivity | `subscribe-conductivity` | `cond-min`/`max` | µS/cm |
| Humidity | `subscribe-humidity` | `humidity-min`/`max` | % |
| Battery | `subscribe-battery` | — | % |

**Attributes (in addition to the slot topics/ranges above):**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `name` | string | `""` | Plant name |
| `image-url` | string | `""` | Optional plant photo URL (falls back to a leaf icon) |
| `layout` | `compact` \| `detailed` | `compact` | Badges row only, or labelled rows with values |
| `show-battery` | boolean | `true` | Show the battery badge |

> **Conventions:** dual-payload ✓ (each metric can come from separate topics **or** one JSON payload, e.g. a MiFlora JSON message) · auto-discovery: consumes multiple `sensor` entities grouped by device · custom inspector: not required (slots are fixed). See [Element platform conventions](#element-platform-conventions).

**Editor preview:** leaf icon, "Plant name", and placeholder badges at healthy values.

**Default size:** 200×120 px.
### E10 — More material elements (`feezal-element-material-*`) ✅

The existing material element set covers `button`, `switch`, `slider`, `gauge`, and `value`. The following MD3 primitives are missing and would add significant value on a dashboard:

| Element | MD3 component | Dashboard use-case |
|---|---|---|
| `feezal-element-material-checkbox` | `md-checkbox` | Toggle a boolean MQTT topic (e.g. enable/disable an automation) |
| `feezal-element-material-radio` | `md-radio` group | Select one-of-N state (e.g. HVAC mode: heat / cool / auto / off) |
| `feezal-element-material-select` | `md-outlined-select` | Dropdown for selecting a named option from a list; publishes the selected value |
| `feezal-element-material-text-field` | `md-outlined-text-field` | Text input that publishes its value on commit (Enter or blur); optionally subscribes to show current value |
| `feezal-element-material-progress-linear` | `md-linear-progress` | Horizontal progress bar driven by a numeric MQTT value with configurable `min`/`max` |
| `feezal-element-material-progress-circular` | `md-circular-progress` | Circular indeterminate or determinate spinner/progress ring |
| `feezal-element-material-chip` | `md-filter-chip` | Compact toggle chip — selected/deselected state maps to a boolean MQTT topic |
| `feezal-element-material-icon-button` | `md-icon-button` | Icon-only action button; publishes a configurable payload on tap; supports toggle mode |
| `feezal-element-material-badge` | `md-badge` | Notification count overlay; subscribes to a numeric or string topic and renders a badge dot or count |
| `feezal-element-material-fab` | `md-fab` | Floating action button for a primary dashboard action (e.g. arm/disarm alarm) |

**Implementation notes:**
- All elements follow the standard `feezal-element-material-*` conventions: `subscribe` + `publish` attributes, `FeezalElement` base class, full theme integration via `--md-sys-color-*` → `--feezal-*` bridge (U15 MD3 bridge).
- `radio` needs special handling: the element renders a labelled radio group from a configurable `options` list (comma-separated or JSON array). The currently selected option is read from `subscribe` and each selection publishes to `publish`.
- `select` and `text-field` should have an optional `label` attribute rendered as the MD3 field label.
- `progress-linear` and `progress-circular` can optionally display the numeric value as text overlay (`show-value` boolean).
- Elements with no direct MD3 analogue (gauge, value) remain custom Lit — do not duplicate them.

> **Conventions:** auto-discovery — `checkbox`, `chip`, and `icon-button` (toggle mode) map to the discovery `switch` component; `select` maps to `select`; `text-field` maps to `text`. Each declares a `discovery` descriptor per [Element platform conventions](#element-platform-conventions). These are single-value controls, so dual-payload mode does not apply.


### E14 — Energy flow element (`feezal-element-material-energy-flow`) ✅

A live energy flow visualisation for solar PV users (rooftop or balcony). Shows the real-time energy topology as an animated flow diagram: animated arrows convey the direction and relative magnitude of power flows between nodes.

> **Conventions:** dual-payload — (per-topic only) · auto-discovery: not a single-component target · custom inspector: N6 (node enable/label/colour + summary-row builder). See [Element platform conventions](#element-platform-conventions).

**Nodes and flows:**

```
        [Solar PV / Balcony PV]
               ↓ (generation)
[Grid] ←→ [House / Load] ←→ [Battery] (optional)
```

Each arrow animates (pulsing dashes or moving particles along an SVG path) proportional to the watt value it represents. Arrow direction reverses automatically when power flows the other way (e.g. feeding excess solar back to the grid).

**Data topics:**

| Attribute | Unit | Description |
|---|---|---|
| `subscribe-solar` | mqttTopic | Current solar generation (W) |
| `subscribe-grid` | mqttTopic | Grid import/export (W, positive = import, negative = export) |
| `subscribe-load` | mqttTopic | Current house consumption (W) |
| `subscribe-battery` | mqttTopic | Battery charge/discharge (W, optional) |
| `subscribe-battery-soc` | mqttTopic | Battery state of charge (%, optional) |

**Summary panels (below the flow diagram):**

Configurable tabs or rows showing accumulated energy for the current day and week, read from separate topics:

| Attribute | Description |
|---|---|
| `subscribe-solar-today` | Solar yield today (kWh) |
| `subscribe-solar-week` | Solar yield this week (kWh) |
| `subscribe-grid-import-today` | Grid import today (kWh) |
| `subscribe-grid-export-today` | Grid export today (kWh) |
| `subscribe-load-today` | House consumption today (kWh) |

**Display attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `show-battery` | boolean | `false` | Show the battery node and its flow arrows |
| `show-summary` | boolean | `true` | Show the daily/weekly summary rows below the diagram |
| `pv-label` | string | `Solar` | Label shown on the solar node (e.g. "Balcony PV", "Rooftop") |
| `grid-label` | string | `Grid` | Label on the grid node |
| `load-label` | string | `House` | Label on the load/consumption node |
| `battery-label` | string | `Battery` | Label on the battery node |
| `unit` | string | `W` | Unit for live power values |
| `animate-speed` | number | `1` | Animation speed multiplier for flow arrows (0 = static) |
| `color-solar` | color | `#fdd835` | Solar node and flow arrow colour |
| `color-grid` | color | `#42a5f5` | Grid node and arrow colour |
| `color-load` | color | `--primary-text-color` | Load node colour |
| `color-battery` | color | `#66bb6a` | Battery node and arrow colour |
| `color-export` | color | `#26a69a` | Export-to-grid arrow colour (overrides `color-grid`) |

**Editor preview:** renders static arrows at mid-scale values with node labels. No animation in editor mode.

**Default size:** 320×280 px (wider with battery node visible).

*Research note: HA has a dedicated energy cards section and a new **Distribution card** (introduced 2024) that renders energy distribution as a horizontal stacked bar / percentage chart — useful as a companion to the flow diagram. A future E14b could add a `feezal-element-material-energy-distribution` for exactly this: a horizontal stacked bar showing % from solar / grid / battery.*


### E22 — Computer stats element (`feezal-element-material-computer-stats`) ✅

A system monitoring element that visualises CPU, RAM, GPU and other resource metrics as a set of concentric ring gauges. Designed for dashboards showing server, NAS, Raspberry Pi, or gaming PC health. Data arrives from MQTT — any publisher works: [glances](https://github.com/nicolargo/glances) MQTT export, [MQTT System Stats](https://github.com/mqttx/mqttx) side-cars, Node-RED system nodes, or custom scripts.

> **Conventions:** dual-payload — (per-topic only) · auto-discovery: not a single-component target · custom inspector: N6 (ring builder: reorder, threshold, colour + info-row editor). See [Element platform conventions](#element-platform-conventions).

**Visual concept:** stacked concentric SVG rings (similar to the iOS Activity rings / Apple Watch fitness rings). Each ring represents one metric. The ring fills clockwise from 0 % to 100 %. A subtle gap remains at the top (starting position). A metric label + current value is shown to the right of (or below) the ring set when space allows.

Rings are rendered innermost→outermost in the order the user configures them. Up to 8 rings fit comfortably; with 3–5 rings the layout is cleanest. Each ring has an independent colour that pulses or changes when the value crosses a configurable warning/critical threshold.

**Ring colour behaviour:**
- Normal: ring colour as configured.
- Warning threshold crossed: ring colour transitions to amber (`#ff9800`).
- Critical threshold crossed: ring colour transitions to red (`#f44336`) and the ring label text also turns red.

**Pre-configured metric slots** (each is optional; any combination can be enabled):

| Slot key | Default label | Typical topic | Description |
|---|---|---|---|
| `cpu` | CPU | `stats/cpu` | CPU utilisation (0–100 %) |
| `cpu-temp` | CPU °C | `stats/cpu_temp` | CPU temperature — ring fills relative to `max` (e.g. 100 °C) |
| `ram` | RAM | `stats/ram` | RAM usage (0–100 %) |
| `swap` | Swap | `stats/swap` | Swap / page file usage (0–100 %) |
| `gpu` | GPU | `stats/gpu` | GPU utilisation (0–100 %) |
| `gpu-mem` | VRAM | `stats/gpu_mem` | GPU memory usage (0–100 %) |
| `gpu-temp` | GPU °C | `stats/gpu_temp` | GPU temperature |
| `disk` | Disk | `stats/disk` | Disk usage (0–100 %) |
| `load` | Load | `stats/load` | Load average (value scaled against `max`; default `max` = number of cores) |
| `net-up` | ↑ | `stats/net_up` | Network upload (value scaled against `max` in Mbit/s) |
| `net-down` | ↓ | `stats/net_down` | Network download |

Up to 4 **custom rings** can also be defined via a `custom-rings` JSON attribute — each with a topic, label, min, max, and colour — for metrics that don't fit the pre-configured slots (e.g. a battery, a UPS load, a custom sensor).

**Optional text rows below the rings:**

A compact status bar beneath the ring set can show additional values that don't map well to a ring (e.g. uptime, IP address, kernel version, number of running processes). Each row is a `{label, subscribe}` pair in the `info-rows` JSON array.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-cpu` | mqttTopic | — | CPU utilisation (%) |
| `subscribe-ram` | mqttTopic | — | RAM usage (%) |
| `subscribe-swap` | mqttTopic | — | Swap usage (%) |
| `subscribe-gpu` | mqttTopic | — | GPU utilisation (%) |
| `subscribe-gpu-mem` | mqttTopic | — | VRAM usage (%) |
| `subscribe-gpu-temp` | mqttTopic | — | GPU temperature |
| `subscribe-cpu-temp` | mqttTopic | — | CPU temperature |
| `subscribe-disk` | mqttTopic | — | Disk usage (%) |
| `subscribe-load` | mqttTopic | — | Load average |
| `subscribe-net-up` | mqttTopic | — | Upload (Mbit/s) |
| `subscribe-net-down` | mqttTopic | — | Download (Mbit/s) |
| `rings` | string | `["cpu","ram","gpu"]` | JSON array of slot keys to render, in inner→outer order |
| `ring-width` | number | `10` | Width of each ring in px |
| `ring-gap` | number | `4` | Gap between rings in px |
| `warn-threshold` | number | `75` | % value at which ring turns amber |
| `crit-threshold` | number | `90` | % value at which ring turns red |
| `cpu-color` | color | `#42a5f5` | Ring colour for CPU |
| `ram-color` | color | `#66bb6a` | Ring colour for RAM |
| `gpu-color` | color | `#ab47bc` | Ring colour for GPU |
| `disk-color` | color | `#26c6da` | Ring colour for Disk |
| `temp-color` | color | `#ff7043` | Ring colour for temperature slots |
| `net-color` | color | `#ffca28` | Ring colour for network slots |
| `custom-rings` | string | `[]` | JSON array of `{subscribe, label, color, min, max}` extra ring definitions |
| `info-rows` | string | `[]` | JSON array of `{label, subscribe}` text rows below the rings |
| `show-labels` | boolean | `true` | Show metric label + value alongside each ring |
| `show-legend` | boolean | `true` | Show a colour-coded legend below the rings listing all active metrics and current values |
| `animate` | boolean | `true` | Animate ring fill transitions |
| `host-label` | string | `""` | Optional hostname / machine label shown at the top of the element |

**Load average scaling:** when `subscribe-load` is used, `load-cores` (integer, default `4`) defines the maximum — a load of 4.0 on a 4-core machine fills the ring to 100 %. Independently configurable via `load-max` if the auto-scale is not desired.

**Temperature scaling:** temperature rings use `temp-max` (default `100`) as the 100 % mark. The ring fills to `current / temp-max`.

**Network ring scaling:** each direction uses its own `net-max` (default `1000` Mbit/s). Values above max clamp at 100 % fill and the label turns bold.

**Editor preview:** renders three rings (CPU, RAM, GPU) at static fill values (65 %, 48 %, 30 %) with placeholder labels. No animation in editor mode.

**Default size:** 200×200 px (square; ring diameter scales to the shorter dimension). Grows vertically when `show-legend` is true.


### E23 — Map element (`feezal-element-material-map`) ✅

A geographic map widget that displays one or more tracked positions on an OpenStreetMap tile layer via [Leaflet.js](https://leafletjs.com/). The primary and most compelling use-case is **[OwnTracks](https://owntracks.org/)** family/friends/device tracking: with a single MQTT wildcard subscription the element auto-discovers every person in the household and renders them as avatar pins on the map — battery level, accuracy circle, geofence badges and all. Also works with any other MQTT position source (ioBroker material map's `lon;lat` string format, Node-RED GPS nodes, custom scripts, vehicle trackers via qtripp, etc.).

---

#### OwnTracks integration 

[OwnTracks](https://owntracks.org/) is an open-source mobile app (iOS + Android) that publishes the device's location to a private MQTT broker. It follows a well-documented JSON protocol:

**Topic structure:**
- `owntracks/<user>/<device>` — location messages (`_type: "location"`)
- `owntracks/<user>/<device>/info` — card messages (`_type: "card"`) with a display name and **face** (Base64-encoded PNG avatar)

**Location payload** (key fields from `_type: "location"`):
```json
{
  "_type": "location",
  "lat": 48.137,
  "lon": 11.575,
  "tst": 1719388800,
  "tid": "JD",
  "acc": 15,
  "batt": 72,
  "vel": 0,
  "inregions": ["Home"]
}
```

**Card payload** (published to `owntracks/<user>/<device>/info`, retained):
```json
{
  "_type": "card",
  "tid": "JD",
  "name": "Jane",
  "face": "<base64-encoded PNG>"
}
```

The `face` field is a Base64-encoded PNG set directly in the OwnTracks app — it can be any profile picture, and naturally lends itself to fun/custom avatars. When the feezal element receives a card message it decodes the PNG and renders it as a circular avatar pin on the map for that person. If no card is available, a coloured circle with the `tid` initials is used as fallback.

**Auto-discovery:** the element subscribes to `owntracks/+/+` (wildcard) and `owntracks/+/+/info` on startup. Every person who publishes while the dashboard is open is automatically added to the live person roster — no manual per-person configuration required. Persons whose broker connection drops trigger an LWT (`_type: "lwt"`) which the element uses to show a greyed-out "offline" marker.

**Per-person display config — N6 custom inspector:**

> ⚠️ **This element requires a custom inspector (N6).** Because the person roster is built dynamically from MQTT wildcard subscriptions, configuring per-person overrides (nickname, avatar override, colour, visibility) through the standard flat attribute inspector would be terrible UX. The element ships with a dedicated inspector component (a full `<feezal-inspector-map>` web component loaded via N6) that renders:
>
> - A live **person roster** table: shows each auto-discovered `owntracks/<user>/<device>` alongside their card avatar (if received), last-seen timestamp, battery %, and current geofence region.
> - **Per-person overrides:** nickname field, custom avatar upload (PNG/JPG → stored as data-URL in element config), pin colour picker, "show on map" toggle.
> - **Home marker:** lat/lon input + label for a static home-base pin.
> - **Waypoints strip:** optional list of saved OwnTracks waypoints (geofences) to overlay as named circles on the map.
> - **Tile provider selector** and zoom defaults.

The element stores the person overrides as a JSON blob in a single `persons` attribute that the custom inspector manages — the dashboard author never edits this JSON by hand.

---

#### General marker mode (non-OwnTracks)

When `owntracks-mode` is `false`, the element works as a generic multi-marker map:

**Coordinate formats accepted** (configurable via `coord-format`):
- Separate topics for latitude and longitude (two `mqttTopic` attributes)
- Combined `lat,lon` string on one topic (comma- or semicolon-separated — ioBroker compat)
- JSON object `{"lat": 48.1, "lon": 11.6}` on one topic

A single-marker shorthand via top-level `subscribe-lat` / `subscribe-lon` (or `subscribe-position`) covers the common single-device case. For multiple markers in generic mode, a `markers` JSON attribute configures each one: `{subscribe, label, icon, color, coord-format}`.

---

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `owntracks-mode` | boolean | `true` | Enable OwnTracks auto-discovery (subscribes `owntracks/+/+` and `owntracks/+/+/info`) |
| `owntracks-prefix` | string | `owntracks` | MQTT topic prefix (override if using a custom `pubTopicBase` in OwnTracks config) |
| `persons` | string | `{}` | JSON blob of per-person overrides; managed by the custom inspector (N6) |
| `subscribe-lat` | mqttTopic | — | Latitude topic — generic mode, single marker |
| `subscribe-lon` | mqttTopic | — | Longitude topic — generic mode, single marker |
| `subscribe-position` | mqttTopic | — | Combined position topic (parsed per `coord-format`) |
| `coord-format` | `lat,lon` \| `lon,lat` \| `json` | `lat,lon` | How to parse a combined position topic |
| `markers` | string | `[]` | JSON array of generic marker definitions `{subscribe, label, icon, color, coord-format}` |
| `zoom` | number | `13` | Initial zoom level (1–19) |
| `tile-url` | string | OSM default | Custom tile server URL template |
| `home-lat` | number | — | Static home-base marker latitude |
| `home-lon` | number | — | Static home-base marker longitude |
| `home-label` | string | `Home` | Label for the home-base marker |
| `show-zoom` | boolean | `true` | Show Leaflet zoom controls |
| `show-accuracy` | boolean | `true` | Show accuracy circle around OwnTracks markers |
| `show-battery` | boolean | `true` | Show battery % badge on OwnTracks avatar pins |
| `show-regions` | boolean | `true` | Show geofence region name badge on pins (`inregions[0]`) |
| `follow` | boolean | `true` | Auto-pan/zoom to keep all active markers in view |
| `stale-minutes` | number | `60` | Minutes after last fix before a marker is considered stale and shown dimmed |
| `label` | string | `""` | Optional overlay label in top-left corner of the map |

**Editor mode:** Leaflet loads and renders the configured `home-lat`/`home-lon` or a world-centre default. A placeholder house pin is shown. No MQTT connection in editor.

**Dependency:** Leaflet.js (~42 KB gzip) — ES module import inside the element, not global. Tiles fetched from the configured tile server directly by the browser.

**Default size:** 320×240 px.



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

### A8 — Per-site tree-shaking for static HTML export ✅ implemented

**Approach used:** Option A (per-export Vite build) with graceful Rollup fallback.

At export time:
1. `server/src/build/extract-elements.js` parses the site's `views.html` for all `feezal-element-*` and `feezal-theme-*` tag names (including `child-element="…"` attributes on the repeater element).
2. Resolved package names are checked against `www/node_modules/@feezal/` — missing packages are silently skipped.
3. A temporary entry file (`www/src/_export-entry.js`) is generated importing only the needed packages plus the active theme.
4. `vite.build()` (called via dynamic `import()` from CJS) produces a minified IIFE; the entry file is deleted after the build.
5. Results are cached in-memory by a SHA-256 hash of the sorted package list for the lifetime of the server process.
6. If the Vite build fails for any reason the existing Rollup path (full `viewer-bundle.js`) is used as a fallback.

**Files changed:** `server/src/build/extract-elements.js` (new), `server/src/build/export.js`.

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
