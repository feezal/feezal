# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Table of Contents

**Bugs**
- [B61 — Glass backdrop-filter: drawer-hover repaint bleeds artifacts into the view (Chrome/macOS only)](#b61--glass-backdrop-filter-drawer-hover-repaint-bleeds-artifacts-into-the-view-chromemacos-only)
- [B62 — Gradient view background tiles/scrolls instead of staying put (Safari/iOS, PWA)](#b62--gradient-view-background-tilesscrolls-instead-of-staying-put-safariios-pwa)
- [B63 — "Open viewer" does nothing on Safari/iOS (regression)](#b63--open-viewer-does-nothing-on-safariios-regression)
- [B68 — `glass-meter` + `glass-loadpoint`: card overflows the host and ignores its height](#b68--glass-meter--glass-loadpoint-card-overflows-the-host-and-ignores-its-height)
- [B69 — `glass-meter` is overloaded: move the secondary readouts into a details popup](#b69--glass-meter-is-overloaded-move-the-secondary-readouts-into-a-details-popup)
- [B70 — System element editor placeholders: swipe shows text not icon, mismatched chrome, inconsistent default sizes](#b70--system-element-editor-placeholders-swipe-shows-text-not-icon-mismatched-chrome-inconsistent-default-sizes)
- [B71 — `system-splash` appears to do nothing in the viewer (no visible splash/spinner)](#b71--system-splash-appears-to-do-nothing-in-the-viewer-no-visible-splashspinner)
- [B72 — `device-health`: one list entry per entity instead of per device (ESPHome / zigbee2mqtt)](#b72--device-health-one-list-entry-per-entity-instead-of-per-device-esphome--zigbee2mqtt)
- [B73 — Background editor (view styles): solid + gradient colour fields should use the style-inspector var-autocomplete, not a dropdown; widen the too-small percent input](#b73--background-editor-view-styles-solid--gradient-colour-fields-should-use-the-style-inspector-var-autocomplete-not-a-dropdown-widen-the-too-small-percent-input)
- [B74 — View theme selector: rename the default entry "Site theme (default)" → "Inherit" and drop its colour swatch](#b74--view-theme-selector-rename-the-default-entry-site-theme-default--inherit-and-drop-its-colour-swatch)
- [B75 — Roadmap IDs leak into user-facing help texts & labels](#b75--roadmap-ids-leak-into-user-facing-help-texts--labels)
- [B76 — `paper-slider`: invisible track (default ≈ background) + knob defaults should be `--primary-text-color`](#b76--paper-slider-invisible-track-default--background--knob-defaults-should-be---primary-text-color)

**Near-term Improvements**
- [N2b — Repeater with live canvas sub-elements](#n2b--repeater-with-live-canvas-sub-elements-future) *(future)*
- [N12 — Export bundle: strip mqtt.js for feezal-bridge users](#n12--export-bundle-strip-mqttjs-for-feezal-bridge-users-partial) *(partial)*
- [N13 — Lighter MQTT client for export bundle](#n13--lighter-mqtt-client-for-export-bundle-️-tbd) ⚠️
- [N38 — Site locale: localized number formatting (decimal separator & friends)](#n38--site-locale-localized-number-formatting-decimal-separator--friends)

**Element Ecosystem**
- [E20 — Weather forecast (`feezal-element-material-weather`)](#e20--weather-forecast-element-feezal-element-material-weather)
- [E28 — Grafana integration](#e28--grafana-integration)
- [E29 — Tile / compact state element (`feezal-element-material-tile`)](#e29--tile--compact-state-element-feezal-element-material-tile)
- [E30 — Mini live sparkline (`feezal-element-basic-sparkline`)](#e30--mini-live-sparkline-feezal-element-basic-sparkline)
- [E32 — Logbook / event list (`feezal-element-basic-logbook`)](#e32--logbook--event-list-feezal-element-basic-logbook)
- [E38 — Element scaling / responsive sizing](#e38--element-scaling--responsive-sizing-️-tbd--needs-element-audit) ⚠️
- [E54 — Markdown element (`feezal-element-basic-markdown`)](#e54--markdown-element-feezal-element-basic-markdown)
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
- [E112 — Scrypted integration: camera snapshot element](#e112--scrypted-integration-camera-snapshot-element-sensors-already-work--to-refine) 💡 *(to refine)*
- [E113 — Element taxonomy: make "function × style" explicit](#e113--element-taxonomy-make-function--style-explicit--needs-discussion) ⚠️
- [E114 — Family parity contract: material/circle / glass / metro stay in sync](#e114--family-parity-contract-materialcircle--glass--metro-stay-in-sync--needs-discussion) ⚠️
- [E119 — `basic-number`: configurable placeholder before the first value](#e119--basic-number-configurable-placeholder-before-the-first-value)
- [E125 — Homematic battery voltage (`OPERATING_VOLTAGE`)](#e125--homematic-battery-voltage-operating_voltage--future) 💡
- [E128 — Homematic blinds: settling behaviour + `DIRECTION` indicator](#e128--homematic-blinds-settling-behaviour--direction-indicator-later--after-e127) *(later)*
- [E139 — "Fancy" element family: Lottie-animated device cards](#e139--fancy-element-family-lottie-animated-device-cards)
- [E144 — Lock autodiscovery: Homematic BidCoS (Keymatic) + HmIP smart locks + zigbee2mqtt](#e144--lock-autodiscovery-homematic-bidcos-keymatic--hmip-smart-locks--zigbee2mqtt--keymatic--z2m-done-hmip-dld-open) 🔨 *(Keymatic + z2m done; HmIP-DLD open)*
- [E145 — Autodiscovery support for ccu-jack's MQTT interface](#e145--autodiscovery-support-for-ccu-jacks-mqtt-interface)
- [E150 — Discovery for profile-shaped components: `water_heater` ✅ + `lawn_mower` 🔨](#e150--discovery-for-profile-shaped-components-water_heater---lawn_mower)
- [E151 — Gauge parity: `glass-gauge` + `metro-gauge`](#e151--gauge-parity-glass-gauge--metro-gauge)
- [E152 — Rename `metro-tile` → `metro-button` (naming parity)](#e152--rename-metro-tile--metro-button-naming-parity)
- [E153 — `metro-loadpoint`: move the overloaded front controls to a 2×2 backside](#e153--metro-loadpoint-move-the-overloaded-front-controls-to-a-2×2-backside)

**Editor UX**

- [U3 — Element grouping and locking](#u3--element-grouping-and-locking-partial) *(grouping not yet done)*
- [U23 — Custom collapsed placeholder text in the source editor](#u23--custom-collapsed-placeholder-text-in-the-source-editor-blocked-by-upstream) 🚧
- [U38 — Topic browser sidebar panel](#u38--topic-browser-sidebar-panel)
- [U45 — Element insertion: palette sidebar + full-screen picker](#u45--element-insertion-palette-sidebar--full-screen-picker--to-refine) 💡 *(to refine)*
- [U50 — layout-app: expose the content area's inset (padding)](#u50--layout-app-expose-the-content-areas-inset-padding)
- [U58 — "Generate" button: bulk element + app scaffold wizard from discovery](#u58--generate-button-bulk-element--app-scaffold-wizard-from-discovery--to-refine) 💡
- [U61 — Editor preview fidelity: gradient/background in a percentage-sized view's scroll overflow](#u61--editor-preview-fidelity-gradientbackground-in-a-percentage-sized-views-scroll-overflow)

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
- [A29 — RTL layout support (Arabic, Hebrew)](#a29--rtl-layout-support-arabic-hebrew--future) 💡 *(future)*


---

## Bugs

### B61 — Glass backdrop-filter: drawer-hover repaint bleeds artifacts into the view (Chrome/macOS only)

**Reported (07/2026).** A `layout-app` with sub-views built from **glass** elements. Sub-views: theme `glass`, plus a manually configured **gradient background**. The `layout-app`'s own view: theme `midnight-blue`. Hovering the entries in the `layout-app` **drawer** produces **strange visual artifacts** in the embedded view, *underneath the glass elements* — as if the drawer entry's hover background-color change is bleeding into the view. **Chrome / macOS only** — does **not** reproduce on Chrome / Windows.

**Analysis (do NOT fix yet).** This has the fingerprint of a **`backdrop-filter` invalidation/compositing artifact**, which is a known class of Chrome bug on macOS:
- Glass cards paint a live blur: `-webkit-backdrop-filter / backdrop-filter: blur(var(--feezal-glass-blur, 20px))` ([feezal-glass.js:66-68,105-106](../www/packages/@feezal/feezal-glass/feezal-glass.js#L66-L68)). A `backdrop-filter` samples everything painted behind the element, so its correctness depends on the browser invalidating the filtered region whenever *anything* behind or around it repaints.
- The drawer entries repaint on hover: `.entry:hover { background: rgba(128,128,128,0.12); }` with a hover `transition` ([feezal-element-layout-app.js:123,142](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L123)). That per-hover background repaint is the trigger.
- On macOS Chrome the backdrop-root / dirty-region for the glass cards' `backdrop-filter` appears to be computed too narrowly (or on a stale layer), so the drawer's repaint region isn't correctly isolated from the backdrop-filtered content — the hover paint smears/ghosts into the glass cards' sampled backdrop.
- **Why macOS-only:** Chrome uses a different GPU compositing backend per platform (macOS → Metal/CoreAnimation; Windows → ANGLE over D3D). `backdrop-filter` layerization and invalidation bugs are routinely backend-specific, which is exactly why this splits along OS lines rather than being a logic bug in feezal.
- **Likely aggravators (all present in this repro):** the **theme mismatch** (drawer/host view `midnight-blue` vs. sub-view `glass`) and the **manual gradient background** mean the glass cards' backdrop samples across differently-backed layers; and nested stacking contexts (`layout-app` embedding a view that contains `container-type: size` glass hosts — [feezal-glass.js:60](../www/packages/@feezal/feezal-glass/feezal-glass.js#L60)) give the compositor more layer boundaries to get wrong.

**This is primarily a browser bug, but feezal can likely mitigate it** (candidate directions, to validate — not yet chosen): force the embedded-view content and/or the glass cards onto a **stable, isolated compositing layer** so drawer repaints can't invalidate their backdrop root — e.g. `isolation: isolate` on the content container, a `transform: translateZ(0)` / `will-change: transform` promotion, or `contain: paint` on the `.drawer` so its hover repaint is confined. Each of these can *also* make `backdrop-filter` worse on some Chrome versions, so this must be measured, not assumed. The existing **"solid card" degrade** (glass elements can replace the live blur with a semi-opaque solid card — [feezal-element-glass-light.js:62](../www/packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js#L62)) is the guaranteed-correct fallback and a useful confirmation lever (see below).

**Diagnosis needed from the reporter before attempting a fix — please capture:**
1. **`chrome://gpu` dump** (or at least the top section): Chrome version, exact macOS version, GPU model, and the **ANGLE / graphics backend** line (Metal vs OpenGL vs SwiftShader), plus whether "Out-of-process Rasterization" / "Compositing" are hardware accelerated.
2. **Solid-card test (the key isolating step):** switch the glass elements to the **solid-card / no-blur** mode (the per-element blur-off option). If the artifacts **vanish**, that confirms `backdrop-filter` as the cause and points the fix at layer isolation rather than the drawer.
3. **A screen recording (or burst of screenshots) of the artifacts** — what do they actually look like? Ghost of the hover highlight? Smearing/trails? Colour bleed of the gradient? A stale rectangle? The *shape* of the artifact tells us which layer is mis-invalidated.
4. **Minimal-repro narrowing** — does it still happen when you remove, one at a time: (a) the manual gradient background (plain solid view bg), (b) the theme mismatch (set the `layout-app` view to `glass` too, or the sub-views to `midnight-blue`), (c) the `slim`/`autohide` drawer modes, (d) `entry-style: list` vs `pill`, (e) the drawer in **overlay** vs **persistent** mode? Each "no longer repros" narrows the trigger.
5. **Backend swap** — in `chrome://flags`, set **"Choose ANGLE graphics backend"** to a different value (e.g. Metal → OpenGL) and/or toggle GPU compositing, restart, and retest. If a different backend fixes it, that nails it as a Metal-path compositor bug (and informs whether a CSS layer hint can dodge it).
6. **Viewer vs editor** — does it reproduce in the **deployed viewer** as well as the editor canvas? (Rules out editor-only chrome/overlays as a contributor.)
7. **Does simply scrolling / any other repaint over the view** (not just drawer hover) trigger similar artifacts, or is it specifically the drawer entry hover? (Distinguishes "any repaint invalidates the backdrop" from "the drawer layer specifically".)

**Ships with (once diagnosed):** the chosen layer-isolation CSS fix (guarded so it doesn't regress `backdrop-filter` performance/correctness on other platforms), a TESTING.md note (glass sub-views inside `layout-app`, hover drawer entries on macOS Chrome → no artifacts), and — if no clean CSS fix exists — documentation of the solid-card fallback as the recommended setting for macOS-heavy deployments.

**Relates:** the glass family (`feezal-glass` — the `backdrop-filter` source), `layout-app` (the drawer whose hover triggers it), the glass **solid-card degrade** option (the fallback + diagnostic lever), E38/performance (backdrop-filter GPU cost is already a documented glass concern), per-view themes ✅ (the theme mismatch is an aggravating input here).

### B62 — Gradient view background tiles/scrolls instead of staying put (Safari/iOS, PWA)

**Reported (07/2026).** A view with a **gradient background**, viewed on **Safari / iOS in PWA (installed / standalone) mode**. Scrolling down the view, the gradient background is **not sticky** — it scrolls with the content and **repeats/tiles**, which looks broken.

**Analysis (do NOT fix yet).** Two feezal-side mechanisms combine with two iOS Safari limitations:
- **The viewer mirrors the view background onto `<html>` and `<body>`.** In the viewer, `feezal-site` copies the current view's `background` shorthand verbatim onto `document.documentElement` and `document.body` ([feezal-site.js:483-486](../www/src/feezal-site.js#L483-L486)) — added so the iOS status-bar inset (`viewport-fit=cover`) and overscroll bounce show the view colour instead of white. For a gradient view that value is a `linear-gradient(...)`/`radial-gradient(...)`, set with **no** accompanying `background-size` / `background-repeat` / `background-attachment`.
- **A gradient with those defaults tiles.** CSS gradients default to `background-repeat: repeat` and `background-size: auto` — the gradient renders at one "tile" and **repeats down** any element taller than that tile. On a scrollable page (content taller than the viewport) the body/html gradient therefore repeats as you scroll.
- **iOS Safari ignores `background-attachment: fixed`** (long-standing) — so even if we added `fixed` to pin the gradient to the viewport, iOS would render it as `scroll`. The canonical iOS workaround is a separate `position: fixed` full-viewport backdrop layer behind the content, not `background-attachment`.
- **The host also carries a `--feezal-canvas-bg` sync with `background-attachment: local`** ([feezal-site.js:41-45](../www/src/feezal-site.js#L41-L45)) — meant to extend the current view's background across the full scrollable area. This works in the **viewer** but is **overridden by the editor-only checkerboard rule** ([feezal-site.js:59-64](../www/src/feezal-site.js#L59-L64)) — the source of the separate editor WYSIWYG discrepancy (**Issue B** below). The core iOS defect is on the **viewer**'s `<body>`/`<html>` gradient mirror (**Issue A**).
- **Why PWA/standalone makes it obvious:** full-screen standalone mode + iOS momentum/overscroll exposes the whole tall background with no browser chrome, so the tiling and scroll are unmistakable.

**Update (07/2026) — cross-platform testing splits this into TWO distinct issues.**
- **Viewer, Chrome/Windows:** gradient background is **sticky and correct** across the full scroll area.
- **Viewer, Safari/iOS:** the gradient **tiles/scrolls** — **the core B62 defect** (iOS-only).
- **Editor, both platforms (Chrome/Windows == iOS):** scrolling down reveals the **checkerboard grid** in the overflow area — a *second, separate* issue (see below), not the iOS tiling bug.

**Issue A (core, iOS viewer only).** The desktop viewer renders the `<body>`/`<html>` gradient mirror correctly (root-element background propagates to the viewport and stays put); iOS Safari does not (ignores `background-attachment: fixed`, tiles on the tall scroll/overscroll). Fix targets **only** the iOS viewer path — a `position: fixed` viewport backdrop for gradient backgrounds — leaving the correct desktop viewer untouched.

**Issue B → split out to [U61](#u61--editor-preview-fidelity-gradientbackground-in-a-percentage-sized-views-scroll-overflow).** The reporter's 100%-sized view showed checkerboard on scroll in the **editor** where the **viewer** fills the gradient (the editor checkerboard rule overrides the `--feezal-canvas-bg` sync). That editor/viewer preview-fidelity gap + the view-sizing decisions behind it are tracked in **U61**, not here — B62 covers only the iOS tiling defect (Issue A).

*(A separate regression surfaced during the same session — the viewer would not open at all from the editor on iOS; tracked as **B63**.)*

**Fix direction (note only, not yet implemented):** when the background is a **gradient**, it must be painted `no-repeat` and sized to cover the viewport, and pinned in a way iOS honours — i.e. a dedicated **`position: fixed` full-viewport backdrop layer** carrying the gradient (behind the scrolling content), rather than relying on `background-attachment` or copying the raw shorthand onto `<body>`. A solid-colour background can keep today's `local`/mirror approach; the gradient case is the one that needs the fixed backdrop. Whatever the fix, it must keep the original intent (status-bar inset + overscroll bounce show the view colour) intact and must not regress non-iOS browsers.

**Established by cross-platform testing (07/2026):** desktop viewer (Chrome/Windows) = correct; iOS viewer = tiles; editor checkerboard = by-design chrome on both platforms. So the offending layer is the **viewer `<body>`/`<html>` gradient mirror** ([feezal-site.js:483-486](../www/src/feezal-site.js#L483-L486)) under iOS Safari. Remaining diagnosis is optional — the mechanism is well understood — but if convenient:
1. **Solid vs. gradient on iOS:** set the same view to a **solid colour** — expected to be fine (confirms it's gradient-tiling specifically, not the mirror in general).
2. **Tab vs. installed PWA on iOS:** does the tiling differ between a normal Safari tab and the Home-Screen standalone app? (Both should show it; standalone just makes it starker.)
3. **A screen recording of the iOS scroll** — tile with a visible repeat seam vs. scroll-away-leaving-a-gap vs. only-on-overscroll-bounce — to pick the exact `position: fixed` backdrop treatment.
4. **iOS version + device model.**
5. **macOS Safari Web Inspector** attached to the iPhone (Develop → *device*): read computed `background-image` / `background-repeat` / `background-attachment` on `html` / `body` while scrolling — final confirmation of the mirror layer.

**Ships with (once diagnosed):** the fixed-backdrop gradient layer (gradient views only) with the status-bar/overscroll intent preserved, a TESTING.md note (gradient view on iOS Safari + installed PWA → background stays put on scroll, no tiling), and a regression check that solid-colour backgrounds and non-iOS browsers are unchanged.

**Relates:** `feezal-style-editor-background` / **U59** (the gradient editor that authors these backgrounds), `feezal-site` (the canvas bg + iOS body/html mirror), A18 (kiosk / wall-panel mode — iOS PWA is a primary kiosk target), the `viewport-fit=cover` / status-bar-inset work the mirror was added for, **B63** (viewer-open regression found in the same iOS session).

### B63 — "Open viewer" does nothing on Safari/iOS (regression)

**Reported (07/2026).** From the editor on **Safari / iOS**, using the **open-viewer** action **does nothing** — no new tab/window opens. It **worked previously**. Surfaced while testing B62. **Clarified by reporter:** the editor was running as a **normal Safari tab with browser chrome — NOT an installed Home-Screen (standalone) app** — and the site had the **"Enable PWA" switch turned on** shortly before. **Further observations (reporter):** the failed attempts did **not** refresh the viewer that was open in the other tab; and after **closing** that other tab and trying again, **still no new viewer tab opened**.

**Retracted hypothesis.** An earlier draft blamed the "`window.open` is a no-op inside an installed standalone PWA" behaviour. The reporter confirms they were in a **normal Safari tab**, so that explanation does **not** apply. In a normal iOS Safari tab, `window.open` from a genuine tap normally *does* open a tab.

**What the new observations rule in/out.** "Did not refresh the other tab" + "closed it and still nothing" together mean the `window.open` call is **fully no-op'ing** — it is neither creating a tab nor navigating/reusing a background one. That **weakens** the plain "reuse-and-refresh" quirk and the SW-interference idea, and **strengthens a stale *named-window* binding**: iOS Safari keeps the `feezal-<site>` window *name*→handle mapping alive for the browsing-context session, so after the first (working) open the name is bound to a window the browser will no longer surface *or* recreate — and **closing the visible tab does not clear that session-level name binding**, which is exactly why the retry also does nothing. This fits all three facts: it worked the first time, doesn't refresh, and won't reopen after closing. It is also **independent of the PWA toggle** (the editor page is outside any service-worker scope, so nothing intercepts the `open()` call itself) — enabling PWA was most likely coincidental / just what prompted the retry.

**Gesture path is fine (checked).** The action is an action-menu item ([feezal-app-editor.js:973](../www/src/feezal-app-editor.js#L973)) whose handler runs `this._actionMenuPos = null; this._view();` **synchronously** — setting a reactive property doesn't await, so user-activation is preserved into the `window.open` call. So "lost user gesture / popup-blocked" is unlikely to be the cause.

**What "Enable PWA" does (relevant context).** The switch sets `viewer.pwa: true` and is **viewer-scoped only**: it registers a `display: standalone` **manifest** and a **service worker** (`sw.js`) at **`/viewer/<site>/`** ([server/src/build/pwa.js:191-259](../server/src/build/pwa.js#L191-L259)); the PWA tags are injected only into the viewer/export page. **The editor is never made a PWA** (no manifest/SW on the editor page) — matching the expectation that an editor PWA would be useless. But note: `/viewer/<site>/` is *exactly* the URL the editor's open-viewer button targets.

**Analysis (do NOT fix yet).** The action is `_view()` → `window.open(base + hash, 'feezal-' + feezal.siteName)` ([feezal-app-editor.js:2222-2228](../www/src/feezal-app-editor.js#L2222-L2228)) — a **named** window target, not `_blank`. Ordered by fit with the observations:
1. **Stale named-window binding (leading).** iOS Safari retains the `feezal-<site>` *name*→window handle for the browsing session; once bound (first, working open), later `window.open(url, 'feezal-<site>')` calls target that stale handle and no-op instead of creating a fresh tab, and **closing the visible tab doesn't clear the binding**. Explains *all three* facts (worked once · no refresh · won't reopen after close). Independent of PWA.
2. **Named-window reuse-not-foregrounding.** A softer variant: a background tab exists/updates but iOS won't surface it. **Partly contradicted** by "did not refresh the other tab" — but keep it until the tab-switcher check (below) rules it out.
3. **Viewer service worker / standalone manifest interfering** (from the PWA toggle). **Downgraded:** the SW is scoped to `/viewer/<site>/`, and the failing `window.open` runs on the **editor** page (out of scope), so the SW cannot intercept the `open()` call itself — it could only affect what loads *after* a tab opens, which isn't what's happening here.

**Decisive experiments (run in this order):**
1. **`_blank`/unique-name probe (most diagnostic).** Try opening the viewer URL with `target="_blank"` / `window.open(url, '_blank')` instead of the fixed `feezal-<site>` name. **Works → confirms the stale named-window binding (cause 1)** and points straight at the fix.
2. **Reload the editor page, then open-viewer once.** A fresh page/browsing context clears Safari's name map. **First open works again → confirms the session-scoped stale-name binding.**
3. **Tab-switcher check** right after a failed tap: is a viewer tab sitting in the background (updated or not)? **Present → cause 2 (non-foregrounding); absent → cause 1 (open fully no-op'd).**
4. **PWA off + retry** (to formally clear the SW/manifest from the picture): expected **still broken** (confirms PWA was coincidental). If it unexpectedly *fixes* it, re-open cause 3.

**Fix direction (note only, not yet implemented):** reconsider the **named target** — iOS's stale-name behaviour makes a fixed `feezal-<site>` name a poor fit. Options: use `_blank` (simplest; loses the "reuse one viewer tab" convenience — acceptable), or open via a **real anchor** the user taps (`<a href=… target="_blank" rel="noopener">`, which iOS honours most reliably) and, if tab-reuse is still wanted on desktop, keep a handle from the returned `Window` and `focus()` it rather than relying on the browser's name map. Whatever the mechanism, verify it survives repeated opens and tab-close on iOS.

**Further diagnosis if still inconclusive:**
1. **iOS version + device model**, and Safari build.
2. **Does a plain link work?** Type/tap the viewer URL directly (`/viewer/<Site>/`) in Safari — if that opens but the button doesn't, it's the `window.open` mechanism, not the URL/route.
3. **Remote Web Inspector** (macOS Safari → Develop → *iPhone*): watch the **console** on tap and confirm `_view()` fires and what `window.open` **returns** — `null` = blocked/suppressed; a `Window` object whose tab never surfaces = the stale/hidden named-window case.
4. **Regression bisect (only if `_blank` also fails):** was the trailing-slash **B39** change or any recent top-bar/action-menu rework in the window that "previously worked"?

**Ships with (once diagnosed):** the reworked open mechanism (named-target dropped/reconsidered, or anchor-based), a TESTING.md note (open viewer from editor works repeatedly in a Safari tab on iOS — including after closing the viewer tab — PWA on **and** off), and a regression guard if a code change is implicated.

**Relates:** **B62** (found in the same iOS session), `feezal-app-editor` `_view()` / the top-bar open-viewer action, **`server/src/build/pwa.js`** (the viewer-scoped SW/manifest the PWA toggle registers — a suspect for cause 2), A18 (kiosk / iOS is a primary target — opening/navigating the viewer must work there), the history-panel preview which uses the same `window.open` pattern ([feezal-sidebar-history.js:183](../www/src/feezal-sidebar-history.js#L183)) and likely shares the fault on iOS.

### B68 — `glass-meter` + `glass-loadpoint`: card overflows the host and ignores its height

**Reported (07/2026).** Both cards render **wider than the element** and **do not scale with the element's height** — the frosted card doesn't fill its host box.

**Root cause (confirmed — same regression fixed in `glass-value`).** Both override the shared glass `.card` with `position: relative`:
- [feezal-element-glass-meter.js:67](../www/packages/@feezal/feezal-element-glass-meter/feezal-element-glass-meter.js#L67) — `.card { gap: 1px; position: relative; }`
- [feezal-element-glass-loadpoint.js:79](../www/packages/@feezal/feezal-element-glass-loadpoint/feezal-element-glass-loadpoint.js#L79) — `.card { … position: relative; }`

The shared `glassCardStyles` `.card` is `position: absolute; inset: 6px` ([feezal-glass.js:61-62](../www/packages/@feezal/feezal-glass/feezal-glass.js#L61-L62)) — which both **fills the host** (so the card tracks width/height) **and** is the positioning context for the corner badges (`.unavail`, etc.). The local `position: relative` wins (element styles compose after the shared block), so `inset` stops applying and the card collapses to **content size**: wider than the element, height-independent.

**Fix (mechanical — mirror `glass-value` fix `39c60584`).** Delete the `position: relative` from each `.card` override (keep the other props); the shared absolute card already anchors the badges. Bump each element's patch version. Add a browser regression test asserting the card insets to the host and grows with host height, exactly like `test-browser/feezal-glass-value.test.js`.

**Relates:** `glass-value` (identical bug, already fixed — the reference fix + test), `feezal-glass` `glassCardStyles` (the shared `.card { position:absolute; inset }` these must not override), **B69** (the `glass-meter` redesign, bundle the two `glass-meter` changes).

### B69 — `glass-meter` is overloaded: move the secondary readouts into a details popup

**Reported (07/2026).** The `glass-meter` card is **overloaded** — it stacks up to seven lines in one small tile (icon, value + unit, rate, error, status, reading-age, raw), which is cramped and unreadable at tile sizes ([feezal-element-glass-meter.js render](../www/packages/@feezal/feezal-element-glass-meter/feezal-element-glass-meter.js)).

**Redesign (mirror `glass-value` / `glass-lock`).** Keep the **primary readout on the card** — icon + big value + unit (and the error badge, since a fault must stay visible) — and move the **secondary readouts** (rate ↗, status, reading-age, raw) into a **details popup** opened by the corner **⋯** button, using the shared popover infrastructure (`FeezalGlassCard` + `glassPopupStyles`, exactly as `glass-lock` `1bf2641f` and `glass-light`). The card stays display-only (no toggle); the ⋯ button only appears when there's secondary content to show. Ships with a browser test (card shows value+unit; popup lists the extra readouts) and a TESTING.md row; bundle with the **B68** width fix in one `glass-meter` change (single version bump).

**Relates:** **B68** (the width bug on the same element — fix together), `glass-lock` (the tap/popup redesign precedent + `FeezalGlassCard`/`glassPopupStyles` pattern), `glass-value` (the decluttered value card this meter should resemble), E147 (the AI-on-the-edge meter this card serves).

### B70 — System element editor placeholders: swipe shows text not icon, mismatched chrome, inconsistent default sizes

**Reported (07/2026).** Three inconsistencies in the **System** pseudo-element editor placeholders:

1. **`system-swipe` shows the word "swipe" instead of the icon.** Its placeholder renders `<span class="material-icons">swipe</span> Swipe` ([system-swipe.js:150](../www/packages/@feezal/feezal-element-system-swipe/feezal-element-system-swipe.js#L150)), but its local `.ph .material-icons` rule ([:51](../www/packages/@feezal/feezal-element-system-swipe/feezal-element-system-swipe.js#L51)) is **missing `font-family: 'Material Icons'`** — the global class can't reach shadow DOM, so the ligature renders as plain text. (Its siblings declare the font-family locally, e.g. [system-notification.js:217](../www/packages/@feezal/feezal-element-system-notification/feezal-element-system-notification.js#L217).) **Fix:** switch the placeholder to `<feezal-icon name="swipe">` (the canonical, shadow-safe path — same fix as the device-health board `6e4a02fb`), or add the missing `font-family`.

2. **`system-swipe`'s placeholder chrome differs from the other System placeholders.** It hardcodes `background: #eceff1; border: 2px dashed #455a64; color: #455a64` ([system-swipe.js:45-52](../www/packages/@feezal/feezal-element-system-swipe/feezal-element-system-swipe.js#L45)), an opaque light chip; the others use theme-aware muted text (`color: var(--secondary-text-color, #777)`, no opaque background). On the canvas the swipe placeholder stands out with a different background-colour. **Fix:** align `system-swipe`'s `.ph` to the shared System placeholder style (theme-aware muted, no hardcoded `#eceff1`/`#455a64`).

3. **Default sizes are inconsistent** — `system-notification`/`-pin`/`-splash` are `140×40`, `system-script`/`-swipe` are `120×40`. **Fix:** set **`defaultStyle` to `160×40` for every System element** (notification, pin, script, splash, swipe — and `system-connection-status` if it declares one).

**Ships with:** the three fixes across the System element files (patch-bump each touched package), a browser assertion that `system-swipe`'s placeholder renders a `feezal-icon` (not `.material-icons` text) — mirroring the device-health test — and a TESTING.md note. Small, mechanical; good to bundle in one commit.

**Relates:** device-health icon fix `6e4a02fb` (the identical shadow-DOM `.material-icons` → `feezal-icon` fix + its test), E7 (`system-swipe` origin), the System element family (notification/pin/script/splash/swipe — the shared placeholder chrome + default-size convention this unifies).

### B71 — `system-splash` appears to do nothing in the viewer (no visible splash/spinner)

**Reported (07/2026).** Added a `system-splash` to a site; in the viewer **no spinner or overlay is perceptible** on load. **Refined by the reporter (07/2026): the splash only works on the view where the element is placed — it was expected to be site-wide.** That is the primary issue.

**Root cause (confirmed) — the splash is a per-VIEW element, but boot cover must be site-wide.** The overlay lives inside the placed element and only runs when **its view is in the DOM** — everything is armed in `connectedCallback` ([:183-225](../www/packages/@feezal/feezal-element-system-splash/feezal-element-system-splash.js#L183)), and the viewer only mounts the **active** view's elements. So a splash placed on view B does nothing while view A (or any other view) is the one loading, and it only ever covers **its own** view's first paint — not the site's initial boot. The description says "place one per site" ([:48-50](../www/packages/@feezal/feezal-element-system-splash/feezal-element-system-splash.js#L48)) and it uses module-level place-once semantics, so **site-wide is the intended contract** — the implementation just doesn't deliver it.

**Fix direction — make the splash an app/site-level concern, not a per-view element.** The overlay + hide-lifecycle must run at viewer boot regardless of which view is active. Candidate shapes (to choose during design):
- **Site-level config, app-level render.** Treat a placed `system-splash` as declaring a **site setting** (settle-window/timeout/spinner-delay/logo/lottie/colours); the **viewer shell** (`feezal-app-viewer`) reads it and renders the overlay at the app root on boot, before/independent of the first view mount. The on-canvas element stays an editor-only config placeholder.
- **Eager global activation.** Have the viewer scan the site for a splash element at boot and run its overlay/lifecycle globally (a static "site splash" registered once), independent of view mounting/navigation.

Either way the overlay is **fixed at the app root** and the hide conditions (connection up + quiet `settle-window`, backstops) are unchanged.

**Secondary (fold in while here) — invisible by default.** Even on the correct view, a fast load gives **no visible signal**: the overlay background defaults to `--feezal-splash-background` = **`--primary-background-color`** (same colour as the page — [:78-80,125](../www/packages/@feezal/feezal-element-system-splash/feezal-element-system-splash.js#L78)) and the **spinner only appears after `spinner-delay` (1000 ms)** ([:60,215-219](../www/packages/@feezal/feezal-element-system-splash/feezal-element-system-splash.js#L60)), so it fades (250 ms) before the spinner ever shows. Consider showing the spinner immediately (or a ~300 ms default), a subtly distinct default background, and an editor **"Preview splash"** affordance so it's observable at design time (today it's only a placeholder chip).

**Ships with:** the app-level activation, a browser test that the overlay covers boot **regardless of which view holds the splash element** and hides on connect+settle, migration of any existing per-view splash (source-view unaffected — same element/attrs, new activation path), and TESTING.md steps. Version bump.

**Relates:** E39 (`system-splash` origin — FOUC/boot cover), `feezal-app-viewer` (the shell that must host the app-level overlay), the viewer boot/connection lifecycle (`feezal.connection` `connected`/`message` events the hide rides on), **B70** (sibling System-element polish), E89 / `@feezal/feezal-lottie` (the optional boot animation path).

### B72 — `device-health`: one list entry per *entity* instead of per *device* (ESPHome / zigbee2mqtt)

**Reported (07/2026).** In the reworked device-health inspector checklist, **every topic from an ESPHome device creates its own list entry** — the same device appears many times. Same for zigbee2mqtt. Expected: **one entry per physical device**.

**Root cause.** `buildHealthDevices` ([feezal-element-basic-device-health.js](../www/packages/@feezal/feezal-element-basic-device-health/feezal-element-basic-device-health.js), added in the overhaul `eb3ec828`) merges a device's entities **by friendly name** (`byName`). That collapses Homematic (whose entities share the channel name) but **not ESPHome/z2m**: each of a device's entities has a **distinct entity name** ("Boiler Temperature", "Boiler Uptime", "Boiler WiFi", …), and — for ESPHome especially — **every entity carries the same `availability_normalized`** (the shared `<node>/status`), so each entity becomes its own health candidate → N duplicate rows, all watching the same availability topic.

**Fix — key the merge on device identity, not name.** Discovery entities already carry it: `config.device.identifiers[0]` (server `decorateBatteryLow` and `getDeviceGroups` both key on exactly this — [discovery.js:391,398,432](../server/src/mqtt/discovery.js#L391)). Change `buildHealthDevices` to group by, in order: **`config.device.identifiers[0]` → `node_id` → the shared availability/battery topic → friendly name** (the current behaviour as the last-resort fallback). Take the **device label** from `config.device.name` (friendly-name'd) when present; **union** the signals (battery / availability / fault / sabotage) across the device's entities (first of each kind wins). Alternatively/additionally, the inspector could fetch the already-device-grouped **`/api/discovery/device-groups`** endpoint instead of `/api/discovery/devices` and build one entry per group.

**Ships with:** the `buildHealthDevices` dedup fix + a unit test (several ESPHome/z2m entities sharing one `device.identifiers` collapse to a single entry that unions their signals; distinct devices stay separate), patch-bump `basic-device-health`, and a TESTING.md note.

**Relates:** the device-health overhaul `eb3ec828` (introduced `buildHealthDevices`; this fixes its dedup), `decorateBatteryLow` / `getDeviceGroups` in `discovery.js` (the device-identity keying to mirror + the ready-made device-grouped endpoint), E124/N31 (the per-entity battery/availability records that duplicate here).

### B73 — Background editor (view styles): solid + gradient colour fields should use the style-inspector var-autocomplete, not a dropdown; widen the too-small percent input

**Reported (07/2026).** Two gripes with the **view-styles background editor** ([feezal-style-editor-background.js](../www/src/feezal-style-editor-background.js)):

1. **The theme-variable picker is an extra dropdown, not the autocompleting input the rest of the style inspector uses.** **Both the SOLID background colour input and each GRADIENT stop** carry a compact **`.var-menu` quick-pick `<select>`** for canonical theme vars ([:75-77](../www/src/feezal-style-editor-background.js#L75) — "*solid + each gradient stop*"; the `THEME_VARS` list) sitting next to the colour input. Elsewhere in the **Style inspector**, a CSS-variable value is entered via an **autocompleting `var(--…)` input** (type `var(`, get theme-var suggestions inline — [feezal-sidebar-inspector-styles.js:148,326,395,442](../www/src/feezal-sidebar-inspector-styles.js#L148)). The reporter wants **both the solid colour field and the gradient stops** to use **that same autocompleting input** and **drop the extra dropdown** everywhere in this editor.
2. **The breakpoint (stop position) percent input is too narrow to read the value.** `.stop-row .pct { width: 52px }` ([:74](../www/src/feezal-style-editor-background.js#L74)) — a stop at `100` is clipped/unreadable.

**Fix.**
- **Autocomplete instead of dropdown.** Reuse the style inspector's `var(--…)` autocomplete for **the solid colour field and every gradient stop**, and remove the `.var-menu` `<select>` from both. The stop colour input already accepts a typed literal **or** `var(--…)` and keeps it verbatim (U59), so only the **suggestion UI** changes. Best done by **extracting the var-autocomplete into a shared control/helper** (it currently lives inline in `feezal-sidebar-inspector-styles.js`) so both the style inspector and the gradient editor share one implementation — no divergent copies.
- **Widen the percent input** so the value (up to `100`, optionally with a `%` suffix) is fully visible — e.g. `width: ~64–72px` (or let it flex), and right-align the digits.

**Ships with:** the shared var-autocomplete control (or a documented reuse), the gradient-editor swap + widened `.pct`, a browser test (typing `var(` in a stop suggests theme vars and commits the pick; the percent field shows a two/three-digit value un-clipped), and a TESTING.md note on the view-styles gradient editor.

**Relates:** **U59** (the gradient editor + the literal-or-`var(--…)` stop model this refines), the Style inspector `var(--…)` autocomplete ([feezal-sidebar-inspector-styles.js](../www/src/feezal-sidebar-inspector-styles.js) — the pattern to share), the canonical theme-variable set (`THEME_VARS` — the suggestions source).

### B74 — View theme selector: rename the default entry "Site theme (default)" → "Inherit" and drop its colour swatch

**Reported (07/2026).** In the **view theme selector**, the default (empty) entry is labelled **"Site theme (default)"** and shows a (neutral) colour swatch chip like the real themes. The reporter wants it **renamed "Inherit"** and this special entry to **show no swatch** (a view with no theme inherits the site theme — there's no colour to preview).

**Where.** The shared picker `feezal-theme-select.js` ([the ONE styled theme picker, used by both the site-theme sidebar and the view picker](../www/src/feezal-theme-select.js)):
- The label is the `emptyOption` fallback **"Site theme (default)"** ([:234-235](../www/src/feezal-theme-select.js#L235), the B50 contract) — the view picker's empty entry (`cls === ''`).
- That empty entry currently renders `PLACEHOLDER_SWATCHES` — a neutral chip ([:256](../www/src/feezal-theme-select.js#L256)) — in both the dropdown row and the selected-value display.

**Fix.**
1. **Rename** the view picker's empty-entry label to **"Inherit"** — set the view theme attribute descriptor's `emptyOption` (passed through at [feezal-sidebar-inspector-attributes.js:1485](../www/src/feezal-sidebar-inspector-attributes.js#L1485)), or change the `:235` fallback. **Scope it to the view picker** — confirm the site-theme sidebar doesn't rely on the same empty label (it shouldn't show an "inherit" entry).
2. **No swatch for the empty entry.** For `cls === ''`, render **nothing** where the swatch chip goes (both the option list and the closed/selected display), instead of `PLACEHOLDER_SWATCHES` — the label sits alone, visually distinct from the real themes. Keep the real `default` theme (`cls === 'default'`) swatch untouched ([:257](../www/src/feezal-theme-select.js#L257)).

**Ships with:** the label + swatch-suppression change, a browser test (the view picker's empty entry reads "Inherit" and renders no `.swatches`; a real theme still shows its chip), and a TESTING.md note. Small, contained.

**Relates:** **U57** (the compound-swatch theme picker this tweaks), **U53** (the shared styled theme picker), **B50** (the `emptyOption` "(default)" contract being adjusted), the view-settings theme attribute (the descriptor that should pass `emptyOption: 'Inherit'`).

### B75 — Roadmap IDs leak into user-facing help texts & labels

**Reported (07/2026).** Some editor **help popups and labels show internal roadmap IDs** — e.g. a help tooltip reading **"N37: …"**. These IDs (our `E##` / `N##` / `B##` / `U##` / `A##` roadmap references) are for code comments / commits / the roadmap, **not the UI**, and should never appear to users.

**Scope (~15 files, ~20+ occurrences).** They sit in user-facing descriptor strings — attribute `help:`, `label:`, `placeholder:`, and element `description:` — across both element packages (`www/packages/@feezal/*`) and editor built-ins (`www/src/*`). Confirmed offenders include: **`E102:`** (climate valve range help), **`B54:`** (climate boost help), **`E132:`** (sensor class help), **`E124:`** (low-battery help), **`E138:`** (motion/alarm active-colour help), **`E81:`** (bar item-size help), **`N12`**, **`E129`**, **`E50`**, **`E123`**, **`B56`**, **`E135`**, and the reporter's **`N37:`** in `www/src/`. (Grep: `help|label|placeholder|description` string values matching `\b[ENBUA][0-9]{1,3}\b`.)

**Fix.** Strip the roadmap-ID prefix/mention from every user-facing string, keeping the actual explanatory text (`"E124: optional low-battery topic…"` → `"Optional low-battery topic…"`; `"E138: the motion-slice active default is…"` → `"The motion-slice active default is…"`). Leave the IDs in **code comments** (they're useful there). Where a bumped element package is touched, patch-bump it.

**Guard against regressions.** Add a test that scans element descriptors (`palette`/`attributes`/`styles` `help`/`label`/`placeholder`/`description`) and the editor's user-facing strings for the roadmap-ID pattern and **fails CI** on a hit, with a small curated allowlist for legitimate matches (units / chemistry / paper sizes like `CO2`, `A4`, `B12`) so real text isn't blocked. This is the durable fix — a one-time sweep alone will drift back.

**Ships with:** the sweep across the ~15 files, the regression-guard test, and (if any element package is modified) its patch bump + `docs/TESTING.md` note that user-facing strings must be ID-free.

**Relates:** the element-spec authoring guide (`docs/element-spec.md` — add a "no roadmap IDs in user-facing strings" rule), the attribute-descriptor `help`/`label` convention (CLAUDE.md), every element package + `www/src` inspector/help surfaces that carry the offending strings.

### B76 — `paper-slider`: invisible track (default ≈ background) + knob defaults should be `--primary-text-color`

**Reported (07/2026).** The **`paper-slider`** ([feezal-element-paper-slider.js](../www/packages/@feezal/feezal-element-paper-slider/feezal-element-paper-slider.js)) renders badly out of the box:
1. **No usable exposed var / invisible track.** The **track colour default resolves to ≈ `--primary-background-color`**, so the track is invisible against the page. The Style-inspector list ([:106-125](../www/packages/@feezal/feezal-element-paper-slider/feezal-element-paper-slider.js#L106)) exposes `--paper-slider-container-color` / `-bar-color` etc. but **none carry a `default`**, and none reliably drives the visible track.
2. **Knob colour default is wrong** — both the knob and the **start knob** should default to **`var(--primary-text-color)`**.

**Root cause.** The element wraps Polymer `<paper-slider>` and sets **no `--paper-slider-*` defaults of its own** — the color vars (`container-color` = track, `knob-color`, `knob-start-color`, `active-color`, …) rely entirely on **per-theme wiring, which is inconsistent**: most themes set only `--paper-slider-active-color`, and a couple map `--paper-slider-container-color` onto a `linear-gradient(var(--primary-background-color), …)` (e.g. [midnight-blue.js:35](../www/packages/@feezal/feezal-theme-midnight-blue/feezal-theme-midnight-blue.js#L35), [dark-mint.js:36](../www/packages/@feezal/feezal-theme-dark-mint/feezal-theme-dark-mint.js#L36)). On any theme that doesn't set them, the track/knob fall back to Polymer defaults or the near-background mapping → invisible track, unthemed knob.

**Fix — give the element sensible, theme-var defaults** (in the wrapper's `<style> :host`, and mirror them as `default:` on the style descriptors so the inspector shows them):
- **Track** (`--paper-slider-container-color`): a **visible** muted default — `var(--divider-color)` or `var(--secondary-background-color)` — **never `--primary-background-color`**. (Add/clarify a "track colour" descriptor with this default.)
- **Knob + start knob** (`--paper-slider-knob-color`, `--paper-slider-knob-start-color`): **`var(--primary-text-color)`**.
- **Active fill** (`--paper-slider-active-color`): `var(--primary-color)` (most themes already set this — the element default just guarantees it when they don't).

Theme overrides keep winning (element `:host` defaults are the floor). Use the canonical theme vars per the theme-variable discipline (each with a literal hex last-resort fallback).

**Ships with:** the `:host` defaults + descriptor `default`s, patch-bump `feezal-element-paper-slider`, and a TESTING.md note (slider track + knob are visible on the **default** theme with no per-element styling). Legacy paper/Polymer element — keep it minimal.

**Relates:** the theme-variable discipline (canonical `--primary-text-color` / `--divider-color` / `--primary-color` + hex fallback — CLAUDE.md, element-spec §5.1), the `--paper-slider-*` theme wiring across the theme packages (the inconsistency this floors), `carbon-slider` / `material-slider` (the modern sliders — sanity-check their track/knob defaults are visible too).

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

Displays **image payloads received over MQTT** (binary or base64) — distinct from `circle-camera`, which is stream/URL-based. ESP32-cams, doorbells, printer cams, and vision systems publish stills this way. Options: state framing (border color bound to a second topic — e.g. pass/fail, motion), **filmstrip of the last N images** (tap to enlarge; Cognex's no-read-review pattern), freeze-on-condition. Memory-bounded ring buffer; document payload-size caution.

**Relates:** E65 (vision sibling), circle-camera (stream sibling), E32 (event context).

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

### U58 — "Generate" button: bulk element + app scaffold wizard from discovery 🔨 Phase ① (Devices) ✅ done · Phase ② (App) pending

**✅ Phase ① implemented (07/2026) — Devices mode + shared prerequisites.** The top-bar **Generate** button (`auto_awesome`, between the `#toolbar` cluster and the source-mode toggle) opens the two-tile popup ([feezal-generate-dialog.js](../www/src/feezal-generate-dialog.js)); the **App** tile renders disabled ("Coming soon" — Phase ②). **Devices** mode: pick a style family (the device-card families that ship ≥3 discovery elements — Circle / Glass / Metro / E-ink lead), tick discovered devices from a source-grouped, filterable list, and one pre-wired element per device is dropped onto the current view in a deterministic auto-grid. Append-only with a `discovery-id` dupe-guard (a device already on the view is skipped, never duplicated); family-parity gaps are skipped-and-reported (grouped by function on the result screen); id-less/unknown-component rows are filtered out. All three prerequisites landed as the shared headless module [feezal-discovery-stamp.js](../www/src/feezal-discovery-stamp.js): `stampDiscovery(el, entity)` (extracted verbatim from `_applyDiscovery`, which now delegates to it — the ⚡ picker and Generate wire devices byte-for-byte the same), `resolveElementTag(component, family, deviceClass)` (registry-checked, `binary_sensor` routed by device_class, null on parity gap — the minimal slice of **E113**), and `layoutGrid` (uniform-cell packing from `defaultStyle`, columns from view width, Devices-mode only). Unit-tested (`test/feezal-discovery-stamp.test.js`) + browser-tested (`test-browser/feezal-generate-dialog.test.js`); TESTING.md §Generate wizard. **Phase ② (App mode)** — the room/function heuristic, multi-view creation, `layout-app` wiring and the `--feezal-app-content-max-width` cap — remains open below.

A one-click path from "connected broker with discovered devices" to "a populated, wired dashboard". Where **U31/U45** insert *one* element at a time and **U30** was a vague "generate a starter dashboard" idea, this is the concrete, opinionated wizard: pick a lot at once, pick the look, get views wired.

**Entry point — a `Generate` button in the top bar**, sitting **between** the left tool cluster (`#toolbar`: copy / paste / cut / delete / undo, [feezal-app-editor.js:893-900](../www/src/feezal-app-editor.js#L893-L900)) and the right cluster (the `<>` source-mode toggle → `feezal-site-manager` → the Deploy split button, [feezal-app-editor.js:902-924](../www/src/feezal-app-editor.js#L902-L924)). Clicking it opens a **large, Windows-Start-menu-style popup** offering **two choices**:

**① Devices — bulk-generate elements onto the current view.**
- A **filterable, checkbox list of all discovered devices** (from the discovery registry, `server/src/mqtt/discovery.js`; grouped by source — Homematic / zigbee2mqtt / WLED / evcc — the same grouping the ⚡ picker already uses).
- The user ticks the devices they want elements for, picks a **style family** (glass / metro / material-circle / eink / …), and hits generate.
- feezal creates one **pre-wired** element per selected device, laid out on a **sensible auto-grid** on the current view. Wiring is free — it is exactly the `_applyDiscovery` attribute-stamping that already runs in the ⚡ picker ([feezal-sidebar-inspector-attributes.js](../www/src/feezal-sidebar-inspector-attributes.js)), just fired in bulk at insert time. Function → element is the discovery `component` → `palette.function` resolution (**E113**), and the family is the user's pick.
- This is **U31 done in bulk**: U31 is "pick one device → one element at a chosen spot"; this is "tick many → grid them". They share the device list, the function→family resolution and the stamping — build the shared pieces once.

**② App — scaffold a whole multi-view app.**
- Creates a **`Menu` view containing a `layout-app` element** plus a **set of sub-views**, all wired into the `layout-app` navigation config (drawer/tab entries → view names).
- The user chooses the **grouping axis**:
  - **by room** → sub-views `Living room`, `Bathroom`, `Kitchen`, … (each holding that room's device elements), or
  - **by function** → sub-views `Heating`, `Lights`, `Covers`, `Sensors`, … (each holding all devices of that function).
- Plus the same **style-family** pick, applied to every generated element and (where families ship an app shell / view chrome) to the `layout-app` styling.
- Each sub-view is itself a "Devices" bulk-generation scoped to that room/function bucket, so the two modes share the generation core.
- **Sub-views use flow layout, width-capped for phones/tablets.** Each generated sub-view is set to `child-position="flow"` (**U41** — a wrapping flex container, not absolute placement) so the device cards stack and reflow responsively; the flow container is **width-capped and centred** (a max-width around a phone/tablet column, `flow-justify: center`) so the app doesn't sprawl edge-to-edge on a large monitor — **tablets and phones are the target form factor**. ⚠️ **Supporting knob needed:** the view today exposes only `width`/`height` styles plus the U41 flow knobs (`flow-gap`/`-direction`/`-justify`/`-align`) — there is **no `max-width`**. U58's App mode needs one. ✅ **Resolved (07/2026): centrally on the `layout-app` content area** — a new `--feezal-app-content-max-width` style knob (default none) that caps every embedded view in one place, built next to **U50**'s content inset (not a per-sub-view style — one knob, no per-view drift). This is a small dependency to build alongside App mode, not part of the wizard proper.

**Decided (refinement, 07/2026):**
- **Two tiles only — no third option.** A third mode was weighed (AI *"Describe"* free-text generation, a single-Room view, a Template/preset filler) and **declined for v1** — revisit only if demand appears. The AI path stays available separately through the assistant, not as a Generate tile.
- **Devices mode is a flat auto-grid.** No section headers or room/function grouping on the single view — all structure lives in **App** mode. This keeps the two tiles clearly distinct (place-and-wire vs. structure-into-views).
- **One family per run.** The style family is chosen once and applied to the whole batch in both modes; per-element restyle afterwards is **E115**'s job, not this wizard's.
- **Append-only, with a dupe guard.** Re-running Generate (or generating onto a non-empty view) only adds devices **not already placed** — guarded on `discovery-id` — and never touches or removes existing elements. No "replace / regenerate" in v1.
- **List unit = one discovered entity (function), not one physical device.** A device exposing several functions (e.g. climate + battery, or a multi-gang switch) yields one row — and one card — per entity, matching the discovery registry and the ⚡ picker; no "primary function" guessing.
- **Family-parity gap = skip + report.** If the chosen family lacks an element for a device's function, those devices are **skipped and listed** ("N devices have no *&lt;family&gt;* card — add them in another family"); Generate never silently drops them and never mixes families in one run (per-element restyle later is **E115**). This makes **E114**'s parity report a direct input.
- **Room detection = deterministic lexicon + editable review (v1).** A multilingual room-word match over device/topic/channel names, plus HA `device.suggested_area` when present, feeding the always-editable room list; AI-driven clustering is **deferred** (a later "improve with AI" enhancement, not a v1 dependency).
- **Sub-view width cap = central on `layout-app`.** A single content-area max-width knob caps every embedded view in one place (not a per-sub-view style), landing next to **U50**'s content inset.
- **No hybrid room×function axis in v1.** App mode groups on exactly one axis per run (room OR function); a two-level rooms-then-functions layout is deferred.

**Implementation-readiness — prerequisites (07/2026).** Before the wizard UI, three small reusable pieces must exist:
1. **Headless stamping core.** Today `_applyDiscovery` ([feezal-sidebar-inspector-attributes.js](../www/src/feezal-sidebar-inspector-attributes.js)) stamps the *selected* element via the inspector. Extract the stamp itself into a pure `stampDiscovery(element, entity)` (create-element-then-stamp, no selection/inspector coupling) that both the ⚡ picker and bulk Generate call. Highest-leverage refactor — de-risks everything downstream.
2. **Function → element-tag resolver.** `resolveElementTag(component, family)` → `feezal-element-<family>-<function>`, registry-checked, returning null when the family lacks that function (feeds the skip-and-report parity gate). This is a **minimal slice of E113** — U58 does *not* need the full `palette.function`/`palette.family` descriptor migration to ship, only this lookup; landing full E113 later can replace the resolver's internals without touching U58.
3. **Auto-grid v1 (`layoutGrid`).** A deterministic starting layout: uniform cells sized from each element's `defaultStyle`, packed left-to-right into columns derived from the target view width, wrapping to rows. Explicitly a *starting point, fully editable* (inherits U30's caveat); size-aware packing (**E38**) is a later refinement, not a v1 gate. Devices mode places absolutely on the current view; App-mode sub-views use U41 flow layout instead, so this grid math is **Devices-mode only**.

**App-mode idempotency rules (07/2026).** Re-running App mode (or running it with a `Menu`/`layout-app` already present) **reuses** the existing app shell rather than creating a second one, and **merges** into same-named sub-views instead of duplicating them; the `discovery-id` dupe guard spans the whole app, so a device already carded anywhere is not re-added. Collisions with pre-existing hand-made views merge by name — the wizard adds only the missing device cards, never clears a view.

**The hard part — a room/function heuristic.** Function grouping is easy (it's the discovery `component`, already known — light/climate/cover/contact/sensor/motion per **E113/E138**). **Room grouping needs detection** from device metadata:
- **Best signal, when present:** an explicit area — HA MQTT discovery devices can carry `device.suggested_area`; the device-group machinery (`getDeviceGroups()` by `device.identifiers`, `discovery.js`) is where this would be read.
- **Fallback:** parse a room from the **device / topic / channel name** against a **room-word lexicon** — multilingual (`Wohnzimmer`/Living, `Bad`/Bath, `Küche`/Kitchen, `Schlafzimmer`/Bedroom, `Büro`/Office, `Flur`/Hall, …), since Homematic channel names, zigbee2mqtt friendly names (`wohnzimmer_lampe`) and evcc titles usually encode the room. Homematic device/channel names and z2m friendly names are the richest source here.
- The detected room list must be **shown and editable before generation** (rename / merge / assign-unmatched-to-a-bucket) — a wrong guess must be a two-click fix, never a silent miscategorisation. "Unknown room" is its own bucket.

**Relationship to existing items (asked explicitly):**
- **U30 (auto-generated starter dashboard) — superseded.** U30 was the vague version of exactly this ("walk discovery, group by area/device, emit cards"); U58's App mode is its concrete, decided design. **Recommend folding U30 into U58** (or marking U30 done-by/subsumed) rather than keeping two onboarding-generation entries. U30's live caveat still applies and is inherited: a generated layout must be genuinely good and fully editable afterwards, or it hurts more than a blank canvas — which is why the room list is editable and the grid is a starting point, not a lock-in.
- **U31 (device-first insertion) — complementary, not obsolete.** Single precise insertion vs. bulk scaffolding; they share the device list + stamping. Keep both.
- **U45 (palette + full-screen picker) — complementary, not obsolete.** U45's "Add element" picker browses the catalog to place *one* element; U58's Generate is a distinct entry point for *scaffolding many*. Different mental model → its own button, but the "Devices" checkbox list could be reachable from both.
- **E113 (function × style) — prerequisite, consumer.** The family pick is E113's style axis; function detection is its function axis. U58 is a heavy consumer of that model, not a replacement.
- **E114 (family parity) — prerequisite for a *safe* family pick.** "Generate everything as glass" must not silently drop devices whose function glass lacks; a complete parity set (or an explicit "N devices have no glass equivalent — generate those as …?" prompt) is required. U58 makes E114 more valuable, doesn't obsolete it.
- **E115 (switch family) — complementary.** Generated as metro but wanted glass? E115's "switch all of family X" is the after-the-fact fix; U58 sets the family up front. Neither obsoletes the other.

**Phasing (suggested).** Ship **① Devices** first (small: device list + family pick + bulk stamp + auto-grid; reuses proven machinery). **② App** second (the room heuristic + multi-view creation + `layout-app` wiring is the real design and risk). Both gate on **E113** for the function/family model and benefit from **E114** parity.

**Risks / open questions.** The **auto-grid layout algorithm** is now the single remaining quality risk — v1 ships the deterministic uniform-cell packing described above; whether that reads well across mixed element sizes or needs size-aware packing (**E38**) is the open judgement call, mitigated by the layout being fully editable afterward. Everything else is settled (see *Decided* + *Implementation-readiness* above): deterministic-lexicon room detection with editable review (AI deferred), no hybrid room×function axis, skip-and-report on parity gaps, per-entity list unit, central width cap — plus this session's no-third-tile / flat-grid / one-family / append-only decisions.

**Relates:** **U30** (the idea this concretises — recommend subsuming), **U31** (device-first single insert — shared machinery), **U45** (element picker — sibling entry point), **E113** (function × style — the model), **E114** (parity — safe family pick), **E115** (switch family — after-the-fact restyle), **E138** (the device-function taxonomy the buckets use), **E108** ✅ (native discovery — supplies the device list), **U41** ✅ (flow layout — the sub-view layout mode App generates), **U50** (layout-app content inset — candidate home for the sub-view width cap), **E38** (responsive sizing — the width-cap + auto-grid concern), `layout-app` (the app-shell element the App mode wires), U37 ✅ (welcome wizard — the other onboarding surface), U9/AI assistant (candidate room-clustering engine), **E147** (the AI-on-the-edge meter element — a candidate the wizard could place from discovered meters, deriving its json/status/connection topics from the discovered value topic).

### U50 — layout-app: expose the content area's inset (padding)

The embedded view sits flush against the app bar and drawer — there is no way to give the content area breathing room. `.content` carries no padding and none is configurable ([feezal-element-layout-app.js:155-156](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L155-L156)); the only workaround is baking margins into every embedded view, which then differ per view and break when a view is embedded somewhere else.

**Wanted:** a `--feezal-app-content-padding` entry in the element's `styles` descriptor (default `0`), alongside the existing `--feezal-app-*` knobs ([feezal-element-layout-app.js:54-66](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L54-L66)), applied to `.content`.

**Padding, not margin.** `.content` is a flex child with `flex: 1`; a margin would shrink the box *and* sit outside the background, leaving an unpainted gutter between the drawer and the view. Padding keeps the inset inside the painted area, which is what "content margin" visually means here.

**Implementation notes:**

- `.content` needs `box-sizing: border-box` — it currently has none, and `#content` inside it is `width: 100%; height: 100%`. Without it the padding adds to the 100 % and `overflow: auto` turns into permanent scrollbars.
- The embedded view's own background is copied onto `.content` at embed time ([feezal-element-layout-app.js:342-348](../www/packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js#L342-L348)), so it will paint under the padding — correct for a bar/drawer-to-content inset, but worth a deliberate look if a per-side value is ever wanted.
- Accept a full CSS shorthand (`8px`, `8px 16px`, …) rather than a number, so per-side insets need no extra knobs.

**Relates:** E-layout-app (the shell), N36 (the `--feezal-app-*` style-var set this extends), E38 (element scaling / responsive sizing — a responsive inset would belong there).

### U61 — Editor preview fidelity: gradient/background in a percentage-sized view's scroll overflow

**Split out of B62 (07/2026).** When a view is sized in **percentages (e.g. 100% width/height)** and its content overflows into a scroll, the **editor** paints a **checkerboard** in the overflow area, but the **viewer** paints the **view's gradient/background** there. So the editor does not faithfully preview what ships — a WYSIWYG gap. (The iOS-only gradient *tiling* defect is the separate Issue A, tracked in **B62**.)

**Mechanism.** `feezal-site`'s host has a base rule `background: var(--feezal-canvas-bg); background-attachment: local` that extends the current view's background across the full scrollable area, beyond the view's own box ([feezal-site.js:41-45](../www/src/feezal-site.js#L41-L45)) — this is what the viewer uses, and why a desktop viewer fills the overflow with the gradient. But an **editor-only** rule `:host(:not(.feezal-viewer))` paints the checkerboard `background-image`, which **overrides** the canvas-bg sync ([feezal-site.js:59-64](../www/src/feezal-site.js#L59-L64)). Net: viewer overflow = gradient; editor overflow = checkerboard.

**Why the checkerboard exists (and where it's still right).** It marks the area *outside* a **fixed-size** view (a view with explicit px dimensions smaller than the canvas) — genuinely useful there: it shows the view's bounds against the empty canvas. The problem is only the **percentage/100%-sized** case, where there is conceptually no "outside" the user cares about and the viewer will fill the whole scroll with the gradient.

**Open decisions:**
1. **Editor overflow paint by sizing mode.** Keep the checkerboard for **fixed-size** views (bounds are meaningful), but for **percentage-sized** views let the editor extend the view's background across the overflow — i.e. don't let the checkerboard override the `--feezal-canvas-bg` sync when the view is percentage-sized. This makes the editor match the viewer where it matters and keeps the useful bounds indicator where it helps.
2. **View background vs. content height (deeper).** A 100%-height view whose content overflows still has a 100%-tall *box*, so its gradient (painted on the view element) doesn't cover the overflow by construction — the viewer only fills it via the separate canvas-bg sync. Should a view's background instead track its **content** height, so the gradient is continuous on the view element itself (editor and viewer alike), making the canvas-bg extension unnecessary for this case? This is the more principled fix but touches view layout/sizing semantics, so weigh it against option 1's smaller surface.
3. **Interaction with B62's iOS fix.** Whatever backdrop approach B62 adopts for the iOS viewer (a `position: fixed` gradient layer) should be consistent with how the editor previews the overflow here — ideally one model that both the editor and every viewer platform honour.

**Ships with (once decided):** the editor overflow-paint change (guarded by view sizing mode), a TESTING.md note (percentage-sized gradient view with overflowing content → editor overflow shows the gradient, matching the viewer; fixed-size view still shows the checkerboard bounds), and coordination with B62 so the two don't diverge.

**Relates:** **B62** (the sibling it split from — Issue A is the iOS tiling defect; this is the editor/viewer preview gap), `feezal-site` (the canvas-bg sync + editor checkerboard override), **U59** (gradient editor — authors these backgrounds), the fixed-vs-percentage view sizing model, E38 (responsive sizing — view/content sizing is adjacent).

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

> **Terminology note for E120:** reported as "*-shutter". The packages are named **cover** (`feezal-element-circle-cover`, `-glass-cover`, `-metro-cover`) — same elements. Whether the user-facing label should become "Shutter" is a separate question for **E113** (taxonomy).

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

### E139 — "Fancy" element family: Lottie-animated device cards

A new element family whose defining trait is **animation**: a `fancy-contact` that visibly swings the window/door open and closed, a `fancy-light` whose glow breathes with the state, a `fancy-cover` whose blind actually travels. Rich vector motion as the family chrome — nothing in the palette does this today.

**Decided (07/2026):**
- **Core family** (`feezal-element-fancy-*`, palette category `Fancy`) — ships with feezal, in the default palette. *(Deliberate exception to the A23 keep-core-small line.)*
- **MVP scope: light, climate, cover, contact, sensor, lock** — six cards (sensor = the E138 ✅ alarm-boolean semantics; a `fancy-motion` can follow the taxonomy later).
- **Animations: programmatic built-in set + per-element override.** The default set is **self-authored/generated Lottie JSON** — feasible because Lottie is plain JSON (shape layers + keyframed transforms) and the chosen style tier is authorable in code; MIT-clean by construction, no third-party asset licensing. Every element additionally accepts **user-supplied animation JSON via asset refs** (per-state/per-variant `src` overrides through the E89 loader) for anyone wanting LottieFiles art instead.
- **Style: filled flat duotone** — solid flat shapes in **two theme-derived tones**, recoloured at runtime: the animation JSON uses two palette slots substituted with resolved values of the canonical theme vars before instantiating (lottie-web needs concrete colours — read computed style, re-render on theme change; must respect per-view themes). Default tone mapping follows E138's colour semantics: base tone from `--secondary-text-color`/`--divider-color`; active tone `--primary-color` (light/cover/lock/contact), `--error-color` (alarm sensor states).
- **Chrome: animation + slim chrome** — the animation is the hero (most of the tile); beneath it a slim label + state line; availability/low-bat/sabotage badges come from the controller contracts. One consistent family frame across all six cards.

**Architecture:**
- **E137 controllers are the behavior layer — fancy elements are pure views:** contact → `ContactController`, sensor → `SensorController`, climate → `ClimateController`, light → `LightController`, cover → `CoverController` (all extracted as of E137 part 5). **Lock has no controller yet** — with `fancy-lock` as a second consumer beside `circle-lock`, the E137 rule applies: **extract `feezal-controller-lock` first.** All six register in `feezal-controller-parity.test.js`.
- **State → segment model on the E89 machinery:** shared lazy `lottie-web` chunk (fetched only when a fancy element is on a view — the established E39/E89 export discipline); per-state segments plus **directional transitions** (open→closed plays the closing segment, never a jump-cut). Two special mappings: `fancy-cover` **seeks by position** (position % → frame within the travel segment, so the blind stands where the device reports — E127/E128 settling-aware); `fancy-light` scales glow intensity with brightness. `fancy-contact` covers door/window/garage variants incl. the Homematic **tilt tristate** (three poses + transitions between all of them).
- **Editor: static pose** (current state's first frame, no lib load — E89 pattern); `prefers-reduced-motion` freezes to poses in the viewer too.
- **Packaging: one N29 bundle** (`@feezal/feezal-elements-fancy`) in the core workspace — the six cards share the animation set, the recolour helper and the chrome frame (E106 lesson: no six hand-rolled copies).

**Animation authoring:** the default set is generated by a **checked-in generator script** emitting the Lottie JSONs — reproducible, tweakable, and the two-tone palette slots are enforced by the generator. Complex illustrative art is explicitly out of scope for the built-in set (that's what the override attributes are for). *(Answer to "can you create them": yes for this tier — flat-geometric Lottie is authorable programmatically; illustrator-grade art would need supplied/curated assets.)*
 
**Sequencing:** first wave **contact, sensor, climate, light, cover** (controllers all shipped); **lock** follows the controller-lock extraction. Family frame + recolour helper + generator land with the first wave.

**Ships with:** N29 bundle + registration + `generate-elements`, parity-test registrations, TESTING.md §6 family section (state animations, directional transitions, position-seek, tilt tristate, theme recolour incl. per-view themes, reduced motion, editor static pose, override srcs, lazy chunk), version bumps per policy.

**Relates:** E89 ✅ (Lottie machinery + lazy loader — the foundation), **E137** (controllers — the behavior layer; lock-controller extraction is the one prerequisite), **E138 ✅** (taxonomy + colour semantics the family follows), E114 (parity), E39 ✅ (splash — same lazy-chunk discipline), per-view themes ✅ (recolour must respect them), A25 ✅ (self-hosted/MIT-clean assets — the programmatic set satisfies it by construction), E113 (function × style — a new style family over existing functions, exactly that model), E135 (sabotage badge on the fancy cards too).

### E144 — Lock autodiscovery: Homematic BidCoS (Keymatic) + HmIP smart locks + zigbee2mqtt 🔨 Keymatic + z2m done; HmIP-DLD open

**✅ Keymatic done (07/2026).** A native `homematic-lock` recognizer ([server/src/mqtt/native-discovery.js](../server/src/mqtt/native-discovery.js), recognizer 8) promotes **BidCoS Keymatic (`HM-Sec-Key`, channelType `KEYMATIC`)** to a `lock` record: `STATE` (bool) → state + lock/unlock command, the separate `OPEN` datapoint → the E143 `open_command_topic`/`payload-open` (door release), the `ERROR` enum (`0 NO_ERROR`/`1 CLUTCH_FAILURE`/`2 MOTOR_ABORTED`) → the E143 `error_topic` (fault badge), and battery + availability via the B65 `:0` maintenance index. The lock discovery-map (in `feezal-controller-lock`) gained `open_command_topic`/`error_topic`/`message_property_error` keys so these auto-stamp onto the circle/glass/metro lock cards. Recognizer tests added; server suite (447) green. **⚠ Still verify on a real Keymatic:** the `STATE` boolean polarity (the recognizer assumes `true`=unlocked / `false`=locked — a one-attribute fix on the card if reversed).

**✅ z2m: no native work.** The generic **HA-discovery path already supports `component: 'lock'`** ([server/src/mqtt/discovery.js:120-147](../server/src/mqtt/discovery.js#L120-L147)), so z2m locks (Danalock, Yale, …) that publish HA lock discovery flow through unchanged. Confirm with a real z2m lock; if its shape needs a tweak, fix it in the HA-discovery mapping, not a recognizer.

**⏳ Open — HmIP door lock (`HmIP-DLD`).** Channel `DOOR_LOCK_TRANSCEIVER` (confirmed) with `LOCK_STATE` (enum) + `LOCK_TARGET_LEVEL` (command) + the E135 boolean fault flags (`ERROR_JAMMED`, `ERROR_LOAD_TOO_LOW`, `ERROR_NO_END_STOP_LOCK/UNLOCK`). **Deferred:** the `LOCK_STATE` / `LOCK_TARGET_LEVEL` **enum values are NOT in OpenCCU-Base's `legacy-parameter-definition.config`** and couldn't be confirmed from docs — implementing them without a real-device dump would be guessing (unlike the channelType-gated Keymatic map, a wrong enum here mis-reads state). **Needs a real HmIP-DLD `hm/status/#` capture** (LOCK_STATE values seen, LOCK_TARGET_LEVEL command payloads for lock/unlock/open) before wiring. The `hm-lock` recognizer already has the structure; add `DOOR_LOCK_TRANSCEIVER` to `LOCK_CHANNEL_TYPES` with the confirmed enum map.

**⚠ Verify-first (usual hm-metadata caveat):** the Keymatic `STATE` polarity (above); the HmIP-DLD enums (above); and how the RedMatic/hm2mqtt bridge names these on the MQTT topic.

**Relates:** **E108** ✅ (recognizer framework), **E135** (lock error/jammed datapoints — same devices, shared research), **E143** (the lock elements these records populate — build alongside), **E137** (`feezal-controller-lock` owns the discovery-map fragment), U58 (Generate wizard consumes the new lock records), N31 (availability), the HA-discovery `lock` path already in place for z2m.

### E145 — Autodiscovery support for ccu-jack's MQTT interface

feezal's native Homematic autodiscovery is **RedMatic-only** today (established in **B65**): every recognizer gates on the rich `hm` metadata block (`channelType`/`channelName`/`deviceType`) that **only RedMatic publishes**. [ccu-jack](https://github.com/mdzio/ccu-jack) is a popular, high-performance CCU MQTT/REST gateway, but its users get **no autodiscovery** — this item adds it.

**The gap (from the B65 research):**
- ccu-jack MQTT topics are **address-based**: `device/status/<serial>/<channel>/<param>` (and `device/set/…`).
- Payloads are **bare VEAP** `{"v":…,"ts":…,"s":…}` — value only (`v`, not `val`), no channel/device metadata.
- ccu-jack MQTT is **value-only** — it publishes **no** metadata/enumeration topics (no channelType, no device list). *(Confirmed against the [ccu-jack MQTT wiki](https://github.com/mdzio/ccu-jack/wiki/MQTT-Server).)*
- **But the metadata exists in ccu-jack's REST/VEAP tree** — a hierarchical API with `identifier` / `title` (friendly device+channel names) / `description` / typed `~links` (`rel: device`, …). That's where channel types, device types and names live.

**Design principle (decided): feezal stays purely MQTT.** No second transport — the discovery path must work over the MQTT stream alone. This rules out any HTTP/REST dependency.

**Design approaches:**
- **A — REST/VEAP metadata + MQTT values. ❌ Decided against.** Walking ccu-jack's REST/VEAP tree over HTTP would give RedMatic-level metadata, but it adds a **second transport (HTTP-client + auth)** — which violates the pure-MQTT principle above. Not pursued.
- **B — MQTT-only datapoint-signature recognition.** Work purely from the address topics: `device/status/<serial>/<channel>/<param>` gives serial + channel + datapoint name. Classify by **datapoint-name signatures** per channel (e.g. `SET_POINT_TEMPERATURE`+`ACTUAL_TEMPERATURE` → climate; `STATE`+`LEVEL` → dimmer; `STATE` only → switch/contact, ambiguous). Pure MQTT, works with **any** ccu-jack today; but **no friendly names** (only `serial:channel`), weaker/ambiguous classification, more false positives. Extends the existing metadata-less datapoint-completeness fallback in `native-discovery.js`. This is the **works-today** path.
- **C — Upstream PR to ccu-jack for optional richer MQTT payloads (preferred long-term).** Contribute an **opt-in** feature to [mdzio/ccu-jack](https://github.com/mdzio/ccu-jack) that publishes the device/channel metadata **over MQTT** (behind a config flag, off by default so existing users are unaffected). Two shapes to propose:
  - **Retained metadata topics** (preferred — MQTT-idiomatic, keeps value payloads lean): one retained message per channel/device carrying `deviceType`, `channelType`, `channelName`, `channelIndex`, address — e.g. a `device/<serial>/<channel>/~meta` (or device-info) topic. feezal subscribes value topics + the retained meta tree and joins them by serial:channel. Retained ⇒ instant on connect, published once, not per value.
  - **Enriched value payloads** (alternative): optionally fatten `{"v","ts","s"}` with a metadata block (à la RedMatic's `hm`). Simpler for consumers but heavier on every message.
  With C in place, feezal's **existing rich-metadata recognizers work essentially unchanged** (map ccu-jack's meta fields to the same `channelType`/`channelName`/`deviceType` the recognizers already read), and `:0` correlation is exact. Trade-off: depends on the PR landing upstream **and** users updating ccu-jack — so **B remains the fallback** for un-upgraded installs.

**Recommended path:** ship **B** (pure-MQTT, works with any ccu-jack now) and pursue **C** upstream in parallel; when C is available it upgrades the same integration from signature-guesses to full metadata without changing feezal's transport model.

**Adaptation needed regardless of approach:**
- **Topic scheme:** a configurable `device/status/…` / `device/set/…` prefix path (distinct from RedMatic's `hm/status/…`).
- **Payload shape:** value at **`payload.v`** (not `payload.val`), plus `ts`/`s` — the built discovery records must set the message-property accordingly, and VEAP boolean/enum/number typing must map to feezal's cast model.
- **Connection model:** decide whether ccu-jack is a **separate configured source** or **auto-detected** from the `device/` prefix on the same broker (still pure MQTT either way).

**Silver lining (B65):** ccu-jack's **address-based topics make `:0` correlation trivial** — `device/status/<serial>/<channel>/…` → `device/status/<serial>/0/…` — so availability/battery/maintenance (`UNREACH`/battery/E135 signals) wiring is *easier* here than RedMatic name-mode. The B65 fix's string-transform path already covers this case.

**Open questions:** for **C**, the exact retained-meta topic shape to propose upstream (and whether mdzio prefers retained-meta vs. enriched-payload); for **B**, how far datapoint-signature classification can go without channelType before false positives dominate; scope of system variables / programs (ccu-jack exposes these too — likely a later tier); how much of the existing recognizer logic (climate/contact/cover/light/switch/sensor) is reusable once fed ccu-jack-shaped metadata (C) vs. needs a signature-only variant (B).

**Ships with:** for **B** — the pure-MQTT ccu-jack signature recognizer, topic-prefix + `payload.v` config, the `:0`/availability wiring reuse, tests (sample ccu-jack value topics → correct discovery records; `:0` availability resolves), TESTING.md, docs. For **C** — an upstream PR to mdzio/ccu-jack (retained metadata topics, opt-in) plus the feezal side that maps its meta fields into the existing recognizers; tracked as a separate deliverable that upgrades B.

**Relates:** **B65** (the research this builds on — bridge scheme table, and the `:0` synergy), **E108** ✅ (recognizer framework — where the ccu-jack signature recognizer / meta-adapter slots in), **N31 / E124 / E135** (`:0` availability/battery/maintenance — trivially derivable here), RedMatic (the currently-only-supported bridge — this is the parallel pure-MQTT path), **E109 / E112** (sibling third-party integration items), pure-MQTT design principle (no second transport — the constraint that shaped this item), the discovery `component` model (the shared target these records must produce).

### E150 — Discovery for profile-shaped components: `water_heater` ✅ + `lawn_mower` 🔨

Follow-up to **E149** ✅ (which shipped the seven *pure-mapping* HA discovery components: `button` `scene` `number` `text` `alarm_control_panel` `camera` `image`). The two remaining selected components need a device-variant *profile* on an existing element, not just a new `discovery: {component, map}` fragment.

**✅ `water_heater` done (07/2026).** It turned out to be a **clean structural alias** of climate, not a profile fork: HA's `water_heater` uses the *identical* topic key names (`temperature_command_topic`/`temperature_state_topic`/`current_temperature_topic`/`mode_command_topic`/`mode_state_topic`/`modes`/`min_temp`/`max_temp`), and the config carries its own `modes` list (`off`/`eco`/`performance`/`high_demand`/…) which the climate controller already accepts as a plain string array. So instead of a fork: added `water_heater` to `SUPPORTED_COMPONENTS` + `FUNCTION_CANDIDATES` (→ `climate`), and a small **`aliasComponents`** field on the element's discovery descriptor (`discovery: {component: 'climate', aliasComponents: ['water_heater'], map: climateDiscoveryMap}`) so the ⚡ picker and auto-config banner accept the alias component (the shared `elementAcceptsComponent` helper). All four climate cards (circle/glass/metro/eink) consume it; the Generate wizard resolves it for free. Tests: `server/test/discovery-e150.test.js`, `www/test-browser/feezal-discovery-e150.test.js`.

**🔨 `lawn_mower` — deferred (needs per-action command topics).** Unlike vacuum, HA's `lawn_mower` has **no single `command_topic`** — it exposes three *separate* command topics (`start_mowing_command_topic`, `pause_command_topic`, `dock_command_topic`) plus `activity_state_topic` (activities `mowing`/`docked`/`paused`/`error`). `circle-vacuum`'s contract publishes every action as a payload to **one** `publish-command` topic, so an alias/map reuse would leave the control buttons non-functional. Landing it properly means either (a) extending `circle-vacuum` with an optional per-action-topic command mode (three `publish-*` attributes + activity-state labels), or (b) a dedicated `lawn-mower` element. Niche — parked until asked. When done: add `lawn_mower` to `SUPPORTED_COMPONENTS` + `FUNCTION_CANDIDATES`, and either the vacuum variant or the new element with its own discovery map + tests.

**Relates:** **E149** ✅ (parent — the discovery-extension work this completes), **E137** (the climate controller the alias rides), **N12** ✅ (the discovery engine), **E135** (the Homematic climate profiles that inspired the "profile not fork" framing), circle-climate (water_heater target) / circle-vacuum (lawn_mower target).

### E151 — Gauge parity: `glass-gauge` + `metro-gauge`

The analogue **gauge / dial** value card exists for **circle** (`circle-gauge` — arc/ring/needle looks, colour-range zones, major+minor ticks, min/max, unit, decimals, `show-value`, discovery `component: 'sensor'`), **panel** (`panel-gauge` — the instrument-panel needle) and **material** (`material-gauge`), but the **glass** and **metro** families have none — a family-parity gap (they ship only the plain `-value` numeric readout).

Add:
- **`glass-gauge`** — a frosted-glass dial mirroring the `circle-gauge` attribute contract (look, zones, ticks, min/max, unit, decimals, show-value) in the Glass design language: frost tint, `degrade`, squircle, `--feezal-glass-*` vars, N31 availability badge. Follow the family conventions (see glass-value / glass-button).
- **`metro-gauge`** — the same contract rendered as a Metro tile (flat tile background + accent, `--feezal-metro-*` vars, E141 tile-state colour discipline).

Both are **display-only views** over the same value wiring as the `-value` cards (subscribe / message-property / unit / decimals) plus the gauge geometry; discovery `component: 'sensor'`, so the ⚡ picker + Generate wizard pick them up like every other sensor card (function `gauge` is already a `sensor` candidate). Reuse the `circle-gauge` SVG/geometry helpers where practical rather than re-deriving the dial maths.

**Ships with:** the two element packages (+ `www/package.json` deps, `generate-elements.js` manifest regen), the `docs/TESTING.md §6` element rows, and browser tests (value→needle-angle mapping, zone bands, tick geometry) mirroring `circle-gauge`'s.

**Relates:** circle-gauge / panel-gauge / material-gauge (the existing gauges this brings to parity), **E114** (numeric-card cross-family parity), **E138** (the `-value` / `-sensor` / `-motion` taxonomy these slot into), glass-value / metro-value (the sibling readouts + the family chrome to mirror).

### E152 — Rename `metro-tile` → `metro-button` (naming parity)

`feezal-element-metro-tile` is the Metro family's **generic button/action tile** — icon + label, tap publishes a payload and/or navigates to a view, optional live badge ([metro-tile.js:283-347](../www/packages/@feezal/feezal-element-metro-tile/feezal-element-metro-tile.js#L283)). Every other family calls this the **button** (`material-button`, `glass-button`, `eink-button`, `paper-button`, `carbon-button`); "Tile" is a Metro-only misnomer. Hard-rename it to `metro-button` (E148/panel-value precedent: no alias, source-view search-replace, BREAKING-CHANGES row).

**The complication — `MetroTileBase` lives in this package.** `metro-tile.js` exports **both** the concrete tile element **and** `MetroTileBase`, the shared live-tile base (size presets, the 3D Y-flip front/back, `renderFront`/`renderBack`/`baseAction`) that **~13 metro elements import** (`metro-lock`, `-light`, `-loadpoint`, `-cover`, `-climate`, `-meter`, `-motion`, `-sensor`, …). So the rename is **not** just one element:
- **Preferred:** first **extract `MetroTileBase` into a shared `@feezal/feezal-metro` package** (mirroring `@feezal/feezal-glass` / `FeezalGlassCard`), update the ~13 importers to `@feezal/feezal-metro`, THEN rename the now-thin concrete element `metro-tile` → `metro-button`. Leaves a clean shared base, not a base hiding inside a "button" package.
- **Minimal:** rename the package to `metro-button` and keep `MetroTileBase` exported from it, updating the ~13 `import … from '@feezal/feezal-element-metro-tile'` to `-metro-button`. Simpler, but semantically odd (the family base living in the button package).

**Mechanics (per panel-value):** package dir + `package.json` name/main + `.js` file + tag + class (`FeezalElementMetroTile` → `FeezalElementMetroButton`) + palette `Tile` → `Button`; `www/package.json` dep (alphabetical), `npm install`, `generate-elements.js` regen; update the element-smoke/import refs and any `metro-tile` test references; BREAKING-CHANGES + TESTING.md rows; version bump.

**Relates:** E148 / panel-value (the hard-rename precedent + mechanics), the button family (the shared naming this joins), `MetroTileBase` + `@feezal/feezal-glass` (the shared-base extraction pattern to mirror), **B70** (metro-loadpoint backside — same family base).

### E153 — `metro-loadpoint`: move the overloaded front controls to a 2×2 backside

The `metro-loadpoint` **front is overloaded** — the charge-mode buttons (Off / Solar / Min+Solar / Fast) sit inline under power + vehicle SoC/limit ([metro-loadpoint.js:79-80,123-126](../www/packages/@feezal/feezal-element-metro-loadpoint/feezal-element-metro-loadpoint.js#L79)), a cramped row of tiny targets on a Metro tile. It already extends `MetroTileBase` (which provides the flip/backside), so: **move the four mode buttons to the backside as a 2×2 grid, bigger** (touch-friendly), via `renderBack()` — exactly like `metro-lock`'s back buttons. The **front** keeps the primary readout (power + SoC/limit + charging state); the ⋯ flip affordance appears automatically once `renderBack()` returns content. Ships with a browser test (front shows power/SoC, backside 2×2 has the four modes and `setMode` publishes) and a TESTING.md row; version bump.

**Relates:** `metro-lock` (the backside-buttons pattern to mirror), `MetroTileBase` (`renderFront`/`renderBack`/flip — the mechanism), E109 (the evcc loadpoint family this refines), glass-loadpoint (the sibling that had the same overload — see **B68**), **B69** (glass-meter overload — same "declutter into the popup/backside" theme).


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

## Open Questions

**Package Manager (N4 and N23 shipped — both archived)**
- ~~Icon-set contract: is a `feezal-icons-*` package a webfont + name list, registered SVG symbols, or both?~~ **Settled (N23):** both modes — `{font, names}` for ligature webfonts, `render(name)` for SVG — see `docs/icons-spec.md` §3.

**History-in-payload convention (E69, E70, comparison/ad-hoc trends)**
Several analytics elements need historical data feezal deliberately doesn't store (real history = E28/A11 Grafana). Middle ground to decide: a documented convention where an **external aggregator (she, Node-RED) publishes a retained JSON series to a topic and the element only renders it** — settle the series JSON shape once (timestamps + values, units, buckets?) and reuse it across carpet plot, Sankey totals, comparison charts, and possibly E30's future first-load backfill. Keeps feezal storage-free while unlocking the whole analytics category.

**Layout & responsive design**
See the design exploration earlier in this file — the view-in-view nesting concept is the likely foundation. Full responsive layout support is a longer-term goal; no decisions needed yet.

---
