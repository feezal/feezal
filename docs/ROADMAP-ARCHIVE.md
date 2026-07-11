# Implemented and archived Items of ROADMAP.md

## Bugs

### B16 — Retained-topic replay cache evicted by live updates ✅ fixed

Elements sometimes got no payload on frontend connect even though their topics are *always published retained*. Root cause chain in `server/src/socket/hub.js`: the replay cache evicted a topic whenever a message arrived with `retain=false` — but per **[MQTT-3.3.1-9] the broker strips the RETAIN flag on every delivery to an established subscription**, regardless of how the publisher set it. `retain=1` only ever marks the stored-retained replay right after subscribing. So the first state update after server start (published retained!) arrived as `retain=0` and evicted the topic; the busier the topic, the more reliably its replay was missing. **Fix — known-retained last-value cache:** a topic ever delivered with `retain=1` (i.e. provably in the broker's retained store) stays cached; every later message refreshes the cached payload (replay is always the last value); only an **empty payload** evicts (the MQTT retained-clear convention — its live delivery also arrives as `retain=0` + empty, previously mis-cached as an empty replay). Topics never seen retained (commands, `reload`) are never cached — the anti-command-replay guarantee is unchanged. Covered by 4 hub unit tests + a full-chain aedes integration test reproducing the exact scenario (retained store predates server start → live retained update → late frontend still gets the fresh replay).

**Residual gap (documented, → N9):** topics whose *first* retained publish happens *after* the feezal server started are never seen with `retain=1` (the bridge's `#` subscription is already established), so they don't enter the replay cache until the next server restart/reconnect. Detecting publisher retain on live deliveries requires MQTT 5 *Retain As Published* subscriptions — belongs to N9 (protocol version).

**Second layer (found while verifying, ✅ fixed):** with the replay working, editor elements *still* missed retained state ~50/50 per page load. `feezal-connection-feezal` dispatched its `connected` event `bubbles + composed` from inside the wrapper's shadow root — the event crossed the shadow boundary and fired on the wrapper host *in addition to* the wrapper's own re-dispatch, so `getSite`/`loadViews` ran **twice**, every element was built twice, and the hub replay raced the second generation. The backend event is no longer composed (the wrapper's re-dispatch is the single public `connected`); the hub also gained the previously missing `unsubscribe` handler (per-socket subscription sets grew stale). E2E `editor-replay.test.js` loads the editor three times against a broker with pre-existing retained state and asserts elements reflect it every time, with exactly one element generation.

### B25 — dialog elements: inconsistent header/close bar — unify + make it configurable ✅ fixed

`material-dialog-view` always showed a header bar (title + top-right ✕, gated by `show-close`), while `material-dialog` only rendered a title-text-only header when `title` was set — no ✕, no `show-close`. **Fixed** — same header contract on both:

- **material-dialog 1.1.2:** ported the dialog-view header — shared `_headerTemplate()` (inline-styles variant for the portal, class variant for the editor preview) with title + top-right ✕ wired to `_close()`; new `show-close` attribute (default `true`, parity with dialog-view); `.dialog-header`/`.dialog-close` CSS added.
- **Both elements:** new **`hide-header`** boolean (default `false`) hides the bar entirely, regardless of `title`/`show-close`. *Deliberately inverted from the planned `show-header`:* Lit reflects constructor defaults, so a default-true boolean can never persist its "off" state across save/reload (absent attribute → constructor `true` again) — a default-false `hide-header` survives. Precedence: `hide-header` wins; otherwise the bar shows when `title` or `show-close`.
- **Live sync:** property changes while a dialog is open (title / show-close / hide-header / sizing / a new message's template) now re-render the open portal — previously the portal only rendered on open/close. (dialog-view re-renders chrome only; the imperative view clone is untouched.)
- Inspector checkbox rows for the new attributes on both elements; 6 unit tests (default ✕ parity, ✕ closes, no-header combinations, hide-header on both, live update); TESTING.md header-parity bullet. dialog-view 1.0.2.

### B24 — dialog elements: no min-height / height attribute — dialog collapses to ~50px ✅ fixed

Both dialog elements exposed only `width` / `max-height`, so a dialog with little content collapsed to ~50px with no way to raise the floor. **Fixed** — `height` and `min-height` convenience attributes on both, empty preserves auto sizing:

- **material-dialog-view 1.0.1:** attributes → `--feezal-dialog-view-height` / new `--feezal-dialog-view-min-height` tokens (descriptor, `SIZE_TOKENS`, reflected properties, portal `style.setProperty`, panel CSS in shadow preview + portal, inspector Layout rows).
- **material-dialog 1.1.1:** `height:` / `min-height:` appended to both `panelStyle` builders (portal + editor preview), descriptor + reflected properties, inspector Layout rows.
- Covered by 4 unit tests (explicit sizing reaches the portal panel/tokens; empty keeps auto), TESTING.md dialog-sizing bullet.

### B23 — basic-navigation: active-view highlight not synced with actual active view ✅ fixed

The element highlighted the wrong (or no) view on first load, and never followed view switches made by anything else (URL hash, `material-navbar`, programmatic navigation) — it only tracked its own clicks, via a custom `view-changed` event that only it dispatched. **Fixed** (`@feezal/feezal-element-basic-navigation` 1.0.1) by porting material-navbar's (E46) proven mechanism: the active view is read from `feezal-site`'s reflected `view` attribute and followed via a **MutationObserver** (`attributeFilter: ['view']`), with a `firstUpdated` late-attach for the case where `feezal.site` only becomes available after connect. `_navigate` now sets the reflected `feezal.site.view` property (drives `updateVisibility` + hash sync) instead of `setAttribute` + custom event; the `view-changed` event had no other listeners and is gone. Covered by 4 unit tests (initial highlight, external switch, late view, click navigation).

### B22 — material-select: right border hidden when element width is below ~210px ✅ fixed

`md-outlined-select` ships `:host{min-width:210px}` — below that element width the inner control kept its intrinsic minimum, overflowed the host and the right border was clipped. **Fixed** (`@feezal/feezal-element-material-select` 1.1.1): `min-inline-size: 0` on the inner `md-outlined-select` (outer shadow rule beats the `:host` default), so the control shrinks with the element at any width — same pattern as the slider's `min-inline-size: 0` (E38).

### B21 — Active view-tab underline sits above the tab-bar/canvas separator border ✅ fixed

The active tab's blue underline was an `inset box-shadow` inside the 39px tab, while the bar drew its 2px separator as a `border-bottom` *below* the tabs — so the underline sat 2px above the separator instead of coinciding with it. **Fixed** in `feezal-app-editor.js`: the separator is now an inset shadow on `#view-tabs` (drawn *behind* the tabs), tabs are 41px with a 2px transparent `border-bottom` occupying the same rows, and the active tab (and `folder.contains-active`) colours that border — the underline sits exactly ON the separator, material-style. `background-clip: padding-box` keeps hover/folder backgrounds out of the border area so the separator stays visible under them; the `drop-end` hint and dark mode carry the separator in their composite shadows. Total bar height unchanged (41px).

### B20 — New element dropped from palette does not snap until re-dragged ✅ fixed

The palette drag created the new element and moved it by raw `dx`/`dy` — no snap anywhere; only a subsequent re-drag (interact.js snap modifier on the element) snapped. **Fixed** in `feezal-palette.js`: the palette drag now tracks the raw, unsnapped position (`_dragPos`, view-local px, so snapping never accumulates into the drag delta), sets `feezal.editor.dragElement` for the duration of the drag, and routes every position through the inspector's `_snap()` (`_applySnappedPos()`), applying the returned target within its range per axis. The initial drop therefore snaps exactly like a re-drag — grid **and** element-edge snapping, including the guide lines, which are hidden again on drop.

**Follow-up (same root cause, fixed):** the palette drag also lacked the view-bounds **restrict** a regular element drag has (interact `restrict` modifier in `initAbsolute`) — the new element could be dragged outside the view/viewport and only stopped at the borders after drop + re-drag. `_applySnappedPos()` now clamps the displayed position to the view rect (incl. the 1px bottom reserve against a spurious scrollbar); the raw `_dragPos` stays unclamped so the drag-back-to-palette **cancel gesture** (`x + width < 0` in `onend`) keeps working — the cancel check now reads the raw position instead of the clamped style. Covered by 4 unit tests.

### B19 — Server crash on `send` with undefined topic (unguarded `bridge.publish`) ✅ fixed

A `send` message with an undefined `topic` reached `bridge.publish`, which passed it straight to `client.publish(undefined, …)` — mqtt.js throws synchronously inside `_removeTopicAliasAndRecoverTopicName` (`Cannot read properties of undefined (reading 'toString')`) and the whole server process crashed. A malformed `send` from any client could take down the server.

**Fixed (defense in depth):**
- `bridge.publish` (`server/src/mqtt/bridge.js`) bails out (warn + return) unless `message.topic` is a non-empty string.
- The `send` handler (`server/src/socket/hub.js`) drops malformed messages before `insertTopic`/`updateCache`/echo run.
- Same crash class closed in `subscribe`/`unsubscribe`: non-array payloads are ignored, non-string topic entries filtered.
- Regression tests in `hub.test.js` (server survives a malformed-send barrage and still processes valid sends) and `bridge.test.js` (`publish()` never throws on invalid topics).

**Open follow-up:** *why* the editor emitted `send` with an undefined topic in the first place (the upstream trigger) was not reproduced — if it reappears, the server now logs `hub: ignoring send without topic` with the client address instead of dying.

### B18 — White line between canvas and view-tab-bar after deleting an element ✅ fixed

Two coupled defects in the editor's element-delete path (`_deleteElems()` in `www/src/feezal-sidebar-inspector.js`):

1. **White line:** the editor gives `feezal-site` `tabindex=1` and focuses it programmatically (keyboard shortcuts / element selection). The browser's **default focus ring** then draws along the canvas edges — visible as a white line between the tab bar and the canvas, most obviously after deleting an element (the site keeps focus while nothing is selected, so the ring is no longer read as "selection"). **Fixed:** `feezal-site:focus { outline: none }` in the editor's injected site stylesheet — the focus is a programmatic shortcut target, not tab-navigation.
2. **Empty selection:** `_deleteElems()` set `selectedElems = []`, leaving the inspector blank. **Fixed:** after deletion the active view is selected (`selectElement(null)` — same path as a click on empty canvas), and the deleted elements are also dropped from DragSelect's selection/selectables sets (stale node references). Bonus: the view-selected tab tint (`--tab-active-color`) was dead — it targeted the pre-U8 `#tabs` id and the CSS var had lost its consumer; both repaired (`#view-tabs`, `.ftab.view.active` colour).

### B17 — Slider elements unusable with sub-integer value ranges (Homematic 0–1) ✅ fixed

Root-cause analysis July 2026 (Homematic dimmer, `LEVEL` datapoint 0–1). Sibling of the material-light publish-rounding fix that shipped in `@feezal/feezal-element-material-light` 1.1.1 (`pctToRaw` — publish granularity follows the configured brightness range). The same integer-grained assumption remained in both slider elements:

- **material-slider — `step` defaulted to `1`:** with `min=0` / `max=1` the underlying `md-slider` had exactly two valid positions. **Fixed** (1.0.7): when `step` is not explicitly set, the default is derived from the range — `(max − min) / 100` (`deriveStep()`, unit-tested) — so the default 0–100 range keeps step 1 and a 0–1 range gets 0.01; an explicit `step` attribute wins; empty/0/invalid counts as unset.
- **paper-slider — no `step` at all:** the element didn't expose `step`, and `paper-slider`'s internal default is also `1`. **Fixed** (1.0.2): `step` attribute exposed (default `1` for back-compat) and passed through to the inner `paper-slider`.

**Relates:** E77 (light element, same Homematic 0–1 motivation), material-light 1.1.1 (`pctToRaw`, the shipped third leg of this analysis).

### B14 — Editor grid: vertical lines ignore the grid colour, and the grid is offset by the toolbar ✅ fixed

Two defects in the editor grid overlay (`_gridSizeChanged()` in `www/src/feezal-sidebar-inspector.js`):

1. **Vertical lines ignored `gridColor`** — the horizontal gradient ended on `gridColor` but the vertical `-90deg` gradient hardcoded both stops to `rgba(0,0,0,0.1)`, so vertical lines were always a fixed faint black. **Fix:** replaced the two `repeating-linear-gradient`s with a standard two-axis grid — `linear-gradient(to right, gridColor 1px, transparent 1px)` + `linear-gradient(to bottom, …)` at `background-size: gridSize` — so both axes draw a clean 1px line in the configured colour.
2. **Grid offset / phase** — `#grid` used a hardcoded `top: 35px` (~6px short of the real tab-bar height, so it sat on the tab bar), and the old bottom-anchored gradient never put a line at the origin. **Fix:** `_positionGrid()` overlays the grid on the measured canvas viewport (`feezal-site` rect relative to `#container-view`) and sets `background-position` to the active view's `0,0` origin (mod grid size), so the first line coincides with the view's top-left even with a view margin/scroll offset. A `ResizeObserver` on the canvas keeps it aligned on window/sidebar resize.

### B15 — Copy-on-use of global assets: stale `src` + duplicate copies ✅ fixed

Two bugs in the A14 **copy-on-use** flow (dragging a global asset onto a view copies it into the site's `assets/` and repoints the element's `src`).

1. **`src` not reflected on the first drop / inspector shows the old value.** `_localiseGlobalAsset()` (`www/src/feezal-sidebar-assets.js`) sets `src` *asynchronously* once the server responds, but the attribute inspector only re-reads on selection change — so the field stayed on the old `/assets/global/…` value. **Fixed** by nudging the inspector to re-read after the async `src` update (`insp.selectedElems = [...insp.selectedElems]`).
2. **Re-dragging the same global file made duplicate copies (`-1`, `-2`, …).** `copyAssetUnique()` (`server/src/storage/filesystem.js`) unconditionally suffixed when the name was taken. **Fixed** with content-dedup: (a) name free → copy; (b) name taken + byte-identical → reuse, no copy; (c) name taken + different → suffix. Identity is checked by size first, then a streamed byte compare (`_filesEqual`). Covered by a storage-suite test.

### B10 — Asset Manager not functional

The Asset Manager sidebar (`feezal-sidebar-assets.js`) has multiple bugs that need concrete reproduction steps before fixing. Needs investigation with specific bug reports.

### B11 — History preview ignores historical theme ✅ fixed
When previewing a past commit, the current theme was always applied because `getSiteAtVersion()` only fetched `views.html`, not `viewer.json`. Fixed by extending `getSiteAtVersion()` to also `git show sha:viewer.json` and returning the historical config. The viewer route now uses the historical `viewerConfig` (theme, themeOverrides, classes) for `?sha=` previews while still using the current connection config.

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

### B12 — `material-map` rendering broken ✅ fixed

Two distinct bugs on `feezal-element-material-map`:

1. **Tile invisibility:** two of the four map quadrant tiles are invisible. The map renders as a 2×2 grid but half the tiles have no visible content. Likely a CSS `overflow`/`clip` or `z-index` issue in the tile container, or an incorrect tile URL construction for those quadrants.

2. **OwnTracks marker not shown:** when OwnTracks mode is configured (prefix set to e.g. `owntracks`), the location pin is not rendered despite a valid location payload arriving. Confirmed example: topic `owntracks/basti/iphone7`, payload:
   ```json
   {"_type":"location","acc":14,"alt":425,"batt":85,"lat":48.740668,"lon":9.177687,"tst":1782583402}
   ```
   The element receives the message but no marker is placed on the map.

### B13 — `material-fab` icon not rendering; theme color CSS var has no effect ✅ fixed

Two bugs on `feezal-element-material-fab`:

1. **Icon not showing** — the render used `<md-icon>`, which defaults to the *Material Symbols Outlined* font; feezal only loads *Material Icons*, so the ligature never resolved. Fixed by rendering the icon as a `<span style="font-family:'Material Icons'">` (the same proven pattern used by `material-button` / `material-dialog`).
2. **Color CSS var ignored** — `md-fab` resolves its fill from component-level tokens per variant (`--md-fab-primary-container-color`, …), not directly from the mapped `--md-sys-*` tokens. Fixed by setting the `--md-fab-*-container-color` tokens (all variants) to `--feezal-fab-color` and the `--md-fab-*-icon-color` tokens to white, so the exposed variable and the active theme always take effect.

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

### N29 — Element *sets*: one-click install of many elements (bundle / multi-element packages) ✅ done

**Problem.** The N4 Package Manager already removes hand-`npm install` — users search npm and click Install in the Packages sidebar ([feezal-sidebar-packages.js](../www/src/feezal-sidebar-packages.js)), and [install.js](../server/src/build/install.js) does `npm install` → Vite-bundle → drop into `<dataDir>/elements/<pkg>/`. But **one npm package = one element**, so installing a whole design system or a family (the material set, or a styled/framework family like E55–E63 / E83–E85) means N separate installs. There is no "install this set" unit — which is exactly what a community gallery (A20) wants to offer.

Shipped in two phases; Phase A's marker was designed so Phase B is a compatible extension.

#### Phase A — meta / aggregator package (MVP, minimal change) ✅ implemented (July 2026)

A package named `feezal-elements-*` (plural) carrying a `feezal: {type: "bundle", elements: [...]}` marker whose `package.json` only lists member `feezal-element-*` packages as **dependencies** — no element code of its own. The install pipeline **detects a bundle and expands it**: members are bundled from the same staging `npm install` (they're dependencies, so npm already fetched them), landing each in its own `<dataDir>/elements/<member>/` dir.

**Implemented decisions** (pathfinder set: `@feezal/feezal-elements-eink`):
- Name prefix `feezal-elements-` → type `bundle` in `derivePkgType`/`isAllowedPackage`; registry-search keyword for sets is **`feezal-elements`** (aggregator packages must carry it in their `keywords`).
- Each written member records its owner in `feezal.set`; the set itself gets a **code-less marker dir** (manifest-only `package.json`) so it shows in the installed list and can be updated/removed as a unit — discovery skips it by name prefix, so nothing changed in `_scan`/palette/registry/export.
- **Remove semantics:** removing the set removes exactly the members whose `feezal.set` matches it (individually installed members and members owned by another set survive); removing a single member leaves the set alone.
- Packages sidebar: **Sets** filter, `set` chip, members grouped/indented under their set row in the All/Sets views (type filters stay flat).
- Cost accepted as designed: a 20-element set = 20 bundled files, shared base classes inlined per member (no dedup — see Phase B).

#### Phase B — true multi-element package (one dir, many tags; code-dedup) ✅ implemented (July 2026)

The package ships **one bundle** and declares its exposed tags in a manifest: `feezal: {type: "elements", elements: ["feezal-element-x-a", "feezal-element-x-b", …]}` on a `feezal-elements-*` (plural) package — `feezal.type` distinguishes it from a Phase A marker (`"bundle"`). Discovery registers **all listed tags** from that single import; a shared **family base class** is bundled **once** instead of per element. This is the shipping unit for the design-system families (see [element-families.md](element-families.md)).

**Implemented decisions** — the three `tag == package-name` assumptions now read the manifest:

1. **Discovery** — `_scan` in [elements.js](../server/src/build/elements.js) matches `feezal-elements-*` dirs, skips Phase A markers (`feezal.type "bundle"` / no tag list), and pushes one element entry carrying `tags: [...]` from the manifest.
2. **The registry contents** — `window.feezal.elements` (dynamic route + build-time `writeElementsFile`, via the shared `elementTags()` helper) now carries **custom-element tag names**: families expanded from their manifest, single-element packages' `@scope/` stripped. All consumers (palette, source-mode tag completion, AI catalogue, browser smoke test) already stripped the scope, so the change is backward- and forward-compatible; the palette's strip stays as belt-and-braces against a stale cached registry.
3. **Export tree-shaking** — `tagsToPackages(tags, tagMap)` in [extract-elements.js](../server/src/build/extract-elements.js) resolves family tags through a map built by the new `buildTagToPackageMap(nodeModulesDir)` (manifest scan, any scope) and dedupes multiple tags into their one family package; unmapped tags keep the `@feezal/${tag}` convention.
4. **Install pipeline** — [install.js](../server/src/build/install.js) routes `feezal.type === "elements"` through the regular single-package path (one Vite bundle, one `<dataDir>/elements/<pkg>/` dir) with the tag manifest preserved in the written `package.json`; tags are validated against the `feezal-element-*` form. `listInstalled` reports type `elements`; remove/update treat the family as one unit (no member dirs, no reference counting needed — one of the reasons Phase B won for families).
5. **Packages sidebar** — type `elements` shows under the **Sets** filter with the `set` chip (single row, no member indentation).

Server unit tests cover Phase B discovery (tags entry, marker skip), registry emission, tag-map building/dedup, and family list/remove.

**End state reached:** the styled/framework families ship in this shape (element-spec §1.1 documents the manifest contract); the community gallery (A20) can offer "install this set" as a first-class action.

**Relates:** N4 (the package-manager pipeline this builds on), N27 (live-viewer loading of installed packages — a set must load in the viewer too, same gap), A20 (community ecosystem / curated gallery — sets are the unit it distributes), E55–E63 / E80 / E83–E85 (families that ship as multi-element packages — the primary beneficiaries), A8 (export tree-shaking — the Phase B `tagsToPackages` change).

### N28 — Font Awesome icon set (`feezal-icons-fa`) ✅ implemented

A `feezal-icons-*` package wrapping **Font Awesome Free** — the third bundled set after `feezal-icons-mdi` and `feezal-icons-knx-uf`. The **brands** style (~600 logos: GitHub, Spotify, …) fills a real gap — MDI carries only a shrinking brand set.

**Implemented (July 2026), `@feezal/feezal-icons-fa` 1.0.0 (bundled workspace package):**

- **Three sets, one package** (the settled N28 decision): `fa-solid` (2001), `fa-regular` (273), `fa-brands` (603) from Font Awesome Free **7.3.0** — icon values `fa-solid:house`, `fa-regular:heart`, `fa-brands:github`, three picker chips.
- **`render(name)` SVG mode** (mandatory — FA's webfont is class+codepoint): generated data modules per style (`icons-{solid,regular,brands}.js`, spec-§4a format, ~2 MB total, editor-only), produced by the committed `generate.mjs` from `@fortawesome/fontawesome-free` (`npm install --no-save` + run; documented in the README). Normalisation strips the per-file license comment + `xmlns`; paths keep their `currentColor` fill; varying viewBox widths are fine (unsized SVG, `<feezal-icon>` sizes to 1em).
- **Server support for multi-set packages:** `discoverIconPackages()` now accepts the plural manifest `feezal.sets: [{set, icons}, …]` (one discovery entry per set; singular form unchanged; user-module URLs deduped) — so per-site tree-shaking shakes each style from its own data module. Documented in **icons-spec §1** (the package slug names the family, not a single set).
- **Licensing:** CC BY 4.0 — FA's `LICENSE.txt` ships in the package, attribution in the README; Pro styles out of scope.
- 4 www unit tests (three-set registration, per-style volume + expected names, SVG normalisation, unknown-name fallback, `<feezal-icon>` end-to-end) + 2 server tests (plural-manifest discovery, per-set tree-shaking); TESTING.md picker/tree-shaking bullet.

**Relates:** N23 (the icon-set contract this rides on), E71/E72 (icon elements as consumers), A20 (ecosystem tooling).

### N24 — Viewer presence + per-client control topics ✅ implemented

*Origin — Node-RED research (July 2026): uibuilder's stable `clientId` and Dashboard 2.0's `msg._client` both exist because site-wide control topics are all-or-nothing broadcasts — you couldn't tell the hallway panel to switch views without also switching every phone.*

**Implemented (July 2026) — MQTT-native, pure topic convention, on by default** (disable: Viewer Settings → Site → *Viewer presence*, `presence="off"` on `<feezal-site>`). Full reference: **docs/presence.md**.

- **Topic convention (as decided):** one subtree per client under the site topic — `<site>/clients/<id>/status` (retained status JSON, cleared on disconnect) plus per-client commands mirroring the site-wide set (`view|reload|theme|playlist|addclass|removeclass`) and the per-client-only `rename`. Site-wide control topics unchanged — the subtree is additive. All-clients presence is one subscription (`+/status`), a per-client ACL one pattern.
- **Viewer runtime** (`www/src/feezal-presence.js`, imported by `viewer-main.js`): per-browser client ID (`viewer-x7k2` style, `localStorage`, topic-safe charset, private-mode fallback), dismissible plain-DOM corner toasts ("Connected as …"), retained status `{view, connectedSince, lastChange, connection: direct|bridge, userAgent}` republished on every view change (attribute observer — catches nav elements, swipe, hash, MQTT alike), collision detection via the own-status subscription (warn once, proceed — last-writer-wins, no auto-suffixing), rename flow (clear old retained status → persist → resubscribe subtree → republish → re-register the server-side clear).
- **Offline = cleared topic, no heartbeat:** direct-MQTT viewers register a broker **LWT** via the new `feezal.presenceWill()` hook in `feezal-connection-mqtt.js` (an explicitly configured LWT wins); bridge viewers register their status topic over Socket.IO (`presence` event) and `server/src/socket/hub.js` publishes the retained clear on disconnect (hub cache + broker).
- **Retain plumbing** (prerequisite, all layers): `feezal-connection.pub(topic, payload, {retain})` → mqtt.js publish options → hub `send` → `bridge.publish(…, {retain})`.
- **`feezal-site` refactor:** shared `applyControlCommand(cmd, payload)` consumed by both the site-wide and per-client subscriptions; fixed a pre-existing leak where addclass/removeclass re-subscribed on every view switch.
- **Editor Clients panel** (`www/src/feezal-sidebar-clients.js`, devices icon in the sidebar rail): live rows from `<site>/clients/+/status` (id, view, connection, online-since, UA) with Switch-view / Set-theme / Reload / Rename actions — deliberately just an MQTT client of the convention.
- 12 www unit tests (identity, enable/disable, will shape, retained status + view republish, command routing, rename incl. resubscribe + old-status clear, collision, toasts) + hub disconnect-clear/malformed-registration tests + bridge retain-forward/retained-clear tests; TESTING.md §12 checklist; **docs/presence.md** (convention, payload, rename/collisions, privacy, automation examples).

**Deferred (unchanged):** per-client MQTT credentials / broker ACL mapping → N10/A19.

**Relates:** A18 (kiosk remote management), E49 (scripts as automation consumers), E62 (client presence list element consumes the same convention), N10/A19 (credentials/ACLs).

### N4 — Package Manager (elements + themes) ✅ done

Install, update, and remove feezal add-on packages from the editor, without a daemon restart. Shipped for the `feezal-element-*` and `feezal-theme-*` types; the `feezal-icons-*` third type plus the theme authoring docs/scaffold and live-registry validation were split out to **N23** (✅ done — see below).

**What was built:**
- **Install pipeline** (`server/src/build/install.js`) — name-prefix allowlist + `type` derivation (`feezal-element-*` / `feezal-theme-*`), `npm install` into a temp staging dir with `--ignore-scripts --no-audit --no-fund`, then a Vite/Rollup **self-contained-ESM bundle** step (all bare specifiers — `@feezal/feezal-element`, `lit`, … — resolved and inlined so the browser's dynamic import works), written to `<dataDir>/elements/<pkg>/` with a minimal `package.json` (`{name, version, main, feezal:{type}}`). Dependency-free themes pass through the bundle step unchanged. Covered by unit tests; bundling validated offline against the real staging layout.
- **`/api/elements*` routes** — list / search (npm registry, scoped by type keyword) / install / update / remove, all behind `editorAuth`; blocking install returns `stdout`/`stderr`; emits a Socket.IO `elementsChanged` event so connected editors reload and repopulate the palette (`window.feezal.elements`) and theme picker (`window.feezal.themes`) — **no daemon restart**.
- **Package Manager sidebar tab** (`www/src/feezal-sidebar-packages.js`) — a dedicated tab with an *All / Elements / Themes / Icons* type filter, npm search + Install, an installed list (version, outdated `→ vX.Y.Z` badge, Update / Remove), an output `<pre>`, and a reload prompt.

**Loading strategy (why server-side bundling).** User elements load via `import '/user-elements/<pkg>/<main>'`; the browser can't resolve bare specifiers, but every spec-compliant element does `import { FeezalElement } from '@feezal/feezal-element'`. Bundling to a self-contained ESM on install solves that and lands output exactly where `discoverElements()` / `_scan()` already scans — so no discovery change was needed for elements/themes. Trade-off: each bundle inlines its own copy of the shared runtime (Lit + FeezalElement); safe because elements interact with the editor only via the DOM, `customElements`, and the global `feezal` object. **Authoring caveat:** an element that itself defines Shoelace (or another custom element the editor already defines) hits `customElements.define` "already defined". This **supersedes** the "packages must be pre-bundled" constraint in `element-spec.md §User elements`.

**Security & environment:** `--ignore-scripts` on every npm call (blocks postinstall RCE); name allowlist; routes behind `editorAuth`; requires `npm` in PATH + network at runtime (present in the Docker alpine image), with an air-gapped manual-drop fallback (a self-contained ESM in `<dataDir>/elements/<pkg>/`).

**Deferred to N23:** `feezal-icons-*` icon-set packages (blocked on the `registerIcons()` contract + icon-picker merge), the theme authoring docs + `create-feezal-theme` scaffold, and end-to-end validation of the live npm-registry install path.

### N23 — Icon-set packages (`feezal-icons-*`) + package-manager follow-ups ✅ done

The three parts deliberately deferred from N4, all shipped July 2026. Full design history (contract decisions, ioBroker vis icon-ecosystem research, picker UX) lives in this entry's roadmap version in git history; condensed here.

**1 — Icon-set packages (the third type)** — shipped in stages (July 2026):
- **Infrastructure:** `www/src/feezal-icon.js` (MIT viewer runtime: `feezal.registerIcons(set, {font?, names, render?})` registry with font/render modes, `window.feezal.iconSets`, `feezal-iconsets-changed`, the shared `<feezal-icon>` resolver incl. not-installed fallback); server discovery (`feezal-icons-*` → type `icons`), install pipeline with **sidecar asset copy** (fonts/SVGs/LICENSE land next to the bundle); the multi-set **icon picker** (chip row, `set:` scoping, grouped All view, last-used persistence, keyboard cursor). `docs/icons-spec.md` written. 12 registry/element + 7 picker unit tests, 3 server tests, 5 E2E tests.
- **Per-site tree-shaking** (`server/src/build/icons.js`): packages declare a data module via `feezal: {set, icons}`; full sets load only in the editor; viewer pages get a server-inlined registration with just the icons the site references; exports get the same appended. A dashboard using a dozen MDI icons ships ~2 kB instead of 5 MB. User-installed sets (single-file bundles) aren't shakeable — viewer loads the full module, exports warn and skip.
- **Reference packages** (both live in `www/packages/@feezal/` as built-ins): `@feezal/feezal-icons-mdi` (7447 Pictogrammers MDI, render mode — the MDI webfont is class+codepoint and can't reach shadow DOM) and `@feezal/feezal-icons-knx-uf` (all 940 KNX-UF icons, SVGO 8 MB → 2.1 MB, white strokes mapped to currentColor; CC BY-SA attribution shipped). Along the way fixed a pre-existing N4 bug: `/editor/feezal-elements.js` served a startup-time discovery snapshot — now re-discovers per request.
- **Element migration:** all seven elements with user-configurable icons render through `<feezal-icon>`; exception material-energy-flow (SVG `<text>` glyphs, Material-names-only). E71/E72 (icon-value variants, plain icon) build on the registry.
- **`@feezal/create-feezal-icons` scaffold** (`packages/create-feezal-icons/`): `--mode svg` emits the tree-shakeable layout (data module exactly `export default <JSON object>;` + registering entry); `--mode font` emits the ligature-font variant (`@font-face` via `new URL(…, import.meta.url)`, assets dir) with the class+codepoint warning; validates the set-name pattern, emits the `feezal-icons` keyword and `feezal: {type, set, icons?}` manifest.

**2 — Theme authoring docs + scaffolds** — `docs/theme-spec.md` written (package conventions incl. the required `feezal-theme` keyword and `feezal: {type: 'theme'}` field; the self-injecting class-scoped-`<style>` convention and why it makes runtime switching instant; how themes are applied — class on `<feezal-site>` mirrored to `body`, `<site>/theme` control topic, `window.feezal.themes` discovery, export inlining; the core variable list cross-referencing element-spec §5.1; the **two theme flavours** — npm package vs. local `<dataDir>/themes/<slug>.css` editor theme — incl. converting local → package). `@feezal/create-feezal-theme` scaffold (`packages/create-feezal-theme/`) with light/dark starter variable blocks covering the core set. Both scaffolds mirror `create-feezal-element` (kept as a consistent `create-feezal-*` family rather than folding into one CLI). Also fixed `create-feezal-element` emitting keyword `element` instead of the registry-searched `feezal-element` — scaffolded packages were unfindable in the Package Manager search. All three scaffolds are covered by `server/test/scaffolds.test.js` (runs the real CLIs; asserts allowlist/type/keyword acceptance, module syntax, the real tree-shaker parse + `extractUsedIcons` round-trip, and `listInstalled()` after an air-gapped manual drop).

**3 — Live npm-registry install validation** — validated against a **real registry** (local Verdaccio, July 2026): freshly scaffolded theme + icons packages published via real `npm publish`, then the production `installPackage()` ran `npm install` from the registry, Vite-bundled, wrote the install manifest, copied the icons package's sidecar `LICENSE.txt`, and the results were picked up by `listInstalled()` and `discoverIconPackages()` (user icon set correctly discovered as non-shakeable single-file bundle). **Residual, blocked on the first public publish:** the npmjs.org keyword-search leg (`GET /api/elements/search` queries registry.npmjs.org directly) and the "update available" badge can only be verified against a genuinely published `feezal-*` package — as of July 2026 none exist (all three keyword searches return 0 results). Verify both once the first packages are published (A10 npm-publishing pipeline).

**Residual → N27:** live-viewer loading of user-installed element/theme packages (pre-existing N4 gap; icons are handled via the inlined registrations).

### N26 — View playlist / signage rotation ✅ done

*Origin — Peakboard research (July 2026): rotating content on wall displays is a digital-signage staple. Implemented July 2026.*

A per-site **playlist**: an ordered list of views, each with a dwell time, looping in the viewer — purely client-side (a timer driving the existing view-switch machinery in `feezal-site.js`), so it works identically in the live viewer and in **static exports**, with zero server involvement.

**Configuration — reflected attributes on `<feezal-site>`** (they travel with the serialized site HTML): `playlist` (comma-separated `name` or `name:seconds` entries; unknown views are filtered out), `playlist-enabled` (boolean — the steady state, rotation starts right after load), `playlist-dwell` (default seconds, 10), `playlist-resume` (idle seconds before resuming after an interruption, 60), `playlist-transition` (`none` | `fade` — fade is a CSS animation on the view's display toggle, gated to the viewer via a `feezal-viewer` host class). Edited in **Site Settings → Site → View playlist** (switch, views input with per-view dwell syntax, dwell/resume number fields, transition select).

**Runtime control** via the new site control subtopic `<site>/playlist` (additive to `view|reload|theme|addclass|removeclass`): `on` / `off` (retained defines the steady state — the replay arrives like any subscription), `pause` (suspends until the idle timeout), `next` / `prev` (immediate jump, wraps both directions, works even while paused). Unknown payloads are ignored.

**Interaction pause:** any user interaction (pointerdown/keydown/wheel/touchstart on `window`) pauses rotation and (re-)arms the resume timer — a wall panel stays touchable without fighting the carousel. A direct `<site>/view` command or in-dashboard navigation pauses the same way (detected in `updated()`: view switches not flagged as playlist-initiated count as activity; the initial view assignment is exempt). On resume the playlist advances immediately. **The editor never rotates** (all engine paths are `feezal.isEditor`-guarded).

**Also fixed along the way:** the Site tab in `feezal-sidebar-viewer` was never seeded from the loaded `<feezal-site>` attributes (Title/topics showed blank after an editor reload) — the `getSite` handler in `feezal-sidebar-inspector.js` now seeds the whole site object; and `_applySite()` now removes an attribute when its field is cleared (previously stale values survived in the saved HTML).

**Open questions resolved:** paused state does not survive a reload (retained `off` covers the steady-state case); retained `on`/`off` defines the steady state (yes — matches `theme`); progress indicator not built (revisit on demand as a companion element).

**Covered by** `www/test/feezal-site-playlist.test.js` (20 tests: parsing, rotation/wrap/per-entry dwell, enable gating, interaction+command pause/resume, all five control payloads, editor inertness, teardown) plus `_applySite`/`_setSite` round-trip tests in `feezal-sidebar-viewer.test.js`. Documented in the user guide (site-topics table + "View playlist (signage rotation)" section).

**Deferred to N24:** per-client playlist enable (hallway panel rotates, phones don't) — joins the client-scoped command set when N24 lands.

### N8 — MQTT TLS certificate management ✅ done

Shipped in two stages; full design history (incl. the corrected TLS-termination map) in git history of the roadmap entry.

- **CA trust certificate** *(first stage)* — Connection sidebar TLS section (upload file / paste PEM, CN badge, remove with confirmation); JSON certs API `GET`/`POST`/`DELETE /api/sites/:name/certs` (types `ca`/`cert`/`key`, presence-only GET, PEM sanitised); stored at `<dataDir>/sites/<name>/certs/` (A14 layout, gitignored); the bridge passes `ca.pem` as the mqtt.js `ca` option and reconnects on deploy.
- **Client certificate (mTLS)** *(July 2026)* — sidebar **Client certificate (mTLS)** section with cert + key rows (upload/paste/remove; shared paste area; shown for `mqtts://`/`wss://`); the bridge loads `client.crt`/`client.key` alongside the CA. Options assembly extracted to `buildConnectOptions()` (exported, unit-tested: full mTLS set, CA-only, missing files skipped individually). The private key is stored server-side and never served back.
- **Termination-map documentation** *(July 2026)* — the original "TLS is terminated in Node.js, the browser is uninvolved" framing was wrong for direct viewers/exports. user-guide §7 gained **"TLS and self-signed brokers"**: who terminates TLS where (server: editor/bridged viewers/the bridge's own connection — browser: direct `wss://` viewers and every static export), per-platform CA-import steps (Windows/macOS/Linux/Firefox/Android/iOS), the Let's-Encrypt-first recommendation, and the mTLS OS-store story; sidebar hints state the server-side scope of uploaded certs. Exports ship `TLS-SETUP.md` (see N10).

### N9 — MQTT protocol transport and version ✅ done

- **Backend bridge for `mqtt://`/`mqtts://`** and the **export hard error** for non-WebSocket protocols were already in place (viewer route picks `backend=feezal` for TCP protocols; editor export dialog + server-side 4xx with the actionable ws/wss message).
- **Configurable protocol version** *(July 2026)* — **MQTT version** select in the Connection sidebar (`3.1.1` default / `5.0`), stored as `connection.protocolVersion` (integer 4/5) in `viewer.json`, passed as the mqtt.js `protocolVersion` option by **both** the browser client (`feezal-connection-mqtt`) and the server bridge; a version change triggers a bridge reconnect. Unit-tested on both sides.
- **Explicitly not included:** MQTT 5 *Retain-As-Published* subscriptions in the bridge (the B16 residual — topics first retained after server start miss the replay cache until reconnect). Revisit if that gap ever bites in practice.

### N10 — Credential security: live viewer bridge + export runtime prompt ✅ done

*(July 2026.)* MQTT credentials and TLS private keys are no longer visible in page source or export bundles.

- **Live viewer — server bridge for all modes:** new **"Connect via server (recommended)"** toggle in the Connection sidebar (`connection.viaServer`; forced + disabled for `mqtt://`/`mqtts://`, which cannot be opened from a browser). The viewer route honours it (`backend=feezal`) **and strips the connection config from bridged viewer pages** — credentials never reach the page source. Direct mode shows an explicit warning in the sidebar (credentials embedded and readable by anyone who can open the viewer).
- **Static export — runtime credential prompt:** exports never contain credentials. `sanitizeExportConnection()` strips URI userinfo and `username`/`password` fields (and the meaningless `viaServer` flag) and sets `credentialPrompt`; the exported viewer (`feezal-connection-mqtt`) then shows a hand-rolled login overlay on first load (no Shoelace — viewer rule): broker URL (pre-filled, editable), username, password, **Remember on this device** (localStorage; default sessionStorage, cleared with the tab). Authorization failures (CONNACK 4/5 or auth-flavoured errors) clear the stored credentials and re-prompt with an error note; credential-less exports connect without any dialog.
- **~~Config sidecar alternative~~ dropped by decision (July 2026)** — one mechanism only, the runtime prompt.
- **mTLS + static export:** no hard error; certificates are **never** put into the ZIP. When the site has TLS material, the export includes a generated **`TLS-SETUP.md`** (CA-trust import per platform; mTLS client-certificate section when a client cert is present) — this supersedes the originally planned separate `MTLS-SETUP.md`, and together with the sidebar hints replaces the planned export-dialog warning (kept the export flow prompt-free).
- **Documentation:** user-guide §7 got the **connection-mode comparison table** (via server vs. direct: data path, credential visibility, TLS termination, protocols, server dependency) and §10 a **"Credentials — the runtime prompt"** walkthrough (behaviour, Remember semantics, forgetting a device, the always-direct nature of exports).
- **Tests:** export credential-stripping + TLS-SETUP suite (7), connection-mqtt runtime-prompt suite (8) + protocol version (2), bridge `buildConnectOptions` (5); full server + www suites green.

### N11 — Dual snap lines per axis ✅ done

While dragging an element, up to two vertical (left/right) and two horizontal (top/bottom) alignment guides can now appear at once, instead of a single winner-takes-all line per axis.

**Implementation** (`_snap()` in `www/src/feezal-sidebar-inspector.js`, drag path only):
- Added a drag-specific branch that tracks the four dragged sides independently — left → `vsnap1`, right → `vsnap2`, top → `hsnap1`, bottom → `hsnap2`. Each records its nearest other-element edge within `range` and its guide line shows/hides independently.
- interact.js still snaps to a single position per axis: the closer of left/right sets `object.x`, the closer of top/bottom sets `object.y`. A guide that shows but doesn't win is purely visual feedback (Figma-style).
- The resize/single-point path (`_snapSize`) and grid snapping are unchanged; no new DOM (the four existing snap-line elements are reused).

### N19 — Icon attribute autocompletion for material elements ✅ done

Any attribute named `icon*` (e.g. `icon`, `icon-on`, `icon-off`) now gets a search-as-you-type icon picker in the standard attribute inspector.

**Implementation** (`www/src/feezal-sidebar-inspector-attributes.js` only):
- Auto-detection in `_rebuildItems`: `isIcon` when the attribute name matches `/^icon(-|$)/i`, or the descriptor sets `type:'icon'` / `iconPicker:true` (and it isn't already a bool/colour/topic/select/textarea).
- `_renderInput` renders an `sl-input` (with a live icon preview in the `prefix` slot) plus a scrollable **icon grid** dropdown filtered by the typed text.
- Grid populated from the already-bundled `material-design-icons.js` ligature list; tiles render via a local `.material-icons` font rule; clicking a tile writes the ligature name to the attribute.
- No per-element changes required.

### N20 — Style inspector: resolve CSS variable colours in the colour picker ✅ done

A colour style whose value is a `var(…)` (or `color-mix(…)`, rgb, named colour) now shows its **actual rendered colour** in the native swatch, instead of black/nothing.

**Implementation** (`www/src/feezal-sidebar-inspector-styles.js` only):
- `_toColorHex` fast-paths hex literals; anything else is resolved via `_resolveColor`, which applies the value to a hidden probe `<span>` appended into the selected element's DOM context and reads `getComputedStyle(probe).color` — so `var()` chains and `var(--x, fallback)` fallbacks resolve natively against the element's theme/custom-props.
- `_rgbToHex` converts the resolved `rgb()`/`rgba()` to `#rrggbb`; fully-transparent (unresolved var, no fallback) returns '' and the swatch gets an `unresolved` class rendering a checkerboard.
- The stored value stays the `var(…)` string; only the swatch display is resolved. Re-resolves on selection change / re-render.

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

### N14 — Live elements in the editor (glass-overlay WYSIWYG) ✅ done

Elements now subscribe and render live in the editor exactly as in the viewer. The canvas is a true WYSIWYG preview.

**Implementation:**
1. **`feezal-element` base class** — removed `if (!feezal.isEditor)` guards from `connectedCallback` and `updated()`. Elements subscribe unconditionally.
2. **`feezal-polymer-element` base class** — same subscription guard removed; kept tabindex-focus-blocking code for editor accessibility.
3. **`feezal-sidebar-inspector.js`** — `initElem()` now injects a `<style class="feezal-glass-style">` into each element's shadow root with `:host(.feezal-editable)::after { position:absolute; inset:0; z-index:5; cursor:inherit }`. This glass overlay sits above all shadow-DOM internals and blocks any remaining pointer events, complementing the `pointer-events:none` rule already in base-class styles.
4. **All 16 built-in elements** — removed `if (feezal.isEditor)` subscription guards and static placeholder render branches. Unconfigured-state hints use null-coalescing (`this._value ?? (feezal.isEditor ? demo : null)`) so real MQTT data always takes priority.
5. **Publish guards kept** — all `if (feezal.isEditor) return;` inside publish/action handlers are preserved; elements never publish in the editor.
6. **`feezal-element-basic-view`** — kept its `isEditor` check to prevent recursive canvas rendering.
7. **`docs/element-spec.md`** — §4.1, §4.4, §6.4, §7, and the §11 full example all updated to reflect the new convention: subscribe freely, guard publishes.


## Element Ecosystem

### E58 — Frosted-glass element family (`feezal-element-glass-*`) ✅ implemented

Translucent blurred cards over a wallpaper — the "make it look like Apple Home" request: squircles, `backdrop-filter` frost, soft depth, springy micro-interactions.

**Implemented (July 2026), `@feezal/feezal-element-glass-{scene,sensor,light,contact,shutter}` + `@feezal/feezal-theme-glass`, all 1.0.0 — built-in packages (ship with feezal like basic/material; no external repo/npm publish):**

- **`feezal-theme-glass`:** gradient wallpaper as an inline SVG data URI (no binary assets) painting the site canvas + body, plus the frost variables the family consumes (`--feezal-glass-blur/tint/on-tint/solid/border/color/muted/accent/radius`); **light frost by default, dark frost follows `prefers-color-scheme`**; generic feezal/HA vars set so non-glass elements stay legible.
- **Family conventions:** hand-rolled Lit (no UI library in the viewer bundle); frost = `backdrop-filter: blur(var(--feezal-glass-blur))` over the tint; **`degrade` boolean on every card** swaps the live blur for a semi-opaque solid (`--feezal-glass-solid`) — zero per-frame GPU cost for weak wall tablets; squircle via `@supports (corner-shape: squircle)` progressive enhancement over a generous radius (honest name `glass`, no trademark cosplay); `:active` scale micro-interaction.
- **glass-scene** — icon + label squircle publishing a payload on tap; optional state topic + `payload-active` highlight.
- **glass-sensor** — big numeral + unit + label + icon, `decimals`, sensor discovery.
- **Device cards match their material siblings** (refined during implementation: same capabilities + same custom-inspector pattern as the device-* elements):
  - **glass-light** — material-light's wiring contract for the on/off + brightness subset, same attribute names: `payload-mode` json/separate, `subscribe-state`/`publish-state`/`payload-on`/`payload-off`, `on-off-source: brightness` (E77 Homematic derivation incl. `1.005` OLD_LEVEL restore), `subscribe/publish-brightness` + `brightness-min/max` with material-light's exact `pctToRaw` scaling, availability badge, per-topic message-properties, light discovery (schema → payload-mode). Tile UX: tap toggles, **long-press or ⋯ flips** to the brightness slider. **CT/RGB/HS/effects deliberately not ported** — the glass tile has no UI surface for them; colour lights use material-light. Two-tab Topics/Config N6 inspector (capability-gated availability, brightness-source-aware sections).
  - **glass-contact** — material-contact's full contract (payload-open/closed/tilted incl. the boolean-coercing `payloadMatch`, availability with JSON `{state}` tolerance, `type` → icon mapping + explicit `icon` override, binary_sensor discovery with `device_class` valueMap); flat attribute form like the material sibling.
  - **glass-shutter** — material-cover's full contract (json/separate `payload-mode`, `json-map`, position + state-string inference, up/stop/down payloads, optional tilt topics → slider row, `invert`, `show-position`, availability, cover discovery); the frost shade layer descends as the cover closes, vertical drag on the card sets the position; two-tab N6 inspector adapted from material-cover's (gated Tilt/Availability sections).
- 21 www unit tests (scene publish/active, sensor formatting, contact state/availability parity, light separate/json/E77/flip/slider/editor-guard, shutter json inference/commands/separate/invert/tilt gating, inspector + discovery registration); TESTING.md §6 family list + notes.

**Deferred:** room-group card and media card (the roadmap's remaining first-cut sketch members — superseded in priority by the device trio during implementation), sample-based auto-contrast tint, pre-blurred-wallpaper degrade variant (the solid-card degrade ships), measuring the degrade default on real Pi/tablet hardware (manual QA note instead).

**Relates:** E55 (front/back flip sibling), E29, A16 (wallpaper asset export), E38, A18 (wall tablets — the degrade switch targets them).

### E55 — Metro tile element family (`feezal-element-metro-*`) ✅ implemented

**Implemented (July 2026), `@feezal/feezal-element-metro-{tile,switch,light,climate,sensor,media,contact}` + `@feezal/feezal-theme-metro`, all 0.1.0 — built-in packages (ship with feezal like basic/material; no external repo/npm publish):**

- **Shared base class `MetroTileBase`** (exported by the metro-tile package, the concrete packages depend on it): flat accent tile, `size` grid (1x1/2x2/4x2/4x4 → 70/150/310 px on a 70+10 grid, rewrites inline width/height, manual resize stays possible), label/icon/badge slots, and the **3D Y-flip**: ⋯ affordance only when `renderBack()` returns content, front tap = `baseAction()`, flip back via ⋯/outside tap, instant under `prefers-reduced-motion`, flip state per-client (never published).
- **metro-tile** — the generic tile doubles as `metro-navigate`: tap publishes a payload and/or jumps to a view; optional live badge from a topic. (Base package must define a real element — the palette and smoke harness expect every `feezal-element-*` package to register its tag.)
- **metro-switch** — whole-tile toggle (accent = ON, `--feezal-metro-off-color` = OFF); back: explicit ON/OFF; per-state `icon-on`/`icon-off`. Discovery: `switch`.
- **metro-light** — toggle front with brightness %; back offers ON/OFF + the active `mode`'s sliders (brightness / brightness_ct / color_temp / rgb / hs). The MQTT wiring contract mirrors material-light: `payload-mode` separate|json (zigbee2mqtt JSON shape), E77 `on-off-source: brightness` (HmIP/Homematic dimmers, numeric OLD_LEVEL payload-on published verbatim), kelvin/mired conversion, per-topic `message-property-*`; N6 two-tab inspector and the discovery descriptor are ports of material-light's (schema → payload-mode, capability ranges, supported_color_modes → mode).
- **metro-climate** — current temp front; back: clamped setpoint stepper + mode chips (`modes` bare-string list). Discovery: `climate` (temps, mode topics, min/max/step).
- **metro-sensor** — big value front; back: recent-trend SVG polyline + min/max over the last `points` values. Discovery: `sensor`.
- **metro-media** — track/artist front, tap = play/pause payload; back: prev/play/next + volume slider; state topic drives the icon.
- **metro-contact** — front-only status tile mirroring material-contact: `type` SVG visuals (window with tilt + mirror, door, generic, waterleak, firealarm, garagedoor), the same payload coercion, availability `!` badge, `icon-open`/`icon-closed` per-state icon overrides; tile colour = accent/open/tilt. Discovery: `binary_sensor` incl. `device_class` → type.
- **feezal-theme-metro** — near-black WP7 start-screen theme, cyan default accent, classic accent palette documented for per-tile overrides.
- E29/E48-overlap settled as scoped: detail-on-the-back inline; no Shoelace (hand-rolled flat controls per the viewer-dependency rule).
- 11 browser behaviour tests (`test-browser/feezal-elements-metro.test.js`); TESTING.md §6 category list + family note. Live-tile notification flips stay a follow-up, as scoped.

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

### E59 — Terminal / retro-CRT element family (`feezal-element-tui-*`) ✅ implemented

**Implemented (July 2026), `@feezal/feezal-element-tui-{value,checkbox,menu,sparkline,log,ascii,panel,crt}` + `@feezal/feezal-theme-tui`, all 0.1.0 — built-in packages (ship with feezal like basic/material; no external repo/npm publish):**

- Shared phosphor look via `--feezal-tui-color/bg/glow/font` (green default) — glow is layered text-shadow, `--feezal-tui-glow: 0` disables; all blink/flicker animation gated on `prefers-reduced-motion`.
- **tui-value** — `label……: value` dot-leader row (CSS-clipped dot run, no width math); blinking cursor block for 2 s after each message. Discovery: `sensor`.
- **tui-checkbox** (initially shipped as tui-toggle, renamed) — `[X] label` checkbox, Space/Enter + click, material-switch payload contract. Discovery: `switch`.
- **tui-menu** — `[1] Lights` hotkey menu (items objectList: label/publish/payload, hotkeys 1–9 auto-assigned), digit keypress when focused, entry flash on activation; vertical/horizontal.
- **tui-sparkline** — `▁▂▃▅▇` block graph of the last `points` values, min/max fixed or auto.
- **tui-log** — timestamped scrolling feed; MQTT wildcards allowed, `max-lines` ring buffer, optional topic prefix, auto-scroll.
- **tui-ascii** — baked 3×5 block font (digits, `:.%-°+`, small letter set) sized via container-query units; `baseAttribute: value`. Discovery: `sensor`.
- **tui-panel** — real box-drawing frame (`┌─ TITLE ─┐`, single/double) measured against live monospace metrics via ResizeObserver so it closes cleanly at any size; wraps an embedded view by reusing `feezal-element-basic-view` internally (same composition as layout-flex regions).
- **tui-crt** — opt-in decorative overlay: scanlines (strength attr), vignette, flicker **off by default** (accessibility/battery, per the roadmap note) and suppressed by `prefers-reduced-motion`; click-through in the viewer, selectable in the editor.
- **feezal-theme-tui** — green-phosphor page theme (HA-style vars mapped); amber/white variants by overriding `--feezal-tui-color`, per the "variant via var, not separate family" decision.
- Box-drawing joins between separate elements stayed a non-goal (each element frames itself), as scoped.
- 13 browser behaviour tests (`test-browser/feezal-elements-tui.test.js`); the test-helper fake connection learned MQTT wildcard matching for the log tests. TESTING.md §6 category list + family note.

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

### E56 — Analog cockpit element family (`feezal-element-panel-*`) ✅ implemented

**Implemented (July 2026), `@feezal/feezal-element-panel-{led,switch,7seg,gauge,knob}` — built-in packages (ships with feezal like basic/material; no external repo/npm publish):**

- **panel-led** — pilot light: boolean cast or exact `payload-on`/`payload-off`; optional `states` objectList mapping payload → colour + steady/blink/blink-fast; radial-gradient lens with glow, recessed bezel. Discovery: `binary_sensor`.
- **panel-switch** (initially shipped as panel-toggle, renamed) — bat-handle flip switch on a screwed plate with snap-overshoot lever animation; `guard` adds the red safety cover (first tap opens, auto-closes after 4 s); material-switch MQTT contract. Discovery: `switch`.
- **panel-7seg** — seven-segment readout with ghost segments, decimal point, minus and a letter subset (`Err`); value right-aligned into `digits` cells, optional fixed `decimals`; `baseAttribute: value`. Discovery: `sensor`.
- **panel-gauge** — 240° dial, tick scale with numerals, `zones` objectList (green/amber/red bands), under-damped needle **spring** on its own rAF (writes the SVG transform directly — no per-frame re-render). Discovery: `sensor`.
- **panel-knob** — hand-rolled drag-to-turn (pointer angle, 270° throw — `<round-slider>` evaluated and skipped: no wrap-around arc + first-class detents/keyboard wanted), scroll wheel + arrow/Home/End keys, optional `detents` snapping to `step`; publishes throttled (200 ms) while dragging, always on release; incoming state ignored mid-drag. Discovery: `number`.
- Shared cockpit look via family CSS vars `--feezal-panel-face/bezel/text` (point-of-use fallbacks so a theme can set them once for all five) + per-element accent vars; publish guards in the editor everywhere; canvas drag unaffected (editor pointer-events discipline).
- 13 browser behaviour tests (`test-browser/feezal-elements-panel.test.js`) + smoke-harness mounting; TESTING.md §6 category list + family note.

Skeuomorphic **instrument-panel controls** — the "virtual hardware" aesthetic the MQTT/Node-RED crowd loves: dashboards that look like a machine console, not an app. More than a skin, because it introduces **interaction types the current set doesn't have**.

**Family (first cut):**

- **`panel-toggle`** — a real flip toggle switch (guard-cover variant as an attribute for "are you sure" actions) with a satisfying snap animation.
- **`panel-knob`** — **rotary knob**: drag-to-turn (pointer angle) + scroll-wheel + keyboard arrows; detents optional; min/max/step; publishes like the slider but *feels* like hardware. The marquee element of the family — dimmers, volume, setpoints. **Candidate backing lib:** **`<round-slider>`** (Lit; the same round slider Home Assistant uses for its thermostat/light cards) — a proven circular drag control to wrap instead of hand-rolling the pointer-angle math; evaluate whether it covers detents/keyboard, else hand-roll over its SVG approach.
- **`panel-gauge`** — analog needle gauge (240° arc, configurable range/zones — green/amber/red bands); needle physics (spring damping) convey rate-of-change in a way a number can't. VU-meter variant (level from a topic, peak hold).
- **`panel-led`** — indicator lamp (steady/blinking states by payload mapping, color per state), the classic status pilot light.
- **`panel-7seg`** — seven-segment / Nixie-style numeric display for sensor values.

**Styling:** brushed metal / dark console surfaces, engraved labels, screw-head corner details as an opt-out flourish; a restrained **Dieter-Rams / hi-fi** variant (matte, minimal) selectable per theme rather than a separate family. Needs to degrade gracefully on the existing flat themes (the physics/interaction still carry the value).

**Notes:** knob/gauge rendering is SVG-in-shadow-DOM (crisp at any size, themeable via CSS custom properties, relates to E51's machinery); drag-to-turn needs the same interact.js pointer discipline as the canvas (editor mode must not fight element drag); auto-discovery wiring like the material set (dimmer → knob, sensor → gauge).

**Relates:** E38 (elements scale to their box — gauges/knobs are naturally square), E51 (SVG rendering), N23 (glyphs), A20 (npm packaging), existing material-slider/light (shared publish conventions).

### E25 — Time picker element (`feezal-element-material-time-picker`) ✅ implemented

An interactive time input publishing a selected time to MQTT — the scheduling companion ("turn on lights at …").

**Implemented (July 2026), `@feezal/feezal-element-material-time-picker` 1.0.0:**

- **MD3 outlined text field with `type="time"`** (browser-native picker; `show-seconds` switches the field step to 1 s) plus a **touch-optimised wheel picker** opened by the trailing clock icon: drum-roll columns (hours / minutes / optional seconds) with CSS scroll-snap, centre-row highlight, tap-to-select, Cancel/OK — rendered as a fixed overlay inside the element's shadow DOM (no Shoelace in the viewer bundle).
- **Payload contract:** subscribe accepts `HH:MM`, `HH:MM:SS` or numeric seconds since midnight (wrapping at 24 h); publish emits the configured `format` (`HH:MM` | `HH:MM:SS` | `seconds`). Exported `parseTime`/`formatTime` helpers, unit-tested round-trip.
- **All roadmap attributes:** `subscribe`/`message-property`, `publish`, `format`, `step` (minute increment of the wheel), `label`, `show-seconds`, `publish-on-change` (publish on every drum settle instead of only on OK/field commit), plus `disabled`; `--feezal-time-picker-color` accent var; default size 160×60, publish guarded in the editor.
- 7 www unit tests (parse/format contract); TESTING.md §6 entry + element-specific note.

### E52 — Schedule editor element (`feezal-element-material-schedule`) ✅ implemented

A UI for **editing schedules, not executing them** — the element renders the retained schedule JSON from the subscribe topic and publishes edits back; the consumer (she, Node-RED, a thermostat adapter) owns the actual scheduling. Niagara-style weekly editor; ThingsBoard paywalls this — a real differentiator.

**Implemented (July 2026), `@feezal/feezal-element-material-schedule` 1.0.0 — all refined decisions honoured:**

- **Generic feezal JSON contract**, documented as a deliverable in **docs/schedule-format.md**: `{type: boolean|number, week: {mon…sun: [{from, to, value}]}, default, exceptions}`; `"HH:MM"` wall-clock strings (`"24:00"` valid as `to`), half-open intervals, `exceptions` reserved from day one and **preserved verbatim** through the edit round-trip.
- **Boolean + number types:** on/off painting AND setpoint-per-block via the `type` attribute (`min`/`max`/`step-value` bound numeric editing; new blocks seed from the last used value, else the step-rounded midpoint). A typed payload wins over the attribute for rendering (console warning on mismatch); unparseable/missing payloads start an empty schedule of the configured type — never crash.
- **Explicit Save:** dirty indicator ("● unsaved"), Save publishes the whole document **retained**, Revert restores the last received payload; a remote update arriving **while dirty** never clobbers the draft — a "changed remotely" hint appears and the user decides (Save overwrites / Revert adopts). Save is editor-guarded.
- **Timezone: naive wall-clock** — no TZ field, no conversion; documented in the format contract (consumer's clock wins).
- **Drag-paint grid** (pointer events, `touch-action: none`): drag on empty space creates a block (snapped to the `step` attribute: 5/10/15/30/60 min), block edges resize (7 px handles), tap selects → toolbar with Delete and (number type) a clamped value input; blocks clamp to the free gap containing the drag start — **no overlaps** (`clampBlock`); hour gridlines + tick axis, Monday-first columns.
- **"Effective value now", client-side:** chip ("now: 21.5 → 22:00" — block value until block end, else `default` until the next block/midnight) plus a dashed now-line on today's column, refreshed every 30 s. Exceptions are ignored in the MVP (documented); the optional consumer `status-topic` remains a later refinement.
- **No custom N6 inspector needed** (as anticipated): plain attribute descriptors suffice — the grid lives in the element. No `@material/web` imports (custom rendering) — fully unit-testable.
- 23 www unit tests (time helpers, gap clamping, format round-trip incl. exceptions preservation and invalid-block dropping, `effectiveNow` incl. Monday-first mapping, dirty/save/revert/remote-hint flows, block editing, editor publish guard); TESTING.md §6 entries.

**Later tiers (unchanged):** exceptions/holiday editing UI (tier 2), reusable calendar objects (tier 3), enum type, `status-topic`, live/debounced publish mode.

**Relates:** she (consumer), E25 (time picker), E67 (irrigation — E52 publishes the plan, E67 does live control), E61 (alarm family — same "contract as deliverable" pattern).

### E51 — SVG element (`feezal-element-basic-svg`) ✅ implemented

Renders an SVG **inline** (shadow DOM, not `<img>`) and binds its *internals* to MQTT — the floor-plan / schematic use case (rooms light up, pipes recolor with flow temperature, a needle rotates with a sensor value).

**Implemented (July 2026), `@feezal/feezal-element-basic-svg` 1.0.0 — all three tiers in one release, as decided:**

- **Tier 1 — Display:** `src` asset-only, fetched + sanitized (DOMPurify SVG profile — strips `<script>`, `on*` handlers) + injected inline into the shadow DOM; scales viewBox-driven to the element box with a `preserve-aspect-ratio` attribute; unconfigured/error hints in place of the drawing.
- **Tier 2 — Value bindings:** `bindings` JSON attribute with the decided row schema — `selector` + `subscribe` + `target` (`fill|stroke|opacity|visibility|class|text|rotate|translate|scale`) + at most one mapping field: `map` (discrete lookup), `range` (clamped linear interpolation, numbers AND `#hex` colors via channel lerp), `format` (`${value}` template); no field = raw passthrough. **No-match semantics as decided: revert to the SVG's pristine value** (captured per node/target on first apply) — unmatched map key or non-numeric range input restores the original. Transforms apply with `transform-box: fill-box; transform-origin: center`. Rows honour the global `message-property` and subscribe through the base-class `_subscribe()` path, so `dynamic-subscriptions` gating applies.
- **Tier 3 — Click regions:** rows with `publish` + `payload` make the sub-shape clickable — hover cursor, focus ring, `tabindex`/`role=button` with Enter/Space, publish guarded in the editor.
- **Custom N6 inspector** (same-file, Shoelace tags without import): src / preserve-aspect-ratio / message-property plus per-row cards — selector, topic, target select, mode select (raw|map|range|format) with mode-specific mini-editors (map key→value pairs, range in/out, format template) and click publish/payload; add/remove rows; persisted via `feezal-attribute-changed` as the JSON attribute (source of truth). Editor canvas renders the SVG live with an "N bindings" badge.
- 19 www unit tests (mapping semantics incl. clamping + color lerp, sanitize, pristine revert, rotate transform, nested message-property, unparseable-bindings tolerance, click regions incl. editor guard, badge); TESTING.md §6 entries.

**Deferred (unchanged):** selector picking by clicking a shape on the canvas (editor pick mode, Tier 2b); inline light-DOM markup storage. **Known limitation (documented in TESTING.md):** static exports opened from `file://` cannot `fetch` the SVG asset (browser restriction) — hosted exports and the live viewer work; inlining the SVG at export time is a possible follow-up.

**Relates:** E50 (siblings — deliberate schema separation, decided; host-level conditions work on this element for free), E49 (computed values feeding bindings), A16 (the `src` reference participates in referenced-asset export), N6.

### E49 — Script element (`feezal-element-system-script`) ✅ implemented

Client-side scripting glue — subscribe, compute, publish page-locally (or to the broker), any display element shows it. Deliberately minimal; NOT an automation engine (24/7 logic belongs in she/Node-RED). Full user documentation: **docs/script-element.md**.

**Implemented (July 2026), `@feezal/feezal-element-system-script` 1.0.0 — the whole MVP cut, all roadmap decisions honoured:**

- **Pseudo-element** (System category): code chip + `name` in the editor, invisible in the viewer; `name` attribute only.
- **Execution model as decided:** viewer-only (hard rule — never runs in the editor), main-thread, full DOM access, no sandbox; runs once per page load after the connection is up (`connected` event), wrapped per-script in its own **async function scope** via `new Function` (top-level `const`/`let` don't collide; top-level `await` works); uncaught errors — sync, async and in callbacks — logged with the `[name]` prefix. Edits apply on the next viewer page load (`<site>/reload` pushes one).
- **Persistence as decided:** source in a `<script type="text/feezal">` child (raw-text parsing — code containing `<` survives; browsers never execute unknown types); editable in source view as ordinary HTML.
- **Full `fzl` API:** `sub(topic, cb)` (origin-agnostic, wildcards, returns unsubscribe fn, not gated by `dynamic-subscriptions`), `pub(topic, value)` (page-local `{local: true}`, no retain), `mqtt.pub(topic, value, {retain})`, `onViewChange(cb)` (fires immediately + on every switch via a `view`-attribute observer), `log(…)`.
- **Payload convention as decided:** object/array-only JSON auto-parse in both directions (raw string on parse failure; `"1.5"` stays a string); publishing stringifies objects/arrays, `String()`s the rest.
- **Dedicated Monaco editor:** the custom N6 inspector embeds `feezal-template-editor`, which gained `language` + `typedefs` support — the script edits as JavaScript with **`fzl.d.ts` completions** (registered once via `javascriptDefaults.addExtraLib`) and the existing expand-to-fullscreen overlay.
- **Caveats documented** (docs/script-element.md): per-client `fzl.mqtt.pub` multiplication, no local last-value replay, dual-source topic shadowing, busy-loop freeze, `unsafe-eval` CSP requirement, ephemeral DOM changes.
- 17 www unit tests (payload convention, run-once/connected-gating, editor suppression, per-script scoping, top-level await, error prefixing, full fzl API incl. unsubscribe + onViewChange, `<` in source, typedefs export); TESTING.md §6 entries.

**Deferred (unchanged):** `run` attribute (`view-active` lifecycle), source-view syntax highlighting for `text/feezal`. **Non-goals (unchanged):** cron/solar, single-instance/server-side execution.

**Relates:** E50 (condition rows bind script-computed topics), U32 (a component param can be a script-fed topic), N2b, N10 (CSP note).

### E48 — Dialog-view element (`feezal-element-material-dialog-view`) ✅ implemented

**Status: ✅ implemented** — shipped as `@feezal/feezal-element-material-dialog-view` 1.0.2 (MIT), matching the spec below; a `feezal-element-paper-dialog-view` sibling also exists for the paper design system.

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

**Decisions (July 2026):**
- **Destroy on close:** the cloned view is removed from the portal when the dialog closes; reopening clones fresh. Clean slate, subscriptions torn down while closed, broker-retained topics replay on reopen — matches the dialog's ephemeral nature and the dynamic-subscriptions model. (Keep-mounted was rejected: transient state retention isn't worth keeping the view's subscriptions live forever after first open — or adding pause/resume plumbing.)
- **Respect the view's own chrome:** the embedded view renders exactly as it does standalone — its background *and* `--feezal-view-margin` are respected inside the dialog (WYSIWYG-faithful). The dialog's `--feezal-dialog-view-padding` default of `0` keeps the two spacing sources from stacking out of the box.

**Parked (deliberately, until E29 lands):** the tile `more` action wiring — settled then, together with the tile element. Meanwhile the MQTT route already works with zero new mechanism: any element publishes the dialog's `payload-open` to its `subscribe` topic, optionally page-locally (E49's `{local: true}` flag) so it never touches the broker.

### E53 — Notification / toast element (`feezal-element-system-notification`) ✅ implemented

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

### E75 — Data table (`feezal-element-basic-table`) ✅ implemented

> **Status: ✅ implemented (July 2026)** — data table for JSON-array-of-objects payloads (Peakboard research origin: Table/ListView + Hub Lists; a retained JSON topic plays the Hub-Lists role with zero new infrastructure). **Read-only:** columns from a `columns` config (key/label/width/align/format/editable via the U35 `objectList` list editor — the anticipated N6 custom inspector wasn't needed; a per-column `class-map` object added in source view is preserved by the editor) or auto-derived from the first row's keys; per-column formatting `number[:decimals[:suffix]]` / `date` / `time` / `datetime` (epoch-seconds heuristic below 1e12, epoch-ms, ISO strings → locale); numeric-aware click-to-sort (asc → desc → payload order, `sortable=false` disables), `filter` text box, `max-rows` cap, sticky header, `empty-text`. **Conditional formatting** via the map convention (exact value or `>` `>=` `<` `<=` thresholds, later matching entries win — E50 rule): `row-class-map` (`{"columnKey": {matcher: class}}`) tints rows, per-column `class-map` colours cells; the semantic names ok/success/good, warn/warning, error/alert/critical, info are pre-styled from the theme state colours (user classes can't pierce the shadow DOM, so the element ships the U18-ish palette itself). **Write-back (phase 2, shipped):** with `editable`, flagged columns render inputs; every commit publishes the **whole updated array** to `publish` (defaults to the subscribe topic), non-retained by default (the `retain` boolean opts in), number types preserved; row add/delete included. Documented caveat: last-writer-wins, no merging. **Backing lib decision:** hand-rolled — sort/filter/cap over an in-memory array is ~30 lines; `@tanstack/lit-table` / `<active-table>` would have added bundle cost and a Lit-3-compat risk for no feature this element needs (`@lit-labs/virtualizer` remains the upgrade path for huge arrays, A20). Theming: `--feezal-table-text/header/surface/border-color`. Editor canvas shows sample rows (following configured columns) until real data arrives; publishes are editor-guarded. Default size 400×300. **25 unit tests** (ingestion, columns, formatting, sort/filter/cap, class maps, editor sample/guards, whole-array write-back contract).

**Relates:** N2 (repeater — free-form sibling; the table is the dense/tabular case), E32 (event rows from wildcards — different source model), E66 (fleet board is a specialized table), E61 (alarm table shares sorting + severity classes), U18 (classes for conditional formatting), U35 (`objectList` columns editor).

### E81 — Navbar: attribute to set navbar item width ✅ implemented

`material-navbar` items sized themselves (`flex: 0 1 auto`); item width was implicit.

**Implemented (July 2026), `@feezal/feezal-element-material-navbar` 0.2.0:**

- New **`item-width`** attribute: empty = auto (content-sized, unchanged default), a **CSS length** (`72px`) pins every item to that fixed flex-basis, **`equal`** makes all items share the bar evenly (`flex: 1 1 0`) — the common case without hand-picking a pixel value. Applied per-item as an inline flex-basis, so it composes with the existing `align` distribution; in vertical orientation the value applies to the item height (main axis).
- Inspector: "Item width" input in the N6 inspector's Layout section (placeholder documents the three forms).
- 4 unit tests (auto default, fixed length, equal, runtime change/removal); TESTING.md navbar bullet extended.

**Relates:** E46 (`material-navbar`), E80 (navigation rail — same item-sizing consideration).

### E79 — Button: state feedback (`subscribe`) + `disabled` attribute (material **and** paper) ✅ implemented

Both button elements were publish-only fire-and-forget — no way to reflect the state they control (e.g. highlight while the scene/actor is active), and no `disabled` hook for E50 conditions on the material one.

**Implemented (July 2026), `material-button` 1.1.0 + `paper-button` 1.1.0 — identical attribute contract:**

- **State feedback:** `subscribe` (primary, per element-spec §4.0 — the base-class control channel comes along) + `message-property`; `payload-active` / `payload-inactive` (defaults `1` / `0`): a matching payload sets/clears the state, **anything else leaves it unchanged**; both empty = feature off (previous behaviour). The state is **reflected as a boolean `active` host attribute** so themes/classes can target `feezal-element-…-button[active]`.
- **Colour tokens:** `--feezal-button-active-color` / `--feezal-button-inactive-color` exposed in `styles`, both defaulting to the base token so nothing changes until themed. Material: a private `--_btn-color` switches with `[active]` and feeds the MD3 tokens (`--md-sys-color-primary`; tonal's `secondary-container` now derives from it via `color-mix`), so **all five variants** render the state. Paper: mapped onto `--paper-button-background-color`.
- **`disabled`:** boolean attribute — renders the underlying button disabled and blocks `_click` publishing (also guarded on direct calls). Documented as a **UI-only guard** (the MQTT topic stays writable — not a security boundary); the designated E50 `attribute`-action hook.
- 5 new browser tests (Chromium-verified): active/inactive/unchanged payload mapping, custom payloads + `message-property` JSON path, disabled blocks publishing — for **both** elements; TESTING.md bullet. (Material-button behaviour lives in the browser suite — md-* components can't instantiate under happy-dom.)

**Relates:** E50 (conditions — `disabled` is the designated attribute-action target), element-spec §4.0, E29 (tile shares the active-state colour pattern), E78 (paired material/paper parity work).

### E78 — Contact: remove multi-contact mode ✅ implemented

`feezal-element-material-contact` carried a second personality: the `contacts` attribute (JSON array of `{subscribe, label}`) switched it to a compact dot-grid room overview. Aggregating several sensors into one card is **composition**, not an element feature — room overviews should be built from single contact elements (U32 composed component or a repeater); keeping it meant every display element eventually growing its own bespoke multi-mode.

**Implemented (July 2026), `@feezal/feezal-element-material-contact` 1.1.0:**

- Dropped the `contacts` attribute/property, the multi-grid render branch + CSS, the per-contact subscription loop and the `_multiOpen` state — the element is single-contact only (`subscribe` + payload mapping), simplifying its E38 scaling story. Two leftover debug `console.log`s in the subscription handler removed along the way.
- **Breaking for saved views using `contacts`:** the attribute is silently ignored — the element falls back to single mode (empty `subscribe` → editor placeholder). Migration: one contact element per sensor inside a composed component. *(The original entry suggested riding the next lockstep major; shipped now as a minor on explicit request, with the fallback + migration documented.)*
- Browser behaviour test updated to assert the graceful legacy-attribute fallback; TESTING.md migration bullet; description updated (composition pointer instead of the multi-mode mention).

**Relates:** U32 (composed components — the intended replacement), N2b (repeater as the dynamic alternative), U35 (archived — contact never joined its adoption list), E38 (simpler scaling without the grid mode).

### E76 — QR code content assistant (typed presets for `basic-qrcode`) ✅ implemented

The `value` attribute was a raw string the user had to hand-author — fine for URLs, error-prone for scheme syntaxes (`WIFI:S:<ssid>;T:WPA;P:<pw>;;` escaping).

**Implemented (July 2026), `@feezal/feezal-element-basic-qrcode` 1.1.0:**

- **N6 custom inspector** (`feezal-element-basic-qrcode-inspector`, in the element package, editor-only, `<sl-*>` without importing Shoelace) with a **type picker** and per-type fields generating the value: Text/raw (default, verbatim), Web URL (auto-prefixes `https://` when the scheme is missing), WiFi (`WIFI:S:…;T:…;P:…;H:true;;` with proper `\;,":` escaping; masked password with reveal toggle + credential-visibility hint; `nopass` omits P), E-mail (`mailto:` with URL-encoded subject/body), Phone (`tel:`), SMS (`SMSTO:num:msg`), Geo (`geo:lat,lon`), Contact (minimal vCard 3.0). The inspector also carries the element's remaining attributes (subscribe / message-property / ecc / label) since N6 inspectors replace the whole panel.
- **`value` stays the single source of truth** — the assistant only writes the plain attribute; source mode, MQTT baseAttribute payloads and the viewer bundle are untouched.
- **Round-trip:** on open the current value is parsed back into type + fields for all known schemes; unknown or unparseable-but-prefixed values open on Text/raw with the string as-is (never destroyed). Switching the type alone emits nothing — the value is only rewritten when a field is edited.
- A read-only **Generated value** preview shows the produced string; the canvas QR updates live via the normal attribute flow.
- Pure exported helpers `buildQrValue()` / `parseQrValue()` with 12 unit tests (per-type generation incl. WiFi escaping, full round-trips, URL detection, raw fallback) + 2 inspector behaviour tests (parse-on-open + regenerate-on-edit, type-switch never clobbers); TESTING.md bullet.

**Relates:** E74 (the element), N6 (custom inspector machinery), N10 (credentials-in-HTML visibility note).

### E87 — Rename `paper-card-template` → `paper-card` and flesh out attributes/styles ✅ implemented

A paper **card** (heading + optional image + elevation, with a templated body) is genuinely useful and distinct from `basic-template` — but the old element was under-built, mis-named, and used the legacy `topic` + Polymer pattern.

**Implemented (July 2026), `@feezal/feezal-element-paper-card` 1.0.0 (new package; `feezal-element-paper-card-template` removed):**

- **Renamed:** package/tag `feezal-element-paper-card` , palette `Paper / Card`. Rebuilt on the **Lit base** (was Polymer wrapping `@polymer/paper-card`); paper elevation shadows (0–5, the paper-styles shadow classes) are reproduced natively with a box-shadow transition (the old `animated-shadow` toggle is gone — the transition is always on and only matters when elevation changes at runtime).
- **Migration:** the old tag stays registered as a **deprecated alias** in the new package — it maps the legacy `topic` attribute onto `subscribe` (explicit `subscribe` wins) and logs a deprecation warning, so saved dashboards keep rendering unchanged. The alias never appears in the palette (only package-name tags do).
- **Platform conventions:** primary `subscribe` attribute (was legacy `topic`); the body uses the **same `${msg.*}` templating idiom as `basic-template`** (light-DOM `<template>` child, `${msg.payload}`/`${msg.topic}`) — one templating story across both elements. (`message-property` deliberately not added: the template receives the whole message, matching `basic-template`'s contract.)
- **More attributes:** `heading`, new `subhead`, `image` + new `image-height`, `elevation` (0–5). The old half-baked hidden `actions` row machinery was dropped; an actions row remains future work if wanted.
- **More exposed styles:** `padding`, `border-radius`, `background`, `border`, `overflow` added alongside position/size/font, plus the token descriptors `--paper-card-background-color`, `--paper-card-header-color`, `--content-overflow`.
- 7 unit tests (palette identity, header/subhead/image rendering, hidden header, templated body, elevation reflection, alias `topic`→`subscribe` mapping + deprecation warning + explicit-subscribe precedence); TESTING.md §6 entry renamed + migration bullet; `www/package.json` + `vite.config.js` references updated.

**Relates:** `basic-template` / E82 (the plain templating sibling), E86 (paper family modernisation), U32 (a card-framed template is also achievable as a composed component).

### E86 — Paper dialogs: parity with material dialogs + split into two elements ✅ implemented

`feezal-element-paper-dialog` was a non-functional stub (hardcoded `<h2>Header</h2>` + lorem ipsum, only a `subscribe` attribute) while the material side had two fully-featured dialogs.

**Implemented (July 2026):**

- **`feezal-element-paper-dialog` 1.1.0** — full rewrite as the templated-body twin of `material-dialog`: title, `${msg.*}` templated content, OK/Cancel publish, payload-open/close, ESC/backdrop/✕ close, document.body **portal** (never trapped in a display:none view), live portal updates, editor preview panel.
- **`feezal-element-paper-dialog-view` 1.0.0** *(new package)* — the view-embedding twin of `material-dialog-view` (E48): clones the chosen `<feezal-view>` live into the dialog body (`baseAttribute: 'view'`, recursion guard, dynamic-subscription wake-up), same portal + token-mirroring machinery. Registered in `www/package.json` (alphabetical) and auto-discovered by the server.
- **Parity is unit-asserted:** both paper elements expose the **exactly identical attribute set** as their material counterparts (the tests compare the descriptors) — incl. the **B24** sizing attributes (`width`/`height`/`min-height`/`max-height`) and the **B25** header contract (`show-close`, `hide-header`, unified title + ✕ bar). `paper-dialog-view` shares the `--feezal-dialog-view-*` token names with the material sibling (theming knowledge transfers); the paper look comes from its defaults.
- **Paper chrome:** 2px corners, paper elevation shadow, flat uppercase text buttons (primary-coloured OK, neutral Cancel), `--paper-dialog-background-color`/`--paper-dialog-color` theme tokens, 20px/500 title.
- **Implementation decision:** rebuilt on the **Lit base** instead of wrapping `@polymer/paper-dialog` — the portal/payload/B24/B25 contract can't be expressed through iron-overlay-behavior, and parity is the point; the paper look is reproduced with paper design tokens (the `@polymer/paper-dialog*` dependencies are dropped). The paper dialogs use the generic attribute inspector (no custom N6 inspector — the material ones keep theirs; can be added later if grouping is wanted).
- 11 unit tests (attribute-set parity ×2, portal open/close, template body, OK/Cancel publish, B25 header + hide-header, B24 sizing, view embedding, missing-view error, token mirroring); TESTING.md paper-parity bullet + `dialog-view` in the paper element list.

**Relates:** E48 (material-dialog-view), B24/B25 (the settled attribute contract this parity targets), E79 (material/paper parity theme).

### E82 — Template: `click-through` attribute (pointer-events passthrough) ✅ implemented

Allow a `basic-template` element to be layered **over** an interactive element (e.g. a button) without swallowing pointer events — useful for overlaying decorative/computed HTML on top of a control.

**Implemented (July 2026), `@feezal/feezal-element-basic-template` 1.1.0:**

- New `click-through` boolean attribute (default `false` = previous behaviour; safe default-false pattern, so nothing is serialized unless enabled). When set, the host gets `pointer-events: none` — clicks/taps pass through to whatever sits beneath in stacking order.
- **Editor caveat solved in pure CSS:** the rule is `:host([click-through]:not(.feezal-editable))` — the editor marks every canvas element with `feezal-editable` (stripped from saved/deployed HTML by `_clean()`), so on the canvas the element stays selectable/draggable with zero mode-detection JS; in the viewer the class is absent and the passthrough applies.
- **Scope (documented in the help text):** whole-element passthrough — interactive content *inside* the template is not clickable either while enabled.
- 4 unit tests (descriptor, gated CSS rule, two-way reflection, off-by-default) + a templating regression test; TESTING.md bullet.

**Relates:** U33 (stacking order — click-through is most useful once elements are layered predictably), E50 (conditions can toggle `click-through` from MQTT state via an `attribute` action row).

### E77 — Light: on/off derived from brightness (Homematic dimmer mode) ✅ implemented

Homematic dimmers have **no dedicated on/off datapoint** — off is simply `LEVEL = 0`. With only `subscribe-brightness` / `publish-brightness` configured, `feezal-element-material-light` was dead: `_on` started `false` and nothing ever set it, the ring drag was gated on `_on`, and the centre tap published `on`/`off` to the empty `publish-state` topic while still flipping the local `_on` — the UI lied. (Analysis July 2026.)

**Implemented (July 2026), `@feezal/feezal-element-material-light` 1.2.0:**

- **New attribute `on-off-source`** — `select`, `topic | brightness`, default **`topic`** (explicit opt-in, not a heuristic — zigbee lamps retain their last brightness while off, so auto-deriving would show every zigbee lamp as "on"; the default leaves all existing elements untouched, and JSON mode / HA auto-discovery never hit the separate-mode paths).
- **Derive:** the `subscribe-brightness` handler sets `_on = raw !== effOff` where `effOff` = numeric `payload-off`, else `brightness-min` (the default `'off'` string degrades gracefully to the minimum); the last non-off percent is remembered (`_lastBrt`) for toggle-on restore.
- **Toggle via brightness:** publishes to `publish-brightness` instead of `publish-state` — **off** → numeric `payload-off` verbatim, else the raw minimum, `_brt = 0` locally; **on** → numeric `payload-on` verbatim (in-range values predict `_brt` locally; **out-of-range values like Homematic's `1.005` OLD_LEVEL restore are treated as device commands** — published verbatim, `_on` optimistic, `_brt` untouched until the device echoes the actual level), non-numeric `payload-on` restores the remembered `_lastBrt` (fallback 100 %) through `pctToRaw`.
- **Ring drag from off:** in brightness mode the ring stays draggable while off (dragging from off to 30 % is the natural way to turn a dimmer on); on release `_on = final > 0`. Topic mode keeps the `_on` gate.
- **JSON-mode consistency:** `_applyJsonState` derives `_on` from the brightness field when the message carries no state key (a present state key still wins — zigbee2mqtt off-retains-brightness unaffected).
- **Folded-in fix — dead inspector attributes:** the N6 inspector's State section wrote `subscribe-state` / `message-property-state` but the runtime read neither — topic-based on/off configured through the Topics tab had silently never worked in separate mode. Both are now supported (descriptor, properties, runtime), with `subscribe` fallback for back-compat with saved views; the state subscription is skipped entirely in brightness mode.
- **Inspector:** Config tab → *State payloads* gains the "On/off source" select (separate mode only) with `1`/`0` placeholders and the Homematic `1.005` OLD_LEVEL tip when brightness-sourced; the Topics tab replaces the State inputs with an "unused — derives from Brightness" hint in brightness mode.
- 12 new unit tests (derive + effOff, toggle off/on, `_lastBrt` restore, 1.005 verbatim without `_brt` prediction + device echo, drag-from-off + release derivation, topic-mode untouched, subscribe-state fix + fallback, json state-absent fallback); TESTING.md real-device bullet.

**Relates:** B17 (slider elements, same Homematic 0–1 motivation — archived), material-light 1.1.1 (`pctToRaw`), N6 (custom inspector).

### E50 — Per-element conditions (visibility / class / style / attributes) ✅ implemented

Every element gets an optional list of **conditions** that declaratively bind its visibility, CSS classes, styles, or attributes to MQTT topics — or page-locally published ones (E49) — feezal's answer to HA's per-card visibility conditions. Previously this required imperative `addclass`/`setstyle` control-topic plumbing from Node-RED; conditions make the 80% case a pure inspector configuration.

**Not a wrapper element (design decision, July 2026).** An earlier draft was a container element wrapping one child — rejected after a codebase survey (the canvas machinery assumes elements are direct children of the view). Per-element conditions match the HA mental model — *select element → set condition → done* — and needed zero canvas work. To condition a whole region, embed a named view (`basic-view` / `layout-*`) and condition *that* element.

**Implemented (July 2026), `@feezal/feezal-element` 1.1.0:**

- **Shared engine** `feezal-conditions.js` in `@feezal/feezal-element` — host-agnostic, wired into **both** base classes (Lit `FeezalElement` and Polymer `FeezalPolymerElement`), so every element gets conditions with zero per-element code. Exposes `parseConditions()` / `evalCondition()` (unit-tested pure functions) and a `FeezalConditions` controller (connect/disconnect keyed to the element lifecycle and the `visible`/`dynamic-subscriptions` gating, idempotent for an unchanged attribute).
- **Row schema** (persisted as the `conditions` JSON attribute — round-trips through the Monaco source editor): `subscribe` topic, optional `property` dot-path (default `payload`), `operator` (`=`, `!=`, `>`, `<`, `>=`, `<=`, `matches`; default `=`), compare `value`, and `action`:
  `show`/`hide` (AND-combined; optional `keep-layout` → `visibility:hidden` instead of `display:none`) · `class` (add while matched) · `style` (`{prop: value}` map) · `attribute` (`attribute` + `attribute-value`, plain `setAttribute` so Lit reflection reacts like an inspector edit).
- **Semantics:** rows evaluate independently against the last value on their topic; unmatched rows revert to the element's **pristine** value (captured before any effect); several matching rows on the same style property or attribute → **later row wins** (full-state recompute, not per-row patching); no effect until the first message arrives (locally-published topics have no replay — E49 decision); malformed JSON/rows are dropped silently; runtime edits of the attribute resubscribe and revert old effects.
- **Editor:** a third **Conditions** tab in the inspector (single-element selection; not views or component instances) with N6-style rows — topic input with MQTT autocomplete that accepts free text incl. `${param}` (U32 stamp-time parameterization), operator/value/action controls, per-action fields (class name; style key/value rows; attribute name select from the element's declared descriptor attributes with custom… fallback; keep-layout checkbox), add/reorder/remove; tab label shows the row count. Elements with conditions get a **👁 badge** (top-left, injected-CSS mask like the lock badge). **Effects are never applied in the editor.**
- 21 engine unit tests + 6 inspector-panel tests; TESTING.md §4 "Conditions (E50)" checklist; element-spec §4.5 documents the author-facing contract.

**Deferred (from the original entry):** conditions on a whole `feezal-component` instance (needs its own handling — `feezal-component` doesn't extend `FeezalElement`); fade transition on visibility toggle; "preview conditions in editor" toggle; `${value}` payload interpolation in effect values (E49 covers it meanwhile); multi-select editing. Documented behaviours: an attribute the element itself rewrites at runtime is last-writer-wins; condition-applied values live only in the viewer's DOM and are never persisted.

**Relates:** E49 (combined logic via script), E51 (SVG value bindings reuse the row UI/plumbing — sequencing satisfied: E50 landed first), U3, U32 (`${param}` composability), N6, E79 (`disabled` as the designated attribute-action target).

### E46 — Material navbar (`feezal-element-material-navbar`) ✅ done

A navigation element that switches between views — the persistent "menu" a multi-view dashboard needs. It renders a row (or column) of destination items; tapping one navigates to the target view. It complements the swipe gesture (E7) and the tile `navigate` action (E29): E7 is invisible/gesture-driven, E29 is a single per-tile button, and this is a dedicated, always-visible nav bar/rail.

**Navigation mechanism.** View switching in feezal is driven by the URL hash — `feezal-site` reads `location.hash` (`#/<viewName>`) and shows the matching `<feezal-view name>`, keeping the hash in sync on every change (see [feezal-site.js:68-73](../www/src/feezal-site.js#L68-L73) and `_viewChanged`). The navbar navigates by setting `location.hash = '#/' + viewName`; `feezal-site` does the rest, so it also stays in sync when the view is changed by any other means (swipe, MQTT `subscribe/view`, deep link). The available views are enumerated from `feezal.views` — useful for validation and for an "all views" default.

**`items` attribute — two accepted shapes.** A single JSON-array attribute defines the destinations, accepting either form (mix allowed):

```jsonc
// 1. bare view names — label defaults to the view name
["view1", "view2", "view3"]

// 2. label/view pairs — richer, optional per-item icon + badge
[
  {"label": "Home",    "view": "home",    "icon": "home"},
  {"label": "Climate", "view": "climate", "icon": "thermostat"},
  {"label": "Lights",  "view": "lights",  "icon": "lightbulb", "subscribe-badge": "home/lights/on-count"}
]
```

Per-item object keys: `view` (required — target view name), `label` (defaults to `view`), `icon` (optional Material icon name, resolved through the icon registry — N4/N20), `subscribe-badge` (optional MQTT topic whose payload renders as a numeric/dot badge on the item).

**Active-item highlighting.** The item whose `view` matches the currently active view (from the hash / `feezal-site.view`) gets the MD3 active indicator (filled pill + active label/icon colour). The element listens for `hashchange` so the highlight follows navigation from any source, not just its own taps.

**Attributes:**

| Attribute | Type | Default | Description |
|---|---|---|---|
| `items` | string (JSON) | `[]` | Destinations — array of view-name strings **or** `{label, view, icon?, subscribe-badge?}` objects (see above). Empty = auto-populate from all `feezal.views` in document order. |
| `orientation` | `horizontal` \| `vertical` | `horizontal` | Lay items out as a bottom/top nav **bar** (horizontal) or a side nav **rail** (vertical). |
| `show-labels` | `always` \| `active` \| `never` | `always` | MD3 label-visibility behaviour (mirrors Material's navigation-bar label options). |
| `show-icons` | boolean | `true` | Render each item's icon (when provided). Icon-only bars set `show-labels="never"`. |
| `align` | `start` \| `center` \| `space-between` | `space-between` | How items distribute along the main axis. |
| `subscribe` | mqttTopic | — | Optional — reflect an externally-driven active view (payload = view name); overrides hash-based highlighting when set. |
| `publish` | mqttTopic | — | Optional — publish the selected view name on tap (in addition to navigating), for cross-device sync. |

**Exposed CSS custom properties.** The element is meant to be themed per-site, so it exposes a documented token surface (defaulting to MD3 / `--feezal-*` theme variables so it inherits the active theme out of the box — see `element-spec.md §5.1`):

| Property | Default | Controls |
|---|---|---|
| `--feezal-navbar-background` | `--md-sys-color-surface-container` | Bar/rail background |
| `--feezal-navbar-color` | `--md-sys-color-on-surface-variant` | Inactive item icon/label colour |
| `--feezal-navbar-active-color` | `--md-sys-color-on-secondary-container` | Active item icon/label colour |
| `--feezal-navbar-active-indicator` | `--md-sys-color-secondary-container` | Active pill/indicator fill |
| `--feezal-navbar-gap` | `4px` | Space between items |
| `--feezal-navbar-item-padding` | `8px 12px` | Per-item padding |
| `--feezal-navbar-icon-size` | `24px` | Icon size |
| `--feezal-navbar-label-size` | `12px` | Label font size |
| `--feezal-navbar-radius` | `16px` | Active-indicator corner radius |
| `--feezal-navbar-elevation` | `none` | Optional box-shadow (e.g. a raised bottom bar) |

Padding/gap/icon/label tokens should default to container-query units where practical so the bar scales with the element (E38 pattern).

> **Conventions:** dual-payload — (n/a) · auto-discovery: — · custom inspector: **N6 recommended** (an items list-builder — add/reorder rows, pick a view from a dropdown of `feezal.views`, choose an icon) since hand-editing the `items` JSON is the main friction point. See [Element platform conventions](#element-platform-conventions).

**Editor preview:** renders the real bar with either the configured `items` or, when empty, the document's views — so the author sees the actual layout. Taps are inert in the editor (no navigation) to avoid switching the canvas view while editing.

**Default size:** 400×64 px (horizontal bar); 80×400 px (vertical rail).

**Implementation note:** `@material/web` does not ship a navigation-bar/rail component, so this is a small custom Lit element styled with MD3 tokens (or built on `md-tabs` if primary-tab semantics prove sufficient). Confirm which during implementation.


### E47 — App Layout element (`feezal-element-layout-app`) ✅ done

A **Layout-category app shell**: a full-bleed element with a top app bar and a collapsible left navigation drawer, whose main content area **embeds a named view and swaps it** as the user picks drawer entries. This is the modern Lit/MD3 rewrite of the legacy Polymer `feezal-element-paper-app-layout` (which had the chrome but never wired the drawer to navigation), landing in the new **Layout** category alongside E9 (`feezal-element-layout-flex`).

**Relationship to neighbours.** [E46](#e46--material-navbar-feezal-element-material-navbar) (navbar) is a *standalone* nav control that drives **whole-page** navigation via the URL hash; E47 is a *self-contained shell* whose drawer swaps **embedded** content while the bar+drawer chrome stays put. Different philosophies for different apps — a site uses one or the other, not both. Unlike E9, E47 does **not** expose a light-DOM `<slot>` on the canvas (its regions are chosen by attribute, not slotted children), so it sidesteps the editor pointer-interaction pitfalls E9 hit.

#### Resolved design (from refinement Q&A)

| Decision | Choice |
|---|---|
| Navigation model | **Embed & swap** the main content view (chrome persists); optionally mirror the selection to the URL hash / an MQTT topic. |
| Drawer responsiveness | **Persistent** on wide; collapses to an **overlay + hamburger** below a breakpoint. |
| Menu entry fields | **`{label, icon, view}`** per entry. |
| Top bar | **Hamburger + title + right-aligned action icons.** |

#### Structure & behaviour

- **Full-bleed shell.** Like the paper element: pinned to the view (`top/left:0`, `100%×100%`, `restrict:{move:false,resize:false}`) so it owns its host view. Internally a CSS grid/flex: top bar row + (drawer | content) row.
- **Content area — embed & swap.** Hosts the *active entry's* view using the same approach as `feezal-element-basic-view`: in the **viewer**, clone the target `<feezal-view>` (stripping the inactive `display:none`); in the **editor**, show a lightweight placeholder ("View: <name>") — never a live nested render, to avoid recursion. Switching entries just re-points the content host at the new view. A **recursion guard** (a content view must not embed a view that contains this shell) is noted as a follow-up, mirroring E9.
- **Active selection.** Internal `_active` state, defaulting to the first entry (or an `active-view` attribute). Optional `subscribe` (payload = view name → switch) and `publish` (emit selected view on change) for cross-device sync, plus optional URL-hash mirroring so entries are deep-linkable.
- **Responsive drawer (container query, not viewport).** Use `container-type: inline-size` on the shell and a `@container (min-width: …)` breakpoint (E38 pattern) so behaviour tracks the element's *own* width and stays correct in the editor at any preview size. Above the breakpoint: drawer persistent, hamburger hidden. Below: drawer is an overlay with a scrim, toggled by the hamburger; tapping an entry (or the scrim) closes it. Breakpoint is a configurable attribute (default ~768px). On narrow, remember open/closed for the session.
- **Top bar.** Hamburger (shown only below the breakpoint, or always if configured) · title (`title` attribute, optionally driven by an MQTT `subscribe-title` topic) · a right-aligned **actions** area. For the MVP, actions are a small configurable list of icon-buttons that publish an MQTT payload on tap (`{icon, publish, payload}`); richer action types later.
- **Drawer entries.** Rendered from an `items` JSON-array attribute of `{label, icon, view}` (icon = Material icon name via the icon registry, N20/N4). The active entry (matching `_active`) gets the MD3 active indicator (filled pill + active colour).

#### Attributes (draft)

| Attribute | Type | Default | Description |
|---|---|---|---|
| `items` | string (JSON) | `[]` | Drawer entries: `[{label, icon?, view}]`. |
| `title` | string | `''` | Top-bar title. |
| `subscribe-title` | mqttTopic | — | Optional — drive the title from MQTT. |
| `active-view` | string | first entry | Initially selected content view. |
| `breakpoint` | number (px) | `768` | Width below which the drawer becomes an overlay. |
| `drawer-persistent` | boolean | `true` | If false, always overlay (hamburger at all sizes). |
| `actions` | string (JSON) | `[]` | Top-bar action buttons: `[{icon, publish, payload}]`. |
| `subscribe` / `publish` | mqttTopic | — | Optional external active-view sync (payload = view name). |

**Styles / tokens:** `--feezal-app-bar-bg`, `--feezal-app-bar-color`, `--feezal-app-drawer-bg`, `--feezal-app-drawer-color`, `--feezal-app-drawer-width`, `--feezal-app-active-color`, plus `background`/`border` — each defaulting to MD3/`--feezal-*` theme vars so it inherits the active theme.

#### Editor UX

- **Custom N6 inspector** (like E9's region manager): an entries list-builder — add / reorder / remove rows, each with a **view picker** (dropdown of `feezal.views`), a **label** field, and an **icon picker** (N20); an **✎ edit** button per entry to jump to editing that content view (`feezal.app._setView(name)`); an **＋ add** that can create-and-embed a new blank view (mirroring E9's `_addRegion`, reusing the synchronous-hide fix so new views don't reflow the canvas). Plus top-bar fields (title/subscribe-title), the actions list, and drawer options (breakpoint, persistent).
- **Canvas preview:** render the real bar + drawer chrome with the placeholder content pane; drawer taps switch the previewed pane but are otherwise inert (no viewer navigation). Because entries are attribute-driven (no `<slot>`), there are no nested editable children to manage.

#### Implementation notes

- **No MD3 nav-drawer:** `@material/web` dropped its navigation-drawer component, so hand-roll the drawer/bar with CSS (flex + container query); use `md-icon-button` for the hamburger and actions — **render glyphs as `<span class="mi">` with the loaded 'Material Icons' font, not `<md-icon>`** (the recurring unloaded-Material-Symbols gotcha).
- Reuse `feezal-element-basic-view`'s clone-in-viewer / label-in-editor logic for the content pane rather than reinventing it.
- **Default size:** full view (fills its host); `restrict` disables move/resize.


### E44 — Pin protection element ✅ done
A view can require a PIN to enter (rendered in the viewer). Useful for settings or admin pages on a shared display. => Let's make an element for that. The element renders only a placeholder in the editor (category system) and just adds a fullscreen overlay that disappears when pin is entered correctly. write security notes in user documentation: this is not safe, user can bypass it very easily. 


### E45 — Responsive / breakpoint layouts ✅ done

Dashboards need to look right on a phone, a tablet, and a wall display. feezal elements are **absolutely positioned**, so they don't reflow — a layout hand-placed for 1920×1080 is unusable at 390 px. The goal: let a site present a **different layout per viewport class**, chosen automatically.

#### Decision — a responsive *layout element*, not per-view breakpoint variants

Two ways to do this:

| Approach | How | Verdict |
|---|---|---|
| **A — Breakpoint variants baked into every view** | Each `feezal-view` stores N element sets (desktop/tablet/mobile); the editor gets a breakpoint switcher; the viewer shows the set matching the viewport. | ❌ Heavy: every element duplicated per breakpoint inside one view, complex editor state, and absolute elements still don't reflow — you're hand-laying each variant anyway. |
| **B — A responsive layout element that swaps whole *views* by breakpoint** *(chosen — matches the user's instinct)* | A layout element assigns a **named view** to each breakpoint and renders the matching one, reusing the **E9 region-view embed** mechanism (`feezal-element-layout-flex`). | ✅ Minimal new code (E9 already embeds named sub-views), the author edits ordinary views, and mobile vs desktop can be *radically* different layouts, not just reflowed ones. |

**Chosen: B.** You author separate views (e.g. `Home·desktop`, `Home·mobile`) and drop a responsive element on a thin **shell view** that the nav points at; the element renders whichever assigned view matches the current viewport.

#### `feezal-element-layout-responsive`

A full-canvas pseudo-container (Layout palette category, like `layout-flex`). Config is an **ordered list of breakpoint rules**, each mapping a viewport predicate to a view to embed:

```
rules: [
  { view: "Home·mobile",  maxWidth: 600 },
  { view: "Home·tablet",  maxWidth: 1024, orientation: "portrait" },
  { view: "Home·desktop" }                       // fallback (no predicate = always matches)
]
```

- **Predicates:** `minWidth` / `maxWidth` (px) and optional `orientation: portrait | landscape`. Rules are evaluated **top-to-bottom; first match wins**, so ordering *is* priority — and portrait/landscape falls out naturally (add an orientation'd rule above the width-only one).
- **Fallback:** the last rule with no predicate is the default when nothing else matches.
- **Defaults** offered in the inspector: mobile `<600`, tablet `600–1024`, desktop `≥1024` — all editable.

#### Runtime (viewer)

- A single `matchMedia` set (or a `ResizeObserver` on the container) evaluates the rules and mounts **only the matching view** into the container — same embed path as E9 flex regions.
- **Only the active view is in the DOM**, so its elements' MQTT subscriptions are the only live ones — no double-subscribing the same device across breakpoints (a real concern if all variants were mounted). On breakpoint change, unmount the old view, mount the new.
- Cheap: media-query listeners, no polling.

#### Editor UX

- **Inspector (N6 custom):** the rule list — per row: assigned view (pick existing / create), `min/max width`, `orientation`, and drag-reorder (order = priority); add/remove; a "fallback" marker on the predicate-less rule.
- **Breakpoint switcher:** a segmented control (📱 / ▭ / 🖥) on the element (mirrors E9's region-edit navigation) that (a) previews a breakpoint by clamping the canvas to a representative device width, and (b) jumps the editor into the assigned region-view to edit it.
- The assigned views are **ordinary views**, hidden from the nav tab bar (folder them via U8, exactly like E9 slot sub-views) so they don't clutter navigation.

#### Storage & composition

- Rules serialize as a JSON attribute on the element in `site.html` (like E9's slot config); assigned views are normal `<feezal-view>`s.
- **Composable:** an assigned view can itself contain a `layout-flex` (or another responsive element) — responsive *outer* choice + flexible *inner* regions. The E9 viewer **recursion guard** already prevents a view embedding itself.

#### Relationships

- **E38 (element scaling / container queries)** is complementary — *within* a chosen layout, elements still scale to their box. E45 picks the layout; E38 makes each layout elastic.
- **E7 (swipe)** and **U13 (viewer mobile support)** pair naturally for the mobile layouts; **A9 (PWA export)** is the delivery vehicle.

#### Open questions

- **Site-level responsive?** Should the whole active view be swappable by breakpoint at the `feezal-site` level (bypassing the shell-view + element), or is element-first enough? Element-first is cleaner and composable — start there; a site-level mode is a later extension.
- **Shared content across breakpoints.** The same device card must be authored in each breakpoint view (duplicated wiring). Acceptable for MVP; a future "shared element / symbol" concept could de-duplicate. Note it.
- **Editor preview fidelity.** Clamping the canvas width approximates a device; a full device-frame preview (with the viewer's real CSS) is a nice-to-have, not MVP.
- **Default breakpoint thresholds** and whether to expose a global site default vs per-element.


### E9 — Flexbox layout element (`feezal-element-layout-flex`) ✅ done (v1)

A Layout-category flexbox **container** element. Its regions are `feezal-element-basic-view` children (light DOM) that each embed an **ordinary named view**.

**Implementation:**
- Container flex settings are attributes — `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap` — applied to a shadow flex wrapper around `<slot>`; per-region flex (`flex-grow`/`shrink`/`basis`, `min-width`) is stored as **inline styles on each region's `basic-view`**.
- **Custom N6 inspector** (`feezal-element-layout-flex-inspector`) manages the element directly via its `.element` ref: Layout controls (direction/justify/align/gap/wrap) dispatch `feezal-attribute-changed`; the Regions list adds (creates a new blank view via `feezal-view` + `feezal.app.views`/`requestUpdate`, then embeds a `basic-view`), removes, reorders (DOM sibling swap), re-points a region's `view`, edits per-region flex, and an ✎ button calls `feezal.app._setView(name)` to jump to that region's view. Each change calls `element.requestUpdate()` + `feezal.app.change()`.
- Editor shows an empty-state hint until regions are added; regions render `basic-view`'s editor placeholders (view-name labels), not live content. Responsive: `flex-wrap` + per-region `min-width`.
- Slot sub-views are ordinary views (organise via folders; removing a region leaves the view untouched).

**Deferred (v2):** drag-and-drop visual layout-preview inspector; live nested previews in the editor; a view-cycle recursion guard in the viewer (a region must not embed a view that contains this container).

### E15 — Media player element (`feezal-element-material-media-player`) ✅ done

A compact MD3 media/music control card (Device category). Album art (`subscribe-artwork-url` topic or static `artwork-url`, with an `album` icon fallback), title/artist/album metadata, a draggable div-based seek bar showing `mm:ss / mm:ss` (publishes target seconds to `publish-seek` on release), a transport row (previous / rewind / play↔pause auto-toggled from the `subscribe` playback state / forward / next / stop / tinted shuffle toggle / cycling repeat), and an optional 0–100 volume slider. Standard flat inspector; custom N6 inspector deferred (noted in-file).

### E17 — Alarm panel element (`feezal-element-material-alarm-panel`) ✅ done

A security alarm control panel (Device category): a colour-coded state banner (flashing on `triggered`, pulsing on `pending`), a masked PIN display, a 3×4 keypad, and a mode-button row from a `modes` JSON array. Publishes `{"action","code"}` JSON to `publish-action` on arm/disarm and clears the PIN immediately (never stored). `require-code-to-arm` gates arming; disarm always requires a code. Includes HA `alarm_control_panel` discovery. Custom N6 inspector deferred.

### E19 — Humidifier / dehumidifier element (`feezal-element-material-humidifier`) ✅ done

A humidifier/dehumidifier card (Device category) reusing the climate element's circular arc geometry. Draggable target-humidity arc (publishes to `publish-target-humidity` on release), current humidity in the centre, centre tap toggles on/off (`publish-state`), optional `md-filter-chip` mode row, and a `type` (humidifier/dehumidifier) that switches the arc accent between blue and amber via `--feezal-humidifier-*` vars. Includes HA `humidifier` discovery. Custom N6 inspector deferred.

### E21 — Robot vacuum element (`feezal-element-material-vacuum`) ✅ done

A robot-vacuum control card (Device category): a top-down SVG robot disc that slow-spins while cleaning and tints/`!`-overlays per state, a coloured status label, a battery bar (green/amber/red), a control-button row (start / pause / stop / return-home / optional locate → `publish-command`), and an optional fan-speed chip row (`fan-speeds`). Includes HA `vacuum` discovery. Custom N6 inspector deferred.

### E43 — Template body for dialog and countdown-dialog ✅ done

`feezal-element-material-dialog` and `feezal-element-material-countdown-dialog` had a plain `message` string attribute; it was replaced with a `template` attribute evaluated as a JavaScript template literal at runtime (like `feezal-element-basic-template`).

**Implementation:**
- **Attribute rename** `message` → `template` (breaking change → minor bump on both packages, 1.1.0).
- Both elements capture the triggering MQTT message as `this._msg` (state) and expose it to the template; `countdown-dialog` also passes `seconds` (the live remaining count).
- Evaluation: `new Function('msg', 'return \`'+tpl+'\`;')(this._msg)` for the dialog; `new Function('msg', 'seconds', …)(this._msg, remaining)` for the countdown. Errors are caught and logged; the body is left empty on error. With no message yet, `msg = {}`.
- Result rendered via `unsafeHTML(...)` where the old `message` was used (added the `unsafeHTML` import to countdown-dialog).
- **Editing UI:** the value is stored as a plain attribute (not a `<template>` child). countdown-dialog uses the standard inspector's Monaco template editor (`textarea + editor`, `variables: ['msg','seconds']`); the dialog's custom inspector embeds `<feezal-template-editor>` directly (`variables: ['msg']`).
- Default countdown template: `` `Proceeding in ${seconds}…` ``.

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

### U32 — Composed elements: reusable parameterized components ✅ MVP implemented

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

### U33 — Element stacking order via context menu ✅ implemented

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

### U34 — Bundle size breakdown in the editor ✅ implemented

Show the user how big the export bundle is and **what makes it that big** — the export size used to be a single opaque number, so "should I drop this heavy element?" had no data.

**Implemented (July 2026):**

- **Data source (as sketched):** the filtered Vite build in `server/src/build/export.js` already carries per-module byte attribution — the output chunk's `modules` map (`renderedLength` + rendered `code` per module id). `buildBundleReport()` aggregates it into buckets: one per `@feezal/feezal-{element,theme,icons}-*` package, `@feezal/feezal-element (runtime)`, one per top-level vendor dep (lit, mqtt, …), and `feezal core` (www/src viewer runtime + virtual helper modules). Handles workspace real paths (symlink-resolved `packages/@feezal/…`), scoped deps and win32 ids.
- **Minified + gzip, honestly labelled estimates:** per-module data is pre-minification, so bucket bytes are pro-rata scaled to the exact minified total; per-bucket gzip compresses each bucket's concatenated source independently and normalises so the columns add up to the exact whole-bundle gzip. Totals are exact, rows carry `estimate: true`.
- **Cached with the bundle** (same key — the report is a by-product of the build that already runs) and served by `GET /api/sites/:name/bundle-report` via `exportBundleReport()`, which also appends the post-build tree-shaken icon registrations as an `icons (tree-shaken)` bucket. Falls back to an error (→ dialog warning) when only the unattributable full-bundle fallback is available.
- **UI — the decided cheap MVP:** Export now opens `feezal-export-dialog` (new `www/src/feezal-export-dialog.js`): totals header (minified / ~gzip kB), sorted plain-CSS bar list with per-row name, kB, ~gz kB, % of total, top-3 contributors highlighted; **Download ZIP** button does the actual export (the mqtt:// guard dialog is unchanged). First-run note while the build runs; re-opening is instant (cache).
- 9 server tests (bucketing, normalisation, null-metadata fallback, report ⇄ export cache sharing, fallback throw) + 4 www tests (formatKb, render/sort/highlight, error states); TESTING.md §10 checklist entry.

**Not done (as scoped):** treemap/pie upgrade, live-viewer bundle report, "zip contents" (assets/fonts/icons) breakdown.

**Relates:** N12/N13 (export bundle slimming — this makes the win visible), A8 (the filtered build this piggybacks on), N27 (user-installed packages would appear as buckets once exportable).

### U36 — Inspector: debounced live-apply on typing (not only on blur) ✅ implemented

Text/number inputs in the attribute and style inspectors only committed on blur/Enter (Shoelace `sl-change`) — no canvas feedback while typing.

**Implemented (July 2026):**

- **Debounced live-commit on `sl-input`** for the free-text controls in both panels — default text/number inputs, textareas, colour text inputs and topic inputs in the attributes panel (`_liveChange`/`_flushChange`); the style value inputs in the styles panel (`_liveInput` composing with the existing `var(--…)` autocomplete). The canvas updates `LIVE_APPLY_DEBOUNCE_MS` (250 ms, a shared exported constant) after the last keystroke.
- **`sl-change` is the immediate flush:** blur/Enter (and a picked topic completion / var-autocomplete selection) cancels the pending debounce and commits right away.
- **Undo coalescing:** live commits apply to the element **without** a history checkpoint (`feezal.app.change()` suppressed); the flush pushes exactly one — a typing burst is one undo step. (Side-effect fix: the default text and topic inputs previously *never* checkpointed history on commit — the dead `_blur`/`hasChange` path; they now do, via the flush.)
- **Context-switch safety:** pending timers are cancelled whenever `selectedElems` changes in either panel, so a debounced value can never fire against a different element.
- **Caret safety:** the re-render writes back the identical typed string (no caret move); in the styles panel a transiently invalid live value ("re" of "red") keeps the typed text in the item instead of resetting the input mid-typing (the flush keeps the old reset-to-last-valid behaviour).
- **Discrete controls unchanged:** selects, checkboxes, the colour picker swatch, dropdowns, the list editor and the icon picker keep their immediate `sl-change` commits.
- 7 unit tests (burst applies once after the debounce without history, flush cancels + single checkpoint, burst+flush = one undo step, selection-switch cancel — for both panels); TESTING.md live-apply bullet.

**Relates:** the attribute/style inspector panels, U35 (same inspector surface), the undo/history machinery (`feezal.app.change(noHistory)` gating).

### U35 — Generic list editor for label/value array attributes ✅ implemented

Several elements carried a **JSON array attribute** that the generic inspector rendered as a raw JSON string input — hand-editing `[{"value":"a","label":"Option A"},…]` is exactly the syntax the inspector exists to avoid.

**Implemented (July 2026):**

- **New descriptor type `type: 'objectList'`** with an `itemFields` spec (`{key, type?, options?, placeholder?}`; field types `string` | `number` (emits numbers) | `color` (text + swatch) | `select`; default `[{key:'label'},{key:'value'}]`). A single field with an empty `key` switches to **bare-string items** (`["low","high"]`). The legacy `list: true` + `columns` form maps onto the same control.
- **The control** (`feezal-editable-list`, reworked — the old `list:true` variant was broken and unused): one row per item with per-field inputs, ＋ add, per-row ✕ delete, and **HTML5 drag-handle reordering**. The raw JSON attribute string stays the single source of truth (source mode / MQTT `setattribute` / saved views untouched); **unparseable values fall back to a raw text input — never destroyed**.
- **Adopted** in the six raw-JSON elements: `material-radio` `options` (1.0.4), `material-select` `options` (1.1.2), `material-alarm-panel` `modes` (0.1.2), `material-humidifier` `modes` (0.1.2), `material-fan` `preset-modes` (bare strings, 1.0.5), `material-computer-stats` `rings` (`{slot,label,color,max}` with colour swatch + numeric max, 1.0.3).
- 8 unit tests (row rendering, add/delete, per-field patch, drag reorder, bare mode, number emission, invalid-JSON fallback + raw pass-through, empty value); element-spec §3.2.1 rewritten for the new type; TESTING.md list-editor section.

**Deferred (from the entry):** `mqttTopic` autocomplete inside list fields (plain text works meanwhile); adopting the control inside the custom N6 inspectors (navbar/layout-app/layout-responsive keep their hand-rolled rows — they'd mainly gain drag-sort) and climate's raw-JSON textarea (lives in its custom inspector).

**Relates:** N6 (custom inspector machinery — this removes the main reason small elements needed one), element-spec §3.2.1, U32 (composed-element params could reuse the control later).

### U9 — AI coding assistant ✅ done

> **Status: 🔨 Phases 1–3 done.** Phases 1 & 2 (design + source mode, OpenAI-compatible / Ollama / Anthropic providers, server-side conversations + history, file context) and Phase 3 (agent/tools mode — archived U26/U27; new-view creation via the `<!-- @new-view: Name -->` directive) are implemented. The template-editor sparkle button was **dropped** (not wanted). Minor Phase-2 polish remains deferred (Monaco diff-overlay, whole-document source scope, context-window ring). See [Phasing](#phasing).

An AI chat assistant integrated into the feezal editor, inspired by [hobbyquaker/she](https://github.com/hobbyquaker/she)'s Monaco-based assistant. Unlike she (which is source-only), feezal's assistant works in **both** editing modes:

- **Design mode (live canvas)** — the default. The assistant edits the view's HTML under the hood; the user never sees raw HTML. Before applying, it asks for a simple **confirmation** ("Changing the current view…") and then applies the change straight to the canvas.
- **Source mode (Monaco, N15)** — proposals are shown as a Monaco diff overlay, as in she.

The model contract is identical in both modes (it always returns the full proposed view HTML); only the *presentation and apply* differ by mode.

> **Prerequisite:** U7 (Monaco bundled + `feezal-monaco-loader.js`) and N15 (source view) are required for source-mode diffs. Design mode depends only on the editor canvas and works without the source view.

#### Entry point — toolbar button (config-gated)

A single **icon-button** toggles the assistant:

- **Position:** rightmost in the editor top bar, after the sidebar-tab icon row in `#menu-right` (the last control in the [feezal-app-editor.js](../www/src/feezal-app-editor.js) toolbar).
- **Icon:** a small **android** glyph (`android` Material Icons ligature), using the existing `.icon-btn` + `<span class="material-icons">` style — same size, hover, and `.active` treatment as the Inspector / Theme / Palette buttons — so it reads as a native toolbar control.
- **Conditional visibility:** the button renders **only when an AI backend is configured** in the Editor Settings tab. With no provider/key set it is hidden entirely (discoverability comes from the settings panel, not a dead button). Visibility reacts live to a `feezal:ai-config-changed` event, so enabling a backend reveals the button without a reload.
- **Active state:** while the panel is open the button shows the standard `.active` highlight.

#### Panel layout & UX

The assistant is a **resizable panel docked to the right window edge**, overlaying the right-sidebar region (never the canvas), with a drag handle on its left border (min ~320 px, max ~640 px; width persisted to `localStorage`). A single `feezal-ai-chat` Lit element is reused unchanged in both modes.

Visual design takes cues from **Claude Code / Claude's chat UI** — calm, content-first:

- Vertical message stream: user turns right-aligned in a subtle bubble; assistant turns full-width plain text with comfortable line-height; generous spacing; monospace only inside code / indicator blocks.
- Slim header: conversation title, model selector, new-conversation (＋) and history (🕘) actions.
- Bottom **composer**: auto-growing textarea, an animated "thinking" affordance while streaming, and a stop (■) button that replaces send during a request.
- In design mode a proposal shows a compact **confirmation card** (see Apply flow) rather than walls of code.
- **Dark/bright mode:** the panel inherits the editor theme. All colours route through the existing feezal CSS custom properties (`--feezal-bg`, `--feezal-color`, `--feezal-border`, `--sl-color-*`) and the `:host(.dark)` propagation already used for the other editor panels — no hardcoded hex. Code blocks and the Monaco diff use the matching light/dark theme. Verify both themes before shipping (element-spec §8.2 discipline).

```
┌───────── editor top bar ──────[Inspector][Theme]…[Editor][🤖]┐
├──────────────────────────────────────────┬──────────────────┤
│                                           │ 🤖 Assistant   ＋🕘│
│   Canvas (design mode)                    │──────────────────│
│   — or — Monaco (source mode)             │   …user…         │
│                                           │   …assistant…    │
│                                       ⟷ ◀│  ┌─ confirm ────┐ │  ← drag handle
│                                       drag │  │ Change view? │ │
│                                           │  │  ✓ Accept  ✕ │ │
│                                           │  └──────────────┘ │
│                                           │──────────────────│
│                                           │ context chips    │
│                                           │ [ textarea ] ▶/■ │
└───────────────────────────────────────────┴──────────────────┘
```

#### Context sent to the model

A **context chips row** sits above the composer (she-parity):

| Context piece | Source | Control |
|---|---|---|
| Target view HTML | design: the active canvas view (implicit). source: a view chosen via the target-view selector (see below) | toggle / view-scope chip |
| Feezal element catalogue | `feezal.elements` + each `static get feezal()` (name, attributes, defaultStyle) | toggle (default on) |
| Known MQTT topics | `/api/topics/completions` topic trie | toggle (default on) |
| Element-spec reference | bundled `docs/element-spec.md` excerpt | toggle (default off) |
| Extra files | user-added other views' HTML, element sources, arbitrary text/markdown | per-file chip |

Adding files matches she exactly: a **"+" button** opens a hidden `<input type="file" multiple>`, **drag-and-drop** onto the panel adds files, and each becomes a removable chip `{name, content}` with a language badge. The current-view chip can be toggled off to ask general questions without sending the view.

A **prompt-size indicator** shows the estimated request size (bytes + rough token count). When the active model's context window is known (e.g. via Ollama model info), a small **context-usage ring** visualises `promptBytes / contextWindow`, as in she.

The element catalogue is serialised as compact JSON in the system prompt so the model emits valid element tags, attribute names, and defaults without hallucinating APIs.

#### View scope (source mode has no active view)

Unlike design mode — where the active canvas tab *is* the working view — source mode loads the **entire site** into Monaco (`feezal.site.outerHTML`, every view — see [feezal-app-editor.js:1295](../www/src/feezal-app-editor.js#L1295)), so there is **no implicit current view**. Therefore, in source mode:

- The context row shows a **target-view selector** listing the document's `<feezal-view name>`s plus a **"Whole document"** option.
- If the user sends an edit request **without** having picked a target, the assistant **asks first** — *"Which view should I work on?"* — and lists the available views, rather than guessing.
- The chosen view's `<feezal-view>` block is what gets sent as context and what the model's reply replaces. Splicing is keyed by the view's **`name` attribute** (unique within a site); the prompt instructs the model to **preserve `name`** and not rename or reorder views, so the target block is unambiguous. If a scoped reply's `name` does not match the target (model renamed/dropped it), the apply is **rejected** rather than guessed.
- **"Whole document"** scope is reserved for genuine cross-view edits (e.g. renaming an MQTT topic across every view); the reply must echo **every** `<feezal-view>` back, and the Monaco diff is the safety net for that larger change.

#### System prompt & output contract

The system prompt is the contract that makes wholesale view replacement safe (there is no `data-fid` reconciliation — an omitted element is a deleted element). It is kept as a **server-side template** (tunable without a client release), stamped with the feezal version, and assembled per request. It must specify:

**Role & domain.** "You edit feezal *views*: HTML made of absolutely-positioned `<feezal-element-*>` custom elements driven by MQTT. Position/size live in inline `style` (`position:absolute; top/left/width/height`)."

**Output contract (load-bearing):**
- Return the **complete** HTML for the working scope — never a fragment. The editor **replaces the whole scope** with the reply, so any element you omit is **deleted**. Echo unchanged elements **verbatim** (same tags, attributes, inline styles, order).
- Make the **minimal** change the request needs.
- Emit exactly **one** ```` ```html ```` fenced block; prose/explanation goes **outside** it.
- Scope boundary: design mode → the view's **inner** elements only (no `<feezal-view>` wrapper); source mode → the chosen `<feezal-view name="…">…</feezal-view>` block(s) intact (see View scope).
- **Edit vs. answer:** for questions ("what does this view do?") reply in prose with **no** code block — the *absence* of a block is the signal not to apply.

**Element rules (ground truth = the injected catalogue):**
- Use only element tags and **kebab-case attributes present in the catalogue** — never invent elements or attributes.
- Wire MQTT via `subscribe` / `publish` / `message-property`; honour each element's `defaultStyle` / `restrict` minimums when adding.
- Prefer topics from the **Known MQTT topics** list; if you must guess a topic, say so in prose.

**Reliability aid:** include one tiny **few-shot example** (a small view + a request + the correct full-HTML reply) — the cheapest way to lock the output format.

The prompt is **mode-agnostic** (identical for design and source); only the client-side *apply* differs.

#### Output validation & safety (client-side)

The system prompt asks for clean output, but the client **must not trust it** — model HTML is injected into the live DOM and persisted into saved views. Before applying (both modes), the editor parses and **validates** the proposed HTML and **rejects** it with an error card if it contains any of: a non-`feezal-element-*` / non-whitelisted tag, `<script>` / `<iframe>` / `<object>`, any `on*` event-handler attribute, `javascript:` URLs, or an element tag not present in the catalogue. Inline `style` is constrained to a safe property set. A rejected proposal shows "Can't apply — `<reason>`" with the raw HTML available in the expander; it is **never** silently applied.

#### Apply flow — branches by editor mode

**Design mode (confirmation, no HTML shown):**

1. The model's HTML code block is parsed (`parseBlocks()`, ```` ```html ```` fences) but **never rendered as text**.
2. A simple **confirmation card** appears in the chat — *"Changing the current view…"* — with actions **Accept** · **Discard** · **Always accept** (session flag, per she's auto-apply). No per-element diff is computed or shown.
3. **Accept** applies the proposed HTML to the canvas via the existing N15 apply path (the inspector already rewrites `feezal-view.innerHTML` and rebinds interact.js — see [feezal-sidebar-inspector.js:398](../www/src/feezal-sidebar-inspector.js#L398)), then calls `feezal.app.change()` **exactly once**, which pushes a single whole-site `innerHTML` snapshot onto the editor undo stack (`_history`) — so one Ctrl+Z reverts the entire change. *(Caveat: that stack is shallow — ≈5 entries, shared with manual edits — so AI changes do not get unlimited undo depth.)* A toast confirms ("View updated").
4. Optional **"view as HTML"** expander (collapsed by default) for power users who do want to see the raw diff.

> **Apply timing & failures:** the code block is parsed only **after** the stream completes (no apply on partial output). If an *edit* request yields no code block, the assistant treats the reply as an answer and shows no card; if a reply fails [Output validation](#output-validation--safety-client-side), it surfaces the error card instead of applying.

**Source mode (Monaco diff, she-style):**

0. **Establish the target view first.** Monaco holds the whole site, so if no target view is selected the assistant asks which view to work on before proposing changes (see *View scope* above); "Whole document" is allowed for cross-view edits.
1. The model returns the proposed HTML for the chosen scope (the target `<feezal-view>` block, or the whole document). An **Apply** button opens a `MonacoDiffEditor` overlay: left = current buffer, right = proposed — the editor splices a view-scoped reply back into the correct `<feezal-view>` block before diffing.
2. Toolbar: **Accept** (writes to the Monaco model) · **Discard** · **Always accept**.
3. After accepting, the user saves normally (Ctrl+S).

Both modes also support a **new-view directive** ✅ — the model begins its `html` block with `<!-- @new-view: Name -->` to create a new view instead of editing the current one (feezal's take on she's `// @new-file:` hint).

#### Template editor integration (U7 follow-up)

A simpler **sparkle button** (✨) appears next to the template textarea / Monaco editor in the attribute inspector. Clicking it opens a compact prompt popup: "Describe what the template should display" → calls the AI with the element's `subscribe` topic and last known payload as context → streams the generated template string directly into the editor. No diff view — the result replaces the current template immediately (the user can Ctrl+Z to undo).

#### Backend & providers

A server endpoint proxies AI requests and streams responses:

```
POST /api/ai/chat        { messages, context, model } → SSE text/event-stream (token stream)
GET  /api/ai/config      → { configured, provider, model }   (never returns the API key)
GET  /api/ai/models      → available models for the configured provider
GET  /api/ai/model-info  → context window / params (Ollama), when available
```

The server builds the full system prompt (context injection) and streams tokens so the panel shows partial output live, with a stop button (AbortController) that saves the partial reply.

**Supported providers** (configured in server config, she-parity selection UX):

| Provider | Auth | Notes |
|---|---|---|
| OpenAI | `apiKey` | `gpt-4o`, `gpt-4.1`, … |
| Anthropic | `apiKey` | `claude-sonnet-4-5`, … |
| Ollama (local) | none | `http://localhost:11434` — fully offline; exposes context-window info |
| OpenAI-compatible | `apiKey` (optional) | LM Studio, llama.cpp, vLLM, … |

- The panel header has a **model dropdown** populated from `/api/ai/models`, with the choice persisted to `localStorage` (`feezal:selectedModel`).
- Config is **global per server** (not per-site). The API key / endpoint are stored in the server config and **never** sent to the browser or written into `views.html`.
- The **Editor Settings tab** (`feezal-sidebar-editor.js`, `build` icon) gains an **AI** section: provider select, API key / endpoint inputs, model select, and a "Test connection" button. Saving emits `feezal:ai-config-changed`, which both reloads the panel's config and toggles the toolbar android button's visibility live.

#### Conversations

Following she, conversations persist **server-side** so history survives reloads and is browsable:

```
POST   /api/ai/conversations          save { id, title, messages }
GET    /api/ai/conversations          list { id, title, updatedAt }[]
GET    /api/ai/conversations/:id      load full message log
DELETE /api/ai/conversations/:id      delete
```

- A `conversationId` (generated client-side) is kept in `localStorage`; the title is the first user message (truncated).
- The panel header exposes **New conversation** (＋) and a **history** (🕘) timeline of past conversations, with delete.
- Context (current view + extra files) refreshes automatically when the user switches views or editing modes.

> Supersedes the earlier "localStorage-only, no server persistence" idea — she-parity (browsable history) requires server-side conversations.

#### Phasing

The full spec is large; build incrementally so each phase ships value and de-risks the next.

- ✅ **Phase 1 (MVP) — done:** design mode; OpenAI-compatible + Ollama providers; `localStorage` conversations; element-catalogue + known-topics context; confirmation-card apply with client-side **output validation** and the server-built **system-prompt contract**; config-gated android toolbar button + right-docked resizable panel + AI settings section.
- ✅ **Phase 2 — done:** source mode (target-view selector + Monaco-buffer context + splice-apply via `executeEdits`); Anthropic native provider; **server-side** conversations + history timeline; file-context chips (＋ / drag-drop) + prompt-size (token) estimate.
  - *Deferred within Phase 2:* the separate **Monaco diff-overlay**, the **"Whole document"** source scope, and the **context-window usage ring** (needs a provider model-info endpoint).
- ✅ **Phase 3 — done:** agent / tools mode (archived **U26** / **U27** in [ROADMAP-ARCHIVE](ROADMAP-ARCHIVE.md)) and new-view creation (via the `<!-- @new-view: Name -->` output directive). *(Template-editor sparkle button dropped — not wanted.)*

Phases 1–2 shipped across commits (`2220abd`, `529e85a`, `4fe798b`, `5912450`, `ef56757`, `37fddff`). The Scope list below is the full feature.

#### Scope
1. `server/src/routes/api.js` — `/api/ai/chat` (SSE), `/api/ai/config`, `/api/ai/models`, `/api/ai/model-info`, and `/api/ai/conversations` CRUD.
2. `server/src/app.js` — AI config loading (`config.ai: { provider, apiKey, model, endpoint }`) + conversation store (flat files under `<dataDir>/ai/`).
3. `www/src/feezal-ai-chat.js` — new Lit element: right-docked resizable panel, message stream, streaming + stop, context chips (+ add / drag-drop), model dropdown, prompt-size / context ring, dual-mode apply (design confirmation / source Monaco diff), conversation history. Claude-Code-inspired styling; full dark/bright support via feezal CSS vars.
4. `www/src/feezal-app-editor.js` — rightmost **android** `.icon-btn` in the top bar, gated on AI-configured; mount `feezal-ai-chat`; single-undo apply integration.
5. `www/src/feezal-sidebar-editor.js` — **AI** settings section (provider / key / model / endpoint, test) emitting `feezal:ai-config-changed`.
6. ~~`www/src/feezal-template-editor.js` — sparkle button for template generation~~ — **dropped** (not wanted).

#### Out of scope (MVP)
- AI in the viewer (the assistant is editor-only).
- **Agent / tools mode** — letting the model query live MQTT values / last payloads to ground its answers (feezal's analog of she's `ctxTools`). ✅ **Done** — see archived **U26** in [ROADMAP-ARCHIVE](ROADMAP-ARCHIVE.md).
- ~~`// @new-file:` → new-view creation~~ — ✅ done (via the `<!-- @new-view: Name -->` directive).
- Per-site AI configuration — one global config per server is enough.


### U28 — AI chat: render assistant messages as Markdown ✅ done

> **Status: ✅ implemented** — assistant replies and the live findings narration render Markdown via `marked`, sanitized with `DOMPurify` before `unsafeHTML`; user messages stay verbatim; links open in a new tab; theme-agnostic bubble styles for code/pre/lists/tables/blockquote.

Assistant replies are rendered as **plain text** today — `_renderMessage()` in `www/src/feezal-ai-chat.js` interpolates `${text}` straight into the bubble (`.bubble { white-space: pre-wrap }`), so `**bold**`, `#` headings, `-`/`1.` lists, `` `inline code` ``, ```` ``` ```` fenced code blocks, tables, and `[links](…)` all show as literal syntax. Models reply in Markdown by default, so this reads noticeably worse than it should.

**Change.** Parse the assistant message content as Markdown and render the resulting HTML in the bubble (via Lit's `unsafeHTML`). User messages stay verbatim (they may contain topics/JSON/code the user typed and shouldn't be reinterpreted).

**Security — mandatory.** Model output is untrusted, and `unsafeHTML` bypasses Lit's escaping, so the parsed HTML **must be sanitized** before insertion (strip `<script>`, event-handler attributes, `javascript:` URLs, etc.). Do not skip this — a prompt-injected or hostile tool result could otherwise inject active content into the editor origin.

**Approach.**
- Add a small, well-maintained Markdown parser + sanitizer to `www` (e.g. `marked` + `DOMPurify`, or `markdown-it` + `DOMPurify`). Both are tiny and tree-shake; no server changes. There is no such dependency today.
- Factor a `_renderMarkdown(text)` helper: `sanitize(parse(text))` → `unsafeHTML(...)`. Reuse it for assistant bubbles and the tool/narration lines if desired.
- **Streaming:** re-parse the accumulating text on each token (cheap for chat-sized messages) so formatting appears live; fenced code blocks left unterminated mid-stream should degrade gracefully (render as they close). If re-parsing per token proves janky, fall back to rendering raw text while `_streaming` and switching to parsed Markdown once the message completes.

**Styling (theme-aware, scoped to `.bubble`).** Add CSS for the generated elements so they match the panel and dark/bright modes via feezal CSS vars:
- Inline code + fenced blocks: monospace, subtle surface background, horizontal scroll for long lines; optional per-block **copy** button.
- Headings/paragraph/list spacing tuned for a chat bubble (tight margins, no giant `h1`).
- Links open in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Tables: minimal borders, scrollable on overflow.

**Scope:** presentation-only, entirely within `feezal-ai-chat.js` (+ the two new `www` dependencies). No backend or protocol changes. Pairs naturally with the archived U27 chat-UX work.


### U29 — AI chat: persist open/closed state in localStorage ✅ done

> **Status: ✅ implemented** — `_aiPanelOpen` inits from `localStorage['aiPanelOpen']`; the three open/close toggles route through a `_setAiPanelOpen(open)` helper that persists it; the `_aiConfigured` gate stays authoritative (force-closes when unconfigured without overwriting the saved preference).

The panel **width** already persists (`localStorage['aiPanelWidth']`), but its **open/closed** state does not — `_aiPanelOpen` is hard-initialised to `false` in the `feezal-app-editor` constructor, so the assistant is collapsed on every editor load even if the user had it open. Persist it like the width, so the panel restores its last state across reloads.

**Change (all in `www/src/feezal-app-editor.js`):**
- **Init from storage:** `this._aiPanelOpen = localStorage.getItem('aiPanelOpen') === '1';` (default closed when the key is absent).
- **Write on every toggle:** the open/close click handlers currently just set `this._aiPanelOpen = true/false` (three sites). Route them through a small `_setAiPanelOpen(open)` helper that also does `localStorage.setItem('aiPanelOpen', open ? '1' : '0')`.
- **Respect the config gate:** restoring open must stay subordinate to `_aiConfigured` — the existing rule that forces the panel closed when AI isn't configured (`if (!this._aiConfigured) this._aiPanelOpen = false;`) still wins, so a persisted `open` never shows the panel without a configured backend. Don't clear the stored preference in that case — if the user later configures AI, their last state should return.

**Scope:** trivial, presentation-only; one new `localStorage` key and a tiny setter. No backend change.


### U26 — AI assistant: MQTT-aware tools (topic search · payload peek · discovery search) ✅ done

> **Status: ✅ implemented** (backend + tools + tool-calling loop + agent-mode prompt; frontend toggle/activity in U27). Pure matchers and the loop mechanics are unit-tested; **live-provider tool execution still needs manual verification** with a real model.

Give the assistant read-only **tools** to explore the live broker instead of relying on the static, truncated context it gets today. This is the concrete realisation of U9's deferred **"Agent / tools mode"** (Phase 3).

**Why.** Today `buildSystemPrompt()` bakes in the first **200** known topics as a flat dump and nothing about their *values*. On a real broker (thousands of topics) the model can't find the right topic, doesn't know a payload's **shape** (JSON keys? `ON`/`OFF`? `true`/`false`? `open`/`closed`?), and can't resolve a device the user names ("the kitchen light") to concrete topics. So it guesses — wrong topics, wrong `payload-on`/`payload-off`, wrong `message-property`. Three tools fix this; the model calls them on demand and the 200-topic dump can shrink or go away.

#### Prerequisite — a tool-calling loop

The current assistant is **streaming text only** (`ai/providers.js` `streamChat`): messages in, tokens out, no function calling. U26 needs a **tool-use loop**: model emits a tool call → server executes it against the in-process caches → result is fed back → model continues, possibly calling again, until it emits the final view HTML.

- Add tool/function-calling to each provider adapter: OpenAI `tools` + `tool_calls`, Anthropic `tool_use`/`tool_result` content blocks, Ollama `tools`. Normalise to a common `{name, arguments}` → `{toolCallId, content}` shape, mirroring how `streamChat` already normalises token deltas.
- Server-side executor loop (bounded iterations, e.g. ≤5) between model turns. The tools run **entirely server-side** — the caches live in the Node process (`bridge.js` trie, `hub.js` retained cache, `discovery.js` entities), so the browser gains nothing but a "assistant is looking things up…" status line.
- **Capability fallback:** models/providers without tool support degrade gracefully — either keep the current static-context behaviour, or expose the tools as an explicit "the user can paste results" affordance. Gate the tool loop on a capability flag.

#### Tool 1 — `search_topics(query)`

Keyword search over the **flat list of all known topics** (walk `bridge.js` `topicTrie` to its leaves via a new `getAllTopics()`; today only `getTopicCompletions(prefix)` exists).

**Query grammar — one or two keywords, the second optionally negated:**
- **`keyword1`** — **fuzzy** match over the *whole topic string with `/` separators ignored* (treat the topic as one flat string; case-insensitive subsequence/fuzzy scoring). Finds the device/thing regardless of how deep or how it's segmented.
- **`keyword2`** *(optional)* — matches **only a full topic part**: a complete segment bounded by `/` (or the topic start/end), case-insensitive and **exact** (so `set` matches `…/set` or `…/set/…` but **not** `reset` or `settings`). Can be **negated** with `NOT`.

**Syntax:** `"kw1 kw2"` (both required) · `"kw1 NOT kw2"` or `"kw1, NOT kw2"` (kw2 negated). A small parser splits on whitespace/comma and recognises a leading `NOT` on the second term.

**Worked examples** (the whole point):
- `"livingroom set"` → command/write topics for the living room (e.g. `zigbee2mqtt/livingroom_lamp/set`) → wire to **`publish`**.
- `"livingroom NOT set"` → state/read topics for the living room (the lamp's state, excluding any `set` segment) → wire to **`subscribe`**.

Returns a capped, score-ranked list of full topic strings. This directly teaches the model the publish-vs-subscribe split from the topic layout.

#### Tool 2 — `get_topic_payload(topic)`

Return the **last-known payload** for an exact topic so the model can see its actual **shape/value** before configuring an element. Source: `hub.js`'s retained-message `cache` (`{topic → {payload, retain, …}}`). Returns `{topic, payload, retained, ts}` or a not-found marker.

The model uses this to choose correctly:
- JSON payload → read the keys to set **`message-property-*`** (e.g. `{"state":"ON","brightness":128}` → `message-property="state"`).
- Scalar enum → set **`payload-on`/`payload-off`** / state maps from the *real* values (`ON`/`OFF`, `true`/`false`, `open`/`closed`, `1`/`0`).

**Cache caveat / plumbing:** `hub.js` currently caches **only retained** messages, so non-retained state topics have no entry. To make the tool useful there, add a small **bounded `lastSeen` map** (topic → last payload, updated on every message regardless of retain, size-capped) and expose `getLastPayload(topic)`. Note the value may be stale/absent; the tool should say so.

#### Tool 3 — `search_discovery(query)`

**Fuzzy search by name** over the cached MQTT auto-discovery registry (`discovery.getDiscoveredEntities()` — HA/zigbee2mqtt entities with `name`, `component`, and a full `config` incl. `state_topic`/`command_topic`). Fuzzy-match `query` against entity `name` (and device name); return matches with their `component` type and the key topics already resolved from the discovery config.

Lets the model turn "add the kitchen light" into a concrete element wired to the discovered `command_topic`/`state_topic` **without** the user pasting anything — and it composes with Tool 2 (peek the state topic's payload to nail the property/enums).

#### System-prompt updates

Teach the model the tools **and how to act on results** (`ai/prompt.js`):
- **When to call which:** unsure of a topic → `search_topics` (use the ` set`-part pattern for command topics, the `NOT set` pattern for state topics); about to set `payload-on/off`, a state map, or `message-property` → `get_topic_payload` first, never assume; user names a device → `search_discovery` to resolve it.
- **How to interpret results:** a `…/set` (command) topic → `publish`; its sibling state topic → `subscribe`; a JSON payload → `message-property`; scalar enums → copy the exact on/off strings from the real payload.
- **Shrink the static dump:** replace the baked 200-topic list with a short note that the full topic space is searchable via the tool (saves tokens and scales to large brokers). Keep the element catalogue (it's the ground-truth contract).

#### Plumbing summary

| Need | Source today | Add |
|---|---|---|
| Flat topic list | `bridge.js` `topicTrie` (+ `getTopicCompletions`) | `getAllTopics()` trie-flatten + the 1–2-keyword/negation matcher |
| Last payload | `hub.js` retained `cache` | bounded `lastSeen` map + `getLastPayload(topic)` |
| Discovery search | `discovery.getDiscoveredEntities()` | fuzzy-by-name matcher (tiny subsequence scorer, no new dep) |
| Tool-calling | — (`streamChat` is text-only) | per-provider tool support + server-side execute→continue loop |

**Scope:** editor-only (like the rest of U9); all tools are read-only and run server-side against existing in-memory caches. Ships naturally alongside [A17](#a17--comprehensive-automated-testing-backend--frontend--unit--integration--system--done) — the matchers (fuzzy scorer, 2-keyword/negation parser, trie-flatten) are pure functions and should land with unit tests.


### U27 — AI assistant chat UX: larger multiline input + activity animation ✅ done

> **Status: ✅ implemented** — auto-growing ~3-line composer, sweeping shiny border + text shimmer while busy (respects `prefers-reduced-motion`), and a persisted `agent` toggle chip that gates [U26](#u26--ai-assistant-mqtt-aware-tools-topic-search--payload-peek--discovery-search)'s tool loop, with live tool-activity status.

Refinements to the assistant panel (`www/src/feezal-ai-chat.js`): a roomier input, an activity animation that matches [hobbyquaker/she](https://github.com/hobbyquaker/she)'s assistant (animated "shiny" border + text shimmer while the model works), and a toggle to turn agent/tool mode on or off.

#### 1. Larger, auto-growing multiline input

The composer is currently `<textarea rows="1">` with `max-height:160px` and **no auto-grow**, so it reads as a single line until the user inserts newlines — cramped for describing a change.

- Default to **~3–4 visible lines**: set `rows="3"` (or `4`) and give `.composer textarea` a matching `min-height` (`~4.2em` for 3 lines at `line-height:1.4`).
- **Auto-grow** on input up to the existing `max-height:160px` cap: on `@input`, reset `height:auto` then set `height = scrollHeight` (clamped), and reset back to the min height after `_send()` clears the field. Keep Enter = send, Shift+Enter = newline (already wired in `_onKeydown`).

#### 2. "Shiny" activity animation (while the assistant is working)

When `_streaming` is true — the model is thinking, streaming, or (with U26) running a tool — animate two surfaces so the panel visibly signals activity:

- **Composer box** (`.composer .box`): swap the static `1px` border for an **animated gradient "shine"** that sweeps around the box.
- **Active assistant bubble** (the "proposing a change…" / working message and the `.dots` state): add a **text shimmer** (a highlight sweeping across the label) and/or the same animated border, so the in-progress message reads as live rather than static.

**Implementation approach** (plain CSS, no new dependency; gate everything behind a `.busy` class toggled by `_streaming`):

- *Animated gradient border* — a pseudo-element behind the box painted with a rotating `conic-gradient` (or a sliding `linear-gradient` via animated `background-position`), confined to a border ring using the padding-box/`mask` compositing trick (or `border-image`), driven by a `@keyframes` that rotates the gradient angle / slides the position. Use the theme's primary tokens (`--sl-color-primary-*`) plus an accent stop so it matches feezal's palette while echoing she's sweep.
- *Text shimmer* — a moving `linear-gradient` background with `-webkit-background-clip:text; color:transparent;` animated on `background-position`, applied to the working label.
- Respect **`prefers-reduced-motion`** (drop to a static tint / no sweep).

**Tie-in with U26:** "does something" should cover the whole tool-use loop, not just token streaming — drive the animation from a broader busy state (`_streaming` today; extend to include tool-call status once U26 lands, e.g. a `_busy`/`_activity` flag with an optional label like "searching topics…").

#### 3. Agent-mode toggle (tool usage on/off)

A **tiny checkbox** in the composer to enable/disable **agent mode** — i.e. whether the assistant may use the [U26](#u26--ai-assistant-mqtt-aware-tools-topic-search--payload-peek--discovery-search) tools (topic search / payload peek / discovery search) and run the tool-use loop.

- **Placement:** a compact toggle in the existing `.chips` row (next to the `view` chip and file chips), styled to match — a small checkbox + `agent` label (or a toggle-chip like `_includeView`). "Tiny" so it doesn't dominate the composer.
- **State:** a persisted `_agentMode` flag (default on once U26 ships; `localStorage`-backed like other panel prefs). When **off**, the request omits the `tools` array / uses today's plain `streamChat` path (static context only); when **on**, the server runs the tool-calling loop.
- **Wiring:** the flag rides along in the AI request so the server-side loop is gated per-message. Reflect it in the composer `hint` line (e.g. append `· agent on`), mirroring the existing `auto-apply on` hint.
- **Capability interplay (U26):** if the selected provider/model can't do tool-calling, show the checkbox disabled with a tooltip ("model doesn't support tools") rather than hiding it.

**Scope:** editor-only. Items 1–2 are presentation-only (CSS + a small auto-grow handler + the busy-class toggle); item 3 adds one persisted flag threaded into the request and depends on U26 for anything to gate.


### U25 — Store custom classes in `views.html` (source-editable) ✅ done

Move **custom-class definitions** (the CSS bundles authored on the Themes page, U18) out of `viewer.json` and into `views.html`, so they are visible and editable from the **source editor** (N15) alongside the markup that uses them.

#### Current state — definitions and usage are split across two files

Custom classes (U18) have two halves that today live in **different files**:

| Half | Example | Stored in | Source-editable? |
|---|---|---|---|
| **Definition** — the CSS bundle | `.feezal-class-card { border-radius:8px; … }` | `viewer.json` → `viewer.classes` | ✗ **no** — `viewer.json` isn't reachable from the source editor |
| **Usage** — the applied class name | `<feezal-element-… class="feezal-class-card">` | `views.html` (element `class` attribute) | ✅ yes |

So in the source editor a user sees `class="feezal-class-card"` on an element but has **no way to see or edit what that class actually does** — the rule body is in a JSON file the editor never surfaces. The definition is authored only through the Themes-page class editor (`feezal-sidebar-themes.js`), which serialises to `viewer.classes` on deploy (`feezal-app-editor.js` `_deploy()`), and the runtime `<style>` is rebuilt separately in three places:

- **Editor:** `_syncClassesStyle()` injects `<style id="feezal-classes">` into `document.head`.
- **Viewer:** `server/src/app.js` reads `viewerConfig.classes`, sanitises, and injects a `<style>` into `<head>`.
- **Export:** `server/src/build/export.js` does the same into `index.html`.

#### Proposal — one source of truth, inside the document

Persist the class definitions as a single **`<style>` block inside `<feezal-site>`** in `views.html` (e.g. as the first child):

```html
<feezal-site>
    <style id="feezal-classes">
        .feezal-class-card      { border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.2); }
        .feezal-class-danger-bg { background:#c62828; color:#fff; }
    </style>
    <feezal-view name="Home"> … </feezal-view>
    …
</feezal-site>
```

Because the source editor serialises `feezal.site.outerHTML` (`_enterSourceMode()` in `feezal-app-editor.js`), a `<style>` child of `<feezal-site>` **automatically appears in source** and round-trips back through `_applySource()`. Definition and usage now sit in the same file — a folded view reads as a self-contained document.

#### Why this is a net simplification

- **Viewer + export get simpler, not more complex.** Both already serve/inline `views.html` verbatim. With the `<style>` living in the document, the separate `classesStyle` construction+injection in `server/src/app.js` and `export.js` can be **deleted** — the block ships for free with the HTML.
- **Git history preview (A7) simplifies.** `getSiteAtVersion()` currently has to `git show sha:viewer.json` *just* to recover historical `classes` for `?sha=` previews (see ROADMAP-ARCHIVE U16). If classes live in `views.html`, the historical HTML already carries them — one fewer cross-file dependency.
- **Consistency.** Class *usage* is already in `views.html`; moving the *definition* there co-locates the two halves that were arbitrarily split.

#### Implementation sketch

1. **Themes-page class editor (`feezal-sidebar-themes.js`)** — becomes a *view* over the in-document `<style id="feezal-classes">` rather than an independent `_classes` state serialised on deploy. `_syncClassesStyle()` writes the block **inside `feezal.site`** instead of `document.head`; the editor still parses it back into the per-class property cards for the GUI. (Keep the GUI — the source block and the visual editor are two views of the same data, kept in sync like design/source mode already are.)
2. **Deploy (`feezal-app-editor.js` `_deploy()`)** — drop `classes: themesSidebar.classes` from the `viewer` object; the definitions now flow with `html`. Ensure `_clean()` does **not** strip the `<style id="feezal-classes">` node (it currently strips only editor-only classes and theme classes — leave the style block alone).
3. **Viewer/export** — remove the `viewer.classes` → `<style>` injection in `server/src/app.js` and `server/src/build/export.js`.
4. **Migration (one-time).** On load, if `viewer.json` has `classes` but `views.html` has no `<style id="feezal-classes">`, synthesise the block from `viewer.classes` and inject it into the site DOM (marking the site dirty so the next deploy persists it and the legacy `viewer.classes` key is dropped). Mirror U18's "old storage silently dropped on upgrade" approach.

#### Open questions / caveats

- **`<style>` as a `<feezal-site>` child.** Verify `feezal-site` treats a non-`<feezal-view>` child as inert (it should — view logic keys off `<feezal-view>`, and the browser applies the CSS globally regardless). If not, an alternative is a dedicated slot or a `views.html`-level block with a small change to what source mode serialises.
- **Sanitisation shifts to author-trust.** Today the server sanitises `viewer.classes` property names/values before injecting. Raw CSS authored directly in `views.html` source is inherently user-controlled (it's their own dashboard, same trust level as inline `style=`), so strict sanitisation becomes moot for the live/editor path — but if `views.html` is ever rendered in a context that isn't fully trusted, the `<style>` block is a larger surface than a constrained JSON map. Note this in the security model.
- **Formatting.** `prettyhtml`/Monaco formatting of CSS *inside* a `<style>` block — confirm it doesn't mangle the rules on round-trip (cosmetic only).
- **Theme stays in `viewer.json`.** Only the arbitrary user-authored *classes* move. The active theme (a package reference) and colour `themeOverrides` remain site-level config in `viewer.json` — they aren't document content and `_clean()` already strips `feezal-theme-*` from the markup deliberately.


### U24 — Collapsible palette categories ✅ done

Palette categories (Basic, Device, System, Material, …) are individually collapsible so users with a large element library can hide categories they don't currently need.

**Implementation** (`www/src/feezal-palette.js` only, no server change):
- Each category header is a clickable row with a right-aligned chevron (`expand_more` / `chevron_right`); clicking the header toggles the category.
- Collapsed state is a reactive `_collapsed` Set, persisted to `localStorage` under `feezal-palette-collapsed` (JSON array of collapsed category names), restored on load.
- A collapsed category renders its header only (its element tiles are omitted from `render()`).
- When the filter is active, every category is force-expanded (and the chevron hidden) so matches are always visible, regardless of saved state.

### U8 — Folders for views ✅ done

Views can be organised into a folder hierarchy in the editor. **Folders are an editor-only concept** — the viewer and static exports are unaffected and continue to show all views flat.

**Implementation** (`www/src/feezal-app-editor.js`, load wiring in `www/src/feezal-sidebar-inspector.js`):
- The folder tree is persisted under `viewer.folders` in `viewer.json` (flows through the existing deploy `viewer` config; no server change needed). Each node is a folder `{id, name, children:[]}` or a view ref `{view}`. Never written to `views.html`.
- The view tab bar was replaced with a custom folder-aware tab bar (`#view-tabs`) that renders folders and views in tree order, with collapse/expand, indentation, and a per-folder view count.
- **Create folder** button (`create_new_folder`) next to "Add view"; new folders open a rename dialog immediately.
- **Right-click a view tab**: Rename, Duplicate, Move to (Top level + each folder), Delete.
- **Right-click a folder tab**: Rename folder, Delete folder (children lifted to the parent at the folder's position).
- **Drag & drop**: reorder views/folders, drop a view/folder *into* a folder (centre), reorder *before/after* (edges), drag to the empty bar area for top level. Visual drop indicators (insertion line / folder highlight / end-of-bar). Nesting capped at 3 levels (`_maxFolderDepth` rejects deeper moves).
- **Reconciliation** (`_reconcile`): on load and whenever the view set changes, dangling view refs and duplicates are dropped, malformed nodes ignored, over-deep folders flattened, and any unreferenced views appended at the top level — covering all the views.html ↔ viewer.json drift cases. Renames update the tree in place (`_renameInTree`) so placement is preserved. Empty folders are kept.
- The viewer route and static export compose their HTML from `views.html` + theme/overrides/classes only and never reference `folders`, so both stay flat automatically.

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

### A13 — Update / restart feezal from the UI ✅ implemented

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

### A16 — Export asset layout: drop the `global/` subfolder ✅ done

> **Status: ✅ implemented** — Option 2 + Option 1 as recommended: `planExportAssets()` in `server/src/build/export.js` bundles only *referenced* assets into a single `assets/` tree (no `global/` folder), keeps site assets authoritative on collisions (`-1` suffix for the global file), and rewrites all reference forms — absolute `/assets/<site>/…` and `/assets/global/…` (also in theme-override/class CSS and user themes) as well as the legacy relative forms — to the relative `assets/…` form, which also makes asset references work from `file://`. Covered by six unit tests and the offline-export E2E (image loads from an extracted bundle).

> **Largely obviated by A14's [copy-on-use global assets](ROADMAP-ARCHIVE.md#global-assets-are-an-editor-only-library-copy-on-use) (✅ implemented).** Dragging a global asset now copies it into the site's own `assets/` and stores a site-relative `src`, so newly-authored markup never references `global/` and new exports won't contain a `global/` folder. What remains here is optional cleanup: (a) drop the now-mostly-dead `global/`-bundling branch in `export.js`, and (b) bundle only *referenced* assets (Option 2) so exports stop copying the entire pool. Still relevant for sites deployed before copy-on-use that retain `/assets/global/…` references.

After A15 a single-site export nests a `global/` folder *inside* the site bundle:

```
<sitename>.zip
└── <sitename>/
    ├── index.html
    ├── global/…      ← assets from the shared cross-site pool
    └── assets/…      ← this site's own assets
```

**Two problems with `global/` here:**
1. **Semantic mismatch.** "Global" is an *editor-only* concept — a pool of assets shared across sites (`<dataDir>/global/assets/`, surfaced by the Assets sidebar's Global tab). A self-contained export of *one* site has no notion of "other sites", so a folder literally named `global` inside `<sitename>/` is confusing — it reads as if the bundle were multi-site.
2. **It copies the whole pool.** `getAssetFilesForExport()` returns **every** global asset (and every site asset), referenced or not — so each single-site export carries the entire shared library even when the site uses none of it.

Asset references are stored in the markup with relative prefixes — `global/<path>` and `assets/<path>` (the viewer's `resolveAsset()` maps these to `/assets/global/…` and `/assets/<site>/…`; the export's `resolveAsset()` returns them as-is, relative to `index.html`). So the layout is driven entirely by those two prefixes.

#### Options

**Option 1 — Flatten global into `assets/` with reference rewriting *(recommended)*.**
Copy the used global assets into the site's `assets/` tree and rewrite the baked references `global/<p>` → `assets/<p>` in `siteHtml` (and any config that carries asset URLs) before `composeIndexHtml()`. The export's runtime `resolveAsset()` already returns paths verbatim, so only the stored prefixes change. Result: one `assets/` folder, no `global/`.
Handle the rare collision (a global and a site asset sharing the same relative path) by keeping the *site* asset authoritative and writing the colliding global file under a disambiguated name (e.g. `assets/shared-<name>` or `assets/<name>-<hash>`), rewriting only that one reference.

**Option 2 — Bundle only *referenced* assets *(do this regardless)*.**
Scan `siteHtml` (+ config) for `global/…` and `assets/…` references and include only those files instead of the whole pool. Smaller ZIP, and it shrinks the global set to exactly what's used — which also minimises the collision surface for Option 1. Naturally pairs with Option 1.

**Option 3 — Namespace under `assets/` *(minimal effort)*.**
Keep global files but place them at `assets/global/<p>` (a subfolder of `assets/`, not a top-level sibling) and rewrite `global/<p>` → `assets/global/<p>`. Removes the top-level `global/` but still has a literal "global" dir, so it only *partly* addresses the concern. No collision handling needed (global and site stay in separate subtrees).

**Recommendation:** Option 2 + Option 1 — bundle only referenced assets, flattened into a single `assets/` tree with collision-safe rewriting, so an export contains just `<sitename>/{index.html, assets/}`.

#### Touch points

- `server/src/build/export.js` — rewrite `global/` references in `siteHtml` (and config asset URLs) before composing `index.html`; drop the `global/`-prefixed ZIP entries so global files land under `assets/`.
- `server/src/storage/filesystem.js` — `getAssetFilesForExport()` gains a "referenced-only" filter (take the set of referenced paths, or scan the HTML there) and returns global files tagged with their target `assets/` path.
- Build the collision map from the referenced-asset scan.

**Scope:** export-only. The editor and viewer keep the `global/` vs `assets/` distinction — the shared pool is a real, useful concept there; it just shouldn't leak into a single-site static bundle.


### A17 — Comprehensive automated testing (backend · frontend · unit · integration · system) ✅ done

> **Status: 🟢 all five phases done, depth pass complete** — 466 tests across four suites, coverage ratchets in place, CI runs the full pyramid (component tests across chromium+firefox+webkit) on every push. The first "automation candidates" wave landed: an element smoke harness mounting every package, 12 elements with full MQTT behaviour tests, theme variable+screenshot regression, and E2E for inspector editing, move/nudge/undo, source mode, view management, copy-on-use drag (B15) and broker-restart reconnect. The tests pinned two new bugs: **paper-tabs leaks its MQTT subscription on disconnect**, and the **shortcuts modal documents arrow-nudge backwards** (plain = grid size, Ctrl/Shift = 1px, Alt = nothing) — see docs/TESTING.md "known issues". Remaining candidates are listed at the end of docs/TESTING.md.

**Goal:** everything tested — backend *and* frontend, across the full pyramid (unit → integration → system/E2E), run in CI on every change.

#### Where we are today

| Layer | Tooling | Coverage |
|---|---|---|
| Backend — unit | Vitest (`server/vitest.config.mjs`) | **broad** — storage, topic-match, extract-elements, export (A15 ZIP layout, theme/class inlining, bundle cache + Rollup fallback), discovery, ai (config/conversations/providers/prompt), auth, git |
| Backend — integration | Vitest + `supertest` + aedes | **broad** — sites, assets (incl. B15 copy-on-use), themes, history/certs, discovery, ai endpoints; Socket.IO hub with real clients + mqtt bridge against a real in-memory broker, incl. the full broker→bridge→hub→editor relay chain |
| Frontend — logic unit | Vitest + happy-dom (`www/vitest.config.mjs`) | **partial** — connection topic matching/fan-out, mqtt payload parsing, view visibility, U25 class parser round-trip, U8 folder reconciliation, AI chat (SSE parse, output validation, tag correction), broker URI fields, inspector attribute helpers, monaco shadow-style sync |
| Frontend — component (browser) | Vitest browser mode + Playwright (`www/vitest.browser.config.mjs`; chromium local, +firefox/webkit in CI) | **broad** — smoke harness mounts every element package (render, payload, visibility, subscription cleanup); full MQTT behaviour for button, switch, image, number, gauge, slider, progress, checkbox, contact, motion, select, input; FeezalElement base (control channel, baseAttribute, gating); feezal-site/-view; theme variables + distinctness + swatch screenshots |
| System / E2E | Vitest + playwright-core + aedes (`www/vitest.e2e.config.mjs`) | **broad** — happy path (editor boot, palette drag, deploy, reload restore, viewer retained/live MQTT, export ZIP) plus editor flows (inspector topic editing → live broker value, move/nudge/undo, source mode incl. syntax-error deploy gating, view add/rename/navigate, copy-on-use asset drag incl. the B15 inspector refresh) and broker-restart reconnect through the bridge |

206 backend + 106 frontend logic + 134 browser component (per browser; ×3 in CI) + 20 E2E tests pass — `npm run test:all` at the root chains everything (needs chromium via `npx playwright install chromium` and a built `www/dist`; on WSL also `libnss3`/`libnspr4`, see `vitest.browser.config.mjs`). CI (`.github/workflows/ci.yml`) runs all four suites on ubuntu — component tests across chromium+firefox+webkit — with coverage gates (`coverage.thresholds`, ratchet up, never down) and uploads the coverage reports as artifacts. Known issues pinned by tests (fix separately, then remove the exceptions): paper-tabs MQTT subscription leak, editor boot `querySelectorAll`-on-null errors, shortcuts-modal arrow-nudge documentation. The remaining automation candidates live at the end of docs/TESTING.md.

#### Target — one runner, four layers

Standardise on **Vitest** everywhere (already the backend runner; its browser mode covers real DOM) so there's one config style, one assertion API, one coverage report.

**1. Backend unit** — cover every logic module with a temp-dir/mocked-IO harness:
- `build/export.js` — assert the ZIP layout and entry names (directly locks in A15's `<sitename>/` wrap and A16's asset flattening), theme/class inlining, the tree-shaken bundle path.
- `build/extract-elements.js`, `build/elements.js` — tag/package extraction from sample markup.
- `build/git.js` — init/commit/`showFile`/restore against a temp repo (incl. the A14 legacy-filename fallback).
- `storage` — extend with `copyAssetUnique` collision suffixing, `getSiteAtVersion` legacy fallback, `updateAssetRefs`.
- `ai/prompt.js`, `ai/providers.js` — prompt assembly and provider request shaping with `fetch` mocked.
- `auth/*`, `mqtt/discovery.js` — pure logic paths.

**2. Backend integration** — Express + `supertest`, extend beyond site CRUD:
- Assets: upload / list / rename / mkdir / **transfer (copy + `unique`)** — the copy-on-use path end-to-end.
- Certs (N8), user themes, git history endpoints (list/file/restore), AI endpoints.
- **Socket.IO hub** — boot the server, connect a client, exercise `getSite` / deploy / `elementsChanged`.
- **In-memory MQTT broker** (e.g. `aedes`) so `mqtt/bridge.js` and discovery are tested against a real broker instead of mocks.

**3. Frontend unit / component** — stand up a `www` Vitest config:
- *Logic-only* modules in `happy-dom`/`jsdom` (fast, no rendering): the U25 class parser (`_parseClassesStyle`/`_syncClassesStyle` round-trip), U8 folder reconciliation, topic/attribute helpers, `resolveAsset`.
- *Real web components* in **Vitest browser mode** (Playwright provider) for shadow-DOM/Lit lifecycle: `feezal-site` view visibility, `feezal-view`, element rendering, inspector wiring. (`@open-wc/testing` patterns apply.)

**4. System / E2E** — Playwright driving the whole stack: start the server + an in-memory broker, then script real flows — create a site, drag an element, **drag a global asset (copy-on-use) and assert it lands in the site**, edit in source mode and apply, deploy, open the viewer and assert a retained MQTT message renders, **export the ZIP and assert `<sitename>/index.html` + flattened assets**. This is the layer that would have caught the drag/drop wiring the unit tests can't.

#### Infrastructure

- **CI runs on Linux.** The rolldown native binding is platform-specific (`@rolldown/binding-linux-x64-gnu` vs `…-win32-x64-msvc`) — a Windows-populated `node_modules` fails on Windows and vice-versa. CI must install fresh on Linux; document that Windows contributors either `npm install` on Windows or run tests via **WSL** (confirmed working: `wsl bash -lc "cd …/server && npm test"`).
- **Root `npm test`** that fans out to `server` and `www` (npm workspaces or a top-level script), so one command runs the whole suite.
- **Coverage** via `vitest --coverage` (v8) with a gate that ratchets up over time; publish the report in CI.
- **Shared fixtures/helpers** — temp `dataDir` bootstrap (already used), an in-memory broker helper, a headless editor bootstrap for component tests.

#### Suggested phasing

1. Fill backend unit + integration gaps (cheap, high value; hardens A14/A15/A16 immediately). ✅ *done — incl. export ZIP + broker/hub integration*
2. Stand up frontend logic-unit tests (no rendering) — quick wins on parsers/reconcilers. ✅ *done — `www/test/`, happy-dom*
3. Add component (browser-mode) tests for the core custom elements. ✅ *foothold done — `www/test-browser/`, `npm run test:browser`*
4. Add the Playwright E2E happy-path last (most expensive, highest confidence). ✅ *happy path done — `www/test-e2e/`, `npm run test:e2e`*
5. Wire coverage + CI gate once each layer has a foothold. ✅ *done — thresholds in both vitest configs, full pyramid in `ci.yml`*


### A14 — Restructure the data directory (lowercase layout + file renames) ✅ done

Reorganise `<dataDir>` so every top-level entry is a **lowercase, single-purpose folder**, sites live under a dedicated `sites/` parent (no longer scattered at the root among system directories), and the two per-site files are renamed to match the site-centric naming: **`views.html` → `site.html`** and **`viewer.json` → `site.json`**.

**No migration.** This is a clean break — new/empty data dirs use the new layout; existing data dirs are **not** auto-migrated (users move/rename folders and files manually if they want to keep old data). This keeps the change to path constants only, with no migration code to write, test, or maintain. See the [git-history caveat](#a14-git-history-caveat) below for the one behavioural consequence of renaming under an existing git repo.

#### Current layout — sites and system dirs share the root

```
<dataDir>
├── <siteName>/            ← each site sits at the TOP level (e.g. Default/)
│   ├── views.html
│   ├── viewer.json
│   ├── assets/
│   └── .git/
├── _global/
│   └── assets/
├── themes/                ← user CSS themes (<slug>.css)
├── elements/             ← user-installed packages (N4)
├── certs/<siteName>/     ← MQTT TLS certs (N8)
├── ai.json               ← AI provider config
└── ai/conversations/     ← AI conversation history
```

Because sites and system directories share the root, `listSites()` must **guess** which top-level dirs are sites by excluding a reserved-name list (`_global`, `themes`, anything starting with `_` — see `RESERVED_SITE_NAMES` / `isReservedSiteName` in `server/src/storage/filesystem.js`, duplicated in `server/src/routes/api.js`). Every new system dir (`elements/`, `certs/`, `ai/`) is another dir that happens *not* to be excluded and is only safe because it doesn't collide with a real site name. A user site literally named `themes` or `elements` would break.

#### Target layout (all-lowercase)

```
<dataDir>
├── ai/
│   ├── config.json       ← was ai.json
│   └── conversations/    ← was ai/conversations/
├── global/               ← was _global/
│   └── assets/
├── sites/                ← NEW parent — every child is unambiguously a site
│   └── default/
│       ├── site.html     ← was views.html
│       ├── site.json     ← was viewer.json
│       ├── assets/
│       ├── certs/        ← was <dataDir>/certs/<site>/ — now nested per-site (N8)
│       └── .git/
├── themes/               ← user CSS themes (<slug>.css)
├── elements/             ← user-installed element packages (N4)
└── icons/                ← future — feezal-icons-* icon sets (N4 / N20)
```

**Wins:**
- **`listSites()` becomes exact, not heuristic** — read `sites/`, return every child dir. `RESERVED_SITE_NAMES` / `isReservedSiteName` disappear (both copies), and a site may be named anything (`themes`, `elements`, `_global` — no longer special).
- **Every root entry is one clear, lowercase purpose**; the add-on stores (`themes/`, `elements/`, future `icons/`) sit together as siblings.
- **A site is fully self-contained** — its git repo, `assets/`, and now `certs/` all live under `sites/<name>/`. Nothing per-site is scattered at the root.
- **New system data has an obvious home** — a new top-level folder, never something `listSites()` has to learn to skip.

#### Global assets are an editor-only library (copy-on-use)

`<dataDir>/global/assets/` is a **shared convenience library available only in the editor** (the Assets sidebar's *Global* tab) — it is **not** a runtime location that any site references. The moment a global asset is actually *used*, it becomes a site asset:

- **Copy-on-use.** Dragging a global asset onto a view (or otherwise placing it) **copies the file into the current site's `sites/<name>/assets/`** and sets the element's `src` to the **site-relative** reference (`/assets/<site>/<path>`) — never `/assets/global/<path>`. The global entry stays in the library as a reusable template; the site gets its own independent copy.
- **Collision handling.** If a file of the same name already exists in the site's assets, disambiguate on copy (suffix `-1`, `-2`, … — or, if the bytes are identical, reuse the existing site copy and skip the write).

**Why this is the right model:**
- **Every site is self-contained.** All assets a site references live under its own `assets/`. There is no cross-site runtime dependency on the shared pool, and deleting/renaming a global asset can never break an already-built site.
- **The viewer never resolves `global/` for rendered content.** No deployed markup references the global pool; the `/assets/global` static route remains only so the editor's *Global* tab can browse/preview the library.
- **Export becomes trivially correct.** A single-site bundle only ever contains `assets/` — there is simply no `global/` reference to bundle. This **supersedes A16**: the "`global/` subfolder inside the export" problem disappears at the source, leaving A16 as nothing more than deleting the now-dead global-bundling branch in `export.js`.

**Implementation:**
- `www/src/feezal-sidebar-assets.js` — in the drag-to-canvas drop path, when `_category === 'global'`, first copy the file to the site via the existing `POST /api/assets/:site/transfer` (`{srcCategory:'global', destCategory:'site', copy:true}`, which returns the destination path and already handles the filesystem copy through `storage.copyAsset`), then set the element `src` to `/assets/<site>/<destPath>`. `_assetSrc()`'s `global` branch is then only used for library preview, never for a stored reference.
- **Server:** no new endpoint required — transfer/`copyAsset` already exist. (An optional convenience `POST /api/assets/:site/use-global` could wrap the copy + collision-suffix in one call.)
- **No migration.** Existing sites that already reference `/assets/global/…` keep working via the static route; only new placements copy. An optional one-shot "localise global references" action could rewrite + copy them into the site later, but it is not required.

#### Touch points — folder moves (path constants)

| Concern | Today | New |
|---|---|---|
| Site dir | `<dataDir>/<name>` (`_sitePath`) | `<dataDir>/sites/<name>` |
| List sites | `readdir(dataDir)` + reserved-name filter | `readdir(<dataDir>/sites)`, no filter |
| Global assets | `<dataDir>/_global/assets` | `<dataDir>/global/assets` |
| Site assets | `<dataDir>/<name>/assets` | `<dataDir>/sites/<name>/assets` |
| Themes | `<dataDir>/themes` | `<dataDir>/themes` *(unchanged)* |
| Elements | `<dataDir>/elements` | `<dataDir>/elements` *(unchanged)* |
| Icons *(future)* | — | `<dataDir>/icons` |
| Certs | `<dataDir>/certs/<name>` | `<dataDir>/sites/<name>/certs` |
| AI config | `<dataDir>/ai.json` | `<dataDir>/ai/config.json` |
| AI conversations | `<dataDir>/ai/conversations` | `<dataDir>/ai/conversations` *(unchanged)* |

Files to update: `server/src/storage/filesystem.js` (`_sitePath`, `_assetBase`, `GLOBAL_DIR`, `listSites`, drop reserved-name logic), `server/src/routes/api.js` (static-route + cert + theme + `siteRepoDir` paths, drop the duplicated `RESERVED_SITE_NAMES`), `server/src/app.js` (the `/assets/global`, `/assets/:site`, `/themes`, `/user-elements` static mounts), `server/src/ai/config.js`, `server/src/ai/conversations.js`, `server/src/build/export.js` (user-theme lookup), and `server/src/socket/hub.js` (cert dir → now under the site dir). Centralising these as named constants (or a small `paths.js` helper) while touching them would remove the current duplication (e.g. `RESERVED_SITE_NAMES` defined twice).

#### Touch points — file renames (`views.html` → `site.html`, `viewer.json` → `site.json`)

The rename is contained by the storage abstraction — almost every server access goes through **two constants** in `server/src/storage/filesystem.js`:

```js
const VIEWS_FILE  = 'site.html';   // was 'views.html'
const CONFIG_FILE = 'site.json';   // was 'viewer.json'
```

`getSite`, `saveSite`, `getSiteAtVersion`, and `updateAssetRefs` all reference these constants, so flipping the two values covers the read/write/commit paths at once. Consumers that go through the storage layer need **no** change:

- **Export** (`server/src/build/export.js`) — consumes `storage.getSite()` → `{html, config}`, never the raw filenames. ✅ No change (only stale "views.html" comments to tidy).
- **Viewer route** (`server/src/app.js`) — uses `storage.getSite()` / `getSiteAtVersion()`, not literal filenames. ✅ No change.
- **Deploy** — the editor sends `{html, …, viewer}` over the socket; the server writes via `saveSite()` → constants. ✅ No change.

Places that **do** hardcode the old filename and must be updated:

- **Git viewer / history overlay (N16)** — `www/src/feezal-history-bar.js` hardcodes `?path=views.html` when fetching a historical file; change to `site.html`. The server route `GET /api/sites/:name/history/:sha/file` validates `path` with `/^[\w.-]+$/` (no allowlist), so it accepts the new name without change — only the frontend caller is hardcoded.
- **Comments / docs** referencing the old names (cosmetic): `server/src/build/git.js`, `server/src/build/extract-elements.js`, `server/src/ai/config.js`, `server/src/routes/api.js`, `server/src/app.js`, `server/src/storage/filesystem.js`, and `www/src/feezal-app-editor.js` / `feezal-sidebar-themes.js` inline comments; plus `docs/user-guide.md` (mentions `viewer.json`). Update opportunistically.
- **Roadmap cross-refs** — U25 and several other entries in this file describe storage as `views.html` / `viewer.json`; refresh them when A14 lands.

<a id="a14-git-history-caveat"></a>
**Git-history caveat (git viewer).** git auto-commit is filename-agnostic (`git add -A`), so a renamed file is committed automatically with no code change. But `getSiteAtVersion()` / the history overlay resolve a version via `git show <sha>:site.html`, which **fails for commits made before the rename** (those blobs are named `views.html`). Per "no migration" this is accepted: pre-rename history is not viewable under the new names. If graceful history is wanted, `showFile()` can fall back to the legacy name on a not-found (`git show <sha>:views.html`) — a small, optional robustness tweak, not required for the MVP.

#### Open questions

- **Icons vs. unified package store.** The layout gives `feezal-icons-*` sets their own top-level `icons/`, parallel to `elements/`/`themes/`. N4 (Package Manager), however, currently plans to install *all* package types — elements, themes, icon-sets — into a single `<dataDir>/elements/` dir picked up by one discovery scan. Decide before both land: either split installed packages into `elements/` + `icons/` (+ theme packages?) by type, or keep N4's unified store and treat top-level `themes/`/`icons/` strictly as the *user-authored* CSS/asset dirs (distinct from installed npm packages). Align the two entries.
- **Certs, git, and serving.** Nesting `certs/` inside `sites/<name>/` keeps the site self-contained, but the private key must never be committed or served — verify a per-site `.gitignore` (or the commit staging) excludes `certs/`, and that no static mount exposes it.
- **Site-name validation.** With sites confined to `sites/`, a site name can no longer collide with a root system dir (`themes`, `elements`, …), so the reserved-name list goes away entirely. A site name now only needs to be a valid single path segment — confirm validation still rejects path separators, `..`, and empty names.


### A15 — Export ZIP: wrap contents in a `<sitename>/` folder ✅ done

The static export (`createExport()` in `server/src/build/export.js`) currently writes all ZIP entries **at the archive root**:

```
<sitename>.zip
├── index.html
├── global/…      ← global assets
└── assets/…      ← site assets
```

Unzipping spills these loose files into whatever directory the user extracts to. The desired behaviour is a single top-level folder named after the site, so an extract yields one tidy `<sitename>/` directory:

```
<sitename>.zip
└── <sitename>/
    ├── index.html
    ├── global/…
    └── assets/…
```

**Change is minimal** — prefix every archive entry name with `<sitename>/`. In the `createExport()` finalise block:

```js
const root = `${dirName}/`;                       // dirName = sanitised site name
archive.append(indexHtml, {name: root + 'index.html'});
// …
archive.file(…, {name: root + 'global/' + file});
archive.file(…, {name: root + 'assets/' + file});
```

**Notes:**
- **The HTML entry is already named `index.html`** (see `archive.append(indexHtml, {name: 'index.html'})`) — the second half of the request ("rename the html to `index.html`") is already satisfied; it just moves *into* the new folder unchanged.
- **Relative asset paths stay valid.** `index.html` references assets as relative `global/…` and `assets/…` paths (`resolveAsset()` returns them as-is). Because `index.html`, `global/`, and `assets/` all move together into `<sitename>/`, every relative reference is preserved — no path rewriting needed.
- **Folder-name sanitisation.** The site name becomes a ZIP path segment, so sanitise it (strip `/`, `\`, `..`, leading dots; collapse to a safe slug) rather than trusting the raw name. Reuse the site-name validation A14 settles on. The download filename (`<siteName>.zip`, set in `feezal-app-editor.js` `_export()`) can keep using the raw name or the same slug — keep them consistent.
- **Optional:** if any hosting-target docs (A12) or the export help text describe the "loose files at root" layout, update them to the wrapped layout.

> **Status: ✅ implemented.** Entries are wrapped under a sanitised `<sitename>/` root. Follow-up A16 addresses the `global/` subfolder that now sits inside it.


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

### A9 — Mobile app packaging: PWA export + Capacitor project template ✅ all tiers implemented

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

#### Tier 1 — PWA toggle in Site Settings (viewer **and** export) ✅ done

> **Status: ✅ implemented** — `viewer.pwa` toggle in Site Settings; per-site `manifest.webmanifest` + scope-corrected `sw.js` + icon routes (`server/src/build/pwa.js`, wired in `app.js`); export gains manifest/sw/icons with an http-guarded registration (byte-identical when off); editor-side canvas icon pipeline (`www/src/feezal-pwa-icons.js`) with the interact.js crop dialog (`feezal-pwa-icon-dialog`, safe-zone circle, maskable background picker, live previews); both entry points (Site Settings + Asset Manager "Set as PWA icon" with auto-enable toast); icons + source + crop meta stored in `sites/<name>/pwa/` via `PUT/GET/DELETE /api/sites/:name/pwa-icons`. Covered by 13 server unit/route tests, 3 export tests, 9 canvas/dialog component tests and 6 E2E tests (incl. a real `serviceWorker.ready` on the served viewer).

A per-site **"Enable PWA" checkbox in Site Settings** (the `feezal-sidebar-viewer` "Site" tab, next to page title/theme). Persisted as `viewer.pwa: true|false` (default **off**) in the site config (`site.json`), deployed like every other viewer setting. When enabled, **both** delivery paths become installable Progressive Web Apps:

**a) The served viewer** (`/viewer/<site>`) — the server's `viewerHandler` (`server/src/app.js`) injects, only when `viewer.pwa` is set:
- `<link rel="manifest" href="/viewer/<site>/manifest.webmanifest">`, `<meta name="theme-color">` and `apple-touch-icon` links.
- A small registration snippet: `navigator.serviceWorker.register('/viewer/<site>/sw.js')`.
- Two new sibling routes (registered *before* the `:site` viewer route):
  - `GET /viewer/<site>/manifest.webmanifest` — generated per site: `name`/`short_name` = site name, `start_url` + `scope` = `/viewer/<site>`, `display: "standalone"`, theme/background colors (static defaults first; deriving them from the active theme's `--primary-background-color` is a follow-up), icons from `www/favicon/`.
  - `GET /viewer/<site>/sw.js` — minimal cache-first app shell (the viewer page, `/viewer-bundle.js`, icons); everything else network-first. Serving it *under* the site path gives it the right scope without `Service-Worker-Allowed` headers. Live MQTT keeps working offline→online because `feezal-connection` already reconnects.

**b) The export** (`createExport()`) — when `viewer.pwa` is set, the ZIP additionally contains `manifest.webmanifest` (relative `start_url: "."`, `scope: "."`), `sw.js` and the icon set, and the generated `index.html` gains the same manifest/meta links plus a registration snippet guarded by `location.protocol.startsWith('http')` — service workers can't register from `file://`, so the offline bundle stays exactly as functional as today and turns installable the moment it's hosted on any static server. With the toggle **off**, the export is byte-identical to today's output.

**c) Custom app icon — one upload, feezal generates every format (first cut, editor-side).**
The user provides a **single image** (PNG / JPEG / WebP / SVG); all conversions happen **in the editor via the Canvas API** — no server-side image dependency (`sharp`/`jimp` stay out; the server may be a Pi/NAS, and the editor is by definition a modern browser). SVG rasterizes for free via `<img>` → canvas. Warn when the source is smaller than 512×512 (soft upscale).

*Crop dialog* (shared by both entry points):
- A 1:1-locked crop rectangle over the image preview, **movable and resizable** — implemented with interact.js (already a dependency; same drag/resize machinery as the canvas).
- An **always-visible safe-zone circle** inscribed at 80% of the crop area (dashed outline, outside dimmed) — shows what survives Android's adaptive-icon masks and iOS corner rounding.
- A **maskable background color picker**, defaulting to the active theme's `--primary-background-color`, overridable; the picked value is persisted for regeneration.
- Live preview of both variants: the plain icon and a circle-masked rendering (what Android launchers will actually show).

*Generated set* (canvas `toBlob('image/png')` from the confirmed crop):
- `purpose: "any"`: `icon-192.png`, `icon-512.png`, plus `apple-touch-icon.png` (180×180 — iOS applies its own rounding, so the plain variant is correct).
- `purpose: "maskable"`: `maskable-192.png`, `maskable-512.png` — the crop scaled to the 80% safe zone, centered on a full-bleed square of the chosen background color (transparency never leaks into maskable icons). The manifest lists the two purposes as **separate entries** — never `"any maskable"` on one file (the classic double-crop mistake).

*Storage & API*: `sites/<name>/pwa/` (precedent: `certs/`) — the generated PNGs, the original `source.*`, and a `pwa.json` holding crop rect + background color, so the set can be **regenerated** (button in Site Settings; e.g. after a theme switch — no auto-regeneration on theme change, that would be a surprising deploy side effect). `PUT /api/sites/:name/pwa-icons` (generated set + source in one request), `DELETE` resets to the default feezal icons. Deliberately *not* in `assets/` — invisible to the Asset Manager's rename/delete and out of A16's referenced-only export logic; the export copies `pwa/` explicitly, the viewer serves it at `/viewer/<site>/icons/*`.

*Entry points* (both in the first cut):
1. **Site Settings** (primary): upload field + current-icon preview + Regenerate + Reset, next to the "Enable PWA" checkbox.
2. **Asset Manager context menu** — "Set as PWA icon" on any image asset: opens the same crop dialog with that asset preloaded; if the PWA toggle is off it is switched on, announced via toast.

*Default icons* when no custom icon is set — ✅ already available: `www/favicon/` contains `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `apple-touch-icon.png`, `favicon.svg`, `favicon.ico`, and a `site.webmanifest` skeleton to crib from.

**Result:** with the checkbox on, Chrome on Android offers "Add to Home Screen" for the live viewer URL *and* for a hosted export; Safari on iOS installs via the share menu. The installed icon launches the dashboard standalone (no browser chrome) with offline app-shell support.

No app store, no signing, no developer accounts. This covers the majority of home-automation dashboard use cases.

**Testing (A17):** unit — manifest route shape (two icon purposes when a custom icon is set), `pwa: false` leaves viewer page + export untouched, export gains the PWA entries when on; component (browser mode) — the canvas crop/convert pipeline (sizes, maskable padding + background fill, SVG source) and the crop-dialog interactions; E2E — toggle the checkbox in Site Settings, deploy, assert the manifest link + a successful `navigator.serviceWorker.ready` on the served viewer, set an icon via the Asset Manager context menu, and check the export-ZIP entry list.

---

#### Tier 2 — Capacitor project export (Android/iOS app without app-store submission) — 2a ✅ done

> **Status: Tier 2a ✅ implemented** — `server/src/build/capacitor.js` (scaffold: pinned Capacitor 7 `package.json` with `npm run android|ios|assets` convenience scripts via a tiny `scripts/platform.mjs`, `capacitor.config.json` with cleartext enabled for `ws://`, personalised step-by-step `README.md`, `resources/icon.png` from the A9 PWA icon) + `GET /api/sites/:name/export-capacitor` (appId validation, `mqtt://` guard, `viewer.app` defaults); editor: `feezal-capacitor-dialog` (live appId derivation, icon preview, localhost-broker warning) reachable from the deploy caret menu and the Site Settings "Mobile app" block; `viewer.app = {name, id}` persisted via deploy. Docs: `docs/MOBILE-APPS.md`. Covered by 11 server tests + 5 E2E tests (incl. the real ZIP download).

One export serves both platforms — a Capacitor project is platform-agnostic until `npx cap add <platform>` runs, so there are no separate Android/iOS exports and the server never vendors the platform templates (no drift with Capacitor releases).

**Entry points (mirrors the A9 icon pattern):**
1. **Deploy caret menu** (next to "Export ZIP"): *"Export mobile app project…"* — the primary, discoverable home.
2. **Site Settings**, below the PWA section: a *"Mobile app"* block with app name / app ID fields (see persistence below) and the same export action.

Both open the **pre-export dialog**: app name + app ID (`io.feezal.<slug>` derived from the site name — sanitised for reverse-DNS: lowercase, umlauts/spaces stripped — but editable), a preview of the icon that will be used (the A9 PWA icon source; hint to set one when missing), and a **broker-reachability warning** when the connection URI host is `localhost`/`127.0.0.1` — the phone can't reach that; the #1 "app shows nothing" trap. One confirm → ZIP downloads.

**Persistence:** the dialog's values are stored as `viewer.app = {name, id}` in `site.json`, so re-exports keep them; the Site Settings block edits the same values.

**What gets exported** (architecture: project scaffold, user builds — the server never runs Capacitor CLI/Gradle/Xcode):
```
my-dashboard/
  package.json              pinned @capacitor/* versions + convenience scripts:
                            "android": cap add android + sync + open,
                            "ios":     cap add ios + sync + open,
                            "assets":  @capacitor/assets icon/splash generation
  capacitor.config.json     appId, appName, webDir: "www"
                            (+ android:usesCleartextTraffic pre-set — ws:// brokers)
  www/                      the A16 export (relative refs = WebView-safe)
  resources/icon.png        the A9 PWA icon source (512+) — `npm run assets`
                            generates ALL native icons + splash screens from it
  README.md                 generated per site (see below)
```

**User workflow — three commands:** unzip on a dev machine → `npm install` → `npm run android` (opens Android Studio, press Run with the phone connected) or `npm run ios` (opens Xcode on a Mac). `npm run assets` first if they want the native icons.

**The generated README.md** is personalised ("*Wohnzimmer* as an Android app") and step-by-step for the no-store path:
- Prerequisites: Node 20+, Android Studio + JDK 17 (Android) / Xcode 15+ on a Mac (iOS).
- Android sideload: enable developer mode + USB debugging → Run from Android Studio (or `adb install app-debug.apk`). Permanent, no accounts.
- iOS sideload: sign in Xcode with a **free Apple ID** (app re-signs every 7 days — documented honestly), device trust step; the paid Developer Program ($99/y) makes it last a year / enables distribution.
- Broker note: the app must reach the broker over the network — the configured URI is echoed here, with the localhost warning repeated when applicable.
- Capacitor version pinning and how to update it independently of feezal.

A generic repo page (`docs/mobile-apps.md`) covers the same for linking from the UI.

#### Tier 2b — optional server-side APK build via Docker (powerful hosts only) ✅ done

> **Status: ✅ implemented** — `server/src/docker.js` (dockerode; socket discovery, cached engine detection, capability gating, volume/pull/archive helpers — shared with A13) + `server/src/build/apk.js` (single-job build manager: project in via `putArchive`, live log over SSE, 30-min timeout, cancel, APK out via `getArchive`; named volumes `feezal-gradle-cache`/`feezal-npm-cache`). Routes: `GET /api/server/capabilities`, `POST /api/sites/:name/build-apk` (403 without opt-in / 409 busy / 202 job), SSE `…/events`, `…/result`, `DELETE` cancel. Dialog: capability-gated "Build APK on server" button with live log pane + APK download. Build image pinned `mingc/android-build-box:1.29.0` (first tag with JDK 21 — Capacitor 7 needs it; `npm install --include=dev` because the image sets `NODE_ENV=production`), override via `FEEZAL_ANDROID_BUILD_IMAGE`; the site icon is baked in via `capacitor-assets` (best-effort). Verified end-to-end against a real engine: a live `putArchive → build → getArchive` produced a working `app-debug.apk`. Covered by 12 mocked/route tests + a daemon-gated real-Docker integration test + an E2E capability-off test; the full build is a manual TESTING.md item.

For feezal instances on capable x86_64 hosts, the pre-export dialog additionally offers **"Build APK on this server"** — producing a ready-to-sideload `app-debug.apk` with zero local toolchain.

**How feezal starts the build container — Docker Engine API, no bind mounts:**

- A shared module **`server/src/docker.js`** (deliberately also the groundwork for [A13](#a13--update--restart-feezal-from-the-ui)) talks to the Docker Engine API via **`dockerode`** — socket discovery (`DOCKER_HOST` or `/var/run/docker.sock`; Podman's docker-compatible socket works too), engine info, container lifecycle, log streaming, archive in/out, digest-pinned image pulls.
- **No bind mounts, ever**: feezal streams the generated Capacitor project into the created container via `putArchive` (a tar upload) and pulls `app-debug.apk` back out via `getArchive`. This is what makes the design **deployment-agnostic** — bind-mount paths are resolved by the *host* daemon and would break the moment feezal itself runs in a container (its `/tmp` is not a host path). With archives, the same code works whether feezal is bare-metal or a container starting *siblings* through a mounted socket.
- The single exception: the **Gradle/SDK cache** is a **named volume** (`feezal-gradle-cache` at `/root/.gradle`) — named volumes are referenced by name, not path, so they are sibling-safe. First build ~5–15 min (image + dependency downloads, network required); warm builds ~1–3 min.
- Build container: `mingc/android-build-box` **pinned by digest** (it ships Node, needed for `npm install`/`cap add`), overridable via `FEEZAL_ANDROID_BUILD_IMAGE`. Build script: `npm install && npx cap add android && npx cap sync && cd android && ./gradlew assembleDebug`.

**Consent + capability model:**

- **Opt-in required**: the Docker socket is root-equivalent on the host, so the feature activates only when `FEEZAL_DOCKER_BUILDS=1` (or `--enable-docker-builds`) **and** the socket is reachable **and** the engine reports x86_64 (`aapt2` has no official linux-arm64 builds — Pi-class hosts degrade to Tier 2a automatically).
- A capabilities endpoint (`GET /api/server/capabilities` → `{dockerBuilds: true|false}`) drives the dialog button's visibility.

**Job model (a 15-minute HTTP request dies at every proxy):**

- `POST /api/sites/:name/build-apk` → job id (single build at a time, lock).
- **SSE progress stream** (same pattern as the AI chat) pipes the container log live into the dialog; cancel = kill container; 30-min timeout.
- `GET …/build-apk/result` → the APK download; container auto-removed after extraction.
- **Debug-signed deliberately**: debug APKs sideload fine, which is exactly the no-store use case. Release signing (user keystore management) is out of scope.

**Deployment matrix (why bare-metal needs no redesign):**

| feezal runs as | Requirement | Build containers are |
|---|---|---|
| Docker container (current distribution) | mount `/var/run/docker.sock` into the feezal container + opt-in flag | siblings on the host daemon |
| Bare metal (future) | Docker (or Podman with docker socket) installed on the host + opt-in flag | ordinary local containers — same code path |
| No Docker available | — | button absent; Tier 2a project export always works |

Deliberately **no native-toolchain builds** on bare metal (detecting ANDROID_HOME/JDK/Gradle on arbitrary hosts is a support-matrix nightmare) — the container *is* the toolchain encapsulation, regardless of how feezal itself is installed.

**Housekeeping:** the image is ~5 GB plus the ~2 GB cache volume — spec includes a maintenance action ("remove build image + cache") even if it lands later.

- **iOS stays impossible server-side** — Xcode only runs on macOS and Apple's licensing forbids macOS VMs on non-Apple hardware; unsigned IPAs cannot be sideloaded, so there is no Linux workaround. iOS remains the Tier 2a Xcode path.

**Testing (A17):** unit — appId slug derivation, scaffold file set, README generation (localhost warning present/absent), capacitor.config content; E2E — dialog flow from both entry points, persisted `viewer.app` round-trip, export ZIP entry list + README content. Tier 2b: feature-detection fallback logic unit-tested; the Docker build itself gets a manual TESTING.md item (CI runners can't spare 15-minute Android builds).

**Cloud builds (EAS, CI-hosted Gradle/Xcode) were considered and rejected** — they require third-party accounts and uploading signing keys to external services, which contradicts feezal's self-hosted, privacy-focused nature. Tier 2a/2b cover the need without leaving the user's infrastructure.

---

### A21 — Licensing model: AGPL-3.0 core, MIT element SDK and viewer runtime ✅ implemented

**Decision (July 2026):** three tiers:

- **Core (server + editor): AGPL-3.0-only.**
- **Element SDK (`@feezal/feezal-element`) and all official elements/themes: MIT** *(already the case)* — community elements subclass the base class without any copyleft infection; keeps the A20 ecosystem friction-free.
- **Viewer runtime (the code bundled into static dashboard exports): MIT** — exported dashboards stay license-clean artifacts users can publish anywhere; the copyleft-protected asset is the server + editor.

**Rationale:**
- GPLv3 only triggers on *distribution*, which leaves the **SaaS loophole**: someone could run feezal as a hosted dashboard service without ever distributing it, hence without any source obligations. **AGPL-3.0 closes this** (network use triggers source obligations) — the standard choice for server-side software. Self-hosting users are unaffected; they already have the source.
- Noncommercial source-available licenses (PolyForm NC, CC BY-NC, FSL/BUSL) were considered and rejected: they are not open source (no distro/community packaging, blanket corporate bans on NC-licensed software), which would chill the ecosystem A20 depends on. AGPL provides strong protection against proprietary exploitation while staying genuinely open source.
- `-only` rather than `-or-later`: keeps control over future license terms in the copyright holder's hands.

**Implementation (July 2026) — all items done:**
- [x] `LICENSE` (AGPL-3.0-only, official SPDX text) at repo root; MIT `LICENSE` files in all 72 packages (`www/packages/@feezal/*` + `packages/create-feezal-element`).
- [x] SPDX ids fixed: `"AGPL-3.0-only"` in root/`server`/`www` package.json; `"MIT"` in all element/theme/SDK packages incl. the ~49 that had no `license` field at all; `create-feezal-element` → MIT (its scaffold already generated MIT elements).
- [x] MIT viewer boundary marked: the traced **9-file viewer-runtime set** in `www/src` (`viewer-main.js`, `feezal-app-viewer.js`, `feezal-site.js`, `feezal-view.js`, `feezal-connection.js`, `feezal-connection-mqtt.js`, `feezal-connection-feezal.js`, `feezal-history-bar.js`, `feezal-monaco-loader.js` — the set covers both export paths: the filtered per-site build in `server/src/build/export.js` and the fallback full `viewer-bundle.js`) carries per-file `SPDX-License-Identifier: MIT` headers. Shared-with-editor files are MIT because MIT-in-AGPL composes, not the reverse. *(The orphaned `src/feezal-connection-node-red.js` — imported nowhere — was deleted when this item was archived, July 2026.)*
- [x] **CLA**: `CLA.md` = **FLA-2.1** (fetched from the official contributoragreements.org template — 2.1 superseded the 2.0 originally planned), individual+entity, exclusive grant, traditional patent license, jurisdiction Germany. Chosen because German law does not permit copyright assignment — the FLA's exclusive-license-grant model is drafted for German/EU law, gives the maintainer relicensing rights, and contractually guarantees the software always remains FOSS. Enforcement: `.github/workflows/cla.yml` (CLA Assistant Lite, `contributor-assistant/github-action`), signatures stored in-repo at `.github/cla-signatures.json`; explained in `CONTRIBUTING.md`. Activates automatically on the first external PR. *Optional remaining: lawyer review of the final text.*
- [x] Dependency license gate: `scripts/check-licenses.js` (dependency-free; walks all three `package-lock.json`s, production deps only, allowlist, fails CI on anything else) wired into `.github/workflows/ci.yml` as the `license-gate` job. Local run: 628 production deps checked, all clean (permissive + MPL-2.0 build-time + CC-BY-3.0 spdx-exceptions data file). Core stack confirmed AGPLv3-compatible: Lit (BSD-3), Shoelace (MIT), @material/web (Apache-2.0), Monaco (MIT), mqtt.js (MIT), Express/Socket.IO (MIT), interact.js (MIT).
- [x] Model stated in README (License section) and `docs/element-spec.md` (licensing note: subclassing the MIT base class does not place elements under AGPL).

---

## Documentation

### D1 — Element spec (highest priority) ✅ done
`element-spec.md` fully rewritten. Covers: package & naming conventions, `FeezalElement` base class API, `static get feezal()` descriptor in full (palette, attributes with all supported types + `help`/`tooltip`, styles, description, links, restrict, defaultStyle), MQTT subscribe/publish contract, CSS custom property conventions, editor vs viewer mode, publishing checklist, and a complete worked example (toggle button).

### D2 — Self-hosting guide ✅ done
Covered by `docs/user-guide.md` — nginx/Caddy reverse proxy setup, HTTPS, proxy auth, Docker deployment, and CLI configuration are all documented.

### D3 — User guide ✅ done
`docs/user-guide.md` written. Covers: installation & CLI flags, editor layout overview, working with views, placing & configuring elements, right-click context menu, attribute & style inspector, MQTT data binding patterns (basic display, publish, wildcard, dynamic subscriptions, common use-case table), themes, connection settings, site management, static export, asset manager, and keyboard shortcut reference.

### N17 — Asset Manager: view modes, file search, and thumb size slider ✅ done

Three UX improvements implemented in eezal-sidebar-assets.js:
- **View modes**: toggle between Thumbs (grid_view), List (list), and Details (iew_list). Persisted in localStorage. Details view has sortable columns (name/type/size/date).
- **File search**: inline search input filters assets case-insensitively across all folders in the current category. Shows flat results; breadcrumb is hidden while search is active. Esc / × to clear.
- **Thumb size slider**: range slider (48–160 px, step 8) in thumbs mode. Controls --thumb-size CSS variable. Persisted in localStorage.

### N18 — Asset Manager: move/copy cross-scope transfers ✅ done

Context menu for file tiles/rows gains 

### N17 — Asset Manager: view modes, file search, and thumb size slider ✅ done

Three UX improvements implemented in `feezal-sidebar-assets.js`:
- **View modes**: toggle between Thumbs (`grid_view`), List (`list`), and Details (`view_list`). Persisted in `localStorage`. Details view has sortable columns (name/type/size/date).
- **File search**: inline search input filters assets case-insensitively across all folders in the current category. Shows flat results; breadcrumb is hidden while search is active. Esc / × to clear.
- **Thumb size slider**: range slider (48–160 px, step 8) in thumbs mode. Controls `--thumb-size` CSS variable. Persisted in `localStorage`.

### N18 — Asset Manager: move/copy cross-scope transfers ✅ done

Context menu for file tiles/rows gains "Move to site" / "Copy to site" (from global) and "Move to global" / "Copy to global" (from site). Server implements `POST /api/assets/:site/transfer` with `{srcCategory, srcPath, destCategory, destPath, copy}`. On move, `storage.updateAssetRefs()` walks `views.html` and `viewer.json` for the site and replaces the old asset URL with the new one, then auto-commits.

### N20 — Element housekeeping: remove deprecated packages, rename `material-text-field` ✅ done

- Removed `feezal-element-material-progress-circular`, `feezal-element-material-progress-linear`, and `feezal-element-material-value` package directories.
- Renamed `feezal-element-material-text-field` → `feezal-element-material-input` (palette label "Input"). Backward-compat alias `feezal-element-material-text-field` registered with a console deprecation warning.
- `www/package.json`, `scripts/generate-elements.js`, and `www/editor/feezal-elements.js` updated accordingly.

### N21 — Site `/theme` subtopic for runtime theme switching ✅ done

Added `<site>/theme` subscription in `feezal-site.js` `connectedCallback`. Payload: full class name (`feezal-theme-dark-mint`) or just the suffix (`dark-mint`). Removes all existing `feezal-theme-*` classes from `<body>` and applies the new one. Ephemeral (resets on reload).

### N22 — Document site topics in user guide ✅ done

Added **Section 8 — Site topics** to `docs/user-guide.md`, documenting `<site>/reload`, `<site>/view`, `<site>/theme`, `<site>/addclass`, `<site>/removeclass`. Includes instructions for setting the site subscribe topic, a reference table, and `mosquitto_pub` examples. Existing sections 8–12 renumbered to 9–13.

### E36 — Dialog element (eezal-element-material-dialog) ✅ done

Pseudo-element — invisible labelled placeholder in the editor (120×40 px). In the viewer it opens a viewport-centred modal on an MQTT message matching payload-open (open by default) and closes on payload-close (close), ESC, backdrop click, or button press.

Configurable title, Material icon, HTML message body, OK button and Cancel button (each with label, publish topic, and payload). Backdrop click behaviour controlled by close-on-backdrop. Panel dimensions via width and max-height.

Editor shows a static open-state preview overlay alongside the canvas placeholder so the author can see the layout and button styling.

**Package:** www/packages/@feezal/feezal-element-material-dialog/

### E37 — Countdown confirmation dialog (eezal-element-material-countdown-dialog) ✅ done

Pseudo-element — 120×40 px canvas placeholder. On payload-open opens a viewport-centred modal and starts a countdown from duration seconds. A shrinking SVG circular ring visualises progress; the ring turns amber at warn-seconds and red at half that threshold. The body message supports a {seconds} placeholder replaced live.

At zero the element publishes payload-confirm to publish-confirm and closes. Pressing Cancel publishes payload-cancel to publish-cancel and closes. ESC also triggers the cancel action.

**Package:** www/packages/@feezal/feezal-element-material-countdown-dialog/

### E42 - material-plant auto-discovery from multi-sensor device groups (done)

Added per-metric message-property-* attributes to plant element. Server: getDeviceGroups() in discovery.js and GET /api/discovery/device-groups endpoint.

### E40 — Select / dropdown element (feezal-element-material-select) + discovery wiring (done)

Added MQTT auto-discovery descriptor (component: select; maps state_topic -> subscribe, command_topic -> publish, options -> join-transformed comma string, name -> label). Fixed _options getter to accept both comma-separated strings (from discovery) and JSON arrays. Added CSS custom properties for theming: --feezal-select-text-color, --feezal-select-background-color, --feezal-select-popup-background-color, --feezal-select-border-color, all wired to the appropriate MD3 system tokens including the menu container background to fix the dark-on-dark popup issue.

### E41 — CSS custom property audit (done for slider, checkbox, chip, select, fab/B13)

- slider: added --feezal-slider-track-color (inactive), --feezal-slider-knob-color (separate from track), --feezal-slider-track-width, --feezal-slider-knob-size; wired to MD3 direct tokens.
- checkbox: added --feezal-checkbox-inactive-color, --feezal-checkbox-label-color, --feezal-checkbox-size; wired to MD3 outline and container tokens.
- chip: added --feezal-chip-text-color, --feezal-chip-outline-color, --feezal-chip-active-color, --feezal-chip-inactive-color; wired to MD3 filter-chip tokens.
- fab (B13 fix): --feezal-fab-color now correctly maps to --md-sys-color-primary-container (and on-primary-container -> #fff) instead of --md-sys-color-primary, which is what md-fab variant=primary actually uses for its background.

## Near-term Improvements

### N15 ✅ — Source view (Monaco editor for view HTML)

A **Design / Source** toggle (`code` icon, Ctrl+Shift+U) in the view toolbar opens a Monaco HTML editor on the active view's `innerHTML`. Format button (auto-formats on first open), Discard button. Source → canvas via `DOMParser`; parse errors shown inline. Ctrl+S applies source and deploys. View navigation while in source mode commits source first. `feezal-sidebar-inspector.rebindView()` re-attaches interact.js handles after innerHTML rewrite.

**Implemented in:** `feezal-app-editor.js`, `feezal-sidebar-inspector.js`, `feezal-monaco-loader.js`.

### N16 ✅ — Source / diff view in commit history

Three new per-commit icon buttons in the history sidebar: **View source** (`code` — read-only Monaco HTML editor), **Diff vs. current** (`difference` — MonacoDiffEditor, historical left / current right), **Diff vs. parent** (`compare_arrows` — MonacoDiffEditor, parent left / this commit right). Full-viewport overlay, Esc to close, spinner while loading. New server endpoint `GET /api/sites/:name/history/:sha/file?path=views.html` uses the existing `git.showFile()` helper.

**Implemented in:** `feezal-sidebar-history.js`, `server/src/routes/api.js`.

## Editor UX

### U7 ✅ — Monaco editor for template attributes

Elements add `editor: true` to their template attribute descriptor (e.g. `feezal-element-basic-template`). The inspector renders `feezal-template-editor` (new Lit component) instead of `sl-textarea` for those attributes. The component lazy-loads Monaco on first use, shows a spinner during load, debounces change events (300 ms), syncs theme (`vs` / `vs-dark` from `feezal.app._darkMode`), and includes an expand overlay button for large templates. Phase 1 static completion provider triggers on `${` and offers `msg.payload`, `msg.topic`, `msg.payloadString`, `JSON.stringify(…)`, plus extra `variables` from the descriptor (e.g. `seconds` for countdown-dialog). Phase 2 (live payload key completions) deferred — requires server-side payload caching.

Shared infrastructure: `feezal-monaco-loader.js` (single lazy `import('monaco-editor')` cache), `vite-plugin-monaco-editor` in `vite.config.js` (workers: `editorWorkerService`, `html`, `css`, `typescript`). Monaco adds ~3 MB / 984 kB gzip to the editor's async chunks — viewer bundle unaffected.

**Implemented in:** `feezal-template-editor.js` (new), `feezal-monaco-loader.js` (new), `feezal-sidebar-inspector-attributes.js`, `vite.config.js`, `www/package.json`, `feezal-element-basic-template` v1.0.2.
