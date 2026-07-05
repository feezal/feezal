# feezal Theme Authoring Specification

This document is the reference for building and publishing `feezal-theme-*` packages (N23). It complements the [Element Authoring Spec](element-spec.md); read that first for the general packaging/publishing workflow.

---

## 1. Package conventions

| Rule | Detail |
|---|---|
| npm scope | Publish under an npm scope, e.g. `@yourscope/feezal-theme-nordic` |
| Package name | `feezal-theme-<slug>` — the `<slug>` becomes the CSS class name and the theme-picker label |
| npm keyword | `feezal-theme` (required — the Package Manager's registry search filters on it) |
| Entry point | `package.json` `"main"` points to the self-injecting module (§2) |
| `feezal` field | `"feezal": {"type": "theme"}` — lets the server classify the package without executing it |
| Dependencies | None — a theme is a dependency-free ESM whose only side effect is a `<style>` injection |
| License | Your choice; the official scaffold defaults to MIT |

## 2. The self-injecting convention

A theme package is a single ES module that, on import, appends a `<style>` element to `document.head`. All rules are scoped under the `.feezal-theme-<slug>` class so importing a theme never changes anything until the class is applied:

```js
// feezal-theme-nordic.js
const styleElement = document.createElement('style');
styleElement.innerHTML = `.feezal-theme-nordic {
    --primary-background-color: #2e3440;
    --secondary-background-color: #3b4252;
    --primary-text-color: #eceff4;
    --secondary-text-color: #d8dee9;
    --disabled-text-color: #4c566a;
    --divider-color: #434c5e;
    --primary-color: #88c0d0;
    --accent-color: #d08770;
    --error-color: #bf616a;
}`;
document.head.appendChild(styleElement);
```

No framework, no registration call — the class-scoped stylesheet *is* the theme. Every installed theme's stylesheet is present in the page simultaneously; only the class on the site decides which one is active, which is what makes runtime switching (§3) instant.

## 3. How themes are applied

- The active theme is stored per site and injected by the server as a `feezal-theme-<slug>` class on `<feezal-site>`; the viewer mirrors it to `document.body` so portals/dialogs appended to `<body>` inherit the variables.
- **Runtime switching:** publishing to the site control topic `<site>/theme` (payload: full class name or just the slug) swaps the class live — see the user guide's site-topics section.
- **Discovery:** the server scans `feezal-theme-*` packages alongside elements; discovered names surface as `window.feezal.themes` and populate the editor's theme picker. Installing through the Package Manager emits `elementsChanged`, so the picker updates without a restart.
- **Static export:** the active theme's CSS is inlined into the exported `index.html` — exports are self-contained.

## 4. Which variables to set

The canonical variable list lives in [element-spec.md §5.1](element-spec.md#51-available-theme-variables). In short:

- **Core (set these):** the HA-compatible set — `--primary-color`, `--accent-color`, `--primary-text-color`, `--secondary-text-color`, `--disabled-text-color`, `--primary-background-color`, `--secondary-background-color`, `--divider-color`, `--error-color`, plus the state colours `--warning-color`, `--success-color`, `--info-color` and the feezal aliases `--feezal-color`, `--feezal-bg`, `--feezal-border`.
- **Why this works for every element:** elements never consume theme variables directly in their rules — they route them through per-element `--feezal-<element>-<role>` properties with fallback chains (element-spec §5.2), and MD3-based elements route `--md-sys-*` tokens through the same feezal vars. Set the base variables and the whole element ecosystem follows.
- **Legacy:** the built-in themes also set `--paper-*` variables for the remaining Polymer-era elements. New themes may skip these unless you target dashboards that still use `paper-*` elements.
- **Don't** style element internals (shadow DOM) or use element tag selectors — themes are variable definitions, not stylesheets for specific elements.

## 5. Two theme flavours

| | npm package (`feezal-theme-*`) | Local editor theme |
|---|---|---|
| Created by | authoring a package (this spec / the scaffold) | **Save as theme…** in the editor's CSS-variable overrides panel |
| Stored in | `<dataDir>/elements/<pkg>/` (installed) | `<dataDir>/themes/<slug>.css` |
| Format | self-injecting ESM (§2) | plain CSS, same `.feezal-theme-<slug>` scoping |
| Shareable | yes — publish to npm, installable via the Package Manager | file copy only |
| Editable in the editor | no | yes (re-opens the overrides panel) |

Both flavours define the same variables and switch through the same mechanism. To turn a local theme into a shareable package: scaffold one (§6) and paste the CSS block from `<dataDir>/themes/<slug>.css` into the generated module.

## 6. Scaffold

```sh
npm create @feezal/feezal-theme
# or: npx @feezal/create-feezal-theme [slug] --base dark --scope yourscope --yes
```

Generates the package directory with a `package.json` (correct name, keyword and `feezal` field), the self-injecting module pre-filled with a light or dark starter variable block, and a README.

## 7. Testing your theme

1. **Manual drop (air-gapped):** copy the package directory into `<dataDir>/elements/<your-pkg>/` and reload the editor — the theme appears in the picker.
2. Or install it through the Package Manager once published.
3. Check both the editor canvas and the viewer, plus a static export (the CSS must survive inlining — avoid `</script>` sequences in content, which cannot occur in plain CSS anyway).
4. Flip through a few Material and basic elements: if something ignores your colours, the gap is usually a missing core variable (§4), not the element.

## 8. Publishing checklist

1. `package.json`: name matches `feezal-theme-*`, keyword `feezal-theme`, `"feezal": {"type": "theme"}`, `main` points at the self-injecting module, license field set.
2. The module's only side effect is the `<style>` injection — no imports, no globals beyond the append.
3. All rules scoped under `.feezal-theme-<slug>`; slug matches the package name.
4. `npm publish --access public`, then install through the feezal Package Manager (search finds it via the keyword).
