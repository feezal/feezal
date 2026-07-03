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
- [ ] **App Layout** (`layout-app`): top bar + drawer render; picking a drawer entry **swaps the embedded content view**; shrinking the element past `breakpoint` collapses the drawer to an **overlay + hamburger** (+ scrim closes it); title (static and `subscribe-title`); action buttons publish. *(The N6 inspector add/reorder/remove + create-view is automated.)*
- [ ] **Navbar** (`material-navbar`): tapping navigates; **active item follows** the current view from tab bar / swipe / MQTT; badges update from MQTT; orientation/labels/align render right; empty → auto-fills all views. *(The N6 inspector item editing is automated.)*
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

- [ ] Install a real published `feezal-element-*` from npm; after reload the element is in the palette; **Update** and **Remove** round-trip.

---

## 3. Editor — core

(Selection — rubber-band, Ctrl+click toggle, view-select on empty canvas —
copy/paste offset, Ctrl+D, Delete, context-menu lock/unlock incl. drag-blocking,
single-element move, arrow nudge, single undo, source-mode error gating + apply,
and palette drag-to-canvas are all automated.)

- [ ] **Resize** via handles; **snapping** to other elements + grid (both axes); snap guide lines show/hide correctly.
- [ ] **Grid:** toggle visibility; change size + colour (both axes use the colour); grid aligns to the view origin, not the toolbar.
- [ ] **Undo / redo** breadth: multi-step sequences, redo (Ctrl+Y), across add/delete/source-apply.
- [ ] **Cut** (Ctrl+X) and paste; group IDs remapped (if grouping used).
- [ ] **Context menu:** copy-to-view and move-to-view submenus. *(Lock/unlock is automated.)*
- [ ] Locked state **persists after deploy** (amber outline back after reload).
- [ ] **Drag element to far edge** of an oversized/scrolled view reaches the real edge (B8).
- [ ] **Keyboard shortcuts** modal (`?`) lists correct bindings; each works.
- [ ] **Source mode:** format document; editing comfort (highlighting, completion).
- [ ] **Palette** (left): categories in order; search filter works.
- [ ] **Sidebar tabs** (right): Inspector · Theme · Site Settings · Assets · Version history · Editor Settings · Packages — each opens its panel; no empty/dead tab.
- [ ] Sidebar + palette **collapse** toggles; widths persist across reload.

## 4. Editor — inspector

- [ ] **Attributes:** every attribute type renders the right control (text, number, select, boolean, color, mqttTopic w/ autocomplete, icon w/ autocomplete); help tooltips show.
- [ ] **Multi-select** shows the intersection; "— varies —" for mixed; editing applies to all.
- [ ] **Styles** tab: position/size, custom CSS props with autocomplete + CSS-var colour resolution in the picker; per-property mixed handling.
- [ ] **Classes** selector applies/removes `feezal-class-*`; conflicting inline styles cleared with a note.
- [ ] **Custom (N6) inspectors** for the remaining ones: layout-flex, layout-responsive, light, climate, cover, alarm-panel, humidifier, media-player, vacuum, repeater, energy-flow. *(navbar + layout-app + the host protocol are automated.)*

## 5. Views & navigation

- [ ] Reorder / delete views; view folders — drag into folders, nesting UI.
- [ ] Tab bar reflects views; hidden/foldered views excluded as configured.
- [ ] Viewer: navigate via **Navigation** element, **Navbar**, swipe (if used).
- [ ] Region/embedded views (layout-flex / layout-responsive / layout-app / basic-view) render the referenced view in editor (placeholder) and viewer (live).

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
- [ ] chart · [ ] datetime · [ ] iframe · [ ] image · [ ] navigation · [ ] number · [ ] repeater · [ ] template · [ ] view

### Layout (composite — also test embed & swap)
- [ ] layout-flex · [ ] layout-responsive · [ ] layout-app

### System (pseudo-elements — placeholder in editor, behaviour in viewer)
- [ ] system-pin · [ ] connection-status

### Material
- [ ] alarm-panel · [ ] badge · [ ] button · [ ] camera · [ ] checkbox · [ ] chip · [ ] climate · [ ] clock · [ ] computer-stats · [ ] contact · [ ] countdown-dialog · [ ] cover · [ ] dialog · [ ] door-lock · [ ] energy-flow · [ ] fab · [ ] fan · [ ] gauge · [ ] humidifier · [ ] icon-button · [ ] input · [ ] light · [ ] map · [ ] media-player · [ ] motion · [ ] navbar · [ ] plant · [ ] progress · [ ] radio · [ ] select · [ ] slider · [ ] switch · [ ] tank · [ ] vacuum

### Paper (legacy)
- [ ] app-layout · [ ] badge · [ ] button · [ ] card-template · [ ] checkbox · [ ] dialog · [ ] dropdown · [ ] listbox · [ ] slider · [ ] switch · [ ] tabs

### Element-specific notes
- [ ] **Dialogs** (material-dialog, countdown-dialog, paper-dialog): open/close triggers; template body renders.
- [ ] **Repeater**: array payload → N children; key→attribute mapping; child MQTT wiring.
- [ ] **Chart / map / camera / energy-flow**: render their heavier viz; check performance + no leaks.
- [ ] **Auto-discovery consumers** (light, climate, cover, switch, sensor-like): dropping onto a discovered device wires topics/payloads correctly (see §9).
- [ ] **Icon-bearing** (icon-button, fab, badge, chip, tile, navbar, app-layout): glyphs load (Material Icons font), not text.

---

## 7. Themes & styling

(Theme variables, distinctness and per-theme swatch screenshots are automated;
refresh baselines with `npm run test:browser -- --update` after palette changes.)

- [ ] Switch between all built-in themes (9) → **whole editor + viewer look right** (beyond the swatch palette); picker swatches sample real colours.
- [ ] **Colour overrides** section (theme tab): add/edit/remove override; live preview; persists; **collapsible state persists** (default open).
- [ ] **Classes** section: create/rename/delete a class; edit its CSS props; applies live to elements carrying it; **collapsible state persists**.
- [ ] User `.css` themes (create/save/delete) coexist with theme packages.
- [ ] Historical-preview (`?sha=`) uses the theme/overrides/classes from that commit.

## 8. Assets

REST endpoints and the copy-on-use drag (incl. inspector refresh) are automated —
this section is about the remaining **UI**.

- [ ] Upload via button **and** drag-drop, to Site and Global; folder UI (mkdir, move into); rename; delete; preview overlay.
- [ ] Move/copy an asset between site↔global via the UI; references in the site HTML follow.

## 9. MQTT / connection / auto-discovery

- [ ] Connection Settings: set broker URI, credentials, protocol version, TLS certs (N8) — connect succeeds; status shown.
- [ ] Topic autocomplete **dropdown** in the inspector populates from live traffic.
- [ ] **Auto-discovery** (HA / zigbee2mqtt): discovered devices appear; dropping one wires a suitable element; device grouping / element hints.
- [ ] `wss://` (TLS) viewer connection against a real broker. *(Plain `ws://` direct and the `mqtt://` bridge are automated.)*

## 10. Site management, versioning, export

(Site manager UI — create/rename/duplicate/delete — is automated, as is the
export: A16 layout — `<sitename>/{index.html, assets/}`, referenced-only,
no `global/` folder, rewritten references — and opening the bundle from
`file://` with live MQTT and a loading image.)

- [ ] A site named like an old reserved word (`themes`, `elements`) is allowed (post-A14).
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
