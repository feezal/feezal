# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Table of Contents

**Bugs**
- [B8 — Elements cannot be dragged to the far edge of an oversized view](#b8--elements-cannot-be-dragged-to-the-far-edge-of-an-oversized-view-questionable) ❓
- [B29 — device-climate: circle-slider geometry differs from device-light](#b29--device-climate-circle-slider-geometry-differs-from-device-light)
- [B30 — View names with umlauts (e.g. "Küche") cannot be opened](#b30--view-names-with-umlauts-eg-küche-cannot-be-opened)
- [B31 — basic-template: template content lost on copy/cut/paste and duplicate](#b31--basic-template-template-content-lost-on-copycutpaste-and-duplicate)
- [B32 — Snapping helper lines sometimes don't disappear](#b32--snapping-helper-lines-sometimes-dont-disappear-needs-investigation) ❓
- [B33 — Elements sometimes not selectable/draggable](#b33--elements-sometimes-not-selectabledraggable-needs-investigation) ❓
- [B34 — Stray orange dot left over from rubber-band selection during element drag](#b34--stray-orange-dot-left-over-from-rubber-band-selection-during-element-drag)
- [B35 — Rubber-band select sometimes selects nothing](#b35--rubber-band-select-sometimes-selects-nothing-needs-investigation) ❓
- [B36 — Snapping sometimes stops working until page reload](#b36--snapping-sometimes-stops-working-until-page-reload-needs-investigation) ❓

**Near-term Improvements**
- [N2b — Repeater with live canvas sub-elements](#n2b--repeater-with-live-canvas-sub-elements-future) *(future)*
- [N12 — Export bundle: strip mqtt.js for feezal-bridge users](#n12--export-bundle-strip-mqttjs-for-feezal-bridge-users-partial) *(partial)*
- [N13 — Lighter MQTT client for export bundle](#n13--lighter-mqtt-client-for-export-bundle-️-tbd) ⚠️
- [N30 — layout-app breaks the site active-view MQTT contract](#n30--layout-app-breaks-the-site-active-view-mqtt-contract-️-refinement-needed) ⚠️ *(refinement needed)*
- [N31 — Discovery: consume availability — multi-topic support in the FeezalElement base class](#n31--discovery-consume-availability--multi-topic-support-in-the-feezalelement-base-class)

**Element Ecosystem**
- [E7 — Swipe gesture element](#e7--swipe-gesture-element)
- [E20 — Weather forecast (`feezal-element-material-weather`)](#e20--weather-forecast-element-feezal-element-material-weather)
- [E28 — Grafana integration](#e28--grafana-integration)
- [E29 — Tile / compact state element (`feezal-element-material-tile`)](#e29--tile--compact-state-element-feezal-element-material-tile)
- [E30 — Mini live sparkline (`feezal-element-basic-sparkline`)](#e30--mini-live-sparkline-feezal-element-basic-sparkline)
- [E32 — Logbook / event list (`feezal-element-basic-logbook`)](#e32--logbook--event-list-feezal-element-basic-logbook)
- [E34 — Countdown / timer element (`feezal-element-basic-countdown`)](#e34--countdown--timer-element-feezal-element-basic-countdown)
- [E38 — Element scaling / responsive sizing](#e38--element-scaling--responsive-sizing-️-tbd--needs-element-audit) ⚠️
- [E39 — Splash / FOUC-prevention element (`feezal-element-system-splash`)](#e39--splash--fouc-prevention-element-feezal-element-system-splash)
- [E54 — Markdown element (`feezal-element-basic-markdown`)](#e54--markdown-element-feezal-element-basic-markdown)
- [E57 — E-ink / mono element family (`feezal-element-eink-*`)](#e57--e-ink--mono-element-family-feezal-element-eink-) 💡
- [E61 — HMI / alarm element family (`feezal-element-hmi-*`)](#e61--hmi--alarm-element-family-feezal-element-hmi--️-reviewrefinement-needed) ⚠️
- [E62 — MQTT broker introspection family (`feezal-element-mqtt-*`)](#e62--mqtt-broker-introspection-family-feezal-element-mqtt-)
- [E63 — Plant-schematic symbol family (`feezal-element-schematic-*`)](#e63--plant-schematic-symbol-family-feezal-element-schematic-) 💡
- [E64 — Camera image via MQTT (`feezal-element-basic-mqtt-image`)](#e64--camera-image-via-mqtt-feezal-element-basic-mqtt-image) 💡
- [E65 — Pass/fail counter (`feezal-element-basic-passfail`)](#e65--passfail-counter-feezal-element-basic-passfail) 💡
- [E66 — Fleet / heartbeat board (`feezal-element-basic-fleet`)](#e66--fleet--heartbeat-board-feezal-element-basic-fleet) 💡
- [E67 — Irrigation zone control (`feezal-element-material-irrigation`)](#e67--irrigation-zone-control-feezal-element-material-irrigation) 💡
- [E68 — Astro / sunrise-sunset card (`feezal-element-basic-astro`)](#e68--astro--sunrise-sunset-card-feezal-element-basic-astro) 💡
- [E69 — Carpet plot (`feezal-element-basic-carpet`)](#e69--carpet-plot-feezal-element-basic-carpet) 💡
- [E70 — Sankey diagram (`feezal-element-basic-sankey`)](#e70--sankey-diagram-feezal-element-basic-sankey) 💡
- [E80 — Navigation rail element (`feezal-element-material-navrail`)](#e80--navigation-rail-element-feezal-element-material-navrail)
- [E83 — Spectrum element family (`feezal-element-spectrum-*`)](#e83--spectrum-element-family-feezal-element-spectrum-) 💡
- [E85 — Backlog: additional component-library design systems](#e85--backlog-additional-component-library-design-systems) 💡
- [E88 — JSON tree viewer (`feezal-element-basic-json`)](#e88--json-tree-viewer-feezal-element-basic-json) 💡
- [E89 — Lottie animation element (`feezal-element-basic-lottie`)](#e89--lottie-animation-element-feezal-element-basic-lottie) 💡
- [E90 — Vaadin element family (`feezal-element-vaadin-*`)](#e90--vaadin-element-family-feezal-element-vaadin-) 💡
- [E91 — Theme switcher element (`feezal-element-system-theme-switch`)](#e91--theme-switcher-element-feezal-element-system-theme-switch) 💡
- [E92 — PDF viewer element (`feezal-element-basic-pdf`)](#e92--pdf-viewer-element-feezal-element-basic-pdf) 💡
- [E93 — Range slider: min/max band (`feezal-element-material-range`)](#e93--range-slider-minmax-band-feezal-element-material-range) 💡
- [E94 — 3D model viewer (`feezal-element-basic-model`)](#e94--3d-model-viewer-feezal-element-basic-model) 💡
- [E95 — Configurable keyboard shortcuts for interactive elements](#e95--configurable-keyboard-shortcuts-for-interactive-elements)
- [E96 — MIDI input as an element trigger (Web MIDI)](#e96--midi-input-as-an-element-trigger-web-midi-️-questionable-future) ❓
- [E99 — glass-light: configurable on/off state labels](#e99--glass-light-configurable-onoff-state-labels)
- [E100 — Fan element (`feezal-element-glass-fan`)](#e100--fan-element-feezal-element-glass-fan)
- [E101 — Dialog element family (`feezal-element-glass-dialog*`)](#e101--dialog-element-family-feezal-element-glass-dialog)
- [E102 — Climate elements: boost mode, thermostat mode datapoint conventions, valve position](#e102--climate-elements-boost-mode-thermostat-mode-datapoint-conventions-valve-position-️-refinement-needed) ⚠️
- [E103 — WLED elements (Device / Glass / Metro)](#e103--wled-elements-device--glass--metro)
- [E104 — Metro cover/shutter element (`feezal-element-metro-cover`)](#e104--metro-covershutter-element-feezal-element-metro-cover)

**Editor UX**

- [U3 — Element grouping and locking](#u3--element-grouping-and-locking-partial) *(grouping not yet done)*
- [U23 — Custom collapsed placeholder text in the source editor](#u23--custom-collapsed-placeholder-text-in-the-source-editor-blocked-by-upstream) 🚧
- [U30 — Auto-generated starter dashboard from MQTT discovery](#u30--auto-generated-starter-dashboard-from-mqtt-discovery-questionable-low-priority) ❓ 🔽
- [U31 — Device-first element insertion](#u31--device-first-element-insertion-questionable-low-priority) ❓ 🔽
- [U37 — Welcome wizard / first-run onboarding tour](#u37--welcome-wizard--first-run-onboarding-tour)
- [U38 — Topic browser sidebar panel](#u38--topic-browser-sidebar-panel)
- [U39 — Attribute inspector UX for attribute-heavy elements](#u39--attribute-inspector-ux-for-attribute-heavy-elements-️-needs-discussion) ⚠️
- [U40 — Drag-and-drop reordering for `position:static` views](#u40--drag-and-drop-reordering-for-positionstatic-views) 🔽 partial

**Architecture & Infrastructure**
- [A7 — Git versioning for data directory](#a7--git-versioning-for-data-directory-in-progress) 🔨 *(in progress — bookmarks + push remaining)*
- [A11 — Grafana panel plugin](#a11--grafana-panel-plugin-feezal-feezal-panel)
- [A12 — Export deployment targets](#a12--export-deployment-targets-low-priority) 🔽
- [A18 — Kiosk / wall-panel mode](#a18--kiosk--wall-panel-mode)
- [A19 — Security model: multi-user / ACL story](#a19--security-model-multi-user--acl-story-needs-discussion) ⚠️
- [A20 — Element/theme scaffolding and community ecosystem tooling](#a20--elementtheme-scaffolding-and-community-ecosystem-tooling)
- [A21 — Accessibility: adopt the web-components Gold Standard for feezal elements](#a21--accessibility-adopt-the-web-components-gold-standard-for-feezal-elements)


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

**Related issue — snapping helper lines misplaced when an oversized view is scrolled:** if the view canvas is wider/taller than the viewport and `#container-view` is scrolled (e.g. scrolled right), the element-snap helper lines (`#vsnap1`/`#vsnap2`/`#hsnap1`/`#hsnap2`) render at the wrong position — offset by roughly the scroll amount. Likely the same class of bug as the drag-restrict issue above: `_snap()` in [feezal-sidebar-inspector.js](www/src/feezal-sidebar-inspector.js) computes target positions (`tx`, `tr`, `ty`, `tb`) relative to `view.getBoundingClientRect()` / `cvRect` (viewport-clipped, scroll-dependent coordinates), then writes them directly as the `left`/`top` CSS of snap-line elements positioned inside `#container-view`. If those snap lines don't scroll together with the canvas content (i.e. they're pinned to the visible viewport rather than the scrolled canvas), the coordinate systems mismatch by the scroll offset. Needs the same fix approach as B8: either make the snap lines scroll with the canvas content, or convert the computed positions into `#container-view`-relative (viewport) coordinates that account for its current `scrollLeft`/`scrollTop` before assigning them as CSS `left`/`top`.

### B29 — device-climate: circle-slider geometry differs from device-light

`device-climate` and `device-light` placed side by side with identical width/height should have **perfectly aligned circle-sliders** — same centre, radius, track and knob geometry. Currently the `device-climate` slider track is narrower than `device-light`'s.

Fix in the device element family (own repo): unify the circle-slider geometry (ideally share the drawing code/constants between the two elements), and make **track width and knob diameter configurable** on *both* elements via CSS custom properties exposed in the Style inspector.

### B30 — View names with umlauts (e.g. "Küche") cannot be opened

A view whose name contains a German umlaut (e.g. `Küche`) cannot be opened — navigating to it immediately falls back to the default view.

**Likely root cause:** browsers percent-encode non-ASCII characters in `location.hash` (`#/Küche` → `#/K%C3%BCche`). [feezal-site.js:101](www/src/feezal-site.js#L101) reads the hash without `decodeURIComponent`, so the view lookup runs against `K%C3%BCche`, finds no match, and falls back. The hash-sync comparison in `_viewChanged` ([feezal-site.js:314](www/src/feezal-site.js#L314), `location.hash !== expectedHash`) also never matches for encoded names, so it may re-write the hash on every switch.

**Fix:** `decodeURIComponent` when reading the hash, and encode (or decode-then-compare) consistently when syncing it. Audit *all* hash consumers — `feezal-app-editor` derives its `nav.view` from the hash the same way — plus anywhere view names travel through URLs (viewer deep links, history preview, playlist, N24 view commands).

### B31 — basic-template: template content lost on copy/cut/paste and duplicate

Copying, cutting+pasting, or duplicating a `basic-template` element loses the template content — the pasted element arrives empty.

**Likely mechanism:** the template is stored as a **light-DOM `<template>` child**, not an attribute ([feezal-element-basic-template.js](www/packages/@feezal/feezal-element-basic-template/feezal-element-basic-template.js)) — the clipboard/duplicate path in `feezal-app-editor.js` apparently doesn't preserve the element's light-DOM children (or serialises the element after its rendered output has replaced/obscured the `<template>` child). Fix so that clipboard and duplicate serialisation carries light-DOM children through intact; check the same path for other elements storing content in children. Add a regression test.

### B32 — Snapping helper lines sometimes don't disappear ❓ needs investigation

The snapping helper/alignment lines shown while dragging sometimes remain visible after they should have disappeared (drag ended / snap no longer active). No reliable repro yet — **further investigation/refinement needed**. Likely a missed cleanup path in the drag lifecycle in [feezal-sidebar-inspector.js](www/src/feezal-sidebar-inspector.js) (e.g. drag cancelled via Escape, pointer released outside the canvas, or interact.js end event not firing).

### B33 — Elements sometimes not selectable and/or draggable ❓ needs investigation

Sporadically, elements on the canvas cannot be selected and/or dragged. No reliable repro yet — **further investigation/refinement needed**. Candidate directions: interact.js handlers not (re)attached after view switch / paste / undo / element creation; a stale overlay (group box, helper line, DragSelect surface) with a higher z-index swallowing pointer events; the `locked` code path suppressing interaction more broadly than intended. First step: when it occurs, inspect which element receives the pointer events (`document.elementFromPoint`) and whether the interact.js instance is still bound.

### B34 — Stray orange dot left over from rubber-band selection during element drag

A tiny orange dot occasionally appears at the point of the initial click when dragging an element around the canvas (not a rubber-band drag) — looks like a leftover from the rubber-band selection rectangle.

**Likely root cause:** the DragSelect selector element ([feezal-sidebar-inspector.js:787-790](../www/src/feezal-sidebar-inspector.js#L787-L790)) is styled `border:1px dotted rgba(250,120,0,0.8); display:none` and only toggled visible by the DragSelect library itself during a rubber-band gesture. When a real element drag starts (not an empty-canvas rubber-band), the `dragstart` handler calls `ds.break()` ([feezal-sidebar-inspector.js:798-804](../www/src/feezal-sidebar-inspector.js#L798-L804)) to abort DragSelect's gesture — but by that point DragSelect may already have flipped the selector to visible at the click origin with near-zero width/height. If `ds.break()` doesn't reliably reset `display` back to `none` in that race, the near-zero-size dotted orange-bordered box stays on screen, rendering as a tiny dot exactly at the first-click position — matching the reported symptom.

**Fix direction:** explicitly hide the selector (`display:none` or equivalent) whenever `ds.break()` is called in the `dragstart` handler, rather than relying on DragSelect's own cleanup; verify against the installed `dragselect` version's `break()` behaviour (whether it already resets the selector and this is instead a timing/z-index issue). Needs a repro to confirm before fixing — grep-located candidate, not yet reproduced/verified.

**Relates:** B32 (snapping helper lines not disappearing — same family of "leftover canvas overlay" bug, possibly worth investigating together), B33 (selectability/drag flakiness — same interact.js/DragSelect interaction surface).

### B35 — Rubber-band select sometimes selects nothing ❓ needs investigation

Dragging a rubber-band selection over elements sometimes selects nothing, even though it visibly overlaps elements. No reliable repro yet — **further investigation needed**.

Candidate area: the DragSelect `callback` handler ([feezal-sidebar-inspector.js:806-833](../www/src/feezal-sidebar-inspector.js#L806-L833)) only applies `items` when `this._dsDidDrag` was set true by the `dragstart` handler ([feezal-sidebar-inspector.js:798-804](../www/src/feezal-sidebar-inspector.js#L798-L804)), which itself gates on `event.target.tagName === 'FEEZAL-VIEW'` — if the gesture starts on some other element/overlay first (or `dragstart` doesn't fire before `callback` in some ordering), `_dsDidDrag` stays false and the whole selection result is discarded (`wasDrag` false → early `return`, line 810-816) regardless of what DragSelect actually found under the rectangle. Also worth checking whether newly-registered elements (`ds.addSelectables`, [feezal-sidebar-inspector.js:1417-1421](../www/src/feezal-sidebar-inspector.js#L1417-L1421)) can miss registration in some ordering, making them invisible to DragSelect's hit-testing even though they're visually on canvas.

**Relates:** B34 (stray orange dot — same `dragstart`/`ds.break()` gating logic, possibly a shared root cause worth investigating together), B32/B33 (same canvas-overlay/DragSelect/interact.js interaction surface).

### B36 — Snapping sometimes stops working until page reload ❓ needs investigation

Snapping occasionally just stops working during drag/resize — no snap lines, no snap-to behaviour — and a full page reload fixes it. Since reload resets in-memory JS state, this points at **stuck client-side state**, not a server/data issue. No reliable repro yet — **further investigation needed**.

**Candidate root cause:** `_effectiveSnapping()` ([feezal-sidebar-inspector.js:1152-1163](../www/src/feezal-sidebar-inspector.js#L1152-L1163)) derives the active snap mode from `this._ctrlDown`/`this._shiftDown`, which are tracked purely from `keydown`/`keyup` listeners ([feezal-sidebar-inspector.js:524-544](../www/src/feezal-sidebar-inspector.js#L524-L544)) — `_ctrlDown` is set true on a `keydown` with `ctrlKey` and only cleared on a matching `keyup`. If a `keyup` for Ctrl is ever missed — e.g. an OS/browser-level shortcut consumes it, focus leaves the document (alt-tab, DevTools, a native file/color-picker dialog) while Ctrl is held, or the key is released while an iframe/other element has focus — `_ctrlDown` stays stuck `true`. Per `_effectiveSnapping()`, a stuck `_ctrlDown` with the default `snapping = 'elements'` evaluates to `'off'` permanently, matching the reported symptom exactly (snapping silently stops, survives until something resets the JS state — i.e. reload). Same failure mode could apply to `_shiftDown` getting stuck, flipping snapping to the wrong mode instead of off.

**Fix direction (pending confirmation):** don't trust keyup alone — also resync modifier state from `window blur`/`visibilitychange` (clear both flags when focus leaves the window) and from every subsequent `pointerdown`/`mousedown` (read `event.ctrlKey`/`event.shiftKey` opportunistically). Needs a repro to confirm the stuck-modifier theory before implementing.

**Relates:** B32 (snapping helper lines sometimes don't disappear — could be the same stuck-modifier root cause manifesting as lines stuck *visible* instead of snapping stuck *off*; worth investigating together).

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

### N30 — layout-app breaks the site active-view MQTT contract ⚠️ refinement needed

**Problem.** `feezal-site` owns the "active view" contract: switching views publishes the view name to `<site-publish>/view` ([feezal-site.js](../www/src/feezal-site.js) `_viewChanged`), incoming `<site-subscribe>/view` (and the N24 per-client variant `…/clients/<id>/view`) switches via `applyControlCommand()`, the URL hash tracks it, and the N26 playlist drives it. **layout-app bypasses all of it**: it sits on one site view (e.g. `main`) and *clones* drawer-entry views into its content pane — the site's active view never changes. Consequences: (1) the viewer publishes `main` forever, automations never learn the user is on `page2`; (2) an incoming `view: page2` command switches the *site* view — dumping the user out of the app shell onto the raw page instead of swapping the shell's content; (3) hash/deep-links and playlist rotation have the same blind spot. layout-app's own element-level `subscribe`/`publish` is a parallel, duplicate contract — it doesn't heal the site one.

**Options considered** (discussed July 2026):

- **A — shell as site chrome** (architecturally correct, biggest change): move layout-app out of the view layer to a site-level wrapper that is always visible, with normal site view switching happening inside its content pane. `site.view` stays the single source of truth; publish/command/hash/playlist all just work, no cloning. But: new "site shell" element category, editor canvas + placement rules + serialization changes, dashboard migration.
- **B — view-router delegation** (recommended): keep the architecture, integrate the protocol. *Outbound:* when layout-app swaps its embedded view it notifies the site, which publishes the embedded name on the standard `<publish>/view` and syncs the hash. *Inbound:* `applyControlCommand('view', name)` first offers the command to a registered, currently-visible "view router" (the layout-app) — if `name` is one of its drawer entries it swaps internally, else the site switches top-level as today. Playlist advances route through the same path (rotation inside the shell for shell views). One MQTT contract; layout-app's own `publish`/`subscribe` become deprecable.
- **C — document-only** (rejected): declare layout-app's element-level topics *the* mechanism when a shell is used. Leaves two competing contracts; every consumer must know which dashboard style is deployed.

**Open questions (refinement needed before implementation):**

1. **Hash / deep-link format** — flat `#/page2` (matches the one-active-view model, but on load the viewer must infer that `page2` opens *inside* the shell; ambiguous if a view is both a drawer entry and standalone) vs. nested `#/main/page2` (unambiguous, but changes the hash format existing bookmarks/consumers may rely on).
2. **Published payload** — just the embedded name (`page2`, keeps existing automations working) or structured (`main/page2`, more honest)?
3. **Default behaviour** — always-on for layout-app, or opt-in via an attribute (e.g. `sync-site-view`)? Always-on is better UX but changes behaviour of existing dashboards already using the element-level topics.
4. **Precedence rules** — multiple layout-apps (on different top-level views): proposal — only the *visible* one may claim a command, first match wins, nesting unsupported. A command naming a view that is *not* a drawer entry switches the site top-level and the shell disappears — acceptable?

**Relates:** N24 (per-client view commands — must route through the same delegation), N26 (playlist — should rotate inside the shell), E47 (layout-app, archive), E80 (navigation rail — any future shell-style element needs the same router hook), material-navbar (already switches the *site* view directly — the consistent counter-example).

### N31 — Discovery: consume availability — multi-topic support in the FeezalElement base class

**Problem.** Auto-discovery works well, but **availability is effectively ignored**. Elements that support it map only the legacy scalar `availability_topic` in their discovery descriptors — the modern HA discovery form is an **`availability` array** with `availability_mode`, and that array is what zigbee2mqtt publishes: **two topics per device**, the bridge state *and* the device availability:

```json
"availability": [
  {"topic": "zigbee2mqtt/bridge/state",                    "value_template": "{{ value_json.state }}"},
  {"topic": "zigbee2mqtt/licht_garten_group/availability", "value_template": "{{ value_json.state }}"}
],
"availability_mode": "all"
```

Semantics per HA: `all` = available only if **every** topic reports available, `any` = at least one, `latest` = the most recent message wins. The single-string `subscribe-availability` attribute can't express this.

**Second problem — duplication.** Availability is currently hand-rolled per element: ~15 elements (glass-climate/-contact/-light/-occupancy/-shutter/-switch, material-climate/-contact/-cover/-door-lock/-fan/-light/-motion, metro-contact/-occupancy) each declare `subscribe-availability` + `message-property-availability`, render their own unavailable badge, and map `availability_topic` in their own discovery descriptor. The [FeezalElement base class](../www/packages/@feezal/feezal-element/feezal-element.js) has **no availability support at all**. Per-element handling should not be the model.

**Proposal (preferred): lift availability into `FeezalElement`.**

- **Base-class attributes**, contributed automatically to every element's descriptor (the way `subscribe` already is; possibly opt-out via the `feezal` descriptor for pseudo/system elements):
  - `subscribe-availability` — one topic (string, back-compat) **or** a JSON array of topics / `{topic, property}` objects for the multi-topic case.
  - `availability-mode` — `all` | `any` | `latest`, default `all` (matches HA default for the array form).
  - `payload-available` / `payload-not-available` — defaults `online` / `offline` (HA defaults).
  - `message-property-availability` — dot-path for JSON payloads; the array's per-entry `value_template: {{ value_json.state }}` maps to per-entry `property` (e.g. `payload.state`) — feezal's existing `message-property` mechanism covers this, no template engine needed.
- **Base-class scope: subscription + state only — UI stays in the elements** *(decided July 2026)*. The base subscribes to all availability topics, tracks per-topic status, applies payload matching / property paths, and combines everything per `availability-mode` into one reactive **`_available`** flag (plus a per-topic status map for diagnostics/tooltips). It renders **nothing**: which badge is shown, where it sits, whether the element dims — that is presentation, and presentation is element-family business (a glass card, a material tile, and a metro block indicate "unavailable" differently and place badges differently). This split also avoids the base class injecting DOM into shadow roots it doesn't own — technically fragile and against the Lit grain (base = behaviour, subclass = render), and it mirrors how `subscribe` already works: inherited machinery, element-specific rendering.
  - **Consistency guard (the one real risk of this split is 15 drifting badge looks):** ship optional shared helpers alongside the base — an exported badge template partial + shared CSS block (themable via `--feezal-unavailable-*` custom properties) that elements *may* compose into their render; and the base reflects a host attribute (e.g. `unavailable`) so themes and zero-effort elements get a styling hook via pure CSS. Convention over enforcement.
- **Discovery, server side** ([discovery.js](../server/src/mqtt/discovery.js)): normalise the three wire forms — scalar `availability_topic` (+ `payload_available`/`payload_not_available`), the `availability` array, and `availability_mode` — into one canonical list on the discovery record.
- **Discovery, element side:** the base class maps the canonical availability list into the new attributes for *every* element automatically — individual discovery descriptors drop their `availability_topic` lines.
- **Migration:** single-topic string values of `subscribe-availability` keep working unchanged; the ~15 elements shed their duplicated attribute declarations and subscription/matching logic incrementally (patch bumps per package) while **keeping their own badge rendering** (optionally switching to the shared badge partial); the external device family follows the same contract.

**Alternative considered — central availability registry on the connection/site layer:** `feezal-connection` tracks availability topics once and elements just reference a device id. Cheaper per element and naturally dedupes the shared bridge topic (hundreds of elements → one `zigbee2mqtt/bridge/state` subscription), but it introduces a second stateful layer and an indirection that breaks the "element = self-contained subscriptions" model; MQTT subscription dedup already happens in the client. **Verdict: base-class approach preferred**, with the registry idea only revisited if the per-element fan-out to the bridge topic measurably hurts.

**Open questions:**
1. Attribute shape for multi-topic — JSON array in one attribute (matches repeater/logbook precedent) vs. `subscribe-availability` + `subscribe-availability-2…n` (friendlier inspector, clumsy contract). Leaning JSON array with an N6 custom-inspector row builder later.
2. Should *unavailable* block interaction (HA greys out controls) or only badge it? Current per-element behaviour keeps controls usable ("badge when unavailable, controls stay enabled") — keep that as the default, add an opt-in `disable-when-unavailable`?
3. `latest` mode needs message-order tracking — worth implementing, or ship `all`/`any` first and add `latest` when a real device needs it?
4. Editor UX: should the inspector's availability section visualise live per-topic status (online/offline per entry) as a wiring aid?

**Relates:** element-spec §3.7/§4 (conventions doc must specify the new contract), E66 (fleet board — availability is its core data), N24 (presence — similar online/offline semantics), B28/U38 (topic fields/browser for wiring availability topics manually).

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

*Inspiration (awesome-web-components, July 2026):* **XWeather** — a set of web components implementing parts of the OpenWeatherMap API — is a useful reference for the condition/icon mapping and layout, even though feezal's element stays MQTT-driven rather than calling a weather API directly (keeps it provider-agnostic and credential-free).

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

### E39 — Splash / FOUC-prevention element (`feezal-element-system-splash`)

A system element that prevents flash-of-unstyled-content and UI jitter on first load, before retained MQTT messages have been received and the dashboard has settled into its initial state.

**Editor behaviour (decided): pseudo-element** — placeholder chip in the editor (like the E49/E53 system-element pattern); position and size are irrelevant; the overlay never shows in editor mode. Palette-discoverable, attributes edit in the normal inspector, no new site-settings surface — a built-in `feezal-site` behaviour was rejected for exactly these reasons ("place it once", same as E53).

**Viewer behaviour:**
- On first page load, renders a full-screen overlay above all other content (`position: fixed; inset: 0; z-index: 9999`), solid in the site/theme background colour.
- The overlay hides once **all** of the following hold:
  1. The MQTT connection is established.
  2. The view's DOM is fully populated (element `connectedCallback`s have run).
  3. **Quiet window (decided):** no message has arrived for a settle window (default **400 ms**) — broker-retained messages arrive in a burst right after subscribe, so a short silence means the initial state is in. Zero config, adapts to any topic count. (First-message-on-any-topic and configured-count rules were rejected: one unblocks too early, the other silently rots.)
- **Fallback timeout (decided): default 3 s, configurable, measured from connection-up** — the splash must never hang on a dashboard with no retained topics. If the connection itself never establishes, the same timeout counts from page load as a hard cap.
- **Spinner after ~1 s (decided):** a subtle spinner appears only if the wait exceeds ~1 s — fast loads see a clean colour flash, slow loads get feedback (this also covers the "unexpectedly long wait" concern). *(Candidate for the spinner itself, awesome-web-components July 2026: **LDRS** — lightweight, customizable, themeable loading animations as web components — instead of a hand-rolled spinner; verify bundle cost, else a CSS spinner is fine.)*
- Once the conditions are met the overlay fades out with a short transition (target: ~250 ms).
- Only fires on the initial load; navigating between views does not re-trigger the overlay.

**Attributes:** `settle-window` (ms, default `400`), `timeout` (seconds, default `3`). Theming via CSS custom properties (`--feezal-splash-background` defaulting to the theme background, spinner colour/delay).

**Deferred:** logo image attribute (A16 asset — the branded kiosk boot screen), custom colour *attribute* (the CSS custom property covers theming meanwhile), re-trigger on reconnect after connection loss.

### E54 — Markdown element (`feezal-element-basic-markdown`)

Render Markdown from a subscribed payload or an asset file (`src`) — notes, documentation panels, status summaries. Dashboard 2.0 ships `ui-markdown` (incl. Mermaid); uibuilder built a whole markdown-site node (Markweb). Cheap to build and has a nice AI synergy: the in-editor assistant already renders Markdown — an element displaying AI/script-generated markdown content closes that loop (E49 script computes a summary → publishes → markdown element renders).

**Decisions (July 2026):**
- **Renderer: reuse `marked` + `DOMPurify`** — the AI chat's proven pipeline (`_renderMarkdown` in `feezal-ai-chat.js`, incl. the links-open-in-new-tab DOMPurify hook), one markdown pipeline in the repo. Note: those deps currently live only in the editor bundle — the element brings them into the viewer/export bundle (~60 kB min / ~20 kB gzip); export tree-shaking (A8) drops them for sites without the element.
- **Sanitized by default, `allow-html` opt-out attribute:** DOMPurify (safe-HTML profile) on every render regardless of source; setting `allow-html` disables sanitization for trusted setups (author-controlled docs panels embedding richer HTML). The attribute's inspector `help` text must state the consequence plainly: anyone able to publish to the subscribed topic can inject script into every viewer.
- **`src` + `subscribe` compose:** the asset renders immediately as initial/fallback content; the first (and every later) payload on the topic replaces it — a static doc that a script/automation can override live. Neither ignored-src nor mutual exclusion.
- **`${...}` templating out of scope** — that's `basic-template`'s job.

**Deferred:** Mermaid as an opt-in later tier — the dependency is heavy (~1 MB) and needs a lazy-loading design (viewer-bundle chunk + static-export story) before it's worth it.

**Relates:** U9/AI assistant (shared renderer), E49 (generated content), A16 (asset refs), E32/basic-template (adjacent display elements).

**Relates:** U9/AI assistant (shared renderer), E49 (generated content), A16 (asset refs), E32/basic-template (adjacent display elements).

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

### E62 — MQTT broker introspection family (`feezal-element-mqtt-*`)

*From EMQX research (July 2026): broker operators demonstrably want these views — client lists, per-topic rates, retained-message browsing — but they exist only inside broker admin consoles (EMQX Dashboard, and nowhere at all for Mosquitto). No dashboard tool composes them next to telemetry widgets.* Uniquely fitting feezal's MQTT-native identity, and doubles as built-in debugging tooling while editing.

**First cut (decided, July 2026): the client presence list** (`feezal-element-mqtt-clients`), consuming the **N24 convention** (`<site>/clients/+/status`) — a live list of feezal viewers (id, current view, connection type, online-since) placeable on any dashboard: the canvas sibling of N24's editor clients panel, and N24's first element-side consumer. Broker-generic sources (EMQX `$SYS/…/clients/#` connect/disconnect events, LWT-based presence patterns) become an attribute-selectable later mode — their payload formats are broker-specific and Mosquitto offers nothing comparable, so the feezal-native contract goes first. *Depends on N24 shipping.*

**Later tiers (dispositions decided, order open):**
- **Topic-tree browser**: a wildcard subscription rendered as a live collapsible tree with last payload, message rate, and retain flag per node — buildable entirely client-side, arguably the most useful single element of the set. **Decided: element + editor panel** — the tree component is shared with a new editor sidebar panel (live topic inspector while editing; candidate upgrade for the `mqttTopic` autocomplete into a browsable picker), not a pure canvas element.
- **$SYS stat tiles/charts**: connections, subscriptions, message rates in/out, uptime — pure subscription against `$SYS/broker/…` (Mosquitto) / `$SYS/brokers/…` (EMQX); a prefix attribute covers both.
- **Retained-message browser**: subscribe a subtree, filter the retain flag; delete = publish empty retained payload. **Decided guard: a per-delete confirm dialog spelling out the full topic name** — no bulk delete in the first version.

**Caveats to document:** `$SYS` is often ACL-restricted to localhost by default (EMQX); broad `#` subscriptions are expensive on busy brokers — every element takes a subtree-scoping attribute rather than defaulting to `#`. Broker-HTTP-API features (kick client, slow subscribers) are explicitly out of scope — pure MQTT only.

**Relates:** N24 (the presence contract the first-cut element consumes), E32 (logbook), editor topic autocomplete (shared topic-tree machinery — now a decided direction, see topic-tree browser).

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

### E80 — Navigation rail element (`feezal-element-material-navrail`)

A dedicated MD3 **Navigation Rail** — a compact vertical column of destinations for switching views, sitting between the horizontal bottom bar and the full drawer. `material-navbar` (E46) already offers a vertical `orientation` mode, but a true navigation rail is a distinct MD3 pattern with its own affordances worth a dedicated element:

- **Narrow fixed-width rail** (~80px), items stacked vertically with the icon in an active-indicator pill and the label beneath (`show-labels: always | active | never`).
- **Optional header slot** at the top — a menu/hamburger button and/or a FAB (e.g. a primary action), above the destination list.
- **Item alignment** along the rail (`top | center | bottom`) so the destination group can sit against either end.
- Same **items model as the navbar** — JSON array of view-name strings or `{label, view, icon?, subscribe-badge?}` objects; empty auto-populates from all views in document order.
- **Active item follows the current view from any source** (nav / swipe / MQTT / deep link / hash) via the same MutationObserver-on-`feezal-site.view` mechanism the navbar uses. (See B23 — the active-view sync must be sourced from shared view state, not internal click state.)
- Standard `subscribe` / `publish` support and MD3 CSS custom properties for the rail surface, active-indicator, and item colours, exposed in the Style inspector.

**Open question:** whether this is best implemented as a separate element or as an expanded/dedicated preset of `material-navbar`'s vertical mode (adding header slot + rail styling there). A separate element keeps the palette clear and the MD3 semantics distinct; sharing the navbar's item/active-view engine avoids duplicating the sync logic.

**Ships with:** unit tests (item parsing, active-view sync from external switch, label modes), patch bump, TESTING.md per-element bullet.

**Relates:** E46 (`material-navbar` — shares the items model + active-view sync engine; rail is the vertical sibling), B23 (`basic-navigation` active-view sync bug — same "reflect current view from any source" requirement), E48 (dialog-view — another navigation surface).

### E83 — Spectrum element family (`feezal-element-spectrum-*`) 💡 idea

A third element **design system** alongside paper (Polymer Paper) and material (Material Web / MD3), backed by **Adobe Spectrum Web Components** (`@spectrum-web-components/*`). Both existing families wrap an off-the-shelf web-component library (`@polymer/paper-*`, `@material/web`); Spectrum extends that model with a genuinely different, clean "professional tool" design language.

**Why Spectrum as the flagship third framework:**

- **Lit-native** — built on LitElement, so it integrates exactly like `@material/web` already does (same reactive model, clean Vite bundling); the lowest-friction technical match.
- **Distinct look & feel** — Adobe Spectrum reads as a polished, restrained pro-app aesthetic, clearly not Material and not Paper.
- **Per-component packages** — `@spectrum-web-components/button`, `…/slider`, `…/switch`, etc. tree-shake, so a family only pulls in what its elements use.
- **License** — Apache-2.0, compatible with feezal's AGPL-3.0.

**Scope (first cut):** the same everyday controls the material set covers so the family stands on its own — `spectrum-button`, `spectrum-switch`, `spectrum-slider`, `spectrum-checkbox`, `spectrum-select`, `spectrum-number`/stepper, plus a `spectrum-card`/container. Reuse the existing MQTT subscribe/publish conventions and attribute descriptors from the material equivalents; only the presentation layer differs.

**Open questions:**
- **Bundle cost** in the viewer/export bundle (Spectrum ships its own tokens/theme layer — measure vs. the material set).
- **Theme mapping** — map Spectrum design tokens onto feezal's theme variables so the family respects the active theme rather than forcing Spectrum's own palette; likely a `feezal-theme-spectrum` for the native look plus token bridges for the existing themes.
- **Auto-discovery** wires the family like the material set (naming convention `feezal-element-spectrum-*`); reserve `spectrum` as an official category.

**Relates:** paper/material families (same wrap-a-component-library pattern), E84 (Wired — the other concrete new framework), E85 (backlog of further design systems), E55–E63 (hand-rolled aesthetic families — the deliberate *opposite* approach: no component library, pure CSS/SVG).

### E85 — Backlog: additional component-library design systems 💡 idea

Parking lot for further **off-the-shelf web-component UI libraries** that could each back a future `feezal-element-<category>-*` family, evaluated but not prioritised over Spectrum (E83) and Wired (E84 — since shipped, see ROADMAP-ARCHIVE). All are framework-agnostic custom elements wrappable the same way as paper/material; the recurring trade-offs are **bundle cost**, **Lit-nativeness** (cleanest integration), and how well their design tokens map onto feezal themes.

- ~~**IBM Carbon**~~ — ✅ **promoted and implemented (July 2026)** as the built-in `feezal-element-carbon-*` family (button/switch/checkbox/slider/select/input, wrapping `@carbon/web-components`); see ROADMAP-ARCHIVE **E98** for scope, token mapping and the measured bundle cost.
- **Shoelace / Web Awesome** (Lit, Shoelace core MIT) — neutral modern web ("Bootstrap for web components"). **Already a dependency** (editor chrome), so the lowest-cost family to add — but it's currently kept *out* of viewer elements on purpose (bundle discipline), and Web Awesome (the successor) has a paid tier. Decide the viewer-bundle trade-off first.
- **Microsoft Fluent UI** (`@fluentui/web-components`) — Fluent 2 (Windows/Office) design language, distinct look. Watch-out: Microsoft's web-component stack (FAST → Fluent WC) has churned repeatedly — stability risk.
- **SAP UI5 Web Components** (`@ui5/webcomponents`, Apache-2.0) — SAP Fiori design, very distinct enterprise aesthetic. Heavier; strongly opinionated.
- **PatternFly Elements** (`@patternfly/elements`, **Lit**, MIT) — Red Hat's design system; clean, Lit-native, integrates easily.
- **Ionic** (`@ionic/core`) — native-mobile (iOS/Android) feel; framework-agnostic custom elements but built on **Stencil, not Lit**, so integration differs from the others. Good if a "phone-app" look is ever wanted.

**Further candidates surfaced from awesome-lit (July 2026):**

- **Kor** (Lit) — a lightweight design system **built specifically for data/dashboard UIs** (dark, industrial). Arguably the best *thematic* fit for feezal's audience of the whole list — a strong promote candidate alongside Carbon for the "industrial dashboard" slot.
- **Lion** (ING, Lit, MIT) — white-label, accessibility-first **base layer** meant to be themed, not a finished look. Interesting less as a family and more as a *foundation* to build a bespoke feezal family on (feezal supplies the skin, Lion the accessible behaviour).
- **Clarity Core** (VMware, Lit) — enterprise design system; clean, data-dense.
- **Red Hat Design System** (`@rhds/elements`, Lit) — the RH brand system (distinct from PatternFly Elements above, though related); polished, Lit-native.
- **Calcite** (Esri/ArcGIS) — **geo/mapping-flavored** design system; interesting given feezal's map element, but **verify the build (Calcite is Stencil-based, not Lit)** before counting it.
- **Ignite UI Web Components** (Infragistics) — complete suite **including a data grid and charts**; commercial licensing — relevant mostly if E75 (table) or charting ever wants a batteries-included commercial option.

**Further candidates surfaced from awesome-web-components (July 2026):**

- **Siemens iX** — an **industrial** web-component design system (automation/HMI heritage). Best audience fit on the whole list for feezal's SCADA/automation users — a top promote candidate for the "industrial" slot alongside Carbon and Kor.
- **Nord** (Nordhealth) — clean, polished, accessible design system; a distinct professional look.
- **Elix** — less a skin than a set of **accessible UI-pattern primitives** (menus, carousels, dialogs, list-box). Interesting as *behaviour* building blocks feezal elements/inspectors could reuse, rather than a whole family look.
- Breadth-only options if a specific brand look is ever wanted: **Auro** (Alaska Airlines), **Crayons** (Freshworks), **Lyne**, **Forge**, **Blueprint UI**.

When any of these is chosen, promote it to its own `Ex` entry (like E83/E84) with a concrete component scope, theme-token mapping plan, and a measured bundle-cost note.

**Relates:** E83 (Spectrum), E84 (Wired), paper/material families (the wrap-a-library precedent), E55–E63 (hand-rolled aesthetic families — the alternative to adopting a component library).

### E88 — JSON tree viewer (`feezal-element-basic-json`) 💡 idea

*(Source: awesome-lit, July 2026 — `<json-viewer>`.)* An element that subscribes to a topic and renders the **JSON payload as a collapsible tree** — the "inspect what this device is actually publishing" widget an MQTT dashboard is missing. Doubles as a debugging/diagnostics tool and a live structured-data readout.

- **Backing lib:** `<json-viewer>` (Lit, MIT — visualizes JSON as a tree view) as a candidate to wrap; verify Lit 3 compat + bundle cost, else a small hand-rolled recursive Lit renderer is cheap.
- **Attributes:** primary `subscribe` (+ `message-property` to drill into a sub-path), `expand-depth` (auto-expand N levels, default e.g. 1), `filter`/path-search, optional `max-depth`. Non-JSON payloads fall back to showing the raw string (never error).
- **Styles:** expose the tree's key/value/type colours as CSS custom properties so it themes with the active feezal theme.
- **Fits the E62 MQTT-introspection family** — a topic-payload inspector is exactly that family's territory; decide whether it ships standalone as `basic-json` or as `mqtt-json` within E62.

**Relates:** E62 (MQTT broker introspection family — natural home), `basic-template` (the other "render a payload" element — this is the structured/tree case), E32 (logbook — raw message feed sibling).

### E89 — Lottie animation element (`feezal-element-basic-lottie`) 💡 idea

*(Source: awesome-lit, July 2026 — `<lottie-player>`.)* An element that plays a **Lottie animation**, with playback driven by MQTT — animated weather glyphs, alert/attention states, "working"/progress spinners, playful status characters. Nothing in the palette offers rich vector animation today.

- **Backing lib:** `<lottie-player>` (Lit web component) wrapping lottie-web; verify bundle cost (lottie-web is sizable — likely a lazy-loaded/viewer-chunk concern like E54's Mermaid deferral).
- **Source:** `src` (asset URL / Asset Manager reference) for the animation JSON; consider a `subscribe` to swap the animation or drive playback.
- **MQTT-driven playback:** map payloads to play / pause / stop / loop, seek to a frame or named segment, or pick among several clips by value (e.g. `sunny`/`rain`/`storm` → different segments) — the same value→state mapping pattern the icon-value (E71) and status elements already use.
- **Attributes:** `src`, `subscribe`, `autoplay`, `loop`, `speed`, plus a value→segment/clip map; `renderer` (svg/canvas) if the lib exposes it.
- **Styles:** sizing scales to the element box (E38); background/transparency options.

**Relates:** E54 (markdown — same "heavy dep, lazy-load into viewer/export" bundling problem to solve), E71 (icon-value — the value→variant mapping pattern), E39 (splash — a Lottie could be a richer FOUC/splash animation), A16 (asset refs for the animation JSON).

### E90 — Vaadin element family (`feezal-element-vaadin-*`) 💡 idea

An element **design system** backed by **Vaadin web components** ([vaadin.com](https://vaadin.com/)) — a "business/enterprise web app" look, promoted from the E85 backlog to its own concrete entry alongside Spectrum (E83) and Wired (E84).

**Why Vaadin is a strong candidate:**

- **Lit-native** — Vaadin's web components are built on Lit, so they integrate like `@material/web` already does (same reactive model, clean Vite bundling).
- **The broadest component suite of any candidate** — buttons, selects, combo-box, date/time pickers, number field, and notably a mature **data grid** and **charts**. That breadth means the family could cover controls the material set doesn't (e.g. combo-box, rich date pickers) and could **back other roadmap items** — the Vaadin **Grid** for E75 (data table), Vaadin **Charts** as a charting option, its **date-time-picker** for E25.
- **Distinct look** — clean, dense, professional "line-of-business" aesthetic, clearly different from Material, Paper, Spectrum, and Wired.

**Watch-outs / decisions:**

- **Licensing is the key gate:** Vaadin's **core** components (`@vaadin/*` — button, text-field, select, combo-box, date-picker, grid, …) are **Apache-2.0** and fine for feezal's AGPL-3.0. But **Vaadin Charts and some Pro components are commercial** (CVAL license) — the family must stick to the free core, and **Charts/Pro-only pieces are out of scope** unless a licensing story exists. Verify each component's tier before including it.
- **Bundle cost** — Vaadin components pull in a shared Lumo theme + `@vaadin/component-base`; measure the viewer/export footprint versus the material set (per-component packages help tree-shaking).
- **Theming** — map the Lumo theme's CSS custom properties onto feezal's theme variables (likely a `feezal-theme-vaadin` for the native Lumo look plus token bridges for existing themes).

**Scope (first cut, free core only):** `vaadin-button`, `vaadin-select`, `vaadin-combo-box` (the standout — no material equivalent), `vaadin-text-field`/`number-field`, `vaadin-date-picker` / `time-picker`, `vaadin-checkbox`, plus a container/card, reusing feezal's MQTT subscribe/publish conventions.

**Relates:** E83 (Spectrum) / E84 (Wired) — the other concrete framework families; E85 (backlog it was promoted from); E75 (Vaadin Grid could back the data table), E25 (Vaadin date/time picker), and the charting items (Vaadin Charts — but commercial, so likely not); N29 (element sets — a design-system family is the prime "install as a set" case).

### E91 — Theme switcher element (`feezal-element-system-theme-switch`) 💡 idea

*(Source: awesome-web-components, July 2026 — `<dark-mode-toggle>` / `<theme-switch>`.)* feezal ships many themes but has **no in-viewer control to switch them** — the theme is chosen in the editor. A viewer-facing switcher lets end users flip light/dark (or pick among installed themes) on the running dashboard.

- **Two modes:** a simple **light/dark toggle**, or a **theme picker** (dropdown of installed `feezal-theme-*` names) — one attribute selects which.
- **Persistence:** remember the choice per client (localStorage), and optionally publish/subscribe the selection to a topic so it can sync across viewers or be driven from automation (e.g. dark after sunset). Ties into the theme machinery that already surfaces `window.feezal.themes`.
- **Editor:** a normal palette element (renders a real toggle/select); position/size on the canvas like any control.
- **Attributes:** `mode` (`toggle` | `select`), `subscribe`/`publish` (optional cross-client sync), `default`, persistence on/off. **Styles:** themeable icon/track colours.

**Relates:** the theme system (`window.feezal.themes`, theme packages), A18 (kiosk/wall-panel — auto dark/light there), E50 (conditions could also drive theme via a control topic), E71 (icon-value — the toggle's sun/moon glyphs).

### E92 — PDF viewer element (`feezal-element-basic-pdf`) 💡 idea

*(Source: awesome-web-components, July 2026 — `<pdfjs-viewer-element>`.)* Display a **PDF** on a dashboard — equipment manuals, floor plans, wiring diagrams, datasheets, shift schedules. Fills the gap between `basic-iframe` (whole external page) and `basic-image` (raster only): crisp, scrollable, multi-page vector documents.

- **Backing lib:** `<pdfjs-viewer-element>` (wraps Mozilla PDF.js). PDF.js is heavy — treat like E54/E89: lazy-load into a viewer chunk, and decide the static-export story.
- **Source:** `src` = an Asset Manager reference (A16) or URL; optional `subscribe` to swap the document live (publish a new asset path/URL).
- **Attributes:** `src`, `page` (initial page, optionally MQTT-driven), `zoom`/fit mode, toolbar on/off. **Styles:** background, border, sizing to the element box.

**Relates:** E54 / E89 (same heavy-dep lazy-load + export concern), A16 (asset refs — most PDFs ship as assets), `basic-iframe` / `basic-image` (the adjacent embed elements this sits between).

### E93 — Range slider: min/max band (`feezal-element-material-range`) 💡 idea

*(Source: awesome-web-components, July 2026 — `<range-slider>`.)* The current `material-slider` / `paper-slider` are **single-value**. A **dual-handle range slider** publishes a **min/max band** — setpoint ranges, comfort bands (heating/cooling deadband), acceptable-value windows, schedule windows.

- **Two handles → two values;** publish as either two topics (`publish-min` / `publish-max`) or one JSON `{min,max}` payload (decide the convention — reuse whatever E-series settled for multi-value; default to two topics for MQTT-native simplicity). Symmetric `subscribe-min` / `subscribe-max` for feedback.
- **Attributes:** `min`, `max`, `step` (inherit the E-series step-default fix from **B17**), plus the publish/subscribe pair; keyboard-accessible handles (the `<range-slider>` lib emphasizes a11y — see A21).
- **Backing lib:** `<range-slider>` (accessible dual-handle custom element) as a candidate to wrap, else extend the existing slider with a second handle.

**Relates:** B17 (slider sub-integer step fix — inherit it), material-slider / paper-slider (the single-value siblings), A21 (accessibility — range sliders are a classic keyboard-a11y case), E52 (schedule — time windows are a range too).

### E94 — 3D model viewer (`feezal-element-basic-model`) 💡 idea

*(Source: awesome-web-components / awesome-lit, July 2026 — `<model-viewer>`.)* Render an **interactive 3D model** (glTF/GLB) on a dashboard — a device, a 3D-printer bed, a building/room, a machine — with orbit/zoom. State-driven touches later (highlight a part, rotate to a pose from a topic).

- **Backing lib:** Google's `<model-viewer>` (a mature, framework-agnostic web component). Heavy (three.js under the hood) — same lazy-load/viewer-chunk + export concern as E54/E89/E92.
- **Source:** `src` (GLB asset via A16 or URL), optional `poster`, camera controls on/off, auto-rotate. Later: `subscribe`-driven camera pose / variant / annotation hotspots.
- **Scope note:** start as a display element (orbit + auto-rotate); MQTT-driven interaction is a phase 2.

**Relates:** E92 / E54 / E89 (heavy-dep lazy-load family), A16 (GLB assets), E56 (analog cockpit — a 3D twin is the maximal "virtual hardware" version of that idea).

### E95 — Configurable keyboard shortcuts for interactive elements

A platform capability (cross-cutting, like E50 conditions) letting the dashboard author **bind keyboard shortcuts to element interactions** in the **viewer** — press a key to press a button, step a slider, toggle a switch, open a dialog, switch a view, etc. Turns a feezal dashboard into a keyboard-drivable control surface (power users, wall-panels with a keypad, accessibility).

**The core design question — elements have more than one action.** A single `shortcut` attribute is enough for a button (one action: click/publish) but not for a slider (up / down), a cover (open / close / stop), a switch (toggle, or on / off), or a dialog (open / close). So the clean model is a small new **element "actions" concept**:

- Each interactive element **declares its invokable actions** in its descriptor (e.g. `actions: ['press']` for button, `['increment','decrement']` for slider, `['open','close','stop']` for cover, `['toggle','on','off']` for switch, `['open','close']` for dialog, `['next-view','prev-view','goto']` for navigation). This mirrors how elements already declare `attributes`/`styles`.
- A **shortcut binding** maps a key (or chord) → (element, action). Stored per element (e.g. a `shortcuts` JSON attribute: `[{key:'ArrowUp', action:'increment'}, …]`) so it saves with the view and survives export.
- A **viewer-level keyboard dispatcher** (one global `keydown` listener) matches pressed keys against all registered bindings and invokes the target element's action method. Editor mode does **not** arm shortcuts (they'd fight the editor's own keymap).

**MVP vs. full:**
- **MVP:** a single `shortcut` attribute on each interactive element bound to its **primary** action (button press, switch toggle, dialog open, view navigate). Cheap, covers most cases.
- **Full:** the per-action `shortcuts` mapping above, with an inspector **"Shortcuts" section** (key-capture input per declared action).

**Design decisions to settle:**
- **Key syntax & chords:** single combo (`ctrl+shift+l`, `ArrowUp`) vs. sequences (`g h`); require a modifier by default so shortcuts don't fire while typing in an input/`basic-template` field (ignore when focus is in a text field).
- **Scope:** global vs. **active-view-only** (a key means different things per view) — likely per-view by default with an opt-in global flag.
- **Conflict handling:** detect/warn when two elements bind the same key (in the editor), and define precedence at runtime (first match / active view wins).
- **Discoverability:** a viewer **help overlay** (e.g. `?`) listing the active shortcuts — mirror the editor's existing shortcut-reference modal.
- **Composability with E50/E49:** a shortcut is just another trigger for an element action, so it composes with conditions (E50) and scripts (E49) — a key could ultimately trigger any action those can.

**Relates:** E50 (per-element conditions — same "cross-cutting per-element capability" shape; shortcuts are another action trigger), E49 (script — programmatic actions), E7 (swipe gesture — the touch analog of keyboard navigation), A21 (accessibility — keyboard operability overlaps directly; do them coherently), U-series shortcut-reference modal (reuse the help-overlay pattern), N24 (per-client — bindings are per-client UI state).

### E96 — MIDI input as an element trigger (Web MIDI) ❓ questionable / future

Beside E95's keyboard shortcuts, allow **MIDI controllers** to drive element interactions — a fader moves a slider, a pad press fires a button, a rotary knob (CC) sets a dimmer. MIDI hardware (cheap USB pad/fader controllers) is a genuinely nice **physical control surface** for a home/industrial dashboard, and it maps to feezal's controls almost 1:1.

**Motivating use case — real hardware sliders → feezal sliders:** a cheap USB MIDI fader controller (e.g. Korg nanoKONTROL, Behringer X-Touch Mini — banks of physical motor/linear faders) becomes a **lighting/mixing desk** for the dashboard: each physical fader is bound to a `material-slider` (a room's dimmer), so moving fader 1 sets the living-room brightness, fader 2 the kitchen, etc. — publishing the same MQTT topics the on-screen sliders do. It gives the tactile, eyes-free, multi-channel control a touchscreen slider can't, which is exactly what makes it worth the Web-MIDI complexity. (Continuous CC → slider value is the enabling piece below; motorized faders would also want the MIDI-*out* feedback phase so the hardware tracks state changed elsewhere.)

**Feasibility — yes, via the Web MIDI API (with real caveats):**
- The browser *can* listen to MIDI devices: **`navigator.requestMIDIAccess()`** returns inputs whose `midimessage` events carry note-on/off, control-change (CC), program-change, etc. So the technical path exists.
- **Secure context required** (HTTPS/localhost) and a **permission prompt** (`sysex` needs an extra grant, not needed here).
- **Browser support is the catch:** solid in **Chromium** (Chrome/Edge/Opera). **Safari does not support Web MIDI at all**, and **Firefox** support is partial/gated. So this is a Chromium-first, progressive-enhancement feature — must degrade gracefully (no MIDI → the dashboard is unaffected; E95 keyboard shortcuts remain the portable option). This support gap is the main reason it's marked **questionable**.

**Concept (reuses E95's "actions" model):**
- A **MIDI binding** maps a MIDI message → (element, action): note-on → discrete actions (button press, toggle, view switch); **CC (continuous)** → **value** actions (set a slider/dimmer to the CC's 0–127 mapped into the element's range) — this goes *beyond* E95's discrete triggers and is the compelling part (a physical fader mirroring a slider, bidirectionally if MIDI-out feedback is ever added).
- A viewer-level MIDI dispatcher (one `requestMIDIAccess` + per-input listener), armed only in the viewer, matched against saved bindings; the editor offers a **"MIDI learn"** capture (press the pad / move the fader to bind) in the same inspector section as E95 shortcuts.

**Open questions:** device identity/persistence across reconnects (match by port name/id); channel/note filtering; MIDI *feedback/out* (lighting a controller's LED from state) as a later phase; whether this is per-element bindings or a central MIDI-map surface. Given the Safari/Firefox gap, likely ships (if ever) as an optional power-user feature, not a core interaction path.

**Relates:** E95 (shares the element-actions model + inversion of the "learn" UI; keyboard is the portable sibling), E50/E49 (a MIDI event is just another action trigger), N24 (per-client input state), A21 (accessibility — physical input is complementary, not a replacement for keyboard operability).

### E99 — glass-light: configurable on/off state labels

The state line of `glass-light` is hard-coded English: `Off`, `On`, `On • <brightness> %` ([feezal-element-glass-light.js:767](../www/packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js)). Make the displayed labels configurable — e.g. `label-on` / `label-off` string attributes (defaults `On` / `Off`) — so dashboards can localise ("Ein"/"Aus") or reword them ("Läuft"/"Standby"). The brightness suffix (`• <brt> %`) keeps appending to the on-label. Not to be confused with `payload-on`/`payload-off` (MQTT payload values) or `label` (the card title) — the `help` texts should make the distinction explicit.

**Check siblings for the same hard-coding** (`metro-light`, `material-light`, and the external device-family light) and apply the same attributes where applicable, keeping naming identical across families.

**Ships with:** patch bump, TESTING.md element-notes update.

### E100 — Fan element (`feezal-element-glass-fan`)

The Glass family's missing fan control — every other common device type (light, climate, contact, shutter, switch, occupancy, sensor, button) already has a glass counterpart; fan is the gap. Frosted-glass card in the established Glass visual language (Apple-Home-style tile, tap/long-press-to-detail pattern where applicable).

**MQTT contract mirrors `feezal-element-material-fan`** (same attribute names, same capability model — the established Glass convention, see E58/glass-light's header comment: "MQTT capability contract mirrors feezal-element-material-* — SAME attribute names"):

| Attribute | Description |
|---|---|
| `subscribe` / `message-property` / `publish` | Primary on/off state and command |
| `payload-on` / `payload-off` | On/off payloads |
| `subscribe-speed` / `message-property-speed` / `publish-speed` | Fan speed (numeric, scaled by `speed-range-min`/`speed-range-max`) |
| `subscribe-preset` / `message-property-preset` / `publish-preset` | Preset mode (e.g. auto, sleep) |
| `preset-modes` | Comma/JSON list of available preset names |
| `speed-range-min` / `speed-range-max` | Device-reported speed scale (HA discovery maps this from `speed_range_min/max`) |
| `label` | Card label |
| `subscribe-availability` / `message-property-availability` / `payload-available` / `payload-unavailable` | Availability (see N31 — should adopt the base-class mechanism once it lands rather than the current hand-rolled pattern) |

**Visual concept:** icon (fan blades) that **animates/rotates when on**, speed as a slider or stepped dots (matching glass-light's brightness slider style), preset chips if `preset-modes` is set.

**Relates:** material-fan (attribute-contract source), E58 (glass-light, the established pattern this follows), N31 (availability — adopt the base-class approach rather than hand-rolling a 15th copy).

### E101 — Dialog element family (`feezal-element-glass-dialog*`)

The Glass family's missing dialog/popup elements — Material already has all three dialog variants; Glass has none. Adds, mirroring the Material family 1:1 in MQTT contract and behaviour, restyled in the frosted-glass visual language:

- **`feezal-element-glass-dialog`** — mirrors `feezal-element-material-dialog`: free-form templated body (`template`, `title`, `icon`), opens on `subscribe`/`payload-open`, closes on `payload-close`, optional OK/Cancel buttons each with their own publish topic/payload, `close-on-backdrop`, `show-close`, `hide-header`, sizing (`width`/`height`/`min-height`/`max-height`).
- **`feezal-element-glass-dialog-view`** — mirrors `feezal-element-material-dialog-view`: same open/close/OK/Cancel contract, but the body is an embedded feezal **view** (`view` attribute) instead of a template — a whole dashboard view rendered inside the glass dialog chrome.
- **`feezal-element-glass-countdown-dialog`** — mirrors `feezal-element-material-countdown-dialog` (palette name "Confirm"): a confirm-with-countdown dialog — `template` body with `${seconds}`/`${msg.*}` variables, `duration`, auto-confirms via `publish-confirm`/`payload-confirm` when the countdown reaches zero, `publish-cancel`/`payload-cancel` + `cancel-label` for the Cancel button, `warn-seconds` for the amber/red ring threshold. The countdown ring rendering should reuse/match glass-climate's or glass-light's ring styling for family consistency.

**Why one roadmap item covering three elements:** all three are thin visual reskins of existing, proven Material elements — no new MQTT semantics or interaction model to design, only the frosted-glass chrome (backdrop blur, translucent surface, rounded corners consistent with glass-light's card) and the standard Glass palette entry (`category: 'Glass'`, `color: '#7aa5c9'`).

**Ships with:** three packages (`feezal-element-glass-dialog`, `-glass-dialog-view`, `-glass-countdown-dialog`), each registered in `www/package.json`, patch-versioned independently, added to `docs/TESTING.md` §6 with notes on the dialog-specific behaviours (backdrop click, embedded view, countdown ring).

**Relates:** material-dialog / material-dialog-view / material-countdown-dialog (attribute-contract source), E58 (glass-light — the established Glass visual pattern), E48 (dialog-view, archive — original design rationale for the view-embedding variant).

### E102 — Climate elements: boost mode, thermostat mode datapoint conventions, valve position ⚠️ refinement needed

Three related Homematic/HmIP gaps in the `*-climate` family (`glass-climate`, `material-climate`, `metro-climate`, and the external device-climate element — see B29).

**1. Boost mode.** HmIP thermostats support a **boost mode**: activating it fully opens the valve and starts a countdown (Homematic default 5 min) before the thermostat returns to normal control. None of the climate elements currently expose this. Proposed: a `publish-boost`/`payload-boost` pair (publish a trigger, e.g. `BOOST_MODE` datapoint = `true`) plus a `subscribe-boost` read-back so the UI can show boost is active — ideally with the **remaining countdown** if the device publishes one (HmIP's `BOOST_MODE` datapoint doesn't carry a countdown value itself; check whether `PARTY_MODE_*`-style duration/end-time datapoints exist alongside it, or whether the UI should just show a static "boost active" state with a client-side timer bootstrapped from a configurable `boost-duration` default). Visual: an icon/toggle near the setpoint arc, active state clearly distinguished from normal heating.

**2. Thermostat mode datapoint conventions — needs discussion before implementation.** Existing `subscribe-mode`/`publish-mode` already covers *a* mode topic, but **the actual mechanism differs by device generation**:
- **BidCoS** (older Homematic): mode is typically set via a dedicated `CONTROL_MODE` / `AUTO_MODE` / `MANU_MODE` / `BOOST_MODE` **datapoint set**, or historically by writing specific values.
- **HmIP**: some devices expose a dedicated **`SET_POINT_MODE`** datapoint (an enum: AUTO/MANUAL/PARTY), while others infer mode from **writing to the temperature setpoint datapoint itself** (e.g. a specific sentinel value or valve-fully-closed temperature means "off", writing any real setpoint implicitly switches to manual).
- Today's single `publish-mode` + `modes` (JSON label/value list) assumes one clean enum datapoint — it doesn't accommodate "mode is implied by what you write to setpoint" or "boost is a mode value vs. a separate trigger topic" device variants.

**Open questions to refine before implementing:** should `modes` gain a per-entry publish-target override (e.g. a mode entry that writes to `publish-setpoint` with a magic value instead of `publish-mode`)? Is boost better modeled as one of the `modes` chips (reusing the existing mode-chip UI) or as its own dedicated control (per point 1 above)? Do we need a small per-family "device profile" concept (BidCoS vs. HmIP vs. Zigbee2MQTT thermostat schema) that pre-fills the mode/boost wiring, similar to how material-climate's discovery descriptor already maps `schema`/`action_topic` for zigbee2mqtt? This is the hard part of the item — **do not implement until the datapoint/mode model is agreed**.

**3. Valve opening percentage — optional display.** HmIP thermostat valves publish a **valve position percentage** topic (how far open the valve actuator currently is — distinct from the setpoint/actual temperature). `material-climate` **already has this** (`subscribe-valve` / `message-property-valve`, feeding the valve arc indicator — see [feezal-element-material-climate.js:129](../www/packages/@feezal/feezal-element-material-climate/feezal-element-material-climate.js#L129)). Bring the same optional attribute to `glass-climate`, `metro-climate`, and the external device-climate element, each rendered in that family's own visual language (glass: a subtle ring segment matching its existing arc styling per B29's shared-geometry goal; metro: a compact numeric/bar readout matching the flat Metro style). Purely optional/additive — no behaviour change when unset.

**Relates:** B29 (glass-climate/device-climate slider geometry — the valve indicator should follow whatever shared geometry comes out of that fix), N31 (availability — same "shared base contract, per-family rendering" shape applies here too), material-climate (valve attribute + zigbee2mqtt discovery mapping as the reference implementation for points 2 and 3).

### E103 — WLED elements (Device / Glass / Metro)

New elements for **[WLED](https://github.com/wled/WLED)** — the very popular ESP32/ESP8266 addressable-LED firmware — across the three device-style families, matching the pattern already used for light/climate/contact/shutter: **`feezal-element-material-wled`** (palette category **Device** — note: the existing "device-*" family in this repo is the `material-*` packages under `category: 'Device'`, e.g. `material-light`/`material-cover`/`material-climate`; there is no separate `device-*` package prefix), **`feezal-element-glass-wled`**, and **`feezal-element-metro-wled`**.

**WLED's MQTT contract** (device-configured base topic, default `wled/<name>`):
- **Command:** `<base>/api` accepts the same JSON payload shape as WLED's HTTP `/json/state` API — `on`, `bri` (0–255), `transition`, `ps`/`pl` (preset/playlist recall), and a `seg` array for per-segment control. A legacy plain-string command form also exists on `<base>` itself (`ON`/`OFF`/`T`/`A128`/…) for simple on/off/brightness without JSON.
- **State:** `<base>/g` (on/brightness, legacy compact string) and `<base>/c` (current colour hex) are published on change; **availability via LWT** — `<base>/status` retained `online`/`offline`.
- **Segments** are WLED's standout feature and the main design challenge: each device can run **multiple independent LED segments**, each with its own effect (`fx`), speed (`sx`), intensity (`ix`), palette (`pal`), and up to 3 colours (`col`). This doesn't map onto the flat attribute model the other light elements use — it's a genuinely structural, per-entry-list config (see U39's guidance: exactly the case where a **custom inspector** — a segment list builder, N6-style — is warranted rather than forcing it into flat attributes).
- **Effect/palette names are not discoverable over MQTT** — WLED exposes the effect/palette name lists only via its HTTP JSON API (`/json/effects`, `/json/palettes`), not MQTT. Options: ship a static bundled list (the built-in effect/palette names are large but fairly stable across WLED releases, with room for custom/compiled-in extras to fall back to numeric IDs), or have the server fetch them from the device's HTTP API at pairing time (extra dependency: requires network access to the device, not just the broker — bigger architectural step, mirrors the "MQTT-only vs. hybrid" tension seen in E62's broker-introspection notes).

**Proposed scope — MVP vs. later tier:**
- **MVP (single-segment / whole-strip control):** reuses material-light's proven shape — on/off, brightness, RGB colour, one active effect + one active palette selector (from the static bundled list) — published as a single JSON payload to `<base>/api`. Covers the common "one WLED strip = one light" case with the least new machinery.
- **Later tier:** full segment list (custom inspector), preset/playlist recall buttons, per-segment live preview.

**Family split:** Device/Glass/Metro share the identical MQTT contract (mirrors how glass-light/material-light already share theirs) — only the chrome differs: Device (material) gets the full brightness-ring/colour-wheel/effect-selector treatment consistent with material-light; Glass gets the frosted Apple-Home-style card; Metro gets the flat tile styling consistent with metro-light. Segment editing (later tier) is most naturally a Device/Glass feature — Metro's flat/simple aesthetic likely stays MVP-only (single segment), matching how Metro already omits some of Material's richer controls elsewhere in the light family.

**Relates:** material-light (attribute/contract template for MVP scope), glass-light / metro-light (sibling chrome), N31 (availability via LWT retained topic — a clean fit for the base-class approach), U39 (segment list = the textbook case for a custom inspector over flat attributes), E62 (same MQTT-only-vs-device-HTTP tension around discovering effect/palette names).

### E104 — Metro cover/shutter element (`feezal-element-metro-cover`)

The Metro family's missing cover/shutter control — light, climate, contact, occupancy, sensor, switch, media and tile all have Metro counterparts; cover is the gap (Material has `material-cover`, Glass has `glass-shutter`).

**MQTT contract mirrors `feezal-element-material-cover` 1:1** — the established cross-family convention, exactly as `glass-shutter` already does: `subscribe`/`message-property`/`publish` (position state/command), `publish-up`/`publish-stop`/`publish-down` + `payload-up`/`payload-stop`/`payload-down` (or single-topic `publish-command`/`payload-mode`), `subscribe-position`/`publish-position`/`message-property-position`, `min`/`max`/`invert`/`show-position`, tilt (`message-property-tilt`, `publish-slat-angle`, `slat-angle`/`slat-min`/`slat-max`), `json-map`, `label`, and availability (`subscribe-availability`/`message-property-availability`/`payload-available`/`payload-unavailable` — should adopt the N31 base-class mechanism once it lands).

**Visual concept:** flat Metro tile consistent with `metro-light` (palette `category: 'Metro'`, `icon: 'blinds'`) — front face shows the current position (e.g. a flat fill level or percentage in the Metro typographic style, no skeuomorphic slats); tap flips to the back with a position slider, up/stop/down buttons, and a tilt slider when configured, matching metro-light's front/back detail pattern.

**Ships with:** patch-versioned package registered in `www/package.json`, TESTING.md §6 entry with element-specific notes (back-face controls, tilt-only-when-configured, availability degrade).

**Relates:** material-cover (attribute-contract source), glass-shutter (the sibling that already proved the 1:1 mirror), metro-light (Metro tile chrome + flip-to-back pattern), N31 (availability base-class mechanism).

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

### U37 — Welcome wizard / first-run onboarding tour

A guided tour that appears on **first use** (fresh install, no dashboard content yet) and walks the user through the most important concepts in a few steps — fixing the blank-canvas problem without generating anything (deliberately lighter than U30's auto-generated dashboard).

**Interaction model: spotlight overlay.** The whole editor is dimmed by a translucent overlay with a **cutout highlighting the current step's UI region** (magnifier/spotlight effect); next to the cutout, a small card shows the step's explanation with **Next / Back / Skip tour** controls. The highlighted region stays interactive when the step asks the user to actually do something.

**Tour steps (first cut):**

1. **Palette** — spotlight the element palette: "these are the building blocks, drag them onto the canvas".
2. **Canvas** — spotlight the view canvas: free-form positioning, drag & resize.
3. **Inspector** — spotlight the attribute/style inspector sidebar: "select an element to configure it here".
4. **Deploy / View button** — spotlight the deploy + view controls: edit mode vs. the live viewer.
5. **MQTT broker setup** — open/spotlight the connection settings panel (`feezal-sidebar-viewer.js`) and guide the user through entering their broker URI (and credentials, if any); the panel's existing server↔broker status indicator gives immediate feedback that the connection works.
6. **Hands-on: first live element** — guided mini-exercise tying it all together:
   - drag a **`basic-template`** element onto the canvas,
   - configure its `subscribe` topic in the inspector (pointing at a topic that exists on the user's broker — the topic autocomplete helps here),
   - set example template content like `${msg.payload}°C`,
   - deploy/view → the user sees their first live MQTT value on a dashboard.

**Trigger & persistence:** shown automatically only when the editor starts with no meaningful prior state (no elements placed / first launch flag); the "seen" flag is persisted (server-side preferred over localStorage so it survives browser switches). Always skippable at every step, and **re-launchable manually** from the menu/help so it doubles as a feature refresher.

**Implementation notes:** candidate libraries for the spotlight mechanic: **driver.js** (MIT, lightweight, vanilla, cutout + popover out of the box) or Shepherd.js; alternatively a hand-rolled overlay (a fixed full-screen backdrop with a `clip-path`/box-shadow cutout tracking the target's bounding rect) — editor-only, so the dependency never reaches the viewer/export bundle. Steps that target sidebar panels must be able to **switch the active sidebar tab** before spotlighting. The hands-on step needs light event-driven progression (advance when the element lands on the canvas / the topic is set) rather than a plain "Next" click.

**Relates:** U30 (auto-generated starter dashboard — the heavyweight questionable sibling; the wizard is the low-risk answer to the same onboarding gap), U31 (device-first insertion), AI assistant (can answer follow-up "how do I…" questions after the tour).

### U38 — Topic browser sidebar panel

A new tab in the right sidebar (the icon-tab row in [feezal-app-editor.js](www/src/feezal-app-editor.js): inspector / themes / site settings / assets / packages / history / editor settings — plus **topics**): a **topic browser** so the user can comfortably find topics on the broker and **copy them to the clipboard** while wiring up elements — instead of switching to an external MQTT client.

**Inspiration: the she topic browser** ([hobbyquaker/she](https://github.com/hobbyquaker/she), `web/src/pages/MQTT.svelte`) — the proven feature set there:

- **Live collapsible topic tree** built from broker traffic; collapsed branches cost zero DOM nodes; each node shows the **last payload and timestamp** inline.
- **Filter box** — tokenized substring matching *and* MQTT wildcard patterns (`+`/`#`); while a filter is active the tree is replaced by a **flat sorted result list**, with retained-only topic snapshots injected alongside live matches.
- **Live message stream** — rolling feed of incoming messages matching the current filter (bounded ring buffers).
- **Context menu per topic** — **Copy topic** to clipboard; she also offers inspect and **clear retained** (publish empty retained, with a recursive option behind a confirm modal).
- **Publish form** — topic / payload / retain / QoS for quick manual testing.

**feezal first cut:** tree + filter + last payload/timestamp + copy-to-clipboard (the core "find a topic and use it" loop). Later tiers — live stream, publish form, clear-retained — overlap with E62's retained-browser guard rails (per-delete confirm naming the full topic) and should follow its dispositions.

**Data source:** the server already maintains a **topic trie from live MQTT traffic** feeding `/api/topics/completions` ([api.js](server/src/routes/api.js)). Options: extend the server API to expose a subtree with last payloads (retained across editor reloads, sees traffic from before the panel opened), or subscribe editor-side while the panel is open (live but empty on open). Likely a hybrid: trie snapshot for the initial tree, live subscription for updates while the panel is visible.

**Nice-to-haves:** drag a topic from the tree onto an inspector `mqttTopic` field (or onto a canvas element's primary `subscribe`); double-click to copy; per-node message-rate indicator.

**Relates:** **E62** (topic-tree browser — already decided there as "element + editor panel" with a shared tree component: *this is that editor panel*; the canvas element reuses the component), the `mqttTopic` autocomplete (E62 names the panel as the candidate upgrade path to a browsable picker), B28 (custom-inspector topic fields — the shared picker/autocomplete component serves both), U37 (welcome wizard step 6 — "find a topic" is exactly where a browser beats blind typing).

### U39 — Attribute inspector UX for attribute-heavy elements ⚠️ needs discussion

The attribute inspector of some elements is **chaotic** — a long flat list with no structure. Worst-case example: **`glass-climate`** with **~25 attributes** rendered flat: `payload-mode`, the json-mode fields (`subscribe`, `publish`, `json-map`, `message-property`), then per-function separate-mode pairs (`subscribe-setpoint`/`publish-setpoint`/`subscribe-actual`/`subscribe-mode`/`publish-mode`, each with its `message-property-*` twin), then range/display fields (`min`/`max`/`step`/`unit`/`modes`/`label`/`icon`), then the availability block. Depending on `payload-mode`, **roughly half of these fields are irrelevant at any given time** — but all are shown, distinguished only by "json mode: …" / "separate mode: …" prose in the help tooltips.

**Two possible directions — likely both, decided per element:**

**A — Improve the standard attribute editor (descriptor-driven, benefits every element):**
1. **Sections** — an optional `section:` field on attribute descriptors ([element-spec §3.2](element-spec.md)); the inspector renders collapsible groups (e.g. *Connection*, *Setpoint*, *Display*, *Availability*) instead of one flat list. Zero per-element UI code; N31's base-class availability attributes would land in their own section automatically.
2. **Conditional visibility** — a `visibleWhen: {attr, value}` (or predicate) descriptor field, so e.g. the `subscribe-setpoint`… group only shows when `payload-mode=separate` and `json-map`/`message-property` only in json mode. Encodes what today lives as tooltip prose; the single biggest de-clutter for glass-climate/glass-shutter/material-cover-style dual-mode elements.
3. **Advanced tier** — `advanced: true` on rarely-touched descriptors (the `message-property-*` twins, payload overrides) collapses them behind an "Advanced" disclosure per section.
4. Keep the existing type-specific inputs (mqttTopic autocomplete, color, select, icon picker) — they are fine; the problem is structure, not the individual controls.

**B — More custom inspectors (N6 pattern):** full-freedom panels like material-climate/material-light already have. Best-in-class UX for genuinely bespoke needs (item-list builders, embedded editors, live previews) — but per-element code, and B28 shows custom inspectors drift from the standard editor's affordances (missing topic autocomplete). Every new custom inspector is UI that must be maintained and audited separately.

**Recommendation to discuss:** do **A first** — sections + conditional visibility + advanced tier are one inspector change plus descriptor annotations, and probably fix 80 % of the chaos including glass-climate, with consistency for free. Reserve **B** for elements whose configuration is genuinely structural (lists of items, per-entry sub-forms — navbar, layouts, dialogs), not merely numerous. After A ships, audit the attribute-heavy elements (glass-climate, glass-shutter, glass-light, material-cover, material-climate, E20 weather when it lands, …) and decide per element whether annotated descriptors suffice or a custom inspector is warranted.

**Relates:** B28 (custom-inspector autocomplete gap — argues for fewer, better custom inspectors and shared building blocks), N31 (base-class availability attributes should render as a standard section), N6/§3.8 (custom inspector machinery), U17 (multi-select attribute intersection — sections must behave there too), element-spec §3.2 (new descriptor fields need spec'ing).

### U40 — Drag-and-drop reordering for `position:static` views 🔽 partial

Views with `child-position="static"` lay out their elements in normal document flow (no `top`/`left`), so the only thing that determines on-screen order is DOM order. There should be a way to reorder them by drag & drop, the same way absolute-position views let you drag elements freely.

**This is already partially wired up:** `_viewChanged()` in [feezal-sidebar-inspector.js](www/src/feezal-sidebar-inspector.js) branches on `view.childPosition === 'static'` and calls `_initSortable(view)`, which wraps the view with [html5sortable](https://github.com/lukasoppermann/html5sortable) (`items: '.feezal-element'`, placeholder class `feezal-placeholder`) — so elements in a static view can already be dragged to a new position visually.

**What's missing:** html5sortable emits `sortstart`/`sortstop`/`sortupdate` events, but `_initSortable` doesn't listen for any of them. As far as could be found there's no `feezal.app.change()` call (or equivalent dirty/undo-history hook) wired to the reorder, so:
- it's unclear whether a completed drag is picked up by the undo history the same way other edits are (compare `_reorderSelection()`'s Cmd+`[`/`]` front/back/forward/backward stacking-order commands for absolute views, which do call `feezal.app.change()`).
- selection state / the attribute inspector may not refresh to reflect the element's new position in the list after a drag.

Needs verification against current behaviour, then wiring `sortupdate` (or `sortstop`) to the same change/undo pipeline other mutations use.

**Relates:** U33 (Cmd+`[`/`]` stacking-order reorder for absolute-position views — the equivalent affordance to keep consistent with).

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

**Candidate tooling (July 2026, awesome-lit):**
- **Storybook for web-components** — the natural implementation of the **dev harness** bullet above *and* the visual **element catalog / gallery**: authors develop an element in isolation with live controls, and the same stories become the browsable community showcase. Strongest single tooling win here.
- **`@custom-elements-manifest/analyzer`** — generates a `custom-elements.json` API manifest from element source. Feeds author docs automatically, and could later drive inspector help text / attribute discovery from a single source of truth.
- **`lit-analyzer` + `eslint-plugin-lit` + `eslint-plugin-lit-a11y`** — template type-checking and **accessibility linting** for element authors; a quality gate for the ecosystem (and for feezal's own bundled elements).
- **`@lit-labs/virtualizer`** — virtual scrolling; not authoring tooling but the shared perf primitive for big lists (E32 logbook, E75 table).
- **`@lit/localize`** — i18n for Lit; there's no localization item on the roadmap yet — flag as a possible future entry if translating the editor/elements becomes a goal.

**Framework-agnostic authoring (a selling point to document):** because the N4 package manager just `npm install`s a `feezal-element-*` package and Vite-bundles it, a third-party element is **not required to use Lit** — any base (Stencil, FAST Element, Atomico, hybrids, or vanilla `HTMLElement`) works as long as the file `customElements.define()`s the tag and exports the `static get feezal()` descriptor. The `@feezal/feezal-element` base class is a *convenience* (it's Lit-based), not a hard contract. Worth stating explicitly in the author docs — it lowers the barrier for authors bringing components from another ecosystem. (Caveat: bundle size/dedup still favours matching feezal's Lit runtime.)

**Relates:** N23 (icon/theme packaging), U32 (components could later be shared through the same channel), E75/E32 (virtualizer consumers), N29 (element sets — the gallery distributes sets).

### A21 — Accessibility: adopt the web-components Gold Standard for feezal elements

*(Source: awesome-web-components, July 2026 — the Accessibility + Best-Practices clusters.)* feezal's interactive elements (dialogs, buttons, inputs, sliders, navbars) should meet a baseline of web-component accessibility rather than growing it ad hoc. The web-components community has settled resources to adopt:

- **The "Gold Standard Checklist for Web Components"** as the acceptance bar for interactive elements (focus management, keyboard operability, ARIA/roles, `disabled`/state semantics, no focus traps).
- **Shadow-DOM-specific a11y practices** the list documents: managing focus across shadow boundaries, accessible dialogs in shadow DOM (feezal's `material-dialog` / `dialog-view` — cross-ref **B25**), ID-referencing pitfalls, and the AOM/`ElementInternals` direction.

**Scope:**
- Add an **a11y section to `docs/element-spec.md`** (or a checklist doc) that authors must meet — the Gold Standard distilled to feezal's element types.
- Wire **`eslint-plugin-lit-a11y`** into the build as the automated gate (already flagged in A20 tooling).
- **Audit the bundled elements** against the checklist — keyboard operability for slider/range (E93), navbar/navrail roving focus (E80), dialog focus-trap + restore (B25), button `disabled`/`active` semantics (E79) — and fix the gaps.
- Consider **form-associated custom elements (`ElementInternals`)** for input-type elements so they participate properly where it matters.

**Relates:** A20 (`eslint-plugin-lit-a11y` tooling — this is the "why"), B25 (accessible dialog header/focus), E79 (button state/disabled semantics), E80/E93 (keyboard nav & sliders), element-spec.md (where the checklist lives).

---

## Open Questions

**Package Manager (N4 and N23 shipped — both archived)**
- ~~Icon-set contract: is a `feezal-icons-*` package a webfont + name list, registered SVG symbols, or both?~~ **Settled (N23):** both modes — `{font, names}` for ligature webfonts, `render(name)` for SVG — see `docs/icons-spec.md` §3.

**History-in-payload convention (E69, E70, comparison/ad-hoc trends)**
Several analytics elements need historical data feezal deliberately doesn't store (real history = E28/A11 Grafana). Middle ground to decide: a documented convention where an **external aggregator (she, Node-RED) publishes a retained JSON series to a topic and the element only renders it** — settle the series JSON shape once (timestamps + values, units, buckets?) and reuse it across carpet plot, Sankey totals, comparison charts, and possibly E30's future first-load backfill. Keeps feezal storage-free while unlocking the whole analytics category.

**Layout & responsive design**
See the design exploration earlier in this file — the view-in-view nesting concept is the likely foundation. Full responsive layout support is a longer-term goal; no decisions needed yet.

---
