# U41 — Flow layout for views: `child-position: flow` replaces `static` ✅ implemented (MVP) *(absorbs U40)*

*Archived roadmap item — Editor UX. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

**✅ Implemented (07/2026) — MVP.** `child-position` is now `absolute | flow`; `flow` lays a view's elements out as a **wrapping flex row** (tiles L→R, row by row), living in [feezal-view](../../www/src/feezal-view.js) so viewer/export render identically to the editor. Legacy `static` is **aliased to flow at load** (reflects → next save writes `flow`). View knobs `flow-gap`/`flow-direction`/`flow-justify`/`flow-align` map to `--feezal-flow-*` and are gated on flow mode via U39 `visibleWhen`. Editor: `_viewChanged` routes flow (and the static alias) to html5sortable; **reorder is wired to the change/undo pipeline** (`sortupdate` → `feezal.app.change()` — the U40 gap, and the item selector was `.feezal-element` which matched *nothing*, fixed to `.feezal-editable`); **click-selection** is the shared composedPath capture handler absolute views use (`_attachCanvasSelection`, extracted); palette drops into a flow view insert the tile at the drop point with no top/left; the Style inspector hides `top`/`left` for flow-view children. % widths work (elements are ordinary flex items). Unit + browser tested; TESTING.md §5 entry added.

**Deferred (explicitly out of MVP):** the Style-inspector **% preset fraction buttons** (25/33/50/100 with gap-aware `calc()`) — % widths work by hand-typing today; **rubber-band selection** in flow views (gated on B35, now fixed — revisit); per-item `flex-grow`/`align-self`; a grid auto-flow variant. Original spec below:


**Problem.** `child-position="static"` is broken twice over. **Layout:** plain document flow stacks block-level elements in one vertical column — not the intended "tiles float left-to-right, row by row". **Editor:** elements in a static view can't be reliably selected and can't be reliably reordered by drag & drop — `_initSortable()` ([feezal-sidebar-inspector.js:788](../../www/src/feezal-sidebar-inspector.js#L788)) wraps [html5sortable](https://github.com/lukasoppermann/html5sortable) but listens to **none** of its events (no `feezal.app.change()`, no undo-history hook, no selection/inspector refresh — the U40 finding, absorbed here), and static views never get the click-selection path absolute views have.

**Goal:** users can **place, select and reorder** elements with the mouse in a non-absolute view. Rubber-band selection is explicitly **not** required for the MVP (nice-to-have later — and gated on B35's DragSelect fixes anyway).

#### Decided (07/2026)

- **Replace `static` with `flow`** — the `childPosition` dropdown becomes `absolute | flow`. Flow = **flex row-wrap, LTR, top-to-bottom** on the view. The legacy value `static` is **aliased to flow at load** (no file migration; saving writes `flow`). One non-absolute mode to build, document and test.
- **View-level knobs** (all three groups): **`flow-gap`** (px, flex `gap`), **`flow-direction`** (`row` | `column`), **`flow-justify`** (main axis: start/center/end/space-between) and **`flow-align`** (cross axis: start/center/end/stretch). Attribute naming/vocabulary kept consistent with the `layout-flex` element's existing `flex-direction`/`gap`/alignment attributes.
- **Item sizing: fixed sizes** — elements keep their own `width`/`height` and float like tiles; resize handles keep working; **no per-item flex config in MVP**. **Percentage widths are supported** (elements are ordinary flex items): `width: 100%` → full row with auto-resize to page width, `width: 50%` → half row. Caveat to handle in UX: with a non-zero gap, `50% + 50% + gap > 100%` wraps — exact fractions need `calc(50% - <gap>/2)`; the style inspector should offer **preset fraction buttons** (25 / 33 / 50 / 100 %) that emit the gap-aware `calc()` so users don't hand-author it.
- **Reorder = DOM order** (U33 principle: order is DOM order, period): dragging moves the actual DOM child; serialization stays trivial; no CSS `order:` bookkeeping.

#### Editor work items

1. **Selection parity:** click-select in flow views must route through the same composedPath click handler absolute views use — selection must be independent of the sortable machinery (drag threshold so a click never starts a drag).
2. **Reorder wiring** *(the U40 gap)*: listen to html5sortable's `sortupdate` → apply the DOM move, call `feezal.app.change()` (dirty + undo history, same pipeline as `_reorderSelection()`'s Cmd+`[`/`]` for absolute views), refresh selection and inspectors.
3. **Palette placement:** dropping a new element into a flow view inserts at the placeholder's index (insertion point between tiles), not at a `top`/`left`.
4. **Style inspector:** hide `top`/`left` for children of flow views (meaningless); keep `width`/`height` incl. the `%`-preset buttons above; view gains the four `flow-*` style/attribute rows when `child-position="flow"`.
5. **Viewer parity:** the flow styling (`display:flex`, wrap, gap, justify/align + the `static`→`flow` alias) lives in `feezal-view`'s own styles so viewer and export render identically to the editor — no editor-only CSS.

**Later / out of MVP scope:** rubber-band selection in flow views (needs B35 fixed first), per-item `flex-grow`/`align-self` (the "Fixed + per-item flex" tier), a grid auto-flow variant for strictly aligned tracks.

**Not to be confused with `layout-flex`:** that element flexes embedded *views* (regions) inside one canvas element; U41 flexes the *elements of a view* at the view level. Complementary layers — shared attribute vocabulary, different objects.

**Ships with:** TESTING.md section (flow view: place/select/reorder/undo, gap & direction knobs, % widths incl. gap-aware fractions, legacy `static` alias renders identically in editor and viewer).

**Relates:** U40 (absorbed — reorder change-pipeline wiring is work item 2), U33 (DOM-order principle + the equivalent absolute-view reorder affordance), B35 (rubber-band later-scope dependency), layout-flex (attribute vocabulary to stay consistent with), E38 (element scaling/responsive sizing — % widths here are a first concrete instance), feezal-view (`child-position` owner).
