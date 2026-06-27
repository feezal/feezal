# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Bugs

### B8 — Elements cannot be dragged to the far edge of an oversized view ❓ questionable
When the view's canvas dimensions exceed the browser viewport (i.e. the page is scrollable), elements stop before reaching the right and/or bottom edge of the canvas. The cutoff distance matches the scroll offset: if the user has scrolled 200 px down, elements can be dragged at most to `viewHeight − 200 px` rather than the full `viewHeight`. Same issue occurs horizontally.

**View sizing modes and their drag boundaries:**

| Mode | Actual canvas boundary | Expected drag limit |
|---|---|---|
| Fixed px (e.g. `1920×1080`) | Explicit pixel dimensions | `offsetWidth` / `offsetHeight` of the view element |
| Auto / percentage (`width:100%; height:100%`) | Unbounded — extends to wherever the farthest elements are; absolutely-positioned children do not cause the view container itself to grow | Effectively unlimited — no upper clamp should be applied |

In the auto/percentage case, `offsetWidth/offsetHeight` of the view element just returns the viewport size (100% = viewport, and absolutely-positioned children are outside normal flow so they don't expand the container). Using that as the drag limit reproduces the same clipping bug as the fixed case. The correct behaviour is to apply no upper-bound restrict at all, so the user can freely drag elements to any position and the page scroll follows.

**Root cause:** the drag `restrict` modifier in `feezal-sidebar-inspector.js` computes the bounding rect from `viewEl.getBoundingClientRect()`, which returns the *visible* portion of the element clipped to the viewport. When the page is scrolled, the top/left of this rect shifts, shrinking the effective drag area by exactly the scroll offset.

**Fix strategy — branch on view sizing mode:**

```js
const isFixedWidth  = /^\d+px$/.test(viewEl.style.width);
const isFixedHeight = /^\d+px$/.test(viewEl.style.height);
const viewRect = viewEl.getBoundingClientRect();

const restrict = {
    left:   viewRect.left,
    top:    viewRect.top,
    // Fixed axis: use full layout size. Auto axis: use a very large value (no clamp).
    right:  viewRect.left + (isFixedWidth  ? viewEl.offsetWidth  : 1e6),
    bottom: viewRect.top  + (isFixedHeight ? viewEl.offsetHeight : 1e6)
};
```

This handles all combinations: fixed×fixed, fixed×auto, auto×auto.


---

## Near-term Improvements

### N11 — Dual snap lines per axis

When dragging an element, show up to 2 vertical and 2 horizontal snap-helper lines simultaneously — one per side of the dragged element that has a nearby match.

**Current behaviour:** `_snap()` uses a single `nearX` / `nearY` "winner-takes-all" threshold. Only one vertical and one horizontal line is ever shown.

**Desired behaviour:** Track the four sides of the dragged element independently:

| Tracker | Dragged side | → DOM line |
|---|---|---|
| `leftSnap` | left edge | `vsnap1` |
| `rightSnap` | right edge | `vsnap2` |
| `topSnap` | top edge | `hsnap1` |
| `botSnap` | bottom edge | `hsnap2` |

Each tracker independently records the nearest other-element edge within `range`. At the end of the scan, `vsnap1`/`vsnap2` are shown or hidden independently (both can be visible). `object.x` is still the closer of left/right (interact.js snaps to one position). A secondary line that shows but doesn't "win" is purely visual feedback ("you're near this guide"), matching Figma's behaviour.

**Scope:** only the `_snap()` element-snapping path. Grid snap and `_snapSize` (resize) are unchanged. No new DOM elements needed — the 4 existing snap lines are repurposed as left/right/top/bottom.

### N2b — Repeater with live canvas sub-elements *(future)*
Each repeater child becomes individually selectable and configurable on the editor canvas. Requires a virtual sub-editor context — significantly more complex, deferred until the MVP repeater is proven useful.



### N4 — Palette Manager 🔽 low priority
Install additional `@feezal/feezal-element-*` packages from the editor UI without touching the terminal. Requires a backend endpoint that runs `pnpm add` in the `www/` workspace.

### N6 — Custom element inspectors

An element package can ship a Web Component that **fully replaces** the generic attribute form in the sidebar inspector when that element is selected. The style section (position, size, background, etc.) remains below it, unchanged.

#### Declaration

The element declares the custom inspector by adding an `inspector` key to `static get feezal()`:

```js
static get feezal() {
    return {
        palette: { … },
        inspector: 'feezal-element-basic-chart-inspector',  // custom element tag name
        attributes: [ … ],
        styles: [ … ]
    };
}
```

The tag must be defined and registered (via `customElements.define`) in the same element package file. No separate discovery, no extra files.

#### Rendering

When an element with `feezal().inspector` set is selected, `feezal-sidebar-inspector-attributes.js` renders the named custom element in place of the standard attribute form:

```html
<feezal-element-basic-chart-inspector></feezal-element-basic-chart-inspector>
```

The selected element's DOM reference is passed directly to the inspector component as its `.element` property immediately after insertion (same render cycle). The inspector can read any attribute or property from this reference.

#### Writing changes back

The inspector dispatches a standard `feezal-attribute-changed` CustomEvent (bubbles, composed) with `detail: { name, value }` — the same event shape that the built-in attribute controls already use:

```js
this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
    bubbles: true,
    composed: true,
    detail: { name: 'series', value: JSON.stringify(newSeries) }
}));
```

The sidebar listens for this event and applies it to the selected element exactly as it does for built-in controls. No other API is needed.

#### Lifecycle

- `.element` is set after the inspector is connected to the DOM; the inspector should react to it via a Lit reactive property.
- When the selection changes to a different element (or the inspector's own element type), the sidebar replaces the inspector component with a fresh instance.
- When selection is cleared, the inspector is removed.


### N8 — MQTT TLS certificate management

Two sub-features for secure broker connections, both server-side (TLS is terminated in Node.js; the browser is uninvolved).

**CA trust certificate (TLS servers):**
When connecting to an MQTT broker over TLS (`mqtts://`, `wss://`) that uses a self-signed or private CA certificate, the Node.js MQTT client needs to trust that CA. A file-upload control in the Connection settings sidebar lets the user upload a PEM-format CA certificate. The server stores it at `dataDir/certs/<siteName>/ca.pem` and passes it as the `ca` option to `mqtt.js`. The sidebar shows the current status ("CA cert: ✓ uploaded" / "none") with a remove button.

**Client certificate — mTLS:**
For brokers that require mutual TLS authentication, the user uploads both a PEM client certificate and a PEM private key. Stored as `dataDir/certs/<siteName>/client.crt` and `dataDir/certs/<siteName>/client.key` (the key is never served back to the browser). Passed as `cert` and `key` options to the MQTT client. The upload slots are shown only when the selected protocol is `mqtts://` or `wss://`.

**API surface:**
- `POST /api/sites/:name/certs` — multipart form upload; accepts `ca`, `cert`, and `key` fields.
- `DELETE /api/sites/:name/certs/:type` — removes a previously uploaded file (`ca`, `cert`, or `key`).
- `GET /api/sites/:name/certs` — returns which cert files are currently present (names only, never content).

### N9 — MQTT protocol transport and version

**Browser protocol limitation and backend bridge:**
Browsers cannot open raw TCP-based MQTT (`mqtt://` / `mqtts://`) — only WebSocket (`ws://` / `wss://`). When the user selects `mqtt://` or `mqtts://` in the connection form (N7), the broker connection must be proxied through the feezal server: the backend establishes the TCP connection to the broker and relays messages to the browser via the existing Socket.IO channel ("feezal bridge" mode, `feezal-connection-feezal.js`).

**Export error for non-WebSocket protocols:**
A statically exported site has no feezal server to relay through. When the user triggers an export while `mqtt://` or `mqtts://` is selected, the export must surface a clear, actionable error rather than silently producing a broken bundle:

> *"Static export is not supported with mqtt:// or mqtts:// connections. Exported sites connect directly from the browser and require a WebSocket-capable MQTT broker (ws:// or wss://). Switch the connection protocol to ws:// or wss:// before exporting."*

**Configurable MQTT protocol version:**
Add a `version` selector to the Connection UI (`sl-select`: **3.1.1** / **5.0**). The value is stored in `viewer.json` alongside the URI and passed to the MQTT client as the `protocolVersion` option (integer `4` for MQTT 3.1.1, integer `5` for MQTT 5.0 — per the `mqtt.js` API). The feezal bridge relay must honour the same setting when it opens the upstream TCP connection. Default: **3.1.1** (current implicit behaviour, no breaking change).

### N10 — Credential security: live viewer bridge + export runtime prompt

MQTT credentials (username, password) and TLS private keys (N8 mTLS) must not be visible in page source or export bundles. The threat model differs between deployment modes:

#### Live viewer (feezal server running) — server-side bridge

The feezal backend already acts as an MQTT relay for `mqtt://`/`mqtts://` connections (the "feezal bridge" in `feezal-connection-feezal.js`). Extend this to cover **all** connection modes, including `ws://`/`wss://`. The browser speaks only to the feezal server via Socket.IO; the server holds all credentials and opens the MQTT connection entirely on the backend side. Nothing sensitive is injected into the viewer HTML.

This fully solves the live-viewer case: credentials live in `viewer.json` on the server filesystem, mTLS keys stay in `dataDir/certs/` and are never served to the browser.

The Connection sidebar should expose this as an explicit toggle: **"Connect via server (recommended)"** / **"Connect directly from browser"** — with a warning when direct mode is selected explaining that credentials will be present in the page source.

#### Static export — runtime credential prompt

A static export has no server to relay through. Any credential baked into the HTML is readable by whoever has the file. The preferred approach:

**Preferred: Runtime credential prompt.** The exported site detects that connection credentials are missing or redacted (a sentinel value in the baked config) and shows a login dialog on first load:
- Fields: **broker URL**, **username**, **password** (if the broker requires auth).
- Credentials are stored in `sessionStorage` (cleared when the tab closes) or optionally `localStorage` (persisted across reloads, user's choice via a "Remember" checkbox).
- The exported HTML contains the broker host/port but **not** the credentials — the sensitive parts are supplied at runtime by the person who opens the page.
- Suitable for kiosk/shared-display setups where the operator enters credentials once.

**Alternative: Config sidecar.** The ZIP includes a `config.js` template with placeholder credentials. The user populates and serves it separately; `index.html` reads `window.FEEZAL_CONFIG` at startup. The ZIP is safe to commit or share without containing any secrets.

**mTLS + static export — OS certificate store path (no hard error).**

Two questions arise naturally:

**Q: Why not let the user paste the PEM cert/key at first run, like username/password?**
Different authentication layers:
- **Username/password** is an MQTT application-layer credential — `mqtt.js` constructs the CONNECT packet in JavaScript, fully controllable from JS. Runtime prompt + `sessionStorage`/`localStorage` storage is feasible (see above).
- **mTLS client certificates** authenticate at the **TLS handshake layer**, which runs *below* the WebSocket. The browser's TLS stack drives it — the WebSocket API has no interface for passing a PEM string programmatically. The browser only uses certificates from the OS/browser certificate store. Pasting a PEM key into a dialog would store bytes that the TLS stack never sees.

**Q: Why not tell the user to import the cert into the OS/browser certificate store?**
This actually *works* — and is the right answer for static exports. When the broker requests a client certificate during the WSS handshake, the browser intercepts with its native certificate picker. The user selects the installed cert, the handshake completes with full mTLS. `mqtt.js` in the browser uses the native `WebSocket` API and gets mTLS for free, without any code changes.

**Revised approach for static export with mTLS:**
- The export proceeds (no hard error), but the client cert/key are **not** embedded in the ZIP (they would be a security liability in a static file).
- The export dialog shows a prominent, actionable warning:
  > *"This site uses mTLS client authentication. The client certificate and private key are not included in the export — they must be installed in the OS/browser certificate store on any device that opens this dashboard. The browser will present the certificate automatically when the broker requests it."*
- The exported ZIP includes a `MTLS-SETUP.md` with step-by-step OS instructions (Windows: Certificate Manager / MMC snap-in; macOS: Keychain Access; Linux: `certutil` / browser settings; Firefox: Preferences → Privacy → Certificates).
- The `viewer.json` baked into the export contains only the broker host/port and protocol — no cert paths, no key material.

The private key remains exclusively in `dataDir/certs/` on the feezal server (N8). For the live-viewer path it is used directly by the Node.js MQTT client; for static export the user installs it alongside the cert in their OS store (standard operational practice for mTLS deployments).

### N12 — MQTT Auto-Discovery (config-topic import)

A general framework that reads the widely-adopted MQTT **auto-discovery** config-topic convention (popularised by Home Assistant and emitted by zigbee2mqtt, ESPHome, Tasmota, Zigbee2MQTT, WLED, and many others) and uses it to **pre-wire feezal elements automatically**. The user points feezal at their broker; feezal already knows the device's topics, payload schema, value ranges, and units — so dropping a light, thermostat, or shutter onto the canvas can be a single click instead of a dozen manual topic entries.

> **Wording / branding.** This feature is **brand-neutral** in the UI. The use case is *zigbee2mqtt → feezal* (and any other publisher of the same topic format); it does not require or involve a Home Assistant instance. The UI never says "Home Assistant". Terms used: **Auto-Discovery** (the feature), **config topics** (the scanned retained messages), **Auto-configure** (the apply action), **Discovered devices** (the browser).

---

#### How auto-discovery topics work

Publishers emit a **retained** JSON config message per entity to a well-known topic under a configurable prefix (default `homeassistant`):

```
<prefix>/<component>/<node_id>/<object_id>/config        # component discovery
<prefix>/<component>/<object_id>/config                  # short form
<prefix>/device/<node_id>/config                         # device discovery (one payload, many entities via "cmps")
```

The payload describes the entity: its command/state topics, payload values, value ranges, units, supported colour modes, etc. Keys are heavily **abbreviated** (`stat_t`, `cmd_t`, `bri_cmd_t`, `~`) and a `~` field provides a base topic that the abbreviations expand against.

**Example** (zigbee2mqtt light, JSON schema):
```json
{
  "~": "zigbee2mqtt/Living Room Lamp",
  "name": "Living Room Lamp",
  "unique_id": "0x00158d0001abcd_light_zigbee2mqtt",
  "stat_t": "~", "cmd_t": "~/set", "schema": "json",
  "brightness": true, "brightness_scale": 254,
  "color_mode": true, "supported_color_modes": ["xy", "color_temp"],
  "max_mireds": 500, "min_mireds": 150
}
```

#### Server-side discovery registry

A new server module subscribes (on broker connect) to the discovery wildcards:

```
<prefix>/+/+/config
<prefix>/+/+/+/config
<prefix>/device/+/config
```

For every retained config message it:
1. **Expands** abbreviations to full keys and resolves the `~` base topic.
2. **Normalises** both single-component payloads and device-discovery payloads (`cmps` / `components` map) into a **flat entity list**: `{ discovery_id, component, name, unique_id, topics{…}, schema, ranges{…}, options{…} }`.
3. **Caches** the entity list in memory (keyed by `discovery_id`), updating on every retained-config change so it always reflects the live broker state.
4. Removes an entity when its config topic is cleared (empty retained payload), matching the standard "delete by empty config" convention.

The prefix is configurable per site (default `homeassistant`); auto-discovery can be disabled entirely per site.

**REST surface:**
- `GET /api/discovery/devices` — the normalised flat entity list for the current site.
- `GET /api/discovery/devices/:id` — a single normalised entity (used when applying).

#### Per-component mapping tables

For each supported `component` type there is a mapping table: discovery keys → feezal element + attribute values, including **unit/scale conversions**. Shipped incrementally:

| Discovery component | feezal element | Notable conversions |
|---|---|---|
| `light` *(first)* | `feezal-element-material-light` | `brightness_scale` (often 254/255) → 0–100 %; mireds ↔ kelvin; `supported_color_modes` → element colour mode |
| `climate` | `feezal-element-material-climate` (E11) | `temp_step`, `min/max_temp`, mode lists |
| `cover` | `feezal-element-material-shutter` (E12) | position scale, tilt range |
| `switch` | `feezal-element-material-switch` | payload on/off |
| `fan` | `feezal-element-material-fan` (E18) | percentage range, preset modes |
| `humidifier` | `feezal-element-material-humidifier` (E19) | target range |
| `lock` | `feezal-element-material-door-lock` (E13) | state/command payloads |
| `vacuum` | `feezal-element-material-vacuum` (E21) | fan-speed list, command set |
| `sensor` / `binary_sensor` | `feezal-element-basic-value` / `feezal-element-material-contact` (E27) | unit, device_class → icon |

Each element declares which discovery component(s) it can consume (see **Element platform conventions** in the Element Ecosystem section). New elements register their mapping without touching the framework.

#### Two ways to consume discovery in the editor

**1. Reactive "Auto-configure" banner (topic-driven).**
When the user types or picks a topic in an element's inspector (e.g. `zigbee2mqtt/Living Room Lamp`), the inspector queries the registry for an entity whose `state_topic` / base topic matches. On a hit it shows a non-intrusive banner:

> *⚡ Found a matching device config for this topic — **Auto-configure**?*

Clicking **Auto-configure** applies the full mapped attribute set in one step (and, if the element type doesn't match the component, offers to swap to the right element type).

**2. Proactive "Discovered devices" browser.**
A panel (palette tab or dialog) lists every discovered entity grouped by device, each with its name, component icon, and topic. Dragging one onto the canvas (or clicking "Add") creates the correct element **fully pre-wired** — zero manual attribute entry.

#### Apply semantics — MVP vs. future

- **MVP: one-time snapshot apply.** Auto-configure writes concrete attribute values into the element; there is no live link afterwards. The element also stores the source **`discovery-id`** attribute so it can be re-matched later.
- **Future (not MVP): re-sync.** Because each auto-configured element carries its `discovery-id`, a later enhancement can detect when the device's config topic changes (e.g. firmware adds a colour mode) and offer to re-apply. Stored now, implemented later.

#### Relationship to dual-payload elements

zigbee2mqtt (and HA discovery generally) most often uses the **JSON schema** (one state topic, one command topic, JSON payloads). Some setups — including the maintainer's — configure zigbee2mqtt to publish each property on a **separate topic** instead. To consume both, the controllable elements must support **both payload modes**; this is captured once in **Element platform conventions** below and is a prerequisite for `light`, `climate`, and `cover` auto-configuration.

---

## Element Ecosystem

### Element platform conventions

Cross-cutting capabilities that apply to many elements below. Individual element sections reference these by name (e.g. *"Conventions: dual-payload ✓ · discovery: `light` · inspector: N6"*) rather than repeating the full spec, and only call out element-specific details (e.g. a particular unit conversion).

#### Dual payload mode (`payload-mode`)

Controllable elements that read/write several related properties (state, brightness, colour, position, setpoint, …) must support **two interchangeable wiring styles**, selected by a `payload-mode` attribute:

- **`separate` (default)** — one `mqttTopic` attribute per property (`subscribe-state`, `subscribe-brightness`, `publish-color`, …). Matches users who split every property onto its own topic (incl. zigbee2mqtt configured that way, ioBroker states, Node-RED flows).
- **`json`** — a single `subscribe`/`publish` topic pair carrying a JSON object. A `json-map` (or sensible defaults) maps element properties to JSON paths, e.g. `{"state":"state","brightness":"brightness","color_temp":"color_temp","color":"color.x|color.y"}`. Matches zigbee2mqtt default schema, ESPHome, and HA-discovery JSON-schema devices.

Outgoing commands mirror the mode: `separate` publishes per-topic; `json` publishes a single merged JSON object. The base `FeezalElement` should provide a shared helper for both directions so each element only declares its property↔key map.

#### Auto-discovery target (N12)

An element that can be produced by **Auto-Discovery (N12)** declares the discovery component(s) it consumes and its property mapping in `static get feezal()`:

```js
static get feezal() {
    return {
        palette: { … },
        discovery: {
            component: 'light',              // or ['switch','light'] etc.
            // discovery-key → element-attribute, with optional transform
            map: {
                state:      'subscribe-state',
                brightness: { attr: 'subscribe-brightness', scaleTo: 100 },
                color_temp: { attr: 'subscribe-color-temp', unit: 'mired→kelvin' }
            }
        },
        attributes: [ … ]
    };
}
```

The N12 framework reads this descriptor to pre-wire the element; no framework change is needed to support a new element type. Auto-configured elements persist a `discovery-id` attribute for future re-sync.

#### Custom inspector (N6)

Elements with **dynamic, repeating, or visual-layout configuration** (lists of modes, rings, nodes, persons, slots, contacts) should ship an N6 custom inspector instead of relying on the flat attribute form. Elements that benefit are tagged below. The standard flat inspector remains the default for simple elements.

#### Lessons from the Light element (E16 → E35)

The Light element (`feezal-element-material-light`) was the first device-control card to go end-to-end (basic element → dual-payload → N6 inspector → auto-discovery → theming). The refinements it needed are now **standing requirements for every device-control card** (Thermostat E11, Shutter E12, Door-lock E13, …). Build them in from the start instead of retrofitting:

1. **Palette category `Device`, not `Material`.** Device-control cards live in the `Device` palette category (the element *tag* keeps its `feezal-element-material-*` name; only the `palette.category` string is `Device`). The palette groups dynamically, so a new category needs no other code.
2. **Ship the N6 inspector with the element, never retrofit it.** The flat form exploded to ~30 attributes and became unusable. A two-tab inspector (**Topics** + **Config**) with **capability-gated, collapsible sections** is the baseline. A section is enabled when any of its topic attributes is non-empty; toggling it off clears those topics. Don't add `has-*` capability booleans — **derive section enablement from topic presence**.
3. **Discovery is JSON-first.** zigbee2mqtt / HA emit a `schema: json` config pointing at the consolidated JSON form, so an auto-configured card must **default `payload-mode: json`**. The discovery descriptor maps **only the attributes the element actually consumes**, using `onlyWhen` guards and transforms (`mired→kelvin`, scale, `valueMap`, `join`, `colorMode`, …) added to `_applyDiscovery()` in `feezal-sidebar-inspector-attributes.js`. `discovery-id` is a `reflect: true` property.
4. **Dual payload, element-managed subscriptions.** Override the base `_subscribe()` as a no-op and manage subscriptions directly: a single JSON topic in `json` mode, per-topic wiring in `separate` mode. `payload-mode` defaults to `separate` for hand-wired back-compat, but discovery flips it to `json`.
5. **Theme-aware, state-aware colour tokens — a *small* set.** Don't hardcode colour attributes. Expose CSS custom properties (`--feezal-<el>-*`) that **default to theme vars**, surface them in the **style inspector**, and show those defaults as **placeholders** (the inspector reads inline style only). Keep the set minimal and state-aware — Light consolidated 8 tokens down to 5 (on / off / surface / text / error).
6. **The N6 inspector must match the standard inspector.** Custom inspectors don't inherit the shell's Shoelace theming, so replicate the standard `::part(base|combobox|input|form-control-label)` rules (dark-mode bg/border/label) and set `autocomplete="off"` on every `sl-input`. In return, the shell renders a **generic discovery device picker** above any N6 inspector automatically — the element just needs a `discovery` descriptor.
7. **Availability badge, controls never disabled.** Optional `subscribe-availability` (+ `payload-available` / `payload-unavailable`) drives a small corner badge when the device is unavailable. **Never disable the controls** — the card stays usable regardless of availability.
8. **Ground the design in a real device.** Light was built against a real Philips Hue via zigbee2mqtt, which surfaced every nuance (separate stream, nested-`color` JSON, mireds, effect list). Do the same for each new card — pick a concrete climate / cover / lock device and model its real topic shapes.

### E4 — Camera element
Renders a live camera stream on the dashboard canvas. Targets three source types:
- **MJPEG**: a plain `<img>` with a streaming URL — works anywhere, no codec negotiation.
- **WebRTC**: for low-latency feeds from cameras that support it (Frigate, go2rtc, etc.). Requires an SDP/signalling integration.
- **HLS / RTSP-over-HTTP**: via a `<video>` element with an HLS.js adapter for browsers that don't natively support HLS.

Configurable attributes: `src`, `type` (mjpeg / webrtc / hls), `fit` (cover / contain), `muted`, `autoplay`. Falls back to a placeholder frame when the stream is unreachable.

### E9 — Flexbox layout element *(backlog, depends on N6)*

A canvas element that acts as a **visual flexbox container** for sub-views or child elements. Unlike the free-form absolute-position canvas, this element enforces a flex layout so the user can build structured page regions (sidebars, grids, responsive rows) without manually positioning every child.

**Custom inspector (N6):**
Ships with a dedicated inspector web component (via N6) that replaces the generic attribute form with a drag-and-drop **layout preview panel**:
- Visual representation of the flex container with draggable child slots.
- Controls for `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap` rendered as icon-button groups rather than raw text inputs.
- Add / remove / reorder child slots directly in the inspector; each slot maps to a named `feezal-view` embedded inside the container.

**Runtime:**
- Each child slot hosts a `feezal-element-basic-view` referencing a named sub-view. Sub-views are full feezal views — they can contain any elements and respond to MQTT normally.
- Container sizing: flex children use `flex: 1` by default; the inspector lets users set custom `flex-grow`, `flex-shrink`, `flex-basis` per slot.
- Responsive behaviour: `flex-wrap: wrap` + `min-width` on slots gives automatic reflow on smaller screens without needing A4 breakpoints.

**Editor:**
At edit time the container renders its child view slots with a checkerboard background and slot label overlay (similar to `feezal-element-basic-view`). Selecting the container opens the custom layout inspector; selecting a child slot navigates into that sub-view for normal element editing.

### E7 — Swipe gesture element
A **pseudo-element** (invisible placeholder in the editor, position/size irrelevant) that enables swipe-to-navigate between views in the viewer. Pairs naturally with U13 (viewer mobile support).

Configurable attributes:

| Attribute | Type | Default | Description |
|---|---|---|---|
| `views` | comma-separated names | *(all views in order)* | Which views participate in the swipe cycle and in what order |
| `direction` | `horizontal` \| `vertical` | `horizontal` | Swipe axis |
| `threshold` | number (px) | `50` | Minimum swipe distance to trigger navigation |
| `animate` | boolean | `true` | Slide animation between views |
| `wrap` | boolean | `true` | Whether swiping past the last view wraps back to the first |

Listens for `touchstart`/`touchend` (and `pointerdown`/`pointerup` for unified pointer handling) on the viewer root. Does not interfere with scrollable content inside elements — only triggers when the swipe starts on an unoccupied area or is sufficiently directional.

### E10 — More material elements (`feezal-element-material-*`)

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

### E11 — Climate element (`feezal-element-material-climate`)

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

### E12 — Shutter / Blinds element (`feezal-element-material-shutter`)

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

### E13 — Door lock element (`feezal-element-material-door-lock`)

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

### E14 — Energy flow element (`feezal-element-material-energy-flow`)

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

### E15 — Media player element (`feezal-element-material-media-player`)

A full-featured music/media control panel for MQTT-connected media players (e.g. Music Assistant, Snapcast, MPD, Home Assistant media_player entities bridged via MQTT, Volumio, Mopidy).

**Visual concept:** a compact player card with album art as a blurred background tint, clean typography for track metadata, an `md-linear-progress` seek bar, and icon-button transport controls. The layout adapts to the element's configured dimensions — at narrow widths the artwork shrinks to a small square thumbnail; at wider sizes it fills the left half of the card.

**Transport controls (row of `md-icon-button`):**

`skip_previous` — `fast_rewind` — `play_arrow` / `pause` — `fast_forward` — `skip_next` — `stop` (optional) — `shuffle` (toggle) — `repeat` / `repeat_one` (cycle)

Each button publishes a configurable payload to `publish-command`. Play/pause toggles automatically based on `subscribe-state`. Shuffle and repeat show their active state visually (tinted icon when on).

**Progress bar:**
- Renders as `md-linear-progress` with a draggable thumb overlay for seeking.
- Current position read from `subscribe-position` (seconds or ISO 8601 duration); total duration from `subscribe-duration`.
- Displays elapsed / total time as `mm:ss / mm:ss` below the bar.
- On drag-release publishes the target position (seconds) to `publish-seek`.

**Album art:**
- `<img>` sourced from `subscribe-artwork-url` (a topic that carries a URL string) or a static `artwork-url` attribute.
- Falls back to a generic `album` Material icon when no art is available.
- Blurred and tinted variant of the art used as card background (CSS `backdrop-filter: blur` + low-opacity overlay) — degraded gracefully when the browser does not support `backdrop-filter`.

**Metadata fields:**
- **Title** — `subscribe-title` — large bold text, truncated with ellipsis.
- **Artist** — `subscribe-artist` — secondary text line.
- **Album** — `subscribe-album` — optional tertiary text line (hidden when attribute absent).

**Volume:**
- Optional `md-slider` row at the bottom of the card.
- Current volume read from `subscribe-volume` (0–100); changes published to `publish-volume`.
- Hidden when `show-volume` is `false`.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | Playback state topic (`play`/`pause`/`stop`/`idle`) |
| `publish-command` | mqttTopic | — | Topic for transport commands |
| `payload-play` | string | `play` | Payload for play button |
| `payload-pause` | string | `pause` | Payload for pause button |
| `payload-stop` | string | `stop` | Payload for stop button |
| `payload-next` | string | `next` | Payload for skip-next |
| `payload-previous` | string | `previous` | Payload for skip-previous |
| `payload-forward` | string | `forward` | Payload for fast-forward |
| `payload-rewind` | string | `rewind` | Payload for rewind |
| `subscribe-title` | mqttTopic | — | Currently playing track title |
| `subscribe-artist` | mqttTopic | — | Currently playing artist name |
| `subscribe-album` | mqttTopic | — | Currently playing album name |
| `subscribe-artwork-url` | mqttTopic | — | Topic carrying the album art URL string |
| `artwork-url` | string | `""` | Static fallback artwork URL |
| `subscribe-position` | mqttTopic | — | Current playback position in seconds |
| `subscribe-duration` | mqttTopic | — | Track duration in seconds |
| `publish-seek` | mqttTopic | — | Topic to publish seek position (seconds) to |
| `subscribe-volume` | mqttTopic | — | Current volume (0–100) |
| `publish-volume` | mqttTopic | — | Topic to publish new volume to |
| `subscribe-shuffle` | mqttTopic | — | Shuffle state (`true`/`false`) |
| `publish-shuffle` | mqttTopic | — | Topic to publish shuffle toggle |
| `subscribe-repeat` | mqttTopic | — | Repeat mode (`off`/`one`/`all`) |
| `publish-repeat` | mqttTopic | — | Topic to publish repeat mode |
| `show-volume` | boolean | `true` | Show volume slider row |
| `show-seek` | boolean | `true` | Show progress bar and time display |
| `show-artwork` | boolean | `true` | Show album art |
| `show-album` | boolean | `true` | Show album name line |
| `show-shuffle-repeat` | boolean | `true` | Show shuffle and repeat buttons |

**Editor preview:** renders a static card with placeholder artwork icon, dummy metadata ("Artist — Song Title"), and a progress bar at 40 %. Transport buttons are non-interactive.

**Default size:** 320×180 px.

### E17 — Alarm panel element (`feezal-element-material-alarm-panel`)

A security alarm control panel with PIN keypad entry and arm/disarm mode selection. Corresponds to HA's alarm panel card, widely used on wall-mounted dashboards.

> **Conventions:** dual-payload ✓ · auto-discovery: `alarm_control_panel` · custom inspector: N6 (arm-mode list builder). See [Element platform conventions](#element-platform-conventions). Element-specific: discovery `code_arm_required` → `require-code-to-arm`; `supported_features` → which mode buttons show.

**Visual concept:** a prominent status banner at the top (colour-coded by state), a 3×4 numeric keypad (0–9, ✕ clear, ✓ confirm), and arm-mode buttons arranged in a row below the keypad.

**States and colours:**

| State payload | Banner colour | Label |
|---|---|---|
| `disarmed` | `#4caf50` (green) | Disarmed |
| `arming` | `#ff9800` (amber) | Arming… |
| `armed_home` | `#2196f3` (blue) | Armed Home |
| `armed_away` | `#f44336` (red) | Armed Away |
| `armed_night` | `#9c27b0` (purple) | Armed Night |
| `triggered` | flashing `#f44336` | ALARM! |
| `pending` | `#ff9800` pulsing | Pending |

All state payloads and labels are configurable via `state-labels` JSON.

**ARM mode buttons:** rendered as `md-outlined-button` row; which modes are shown is controlled by a `modes` JSON array (same format as E11). Default modes: `armed_home`, `armed_away`. Each button press arms the panel in that mode; PIN entry is required if the alarm is currently armed.

**PIN entry:** digits accumulate into a masked `●●●●` display above the keypad. On ✓ the current PIN is published to `publish-action` as a JSON payload `{"action":"arm_home","code":"1234"}` (action determined by which mode button was pressed, or `disarm` when disarming). The element never stores or logs the PIN locally — it is published once and immediately cleared from the display.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | Current alarm state topic |
| `publish-action` | mqttTopic | — | Topic to publish arm/disarm JSON action |
| `modes` | string | `[{"value":"armed_home","label":"Home"},{"value":"armed_away","label":"Away"}]` | JSON array of arm mode objects |
| `require-code-to-arm` | boolean | `true` | Whether PIN is required for arming (not just disarming) |
| `code-length` | number | `4` | Expected PIN length; keypad auto-submits when reached |
| `state-labels` | string | `{}` | JSON map of state payload → display label overrides |
| `label` | string | `Alarm` | Panel title label |

**Default size:** 220×320 px.

### E18 — Fan control element (`feezal-element-material-fan`)

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

### E19 — Humidifier / dehumidifier element (`feezal-element-material-humidifier`)

A humidifier control element with a similar circular arc design to the thermostat (E11) — arc slider for target humidity, current humidity in the centre, on/off toggle, and mode selector. Covers humidifiers, dehumidifiers, and hygrostats.

> **Conventions:** dual-payload ✓ · auto-discovery: `humidifier` · custom inspector: N6 (mode list). See [Element platform conventions](#element-platform-conventions). Element-specific: discovery `min/max_humidity` → arc range; `device_class` (`humidifier`/`dehumidifier`) → `type`.

**Visual concept:** droplet-shaped accent arc (blue gradient) instead of a heat arc. The arc spans ~240° for target humidity (0–100 %). Current humidity shown in the centre. When the device is dehumidifying the arc colour shifts to an orange/amber gradient.

**Controls:**
- **Target humidity arc** — drag handle; publishes to `publish-target-humidity` on release.
- **On/Off** — tap/click centre; publishes to `publish-state`.
- **Mode chips** — configurable `md-filter-chip` row (normal / eco / baby / sleep / auto / boost). Publishes to `publish-mode`. Hidden when `modes` is empty.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | On/off state |
| `publish-state` | mqttTopic | — | Topic for on/off |
| `subscribe-current-humidity` | mqttTopic | — | Current measured humidity (0–100 %) |
| `subscribe-target-humidity` | mqttTopic | — | Current target humidity |
| `publish-target-humidity` | mqttTopic | — | Topic to publish target humidity |
| `subscribe-mode` | mqttTopic | — | Current mode |
| `publish-mode` | mqttTopic | — | Topic to publish selected mode |
| `modes` | string | `""` | JSON array of mode objects `{value, label}` |
| `type` | `humidifier` \| `dehumidifier` | `humidifier` | Changes arc colour direction (blue → humid, orange → dry) |
| `unit` | string | `%` | Humidity unit label |
| `label` | string | `""` | Label below the arc |

**Default size:** 200×240 px.

### E20 — Weather forecast element (`feezal-element-material-weather`)

A wall-display-optimised weather card. Shows current conditions prominently and an N-day or N-hour forecast strip. Data is entirely MQTT-driven: each data point comes from a separate topic, making it compatible with any weather provider that publishes to MQTT (e.g. via a bridge from openweathermap, DWD, yr.no).

**Visual concept:** top half — large animated SVG weather icon (sunny, partly cloudy, rainy, snowy, foggy, thunderstorm, etc.) with current temperature in a large typeface, and a secondary info row (feels-like, humidity, wind, UV index). Bottom half — a horizontal forecast strip: 5–7 slots, each with abbreviated day name, small weather icon, and high/low temperature bar.

**Animated weather icons:** SVG-based inline animations (clouds drifting, sun rays rotating, rain drops falling, snow drifting). Editor mode shows static icons.

**Current conditions topics:**

| Attribute | Description |
|---|---|
| `subscribe-condition` | Weather condition string (see condition map below) |
| `subscribe-temperature` | Current temperature |
| `subscribe-feels-like` | Apparent temperature |
| `subscribe-humidity` | Relative humidity (%) |
| `subscribe-wind-speed` | Wind speed |
| `subscribe-wind-direction` | Wind direction (degrees or cardinal string) |
| `subscribe-uv-index` | UV index (0–11+) |
| `subscribe-pressure` | Atmospheric pressure (hPa) |
| `subscribe-visibility` | Visibility (km) |

**Condition map** (configurable via `condition-map` JSON attribute to adapt non-standard payloads):
`sunny`, `partlycloudy`, `cloudy`, `fog`, `rainy`, `pouring`, `snowy`, `snowy-rainy`, `hail`, `lightning`, `lightning-rainy`, `windy`, `windy-variant`, `exceptional`, `clear-night`

**Forecast strip:** each of up to 7 forecast slots is configured as a JSON array topic. `subscribe-forecast` receives a JSON array payload:
```json
[
  {"day": "Mon", "condition": "sunny",       "high": 24, "low": 14},
  {"day": "Tue", "condition": "partlycloudy","high": 21, "low": 12},
  ...
]
```

**Display attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `unit` | `°C` \| `°F` | `°C` | Temperature unit |
| `wind-unit` | string | `km/h` | Wind speed unit label |
| `show-forecast` | boolean | `true` | Show forecast strip |
| `show-feels-like` | boolean | `true` | Show apparent temperature |
| `show-wind` | boolean | `true` | Show wind speed/direction |
| `show-humidity` | boolean | `true` | Show humidity |
| `show-uv` | boolean | `false` | Show UV index |
| `show-pressure` | boolean | `false` | Show pressure |
| `condition-map` | string | `{}` | JSON map of custom payload → standard condition string overrides |
| `location-label` | string | `""` | Optional location name shown above the icon |

**Default size:** 280×280 px (wider when forecast strip is enabled).

### E21 — Robot vacuum element (`feezal-element-material-vacuum`)

A robot vacuum control element. A popular type in the community (Mushroom vacuum card, 5k stars). Covers start/stop/pause/return-home controls, cleaning status, battery level, fan speed mode, and optional room/zone selector.

> **Conventions:** dual-payload ✓ · auto-discovery: `vacuum` · custom inspector: N6 (fan-speed / command-payload builder). See [Element platform conventions](#element-platform-conventions). Element-specific: discovery `fan_speed_list` → `fan-speeds`; `supported_features` → which command buttons are shown.

**Visual concept:** a top-down circular robot vacuum SVG illustration (simplified disc shape with bumper). A large status label below it ("Cleaning", "Docked", "Returning home", "Error"). Battery level shown as a small coloured bar segment on the robot body. Fan speed chips below.

**States and icon behaviour:**

| State | Illustration | Label colour |
|---|---|---|
| `docked` / `idle` | Static disc, charging indicator glow | `--secondary-text-color` |
| `cleaning` | Slow spin animation | `--primary-color` |
| `paused` | Static disc, pause overlay | `--accent-color` |
| `returning` | Arrow animation towards dock | `--primary-color` |
| `error` | Red tint, `!` overlay | `#f44336` |

**Controls (row of `md-icon-button`):**

| Button | Icon | Payload |
|---|---|---|
| Start / Resume | `play_arrow` | `publish-command` ← `start` |
| Pause | `pause` | `publish-command` ← `pause` |
| Stop | `stop` | `publish-command` ← `stop` |
| Return home | `home` | `publish-command` ← `return_home` |
| Locate | `location_searching` | `publish-command` ← `locate` |

Each payload is independently configurable (`payload-start`, `payload-pause`, `payload-stop`, `payload-return-home`, `payload-locate`).

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe-state` | mqttTopic | — | Current vacuum state |
| `publish-command` | mqttTopic | — | Topic for commands |
| `subscribe-battery` | mqttTopic | — | Battery level (0–100 %) |
| `subscribe-fan-speed` | mqttTopic | — | Current fan speed mode |
| `publish-fan-speed` | mqttTopic | — | Topic to publish fan speed |
| `fan-speeds` | string | `""` | Comma-separated fan speed mode names (e.g. `quiet,standard,turbo`) |
| `subscribe-area` | mqttTopic | — | Currently cleaning area/room name |
| `state-labels` | string | `{}` | JSON map of state payload → display label overrides |
| `show-locate` | boolean | `true` | Show the locate button |
| `label` | string | `""` | Optional element label |

**Default size:** 180×240 px.

### E22 — Computer stats element (`feezal-element-material-computer-stats`)

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

### E23 — Map element (`feezal-element-material-map`)

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

### E24 — Clock element (`feezal-element-material-clock`)

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

### E25 — Time picker element (`feezal-element-material-time-picker`)

An interactive time input that publishes a selected time value to MQTT. Used for scheduling automations — e.g. "turn on lights at …", "start heating at …". Common in ioBroker.vis dashboards for timer/schedule widgets.

**Visual concept:** an `md-outlined-text-field` with `type="time"` for desktop (browser-native time picker); on touch devices a custom touch-optimised wheel picker (two drum-roll columns: hours and minutes, optional seconds) overlaid in an `sl-dialog`. The current value is read from a `subscribe` topic and shown in the input; changes publish to `publish`.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Topic to read current time value from |
| `publish` | mqttTopic | — | Topic to publish selected time to |
| `format` | `HH:MM` \| `HH:MM:SS` \| `seconds` | `HH:MM` | Output format: `HH:MM` string, `HH:MM:SS` string, or total seconds since midnight |
| `step` | number | `1` | Minute increment for the wheel picker (e.g. `5` for 5-minute steps) |
| `label` | string | `Time` | Field label rendered inside the MD3 text field |
| `show-seconds` | boolean | `false` | Show a seconds column in the wheel picker |
| `publish-on-change` | boolean | `false` | Publish on every wheel-picker step rather than only on confirm |

**Default size:** 160×60 px.

### E26 — Fluid level / tank element (`feezal-element-material-tank`)

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

### E27 — Window / door contact element (`feezal-element-material-contact`)

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

### E28 — Grafana integration

Most serious smart-home users already have a Grafana instance with years of historical data in InfluxDB, TimescaleDB, or Prometheus. Feezal's MQTT elements are strong for live state but weak for time-series history and trend visualisation. Rather than re-implementing charting, feezal should embrace Grafana as a first-class data visualisation companion and make embedding and linking effortless.

---

#### What is worth the effort

**E28a — Grafana panel element (`feezal-element-grafana-panel`)** ⚡ high value, low effort

Grafana supports rendering individual panels in isolation via the `d-solo` endpoint:

```
http://grafana:3000/d-solo/<dashboard-uid>/<slug>?orgId=1&panelId=<n>&from=now-1h&to=now&theme=dark
```

The element is essentially a smart `<iframe>` wrapper around this URL, but with feezal-specific value-adds:

- **Theme sync**: auto-appends `&theme=dark` or `&theme=light` based on the active feezal theme — no manual URL editing needed.
- **Time range control**: exposes `from` / `to` attributes (relative strings like `now-1h` or ISO timestamps). When a shared time-range controller element is present on the canvas (E28c below), all Grafana panel elements update together.
- **MQTT-driven Grafana variables**: each `var-*` attribute is mapped to a Grafana template variable in the URL. The value can be a static string or a `mqttTopic` reference — when the MQTT value updates, the iframe src is rebuilt, effectively filtering the panel live. Example: `var-device` subscribed to `home/selected-device` → clicking a device button updates all Grafana panels to show only that device's data.
- **Loading / error states**: shows a skeleton placeholder while the iframe loads; detects Grafana's auth redirect (login page) and shows a helpful configuration hint ("Enable anonymous viewer access or check `allow_embedding` in grafana.ini").
- **Click-through**: optional `click-url` attribute — clicking the panel opens a full Grafana dashboard in a new tab (or in a Shoelace `sl-dialog` overlay).

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | Full `d-solo` panel URL (Grafana constructs this; copy from Share → Embed) |
| `from` | string | `now-1h` | Time range start (Grafana relative or ISO) |
| `to` | string | `now` | Time range end |
| `refresh` | number | `0` | Auto-refresh interval in seconds (0 = no refresh); rebuilds iframe src with a cache-bust |
| `theme` | `auto` \| `dark` \| `light` | `auto` | Panel theme; `auto` follows feezal theme |
| `vars` | string | `{}` | JSON map of Grafana variable overrides `{"var-host": "server1"}` |
| `subscribe-var-*` | mqttTopic | — | Dynamic Grafana variable driven by MQTT, e.g. `subscribe-var-device` → `&var-device=<payload>` |
| `click-url` | string | `""` | URL to open when the panel is clicked (full dashboard deep link) |
| `click-target` | `blank` \| `dialog` | `blank` | Where to open `click-url` |
| `show-title` | boolean | `false` | Show the panel title as an overlay label above the iframe |

**Grafana setup prerequisite** (documented in element help tooltip):
```ini
# grafana.ini
[security]
allow_embedding = true

[auth.anonymous]
enabled = true
org_role = Viewer
```
Or use a Grafana service account with Viewer role and pass the token via a reverse proxy that injects the `Authorization` header — the element itself does not handle credentials (they must be handled at the network layer).

---

**E28b — Grafana dashboard kiosk element (`feezal-element-grafana-dashboard`)**

Embeds an entire Grafana dashboard in kiosk mode (`?kiosk`) as a full-canvas feezal element. Useful for a dedicated "history" view in the feezal site that shows a pre-built Grafana dashboard without leaving the feezal shell. Inherits the same `from`/`to`/`theme`/`refresh` attributes as E28a. Less composable than individual panels but zero Grafana-side setup beyond `allow_embedding`.

---

**E28c — Time range controller (shared state for panel elements)**

A small UI widget (date-range picker + preset buttons: Last 1h / 6h / 24h / 7d / 30d) that broadcasts a time range to all Grafana panel and dashboard elements on the same canvas view. Implemented as a Lit element that emits a custom DOM event `feezal-timerange-change`; the panel elements listen for it and update their `from`/`to` attributes. No MQTT involved — purely in-canvas state. Makes a "history" view feel like a mini Grafana with consistent time context across all panels.

---

#### What is NOT worth the effort

- **Native chart rendering** (re-implementing Grafana panels in Lit/Canvas): massive scope, fragile, never as good as Grafana itself. The iframe approach gives full Grafana fidelity for free.
- **Grafana alerting → feezal notifications**: Grafana already supports MQTT contact points (via the MQTT notifier plugin or a webhook bridge). No feezal-specific work needed — users configure this in Grafana.
- **Grafana data source proxy**: routing InfluxDB/Prometheus queries through feezal's backend would make feezal a query proxy. Out of scope — Grafana's own backend is the right place for this.
- **Grafana plugin**: building a feezal panel plugin for Grafana (so feezal widgets appear inside Grafana) — see **A11** for the detailed spec. It inverts the relationship and is a separate deliverable but absolutely worth doing.

---

**Default size:** 400×300 px (panel element); 800×600 px (dashboard element).

---

### E29 — Tile / compact state element (`feezal-element-material-tile`)

The single most-used dashboard pattern in the wider ecosystem (Home Assistant's Tile card + the Mushroom card family). A compact horizontal card combining an **icon**, **primary label**, **secondary state line**, and an optional **quick-action control** — the workhorse for room overviews where many devices share a grid.

**Visual concept:** a rounded MD3 surface, ~`56` px tall. Left: a circular icon chip whose colour/fill reflects on/off or active state. Centre: bold name on top, live secondary state below (e.g. "On · 80 %", "22.4 °C", "Closed"). Right (optional): a single quick control — toggle, or a tap target that publishes a payload.

**Quick-action modes** (`action` attribute):

| Mode | Behaviour |
|---|---|
| `none` | Display only — tile shows state, no control |
| `toggle` | Tap anywhere publishes a configurable on/off payload to `publish` |
| `more` | Tap opens a Shoelace `sl-dialog` "more-info" panel (future: embeds the matching full element, e.g. the light or thermostat) |
| `navigate` | Tap navigates to another feezal view (`target-view`) — turns a tile into a room-entry button |

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | State topic driving the secondary line and icon colour |
| `publish` | mqttTopic | — | Topic for `toggle` action |
| `icon` | string | `lightbulb` | Material icon name |
| `label` | string | `""` | Primary label |
| `secondary` | string | `""` | Static secondary text (overridden by `subscribe` when set) |
| `state-map` | string | `{}` | JSON map of payload → display string for the secondary line |
| `action` | `none` \| `toggle` \| `more` \| `navigate` | `toggle` | Quick-action behaviour |
| `payload-on` / `payload-off` | string | `on` / `off` | Toggle payloads |
| `active-when` | string | `on` | Payload value(s) that render the tile in its "active" (tinted) state |
| `color-active` | color | `--sl-color-primary-600` | Icon-chip colour when active |
| `target-view` | string | `""` | View to navigate to in `navigate` mode |

> **Conventions:** dual-payload — (single state topic) · auto-discovery: consumes any component as a read-only tile (icon/label from `device_class` + `name`) · custom inspector: not required. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** static tile with placeholder icon, "Device name" / "State" text.

**Default size:** 200×56 px.

### E30 — Mini live sparkline (`feezal-element-basic-sparkline`)

A lightweight inline trend chart driven by **live MQTT values buffered in the browser** — the most-requested "show me a quick graph" pattern (HA's mini-graph-card is consistently a top-3 community card). Deliberately **distinct from Grafana (E28)**: there is no backend, no historical query, no persistence — it visualises the trend of values that arrive while the dashboard is open.

**Data model (MVP):** the element keeps an in-memory ring buffer of the last `points` samples (default `60`) for the subscribed topic. Each incoming MQTT message appends `{ t: now, v: Number(payload) }`. On reload the buffer starts empty and refills live. *(Future enhancement, explicitly out of MVP scope: an optional server-side ring buffer so the chart has history on first load — deferred to avoid overlapping Grafana's role and adding backend storage.)*

**Visual concept:** a smooth SVG line (or area fill) spanning the element width, auto-scaled to the buffered min/max (or a fixed `min`/`max`), with an optional current-value label and a coloured "above/below threshold" tint. No axes by default (sparkline style); an optional faint baseline and min/max labels can be enabled.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Numeric value topic |
| `points` | number | `60` | Max samples held in the rolling buffer |
| `window-seconds` | number | `0` | If > 0, drop samples older than this many seconds (time-based window instead of count-based) |
| `mode` | `line` \| `area` | `area` | Line only, or filled area under the line |
| `min` / `max` | number | *(auto)* | Fixed Y range; blank = auto-scale to buffered data |
| `color` | color | `--sl-color-primary-600` | Line/area colour |
| `warn-threshold` | number | — | Value above which the line tints to `color-warn` |
| `color-warn` | color | `#ff9800` | Tint colour past `warn-threshold` |
| `show-value` | boolean | `true` | Show the current value as an overlay label |
| `show-minmax` | boolean | `false` | Show faint min/max labels at the chart edges |
| `decimals` | number | `1` | Decimal places for the value label |
| `unit` | string | `""` | Unit suffix on the value label |

> **Conventions:** dual-payload — (single numeric topic) · auto-discovery: consumes `sensor` (unit/`device_class` → label) · custom inspector: not required. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** renders a static dummy waveform (sine-ish) so the author can see the style without a live feed.

**Default size:** 160×60 px.

### E31 — Plant / flower monitor (`feezal-element-material-plant`)

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

### E32 — Logbook / event list (`feezal-element-basic-logbook`)

A rolling, in-browser list of recent MQTT events — the live counterpart to HA's Logbook/Activity card. Like the sparkline (E30) it is **live-only**: it shows messages that arrive while the dashboard is open, with no backend history.

**Visual concept:** a scrollable vertical list, newest at top. Each row: a small timestamp, an optional icon, and a formatted message line. New rows fade/slide in. The list is capped at `max-rows` (oldest dropped).

**Sources:**
- **Single topic / wildcard:** subscribe to one topic or an MQTT wildcard (`home/+/event`); each message becomes a row. A `template` string formats the row from the topic and payload (e.g. `"{topic}: {payload}"`), with JSON-path extraction for structured payloads.
- **Configured event map:** a `events` JSON array maps specific `{subscribe, label, icon}` triples to friendly rows (e.g. door opened, motion detected, alarm armed), so several distinct topics feed one consolidated feed.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Topic or wildcard to log |
| `template` | string | `{payload}` | Row format; supports `{topic}`, `{payload}`, `{json:path}` tokens |
| `events` | string | `[]` | JSON array of `{subscribe, label, icon}` mapped event sources |
| `max-rows` | number | `50` | Maximum rows retained |
| `show-time` | boolean | `true` | Show the timestamp column |
| `time-format` | string | `HH:mm:ss` | Timestamp format |
| `dedupe` | boolean | `false` | Collapse consecutive identical messages into one row with a count |

> **Conventions:** dual-payload — (n/a, free-form) · auto-discovery: — · custom inspector: N6 (event-source list builder) recommended when using the `events` map. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** three placeholder rows ("12:01:04 — Living room motion", …).

**Default size:** 240×160 px.

### E33 — Webpage / iframe element (`feezal-element-basic-iframe`)

A generic embedded web page — the building block that the Grafana panel element (E28) specialises. Useful for embedding any web UI (a router admin page, a printer status page, another dashboard, a public webcam page, a weather radar loop).

**Visual concept:** a bordered `<iframe>` filling the element bounds, with a skeleton placeholder while loading and a friendly error overlay if the target refuses framing (`X-Frame-Options` / CSP) — including a hint to open it in a new tab instead.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `src` | string | — | Page URL to embed |
| `subscribe-src` | mqttTopic | — | Optional: a topic carrying the URL, so the embed can change at runtime |
| `refresh` | number | `0` | Auto-reload interval in seconds (0 = never) |
| `scrolling` | boolean | `true` | Allow the iframe to scroll |
| `sandbox` | string | `""` | Optional iframe `sandbox` token list (blank = no sandbox) |
| `zoom` | number | `1` | CSS scale applied to the embedded page |
| `click-url` | string | `""` | Optional "open in new tab" target shown as a corner button |

**Security note:** the `sandbox` attribute is surfaced so authors can lock down embedded third-party pages. The element never injects credentials and never proxies — it is a plain client-side embed.

> **Conventions:** dual-payload — (n/a) · auto-discovery: — · custom inspector: not required. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** a framed placeholder with a globe icon and the configured URL string.

**Default size:** 320×240 px.

### E34 — Countdown / timer element (`feezal-element-basic-countdown`)

A countdown display toward a target time — common in ioBroker timer/schedule dashboards (e.g. "irrigation in 12:34", "next departure", "washing machine done in …"). Counts down (or up) and can publish when it reaches zero.

**Visual concept:** large monospaced `mm:ss` (or `HH:mm:ss` / `d HH:mm:ss`) digits, with an optional thin progress ring or bar showing elapsed-vs-total. Turns amber/red in the final stretch (`warn-seconds`). Shows a configurable "done" label at zero.

**Target sources** (`mode`):

| Mode | Source |
|---|---|
| `target-timestamp` | Subscribes to a topic carrying an absolute Unix/ISO timestamp; counts down to it |
| `seconds-remaining` | Subscribes to a topic carrying remaining seconds; ticks down locally between updates |
| `count-up` | Counts up from a subscribed start timestamp (a stopwatch / "running for" display) |

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `mode` | select | `seconds-remaining` | Target source (see table) |
| `subscribe` | mqttTopic | — | Topic carrying the timestamp or remaining seconds |
| `format` | `mm:ss` \| `HH:mm:ss` \| `d HH:mm:ss` \| `auto` | `auto` | Digit format |
| `show-ring` | boolean | `true` | Show the progress ring/bar |
| `total-seconds` | number | `0` | Denominator for the progress ring (0 = infer from first value) |
| `warn-seconds` | number | `10` | Remaining seconds at which digits turn amber/red |
| `done-label` | string | `Done` | Text shown at zero |
| `publish-on-zero` | mqttTopic | — | Optional topic to publish to when the countdown reaches zero |
| `payload-zero` | string | `done` | Payload published at zero |

> **Conventions:** dual-payload — (single topic) · auto-discovery: — · custom inspector: not required. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** static `12:34` digits with a ring at ~40 %.

**Default size:** 160×100 px.

## Editor UX

### U1 — Preview mode 🔽 low priority
Toggle the editor into a read-only viewer within the same tab (without navigating to the viewer URL). Useful for quick visual checks without switching windows.

### U3 — Element grouping and locking 🔽 partial
- **Lock**: prevent an element from being accidentally moved/resized ✅. Locked elements show an amber dashed outline; interact drag/resize is disabled; lock/unlock is in the right-click context menu and the `locked` attribute is persisted with the dashboard HTML.

#### Grouping (not yet done)

**Concept:** grouping is a **relative-position lock** — it prevents any individual group member from being accidentally moved or resized in isolation. Moving the whole group (by clicking any member, which selects all) still works fine. This is useful for e.g. four buttons that should always stay together: grouping ensures no single button drifts out of formation. It is *not* primarily about moving as a unit — multi-select already handles that.

**Groups are editor-only.** `data-group` attributes **must** be saved in `views.html` so groups survive editor sessions and page reloads. They are stripped only at the point of delivery to the outside world:
- The **viewer route** (`server/src/app.js`) strips all `data-group` attributes from the HTML before serving the viewer page.
- The **export** (`createExport()` in `export.js`) likewise strips them from `siteHtml` before composing `index.html`.
- `_clean()` in `feezal-app-editor.js` must **not** strip `data-group` — doing so would erase groups on every deploy.

**Creating / dissolving:**
- Multi-select the desired elements → right-click → **"Group" `Ctrl+G`** → elements are grouped.
- Right-click any group member → **"Ungroup" `Ctrl+G`** (toggles) → group is dissolved.
- `Ctrl+G` shortcut added to `_keyHandler` in `feezal-sidebar-inspector.js`, guarded by `ctrlKey`. Shortcut reference modal (`?`) gets a new row: `Ctrl+G — Group / ungroup selection`.

**Storage:** `data-group="<id>"` on each member. The ID is a short unique string (e.g. `g1`, `g2`) scoped to the view, generated at group-creation time.

**Selection and interaction behaviour:**
The group is treated as a single composite object — the user never needs to think about individual members while the group exists.
- **Click** any group member → the **group** is selected as a whole. The group bounding-box overlay gets the selection highlight; individual member selection rings are suppressed. `selectedElems` internally contains all members (so the inspector can show shared attributes), but visually only the group box is highlighted.
- **Drag** from any group member → moves all members together. No precondition — the user just drags anywhere on any member and the whole group follows.
- **Resize** → **blocked** for grouped elements. interact.js resize handles are suppressed on members that carry `data-group`, exactly like they are for `locked` elements. To resize an individual member the user must ungroup first (or use Ctrl+click escape hatch below).
- **Ctrl+click** a group member → selects just that one element, bypassing group behaviour entirely. Allows individual attribute edits or resizing when deliberately needed without ungrouping.

**Inspector:** when a group is selected, a small group-icon chip above the attribute list shows the group ID and member count (e.g. "⬡ Group g1 · 3 elements") with an **"Ungroup"** button next to it. Attributes shown use the same intersection logic as U17.

**Copy / paste / duplicate:**
Groups participate in the existing clipboard mechanism (`feezal-app-editor.js`) without special-casing — because clicking a group selects all members into `selectedElems`, the existing copy/cut/paste/duplicate paths already capture the full member set. The only group-specific concern is **group ID collision on paste**:
- When pasting or duplicating, scan the pasted HTML fragment for `data-group` attributes and **remap each group ID to a fresh unique ID**. This ensures the pasted copy is an independent group, not merged with the original.
- Relative positions within the pasted group are preserved (standard offset-paste behaviour applies to the group as a whole).
- Cut removes all members from the canvas; the group ID is carried in the clipboard and remapped on paste just like copy.

The ID remapping is a small post-process step on the clipboard HTML string — replace each `data-group="<oldId>"` with `data-group="<newId>"` using a map built by scanning the fragment before insertion.
Each grouped element always shows a dashed outline in its group colour and a small **group icon** (Material `link` or `group_work`) badge in the top-left corner via a CSS `::before` pseudo-element — same injection technique as the lock `::after` badge (`<style id="feezal-editor-group-style">` in `connectedCallback`). These are always visible, selected or not, so the user can see which elements belong to a group at a glance.

**Visual — group bounding box and selection:**
An absolutely positioned overlay `<div class="feezal-group-box" data-group="<id>">` on the canvas covers the union bounding rect of all members. Updated whenever members move. Where the bounding box edge coincides with a member's outer edge the two dashed lines naturally merge visually.

When the group is selected, the **bounding-box overlay** receives the selection highlight (blue ring, same `outline` style as individual element selection). Individual member selection rings are hidden — only the group box is highlighted. This makes the group feel like a single object.

Multiple groups on the same view each get a distinct colour from a small fixed palette (4–5 hues) so they are distinguishable at a glance.


### U6 — Pin-protected views 🔽 low priority
A view can require a PIN to enter (rendered in the viewer). Useful for settings or admin pages on a shared display.



## Architecture & Infrastructure

### A4 — Responsive / breakpoint layouts
Define multiple layouts per view (e.g. desktop / tablet / mobile) that activate based on viewport width. Editor shows a breakpoint switcher toolbar. See design exploration in ROADMAP (Open Questions).



### A8 — Per-site tree-shaking for static HTML export ⚡ high priority

**Problem:** the static export (`/api/sites/:name/export`) currently produces an HTML file of ~1.2 MB regardless of site content. The entire element ecosystem — including Polymer and all paper elements — is bundled into every export, even for a site that uses only basic Lit elements.

**Root cause:** the export reads the pre-built `dist/viewer-bundle.js`, which was built by Vite with *all* elements imported unconditionally via `editor/feezal-elements.js`. Rollup's `inlineDynamicImports: true` then folds every chunk (824 KB element chunk + 365 KB mqtt.js + 42 KB feezal-connection) into one IIFE and inlines it into the HTML. No per-site filtering happens at any stage.

The old Rollup pipeline (`server/src/build/build.js`) had a `filterElements()` function that did filter imports to only the elements used by the site, but that code is bypassed by the current export path.

**Size composition of the current bundle:**
- `feezal-view-*.js` — ~824 KB (all elements baked in: Polymer paper set, @material/web, basic Lit elements)
- `feezal-connection-mqtt-*.js` — ~365 KB (mqtt.js client)
- `feezal-connection-feezal-*.js` — ~42 KB

**Goal:** a site that uses no Polymer elements should produce an export with no Polymer code; a site that uses only one or two elements should produce a proportionally smaller file.

**Recommended approach — pre-built per-element IIFE chunks (Option B):**

During `npm run build`, in addition to the current outputs, emit a standalone self-contained IIFE per element package (and one for the base viewer runtime without any elements). This adds a per-element build pass but keeps export time fast.

At export time:
1. Parse the exported site's `views.html` for custom element tag names (e.g. `feezal-element-basic-number`, `feezal-element-paper-switch`).
2. Concatenate: `viewer-runtime-base.iife.js` + only the IIFE chunks for tags actually present.
3. mqtt.js is only included when the connection backend is `mqtt` (already known from `config.connection.backend`).
4. Inline the concatenated JS into the HTML as before.
5. Special case: Elements that render elements (until now only feezal-element-basic-repeater) - it carries information of the element it needs to render in attribute "child-element", this has to be taken in account also. 

**Alternative — per-export Rollup build from source (Option A):**

Generate a temporary entry file with only the needed `import` lines, run a fresh Rollup/Vite build per export, inline the output. Optimal result, but adds 10–30 s to every export. Acceptable if exports are infrequent.

**Quick win (Option D) — ensure export step minifies:**

Verify that the Rollup `generate()` call in `createExport()` passes `compact: true` / `plugins: [terser()]`. The Vite build already minifies, but Rollup's IIFE re-wrapping step may undo some of that. Easy to add, ~20–30% size reduction for free.

**Themes — user-selectable at export time:**

Themes cannot be filtered the same way as elements. A site's active theme is set in `viewer.json`, but themes can also be switched dynamically at runtime via MQTT messages — so any theme the user might want to switch to at runtime must be present in the export bundle. Statically scanning the site HTML or config is therefore insufficient.

The right model: when triggering an export the user is shown a **theme selection dialog** listing all installed themes (npm + user-defined). The currently configured theme is pre-checked; the user can additionally check any other themes they want reachable at runtime (e.g. a "dark mode" theme toggled via an MQTT automation). Only the checked themes are included in the export bundle.

Implementation notes:
- The export API endpoint (`POST /api/sites/:name/export`) accepts a `themes: string[]` body parameter (array of theme slugs to bundle).
- If `themes` is absent or empty, fall back to only including the currently configured theme — a safe default that matches the current behaviour for static sites without dynamic switching.
- The export UI (wherever the download button lives) must surface the theme picker before triggering the download.

### A7 — Git versioning for data directory

When enabled, every save auto-commits the data directory. The editor exposes a **History panel** so users can browse saved versions, preview them, and go back — without ever needing to know git exists.

**Core features:**
- Auto-commit on every save: `save: <siteName> @ <ISO timestamp>`
- Manual named checkpoints ("bookmarks") the user can set from the toolbar
- History panel: browse all versions, preview any version, restore or discard
- Optional auto-push to a remote after each commit (backup / GitOps)

**Implementation: spawn `git` directly via `child_process` — no npm dependency.**

The server assumes `git` is present in `PATH` (it is in the Docker image and in any standard Linux userland). All git operations are thin wrappers around `child_process.execFile('git', [...args], { cwd: dataDir })`:

```js
const { execFile } = require('node:child_process');
const git = (args) => new Promise((resolve, reject) => {
    execFile('git', args, { cwd: dataDir }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
    });
});
```

The `git` binary is added to the feezal Docker image (`apt-get install -y git` in the Dockerfile).

---

#### History panel UX

The History panel opens from a toolbar button (`history` icon) or keyboard shortcut. It shows a **vertical timeline** — most recent version at the top — with no git terminology visible anywhere.

```
┌─────────────────────────────────────────────────────┐
│  Version history — my-dashboard                     │
├─────────────────────────────────────────────────────┤
│  ◉  Just now          Auto-save        [Preview]    │ ← current
│  ★  2 hours ago  ✏  Before redesign   [Preview] [▾]│ ← bookmark
│  ◉  2 hours ago       Auto-save        [Preview] [▾]│
│  ◉  Yesterday         Auto-save        [Preview] [▾]│
│  ★  3 days ago   ✏  MVP working        [Preview] [▾]│
│  ◉  3 days ago        Auto-save        [Preview] [▾]│
│     ···                                             │
│                                                     │
│  ▶ Archived timelines (1)                           │
└─────────────────────────────────────────────────────┘
```

Each version entry shows:
- **Timestamp** (relative: "2 hours ago"; hover for exact datetime)
- **Label**: `Auto-save`, `Restored from "Before redesign"`, or a user bookmark name
- **Bookmark icon** (★) on bookmarked versions
- **[Preview]** button — always visible
- **[▾]** action menu on non-current versions: *Restore*, *Discard all saves since this version*, *Bookmark this version*

---

#### Version preview

Clicking **[Preview]** on any history entry loads that version of the dashboard in a read-only viewer overlay (a `<feezal-app-viewer>` in a full-screen modal). The user can visually inspect the historical state before deciding to restore or discard. A banner at the top reads: *"Previewing version from 2 hours ago — [Restore this version] [Discard to this version] [Close]"*.

Implementation: `git show <sha>:sites/<siteName>/views.html` returns the raw HTML of that version; the server injects it into a viewer response.

---

#### Operation 1 — Restore (safe, non-destructive)

> *"Bring back this version's content, but keep the full save history."*

When the user clicks **Restore this version**:

1. `git checkout <sha> -- sites/<siteName>/` — restores the working tree to that version's state without moving HEAD or touching other commits.
2. `git add -A && git commit -m "restore: from \"<label>\" (<sha[:7]>)"` — immediately creates a NEW commit at the tip with the old content.
3. The timeline now shows this restore entry at the top, and all previous versions remain intact below it.

The user's entire save history is preserved. Restoring twice is just two more entries in the timeline. **Nothing is ever destroyed by a Restore.**

The restored version is now the active dashboard. The editor reloads with its content. A toast confirms: *"Dashboard restored from 'Before redesign'"*.

To "undo the restore": simply restore the version that was at the top before — it's still in the timeline one entry below the restore entry.

---

#### Operation 2 — Discard (destructive but reversible)

> *"Abandon everything since this version and start fresh from here."*

This is a power-user operation for when a large chunk of work should be thrown away entirely (e.g. a failed experiment spanning 50 auto-saves). The user explicitly selects **Discard all saves since this version** from the action menu.

**Before discarding, a confirmation dialog** explains what will happen in plain language:
> *"This will discard 12 saves made since '2 hours ago'. The discarded saves will be moved to the Archive and can be recovered later. Your dashboard will be set to this earlier version."*
> [**Discard 12 saves**] [Cancel]

**Implementation:**
1. `git branch archive/<ISO-timestamp>` — creates a branch at the current HEAD so the discarded commits are never truly lost.
2. `git reset --hard <sha>` — moves HEAD back to the selected version.
3. The editor reloads with the restored content. A new auto-save is triggered immediately so the starting point is visible at the top of the timeline.

The discarded commits are now only accessible via the **Archived timelines** section (collapsed by default at the bottom of the History panel).

---

#### Archived timelines

When a Discard operation has been performed, the discarded work is preserved as a named archive entry. The **Archived timelines** section at the bottom of the History panel shows each one:

```
▼ Archived timelines (1)
  ┌──────────────────────────────────────────────────┐
  │  archived 2026-06-26 14:22   12 versions         │
  │  Discarded from: "Auto-save" (2 hours ago)       │
  │  [Browse] [Restore latest from archive] [Delete] │
  └──────────────────────────────────────────────────┘
```

**Browse** opens the archive's timeline (same UI as the main history but read-only). The user can preview any version in the archive and restore individual ones — which creates a new commit in the main timeline (Restore operation, same as above). **Delete** permanently removes the archive branch (`git branch -D`). Until deleted, no work is lost.

---

#### Bookmarks (named checkpoints)

Any version can be bookmarked with a custom name. The name is stored as a lightweight git tag (`feezal-bookmark/<url-encoded-name>`) pointing to that commit, so it survives `git push` to a remote and is visible in standard git tools.

From the toolbar a **Bookmark current version** button (`bookmark_add` icon) lets users name the current state before starting a significant change — e.g. "Working layout before adding weather widget". The bookmark name is shown in the history timeline as a star entry (★).

Bookmarks can also be added retroactively from the action menu of any history entry.

---

#### API surface

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sites/:name/history` | Returns array of `{sha, date, label, bookmarkName?}` |
| `GET` | `/api/sites/:name/history/:sha/preview` | Returns viewer HTML for that version |
| `POST` | `/api/sites/:name/history/:sha/restore` | Non-destructive restore (checkout + new commit) |
| `POST` | `/api/sites/:name/history/:sha/discard` | Archive current HEAD, reset to sha |
| `POST` | `/api/sites/:name/history/:sha/bookmark` | Create/update bookmark tag (`{name}` body) |
| `DELETE` | `/api/sites/:name/history/:sha/bookmark` | Remove bookmark tag |
| `GET` | `/api/sites/:name/history/archives` | List archive branches |
| `DELETE` | `/api/sites/:name/history/archives/:branch` | Delete an archive branch |

---

#### Key `child_process` operations

```js
// Get history (most recent first)
const log = await git(['log', '--format=%H|%aI|%s', 'HEAD']);
// → "abc1234|2026-06-26T14:22:00+02:00|save: my-dashboard @ ..."

// Preview: get file content at a specific version
const html = await git(['show', `${sha}:sites/${siteName}/views.html`]);

// Restore (non-destructive)
await git(['checkout', sha, '--', `sites/${siteName}`]);
await git(['add', '-A']);
await git(['commit', '-m', `restore: from "${label}" (${sha.slice(0, 7)})`]);

// Discard (archives first)
const archiveBranch = `archive/${new Date().toISOString().replace(/[:.]/g, '-')}`;
await git(['branch', archiveBranch]);
await git(['reset', '--hard', sha]);

// Bookmark
await git(['tag', `feezal-bookmark/${encodeURIComponent(name)}`, sha]);

// List bookmarks
const tags = await git(['tag', '--list', 'feezal-bookmark/*', '--format=%(refname:short)|%(objectname:short)']);
```

### A9 — Mobile app packaging: PWA export + Capacitor project template

Turn a feezal export into an installable mobile app. The approach is layered — the tiers are independent and each delivers value on its own.

#### Why not a single solution

Four categories of "wrapping HTML in a native app" exist; they differ enormously in complexity and constraints:

| Approach | Toolchain required | App store | Offline | Effort |
|---|---|---|---|---|
| PWA (`manifest.json` + service worker) | None | No (home screen install) | ✅ | Low |
| Capacitor / Cordova project template | Android Studio or Xcode on user's machine | Optional | ✅ | Medium |
| Cloud build (EAS, Bitrise) | None (cloud) | ✅ | ✅ | High |
| TWA (Trusted Web Activity) | Android Studio | Google Play | ✅ | Medium, Android-only, needs live URL |

React Native is the wrong abstraction — it replaces the web layer with native UI components written in JavaScript/JSX. There is no path from an existing HTML export to a React Native app.

**Flutter** is a nuanced case. Its `webview_flutter` package can load a local HTML file in a native `WebView` (Android's `WebView` / iOS's `WKWebView`) — technically the same underlying WebView that Capacitor uses. So a minimal Flutter app *can* wrap the feezal export with identical runtime characteristics. The downsides compared to Capacitor for this specific use case: Flutter bundles its own engine (~15–25 MB APK overhead vs ~3–5 MB for Capacitor), and the project template would require Dart/`pubspec.yaml` rather than the JavaScript tooling feezal users already know. Flutter becomes the *better* choice if the app eventually grows beyond a passive viewer — e.g. native BLE/MQTT, background alerting, or native push notifications — because its native plugin ecosystem and performance at those layers is excellent. For now, Capacitor is the pragmatic default; Flutter is worth revisiting if deeper native integration is ever needed.

The critical constraint: **feezal's server is a Node.js process** and may run on a Raspberry Pi, NAS, or a small Linux box. It cannot invoke Gradle or Xcode — those toolchains can only run on the user's dev machine. The server can, however, generate and ZIP project templates that the user then opens in their IDE.

---

#### Tier 1 — PWA export (high value, zero toolchain, implement first)

Enhance the existing HTML export to be a valid **Progressive Web App**. This requires adding three things to the export ZIP alongside `index.html`:

1. **`manifest.json`** — declares the app name (site name), icon set (generated from assets or a default feezal icon), theme color, `display: "standalone"`, `start_url: "."`, and `background_color`. Reference it from `index.html` via `<link rel="manifest" href="manifest.json">`.

2. **`sw.js`** — a minimal service worker using Cache-First strategy. Caches all ZIP assets on first load. Subsequent loads work offline. On the broker side, MQTT over WebSocket reconnects automatically when the network returns — feezal-connection already handles this.

3. **Icons** — a set of PNG icons at standard sizes (192×192, 512×512) for Android, and `apple-touch-icon` for iOS. If the site has a configured icon in its assets, use it; otherwise ship a default feezal icon. These are included in the ZIP.

**Result:** the user hosts the ZIP contents on any static server (or `file://` via a local web server on Android). Chrome on Android shows an "Add to Home Screen" banner automatically. Safari on iOS shows "Add to Home Screen" in the share menu. The installed icon launches the dashboard in standalone mode (no browser chrome), full-screen, with offline support.

No app store, no signing, no developer accounts. Works on any device with a modern browser. This covers the majority of home-automation dashboard use cases.

---

#### Tier 2 — Capacitor project template export (real APK/IPA, user builds locally)

For users who want an actual `.apk` or `.ipa` — for sideloading, internal distribution, or app store submission — export a **Capacitor project** with the dashboard pre-embedded as the web layer.

**What gets exported:**

A ZIP containing a valid Capacitor project:
```
my-dashboard/
  package.json              (scripts: cap sync, cap build android/ios)
  capacitor.config.json     (appId, appName, webDir: "www")
  www/
    index.html              (the feezal export)
    manifest.json
    sw.js
    assets/
  android/                  (standard Gradle project, generated by `cap add android`)
  ios/                      (standard Xcode project, generated by `cap add ios`)
```

The `appId` is derived from the site name (e.g. `io.feezal.my-dashboard`). `appName` is the site name.

**Feezal server's role:** generate the project template files and ZIP them. The server does *not* run Capacitor CLI, Gradle, or Xcode — those run on the user's machine. The server ships the project structure with web assets pre-populated; the user only needs to run `npm install && npx cap sync && npx cap build android` (or open the `ios/` folder in Xcode).

**User workflow:**
1. Click "Export → Mobile App (Android / iOS)" in the editor.
2. Download the ZIP; unzip on a machine with Android Studio (Android) or Xcode on a Mac (iOS).
3. Follow the README included in the ZIP: `npm install`, `npx cap sync`, then build from the IDE or `npx cap build android --prod`.
4. Result: a signed APK/IPA ready for sideloading or store submission.

**README in the ZIP** must clearly state:
- Android build requires Android Studio + JDK 17+.
- iOS build requires a Mac with Xcode 15+ and an Apple Developer Program membership ($99/year) for device distribution or App Store upload. Free tier allows sideloading to personal devices via Xcode.
- The Capacitor project version and how to update it independently of feezal.

**Connection note:** if the site uses `ws://` with the feezal server bridge (N10), the app must reach the feezal server over the network. If it uses `ws://` direct to the broker, it works standalone. This distinction should be surfaced in the export UI.

---

#### Tier 3 — Cloud build (future, likely out of scope)

Services like **Expo EAS Build** (for Capacitor too, via a community plugin) or **GitHub Actions** can run the Gradle/Xcode build in the cloud and deliver a download link. This removes the local toolchain requirement entirely.

However, this requires:
- The user to have accounts with the cloud build service and/or app stores.
- Signing certificates uploaded to the cloud service (private keys leaving the user's machine — a security trade-off).
- API integration in the feezal server to submit builds and poll for results.

Given the self-hosted, privacy-focused nature of feezal's typical deployment, cloud builds are probably not the right default. Leaving this as a future option if there is clear demand.
### A11 — Grafana panel plugin (`feezal-feezal-panel`)

A set of Grafana panel plugins that bring feezal-style live controls and current-state displays into Grafana dashboards. This targets **Grafana-primary smart-home users** — people who already run Grafana for historical data (InfluxDB, Prometheus, TimescaleDB) and want to add live MQTT state and control widgets to their existing dashboards without setting up a separate feezal server. This is the reverse of E28 (E28 = feezal embeds Grafana; A11 = Grafana hosts feezal-style panels).

---

#### Why this matters

A large fraction of serious smart-home users are already Grafana-first. Their workflow is:
1. Sensor data → InfluxDB / Prometheus
2. Grafana for charts, alerts, trends
3. A separate dashboard tool (HA, Node-RED UI, or feezal) for live state and controls

A feezal Grafana plugin collapses step 3 into Grafana itself. Users get the feezal visual language (MD3, material elements) and MQTT live state, without leaving Grafana and without running the feezal server at all. The unique value proposition over every other Grafana panel plugin: **controls that publish MQTT commands** — a switch, a slider, a button — live inside a Grafana dashboard alongside historical graphs.

---

#### Technology stack

Grafana plugins are **React + TypeScript**, not Lit. The official toolchain:

```sh
npx @grafana/create-plugin@latest
# → choose: Panel
# → plugin ID: feezal-feezal-panel
```

This scaffolds:
```
packages/grafana-plugin/
    src/
        module.ts         ← exports PanelPlugin
        SimplePanel.tsx   ← React panel component
        types.ts          ← SimpleOptions interface
        plugin.json       ← manifest (type: "panel", id: "feezal-feezal-panel")
    provisioning/         ← Docker-compose dev environment
    docker-compose.yaml   ← `npm run server` spins up Grafana + plugin
    package.json
```

**Runtime contract — `PanelProps`:**
```ts
export const SimplePanel: React.FC<PanelProps<SimpleOptions>> = ({
    options,   // user-configured options (from the options builder)
    data,      // data.series: DataFrame[] — Grafana query results
    width,     // panel width in px
    height,    // panel height in px
}) => { ... };
```

**Options editor** is defined inline in `module.ts` using Grafana's fluent builder:
```ts
export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel)
    .setPanelOptions((builder) => {
        builder
            .addFieldNamePicker({ path: 'valueField', name: 'Value field' })
            .addUnitPicker({ path: 'unit', name: 'Unit' })
            .addSliderInput({ path: 'warnThreshold', name: 'Warning threshold', defaultValue: 75 })
            .addTextInput({ path: 'mqttBroker', name: 'MQTT broker URL (ws://...)' })
            .addTextInput({ path: 'mqttTopic', name: 'MQTT subscribe topic' });
    });
```

---

#### Visual components — React, not Lit wrappers

The plugin does **not** wrap Lit custom elements inside React (fragile, adds feezal runtime dep). Instead, the visualization components are written **natively in React** using `@material/web` web components as React wrappers (React 19 has greatly improved custom element interop). The visual output is identical to feezal elements — the same MD3 colours, the same gauge arc geometry — but implemented as React components.

This approach keeps the Grafana plugin self-contained and avoids pulling in the feezal element packages (which assume a full feezal runtime with `feezal.isEditor`, topic subscriptions, etc.).

Longer term: a shared `@feezal/vis` package could export rendering primitives (SVG arcs, ring gauges, threshold colours) in a framework-agnostic way — Lit elements and the Grafana React components both import from it. But for the MVP, duplicate the rendering code.

---

#### Panel types to implement

**Phase 1 — read-only panels (use only Grafana data frames)**

| Plugin panel type | Visual | Grafana data usage |
|---|---|---|
| `value` | MD3 stat card — large current value, unit, optional sparkline | Last value of selected numeric field; threshold colours |
| `gauge` | Circular arc gauge (same as `feezal-element-material-gauge`) | Last value of selected field; configurable min/max/unit |
| `status` | Coloured state indicator with label | String field → state label map; numeric field → threshold colours |
| `history-bar` | Thin horizontal bar chart — last N values | All values of selected field as a minimal bar strip |

These panels are valuable standalone: they render feezal-style MD3 visuals for Grafana query data. A user with Prometheus or InfluxDB can immediately use them.

**Phase 2 — hybrid panels (Grafana data + live MQTT)**

These panels combine Grafana's historical query data with a direct MQTT WebSocket connection for the live current value:

| Plugin panel type | Grafana data | Live MQTT | Description |
|---|---|---|---|
| `mqtt-value` | Min/max/sparkline from query | Current value from topic | Stat card showing live value + Grafana-driven sparkline below |
| `mqtt-gauge` | Historical average or last known | Live reading | Gauge arc live-updated by MQTT, with Grafana average as a threshold reference mark |

The MQTT connection is made directly from the browser using mqtt.js WebSocket mode (the same library feezal uses). The broker URL and subscribe topic are configured in panel options. No feezal server required.

**Phase 3 — control panels (MQTT publish)**

The unique panels no other Grafana plugin offers — controls that publish MQTT messages:

| Plugin panel type | Description |
|---|---|
| `mqtt-switch` | Toggle switch that subscribes to a state topic and publishes on/off to a command topic |
| `mqtt-button` | One or more buttons that publish configurable payloads on click |
| `mqtt-slider` | Horizontal slider that subscribes to current value and publishes on release |

These panels let users control smart home devices (lights, switches, covers) without leaving their Grafana dashboard.

---

#### Deployment

**Local / development:**
```sh
# 1. Build the plugin
cd packages/grafana-plugin && npm run build

# 2. Mount in Grafana (docker-compose.yaml included in scaffold)
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=feezal-feezal-panel \
  GF_PATHS_PLUGINS=/var/lib/grafana/plugins \
  docker run -v ./dist:/var/lib/grafana/plugins/feezal-feezal-panel grafana/grafana
```

**Self-hosted Grafana (Linux):**
```sh
# Copy dist/ to Grafana's plugin directory
sudo cp -r dist/ /var/lib/grafana/plugins/feezal-feezal-panel

# Allow unsigned (until published to catalog)
echo 'allow_loading_unsigned_plugins = feezal-feezal-panel' >> /etc/grafana/grafana.ini
sudo systemctl restart grafana-server
```

**Grafana catalog (signed):**
Requires a Grafana Cloud account + `PluginPublisher` API key. The `@grafana/create-plugin` scaffold includes a release GitHub Actions workflow. The plugin ID `feezal-feezal-panel` must match the Grafana Cloud account slug prefix (`feezal-`). Once approved, users install via **Administration → Plugins** without any manual file copying.

---

#### Package location in monorepo

```
packages/
    create-feezal-element/   ← existing
    grafana-plugin/          ← new (A11)
        src/
        plugin.json
        package.json
        docker-compose.yaml
        README.md
```

The plugin package is independent of the feezal server and `www/` — it has its own build pipeline (`webpack` or `vite` via `@grafana/create-plugin`'s internal config). It does not need the feezal server running to build or develop.

---

#### Interplay with other roadmap items

- **E28** — complementary, not competing. E28 targets feezal-primary users who want to embed Grafana charts into feezal. A11 targets Grafana-primary users who want live MQTT control in Grafana.
- **A10** — the Grafana catalog publish flow (Grafana API key + GitHub Actions) is separate from the npm publish flow, but the release CI workflow can be extended to cover both.
- **N6** (custom element inspectors) — not applicable; Grafana has its own panel editor sidebar (the options builder replaces N6 for this plugin).

### A12 — Export deployment targets 🔽 low priority

Instead of (or in addition to) downloading a ZIP, the user configures one or more named **deployment targets** in the feezal server settings. Triggering an export sends the built site bundle directly to the configured target — no manual file transfer needed. Useful for kiosk displays, wall panels, self-hosted web servers, and cloud storage.

---

#### Motivation

The current export flow: **Export → download ZIP → unpack on target machine → serve with a web server.** For users who deploy frequently (e.g. iterating on a dashboard), this manual round-trip is friction. A configured target collapses it to a single click.

---

#### Target types

| Target type | Description | Typical use case |
|---|---|---|
| **Local filesystem** | Write directly to an absolute path on the feezal server host | feezal and the serving web server (nginx/Caddy) run on the same machine; nginx serves from the export path |
| **SCP / SFTP** | Copy files to a remote host via `scp`/`sftp` (spawned as a child process) | Raspberry Pi, NAS, VPS |
| **rsync over SSH** | Sync only changed files using `rsync -az --delete` | Large dashboards with many assets; only diffs are transferred |
| **S3-compatible** | PUT objects to an S3 bucket (AWS S3, MinIO, Backblaze B2, Cloudflare R2, etc.) | Static site hosting on cloud storage |
| **FTP** | Upload to a classic FTP server | Shared hosting or legacy NAS firmware |
| **HTTP PUT / WebDAV** | HTTP PUT request or WebDAV upload to a configured URL | Caddy WebDAV, Nextcloud, custom endpoints |

Each target type has its own configuration form in the server settings UI. Credentials are stored server-side (in `dataDir/targets.json` or environment variables), never returned to the browser.

---

#### Configuration model

Targets are **named and reusable** — a single target can be referenced by multiple sites. Each site can have a default target; the export dialog also allows one-time target selection.

**Target record (stored in `dataDir/targets.json`):**
```json
{
  "id": "nas-www",
  "name": "NAS web root",
  "type": "sftp",
  "host": "192.168.1.10",
  "port": 22,
  "username": "pi",
  "keyFile": "/data/feezal/keys/nas_ed25519",
  "remotePath": "/volume1/web/dashboard"
}
```

**Per-site default target** stored in `viewer.json`:
```json
{
  "exportTarget": "nas-www"
}
```

---

#### Export flow with a target

1. User clicks **Deploy** (or **Export → Deploy to: nas-www**) in the editor toolbar.
2. Server runs the existing export pipeline (build bundle, inline JS/CSS) into a temp directory.
3. Instead of returning the ZIP as a download, the server pushes the files to the configured target:
   - **Filesystem**: rename temp dir into place atomically (`fs.rename`).
   - **SCP**: `execFile('scp', ['-i', keyFile, '-r', tempDir + '/.', user+'@'+host+':'+remotePath])` — zero npm dependencies, relies on `openssh-client` already in the Docker image.
   - **rsync**: `execFile('rsync', ['-az', '--delete', '-e', 'ssh -i '+keyFile, tempDir+'/', user+'@'+host+':'+remotePath])` — rsync is added to the Docker image.
   - **S3**: `@aws-sdk/client-s3` PutObject per file — no native equivalent; the SDK is the right tool here.
   - **FTP**: `basic-ftp` npm package — no native `ftp` client ships in standard Linux images; small and the only npm dep we can't avoid.
   - **HTTP PUT**: Node.js built-in `fetch` (Node 18+).
4. Server responds with a success/failure status. Editor shows a toast: *"Deployed to NAS web root ✓"* or an error with the full stderr output.

---

#### Security notes

- **SSH keys** are stored on the server filesystem (`dataDir/keys/`), never in the database or returned to the browser. Key upload is a separate API endpoint (`POST /api/targets/:id/key`). The key file is written with `0600` permissions (`fs.chmod`) immediately after upload so that `ssh`/`scp`/`rsync` do not reject it with "permissions too open".
- **S3 credentials** (access key ID, secret) are stored in `dataDir/targets.json` with `0600` permissions, or sourced from environment variables (`FEEZAL_TARGET_<ID>_SECRET`). The API never returns the secret to the browser — only a masked indicator (`"secretConfigured": true`).
- **FTP passwords** follow the same masking pattern.
- The target settings UI uses a standard "••••••" password field that is write-only from the browser's perspective.
- **SSH host key verification**: `scp`/`rsync` will fail on first connect if the remote host is not in `~/.ssh/known_hosts`. The target config stores a `hostKey` field (the expected `ssh-ed25519`/`ecdsa` fingerprint); at deploy time the server writes a temporary `known_hosts` file and passes `-o UserKnownHostsFile=<tmpFile>` to `scp`/`rsync`. The **Test connection** button runs `ssh-keyscan` and presents the discovered fingerprint for the user to confirm before saving.

---

#### API surface

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/targets` | List all configured targets (names, types, status — no secrets) |
| `POST` | `/api/targets` | Create a new target |
| `PUT` | `/api/targets/:id` | Update a target |
| `DELETE` | `/api/targets/:id` | Delete a target |
| `POST` | `/api/targets/:id/key` | Upload an SSH private key file |
| `POST` | `/api/targets/:id/test` | Test the connection (SSH handshake, S3 head-bucket, etc.) |
| `POST` | `/api/sites/:name/deploy` | Export site and push to its configured target |
| `POST` | `/api/sites/:name/deploy/:targetId` | Export site and push to a specific target |

---

#### Editor UX

- **Toolbar**: a **Deploy** button (rocket icon `rocket_launch`) appears next to the existing export button when the current site has a default target configured. Clicking it deploys immediately. A dropdown arrow on the button opens a list of all targets for one-time selection.
- **Target manager**: lives in a new “Deployment” tab in the server settings sidebar. Lists configured targets with type icons, connection status (last tested), and edit/delete buttons.
- **Connection test**: each target has a **“Test connection”** button that performs a quick probe (see table below) and shows the result inline.

---

#### Connection test

The **"Test connection"** button for each target type:

| Target type | Test method |
|---|---|
| Filesystem | `fs.access(remotePath, fs.constants.W_OK)` |
| SCP / rsync | `execFile('ssh', ['-i', keyFile, '-o', `UserKnownHostsFile=${tmpKnownHosts}`, '-o', 'BatchMode=yes', `${user}@${host}`, 'echo ok'])` |
| S3 | `s3.send(new HeadBucketCommand({ Bucket }))` |
| FTP | `basic-ftp` client login + `ftp.pwd()` |
| HTTP PUT | `fetch(url, { method: 'OPTIONS' })` |

For SCP/rsync targets that haven't been connected before, the test button runs `execFile('ssh-keyscan', ['-t', 'ed25519,ecdsa', host])` and presents the discovered fingerprint in the UI for the user to confirm before saving.

---

#### Dependencies

**System tools required** (available in standard Linux userland; added to Docker image where not already present):

| Tool | Used for | Docker image |
|---|---|---|
| `git` | A7 git versioning | `apt-get install -y git` |
| `ssh` / `scp` | SCP target deploy + connection test | `apt-get install -y openssh-client` |
| `rsync` | rsync target deploy | `apt-get install -y rsync` |
| `ssh-keyscan` | Host fingerprint scan for connection test | included with `openssh-client` |

**npm packages** (only where no system equivalent exists):

| Target type | npm package | Reason |
|---|---|---|
| S3-compatible | `@aws-sdk/client-s3` (modular v3; ~50 KB with tree-shaking) | No native S3 client; SDK is unavoidable |
| FTP | `basic-ftp` (~20 KB, actively maintained) | No `ftp` client ships in standard Linux images |
| HTTP PUT / WebDAV | Node.js built-in `fetch` (Node 18+) | No extra dependency |

---

## Open Questions

**Palette Manager (N4)**
- Should this work with arbitrary npm package names (any `feezal-element-*` on the registry), or only a curated list?
- What about version pinning / update UX?

**Layout & responsive design**
See the design exploration earlier in this file — the view-in-view nesting concept is the likely foundation. Full responsive layout support is a longer-term goal; no decisions needed yet.

---

## Documentation

### D2 — Self-hosting guide
Step-by-step: install, configure, put behind nginx/Caddy with HTTPS and proxy auth.