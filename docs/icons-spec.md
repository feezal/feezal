# feezal Icon-Set Authoring Specification

This document is the reference for building and publishing `feezal-icons-*` packages (N23). It complements the [Element Authoring Spec](element-spec.md); read that first for the general packaging/publishing workflow.

---

## 1. Package conventions

| Rule | Detail |
|---|---|
| npm scope | Publish under an npm scope, e.g. `@yourscope/feezal-icons-lucide` |
| Package name | `feezal-icons-<set>` — the `<set>` slug should match the set name you register |
| npm keyword | `feezal-icons` (required — the Package Manager's registry search filters on it) |
| Entry point | `package.json` `"main"` points to the module that calls `feezal.registerIcons(…)` on import |
| Set name | `[a-z][a-z0-9-]*` — becomes the icon-name prefix (`mdi:lightbulb`) and the picker chip label |
| `feezal` field | `"feezal": {"type": "icons", "set": "<set>", "icons": "icons.js"}` — `set` lets the server know your prefix without executing the package; `icons` names the data module that enables per-site tree-shaking (§4a) |
| Multi-set packages (N28) | One package MAY register several sets when the artwork ships as separate namespaces (Font Awesome's styles): declare the plural form `"feezal": {"type": "icons", "sets": [{"set": "fa-solid", "icons": "icons-solid.js"}, …]}` — one data module per set, the entry calls `registerIcons()` once per set. The package slug then names the family (`feezal-icons-fa`), not a single set. |
| License files | Ship the icon artwork's LICENSE/attribution files in the package — the installer copies them next to the bundle (important for attribution licenses like CC BY-SA) |

## 2. Icon names — the `set:name` convention

Icon attribute values are namespaced Home-Assistant-style:

```
lightbulb              → built-in Material Icons (bare name, unchanged since ever)
mdi:lightbulb          → the "mdi" set
knx-uf:sunblind        → the "knx-uf" set
```

The set prefix is your registered set name. Bare names always resolve to the built-in Material set, so installing icon packages never changes existing sites.

## 3. The `registerIcons()` contract

Your entry module registers the set at import time:

```js
feezal.registerIcons('lucide', {
    // EITHER a ligature webfont …
    font: {family: 'Lucide'},          // you must inject the @font-face yourself, see §4
    // … OR a render function (required if no font):
    render(name) {                      // → SVGElement or SVG markup string
        return `<svg viewBox="0 0 24 24"><path d="${PATHS[name]}"/></svg>`;
    },
    // ALWAYS: the names advertised to the editor's icon picker.
    names: ['lightbulb', 'thermometer', /* … */]
});
```

- **Font mode** is for **ligature** webfonts (the glyph renders from the icon's *name*, like Material Icons). `<feezal-icon>` renders `<span style="font-family:'<family>'">name</span>` inside its shadow DOM.
- **Class-plus-codepoint webfonts** (e.g. fonts styled via `.xyz-name::before {content: "\F00deref"}`) **cannot** use font mode — document-level CSS classes do not reach shadow DOM. Use `render(name)` instead (SVG is usually the better choice anyway: it follows `currentColor`).
- `render(name)` output is sized to `1em` and filled with `currentColor` by `<feezal-icon>` — return an unsized `<svg viewBox="…">`.
- Registering the same set name again replaces the set (last write wins) and re-renders all `<feezal-icon>` instances.
- Discovery: registered set names appear in `window.feezal.iconSets`; a `feezal-iconsets-changed` event fires on `document` after each registration.

## 4a. The data module — per-site tree-shaking

Full icon sets are megabytes. feezal loads them **only in the editor** (the picker offers every icon); viewer pages and static exports get a **server-generated mini-registration containing just the icons the site uses**.

To opt in, keep your icon data in a separate module declared via `feezal.icons`:

```js
// icons.js — one JSON object literal, name → complete inline-SVG markup
export default {"lightbulb": "<svg viewBox=\"0 0 24 24\">…</svg>", …};
```

```js
// index.js — the full registration, loaded by the editor
import ICONS from './icons.js';
feezal.registerIcons('myset', {names: Object.keys(ICONS), render: n => ICONS[n] || ''});
```

The server parses the data module (it must be exactly `export default <JSON object>;`), scans the site HTML for `myset:<name>` references, and inlines only those entries into viewer pages and exports.

**Loading matrix:**

| Context | Bundled set (with data module) | User-installed set |
|---|---|---|
| Editor | full set (dynamic module route) | full set |
| Live viewer | tree-shaken inline registration | full module (`<script>` tag) — install bundles are single files and cannot be shaken |
| Static export | tree-shaken registration appended to the bundle | **not included** (logged at export time) |

**Caveat — dynamic icon names:** the extractor sees only icons statically present in the saved site HTML (attribute values, `feezal-params` defaults, template markup). Icons chosen at *runtime* (e.g. an MQTT payload carrying `mdi:whatever`) are not in the shaken set — sites relying on that need the icon present statically somewhere, or the full set installed as a user package.

## 4. Shipping assets (fonts, SVG files)

The Package Manager bundles your JS entry into a single ESM file. **Non-JS files are copied alongside it** (preserving relative paths) into `<dataDir>/elements/<pkg>/…`, served from `/user-elements/<pkg>/…`.

Reference assets relative to your module so the path survives bundling:

```js
const fontUrl = new URL('./assets/lucide.woff2', import.meta.url);
const css = `@font-face { font-family: 'Lucide'; src: url('${fontUrl}') format('woff2'); }`;
document.head.appendChild(Object.assign(document.createElement('style'), {textContent: css}));
```

Skipped by the copy: `*.js`, `*.mjs`, `*.cjs`, `*.ts`, `*.map`, `*.md`, `package.json`, `node_modules/`, `.git/`. Everything else (fonts, SVGs, LICENSE, attribution files) is copied.

For pure-SVG sets, consider inlining path data as a JS object instead of shipping hundreds of files — smaller installs and no extra requests.

## 5. Rendering icons — `<feezal-icon>` (element authors)

Elements should render icon names through the shared resolver instead of a raw Material span, so any installed set works:

```js
html`<feezal-icon name="${this.icon}"></feezal-icon>`
```

- Tracks the host's `font-size` and `color` (glyph = `1em`, `currentColor`).
- Bare names render the built-in Material ligature — drop-in compatible.
- Unknown set prefix (set not installed) renders a small muted `set:name` fallback with a tooltip instead of breaking.

## 6. Editor integration (what you get for free)

- Your set appears in the **icon picker** as a chip (`All | Material | <your-set> | …`); the last-used chip is remembered.
- Typing `<set>:` in an icon field scopes the autocomplete to your set.
- In the **All** chip, matches are grouped under set-name headers.
- Picking an icon writes the prefixed name into the attribute.

## 7. Publishing checklist

1. `package.json`: name matches `feezal-icons-*`, keyword `feezal-icons`, `main` points at the registering module, license field set.
2. Entry calls `feezal.registerIcons()` at import time — no other side effects.
3. Ligature font? Inject the `@font-face` yourself (§4). Anything else? Implement `render(name)`.
4. Icon artwork license + attribution files included in the package.
5. `npm publish --access public`, then install through the feezal Package Manager (search finds it via the keyword).

## 8. Known limitations

- User-installed icon sets are not folded into static exports (their install bundles are single files and cannot be tree-shaken; the export logs a warning). Bundled sets with a data module are fully supported in exports via the shaken registration.
- Webfont assets referenced by URL are not inlined into the single-file export — another reason to prefer SVG data modules.
- Dynamic (runtime-chosen) icon names are not covered by tree-shaking — see §4a.
