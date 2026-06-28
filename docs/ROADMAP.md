# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Bugs

### B10 — Asset Manager not functional

The Asset Manager sidebar (`feezal-sidebar-assets.js`) has multiple bugs that need concrete reproduction steps before fixing. Needs investigation with specific bug reports.

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

### N12 — Export bundle: strip mqtt.js for feezal-bridge users *(partial)*

Exports over `ws://`/`wss://` (the only permitted export mode) no longer bundle socket.io-client (~40 kB) — ✅ fixed by stubbing out `feezal-connection-feezal.js` in the Vite export plugin.

Remaining: exports always bundle mqtt.js (~280 kB) even when the live site uses the feezal bridge. This case is currently blocked at export time (`mqtt://`/`mqtts://` → error), so the remaining waste is theoretical until N9 (bridge mode export) is implemented.

### N13 — Lighter MQTT client for export bundle ⚠️ TBD

The export bundle currently includes all of mqtt.js (**347 kB minified / 100 kB gzip**). mqtt.js is large because it targets Node.js and carries a full MQTT stack including QoS 1/2, session persistence, offline buffering, and a Node.js stream abstraction. feezal's actual usage is minimal: `connect`, `subscribe`, `unsubscribe`, `publish`, connection/disconnection/message events — all QoS 0, WebSocket-only.

**Options evaluated:**

| Option | Minified | Gzip | Notes |
|---|---|---|---|
| **mqtt.js 5.x** *(current)* | 347 kB | 100 kB | Mature, battle-tested; ES modules but not side-effect-free, no useful tree-shaking |
| **paho-mqtt 1.1.0** | 30 kB | 7.7 kB | ❌ Last release 2018, effectively abandoned; callback API; no ES modules |
| **u8-mqtt 0.6.x** | 19 kB | 7.3 kB | ✅ ES modules, zero deps, MQTT 3.1.1 + 5.0, auto-reconnect; ⚠️ 62 GitHub stars, single author, no formal releases |
| **Bespoke minimal client** | ~5 kB | ~2 kB | QoS-0 WebSocket MQTT is ~200 lines; ❌ maintenance burden, security risk |

**Recommended approach: export-only `u8-mqtt` backend**

u8-mqtt (19 kB / 7 kB gzip) is the most promising candidate — a **95% size reduction**. The risk-managed strategy is to use it exclusively in the export build, keeping mqtt.js for the live viewer:

- Add `feezal-connection-mqtt-lite.js` that adapts u8-mqtt to feezal's connection interface (`connect`, `subscribe`, `unsubscribe`, `publish`, events)
- The Vite export plugin (already stubs `feezal-connection-feezal.js`) replaces `feezal-connection-mqtt.js` with the lite version
- Live viewer continues to use mqtt.js unchanged
- If u8-mqtt causes issues, the stub can be reverted independently

**u8-mqtt API sketch for the feezal use case:**
```js
import mqtt_client from 'u8-mqtt';

const client = mqtt_client()
  .with_websock(cfg.uri)
  .with_autoreconnect();

await client.connect({ client_id: clientId });

// subscribe
client.subscribe_topic('my/topic', (pkt) => { /* pkt.payload_utf8() */ });

// publish
client.json_send('my/topic', payload);
```

**Concerns to verify before implementing:**
- Username/password auth support (needed for N10)
- QoS 0 vs QoS 1 subscribe behaviour (feezal currently uses QoS 0 implicitly)
- LWT (last will) support
- Reconnect behaviour parity with mqtt.js

**Expected export bundle savings:** ~300 kB minified / ~93 kB gzip (from ~400 kB to ~100 kB total).

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



### N4 — Palette Manager / custom element install

#### Current state — what already works

The server already has a full dynamic element-discovery pipeline. `discoverElements()` in `server/src/build/elements.js` scans three locations:

| Source | Path | Served via |
|---|---|---|
| Bundled packages | `www/packages/@feezal/` | Baked into `viewer-bundle.js` at build time |
| User-installed | `<dataDir>/elements/` | `/user-elements/<pkg>/` — dynamic import at runtime |
| Built-ins | `www/src/feezal-element-*.js` | Baked into editor Vite chunk |

The Express route `GET /editor/feezal-elements.js` regenerates the module on every request by calling `discoverElements()` — **no daemon restart required** to pick up user-installed elements. A browser reload is enough.

#### `generate-elements.js` — build-time only, not a runtime concern

