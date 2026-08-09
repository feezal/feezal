# Feezal Roadmap

Work in progress — priorities and scope are not final.

---

## Table of Contents

**Bugs**
- [B61 — Glass backdrop-filter: drawer-hover repaint bleeds artifacts into the view (Chrome/macOS only)](#b61--glass-backdrop-filter-drawer-hover-repaint-bleeds-artifacts-into-the-view-chromemacos-only)
- [B106 — `discovery-ids` is space-separated, but MQTT topics may contain spaces](#b106--discovery-ids-is-space-separated-but-mqtt-topics-may-contain-spaces)
- [B118 — Undo dead after deleting via the layers-tree context menu (until the canvas is clicked)](#b118--undo-dead-after-deleting-via-the-layers-tree-context-menu-until-the-canvas-is-clicked)
- [B119 — Right-click menu dead after the tab was backgrounded (footer selector crash)](#b119--right-click-menu-dead-after-the-tab-was-backgrounded-footer-selector-crash)
- [B127 — Copy/paste of template elements loses the template content (B31 regression class)](#b127--copypaste-of-template-elements-loses-the-template-content-b31-regression-class)


**Near-term Improvements**
- [N2b — Repeater with live canvas sub-elements](#n2b--repeater-with-live-canvas-sub-elements-future) *(future)*
- [N12 — Export bundle: strip mqtt.js for feezal-bridge users](#n12--export-bundle-strip-mqttjs-for-feezal-bridge-users-partial) *(partial)*
- [N13 — Lighter MQTT client for export bundle](#n13--lighter-mqtt-client-for-export-bundle-️-tbd) ⚠️
- [N41 — Shared-fragment dedupe: kill the copy-paste drift across elements](#n41--shared-fragment-dedupe-kill-the-copy-paste-drift-across-elements)
- [N42 — Front-end hot-path hygiene: parse memoization, ungated logging, listener teardown](#n42--front-end-hot-path-hygiene-parse-memoization-ungated-logging-listener-teardown)


**Element Ecosystem**
- [E20 — Weather forecast (`feezal-element-material-weather`)](#e20--weather-forecast-element-feezal-element-material-weather--moved)
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
- [E144 — Lock autodiscovery: Homematic BidCoS (Keymatic) + HmIP smart locks + zigbee2mqtt](#e144--lock-autodiscovery-homematic-bidcos-keymatic--hmip-smart-locks--zigbee2mqtt--keymatic--z2m-done-hmip-dld-open) 🔨 *(Keymatic + z2m done; HmIP-DLD open)*
- [E145 — Autodiscovery support for ccu-jack's MQTT interface](#e145--autodiscovery-support-for-ccu-jacks-mqtt-interface)
- [E150 — Discovery for profile-shaped components: `water_heater` ✅ + `lawn_mower` 🔨](#e150--discovery-for-profile-shaped-components-water_heater---lawn_mower)
- [E159 — Re-add a Paper-family app shell (`paper-app`) with full layout-app parity](#e159--re-add-a-paper-family-app-shell-paper-app-with-full-layout-app-parity)
- [E162 — Fancy family, take two: actually fancy — ready-made Lottie art over generated geometry](#e162--fancy-family-take-two-actually-fancy--ready-made-lottie-art-over-generated-geometry)
- [E164 — Fancy family: finish and re-enable the disabled cards](#e164--fancy-family-finish-and-re-enable-the-disabled-cards)
- [E168 — basic-camera: Frigate event backfill (events from before the viewer opened)](#e168--basic-camera-frigate-event-backfill-events-from-before-the-viewer-opened-️-to-be-refined) ⚠️
- [E172 — Theme: Catppuccin (pastel, 4 flavors)](#e172-theme-catppuccin-pastel-4-flavors)
- [E173 — Theme: Nord (arctic palette, dark + light)](#e173-theme-nord-arctic-palette-dark-light)
- [E174 — Theme: Graphite (calm neutral dark)](#e174-theme-graphite-calm-neutral-dark)
- [E175 — Theme: LCARS (Star Trek bridge computer) ⚠ trade-dress check first](#e175-theme-lcars-star-trek-bridge-computer-trade-dress-check-first)
- [E176 — Theme: Material You / MD3 baseline (light + dark)](#e176-theme-material-you-md3-baseline-light-dark)
- [E177 — Theme: Soft UI / neumorphism ⚠ needs a shadow token](#e177-theme-soft-ui-neumorphism-needs-a-shadow-token)
- [E178 — system-form: a subview as a web form (decided core, script API to refine)](#e178--system-form-a-subview-as-a-web-form-decided-core-script-api-to-refine)
- [E179 — Theme: Industrial Copper (warm metallic dark)](#e179--theme-industrial-copper-warm-metallic-dark)

**Editor UX**

- [U3 — Element grouping and locking](#u3--element-grouping-and-locking-partial) *(grouping not yet done)*
- [U23 — Custom collapsed placeholder text in the source editor](#u23--custom-collapsed-placeholder-text-in-the-source-editor-blocked-by-upstream) 🚧
- [U38 — Topic browser sidebar panel](#u38--topic-browser-sidebar-panel)
- [U45 — Element insertion: palette sidebar + full-screen picker](#u45--element-insertion-palette-sidebar--full-screen-picker--to-refine) 💡 *(to refine)*
- [U61 — Editor preview fidelity: gradient/background in a percentage-sized view's scroll overflow](#u61--editor-preview-fidelity-gradientbackground-in-a-percentage-sized-views-scroll-overflow)
- [U63 — `layout-app`: split the content inset into per-side knobs](#u63--layout-app-split-the-content-inset-into-per-side-knobs)
- [U84 — Canvas zoom, pan and fit-to-view](#u84--canvas-zoom-pan-and-fit-to-view)
- [U85 — Toast/notification service: route the remaining call sites](#u85--toastnotification-service-route-the-remaining-call-sites--service-shipped) 🔨 *(service shipped)*
- [U86 — Inspector: a real `json` attribute control + validation feedback + stable section state](#u86--inspector-a-real-json-attribute-control--validation-feedback--stable-section-state)
- [U98 — Palette colors in editor light mode ⚠️ needs refinement](#u98--palette-colors-in-editor-light-mode-️-needs-refinement)
- [U110 — layout-app: per-sub-view element search (E170 shape B)](#u110--layout-app-per-sub-view-element-search-e170-shape-b)
- [U112 — Element-family-wide settings (e.g. all glass transparency) ⚠ idea, needs refinement + decision](#u112--element-family-wide-settings-eg-all-glass-transparency--idea-needs-refinement--decision)
- [U113 — Scripting ergonomics: `feezal-id`, scoped lookup, value/event contract — decided](#u113--scripting-ergonomics-feezal-id-scoped-lookup-valueevent-contract--decided)


**Architecture & Infrastructure**
- [A7 — Git versioning for data directory](#a7--git-versioning-for-data-directory-in-progress) 🔨 *(in progress — bookmarks + push remaining)*
- [A11 — Grafana panel plugin](#a11--grafana-panel-plugin-feezal-feezal-panel)
- [A12 — Export deployment targets](#a12--export-deployment-targets-low-priority) 🔽
- [A18 — Kiosk / wall-panel mode](#a18--kiosk--wall-panel-mode)
- [A19 — Security model: multi-user / ACL story](#a19--security-model-multi-user--acl-story-needs-discussion) ⚠️
- [A20 — Element/theme scaffolding and community ecosystem tooling](#a20--elementtheme-scaffolding-and-community-ecosystem-tooling)
- [A21 — Accessibility: adopt the web-components Gold Standard for feezal elements](#a21--accessibility-adopt-the-web-components-gold-standard-for-feezal-elements)
- [A23 — Externalize element families: own git repos + npm publish (paper, tui, panel)](#a23--externalize-element-families-own-git-repos--npm-publish-paper-tui-panel)
- [A27 — i18n: editor localization + language-aware element defaults 🔨 Phase 1 (de+es+fr+it+pl+pt+tr) ✅ shipped · phases 2–3 open](#a27--i18n-editor-localization--language-aware-element-defaults--phase-1-deesfritplpttr--shipped--phases-23-open)
- [A29 — RTL layout support (Arabic, Hebrew)](#a29--rtl-layout-support-arabic-hebrew--future) 💡 *(future)*
- [A35 — Theme-var discipline, part 2: family design tokens still default to fixed colours](#a35--theme-var-discipline-part-2-family-design-tokens-still-default-to-fixed-colours)
- [A36 — Server API layer: decompose the monolith, one error contract, bounded caches](#a36--server-api-layer-decompose-the-monolith-one-error-contract-bounded-caches)
- [A37 — Editor front-end: extract the four buried subsystems](#a37--editor-front-end-extract-the-four-buried-subsystems)
- [A39 — Docker-less install route: install script (system user, systemd service) — acquisition compared](#a39--docker-less-install-route-install-script-system-user-systemd-service--acquisition-compared)


**Documentation**
- [D4 — README: "plays well with" ecosystem line](#d4--readme-plays-well-with-ecosystem-line--credits-shipped) 🔨 *(credits shipped)*


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

## 🔨 Partially addressed (07/2026) — hardened, but the reported symptom was NOT reproduced

**Read this before assuming the item is done.** Two real defects in `_recomputeNarrow()` were found by measurement and fixed; the reporter's exact sequence (rail missing after a plain reload, repaired by a narrow→wide cycle) **could not be reproduced**, so this may or may not close it. Please re-test.

> **Scope note.** This entry now holds a *bug* (first paint, partially addressed) and a *feature request* (the configurable `rail` model below). They are independent: the bug can be closed on its own. Split them if the mixed state gets in the way — the only reason they share an entry is that both live in `_recomputeNarrow()`.


**What was measured.** Mounting the shell four ways in real Chromium:

| scenario | first measurement | result |
|---|---|---|
| pre-sized container | 1000px | ✅ slim rail correct |
| **container not sized yet** | **414px** | ❌ latches overlay mode, hamburger, 220px drawer |
| inside a `display:none` view, then revealed | 0px | ✅ correct after reveal |
| narrow → widened | 400 → 1000 | ✅ corrects |

So a transient sub-breakpoint width **does** latch the wrong mode. In the harness it self-corrects once a real width arrives; on the reporter's page it evidently does not, and that gap is still unexplained.

**Fixed regardless — both are defensible on their own:**

1. **A zero width is no longer read as "wide".** `clientWidth > 0 && clientWidth < breakpoint` made 0 mean *not narrow*, conflating "not laid out yet" with "measured and wide" — so an element inside a hidden view answered persistent from a measurement that never happened, and could equally clear a correct narrow state. It now returns without concluding and waits for the ResizeObserver to deliver a real width.
2. **The `narrow` class is written unconditionally.** It used to live inside `if (nowNarrow !== this._narrow)`, so a first computation that happened to equal the initial `_narrow` never established the class at all — state and DOM could disagree with nothing to re-sync them. The `_drawerOpen` side effect stays on a real transition, since in persistent mode there is no "open" to close.

**Tests:** `www/test-browser/layout-app-first-paint.test.js` — the hidden-then-revealed case, the not-yet-sized recovery, a class/state sync sweep across four widths, and `autohide` (which shares the `:host([…]:not(.narrow))` gating and would break identically). These mount the shell the way the viewer does rather than sizing the host directly, which is the one case the existing suite already covered and the reason this passed CI.

**If it still reproduces**, the next thing to capture is the diagnostic below on the real page *at first paint* — specifically `clientWidth` and whether `narrowClass` is set — because the harness says the correction should arrive and on your page it does not.


**Reported (07/2026).** With **Slim rail** enabled, loading a view that should show it renders **no slim sidebar**. Narrowing the window correctly produces the hamburger; widening it again then produces the slim rail. So the end states are right — only the **initial** one is wrong, and a resize cycle repairs it.

**Prior art — this is the second instance of a known class.** N36 already fixed exactly this shape for the *persistent drawer*: "the ResizeObserver's first delivery can race the initial layout — a transient sub-breakpoint width would flip to overlay mode and hide the persistent drawer until a manual resize", fixed by re-measuring in `requestAnimationFrame` from `firstUpdated()`. That fix is still present. **The slim rail is not covered by it**, or is defeated by something later in boot.

## What was measured (browser harness, real Chromium)

**It does NOT reproduce synthetically** — which narrows where to look:

| scenario | `narrow` class | `_narrow` | drawer width |
|---|---|---|---|
| host **pre-sized** (width set before append), wide, `slim` | absent | `false` | **64px — correct** |
| mount first, then set width | absent | `false` | 207px *(mid-transition; `.drawer` has `transition: width 0.18s`)* |
| after narrow → wide cycle | absent | `false` | 220px *(also mid-transition)* |

A pre-sized mount produces a correct rail, so nothing is wrong with the CSS or the attribute plumbing in isolation. **The defect needs the real viewer environment.** Note also that any width measured immediately after a mode flip is **mid-transition** and misleading — settle the transition before trusting a number.

## Leading suspicion (code review, unverified)

Two details in `_recomputeNarrow()` combine badly with a boot where the element is not yet laid out:

```js
_recomputeNarrow() {
    const narrow = this.clientWidth > 0 && this.clientWidth < (Number(this.breakpoint) || 768);
    const nowNarrow = narrow || this.drawerPersistent === false;
    if (nowNarrow !== this._narrow) {            // ← everything is inside this guard
        this._narrow = nowNarrow;
        this.classList.toggle('narrow', nowNarrow);
        if (!nowNarrow) this._drawerOpen = false;
    }
}
```

1. **`clientWidth > 0` conflates "measured as wide" with "not measurable yet".** A `layout-app` inside a `feezal-view` that is `display: none` at boot (the site toggles view visibility) has `clientWidth === 0`, so it reads as *not narrow* without any real measurement having happened.
2. **The class is only touched on a change.** `_narrow` starts `false` and the `narrow` class starts absent, so a first computation of `false` is a no-op — the correct state is never *affirmatively* established, and if the class and the state ever drift apart nothing re-syncs them. A first delivery while hidden therefore "confirms" a state that was never measured, and the later real measurement (0 → 1000) is also a no-op because the value did not change.

That is consistent with the reported behaviour: the resize cycle works precisely because it forces a genuine *transition* (`false → true → false`), which is the only path that runs the body of the guard.

**Not yet confirmed** — the synthetic harness does not reproduce it, so the above is a hypothesis about the real boot sequence, not a diagnosis. Confirm before fixing.

## Diagnostic — run in the real viewer

Paste after a fresh load (before touching the window), then again after the narrow→wide cycle, and diff:

```js
(() => { const el = document.querySelector('feezal-element-layout-app');
  const d = el.shadowRoot.querySelector('.drawer');
  return JSON.stringify({slim: el.hasAttribute('slim'),
    narrowClass: el.classList.contains('narrow'), _narrow: el._narrow,
    clientWidth: el.clientWidth, breakpoint: el.breakpoint,
    drawerPersistent: el.drawerPersistent,
    viewHidden: getComputedStyle(el.closest('feezal-view')).display,
    drawerW: d && Math.round(d.getBoundingClientRect().width)}); })()
```

The decisive fields are **`clientWidth`** and **`viewHidden`** on the first reading. `clientWidth: 0` (or a `display: none` ancestor view) confirms the suspicion above. If instead `clientWidth` is already wide and `narrowClass` is already absent while the rail is still 220px, the fault is in CSS/attribute application, not in the mode computation — a completely different fix.

## Fix direction (once confirmed)

- Make `_recomputeNarrow()` **idempotent**: always write `classList.toggle('narrow', nowNarrow)` rather than only on a state change, so the DOM cannot drift from the state.
- Distinguish **"not measurable yet"** from **"wide"**: when `clientWidth === 0`, defer instead of concluding — re-measure when the element actually gains a box. An `IntersectionObserver`, or recomputing when the owning view becomes visible, is more reliable than one `requestAnimationFrame` at `firstUpdated()`.
- **Check `autohide` too** — it shares the `:host([…]:not(.narrow))` gating and is likely to have the same first-paint hole.

## Requested (07/2026): make the whole drawer-mode model configurable

Today the persistent drawer's presentation is fixed by two booleans and one breakpoint, and *which* presentation you get at a given width is not choosable at all. Wanted: **every combination expressible** — always slim, always wide, or slim/wide switching at a **second breakpoint**.

### Three zones instead of two

```
width <  breakpoint                    →  overlay + hamburger      (unchanged)
breakpoint ≤ width < rail-breakpoint   →  slim rail                (new middle zone)
width ≥  rail-breakpoint               →  full drawer
```

| attribute | values | default | effect |
|---|---|---|---|
| `breakpoint` | number | `768` | **Unchanged** — below this the drawer is an overlay. |
| `rail` | `off` · `slim` · `edge` · `auto` | `off` | The persistent drawer's presentation. `off` = full drawer (today's default); `slim` = icon rail; `edge` = thin edge; `auto` = width-dependent via `rail-breakpoint`. |
| `rail-breakpoint` | number | `1024` | Only with `rail: auto`. At or above it, the full drawer; between `breakpoint` and it, the rail. |

That covers every case asked for: **always slim** (`rail: slim`), **always wide** (`rail: off`), **width-dependent** (`rail: auto` + `rail-breakpoint`), and the existing thin-edge mode.

### `rail` should replace `slim` + `autohide`, the way `header` replaced `hide-header`

Follow the pattern already set in this element: keep the old booleans working, mark them deprecated, and map them on read (`slim` → `rail: slim`, `autohide` → `rail: edge`).

This also **removes an existing ambiguity**: `slim` and `autohide` are independent booleans today, so both can be set at once, and which wins is decided only by CSS source order (`:host([autohide]:not(.narrow))` comes after the slim rule, so the 8px edge silently wins). They are mutually exclusive *presentations* and belong on one axis — the enum makes that explicit instead of accidental.

### Implementation notes

- **The zone must be derived, not latched.** This is the same lesson as the bug above: compute the zone from the current width every time, write the resulting state to the host unconditionally, and never conclude anything from a `clientWidth` of 0. A third zone is a third chance to latch the wrong one on first paint.
- **The CSS cannot express two breakpoints against the element's own width**, so the resolved zone has to reach the stylesheet as host state — a `rail-state` attribute (or class) written by `_recomputeNarrow()`, which then becomes the single place the whole model is decided. Worth considering **container queries** (`@container`) as the alternative, since the element already sizes itself; that would move the thresholds into CSS but split the logic across two places.
- **Validate the pair.** `rail-breakpoint ≤ breakpoint` collapses the middle zone to nothing; decide whether to clamp, ignore, or surface it in the inspector rather than silently rendering no rail.
- **Orthogonal to [U64](#u64--layout-app-expanding-the-slim-rail-must-not-push-the-content).** That item governs how the rail behaves *once shown* (`slim-expand`, `slim-menu-button`); this one governs *whether and when* it is shown. Keep the two attribute groups from overlapping — and note both land on the same element, so settle the naming together.

### Open question

**Should `auto` be able to pick `edge` for the middle zone**, rather than always `slim`? That would need a fourth value (or a separate "what does auto collapse to" knob), and it is not clear anyone wants a thin edge at medium widths and a full drawer when wide. Left out until asked for.

**Ships with:** the first-paint fix (done — see above), the `rail` / `rail-breakpoint` model with `slim`/`autohide` deprecated onto it, browser tests for each zone boundary **and** for a shell mounted inside a hidden view then revealed (the case the existing suite misses, because every other test sizes the host directly), inspector support for the new attributes, and a `docs/TESTING.md` line under the N36 block covering all three zones plus the deprecated-boolean mapping.

**Relates:** **N36** (slim rail + the original initial-ResizeObserver-race fix for the persistent drawer — same class of bug, second instance), **B41**/N30 (view routing — the shell's owning view may be hidden at boot, which is the suspected trigger), **[U50](roadmap-archive/U50.md)** ✅ / **U63** (the `.content` box work next door — unrelated cause, same element), `feezal-element-layout-app._recomputeNarrow()`.

## Fix

1. **Add the missing controls** to the `layout-app` inspector: `show-active-label`, and `header` once that work settles (plus `rail` / `rail-breakpoint` from **B84** and `slim-expand` / `slim-menu-button` from **U64** when they land — four more chances to hit this).
2. **Guard it generically.** A unit test over every element that declares `inspector:`: assert each name in `feezal.attributes` is reachable in the custom inspector, with an explicit **allow-list** for attributes deliberately hidden (managed elsewhere, legacy/deprecated, or internal). Same shape as the existing parity guards — it converts "someone remembered" into "CI fails", and would have caught both instances here.
   - The check can be static (does the inspector source mention the name?) or behavioural (render it and look for a control bound to that name). Static is cheap and catches the real case — forgetting entirely; behavioural is stronger but needs each inspector mountable in the test env. Start static.
3. **Consider a hybrid panel** as the deeper fix: let a custom inspector render its bespoke sections *and* fall back to the generic renderer for any declared attribute it does not claim. Then forgetting one degrades to "shown plainly" instead of "not shown at all". Bigger change; worth weighing against the guard, which is cheap and sufficient.

**Worth checking at the same time:** which other elements declare `inspector:` and whether they have the same drift. `layout-app`, `material-navbar` and the device-health card are the ones to look at first.

**Ships with:** the missing `layout-app` controls, the generic guard test (+ its allow-list), a `docs/TESTING.md` note under the N36 block, and a line in `CLAUDE.md`'s element-authoring checklist — *"if the element has a custom inspector, add the control there too"* — since the existing checklist covers the manifest, tests and version bump but not this.

**Relates:** **N6** (the custom-inspector mechanism this is inherent to), **B84** / **U64** (each adds attributes to this very element — do not repeat the gap), **E47** / **U47** (the layout-app inspector), `CLAUDE.md` §"Creating new feezal elements" (checklist that should mention it), **A32** (the sibling "declare what you use" packaging guard — same "make CI enforce the convention" idea).

### B106 — `discovery-ids` is space-separated, but MQTT topics may contain spaces

**Reported (08/2026).** Seen in saved source:

```html
discovery-ids="sensor/0x5c0272fffec4c0e9/battery sensor/0x5c0272fffec4c0e9/temperature …"
```

The multivalue merge stamps its member IDs **space-joined** — but discovery
IDs embed topic-derived segments, and MQTT topics may legitimately contain
spaces. hm2mqtt/RedMatic builds topics from **Homematic channel names**
("Licht Terrasse"), and the native recognizers put exactly those segments into
their IDs (`hm-switch:<channelAddr || seg>` — `seg` IS the channel name). One
such member and the list becomes unparseable: the splitter yields fragments,
the dupe-guard mismatches (false re-adds on re-runs, or wrong skips).

**Where:** writer `applyMultivalueFill` in
[feezal-discovery-stamp.js](../www/src/feezal-discovery-stamp.js)
(`memberIds.join(' ')`); reader in
[feezal-generate-dialog.js](../www/src/feezal-generate-dialog.js) (the merge
path splits on `/\s+/`). Audit for further space-joined topic/ID lists while
in there — the single-value `discovery-id` attribute is unaffected.

**Fix:** serialize as a **JSON array** (`discovery-ids='["a","b"]'`), the same
convention `subscribe-availability` already uses for its multi-entry form.
Reader accepts both encodings for back-compat: value starts with `[` → JSON
parse; anything else → legacy whitespace split (existing dashboards keep
working; the next re-stamp upgrades them). Unit test with a member ID
containing a space (an hm2mqtt-style channel name) — round-trip through
stamp → parse → dupe-guard must match exactly.

**Relates:** the multivalue merge (⚡ device rows / wizard), U58 ✅ (Generate —
the dupe-guard consumer), E108 ✅ (native recognizers whose IDs carry channel
names), N12 (re-sync — anything else reading discovery ids must use the same
parser).


### B118 — Undo dead after deleting via the layers-tree context menu (until the canvas is clicked)

**Reported (08/2026).** Delete an element through the **layers view's context
menu**, then press **Ctrl+Z** → nothing is restored. Click into the view
first → Ctrl+Z works again. Smells like keyboard focus: after the ctx-menu
click, the keystroke does not reach (or is bailed out of) the undo handler.

**Where to look:** the shortcut handler is `_keyHandler`
([feezal-sidebar-inspector.js](../www/src/feezal-sidebar-inspector.js)),
registered on `window`, with a focus guard that bails when
`document.activeElement` is INPUT/TEXTAREA/SELECT/contentEditable or a
Shoelace host whose shadow activeElement is an input. Candidates:

1. After the layers ctx-menu click, focus rests on a sidebar element that
   trips the guard (e.g. an `sl-*` host whose shadow activeElement matches, or
   a filter input in the layers panel keeping focus) — check what
   `document.activeElement` actually is right after the delete.
2. The handler (or the inspector) may be wired/active only in canvas
   context — verify `window` registration is unconditional and not torn down
   while the sidebar has focus.
3. Rule out a history gap: confirm the layers-tree delete path records the
   change (`feezal.app.change()`) — if the entry is missing, clicking the
   canvas would not fix it, so focus is the prime suspect, but verify while
   in there.

**Fix direction:** after ctx-menu actions in the layers panel, either blur the
panel (return focus to the canvas/host) or narrow the guard so
non-text-editing sidebar focus does not swallow global shortcuts — global
edit shortcuts (undo/redo at minimum) should work regardless of which editor
panel holds focus, as long as no text field is being edited.

**Test:** browser test — delete via the layers ctx menu, dispatch Ctrl+Z
without any intervening click, assert the element is restored (and the same
for redo).

**Relates:** the layers tree (U87 family), the `_keyHandler` focus guard,
B108 (layers/selection interplay — same neighbourhood).


### B119 — Right-click menu dead after the tab was backgrounded (footer selector crash)

**Reported (08/2026).** After the browser tab sat in the background for a
while, the editor's right-click menu stopped working. Console:

```
Uncaught (in promise) SyntaxError: Failed to execute 'querySelectorAll' on
'Element': 'feezal-element-*, feezal-component' is not a valid selector.
    at get _elements (editor-…)  at render …  at Ss._observer (attributes)
```

**Diagnosis:** the crash is the U97 **footer**'s `_elements` getter using a
wildcard TAG selector — which is not valid CSS and throws. The current source
([feezal-footer.js](../www/src/feezal-footer.js)) already replaced it with the
`isCanvasElement` predicate (with a comment naming exactly this trap), so the
reported session was running the earlier build — **first step: confirm a
rebuild/redeploy makes the SyntaxError disappear**, then close that half.

**Refined (08/2026) — a plain reload does NOT fix it.** The menu stays dead
after reloading, while at the same time (a) `www/dist` is freshly rebuilt and
**no longer contains** the invalid selector, and (b) the context-menu wiring
and its browser suites are green in current source (ctx-submenu,
switch-family, cross-view-select). Two branches to distinguish when picking
this up:

1. **Stale bundle survives the reload.** The crashing trace named
   `editor-C498CFC_.js` — that hash fingerprints the broken build. Check
   whether the browser still loads that hash after a HARD reload (service
   worker / PWA cache reviving the old bundle?) and whether the running
   server process serves a pre-fix dist (needs restart). If stale delivery is
   the cause, the actionable bug becomes: **editor bundle caching must not
   survive a rebuild** (cache-busting / SW update flow for the editor route)
   — that is a real defect on its own, reload-should-mean-current.
2. **A second, genuinely new breakage** — if the menu is dead on a
   confirmed-new bundle hash, capture the fresh console output; the
   fault-isolation half below is then the active lead (the suites do not
   exercise the live constellation).

**What must still be fixed — the resilience half:** one component throwing in
`render()` must not take the editor's right-click down with it. The footer's
attribute MutationObserver → `requestUpdate` → throwing render left an
unhandled rejection storm (re-triggered per mutation — plausibly why the
backgrounded tab, replaying batched mutations on resume, surfaced it), and the
breakage escaped the footer: the context menu died. Investigate the coupling
(shared render scheduling? the selectElement path in the stack?) and add a
containment rule: the footer (and similar passive chrome) wraps its cheap
DOM-derived getters defensively, and a render error in one panel must degrade
that panel only. A regression test that feeds the footer a view holding an
unknown/hostile child and asserts the ctx menu still opens would pin it.

**Relates:** U97 ✅ (the footer), the earlier stamp-code lesson (same
wildcard-selector trap, already documented there), B118 (another
sidebar-interaction global breakage — the editor needs fault isolation
between panels).


### B127 — Copy/paste of template elements loses the template content (B31 regression class)

**Reported (08/2026).** Copy/pasting a `basic-template` element (and
presumably anything storing content as a light-DOM `<template>` child —
dialog bodies, repeater templates) pastes an element whose template is
EMPTY. This was fixed once: **B31** made `_clone()` a deep
`cloneNode(true)` precisely so light-DOM children survive copy/paste/
duplicate — and the B31 unit test still passes.

**Refinement from the reporter: INTERMITTENT — sometimes it works —
and possibly tied to MULTISELECT.** That points at a specific suspect:
in multi-select the attribute inspector merges values across every
selected element and a change writes ONE value back to ALL of them —
for the `template` descriptor that write is
`template.innerHTML = newValue` on each element
(`feezal-sidebar-inspector-attributes.js`), so a multi-selection
containing template elements with DIFFERENT contents (or a mixed/empty
merged textarea) can clobber the originals the moment a write fires;
a later copy/paste of the already-wiped element then merely exposes it.
Check whether the SOURCE element is empty too after the repro — if yes,
the loss happens at multiselect-edit time, not at paste time.

**Why it can regress anyway (diagnosed, not yet reproduced):** the B31
test covers `_clone()` IN ISOLATION. The real pipeline is
`_copy` → append into `_clipboardTpl.content` (a template content
fragment — so the copied element's own `<template>` child becomes a
template nested in template content) → `_pasteInternal` → `_clone` again
→ append to the view → select → the N6 inspector's template textarea
(reads `element.querySelector('template')?.innerHTML`, writes it back on
change and rebuilds `_processTemplate`). The loss is somewhere in that
chain or its surroundings, not in `cloneNode` itself.

**Repro matrix to run first** (pin down WHICH path loses it):
1. **MULTISELECT a template element together with others → copy →
   paste; then the same but touch any inspector field while
   multi-selected first.** Also: multiselect TWO template elements with
   different contents, click into the template textarea, blur without
   typing — did either source lose its content?
2. Single-select Ctrl+C → Ctrl+V on the same view (in-memory
   `_clipboardTpl` chain).
3. Context-menu Duplicate (separate path).
4. Copy on view A → switch view → paste on view B.
5. Copy → paste → **undo → redo** (snapshot/restore round-trip).
6. Paste → check content BEFORE selecting vs AFTER the inspector's
   template editor rendered (does selection/editor clobber it?).
7. Source mode round-trip after paste (the U92/B105 formatter must not
   strip `<template>` bodies).

**Suspects, in order:** the MULTISELECT merged-value write clobbering
the template child across the selection (see refinement above); the
inspector template editor writing an empty value on selection/re-render
of the pasted element; the template-inside-template-content nesting
through `_clipboardTpl`; the undo snapshot/restore; the source
formatter. Fix wherever it lands, and add an END-TO-END test over the
full `_copy` → `_pasteInternal` chain asserting the pasted element's
`template` child content (the gap the B31 unit test left open), plus
the duplicate path and a multiselect-edit case (mixed template
contents must never be overwritten by a merged value).

**Relates:** B31 (the original fix + its too-narrow test), U92/B105
(source formatter — must preserve template bodies), N6 (template
textarea editor), U109 (view clipboard — same serialization concerns).


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

### E20 — Weather forecast element (`feezal-element-material-weather`) → moved

**Moved to [INTEGRATION-ROADMAP.md](INTEGRATION-ROADMAP.md) §she — "Special elements".** The element spec and its data-supply half now live together there, because the interesting problem is not the card: weather is the first element whose data has **no MQTT-native source**, so it became the worked example for element-shipped **she adapter scripts**. The ID stays here so it is not reused and the element remains findable from this index.

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

Displays **image payloads received over MQTT** (binary or base64). ⚠️ **Largely absorbed by E163 ✅:** `basic-camera`'s `mqtt-image` type covers the display half (binary → data-URL relay in both connection layers). What keeps this entry alive is the vision niche: state framing (border color bound to a second topic — e.g. pass/fail, motion), **filmstrip of the last N images** (tap to enlarge; Cognex's no-read-review pattern), freeze-on-condition. Memory-bounded ring buffer; document payload-size caution.

**Relates:** E65 (vision sibling), basic-camera (stream sibling), E32 (event context).

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

### U61 — Editor preview fidelity: gradient/background in a percentage-sized view's scroll overflow

**Split out of [B62](roadmap-archive/B62.md) (07/2026).** When a view is sized in **percentages (e.g. 100% width/height)** and its content overflows into a scroll, the **editor** paints a **checkerboard** in the overflow area, but the **viewer** paints the **view's gradient/background** there. So the editor does not faithfully preview what ships — a WYSIWYG gap. (The iOS-only gradient *tiling* defect was the separate Issue A — fixed in **[B62](roadmap-archive/B62.md)**.)

**Mechanism.** `feezal-site`'s host has a base rule `background: var(--feezal-canvas-bg); background-attachment: local` that extends the current view's background across the full scrollable area, beyond the view's own box ([feezal-site.js:41-45](../www/src/feezal-site.js#L41-L45)) — this is what the viewer uses, and why a desktop viewer fills the overflow with the gradient. But an **editor-only** rule `:host(:not(.feezal-viewer))` paints the checkerboard `background-image`, which **overrides** the canvas-bg sync ([feezal-site.js:59-64](../www/src/feezal-site.js#L59-L64)). Net: viewer overflow = gradient; editor overflow = checkerboard.

**Why the checkerboard exists (and where it's still right).** It marks the area *outside* a **fixed-size** view (a view with explicit px dimensions smaller than the canvas) — genuinely useful there: it shows the view's bounds against the empty canvas. The problem is only the **percentage/100%-sized** case, where there is conceptually no "outside" the user cares about and the viewer will fill the whole scroll with the gradient.

**Open decisions:**
1. **Editor overflow paint by sizing mode.** Keep the checkerboard for **fixed-size** views (bounds are meaningful), but for **percentage-sized** views let the editor extend the view's background across the overflow — i.e. don't let the checkerboard override the `--feezal-canvas-bg` sync when the view is percentage-sized. This makes the editor match the viewer where it matters and keeps the useful bounds indicator where it helps.
2. **View background vs. content height (deeper).** A 100%-height view whose content overflows still has a 100%-tall *box*, so its gradient (painted on the view element) doesn't cover the overflow by construction — the viewer only fills it via the separate canvas-bg sync. Should a view's background instead track its **content** height, so the gradient is continuous on the view element itself (editor and viewer alike), making the canvas-bg extension unnecessary for this case? This is the more principled fix but touches view layout/sizing semantics, so weigh it against option 1's smaller surface.
3. **Interaction with B62 ✅ shipped — the model to match.** [B62](roadmap-archive/B62.md) paints a gradient on **`feezal-site`** (the scroller, which is exactly one viewport) with `background-attachment: scroll` / `cover` / `no-repeat`, and suppresses the view's own paint with `background-image: none !important` — because the view's box is one viewport tall while its content is several, so the band it used to paint scrolled away. In the viewer a gradient is therefore **pinned to the viewport with content scrolling over it**. Whatever the editor does should preview that, not a second model. *(An earlier attempt using a document-root `no-repeat`/`cover`/`fixed` mirror was reverted — do not revive it from an old copy of this paragraph.)* **But see [B83](roadmap-archive/B83.md):** that item fixed the detection, which until then read the inline `background` shorthand and was blind to the longhand- and `var()`-authored backgrounds these views actually use — so the model described above now genuinely engages. Preview *that*, not the old accident where desktop looked right only because the view's own `background-attachment: fixed` was doing the pinning.

**Ships with (once decided):** the editor overflow-paint change (guarded by view sizing mode), a TESTING.md note (percentage-sized gradient view with overflowing content → editor overflow shows the gradient, matching the viewer; fixed-size view still shows the checkerboard bounds), and consistency with the viewer model B62 settled on (above) so the two don't diverge.

**Relates:** **[B62](roadmap-archive/B62.md)** ✅ (the sibling it split from — Issue A was the iOS tiling defect, now fixed; this is the editor/viewer preview gap), `feezal-site` (the canvas-bg sync + editor checkerboard override), **U59** (gradient editor — authors these backgrounds), the fixed-vs-percentage view sizing model, E38 (responsive sizing — view/content sizing is adjacent).

### U63 — `layout-app`: split the content inset into per-side knobs

**Requested (07/2026):** split `--feezal-app-content-padding` into `--feezal-app-content-padding-left` and `--feezal-app-content-padding-top`.

**Rationale (inferred — confirm).** Those are the two edges that touch the shell's chrome: the **drawer** on the left and the **app bar** on top. Wanting to inset *only* against chrome, without restating the other sides, is a real need the single knob serves awkwardly.

**Note what already exists.** [U50](roadmap-archive/U50.md) shipped the knob as `type: 'string'` accepting a **full CSS shorthand** precisely so per-side insets need no extra knobs — `--feezal-app-content-padding: 8px 16px 24px 32px` works today and is documented in its help text and in `docs/TESTING.md`. So this item is **not** about new capability; it is about **ergonomics and composability**: setting one edge without restating the rest, overriding a single side from a theme, and a saner inspector UX than one free-text shorthand field.

## ⚠️ The two obvious implementations both break — measured, not assumed

Verified in real Chromium:

| build | `--…-padding` | result (T R B L) | |
|---|---|---|---|
| shorthand only | `16px` | `16px 16px 16px 16px` | ✅ |
| shorthand only | `8px 16px 24px 32px` | `8px 16px 24px 32px` | ✅ *(U50 today)* |
| shorthand **+ longhands declared, sides unset** | `16px` | **`0px 16px 16px 0px`** | ❌ |
| shorthand **+ longhands declared, sides set** | `16px` (+top 50, +left 5) | `50px 16px 16px 5px` | ✅ |
| nested fallbacks `var(--pt, var(--base, 0)) …` | `16px` | `50px 16px 16px 16px` | ✅ |
| nested fallbacks | `8px 16px` | **`0px 0px 0px 0px`** | ❌ |

Two distinct traps:

1. **A declared longhand whose var is unset does not "fall through" to the earlier shorthand.** An unset `var()` makes the declaration *invalid at computed-value time*, which resets that side to its **initial value (0)** — silently zeroing the top and left inset for everyone already using the knob. This is the naive implementation, and it is a regression.
2. **Nested fallbacks collapse on a multi-value base.** `padding: var(--pt, var(--base, 0)) var(--pr, var(--base, 0)) …` substitutes `8px 16px` into a single position, invalidating the whole declaration → **all padding becomes 0**. So this build only works if the base knob is restricted to a **single length**.

> **Therefore: per-side knobs and a multi-value shorthand knob are mutually exclusive in pure CSS.** The API has to pick one. This is the decision the item turns on — not the plumbing.

## Options

- **(A) Do nothing.** The shorthand already expresses every per-side inset. Cheapest, and costs the reporter the ergonomics they asked for.
- **(B) Per-side knobs + restrict the base to a single length** *(recommended)*. Build the padding from nested fallbacks (row 5 above). Per-side wins, base is the fallback for the rest. **Breaking:** U50's documented multi-value shorthand stops working — but U50 shipped days ago and is unlikely to have users yet, so this is the cheapest moment it will ever be to change. Update U50's `help` text and its `docs/TESTING.md` line in the same commit.
- **(C) Per-side only**, deprecating the base knob. Cleanest API, most churn, four knobs in the inspector.
- **(D) Resolve in JS** — read the vars and write a computed inline `padding`. Sidesteps the CSS limitation and could keep multi-value support, at the cost of runtime logic for something CSS should do.

## Open questions

1. **Two sides or four?** The request names only `-left` and `-top`. An asymmetric API is odd, and under option (B) all four fall out for free. Confirm whether `-right`/`-bottom` are wanted for symmetry, or deliberately omitted because only the chrome edges matter.
2. **Precedence**, once decided, must be documented in the `help` text: per-side overrides the base for that side; the base fills the rest.

**Ships with:** the chosen API on `.content` in `feezal-element-layout-app`, updated `help` text, browser tests extending the U50 block in `test-browser/feezal-elements-layout-app.test.js` (per-side values apply; the base still fills unset sides; **no overflow / no permanent scrollbars** — the `box-sizing` property U50 pinned), the `docs/TESTING.md` U50 entry updated rather than duplicated, and a version bump.

**Relates:** **[U50](roadmap-archive/U50.md)** ✅ (the knob this splits — read its box-sizing note first: `.content` is `flex: 1`, so padding must stay inside the 100% or `overflow: auto` becomes permanent scrollbars), **B83** (an unexplained interaction — setting this padding appears to make the gradient sticky on iOS; do not let that observation quietly become the reason for a padding API), **N36** (the `--feezal-app-*` style-var family this extends), **U58** (its App mode wants a content-area `max-width` knob built next to this one — consider the two together so the content-box API is designed once).

## Approach

**Keep the rail's layout footprint at its rest width and overlay only the expansion.** The rest state — which is today's layout — does not change at all; only the open state differs. That is the smaller and safer of the two shapes:

- **(A) Overlay the expansion** *(recommended)* — `.drawer` stays in flow at 64px; the expanded panel is `position: absolute`, full height of the row, `left: 0`, drawn above `.content`. Needs the row to be a positioned ancestor and a `z-index` **above `.content` but below `.bar` (2) and `.scrim` (3)**.
- **(B) Take the drawer out of flow entirely** and reserve the rail width with a gutter on `.content`. Fewer moving parts in the open state, but it changes the rest state too, and the gutter interacts with **[U50](roadmap-archive/U50.md)**'s content padding and with the embedded view's background copy (padding paints the view background under the rail; margin does not). More ways to get subtly wrong.

**Apply the same to `autohide`** — it collapses to an 8px edge and expands to the full width through the identical `:host([…]:not(.narrow))` gating, so it shifts the content exactly the same way.

**Secondary benefit:** the `transition: width 0.18s` currently animates a flex layout, reflowing the whole content area every frame. Once the panel is out of flow, the same animation touches only its own box.

## Interaction — decided (07/2026), and configurable

| input | activating an entry | revealing the labels |
|---|---|---|
| **touch** | navigates directly, rail **does not grow at all** | tap the **hamburger at the top of the rail** → the existing **overlay drawer** |
| **mouse** | navigates; rail stays expanded while the pointer is still over it, collapses on leave | hover the rail |
| **keyboard / D-pad** | navigates; rail stays expanded for continued navigation | focus enters the rail |

### The knobs

Everything above is opt-in-able. Two new attributes, named to sit with the existing `slim` / `autohide` / `entry-style` / `header` set:

| attribute | values | default | effect |
|---|---|---|---|
| `slim-expand` | `overlay` · `push` · `never` | **`overlay`** | How the rail reveals labels. `overlay` draws the expanded panel **over** the content (this item's request); `push` is today's behaviour, kept for anyone who wants it; `never` makes it a pure icon rail whose only path to labels is the menu button. |
| `slim-menu-button` | boolean | **`false`** | Shows a hamburger at the **top of the rail** that opens the existing overlay drawer. |

**`slim-expand` defaults to `overlay`, which changes current behaviour.** That is deliberate — the pushing is the reported defect — but it *is* a visible change for existing dashboards, so `push` exists to restore it. Flagging rather than burying it.

**`slim-menu-button` defaults to `false`** so nothing appears unbidden on existing dashboards. Note the consequence: a touch user with the defaults still has no way to read the labels, so the two knobs are really "pick one" — either `slim-expand: overlay` with hover for desktop, or the button for touch, or both. Worth deciding whether a slim rail on a touch-first dashboard should default the button **on** instead.

### Deliberately NOT knobs

Two behaviours are treated as fixes rather than preferences. Say if you want them configurable anyway:

- **A pointer never expands the rail.** "Tap navigates, no growth" and "a mouse click must not pin it open" are the same rule; there is no coherent third option to offer. It is one selector change (below), not a mode.
- **Keyboard focus always expands.** Making that optional would be an accessibility regression — **N36** exists to keep the drawer D-pad/keyboard navigable, and a rail whose labels are unreachable by keyboard is worse than one that pushes content.

### One CSS change delivers all three inputs

```css
/* was: .drawer:focus-within */
:host([slim]:not(.narrow)) .drawer:hover,
:host([slim]:not(.narrow)) .drawer:has(:focus-visible) { width: …; }
```

`:focus-visible` deliberately does **not** match a `<button>` focused by mouse or touch — only by keyboard. So: no growth on tap, no focus-pinning after a mouse click (leaving `:hover` to govern it), keyboard expansion preserved.

⚠️ **Supersedes an earlier draft of this item**, which proposed blurring the entry from JS on pointer activation. That cannot satisfy "must not grow at all" — the sequence would still be *focus → expand → blur → collapse*, a visible flash — and it needed `PointerEvent.pointerType` plumbing plus a rule about not blurring on keyboard. The selector needs none of it. `:has()` requires Safari 15.4+ / Chrome 105+; confirm before relying on it.

### The menu button opens the OVERLAY drawer, not an expanded rail

Reuse the narrow-mode drawer wholesale — scrim, Esc, close-on-select, focus handling. Material's canonical navigation-rail + modal-drawer pairing, **no third drawer state**, and an overlay never pushes content.

**At the top of the rail**, not in the app bar — because **the bar is not guaranteed to exist**. With `header: never` there is none, and with `header: small-only` it is hidden *above* the breakpoint, which is exactly where a persistent slim rail lives. A bar-hosted button would be missing precisely when slim mode needs it. (Same for the deprecated `hide-header`.)

**Apply both knobs to `autohide` too** — an 8px edge is even less discoverable than an icon rail.

## Open question

**Does the menu button make the rail redundant at some widths?** With `slim-expand: never` plus `slim-menu-button`, the rail is an icon strip whose only affordance opens the full drawer — at which point plain overlay mode is simpler. Worth checking whether those configurations should converge rather than shipping a rail that is mostly a launcher for something else.

**Ships with:** the `slim-expand` and `slim-menu-button` attributes (both honoured by `slim` **and** `autohide`), the `:has(:focus-visible)` swap, the rail-top button wired to the existing overlay drawer, browser tests asserting (a) with `slim-expand: overlay` the content box does **not** move between rest and expanded — measure `.content` `getBoundingClientRect()` before/after, which is the actual complaint — (b) `push` still moves it and `never` never expands, (c) a pointer-activated entry never widens the rail while a keyboard-activated one does, and (d) the rail button opens the overlay drawer and survives `header: never` / `small-only`, a `docs/TESTING.md` line under the N36 block, and a version bump.

**Relates:** **N36** (slim rail + autohide — the modes this changes), **[U50](roadmap-archive/U50.md)** ✅ (content inset — option B would interact with it), **U63** (per-side inset knobs — same box, settle the API together), **B84** (first-paint mode selection in the same element; unrelated cause, and its `narrow`-class handling is what gates these rules), **E38** (responsive sizing — reflow-vs-repaint is the same concern), `feezal-element-layout-app`.

### Storage shape — alternatives for later refinement

How the two dynamic modes serialize is the one real open decision (all three serialize into the `style` attribute either way). Three candidates, to pick from when this is built:

- **A — explicit per-mode namespaces.** `Subscribe` → `--x-subscribe-topic` + `--x-subscribe-property`; `Range` → `--x-range` + `--x-range-topic` + `--x-range-property`. Most self-describing in source view; the resolver switches on which family is present. Slight duplication of the topic/property pair across the two namespaces.
- **B — one shared source, range optional (recommended to evaluate first).** Both modes write `--x-source-topic` + `--x-source-property`; `Range` *additionally* writes `--x-range: <name>`. Presence of `-range` is what distinguishes the modes: absent → the payload is the colour (Subscribe); present → map through the range. One subscription path, no duplicated pair; the radio is pure UI sugar over "is a range attached?". Reads slightly less obviously in source.
- **C — auto-detect (note as the risky option).** A single "dynamic" mode with a topic/property; the resolver treats the payload as a colour if it parses as one, else maps it through an attached range. Fewest controls, but "why did my number render as a colour / not" is an implicit-behaviour support trap — record it, likely reject.

Independent of A/B/C: decide whether the **Subscribe topic may also feed a range** is just mode B falling out for free, or whether Subscribe stays deliberately range-less for clarity.

## Open questions

1. **Gradient colour space** — OKLCH (recommended) or sRGB, and per-range override or global?
2. **What happens when a range is deleted** while elements reference it? Refuse with a usage count, or leave dangling references that fall back to the var's normal value? A usage count in the manager is worth having either way.
3. **Renaming a range** — rewrite every reference, or treat names as immutable ids with a separate display label? Ids + labels is the safer shape and avoids a rename touching every view.
4. **Does this subsume the conditions engine's `style` action for colours?** They will overlap. Document when to use which — ranges for value→colour, conditions for arbitrary rules — or the two grow apart.

**Ships with:** the range schema + shared resolver (bands/gradient/enum, theme-var passthrough), the paired-property mechanism in `FeezalElement` (the storage shape chosen from A/B/C above; the primary value as the Range default source, an override/Subscribe subscription when a topic is set, and the raw-payload→`<var>` passthrough for Subscribe), the primary-value opt-in, `<feezal-site>` storage, the site-level manager panel, the colour-control **Static / Subscribe / Range radio** with the multi-line dynamic blocks (Subscribe: autocompleting `feezal-topic-input` + message-property + a live swatch of the last payload; Range: range dropdown + create sentinel + topic/property pre-filled from the primary value), the gauge `ranges` attribute accepting a named range, unit tests for the resolver, browser tests that a resolved colour lands on the var (from the primary value, from an overridden topic, and from a raw Subscribe payload), a test that Static↔Subscribe↔Range round-trips the paired properties cleanly, an **export test that ranges + subscriptions survive** into a static bundle, `docs/TESTING.md` coverage, and version bumps.

**Relates:** `@feezal/feezal-gauge` (`bandColor` / `parseRanges` — the existing implementation this generalises, and the first consumer to migrate), **U49** / the conditions engine (`action: style` — the overlapping mechanism to delimit), **U47** ✅ (the `＋ Create new…` sentinel pattern to copy), `feezal-sidebar-themes` / `-assets` (site-level panel precedent), `material-tank` warn/crit + the glass/metro state colours (the ad-hoc thresholds to absorb), `CLAUDE.md` §"Theme variable discipline" (band colours should prefer theme vars), **A16**/export (ranges must serialize into a static bundle).

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

### E159 — Re-add a Paper-family app shell (`paper-app`) with full layout-app parity

**Requested (07/2026):** re-add `paper-app`, with the same features `layout-app` has.

**History.** The legacy Polymer element was `feezal-element-paper-app-layout`. It was **replaced**, not lost: [E47](roadmap-archive/E47.md) built `feezal-element-layout-app` as "the modern Lit/MD3 rewrite of the legacy Polymer `feezal-element-paper-app-layout` (which had the chrome but never wired the drawer to navigation)". So the old element was **not** feature-equivalent — it had the bar and drawer but no view routing. "Re-add with the same features" therefore means building something the Paper family has **never** had, not restoring a deleted file.

## What "the same features as layout-app" actually means

Worth reading before estimating — this list accumulated across a dozen items, and every entry is behaviour a second implementation would have to reproduce **and keep in step**:

| area | feature | from |
|---|---|---|
| chrome | top bar: title, hamburger, action buttons (`actions` JSON) | E47 |
| drawer | entries `{label, icon, view}`, `entry-style` pill/list | E47 / N36 |
| responsive | persistent vs overlay by `breakpoint`, measured on the element's **own** width via ResizeObserver | E47 / N36 |
| responsive | scrim, Esc-to-close, floating fab hamburger when the header is hidden | N36 |
| responsive | **slim rail** and **autohide** modes | N36 |
| a11y / TV | arrow-key + D-pad drawer nav, Home/End, Enter/Space, focus ring | N36 |
| content | embeds and **swaps** a named view (clone into `#content`) | E47 |
| routing | registers as a site **view router** — URL hash `#/view/embedded`, inbound/outbound MQTT view control | N30 / B41 |
| theming | per-view theme CSS mirrored into the shadow root so an embedded themed view renders correctly | B50 |
| theming | embedded view's own background copied onto `.content` | N36 |
| theming | the `--feezal-app-*` style-var family (bar, drawer, overlay opacity, active indicator, drawer width) | N36 |
| layout | `--feezal-app-content-padding` content inset (+ its `box-sizing` trap) | [U50](roadmap-archive/U50.md) ✅ |
| editor | custom N6 inspector: drawer-entry editor, "create new view" flow | E47 / U47 |

Plus two open defects it would inherit or duplicate: **B84** (slim rail missing on first paint) and **U63** (per-side content inset).

## ✅ Decided (07/2026): a real Paper element on `FeezalPolymerElement`

**A genuine Paper-family element** — `feezal-element-paper-app`, extending **`FeezalPolymerElement`** like the rest of the family, not a skin over `layout-app` and not a Lit element styled to look Paper.

That is the most expensive of the options considered and it adds to the legacy Polymer stack, so the consequences are recorded here **to be planned for, not discovered**:

- **Behaviour drift is the main risk.** The table above is thirteen behaviours accumulated over E47/N36/N30/B41/B50/U47/U50; a fork means each future `layout-app` fix must be applied twice, and nothing enforces that. **Mitigation: a parity test**, in the spirit of `www/test-browser/feezal-controller-parity.test.js` — assert both shells expose the same attribute names, the same style-var family and the same routing contract, and fail when one gains something the other lacks. Write it **with** the element, not after.
- **Two open defects must be fixed in both**: **B84** (slim rail missing on first paint) and **U63** (per-side content inset). Ideally settle those on `layout-app` *first*, so the Paper element is built against the finished behaviour rather than inheriting a known-broken copy.
- **Polymer re-expression.** Framework-agnostic parts port directly (the ResizeObserver mode computation, the drawer-entry model, the embed/clone logic, the `--feezal-app-*` vars). Lit-specific machinery needs re-expressing: reactive properties → Polymer `properties` with `reflectToAttribute`, `renderRoot` → `this.$`, `html` templates → Polymer templates, and the B50 theme-CSS mirroring must target the Polymer shadow root.
- **Watch the class of bug the Paper family already has.** `paper-checkbox` reads from `topic` rather than `subscribe` (see [E157](roadmap-archive/E157.md)); pick the attribute names deliberately so the new shell matches `layout-app`'s contract rather than inheriting legacy naming by reflex.
- **`_syncViewBackground` / gradient detection** currently reads inline shorthand only — see **B83**. The new shell copies view backgrounds the same way `layout-app._embed()` does, so build it against B83's fix, not the current code.

**Ships with:** the element or variant, palette entry, the N6 inspector (shared or re-pointed), `www/editor/feezal-elements.js` regenerated if a new package lands, per-element notes in `docs/TESTING.md` §6, a browser test mirroring `test-browser/feezal-elements-layout-app.test.js`, and version bumps per policy.

**Relates:** **[E47](roadmap-archive/E47.md)** ✅ (built `layout-app` *as* the replacement for `paper-app-layout` — read it before re-adding what it deliberately superseded), **N36** / **N30** / **B41** / **B50** / **U47** / **[U50](roadmap-archive/U50.md)** ✅ (the feature set to match), **B84** (slim-rail bug that would be inherited), **U63** (content-inset API in flux — settle it before duplicating), **E137** (the "view over shared behaviour, never fork" principle this item must answer to), **E114** (family parity — the convention pulling toward a separate element), `feezal-element-layout-app`.

### E162 — Fancy family, take two: actually fancy — ready-made Lottie art over generated geometry

**Verdict from the reporter (07/2026), after seeing [E139](roadmap-archive/E139.md) ✅ on a dashboard:** *"i expected much more fancyness … they look really boring. i wanted animations! colors! fancy!"* Honest reading: the shipped set is exactly what E139's own text warned it would be — *"complex illustrative art is explicitly out of scope for the built-in set"* — flat-geometric motion authored in code. The MACHINERY is right (lazy chunk, segment player, directional transitions, position-seek, controller views, override attributes); the ART is the problem. This item replaces the art tier, not the architecture.

## What "fancy" concretely means (so the next attempt can't miss it)

- **Colour** — not two theme tones. Real palettes, gradients, glow. The E139 duotone was chosen FOR theme-recolourability; that trade-off is now explicitly re-decided: **looking great beats auto-retinting** for the built-in set.
- **Motion character** — overshoot/bounce, secondary motion (particles, sparkles, drips), not just eased transforms of the same rectangles.
- **Illustration** — objects that look like the thing (a bulb with filament and rays, a radiator with shimmer, a window with glass and frame depth), not abstract geometry.

## Motion hierarchy (decided 07/2026, from the reporter) — WHEN to animate, not just how

Fancy must not mean busy. Three tiers, strictly:

1. **Rest = still.** A dashboard that is just being shown, with all values stable, animates **nothing**. No idle loops, no ambient motion.
2. **Value changes = decent, short.** A data-driven change plays a brief, restrained flourish and returns to stillness — a temperature rose, the thermometer glyph does a short rise animation, done. Not-too-fancy is the spec here.
3. **User interaction = the really fancy tier.** The showpieces are reserved for moments the user *caused*:
   - switching a light on → the bulb transforms off→on with sparkle;
   - operating a lock → an **animated key turns while the command is in flight**, and when the device *reports back* (subscribe confirmation / HmIP settling — the E127/E128 machinery, given a visual form) → a confirmation flourish (sparkle, spotlight). This is command→working→confirmed **choreography**, not a single clip: the controllers' settling state is what drives it, so the animation is honest about what the device actually did.

**Plus the popup tier (glass precedent):** elements with complex multiple controls hide them behind a **popup**, exactly like the glass family — and the popup open/close transitions are themselves really fancy animated (this is user interaction, tier 3).

### E164 — Fancy family: finish and re-enable the disabled cards

**Context (07/2026).** For the upcoming release only the two cards that meet the E162 bar ship user-visible: **fancy-switch** (confetti proof piece) and **fancy-contact** (perspective Dreh-Kipp window with handle choreography and breeze). The other five — **light, cover, climate, sensor, lock** — are E139-era first drafts and are **disabled**: not imported in the bundle's index.js, dropped from the package.json feezal.elements manifest (→ unregistered, invisible to palette, discovery and Generate). fancy-contact's type is **pinned to window** (select narrowed per-name, discovery valueMap stamps window regardless of device_class) — the door/garage/generic variants are drafts too. Files and test coverage stay in place.

**Done means, per card:** brought to the proof-piece bar the switch and window set —
- artwork with material/perspective quality (the window's camera-projection treatment, not flat boxes);
- choreographed state transitions (the handle-turns-BEFORE-the-sash-moves class of sequencing — e.g. the lock's key turning before the shackle, cover slats tilting before travel);
- a flourish moment on user interaction (breeze/confetti class), tier-boundaries per the E162 hierarchy (rest = still);
- settling-driven confirmation where the device reports back (lock: key turns → holds → sparkle on the reported state; cover: travel follows the reported position, already seek-based);
- editor pose mirroring the final look per state.

Also: the contact card's **door / garagedoor / generic** variants reworked to the window's standard (door with handle + perspective swing; garage with slat roll).

**Re-enable mechanism** (the disable is deliberately shallow): restore the imports in feezal-elements-fancy/index.js, restore the manifest entries in its package.json, un-pin the contact type (drop the per-name options override and the discovery valueMap pin), run scripts/generate-elements.js, update TESTING.md §6 and bump the package.

**Relates:** E139 ✅ (the family), E162 (motion hierarchy, packs, the quality bar), fancy-switch + the window in fancy-contact (reference implementations).

### E168 — basic-camera: Frigate event backfill (events from before the viewer opened) ⚠️ to be refined

**Reported (08/2026).** The camera's event list is a live ring buffer over
`frigate/events` — it starts EMPTY on every page load and fills only while
the viewer is open. Wanted: the recent events that happened before, via
Frigate's HTTP API (`GET /api/events` exists and filters by
camera/label/zone/limit; per-event `thumbnail.jpg` / `snapshot.jpg` /
`clip.mp4` endpoints too).

**Research (08/2026, verified against sources — not memory):**

1. **Every HA Frigate card goes through a server-side proxy; none talks to
   Frigate from the browser.** Read from the
   [frigate-events-card source](https://github.com/saihgupr/frigate-events-card):
   backfill is a Home Assistant WEBSOCKET command (`frigate/events/get` with
   cameras/labels/zones/limit), live updates `frigate/events/subscribe`,
   thumbnails/clips via HA-proxied paths
   (`/api/frigate/<instance>/notifications/<event>/snapshot.jpg`, `clip.mp4`).
   The HA Frigate integration forwards those server-side to Frigate's HTTP
   API. Browser stays same-origin; auth is the HA session.
2. **Why: Frigate's API sends NO CORS headers** — confirmed in
   [frigate discussion #11856](https://github.com/blakeblackshear/frigate/discussions/11856),
   where exactly the naive approach (browser `fetch` of `/api/events`) fails
   with *CORS Missing Allow Origin*. Direct JSON fetch from a feezal viewer
   origin is blocked on a stock Frigate, full stop.
3. **Images dodge CORS**: `<img src="<frigate>/api/events/<id>/thumbnail.jpg">`
   loads fine — the same loophole the U74 live-MJPEG feed already uses.

**Options (decide during refinement — this is the principle call):**

- **(a) feezal-server proxy route, the HA pattern** — e.g.
  `/api/frigate/events` forwarding to the configured Frigate base URL
  (events JSON; thumbnails can stay direct `<img>`). Works on stock Frigate,
  auth-capable. AGAINST: it is exactly the "second transport for
  integrations" the pure-MQTT principle forbids, and static exports have no
  feezal server (backfill would skip there).
- **(b) direct fetch, best-effort** — optional `events-api` attribute; works
  ONLY behind a CORS-adding reverse proxy in front of Frigate; degrades to
  live-only otherwise. Principle-compatible (element-level HTTP, like the
  MJPEG feed) but silently does nothing on a default install — reads as
  broken.
- **(c) upstream** — file with Frigate: CORS headers on the API (a
  one-liner for them) and/or a retained recent-events MQTT topic. The
  principle-pure path, on their timeline. Worth filing REGARDLESS of a/b —
  it lets any proxy shrink later.

**Leaning (from the research): (a) scoped narrowly** — events list only,
exports skip backfill — every HA card author reached the same conclusion
and none solved it client-side; pair with (c) filed upstream. The
pure-MQTT carve-out is the maintainer's call, hence ⚠️.

**While in there (small, found 08/2026):** discovery stamps the FULL events
wiring (`events-topic`/`events-camera`/`event-thumbs`/chips from the
recognizer) but never `show-events`, which defaults to false — a picked
Frigate camera is fully event-wired and shows nothing. One `alsoSet` on the
camera's discovery map fixes it for discovered cameras without changing the
manual default.

**Relates:** E163 ✅ (basic-camera + the events ring buffer), U74 (the
Frigate base URL + live-feed precedent), B111 ✅ (the URL plumbing), the
pure-MQTT principle (the decision this item exists to make).


### Consequences

- **The E139 built-ins get re-audited against tier 1**: the light's breathing loop and the climate heat waves are rest-state loops — they go (a heating thermostat is a *stable state*, not an event). **Decided (07/2026): ACTIVE ALARM STATES are the one deliberate tier-1 exception, and they get the FULL fancy treatment** — fire/smoke, water-leak, gas/CO and similar alarm-slice states animate continuously and richly while active (burning flames, rippling water, not just a pulse). Rationale: an active alarm *wants* ambient attention — motion is the point, and stillness would be the bug. The exception is bounded by the E138 alarm slice; motion/presence states are ordinary states and stay still.
- **The segment model grows event semantics**: change-flourishes (played once on a value delta), interaction transitions, a *working* loop (bounded by the settling window), a *confirmed* flourish, popup open/close clips. The player already handles clips + completion chaining; the new part is what TRIGGERS them.
- **Tier 2 needs chatter protection**, or it silently re-creates idle motion: a temperature ticking 0.1° every ten seconds must not flourish every ten seconds. Minimum-delta and/or cooldown per element (sane defaults, not knobs-first).
- **Commands without confirmation** (no state topic wired, or settling timeout): the working animation must resolve anyway — fall to the optimistic end state after the settling window, no eternal key-turning.
- `prefers-reduced-motion` freezes **all** tiers, as today.

## The licensing landscape for ready-made animations (researched, verify before vendoring)

| source | license | shippable in core? |
|---|---|---|
| **LottieFiles marketplace (free tier)** | "Lottie Simple License" (FL 9.13.21) — **redistribution IS permitted** (analysed against the full text, 07/2026), but share-alike: files stay LSL forever, no relicensing | ⚠️ legally vendorable, **poor fit** — see the LSL analysis below. User-side `animation-src` remains the clean path |
| **Google Noto Animated Emoji** | **CC BY 4.0** — redistribution allowed with attribution | ✅ vendorable per A25 (attribution file alongside, like the font licenses). Full-colour, genuinely delightful; the set covers a surprising amount of the device vocabulary (bulb, fire, droplet, bell, warning, sun/clouds/rain for a future weather card) |
| **useAnimations** | MIT (repo) | ✅ vendorable, but micro icon-transitions, monochrome — solves motion, not "colors!" |
| **LordIcon / IconScout etc.** | paid seats | ❌ out for core; users can buy + `animation-src` |

**Key insight:** the built-ins must come from **redistributable** sources (CC-BY/MIT); LottieFiles' huge catalogue is the *user's* pool, not ours — and E139 already shipped the attribute pair (`animation-src` + `animation-map`) that makes any of it usable today.

## Capability re-assessment (07/2026) — reference-grade GEOMETRIC fancy is generatable

The reporter supplied a LottieFiles success animation ("exactly what i mean when i say fancy") and asked for an honest can-you-do-this. Deconstructed, it is four techniques and ZERO artwork: **trim-path draw-ons** (the ring wipes in, the tick draws stroke-on — a technique E139's generator never used and half the perceived quality), a **particle system** (~32 confetti pieces, two staggered bursts, curved bezier flight paths, spins, 1-frame pop-in / 10-frame fade-out), **craft easing** (x:0,y:1 launch-and-drift — plain numbers), and a **real multi-colour palette**. Every shape is a primitive.

**Assessment, recorded:** this tier IS programmatically reachable — particle bursts are the one motion-design category where code beats hand-animation — and the E139 failure was parameter timidity, not capability. The fix is to **extract the motion vocabulary and the concrete numbers from reference files like this one** (launch ≈ 37 % of comp, 40-frame flights, the exact ease curves, burst-pair stagger) into generator primitives, rather than inventing parameters blind. Copying technique/parameters is legally clean (the LSL covers files, not ideas; own shapes, own code). The hard limit stays: no eyes — the last 20 % of feel needs short human feedback loops (or strict cloning of reference timings), and illustrator-grade art (characters, organic shading) remains out of generator reach — the Noto/pack path covers that.

**Proof piece SHIPPED (07/2026): `fancy-switch`** — the generator gained the reference vocabulary (trim paths, spatial-tangent curved particle flights, the x:0/y:1 pop easing, a seeded deterministic PRNG) and the new card plays it: ON = knob overshoot + radial trim-path wipe + a two-burst 24-particle multi-colour confetti explosion with the reference's numbers; OFF = an explicit shrink-down (imploding ring, knob squash), never the reversed ON. The palette contract was extended for it: flourish particles carry their OWN declared colours (`entry.palette`) through the recolour untouched, while chrome stays theme-toned — enforced by the updated unit test. **Awaiting the eye:** the reporter judges the rendered feel; the parameters are one generator edit away from any verdict.

**Consequence for the direction:** generated art is BACK on the table for the geometric-fancy tier (bursts, wipes, draw-ons, sparkles — i.e. the tier-3 flourishes: the supplied file is literally the lock's command→confirmed choreography: ring wipe, tick draw-on, confetti), complementing — not replacing — the ready-made packs for illustrative looks.

## The Lottie Simple License, analysed against feezal's model (07/2026)

Full-text review (FL 9.13.21) against the concrete model: repo **AGPL-3.0-only**, element packages published **MIT**, CI **license gate** whose allowlist is exclusively OSI/DFSG-clean SPDX licenses (CC-BY-4.0 already on it; LSL has no SPDX identifier).

**Permitted:** download, reproduce, modify, publish, distribute, display — incl. commercial. So vendoring is NOT forbidden (the earlier "not clearly permitted" verdict above was too pessimistic — corrected).

**Why it still fits poorly:**
1. **Share-alike, no relicensing** — files must carry and stay under the same terms; they cannot be subsumed under the fancy package's MIT or the repo's AGPL. Mixed licensing is workable (the OFL-font precedent) but needs `LicenseRef-` handling, an AND-expression in the npm `license` field, and a deliberate gate extension.
2. **The no-compete clause is a field-of-use restriction** ("does not include the right to collect or compile Files … to develop a similar or competing service") — fails OSD §6/DFSG, so the distribution stops being 100 % open-source-licensed. Harmless in fact for dashboard chrome — but the planned **animation picker gallery** is exactly where it bites: shipping a large collection starts to look like "collecting/compiling Files". A small curated set is defensible; a gallery is not.
3. **Drafting ambiguity on "display"** — read literally, "any display … must contain (and be subject to) the same terms" would attach to every wall panel showing the animation. The sane reading (terms travel with the files; displays are merely subject to them) is probably right, but the interpretive risk lands on **every user who exports/publishes a dashboard**, and exports would need to bundle the LSL text.
4. **Per-file applicability** — the LSL covers "public animation files available for download at the LottieFiles site", but not everything there carries it (marketplace/paid files, and newer uploads under different terms). Every candidate needs its license verified and archived individually.

**Resolution:** LSL assets stay **user-side** (`animation-src` — their download, their obligation); the **built-in** set comes from allowlisted sources (CC-BY-4.0/MIT/OFL-class — zero model change). A single irreplaceably good LSL file may be vendored as a consciously-argued exception (license text alongside, gate extended deliberately, kept out of the MIT npm payload) — the fallback, never the default.

## Direction (proposed, refine before building)

1. **Curate a CC-BY/MIT built-in set** — Noto Animated Emoji first: audit which of the six cards (+ states) it can cover convincingly; vendor the JSONs with attribution (A25 pattern), wire them through the existing segment maps. Where emoji art exists, it REPLACES the generated geometry as the default.
2. **Full-colour art does not recolour** — it keeps its own palette (that is the point). The two-tone recolour path stays for the generated fallbacks and for the `--feezal-fancy-*` knobs; a per-element `recolor` boolean could force-tint monochrome art. The E138 colour-semantics requirement relaxes to badges/state-line (which already follow the theme).
3. **Keep the generator as the gap-filler** — device-specific motion no emoji provides (blind travelling to a position %, sash tilt tristate, shackle swing) stays generated, but upgraded: gradients, glow layers, overshoot easing, secondary particles. The slots/segments machinery already supports it; only the authoring ambition was too low.
4. **Editor UX: an animation picker** — the fancy inspector should *show* what you're choosing: a gallery of the vendored set + the site's own `.json` assets with live previews, instead of a bare asset path field. This is where "fancy" becomes discoverable instead of a hidden override.
5. **Size discipline** — ready-made art is 20–200 kB per file; the built-in set should move out of the main chunk into lazily fetched per-card assets (the loader machinery exists — E89), with the tiny generated fallbacks staying inline for instant first paint.

## Packaging (discussed 07/2026): split the ART, not the family

Asked: would moving the fancy elements into their own repo + npm distribution make the licensing easier? Analysed: it makes the CORE cleaner (repo/image stays 100 % OSD-clean, the license gate never sees an optionally-installed package, the opt-in shifts to the user) — but the LSL problems themselves just relocate (a package with LSL assets still cannot be "license": "MIT" wherever it lives; the display clause still reaches every dashboard; per-file verification is the same work), and it costs the one thing E162 exists for: Fancy would leave the default palette (reversing E139's deliberate A23 exception).

**Decided direction instead: keep the six elements in core (machinery + generated fallbacks are MIT-clean — never the problem) and ship ready-made art as separate optional ANIMATION-PACK packages** — `@feezal/feezal-animations-noto` (CC-BY-4.0, allowlist-clean, may even ship in core) first; an LSL pack only ever as its own clearly-labeled opt-in artifact, or not at all (LottieFiles stays user-side). This is the `feezal-icons-*` precedent exactly: asset packages installed via the package manager, registered at import — and the animation picker's content model falls out for free (installed packs + the site's own .json assets).

## Open questions

- Noto coverage audit: which cards get convincing emoji art, which stay generated? (Cover and lock almost certainly stay generated — no emoji travels a blind.)
- Attribution UX: a LICENSES/animations file, or per-asset credits surfaced in the editor?
- Should the picker also browse LottieFiles directly (link-out, never bundling), keeping the licensing burden on the user?
- `fancy-motion` card while at it? (The taxonomy slot exists.)

**Ships with:** the curated vendored set + attribution, the no-recolour/full-colour path, upgraded generator art for the gap cards, the animation picker UX, lazy per-card asset loading, updated family tests (the palette-slot assertions become conditional on generated art), TESTING.md updates, patch bumps.

**Relates:** **[E139](roadmap-archive/E139.md)** ✅ (the machinery this re-skins — player/segments/override attributes unchanged), **E89** ✅ (loader), **A25** (self-hosting + license hygiene — the vendoring pattern), **E113** (function × style), the E20/weather element (Noto's weather emoji would serve it too).

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

**Goal: keep the element set shipped with feezal small.** Three families move out of `www/packages/@feezal/` into their own GitHub repos and are published to npm — exactly the `feezal-elements-rail` pattern (local reference: `/mnt/c/Users/basti/source/repos/feezal-elements-rail`; also `feezal-elements-lcars`). Core keeps basic, material (Device), glass, layout, system — **and metro permanently** ([A24](roadmap-archive/A24.md) ❌ rejected 08/2026: metro stays in feezal).

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

**Sequencing:** pilot with **panel** (smallest, 5 elements, no theme), then tui, paper. The detection feature lands with the pilot's core-removal PR. E63 (schematic family) starts external from day one and never enters core; metro stays in core ([A24](roadmap-archive/A24.md) ❌ rejected).

**Relates:** N29 (bundle mechanism), A20 (scaffolding/ecosystem tooling — this creates the de-facto template), rail/lcars repos (living precedent incl. PUBLISHING.md), E63 (first born-external family), [A24](roadmap-archive/A24.md) ❌ (metro stays in core — rejected 08/2026), E106 (the glass shared-code lessons apply when consolidating families), packages sidebar + `server/src/build/install.js` (install path under test).


### A27 — i18n: editor localization + language-aware element defaults 🔨 Phase 1 (de+es+fr+it+pl+pt+tr) ✅ shipped · phases 2–3 open

feezal is English-only today — and not just the editor chrome: **element attribute defaults bake English into every dashboard** (`label-on: 'On'`, `label-off: 'Off'`, `done-label: 'Done'`, contact state texts, `labelOff: 'off'` centre text, …). A German wall tablet should say "Ein/Aus" without the user hand-setting every label on every element.

**Foundation decided (07/2026): the site `locale` attribute lands in N38** (localized number formatting) — this item consumes that same attribute for its language-aware defaults rather than introducing a second setting. Open sub-question to settle here: whether the *editor chrome* language follows the site locale or gets its own editor-level setting (an editor used in English can legitimately build German dashboards).

**First step SHIPPED (07/2026)** — with [N38](roadmap-archive/N38.md) ✅, which supplied the locale foundation in the same stroke. What landed: the `defaultI18n` descriptor field + `localizedDefault`/`resolveLocaleChain` in `@feezal/feezal-element/feezal-locale.js`; `_applyLocalizedDefaults` in the base class (on connect + `feezal-locale-change`, authored-attributes-win); the inspector placeholder shows the locale-resolved default; German dicts on every display-text descriptor across the families (glass/eink/metro/circle/panel switch·light·contact·wled state words, countdown's `done-label` — 24 dicts, 13 elements, case-matched per family). One refinement beyond the plan, discovered by test: the display-text properties were REFLECTED, and Lit reflects constructor defaults on first render — so `hasAttribute` was not the trustworthy authored-signal the refinement assumed, and saved dashboards already carried baked `text-on="On"` junk. The properties no longer reflect, and the base class heals the baked junk (attribute value === en default → treated as reflection junk, removed, localized; anything else the author typed wins). **Still open here: Phase 2 (editor chrome), Phase 3 (help texts), climate/enum mode words.**

**Language progress (Phase 1 dicts):**
- ✅ de (07/2026, first step)
- ✅ pt · es · fr · it · pl · tr (07/2026 — all 38 dicts across 14 packages; contact-state words use the feminine forms that fit window/door in the Romance languages, Polish the neuter/plural fitting okno+drzwi; `test/feezal-locale.test.js` ratchets that every shipped dict carries the FULL language set, so a new dict or language cannot ship half-covered)
- ⏳ next candidates when asked: nl, cs, sv, da, nb, fi, hu, ru, uk (the N38 locale picker already offers them — only dict entries are missing)


**Proposed scope split (phased — the phases are independently shippable):**

1. **Phase 1 — language-aware element text defaults** (smallest string count, highest end-user value). The *runtime display defaults* of text attributes become locale-aware; **explicitly set attributes always win**, and **serialized HTML stays locale-independent** (an unset `label-on` stores nothing — a shared dashboard renders "On" on an English tablet and "Ein" on a German one; that's a feature, not a bug).
   - **Mechanism suggestion:** attribute descriptors gain inline dictionaries — e.g. `default: 'On', defaultI18n: {de: 'Ein'}` — resolved at render time against the active locale (fallback chain: exact locale → language → `default`). Inline dicts keep **element packages self-contained** (critical for A23 externalized families — no central catalog dependency), and the inspector shows the localized default as the field placeholder.
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

## Refinement (07/2026) — the open questions, answered against the code

### Phase 1 is feasible, and the reason is worth knowing

The design promises "serialized HTML stays locale-independent". **That holds, because descriptor `default`s are never materialised**: the inspector renders them as the input's `placeholder` (`feezal-sidebar-inspector-attributes.js`), so an untouched attribute is genuinely absent from the saved HTML. A shared dashboard really can render "On" on an English tablet and "Ein" on a German one.

**But there are two sources of truth for a default, and only one of them is the descriptor.** The runtime value comes from the constructor:

```js
this.labelOn  = 'On';     // eink-light, glass-light, …
this.labelOff = 'Off';
this.doneLabel = 'Done';  // basic-countdown
```

The descriptor's `default` feeds the *inspector placeholder*; the constructor feeds the *rendered output*. Phase 1 has to change the second, and any design that only localises descriptors will look right in the inspector and still render English.

### Where resolution happens — not the constructor

Constructor-time resolution fails twice: the site locale may not be resolvable when an element is constructed, and a later locale change would not propagate.

**Proposed: the base class applies localized defaults on connect, and again when the locale changes, but only for attributes the author never set.** `hasAttribute()` is a trustworthy "was this set?" signal *precisely because* defaults are never written:

```js
// FeezalElement, on connect + on locale change
for (const spec of localizableAttributes(this.constructor)) {
    if (!this.hasAttribute(spec.name)) this[propOf(spec)] = localizedDefault(spec, locale);
}
```

This keeps every existing constructor untouched (English stays the in-code fallback and the final resort), materialises nothing, and is locale-reactive. The alternative — leaving properties unset and resolving in each `render()` — is more purely reactive but would touch every element's template.

### Fallback semantics

Plain BCP-47 truncation, most specific first, `en` last: `de-AT → de → en`, and with a script subtag `zh-Hans-CN → zh-Hans → zh → en`. One shared `resolveLocaleChain(locale)` helper so the element defaults, the editor catalog and the `Intl` call sites cannot disagree about what `pt-BR` falls back to.

### Export: dynamic by default, pinned by being set

No special export logic. The site `locale` attribute defaults to the browser's language, so an export with no explicit locale follows the viewing device; a site that *sets* one has it serialized and therefore pinned. The two behaviours fall out of the same attribute — worth stating in the docs, since "why does my exported dashboard change language on my colleague's laptop?" is otherwise a support question.

### Editor chrome language: its own setting

Follows the reporter's own framing — an editor used in English can legitimately build German dashboards. Persist it with the other editor preferences in **`<dataDir>/editor.json`** (the welcome-tour seen-marker and the discovery grace period already live there), defaulting to `navigator.language`. ⚠️ That store is **per installation, not per browser**, so two people editing the same server share one editor language; `localStorage` would be per-browser but diverges from where every other editor preference lives. Recorded as a genuine trade-off rather than a default choice.

### The AI assistant

Its generated labels are **explicitly set attributes**, so they win over locale defaults by the same rule as any hand-set value — no interaction to design. The real requirement is the other direction: **pass the site locale into the prompt** (`server/src/ai/prompt.js`) so a German site gets German labels generated in the first place, rather than English ones that then override the German defaults.

### Variant decisions

- **`pt`: ship both `pt-BR` and `pt-PT`.** Brazil is the larger smart-home market and the differences are user-visible; the fallback chain makes `pt-BR → pt → en` work if only one exists.
- **`zh`: `zh-Hans` first**, `zh-Hant` later. Both wait on the CJK font decision already recorded above.

## First step (decided 07/2026): German element-text defaults — implementation-ready

The concrete first deliverable is **Phase 1 restricted to en + de**: a German wall tablet renders "Ein/Aus", "Offen/Geschlossen", "Fertig" without the user setting a single label, and the saved HTML stays language-independent. Small, self-contained, highest end-user value, and it **ships without waiting on N38 or the editor-chrome catalog**. The two previously-open questions are settled by it:

**1. What counts as "localizable" → the presence of the i18n dict IS the opt-in.** No separate boolean flag. A descriptor that carries a `defaultI18n` map is localizable; one that does not is never touched. This makes the one real trap disappear for free: `payload-on: 'ON'` and every other wire-protocol attribute simply carries no dict, so it can never be localized. Element authors opt each display string in, one at a time, and the audit below is exactly "which descriptors get a dict".

**2. Carry all locales or lazy-load → ship both inline for en+de.** The strings are single state-words; en+de across every element is a few kB, far under any threshold worth lazy-loading machinery for. Inline keeps packages self-contained (the A23 requirement). Re-measure only when the language count grows — not now.

### Mechanism (concrete)

- **Descriptor format:** `{name: 'label-on', type: 'string', default: 'On', defaultI18n: {de: 'Ein'}}`. `default` stays the en source + final fallback; `defaultI18n` adds locales. The inspector placeholder shows the *resolved* default for the active locale.
- **Locale source — `feezal.locale`, one global.** The viewer bootstrap sets `feezal.locale` from N38's site `locale` when present, else `navigator.language`, and dispatches a `feezal-locale-change` event on change. Because it falls back to the browser language, **German devices get German with zero configuration and this step needs nothing from N38** — when N38 lands, its attribute simply becomes the top of the chain. `resolveLocaleChain(locale)` (shared helper, §"Fallback semantics") turns `de-AT` into `de → en`.
- **Resolution in the base class, on connect + on `feezal-locale-change`, gated by `hasAttribute`** (per the refinement above — the constructor's `this.labelOn = 'On'` is overwritten only when the author never set the attribute, so explicit values always win and nothing is materialised into the HTML):

  ```js
  // FeezalElement
  _applyLocalizedDefaults() {
      const chain = resolveLocaleChain(feezal.locale);
      for (const spec of this.constructor.feezal.attributes || []) {
          if (!spec.defaultI18n || this.hasAttribute(spec.name)) continue;
          const val = chain.map(l => spec.defaultI18n[l]).find(v => v != null) ?? spec.default;
          this[propOf(spec.name)] = val;
      }
  }
  ```

### German glossary — the first-step audit

Every `type: 'string'` DISPLAY default across the element packages gets a `defaultI18n.de` (wire/payload/topic attributes get none). The confirmed core set (grep of the packages):

| attribute(s) | en | de |
|---|---|---|
| `label-on` / `text-on` | On | Ein |
| `label-off` / `text-off` | Off | Aus |
| `text-open` | Open / open | Offen / offen |
| `text-closed` | Closed / closed | Geschlossen / geschlossen |
| `done-label` (basic-countdown) | Done | Fertig |
| panel-switch engraved `label-on`/`label-off` | ON / OFF | EIN / AUS |

`label: 'Alarm'` (alarm card title) stays "Alarm" (same in de). Climate mode words (Heat/Cool/Auto/Idle → Heizen/Kühlen/Auto/Aus) are enum-driven and are a follow-up bullet, not blocking the core state words. The audit's job is to walk every family (glass/circle/metro/eink/material/paper/panel/tui) and add `defaultI18n.de` to each display string, matching case (lower-case `open` stays lower-case `offen`, upper-case `ON` → `EIN`).

**Ships with (first step):** the `defaultI18n` descriptor field honoured by the inspector placeholder; `feezal.locale` + the `feezal-locale-change` event set from the viewer (browser-language default); `resolveLocaleChain`; the base-class `_applyLocalizedDefaults` on connect + locale-change; German dicts on every display-text descriptor across all families; per-element patch bumps; unit tests (a set attribute wins over the de default; an unset one renders "Ein" under `de` and "On" under `en`; a locale change re-applies live; `payload-*` is never localized; the saved HTML is unchanged either way); and a `docs/TESTING.md` row (switch `feezal.locale`/browser lang to `de` → state texts flip, saved HTML identical). **Explicitly deferred to later A27 phases:** editor chrome (Phase 2), help texts (Phase 3), every language past de, and climate/enum mode words.

**Relates:** A23 (externalized element packages must carry their own translations — the inline-dict design exists because of this), A25 (no-CDN rule — any i18n lib must be bundled/self-hosted), **A29** (RTL — layout mode, deliberately split out), **N38** (site locale — the foundation attribute), E99 ✅-era label work (`label-on`/`label-off` — the attributes phase 1 localizes were introduced for exactly this localisation need, just manually), U37 (welcome wizard — early editor-chrome translation candidate), basic-datetime/clock (Intl locale pass-through).

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
### A35 — Theme-var discipline, part 2: family design tokens still default to fixed colours

**Context (07/2026).** The discipline sweep removed every fallback after a canonical theme var and every `--sl-color-*` reference from dashboard code (491 chains + 136 tokens across 101 files), and the default palette now lives ONCE in `www/src/feezal-base-theme.js` (`:root`), enforced by `www/test/theme-var-discipline.test.js`. What remains — deliberately — is the class the sweep could not do mechanically: **~512 element/family vars in 74 files whose default is a fixed colour with NO canonical var in the chain**, plus plain literal descriptor defaults (e.g. `--feezal-app-bar-color: #fff`).

## Why these were not bulldozed

They are **design-language constants**, not theme roles, and each needs a per-var decision:

- **Frosted glass** (`glass-*`, the worst offenders at ~30/file): surfaces like `rgba(255,255,255,0.12)` and text `rgba(255,255,255,0.92)` are what MAKES the glass look. Mapping glass text to `--primary-text-color` renders it unreadable on light themes — the glass card is dark regardless of theme.
- **eink** (1-bit black/white by definition), **panel** (cockpit bezels), **tui** (terminal green) — same story: the family IS the palette.
- **On-primary text** (`--feezal-app-bar-color: #fff`, dialog header text, …): the canonical set has NO "text on primary-coloured surface" role, so there is nothing correct to map to today.
- Editor-placeholder chrome inside elements (layout-flex/-responsive slot badges etc.) — cosmetic, low value.

## Fix directions (decide per family, not globally)

1. **Family themes own the family tokens.** `feezal-theme-glass` defines `--feezal-glass-*` values; the elements reference them bare; a *base block in the family's shared package* (the `@feezal/feezal-glass` equivalent of `feezal-base-theme.js`) supplies the defaults once per family instead of per element. Removes the duplication without pretending a design constant is a theme role.
2. **New canonical roles** where a real gap exists — the strongest candidate is **`--on-primary-color`** (text/icons on `--primary-color` surfaces: app bar, filled buttons, dialog headers). One new var would eliminate most `#fff` literals meaningfully instead of mislabelling them.
3. **Leave true constants alone** and allow-list them in the ratchet with a comment (eink's black is not themable and should not look like it is).

## Ships with

Per-family passes (glass first — biggest count), each: the family base block or new canonical role, elements referencing bare vars, the ratchet extended to that family's pattern, a visual check on light AND dark themes, patch bumps. The ratchet stays green throughout — extend it family by family rather than in one leap.

**Relates:** `www/src/feezal-base-theme.js` + `www/test/theme-var-discipline.test.js` (part 1, done), `CLAUDE.md` §Theme variable discipline, `docs/element-spec.md` §5.1, the `--md-sys-color-*` legacy migration (same touch-it-then-migrate policy).

---

### D4 — README: "plays well with" ecosystem line 🔨 credits shipped

**Shipped (08/2026):** the README **Credits** section — Lit, MQTT.js,
interact.js, DragSelect, Monaco Editor, plus the licence-REQUIRED attributions
found by the vendored-asset audit: Font Awesome Free (CC BY 4.0) and the KNX-UF
icon set (CC BY-SA 3.0 DE); MDI/Material Symbols/Roboto are Apache-2.0 (no
visible attribution needed) and the fancy family's animations are generated,
not vendored art. Settled while writing: Shoelace and Express are NOT credited
(kept to the SBOM pointer).

**Remaining — the "plays well with" line:** a separate README line naming the
integration ecosystem (recognition, not dependencies): Home Assistant MQTT
discovery, zigbee2mqtt, Homematic/CCU, Frigate, evcc, WLED (and the Scrypted →
Frigate camera chain the camera docs describe). One line, links only, no
badges — deliberately deferred.

---

### N41 — Shared-fragment dedupe: kill the copy-paste drift across elements

**Found by audit (08/2026).** The element corpus re-implements the same fragments with measurable drift — each bullet names the worst evidence:
- 🔨 **Availability attributes** — `availabilityAttributes({section, available, unavailable, mode})` now lives in `feezal-discovery-fragments.js` and **37 of 57 files** spread it; 54 descriptors across 17 distinct wordings collapsed to one. Verified by diffing every element's RESOLVED descriptors against HEAD: attribute set unchanged, no type/default/section changed, only ordering in 2 files. `test/availability-fragment-adoption.test.js` is the ratchet. **Remaining 20 files are individually blocked, not merely unswept** (allowlisted with reasons): `partial` — the element declares only 3 of the 4 knobs, so adopting would ADD one (a behaviour change); `split` — descriptors interleaved with element-specific ones, so swapping reorders the inspector; `advanced` — a per-file flag the fragment does not model. Each needs a decision, not a sweep.
- 🔨 **Availability badge** — the survey in this item was **inaccurate**, which changes what the work is. The five verbatim copies were **not** wifi-off: they were a byte-identical MDI **alert-circle** `UNAVAIL` const, now exported once as `unavailableIcon` and adopted by all five Circle elements (pure dedupe — each family still positions it with its own `.unavail` rule, so nothing moved on screen). wifi-off appears in device-health / qrcode / connection-status, which show CONNECTION state, not per-device availability — a different concern that should NOT be folded in.
  **What is left is a design decision, not a refactor:** the badge concern still carries three glyphs — alert-circle (5 Circle elements), a warning triangle (circle-multivalue), and the `⚠` text glyph of `availabilityBadge()` and its 3 adopters. Unifying them changes what users see, so pick the glyph first, then sweep. The per-element `.unavail` CSS (position/size varies by family) is the other half.
- **Rewire idiom**: `_wireSubscriptions`/`__wireSig` copy-pasted **12×** in two divergent variants (~170 lines). Hoist `rewireOnSignatureChange()` into `FeezalElement`; subclasses keep only their `_wireSignature`/`_wireSubscriptions`.
- ✅ **Locale drift (user-visible)** — done: `formatValueDisplay()` now lives in `feezal-locale.js` and glass/circle/eink-value all call it, so one reading renders identically across families (the guard test asserts the families AGREE, not merely that the helper works). *Still open in this bullet:* the 5 remaining `formatNumber` bypasses (controller-aiedge, material-tank, basic-table…).
- **Truthy-payload parsing**: hand-rolled **17× with 6 different semantics** (some accept `'on'`, some `1`, some lowercase). Export one `asBool()` (the identical `feezal-hm-fault`/`evcc-loadpoint` version) and adopt.
- **Multivalue grid/stack markup**: the ~22-line render block is character-identical ×4 families — export `renderMultivalueGrid/Stack(mv)` partials from the controller.
- **Smaller**: wled effect/palette `<select>` builders ×3 (→ controller `effectOptions()/paletteOptions()`; also fix wled-lists.js's stale "duplicated verbatim in 3 packages" header comment — it is imported, not copied); `labelFor()` duplicated between the two history UIs; `formatKb`/`formatSize` per-file byte formatters; ✅ `uniqueViewName` unified in `feezal-discovery-stamp.js` — the wizard sanitized nothing, so it could mint view names the editor itself rejects (quotes/angle brackets, unbounded length).

**Ships with:** the shared exports + adoption sweep, patch bumps across touched packages, and ratchet-style greps in existing guard tests where cheap (e.g. "no local `subscribe-availability` descriptor outside the fragment").

### N42 — Front-end hot-path hygiene: parse memoization, ungated logging, listener teardown

**Found by audit (08/2026).**
- **JSON.parse per render/message**: `MultivalueController.config` re-parses the `values` attribute ≥2× per update cycle (per MQTT message, ×4 families); `basic-device-health:230`, `circle-fan:298`, `circle-value:267`, the inspector's `_conditionCount` parse per render. Memoize on the raw attribute string; fold `rowUnit` into `grid()` rows (currently 2 calls × rows, each allocating a Set).
- **Ungated hot-path logging**: `feezal-connection.js:135` logs EVERY inbound MQTT message (holding a live payload reference), `:248` every publish; `feezal-connection-mqtt.js:168,183,187` more of the same — while the `mqttDebugOn()` gate exists three lines away. Gate them; delete the stray `console.log`s in paper-dropdown:112, paper-tabs:100, sidebar-inspector:583.
- **`_spreadMessage`** allocates a filtered array and scans all subscriptions per message (`feezal-connection.js:148-150`) — plain loop + an exact-topic index.
- **Listener leaks**: `feezal-sidebar-inspector` wires 3 capture listeners per view and never removes them (`:1027/1046/1061` vs `disconnectedCallback:662`); 5 more src files add without removing (capacitor-dialog SSE, connection, presence, pwa-icon-dialog, site playlist). Uniform fix: per-wiring `AbortController`.
- **querySelector churn**: `feezal-app-editor` re-queries the same selectors up to 9× (`feezal-sidebar-viewer` etc.) — cached getters.

### U84 — Canvas zoom, pan and fit-to-view

**Found by audit (08/2026): none exist** — the canvas only scrolls (`feezal-site` overflow:auto); no zoom, no space-drag pan, no fit/overview for large dashboards.
- `Ctrl+wheel` zoom around the cursor, `Ctrl+0` = 100 %, `Ctrl+Shift+0` (or a toolbar control) = fit view; space-held drag pans; zoom % indicator in the toolbar.
**Attempted 08/2026 — reverted, with two measurements to start from.**

1. **CSS `zoom` is not the shortcut it looks like.** It scales layout, so
   `feezal-site`'s scroll extent adapts by itself and no wrapper is needed —
   but probed in a real editor at 0.5, a pointerdown on the element's visual
   centre produced **no interact drag at all** (zero snap-target calls, element
   unmoved), while its rect had halved correctly.
2. **`transform: scale()` alone fails the same way**, and the margin trick for
   the scroll extent (`margin-right: offsetWidth * (z - 1)`, avoiding a wrapper
   the VIEWER would share) has its own problem: the view is a flex child, so a
   large negative margin changes its layout size and the element moves out from
   under the cursor mid-gesture. Mid-drag `elementFromPoint` returned the view,
   not the element.

So the open question is not which scaling property to use — it is why interact
never picks up the gesture inside a scaled subtree. Answer that first; the
coordinate conversions themselves are straightforward and were written (drag
delta and palette drop divide by the scale, `_dragRestriction` multiplies the
layout figures it mixes with client rects).

**Research (08/2026) — interact.js × zoomed views, docs + source verified:**

1. **interact.js has NO native transform/zoom awareness — confirmed, and it
   never will be a config flag.** The FAQ is silent on transforms; the
   upstream issues asking for it have been open for years
   ([#137](https://github.com/taye/interact.js/issues/137),
   [#400](https://github.com/taye/interact.js/issues/400),
   [#430](https://github.com/taye/interact.js/issues/430),
   [#609](https://github.com/taye/interact.js/issues/609)). There is no
   `deltaScale`/transform option (the earlier sketch's assumption was wrong).
   The library measures rects via `getBoundingClientRect` and reports dx/dy
   in client/page pixels; the entire ecosystem recipe is: **let interact run
   in screen space, divide `event.dx`/`dy` by the zoom in your own move
   listeners, and derive positions from client rects** (which scale
   automatically).
2. **Hooks interact DOES provide** (verified in the bundled 1.10.27):
   `interactable.rectChecker(fn)` overrides rect measurement per
   interactable; `deltaSource: 'page' | 'client'` picks the delta coordinate
   pair; `origin` shifts the coordinate origin. None applies a scale — they
   are useful for keeping ONE consistent space, not for converting.
   feezal's snap `targets` callbacks already live in page space (client-rect
   derived), so the snap pass survives zoom by construction as long as its
   inputs stay screen-space.
3. **The no-start is SOLVED — bisected 08/2026, and it was never a start
   problem.** A scale gradient (drag at 1 / 0.98 / 0.9 / 0.75 / 0.5) showed
   drags work down to 0.9 and die below — a threshold, not a categorical
   limit. At the broken scales `resizeElement` was set mid-gesture: interact
   starts a **RESIZE, not nothing** — the resizable's edge margins eat the
   small VISUAL element, so its centre falls inside the right/bottom edge
   zones and the action checker picks resize. Dragging from the top-left
   quadrant of the same element at 0.5 works perfectly. The clincher: a
   50×25px element at **scale 1** behaves identically (centre-press starts a
   resize) — the defect is size-dependent, not zoom-dependent, and exists
   today (filed as B122). Consequences for U84: (a) drag inside scaled
   subtrees starts and tracks exactly as upstream documents (offset ∝ scale,
   fixed by dividing); (b) the resize onmove writes `event.rect.width` —
   VISUAL px — into layout styles, which under zoom shrinks the element to
   its visual size (measured: 100×50 → 50×65 after one gesture at 0.5), so
   the resize path needs the same ÷zoom treatment as the drag path; (c) fix
   B122 (explicit resize `margin`, or margin derived from the element's
   visual size) and the "no-start" disappears at every scale.
4. **Recommended architecture** (ecosystem consensus + feezal structure):
   one source of truth `feezal.editorZoom`; `transform: scale(zoom)` +
   `transform-origin: 0 0` on the view container; scroll extent via a sized
   wrapper (layout size × zoom) — NOT the margin trick (measured badly:
   flex-child layout shifts mid-gesture); screen space stays screen space
   (`_snap` in/out, restriction rects, autoScroll — all client-rect derived);
   layout-space conversion at exactly two boundaries: writing styles
   (`left = old + dx / zoom`) and wherever layout numbers mix with client
   rects (`_dragRestriction`, `_viewContentExtent`, the drag-autoscroll
   compensation at `inspector.js:2006` — still the budgeted risky spot).
   Cursor-centric `Ctrl+wheel`: adjust scroll so the cursor's canvas point
   stays fixed (`scroll' = (scroll + cursor)·z'/z − cursor`).
5. ~~Fallback if the no-start resists~~ — obsolete: the no-start is solved
   (point 3). Kept only as a pointer: A38's hand-rolled direction shows
   drag/resize could eventually go interact-free, but nothing in U84 needs it.

**Verdict (08/2026, measured): DOABLE.** The categorical fear — "interact.js
does not support this at all" — is half-right and not fatal: interact has no
transform awareness and never will, but drags inside scaled subtrees START
and TRACK (offset ∝ scale, fixed by dividing); the one observed hard blocker
was B122 wearing a zoom costume. What remains is breadth, not depth: an
audit of every seam where client rects meet layout px — the multiplicative
sibling of B114's additive scroll audit, with the same seam-and-revert-probe
test pattern.

**The seam catalogue** (~12, each individually trivial, each needing its own
revert-provable test):
drag onmove ÷z (two sites: initAbsolute + the flow-mode drag), resize onmove
÷z (two sites — measured: one gesture at 0.5 writes the visual rect into
layout and shrinks the element), `_snapSize` input assembly, `_dragRestriction`
/ `_viewContentExtent` layout×z mixing, palette `_applySnappedPos` ÷z,
align/distribute (rect-derived deltas written to styles), the U99 readouts
(÷z so the label shows LAYOUT px, the number the style inspector shows), the
grid overlay (background-size ×z + origin), cursor-centric wheel scroll math,
and the drag-autoscroll compensation (`inspector.js:2006` — still the single
budgeted risky spot).

**Build order:** (1) B122 first — standalone user value, and it removes the
"no-start" at every scale; (2) drag+resize ÷z with per-seam e2e; (3) the
rest of the catalogue seam by seam; (4) gestures/UI last (Ctrl+wheel around
the cursor, Ctrl+0 / Ctrl+Shift+0, space-drag pan, the U97 footer segment).
Clamp zoom to ~0.25–2 and STEP it (no fractional wheel accumulation) —
cleaner numbers, fewer sub-pixel-flaky snap tests. Sizing: comparable to the
whole B112–B117+B114 guides arc — several focused sessions, not an afternoon.

**Residual risks, named:** zoom×autoScroll during edge drags (mitigation:
disable autoScroll while zoomed ≠ 1 if it misbehaves — pan exists, scoped
degradation); ±1px snap assertions at deep zoom-out (mitigation: stepped
zoom + tolerant assertions at non-1 scales only).

**Cheaper alternative if the budget shrinks:** a read-only overview mode —
fit + pan + zoom for orientation, editing gated to 100% — delivers most of
the large-dashboard value at ~20% of the cost and zero risk to the drag
stack. Full editing-under-zoom can follow it incrementally.

The zoom indicator's home is settled: the [U97](roadmap-archive/U97.md) ✅
footer, not a floating tray.

- Out of scope here: minimap (💡 future note only).

### U85 — Toast/notification service: route the remaining call sites 🔨 service shipped

**Shipped (08/2026):** `www/src/feezal-toast.js` — a stacked bottom-centre queue in the
editor shell. Success/info auto-dismiss, warning/danger stay until dismissed (they usually
need a decision), optional action button, themed through the `--feezal-*` editor vars so
dark mode needs no extra wiring; `feezal.app.toast(msg, opts)` is the entry point. Landed
with **B98** ✅, whose deploy failure had nowhere to go — deploy success and failure (with a
Retry action) are its first users. Browser-tested in `test-browser/feezal-toast.test.js`.

**Remaining — route the other feedback through it** (each is currently silent or bespoke):
export ready, package install/update/remove results, component create/detach/delete,
the switch-family report (replacing its own `.switch-toast` in `feezal-sidebar-inspector`),
AI apply results, and the asset upload/rename outcomes.

**Relates:** N43 ✅ (chrome tokens style it), B98 ✅ (the error channel that motivated it).

### U86 — Inspector: a real `json` attribute control + validation feedback + stable section state

**Found by audit (08/2026).**
- `type: 'json'` attributes (camera `chips`, lottie `map`, layout-app `items`, …) fall through to a **plain text input**; invalid JSON is written to the attribute silently. And where a `validator` rejects, the ONLY feedback is a red border (`.attr.invalid`) — no message, while the field keeps the rejected value.
- Remedy: a `json` control = the objectList editor's proven raw-fallback pattern (pretty-print on focus-out, parse check with an inline message line under the field, "fix it to get the editor" hint); a shared inline validation-message slot for every control (the red border gets a text); `validator` errors surface their string.
- **Section collapse state is discarded on every selection change** (`_initCollapsedSections` re-runs per selection) — remember the user's expand/collapse per element TYPE for the session.

### U98 — Palette colors in editor light mode ⚠️ needs refinement

**Reported (08/2026).** The element palette looks wrong in editor **light
mode** — the per-element `palette.color` values are designed against the dark
editor and are kept AS-IS there (dark mode is great and must not change). In
light mode the same colors read poorly, and some families break outright:
**e-ink tiles render dark text on a dark tile**. The tile background is the
raw `palette.color` ([feezal-palette.js](../www/src/feezal-palette.js),
`background-color: ${el.color}`) with a fixed text color — no contrast logic.

**Constraint:** NO second per-element color configuration — whatever the fix,
it derives from the existing single `palette.color`.

**Suggested directions (one global algorithm, no element changes):**
1. **Contrast-correct text (minimal):** keep the tile colors in both modes,
   but pick the label color per tile from the background's relative luminance
   (WCAG threshold → black/white text). Fixes dark-on-dark outright; light
   mode still shows the dark-designed palette, which may remain heavy.
2. **Pastelize for light mode (recommended candidate):** transform each color
   for light mode only — same hue, lifted lightness / reduced saturation
   (HSL/OKLCH transform) for the tile background, dark text; dark mode stays
   byte-identical. Family recognizability survives (hue is preserved), and
   one pure function covers every element incl. third-party packages.
3. **Accent instead of fill:** in light mode render neutral light tiles with
   the element color as an accent (left stripe / icon tint). Cleanest look,
   but changes the palette's visual language between modes.

**Open questions (the ⚠ part):** which direction (2 vs 3 — mock both against
the same palette page); exact transform numbers for 2 (must keep families
distinguishable — test with e-ink/tui/panel, the darkest sets); whether the
category header chips need the same treatment; contrast floor (WCAG AA for
the tile labels).

**Relates:** the editor dark-mode discipline (N43 — this is its light-mode
mirror), element-spec `palette.color` (docs note: color is authored against
the dark editor; light mode derives), U45 (palette/picker — same tiles).


### A39 — Docker-less install route: install script (system user, systemd service) — acquisition compared

**Requested (08/2026).** A first-class installation path WITHOUT Docker,
modeled on [she](https://github.com/hobbyquaker/she)'s `she --install`
(same maintainer): a script that creates a dedicated system user,
installs + enables a systemd unit, and keeps all persistent state in one
data directory.

**What the script sets up (route-independent):**
- **System user** `feezal` (no login shell, home = the data dir).
- **Data dir** `/var/lib/feezal/` owned by that user — sites, uploads,
  editor prefs, discovery cache; the existing `--data-dir` flag points
  there.
- **systemd unit** (`feezal.service`): runs the server as the `feezal`
  user, `WantedBy=multi-user.target`, restart-on-failure, hardening
  defaults (`NoNewPrivileges`, `ProtectSystem=strict` with data dir —
  AND the app dir, see below — writable, `PrivateTmp`); `enable --now`.
  Resolve an ABSOLUTE node path into `ExecStart` at install time (nvm
  paths change per version and break units).
- **Idempotent re-run** = the update path (existing user/unit/data
  untouched, deps refreshed, service restarted); `--uninstall` removes
  unit + user, KEEPING the data dir unless `--purge`.
- One `feezal --install` implementation shared by every acquisition
  route (the `feezal` bin exists in `@feezal/feezal-server`).

**Acquisition: `git clone` vs `npm install -g` — compared (08/2026):**

The discriminating feezal-specific fact: the editor's **runtime package
manager installs element/theme packages into the app's `wwwDir`**
(`pkgManager.installPackage({wwwDir, …})`, `server/src/routes/api.js`) and
the server discovers elements by scanning `www/node_modules/@feezal/` —
so the app tree must be WRITABLE by the service user at runtime, and its
node_modules layout must match what the scanner expects.

- **git clone (or release tarball) into a service-owned dir** — e.g.
  `/opt/feezal`, chowned to `feezal`:
  - ✅ the runtime package manager and element discovery work UNCHANGED
    (same workspace layout as dev/Docker);
  - ✅ the committed `package-lock.json` governs installs —
    `npm ci --ignore-scripts` per A34, exactly the CI/Docker posture;
  - ✅ trivial for contributors (patch, branch, PR from the install);
  - ⚠ needs git + a build, OR prebuilt assets: building `www/` needs
    devDeps and minutes on a Pi. Mitigation: install from a **release
    tag whose GitHub release asset carries the prebuilt `dist/`** (the
    script downloads the tarball; plain `git clone` of main stays the
    contributor route with build-on-install);
  - ⚠ weaker supply-chain story than npm (https + tag signatures vs.
    npm provenance/`npm audit signatures`) — acceptable given the
    lockfile still pins every dependency.
- **npm install -g @feezal/feezal-server (or npx)**:
  - ✅ versioned, provenance-attested tarballs (trusted publishing is
    already set up), no git/build on the target — `files` already ships
    `bin/ src/ dist/`;
  - ✅ rollback = `npm i -g @feezal/feezal-server@x.y.z`;
  - ❌ **the global tree is root-owned** — the runtime package manager
    cannot install into it; would need redirecting runtime installs to
    a dataDir packages location + a SECOND element-discovery search
    path (real engineering, touches server startup scanning, Vite
    resolution for the editor bundle, and the export pipeline);
  - ❌ **no lockfile applies to a global install** — npm resolves the
    published ranges fresh, breaking A34's "the lockfile is the pin"
    unless the package ships an `npm-shrinkwrap.json` (doable, adds a
    publish step that must stay in sync);
  - ⚠ hoisting: `@feezal/*` deps land as SIBLINGS of the server in the
    global tree, not under a `www/node_modules/` — the discovery scan
    and the editor's Vite-built import map assume the workspace layout.

**Suggestion (decide before building):** ship **v1 as the git/tarball
route** — it is what was requested, matches she, and requires ZERO
changes to the runtime package manager or discovery. Concretely:
`git clone` (contributors, build-on-install) OR the release-tarball
download with prebuilt `dist/` (end users, no toolchain), both followed
by `sudo node server/bin/feezal.js --install`. Treat the npm-global
route as a **follow-up item** gated on redirecting runtime element
installs to the data dir (which would ALSO benefit Docker: image stays
immutable, installed packages survive image updates) — file that
separately if wanted.

**Docs:** README install section gains the route beside Docker;
TESTING.md gets a fresh-VM checklist (install → service up → editor
reachable → runtime element install works → update run → uninstall
keeps data).

**Relates:** A34 (dependency policy — `npm ci --ignore-scripts`,
lockfile-as-pin), the Docker image (same data-dir contract; would gain
from dataDir-redirected runtime installs), the editor package manager
(`/api/elements` install route), server `--data-dir`.


### U110 — layout-app: per-sub-view element search (E170 shape B)

**Split from E170 (08/2026)** when shape A (the `*-search` element
family) shipped. A per-sub-view **"search" checkbox in the layout-app
entries manager**: enabled views render a search field in the app chrome
(under the top bar / above the content) that filters the EMBEDDED view's
elements. MUST reuse the shipped engine
(`@feezal/feezal-element/feezal-search-filter.js` —
`applySearchFilter`/`FeezalSearchBase` semantics: label+href matching,
`feezal-search-hidden` attribute, warm subscriptions, viewer-only), not
fork it. Field styling follows the app chrome (bar colours); × + Escape
clear; the U103 embedded clone is the filter target
(`#content`'s active `feezal-view` clone). Distinct from U108 (drawer
search filters NAV ENTRIES; this filters the embedded view's ELEMENTS).

**Relates:** E170 (shipped engine + elements), U108 (drawer-entry
search), U103 (embedded clones), layout-app entries manager.


### U112 — Element-family-wide settings (e.g. all glass transparency) ⚠ idea, needs refinement + decision

**Requested (08/2026).** Set certain styles ONCE for a whole element
family — the driving example: the transparency/blur of every `glass-*`
backdrop — instead of per element. Reporter asks: can CSS vars carry
this, and what UI concept (a new right-sidebar tab?) fits.

**Can CSS vars handle it? YES, for the style class of settings — the
plumbing already exists.** Every glass knob defaults through the family
tokens (`--feezal-glass-tint/-blur/-radius/-border/-margin/…`), custom
properties inherit through shadow boundaries, and the cascade already
layers exactly right: element inline knob (style inspector) → wins over
a family-scope value → wins over the theme's value → wins over the
base default. Defining the tokens at SITE scope (inline `style` on
`<feezal-site>`, or a rule in the U25 `feezal-classes` style block —
both serialize with the site, so deploy/export/embedded layout-app
clones all inherit them for free) is the whole runtime mechanism. What
is missing is UI + a curated token list per family.

**UI options (pick one at refinement):**
1. **Family sections in the existing Theme tab.** The themes sidebar
   already persists `themeOverrides` on top of the picked theme —
   extend it with per-family sections (Glass / Metro / Eink / Circle …)
   listing each family's curated tokens with the standard colour/value
   knobs. + Reuses persistence and mental model ("theme, then my
   overrides"); no new tab in an already dense sidebar (U93/U100).
   − Conflates theme picking with family styling; long tab.
2. **New right-sidebar "Families" tab.** One section per INSTALLED
   family. + Dedicated, discoverable, scales to third-party families.
   − New tab in a crowded sidebar; needs a family-manifest concept
   (see caveats) before it can render anything.
3. **"Apply to family" from the element style inspector.** A small
   scope menu on family-token rows: "set for all glass elements" writes
   the value to the site scope instead of the element. + Zero new
   surface, discovered exactly where the need arises. − Scope confusion
   unless the row clearly shows WHERE the effective value comes from
   (element / family / theme) — which would itself be a nice addition
   (an origin badge), but is real work.
Hybrid 1+3 is plausible (the tab as the home, the row menu as the
shortcut).

**Caveats / downsides (why this needs a decision round):**
- **Curated token lists per family:** dumping every element knob
  family-wide is noise; each family needs a short curated list (blur,
  tint, radius, label colours …). Where does it live? Suggestion: the
  family chrome package exports it (`@feezal/feezal-glass` →
  `familyStyleTokens`), falling back to intersecting the family
  elements' style descriptors — defines the manifest for third-party
  families too.
- **Per-view themes win by proximity:** vars set on a view (per-view
  theme, U51) shadow site-scope family values — layering must be
  documented (site-level family override sits between site theme and
  per-view theme, NOT above the view). Per-view family overrides are a
  possible later extension.
- **Attribute-type settings are NOT CSS-able:** family-wide `degrade`
  (the obvious wall-tablet wish, also E171's popup knobs) toggles
  rendering paths via host attributes — a var cannot express it. Bulk
  attribute stamping is destructive (kills per-element opt-outs).
  Direction if wanted: elements read a family DEFAULT from a site
  attribute (e.g. `<feezal-site glass-degrade>`) with the element
  attribute overriding — file separately once the style story ships;
  v1 = CSS vars only.
- **Perf framing:** the driving example (backdrop transparency/blur)
  is exactly the GPU-cost family (B61, degrade) — a family-wide blur
  reduction is likely to be used as a performance knob, worth saying so
  in its help text.
- Theme-var discipline applies unchanged (canonical vars bare, no new
  fallback chains).

**Relates:** themes sidebar (`themeOverrides` — the existing override
layer), U25 (site style block), U51 (per-view themes / proximity),
B61 + `degrade` (perf motivation), E171 (family-wide popup knobs would
ride the same concept), theme-var discipline test.


### U113 — Scripting ergonomics: `feezal-id`, scoped lookup, value/event contract — decided

**Requested + decided (08/2026).** Use case: two input elements + a
button; pressing the button runs a script action. Possible today via
`system-script` (`fzl` API) or a template `<script>`, but reading an
input means shadow-root spelunking and elements have nothing to be found
by. Decisions with the maintainer:

1. **A dedicated `feezal-id` attribute** (NOT the HTML global `id` — no
   `getElementById`/CSS-`#` collision semantics to explain), one identity
   shared by scripting (`fzl.el()`), E178 system-form field keys,
   and the UI. Injected into the generic attributes inspector for every
   element, like the `locked` checkbox — zero per-element descriptor
   work; serializes as a plain attribute.
2. **Shown in the layers view** — the tree row displays the `feezal-id`
   next to the element tag/label (helpful for plain editing, not just
   scripts).
3. **Source-view priority:** `feezal-id` sorts FIRST on the opening-tag
   line — extend the U92/U96 identifying-attribute serialization order
   (`feezal-id` before `label`/`subscribe`/`icon`/…), so a folded
   element leads with its identity.
4. **Scoped lookup API:** `fzl.el(feezalId)` / `fzl.val(feezalId)` /
   `fzl.on(feezalId, event, cb)` — `val`, not `value`: short like `el`
   and `on` (maintainer preference) — resolving the VISIBLE occurrence first
   (layout-app keeps warm clones of visited sub-views, N40, and U32
   component instances stamp copies — global uniqueness is a lie; the
   API defines resolution: visible first, then document order). The
   inspector may warn on duplicates within one authored view.
5. **Public element contract, curated list first** (material/carbon
   input, select, slider, checkbox, radio, switch; the *-button
   families): a `.value` getter (setter where sensible) + composed,
   bubbling `feezal-change` / `feezal-press` events that escape the
   shadow root. Input elements additionally re-dispatch the low-level
   editing events as composed `feezal-blur` / `feezal-keyup` /
   `feezal-keydown` (detail carries key + value), so scripts can do
   live validation, Enter-to-submit and typeahead without shadow-root
   reach-ins — `fzl.on(id, 'keydown', cb)` maps the short event names
   onto the prefixed ones. Documented in docs/element-spec.md; a
   parity-style test pins the contract. This contract is a PREREQUISITE
   of E178.
6. **Cookbook docs:** collect-and-publish-one-JSON via `fzl.mqtt.pub`
   first (pure-MQTT doctrine), webhook `fetch` as the escape hatch with
   the A28 `connect-src` note, button-triggered view switch.

**Caveats (unchanged):** id resolution is semantics-by-definition, not
uniqueness (clones/instances); CSP for webhook fetches (A28); every
contract element freezes public surface — curate, don't blanket all
~170.

**Relates:** E178 (system-form — consumes feezal-id + the
contract), system-script (`fzl` API), N40/U32 (duplication sources),
U92/U96 (source attribute order), A28 (CSP), docs/element-spec.md.


### E172 — Theme: Catppuccin (pastel, 4 flavors)
**From the SmartHomeScene 2023 HA-theme survey (08/2026)** — the survey
anchor: siblings E173 (Nord), E174 (Graphite), E175 (LCARS),
E176 (Material You), E177 (Soft UI). Skipped as covered/derivative:
visionOS (≈ `feezal-theme-glass`), Metrology (≈ `feezal-theme-metro` +
family), iOS/macOS (glass overlap), Google theme (folded into E176),
Caule/Waves/Slate/Your-Name (color-pack/derivative, no distinct design
language).

Port the **Catppuccin** pastel palette
([catppuccin/home-assistant](https://github.com/catppuccin/home-assistant),
**MIT**; the palette spec itself is catppuccin/catppuccin, MIT). Four
flavors — Latte (light), Frappé, Macchiato, Mocha (dark). Ship **Latte +
Mocha first** as `feezal-theme-catppuccin-latte` / `-mocha` (one package
per theme, like solarized-light/-dark); Frappé/Macchiato later if wanted.
Mapping: base/mantle → backgrounds, surface0/1 → secondary bg + divider,
text/subtext → text colours, blue → `--primary-color`, mauve → accent,
red/yellow/green/sky → error/warning/success/info; tune the glass tint
tokens to the pastel mood. Attribute the palette in the package README.


### E173 — Theme: Nord (arctic palette, dark + light)
**From the E172 survey.** Port the **Nord** palette — the missing third
of the classic developer-palette set beside the existing gruvbox and
solarized pairs. Reference implementation:
[coltondick/nordic-theme-main](https://github.com/coltondick/nordic-theme-main)
(**Apache-2.0**); the palette itself is `nordtheme/nord` (**MIT**) — map
from the palette spec directly, credit both. `feezal-theme-nord` (dark:
polar-night nord0–3 backgrounds, snow-storm nord4–6 text, frost nord8 as
`--primary-color`) + `feezal-theme-nord-light` (snow-storm ground,
polar-night text); aurora nord11/13/14/8 → error/warning/success/info.


### E174 — Theme: Graphite (calm neutral dark)
**From the E172 survey.** Port **Graphite**
([TilmanGriesel/graphite](https://github.com/TilmanGriesel/graphite),
**MIT**) — a calm, LOW-SATURATION neutral-gray dark theme with muted
accents. Distinct from every existing feezal dark: midnight-blue and
blue-night are blue-tinted, dark-mint/dark-orange are accent-led;
feezal has no neutral graphite dark. Upstream also carries a light
variant — check it when porting and ship `feezal-theme-graphite`
(+ `-light` if the upstream light holds up). Credit upstream.


### E175 — Theme: LCARS (Star Trek bridge computer) ⚠ trade-dress check first
**From the E172 survey.** An **LCARS** look
([th3jesta/ha-lcars](https://github.com/th3jesta/ha-lcars), repo **MIT**,
fonts/colours from thelcars.com) — black ground, orange/salmon/lavender
pill shapes, the iconic elbow frames. Two blockers to resolve BEFORE
building:
1. **Trade dress / trademark:** the repo is MIT but the LCARS design
   language and the term are associated with CBS/Paramount (trademark
   registrations exist; fan use is widely tolerated but NOT licensed).
   Decide: ship as a clearly fan-made homage under a non-infringing
   package name, or drop. Legal-comfort call for the maintainer — the
   MIT label on a fan repo does not settle it.
2. **Scope:** LCARS lives on SHAPES (elbows, pill nav, segmented bars),
   not just colours — a var-only feezal theme gets the palette +
   typography but not the frames. v1 = palette/typography theme; the
   full look would need theme CSS on the app-shell chrome or a
   dedicated family (out of scope here; relates U112 family tokens).


### E176 — Theme: Material You / MD3 baseline (light + dark)
**From the E172 survey.** feezal ships a **Material element family**
(MD3 controls) but NO matching theme — the palette gap shows (U98).
Build `feezal-theme-material-light`/`-dark` from the **MD3 baseline**
color roles. References:
[Nerwyn/material-rounded-theme](https://github.com/Nerwyn/material-rounded-theme)
(**Apache-2.0**) and JuanMTech/google-theme; the MD3 baseline tokens
themselves are published by Google under Apache-2.0. Map the MD3 roles
ONTO the canonical feezal set (surface/on-surface → backgrounds/text,
primary → `--primary-color`, tertiary → accent, error → error) — the
theme DEFINES canonical vars; the no-`--md-sys-color-*`-defaults rule
for elements is untouched. Dynamic color (wallpaper-derived Material
You) is explicitly out of scope — static baseline only.


### E177 — Theme: Soft UI / neumorphism ⚠ needs a shadow token
**From the E172 survey.** Port the **Soft UI** look
([KTibow/lovelace-soft-theme](https://github.com/KTibow/lovelace-soft-theme),
**MIT**) — near-monochrome ground where cards read as EXTRUDED via paired
light/dark soft shadows (neumorphism). Caveat that makes this more than
a palette: the signature is the SHADOW, and feezal themes can only set
variables — the families' card shadows are currently hardcoded (glass:
`box-shadow: 0 8px 24px …`). Either (a) ship palette-only (loses the
point), or (b) first add a `--feezal-*-shadow` token to the family card
chromes (small, U112-adjacent change) so the theme can express the
double soft shadow. Recommend (b) — decide together with U112's
family-token manifest. Light + dark variants.


### E178 — system-form: a subview as a web form (decided core, script API to refine)

**Requested + core decided (08/2026).** A `system-form` element that
embeds a SUBVIEW (the dialog-view/layout-view clone machinery, N40
keep-warm semantics) and turns it into a form: every member element
carrying a **`feezal-id`** and the U113 **`.value` contract**
automatically becomes a field — the payload is
`{<feezal-id>: <value>, …}`. Elements without a `feezal-id` are not
part of the payload (explicit opt-in). U113 is the prerequisite.

**Decisions taken:**
- **Field keys = `feezal-id`** (one identity across scripting, forms,
  layers view — see U113).
- **Submit = BOTH:** a designated member button — suggestion: the form's
  `submit-id` attribute names the trigger's `feezal-id`, default
  `submit`, listening for its composed `feezal-press` (no per-family
  button knob needed) — and when NO member matches, the form renders its
  own plain submit button (label knob) under the embedded view.
- **Always a script**, Monaco-edited like system-script, PREFILLED with
  a small transparent default that collects all values and publishes one
  JSON to the configured topic. Validation = edit the script (return
  false / don't publish); webhook = replace the publish with fetch (A28
  `connect-src` note in the help).
- **Member publishing untouched:** the form only READS values; members
  with their own `publish` topics keep publishing per change — leave a
  member's publish topic empty to keep it quiet. No suppression magic.

**Script context API (suggestions — refine before building):** the form
script gets the `fzl` API plus a `form` object:
- `form.values()` → `{feezalId: value}` over the embedded view;
- `form.topic` → the form's `publish` attribute (the requested
  `fzl.attr('topic')` shortcut, but typed: `form.attr(name)` exists as
  the general accessor, `form.topic` is the sugar for the 90% case);
- `form.publish(obj = form.values())` → one-liner JSON publish to
  `form.topic`;
- `form.reset()` → clear/restore member values (needs the contract's
  setter side);
- default script (the prefill):
  `fzl.mqtt.pub(form.topic, form.values());`
  — or even `form.publish();` — decide which reads better as the
  learning template (leaning to the explicit `fzl.mqtt.pub` form: it
  teaches the general API, and `form.publish()` stays the shortcut).

**Editor:** placeholder like the other system pseudo-elements (never a
live embed on canvas); view picker for the subview (B128 space-safety);
Monaco script tab; TESTING.md recipe with the two cookbook flows (JSON
publish; webhook fetch).

**Relates:** U113 (prerequisite: feezal-id + value/event contract),
system-script (`fzl`, Monaco), N40 (embedded clone), B128 (view
picker), A28 (CSP for fetch), E50 (conditions on form members work
unchanged).


### E179 — Theme: Industrial Copper (warm metallic dark)

**Requested (08/2026).** A luxury warm-metallic dark theme — copper and
bronze on deep charcoal. Inspiration: the German HA community's
`industrial_copper` theme
([simon42 forum thread, post #7](https://community.simon42.com/t/luxus-home-assistant-dashboard-wie-auf-dem-bild-umsetzbar/89304/7)
by user Mercator; credit the thread in the package README — the palette
values themselves are not copyrightable, the CSS technique is
re-implemented, not copied).

**Palette (from the thread):** copper accents `#D4924A` / `#E8B86A`,
warm gold text `#EDD8A8`, deep warm charcoal ground
`rgba(38,32,24,0.97)`. Mapping: charcoal → backgrounds (secondary a
step lighter/warmer), gold text → `--primary-text-color` (muted variant
→ secondary), copper `#D4924A` → `--primary-color`, `#E8B86A` → accent;
error/warning/success tuned WARM so they sit in the metal palette
(brick red, amber, olive-gold green) rather than stock RGB.

**The metallic signature (and its scope caveat):** the thread's luxury
look is layered CSS on the cards — a warm dark gradient base,
horizontal brushed-metal strokes via `repeating-linear-gradient`, and a
multi-stage `box-shadow` bevel (bright gold hairline top, dark shadow
line bottom) with a `1px solid rgba(210,155,65,0.65)` border. Like E177
(Soft UI), that exceeds a var-only feezal theme: v1 ships the PALETTE
(already distinctive — no warm-metal theme exists; dark-orange is the
closest and is flat accent-led, not metallic). The bevel/brushed
texture needs the E177/U112 family shadow-and-surface tokens — when
those land, this theme is the second consumer (gradient card surface +
bevel shadow + hairline border tokens). Decide then whether the glass
family's tint token can carry the gradient stack or a dedicated
`--feezal-*-card-surface` token is cleaner.

**Relates:** E177 (Soft UI — same "the signature is beyond a palette"
class, shared token need), U112 (family tokens), E172–E176 (theme
survey siblings), dark-orange theme (nearest existing, for contrast in
the docs).


### A36 — Server API layer: decompose the monolith, one error contract, bounded caches

**Found by audit (08/2026).** `routes/api.js` is a 1145-line factory with 56 routes and 8 concerns; `app.js` mixes 8 more in one 470-line function. Beyond size, the audit found systemic issues to fix WITH the split (each trivial in a decomposed layer, invasive without):
- **asyncHandler + error middleware**: 33 hand-copied try/catch envelopes, 9 dataDir guards, **and 5 async routes with NO try/catch** — an fs error there is an unhandled rejection that kills the process (Express 4). No `(err,req,res,next)` middleware exists anywhere, so fall-through errors render stack traces (NODE_ENV is never set). One wrapper + one terminal handler + a `requireDataDir` middleware removes ~150 lines and the crash class.
- **One error envelope** (5 shapes coexist today).
- **Route split** by the audit's table (sites/assets/ai/discovery/themes/packages/history/export/apk/admin/pwa-icons); extract the 260-line `viewerHandler` into a pure `renderViewerPage()` (directly unit-testable — app.js sits at 62 % coverage precisely because of it).
- **Bounded caches**: export `_bundleCache` (holds whole minified bundles, never evicted, stale after package installs — clear from `emitElementsChanged` + LRU cap), hub message cache + bridge topic trie (unbounded on busy brokers; the `lastPayloads` LRU pattern exists to copy), CSP violation site-map (publicly writable keys — record only known sites, LRU).
- **Sync fs off request paths**: element discovery re-scans synchronously on every editor load AND every viewer render (`elements.js:236-282`); pwa.js does 5-10 sync calls per manifest/sw/icon request. Cache with `emitElementsChanged` + mtime invalidation (the `icons.js` pattern).
- **Misc**: one exec wrapper (git's has NO timeout/maxBuffer — a long history can hang a request), `fetchWithTimeout` for registry/AI calls (currently unbounded fan-out, one fetch per installed package), a `readJson/writeJson` util (14 divergent read-modify-write sites; the prefs PUT is a lost-update race), fixed temp entry file in export (two concurrent exports corrupt each other — mkdtemp or a virtual module; also read-only in Docker).

**Ships with:** the split + middlewares + envelope, caches bounded, sync-fs promoted/cached, exec/fetch/json utils adopted, coverage rising as a side effect (each extracted module is unit-testable).

### A37 — Editor front-end: extract the four buried subsystems

**Found by audit (08/2026).** `feezal-app-editor.js` (3667 lines) and `feezal-sidebar-inspector.js` (2350) each hide complete subsystems that are separable with no behavior change:
- Out of app-editor: ✅ the **view folder tree** model (done — `feezal-view-folders.js`; `_reconcile` lost its `feezal.views` global and `_applyDrop` became tree-in/tree-or-null-out, so the existing suites call the model directly and 14 new tests cover helpers that were previously only reachable by driving the tab bar). Still open: the **component system** (~380), **source/Monaco mode** (~215), clipboard handlers.
- Out of sidebar-inspector: ✅ the module-scope **canvas geometry helpers** (done — moved to `feezal-canvas-geometry.js`: `isCanvasElement`, the U33 stacking model and the B80 geometry hand-off, ~140 lines, importers re-pointed), the **canvas interaction engine** (interact.js wiring + the rubber band; A38 already lifted the marquee out into `feezal-canvas-rubberband.js`, so this is materially smaller than the ~1000 lines originally scoped), the **context menu**, the **switch-family migration**.
- Mechanical rule: extraction only, no rewrites; each move lands with its existing tests re-pointed and a browser smoke.

**Progress note (08/2026).** Two moves landed: the canvas geometry helpers and the folder tree. Both were *pure models* — array/DOM in, value out — which is why they extracted cleanly and gained tests as a side effect.

**The remaining pieces are a different kind of work, and scoping them as "extraction" undersells them.** The component system, source/Monaco mode and the clipboard handlers are component *orchestration*: they touch `this` state, dialogs, `feezal.site` and the render template (source mode alone gates ~15 places in `render()`). Moving them means introducing controller objects that hold a reference back to the editor — a legitimate design, but a refactor with real regression surface, not a cut-and-paste. Worth doing deliberately rather than opportunistically: A38 is the cautionary example — a change that looked like a pure removal broke seven e2e tests through a layout invariant no one had written down.

**Relates:** N42 (querySelector caching lands naturally during extraction), A36 (the server twin).
