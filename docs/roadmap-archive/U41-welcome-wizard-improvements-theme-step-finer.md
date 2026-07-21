# U41 — Welcome wizard improvements (theme step, finer spotlights, broker-text fix) ✅ implemented

*Archived roadmap item — Editor UX. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

Refinements to the U37 first-run tour ([feezal-welcome-tour.js](../../www/src/feezal-welcome-tour.js)) from first real-use feedback:

1. **Theme step before the MQTT step** — after the general orientation steps, show the user how to switch the theme: switch the sidebar to the **Theme** tab (`_setSidebar('themes')`), spotlight the theme list, and let them pick one (interactive step). Ordering: … → Deploy/View → **Theme** → MQTT broker → hands-on.
2. **Spotlight the Template element in the palette** — the hands-on "drag a Template element" step currently spotlights the whole palette. Target the actual entry instead: palette entries carry `data-el="<tag>"`, so the step's `target()` can pierce into `feezal-palette`'s shadow root (`.element[data-el="feezal-element-basic-template"]`). Needs: the Basic category expanded/scrolled into view first (tour `prepare()` hook), and a fallback to the whole palette when the entry isn't visible (e.g. user typed a search filter).
3. **Broker-step text fix** — the step says "enter your broker URI (e.g. mqtt://192.168.1.10)", but the connection panel has a **protocol dropdown** plus separate host/port fields — the `mqtt://` prefix is wrong/confusing. Reword to hostname-only (e.g. "enter your broker's hostname or IP, e.g. 192.168.1.10 — protocol and port have their own fields").
4. **Finer spotlights in the broker step** (and generally in sidebar steps) — instead of dimming around the entire `#sidebar-panels`, guide with per-control spotlights: first the host field (pierce into `feezal-sidebar-viewer`'s shadow root), then the server↔broker **status indicator** so the user knows where to look for the connection feedback. Possibly as sub-steps that advance on input, mirroring the hands-on steps' event-driven progression.

**Implementation notes:** the tour's `target()` functions already run arbitrary code, so shadow-piercing targets are straightforward; add a small `resolveInShadow(host, selector)` helper rather than chaining `shadowRoot` lookups per step. Update the U37 browser tests (step order, new theme step, palette-entry target incl. fallback) and the TESTING.md §3 "Welcome tour" checklist accordingly.

**Relates:** U37 (the implemented tour — archived; this is its first refinement round), feezal-sidebar-themes (theme tab spotlighted in the new step), feezal-sidebar-viewer (broker fields/status indicator targets), feezal-palette (`data-el` entry targets).


> **Implemented 07/2026:** theme step inserted before the broker step (Theme tab, interactive); broker step spotlights the Host input inside feezal-sidebar-viewer's shadow root (new inShadow helper + #conn-host id) with hostname-only wording, followed by a dedicated status-indicator step; hands-on drop step spotlights the palette's Template tile (data-el target, Basic auto-expand + scrollIntoView, whole-palette fallback). Browser tests updated for the new order + targets.


- **Custom N6 inspector** (like E9's region manager): an entries list-builder — add / reorder / remove rows, each with a **view picker** (dropdown of `feezal.views`), a **label** field, and an **icon picker** (N20); an **✎ edit** button per entry to jump to editing that content view (`feezal.app._setView(name)`); an **＋ add** that can create-and-embed a new blank view (mirroring E9's `_addRegion`, reusing the synchronous-hide fix so new views don't reflow the canvas). Plus top-bar fields (title/subscribe-title), the actions list, and drawer options (breakpoint, persistent).
- **Canvas preview:** render the real bar + drawer chrome with the placeholder content pane; drawer taps switch the previewed pane but are otherwise inert (no viewer navigation). Because entries are attribute-driven (no `<slot>`), there are no nested editable children to manage.

#### Implementation notes

- **No MD3 nav-drawer:** `@material/web` dropped its navigation-drawer component, so hand-roll the drawer/bar with CSS (flex + container query); use `md-icon-button` for the hamburger and actions — **render glyphs as `<span class="mi">` with the loaded 'Material Icons' font, not `<md-icon>`** (the recurring unloaded-Material-Symbols gotcha).
- Reuse `feezal-element-basic-view`'s clone-in-viewer / label-in-editor logic for the content pane rather than reinventing it.
- **Default size:** full view (fills its host); `restrict` disables move/resize.