`scripts/generate-elements.js` writes `www/editor/feezal-elements.js` with **bare specifiers** (`import '@feezal/feezal-element-basic-gauge'`) so Vite can bundle all packages into `viewer-bundle.js` at build time. This file is a **build artefact** — it is never imported at runtime (the server serves the dynamic route instead).

**Daemon-start generation:** the server could call `writeElementsFile()` at startup to keep the file fresh, but this only matters for `npm run build` runs that follow. It does not affect the running server or the live editor.

**Eliminating the manual step:** since user-installed elements land in `<dataDir>/elements/` (not `www/packages/`), they are never baked into `viewer-bundle.js` anyway — the dynamic route handles them entirely. The `generate-elements.js` step is only relevant when developing or publishing a new *bundled* element package, and is already integrated into the Docker build. No change needed here for the user-install flow.

#### What N4 needs to implement

**1. Backend API — npm install to `<dataDir>/elements/`**

```
POST /api/elements          { "package": "@my-org/feezal-element-foo" }
DELETE /api/elements/:name
GET  /api/elements          → list installed user elements
```

`POST` runs `npm install --prefix <dataDir>/elements <package>` in a child process. The package lands in `<dataDir>/elements/node_modules/` but must be pre-bundled (no bare specifiers) — a constraint already documented in `element-spec.md §User elements`. Returns progress via SSE or polling.

**2. Hot-reload without daemon restart**

After install/uninstall completes, the server emits a Socket.IO event `elementsChanged` to all connected editor clients. The editor reloads the `<script src="/editor/feezal-elements.js">` module tag in-place (or does a `location.reload()` as a simple fallback). No daemon restart — a browser reload of the editor tab is the only requirement.

Optionally: a `chokidar` watcher on `<dataDir>/elements/` auto-emits `elementsChanged` when packages appear or disappear (supports manual package drops without going through the API).

**3. Editor UI — Palette Manager panel**

A new sidebar tab (or section in the existing palette sidebar) with:
- Search / filter field for npmjs.com (`GET https://registry.npmjs.org/-/v1/search?text=feezal-element-&size=20`)
- List of search results with install button
- List of currently installed user elements with uninstall button and version badge
- Installation progress indicator

Discovery via npm registry search scoped to `keywords:feezal-element` (packages that follow the spec publish with that keyword).

#### Dynamic update summary

| Action | Restart required? | Rebuild required? |
|---|---|---|
| Install user element via API | ✗ | ✗ — browser reload only |
| Add file to `<dataDir>/elements/` manually | ✗ | ✗ — browser reload only |
| Add bundled package to `www/packages/` | ✗ | ✅ `npm run build` required to update `viewer-bundle.js` |
| Modify a bundled element's source | ✗ | ✅ `npm run build` required |

### N8 — MQTT TLS certificate management

Two sub-features for secure broker connections, both server-side (TLS is terminated in Node.js; the browser is uninvolved).

**CA trust certificate (TLS servers):**
When connecting to an MQTT broker over TLS (`mqtts://`, `wss://`) that uses a self-signed or private CA certificate, the Node.js MQTT client needs to trust that CA. A file-upload control in the Connection settings sidebar lets the user upload a PEM-format CA certificate. Additionally: a text input where users can paste PEM. The server stores it at `dataDir/certs/<siteName>/ca.pem` and passes it as the `ca` option to `mqtt.js`. The sidebar shows the current status ("CA cert: ✓ uploaded" / "none") with a remove button.

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


## Element Ecosystem

### Element platform conventions

See **[docs/element-spec.md](../docs/element-spec.md)** §4 (dual-payload / `message-property-*`), §3.7 (discovery descriptor), §3.8 (custom inspector / N6) for the full platform conventions spec. Individual element entries below reference these by name.

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

### E36 — Dialog element (`feezal-element-material-dialog`) ⚠️ needs further planning

**Canvas placement:** pseudo-element — invisible labelled placeholder in the editor (like `feezal-element-connection-status`). Position and size on the canvas are irrelevant; the dialog is a viewport overlay.

**Body content** — two modes controlled by `content-type`:
- **`simple`** — title + optional icon + body text, all configured as attributes. Zero setup, works standalone.
- **`view`** — references a named feezal view (`body-view` attribute). Full element set available inside. The referenced view is a regular site view (accepted UX tradeoff for now; view list will contain dialog views alongside real views).

