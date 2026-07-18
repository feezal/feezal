# feezal — Agent Instructions

## Shell / terminal conventions

**Always use WSL (`wsl -e bash -c "..."`) for all file, build, npm, and git operations.** Never use PowerShell for these — it silently introduces UTF-8 BOMs and corrupts line endings (CRLF), which break JSON parsers, shell scripts, and git diffs.

The only exception is operations that require Windows credential storage, such as `git push` (which may need the Windows Git Credential Manager). For everything else — file writes, npm, builds, grep, git add/commit — use WSL.

---

## Project overview

feezal is a browser-based MQTT dashboard editor + viewer.

- **`server/`** — Node.js/Express + Socket.IO backend. Entry: `server/src/app.js`. Discovers elements and themes at startup from `www/node_modules/@feezal/`.
- **`www/`** — Vite front-end. Editor UI (`editor/index.html`) + viewer bundle (`src/viewer-main.js`). Framework: **Lit 3** + **Shoelace 2.20.1**. Build: `cd www && npm run build`.
- **`www/src/`** — Built-in UI components (`feezal-sidebar-*.js`, `feezal-app-*.js`, etc.). These are part of the editor bundle.
- **`www/packages/@feezal/`** — Element and theme packages living in the npm workspace. This is where new elements are created (see below). npm symlinks them into `www/node_modules/@feezal/` so Vite can resolve imports.
- **`docs/element-spec.md`** — Full element authoring specification. **Always read this before working on any element.**

---

## Critical Lit 3 pattern

**Never initialise reactive properties with class field syntax (`=`).** Class fields shadow Lit's prototype-level reactive setters and break reactivity. Always initialise in the constructor:

```js
// WRONG
class MyEl extends LitElement {
    myProp = 'default'; // shadows the reactive setter
}

// CORRECT
constructor() {
    super();
    this.myProp = 'default';
}
```

---

## Creating new feezal elements

New elements **must** be created as packages under `www/node_modules/@feezal/`, not in `www/src/`.

### Steps

1. **Choose a name** following `feezal-element-<category>-<name>` (e.g. `feezal-element-basic-gauge`). Categories `basic` and `paper` are reserved for official feezal elements.

2. **Create the package directory**:
   ```
   www/packages/@feezal/feezal-element-<category>-<name>/
   ```

3. **Create `package.json`**:
   ```json
   {
     "name": "@feezal/feezal-element-<category>-<name>",
     "version": "0.1.0",
     "main": "feezal-element-<category>-<name>.js"
   }
   ```

4. **Register in `www/package.json`** — add an entry to `dependencies`:
   ```json
   "@feezal/feezal-element-<category>-<name>": "*"
   ```
   Keep all `@feezal/feezal-element-*` entries sorted alphabetically. Without this the package is not bundled by Vite.

5. **Create the element file** `feezal-element-<category>-<name>.js`. Follow the full spec in `docs/element-spec.md` — minimal skeleton:

   ```js
   /* global feezal */
   import { FeezalElement, html, css } from '@feezal/feezal-element';

   class FeezalElementCategoryName extends FeezalElement {
       static get feezal() {
           return {
               palette: { name: 'Display Name', category: 'Category', color: '#4a6080' },
               attributes: [ /* see docs/element-spec.md §3.2 */ ],
               styles: ['top', 'left', 'width', 'height'],
               defaultStyle: { width: '80px', height: '40px' }
           };
       }

       static properties = {
           // declare with attribute: 'kebab-name' for camelCase<->kebab mapping
       };

       constructor() {
           super();
           // initialise ALL reactive properties here (never as class fields)
       }

       render() {
           return html`<div>…</div>`;
       }
   }

   customElements.define('feezal-element-<category>-<name>', FeezalElementCategoryName);
   export { FeezalElementCategoryName };
   ```

6. **The server picks it up automatically** at startup by scanning `www/node_modules/@feezal/` — no registration required.

7. **Regenerate the editor/viewer element manifest** — `www/editor/feezal-elements.js` is a *generated, checked-in* file listing every element import; the palette and the viewer bundle only contain what it imports. After adding (or removing) element packages, run `npm install` in `www/` (creates the workspace symlink) and then:
   ```
   node scripts/generate-elements.js
   ```
   Commit the regenerated manifest together with the new package. Skipping this step means the element builds fine but **never appears in the palette**.

8. After creating or modifying element files, **rebuild**:
   ```
   cd www && npm run build
   ```

9. **Add it to the test checklist** — append the element to the appropriate category list in `docs/TESTING.md §6`, plus an "Element-specific notes" bullet for anything the generic recipe doesn't cover (custom inspector, embedded views, dialogs, per-item MQTT, pseudo-element behaviour, …). See *Test checklist maintenance* below.

