# Breaking changes / migration notes

## E138 — boolean-card taxonomy: `*-motion` / `*-sensor` / `*-value` (07/2026)

The boolean sensor cards were untangled into four functions per family
(contact / alarm sensor / motion / numeric value), all on the E137 shared
controllers. **Hard renames, no tag aliasing** — saved dashboards using the
renamed tags must be migrated (source view → search & replace **before**
upgrading is the safest route).

### Tag migration table

| old tag | new tag | notes |
|---|---|---|
| `feezal-element-glass-occupancy` | `feezal-element-glass-motion` | motion/occupancy/presence/radar/zone types only |
| `feezal-element-metro-occupancy` | `feezal-element-metro-motion` | motion slice only |
| `feezal-element-glass-sensor` | `feezal-element-glass-value` | ⚠ the numeric big-numeral card moved to `-value`; `glass-sensor` still EXISTS but is now the **alarm card** (leak/smoke/gas/CO/…) — an unmigrated dashboard's numeric sensor silently becomes an alarm card! |
| `feezal-element-metro-sensor` | `feezal-element-metro-value` | ⚠ same reused-name trap as glass: `metro-sensor` is now the alarm card |
| `feezal-element-circle-motion` | *(unchanged)* | scope narrowed to motion types; hazard types (water-leak/smoke/…) move to the new `feezal-element-circle-sensor` (which carries the E134 state disc) |
| `feezal-element-eink-sensor` | *(unchanged)* | scope narrowed to alarm types; motion types move to the new `feezal-element-eink-motion` |
| `feezal-element-eink-number` | `feezal-element-eink-value` | E148: numeric-card naming parity — the eink numeric readout joins the `*-value` convention (behaviour/attributes/discovery unchanged, palette `Number` → `Value`). `basic-number` (the unstyled primitive) keeps its name. No reused-name trap. Source-view search-replace `eink-number` → `eink-value`. |
| `feezal-element-panel-7seg` | `feezal-element-panel-value` | The panel family's numeric readout (a seven-segment LED display) joins the `*-value` convention — palette `7-Segment` → `Value`, class `FeezalElementPanelValue`, discovery (`component: 'sensor'`) unchanged; it now also resolves in the Generate wizard for `sensor` entities (function `value`). The CSS var `--feezal-panel-7seg-color` → `--feezal-panel-value-color`. No reused-name trap. Source-view search-replace `panel-7seg` → `panel-value` (covers both the tag and the CSS var). |
| `feezal-element-metro-tile` | `feezal-element-metro-button` | **E152**: the Metro family's generic action tile joins the `*-button` convention every other family already uses (`material-button`, `glass-button`, `eink-button`, `paper-button`, `carbon-button`) — "Tile" was a Metro-only misnomer. Behaviour/attributes/discovery unchanged; palette `Tile` → `Button`, class `FeezalElementMetroTile` → `FeezalElementMetroButton`. No reused-name trap. Source-view search-replace `metro-tile` → `metro-button`. |

New elements: `feezal-element-circle-sensor`, `feezal-element-glass-sensor`
(new meaning), `feezal-element-metro-sensor` (new meaning),
`feezal-element-eink-motion` — all at version 3.1.0.
Later additions on the same parity theme: `feezal-element-glass-gauge` and
`feezal-element-metro-gauge` (**E151** — no rename, purely additive).

### Package moves (no dashboard impact — element authors only)

Two shared code-sharing packages were extracted (same shape as
`@feezal/feezal-glass`; neither is a dashboard element):

| import | now from | why |
|---|---|---|
| `MetroTileBase` from `@feezal/feezal-element-metro-tile` | `@feezal/feezal-metro` | **E152**: the Metro family base class was living inside the concrete tile element's package. Extracted before the `metro-tile` → `metro-button` rename so the family base does not end up hiding in the button package. |
| the `circle-gauge` dial geometry (private until now) | `@feezal/feezal-gauge` | **E151**: `GaugeMixin` / `gaugeAttributes` / `gaugeDiscoveryMap` + the dial maths, so circle / glass / metro gauges derive the identical geometry instead of three copies. |

A third-party element importing `MetroTileBase` from the old path must switch
to `@feezal/feezal-metro`.

### Behaviour notes

- **Type lists are sliced**: motion cards offer only motion-slice types
  (default `motion`); alarm cards only alarm-slice types (default `generic`).
  A saved `type` attribute outside the card's slice falls back to the
  card's default — move the element to its new sibling card instead.
- **Discovery routing**: HA/z2m `binary_sensor` `device_class` now routes to
  the right card — `motion`/`occupancy`/`presence` offer the `*-motion`
  cards; `smoke`/`moisture`/`gas`/`carbon_monoxide`/`vibration`/`tamper`
  offer the `*-sensor` (alarm) cards; `door`/`window`/`garage_door` stay
  with `*-contact`.
- **Active-state default colours** (canonical theme vars, defaults only):
  motion → `--accent-color`, alarm sensors → `--error-color`, contact
  open/tilted → `--primary-color`. Per-element `--feezal-*` style overrides
  keep working.
- **Palette names**: Motion / Sensor / Value (plus Contact) in every family.
- **Family gaps** (documented): material has no numeric *value* card. (The
  eink numeric card was `eink-number` at E138; **E148** renamed it to
  `feezal-element-eink-value`, closing the last naming gap — see the tag
  migration table row above.)
- **Sabotage badges** on contact/sensor/motion land with **E135** (the
  canonical-record machinery) — not part of this change.

### Related earlier rename (bundled per the E138 plan)

- **E130**: the `feezal-element-circle-switch` card's palette name became
  **"Switch"** (tag unchanged — no dashboard breakage).