**Opening the dialog:**
- **MQTT-driven (MVP):** `subscribe-open` topic — `payload-open` opens, `payload-close` closes.
- **Internal publish (planned, not MVP):** `feezal://` prefix routes in-browser without broker roundtrip — see below.

**Buttons:** `buttons` attribute — JSON array of `{label, icon?, publish?, payload?, style?}`. Every button closes the dialog after publishing. N6 custom inspector for the button list.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `content-type` | `simple` \| `view` | `simple` | Body content mode |
| `title` | string | `""` | Dialog title (simple mode) |
| `message` | string | `""` | Body text (simple mode) |
| `icon` | string | `""` | Material icon name above message (simple mode) |
| `body-view` | string | `""` | Name of the feezal view to embed (view mode) |
| `subscribe-open` | mqttTopic | — | Topic that opens/closes the dialog |
| `payload-open` | string | `open` | Payload that opens the dialog |
| `payload-close` | string | `close` | Payload that closes the dialog |
| `buttons` | string | `[]` | JSON array of button descriptors |
| `width` | string | `480px` | Dialog max-width |

**Default size:** n/a (pseudo-element; editor shows ~120×40 px labelled placeholder).

#### Internal publishing concept ⚠️ TBD — separate platform item

A `feezal://` topic prefix routes pub/sub in-browser without touching the MQTT broker. The connection layer intercepts these topics and delivers them locally. Elements declare `subscribe: "feezal://dialog/my-dialog"` and a button on the same dashboard publishes to that address — zero broker roundtrip, conceptually cleaner.

Further use cases: navigate to a view, chain element actions. Touches element platform, connection layer, and user guide. **Design as a standalone platform item before implementing.** The dialog MVP ships with MQTT-only triggers.

### E37 — Countdown confirmation dialog (`feezal-element-material-countdown-dialog`) ⚠️ needs further planning

A separate specialised dialog that auto-executes an action after a countdown unless cancelled. Canonical use case: "Leaving home" button → dialog shows *"Switching to Away in 10… 9… 8…"* + Cancel. On zero the action fires; Cancel suppresses it.

**Canvas placement:** pseudo-element, same as E36.

**Body content:** same two modes as E36 (`content-type`: `simple` or `view`).

**Flow:**
1. MQTT message (or future `feezal://` internal publish) opens the dialog and starts the countdown.
2. **On zero** → publishes `payload-confirm` to `publish-confirm`. Dialog closes.
3. **Cancel pressed** → publishes optional `payload-cancel` to `publish-cancel`. Dialog closes.

**Visual:** large countdown number + shrinking circular progress ring (styled like E34) + message text + Cancel button.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `content-type` | `simple` \| `view` | `simple` | Body content mode (same as E36) |
| `title` | string | `""` | Dialog title |
| `message` | string | `"Proceeding in {seconds}…"` | Body text; `{seconds}` is replaced live |
| `body-view` | string | `""` | Named feezal view to embed (view mode) |
| `duration` | number | `10` | Countdown duration in seconds |
| `subscribe-open` | mqttTopic | — | Topic that starts the countdown dialog |
| `payload-open` | string | `open` | Payload that opens and starts the countdown |
| `publish-confirm` | mqttTopic | — | Topic published when countdown reaches zero |
| `payload-confirm` | string | `confirm` | Payload published on confirm |
| `publish-cancel` | mqttTopic | — | Topic published when cancel is pressed |
| `payload-cancel` | string | `cancel` | Payload published on cancel |
| `cancel-label` | string | `Cancel` | Label of the cancel button |
| `warn-seconds` | number | `3` | Seconds at which the ring turns red/amber |

**Default size:** n/a (pseudo-element; editor shows ~120×40 px labelled placeholder).

### E38 — Element scaling / responsive sizing ⚠️ TBD — needs element audit

