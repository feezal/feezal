# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Table of Contents

**Bugs**
- *(none open — all reported bugs are fixed or closed; see the [archive](roadmap-archive/README.md))*

**Near-term Improvements**
- [N2b — Repeater with live canvas sub-elements](#n2b--repeater-with-live-canvas-sub-elements-future) *(future)*
- [N37 — Pause subscriptions of hidden views (bandwidth saver)](#n37--pause-subscriptions-of-hidden-views-bandwidth-saver)
- [N12 — Export bundle: strip mqtt.js for feezal-bridge users](#n12--export-bundle-strip-mqttjs-for-feezal-bridge-users-partial) *(partial)*
- [N13 — Lighter MQTT client for export bundle](#n13--lighter-mqtt-client-for-export-bundle-️-tbd) ⚠️
- [N38 — Site locale: localized number formatting (decimal separator & friends)](#n38--site-locale-localized-number-formatting-decimal-separator--friends)

**Element Ecosystem**
- [E7 — Swipe gesture element](#e7--swipe-gesture-element)
- [E20 — Weather forecast (`feezal-element-material-weather`)](#e20--weather-forecast-element-feezal-element-material-weather)
- [E28 — Grafana integration](#e28--grafana-integration)
- [E29 — Tile / compact state element (`feezal-element-material-tile`)](#e29--tile--compact-state-element-feezal-element-material-tile)
- [E30 — Mini live sparkline (`feezal-element-basic-sparkline`)](#e30--mini-live-sparkline-feezal-element-basic-sparkline)
- [E32 — Logbook / event list (`feezal-element-basic-logbook`)](#e32--logbook--event-list-feezal-element-basic-logbook)
- [E34 — Countdown / timer element (`feezal-element-basic-countdown`)](#e34--countdown--timer-element-feezal-element-basic-countdown)
- [E38 — Element scaling / responsive sizing](#e38--element-scaling--responsive-sizing-️-tbd--needs-element-audit) ⚠️
- [E54 — Markdown element (`feezal-element-basic-markdown`)](#e54--markdown-element-feezal-element-basic-markdown)
- [E57 — E-ink / mono element family (`feezal-element-eink-*`)](#e57--e-ink--mono-element-family-feezal-element-eink-) 💡
- [E61 — HMI / alarm element family (`feezal-element-hmi-*`)](#e61--hmi--alarm-element-family-feezal-element-hmi--️-reviewrefinement-needed) ⚠️
- [E62 — MQTT broker introspection family (`feezal-element-mqtt-*`)](#e62--mqtt-broker-introspection-family-feezal-element-mqtt-)
- [E63 — Plant-schematic symbol family (`feezal-elements-schematic`)](#e63--plant-schematic-symbol-family-feezal-elements-schematic)
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
- [E90 — Vaadin element family (`feezal-element-vaadin-*`)](#e90--vaadin-element-family-feezal-element-vaadin-) 💡
- [E91 — Theme switcher element (`feezal-element-system-theme-switch`)](#e91--theme-switcher-element-feezal-element-system-theme-switch)
- [E92 — PDF viewer element (`feezal-element-basic-pdf`)](#e92--pdf-viewer-element-feezal-element-basic-pdf) 💡
- [E93 — Range slider: min/max band (`feezal-element-material-range`)](#e93--range-slider-minmax-band-feezal-element-material-range) 💡
- [E94 — 3D model viewer (`feezal-element-basic-model`)](#e94--3d-model-viewer-feezal-element-basic-model) 💡
- [E95 — Configurable keyboard shortcuts for interactive elements](#e95--configurable-keyboard-shortcuts-for-interactive-elements)
- [E96 — MIDI input as an element trigger (Web MIDI)](#e96--midi-input-as-an-element-trigger-web-midi-️-questionable-future) ❓
- [E107 — Thermostat schedule elements (device week programs)](#e107--thermostat-schedule-elements-device-week-programs--blocked-by-upstream-homematic) 🚧 *(blocked by upstream — Homematic)*
- [E109 — evcc integration: native discovery + energy/charging elements](#e109--evcc-integration-native-discovery--energycharging-elements--to-refine) 💡 *(to refine)*
- [E110 — Server-side HTTP→MQTT poller (bridge for services with no MQTT)](#e110--server-side-httpmqtt-poller-bridge-for-services-with-no-mqtt--likely-out-of-scope) ❌ *(likely out of scope — breaks export/native apps)*
- [E111 — Pi-hole integration](#e111--pi-hole-integration--largely-dissolves-needs-a-user-provided-bridge) ❓ *(largely dissolves — needs a user-provided bridge)*
- [E112 — Scrypted integration: camera snapshot element](#e112--scrypted-integration-camera-snapshot-element-sensors-already-work--to-refine) 💡 *(to refine)*
- [E113 — Element taxonomy: make "function × style" explicit](#e113--element-taxonomy-make-function--style-explicit--needs-discussion) ⚠️
- [E114 — Family parity contract: material/circle / glass / metro stay in sync](#e114--family-parity-contract-materialcircle--glass--metro-stay-in-sync--needs-discussion) ⚠️
- [E115 — Switch an element to another family (context menu)](#e115--switch-an-element-to-another-family-context-menu--to-refine) 💡 *(to refine)*
- [E117 — `publish-local` on every publishing element](#e117--publish-local-on-every-publishing-element-partial--buttons--072026) *(partial — buttons ✅)*
- [E119 — `basic-number`: configurable placeholder before the first value](#e119--basic-number-configurable-placeholder-before-the-first-value)
- [E124 — Battery-powered sensors: dedicated low-battery indicator (contact + motion/occupancy)](#e124--battery-powered-sensors-dedicated-low-battery-indicator-contact--motionoccupancy)
- [E125 — Homematic battery voltage (`OPERATING_VOLTAGE`)](#e125--homematic-battery-voltage-operating_voltage--future) 💡
- [E128 — Homematic blinds: settling behaviour + `DIRECTION` indicator](#e128--homematic-blinds-settling-behaviour--direction-indicator-later--after-e127) *(later)*
- [E129 — metro-* family: expose font/icon sizes as CSS vars, larger icon defaults](#e129--metro--family-expose-fonticon-sizes-as-css-vars-larger-icon-defaults)
- [E130 — material-outlet: auto-discovery + rename to "Switch" (family consistency)](#e130--material-outlet-auto-discovery--rename-to-switch-family-consistency)
- [E131 — Homematic motion detector discovery → *-motion/occupancy elements](#e131--homematic-motion-detector-discovery--motionoccupancy-elements)
- [E132 — Generalize the boolean-sensor family: *-occupancy → *-sensor, numeric *-sensor → *-number](#e132--generalize-the-boolean-sensor-family--occupancy---sensor-numeric--sensor---number)
- [E133 — Palette category rename: "Material" → "Circle", "Simple" → "Material"](#e133--palette-category-rename-material--circle-simple--material)
- [E134 — Circle design language: align the remaining device cards with light/climate/cover/switch](#e134--circle-design-language-align-the-remaining-device-cards-with-lightclimatecoverswitch)
- [E135 — Homematic maintenance signals: ERROR_CODE + SABOTAGE badges, device-health board](#e135--homematic-maintenance-signals-error_code--sabotage-badges-device-health-board)
- [E136 — Metro tile backsides: redesign for touch — bigger targets, calmer layout, use the space](#e136--metro-tile-backsides-redesign-for-touch--bigger-targets-calmer-layout-use-the-space)
- [E137 — Shared MQTT device contracts: extract behavior controllers (climate / light / cover / wled)](#e137--shared-mqtt-device-contracts-extract-behavior-controllers-climate--light--cover--wled)

**Editor UX**

- [U3 — Element grouping and locking](#u3--element-grouping-and-locking-partial) *(grouping not yet done)*
- [U23 — Custom collapsed placeholder text in the source editor](#u23--custom-collapsed-placeholder-text-in-the-source-editor-blocked-by-upstream) 🚧
- [U30 — Auto-generated starter dashboard from MQTT discovery](#u30--auto-generated-starter-dashboard-from-mqtt-discovery-questionable-low-priority) ❓ 🔽
- [U31 — Device-first element insertion](#u31--device-first-element-insertion-) ⚡
- [U38 — Topic browser sidebar panel](#u38--topic-browser-sidebar-panel)
- [U45 — Element insertion: palette sidebar + full-screen picker](#u45--element-insertion-palette-sidebar--full-screen-picker--to-refine) 💡 *(to refine)*
- [U46 — Clippy easter egg in the help popup](#u46--clippy-easter-egg-in-the-help-popup--low-priority) 🔽
- [U48 — Make the viewer's `Connected as "…"` toast optional](#u48--make-the-viewers-connected-as--toast-optional)
- [U50 — layout-app: expose the content area's inset (padding)](#u50--layout-app-expose-the-content-areas-inset-padding)
- [U53 — View theme selector: same styled control as the site theme selector](#u53--view-theme-selector-same-styled-control-as-the-site-theme-selector)
- [U54 — Source editor opens at the current view's line](#u54--source-editor-opens-at-the-current-views-line)
- [U55 — View tab bar: hold-to-drag so clicks stop reordering views](#u55--view-tab-bar-hold-to-drag-so-clicks-stop-reordering-views)

**Architecture & Infrastructure**
- [A7 — Git versioning for data directory](#a7--git-versioning-for-data-directory-in-progress) 🔨 *(in progress — bookmarks + push remaining)*
- [A11 — Grafana panel plugin](#a11--grafana-panel-plugin-feezal-feezal-panel)
- [A12 — Export deployment targets](#a12--export-deployment-targets-low-priority) 🔽
- [A18 — Kiosk / wall-panel mode](#a18--kiosk--wall-panel-mode)
- [A19 — Security model: multi-user / ACL story](#a19--security-model-multi-user--acl-story-needs-discussion) ⚠️
- [A20 — Element/theme scaffolding and community ecosystem tooling](#a20--elementtheme-scaffolding-and-community-ecosystem-tooling)
- [A21 — Accessibility: adopt the web-components Gold Standard for feezal elements](#a21--accessibility-adopt-the-web-components-gold-standard-for-feezal-elements)
- [A23 — Externalize element families: own git repos + npm publish (paper, tui, panel)](#a23--externalize-element-families-own-git-repos--npm-publish-paper-tui-panel)
- [A24 — Externalize the metro element family](#a24--externalize-the-metro-element-family-future--will-be-done-later) *(future)*
- [A27 — i18n: editor localization + language-aware element defaults](#a27--i18n-editor-localization--language-aware-element-defaults--to-refine--needs-discussion) 💡 *(to refine)*
- [A28 — Configurable per-site CSP: "Security" tab in Site Settings](#a28--configurable-per-site-csp-security-tab-in-site-settings)
- [A29 — RTL layout support (Arabic, Hebrew)](#a29--rtl-layout-support-arabic-hebrew--future) 💡 *(future)*


---

## Bugs

*(none open — all reported bugs are fixed or closed; see the [archive](roadmap-archive/README.md).)*

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

### N38 — Site locale: localized number formatting (decimal separator & friends)

Numeric elements render `21.5` everywhere; a European dashboard should show `21,5`. Today only `basic-number` can — via its per-element `decimalSeparator` attribute with hand-rolled string replacement — and configuring a separator on every element of a 40-value wall panel is not a feature.

**Decided (07/2026, discussed): a site `locale`, not a separator toggle.** `Intl.NumberFormat` derives the separator (and grouping, ordering, everything else) correctly from a locale, and a locale is the **same primitive A27 needs** for language-aware label defaults and editor localization — one setting, three consumers, no config debt to unwind later.

- **Setting:** a `locale` attribute on `<feezal-site>` (BCP-47; serializes with the site, travels into exports). **Default: empty = browser locale** (`navigator.language`) — zero-config correctness; a German browser shows `1,5` immediately. This deliberately changes what unconfigured European dashboards render (that IS the fix); explicit per-element settings keep winning.
- **Mechanism:** a shared helper in `@feezal/feezal-element` — `feezal.formatNumber(value, {digits, grouping})` — reading the site locale, caching one `Intl.NumberFormat` per (locale, options). Elements adopt it in place of `toFixed()`/concat. Per-element overrides stay authoritative: `basic-number.decimalSeparator`, `basic-datetime.locale` (which additionally gains the site locale as its FALLBACK instead of the browser default it hardcodes today).
- **Grouping (decided): supported, per-element opt-in** — a `grouping` boolean attribute (default off) on the value-display elements; the separator localizes always, but `1234 W` on a wall panel often reads better ungrouped than `1.234 W`.
- **V1 adoption scope (decided): the value-display surfaces** — `basic-number`, the glass/metro number cards (E132's renames), `material-gauge`, `material-tank`, climate setpoint/actual readouts (all three families), `material-computer-stats`. Slider value labels, input elements and inspector previews follow later.
- **UX:** Site Settings → Site tab, one select showing locales **by example** — *Automatic (browser language)*, `1,234.56 — English`, `1.234,56 — Deutsch`, `1 234,56 — Français`, … — with a live preview line; a free-text BCP-47 input behind "custom". Nobody types `de-DE` unless they want to.

**A27 relation (explicit):** this item **introduces the site `locale` attribute; A27 consumes it** — its phase-1 language-aware element defaults ("Ein/Aus") and editor-chrome localization key off the same attribute (editor language may still deserve its own editor-level setting — an editor used in English can build German dashboards; note in A27). Ship this first: it is small, self-contained, and hands A27 its foundation.

**Ships with:** helper unit tests (locale resolution order: element attr → site attr → browser; caching; grouping flag), per-element adoption tests for the v1 scope, TESTING.md (site locale switch re-renders values; German locale shows commas in viewer AND export; per-element `decimalSeparator` still wins), and an element-spec section ("format numbers via `feezal.formatNumber`, never `toFixed` + concat").

**Relates:** **A27** (i18n — consumes the site locale introduced here; keep the two aligned), E132 (the number cards in the v1 scope), **E114** (parity — number formatting must behave identically across families), basic-datetime (locale fallback), E119 (basic-number placeholder — same element, coordinate).

### N2b — Repeater with live canvas sub-elements *(future)*
Each repeater child becomes individually selectable and configurable on the editor canvas. Requires a virtual sub-editor context — significantly more complex, deferred until the MVP repeater is proven useful.

### N37 — Pause subscriptions of hidden views (bandwidth saver)

**Goal:** the viewer only receives the topics it actually needs. Today **every** element of **every** view subscribes on load and stays subscribed — hidden views' elements consume bandwidth forever. On wall tablets and metered/slow links that adds up.

**Feasibility (verified 07/2026 — the groundwork exists):**
- The connection layer **ref-counts subscriptions**: broker/server-side subscribe happens only for the first subscriber of a topic, unsubscribe when the last leaves ([feezal-connection.js:167-211](../www/src/feezal-connection.js#L167-L211)) — pause/resume plugs into an existing mechanism.
- The connection keeps a **retained-value cache with late-subscriber replay** (B40, [feezal-connection.js:143-192](../www/src/feezal-connection.js#L143-L192)): a resubscribing element **repaints instantly from cache**, then heals from the broker's retained redelivery. Resume is visually seamless for retained topics.
- Elements already unsubscribe in `disconnectedCallback` — dialog-view/layout-app **clone teardown is correct today**; the waste is the *hidden originals* (connected, `display:none`) and scrolled-out elements.
- **Verification item:** confirm the feezal/socket backend honours per-client subscription lists server-side (so unsubscribe actually stops socket traffic, not just local dispatch); direct-MQTT connections trivially benefit.

**Decided (07/2026):**
- **View-level granularity (MVP):** a view is "visible" or not; all its elements pause/resume together. Elements in a visible view stay subscribed even when scrolled out — **element-level pausing** (IntersectionObserver/`checkVisibility()` per element) is a **later tier**, as is page-level pausing on `document.visibilityState` (tab in background).
- **Config: site default + per-view override.** Site setting `pause-hidden-subscriptions` (default **off** — backwards compatible); per-view tri-state `pause-subscriptions` = `inherit` | `always` | `never`. **`never` is the escape hatch for views with non-retained data** that must not miss messages while hidden.
- **Viewer only.** The editor keeps today's always-subscribed behaviour (inspectors/conditions on hidden views stay live).
- **Grace period, configurable:** site setting `pause-grace-seconds` (default **30**) — a view must stay hidden that long before its topics unsubscribe, so quick back-and-forth navigation doesn't churn. **Resubscribe on show is always immediate.**

**Visibility model (the hard part — must cover every embedding path):** "visible" is decided by a small central controller (`feezal.visibility`) in the viewer, not by each element guessing from CSS:
- The **site's active view** is visible (hash/MQTT/playlist switching all funnel through the existing active-view machinery).
- **Embedded views** (layout-app, layout-view, dialog-view, flex regions) render as **clones** — clone elements subscribe on connect and unsubscribe on removal, which is already correct. The **originals** of embedded views are never shown in the viewer → they pause under `inherit`.
- **Non-retained + embedding interplay** (why `never` matters even for embedded views): a freshly stamped clone can only replay what the connection cache holds. A view marked `never` keeps its **original's** subscriptions alive, keeping the cache warm, so a later clone starts with the last-seen values. **Verify the B40 cache stores the last value for non-retained messages too while a subscriber exists — if it only caches broker-retained ones, extend it for held topics** (this is the load-bearing detail of the `never` mode).
- Elements stamped *into* an already-paused context (late clones, conditions unhiding) must consult the controller **before** subscribing in `connectedCallback` — pause state is a precondition, not only an event.
- Availability subscriptions (N31 machinery) pause/resume together with the element's data subscriptions.

**Mechanism sketch:** `FeezalElement` gains `_pauseSubscriptions()` / `_resumeSubscriptions()` (re-running the element's normal wiring); the controller tracks active view + settings, walks the affected view's subtree (all feezal elements incl. component instances) on visibility change, applies the grace timer per view, and exposes `isVisible(el)` for the connectedCallback precondition.

**Ships with:** TESTING.md section (pause after grace, instant repaint on return via cache replay, `never` view keeps receiving, non-retained survival via warm cache, dialog/layout-app embeds, editor unaffected), docs for the two site settings + view attribute.

**Relates:** B40 (retained cache/replay — the resume mechanism), N31 (availability subscriptions pause too), layout-app / dialog-view / layout-view (embedding paths), N12/N13 (the other bandwidth items), A18 (kiosk/wall tablets — the main beneficiary), U51 ✅ (per-view settings precedent on `feezal-view`).

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

**Implementation spec (decided 07/2026 — implementation-ready):**
- **Timestamp parsing (`target-timestamp` / `count-up` modes), auto-detected:** numeric payload `< 1e12` → Unix seconds, `≥ 1e12` → milliseconds; non-numeric string → `Date.parse()` (ISO). Unparseable → show `--:--`, never throw. **Clock-skew caveat** (ℹ help): these modes compare against the *client* clock — a wrong tablet clock shifts the countdown; `seconds-remaining` mode is immune.
- **Ticking:** 1 s interval, but remaining time is always recomputed from `Date.now()` against the anchor (target timestamp, or value+receive-time in `seconds-remaining` mode) — no cumulative interval drift. Interval paused when the element is disconnected.
- **`publish-on-zero` semantics (decided: keep + document):** arms only after a value `> 0` has been seen, fires exactly **once** on the transition to `≤ 0`, and never fires on load when the first (retained, stale) value is already `≤ 0`. **Multi-viewer caveat documented in the ℹ help:** every open viewer publishes at zero (2 tablets = 2 messages) — consuming automations must tolerate duplicates (or use a retained flag). Re-arms when a new value `> 0` arrives.
- **Rendering:** monospace digits (`font-variant-numeric: tabular-nums`), SVG progress ring (or bar when the element box is much wider than tall — container query, same trick as E105); `warn-seconds` switches digits+ring to `--error-color`. At zero: `done-label` replaces the digits, ring full/empty per mode.
- **Styles (§5.1 canonical vars):** digits `--primary-text-color`, ring `--primary-color`, warn `--error-color`, done-label `--secondary-text-color`.

**Editor preview:** static `12:34` digits with a ring at ~40 %; no ticking in the editor.

**Default size:** 160×100 px.

**Ships with:** standard element scaffolding + patch version, TESTING.md §6 entry (all three modes, format auto, warn transition, publish-on-zero arm/fire-once/stale-retained no-fire, editor preview).

**Deferred:** pause/reset control payloads (start/stop the stopwatch via MQTT), server-side deduped publish-on-zero.

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

### E63 — Plant-schematic symbol family (`feezal-elements-schematic`)

State-driven equipment symbols for plant/heating schematics — each bound to a topic with states (running/stopped/fault → colour/animation), plus FlowChief's killer piece: an **animated-flow pipe polyline**. Home use cases: heat-pump, solar-thermal, ventilation, and pool schematics. Validation: ThingsBoard added exactly this category in 3.7+ (SCADA symbol bundles); Ignition's community begs for more symbols. E51 (`basic-svg`, **shipped**) stays the power-user path (import any schematic, bind ids); E63 is the canned library on top of the same binding concepts.

**Decided (07/2026):**
- **MVP symbol set** (all four groups): **pump** (circle symbol, rotates while running), **valve** (open/closed/position, incl. 3-way variant), **fan/motor** (rotating fan blades — ventilation), **sensor flag** (small value+unit readout flag to pin onto schematics), and the **pipe-flow polyline**.
- **Appearance: simple/modern first** — clean flat symbols matching feezal's dashboard aesthetic. The switchable appearance-theme mechanism (P&ID schematic / skeuomorphic mimic as site-wide restyle) stays the design goal but ships **later as themes on top**; symbols must therefore draw everything from CSS custom properties from day one so a later appearance theme is pure CSS.
- **Packaging: one N29 family bundle** — `@feezal/feezal-elements-schematic` (multi-element package, `feezal.elements` manifest) rather than five single-element packages: the symbols share their state machinery, SVG helpers and styling, and nobody wants a pump without a pipe. (The N29 `feezal-elements-*` mechanism is implemented in the server scan.)
- **Born external (decided 07/2026):** this family lives in its **own GitHub repo** (`feezal/feezal-elements-schematic`) and is **published via npm** from day one — it never enters `www/packages/` in the feezal core repo. Follow the rail template and the A23 per-family checklist (repo scaffold, CI + `publish.yml` version-compare workflow, PUBLISHING.md, initial manual `npm publish --access public`, npmjs.com Trusted Publisher/OIDC config for the package). Installed on demand via the packages sidebar — keeping the element categories shipped with feezal small.

**Implementation spec:**
- **Common state contract** (pump/fan/valve): `subscribe` + `message-property`, `payload-on`/`payload-off` (dual-payload convention), optional `subscribe-fault`/`payload-fault` (fault overrides state, symbol turns `--error-color` + badge). Pump/fan: optional `subscribe-speed` (`speed-min`/`speed-max` scaling, B26 pattern) driving the rotation animation speed. Valve: either binary open/closed or `subscribe-position` 0–100 % (fill-level rendering); 3-way via a `variant` attribute.
- **Sensor flag:** `subscribe`, `message-property`, `unit`, `decimals`, `label` — a leader-line flag styled to sit on top of pipes/symbols.
- **Pipe flow (`schematic-pipe`):** `points` attribute (JSON array of `[x,y]` pairs, relative to the element box, straight segments) rendered as an SVG polyline; **animated dashes** (CSS `stroke-dashoffset` keyframes) show flow. `subscribe-flow`: numeric payload — sign flips direction, magnitude scales animation speed (`flow-max` for scaling, `0` = animation off); `payload-on`/`payload-off` alternative for binary flow. Styles: pipe colour (`--feezal-schematic-pipe`, default `--secondary-text-color`), active-flow colour (default `--primary-color`), width. **Path editing is the JSON attribute in MVP** — a visual drag-handle path editor is deferred (N34/E51 territory).
- **Animation discipline:** all rotation/flow animation is pure CSS, paused in the editor (static preview) and honouring `prefers-reduced-motion`.
- **Styles (§5.1):** every colour a `--feezal-schematic-*` custom property defaulting to canonical theme vars (running → `--primary-color`, stopped → `--secondary-text-color`, fault → `--error-color`) — this is what makes the later appearance themes possible.

**Ships with:** the N29 bundle package + registration + manifest, patch/lockstep versioning, TESTING.md §6 entries per symbol (state colours, fault override, rotation speed, pipe direction flip, reduced-motion, editor-static preview).

**Deferred:** damper, vessel, heat exchanger symbols (second wave), P&ID + mimic appearance themes, visual pipe-path editor, E61 alarm-badge integration.

**Relates:** E51 (shipped — shared binding concepts, power-user alternative), N29 (family-bundle packaging), E61 (alarm badge on symbols — deferred hook), E56 (gauge styling discipline), B26 (speed/position scaling pattern).

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

Parking lot for further **off-the-shelf web-component UI libraries** that could each back a future `feezal-element-<category>-*` family, evaluated but not prioritised over Spectrum (E83) and Wired (E84 — since shipped, see [roadmap-archive/E84.md](roadmap-archive/E84.md)). All are framework-agnostic custom elements wrappable the same way as paper/material; the recurring trade-offs are **bundle cost**, **Lit-nativeness** (cleanest integration), and how well their design tokens map onto feezal themes.

- ~~**IBM Carbon**~~ — ✅ **promoted and implemented (July 2026)** as the built-in `feezal-element-carbon-*` family (button/switch/checkbox/slider/select/input, wrapping `@carbon/web-components`); see [roadmap-archive/E98.md](roadmap-archive/E98.md) for scope, token mapping and the measured bundle cost.
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

### E91 — Theme switcher element (`feezal-element-system-theme-switch`)

feezal ships many themes but has **no in-viewer control to switch them** — the theme is chosen in the editor. A viewer-facing switcher lets end users flip light/dark (or pick among installed themes) on the running dashboard.

**Decided (07/2026): three modes in MVP** — `toggle` (light/dark), `select` (theme picker dropdown), `auto` (follow OS `prefers-color-scheme`). **MQTT sync (subscribe/publish) is deferred.**

**Implementation spec:**
- **Switch mechanism:** themes apply via a `<link href="/themes/<name>.css">` swap — the editor already does exactly this ([feezal-app-editor.js:433-439](../www/src/feezal-app-editor.js#L433-L439), `feezal-user-theme-link`). Extract that into a small shared `feezal.applyTheme(name)` helper usable by the viewer, and the element calls it. Verify the theme CSS files are present under the same path in the **static export** (the export must ship all installed themes, or at least the ones the element references — check `createExport()`), else document export limitation.
- **Attributes:** `mode` (`toggle` | `select` | `auto`, default `toggle`), `theme-light` + `theme-dark` (theme names used by `toggle` and `auto`), `default-theme` (initial theme when nothing persisted; empty = the site's editor-chosen theme), `persist` (boolean, default `true`).
- **Persistence & precedence:** persisted client choice (`localStorage`, key scoped per site) → `default-theme` attribute → the site's editor-set theme. `auto` mode is a **pure follower** of `prefers-color-scheme` (live via media-query listener) and never persists — keeping the override semantics trivial; users who want manual control use `toggle`.
- **U51 integration (per-view themes, ✅ shipped 07/2026):** an active user choice must set `feezal.site._themeOverride` (the site's `theme` control command already does this — reuse `applyControlCommand('theme', …)` rather than swapping classes directly) so per-view themes are suppressed while the user's pick is active. The `select` picker **must include a "Site default" entry** that clears the override (`applyControlCommand('theme', 'default')`) — that path restores the baked site theme AND re-enables per-view themes.
- **Picker source (`select` mode):** the installed-theme list surfaced by the existing theme machinery (`window.feezal.themes`; verify it's populated in the viewer, not only the editor — if not, expose it there).
- **Rendering:** `toggle` = sun/moon icon button; `select` = a small `sl-select` of theme names; `auto` = renders a passive indicator (or nothing — `display:none` viewer-side, chip in editor). Editor mode: control renders but is **inert** (editor theme is not affected); standard palette element, normal position/size.
- **Styles (§5.1):** icon/track colours as `--feezal-theme-switch-*` custom properties defaulting to `--primary-text-color` / `--primary-color`.

**Ships with:** standard element scaffolding + patch version, TESTING.md §6 entry (all three modes, persistence across reload, precedence order, OS-scheme flip in auto mode, export behaviour, editor inertness).

**Deferred:** MQTT sync — `subscribe`/`publish` of the theme name for cross-viewer sync and automation-driven switching (dark after sunset); per-view theme overrides.

**Relates:** the theme system (`window.feezal.themes`, theme packages, the editor's link-swap this generalises), A18 (kiosk/wall-panel — auto dark/light there), E50 (conditions could drive theme once MQTT sync lands), E71 (icon-value — the toggle's sun/moon glyphs).

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

### E107 — Thermostat schedule elements (device week programs) 🚧 blocked by upstream (Homematic)

Elements to **view and edit the week program stored *in* a thermostat** — HmIP, BidCoS, and zigbee2mqtt TRVs. Distinct from the existing `material-schedule` element, which edits a *generic* schedule JSON on a retained topic and leaves execution to a consumer (Node-RED, she, …): here the schedule lives **on the device** and the element's job is reading/writing the device-native format. The drag-to-paint week-grid UI of material-schedule is the natural starting point for the editor surface (reuse/extract, don't reinvent — see E106's shared-code direction); what differs is the wiring layer: per-ecosystem **format adapters** behind one editor UI.

**Homematic (HmIP + BidCoS) — 🚧 blocked by upstream.** Week programs live in the **MASTER paramset** (confirmed in E102's analysis: MASTER = configuration incl. week programs — BidCoS: 13 `ENDTIME_`/`TEMPERATURE_<DAY>_1…13` slot pairs per day; HmIP: the same shape × three switchable profiles, `P1_`/`P2_`/`P3_`-prefixed — *verify exact parameter names at implementation time*). Two gaps in the MQTT path:
- **Write** should already work via the E102 paramset topic with the MASTER key — `hm/paramset/<channelNameOrAddress>/MASTER` with a JSON object payload (needs verifying that the bridge accepts MASTER there, not only VALUES).
- **Read is the blocker:** the Homematic↔MQTT interface currently **does not publish MASTER paramsets at all**. Upstream options: **(a)** publish MASTER paramsets (retained) at startup and after every change, or **(b)** an explicit **get-mechanism** — publishing to e.g. `hm/get-paramset/<channel>/MASTER` triggers a `getParamset` and a one-shot publish of the result (lighter, avoids retaining large config blobs for every channel). Whichever lands must be **coordinated across the ecosystem**: the hm2mqtt-style interface itself, plus **RedMatic** and **node-red-contrib-ccu** so the same read/get contract exists everywhere. Until that upstream work exists, the Homematic half of this element cannot ship — hence the 🚧 marker.

**Zigbee2mqtt — partial, per-device (checked 07/2026 against the z2m device database):**
- **Sonoff TRVZB**: exposes `weekly_schedule_sunday` … `weekly_schedule_saturday`, payload = space-separated `HH:mm/temperature` transitions (first transition must be `00:00`, 4–35 °C in 0.5° steps). **Write-only** — z2m documents that `/get` is not possible, so the editor cannot display the device's actual current schedule; it must keep its own shadow (e.g. a retained mirror topic written alongside the device write) and treat the device as a write-only sink.
- **Bosch Radiator Thermostat II (BTH-RA)**: **no schedule exposure at all** — only `operating_mode` (`schedule`/`manual`/`pause`, i.e. selecting whether the internally-stored schedule runs) and a read-only `setpoint_change_source`. Editing the schedule itself is app/device-only today → would need an upstream zigbee-herdsman-converters contribution (the Zigbee thermostat cluster's SetWeeklySchedule commands) before feezal can do anything.
- **HA autodiscovery does not help:** the discovery `climate` schema carries setpoint/mode/temperature only — schedule attributes are separate z2m expose entries and never part of the discovery payload, so N31/E102-style discovery mapping cannot stamp schedule wiring automatically; per-device adapter presets it is.
- Consequence: z2m support is feasible **today** for devices that expose schedule attributes (TRVZB pattern), with the write-only-shadow caveat; a device matrix (which z2m TRVs expose what) should be collected during refinement.

**Element concept:** one schedule-editor element (per visual family as needed, following the E102/E106 conventions): week grid with paint/drag editing, per-day slot list honouring the backend's constraints (max 13 slots and end-time semantics for Homematic; transition-list semantics for z2m), day-copy, and for HmIP a **profile selector** (P1–P3). Backend selected via an adapter/profile stamped from the inspector (E102's profile-picker pattern; ℹ help texts explaining MASTER vs VALUES and the read/get mechanism, per E102's help-text convention). Local-edit state with an explicit **Save/write** action (schedules are config, not live values — no publish-on-every-drag), plus a dirty indicator when the shadow and the (readable) device state diverge.

**Ships with:** package(s) per element conventions, TESTING.md §6 entry (grid editing, slot limits, profile switching, write-only shadow behaviour), patch/registration per policy.

**Relates:** E102 (paramset topic + VALUES/MASTER distinction, profile stamping, device matrix — this entry extends that groundwork to MASTER), material-schedule (editor UI to reuse; docs/schedule-format.md JSON contract as the shadow-format candidate), E106 (shared editor surface extraction), N31 (discovery — explicitly *not* usable for schedules, documented above), U39 (attribute-heavy inspector UX — a schedule adapter config is exactly that).

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

### U31 — Device-first element insertion ⚡

A second palette tab / picker mode listing discovered devices; choosing a device creates the matching pre-wired element (inverse of today's flow) — inspired by HA 2026.6's entity-first card picker.

> **Promoted (07/2026) — the "revisit only with concrete user demand" clause has fired.** This entry previously read *"the existing workflow is good enough… low value"*. **User testing showed people actively want device-first insertion**, so the questionable/low-priority markers are dropped. The old objection (palette/DnD complexity) is also much weaker now: **E108** shipped native discovery for whole families of real devices (Homematic climate/contact/cover/light, WLED), so there is now a genuinely populated device list to insert *from* — the feature has content it didn't have when it was first written.

**How it should work (given E113).** With the **function × style** axes made explicit, device-first insertion is simply the two axes *in the other order*: **pick a device → pick a look**. Today's flow is pick-a-look-then-bind; device-first is pick-the-thing-then-style-it. Both should exist and share one picker, rather than device-first being a bolted-on second tab:
1. User picks a discovered device (grouped by source: Homematic, zigbee2mqtt, WLED, evcc…).
2. feezal proposes the matching **function** (light / climate / cover / contact / sensor) from the discovery entity's `component`.
3. User picks the **style family** (material / glass / metro / plain), defaulting to the site's most-used family.
4. The element is created **pre-wired** — exactly the attribute stamping `_applyDiscovery` already does, just triggered at insert time instead of after.

**Note:** step 4 is essentially free — the discovery→attribute stamping already exists and is well tested; the new work is the picker flow and the function→family resolution, not the wiring.

**Relates:** **E113** (function × style — this is that model applied to insertion), **U45** (the picker this should live inside, not a separate tab), **E108** ✅ (native discovery — supplies the device list), U30 (auto-generated starter dashboard — same onboarding theme, revisit together), E114 (family parity — makes step 3 a safe choice rather than a commitment).

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

### U45 — Element insertion: palette sidebar + full-screen picker 💡 to refine

The left palette is a poor place to *browse* a catalog that now spans many families and dozens of elements — it's narrow, filtering was weak (**B42** ✅ fixed — name/category/family now all match), and finding the right element requires knowing where it lives. But the sidebar has one irreplaceable strength: **drag-to-canvas**, which places the element exactly where the user wants it.

**Decided (07/2026): ship both, and make it configurable in Editor Settings.**
- **Palette sidebar** — keep, and rework: tab switcher at the top, better grouping and tiles (family/category filtering: B42 ✅ fixed). Retains drag-to-canvas.
- **Full-screen picker** — an **Add element** button in the top bar (and, suggested, double-click on empty canvas) opening a large, searchable modal with room for previews, descriptions, family switching and **device-first insertion (U31)**. Inserts at a sensible default position (canvas centre / last click point).
- **Editor Settings** decides which surfaces are active (sidebar only / picker only / both).

> **Trade-off, recorded deliberately:** a user-facing toggle means two insertion surfaces to design, test and document forever, and "which one is on" becomes a support question. Accepted knowingly — the two genuinely serve different needs (precise placement vs. browsing a big catalog) and neither fully replaces the other. If the setting proves unused in practice, collapsing to "both, always" is the natural simplification.

**Depends on E113** for its structure: the picker should filter on **function × style**, which is what makes a large catalog navigable (B42 ✅ gave the filter substring family/category matching; the taxonomy makes it structural).

**Relates:** **E113** (taxonomy — the picker's information architecture), **U31** (device-first insertion — a mode *inside* this picker, not a separate tab), B42 ✅ (filter bug — fixed standalone 07/2026, subsumed here), U24 ✅ (collapsible categories), U32 ✅ (site-specific Components category — must appear in both surfaces), B20 ✅ (palette drag → snap machinery to preserve).

### U46 — Clippy easter egg in the help popup 🔽 low priority

Optional, off-by-default **Editor Settings** toggle that adds a paperclip assistant — a deliberate homage to the late-90s Microsoft Office assistant — to the help popup. Purely a joke feature.

**Constraints:** must be **opt-in**, must not interfere with the actual help content, and the artwork must be **self-drawn/self-hosted** (an original paperclip, not Microsoft's asset — trademark/copyright) and bundled locally per A25 ✅ (no CDN — implemented 07/2026). Respect `prefers-reduced-motion` if it animates.

**Relates:** B43 ✅ (help popup bug — was the blocker, fixed 07/2026), A25 ✅ (self-hosted assets — implemented 07/2026), U37 ✅ (welcome wizard — the other "friendly onboarding" surface).

### U48 — Make the viewer's `Connected as "…"` toast optional

Every viewer load pops a `Connected as "<client-id>"` toast ([feezal-presence.js:215](../www/src/feezal-presence.js#L215)). On a wall-mounted or kiosk dashboard — the case feezal is most often used for — that is noise on every reload, and there is currently no way to silence it short of turning presence **off** entirely (Site Settings → Viewer presence, `presence="off"` — [feezal-sidebar-viewer.js:647-651](../www/src/feezal-sidebar-viewer.js#L647-L651)). That is far too blunt: it also drops the retained status publish and the whole per-client command subtree (`view · reload · theme · playlist · addclass · removeclass · rename`), which users very much want to keep.

**Wanted:** a separate switch in **Site Settings → Viewer presence** — "Show connection toasts" (default on, so existing behaviour is unchanged) — writing a `presence-toasts="off"` attribute on `<feezal-site>` alongside the existing `presence` attribute. Presence keeps working; only the on-screen notifications go quiet.

**Scope decision to make when implementing:** `feezal-presence.js` raises three toasts, and they are not equally noisy —

- `Connected as "<id>"` on every start ([feezal-presence.js:215](../www/src/feezal-presence.js#L215)) — pure noise on a kiosk, definitely gated.
- `This viewer is now "<id>"` after a rename ([feezal-presence.js:201](../www/src/feezal-presence.js#L201)) — confirms a deliberate editor-initiated action; gating it is reasonable but it is not what the user is complaining about.
- `"<id>" is already online in another browser` ([feezal-presence.js:153](../www/src/feezal-presence.js#L153)) — a **sticky diagnostic warning** about an ID collision that silently doubles every command. Suppressing this hides a real misconfiguration; recommend it stays on regardless, or gets its own setting.

**Implementation notes:** gate inside `toast()` ([feezal-presence.js:104](../www/src/feezal-presence.js#L104)) rather than at each call site if all three are covered, otherwise gate per call. Read the attribute through a helper next to `presenceEnabled()` ([feezal-presence.js:54-57](../www/src/feezal-presence.js#L54-L57)) so the site-attribute contract stays in one place. The viewer bundle carries no UI library — these toasts are plain DOM, so there is no component-level `open` prop to lean on.

**Relates:** N24 ✅ (viewer presence + per-client control topics — the feature these toasts belong to), `docs/presence.md` (documents the `presence` attribute; needs the new one), U-viewer-settings (Site Settings panel this switch lands in).

### U50 — layout-app: expose the content area's inset (padding)

The embedded view sits flush against the app bar and drawer — there is no way to give the content area breathing room. `.content` carries no padding and none is configurable ([feezal-element-layout-app.js:155-156](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L155-L156)); the only workaround is baking margins into every embedded view, which then differ per view and break when a view is embedded somewhere else.

**Wanted:** a `--feezal-app-content-padding` entry in the element's `styles` descriptor (default `0`), alongside the existing `--feezal-app-*` knobs ([feezal-element-layout-app.js:54-66](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L54-L66)), applied to `.content`.

**Padding, not margin.** `.content` is a flex child with `flex: 1`; a margin would shrink the box *and* sit outside the background, leaving an unpainted gutter between the drawer and the view. Padding keeps the inset inside the painted area, which is what "content margin" visually means here.

**Implementation notes:**

- `.content` needs `box-sizing: border-box` — it currently has none, and `#content` inside it is `width: 100%; height: 100%`. Without it the padding adds to the 100 % and `overflow: auto` turns into permanent scrollbars.
- The embedded view's own background is copied onto `.content` at embed time ([feezal-element-layout-app.js:342-348](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L342-L348)), so it will paint under the padding — correct for a bar/drawer-to-content inset, but worth a deliberate look if a per-side value is ever wanted.
- Accept a full CSS shorthand (`8px`, `8px 16px`, …) rather than a number, so per-side insets need no extra knobs.

**Relates:** E-layout-app (the shell), N36 (the `--feezal-app-*` style-var set this extends), E38 (element scaling / responsive sizing — a responsive inset would belong there).

### U53 — View theme selector: same styled control as the site theme selector

The U51 ✅ per-view `theme` attribute renders as a **plain generic dropdown** (full class names like `feezal-theme-solarized-dark`) in the view inspector, while the **site** theme selector in the themes sidebar ([feezal-sidebar-themes.js](../www/src/feezal-sidebar-themes.js)) is the nice one: **shortened names** (`pkgToLabel` strips the `feezal-theme-` prefix) plus **three colour swatches per theme** (base colours read from the theme's CSS custom properties, `DEFAULT_SWATCHES` for the built-in default). The two should be **exactly the same control**.

**Implementation:**
- **Extract the themes sidebar's option rendering into a reusable component** (e.g. `<feezal-theme-select>`): shortened label + swatch row per option, the swatch-extraction/caching logic (the sidebar already reads each theme's custom properties by temporarily applying it — reuse, don't duplicate), an empty option for "site theme" (view case) with neutral styling, and a `value`/`change` contract compatible with the inspector pipeline.
- **Themes sidebar** switches to the shared component (visual no-op there — it's the donor).
- **View inspector**: the generic attribute inspector currently renders the `theme` descriptor as a plain `dropdown` ([feezal-view.js:88-94](../www/src/feezal-view.js#L88-L94)). Render the shared component instead — via the E102-WP3 `type: 'custom', component:` descriptor hook if that has landed, else a small special-case (`type: 'theme'`) in [feezal-sidebar-inspector-attributes.js](../www/src/feezal-sidebar-inspector-attributes.js). Emits through the normal change pipeline (dirty + undo) exactly like the dropdown did.
- Both places must stay in sync by construction afterwards — one component, two mounts (the E106 shared-building-block lesson applied to editor UI).

**Ships with:** TESTING.md update in the per-view-theme section (swatches + shortened names in the view inspector, selection still round-trips incl. × clear, sidebar unchanged visually).

**Relates:** **B50 ✅** (per-view theme bugs — fixed separately: the dropdown's `emptyOption` "Site theme (default)" entry + × clear and the layout-app shadow-root CSS mirroring are in place; the new control must preserve both), U51 ✅ (the per-view theme feature this polishes), U44 (× clear affordance — keep it working on the new control), E102-WP3 (the `type: 'custom'` inspector hook — preferred mount if available), feezal-sidebar-themes.js (donor of label/swatch logic).

### U54 — Source editor opens at the current view's line

Switching to the source editor always starts at the top of the document — on a site with many views, finding the view you were just editing means scrolling/searching. **Wanted:** on entering source mode, the editor jumps to the line of the **currently active view**.

**Implementation:** the source editor is Monaco ([feezal-app-editor.js](../www/src/feezal-app-editor.js), `_sourceMode` / `loadMonaco`). After the model is set on entry, locate the active view's opening tag in the serialized HTML — match `<feezal-view` whose `name="<this.view>"` attribute follows within the same tag (don't assume attribute order; a simple regex over the model text, or `model.findMatches('<feezal-view', …)` + name check per hit, covers it since view names are unique) — then `editor.revealLineNearTop(line)` (or `revealLineInCenter`) and place the cursor on that line. If the view isn't found (fresh unsaved view, malformed doc), fall back silently to the top. Also apply when the active view is *changed while source mode is open* only if that flow exists — otherwise entry-time only.

**Ships with:** TESTING.md source-editor section update (open source view with a non-first view active → editor is scrolled to its `<feezal-view>` line, cursor there; first view / not-found falls back to top).

**Relates:** U23 (source editor, the other Monaco item), source-mode machinery in feezal-app-editor.js.

### U55 — View tab bar: hold-to-drag so clicks stop reordering views

Reordering views by accident happens far too often: a click on a view tab that moves a few pixels turns into a drag, and the view (or folder) lands somewhere else in the tab order. The user only wanted to switch views.

**Why it happens:** the tab bar uses **native HTML5 drag** — `.ftab` elements carry `draggable="true"` with `dragstart`/`dragover`/`drop` handlers ([feezal-app-editor.js:1014-1023](../www/src/feezal-app-editor.js#L1014-L1023), same for folder tabs) — and the browser's built-in drag threshold is only a few pixels with **no configurable delay**. Any slightly sloppy click qualifies.

**Wanted: hold-to-drag.** Dragging only arms after the mouse button has been held down for a moment (~250–300 ms) on the tab; a quick click — even a slightly moving one — always stays a click.

**Implementation direction (HTML5 drag has no delay option, so arm it manually):**
- Render the tabs with `draggable="false"` by default. On `pointerdown`, start a timer; when it fires with the button still down on the same tab, set `draggable = true` (plus a visual "lift" cue — slight scale/shadow — so the user knows drag mode engaged). On `pointerup`/`pointerleave`/`dragend`, clear the timer and reset `draggable = false`.
- Keep the existing `dragstart`/`dragover`/`drop`/`dragend` machinery unchanged — only the *arming* changes. Apply identically to **view tabs and folder tabs** (both reorder the same way).
- Watch the interactions on the same elements: `click` (switch view), `dblclick` (rename/edit — must still work, the hold timer must not swallow the second click), `contextmenu`, and the folder-menu open. Touch: `pointerdown` covers it, and a long-press-to-drag is actually the *expected* touch idiom.

**Bundled bug — a self-drop reorders to the END instead of no-op (fix with this item).** Repro: views `view1, view2, view3`; drag `view1` a few px right — the blue drop line sits between view1 and view2 (a no-op position) — release: the order becomes `view2, view3, view1`. This is what makes the accidental drags above so destructive: the most common accident (a micro-drag released over the dragged tab itself) is exactly the case that misfires.

**Cause (confirmed by code read, [feezal-app-editor.js `_applyDrop`](../www/src/feezal-app-editor.js)):** when the drop target IS the dragged tab (`before`/`after` itself — the pointer never left the tab), `_applyDrop` first **detaches the dragged node from the tree**, then tries to `_locate` the target — which is that same, just-detached node. The lookup fails, and the `if (!loc) { tree.push(dragged); }` fallback **appends to the end**. (Dropping on the *neighbour's* half works correctly — only the self-target path misfires.)

**Fix direction:** two independent hardenings —
1. **Self-drop = no-op:** bail out of `_applyDrop` before detaching when the target is the dragged item (same kind + same `name`/`id`) — `before`/`after` self are both order-preserving by definition.
2. **Fallback must not relocate:** `!loc → push(dragged)` turns *any* unresolved target into "move to end" — change it to abort without applying (restore semantics), matching the existing silent-abort for a folder dropped into its own subtree.

**Explicitly out of scope (decided):** canvas element dragging stays exactly as it is — it uses interact.js, a completely separate path, and its immediate drag is correct there. Only the tab bar changes.

**Ships with:** e2e coverage — a click with a small jitter (a few px of mouse movement between down and up) switches the view and does NOT reorder; a press-hold-move-release **over the dragged tab itself** leaves the order unchanged (the bundled bug's repro); a genuine reorder still works; dblclick rename still works.

**Relates:** U8 ✅ (view folders — the second draggable tab kind, same `_applyDrop` path), U33 (drag/reorder conventions), B33 (the other "pointer gesture misfires" family — different surface, keep separate).

### E109 — evcc integration: native discovery + energy/charging elements 💡 to refine

**Why.** [evcc](https://evcc.io/) is a self-hosted, open-source (MIT, Go+Vue) EV-charging / energy manager — PV-surplus charging, dynamic-tariff and CO₂-optimised charging, departure planning, home-battery coordination — talking to hundreds of wallboxes, inverters, meters and vehicles. Its users are precisely feezal's audience (self-hosted, MQTT, home automation, PV), it exposes a rich real-time MQTT API… and feezal sees **nothing** of it today.

**Positioning (decided).** evcc ships a good web UI that is explicitly kiosk/iframe-friendly (`?theme=…&lang=…&unit=…`), so **an iframe of evcc's own UI is the baseline to beat**. The goal is therefore *not* to rebuild that UI. feezal's value is **integration**: one wall panel / app where charging sits next to heating, lights and covers, in the site's visual family, exposing only the two or three controls the user actually touches. evcc's UI is charging-only and always shows everything; feezal's job is selective, blended, themed.

#### MQTT facts (confirmed against docs + `evcc-io/evcc@master`)

- **Root prefix is user-configurable** (`mqtt.topic`), default **`evcc`**; empty ⇒ no MQTT API. The recognizer must therefore detect by **structure, not literal prefix** (same as the configurable `hmPrefix`).
- **Flat scalars — one value per topic, NOT JSON.** `publishComplex()` explodes structs/maps/slices into sub-topics. ⇒ feezal's default `message-property: payload` works as-is — **none** of the `payload.val` plumbing Homematic needed.
- **Everything is retained** (with a full retained-cleanup of the tree at startup *and* graceful shutdown, so stale keys don't linger) ⇒ **instant discovery on connect**.
- **`<root>/status`** = LWT, payloads `online` / `offline`, retained, QoS 1 ⇒ **free availability for every evcc entity** (maps straight onto N31: `payload-available: online` / `payload-unavailable: offline`). Plus `<root>/updated` (unix-seconds heartbeat, ≤1/s).
- **Writes use a `/set` suffix** ⇒ real bidirectional control: `evcc/loadpoints/1/mode/set` ← `pv`, `…/limitSoc/set` ← `80`, `…/minCurrent/set` ← `6`.
- **Structure:** `<root>/site/<key>`, `<root>/loadpoints/<n>/<key>` (n from **1**), `<root>/vehicles/<name>/<key>`; `<root>/loadpoints` and `<root>/vehicles` carry **counts**.
- **Encoding:** floats `%.3f` trimmed; bools `true`/`false`; `time.Time` → **unix seconds OUT** but **ISO-8601 UTC IN** (asymmetric); durations in seconds; `nil` ⇒ empty payload (retained delete).
- **3-element phase arrays** publish `/l1 /l2 /l3` **plus the sum at the parent** (e.g. `chargeCurrents`).
- ⚠️ **Live vehicle SoC/range/odometer live on the LOADPOINT** (`vehicleSoc`, `vehicleRange`, `vehicleOdometer`), *not* under `<root>/vehicles/<name>/` — that tree carries only static config, limits and plans.
- Charge modes: **`off | now | minpv | pv`** (UI: Off / Fast / Min+Solar / Solar). Charger status `A` disconnected, `B` connected, `C` charging, `E`/`F` error.

**No Home Assistant MQTT discovery (confirmed).** Zero `homeassistant/` hits in the repo; no discovery path in `server/mqtt.go`. evcc's official HA route is the *marq24* HACS integration over the **REST** API. ⇒ generic HA discovery will never see evcc; a **native recognizer is required** — and slots directly into E108's recognizer framework.

#### Decided scope (07/2026)

Full set; the **energy-flow element stays generic** (serves any PV/battery home, not evcc-branded) with evcc-specific elements added where the domain genuinely warrants it; **control ships in v1 but MVP-scoped**.

**Recognizer** (a new recognizer in `server/src/mqtt/native-discovery.js`, alongside Homematic + WLED):
- Detect the root by **structure** — match a `…/site/homePower` / `…/loadpoints/<n>/chargePower` signature and derive the prefix.
- Synthesize **one site entity** (grid/PV/battery/home power, battery SoC, green share, tariffs) and **one entity per loadpoint** (the control surface). **Vehicle entities deferred** — low value, since live SoC is on the loadpoint.
- Availability for every entity from `<root>/status`; `message-property` stays the default `payload`.
- ⚠️ The recognizer and at least one matching element must **ship together** — discovery binds an entity to an element declaring the matching `discovery.component`, so a recognizer alone surfaces nothing.

**Elements:**
1. **Energy-flow diagram — generic, highest value.** Grid ↔ PV ↔ battery ↔ home ↔ car nodes with animated flows sized/directed by power. Deliberately **not** evcc-branded so it serves any PV/battery home; evcc discovery just wires it. Inputs: grid power (± import/export), PV power, battery power (± charge/discharge) + SoC, home power, charge power. Shares the animated-flow technique with **E63**'s schematic pipes — build once.
2. **evcc loadpoint card — evcc-specific.** The control widget: mode selector (Off/Solar/Min+Solar/Fast), charge power, vehicle SoC bar with draggable limit, session energy, phases, connected/charging state.
3. **Forecast / price chart.** Dynamic tariff + solar forecast. ⚠️ `<root>/site/forecast` goes through a "sharder" (`BytesMarshaler`) and is likely **chunked JSON**, not exploded scalars — **verify against a live instance before designing**. Relates to the history-in-payload convention (Open Questions).
4. **Session statistics** (energy, solar %, price/kWh, CO₂) — probably generic value/chart elements rather than a new element.

**MVP control scope:** loadpoint `mode`, `limitSoc` / `limitEnergy`, `minCurrent` / `maxCurrent`, `phasesConfigured`.
**Deferred:** plans/departure (`planSoc`/`planEnergy` take JSON `{"value":…,"time":"…Z"}`), `repeatingPlans`, smart-cost / feed-in limits, and **`batteryMode`** — an external override **auto-resets after 60 s**, so any control for it needs a keep-alive republish (a real design wrinkle, not v1).

**Verification constraint (important).** No local evcc instance — a friend can test, so the feedback loop is slow and indirect. Design accordingly: put **all topic assembly behind one small helper** (like `hmTopics()`) so a wrong assumption is a one-line fix, and flag every inferred value in code comments. Unverified today: the `forecast` payload shape; whether heating loadpoints expose a temperature key (heating devices are chargers carrying the `Heating` feature, where `minSoc`/`vehicleSoc` semantically become temperatures); the docs' `batteryboost` vs the source's **`batteryBoost`** (trust the source); exact sub-topics under `plan` / `statistics` / `thresholds`.

**Worth remembering:** evcc already works in feezal **today** with manual wiring (predictable topics, flat scalars, retained, `/set` writes). Discovery + elements make it one-click and native-looking — that convenience *is* the deliverable, which should keep the scope honest.

**Relates:** **E108** (the native-recognizer framework this reuses — archived), **E63** (animated-flow technique for the energy diagram), **E62** (topic-tree browser — helps manual wiring in the meantime), **N31** (availability — evcc's LWT maps directly), A18 (kiosk/wall-panel — the prime placement for this).

### E110 — Server-side HTTP→MQTT poller (bridge for services with no MQTT) ❌ likely out of scope

> **Decision (07/2026): most likely NOT doing this.** A server-side poller only runs while the **feezal server** runs — but a **statically exported site (and native app builds) talk directly to the broker with no feezal server present**. Any dashboard built on polled topics would therefore work in the editor/viewer and then silently break on export, splitting the element set into "works everywhere" vs "works only with the server running". That inconsistency is a worse outcome than simply not integrating REST-only services. Secondary objection: it drags credential storage, scheduling and auth-flow handling into the server of an otherwise MQTT-native product.
>
> **If a REST-only service is ever wanted, the right answer is external:** the user runs their own bridge (or a Node-RED / `system-script` flow) that publishes to MQTT, and feezal consumes plain topics like any other source — no feezal-side machinery, and exports keep working. The analysis below is kept as the record of why, and the Pi-hole API details in **E111** stay useful if this is ever revisited.

**Why it was considered.** feezal being MQTT-native is a strength — until a service simply *has* no MQTT. Pi-hole (E111) has **none at all**, and its third-party bridge ecosystem is thin and undocumented. The same gap applies to Uptime Kuma, router/NAS APIs, Scrypted's stats, and most self-hosted tools, which expose only REST. Rather than a bespoke integration per service, add **one** server-side capability: **poll an HTTP endpoint on a schedule, extract values, publish them to MQTT** — after which the entire existing pipeline (elements, discovery, topic tree, autocomplete, export) works unchanged.

**Why server-side, not in the browser (decided).** Three independent reasons, all confirmed against Pi-hole as the reference case:
- **Credentials.** A Pi-hole v5 API token / v6 app password in a browser-delivered dashboard config is effectively **full admin** — it can rewrite config (`PATCH /api/config`), dump the entire query log (who visited which domain), export everything (`/api/teleporter`) and restart DNS; FTL has had RCE advisories through that surface. There is **no read-only scope**. Client-side credentials are a non-starter.
- **CORS.** FTL ships no `Access-Control-Allow-Origin` in its default headers, upstream evidence about civetweb's default is contradictory, `X-FTL-SID` is a non-simple header (forces preflight), and session cookies are `SameSite=Strict` by design. A server-side fetch sidesteps all of it.
- **Session economics.** Pi-hole v6 sessions expire (1800 s), are **IP-bound**, rate-limited on login and capped at **16 concurrent**. A dashboard authenticating per panel or per browser tab would exhaust them; one server-side session shared by all viewers will not.

**Shape (to refine).**
- A **poll job**: URL, method, interval, headers, an optional **auth pre-flight** (login → token/session, cached, re-run on 401), and a set of **extractions** (JSON path → MQTT topic). Publish retained.
- Auth strategies: none · static header/bearer · query param · **login→session** (the Pi-hole v6 pattern: `POST /api/auth` → `sid`, reused until 401).
- Lives in `server/src/` beside the MQTT bridge; results land on ordinary topics so elements bind to them with no special support.
- **Presets/recipes** per service (Pi-hole first) so the user picks "Pi-hole" + host + password instead of hand-writing JSON paths.
- Open: config surface (editor UI vs config file), extraction syntax (JSON path vs small template), error/backoff/logging semantics, and whether polled services should also synthesize **E108 discovery entities** so they arrive as ready-made devices rather than bare topics.

**Relates:** **E111** (Pi-hole — first consumer and reference implementation), **E108** (native discovery — polled services could register entities the same way), E62 (topic-tree browser — polled topics appear there for free), E49 (script element — the "just poll it yourself" workaround this replaces).

### E111 — Pi-hole integration ❓ largely dissolves (needs a user-provided bridge)

> **Status (07/2026):** this was scoped around **E110**, which is now **out of scope** (it would break static export / native apps). Without it there is **no feezal-side path** to Pi-hole, since Pi-hole has no MQTT of its own. What remains is: *the user runs any Pi-hole→MQTT bridge themselves* (or a Node-RED / `system-script` poll), after which **the existing generic elements already cover it** — stat tiles, a stacked area chart, a doughnut and a top-list table need no new feezal work. So the item largely dissolves into **documentation/a recipe** rather than a feature. The only piece that would need something bespoke is the **enable/disable-blocking control with duration presets**, and that only works if the user's bridge exposes a command topic for it.
>
> The API research below is kept as reference for anyone writing such a bridge or revisiting this.

**Confirmed: Pi-hole publishes no MQTT at all** — nothing in `pi-hole/pi-hole`, `pi-hole/FTL` or `pi-hole/web`; the entire v6 API surface has no MQTT endpoint or config key. The official Home Assistant integration polls the **REST** API. Third-party bridges are weak: the one maintained project (`mqtt4pihole`) exposes *adlists/domain-lists/groups as HA switches*, **not** statistics, and no well-documented "Pi-hole stats → MQTT" bridge with a stable topic contract exists. ⇒ **Pi-hole needs E110**, not a recognizer.

**Two API generations are in the wild — support both:**
- **v5 (legacy, removed in v6):** `GET /admin/api.php?summaryRaw&auth=<token>` etc. Token = hash of `WEBPASSWORD`; static, never expires. Since **5.18** even `summary`/`status` require auth. Flat keys: `dns_queries_today`, `ads_blocked_today`, `ads_percentage_today`, `domains_being_blocked`, `unique_clients`, `status`. (Use `summaryRaw` — plain `?summary` returns comma-formatted **strings**.)
- **v6 (Feb 2025):** lighttpd+PHP replaced by a civetweb server embedded in `pihole-FTL`; `/admin/api.php` is **404**. Base `/api/…`; auth = `POST /api/auth {"password":…}` → `{"session":{"sid":…,"csrf":…}}`, passed as header **`X-FTL-SID`** (or `?sid=`, URL-encoded — it's base64). *No* `Authorization: Bearer` scheme despite what several blog posts claim. Live per-instance OpenAPI at `/api/docs`.

**Poll targets (v6) — three calls reproduce essentially the whole admin dashboard:**
- **`GET /api/padd`** — the single best endpoint: the four headline tiles, `blocking` status, top domain/blocked/client, cache stats, plus host name/model, CPU%, mem% and temperature in **one** request.
- `GET /api/history` — 10-minute buckets, `{timestamp,total,cached,blocked,forwarded}` (the queries-over-24h chart).
- `GET /api/stats/top_domains[?blocked=true]` / `top_clients[?blocked=true]` — the top-list tables.
- Key fields: `queries.{total,blocked,percent_blocked,unique_domains,forwarded,cached,frequency}`, `clients.{active,total}`, `gravity.{domains_being_blocked,last_update}`, and v6-only `queries.status.{GRAVITY,REGEX,DENYLIST,CACHE,FORWARDED,…}` (block-reason breakdown).

**Control:** `GET /api/dns/blocking` → `{"blocking":"enabled","timer":null}`; `POST /api/dns/blocking {"blocking":false,"timer":300}` (seconds; enum `enabled|disabled|failed|unknown`). This is the one genuinely bespoke widget — an **enable/disable-blocking control with duration presets** (10 s / 30 s / 5 min / indefinite), mirroring the admin sidebar. Also available: `POST /action/gravity`, `POST /action/restartdns`.

**Elements:** mostly **generic** — four stat tiles, a stacked area chart (blocked/cached/forwarded over time), a query-type doughnut, and top-list tables. Only the blocking control warrants something Pi-hole-specific. So the real work is E110 plus a preset, not a new element family.

⚠️ **Security must be stated in the UI/help, not just here:** the credential is full admin with no read-only scope, so it lives **only** in the server-side poller config and must never reach a dashboard/export payload.

**Relates:** **E110** (the enabler — this is its reference consumer), E62 (topic tree), E75/E32 (table + chart elements the tiles and top-lists reuse).

### E112 — Scrypted integration: camera snapshot element (sensors already work) 💡 to refine

**Surprise finding — half of this already works.** Scrypted's **official `@scrypted/mqtt` plugin publishes Home Assistant MQTT discovery** (`plugins/mqtt/src/autodiscovery.ts`): retained configs at `homeassistant/<component>/scrypted-<mqttId>-<deviceId>/<iface>/config` covering **MotionSensor, BinarySensor (doorbell), OccupancySensor, FloodSensor, AudioSensor, Online** (→ `binary_sensor`), **Thermometer, HumiditySensor** (→ `sensor`) and **OnOff** (→ `switch`). feezal's **existing** HA-discovery path should therefore already see Scrypted sensors — **verify first; do not build a recognizer before checking.** State topics are `scrypted/<deviceId>/<property>`, **retained**, payload = plain `String(value)` (`true`/`false`, `21.5`) — flat scalars, so the default `message-property: payload` works. Commands are `scrypted/<deviceId>/<method>` with a **JSON array of arguments** (`[]`, `[50]`), plus `…/on/set` ← `true|false` for `OnOff`. Note: **no LWT** — liveness is the retained `online` topic; and entity names come out as the *interface* name ("MotionSensor"), so labels may need prettifying.

**The actual gap is cameras.** The MQTT plugin **deliberately excludes** them (`publishable-types.ts` removes `Camera`, `RTCSignalingChannel`, `ObjectDetection`, …) — no images over official MQTT, and object-detection classes (person/vehicle/animal/face) are not broken out into topics.

**What a browser can consume (confirmed):** the **Webhook plugin** exposes a public, token-authed snapshot URL usable directly in an `<img>` tag from any origin (plain GET — no preflight, no cookies):
```
https://<host>:10443/endpoint/@scrypted/webhook/public/<deviceId>/<token>/takePicture
http://<host>:11080/endpoint/@scrypted/webhook/public/<deviceId>/<token>/takePicture
```
`/public/` endpoints bypass Scrypted's own auth entirely; the token *is* the only auth and it is **plugin-global** (one token unlocks every webhook-enabled device) — a security caveat worth surfacing in help text. The WebHook mixin must be enabled per device first. **Live video is the wall:** no public WebRTC URL (per koush), no official HLS, RTSP isn't browser-consumable, MJPEG only via a third-party plugin, and the NVR iframe needs an authenticated session plus the paid plugin. ⇒ **snapshot polling is the only officially supported embeddable source.**

**Proposal — a GENERIC camera/snapshot element** (not Scrypted-branded): URL + refresh interval, `<img>`-based with cache-busting, optional MJPEG mode, click-to-enlarge, and an explicit stale/error state. It then serves Scrypted, Frigate, go2rtc, and any IP camera with a snapshot URL. Deployment caveats to document: the **self-signed cert** on :10443 (the browser must have accepted it) and **mixed content** if feezal is served over HTTPS and Scrypted over HTTP:11080.

**Higher-value camera path (third-party):** `@apocaliss92/scrypted-advanced-notifier` publishes far richer MQTT under its own `scrypted-an/<id>/<entity>` prefix **with HA discovery in the newer device-bundle format** (`homeassistant/device/scrypted-an-*/config`, which feezal's `handleDeviceDiscovery` already parses): per-class Person/Animal/Vehicle/Face/Plate entities, object counts, battery, command switches — and **`LastImage` as a base64 JPEG payload**. That last one is precisely **E64**'s (camera image via MQTT) use case, so E64 + this plugin may be the better camera story than snapshot polling for users who install it.

⚠️ Scrypted's MQTT topic layout is **completely undocumented upstream** (everything above was read from `plugins/mqtt/src/`), so treat it as unstable across versions and prefer the HA-discovery contract over hand-parsing `scrypted/<id>/…`.

**Relates:** **E64** (camera image via MQTT — the base64/`LastImage` path), **E108** (native discovery — probably *not* needed here, since HA discovery is already emitted), N31 (availability — Scrypted has no LWT, so `online` is the substitute), A18 (kiosk/wall-panel — camera tiles are a prime use).

### E113 — Element taxonomy: make "function × style" explicit ⚠️ needs discussion

**The problem.** The palette flattens **two orthogonal axes** into a single category list: *what an element **does*** (a light, a readout, a container, an invisible behaviour) and *what it **looks like*** (material, glass, metro, lcars, tui, carbon, wired…). `basic`, `system` and `layout` are **function** categories; `glass`, `metro`, `lcars`, `tui` are **style** categories — and they sit side by side as if they were the same kind of thing. That single conflation is the root of several separate complaints:
- users can't reason about the categories (the original "components vs widgets?" question);
- the palette filter can't find `lcars` because family/style isn't a searchable facet (**B42**);
- switching a `metro-light` to a `glass-light` *feels* like it should be trivial but has no model to hang on (**E115**);
- "what even is a **plain** family?" — answered: the unstyled style IS the **Basic** family (E116 ❌ dropped — no fourth parity family);
- device-first insertion (**U31**) is naturally *pick function → pick style*, which the current model can't express.

**Decided (07/2026): make both axes explicit** rather than renaming categories. Deliberately **not** "components vs widgets" — that's a fuzzy distinction that would still leave style and function mixed in one list.

- **Function** (what it is): `device` (a real thing with an MQTT contract — light, switch, climate, cover, contact, sensor) · `readout` (displays a value — value, gauge, sparkline, table, json) · `control` (input — button, slider, select) · `layout` (app shell, view, group, container) · `system` (invisible behaviour — script, notification, splash, pin) · `decoration` (svg, shapes, schematic symbols).
- **Style / family** (what it looks like): `material` · `glass` · `metro` · `plain` · `lcars` · `tui` · `carbon` · `wired` · `paper` · `panel` · `rail` · …

**Important nuance — not every family spans every function.** Only **material / glass / metro / plain** aim for full device coverage (that's the parity contract, **E114**). Families like `lcars`, `tui`, `rail` are style families with *partial* coverage, and some carry elements unique to them (rail's model-railroad symbols). So the model is "function × style, sparsely populated" — the picker must show what exists, not a full matrix with holes.

**Implementation sketch:** today `palette.category` carries both meanings. Add explicit descriptor fields (e.g. `palette.function` + `palette.family`, derived from the tag prefix where possible so most elements need no change), keep `category` as a back-compat alias, and make the palette/picker filter on both facets. `docs/element-families.md` §1–2 and `element-spec.md` §1.1 are the naming home and must be updated together.

**Open questions:** the exact function vocabulary (the six above are a starting proposal, not settled — `control` vs `input`, whether `decoration` earns its own bucket); whether `basic` survives as a function or dissolves into `readout`/`control`; and how site-specific **Components** (U32 ✅) fit — they're user-authored composites, arguably a seventh function.

**Relates:** **U45** (picker — the consumer of this model), **U31** (device-first = the axes in reverse order), **B42** (filter bug — symptom), **E114** (parity — only meaningful once style is a real axis), **E115** (family switching — only legal because function is style-independent), E83/E85 (family/category naming conventions), U24 ✅ (collapsible categories).

### E114 — Family parity contract: material/circle / glass / metro stay in sync ⚠️ needs discussion

Device families must offer **the same elements with the same MQTT contracts** — a `metro-light` and a `glass-light` should differ only in appearance. Today parity is maintained by discipline, so families drift: an attribute gets added to one family and not its siblings, and users discover the gap only when a dashboard can't be restyled. *(Three members — E116's fourth "plain" family was ❌ dropped; the unstyled role is the Basic category.)*

**Parity-set additions (decided 07/2026):**
- **number** — the numeric value card. Glass and metro have it already (today still named `*-sensor`; becomes `glass-number`/`metro-number` via **E132**); the **circle/material family has no number card at all** — a new element, styled to the E134 circle canon (Basic's `basic-number` stays the unstyled primitive; this is the family-styled sibling).
- **template** — a family-styled `*-template`: behaves exactly like `basic-template` (same `<template>` child, `${msg…}` substitution, subscribe/message-property contract — reuse its machinery, don't fork it), wrapped in the family's chrome (frosted glass card / metro tile / circle card). New in **all three** families.

**Decided: enforce parity with a test, not discipline.** The precedent already exists — **E86** ✅ (paper/material dialog parity) asserts parity in unit tests by **comparing descriptor attribute sets between families**. Generalise that into a standing parity test over the parity families.

**Deliverable sketch:**
- A declared **parity set**: the list of functions every parity family must implement (light, switch, climate, cover, contact, sensor, …).
- A **parity test** that, for each function, compares across `material` / `glass` / `metro` / `plain`: attribute **names**, **types**, **defaults** and the `discovery.map` keys — failing CI on drift, with an explicit allow-list for genuinely family-specific extras (e.g. glass's `degrade`, metro's `size` grid).
- Documentation of what is *permitted* to differ (visual/chrome attributes) versus what must not (anything in the MQTT contract).

**Why now:** E108 made this materially more valuable — discovery stamps the *same* config onto whichever family the user picked, so a contract gap between families now shows up as "discovery works on glass but not metro" (exactly the metro-climate `message-property-actual` gap found during E108). Parity is no longer cosmetic; it's a correctness property of discovery.

**Relates:** **E86** ✅ (the unit-asserted parity precedent to generalise), **E106** ✅ (shared base class/code — the mechanism that makes parity cheap), **E103** ✅ (WLED shipped with an identical contract across three families), **E115** (switching — this contract is its precondition), E108 ✅ (discovery — why gaps now cause bugs), **E137** (behavior-controller extraction — the structural fix that makes behavior parity true by construction; this item's test lands *first* and serves as E137's migration safety net).

### E115 — Switch an element to another family (context menu) 💡 to refine

Right-click an element → **Switch family** → `metro-light` becomes `glass-light`, **keeping all configuration** (topics, payloads, limits, label) and its position/size. Today changing your mind about a family means deleting and re-configuring every element.

**Depends on E114** — parity is what makes the attribute set transferable; without it this is a lossy guess.

**Machinery that already exists:** **A23/A24** ship a static **tag-prefix → family-package map** in the editor (for missing-element detection) — exactly the lookup a switcher needs to know which families exist and which are installed. **E87** ✅ established the **deprecated-tag-alias + attribute-remap** pattern for rewriting saved dashboards, which is the same operation applied at author time instead of load time.

**Design points:** carry across every attribute in the shared contract; **warn (don't silently drop)** on family-specific attributes that have no counterpart; preserve position/size and `discovery-id`; route through the normal change/undo pipeline so it's one undoable action. Power feature worth considering: **switch all elements of family X** on a view or site-wide ("restyle this dashboard"), which is the real payoff — though it should probably ship after the single-element case proves the mapping.

**Open:** whether an unavailable target family should offer to install it (A23's missing-element detection already knows the package), and what happens to elements whose target-family twin doesn't exist yet (blocked until E114's parity set is satisfied).

**Relates:** **E114** (parity — precondition), **E113** (function × style — the model that makes this coherent), E87 ✅ (attribute-remap precedent), A23/A24 (tag→package map). *(E115's "strip the styling" switch target is the **Basic** family where a functional twin exists — E116 ❌ dropped.)*

### E117 — `publish-local` on every publishing element *(partial — buttons ✅ 07/2026)*

**Shipped 07/2026 (the "buttons first" tranche):** the base package exports the shared descriptor — `publishLocalAttribute` in `@feezal/feezal-element` 3.0.3 (name/help defined ONCE, per the design note below) — and all six button elements carry it, threading `{local: this.publishLocal}` into `pub()`: `material-button` 3.0.1, `material-icon-button` 3.0.1, `material-fab` 3.0.1, `glass-button` 3.0.7, `carbon-button` 3.0.1, `paper-button` 3.0.1 (Polymer — inline descriptor, same wording). Browser tests cover the option threading and the shared descriptor.

**Scope refined (07/2026): navigation and dialog-opening only — NOT a blanket rollout.** `publish-local` exists for page-local UI wiring (open a dialog, drive a view/tab switch); sliders, checkboxes, selects and the complex device elements publish *device state* that belongs on the broker — they explicitly do **not** get the attribute.

**Remaining (the navigation/tab-bar tranche):** spread `publishLocalAttribute` the same way as the buttons (Lit: import + property + constructor default + pub options; Polymer: inline copy) to every element that publishes as a navigation/selection act:
- `material-navbar` (publishes the picked view, [feezal-element-material-navbar.js:164](../www/packages/@feezal/feezal-element-material-navbar/feezal-element-material-navbar.js#L164))
- `paper-tabs` — has its own legacy `publishLocal`; converge it on the shared descriptor
- `tui-menu` (publishes the picked entry)
- `metro-tile` (tap publish — its navigate-to-view action is already local)
- `material-chip` (tap publish — button-shaped)
- `basic-navigation` needs **checking, likely nothing**: it switches views locally already and no `pub()` call was found — confirm and skip.

**Relates addition:** the dialog elements' *openers* are the consumers — a `publish-local` button/navbar entry triggering a `*-dialog`'s subscribe topic is the canonical use (E49 ✅ semantics).

Original motivation: a button that opens a dialog had to publish its trigger to the **broker** and wait for it to come back. That round-trip is pointless for pure UI wiring (open a dialog, switch a view, drive another element on the same page), puts UI chatter on the broker, and fails outright when the connection is down — while `FeezalConnection.pub()` supported `{local: true}` all along ([feezal-connection.js:167-178](../www/src/feezal-connection.js#L167-L178)).

**Relates:** E49 ✅ (page-local publish semantics), **E114** (family parity — the mechanism to land the remainder consistently), E118 ✅ (the sibling attribute-gap item, archived), N24 (per-client control topics — the deliberately *non*-local counterpart).

### E119 — `basic-number`: configurable placeholder before the first value

Until the first MQTT message arrives, `basic-number` renders **nothing** — `_formatedValue` starts as `''` and `_valueChanged()` early-returns while `value == null` ([feezal-element-basic-number.js:70-73](../www/packages/@feezal/feezal-element-basic-number/feezal-element-basic-number.js#L70-L73)). On a fresh dashboard that reads as a broken or empty widget rather than "no data yet".

It is also **inconsistent**: `prefix` and `suffix` render regardless of whether a value exists ([feezal-element-basic-number.js:56](../www/packages/@feezal/feezal-element-basic-number/feezal-element-basic-number.js#L56)), so a number with `suffix: "°C"` currently shows a bare `°C` floating with no number in front of it.

**Wanted:** a `placeholder` attribute, **default `-`**, shown in place of the value while none has been received.

**Details to settle:**

- **Default `-` changes existing dashboards** (empty → `-`). That is the request and almost certainly an improvement, but it is a visible change on every existing `basic-number`; an empty `placeholder` must remain a supported way to get today's blank behaviour back.
- **Do prefix/suffix show alongside the placeholder?** Recommend **no** — `-` alone reads as "no data", whereas `-°C` reads like a measured value. Suppress both while the placeholder is showing, which also fixes the stray-suffix inconsistency above.
- Distinguish "no message yet" from "message with a null/unparsable payload" — both should land on the placeholder rather than rendering `NaN`.
- Consider the same treatment for the sibling display elements (`basic-icon-value`, `basic-datetime`, `basic-text`) so the family behaves alike — but this item is scoped to `basic-number`.

**Relates:** N31 (availability / `unavailable` attribute — the other "this element has no trustworthy value right now" signal; a placeholder and an unavailable state should not contradict each other), E118 (same element family), **E114** (parity contract, if it spreads to siblings).

> **Terminology note for E120:** reported as "*-shutter". The packages are named **cover** (`feezal-element-material-cover`, `-glass-cover`, `-metro-cover`) — same elements. Whether the user-facing label should become "Shutter" is a separate question for **E113** (taxonomy).

### E124 — Battery-powered sensors: dedicated low-battery indicator (contact + motion/occupancy)

A battery-powered door/window contact currently signals a flat battery by going **entirely unavailable** — the Homematic recognizer folds `LOWBAT` into `availability_normalized` alongside `UNREACH` with `mode: 'all'` ([native-discovery.js:463-478](../server/src/mqtt/native-discovery.js#L463-L478)). The code comment states the compromise outright: *"the element shows unavailable when unreachable OR battery low — acceptable since contacts have no dedicated battery attribute of their own."* This item removes that "since".

**Scope (expanded 07/2026): all battery-powered sensor elements, not just contacts.** Motion / presence / radar / occupancy sensors are battery devices exactly as often as contacts, and their elements (`material-motion`, `glass-occupancy`, `metro-occupancy`) currently have **no battery support of any kind** — not even the folded-into-availability compromise. Same attribute contract, same icon treatment, across both element groups.

**Wanted:** a `subscribe-battery-low` attribute (plus its `message-property-battery-low` twin, default `payload`, and a `payload-battery-low` compare value, default `true`) on `*-contact` AND `*-motion`/`*-occupancy`, with a dedicated low-battery **icon** shown alongside the open/closed resp. motion/clear state — a warning, not a blackout. A sensor with a weak battery still reports its state correctly and should keep showing it. **Auto-discovery must stamp this for BOTH ecosystems** — Homematic (native recognizers) and Zigbee (zigbee2mqtt via HA discovery) — through the normal discovery-apply mechanism, no hand-wiring.

**Zigbee2mqtt facts (researched 07/2026, verified against the z2m HA-extension source):**

- The device **state JSON** on the base topic carries `battery` (0–100 %) for battery devices, and for devices that expose it, `battery_low` (boolean). Both live in the SAME payload as `contact`/`occupancy`.
- z2m's HA discovery announces them as **separate sibling entities of the same device** (linked via the shared `device.identifiers`), both on the device's **base state topic**:
  - `battery_low` → **`binary_sensor` with `device_class: "battery"`** (⚠ not "battery_low" — HA semantics: *on = low*), `entity_category: diagnostic`, `value_template: {{ value_json["battery_low"] }}`;
  - `battery` → **`sensor` with `device_class: "battery"`**, `value_template: {{ value_json["battery"] }}`.
- **Not every battery device exposes `battery_low`** — many modern ones expose only the percentage; a `battery`-only fallback path is therefore required, not optional.
- ⚠ **Parser gotcha:** z2m emits the **bracket form** `{{ value_json["battery_low"] }}` — feezal's template→property parsers (`templateToProperty` in [discovery.js](../server/src/mqtt/discovery.js), the client's `valueTemplateToPath` transform) currently match only the dot form `value_json.x` and would silently yield no property path. Extend them to accept both forms as part of this item.

**Stamping design — one canonical record, two producers (the N31 pattern):** normalize battery-low **server-side** into the entity record as `battery_low_normalized = {topic, property?, payloadLow?}`, exactly like `availability_normalized` ([discovery.js:234](../server/src/mqtt/discovery.js#L234)); the client's `_applyDiscovery` then stamps `subscribe-battery-low`/`message-property-battery-low`/`payload-battery-low` automatically for any element whose class declares the attributes — element `discovery.map`s stay untouched, exactly how availability already works.

- **Zigbee/HA producer:** when a contact/occupancy `binary_sensor` entity is normalized, look up its **device-group siblings** (the machinery exists: `getDeviceGroups()` groups by `device.identifiers[0]`, [discovery.js:377](../server/src/mqtt/discovery.js#L377), and the plant `elementHint` at [discovery.js:399](../server/src/mqtt/discovery.js#L399) is the exact sibling-lookup precedent). Prefer the `binary_sensor`/`device_class: battery` sibling (boolean, payloads from its config); fall back to the `sensor`/`device_class: battery` sibling with a **threshold** — decide the shape: either the server compares nothing and the element gains an optional `battery-low-threshold` (number, default ~15 %) used when the subscribed value is numeric, or the %-fallback is skipped in v1. Leaning to the element-side threshold: it also serves hand-wired setups.
- **Homematic producer:** the recognizers emit the same `battery_low_normalized` from the `:0` maintenance channel — `LOWBAT` (BidCoS) **and** `LOW_BAT` (HmIP), moved **out of** `availability_normalized` (leaving `UNREACH` as the sole availability source, consistent with cover/climate). Applies to the **contact recognizer today** and to the **motion recognizer (E131)** from day one — never repeat the fold-into-availability compromise. Homematic motion device facts for E131: channelType **`MOTION_DETECTOR`**, datapoint **`MOTION`** (bool) — confirmed for BidCoS (per user); ⚠ **verify the HmIP naming before implementing** (probably the same datapoint `MOTION`, but the channelType may be `MOTIONDETECTOR_TRANSCEIVER` on HmIP-SMI/SMO — check a real device's `hm` metadata, don't assume).

**Climate / TRV expansion (07/2026):** radiator thermostats are battery-driven in most cases too — the `*-climate` elements (`material-climate`, `glass-climate`, `metro-climate`) get the same `subscribe-battery-low` contract and icon. **But: mains-powered TRVs and wall thermostats exist**, so the Homematic climate producer must stamp **presence-checked**, not constructed blindly: only emit `battery_low_normalized` when a `LOWBAT`/`LOW_BAT` datapoint has actually been **observed** on the device's `:0` channel (the climate recognizer must start watching those two datapoints in its accumulate step — today it only tracks the thermostat whitelist). The availability topics may stay constructed as today (UNREACH exists on everything); battery must not, or every mains device shows a dead battery slot. Zigbee TRVs (Danfoss Ally, TS0601, …) need nothing special — the device-group sibling lookup above covers them exactly like contacts.

**Bug to fix in passing — HmIP low battery is reported but never read.** Both generations expose the datapoint on the device's **`:0` maintenance channel**, under different names:

| Generation | Datapoint on `:0` |
|---|---|
| BidCoS | `LOWBAT` |
| HmIP | `LOW_BAT` |

The recognizer subscribes **only `LOWBAT`** ([native-discovery.js:472](../server/src/mqtt/native-discovery.js#L472)) — `LOW_BAT` appears nowhere in the file. So an HmIP contact broadcasts its low battery on a topic feezal never listens to, and the warning is silently lost. Subscribe **both** names off the `:0` segment the recognizer already derives (`availSeg`, `device:1` → `device:0`) — the plumbing is in place, only the second datapoint name is missing. Treat either firing as low battery.

The same one-name assumption should be checked on the other battery-powered recognizers before it is copied further.

**Apply family-wide** per **E114**: contacts (`material-contact`, `glass-contact`, `metro-contact`), motion/occupancy (`material-motion`, `glass-occupancy`, `metro-occupancy`) and climate (`material-climate`, `glass-climate`, `metro-climate`) — nine elements, one shared attribute contract and icon treatment (define the descriptor once, the way E117 handled `publish-local`).

**Ships with:** unit tests for both producers (z2m sibling lookup incl. the bracket-form template, `battery`-only fallback, hm LOWBAT/LOW_BAT emission and its removal from availability), a client test that `_applyDiscovery` auto-stamps the three attributes from `battery_low_normalized`, and TESTING.md rows for a discovered z2m contact + occupancy sensor and a Homematic contact showing the icon while state keeps updating.

**Relates:** N31 (availability machinery this deliberately steps back from), E108 ✅ (native Homematic discovery), **E131** (Homematic motion recognizer — must emit the battery record from day one), **E114** (parity contract), E117 ✅ *(partial)* (shared-descriptor precedent), E61 (HMI/alarm family — same "degraded but still reporting" distinction), **E125** (battery *voltage* — the richer signal, deferred; its OPERATING_VOLTAGE datapoint exists on HmIP motion sensors too).

### E125 — Homematic battery voltage (`OPERATING_VOLTAGE`) 💡 future

HmIP battery devices publish **`OPERATING_VOLTAGE`** on the `:0` maintenance channel — an actual voltage, not just the `LOW_BAT` boolean that **E124** wires up. That is strictly more information: it supports a battery-level display, trend charts over time, and warning *before* a device drops out rather than after.

**Deliberately deferred.** E124's boolean is what makes the immediate failure visible and should land first; voltage is an enhancement on top of working low-battery handling. Recorded now so the datapoint isn't rediscovered later.

**When it is picked up, decide:**

- **Where the value surfaces.** A voltage alone is not user-meaningful (is 2.4 V low?) — it needs either a per-device-type mapping to a percentage, or a plain numeric readout the user interprets. A raw volt figure on a contact card is probably noise; a battery *percentage* or a colour-graded icon is not.
- **Which elements carry it.** Possibly not the contact card at all — this may belong to a generic battery/diagnostics element, or to the device-status surface, rather than being duplicated onto every sensor element.
- **BidCoS equivalence.** Check whether the older generation exposes a comparable datapoint before designing around an HmIP-only field; if not, the feature must degrade cleanly for BidCoS devices.
- **Reporting cadence.** Battery voltage updates rarely and drifts with temperature — a chart of it is only useful over days/weeks, which has implications for history retention (see the history/logbook items).

**Relates:** **E124** (low-battery boolean — the prerequisite), E108 ✅ (native Homematic discovery — where the recognizer lives), N31 (availability), E30 (sparkline — the natural place a voltage trend would render).

### E128 — Homematic blinds: settling behaviour + `DIRECTION` indicator *(later — after E127)*

Blinds/covers have **the same LEVEL ramp problem** as dimmers (position reports trail the command while the blind travels) — deliberately split from **E127** so the settling machinery ships and hardens on lights first.

- **Settling:** apply E127's shared helper to the `*-cover` family's position slider unchanged — same attributes (`subscribe-working`, `message-property-working`, `subscribe-settled`, `settle-timeout`, `report-delay-ms`), same three wiring tiers, same discovery observation (`LEVEL_NOTWORKING` / `WORKING` siblings of the blind channel). Blind travel is much slower than a dimmer ramp — the cover default for `settle-timeout` needs to be generous (blinds can travel ~30–60 s; default around 60 s, still configurable).
- **`DIRECTION` datapoint (the blind extra):** blind actuators additionally expose **`DIRECTION`** (mqtt-smarthome `{val}`; enum: none / up / down) while moving. Wire it as optional `subscribe-direction` + `message-property-direction` and render a **movement-direction indicator** on the cover card (e.g. animated ▲/▼ arrow while travelling, per family style) — also observed-only in discovery. Kept in this item, **not** in E127.
- Tilt/slat settling: check whether the slat angle reports ramp the same way on venetian actuators; if so the helper applies to the tilt slider too — verify on real hardware during implementation.

**Ships with:** cover-family attributes + help texts (patch bumps, E114 parity), recognizer update, TESTING.md notes (slow-travel timeout, direction indicator, tilt check).

**Sequencing vs. E137 (controller extraction):** either order works — if E128 lands before `CoverController`, it wires E127's `SettlingController` directly (as planned above) and migrates into the controller with the rest of the cover behavior; if the extraction lands first, E128's settling + `DIRECTION` wiring is implemented *inside* `CoverController` (and every cover family gets it at once). The settling attributes end up in the controller's declared fragment either way (E137's settling decision).

**Relates:** **E127** (the machinery this reuses — do first), **E137** (controller extraction — cover settling ends up inside `CoverController`; see sequencing note), E108 ✅ (recognizer), E114 (parity), E120 ✅-era cover-discovery work (same recognizer area).

### E129 — metro-* family: expose font/icon sizes as CSS vars, larger icon defaults

The metro tiles hardcode their typography and icon sizing (labels 12–13 px, values 16–18 px, tile icon `min(42px, 40cqh)`) — the family exposes **colour** vars (`--feezal-metro-text`/`-accent`/`-off-color`/`-unit`) but **no size vars**, so neither themes nor the style inspector can adjust text or icon sizes. Same move as the glass family's E106 typography decision, applied to metro:

- **Expose sizes as `--feezal-metro-*` custom properties**, defaulted once (shared metro styles / `MetroTileBase` where the family already shares chrome): e.g. `--feezal-metro-icon-size`, `--feezal-metro-font-size-label`, `--feezal-metro-font-size-value`, `--feezal-metro-font-size-unit` — plain px fallbacks (sizes, not colours — §5.1 canonical-var rule doesn't apply). List them in each element's `styles` descriptors so they're settable per element in the style inspector and overridable by `feezal-theme-metro`.
- **Defaults get bigger — icons in particular:** nudge the defaults up, with the **icon size getting the larger increase** (the current 42 px cap reads small on the flat tiles); exact values tuned visually at implementation across all tile sizes (1x1/2x2/4x2/4x4 mosaic) and both front/back faces.
- Apply family-wide (tile, switch, light, climate, contact, sensor, occupancy, media, cover, wled) — one shared definition, per-element descriptor listing (E106 lesson: no ten hand-rolled copies).

**Ships with:** patch bumps across the family, TESTING.md metro-family note (size vars visible in the style inspector, theme override works, new defaults look right on every tile size), and — since metro is A24's future externalization candidate — the shared definition placed where the family bundle can take it along.

**Relates:** E106 ✅ (the glass typography precedent — same pattern), E114 (family parity — glass has vars, metro gets them now, material worth checking after), A24 (metro externalization — shared styles must move with the family), feezal-theme-metro (gains override examples), E38 (element scaling — cq-based icon cap interacts with tile size).

### E130 — material-outlet: auto-discovery + rename to "Switch" (family consistency)

Two gaps in the E121 ✅ outlet card:

**1. No auto-discovery.** E121 deliberately shipped without a discovery descriptor ("would collide with light/switch discovery") — but glass-switch and metro-switch both carry `discovery: {component: 'switch', …}`, so the Material family's card is the odd one out: a discovered switch (zigbee2mqtt, and E126's Homematic word-list switches once they land) can be assigned to the glass or metro card but not to the material one. **Add the same `discovery` descriptor** (component `switch`, mapping `state_topic`/`command_topic`/`payload_on`/`payload_off`/`value_template`/`name` exactly like glass-switch, availability via N31's canonical record). Verify the original collision concern against today's assignment flow: the discovery sidebar offers *all* elements whose `discovery.component` matches — multiple candidates are a user choice, not a conflict (that's exactly how glass-switch and metro-switch already coexist for the same discovered device).

**2. Rename to "Switch" — with a constraint the request needs to know about:** glass and metro call their card **"Switch"**; material calls it **"Outlet"**. But the tag/package `feezal-element-material-switch` is **already taken** — by the *Simple*-category toggle control (palette 'Switch', category 'Simple'), whose MQTT contract the family cards mirror. Decided approach, staged:
   - **Now: palette-name rename only** — `material-outlet`'s palette entry becomes `name: 'Switch'` (category Material/Device, icon can stay `power` or align to `power_settings_new` like the siblings). User-visible consistency across all three families, **zero dashboard breakage** (the tag stays `feezal-element-material-outlet`); description updated ("switch / smart-plug card").
   - **Later (blocked): tag/package alignment** — a true rename to `feezal-element-material-switch` requires first renaming the Simple toggle control's package *and* a saved-dashboard migration story (tag aliasing at load, or A23's unknown-tag detection extended into a rename map). Not worth breaking saved views for; park it until a tag-alias mechanism exists (E115's family-switching machinery is the natural home for one).

**Ships with:** discovery descriptor + palette rename in one patch bump, TESTING.md updates (discovered z2m switch offers all three family cards incl. material; palette shows "Switch" in all three families; existing dashboards with `material-outlet` tags unaffected).

**Relates:** E121 ✅ (the outlet card), E126 (Homematic switch discovery — its discovered plugs/switches should offer this card), glass-switch / metro-switch (discovery descriptor + naming to mirror), E114 (family parity contract), E115 (element family switching — future home of a tag-alias mechanism for the full rename), material-switch (the Simple toggle that owns the tag).

### E131 — Homematic motion detector discovery → *-motion/occupancy elements

The occupancy/motion cards (`material-motion`, `glass-occupancy`, `metro-occupancy`) already carry HA discovery (`component: 'binary_sensor'` with a `device_class` → `type` map, [feezal-element-material-motion.js:92-97](../www/packages/@feezal/feezal-element-material-motion/feezal-element-material-motion.js#L92-L97)), so zigbee2mqtt motion sensors auto-wire today — **Homematic motion detectors don't**: there is no native recognizer for them.

**New recognizer** following the contact pattern ([native-discovery.js](../server/src/mqtt/native-discovery.js)):

- **Match:** `hm/status/<seg>/MOTION` — `MOTION` (bool) is the state datapoint.
- **Channel-type gate:** **`MOTION_DETECTOR`** (BidCoS, confirmed). ⚠ **HmIP naming unverified** — the datapoint is probably `MOTION` there too, but the channelType may be **`MOTIONDETECTOR_TRANSCEIVER`** (HmIP-SMI/SMO); confirm against a real device's `hm` payload metadata before hardcoding the set. Metadata-less channels are never promoted (framework rule).
- **Emit** `component: 'binary_sensor'` with `device_class: 'motion'` (routes through the elements' existing `device_class` → `type` map), `state_topic` = the MOTION status topic, payloads `true`/`false`, `value_template '{{ value_json.val }}'` (→ `payload.val`), availability from `:0 UNREACH` — and **`battery_low_normalized` from day one** (motion detectors are battery devices; `LOWBAT`/`LOW_BAT` on `:0`, presence-checked per **E124**).
- Check whether HmIP exposes `ILLUMINATION` alongside MOTION — out of scope for the card, but don't let it confuse the match (whitelist MOTION only).

**Ships with:** recognizer unit tests (BidCoS + HmIP channel types, unnamed-channel behaviour consistent with the framework, battery record emission), TESTING.md discovery row (discovered Homematic motion sensor offers all three occupancy cards, wired with state + availability + battery).

**Relates:** E108 ✅ (recognizer framework — contact recognizer as the closest pattern), **E124** (battery indicator — this recognizer must emit its record from day one), E126 ✅ (switch recognizer — the most recent recognizer addition to crib from), **E132** (the consuming cards generalize to `*-sensor` — implement the recognizer against the generalized type list), material-motion / glass-occupancy / metro-occupancy (the consuming cards, discovery maps already in place).

### E132 — Generalize the boolean-sensor family: *-occupancy → *-sensor, numeric *-sensor → *-number

Water alarms, fire/smoke alarms and motion sensors all behave the same way: **one boolean state**, an icon that flips, a text per state, battery-driven hardware. The occupancy cards already ARE that element in all but name and type list — generalize them instead of growing per-hazard siblings.

**Rename plan — with a collision the request needs to know about:** "sensor" is currently taken by the **numeric** value cards in two families (`glass-sensor` — value/unit/decimals card; `metro-sensor` — value tile with trend polyline). So the rename is two-step and must cover glass too, or the family ends up inconsistent:

| Today | Becomes | Note |
|---|---|---|
| `metro-sensor` (numeric) | `metro-number` | as requested |
| `glass-sensor` (numeric) | `glass-number` | ⚠ not in the request, but required — otherwise "sensor" means *numeric* in glass and *boolean* everywhere else |
| `material-motion` (bool) | `material-sensor` | name free in material |
| `glass-occupancy` (bool) | `glass-sensor` | after glass-sensor → glass-number |
| `metro-occupancy` (bool) | `metro-sensor` | after metro-sensor → metro-number |

**Tag-migration constraint (same wall as E130):** these are TAG/package renames of shipped elements — saved dashboards carry the old tags. Palette *display names* can change freely, but the tag renames need a migration story first: a **load-time tag-alias map** (old → new rewritten when the site loads, persisted on next save) is the pragmatic mechanism, and E130/E115 already want the same thing. Decide once, build it once, then execute both items' renames through it. Until the alias mechanism exists, this item can pre-stage everything except the actual tag swap (palette names, types, icons, discovery).

**Generalized `type` list + per-type defaults (incl. state icons):** extend the existing `type` select (today `motion | presence | radar | zone`, [feezal-element-material-motion.js:108-110](../www/packages/@feezal/feezal-element-material-motion/feezal-element-material-motion.js#L108-L110)) to cover the hazard classes, each with suitable default `icon-active`/`icon-clear` and `text-active`/`text-clear` so a dropped element looks right without configuration:

| type | icon-active (suggestion) | icon-clear | texts |
|---|---|---|---|
| `motion` / `presence` / `radar` | `directions_run` / `sensor_occupied` | `sensor_occupied`-off style / `check_circle` | Motion / Clear |
| `water-leak` | `water_damage` | `water_drop` (muted) | Leak! / Dry |
| `smoke` / `fire` | `local_fire_department` | `detector_smoke` | Smoke! / Clear |
| `gas` / `co` | `warning` (gas variant) | `co2`-style | Gas! / Clear |
| `vibration` / `tamper` | `vibration` / `lock_open` | `check_circle` | Triggered / OK |
| `generic` (new `_default`?) | `sensors` | `sensors_off` | Active / Inactive |

Alarm-class types (water/smoke/gas) should default the *active* state to the error colour — an active fire alarm is not a neutral state chip. Exact icon names to be settled against the bundled Material Icons list at implementation time; the table is the intent, not the spec.

**Auto-discovery adaptation (both ecosystems):**
- **Zigbee/HA:** extend the cards' `device_class` → `type` valueMap (today `{motion, occupancy, presence, _default: 'motion'}`) with `moisture → water-leak`, `smoke → smoke`, `gas → gas`, `carbon_monoxide → co`, `vibration → vibration`, `tamper → tamper`; `_default` becomes `generic`. z2m announces all of these as `binary_sensor` with the respective `device_class` — the existing map machinery covers it, only the table grows.
- **Homematic:** per-class recognizer coverage beyond E131's motion: water (HM-Sec-WDS / HmIP-SWD) and smoke (HM-Sec-SD / HmIP-SWSD) detectors — ⚠ **channel types and alarm datapoints unverified** (BidCoS smoke is roughly `SMOKE_DETECTOR`/`STATE`, HmIP water reports distinct `ALARMSTATE`/`WATERLEVEL_DETECTED`-style datapoints; confirm against real `hm` metadata like E131's caveat). Either one recognizer with a channelType→type table or per-class siblings — decide by how uniform the datapoints turn out to be.

**Battery (E124) is part of the contract:** these are battery devices almost without exception — the generalized `*-sensor` carries E124's `subscribe-battery-low` trio and icon from day one, and both discovery producers stamp it (sibling lookup for z2m, `:0` LOWBAT/LOW_BAT presence-checked for Homematic).

**Ships with:** type/default/icon tables in the three elements (+ the two numeric renames' palette entries), discovery valueMap extension + recognizer tests, TESTING.md rows per hazard class (discovered z2m water-leak sensor lands on a `*-sensor` card with water icons + battery indicator), and the E124/E131 entries' element names updated when the renames land.

**Relates:** **E124** (battery indicator — the generalized card is its main consumer), **E131** (motion recognizer — implement against the generalized type list), E130 (the sibling rename blocked on the same tag-alias mechanism), **E115** (family switching — natural home of the alias map), E114 (parity — all renames land family-wide or not at all), E113 (taxonomy — "sensor means boolean, number means numeric" is exactly the naming discipline it wants).

### E133 — Palette category rename: "Material" → "Circle", "Simple" → "Material"

The 07/2026 category split left a naming mismatch: the **device cards** (light, climate, cover, contact, wled, …) sit in a category called *Material*, while the actual **MD3 widgets** (button, checkbox, gauge, slider, …) sit in *Simple*. Rename both so the labels say what they mean:

| Category today | Becomes | Content | Why the name |
|---|---|---|---|
| `Material` (~15 elements) | **`Circle`** | device cards | the circular-slider design language of light/climate/cover (see E134) |
| `Simple` (~24 elements) | **`Material`** | MD3 widgets | they literally are Material Design 3 controls |

**Cheap by construction — but wide:** the palette category is a **display string only** (never serialized into dashboards, no tag/package involvement — unlike E130/E132's tag renames, nothing can break in saved sites). The touch points:

- `palette.category` in every affected element file (~39 packages → ~39 patch bumps; a scripted sweep, one commit).
- The palette's fixed `ORDER` array ([feezal-palette.js:241](../www/src/feezal-palette.js#L241)) — swap `Material`/`Simple` positions for `Circle`/`Material` deliberately (decide where Circle sorts; suggestion: `Basic, Layout, System, Circle, Glass, Metro, Material, …`).
- The default-collapse and collapse-state localStorage keys hold old category names — harmless staleness (self-heals; first run after rename re-derives).
- Docs: TESTING.md §6 headings, element-spec.md's category table, the AI assistant prompt if it names categories (check `server/src/ai/prompt.js`).
- B42's filter matches category names — "circle" and "material" become search terms; no code change, but the TESTING row for the filter needs updating.

**Naming tension, accepted deliberately:** the Circle-category cards keep their `feezal-element-material-*` tags (tag prefix ≠ category label — already true today for the Simple category, whose widgets also carry `material-*` tags). The full prefix cleanup is E113/E115/A23 territory, not this item.

**Coordinate with the rename wave:** E130 (outlet→Switch palette name), E132 (occupancy→sensor) and this should land in the **same release** so users re-learn the palette once, not three times.

**Relates:** **E113** (taxonomy — this bakes "category = style family" one step further), **E134** (the Circle name's design commitment), E130/E132 (the concurrent renames), U45 (picker rework — builds on these category names), B42 ✅ (category filter).

### E134 — Circle design language: align the remaining device cards with light/climate/cover/switch

The **Circle** category name (E133) is inspired by the circular sliders of the light/climate cards — but not everything in the category speaks that language. The E132 `*-sensor` card (formerly occupancy), for one, is a plain icon+text card; dropped next to a light and a climate card it visibly belongs to a different family.

**Define the circle-card canon first** (mostly exists, scattered): the B29 ✅/B37 ✅ parity work already pinned the geometry — width-sized circle anchored at the top of the card, identical centre/radius/track-width/knob-size vars (`--feezal-*-track-width` 7, `--feezal-*-knob-size` 10), controls/rows stacking below, 180×220 default (E123 ✅ extended this to cover), canonical theme tokens. Write it down as a short section in `docs/element-spec.md` so new cards start from the canon instead of rediscovering it.

**Primary redesign: `*-sensor` (E132).** A large circular **state disc** in the card's circle position — centred type icon, accent ring/fill while active (error colour for alarm classes per E132's table), muted while clear — visually the sibling of material-light's on/off power disc (E122) and the outlet card (E121). Battery badge (E124) and label placed like the light card's chrome.

**Audit the rest of the category** rather than forcing circles everywhere: contact and door-lock are natural state-disc candidates; camera, media-player, energy-flow, plant, tank, schedule are legitimately non-circular — for those, "align" means the shared geometry/spacing/typography/theme tokens and the 180×220-compatible proportions, not a circle motif. The audit produces a per-element decision list (disc / keep-but-align / exempt) before any pixels move.

**Constraints:** visual only — MQTT contracts, attributes and discovery maps untouched; existing dashboards keep their saved sizes (defaultStyle changes affect new drops only, the E123 precedent); glass/metro families are NOT in scope (they have their own languages — E114 parity applies within each family, not across).

**Ships with:** the element-spec canon section, the audit table in this item (filled during implementation), redesigned `*-sensor` (+ contact/door-lock if the audit confirms), swatch/screenshot updates in the theme visual tests, TESTING.md rows.

**Relates:** **E133** (the name this design earns), **E132** (the sensor card being redesigned), B29 ✅/B37 ✅ (the geometry parity that IS the canon), E123 ✅ (cover's alignment — the precedent), E121 ✅/E122 ✅ (power-disc rendering to reuse), E113 (taxonomy: category = coherent design language), E38 (scaling — the canon should note cq behaviour).

### E135 — Homematic maintenance signals: ERROR_CODE + SABOTAGE badges, device-health board

Homematic `:0` maintenance channels carry two under-used, genuinely actionable datapoints:

- **`ERROR_CODE`** — device-fault reporting: a TRV signals a **stuck valve**, a Keymatic signals clutch/motor faults. Numeric, device-family-specific meanings; `0` = no error.
- **`SABOTAGE`** — case-opened/tamper detection on contacts, motion sensors, smart locks (bool).

**Decided (07/2026, discussed):**

**1. Both surfaces: per-element badges AND a device-health board.**

- **Badges via the E124 pattern:** two more canonical records on the entity — `error_normalized` / `sabotage_normalized` `{topic, property?}` — emitted by the Homematic recognizers from the `:0` channel, **presence-checked like E124's battery** (only when the datapoint has been observed; not every device has them) and auto-stamped by `_applyDiscovery` onto elements declaring the attributes (`subscribe-error` + twin, `subscribe-sabotage` + twin). State keeps rendering — warning, not blackout.
- **Device-health board — a new element** (working name `feezal-element-basic-device-health` or hm-family): the wall-panel "is everything okay?" list aggregating errors, sabotage, low battery (E124) and unreachable devices — "Heizung Bad: Fehler 4 · Haustür: Sabotage · 2 Batterien schwach". Can run discovery-less on wildcard subscriptions (`hm/status/+/ERROR_CODE`, `…/SABOTAGE`, `…/LOWBAT`, `…/UNREACH`, `…/LOW_BAT`) with the device name from the topic segment — which also makes it useful before any element-level wiring. Zigbee siblings (battery/tamper from z2m payloads) are a natural phase 2 of the board.

**2. SABOTAGE is alarm-grade** — error colour and more prominent than the battery badge; an opened case on a lock or window contact is a security event, not maintenance. ERROR badges use the warning tier.

**3. ERROR_CODE v1: nonzero = error, show the raw code** (badge + tooltip "ERROR_CODE 4"). A per-device-family code→text mapping (HM-CC-RT-DN valve faults, Keymatic clutch errors, …) is the explicit **phase 2** — each family's codes need researching against CCU docs; don't block the badge on that.

**4. V1 element scope (where the signals actually occur):** `ERROR_CODE` → the three `*-climate` cards + `material-door-lock`; `SABOTAGE` → `*-contact`, `*-motion`/`occupancy` (E132's `*-sensor`), `material-door-lock`. Shared descriptors per the E117/E124 convention.

**⚠ Verify before implementing (the usual hm-metadata caveat):** `ERROR_CODE`/`SABOTAGE` naming is BidCoS-flavoured — confirm the HmIP `:0` equivalents on real devices (HmIP tends to report `SABOTAGE` too, but error reporting may be per-channel `ERROR_*` datapoints rather than one `:0` code). Same verify-first rule as E131's channel types.

**Ships with:** recognizer tests (presence-checked emission, both records), applier auto-stamp test, the health-board element (+ TESTING.md §6 entry with element-specific notes per the checklist rule), badge rendering tests incl. the alarm-grade sabotage styling, TESTING.md rows (stuck-valve TRV shows the error badge while the setpoint stays operable; opening a contact's case shows the sabotage badge on the card AND a row on the board).

**Relates:** **E124** (the canonical-record + auto-stamp pattern this extends; battery is the third signal on the board), N31 (availability — the fourth board signal, already normalized), **E131** (motion recognizer — emits sabotage for motion sensors when it lands), E108 ✅ (recognizer framework), E66 💡 (fleet/heartbeat board — the generic sibling idea; this board is its Homematic-first concretization), E61 (HMI/alarm family — same alarm-grade signalling language), material-door-lock (Keymatic consumer).

### E136 — Metro tile backsides: redesign for touch — bigger targets, calmer layout, use the space

The metro tiles' **backsides** (the flip-to detail pages) don't hold up: buttons are too small, the available space is used poorly — **especially 4x2, where most of the tile is wasted** — the controls are bad on touch displays and finicky with the mouse, and the overall look is chaotic. `metro-climate` is the worst offender (tiny setpoint stepper, cramped mode chips); the whole family's backs deserve the same pass.

**Design brief (decided): stay true to Microsoft's Metro language — which is an ally here, not a constraint.** Original WP7/Metro was a *touch-first* language: flat surfaces, generous full-width hit areas, sharp corners, typography-led hierarchy, one accent colour. Small bordered mini-buttons are precisely what Metro *wasn't*. The redesign leans INTO the language:

- **Touch targets ≥ half a grid unit** — the mosaic unit is 70 px + 10 px gutter ([feezal-element-metro-tile.js:21](../www/packages/@feezal/feezal-element-metro-tile/feezal-element-metro-tile.js#L21)); nothing interactive below ~35 px, primary actions a full unit. Metro-style full-width flat rows and edge-to-edge segments instead of clusters of small outlined buttons.
- **Size-adaptive back layouts** — the back must lay out per tile size, not one stacked column for all: 4x2 goes **side-by-side** (e.g. climate: big setpoint stepper zone left — WP7-volume-style giant +/− halves — mode segments right); 2x2 stacks; 4x4 gets breathing room, not just stretched 2x2 content. Container queries per the E38 machinery.
- **Calmer hierarchy** — one accent, values in the large Metro display type (coordinate with **E129**'s font/icon CSS vars — do E129 first or together so sizes are tokens, not new hardcodes), labels in the quiet secondary tier, dividers by spacing rather than borders.
- **Interaction feedback** — visible pressed states (the classic Metro tilt/press effect fits and already matches the family's flip animation vocabulary); slider thumbs and rails thick enough for thumbs, with the hit area larger than the visual.

**Scope:** audit every metro back — `metro-climate` (primary), `metro-light` (ON/OFF + sliders), `metro-media` (transport + volume), `metro-wled`, `metro-cover`, `metro-sensor`/`number` (trend back is display-only but joins the layout pass). Fronts are fine — this is the backs only. MQTT contracts, attributes and flip machinery untouched (visual/layout only).

**Ships with:** browser tests for the size-adaptive layouts (back renders side-by-side at 4x2, stacked at 2x2), pressed-state and hit-area checks for the primary controls, updated theme-visual screenshots, TESTING.md metro-family row updates (explicit touch checks: setpoint stepper and mode change operable with a thumb on a wall tablet at 2x2 AND 4x2).

**Relates:** E55 ✅ (the metro family + flip machinery), **E129** (metro font/icon size CSS vars — the tokens this layout pass should build on; sequence together), A24 (metro externalization — land this before or ship as the family's first external release), E38 (container-query scaling — the size-adaptive mechanism), B53/B54/B55 (climate fix wave — metro-climate's back is touched by both; coordinate), E114 (parity — function set unchanged, looks may differ per family by design).

### E137 — Shared MQTT device contracts: extract behavior controllers (climate / light / cover / wled)

**Problem — the contract is triplicated.** For the complex device functions, the *entire MQTT behavior* — subscriptions, payload modes, scaling, mode machinery, command publishing — is implemented three times over in material / glass / metro, held in sync only by discipline and literal `duplicated, keep in sync` comments (`pctToRaw`, `hsvToRgb`/`rgbToHsv`/`parseRgb`/`xyToRgb`, the `$setpoint` substitution helper). The 07/2026 climate bug wave is the receipts:

- **B53/B55** — metro (and partly glass) silently *diverged* from material (missing `match-setpoint-max` resolution; falsy-zero mode filter added to two copies but not the third).
- **B58** — one root cause, **three files to patch**.
- **E122** (on_off light mode) — one feature, three implementations.
- **E114's whole existence** — a CI test to catch drift that shouldn't be *possible*.

**Proposal — behavior controllers (composition, not inheritance).** Per device function, a controller **package**: `@feezal/feezal-controller-climate` / `-light` / `-cover` / `-wled`, each exporting its controller class (**`ClimateController`**, **`LightController`**, **`CoverController`**, **`WledController`**) following the Lit Reactive Controller pattern. The in-repo precedent already exists: **E127's `SettlingController`** (`feezal-element/feezal-settling.js`) is exactly this shape — family-agnostic, shared by all three light elements, explicitly designed for reuse (E128 covers).

The controller owns everything MQTT:
- **Subscriptions** (wired through the host's `addSubscription`), payload modes (json / separate topics), `message-property-*` extraction, availability.
- **Normalization/scaling**: brightness min/max ↔ percent, Homematic `LEVEL` 0–1, mired ↔ kelvin, color parsing (`hsvToRgb` & friends live here, once).
- **Mode machinery**: mode-list parsing, active-entry resolution (`match-*` incl. `match-setpoint-max`), `$setpoint` substitution with correct payload *types* (B58's class of bug becomes structurally impossible), boost, Homematic Off-as-4.5° detection (B53).
- **Commands**: `setMode(entry)`, `setSetpoint(v)`, `toggle()`, `setBrightness(pct)`, `open()/stop()/close()` — with settling (E127) folded in behind the command surface.

The family element becomes a **view**: it reads controller state, renders its chrome, and forwards gestures to controller commands. **Why not a shared base class:** single inheritance is already spent — metro extends `MetroTileBase`, glass extends `FeezalGlassCard`. Mixins would dodge that, but controllers are Lit-native, host-agnostic, and unit-testable without a DOM host.

**Companion extractions** (same move, smaller scale — both with precedent):
- **Shared attribute-descriptor fragments** — the E117 `publishLocalAttribute` pattern scaled up: `climateAttributes` / `lightAttributes` / `coverAttributes` / `wledAttributes`, exported by each controller package alongside its class; families spread them into `static get feezal()` and append family-specific extras (glass `degrade`, metro `size`).
- **Shared `discovery.map` fragments** — per-function maps exported once; recognizers already stamp identical config across families (E108), so the map that consumes it should be single-sourced too.

**Benefits:**
- **Fix once.** Every divergence bug in B53–B58 would have been a single fix; every E122-style feature a single implementation.
- **E114 parity by construction.** The parity *test* shrinks from "compare full contracts across families" to "does each family wire the controller + declare the shared descriptor set" — drift in the behavior layer can no longer happen.
- **New families get cheap.** E134's circle redesign, E57 e-ink, E61 HMI, community families: a new climate element becomes "render this state object, call these commands".
- **Behavior gets unit tests** — once, against the controller, without three families × N attributes of DOM fixtures.

**Caveats:**
- **Migration risk.** ~12 elements (4 functions × 3 families) get their guts replaced; the regression surface is the entire device-element stock. **E114's parity test should exist *before* the extraction** — first as the net proving the three copies agree (or documenting where they legitimately don't), then as the proof the controller reproduces them.
- **Per-family quirks must stay expressible** — metro-light deliberately omits availability attrs (tile scope); glass defers some work to popup-open. Controller feature flags / partial adoption, not forks.
- **Version coupling.** Externalized families (A23/A24) pin against the controller packages — a controller behavior change ships to families on their own release cadence. Per-controller packaging (see Decided) narrows the pin surface to the behaviors a family actually uses, and keeps `@feezal/feezal-element` — a dependency of *every* element, down to `basic-icon` — out of the churn. Lockstep-major discipline covers breaking changes; still, the API surface must be deliberate.
- **Over-abstraction is the failure mode.** This must be an *extraction of existing code*, not a generic "device framework". Four concrete controllers, shaped by what the twelve elements actually do today.
- **Out of scope:** Polymer/paper legacy, and the non-parity families (carbon, tui, panel) keep their own wiring.

**Decided (07/2026):**
- **Bug wave first:** the B53–B58 wave is fixed **first, in the current triplicated code** (fast relief; the fixes then become the controller's regression fixtures). Extraction follows, with the E114 parity test in place as the safety net.
- **API scope: internal first** — extract for the three built-in families; document in `element-spec.md` and open to community/external families only after the shape has survived at least one refactor cycle.
- **Migration order: climate first** (worst offender, knowledge freshest from B53–B58, fixes become fixtures), then light (E127's settling is already half-extracted there), then cover, then wled.
- **v1 scope: four controllers — wled is in.** Its duplication across the three families (presets, palettes, segments) is real. switch / contact / sensor stay as-is for v1; extending further is a later reassessment (see open questions).
- **Descriptor ownership: the controller declares them.** Each controller module exports behavior + attribute-descriptor fragment + `discovery.map` fragment as **one unit**, and declares which attributes it consumes — **E114's parity test derives the parity set from that declaration** instead of a hand-maintained list.
- **Packaging: one workspace package per controller** — `@feezal/feezal-controller-<function>` (`-climate`, `-light`, `-cover`, `-wled`), not modules inside `@feezal/feezal-element`. Rationale:
  - **The base package stays lean and stable.** Every element pins `@feezal/feezal-element`; per-controller packages mean a wled behavior change never bumps the package that `basic-icon` depends on. Independent semver cadence per behavior; externalized families (A23/A24) pin only the controllers they use.
  - **Structural isolation beats build-config discipline.** Honest note on tree shaking: with ESM + `sideEffects: false` + subpath exports, per-*module* tree shaking inside one package would achieve the same dead-code elimination — bundlers shake at module granularity, not package granularity. But a package boundary makes the isolation *structural*: no accidental cross-controller imports, no barrel re-export from the base entry quietly dragging every controller into every bundle. And controllers will grow (WLED segments/effects; future schedule support per E107) — the boundary is where growth gets contained.
  - **Package = the "one unit" from the descriptor decision.** Controller class + attribute fragment + `discovery.map` fragment ship and version as one artifact; the package boundary *is* the contract boundary.
  - **Bundle-size payoff is in exports.** The export build already subsets elements per site; a site without climate elements then carries no `feezal-controller-climate` bytes at all. (The full viewer bundle imports all elements via the manifest, so it always carries all controllers — no change there.)
  - **No server work needed:** the `@feezal/` package scan whitelists `feezal-element-` / `feezal-elements-` / `feezal-theme-` / `feezal-icons-` prefixes ([elements.js:253](../server/src/build/elements.js#L253)) — `feezal-controller-*` is transparently ignored, exactly like the existing shared packages `@feezal/feezal-glass` and `@feezal/feezal-lottie` (the workspace precedent for non-element packages).
  - **Cost accepted:** four more packages under the patch-bump-per-change and lockstep-major rules, plus workspace/`www/package.json` registration for each.
  - **Cross-controller shared machinery stays in `@feezal/feezal-element`** — settling (E127), payload-mode / `message-property` extraction, scaling and color helpers shared by light+wled. No fourth "controller-core" layer for now (open question below if that shared surface grows).
- **State surface: plain properties.** Host templates read controller fields directly (`this.climate.mode`, `this.climate.setpoint`); the controller calls `host.requestUpdate()` on change — Lit-idiomatic, matches the `SettlingController` precedent.
- **Settling (E127) is a mechanism, not a device contract — no `feezal-controller-settling` package.** The device controllers are the *contract* layer (attributes + discovery + commands per function); settling is echo-suppression machinery that several of them need (light today, cover via **E128**, likely wled brightness). Its fate in the target picture:
  - The **class survives** in `@feezal/feezal-element` (it's the first named tenant of the cross-controller shared-machinery bucket; moves to `feezal-controller-core` only if that split ever happens).
  - Its **element-facing role disappears**: after migration, elements no longer instantiate `SettlingController` themselves — each device controller embeds a settling instance behind its command surface, and the settling attributes (`subscribe-working`, `message-property-working`, `subscribe-settled`, `settle-timeout`, `report-delay-ms`) are absorbed into that controller's **declared attribute fragment** (per-function defaults included — e.g. E128's generous cover `settle-timeout`). The inspector's "Settling" section is then driven by the controller declaration, and settling-attribute parity is derived like everything else.
  - **Transition:** the light elements' current direct `SettlingController` wiring is simply the pre-extraction state; it folds into `LightController` when the light slice lands. No throwaway — the class and its tests carry over unchanged, only the call site moves.
- **Sequencing vs. the rename/redesign wave: renames → extraction → redesigns.** E132/E133 renames land first (mechanical, low-risk), then the extraction, then E134/E136 write their new views **against controller state** — each element's render code is rewritten only once.

**Open questions (refinement needed):**
- **Follow-on functions** — do switch / contact / sensor (and metro-media?) join after v1 proves the pattern, or is four the right stopping point? Reassess once climate has shipped.
- **WledController surface** — presets / palettes / effects / segments are a bigger, listier state shape than climate/light/cover; refine its exact API when its slice comes up (last in the order).
- **Allow-list mechanics** — how the derived parity set expresses *permitted* family-specific extras (glass `degrade`, metro `size`): per-family allow-list in the test, or a `familyExtras` declaration next to the shared fragment?
- **`feezal-controller-core`?** — if the cross-controller machinery kept in `@feezal/feezal-element` (payload modes, `message-property` extraction, shared scaling/color) grows enough to churn the base package anyway, split it into a `@feezal/feezal-controller-core` that only controller packages depend on. Default **no** — don't add the layer until the churn is demonstrated.

**Relates:** **E114** (parity contract — this is the structural answer to it; its test lands first as the migration net), E106 ✅ (shared base class/code — this continues that line), E127 ✅ (`SettlingController` — the controller precedent and first tenant of the pattern), **E117** (shared descriptor precedent; its remaining rollout becomes one-line adoption), **B53–B58** (the motivating bug wave; fixed pre-extraction, then regression fixtures), E122 ✅ (one feature, three implementations — the cost this removes), **E115** (family switching — an identical behavior layer makes switching lossless by construction), E132/E133/E134/E136 (renames + redesigns — coordinate sequencing), A23/A24 (externalization — version-coupling caveat), E86 ✅ (descriptor-parity test precedent).

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

### A23 — Externalize element families: own git repos + npm publish (paper, tui, panel)

**Goal: keep the element set shipped with feezal small.** Three families move out of `www/packages/@feezal/` into their own GitHub repos and are published to npm — exactly the `feezal-elements-rail` pattern (local reference: `/mnt/c/Users/basti/source/repos/feezal-elements-rail`; also `feezal-elements-lcars`). Core keeps basic, material (Device), glass, layout, system — **and metro for now** (its externalization is deferred to A24).

**Decided (07/2026):**
- **N29 bundle per family** — each repo ships **one** `@feezal/feezal-elements-<family>` package (`feezal.type: elements` + `elements: [tags]` manifest) consolidating today's single-element packages. **Element tag names do not change**, so saved dashboards are untouched by the packaging change. TUI additionally carries its theme as a second package in `theme/` (rail precedent: `@feezal/feezal-theme-tui`).
- **Opt-in install** — the families are **removed from the default install**; users add a family on demand via the packages sidebar (npm install path).
- **Missing-element detection ships as part of this item** — see below; it is the upgrade path.
- **Git history is preserved** — extract each family's history with `git filter-repo` rather than starting fresh.

| Repo | Package(s) | Elements |
|---|---|---|
| `feezal/feezal-elements-paper` | `@feezal/feezal-elements-paper` | 11 (badge, button, card, checkbox, dialog, dialog-view, dropdown, listbox, slider, switch, tabs) |
| `feezal/feezal-elements-tui` | `@feezal/feezal-elements-tui` + `@feezal/feezal-theme-tui` | 8 (ascii, checkbox, crt, log, menu, panel, sparkline, value) |
| `feezal/feezal-elements-panel` | `@feezal/feezal-elements-panel` | 5 (7seg, gauge, knob, led, switch) |

**Repo-side work (per family):** consolidate the single-element packages into the bundle (shared `index.js` importing every element module; dedupe shared helpers while at it), copy the rail scaffolding (`ci.yml`, `publish.yml` with the version-compare jobs, `PUBLISHING.md`, `CLAUDE.md`, LICENSE, README, vitest setup), port the family's TESTING.md §6 entries into the repo, lockstep-major versioning with core (start at the current core major).

**Core-side work (once, after the pilot family proves the path):**
- Remove the family packages + their `www/package.json` entries, `npm install`, regenerate `www/editor/feezal-elements.js`, prune the moved TESTING.md sections (pointer to the family repos), update docs/element-spec references and release notes.
- **Verify the package-manager install path handles `feezal-elements-*` bundles end-to-end** (server `_scan()` supports them; the sidebar install/uninstall flow must too, incl. theme packages).
- **Missing-element detection (the migration feature):** on loading a site in the **editor**, collect custom-element tags matching `feezal-element-*` that are not registered (`customElements.get()` fails); map tag prefix → family npm package via a small static map shipped with the editor (`paper-* → @feezal/feezal-elements-paper`, …); show a non-blocking banner "This dashboard uses N elements from <family>, which is no longer bundled — Install?" wiring into the packages-sidebar install. Viewer: console warning listing missing tags. TESTING.md section for the detection flow.

**Your checklist per family (ops steps, in order):**
1. ☐ Create the GitHub repo under the `feezal` org (e.g. `feezal/feezal-elements-paper`), MIT, no auto-README.
2. ☐ Clone to the local machine (`/mnt/c/Users/basti/source/repos/feezal-elements-<family>`).
3. ☐ Extract history: `git filter-repo` over a fresh feezal clone, keeping `www/packages/@feezal/feezal-element-<family>-*` (+ theme package where applicable), then merge/graft that into the new repo.
4. ☐ Scaffold from the rail template (workflows, PUBLISHING.md, CLAUDE.md, vitest) and consolidate to the N29 bundle; port tests + TESTING entries.
5. ☐ Local smoke test against feezal: temporary `file:`/`npm link` dependency in `www/`, palette + one element of each type on a canvas, viewer render.
6. ☐ **Initial manual npm publish** (Trusted Publisher config only exists after a first publish): `npm publish --access public` from the repo root — and from `theme/` for tui. Verify with `npm view`.
7. ☐ **Configure npm Trusted Publishing (OIDC)** on npmjs.com for **each** package: package page → Settings → Trusted Publisher → GitHub Actions, org `feezal`, repository `feezal-elements-<family>`, workflow `publish.yml`, environment empty. No tokens/secrets.
8. ☐ Test the automated path: patch-bump, push to `main`, confirm `publish.yml` publishes with provenance.
9. ☐ Install the family from npm via the feezal packages sidebar on a scratch site; verify palette/theme/uninstall.
10. ☐ Only then: core-side removal PR (see above) + release note.

**Sequencing:** pilot with **panel** (smallest, 5 elements, no theme), then tui, paper. The detection feature lands with the pilot's core-removal PR. E63 (schematic family) starts external from day one and never enters core; metro follows later as A24.

**Relates:** N29 (bundle mechanism), A20 (scaffolding/ecosystem tooling — this creates the de-facto template), rail/lcars repos (living precedent incl. PUBLISHING.md), E63 (first born-external family), A24 (metro — deferred follow-up), E106 (the glass shared-code lessons apply when consolidating families), packages sidebar + `server/src/build/install.js` (install path under test).

### A24 — Externalize the metro element family *(future — will be done later)*

Metro **stays bundled with feezal for now** (decided 07/2026) — it moves out **after** the A23 families (panel, tui, paper) have proven the path. When it happens, it is a straight application of the A23 playbook, nothing metro-specific to design:

- Repo `feezal/feezal-elements-metro`, one N29 bundle `@feezal/feezal-elements-metro` (10 elements: climate, contact, cover, light, media, occupancy, sensor, switch, tile, wled) + `@feezal/feezal-theme-metro` in `theme/`.
- Follow the A23 per-family ops checklist verbatim (repo, clone, `git filter-repo` history extraction, rail scaffold, manual first publish incl. theme, npmjs OIDC per package, automated-publish test, sidebar install verification, core-removal PR).
- The A23 missing-element detection map gains the `metro-* → @feezal/feezal-elements-metro` entry **already in A23's implementation** (it costs nothing and future-proofs dashboards for this move).

**Not before:** A23 complete for all three families and the detection/install flow proven in a release.

**Relates:** A23 (the playbook — do that first), N29, E106 (metro shares the same consolidation considerations glass had).

### A27 — i18n: editor localization + language-aware element defaults 💡 to refine — needs discussion

feezal is English-only today — and not just the editor chrome: **element attribute defaults bake English into every dashboard** (`label-on: 'On'`, `label-off: 'Off'`, `done-label: 'Done'`, contact state texts, `labelOff: 'off'` centre text, …). A German wall tablet should say "Ein/Aus" without the user hand-setting every label on every element.

**Foundation decided (07/2026): the site `locale` attribute lands in N38** (localized number formatting) — this item consumes that same attribute for its language-aware defaults rather than introducing a second setting. Open sub-question to settle here: whether the *editor chrome* language follows the site locale or gets its own editor-level setting (an editor used in English can legitimately build German dashboards).

**Proposed scope split (phased — the phases are independently shippable):**

1. **Phase 1 — language-aware element text defaults** (smallest string count, highest end-user value). The *runtime display defaults* of text attributes become locale-aware; **explicitly set attributes always win**, and **serialized HTML stays locale-independent** (an unset `label-on` stores nothing — a shared dashboard renders "On" on an English tablet and "Ein" on a German one; that's a feature, not a bug).
   - **Mechanism suggestion:** attribute descriptors gain inline dictionaries — e.g. `default: 'On', defaultI18n: {de: 'Ein'}` — resolved at render time against the active locale (fallback chain: exact locale → language → `default`). Inline dicts keep **element packages self-contained** (critical for A23/A24 externalized families — no central catalog dependency), and the inspector shows the localized default as the field placeholder.
   - Locale source: a **site-level `lang` setting** (site attribute; default = browser `navigator.language`) — the *viewer's* texts follow the site/browser, not the editor.
   - Date/number elements (`basic-datetime`, clock, sensor decimals) should pass the same locale to the `Intl` APIs they already use.
2. **Phase 2 — editor chrome** (menus, dialogs, sidebar labels, context menus, toasts). Needs a real message catalog. **Library decision to discuss:** `@lit/localize` (Lit-3-native, XLIFF workflow, runtime or build-time transform mode, small and self-hosted — A25-compatible) vs. a hand-rolled `t()` + JSON dictionaries (zero dependency, no tooling, fine for two languages). Editor language = editor user preference (separate from the site `lang`).
3. **Phase 3 — ℹ help texts and docs** — by far the largest surface (hundreds of strings across all element packages). Realistically community- or AI-assisted translation; keep them in the per-descriptor inline-dict format from phase 1 (`help` / `helpI18n`) so external packages stay self-contained. Explicitly fine to lag behind phases 1–2.

**Languages (decided 07/2026):** `en` + `de` first — en stays the source language / final fallback; everything below is future and must not complicate the en+de implementation beyond keeping the dictionary format open.

**Full target set** (BCP-47): `en`, `de`, `nl` (Dutch), `pt` (Portuguese), `es` (Spanish), `fr` (French), `it` (Italian), `sv` (Swedish), `no`/`nb` (Norwegian), `fi` (Finnish), `lt` (Lithuanian), `et` (Estonian), `lv` (Latvian), `pl` (Polish), `uk` (Ukrainian), `cs` (Czech), `ro` (Romanian), `el` (Greek), `ru` (Russian), `zh` (Chinese), `ja` (Japanese), `ko` (Korean).

**Accepted additions (07/2026):** **`da` (Danish)** — completes the Nordic set; **`hu` (Hungarian), `sk` (Slovak), `bg` (Bulgarian), `hr` (Croatian), `sl` (Slovenian)** — round out the EU/Central-European coverage; **`tr` (Turkish)** — very large home-automation community. **Variant decisions, still open:** `pt` should probably mean both `pt-PT` and `pt-BR` (Brazil is a huge smart-home market — decide one `pt` or both); `zh` needs the `zh-Hans`/`zh-Hant` split decided (Simplified first, most likely).

**South/Southeast Asia (assessed 07/2026):**
- **`vi` (Vietnamese)** and **`id` (Indonesian)** — accepted, near-zero cost: both Latin-script; the A25 ✅ font vendoring *already ships the Vietnamese Roboto subset*, Indonesian is plain Latin, and `id` largely covers Malay too. Translation files are the entire cost.
- **`th` (Thai)** — accepted with a font note: own script, not in the vendored set, but small alphabet — a Noto Sans Thai woff2 subset is tens of kB and vendorable within A25's rules (unlike CJK, no system-font compromise needed); browsers handle Thai word segmentation natively.
- **`hi` (Hindi)** — candidate, **lower priority, honest caveat**: India's tech/smart-home audience overwhelmingly uses English-language interfaces, so `hi` buys less reach per translation than anything else on this list. Devanagari is a modest, vendorable subset if it lands. The wider Indic family (Bengali, Tamil, Telugu, …) is explicitly out unless demand appears — each script is its own font.

**RTL (`ar` Arabic, `he` Hebrew) is NOT a language entry** — it's a layout mode and has its own item: **A29**. The dictionary format designed here must merely not preclude RTL locales (it doesn't cost anything extra today).

**Font-coverage constraint (ties into A25 ✅):** the vendored Roboto subsets already cover **every European language above** — latin, latin-ext (lt/et/lv/pl/cs/ro/hu/tr), cyrillic (ru/uk/bg), greek, vietnamese all shipped with the 07/2026 font vendoring. **CJK does not**: bundling Chinese/Japanese/Korean glyphs is megabytes per script (Noto Sans CJK), which collides with A25's self-hosting and the export-size goals — the realistic plan is a `system-ui` font-stack fallback for CJK locales (UI text renders in the OS font), decided and documented when zh/ja/ko land, not silently.

**Open questions (refine before implementation):** exact locale fallback semantics (de-AT → de → en); whether phase 1's resolution happens in the base `FeezalElement` (a `localizedDefault(attr)` helper reading the descriptor) or at descriptor-registration time; how the AI assistant's generated labels interact with locale defaults; whether the viewer export should pin a locale or stay dynamic; editor-language persistence (localStorage vs settings).

**Relates:** A23/A24 (externalized element packages must carry their own translations — the inline-dict design exists because of this), A25 (no-CDN rule — any i18n lib must be bundled/self-hosted), **A29** (RTL — layout mode, deliberately split out), **N38** (site locale — the foundation attribute), E99 ✅-era label work (`label-on`/`label-off` — the attributes phase 1 localizes were introduced for exactly this localisation need, just manually), U37 (welcome wizard — early editor-chrome translation candidate), basic-datetime/clock (Intl locale pass-through).

### A29 — RTL layout support (Arabic, Hebrew) 💡 future

Right-to-left support is **a layout mode, not a translation** — which is exactly why it lives here and not in A27's language list: translated strings are the cheap part; the work is directionality.

**The critical scope decision, made now so it doesn't get discovered mid-implementation: the dashboard canvas does NOT mirror.** Views are user-designed absolute layouts (`top`/`left` px coordinates) — flipping them under an RTL locale would wreck every existing design and violate the author's intent. RTL applies to:

- **Text rendering inside elements** — largely free (`dir="auto"` / the browser's bidi algorithm on labels, values, template output).
- **Element-internal UI layouts** — the real work: layout-app's drawer side and bar order, tab bars, dialog headers/footers, the label/value/unit ordering in cards, slider directionality (RTL sliders run right→left), chevrons/back-arrows (mirrored) vs. content icons like play ▶ (never mirrored — follow the Material iconography mirroring list).
- **Editor chrome** — sidebars, inspector rows, menus; only meaningful once A27 phase 2 (editor translation) exists, and possibly never worth it (an RTL-language user editing in the English editor is acceptable; decide then).

**Mechanism:** CSS **logical properties** (`margin-inline-start`, `inset-inline-end`, …) adopted incrementally in element-internal styles — but only where RTL semantics are actually wanted; the canvas positioning code keeps physical `top`/`left` by design. `dir` attribute set on `<feezal-site>` from the locale (`ar`/`he` → `rtl`), elements opt in per component as they are audited.

**Fonts:** Arabic/Hebrew glyphs are not in the vendored Roboto set (A25 ✅) — same strategy as CJK in A27: `system-ui` fallback for RTL locales, decided and documented, no megabyte font bundles.

**Explicitly future:** nothing here blocks or complicates A27's en+de work; the only present-day requirement (A27's dictionary format must not preclude RTL locales) is already met.

**Relates:** **A27** (the language machinery this rides on — split out from its language list 07/2026), A25 ✅ (font self-hosting constraint), N38 (site locale — supplies the locale that flips `dir`), layout-app / tab bars / sliders (the element-internal audit surface), E38 (element scaling — the other cross-cutting element-CSS audit; coordinate if both run).

### A28 — Configurable per-site CSP: "Security" tab in Site Settings

A25 ✅ shipped a **fixed** CSP: code directives (`script/style/font-src`) hard-locked to `'self'`, content directives (`img/media/connect/frame-src`) wide open for user-configured dashboard content. Both halves deserve configuration: a corporate font host or a trusted script origin can't be allowed today, and conversely a locked-down kiosk can't *tighten* images/iframes/connections to exactly the hosts its dashboard uses.

**Decided (07/2026, discussed):**
- **Fully configurable, every directive, all three states** — `Open (any host)` / `feezal only ('self')` / `Selected hosts` + origin list — *including* the code directives up to `Open`. Loosening `script-src` beyond `'self'` **must carry a prominent warning** ("reverts feezal's no-third-party guarantee for this site — scripts from these origins can read your dashboard and broker traffic"), but the choice is the user's.
- **Violation-driven suggestions ship in v1** (not deferred): the CSP carries a same-origin `report-uri` (`/api/csp-report/<site>`; note `report-uri` is deprecated-but-universal vs. the Reporting-API `report-to` — pick pragmatically, possibly both), the server keeps a small per-site ring buffer (no persistence beyond a cap, stays fully local per A25), and the Security tab lists recent violations as one-click *"blocked: xyz.com (image) — allow?"* chips. This is the actual UX for building an allowlist.
- **Editor CSP stays fixed** at the A25 baseline — no per-site plumbing on the editor route; the canvas renders user content fine because the baseline's content directives are open.
- **Exports: out of scope** (A25 already recorded the `file://` `'self'` unreliability); revisit if demand appears.

**Storage & enforcement:** `viewer.security.csp` in the site config — per aspect `{mode: 'all'|'self'|'hosts', hosts: []}`, defaults = the A25 baseline (fully backwards compatible, absent config → today's header). The **viewerHandler builds the per-site header for the HTML document** (CSP is a document-level policy — shared assets keep the global baseline header). Origins validated as `scheme://host[:port]` (no paths, no wildcards beyond `*.example.com`).

**Non-negotiable header invariants (the builder enforces, not the UI):**
- `script-src`/`style-src` always retain `'unsafe-inline'` (+ `'unsafe-eval'` on script) — feezal's own bootstrap/template machinery needs them; allowlisting *adds* origins, never strips the baseline tokens.
- `font-src` keeps `data:`, `img/media` keep `data: blob:`, worker/base/object stay at baseline.
- `connect-src` **always includes `'self'` + the MQTT broker origin** (auto-derived from Connection settings) — shown in the UI as a locked, labeled chip ("your broker"), not removable; without it every tightened site instantly breaks.

**Security tab UX** (new tab in `feezal-sidebar-viewer` beside Connection/Site/Viewer/Clients):
- Human labels, not directive names: *Images & cameras* (`img-src` + `media-src`), *Embedded pages (iframes)* (`frame-src`), *Network connections* (`connect-src`), and an **Advanced** disclosure for *Scripts / Styles / Fonts* with the loosening warning.
- Per row: the 3-state select + origin chips with an add-input; invalid origins rejected inline.
- **Locked auto-chips:** broker origin (connect), `tile.openstreetmap.org` when a map element runs on default tiles.
- **Content-scan suggestions:** scan the site markup for external hosts in element attributes (`basic-iframe` src, image/camera URLs, …) → one-click "found in your dashboard — allow" chips, so tightening starts from reality instead of an empty list.
- **Violations list:** recent blocked requests (host, directive, count, last seen) with one-click allow; a "changes apply on deploy" hint (N32 ✅ reloads viewers, so the new policy lands immediately after deploy).

**Ships with:** header-builder unit tests (modes, invariants, broker auto-include, origin validation), report-endpoint tests (cap, per-site isolation), e2e (tighten `img-src` → external image blocked + violation row appears → one-click allow + deploy → image loads), TESTING.md section, and a user-guide §14 addendum (the privacy statement gains "per-site CSP configuration" and documents the report endpoint as same-origin/local-only).

**Relates:** A25 ✅ (the fixed policy this makes configurable — its invariants become the floor), **B51** (the `data:`/system-icon fix must survive the configurable builder), B52 (cache headers — same middleware neighbourhood), N32 ✅ (deploy-reload delivers policy changes), U39 ✅ (structured inspector patterns for the tab), A18 (kiosk — the tighten-everything consumer).

## Open Questions

**Package Manager (N4 and N23 shipped — both archived)**
- ~~Icon-set contract: is a `feezal-icons-*` package a webfont + name list, registered SVG symbols, or both?~~ **Settled (N23):** both modes — `{font, names}` for ligature webfonts, `render(name)` for SVG — see `docs/icons-spec.md` §3.

**History-in-payload convention (E69, E70, comparison/ad-hoc trends)**
Several analytics elements need historical data feezal deliberately doesn't store (real history = E28/A11 Grafana). Middle ground to decide: a documented convention where an **external aggregator (she, Node-RED) publishes a retained JSON series to a topic and the element only renders it** — settle the series JSON shape once (timestamps + values, units, buckets?) and reuse it across carpet plot, Sankey totals, comparison charts, and possibly E30's future first-load backfill. Keeps feezal storage-free while unlocking the whole analytics category.

**Layout & responsive design**
See the design exploration earlier in this file — the view-in-view nesting concept is the likely foundation. Full responsive layout support is a longer-term goal; no decisions needed yet.

---
