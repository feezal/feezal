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

New elements: `feezal-element-circle-sensor`, `feezal-element-glass-sensor`
(new meaning), `feezal-element-metro-sensor` (new meaning),
`feezal-element-eink-motion` — all at version 3.1.0.

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
- **Family gaps** (documented): material has no numeric *value* card; the
  eink numeric card keeps its `eink-number` name (the `*-value` rename
  matrix covered glass/metro only).
- **Sabotage badges** on contact/sensor/motion land with **E135** (the
  canonical-record machinery) — not part of this change.

### Related earlier rename (bundled per the E138 plan)

- **E130**: the `feezal-element-circle-switch` card's palette name became
  **"Switch"** (tag unchanged — no dashboard breakage).