Some elements scale their internal UI proportionally when the element is resized on the canvas (font sizes, icon sizes, SVG geometry adapt to the element's width/height). Others render at a fixed internal size regardless of the element's configured dimensions, leading to clipped or cramped content at non-default sizes.

**Goal:** all visual elements should scale gracefully across a reasonable size range. This likely means adopting `container queries`, CSS `cqw`/`cqh` units, or SVG `viewBox` scaling as a consistent pattern across the element set.

**Next step:** compile a concrete list of elements that do not yet scale (user to supply). Once the list is known, assess per-element effort and decide on a shared scaling pattern before making changes.

### E39 — Splash / FOUC-prevention element ⚠️ needs further planning

A system element that prevents flash-of-unstyled-content and UI jitter on first load, before retained MQTT messages have been received and the dashboard has settled into its initial state.

**Editor behaviour:** pseudo-element (invisible placeholder); position and size are irrelevant. Appears in the palette so the user can drop one onto any view that needs it.

**Viewer behaviour:**
- On first page load, renders a full-screen overlay that sits above all other content (`position: fixed; inset: 0; z-index: 9999`).
- The overlay hides until the following conditions are all met:
  1. The MQTT connection is established.
  2. The view's DOM is fully populated (element `connectedCallback`s have run).
  3. At least one retained message has been received (or a configurable timeout has elapsed as a fallback, so the dashboard doesn't hang indefinitely if there are no retained topics).
- Once the conditions are met the overlay fades out with a short transition (target: ~250 ms).
- Only fires on the initial load; navigating between views does not re-trigger the overlay.

**Open questions (needs refinement before implementation):**
- What counts as "enough messages arrived"? Options: first message on any topic, all subscribed topics that have a retained message, a user-configured count, or a fixed debounce after connection-up.
- Fallback timeout value — what is a sensible default?
- Visual appearance of the overlay: solid colour (matching the site background), logo/spinner, or fully transparent (just blocks rendering)?
- Should `warn-seconds` / a progress indicator be shown if the wait is unexpectedly long?
- Does this belong as a standalone element or as a built-in behaviour of `feezal-site`?

### E40 — Select / dropdown element (`feezal-element-material-select`) + discovery wiring

A Material-style dropdown element for selecting one option from a list, fully wired to MQTT auto-discovery `select` components.

**Background:** The HA MQTT discovery protocol defines a `select` component (`homeassistant/select/<id>/config`) with three key fields:

| Discovery field | Description |
|---|---|
| `options` | `["Option A", "Option B", ...]` — the exhaustive list of allowed values |
| `state_topic` | topic the device publishes its current selection to |
| `command_topic` | topic to publish to when the user picks a new value |

The feezal discovery engine already tracks `select` entities (including `options`) — the missing piece is a feezal element that accepts those fields and renders a usable dropdown.

**Element behaviour:**
- Subscribes to `topic` (`state_topic`) to display the current selection.
- Renders a `<sl-select>` (Shoelace) populated from a comma-separated or JSON `options` attribute.
- Publishes the chosen option string to `command-topic` on change.
- In the editor, renders a static preview dropdown labelled with the element name.

**Suggested attributes:**

| Attribute | Type | Description |
|---|---|---|
| `topic` | `mqttTopic` | State topic (subscribe) |
| `command-topic` | `mqttTopic` | Command topic (publish) |
| `options` | `string` | Comma-separated list of options (e.g. `"auto,heat,cool"`) |
| `label` | `string` | Optional label above the dropdown |

**Discovery map:**
```js
static get feezal() {
    return {
        discovery: {
            component: 'select',
            map: {
                state_topic:   'topic',
                command_topic: 'command-topic',
                options:       { attr: 'options', transform: 'join' }, // array → comma-separated
            }
        }
    };
}
```

The existing `transform: 'join'` in `_applyDiscovery()` already handles array → comma-separated string, so no new discovery infrastructure is needed.

**Scope:** one new element package `www/packages/@feezal/feezal-element-material-select/`. No changes to the discovery engine or inspector required.

### E41 — CSS custom property audit for all material elements ⚠️ needs user input

Every material element exposes a set of `--feezal-*` CSS custom properties for theming, but the exposed set is incomplete and inconsistent across elements. This item tracks a systematic audit pass.

**Known gaps (confirmed):**

No confirmed gaps at this time. The `material-progress-linear` and `material-progress-circular` elements have been superseded by the new merged `feezal-element-material-progress` element which exposes `--feezal-progress-color`, `--feezal-progress-track-color`, and `--feezal-progress-thickness` from the start.

**Scope — elements to audit:**

All material elements currently in `www/packages/@feezal/` (30 elements including the new merged progress element):

`material-badge`, `material-button`, `material-camera`, `material-checkbox`, `material-chip`, `material-climate`, `material-clock`, `material-computer-stats`, `material-contact`, `material-cover`, `material-door-lock`, `material-energy-flow`, `material-fab`, `material-fan`, `material-gauge`, `material-icon-button`, `material-light`, `material-map`, `material-motion`, `material-plant`, `material-progress`, `material-radio`, `material-select`, `material-slider`, `material-switch`, `material-tank`, `material-text-field`, `material-value`

**Process:** User will supply the list of missing properties they identify element by element. Each gap is then implemented: add the `--feezal-*` property to the element's `styles` descriptor and wire it to the relevant internal CSS token. Patch-bump the affected element's `package.json` version per commit.

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

### U7 — Monaco editor for template attributes ⚠️ needs further planning

The `feezal-element-basic-template` element's `template` attribute accepts arbitrary HTML with ES template-literal expressions (`${msg.payload}`, `${msg.topic}`, etc.). The current inspector renders this as a plain `<sl-textarea>` — no syntax highlighting, no autocompletion, no error hints. This item replaces it with an embedded [Monaco editor](https://microsoft.github.io/monaco-editor/) (the engine behind VS Code) for template attributes.

#### Current state

- Attribute descriptor marks the field with `textarea: true` and `template: true`.
- Inspector renders a plain `<sl-textarea rows="6">` with a monospace font.
- Template syntax: ES template literals processed via `new Function('msg', 'return \`' + innerHTML + '\`;')`. The `msg` object has `msg.topic` (string) and `msg.payload` (string or parsed JSON object).
- The server already has a topic trie (`/api/topics/completions?prefix=…`) but does **not** cache last-seen payloads.

#### Proposed implementation

**Triggering Monaco:**  
The `template: true` flag on an attribute descriptor becomes the trigger to render Monaco instead of `<sl-textarea>`. No API change to element authors.

**Lazy loading:**  
Monaco is ~5 MB unparsed. It must be loaded on-demand — only when a `template: true` attribute panel is first opened. Load via dynamic `import()` from a separately chunked Vite entry, or from CDN (`esm.sh` / `jspm`). Web workers for Monaco's language features need special handling in Vite (see `vite-plugin-monaco-editor` or `@monaco-editor/loader`).

Preferred approach: `@monaco-editor/loader` (CDN-backed, zero Vite config) → loads Monaco from `cdn.jsdelivr.net` the first time, then uses the browser cache. No impact on bundle size. Only requires CSP header adjustment for `script-src`.

**Language mode:**  
Use Monaco's built-in `html` language for the template content. HTML gives tag/attribute completion and syntax highlighting. The `${...}` interpolations are visually treated as plain text embedded in HTML (Monaco's HTML mode tolerates them). If a pure-JS template without HTML tags is needed, a `language` hint could be added to the descriptor in the future.

**Monaco editor appearance:**  
- Theme: `vs` (light mode) / `vs-dark` (dark mode) — toggled from `feezal._darkMode`.
- Height: auto-grow up to ~300 px (Monaco's `automaticLayout: true` + a ResizeObserver on the container).
- Disable minimap, line numbers can be shown or hidden (keep for HTML — useful for larger templates).

**Custom completion provider — Phase 1 (static):**  
Register a Monaco `CompletionItemProvider` for the HTML language. When the cursor is after `${`, offer:

| Suggestion | Detail |
|---|---|
| `msg.payload` | Full payload (string or object) |
| `msg.topic` | The MQTT topic string |
| `msg.payloadString` | Raw payload as string |
| `JSON.stringify(msg.payload, null, 2)` | Pretty-printed payload |

**Custom completion provider — Phase 2 (live payload keys):**  
When the template element's `subscribe` attribute is set, fetch the last known payload for that topic and extract its top-level keys. Offer `msg.payload.<key>` completions.

*Server change required:* `bridge.js` adds a `Map<topic, lastPayload>` payload cache (capped at e.g. 500 topics, TTL-free — retained messages stay until reconnect clears them). New endpoint:

```
GET /api/topics/payload?topic=<topic>
→ { payload: <last raw JSON string or null> }
```

*Client:* when the template inspector opens, if the element has a `subscribe` attribute, fetch `/api/topics/payload?topic=…`. Parse the JSON payload and walk the object to extract dot-path suggestions:

```
msg.payload.temperature   → number
msg.payload.humidity      → number
msg.payload.state         → string
```

Nested paths (`msg.payload.device.name`) are offered up to 2 levels deep to avoid explosion on large payloads.

**Descriptor change:**  
No change to the `feezal.attributes` descriptor is needed. `template: true` already marks the field; the inspector detects it and switches to Monaco. Element authors don't need to do anything.

**Component:**  
A new `feezal-template-editor` Lit element wraps Monaco and handles:
- Lazy Monaco load + CDN fallback to `<sl-textarea>` if load fails (e.g. offline / CSP).
- Dark/light theme sync from the parent via a `.dark` CSS class or property.
- Emitting `feezal-change` on content change (debounced ~300 ms to avoid re-renders on every keystroke).
- Auto-grow height.

**Scope:**
1. `server/src/mqtt/bridge.js` — add payload cache + export `getLastPayload(topic)`.
2. `server/src/routes/api.js` — add `/api/topics/payload` endpoint.
3. `www/src/feezal-template-editor.js` — new Monaco wrapper component (lazy CDN load).
4. `www/src/feezal-sidebar-inspector-attributes.js` — detect `template: true`, render `<feezal-template-editor>` instead of `<sl-textarea>`.
5. `editor/index.html` — verify CSP allows `cdn.jsdelivr.net` for the CDN approach, or document the Vite worker approach if bundling locally.

**Open questions:**
- CDN load vs. bundle: CDN is zero-footprint but breaks offline use. If offline export + editor is a priority (see A9 PWA), bundling Monaco as a separate async chunk is safer but adds Vite config complexity.
- Should the editor offer a full-screen expand button (the template can grow large)? 
- Does Monaco's HTML mode handle `${…}` expressions gracefully enough, or do we need a custom TextMate grammar / monarch tokenizer?

## Architecture & Infrastructure

### A4 — Responsive / breakpoint layouts
Define multiple layouts per view (e.g. desktop / tablet / mobile) that activate based on viewport width. Editor shows a breakpoint switcher toolbar. See design exploration in ROADMAP (Open Questions).



### A7 — Git versioning for data directory 🔨 in progress

**Backend implemented:** per-site git repos (`<dataDir>/<siteName>/.git`) are auto-initialised on daemon startup and on new site creation.  Every save commits with `save: <siteName> @ <ISO>`.  `git` is installed in the production Docker image.  Separate history per site.  No npm dependency — plain `child_process` calls.

**Also implemented:** History panel sidebar (`feezal-sidebar-history.js`) with vertical timeline, relative timestamps, per-entry Preview (opens `/viewer/:site?sha=`) + action menu.  Restore (non-destructive checkout + new commit) and Discard (archive branch + `reset --hard`) both with confirmation dialogs.  Archived timelines section (collapsed by default) with per-archive delete.  Viewer route supports `?sha=<hex>` for historical preview with a blue banner.

**Remaining:** Bookmarks (named checkpoints via git tags, `bookmark_add` toolbar button), optional push-to-remote.

---

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

3. **Icons** — a set of PNG icons at standard sizes (192×192, 512×512) for Android, and `apple-touch-icon` for iOS. ✅ Already available: `www/favicon/` contains `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `apple-touch-icon.png`, `favicon.svg`, `favicon.ico`, and a `site.webmanifest` skeleton. The export should copy these files into the ZIP and reference them from the generated `manifest.json`.

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

### A13 — Update / restart feezal from the UI ⚠️ TBD

Allow an admin user to trigger a feezal server update or restart from within the editor, without SSH access to the host.

**Approaches to evaluate:**

| Approach | How it works | Pros | Cons |
|---|---|---|---|
| **Docker socket** | Mount `/var/run/docker.sock` into the feezal container; server calls `docker pull` + `docker restart` via the Docker API | Clean, self-contained; works with any Docker setup | Mounting the Docker socket grants root-equivalent access to the host — significant security surface |
| **Companion sidecar container** | A minimal privileged sidecar (e.g. `containrrr/watchtower` or a custom helper) listens on a restricted local socket; feezal sends it a signed restart request | Docker socket never exposed to feezal's process | Extra container to manage; requires a shared secret between feezal and sidecar |
| **Process manager signal** | If feezal runs under a process manager (pm2, s6, systemd), the manager is configured to restart on SIGTERM; feezal's API endpoint sends `process.exit(0)` | Zero extra dependencies for bare-metal / VM installs | Doesn't pull updates; process manager must be configured correctly; not applicable in Docker |
| **Webhook / CI trigger** | Restart button calls an external webhook (e.g. Portainer webhook, Gitea Actions, n8n) configured by the user | feezal has no privileged access at all | Requires external infrastructure; not self-contained |

**Open questions:**
- Which approach is the right default for the recommended Docker Compose setup?
- Should "update" (pull new image) and "restart" (keep current image) be separate actions?
- Authentication: only admin-role users should be able to trigger this — depends on the auth model (N10 / A3).
- Should the UI show a live log stream of the restart/update progress?

No implementation approach chosen yet.

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