7 # feezal — Manual test checklist

A pre-release manual QA pass. Copy this list per release (or tick in place and reset).

Since A17, four automated suites run the bulk of the old checklist:

| Suite | Command | Covers |
|---|---|---|
| Backend unit + integration | `cd server && npm test` | storage, REST API (sites/assets/themes/history/certs/ai/packages), export ZIP, auth, git, discovery parsing, bridge + hub against a real broker |
| Frontend logic units | `cd www && npm test` | topic matching, class parser, folder reconcile, AI output validation, broker-URI fields, … |
| Component (real browsers) | `cd www && npm run test:browser` | **every element package mounted** (smoke harness), 12 elements' full MQTT behaviour, N6 custom inspectors (navbar, layout-app + host protocol), E38 scaling (container queries + ResizeObserver), packages sidebar UI (stubbed fetch), control topics, view switching, theme variables + swatch screenshots — chromium locally, +firefox/webkit in CI |
| E2E (server + broker + Chromium) | `cd www && npm run test:e2e` | editor boot, palette drag, inspector topic editing → live value, move/nudge/undo, rubber-band + Ctrl+click selection, copy/paste/duplicate/delete, context-menu lock, source mode incl. error gating, view + **site** management UI, copy-on-use asset drag (B15), deploy, reload restore, viewer retained/live MQTT (bridge **and** direct `ws://`), broker-restart reconnect, **AI assistant against a stub provider**, export ZIP **opened from `file://` with live MQTT** |

`npm run test:all` at the root chains all four.

**This file covers what automation can't judge:** visual appearance and scaling,
touch, cross-browser *rendering*, real networks/TLS and third-party services
(real npm registry, real AI providers, HA/zigbee2mqtt devices). Don't manually
re-verify what the suites assert — if an automated area regresses, add a test
instead of a checklist item.

**Issues found and fixed by the automated suites** (exceptions removed — the tests now enforce them):
- ~~`feezal-element-paper-tabs` subscription leak~~ — fixed (1.0.3); the smoke harness enforces clean disconnects for every element.
- ~~editor boot `querySelectorAll`-on-null errors~~ — fixed (null-safe `feezal.views` getter); the E2E boot check no longer filters anything.
- ~~keyboard-shortcuts modal documented arrow-nudge backwards~~ — fixed (plain arrows = grid size, Ctrl/Shift = 1 px).
- ~~site-manager rename did nothing via Enter / ✓~~ — fixed (`{host: this}` was missing from the portal `render()`, breaking every method-reference listener in the dropdown); pinned by the site-manager E2E.
- ~~elements with a user-set `z-index` (e.g. a media player) painted above the PIN lock overlay~~ — fixed (0.1.1: the overlay now lives in the browser top layer via the popover API); pinned by the system-pin component tests.

**Legend:** `[ ]` to do · `[x]` pass · `[!]` bug found (note it) · `[-]` n/a.

---

## 0. Setup / environment matrix

Run the critical paths in more than one configuration.

- [ ] Editor loads with **no console warnings/errors** (uncaught Chromium errors are gated by E2E with no exceptions; watch for *warnings* and non-Chromium errors).
- [ ] Browsers: [ ] Firefox  [ ] Safari/WebKit — component tests run there in CI; check *editor UX and rendering* (the E2E layer is Chromium-only).
- [ ] Theme: [ ] light  [ ] dark (toggle in Editor Settings) — check panels, dialogs, inspector.
- [ ] Viewport: [ ] desktop  [ ] narrow/mobile (or device emulation).
- [ ] Connection: [ ] `wss://` with TLS certs (N8) against a real broker. *(`mqtt://` bridge and plain `ws://` direct are automated.)*
- [ ] A broker with some retained topics available (for MQTT binding + auto-discovery tests).

---

## 1. Smoke test (≈2 min critical path)