### Element spec reference

See `docs/element-spec.md` for:
- Full `static get feezal()` descriptor (`palette`, `attributes`, `styles`, `description`, `links`, `restrict`, `defaultStyle`)
- All `attribute` descriptor fields and supported `type` values (`string`, `number`, `boolean`, `color`, `select`, `mqttTopic`)
- `help` property on attribute descriptors → ℹ tooltip in the inspector
- `FeezalElement` base class API (`addSubscription`, `getProperty`, `_payloadCast`)
- MQTT subscribe/publish contract
- CSS custom property conventions
- Publishing checklist

---

## Built-in editor components (`www/src/`)

These are editor UI components, not dashboard elements. Only modify these when changing the editor itself.

| File | Purpose |
|---|---|
| `feezal-sidebar-inspector.js` | Canvas interactions, drag/resize, selection, context menu |
| `feezal-sidebar-inspector-attributes.js` | Attribute inspector panel (renders attribute controls) |
| `feezal-sidebar-inspector-styles.js` | Style inspector panel |
| `feezal-app-editor.js` | Top-level editor app shell |
| `feezal-app-viewer.js` | Top-level viewer app shell |

---

## Attribute descriptors in built-in elements

- **Labels**: always use the exact HTML attribute name (`name` field). Do not add a `label:` property with a friendlier display name.
- **Help text**: add a `help:` string to show a tooltip ℹ icon next to the label in the inspector.
- Attribute names must be **kebab-case** in `feezal.attributes`. If the corresponding Lit property is camelCase, declare `attribute: 'kebab-name'` in `static properties`.

---

## Stack versions

- Lit 3
- Shoelace 2.20.1 (primary colour `#0284c7` / `--sl-color-primary-600`)
- interact.js 1.10.27 (drag/resize; use `snapSize:` modifier for grid snapping)
- DragSelect (rubber-band multi-select on canvas)
- Vite 5

---

## Build & dev

All commands must be run via WSL (see Shell conventions above).

```sh
# Production build (from repo root)
wsl -e bash -c "cd /mnt/c/Users/basti/source/repos/feezal/www && npm run build"

# Dev server (hot reload, proxies API to localhost:3000)
wsl -e bash -c "cd /mnt/c/Users/basti/source/repos/feezal/www && npm run dev"

# Start the feezal server (separate terminal)
wsl -e bash -c "cd /mnt/c/Users/basti/source/repos/feezal && node server/bin/feezal.js"
```

Build output goes to `www/dist/`. The chunk-size warning for chunks >500 kB is expected and pre-existing.

---

## Package versioning

- The `feezal` server package and all `@feezal/*` element/theme packages use **lockstep major versions**: a major bump must be applied to every package in the same release.
- Minor and patch versions are **independent** — element packages may be at different minor/patch versions than the server.
- Always keep verisions in sync between package.json www/package.json and server/package.json
- **Before committing any change to a `feezal-element-*` package** (files under `www/packages/@feezal/feezal-element-*/`), bump the **patch** version in that package's `package.json`. Do this as part of the same commit.


---

## Roadmap maintenance

- Open items live in `docs/ROADMAP.md`.
- Completed items live in `docs/ROADMAP-ARCHIVE.md`.
- **Whenever you mark a roadmap item as done** (add `✅` to its heading), **immediately move the entire section** — from its `### Hx —` heading line down to (but not including) the next `###` heading — to the appropriate section in `docs/ROADMAP-ARCHIVE.md`. Remove it from `docs/ROADMAP.md` entirely.
- Do not leave `✅ done` / `✅ fixed` / `✅ implemented` sections in `docs/ROADMAP.md`.

---

## Test checklist maintenance

`docs/TESTING.md` is the manual QA checklist for the whole app — it must stay in step with the code.

- **Every new element** must be added to the per-element list in `docs/TESTING.md §6`, with an "Element-specific notes" bullet for any behaviour the generic per-element recipe doesn't cover (custom inspector, embedded views, dialogs, pseudo-element / viewer-only rendering, per-item MQTT topics, session/localStorage state, …).
- **Every new feature** (editor UX, sidebar, AI assistant, package manager, export/import, persistence, …) must get its own checklist section — or extend an existing one — with concrete, reproducible steps and the expected result.
- Do this **in the same commit** as the element/feature, exactly as you would bump an element's patch version. A change that ships without its test instructions is incomplete.
- When a feature changes behaviour, update its existing checklist entry instead of leaving stale steps.
