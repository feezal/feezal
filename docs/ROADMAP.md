# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Table of Contents

**Bugs**
- [B16 — Retained-topic replay cache evicted by live updates](#b16--retained-topic-replay-cache-evicted-by-live-updates--fixed) ✅ *(fixed)*
- [B8 — Elements cannot be dragged to the far edge of an oversized view](#b8--elements-cannot-be-dragged-to-the-far-edge-of-an-oversized-view-questionable) ❓

**Near-term Improvements**
- [N2b — Repeater with live canvas sub-elements](#n2b--repeater-with-live-canvas-sub-elements-future) *(future)*
- [N12 — Export bundle: strip mqtt.js for feezal-bridge users](#n12--export-bundle-strip-mqttjs-for-feezal-bridge-users-partial) *(partial)*
- [N13 — Lighter MQTT client for export bundle](#n13--lighter-mqtt-client-for-export-bundle-️-tbd) ⚠️
- [N24 — Viewer presence + per-client control topics](#n24--viewer-presence--per-client-control-topics-️-reviewrefinement-needed) ⚠️
- [N25 — Bridge last-value replay ("synthetic retain")](#n25--bridge-last-value-replay-synthetic-retain-most-likely-not) ❌ *(most likely not)*
- [N27 — Live viewer: load user-installed element/theme packages](#n27--live-viewer-load-user-installed-elementtheme-packages)

**Element Ecosystem**
- [E7 — Swipe gesture element](#e7--swipe-gesture-element)
- [E20 — Weather forecast (`feezal-element-material-weather`)](#e20--weather-forecast-element-feezal-element-material-weather)
- [E25 — Time picker (`feezal-element-material-time-picker`)](#e25--time-picker-element-feezal-element-material-time-picker)
- [E28 — Grafana integration](#e28--grafana-integration)
- [E29 — Tile / compact state element (`feezal-element-material-tile`)](#e29--tile--compact-state-element-feezal-element-material-tile)
- [E30 — Mini live sparkline (`feezal-element-basic-sparkline`)](#e30--mini-live-sparkline-feezal-element-basic-sparkline)
- [E32 — Logbook / event list (`feezal-element-basic-logbook`)](#e32--logbook--event-list-feezal-element-basic-logbook)
- [E34 — Countdown / timer element (`feezal-element-basic-countdown`)](#e34--countdown--timer-element-feezal-element-basic-countdown)
- [E38 — Element scaling / responsive sizing](#e38--element-scaling--responsive-sizing-️-tbd--needs-element-audit) ⚠️
- [E39 — Splash / FOUC-prevention element](#e39--splash--fouc-prevention-element-️-needs-further-planning) ⚠️
- [E48 — Dialog-view element (`feezal-element-material-dialog-view`)](#e48--dialog-view-element-feezal-element-material-dialog-view)
- [E49 — Script element (`feezal-element-system-script`)](#e49--script-element-feezal-element-system-script-️-further-refinement-needed) ⚠️
- [E50 — Conditional wrapper element](#e50--conditional-wrapper-element)
- [E51 — SVG element (`feezal-element-basic-svg`)](#e51--svg-element-feezal-element-basic-svg) 💡
- [E52 — Schedule editor element (`feezal-element-material-schedule`)](#e52--schedule-editor-element-feezal-element-material-schedule-️-reviewrefinement-needed) ⚠️
- [E53 — Notification / toast element (`feezal-element-system-notification`)](#e53--notification--toast-element-feezal-element-system-notification) ✅ *(implemented)*
- [E54 — Markdown element (`feezal-element-basic-markdown`)](#e54--markdown-element-feezal-element-basic-markdown-️-reviewrefinement-needed) ⚠️
- [E55 — Metro tile element family (`feezal-element-metro-*`)](#e55--metro-tile-element-family-feezal-element-metro-) 💡
- [E56 — Analog cockpit element family (`feezal-element-panel-*`)](#e56--analog-cockpit-element-family-feezal-element-panel-) 💡
- [E57 — E-ink / mono element family (`feezal-element-eink-*`)](#e57--e-ink--mono-element-family-feezal-element-eink-) 💡
- [E58 — Frosted-glass element family (`feezal-element-glass-*`)](#e58--frosted-glass-element-family-feezal-element-glass-) 💡
- [E59 — Terminal / retro-CRT element family (`feezal-element-tui-*`)](#e59--terminal--retro-crt-element-family-feezal-element-tui-) 💡
- [E60 — Model-railroad element family (`feezal-element-rail-*`)](#e60--model-railroad-element-family-feezal-element-rail-) 💡
- [E61 — HMI / alarm element family (`feezal-element-hmi-*`)](#e61--hmi--alarm-element-family-feezal-element-hmi--️-reviewrefinement-needed) ⚠️
- [E62 — MQTT broker introspection family (`feezal-element-mqtt-*`)](#e62--mqtt-broker-introspection-family-feezal-element-mqtt--️-reviewrefinement-needed) ⚠️
- [E63 — Plant-schematic symbol family (`feezal-element-schematic-*`)](#e63--plant-schematic-symbol-family-feezal-element-schematic-) 💡
- [E64 — Camera image via MQTT (`feezal-element-basic-mqtt-image`)](#e64--camera-image-via-mqtt-feezal-element-basic-mqtt-image) 💡
- [E65 — Pass/fail counter (`feezal-element-basic-passfail`)](#e65--passfail-counter-feezal-element-basic-passfail) 💡
- [E66 — Fleet / heartbeat board (`feezal-element-basic-fleet`)](#e66--fleet--heartbeat-board-feezal-element-basic-fleet) 💡
- [E67 — Irrigation zone control (`feezal-element-material-irrigation`)](#e67--irrigation-zone-control-feezal-element-material-irrigation) 💡
- [E68 — Astro / sunrise-sunset card (`feezal-element-basic-astro`)](#e68--astro--sunrise-sunset-card-feezal-element-basic-astro) 💡
- [E69 — Carpet plot (`feezal-element-basic-carpet`)](#e69--carpet-plot-feezal-element-basic-carpet) 💡
- [E70 — Sankey diagram (`feezal-element-basic-sankey`)](#e70--sankey-diagram-feezal-element-basic-sankey) 💡
- [E71 — Value-driven icon variants (`feezal-element-basic-icon-value`)](#e71--value-driven-icon-variants-feezal-element-basic-icon-value--implemented) ✅
- [E72 — Plain icon (`feezal-element-basic-icon`)](#e72--plain-icon-feezal-element-basic-icon--implemented) ✅
- [E73 — Text ticker (`feezal-element-basic-ticker`)](#e73--text-ticker-feezal-element-basic-ticker--implemented) ✅
- [E74 — QR code (`feezal-element-basic-qrcode`)](#e74--qr-code-feezal-element-basic-qrcode--implemented) ✅
- [E75 — Data table (`feezal-element-basic-table`)](#e75--data-table-feezal-element-basic-table) 💡
- [E76 — QR code content assistant (typed presets for `basic-qrcode`)](#e76--qr-code-content-assistant-typed-presets-for-basic-qrcode)

**Editor UX**

- [U3 — Element grouping and locking](#u3--element-grouping-and-locking-partial) *(grouping not yet done)*
- [U23 — Custom collapsed placeholder text in the source editor](#u23--custom-collapsed-placeholder-text-in-the-source-editor-blocked-by-upstream) 🚧
- [U30 — Auto-generated starter dashboard from MQTT discovery](#u30--auto-generated-starter-dashboard-from-mqtt-discovery-questionable-low-priority) ❓ 🔽
- [U31 — Device-first element insertion](#u31--device-first-element-insertion-questionable-low-priority) ❓ 🔽
- [U32 — Composed elements: reusable parameterized components](#u32--composed-elements-reusable-parameterized-components) ✅ *(MVP implemented — global library/npm sharing later)*
- [U33 — Element stacking order via context menu](#u33--element-stacking-order-via-context-menu) ✅ *(implemented)*

**Architecture & Infrastructure**
- [A7 — Git versioning for data directory](#a7--git-versioning-for-data-directory-in-progress) 🔨 *(in progress — bookmarks + push remaining)*
- [A11 — Grafana panel plugin](#a11--grafana-panel-plugin-feezal-feezal-panel)
- [A12 — Export deployment targets](#a12--export-deployment-targets-low-priority) 🔽
- [A13 — Update / restart feezal from the UI](#a13--update--restart-feezal-from-the-ui) ✅ *(implemented — admin-only gating waits for N10/A3)*
- [A18 — Kiosk / wall-panel mode](#a18--kiosk--wall-panel-mode)
- [A19 — Security model: multi-user / ACL story](#a19--security-model-multi-user--acl-story-needs-discussion) ⚠️
- [A20 — Element/theme scaffolding and community ecosystem tooling](#a20--elementtheme-scaffolding-and-community-ecosystem-tooling)


---

## Bugs

### B16 — Retained-topic replay cache evicted by live updates ✅ fixed

Elements sometimes got no payload on frontend connect even though their topics are *always published retained*. Root cause chain in `server/src/socket/hub.js`: the replay cache evicted a topic whenever a message arrived with `retain=false` — but per **[MQTT-3.3.1-9] the broker strips the RETAIN flag on every delivery to an established subscription**, regardless of how the publisher set it. `retain=1` only ever marks the stored-retained replay right after subscribing. So the first state update after server start (published retained!) arrived as `retain=0` and evicted the topic; the busier the topic, the more reliably its replay was missing. **Fix — known-retained last-value cache:** a topic ever delivered with `retain=1` (i.e. provably in the broker's retained store) stays cached; every later message refreshes the cached payload (replay is always the last value); only an **empty payload** evicts (the MQTT retained-clear convention — its live delivery also arrives as `retain=0` + empty, previously mis-cached as an empty replay). Topics never seen retained (commands, `reload`) are never cached — the anti-command-replay guarantee is unchanged. Covered by 4 hub unit tests + a full-chain aedes integration test reproducing the exact scenario (retained store predates server start → live retained update → late frontend still gets the fresh replay).

**Residual gap (documented, → N9):** topics whose *first* retained publish happens *after* the feezal server started are never seen with `retain=1` (the bridge's `#` subscription is already established), so they don't enter the replay cache until the next server restart/reconnect. Detecting publisher retain on live deliveries requires MQTT 5 *Retain As Published* subscriptions — belongs to N9 (protocol version).

**Second layer (found while verifying, ✅ fixed):** with the replay working, editor elements *still* missed retained state ~50/50 per page load. `feezal-connection-feezal` dispatched its `connected` event `bubbles + composed` from inside the wrapper's shadow root — the event crossed the shadow boundary and fired on the wrapper host *in addition to* the wrapper's own re-dispatch, so `getSite`/`loadViews` ran **twice**, every element was built twice, and the hub replay raced the second generation. The backend event is no longer composed (the wrapper's re-dispatch is the single public `connected`); the hub also gained the previously missing `unsubscribe` handler (per-socket subscription sets grew stale). E2E `editor-replay.test.js` loads the editor three times against a broker with pre-existing retained state and asserts elements reflect it every time, with exactly one element generation.

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

## Near-term Improvements

### N12 — Export bundle: strip mqtt.js for feezal-bridge users *(partial)*

Exports over `ws://`/`wss://` (the only permitted export mode) no longer bundle socket.io-client (~40 kB) — ✅ fixed by stubbing out `feezal-connection-feezal.js` in the Vite export plugin.

Remaining: exports always bundle mqtt.js (~280 kB) even when the live site uses the feezal bridge. This case is currently blocked at export time (`mqtt://`/`mqtts://` → error), so the remaining waste is theoretical unless bridge-mode export ever gets built (N9 is archived; mqtt:// exports deliberately error).

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

### N2b — Repeater with live canvas sub-elements *(future)*
Each repeater child becomes individually selectable and configurable on the editor canvas. Requires a virtual sub-editor context — significantly more complex, deferred until the MVP repeater is proven useful.

### N27 — Live viewer: load user-installed element/theme packages

Residual from N4/N23 (both archived; the icons type is handled — viewer pages get server-inlined tree-shaken icon registrations). User-installed **element** and **theme** packages under `<dataDir>/elements/` load in the editor (`/editor/feezal-elements.js` re-discovers per request) but not in the **live viewer**, whose bundle contains only built-in packages.

**Likely mechanism (to verify/decide):** install bundles are self-contained ESM served from `/user-elements/<pkg>/…`, so injecting `<script type="module" src="…">` tags for installed packages into viewer pages should just work — mirror how icon registrations are inlined. Decide the static-export story: append the bundles to the export (they're single files) vs. document as unsupported like user icon sets.

**Relates:** N4/N23 (archive), A8 (export tree-shaking — exported user elements would need their tags recognized by `extract-elements.js`).

### N24 — Viewer presence + per-client control topics ⚠️ review/refinement needed

*From the Node-RED research (July 2026): both mature dashboard ecosystems independently converged on this plumbing — uibuilder gives every browser a stable `clientId` with connect/disconnect control messages; Dashboard 2.0 attaches `msg._client` so flows can target one session. Feezal's site control topics are all-or-nothing broadcasts: you can't tell the hallway panel to switch views without also switching every phone.*

**Concept (MQTT-native, no new protocol — just topic conventions):**
- **Client identity (decided):** on **first run** the viewer prompts the user to enter a client ID or accept a generated random default; the ID is persisted in the browser's `localStorage`. **Per-browser is sufficient — no per-tab ID** (two tabs in the same browser profile share one identity; that's fine). User-chosen friendly names (`hallway-panel`) matter for broker ACLs and automations.
- **Presence:** the viewer publishes retained status (JSON: online, current view, user agent, …) with an **LWT** clearing it to offline. Direct-MQTT viewers set their own will at connect; for bridge-backend viewers the server publishes on the socket's behalf on disconnect.
- **Per-client control (decided: additive, not replacing):** the **site-wide control topics remain and keep controlling all running instances**; each viewer *additionally* subscribes to its client-scoped variants of the same command set (`view|reload|theme|addclass|removeclass`).

**Enables:** automations reacting to "is anyone actually looking at a dashboard" (dim the panel, skip TTS announcements); per-panel navigation control (the missing remote-management half of A18 kiosk mode); E49 scripts targeting a specific client; per-device default views.

**Open questions (review before implementation):**
- **Topic convention — undecided.** `<site>/clients/<clientId>/…` is only a strawman; alternatives (`<site>/client/<id>/…`, a separate presence subtree vs. commands-under-client, status topic naming) need a refinement pass before implementation.
- First-run prompt UX: where it appears (viewer overlay?), how the ID can be changed later (settings dialog? query param?), and collision handling (two browsers claiming `hallway-panel`).
- Status payload schema; publish cadence on view changes.
- Privacy note: IP/user-agent on the broker — what goes in the payload by default; opt-in vs. default-on for the whole feature.
- Interaction with N10/A19: per-client MQTT credentials could map onto client IDs (broker ACLs restricting who may publish to whose control topics).
- Editor UI: a "connected clients" panel (list, current view, kick/navigate buttons) — later tier or MVP?

**Relates:** A18 (kiosk remote management), E49 (scripts as automation consumers), N10/A19 (credentials/ACLs), site control topics (existing).

### N25 — Bridge last-value replay ("synthetic retain") ❌ most likely not

**Disposition (July 2026): most likely not.** In practice all relevant topics are reliably retained on the broker — the problem this would solve doesn't exist in a well-configured MQTT setup, and the asymmetry footgun below argues against building it. Kept for the record; the answer to "empty widgets on load" is retained messages (and the E49 local retained cache for page-computed values), documented as best practice.

*Origin — Dashboard 2.0's server-side datastore and uibuilder's `uib-cache` both exist to solve the problem MQTT solves with retained messages — except many real-world publishers (zigbee2mqtt events, misconfigured devices) don't set the retain flag, so a freshly opened viewer shows empty widgets until the next message arrives.*

**Concept:** the server bridge already maintains a live topic/payload cache (`server/src/mqtt/bridge.js`). Opt-in feature: when a **bridge-backend** viewer subscribes, replay the cached last value for topics that have no broker-retained value — synthetic retain.

**Reservations (why this needs review before committing):**
- **Asymmetry footgun:** direct-MQTT viewers and static exports have no server in the path and can't benefit — "works in the live viewer, empty widgets in the export" is a support-question generator. The alternative is to *not* build this and instead document retained-message best practice (and the E49 local retained cache covers computed values).
- If built: global vs. per-topic opt-in; cache TTL/size limits; marking replayed messages (a `synthetic` flag?) so elements/scripts can distinguish them from live traffic.

**Relates:** E49 (local retained cache is the page-local sibling), N10 (bridge-for-everything mode would widen this feature's reach), site connection settings.

### Element platform conventions

See **[docs/element-spec.md](../docs/element-spec.md)** §4 (subscribe naming / dual-payload / `message-property-*`), §3.7 (discovery descriptor), §3.8 (custom inspector / N6) for the full platform conventions spec. Individual element entries below reference these by name.

**Primary subscription naming rule:** every element's primary MQTT subscription attribute must be named `subscribe` (inherited from `FeezalElement`). Secondary topics use `subscribe-<suffix>`. See §4.0 in the element spec.

**Viewer dependency rule — Shoelace is editor-only** *(decided July 2026)*: element packages (anything bundled into the viewer/export) must **not** import Shoelace — editor chrome uses Shoelace freely; elements use `@material/web`, hand-rolled Lit, or plain markup. Referencing `--sl-*` CSS custom properties in element styles is fine (themes define them as fallbacks), and custom **inspectors** may use `<sl-*>` tags without importing them (they only ever render inside the editor, where Shoelace is loaded — the established pattern, see material-dialog's inspector). Keeps viewer and static-export bundles lean. (Applied in E53; E29's more-info panel adjusted accordingly.)

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
| `more` | Tap opens a modal "more-info" panel — reuse the `material-dialog` machinery, **not** Shoelace (Shoelace stays editor-only) (future: embeds the matching full element, e.g. the light or thermostat) |
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

### E38 — Element scaling / responsive sizing ⚠️ TBD — needs element audit

Some elements scale their internal UI proportionally when the element is resized on the canvas (font sizes, icon sizes, SVG geometry adapt to the element's width/height). Others render at a fixed internal size regardless of the element's configured dimensions, leading to clipped or cramped content at non-default sizes.

**Goal:** all visual elements should scale gracefully across a reasonable size range.

**Shared pattern adopted:** `:host { container-type: size }` + CSS container-query units (`cqmin` for square-ish sizing, `cqh` for height-driven) wired into the element's size tokens; explicit `--feezal-*-size` overrides still win. **Exception:** elements with a fixed-positioned popup (e.g. `material-select`) can't use `container-type` (it makes the host a containing block for the fixed menu), so they scale via a `ResizeObserver` driving a shadow-scoped font token instead.

**Progress (user-reported four — ✅ done):**

| Element | Symptom | Status |
|---|---|---|
| `material-icon-button` | Icon size fixed; doesn't grow with dimensions | ✅ icon + touch target scale with `cqmin` |
| `material-checkbox` | Box size fixed; doesn't scale with height | ✅ box + label scale with `cqmin`; also fixed a broken size-token wiring (`--md-checkbox-handle-*` → `--md-checkbox-container-size`) |
| `material-slider` | Clips at low widths; track doesn't grow | ✅ `min-inline-size:0` fixes clipping; track/handle scale with `cqh` |
| `material-select` | Fixed internal size; doesn't adapt | ✅ field text **and field height** scale with element height via `ResizeObserver` (drives the font token plus `--md-outlined-field-top/bottom-space` so the outlined control fills the height instead of staying a fixed ~56 px box; no `container-type` — popup) |

**Remaining (todo):** audit the rest of the element set and apply the same pattern where internal content doesn't scale — this table only covers the four user-reported elements. Caveat: `container-type: size` requires the element to have an explicit height (always true for canvas-positioned elements); watch for elements that rely on auto height.

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

### E48 — Dialog-view element (`feezal-element-material-dialog-view`)

A modal dialog that shows a **feezal view** as its body instead of an HTML template. It is the view-embedding sibling of the existing `material-dialog` (E43 gave that element a template body; this one swaps the template for a live embedded view). This lets an author build a rich "more-info" / settings / detail panel as a normal view on the canvas — with real live elements — and pop it up modally from anywhere via MQTT (or, later, from a tile's `more` action, E29).

**Relationship to neighbours.** `material-dialog` renders a template string (`${msg.*}`) — good for simple confirm/alert dialogs. This element renders an entire view (its own elements, layout, and MQTT bindings stay live inside the dialog) — good for interactive detail panels. It reuses the same **view-embedding mechanism** as `feezal-element-basic-view` / the layout elements (E47): clone the target `<feezal-view name>` with `cloneNode(true)` and clear the `display:none` that `feezal-site` puts on inactive views, so the embedded copy renders and its child elements run their normal lifecycle. Like `material-dialog`, the overlay is rendered into a `document.body` portal in the viewer so it is never clipped by a `display:none` view or a CSS-transformed canvas ancestor.

**Editor behaviour:** a pseudo-element — a ~120×40 px placeholder on the canvas (mirrors `material-dialog`). A **Preview** button in the inspector opens the dialog with the selected view so the author can see it. The `view` attribute uses the standard `dropdown: 'views'` picker (as `basic-view` does) with `baseAttribute: 'view'`.

**Viewer behaviour:** opens on `payload-open`, closes on `payload-close`, backdrop click (`close-on-backdrop`), ESC, or the optional OK/Cancel buttons (each publishes a configurable payload, same as `material-dialog`). Guard against a view embedding itself (a dialog-view whose `view` is the view it lives on) to avoid infinite recursion.

**Attributes** (the `material-dialog` trigger/button set, with `template` replaced by `view`):

| Attribute | Type | Default | Description |
|---|---|---|---|
| `view` | select (`dropdown: 'views'`) | — | The feezal view rendered as the dialog body |
| `title` | string | `''` | Optional dialog title (header hidden when empty) |
| `subscribe` | mqttTopic | — | Topic to listen on for open/close payloads |
| `payload-open` | string | `open` | Payload that opens the dialog |
| `payload-close` | string | `close` | Payload that closes the dialog silently |
| `ok-label` / `ok-publish` / `ok-payload` | string / mqttTopic / string | `''` / — / `ok` | Optional OK button (hidden when label empty) |
| `cancel-label` / `cancel-publish` / `cancel-payload` | string / mqttTopic / string | `''` / — / `cancel` | Optional Cancel button |
| `close-on-backdrop` | boolean | `true` | Close when the backdrop is clicked |
| `show-close` | boolean | `true` | Show a top-right ✕ close affordance |

**Exposed CSS custom properties (dialog size + chrome).** Because the body is a whole view rather than a short message, sizing matters more than for `material-dialog` — expose it as themeable custom properties (defaulting to the current `material-dialog` sizing) rather than only fixed `width`/`max-height` attributes:

| Property | Default | Controls |
|---|---|---|
| `--feezal-dialog-view-width` | `600px` | Panel width |
| `--feezal-dialog-view-height` | `auto` | Panel height (`auto` fits the view; set to size a fixed panel) |
| `--feezal-dialog-view-max-width` | `calc(100vw - 32px)` | Upper bound on width |
| `--feezal-dialog-view-max-height` | `85vh` | Upper bound on height (body scrolls past this) |
| `--feezal-dialog-view-radius` | `8px` | Panel corner radius |
| `--feezal-dialog-view-padding` | `0` | Padding around the embedded view (0 lets the view own its full bleed) |
| `--feezal-dialog-view-background` | `--md-sys-color-surface` | Panel background |
| `--feezal-dialog-view-backdrop` | `rgba(0,0,0,0.5)` | Backdrop colour/opacity |

The corresponding `width` / `max-height` string attributes may be kept as convenience shorthands that simply set the matching custom property, so simple cases don't need CSS.

**Default size:** 120×40 px (pseudo-element placeholder).

**Open questions:**
- View lifecycle when closed — keep the cloned view mounted (fast re-open, retains transient element state) vs destroy on close (clean slate, lower cost). Probably destroy-on-close by default, matching the dialog's ephemeral nature.
- Should the embedded view's own background/margin (`--feezal-view-margin`) be respected, or reset inside the dialog?
- Interaction with E29's `more` action (a tile opening a matching dialog-view) — settle the wiring when E29 lands.

### E49 — Script element (`feezal-element-system-script`) ⚠️ further refinement needed

A small client-side scripting sandbox as a canvas element — the feezal answer to vis's binding language and HA's Jinja templating, but MQTT-native and deliberately minimal (inspired by [she](https://github.com/hobbyquaker/she), but *much* simpler: no cron/solar, no HTTP routes, no storage, no npm requires). It is glue, not an automation engine — logic that must run reliably 24/7 belongs in she/Node-RED; the script element covers *presentation-side* transforms and page-local interactivity: subscribe to broker topics, compute, publish the result page-locally, and any plain display element shows it; conversely a slider publishing locally becomes script input.

**Companion feature — local publishing with a retained cache (decided):** scripts communicate with other elements through **ordinary topic names published page-locally** — *not* through a reserved namespace. An earlier `$local/…`-prefix concept was **rejected**: the connection layer already has the flag convention (`feezal.connection.pub(topic, payload, {local: true})` → `_spreadMessage()`, used by paper-tabs' `publishLocal` checkbox), subscribers are origin-agnostic (they match topic names only), and — the decisive UX argument — with the flag, switching between local and broker publishing is one toggle/method swap at the *publish site*; a namespace would force editing topic strings at every subscriber too.

What `feezal-connection` is missing today: **a client-side last-value cache.** Local publishes reach only currently-registered subscriptions (`_spreadMessage`); broker topics get retained-replay from the broker on subscribe, local ones have no equivalent — a late subscriber (element on a view activated later under `dynamic-subscriptions`, or a script worker restarted after an edit) misses the current value. **Work item:** a local retained cache — `pub(topic, payload, {local: true, retain: true})` stores the value; `sub()` replays matching cached values to new subscribers. Useful standalone (E50 and every element benefit immediately, before the script element ships).

**Sandbox API (draft):**

```js
fzl.sub('home/+/temperature', (payload, topic) => { ... })  // origin-agnostic, wildcards supported
fzl.pub('avg-temp', value, {retain: true})                  // page-local → connection.pub(..., {local: true})
fzl.mqtt.pub('home/foo/set', payload, {retain, qos})        // broker
// plain setTimeout / setInterval work
```

**Implementation sketch (proposed):**
- **Sandbox: one Web Worker per script element** — the browser analog of she's node VM. Real isolation (no DOM, no `feezal.*` internals reachable), a busy-looping script can't freeze the UI or other scripts; terminate + restart fresh on element disconnect or source edit (she-style hot reload — broker-retained messages plus the local retained cache re-deliver current state, so scripts need no persistence). A shared worker would couple script failures and create a shared-global side channel; the by-design inter-script channel is locally published topics.
- **Worker bootstrap** via `URL.createObjectURL(new Blob(...))` — self-contained, works in static exports. Message protocol — worker→main: `sub(pattern)`, `pub`, `mqttPub`, `log`, `error`; main→worker: init (source), matched messages, stop. The element registers subscriptions with `feezal.connection` on the worker's behalf and applies its publishes — and this is where the **editor guard** lives: in editor mode `mqttPub` is intercepted and logged ("would publish X to Y") while local `pub` flows normally so downstream elements preview live (live-WYSIWYG rule, same as the `feezal.isEditor` publish guard).
- **Persistence:** script source as a **`<script type="text/feezal">` child** of the element — browsers parse typed scripts as raw text (code containing `<` doesn't break HTML parsing) and never execute unknown types; survives the Monaco source round-trip as ordinary HTML. Attribute storage rejected (escaping hell); bare text content rejected (`a < b` starts a tag).
- **Editor:** invisible in the viewer; chip in the editor (code icon + `name` + green running / red error dot). Monaco with a `fzl.d.ts` typedef for completions; `console.log` and uncaught errors proxied to an editor console panel.
- **Element attributes:** `name`, `run` (MVP: `always` only).

**MVP cut (draft):** ① local retained cache in `feezal-connection` · ② script element: per-element worker, `fzl.sub`/`fzl.pub`/`fzl.mqtt.pub`, timers, error/log forwarding, `run="always"` · ③ Monaco completions, editor chip, console panel, editor-mode mqtt guard. **Deferred:** `run="view-active"`, hung-worker watchdog, payload-JSON conveniences; cron/solar probably never (automation-engine territory). **Explicit non-goal:** single-instance guaranteed execution / "run on server" — that's she's/Node-RED's job.

**Open questions (proposed answers — confirm or veto before implementation):**
1. **One worker per script element** (vs. one shared worker) — proposed: per element.
2. **Per-client `fzl.mqtt.pub` footgun** — the script runs in *every open viewer*; a `setInterval` publishing to MQTT fires once per connected client. Proposed: document loudly, don't restrict (restricting to message-handler context would break legitimate debounce/delayed-publish patterns).
3. **Lifecycle:** MVP ships `run="always"` only — the element must opt out of the `dynamic-subscriptions` pause for hidden views; `view-active` added later if wanted.
4. **`<script type="text/feezal">` child** as source storage.
5. **Worker defaults incl. `fetch` stay available** — proposed: allow. The sandbox's job is isolation from the DOM and feezal internals, not capability policing (dashboard authors hold the editor password anyway), and fetch→`fzl.pub` covers she's HTTP convenience for free.
6. **Raw-string payloads** in both directions, user calls `JSON.parse` — proposed: yes for MVP; auto-parse conveniences later.
7. **Retain default for `fzl.pub`** — proposed: opt-in, exactly like MQTT (retain state such as `avg-temp`; never events, or they ghost-replay on view activation — the mental model the audience already has).
8. **Dual-source topics** (the same name carrying broker *and* local messages) are inherent to the flag approach — a feature (scripts can simulate/override device values during development) and a footgun; proposed: documentation note only, no mechanism.

**Caveats to document:** strict-CSP hosting may need a `worker-src` allowance for blob workers; static export works client-side by design (N10 interaction to verify).

**Relates:** E50 (wrapper binds script-computed topics), U32 (a component param can be a script-fed topic), N2b, N10.

### E50 — Conditional wrapper element

A container element that wraps another element and declaratively binds its **visibility, CSS classes, or styles** to an MQTT topic — or a page-locally published one (see E49) — feezal's answer to HA's per-card visibility conditions (state / user / screen-size), which are among HA's most-used dashboard features. Today this requires imperative `addclass`/`setstyle` control-topic plumbing from Node-RED; the wrapper makes the 80% case a pure inspector configuration.

**Concept:** the wrapper holds one child element (drop-into nesting like `layout-flex`). Attributes (draft): `subscribe`, `condition` (`=`, `!=`, `>`, `<`, `>=`, `<=`, regex), `value`, and `mode`:

| Mode | Behaviour when condition matches |
|---|---|
| `show` / `hide` | Toggle child visibility (`display` vs. `visibility` TBD — layout impact) |
| `class` | Add `class-name` to the child, remove when unmatched |
| `style` | Apply a configured inline style set to the child |

Multiple conditions / else-branches are out of scope for the MVP — combined logic is exactly what E49 is for (a script computes and publishes the result page-locally; the wrapper simply subscribes to that topic).

**Notes:** transition/animation on toggle (fade) as a nice-to-have; editor always renders the child (with a badge showing the condition) so hidden elements stay editable; naming/category TBD (`layout` vs. `basic`).

### E51 — SVG element (`feezal-element-basic-svg`) 💡 idea

An element that renders an SVG **inline** (shadow DOM, not `<img>`) and binds its *internals* to MQTT — the floor-plan / schematic use case that is hugely popular in HA (ha-floorplan, picture-elements) and openHAB: rooms light up with the lights, a heating schematic recolors pipes with the flow temperature, a custom gauge needle rotates with a sensor value. `basic-image` can already *display* an SVG, but via `<img>` the document is opaque — no styling, no per-node bindings, no clickable regions. Inline is the whole point.

**Tiers (each useful on its own):**

1. **Display** — `src` from the Asset Manager (or pasted markup); the SVG is fetched, sanitized (strip `<script>`, `on*` attributes, external hrefs) and injected inline; scales to the element box (`viewBox`-driven, `preserveAspectRatio` attribute).
2. **Value bindings** — an inspector-managed mapping list (N6-style rows, like navbar items): CSS selector (typically `#id`) → `subscribe` topic → target (`fill` | `stroke` | `opacity` | `visibility` | `class` | `text` | `transform: rotate/translate/scale`) with optional payload mapping (`on`→`#ffb300`, numeric ranges → interpolated color, `${value}` for text nodes). Persisted as JSON attribute like the navbar/app-layout item lists.
3. **Click regions** — the same selector rows optionally get `publish` topic + payload: click/tap on the sub-shape publishes (hover cursor + focus outline on bound shapes).

**Notes:** sanitizing matters even self-hosted (an asset SVG may carry scripts); bindings should use the dynamic-subscription path so only the active view subscribes; editor renders the SVG live with a badge listing the bound selectors — selector *picking* by clicking a shape in the editor canvas would be the killer UX (Tier 2b, needs an editor pick mode). Category `basic`; the asset `src` participates in A16 referenced-asset export, inline-injected content must be inlined into the static export like element markup.

**Relates:** E50 (per-element conditions — the SVG element is many conditions on one graphic), E49 (computed values feeding bindings), U32/N2b (`${...}` payload templating), A16 (asset refs), N6 (inspector list-row editing pattern).

### E52 — Schedule editor element (`feezal-element-material-schedule`) ⚠️ review/refinement needed

A UI for **editing schedules, not executing them**: the element renders the current schedule from a subscribed (retained) topic and publishes the edited schedule as JSON back to a topic. Whatever consumes it — she, Node-RED, a thermostat adapter — owns the actual scheduling. This division keeps feezal a pure view layer and makes the element universally useful.

*Why: Dashboard 2.0's most popular third-party widget is a full UI scheduler (`@cgjgh/node-red-dashboard-2-ui-scheduler`), and scheduler UIs are a perennial gap in HA dashboards too. Bonus synergy: she has cron/solar scheduling built in — a feezal schedule editor publishing to topics that she scripts consume is a natural combo of the two projects.*

**MVP sketch:** weekly grid (7 days × time slots) for on/off or setpoint-per-slot schedules — the thermostat/irrigation/wake-light use case. Tap/drag to paint slots; publish on change (or explicit save button). Entry-list mode (time + payload rows, cron-ish) as a later tier.

**Design input from BMS research (July 2026):** Niagara's Scheduler view is the industry-reference weekly editor — model E52 on it: **typed schedules** (Boolean for on/off, Numeric for setpoints, Enum later), drag-paint blocks on the 7-day grid, a separate **special-events / holiday-calendar list** with priorities (Desigo's exception-schedule + reusable calendar-object model), and an **"effective value now" chip**. This largely settles the format direction: schedule JSON = typed weekly grid + prioritized exceptions + referenced calendars — a generic contract a she helper can consume natively. (Also: ThingsBoard paywalls its scheduler in PE and it's the most-missed feature in their CE community — this element is a real differentiator.)

**Open questions (review before implementation):**
- **Schedule JSON format** — the central decision: define a generic feezal contract vs. align with she's schedule format vs. support pluggable formats (payload templates). Undecided from the discussion; leaning toward a simple generic contract that a she helper can consume natively.
- Setpoint schedules (numeric per slot) in MVP or on/off only?
- Timezone handling (schedule in local time of the consumer, not the browser?).
- Needs a custom inspector (N6) and careful touch/mobile interaction design — this is the most UI-heavy element on the roadmap.

**Relates:** she (consumer), E25 (time picker could be a building block), N6 (custom inspector).

### E53 — Notification / toast element (`feezal-element-system-notification`)

**Status: ✅ implemented (July 2026)** — shipped as spec'd below, with one deviation: `closable` became **`hide-close`** (default `false`), because a default-true boolean attribute cannot round-trip HTML attribute semantics (`closable="false"` would parse as *true*). Toasts render in a shared `feezal-notification-toasts` host appended to `document.body` (the dialog-portal pattern) that mirrors the site's `feezal-theme-*` class, so they escape hidden views and stay themed.

Transient toast notifications driven by MQTT — "washing machine done", "alarm triggered". An invisible system element (editor chip like E49): subscribe to a topic; each message shows a toast with severity styling and timeout. Dashboard 2.0 ships `ui-notification` as a core widget; feezal has dialogs but nothing transient.

**Decided:**
- **Hand-rolled Lit toast stack — Shoelace stays editor-only** (viewer-bundle principle; note @material/web offers no snackbar/toast — planned but never shipped before maintenance mode). Prior art in-repo: the AI chat's mini-toast (`_showToast` in `feezal-ai-chat.js`); the element version adds severity styling, close button, per-toast timers, stacking. Styled via theme CSS custom properties.
- **Position:** fixed **top-right** stack for the MVP; restyleable via user CSS (U18); per-element stack positions are a later enhancement.
- **Payload handling — standard element conventions, no special contract:** `messageProperty` (standard dot-path) extracts the toast text; optional `severity-property` / `title-property` / `timeout-property` dot-paths pull per-message overrides from JSON payloads; element-level defaults apply otherwise. Plain string payloads render as-is.
- **Editor behaviour:** live toasts **suppressed in editor mode**; a small custom inspector (N6) provides a **"Preview notification"** button — same pattern as material-dialog's "Preview Dialog" button — showing a sample toast from the current attributes.
- **Always-active:** the subscription stays live regardless of the active view (opt-out of the `dynamic-subscriptions` pause) — notifications are a site-level concern, place the element once. *This pioneers the always-active mechanism E49 will reuse.*
- **Multiple instances allowed** — channels by design: e.g. one element on `home/+/alert` (`severity="warning"`, sticky), another on `home/status/#` (info, 6 s).

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | Topic or wildcard to toast |
| `messageProperty` | string | — | Standard dot-path extraction for the toast text |
| `title` | string | `""` | Static title line (optional) |
| `title-property` | string | — | Dot-path: per-message title from the payload |
| `severity` | `info` \| `success` \| `warning` \| `error` | `info` | Default severity styling |
| `severity-property` | string | — | Dot-path: per-message severity from the payload |
| `timeout` | number | `6` | Seconds until auto-dismiss; `0` = sticky until closed |
| `timeout-property` | string | — | Dot-path: per-message timeout from the payload |
| `hide-close` | boolean | `false` | Hide the dismiss (×) button |
| `max-visible` | number | `4` | Stack cap; oldest toast dropped on overflow |
| `dedupe` | boolean | `false` | Collapse consecutive identical messages |

**Editor preview:** chip (bell icon + subscribed topic), like the E49/pin system-element pattern.

**Deferred:** dismiss-publishes-ack, sound (browser autoplay policies), per-element stack positions, rate limiting beyond `dedupe` + `max-visible`.

**Relates:** E49 (always-active mechanism, invisible-system-element pattern), E32 (logbook is the persistent sibling), E48 (dialog for blocking interactions), N6 (custom inspector), U18 (stack restyling via user CSS).

### E54 — Markdown element (`feezal-element-basic-markdown`) ⚠️ review/refinement needed

Render Markdown from a subscribed payload or an asset file (`src`) — notes, documentation panels, status summaries. Dashboard 2.0 ships `ui-markdown` (incl. Mermaid); uibuilder built a whole markdown-site node (Markweb). Cheap to build and has a nice AI synergy: the in-editor assistant already renders Markdown — an element displaying AI/script-generated markdown content closes that loop (E49 script computes a summary → publishes → markdown element renders).

**Open questions:** reuse the AI chat's existing Markdown renderer/library (bundle economy — one markdown lib, not two); sanitization policy for topic-driven content; asset-`src` vs. `subscribe` precedence; Mermaid as later opt-in (heavy dependency); `${...}` templating explicitly out of scope (that's `basic-template`'s job).

**Relates:** U9/AI assistant (shared renderer), E49 (generated content), A16 (asset refs), E32/basic-template (adjacent display elements).

### E55 — Metro tile element family (`feezal-element-metro-*`) 💡 idea

A new element set in the design of Microsoft's **Metro** design language (the Windows Phone 7 / Windows 8 start-screen live tiles): flat solid-color tiles, sharp corners, white iconography and typography, everything on a strict size grid. The signature interaction: every tile can **flip to its back side** with the classic 3D Y-axis rotation — **front = the one base action, back = the details**.

**Concept:**

- **Tile sizes: `1x1`, `2x2`, `4x2`, `4x4`** grid units (one attribute, like the Metro small/medium/wide/large tiles). A shared base unit makes mixed tiles align into the iconic mosaic; snapping tile sizes to the editor grid (multiples of the configured grid size) keeps the mosaic effortless without needing a dedicated layout container.
- **Front / back split:** the front carries only the primary state + one base control — light: name, icon, an on/off switch (or the whole tile toggles on tap, Metro-style); thermostat: current temperature; media: track + play/pause. Flipping reveals the detail controls: brightness + color-temperature picker, setpoint stepper + mode, volume/seek/source. Small sizes (`1x1`) may be front-only.
- **Flip mechanics:** CSS 3D (`perspective` + `rotateY(180deg)`, `backface-visibility: hidden`) in a shared base class — front tap fires the base action, so the flip needs its own affordance: a corner ellipsis "⋯" (the Metro app-bar glyph), and flip-back via "⋯"/outside tap. Flip state is per-client UI state, not published.
- **Family (first cut):** `metro-light`, `metro-switch`, `metro-climate`, `metro-sensor` (value + trend on the back), `metro-media`, `metro-contact` — plus `metro-navigate` (a tile that jumps to a view; start-screen-as-navigation). Later: live-tile-style **notification flips** (the periodic content flip Metro tiles are famous for) for sensor tiles.
- **Shared base class** (`feezal-element-metro-tile`) owns size grid, accent color, flip machinery and front/back slots; concrete elements fill the faces — keeps per-element code small, guarantees family consistency.
- **Theming:** accent color from the theme (`--feezal-metro-accent` falling back to the primary color); a matching **`feezal-theme-metro`** package (dark background, accent palette à la WP7 lime/cyan/magenta) completes the look but the tiles must look right on the existing themes too.

**Notes:** the per-tile detail-on-the-back answers the same need as E29's `more` action and E48's dialog-view, just inline — settle the overlap when implementing (a metro tile could alternatively open a dialog-view for *full* detail); viewer-dependency rule applies (no Shoelace in the elements — hand-rolled Lit; the pickers can reuse what material-light already ships); auto-discovery should wire the family like the material set.

**Relates:** E29 (compact-state pattern, `more` action), E48 (detail panels), E38 (scaling within the size grid), N23 (icon set — Metro wants the Segoe-style glyph look), U3 (grouping keeps mosaics intact), A20 (family ships as npm packages).

### E56 — Analog cockpit element family (`feezal-element-panel-*`) 💡 idea

Skeuomorphic **instrument-panel controls** — the "virtual hardware" aesthetic the MQTT/Node-RED crowd loves: dashboards that look like a machine console, not an app. More than a skin, because it introduces **interaction types the current set doesn't have**.

**Family (first cut):**

- **`panel-toggle`** — a real flip toggle switch (guard-cover variant as an attribute for "are you sure" actions) with a satisfying snap animation.
- **`panel-knob`** — **rotary knob**: drag-to-turn (pointer angle) + scroll-wheel + keyboard arrows; detents optional; min/max/step; publishes like the slider but *feels* like hardware. The marquee element of the family — dimmers, volume, setpoints.
- **`panel-gauge`** — analog needle gauge (240° arc, configurable range/zones — green/amber/red bands); needle physics (spring damping) convey rate-of-change in a way a number can't. VU-meter variant (level from a topic, peak hold).
- **`panel-led`** — indicator lamp (steady/blinking states by payload mapping, color per state), the classic status pilot light.
- **`panel-7seg`** — seven-segment / Nixie-style numeric display for sensor values.

**Styling:** brushed metal / dark console surfaces, engraved labels, screw-head corner details as an opt-out flourish; a restrained **Dieter-Rams / hi-fi** variant (matte, minimal) selectable per theme rather than a separate family. Needs to degrade gracefully on the existing flat themes (the physics/interaction still carry the value).

**Notes:** knob/gauge rendering is SVG-in-shadow-DOM (crisp at any size, themeable via CSS custom properties, relates to E51's machinery); drag-to-turn needs the same interact.js pointer discipline as the canvas (editor mode must not fight element drag); auto-discovery wiring like the material set (dimmer → knob, sensor → gauge).

**Relates:** E38 (elements scale to their box — gauges/knobs are naturally square), E51 (SVG rendering), N23 (glyphs), A20 (npm packaging), existing material-slider/light (shared publish conventions).

### E57 — E-ink / mono element family (`feezal-element-eink-*`) 💡 idea

Less a styling exercise than a **deployment niche**: pure black-and-white, huge type, thick rules, zero animation — designed for the very popular **wall-mounted e-paper dashboards** and repurposed Kindle/old-tablet kiosks where normal themes are unreadable and animation causes ghosting. Nobody in the MQTT dashboard space serves this well.

**The constraint set is the spec:**

- **1-bit contrast discipline:** black on white only (optional inverted), no greys as information carriers (dithered fills allowed as texture), ≥2px rules, oversized numerals for glanceability across a room.
- **No animation, no transitions, no hover** — state changes swap content instantly; e-paper refresh does the rest.
- **Redraw discipline:** value updates must change the DOM *only when the rendered text/state actually differs* (e-ink partial refresh is expensive; a per-second re-render of an unchanged value ghosts the panel). A shared base class throttles/dedups updates — this is the real engineering content of the family.
- **Battery-friendly:** works with N24-style per-client controls (a display topic can blank/sleep the panel).

**Family (first cut):** big-numeral sensor tile (value + unit + label + optional min/max footer), on/off state tile (inverted block when active — also the *control*, full-tile tap target), weather summary, clock/date, and a mono icon set (N23 with a stroke-only style). Charts (E-chart family) get a mono sparkline variant later.

**Notes:** ships with a **`feezal-theme-eink`** (white, mono type stack) but the elements enforce their own contrast rules so they survive any theme; pairs with A18 (kiosk mode: hide chrome, wake-lock, fullscreen) — an e-ink profile there (no cursor, no focus rings) would complete the story; test target: a browser at 8-bit greyscale forced-colors emulation.

**Relates:** A18 (kiosk / wall-panel mode), N24 (per-client sleep/wake), N23 (icons), E38 (type scales to the box), A16/export (these panels often run the static export from a local file).

### E58 — Frosted-glass element family (`feezal-element-glass-*`) 💡 idea

Translucent blurred cards over a wallpaper — the **"make it look like Apple Home"** request. Maximum mainstream familiarity and the highest spouse-acceptance factor of the styled families: rounded squircles, `backdrop-filter: blur()` frost, soft depth, SF-Symbols-like glyph weight, springy micro-interactions.

**Concept:**

- **The wallpaper is part of the system:** the view background image (Asset Manager) shines through every card — the frost effect *is* the theming. A **`feezal-theme-glass`** ships wallpapers + light/dark frost variables (`--feezal-glass-blur`, `--feezal-glass-tint`, border-highlight).
- **Family (first cut):** scene/action button (icon + label squircle), light card (tap toggles, long-press/flip for brightness — interaction pattern shared with E55's front/back split), sensor card, room-group card (icon grid of the room's devices), media card. The HomeKit-style **grid of small squircles** look comes from U3-grouped cards on the canvas, no dedicated container needed.
- **Performance is the catch:** `backdrop-filter` over a large wallpaper is expensive on weak wall-tablet GPUs — a **`degrade` attribute/theme switch** falls back to a pre-blurred wallpaper + semi-opaque solid cards (visually near-identical, zero per-frame cost). Decide the default by measuring on a Pi/cheap Android tablet.
- **Auto-contrast:** text/icons must stay legible over arbitrary wallpapers — the tint layer guarantees minimum contrast (sample-based auto light/dark tint as a nice-to-have).

**Notes:** viewer-dependency rule applies (hand-rolled Lit, no Shoelace); the squircle corner (iOS superellipse) via SVG `clip-path` where `corner-shape` isn't available; honest name (`glass`, not `apple-*`) — no trademark cosplay in package names.

**Relates:** E55 (front/back detail pattern), E29 (compact state card), A16 (wallpaper asset export), E38 (scaling), A18 (wall tablets are the target hardware — perf switch matters there).

### E59 — Terminal / retro-CRT element family (`feezal-element-tui-*`) 💡 idea

Monospace, box-drawing borders, green/amber phosphor glow, optional scanline/flicker overlay — the **system console** aesthetic. The nichest of the styled families but the cheapest to build (it is mostly typography and border characters), with huge nerd appeal and a natural pairing with E49: a script element computing values that render into a live "console".

**Family (first cut):**

- **`tui-panel`** — a box-drawing-framed container (`┌─ TITLE ─┐`) wrapping other elements (nesting like `layout-flex`).
- **`tui-value`** — `label........: value` dot-leader readout rows; blinking cursor block on change.
- **`tui-log`** — scrolling message feed from a topic (E32's logbook in terminal clothes; shared guts if E32 lands first).
- **`tui-sparkline`** — block-character graph (`▁▂▃▅▇`) of recent values — a chart with zero chart library.
- **`tui-toggle` / `tui-menu`** — `[ X ]` checkbox and numbered hotkey menu (`[1] Lights  [2] Heating`) publishing on click/keypress.
- **`tui-ascii`** — big-type banner display (figlet-style numerals for clocks/sensors, font baked in).

**Styling:** one `feezal-theme-tui` with phosphor variants (green/amber/white); glow via layered `text-shadow`; the CRT overlay (scanlines, vignette, subtle flicker) is a per-view opt-in element or theme flag — **off by default**, it's an accessibility hazard (flicker) and battery cost.

**Notes:** monospace metrics are the layout grid — elements size in `ch`/`lh` units so borders align across neighbouring elements (the editor's px-grid snapping needs to tolerate that, relates E38); box-drawing joins between separate elements are a non-goal for the MVP (each element frames itself); flicker/animation must respect `prefers-reduced-motion`.

**Relates:** E49 (script → console synergy), E32 (logbook), E34 (countdown in figlet type), N23 (no icons needed — that's the point), A20 (packaging).

### E60 — Model-railroad element family (`feezal-element-rail-*`) 💡 idea

An element set for **model-train control panels** — the first family that opens feezal to a *second hobby community* rather than restyling the first one. The enabler is that MQTT is genuinely established in the hobby (researched July 2026):

- **JMRI** (the open-source hub) has first-class MQTT connections since v4.22/4.26: turnouts, sensors, lights, signal masts, reporters, even throttles — with **plain text payloads** (`CLOSED`/`THROWN`, `ACTIVE`/`INACTIVE`) on a simple topic scheme. Zero-friction feezal fit; this is the primary integration target.
- **Rocrail** runs a native MQTT service (full RCP client protocol over `rocrail/service/client|info`, QoS 1) — but payloads are **XML snippets**, so it needs a thin translation layer: a documented Node-RED bridge flow (Rocrail's wiki has a Node-RED page) or an E49 script; settle the story before shipping.
- **DIY hardware speaks MQTT directly** — mqTrains (ESP8266 servo turnouts, ~$5/point), MattzoBricks (Lego trains), RocMQTTdisplay: layouts with topics on the wire and *no* PC software. feezal can be their entire control panel.
- **iTrain / TrainController** are proprietary/closed (no MQTT, no open API) — out of reach, but they define the UI expectations: track-diagram switchboard, block occupancy, throttles.

**Why feezal wins here:** the incumbent web UIs (JMRI's web-panel servlet mirroring desktop PanelPro, Rocweb) are functional but dated; nobody offers a WYSIWYG, themeable, mobile/PWA panel builder for MQTT layouts. Club/exhibition layouts are exactly the wall-tablet kiosk case feezal already targets (A18, PWA, static export).

**Family — two halves:**

1. **Track-diagram primitives (the Gleisbildstellpult):** straight/curve/crossing segments; a click-to-throw **turnout** with state coloring (+ confirm option for exhibition safety); multi-aspect **signal** (payload→aspect mapping); **block segment** colored by an occupancy sensor; route buttons (publish a route id, light up when set); uncoupler/turntable controls. Elements snap together into a track plan on the editor grid — friendlier than hand-drawing an E51 SVG plan (E51 stays the power-user path: import a CAD track plan, bind ids).
2. **Cab controls:** a **throttle** — speed via rotary knob (shared machinery with E56's `panel-knob`), direction toggle, F0–F28 function grid, loco selector; JMRI's MQTT throttle topics are the reference wiring.

**Styling — the hook:** the iconic **SpDrS60 relay panel / US CTC dispatcher** look (grey domino tiles, colored route lights) as the default `feezal-theme-rail` — itself a beloved aesthetic in the hobby, making this a styled family in the same spirit as E55–E59.

**Notes:** grid-snapping of track segments must assemble cleanly (same mosaic discipline as E55); topic conventions per target (JMRI scheme first-class in auto-discovery-style pre-wiring; Rocrail via the bridge); safety UX matters at exhibitions — locking (U3) and PIN (E44) combine well with a public-facing panel.

**Relates:** E56 (rotary knob), E51 (SVG track-plan alternative), E44/U3 (public-panel safety), A18 (kiosk), E49 (Rocrail XML bridge), A20 (packaging). Research sources: jmri.org MQTT hardware docs, wiki.rocrail.net MQTT service + Node-RED pages, mqtrains.com, mattzobricks.com.

### E61 — HMI / alarm element family (`feezal-element-hmi-*`) ⚠️ review/refinement needed

*From SCADA/BMS research (Ignition, Desigo CC, Niagara, ThingsBoard — July 2026). The consistent lesson across all four ecosystems: stock widget sets age badly and integrators pay for responsive, low-config, binding-driven replacements — and the alarm suite appeared independently in every report as the most universal gap.*

The highest value-to-effort family of the research-derived sets:

- **Moving analog indicator** — Ignition's signature ISA-101 widget: current-value arrow + setpoint marker + good/warn/alarm bands on a horizontal/vertical bar. Domain-generic: temperature vs. comfort band, CO₂, humidity, battery SoC. *"At a glance it is obvious whether the value is where it should be."* Arguably the single best widget idea in the research.
- **Alarm suite**: an **alarm table** with acknowledge/shelve actions (ack = publish to an ack topic), severity colors and filters, card-collapse on mobile (Ignition's responsive pattern); a **severity lamp strip** with live per-category counts (Desigo summary-bar pattern, click → filtered list); a one-line **"highest active alarm" banner**; later a per-element alarm badge with inline-ack popover.
- **Command widgets with handshake semantics**: **multi-state button** (Hand/Off/Auto row), **one-shot button** (publish, show *pending* until state readback confirms — nothing in the current element set does write-confirm), **setpoint stepper** (+/− with bounds).
- **Small classics**: LED/7-segment display, state-over-time strip chart (online/offline/heating timeline), **andon/status grid** over N topics (rooms, servers, appliances).
- **Companion theme**: an **ISA-101 greyscale theme** ("color appears only for abnormal conditions") — slots into the E55–E60 style-family series.

**Blocker to refine first — an alarm topic convention:** JSON shape (`{severity, text, ts, id?}`), severity levels, ack-topic convention (`<topic>/ack`?), retained-active-alarm vs. event-stream semantics. Same class of decision as E52's schedule format; the convention doc is a deliverable of this item.

**Relates:** E32 (logbook = event sibling), E53 (toast = transient sibling), E52 (schedule), E56 (gauge machinery), U18/themes (ISA-101).

### E62 — MQTT broker introspection family (`feezal-element-mqtt-*`) ⚠️ review/refinement needed

*From EMQX research (July 2026): broker operators demonstrably want these views — client lists, per-topic rates, retained-message browsing — but they exist only inside broker admin consoles (EMQX Dashboard, and nowhere at all for Mosquitto). No dashboard tool composes them next to telemetry widgets.* Uniquely fitting feezal's MQTT-native identity, and doubles as built-in debugging tooling while editing.

- **$SYS stat tiles/charts**: connections, subscriptions, message rates in/out, uptime — pure subscription against `$SYS/broker/…` (Mosquitto) / `$SYS/brokers/…` (EMQX); a prefix attribute covers both.
- **Client presence list**: from EMQX's `$SYS/.../clients/#` connect/disconnect events, or LWT-based presence conventions (synergy with N24's viewer presence).
- **Topic-tree browser**: a wildcard subscription rendered as a live collapsible tree with last payload, message rate, and retain flag per node — buildable entirely client-side, and arguably the most useful single element of the set (it's also an editor debugging tool).
- **Retained-message browser**: subscribe a subtree, filter the retain flag; delete = publish empty retained payload (guarded).

**Caveats to document:** `$SYS` is often ACL-restricted to localhost by default (EMQX); broad `#` subscriptions are expensive on busy brokers — every element takes a subtree-scoping attribute rather than defaulting to `#`. Broker-HTTP-API features (kick client, slow subscribers) are explicitly out of scope — pure MQTT only.

**Relates:** N24 (presence), E32 (logbook), editor topic autocomplete (shared topic-tree machinery?).

### E63 — Plant-schematic symbol family (`feezal-element-schematic-*`) 💡 idea

State-driven equipment symbols for plant/heating schematics: **pump, valve, motor, fan, damper, vessel, heat exchanger, sensor flag** — each bound to a topic with states (running/stopped/fault → color/animation, e.g. rotating fan), plus FlowChief's killer piece: an **animated-flow pipe polyline** (material flow along a path, direction/speed bindable). Ignition's design pattern to copy: few symbols × standard states × **switchable appearance themes** (P&ID schematic / mimic skeuomorphic / simple), settable globally per site so one dashboard restyles wholesale.

Home use cases: heat-pump, solar-thermal, ventilation, and pool schematics. Validation: ThingsBoard added exactly this category in 3.7+ (SCADA symbol bundles); Ignition's community begs for more symbols (their library stalled at 5).

**Notes:** largest scope of the research-derived sets — sequence after E51 (SVG element), whose binding machinery it shares; E51 stays the power-user path (import any schematic, bind ids), E63 is the canned library.

**Relates:** E51 (shared binding concepts), E61 (alarm badge on symbols), E56 (gauge styling discipline).

### E64 — Camera image via MQTT (`feezal-element-basic-mqtt-image`) 💡 idea

Displays **image payloads received over MQTT** (binary or base64) — distinct from `material-camera`, which is stream/URL-based. ESP32-cams, doorbells, printer cams, and vision systems publish stills this way. Options: state framing (border color bound to a second topic — e.g. pass/fail, motion), **filmstrip of the last N images** (tap to enlarge; Cognex's no-read-review pattern), freeze-on-condition. Memory-bounded ring buffer; document payload-size caution.

**Relates:** E65 (vision sibling), material-camera (stream sibling), E32 (event context).

### E65 — Pass/fail counter (`feezal-element-basic-passfail`) 💡 idea

Big green/red counter pair over a boolean/enum topic: totals, rate %, current streak, optional reset (button-publish or reset topic). The signature machine-vision/quality widget (Cognex EI), equally at home counting 3D-print outcomes, CI builds, or failed logins.

**Relates:** E64, E30 (sparkline companion), E61 (andon grid).

### E66 — Fleet / heartbeat board (`feezal-element-basic-fleet`) 💡 idea

Grid/list of devices with **online/offline state from LWT or last-seen timeout**, last-seen timestamp, and optional battery/signal columns — the "is everything alive" board every zigbee2mqtt/ESPHome fleet needs. Row sources: a topic-list attribute or a wildcard + template (like E32's event map).

**Relates:** N24 (viewer presence is the same pattern for feezal clients), E32, E61 (andon grid is the status-only sibling).

### E67 — Irrigation zone control (`feezal-element-material-irrigation`) 💡 idea

Per-zone card/list: on/off/auto toggle, valve state, flow, remaining runtime, and a master **rain-delay** switch. Garden irrigation is a top home-automation MQTT use case (and the agriculture research's most transferable widget). Pairs naturally with E52 (schedule editor publishes the plan, this element does live control).

**Relates:** E52, E61 (multi-state Hand/Off/Auto machinery).

### E68 — Astro / sunrise-sunset card (`feezal-element-basic-astro`) 💡 idea

Daylight arc with current sun position, sunrise/sunset/twilight times, moon phase. **Open question:** data via topics (she publishes astro events — keeps feezal dumb) vs. computed client-side from lat/lon (self-contained, works in static exports without a publisher). Leaning topic-driven with optional client-side compute.

**Relates:** E20 (weather), E52 (astro-driven schedules live in the consumer).

### E69 — Carpet plot (`feezal-element-basic-carpet`) 💡 idea

Hour-of-day × day heatmap — the classic energy-consumption visualization (FlowChief's most-loved widget; ideal for smart-meter/PV data). Needs days of history feezal doesn't store → first consumer of the **history-in-payload convention** (see Open Questions): an external aggregator (she, Node-RED) publishes a retained JSON series; the element only renders.

**Relates:** E70, E28/A11 (real history = Grafana), E30 (live-buffer sibling).

### E70 — Sankey diagram (`feezal-element-basic-sankey`) 💡 idea

Generalized N-node energy/material flow diagram (grid→house→consumers, water flows). `material-energy-flow` covers the common fixed home topology; Sankey is the configurable superset. Live mode maps current power values to band widths; historical totals need the **history-in-payload convention** (see Open Questions).

**Relates:** material-energy-flow, E69, E28.

### E71 — Value-driven icon variants (`feezal-element-basic-icon-value`) ✅ implemented

> **Status: ✅ implemented (July 2026)** — icon that switches through a `_0.._100` variant family (the knx-uf blade/shutter/dim/measure families) based on the received value. `min`/`max` scale the payload to 0–100 %, rounded to the nearest tens step; 11 colour properties `--feezal-icon-value-color-0…-100` (default `var(--primary-text-color)`) colour the icon per step. Variant resolution goes through the registry (`feezal.iconSetNames`, new): tolerates the upstream `_00` zero alias and falls back to the nearest available step for partial families (`fts_shutter` has no zero variant). Its icon picker runs in **variant-family mode** (`iconVariants` attr-spec flag): only sets containing complete 11-step families get a chip, tiles show family bases with a mid-step preview, picking writes the base name. The export/viewer tree-shaker expands a used base name to all its `_NN` variants, so runtime-constructed names render outside the editor too. 12 unit tests (scaling, aliasing, nearest-step, colours), 4 picker unit tests, 2 E2E tests (canvas + variant picker) + viewer/export assertions.

**Relates:** N23 (icon sets, `<feezal-icon>`, picker), E49 (a computed value could feed `value`).

### E72 — Plain icon (`feezal-element-basic-icon`) ✅ implemented

> **Status: ✅ implemented (July 2026)** — displays a single icon, nothing else: configured via the icon picker (bare Material or set-prefixed) or driven by the **subscribe payload** (payload = icon name), so a topic can switch the symbol at runtime. One colour property `--feezal-icon-color` (default `var(--primary-text-color)`). **Click-through:** the host has `pointer-events: none`, so it can decorate a button (or anything) without blocking it; the editor re-enables pointer events via the `feezal-editable` class, keeping it selectable/draggable on the canvas. Caveat (icons-spec §4a): payload-driven *set-prefixed* icons render in viewers/exports only if referenced statically somewhere in the site (tree-shaken registrations) — bare Material names always work. 7 unit tests + 2 E2E (viewer click-through onto a real publishing button, payload switch, editor selectability).

**Relates:** N23, E71 (value-driven variant sibling).

### E73 — Text ticker (`feezal-element-basic-ticker`) ✅ implemented

> **Status: ✅ implemented (July 2026)** — horizontally scrolling text line for wall displays (Peakboard-research origin). Content modes: static `text`, single topic (the subscribe payload replaces `text` via `baseAttribute`), and **JSON-array payloads** rendered per-entry through `template` (`{payload}`, `{topic}`, `{json:path}` tokens — the E32 conventions) joined by `separator`. Attributes: `speed` (px/s, so pace is content-length-independent), `direction` (left/right), `pause-on-hover` (string-typed, default on — `"false"` disables). Implementation: the track holds the content twice and animates `transform` 0 → −50 % for a seamless wrap (GPU-friendly); duration = measured run width / speed (ResizeObserver, length-based fallback), set imperatively so it never triggers a render cycle; animation suspends while the tab is hidden or the element is offscreen (`visibilitychange` + `IntersectionObserver` — the E58 wall-tablet perf concern); the editor renders a static track. Default size 400×40. **13 unit tests** (content modes, tokens, flags, editor/viewer, hidden-tab suspension).

**Relates:** E32 (logbook — same feed, persistent form), E53 (notification — same events, transient form), N26 (view playlist, archived)/A18 (signage).

### E74 — QR code (`feezal-element-basic-qrcode`) ✅ implemented

> **Status: ✅ implemented (July 2026)** — QR code from a static `value` or a live subscribe payload (`baseAttribute`, Peakboard-research origin). Canonical uses: scan-to-open the dashboard on a phone, guest WiFi (`WIFI:S:<ssid>;T:WPA;P:<pw>;;`), deep links. Rendered as inline **SVG** (`shape-rendering: crispEdges`, 2-module quiet zone) with two themeable colour descriptors — `--feezal-qrcode-color` (default `var(--primary-text-color)`) and `--feezal-qrcode-background` (default transparent; the inspector help notes dark themes need a light background for scanner contrast). `ecc` L/M/Q/H (default M), optional `label` caption doubling as the SVG `aria-label`. Encoder: **`qrcode-generator`** (MIT, zero-dep) with UTF-8 pre-encoding for non-ASCII content; data-too-long renders an error note instead of crashing and recovers on the next valid payload. Editor renders the real code (placeholder when unconfigured). Default size 160×160. **11 unit tests** (encoding incl. UTF-8/version growth/ECC density, payload re-encode, caption/aria, error + recovery, editor/viewer).

**Relates:** A9 (PWA/mobile — the scan-to-phone pairing), N10 (never encode credentials beyond the deliberate WiFi use).

### E75 — Data table (`feezal-element-basic-table`) 💡 idea

*Peakboard research (July 2026): Table/ListView and Styled Tile Collection are Peakboard's workhorse controls, and **Hub Lists** — central read/write tables shared by every screen — power its team-board/shift-plan/pick-list use cases. feezal has no table element at all; a retained JSON topic can play the Hub-Lists role with zero new infrastructure.*

**MVP (read-only):** `subscribe` receives a **JSON array of objects**; the element renders it as a table. `columns` (JSON attribute, custom inspector per N6: key, label, width, align, format) — when unset, columns auto-derive from the first row's keys. Per-column value formatting (decimals, unit suffix, ISO date → locale string). Click-to-sort headers, optional text-filter box, `max-rows`, sticky header. **Conditional formatting** via the established map convention: `row-class-map` and per-column `class-map` (payload value or numeric threshold → CSS class; colours come from U18 classes/theme vars) — the answer to Peakboard's most-used non-scripting feature.

**Phase 2 (write-back — the MQTT-native Hub-Lists analog):** columns flagged `editable` render as inputs; commits publish the **whole updated array retained** to `publish` (default: the subscribe topic). Optional row add/delete. Every open viewer sees the same table live — team boards, shift plans, pick lists, simple checklists. Documented caveat: **last-writer-wins** on a whole-array retained payload, no merging — fine for the target use cases; anything transactional belongs in a real backend, not a dashboard.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `subscribe` | mqttTopic | — | JSON-array-of-objects payload |
| `publish` | mqttTopic | `""` | Write-back topic (phase 2; defaults to `subscribe`) |
| `columns` | string | `[]` | JSON column config; empty = auto from first row |
| `sortable` | boolean | `true` | Click-to-sort headers |
| `filter` | boolean | `false` | Show text-filter box |
| `max-rows` | number | `0` | Row cap, `0` = unlimited |
| `row-class-map` | string | `{}` | Value/threshold → row CSS class |
| `editable` | boolean | `false` | Enable phase-2 editing (per-column flag in `columns`) |
| `empty-text` | string | `No data` | Placeholder when the array is empty |

> **Conventions:** single state topic · auto-discovery: none · custom inspector for `columns` (N6). See [Element platform conventions](#element-platform-conventions).

**Default size:** 400×300 px.

**Relates:** N2 (repeater — free-form sibling; the table is the dense/tabular case), E32 (event rows from wildcards — different source model), E66 (fleet board is a specialized table), E61 (alarm table shares sorting + severity classes), U18 (classes for conditional formatting).

### E76 — QR code content assistant (typed presets for `basic-qrcode`)

Improve E74 (implemented): today the `value` attribute is a raw string the user must hand-author — fine for URLs, error-prone for everything with a scheme syntax (nobody remembers `WIFI:S:<ssid>;T:WPA;P:<pw>;;` escaping). Add a **content assistant**: a custom inspector (N6) for the `value` attribute with a **type picker** and per-type fields that *generate* the value.

**Preset types and their fields → generated value:**

| Type | Fields | Generated value |
|---|---|---|
| Text / raw *(default)* | value (textarea) | verbatim — today's behaviour |
| Web URL | url | `https://…` (prefixes the scheme when missing) |
| WiFi | ssid, password, security (`WPA`/`WEP`/`nopass`), hidden ☐ | `WIFI:S:<ssid>;T:<sec>;P:<pw>;H:true;;` with proper `\` escaping of `\;,":` |
| E-mail | to, subject?, body? | `mailto:<to>?subject=…&body=…` (URL-encoded) |
| Phone | number | `tel:+…` |
| SMS | number, message? | `SMSTO:<number>:<message>` |
| Geo | lat, lon | `geo:<lat>,<lon>` |
| Contact (vCard) | name, phone?, email?, org?, url? | minimal vCard 3.0 (`BEGIN:VCARD…END:VCARD`) |

**Inspector behaviour:**

- The generated string is written into the plain `value` attribute — **`value` stays the single source of truth**: source-mode edits, MQTT payloads (baseAttribute) and the existing element are untouched; the assistant is pure editor UX, nothing ships in the viewer bundle.
- **Round-trip:** on open, the inspector parses the current value back into type + fields when it matches a known scheme (`WIFI:`, `mailto:`, `tel:`, `SMSTO:`, `geo:`, `BEGIN:VCARD`, URL) — otherwise it opens on *Text / raw* with the string as-is. Unparseable-but-prefixed values fall back to raw rather than destroying anything.
- A read-only preview row shows the generated string so the user learns/verifies the syntax; the canvas QR updates live as fields change (normal attribute flow).
- WiFi password field uses a masked input with reveal toggle; note stays: the value lands in the saved site HTML — same visibility rules as any attribute (see the N10 credential docs).

**Implementation sketch:** `feezal: {inspector: …}` custom-inspector module in the `feezal-element-basic-qrcode` package (editor-only per the established pattern — inspectors may use `<sl-*>` without importing Shoelace); pure generate/parse helper functions (`buildWifi()`, `parseWifi()`, …) unit-testable without DOM. The E2E can reuse the existing qrcode coverage: pick WiFi, fill fields, assert the attribute + rendered module path changed.

**Relates:** E74 (the element, implemented), N6 (custom inspector machinery), N10 (credentials-in-HTML visibility note), material-dialog inspector (the editor-only Shoelace pattern to copy).

## Editor UX

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



### U23 — Custom collapsed placeholder text in the source editor 🚧 blocked by upstream

In the source view, collapsed `<feezal-element-*>` regions all render with the same generic placeholder (the opening tag followed by Monaco's default `⋯`), so folded elements are hard to tell apart at a glance. The goal is to show a meaningful summary in the collapsed line instead — e.g. the element's key attribute (its `subscribe`/`publish` topic, label, or icon) — so a folded view reads like a compact outline.

**Blocked by upstream (Monaco).** The bundled `monaco-editor` exposes no public API for per-region collapsed text: its `FoldingRange` interface has only `start` / `end` / `kind` — there is **no `collapsedText` field** (that field exists in the VS Code / LSP `FoldingRange` but has not been surfaced in the standalone monaco-editor `languages.FoldingRange`). Implementing custom placeholder text today would require patching Monaco internals (the folding controller / hidden-area rendering), which is fragile and high-risk.

**Revisit when:** monaco-editor adds `collapsedText` (or equivalent) to its public `FoldingRange` / folding-range provider API. At that point a custom `registerFoldingRangeProvider` for `html` can return per-element collapsed summaries with low effort.

**Low-risk cosmetic alternatives (not the same feature, available now if desired):** `showFoldingControls: 'always'`, a custom `editor.foldBackground` highlight colour, and `unfoldOnClickAfterEndOfLine: true` improve how collapsed regions *look* and behave, but cannot change the placeholder *text*.

### U30 — Auto-generated starter dashboard from MQTT discovery ❓ questionable 🔽 low priority

A "generate views from discovered devices" wizard: walk the discovery registry (`server/src/mqtt/discovery.js`), group by area/device, and emit one pre-wired device card per component — feezal's equivalent of Home Assistant's auto-generated Areas/Home dashboards (which became HA's default in 2026.2 and are widely credited with fixing HA's blank-canvas onboarding problem), but fully editable afterwards.

**Why questionable:** skepticism that a generated layout would actually be *good* — feezal's value is the hand-crafted free-form canvas, and a mediocre generated result may hurt more than a blank canvas. The AI assistant (with its existing `search_discovery`/`search_topics` tools) may be the better path to the same goal without any dedicated wizard code. Revisit only if onboarding feedback demands it.

### U31 — Device-first element insertion ❓ questionable 🔽 low priority

A second palette tab listing discovered devices; dragging a device onto the canvas creates the matching pre-wired element (inverse of today's flow) — inspired by HA 2026.6's entity-first card picker.

**Why questionable:** the existing workflow — drag an element, then pick the auto-discovered device in the inspector — is considered good enough. Low value for the palette/DnD complexity it adds. Revisit only with concrete user demand.

### U32 — Composed elements: reusable parameterized components

> **Status: ✅ MVP implemented (July 2026)** — `www/src/feezal-component.js` (generic instance element, MIT/viewer-runtime per A21: stamps in `connectedCallback` idempotently, DOM-level `${param}` substitution incl. text nodes and nested inert templates, `MutationObserver` re-stamp filtering out class/style/locked churn, template-bbox sizing); `_clean()` empties instances + drops pseudo-views; deploy `elements` recursion into `template.content`; inspector wiring via `isCanvasElement()` (instances draggable, resize disabled); param inspector from `feezal-params` (typed controls; **boolean params edit as a true/false dropdown** — substitution is textual); palette **Components** category (first in order, right-click menu for edit/rename/delete so lifecycle works with zero instances); "Create component…" dialog with parameterize-as table; "Edit component" pseudo-view + banner with Done/Cancel, auto-commit on deploy/source-mode/tab-switch; detach; rename (template + all instances, one undo step); delete refuses with **[Detach all & delete]** while instances exist. Covered by 12 component unit tests + 6 app-editor unit tests + **8 E2E tests** (stamping, live re-stamp, palette, create via ctx menu + dialog, deploy persists empty instances, edit + Done re-stamps, detach with translated positions).
> Known limitations / follow-ups: undo *while* editing a component exits the edit mode (snapshots are cleaned of pseudo-views on restore); instance size derives from inline px styles only; AI-apply tag validation (`feezal-ai-chat.js`) still rejects `feezal-component` in generated HTML; **latent server quirk found during E2E:** the deploy formatter (prettyhtml in `server/src/socket/hub.js`) does not escape raw `"` inside attribute values — editor-serialized HTML is always entity-escaped so normal deploys are safe, but direct-API deploys with raw quotes produce broken HTML.

Turn a selection of elements into a **named, reusable component with declared parameters** — build once, instantiate many times, edit centrally. This is the single most-requested capability in both neighbouring ecosystems: HA power users beg for "reusable/linked master cards" (only fragile custom cards like decluttering-card/streamline-card deliver it), and vis's grouping-with-exported-attributes is one of its most-used features. Because feezal dashboards are literally HTML with custom elements, a component is *just more HTML* — it rides the existing machinery (source round-trip, git history, export, live preview) instead of fighting it. *(Further validation from the BMS world, July 2026: Niagara integrators name relativized templates — one graphic serving many devices via a relative binding root — as the framework's single most-praised feature; U32's `topic-prefix` parameter is exactly this.)*

**Storage format — a `<template>` in `site.html`:** the definition is a `<template feezal-component="name">` child of `<feezal-site>` (before the views), with `${param}` placeholders in attribute values and a `feezal-params` JSON attribute declaring each parameter's type/default/label. Instances are a single **generic element** `<feezal-component name="...">` carrying the parameter values:

```html
<feezal-site>
  <template feezal-component="room-card"
            feezal-params='{"prefix": {"type": "mqttTopic"},
                            "label":  {"type": "string", "default": "Room"}}'>
    <feezal-element-material-light subscribe="${prefix}/light/state" publish="${prefix}/light/set"
        style="left:0; top:0; width:180px; height:56px"></feezal-element-material-light>
    <feezal-element-basic-number subscribe="${prefix}/climate/temperature" label="${label}"
        style="left:0; top:64px; width:180px; height:40px"></feezal-element-basic-number>
  </template>

  <feezal-view name="home">
    <feezal-component name="room-card" prefix="home/livingroom" label="Living room"
        style="left:20px; top:20px"></feezal-component>
  </feezal-view>
</feezal-site>
```

**Decided (not open):**
- **Generic `<feezal-component name="…">`**, *not* a dynamically registered tag per component. Dynamic `customElements.define()` would mean registration-order timing, collisions with real element packages, and no way to un-define on rename/delete (the registry is append-only). The generic element looks up its template by `name` and stamps it.
- **Light-DOM stamping.** The instance stamps the substituted template content into its light DOM — children are ordinary feezal elements that subscribe to MQTT themselves, so live data in editor and viewer works with zero extra code, and user CSS classes (U18) and theme variables apply normally.
- **DOM-level substitution, never string-replace on serialized HTML.** Walk the stamped fragment and replace `${param}` inside attribute values and text nodes — values are inert by construction (no markup-injection via param values). This also makes **style params free**: `style` and CSS custom properties are just attributes, so an accent-colour parameter works from day one.
- **`${param}` placeholder syntax** — bare `{...}` collides with the JSON many element attributes already carry (state-maps, event lists). This becomes the house templating syntax; N2b (repeater) should adopt the same.
- **Declared, typed parameters.** `feezal-params` metadata drives the inspector with the existing typed controls (`mqttTopic` params get topic autocomplete, colour params the colour picker, …).
- **Strict no-override.** An instance can set *only* declared params — no per-instance tweaking of arbitrary sub-element attributes. "Edit the definition, all instances follow" is therefore always true; divergence has exactly one spelling: **Detach**.
- **Fixed-size instances (MVP).** An instance's size is the template's bounding box; resize handles are suppressed (same mechanism as `locked` elements). Uniform `transform: scale()` resizing is the likely future enhancement — revisit together with E38; no free-resize (children would just clip).

**Editing workflow:**
- **Create:** multi-select (or a U3 group) → context menu → **"Create component…"** → dialog: component name + a table of all sub-element attributes with a "parameterize as…" column (current concrete value becomes the param default). The selected elements are replaced on canvas by an instance whose params equal the old values — visually nothing changes.
- **Insert:** palette gets a **Components** category listing the site's components; drag to canvas like any element.
- **Edit definition:** context menu on any instance → **"Edit component"** → the template opens on the canvas as a pseudo-view (all normal editing tools work). On save, every instance re-stamps — instances stamp from the live template node, so this is cheap and instant.
- **Detach:** replaces a `<feezal-component>` with its substituted, expanded markup (the "ungroup" analog) when one instance needs to diverge.

**Runtime/viewer:** the generic `feezal-component` element ships in the viewer bundle; stamping + substitution happens in `connectedCallback`, re-stamp on attribute change. No special live-data handling needed (children are normal elements).

**Implementation gotcha:** export tree-shaking (`extract-elements.js`) scans site HTML for used element tags — it must also scan **inside `<template>` content**, which is inert and invisible to a naive `querySelectorAll` on the document (use `template.content`).

**Scope & sharing:**
- **MVP: per-site only** — definitions in `site.html` get git versioning, Monaco source editing, and static export for free.
- **Global library later**, mirroring the asset manager: `<dataDir>/global/components/`, inserting **copies into the site** (same copy-on-use pattern as global assets — sites stay self-contained, exports hermetic).
- **npm sharing later** (A20): a component being one self-contained `<template>` block makes a `feezal-component-*` package trivially a single file.

**Deferred:** nesting components in components; conditional/computed params (explicitly out of scope — that is E49's job: a param can simply be a topic that a script element publishes page-locally).

**Refinement pass (July 2026) — the five former gaps, resolved against the actual editor internals. Implementation-ready.**

1. **Serialization stripping — one choke point.** All three serialization paths (deploy, Monaco source mode, clipboard) already funnel through the single `_clean()` in `feezal-app-editor.js`; add one step there: empty every `<feezal-component>`'s light DOM before serializing. Instances persist as empty tags; `connectedCallback` re-stamps, so paste, undo (`restoreViews`), and source round-trip all repopulate for free. **Corrected gotcha:** the old warning about `extract-elements.js` was wrong — the server scanner is *regex on the raw HTML string* and already matches tags inside `<template>` markup; no change needed there. The genuinely affected path is the **client-side deploy `elements` enumeration** (`feezal-app-editor.js` `_deploy()`), which walks the cleaned DOM clone with `querySelectorAll` and cannot see into inert `template.content` — it must recurse into every `template[feezal-component].content` explicitly, or exported/deployed sites lose the packages used only inside components.
2. **Interaction suppression — mostly solved by construction.** The inspector wires only *direct view children* with tag prefix `feezal-element-` (`feezal-sidebar-inspector.js` `_viewChanged()`); stamped children are nested inside the instance, so they are never enumerated, never get `.feezal-editable`, never join DragSelect. Remaining work: (a) extend the enumeration filter to also wire the `feezal-component` tag itself; (b) give instances the standard `initElem()` glass overlay so clicks on stamped children select the instance; (c) the `locked` pattern (`initElem`/`setLocked`) is the reference for any residual suppression. U3 is *not* required (and remains unimplemented) — multi-select is the creation gesture.
3. **"Edit component" — decided: pseudo-view tab + banner.** "Edit component" creates a temporary `<feezal-view feezal-component-edit="<name>">` populated with a clone of `template.content` (raw `${param}` placeholders visible; placeholder-literal MQTT subscriptions are harmless — nothing publishes to `${prefix}/light/state`), adds it to `feezal.app.views`/the tab bar with distinct tab styling, and shows a banner with **Done**/**Cancel**. Done: write the children back into the `<template>`, remove the pseudo-view, re-stamp all instances — **once, on commit** (decided; no live re-stamp while editing), single `change()`. Deploy and source-mode entry **auto-commit an open component edit first** (the exact pattern `_deploy()` already uses for source mode). Belt-and-braces: `_clean()` also drops any `[feezal-component-edit]` view so a pseudo-view can never leak into persistence.
4. **Lifecycle — decided.** *Delete with live instances:* refuse, with a dialog naming the instance count and views, offering **[Detach all & delete] [Cancel]** — no silent breakage, no dangling instances in saved sites. *Rename:* rewrites the template's `feezal-component` attr and every instance's `name` in one operation (one undo step). *Names:* kebab-case `[a-z][a-z0-9-]*`, unique per site, validated in the create/rename dialogs; component names live in their own namespace (no `feezal-element-` prefix), so collisions with element tags are impossible.
5. **Undo atomicity — free by construction.** Undo is whole-site `innerHTML` snapshots (`addHistory()`), and `<template>` definitions live inside `<feezal-site>`, so template + canvas mutations land in the *same* snapshot. Create / Detach / Edit-commit / Rename / Delete each call `change()` exactly once, at the end.

**Additional implementation notes:**
- **New file `www/src/feezal-component.js`** — the generic instance element: stamps in `connectedCallback`; re-stamps via a `MutationObserver` on its own attributes (a generic element cannot declare `static observedAttributes` for unknown param names). It ships in the viewer bundle → it is part of the **MIT viewer runtime (A21)**: give it the `SPDX-License-Identifier: MIT` header and import it from `viewer-main.js`.
- **Palette:** add `'Components'` to the fixed category `ORDER` (first — site-specific components are the user's own vocabulary); the category is rebuilt from `feezal.site.querySelectorAll('template[feezal-component]')` on site change, since `_rebuildCategories()` currently derives only from `feezal.elements`. Drag-drop inserts an instance with the declared defaults.
- **Inspector on an instance:** `feezal-params` metadata drives the existing typed controls (`mqttTopic` → topic autocomplete, colour → picker, …); stamped children's attributes/styles are not editable (strict no-override — divergence is spelled **Detach**).
- **Copy/paste of instances** works by construction: the clipboard path runs `_clean()` (empty tag), paste re-stamps on connect.

**Sequencing (updated):** U3 remains unimplemented and is **not** a prerequisite — gap 2 turned out to need almost none of U3's machinery. U32 can start directly; multi-select is the creation gesture. If U3 lands first it upgrades the gesture to "group → create component", nothing more.

**Relates:** U3 (grouping is the natural creation gesture), N2b (repeater should repeat a component — shared `${...}` templating), E38 (scaling), E49 (computed values), A20 (distribution channel), E48 (dialog-view shows view-reuse demand).

### U33 — Element stacking order via context menu

> **Status: ✅ implemented (July 2026)** — context-menu group (Bring to front / Bring forward / Send backward / Send to back) with smart enable/disable, keyboard shortcuts `Ctrl+]`/`[` and `Ctrl+Shift+]`/`[` (shifted-key spellings `}`/`{` handled), multi-selection moves as a block preserving relative order (forward/backward step across exactly one non-selected editable sibling), one undo step per reorder, locked elements may be restacked. Pure helpers (`stackingSiblings`/`stackingState`/`reorderElements`) exported and unit-tested (16 tests); 7 E2E tests drive menu, keyboard, disabled states, multi-select, undo and deploy.
> **Bug found & fixed along the way:** DragSelect writes cumulative inline `z-index` junk on every selection (+1/−1 per add/remove, 9999 during drags, never balanced) — it polluted saved sites and painted over DOM order, silently defeating the whole premise of this item. Resolution: canvas stacking is DOM order, *period* — an injected editor rule (`feezal-view > .feezal-editable { z-index: auto !important }`) neutralizes inline z-index live, and `_clean()` strips it from every serialized save (also self-healing sites polluted in the past). **Supersedes the "hand-set z-index" caveat below:** z-index on canvas elements is editor-managed and does not survive a save — the stacking-order actions are the sanctioned mechanism.

Right-click an element (or a multi-selection) → **Bring to front** / **Send to back** (and, optionally, **Bring forward** / **Send backward**) to control which element paints on top when elements overlap. Crucially this reorders the elements in the **HTML**, not via `z-index` — the DOM sibling order is the source of truth, so the change is legible in the source editor and diffs cleanly in git history.

#### Why DOM order (not `z-index`)

feezal dashboard elements are absolutely-positioned **light-DOM children of `<feezal-view>`** (slotted through the view; positioned by `child-position: absolute` + inline `left`/`top`). For siblings sharing the same effective `z-index`, **paint order follows DOM order** — a later sibling paints on top. Because `z-index` is a reserved/hidden property (it's filtered out of the inspector — see N1), elements normally carry no explicit `z-index`, so **DOM order already fully determines stacking**. Reordering children is therefore the natural, `z-index`-free way to change stacking, and it matches exactly what the user asked for.

**Persistence is free.** Reordering is just moving a child node within its parent view. The editor already serializes the view's light DOM to `views.html` on `feezal.app.change()`, so the new order persists with **no new data model** and shows up as a plain reordering in the source view and git diff. This mirrors the existing `_ctxCopyToView()` / `_duplicateElems()` paths, which already do `feezal.view.append(clone)` + `feezal.app.change()`.

#### Where it plugs in

All in **`www/src/feezal-sidebar-inspector.js`** (the element context menu), alongside the existing Cut/Copy/Duplicate/Delete/Lock items:

1. **Menu items** — in `render()`'s `cm.onElem` block, add a separated group. Enable/disable smartly: "Bring to front" / "Bring forward" disabled when the selection is already frontmost; "Send to back" / "Send backward" disabled when already backmost.
2. **Actions** — new `_ctxAction()` cases operating on the parent view's **editable siblings** (`.feezal-editable`), so system nodes are never disturbed:
   - **Bring to front** → `view.append(el)` (move to end).
   - **Send to back** → `view.prepend(el)` (move to start).
   - **Bring forward / Send backward** → swap with the next / previous `.feezal-editable` sibling (`el.nextElementSibling`-style, skipping non-editable nodes).
   - Then `feezal.app.change()` (one undo step via the existing history machinery) and refresh the selection.
3. **Optional keyboard shortcuts** — `Ctrl+Shift+]` / `Ctrl+Shift+[` (front/back) and `Ctrl+]` / `Ctrl+[` (forward/backward) in `_keyHandler`, with matching rows in the shortcuts (`?`) modal.

#### Details & decisions

- **Multi-selection:** move all selected elements as a block, **preserving their relative order** — sort `selectedElems` by current DOM index before appending/prepending so their internal stacking is retained.
- **Skip non-element siblings.** A view can contain non-`feezal-element` nodes (e.g. the `<style id="feezal-classes">` block from U25, or component pseudo-view artefacts). Operate relative to `.feezal-editable` siblings; moving before/after a `<style>` node is harmless (it doesn't paint) but the "forward/backward" step must count only editable elements.
- **Locked elements:** reordering changes neither position nor size, so it should be allowed even on `locked` elements (unlike drag/resize). *(Confirm this is the desired behaviour.)*
- **Explicit `z-index` caveat:** if a user has hand-set a `z-index` on an element via the source editor, DOM reordering won't visibly restack it (an explicit `z-index` wins over paint order). This is an edge case since `z-index` is hidden from the inspector; document it rather than trying to rewrite `z-index` values.
- **Grouping (U3):** once groups land, front/back should act on the whole group as a unit; not a prerequisite here.
- **`feezal-component` instances (U32):** an instance is a single node, so it reorders like any element — no special handling.

**Effort:** small — a few context-menu items plus 3–4 DOM helpers, reusing the existing `change()`/history and `.feezal-editable` conventions.

## Architecture & Infrastructure

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

### A13 — Update / restart feezal from the UI

> **Status: ✅ implemented** — shared `server/src/docker.js`: capability detection (`selfUpdate` = `FEEZAL_DOCKER_SELFUPDATE=1` + reachable engine + feezal itself in a container; `restart` additionally via `FEEZAL_ALLOW_RESTART=1` for supervised bare-metal), `restartSelf()` (Engine API restart on the own container, identified by `FEEZAL_CONTAINER_NAME` or hostname) and `updateSelf()` (one-shot `containrrr/watchtower:1.7.1 --run-once --cleanup <name>` sibling). Routes: `POST /api/server/restart` (202, then restart or `process.exit(0)` for the process-manager path) and `POST /api/server/update` (202 + log). UI: capability-gated "Server" section in Editor Settings with Restart/Update buttons (confirm dialogs, poll-until-back + auto-reload). Admin-only gating still waits for N10/A3. Mocked-client tests cover capability gating, the watchtower container spec and the 403/202 route behavior; live restart/update against a real containerized feezal is a manual TESTING.md item.

Allow an admin user to trigger a feezal server update or restart from within the editor, without SSH access to the host.

#### Decided approach

**Docker deployments (the current distribution):** reuse the shared **`server/src/docker.js`** module built for A9 Tier 2b (dockerode over the mounted socket).

- **Restart** (keep current image): Engine API restart on feezal's own container — it identifies itself via the container id in `/proc/self/cgroup` / hostname.
- **Update** (pull new image + recreate): a container cannot `docker rm` *itself* and survive — instead feezal launches a **one-shot watchtower sibling** (`containrrr/watchtower --run-once <feezal-container>`): watchtower pulls the new image, recreates the feezal container with identical config, and exits. This merges the old "socket" and "sidecar" options — no permanently running sidecar, no shared secret, and the socket that Tier 2b already mounts is the only privilege needed.
- **Opt-in, separately from builds**: `FEEZAL_DOCKER_SELFUPDATE=1` — a user may want server-side APK builds but not a self-updating dashboard (or vice versa). Both flags require the mounted socket; both surface through `GET /api/server/capabilities`.
- **UI**: update/restart as distinct actions in Editor Settings, with the same SSE job/progress pattern as the Tier 2b build (pull progress + watchtower log streamed live). Admin-only once N10/A3 lands; until then gated like other editor-wide actions.

**Bare metal (future):** the process-manager path — feezal's endpoint calls `process.exit(0)` and relies on a restart-configured supervisor (systemd `Restart=always`, pm2, s6). *Restart only*; self-*update* on bare metal stays out of scope (package/git management on arbitrary hosts is not feezal's business — documented, with the Docker path as the recommended setup for one-click updates).

**Rejected:** permanent sidecar (extra moving part + secret channel for no gain over the one-shot sibling), external webhook (not self-contained; users who want Portainer/CI hooks can already point them at feezal's container without feezal's involvement).

### A18 — Kiosk / wall-panel mode

Make wall-mounted tablets/panels a first-class, documented feezal use case. Research (July 2026) shows this is a chronically underserved niche: Home Assistant still has no native kiosk mode (years-open feature request), and the de-facto stack is Fully Kiosk Browser (paid license for full features) plus the HACS `kiosk-mode` hack that breaks on frontend refactors. Feezal already has most of the ingredients — static export, APK build, PIN overlay (E44), and MQTT site-control topics (`/view`, `/theme`, `/addclass`) for remote-controlling every connected panel.

**Missing pieces (each small):**
- **Screensaver / auto-dim element** (`feezal-element-system-screensaver`): dim or blank after `idle-seconds`, wake on touch; optional wake on an MQTT motion topic (`wake-topic`) — replaces Fully Kiosk's paid motion-wake feature for panels with an external motion sensor.
- **Capacitor template flags:** keep-awake, immersive/fullscreen (hide Android status/nav bars), launch-on-boot — plumbed through the existing A9 export options.
- **Day/night theme switching:** already possible externally via the `/theme` control topic (document the pattern); optionally a simple time-based schedule in `site.json`.
- **Docs + positioning:** a "Wall panel" guide (export → APK → kiosk flags → control topics) and a README bullet — this is the clearest competitive wedge vs. HA and deserves explicit marketing.

### A19 — Security model: multi-user / ACL story ⚠️ needs discussion

Both neighbouring ecosystems have per-user stories (HA: per-user views/dashboards; vis-2: project/view/widget read-write ACLs). Feezal has a single shared editor password and cosmetic PIN — the model needs to be defined deliberately rather than grown ad hoc.

**Working direction — lean on the broker, not a homegrown user system:** MQTT brokers already solve authn/authz. Mosquitto ACLs (static or dynsec) enforce per-user topic read/write at the **data plane** — a viewer whose MQTT credentials can't read `home/alarm/#` simply never receives that data, which is categorically stronger than any client-side view-hiding (cf. HA's known weakness: hidden views remain URL-accessible). Feezal would then need only: per-user *credential entry* in the viewer (the N10 runtime credential prompt doubles as the login), and guidance/tooling for the broker-side ACL setup.

**To discuss and refine:**
- How viewer identity maps to MQTT credentials (N10 runtime prompt per user? reverse-proxy auth → credential lookup?).
- Editor roles: admin-only gating for restart/update/package-install (blocks A13's remaining work, formerly "A3").
- Client-side conveniences layered on top (per-user default view, hiding UI the user can't use anyway) — explicitly *convenience*, not security.
- Document the threat model plainly: what the PIN element is (cosmetic), what proxy auth covers, what only broker ACLs can guarantee.

**Relates:** N10 (credential security), A13 (admin gating), E44 (PIN).

### A20 — Element/theme scaffolding and community ecosystem tooling

Feezal's "widgets are plain npm packages" model is better infrastructure than vis-2's adapter-bound React widgets or HA's HACS-distributed frontend hacks — but it only compounds if third parties can actually build on it. vis-2 ships an official widget template + dev harness; HA's ecosystem thrives on documentation and HACS distribution. Feezal currently offers `docs/element-spec.md` and nothing else.

**Scope:**
- **Scaffolding CLI:** ✅ *(done, July 2026 — N23)* all three CLIs exist as a consistent family (`packages/create-feezal-{element,theme,icons}`), emit registry-searchable keywords and the `feezal` manifest field, and are covered by `server/test/scaffolds.test.js`. Possible later extension: interactive attribute prompts and generated tests for elements.
- **GitHub template repositories:** `feezal/feezal-element-template`, `feezal-theme-template` — the "Use this template" path for people who start from GitHub rather than npm.
- **Dev harness:** run a local element package against a running feezal instance with hot reload (today the feedback loop is build → install → reload).
- **Discovery/distribution:** the N4 package manager already installs from npm — establish the `feezal-element` npm keyword convention and add a "community elements" browse/search view fed by the npm registry; later, a curated gallery page. *(Validation, July 2026: Ignition Exchange — the free community marketplace for views/templates/symbols — is widely credited as what keeps that ecosystem alive; the gallery is the end-state to aim for.)*
- Element author documentation beyond the spec: a written walkthrough building one real element end-to-end.

**Relates:** N23 (icon/theme packaging), U32 (components could later be shared through the same channel).

---

## Open Questions

**Package Manager (N4 and N23 shipped — both archived)**
- ~~Icon-set contract: is a `feezal-icons-*` package a webfont + name list, registered SVG symbols, or both?~~ **Settled (N23):** both modes — `{font, names}` for ligature webfonts, `render(name)` for SVG — see `docs/icons-spec.md` §3.

**History-in-payload convention (E69, E70, comparison/ad-hoc trends)**
Several analytics elements need historical data feezal deliberately doesn't store (real history = E28/A11 Grafana). Middle ground to decide: a documented convention where an **external aggregator (she, Node-RED) publishes a retained JSON series to a topic and the element only renders it** — settle the series JSON shape once (timestamps + values, units, buckets?) and reuse it across carpet plot, Sankey totals, comparison charts, and possibly E30's future first-load backfill. Keeps feezal storage-free while unlocking the whole analytics category.

**Layout & responsive design**
See the design exploration earlier in this file — the view-in-view nesting concept is the likely foundation. Full responsive layout support is a longer-term goal; no decisions needed yet.

---