The "does anything work at all" pass. If any step fails, stop and fix before the rest.
(Site creation, element drag/edit/deploy, viewer MQTT, reload restore and the
file:// export all run automated on every change.)

- [ ] **Resize** a canvas element via the handles; element + guide **snapping** feels right.
- [ ] Change the theme → editor + viewer reflect it visually.

---

## 2. Verify-first — recently built, not yet browser-tested

These shipped this cycle and were validated by build/unit tests **only** — give them a real click-through first.

### Release notes grouping (A22) — verify on the next tag

- [ ] Push the next release tag → the generated GitHub release body groups commits into **Features → Fixes → Docs → Chore** sections (Chore includes test/ci/refactor/build/style/perf; the `chore(release)` commit itself is absent); commits without a conventional prefix appear in a trailing **Other** section; empty sections are omitted; the Full-Changelog compare link and the Docker update instructions are unchanged.

### Mobile app project (A9 Tier 2a) — real build on a dev machine
The export dialog, scaffold/README content and ZIP download are automated —
the actual toolchain run is not:

- [ ] Unzip an exported project → `npm install` → `npm run android` → Android Studio opens; Run installs on a USB-connected phone; dashboard connects to the broker.
- [ ] (Mac) `npm run ios` → Xcode signing with a free Apple ID → runs on an iPhone.
- [ ] `npm run assets` generates native icons/splash from `resources/icon.png`.

### Server-side APK build (A9 Tier 2b) — real Docker build
Capability gating, the job routes/SSE and the container pipeline are automated
(mocked engine + a daemon-gated integration test); the pipeline has produced a
verified APK once — re-check after changing the build image or Capacitor pin:

- [ ] With `FEEZAL_DOCKER_BUILDS=1` on an x86_64 host: "Build APK on server" appears in the export dialog; the log streams live; Download yields an `app-debug.apk` that installs via `adb install` and shows the dashboard with the site icon.
- [ ] Cancel mid-build → container gone (`docker ps`), dialog shows "cancelled", a new build can start.
- [ ] Without the env flag (or on arm64): the button is absent, `POST …/build-apk` → 403. *(automated too — quick sanity click)*

### Server restart / self-update (A13) — needs a containerized feezal
Capability logic, watchtower container spec and route gating are automated —
the live path needs a real feezal container with the socket mounted:

- [ ] Run feezal as a container with `/var/run/docker.sock` mounted and `FEEZAL_DOCKER_SELFUPDATE=1` → Editor Settings shows the Server section; **Restart** brings the editor back automatically (auto-reload).
- [ ] **Update…** pulls the image via a one-shot watchtower, recreates the container with identical config, editor comes back on the new container.
- [ ] Bare metal with `FEEZAL_ALLOW_RESTART=1` under a supervisor (systemd/pm2): Restart exits the process and the supervisor brings it back.

### PWA (A9 Tier 1) — real-device installs
The toggle, manifest/service-worker routes, icon pipeline (crop, maskable,
uploads via both entry points) and export bundle are automated — what's left
is the part only real hardware can prove:

- [ ] Android/Chrome: open the viewer URL → "Add to Home Screen" appears; installed app launches standalone with the custom icon (maskable shape looks right on the launcher).
- [ ] iOS/Safari: share-menu install; icon + standalone launch.
- [ ] Offline: installed app opens with cached shell after airplane mode; live values return when the network does.

### Elements (E44–E47)
- [ ] **Responsive Layout** (`layout-responsive`): add breakpoint rules (min/max width, orientation) each → a view; in the viewer, resizing the window **swaps** the mounted view at the thresholds; only the active view's elements are subscribed (no double subscriptions); portrait/landscape rule wins when ordered first.
- [ ] **App Layout** (`layout-app`): top bar + drawer render; picking a drawer entry **swaps the embedded content view**; shrinking the element past `breakpoint` collapses the drawer to an **overlay + hamburger** (+ scrim closes it); title (static and `subscribe-title`); action buttons publish; **hide-header** removes the top bar and (in overlay mode) shows a floating hamburger that still opens the drawer; entry/action **icon fields autocomplete** with the tile picker (same UX as the generic icon control, incl. set chips); **entry-style** (inspector → Drawer → Entry style): default `pill` = rounded chips with side inset, `list` = flat rows without radius where hover/active highlight the **full drawer width** edge-to-edge — switch live and check both hover and the active entry in both modes. *(The N6 inspector add/reorder/remove + create-view, the icon-input component and its items wiring are automated.)*
- [ ] **Navbar** (`material-navbar`): tapping navigates; **active item follows** the current view from tab bar / swipe / MQTT; badges update from MQTT; orientation/labels/align render right; empty → auto-fills all views; **item-width (E81)**: a CSS length gives every destination that fixed size, `equal` shares the bar evenly, empty keeps content sizing (vertical orientation: applies to the height). *(The N6 inspector item editing + item-width sizing are automated.)*
- [ ] **PIN Lock** (`system-pin`): navigating away and back re-locks (unless remembered). *(Placeholder-in-editor, keypad overlay incl. covering high-z-index siblings, wrong/correct PIN, clear, and `remember` are automated.)*

### AI assistant — agent mode, needs a real provider
Non-agent chat (streaming, proposal card, Accept, model list) is automated
against a stub provider — this block is about **agent/tool mode + real providers**.

- [ ] Configure a real provider (OpenAI-compatible, Anthropic, Ollama — for Ollama set **`num_ctx` ≥ 8192`**); connection test + model list work for each type.
- [ ] Ask a change with **agent mode ON** → tool activity streams (searching topics / reading payload / searching devices), then a confirmation card.
- [ ] Ask "add switches for all `<room>` lights" → it resolves via discovery/topics, wires `subscribe`/`publish` (`…/set`), correct `payload-on/off`, and a real element tag; **Accept** applies it.
- [ ] Ask for a **new view** ("make a new page for …") → "Create new view" card → applies + navigates.
- [ ] Assistant messages render as **Markdown** (code blocks, lists, links open in a new tab).
- [ ] Empty/failed agent turn shows a clear error (no phantom "(proposed a change)").

### Package Manager — real npm, needs network
The whole sidebar UI (search, install, update badge, remove, rejection errors,
reload prompt) is automated against stubbed endpoints — what's left is the real thing:

- [ ] **Type filter tab bar**: All · Elements · Themes · Icons · Sets render as a tab bar (same styling/alignment as the Inspector and Site Settings tab bars); switching tabs filters the Installed list and clears stale search results.
- [ ] Install a real published `feezal-element-*` from npm; after reload the element is in the palette; **Update** and **Remove** round-trip.
- [ ] **Update installs the badge's version, even right after a publish**: with an older version installed and the `→ x.y.z` badge showing, click **Update** → after the reload the Installed row shows exactly the badge's version (the client sends that version explicitly and the server installs with `--prefer-online`, so npm's 5-minute packument cache can't reinstall the old one). The server log shows `install: npm install <pkg>@<version>` and `install: resolved <pkg>@<version>`.
- [ ] **Installed packages in viewer + export (N27)**: with an installed element placed on the canvas and deployed → the **live viewer** renders it working (the page source shows a `<script type="module" src="/user-elements/…">` tag per used package; unused installed packages are not injected). A **static export** of the same site renders it from `file://` too (the bundle is inlined into index.html) and the export dialog's size report shows an `(installed)` bucket. Same for an installed **theme** set as the active theme. *(Selection, injection and inlining are unit-tested; this is the real-browser check.)*
- [ ] **Element sets (N29 Phase A)**: search for `eink` (or filter **Sets**) → `@feezal/feezal-elements-eink` appears with the `set` chip; **Install** expands it — after reload all member `feezal-element-eink-*` elements are in the palette; the Installed list shows the set row with its members indented beneath; **Remove** on the set removes the marker AND its members (a member also installed individually or owned by another set survives); **Remove** on a single member leaves the set and siblings; **Update** on the set reinstalls all members at latest. *(Type/keyword plumbing, bundle expansion write layout, set-aware remove and the grouping UI are unit-tested; this is the real-registry check.)*
- [ ] **Multi-element families (N29 Phase B)**: install a published `feezal-elements-*` package carrying `feezal: {type: "elements", elements: [...]}` (one bundle, many tags — none published yet; when the first family ships, use it) → ONE row in the Installed list (Sets filter, `set` chip, no indented members); after reload **every** tag from its manifest appears in the palette and drops onto the canvas; source-mode tag completion offers the family's tags; **Remove** deletes the whole family in one step; a static export of a site using two of its elements includes the family bundle exactly once (both elements render). *(Discovery/registry/tag-map/install-path are unit-tested; this is the real-registry + export check.)*

---

## 3. Editor — core

(Selection — rubber-band, Ctrl+click toggle, view-select on empty canvas —
copy/paste offset, Ctrl+D, Delete, context-menu lock/unlock incl. drag-blocking,
single-element move, arrow nudge, single undo, source-mode error gating + apply,
and palette drag-to-canvas are all automated.)

- [ ] **Resize** via handles; **snapping** to other elements + grid (both axes); snap guide lines show/hide correctly.
- [ ] **Grid:** toggle visibility; change size + colour (both axes use the colour); grid aligns to the view origin, not the toolbar.
- [ ] **Undo / redo** breadth: multi-step sequences, redo (Ctrl+Y), across add/delete/source-apply.
- [ ] **Undo keeps the selection:** select an element, change an attribute/style/position, Ctrl+Z → the same element stays selected and the inspector shows the restored values; repeated Ctrl+Z keeps tracking it. Undoing the element's own creation (or a structural change that removed it) falls back to the view selection — never silently selects a different element type. *(Capture/re-match semantics are unit-tested.)*
- [ ] **Cut** (Ctrl+X) and paste; group IDs remapped (if grouping used).
- [ ] **Clipboard keeps light-DOM children (B31)**: copy/paste, cut+paste and duplicate (Ctrl+D) a `basic-template` with template content → the pasted element renders the same template (not empty); same for a dialog with a template body and a layout element with children. *(Deep-clone behaviour is unit-tested.)*
- [ ] **Context menu:** copy-to-view and move-to-view submenus. *(Lock/unlock is automated.)*
- [ ] Locked state **persists after deploy** (amber outline back after reload).
- [ ] **Oversized/scrolled canvas drags (B8)** — fix shipped 07/2026 after multiple reverted attempts; test thoroughly: **auto-sized view** (100%×100%) with elements below/right of the fold → scroll the canvas, drag an element to the very bottom/right of the *existing* canvas → it lands under the pointer (previously it stopped short by exactly the scroll offset); dragging past the farthest element's edge **stops there — a drag never grows the canvas** (the boundary is snapshotted at drag start; dragging the farthest element itself can move it inward/along the edge but not outward). **Fixed-px view** → elements still clamp exactly at the view edge and the far edge is reachable; no spurious scrollbar at the bottom edge of a not-yet-overflowing canvas. **Snap guide lines**: on a horizontally scrolled canvas, vertical guides appear exactly on the aligned element edges (previously offset by the scroll amount); check with a view margin set, too. Also re-check plain drags, multi-select drags, resize snapping, arrow nudge, and undo after drag — this code path broke in past attempts. *(Restriction geometry incl. extent-snapshot semantics, scrolled snap-line placement, canvas-never-grows, and the old-clamp regression are unit/browser/e2e-tested.)*
- [ ] **Keyboard shortcuts** modal (`?`) lists correct bindings; each works.
- [ ] **Source mode:** format document; editing comfort (highlighting, completion).
- [ ] **Palette** (left): categories in order; search filter works.
- [ ] **Sidebar tabs** (right): Inspector · Theme · Site Settings · Assets · Packages · Version history · Editor Settings — each opens its panel; no empty/dead tab.
- [ ] **Deploy auto-reload (N32)**: open a viewer (via-server mode) next to the editor → Deploy → the viewer reloads by itself and shows the new dashboard; the editor does NOT reload. With a direct-MQTT viewer and the site's `subscribe` control topic wired → same behaviour via the `<subscribe>/reload` publish (check the broker: the publish is NOT retained). Two sites open → deploying site A never reloads site B's viewers. Site Settings → Viewer → "Reload viewers on deploy" off → deploy reloads nothing (both paths), and the setting survives deploy + editor reload. *(Broadcast scoping, opt-out and the MQTT publish are covered by server hub tests.)*
- [ ] **Site Settings tabs**: Connection · Site · Viewer · Clients. Connection = broker/auth/TLS/client; Site = name/title/topics/PWA/mobile app; Viewer = "Viewer connection mode" (via-server switch), "Viewer presence" and "View playlist"; Clients = the live viewer list (formerly its own sidebar tab — a persisted `sidebar=clients` selection falls back to Site Settings). Settings changed on the Viewer tab persist through deploy exactly as before the split.
- [ ] **Tab bar alignment**: the inner tab bars of Inspector, Site Settings and Editor Settings — and the **Version history header** — share their bottom edge with the view tab bar left of the sidebar (41px, 2px border) — no vertical offset.
- [ ] **Editor Settings tabs**: Editor Settings · AI Assistant — editor-level settings (theme, colors, grid/snapping, MQTT guard, capability-gated Server section) in the first tab, the complete AI assistant configuration (provider/endpoint/key/model/limits, Save + Test connection) in the second; both scroll independently.
- [ ] **Sidebar panels scroll** when taller than the viewport: shrink the browser window height, then check Inspector (Attributes/Styles with an element selected), Site Settings (both tabs), Theme and Editor Settings — each shows the same thin scrollbar as the palette and reaches its bottom content; nothing is clipped without a scrollbar.
- [ ] Sidebar + palette **collapse** toggles; widths persist across reload.

### Welcome tour (U37)

- [ ] **Auto-start on first use**: clear the `feezalTourSeen` localStorage key and load the editor with an **empty** site → the spotlight tour starts by itself (dimmed editor, cutout on the palette, explanation card). A site that already has elements never auto-starts the tour.
- [ ] **Steps (U41 order)**: Next walks palette → canvas → inspector (sidebar switches to the Inspector tab by itself) → Deploy button → **Theme** (sidebar switches to Theme, picking one works while spotlighted) → broker **host field** (spotlight sits on the Host input inside the Connection tab; the text says hostname/IP only — no `mqtt://` prefix, protocol/port have their own fields) → broker **status indicator** (spotlight moves to the server↔broker status line) → hands-on exercise. Back returns; the dots show progress; the cutout animates between targets and follows window resizes.
- [ ] **Interaction blocking**: during the four explanation steps, clicks on the editor do nothing (stray clicks can't derail the tour); from the broker step on, the editor is fully usable under the dimming.
- [ ] **Hands-on progression (event-driven)**: the drop step spotlights the **Template tile itself** in the palette (Basic category auto-expands and scrolls it into view; with a search filter active it falls back to the whole palette); drag it onto the canvas → the tour advances by itself; set its `subscribe` topic *and* template content (e.g. `${msg.payload} °C`) in the inspector → advances again; final card points at Deploy; **Done** ends the tour. Next also works as manual override on every hands-on step.
- [ ] **Skip & persistence**: *Skip tour* at any step closes it and sets the seen-flag — reloading never auto-starts it again.
- [ ] **Re-launch**: Editor Settings → Help → *Show welcome tour* restarts it anytime (also after it was skipped). *(Step machinery, sidebar switching, click-blocking, hands-on advance and the trigger gating are unit/browser-tested.)*

## 4. Editor — inspector

- [ ] **Attributes:** every attribute type renders the right control (text, number, select, boolean, color, mqttTopic w/ autocomplete, icon w/ autocomplete); help tooltips show.
- [ ] **Monaco editors** (template attributes, system-script, source view, history diff): syntax highlighting renders for HTML *and* javascript; `${…}` completions in templates, `fzl.` completions in scripts. The bundle registers **only** html/css/javascript/typescript (`src/monaco-slim.js`) — an element needing another language must extend that file (and `vite.config.js` if the language has a worker). *(Language registration, tokenization and worker boot are e2e-tested: `test-e2e/monaco-smoke.test.js`.)*
- [ ] **Live-apply while typing (U36):** type into a text/number/topic/style field → the canvas updates ~250 ms after the last keystroke *without* leaving the field; the caret never jumps mid-typing; blur/Enter commits immediately; **one Ctrl+Z undoes the whole typing burst** (not per-character); switching elements mid-typing never applies the value to the new selection. *(Debounce/flush/cancel/one-undo-step semantics are unit-tested.)*
- [ ] **Multi-select** shows the intersection; "— varies —" for mixed; editing applies to all.
- [ ] **Styles** tab: position/size, custom CSS props with autocomplete + CSS-var colour resolution in the picker; per-property mixed handling.
- [ ] **Classes** selector applies/removes `feezal-class-*`; conflicting inline styles cleared with a note.
- [ ] **Custom (N6) inspectors** for the remaining ones: layout-flex, layout-responsive, light, climate, cover, alarm-panel, humidifier, media-player, vacuum, repeater, energy-flow. *(navbar + layout-app + the host protocol are automated.)*
- [ ] **List editor (U35)** (radio/select `options`, alarm-panel/humidifier `modes`, fan `preset-modes`, computer-stats `rings`, paper-dropdown `items` (value/name), paper-tabs `items` (bare names)): the attribute renders as rows instead of raw JSON — add / edit / ✕ delete / **drag-handle reorder** all update the element live; the `rings` editor shows a colour swatch and numeric `max`; fan presets / tab names are single-column bare-string lists; paper-dropdown's Polymer-escaped (`&quot;`) attribute parses fine; a legacy slash-separated paper-tabs value opens in the raw fallback (still renders in the viewer); hand-edit the attribute to invalid JSON in source mode → the inspector falls back to a raw text input without destroying the value. *(Parse/serialize/reorder round-trips and the paper formats are unit/browser-tested.)*

### Conditions (E50)

*(Engine semantics — operators, AND-combined visibility, later-row-wins, pristine revert, editor no-op, runtime re-edit — are unit-tested; this is the UI + live-broker pass.)*

- [ ] Select a single element → a **Conditions** tab appears beside Attributes/Styles (not for the view, multi-selection, or component instances); the tab label shows the row count (e.g. "Conditions · 2").
- [ ] Add a row: topic input offers **MQTT autocomplete** but accepts free text (incl. `${param}` — no autocomplete for placeholders); operator/value/action selects render; action-specific fields switch correctly (class name / style key-value rows with add-remove / attribute select from the element's declared attributes + custom… fallback / keep-layout checkbox for show-hide).
- [ ] Rows reorder via ▲▼ and delete via ✕; deleting the last row removes the `conditions` attribute (check in source mode).
- [ ] Element with ≥ 1 condition shows the **👁 badge** (top-left) on the canvas; effects are **not** applied in the editor.
- [ ] The `conditions` JSON round-trips through the **Monaco source editor** (edit there → inspector reflects it).
- [ ] **Viewer:** `hide` row hides on matching payload and restores on unmatch (with `keep-layout`: element keeps its space); `class`/`style`/`attribute` rows apply and revert; a `show` row keeps the element visible only while matched (after the first message); retained topics apply on load.
- [ ] Conditions survive save/deploy/reload and the static export.

## 5. Views & navigation

- [ ] Reorder / delete views; view folders — drag into folders, nesting UI.
- [ ] Tab bar reflects views; hidden/foldered views excluded as configured.
- [ ] Viewer: navigate via **Navigation** element, **Navbar**, swipe (if used).
- [ ] Region/embedded views (layout-flex / layout-responsive / layout-app / layout-view) render the referenced view in editor (placeholder) and viewer (live).
- [ ] **Umlaut view names (B30)**: create a view named `Küche` → switching to it works from the view tabs, navigation elements, and a direct URL `…#/Küche` (browser shows `#/K%C3%BCche`) in both editor and viewer; reloading on that hash stays on `Küche` instead of falling back to the first view; the address-bar hash doesn't flicker/rewrite on every switch. *(Hash decode + sync loop are browser-tested.)*

---

## 6. Elements

**Automated baseline:** every element package mounts cleanly (smoke harness);
`button · switch · image · number · gauge · slider · progress · checkbox ·
contact · motion · select · input` have full MQTT behaviour covered; E38
scaling is asserted for the container-query and ResizeObserver mechanisms
(checkbox, slider, select).

**Manual recipe — per element, focus on what's left** (tick in the table below):
1. Configure via the inspector (element-specific attrs render sensible controls).
2. Resize across a reasonable range → internal UI **scales** without clipping (E38) — visual check; the mechanism itself is automated.
3. Deploy → **viewer**: reacts to live MQTT / publishes on interaction *(skip for the automated 12)*.
4. Light + dark theme: colours inherit the theme / `--feezal-*` tokens.
5. Icons (where used) render as glyphs, **not literal text**.

### Basic
- [ ] chart · [ ] datetime · [ ] iframe · [ ] image · [ ] navigation · [ ] number · [ ] svg · [ ] table · [ ] template

### Layout (composite — also test embed & swap)
- [ ] layout-flex · [ ] layout-responsive · [ ] layout-app · [ ] layout-repeater · [ ] layout-view

### System (pseudo-elements — placeholder in editor, behaviour in viewer)
- [ ] system-pin · [ ] system-script · [ ] system-connection-status

### Material
- [ ] alarm-panel · [ ] badge · [ ] button · [ ] camera · [ ] checkbox · [ ] chip · [ ] climate · [ ] clock · [ ] computer-stats · [ ] contact · [ ] countdown-dialog · [ ] cover · [ ] dialog · [ ] door-lock · [ ] energy-flow · [ ] fab · [ ] fan · [ ] gauge · [ ] humidifier · [ ] icon-button · [ ] input · [ ] light · [ ] map · [ ] media-player · [ ] motion · [ ] navbar · [ ] plant · [ ] progress · [ ] radio · [ ] schedule · [ ] select · [ ] slider · [ ] switch · [ ] tank · [ ] time-picker · [ ] vacuum

### Carbon (E85 — IBM Carbon Design System)
- [ ] button · [ ] switch · [ ] checkbox · [ ] slider · [ ] select · [ ] input

### Glass (E58 frosted cards)
- [ ] button · [ ] sensor · [ ] light · [ ] switch · [ ] climate · [ ] contact · [ ] shutter · [ ] occupancy

### Metro (E55 live tiles)
- [ ] tile · [ ] switch · [ ] light · [ ] climate · [ ] sensor · [ ] media · [ ] contact · [ ] occupancy

### Panel (E56 analog cockpit)
- [ ] led · [ ] switch · [ ] 7seg · [ ] gauge · [ ] knob

### TUI (E59 terminal / retro-CRT)
- [ ] value · [ ] checkbox · [ ] menu · [ ] sparkline · [ ] log · [ ] ascii · [ ] panel · [ ] crt

### Paper (legacy)
- [ ] badge · [ ] button · [ ] card · [ ] checkbox · [ ] dialog · [ ] dialog-view · [ ] dropdown · [ ] listbox · [ ] slider · [ ] switch · [ ] tabs

### Element-specific notes
- [ ] **Carbon family (E85)** (carbon-button/switch/checkbox/slider/select/input): wraps `@carbon/web-components` the way the material family wraps `@material/web` — attribute contracts mirror the material siblings one-to-one (same subscribe/publish/payload-on/off/message-property descriptors), only the presentation is Carbon's sharp-cornered enterprise look. **button**: Carbon kinds (primary/secondary/tertiary/ghost/danger) via `variant`; E79 active-state highlight follows `payload-active`/`-inactive`. **switch**: Carbon toggle — ON track colour comes from `--feezal-switch-track-on` (wired onto Carbon's support-success token, so it's the theme primary, not Carbon's green); `state-labels` shows On/Off text; `--feezal-switch-border-on`/`-off` draw a track border per state (OFF defaults to the primary colour, ON to transparent — Carbon's track has no border of its own, the ring is injected into the toggle's shadow root as an inset outline, so it must not shift the layout). **slider**: Carbon always shows min/max labels (by design, no hide option); B17 derived step applies; unfilled track defaults to the primary colour, `--feezal-slider-knob-color` styles the handle (defaults to the primary text colour). **select/input**: field with a primary-coloured bottom border by default — check the field background/border tokens follow light AND dark themes; `--feezal-select-popup-background-color` colours the dropdown option list (injected option styling — Chromium/Firefox honour it, Safari/mobile native pickers ignore it). Carbon's density is fixed (no E38 container-query scaling in the first cut) — verify the default sizes look right rather than expecting the internals to scale with the element. Fonts fall back from IBM Plex Sans (not bundled) to the system stack. *(MQTT contracts for button incl. E79 and switch are browser-tested; all six mount via the smoke harness; slider step derivation is unit-tested.)*
- [ ] **Glass family (E58)** (glass-button/sensor/light/switch/climate/contact/shutter + `feezal-theme-glass`): frosted `backdrop-filter` cards over the theme's gradient wallpaper (set view backgrounds transparent, or use your own wallpaper image — the frost is the theming); check light AND dark (frost variables follow `prefers-color-scheme`); `degrade` on any card swaps the live blur for a semi-opaque solid — verify on a weak tablet that scrolling stays smooth with it on; squircle corners round-trip (Chrome 139+ gets `corner-shape`, others the radius fallback). **button** (renamed from scene): tap publishes, `payload-active` highlights. **no shadow rectangle**: card shadows render rounded and unclipped (host overflow visible) — check corners and while pressing. **sensor**: value/unit/decimals. **light**: tap toggles, **long-press or the ⋯ button opens the Apple-Home-style details popup** (top layer, ~200px wide): big vertical brightness pill (drag anywhere on it), colour-temperature slider beneath, round hue/saturation wheel at the bottom — sections appear per capability, brightness is always offered on dimmables; outside tap closes without toggling the card; full material-light wiring contract — `payload-mode: json` (z2m single-topic), `on-off-source: brightness` (Homematic LEVEL, payload-on `1.005` restore), `mode` picks the back sliders (brightness / brightness+ct / ct / rgb / hs), colour temp kelvin/mired, discovery maps `supported_color_modes`/mired range — effects/white stay material-light’s; two-tab Topics/Config inspector. **switch**: material-switch contract, tap toggles, per-state `icon-on`/`icon-off`, availability badge. **contact**: material-contact contract (open/closed/`payload-tilted`, availability badge, `type` picks the icon); flat attribute form like the material sibling. **shutter**: material-cover contract (json/separate, up/stop/down payloads, position, optional tilt slider, invert, availability) with the two-tab inspector; plain tile — tap opens the details popup: vertical position pill (fill = open %, drag to set), up/stop/down buttons, tilt slider when configured. **climate** (renamed from thermostat): material-climate contract (setpoint/actual/mode subset, json TRV shape + separate topics, min/max/step/unit, modes list, discovery incl. °C/°F unit map); card shows actual + → setpoint + mode; popup: vertical setpoint pill (snap to step, actual shown at the top) with mode buttons beneath. Auto-discovery wires all three device cards (light/binary_sensor/cover). **Popups** (light/shutter/climate) anchor ABOVE their card (below when no room), clamped to the viewport near borders — check a card in each screen corner. **switch/contact**: state texts configurable (text-on/off resp. text-open/closed/tilted). **occupancy**: same material-motion contract as the metro tile (type icons, texts, availability, discovery incl. device_class), card highlights while detected. **All cards**: topics set via the inspector start flowing ON THE LIVE CANVAS immediately (subscription rewire — no reload needed). *(MQTT contracts, E77 derivation, payload matching, json/separate publishes, colour/CT round-trips, the live-canvas rewire, editor guards and inspector registration are unit/browser-tested.)*
- [ ] **Metro family (E55)** (metro-tile/switch/light/climate/sensor/media/contact): flat accent tiles (`--feezal-metro-accent`, WP7 look with `feezal-theme-metro`); the `size` attribute (1x1/2x2/4x2/4x4) snaps the element to the 70px+10px mosaic grid — mixed sizes align; tiles with detail controls show the ⋯ affordance and **flip with the 3D Y-rotation** (front tap = base action, ⋯/outside tap flips back, instant under `prefers-reduced-motion`, flip state never published); front-only tiles (contact, plain tile) have no ⋯; light/climate always flip (ON/OFF resp. setpoint stepper), extra controls gate on their topics. **switch/light**: whole tile toggles on tap, accent=ON / dark=OFF; light: `mode` (brightness/brightness+ct/ct/rgb/hs) picks the back sliders, `payload-mode: json` covers zigbee2mqtt single-topic lights (autodiscovery sets it via the schema), `on-off-source: brightness` covers HmIP/Homematic dimmers without an on/off datapoint — all identical to material-light; **climate**: setpoint stepper clamps to min/max, mode chips; **sensor**: back trend polyline + min/max; **media**: front tap = play/pause, back transport + volume; **tile**: publish and/or navigate-to-view on tap, live badge top-right; **switch/light** take per-state `icon-on`/`icon-off` (base `icon` as fallback); **occupancy** mirrors the Device occupancy card (material-motion): payload-active/clear incl. JSON {state} + boolean coercion, type (motion/presence/radar/zone) picks the icon, icon-active/icon-clear + text-active/text-clear per state, availability ! badge, discovery maps device_class; **contact** mirrors material-contact — `type` visuals (window incl. tilt + mirrored handle, door, generic, leak, fire, garage), `payload-tilted`, availability `!` badge, `icon-open`/`icon-closed` overriding the visual, discovery maps `device_class` → type. *(Flip machinery, size grid, MQTT contracts incl. editor guards and capability gating are browser-tested: `test-browser/feezal-elements-metro.test.js`.)*
- [ ] **TUI family (E59)** (tui-value/checkbox/menu/sparkline/log/ascii/panel/crt): monospace phosphor look shared via `--feezal-tui-color/bg/glow/font` (green default; retheme once for all); pair with the `feezal-theme-tui` theme for the full console page. **value**: dot leaders stretch with the element width, cursor block blinks ~2 s after each message (steady under `prefers-reduced-motion`); **menu**: digit hotkeys work with the menu focused, entries flash on activation; **sparkline**: block characters follow min/max or auto-scale; **log**: MQTT wildcards (`+`/`#`) feed it, buffer scrolls to the newest line; **ascii**: unsupported characters render blank (digits, `:.%-°+`, small letter set); **panel**: the box-drawing frame closes cleanly at any element size / font-size and the embedded view renders live in the viewer; **crt**: purely decorative overlay — click-through in viewer, selectable in editor, flicker stays off under `prefers-reduced-motion` and is off by default. *(MQTT binding, publish contracts incl. editor guards, hotkeys, block/segment rendering, wildcard log, frame geometry and CRT layers are browser-tested: `test-browser/feezal-elements-tui.test.js`.)*
- [ ] **Panel family (E56)** (panel-led/switch/7seg/gauge/knob): transparent host background — the instruments carry their own faces (style the element `background` if a console plate is wanted); `--feezal-panel-bezel/text` (+ `--feezal-panel-face` on gauge dial / 7seg window) retheme the family; check on a light theme. **knob**: drag-to-turn feels right on touch (finger angle tracks, no page scroll), detents snap, wheel + arrows step, editor canvas drag never turns the knob; `start-angle`/`sweep-angle` reshape the throw, `ticks` configurable. **switch**: lever visible, points at the active position and snaps with overshoot; `direction` places OFF (down/up/left/right — horizontal layout for left/right), `label-on`/`label-off` engrave the markers, `guard` cover must be opened first and auto-closes after 4 s; **gauge**: needle springs (overshoot + settle) instead of jumping, zones render as coloured bands, `start-angle`/`sweep-angle`/`ticks`/`minor-ticks`/`tick-labels` reshape the dial, `show-value` + `value-prefix`/`value-suffix` + `--feezal-panel-gauge-value-size/color` control the readout; **7seg**: value right-aligned with ghost segments, decimal point, minus, `Err`-style letters; **led**: `states` list maps payload→colour with blink/blink-fast. *(State binding, publish contracts incl. editor guards, guard cover, detents/wheel/keys drag math, dial geometry/tick/readout options, segment/zone geometry, the lever-rect regression and the needle spring are browser-tested: `test-browser/feezal-elements-panel.test.js`.)*
- [ ] **Base-class availability (N31)** (all glass/material/metro device cards): single-topic `subscribe-availability` behaves exactly as before (badge on `offline`, gone on `online`, JSON `{"state":…}` payloads unwrapped); NEW multi-topic form — set `subscribe-availability` to a JSON array (e.g. `[{"topic":"zigbee2mqtt/bridge/state","property":"payload.state"},{"topic":"zigbee2mqtt/dev/availability","property":"payload.state"}]`) → with `availability-mode` `all` (default) the badge appears when ANY topic reports offline, with `any` only when all do; changing the topics via the inspector rewires live; the `unavailable` host attribute appears on the element in the VIEWER only (check the editor never serialises it into views.html). **Discovery**: dropping a zigbee2mqtt-discovered device onto any element auto-wires the availability array incl. per-entry `payload.state` paths — no element-specific mapping involved. *(Base machinery incl. modes/rewire/editor-gating and the server-side normalization are unit/browser-tested.)*
- [ ] **Light state labels (E99)** (glass-light, material-light): set `label-on`/`label-off` on glass-light (e.g. "Ein"/"Aus") → the card's state line shows them, brightness keeps appending ("Ein • 60 %"); material-light's `label-off` replaces the centre "off" text. Defaults unchanged (On/Off resp. off); distinct from `payload-on/off` (MQTT) and `label` (card title). *(Glass label rendering is browser-tested.)*
- [ ] **Circle-slider parity (B29/B37)** (material-climate, material-light): place both cards side by side with identical width/height → the setpoint arc and the brightness ring have the same centre, radius, track width and knob size (climate's track is no longer narrower), **and the same vertical position** — both circles are width-sized and anchored at the top of the card (B37: climate no longer centres its arc in the leftover height); rows below the arc (mode chips, valve, humidity, label) stack underneath and clip on too-short cards, exactly like the light card's controls. Setpoint dragging still works across the whole arc. Style inspector on both: `--feezal-*-track-width` (default 7) and `--feezal-*-knob-size` (default 10) are unitless %-of-viewBox numbers — setting e.g. 10/14 visibly thickens track/knob, and the same numbers on both elements look identical.
- [ ] **Topic autocomplete in custom inspectors (B28)**: every MQTT-topic field in every custom (N6) inspector offers the same dropdown autocompletion as the generic attribute form (shared `feezal-topic-input` from `@feezal/feezal-element`) — type a prefix with retained topics on the broker → suggestions appear (debounced), arrow keys + Enter pick, an intermediate `topic/` completion descends a level and stays open, Escape/Tab dismisses, clicking a final completion commits the attribute. Spot-check across families: glass-light/shutter, metro-light, material-climate/cover/light, material-dialog(+view), material-navbar per-item badge topic, system-notification, basic-qrcode, basic-svg binding rows, layout-app (subscribe-title + per-action publish). layout-flex/-responsive and system-script have no topic fields. Non-topic fields (payloads, labels, message-property) stay plain inputs.
- [ ] **Contact tristate + live rewire (B27)** (material-contact): with `payload-closed`/`payload-open`/`payload-tilted` = `0`/`1`/`2` (Homematic), payload `2` draws the window handle pointing up in the tilt colour, `1` horizontal (open), `0` down (closed); changing `subscribe` or the payloads via the inspector on the live canvas takes effect immediately — no reload. *(Tristate incl. numeric payloads, lever position and the rewire are browser-tested.)*
- [ ] **Shutter value ranges & dedicated command topics (B26)** (material-cover, glass-shutter): set `min`/`max` (e.g. 0/1 for Homematic) → an incoming position of `0.5` displays as 50 %, and setting 50 % publishes `0.5` (json and separate mode); same for `slat-min`/`slat-max` with the tilt slider; defaults 0/100 behave exactly as before (integer payloads). Set `publish-up`/`publish-stop`/`publish-down` topics → the corresponding button publishes its payload to the dedicated topic instead of `publish-command` (also wins over the json publish topic); leave them blank → single-topic behaviour unchanged. Both inspectors: Command section shows the three optional dedicated-topic fields (separate mode), Config tab shows the Value ranges section.
- [ ] **Dialogs** (material-dialog, countdown-dialog, paper-dialog): open/close triggers; template body renders.
- [ ] **Paper card (E87)** (paper-card, renamed from card-template): heading/subhead/header-image render; elevation 0–5 shadows; `${msg.payload}` body updates from the subscribed topic; a saved dashboard still using `<feezal-element-paper-card-template topic="…">` renders identically (deprecated alias maps `topic` → `subscribe`; console warning appears).
- [ ] **Paper dialog parity (E86)** (paper-dialog, paper-dialog-view): both are attribute-identical twins of the material dialogs (unit-asserted) — verify the paper *look* (2px corners, paper shadow, flat uppercase text buttons) in light + dark themes; paper-dialog-view embeds the selected view live (MQTT bindings work inside); B24 sizing + B25 header behave like the material pair.
- [ ] **Dialog sizing (B24)** (material-dialog, material-dialog-view): with little body content set `min-height` (e.g. `300px`) → the open dialog is at least that tall instead of collapsing to ~50px; `height` forces an exact panel height; empty values keep auto sizing. Check the Layout section rows in both custom inspectors.
- [ ] **Dialog header parity (B25)** (material-dialog, material-dialog-view): both dialogs show the same header — title left, ✕ top-right — by default (material-dialog now has the ✕ too); ✕ closes; unchecking `show-close` (with no title) removes the bar; `hide-header` removes the bar entirely even with a title; changing these while the dialog is open updates it live.
- [ ] **Repeater**: array payload → N children; key→attribute mapping; child MQTT wiring.
- [ ] **Chart / map / camera / energy-flow**: render their heavier viz; check performance + no leaks.
- [ ] **Auto-discovery consumers** (light, climate, cover, switch, sensor-like): dropping onto a discovered device wires topics/payloads correctly (see §9).
- [ ] **Light sub-integer brightness range** (material-light): with `brightness-min=0` / `brightness-max=1` (Homematic LEVEL) an incoming `0.5` shows 50 % on the ring, and releasing the ring at e.g. 49 % publishes `0.49` — not just 0/1. Integer ranges (0–100, 0–254 json mode) still publish whole numbers. *(pctToRaw scaling is unit-tested; this is the end-to-end check.)*
- [ ] **Button state feedback (E79)** (material-button + paper-button, same contract): set `subscribe` to a state topic → payload `1`/`0` (or custom payload-active/-inactive) highlights/unhighlights the button; other payloads leave it unchanged; with `--feezal-button-active-color` set, all five material variants and the paper button render the state; `disabled` greys the button and blocks publishing (UI guard only — the topic stays writable); E50 condition rows can toggle `disabled` from MQTT. *(Payload mapping + disabled guard are browser-tested for both.)*
- [ ] **Contact single-mode only (E78)** (material-contact): a saved view still carrying the removed `contacts` JSON attribute renders the normal single-contact SVG (attribute ignored, no dot grid, no crash); open/closed/tilted mapping and availability badge unchanged. Room overviews = multiple contact elements (composed component / repeater).
- [ ] **QR content assistant (E76)** (basic-qrcode): the inspector shows a Type picker — pick *WiFi*, fill SSID/password/security → the canvas QR updates live and the *Generated value* preview shows the `WIFI:S:…;T:…;P:…;;` string; special characters (`; , " : \`) scan correctly; re-selecting the element round-trips the value back into the fields; an unknown value opens on *Text / raw* unchanged; switching Type alone never clobbers the value. Password field is masked with a reveal toggle. *(Generate/parse round-trips are unit-tested.)*
- [ ] **Click-through (E82 family)** (basic-template + basic-image: boolean, default off; basic-icon: `on|off` select, **default on** — its long-standing decorate-a-button behaviour): stack the element over a button (U33 stacking), enable click-through → in the **viewer** clicks reach the button underneath (whole-element passthrough); icon with `click-through: off` catches clicks instead and the setting survives save/reload; in the **editor** all three stay selectable/draggable regardless.
- [ ] **Light Homematic dimmer mode (E77)** (material-light): set *On/off source: brightness* in the Config tab (Topics tab then hides the unused State inputs) against a dimmer with only LEVEL topics — incoming `0.5` shows on + 50 %; centre tap turns off (publishes `0`) and back on (restores the previous %); dragging the ring **from off** to 30 % turns the light on; with *On* = `1.005` the toggle-on publishes `1.005` and the centre shows the device-echoed level (OLD_LEVEL restore). Zigbee lamps in the default *topic* mode behave exactly as before (off retains brightness). *(Derivation/toggle/drag semantics are unit-tested; this is the real-device check.)*
- [ ] **Schedule editor (E52)** (material-schedule, see docs/schedule-format.md): retained schedule JSON on the subscribe topic renders as blocks on the Mon–Sun grid; **drag on empty space** paints a block (snapped to `step` minutes), **dragging block edges** resizes without overlapping neighbours, **tap** selects (toolbar: Delete; `type="number"`: value input clamped to min/max); edits show “● unsaved” — **Save** publishes the whole JSON retained, **Revert** restores; publish a different schedule externally *while dirty* → “changed remotely” hint, draft intact; the **now chip** (“now: 21.5 → 22:00”) and the dashed now-line track the client clock; touch: paint/resize with a finger. Verify a she/Node-RED consumer reads the published JSON (wall-clock contract). *(Format round-trip, clamping, dirty/save/revert/remote-hint, effectiveNow are unit-tested.)*
- [ ] **SVG bindings (E51)** (basic-svg): upload an SVG with `id`d shapes via the Asset Manager, set `src` → renders inline scaled to the box; in the custom inspector add binding rows — `#lamp` + map `on→#ffb300` recolors live, a `rotate` range turns a needle with the payload, `format` fills a `<text>`; an unmatched payload **reverts the shape to its original**; a row with a publish topic makes the shape clickable (cursor + focus ring, publishes payload; not in the editor); editor canvas shows the “N bindings” badge; an SVG containing `<script>`/`onclick` is defanged. Note: static exports opened from `file://` can't fetch the asset (browser restriction) — hosted exports work. *(Mapping semantics, sanitize, revert, click regions are unit-tested.)*
- [ ] **Script (E49)** (system-script, see docs/script-element.md): editor shows a code chip with the `name`; the inspector's Monaco editor offers `fzl.` completions and the expand (⛶) overlay works; write `fzl.sub('a', p => fzl.pub('b', p))`, bind a display element to `b` → deploy + **reload the viewer** → publishing to `a` updates the element; the script does NOT run on the editor canvas; a `throw` shows a `[name]`-prefixed console error without breaking the page; source view shows the code inside `<script type="text/feezal">` and survives a save round-trip (incl. `<` in code). *(fzl API, payload convention, scoping, error handling are unit-tested.)*
- [ ] **Time picker (E25)** (material-time-picker): retained `06:30` / `06:30:15` / `23400` (seconds) on the subscribe topic all show in the field; typing a time in the native field publishes in the configured `format` (`HH:MM` / `HH:MM:SS` / `seconds`); the clock icon opens the **wheel overlay** — drum columns snap to entries, `step=5` coarsens the minutes column, `show-seconds` adds a third drum; OK publishes, Cancel doesn't, backdrop click cancels; `publish-on-change` publishes on every drum settle; nothing publishes in the editor. *(Payload parse/format round-trips are unit-tested.)*
- [ ] **Camera click actions** (material-camera): `click-action: popup` — tapping the feed opens a near-fullscreen top-layer popup with the same feed (✕ button, tap anywhere or Esc closes; with `type=hls`/`webrtc` + `show-controls` the native video controls stay usable and don't close it); `click-action: publish` — tapping publishes `payload` to the `publish` topic; nothing fires on the editor canvas; `click-through` lets taps reach an element beneath the feed (and disables click-action) while the camera stays selectable/draggable in the editor; with `popup-animation` the popup visibly grows out of the camera tile on open and shrinks back into it on close (~220 ms; off = instant, unchanged). *(Publish, popup open/close, click-through and the animation are e2e-tested: `test-e2e/material-camera.test.js`.)*
- [ ] **Camera WebRTC (WHEP)** (material-camera, `type=webrtc`): point `src` at a real WHEP endpoint — go2rtc (`http://host:1984/api/webrtc?src=cam`) or MediaMTX (`http://host:8889/cam/whep`) — → low-latency live video plays (muted by default); the popup shows the same stream without opening a second session; publishing a different WHEP URL to the subscribe topic renegotiates onto the new source; stopping the media server → the element retries every 5 s and recovers when it's back. *(Offer/POST/answer negotiation, live frames, muted default and popup stream sharing are e2e-tested with an in-page WHEP loopback; the real-server/network path is this manual check.)*
- [ ] **Icon-bearing** (icon-button, fab, badge, chip, tile, navbar, app-layout): glyphs load (Material Icons font), not text.
- [ ] **Data table (E75)** (basic-table): retained JSON array on the subscribe topic renders as a table — columns auto-derive from the first row, or configure them via the `columns` list editor (key/label/width/align/format/editable; a per-column `class-map` added in source view survives list edits); `format` `number:1:°C` rounds + suffixes, `date`/`time`/`datetime` render epoch-seconds, epoch-ms and ISO strings via the locale; header click cycles asc → desc → payload order (numeric-aware; `sortable=false` disables), `filter` shows the search box, `max-rows` caps, header stays sticky while the body scrolls; `row-class-map` (`{"state":{"error":"error"},"load":{">90":"warn"}}`) tints whole rows and per-column class-maps colour cells — ok/warn/error/info follow the theme state colours in light + dark; **write-back**: with `editable` on, flagged columns render inputs — commit an edit, add (＋) and delete (✕) a row → each publishes the WHOLE array (non-retained by default, the `retain` checkbox opts into the MQTT retain flag, `publish` overrides the topic) and a second open viewer shows the change live; nothing publishes from the editor canvas (sample rows show there until real data arrives). *(Ingestion, columns, formatting, sort/filter/cap, class maps, editor sample/guards and the whole-array write-back contract are unit-tested.)*
- [ ] **Font Awesome sets (N28)** (`feezal-icons-fa`): the icon picker shows **three chips** — `fa-solid`, `fa-regular`, `fa-brands`; picking writes e.g. `fa-brands:github` and the glyph renders theme-coloured at any size (varying FA viewBox widths look right); a deployed viewer page and a static export render the used FA icons **without** loading the ~2 MB full modules (tree-shaken registration — check the page source); typing `fa-brands:` in an icon field scopes the autocomplete. *(Set registration, per-style volume, SVG normalisation and multi-set tree-shaking are unit-tested.)*

---

## 7. Themes & styling

(Theme variables, distinctness and per-theme swatch screenshots are automated;
refresh baselines with `npm run test:browser -- --update` after palette changes.)

- [ ] **Theme panel tabs**: Theme · Classes — the Theme tab holds the theme selector and colour overrides, the Classes tab the class editor; the Classes tab label shows the class count (e.g. "Classes · 2"); the tab bar aligns with the view tab bar like Inspector/Site Settings.
- [ ] Switch between all built-in themes (9) → **whole editor + viewer look right** (beyond the swatch palette); picker swatches sample real colours.
- [ ] **Colour overrides** section (Theme tab): add/edit/remove override; live preview; persists; **collapsible state persists** (default open).
- [ ] **Classes** tab: create/rename/delete a class; edit its CSS props; applies live to elements carrying it.
- [ ] User `.css` themes (create/save/delete) coexist with theme packages.
- [ ] Historical-preview (`?sha=`) uses the theme/overrides/classes from that commit.

## 8. Assets

REST endpoints and the copy-on-use drag (incl. inspector refresh) are automated —
this section is about the remaining **UI**.

- [ ] **Site/Global tab bar** (same styling/alignment as the other sidebar tab bars): switching tabs resets to the category root folder; "Move to site/global" from the context menu switches to the destination tab automatically. The thumbnail/list/details view toggles and the New-folder/Upload buttons sit right-aligned INSIDE the tab bar and work from there.
- [ ] Upload via button **and** drag-drop, to Site and Global; folder UI (mkdir, move into); rename; delete; preview overlay.
- [ ] Move/copy an asset between site↔global via the UI; references in the site HTML follow.

## 9. MQTT / connection / auto-discovery

- [ ] Connection Settings: set broker URI, credentials, protocol version, TLS certs (N8) — connect succeeds; status shown.
- [ ] **Server connection indicator** (Connection tab, top): green dot + "connected" + broker URI while the server↔broker bridge is up; red dot + "not connected" + the broker's error message (e.g. `unable to get local issuer certificate`, `ECONNREFUSED`) while it is down; updates within a few seconds without a reload; credentials never appear in the shown URI. *(Status tracking, the redaction and the route are unit-tested.)*
- [ ] **CA upload takes effect immediately**: with an `mqtts://`/`wss://` broker signed by a private CA and no CA uploaded → indicator shows the TLS error; upload the CA (Connection → TLS) → the bridge reconnects and the indicator turns green **without a server restart** (same for removing a cert). *(The cert-change reconnect is unit-tested.)*
- [ ] Topic autocomplete **dropdown** in the inspector populates from live traffic.
- [ ] **Auto-discovery** (HA / zigbee2mqtt): discovered devices appear; dropping one wires a suitable element; device grouping / element hints.
- [ ] `wss://` (TLS) viewer connection against a real broker. *(Plain `ws://` direct and the `mqtt://` bridge are automated.)*

## 10. Site management, versioning, export

(Site manager UI — create/rename/duplicate/delete — is automated, as is the
export: A16 layout — `<sitename>/{index.html, assets/}`, referenced-only,
no `global/` folder, rewritten references — and opening the bundle from
`file://` with live MQTT and a loading image.)

- [ ] **Export dialog / bundle size breakdown (U34):** Deploy menu → Export opens a dialog; after a spinner ("first run builds…") it shows total minified / ~gzip kB and a sorted bar list (element packages, `lit`, `feezal core`, theme, `icons (tree-shaken)`), top 3 highlighted, per-row kB / ~gz / %. **Download ZIP** downloads `<site>.zip` and closes the dialog. Re-opening is instant (shared bundle cache). With an `mqtt://` connection the old "Cannot export" error dialog still appears instead. *(Report bucketing/normalisation, the `/bundle-report` route sharing the export cache, and the dialog render/error states are automated.)*
- [ ] A site named like an old reserved word (`themes`, `elements`) is allowed (post-A14).
- [ ] **Default site topics:** a new site opens with Subscribe Topic `feezal/<sitename>/set` and Publish Topic `feezal/<sitename>` prefilled (Site tab). **Rename** the site → both topics follow the new name; change a topic first (e.g. `home/stat`) and rename → the customised topic stays, the untouched one still follows. **Duplicate** retargets default topics to the clone's name. Element-level `subscribe`/`publish` attributes on canvas elements are never rewritten. *(Default scaffold, per-attribute rename/clone retargeting and the element-attribute exclusion are unit-tested.)*
- [ ] **Git history** panel: timeline, per-commit preview (`?sha=` banner + prev/next), restore (non-destructive), discard (archived branch), bookmarks (if present).
- [ ] **Certs are never committed** to a site's git repo (in `.gitignore`).

## 11. AI assistant (full) — see also §2

(Panel visibility gating, model listing, prompt → streamed reply → proposal
card → Accept-applies are automated against a stub provider.)

- [ ] Panel docks right, resizable (width persists); **open/closed state persists**.
- [ ] Source mode (Monaco diff/splice) apply path.
- [ ] Conversations: new, history timeline, delete; file-context chips (＋ / drag-drop); token estimate.
- [ ] Larger multiline input auto-grows; activity animation while busy; agent toggle chip; tool-call limit + num_ctx settings honoured.
- [ ] Editor-internal classes are never echoed back into proposals.

## 12. Viewer

- [ ] No editor chrome; elements interactive — taps/clicks publish.
- [ ] Theme applied; user `.css` theme `<link>` present when active.
- [ ] Mobile/touch: taps, swipe nav; app-layout/responsive behave at small widths.
- [ ] Reconnect on broker drop with a **direct `ws://` connection**. *(Bridge-mode reconnect is automated.)*

### Viewer presence & Clients panel (N24) — see docs/presence.md

*(ID generation/persistence, retained status payload, per-client command
routing, rename incl. old-status clear, collision toast, `presence="off"`,
hub disconnect-clear and bridge retain-forwarding are automated.)*

- [ ] Open a viewer with a site **Publish Topic** set → corner toast "Connected as \"viewer-xxxx\"", dismissible. Without a Publish Topic no presence (even with a Subscribe Topic).
- [ ] Broker shows retained `<publish>/clients/<id>/status` JSON (view, connectedSince, lastChange, connection, userAgent); switching views updates `view` in the payload.
- [ ] With a Publish Topic but **no Subscribe Topic**: viewer announces itself (row appears) but the per-client actions in the Clients panel are disabled and the viewer takes no commands (announce-only). *(Announce-only subscription behaviour is unit-tested.)*
- [ ] Editor → **Site Settings → Clients** tab lists the viewer live; a second viewer (other browser/device) appears as a second row.
- [ ] Editor **dark mode**: the Clients tab paints a dark panel background (no white area behind the client cards); text, card heads and inputs stay readable.
- [ ] **Switch view** select shows the client's current view and follows it live (viewer-side navigation updates the dropdown); picking another entry changes the view on exactly that viewer (other viewers unaffected); **Reload** reloads it; **Set theme** restyles the viewer (until its next reload — the deployed theme is baked into the site HTML).
- [ ] Viewer reconnect (toggle the network briefly / restart the broker) → the client row survives or reappears; a stale broker LWT clearing the status is self-healed by the viewer republishing it. *(Self-heal republish is unit-tested.)*
- [ ] Reload the **editor** while a viewer is online → its row reappears immediately (the hub asks the broker to replay retained state on subscribe, even for statuses first retained after the server started). *(Automated in the hub full-chain tests.)*
- [ ] Reload the editor, then open **Site Settings → Clients** → the row appears without further steps (the panel wires itself on load, before the site DOM exists); changing the site Publish Topic rewires the panel live. The console traces this as `[feezal-clients] subscribing <topic>`. *(Late-site wiring is automated.)*
- [ ] A **static export** behaves like the served viewer: first load shows the "Connected as …" toast, the site appears in the Clients panel, and per-client commands (view/theme/reload/rename) reach it. *(The presence import in the export entry is automated.)*
- [ ] **Rename** to `hallway-panel` → viewer toast, row re-appears under the new id, old status topic cleared on the broker; rename survives a viewer reload (`localStorage`).
- [ ] Close the viewer tab → row disappears (direct: broker LWT; bridge: server clear). Kill the browser process (ungraceful) with a direct-MQTT connection → LWT still clears the status.
- [ ] Site-wide control topics (`<subscribe>/view`, …) still steer **all** viewers.
- [ ] Duplicate id (copy `localStorage` value to a second browser) → "already online" warning toast, both keep working.
- [ ] Site Settings → Viewer → **Viewer presence** off → redeploy: no status published, no toast, Clients panel empty.
- [ ] **All four broker protocols** (`mqtt://`, `mqtts://`, `ws://`, `wss://`, mosquitto): the Clients panel lists viewers and survives a **viewer page reload** (row stays/reappears within seconds). Watch the server console: no `mqtt-bridge: connection closed` after a presence clear — with a ws(s) broker, an empty retained publish used to kill the bridge connection (mqtt.js sends the empty payload as an empty WebSocket frame; mosquitto drops the client with a protocol error). *(Empty-frame guard, hub cache JSON parsing and panel string tolerance are unit-tested; the mosquitto interaction was verified against a real broker.)*

## 13. Auth / deployment (if used)

- [ ] Editor auth gate in the browser; viewer public vs protected as configured.
- [ ] Reverse-proxy setup (nginx) + proxy auth path (Authentik/Authelia) if documented.

---

## Regression sign-off

- [ ] `npm run test:all` (root — all four suites; on Windows run via WSL) green. Needs chromium (`npx playwright install chromium`) and a built `www/dist`; see `www/vitest.browser.config.mjs` for WSL notes.
- [ ] `cd www && npm run build` clean.
- [ ] No new console errors/warnings during the manual pass.
- [ ] All `[!]` items filed as issues / roadmap bugs.

---

## Automation candidates (shrink this file further)

Ordered by value-per-effort; each would delete or shrink checklist items above.

1. **Agent-mode AI E2E** — extend the stub provider with OpenAI tool-call responses; assert the tool loop (activity stream, topic-search tool round-trip, final proposal). Removes most of §2's agent block.
2. **Remaining N6 inspectors** (component) — same pattern as navbar/layout-app for light, climate, cover, alarm-panel, humidifier, media-player, vacuum, repeater, energy-flow, layout-flex, layout-responsive. Removes the §4 N6 item.
3. **E2E: multi-step undo/redo + cut** — deepens §3's remaining interaction items.
4. **E2E: resize via handles + snapping** — drag a resize handle, assert size; drag near another element and assert the snap position. Removes the §1/§3 resize items.
5. **Component: dialogs + repeater** — open/close triggers and array-payload child rendering. Removes the §6 element-specific notes.
6. **`wss://` TLS harness** — self-signed cert on the ws listener + cert upload via the API; automates the §0/§9 TLS items.
7. **E2E: git history panel** — deploy twice, open the history sidebar, preview `?sha=`, restore. Removes the §10 history item.
