# N20 — Style inspector: resolve CSS variable colours in the colour picker ✅ done

*Archived roadmap item — Near-term Improvements. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

A colour style whose value is a `var(…)` (or `color-mix(…)`, rgb, named colour) now shows its **actual rendered colour** in the native swatch, instead of black/nothing.

**Implementation** (`www/src/feezal-sidebar-inspector-styles.js` only):
- `_toColorHex` fast-paths hex literals; anything else is resolved via `_resolveColor`, which applies the value to a hidden probe `<span>` appended into the selected element's DOM context and reads `getComputedStyle(probe).color` — so `var()` chains and `var(--x, fallback)` fallbacks resolve natively against the element's theme/custom-props.
- `_rgbToHex` converts the resolved `rgb()`/`rgba()` to `#rrggbb`; fully-transparent (unresolved var, no fallback) returns '' and the swatch gets an `unresolved` class rendering a checkerboard.
- The stored value stays the `var(…)` string; only the swatch display is resolved. Re-resolves on selection change / re-render.
