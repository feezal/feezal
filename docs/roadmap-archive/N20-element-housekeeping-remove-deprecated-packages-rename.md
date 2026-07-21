# N20 — Element housekeeping: remove deprecated packages, rename `material-text-field` ✅ done

*Archived roadmap item — Documentation. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

- Removed `feezal-element-material-progress-circular`, `feezal-element-material-progress-linear`, and `feezal-element-material-value` package directories.
- Renamed `feezal-element-material-text-field` → `feezal-element-material-input` (palette label "Input"). Backward-compat alias `feezal-element-material-text-field` registered with a console deprecation warning.
- `www/package.json`, `scripts/generate-elements.js`, and `www/editor/feezal-elements.js` updated accordingly.
