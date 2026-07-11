# Element families — external repos, packaging, and development workflow

**Status: agreed plan (July 2026) — nothing implemented yet.** This document records the decisions and the intended workflow for developing the element families on the roadmap (E55 metro, E56 panel, E57 eink, E58 glass, E59 tui, E60 rail, E61 hmi, E62 mqtt, E63 schematic, E83 spectrum, E84 wired, E90 vaadin, E97 lcars, …) outside the feezal core repository. It complements — not replaces — [element-spec.md](element-spec.md): the element authoring contract is unchanged; this document covers repos, packaging, publishing, and the dev loop.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Where do families live? | **One git repo per family**, under the `feezal` GitHub org (e.g. `feezal/feezal-elements-metro`) |
| npm packaging | **One npm package per family** — the N29 **Phase B** multi-element shape (`@feezal/feezal-elements-<family>`), *not* Phase A aggregators |
| Solo elements (E64, E65, …) | Stay **built-in** in the core workspace (`www/packages/@feezal/`) as today — only themed families go external |
| Dev loop | **Server link mode**: feezal watches a local package dir, re-bundles through the real install pipeline on save, editor reloads |
| License | **MIT** (same as the existing element packages / element SDK per A21) |
| Versioning | Lockstep **major** with feezal core; **minor/patch independent** per family; patch bump with every change (existing rule) |

---

## 2. Package model (N29 Phase B)

A family ships as **one npm package containing one bundle that defines many custom-element tags**, declared in a manifest:

```json
{
  "name": "@feezal/feezal-elements-metro",
  "version": "2.0.0",
  "license": "MIT",
  "main": "index.js",
  "keywords": ["feezal", "feezal-element", "feezal-elements", "mqtt", "dashboard"],
  "repository": "github:feezal/feezal-elements-metro",
  "dependencies": {
    "@feezal/feezal-element": "^2.0.0"
  },
  "feezal": {
    "type": "elements",
    "elements": [
      "feezal-element-metro-tile",
      "feezal-element-metro-live-tile",
      "feezal-element-metro-appbar"
    ]
  }
}
```

- **Naming:** package `@feezal/feezal-elements-<family>` (plural — a family, not a single element); element tags keep the standard `feezal-element-<family>-<name>` form, where `<family>` is the family's category prefix. Reserved categories (`basic`, `paper`, and the other built-in categories) remain owned by core.
- **Entry point:** `index.js` imports every element module and `customElements.define()`s all tags. The shared **family base class** (`src/base.js`) is bundled **once** — the main win of Phase B over per-element packages.
- **The manifest is load-bearing:** `feezal.elements` is how the editor palette, the `window.feezal.elements` registry, and export tree-shaking learn which tags a package exposes (see §4, prerequisite 2).
- **Real dependencies:** unlike the core workspace packages (which declare no dependencies and rely on workspace hoisting), external packages must declare everything they import — at minimum `@feezal/feezal-element` with a proper semver range. The install pipeline bundles the package standalone; whatever npm resolves is what ships.

**Why Phase B directly (decided):** Phase A (an aggregator package whose members are separate single-element npm packages) works with today's core but would mean publishing ~100 individual packages across ~13 families and migrating them all to Phase B later. The Phase B core work is done **once, first** (§4), and every family ships in its final shape.

---

## 3. Family repo layout

Repo name = bare package name. One repo = one npm package = one release unit.

```
feezal-elements-metro/
├── package.json                        # see §2
├── index.js                            # imports + defines all elements
├── src/
│   ├── base.js                         # shared family base class (extends FeezalElement)
│   ├── feezal-element-metro-tile.js
│   ├── feezal-element-metro-live-tile.js
│   └── …
├── test/                               # vitest unit tests (happy-dom, mirroring www/test conventions)
├── TESTING.md                          # per-family manual QA checklist (same role as core docs/TESTING.md §6)
├── CLAUDE.md                           # thin: points at element-spec.md + family-specific notes
├── README.md                           # screenshots, element list, install instructions
├── LICENSE                             # MIT
└── .github/workflows/
    ├── ci.yml                          # lint + unit tests on PR/push
    └── publish.yml                     # npm publish (with provenance) on v* tag
```

- **Template repo + scaffold:** a `feezal/feezal-elements-template` repo, stamped by a new **`create-feezal-family`** CLI (the planned A20 scaffold extension, sibling of `create-feezal-element`). This is how ~13 repos stay consistent without a monorepo: tooling lives in the template and is updated there; repos are regenerated-by-hand rarely and drift is acceptable because per-repo tooling is deliberately thin.
- **Tests:** self-contained vitest setup per repo (the core's centralized `www/test/` harness is not reachable from an external repo). If shared helpers accumulate, extract a published `@feezal/element-test-utils` later — not upfront.
- **CLAUDE.md:** keep it thin — link to the element spec, state the family's design language and shared-base conventions, repeat the patch-bump-per-change rule.

---

## 4. Prerequisites in the core repo (ordered)

Nothing family-related can ship before these. In dependency order:

1. **Publish a clean `@feezal/feezal-element` to npm.** ⚠️ The version on npm today is **0.8.0 — Polymer-era**, with stale metadata (depends on `@polymer/polymer`, repository URL points at `node-red-contrib-feezal`), while the workspace package is at 1.1.0. The install pipeline ([install.js](../server/src/build/install.js)) resolves `@feezal/feezal-element` **from npm** when bundling an external package — so until a current version is published, every externally installed element gets the ancient base class. Work: fix the package's metadata (repo URL, drop the Polymer dep, declare `lit` as a real dependency since elements import `html`/`css` through it), align the version with the lockstep-major scheme, publish, and add CI so future base-class changes are published promptly.

2. **N29 Phase B core support.** The three `tag == package-name` assumptions must learn to read the `feezal.elements` manifest (details in ROADMAP N29):
   - palette build ([feezal-palette.js](../www/src/feezal-palette.js)) — iterate declared tags instead of deriving one tag per package;
   - registry emission (`generateElementsModule` / `writeElementsFile` in [elements.js](../server/src/build/elements.js)) — emit actual tag names / a package→tags map;
   - export tree-shaking (`tagsToPackages` in [extract-elements.js](../server/src/build/extract-elements.js)) — tag→package lookup.
   Plus: extend the install allowlist (`isAllowedPackage`/`derivePkgType` in install.js) with the **`feezal-elements-`** prefix (the current `feezal-element-` prefix does **not** match the plural form), and group a family's elements under the family in the Packages sidebar.

3. **N27 — live viewer loads installed packages.** Installed packages currently load only in the editor. Until N27 lands, an externally installed family works on the canvas but **not in the live viewer** — a non-starter for shipping families. The static-export story for installed packages (append the self-contained bundles vs. document as unsupported) should be decided in the same stroke (relates: A8).

4. **Link mode** (dev loop, §5).

5. **`create-feezal-family` scaffold + template repo** (A20).

Only then: start E55/E56/… development in external repos.

---

## 5. Development workflow — server link mode

**Problem:** hack on an external element and see it live in the running editor, without touching the core repo's workspace.

**Mechanism (to build, prerequisite 4):**

- The server can **link a local package directory** (registered via CLI flag/env such as `FEEZAL_LINK_DIRS`, or an API the Packages sidebar exposes).
- A watcher on the linked dir re-runs the **existing install bundle step** (Vite single-ESM bundle, with the linked dir as resolution root — its own `node_modules` provides `@feezal/feezal-element` from npm) and writes the result to `<dataDir>/elements/<pkg>/` — exactly where installed packages live.
- After a rebuild the server nudges connected editors to reload (the existing socket/`reload` machinery). The editor already re-discovers packages per request, so a plain browser reload also works.
- The Packages sidebar shows linked packages with a **"linked (dev)"** badge; Remove unlinks.

**Why this over the alternatives:** it exercises the *real* shipping path (npm resolution + install bundler), so "works in dev" ≡ "works when installed". A temporary drop-in into `www/packages/@feezal/` would give Vite hot reload but mutates `www/package.json` (accidental-commit hazard), resolves deps via workspace hoisting instead of npm, and bypasses the install bundler entirely.

**Day-to-day loop:**

```sh
# once per family checkout
cd ~/source/repos/feezal-elements-metro && npm install

# start feezal with the family linked
FEEZAL_LINK_DIRS=~/source/repos/feezal-elements-metro node server/bin/feezal.js

# edit src/…, save → auto-rebundle → editor reloads
```

**Hacking the base class and a family simultaneously:** `npm link` the core repo's `www/packages/@feezal/feezal-element` into the family repo so the linked bundle picks up local base-class changes; drop the link to return to the published version.

---

## 6. Versioning & publishing

- **Lockstep major** across feezal core and all `@feezal/*` packages (existing rule); **minor/patch independent** per family; **patch bump with every change**, in the same commit (existing rule, extended to family repos).
- **Publish:** GitHub Actions, triggered by a `v*` tag push, `npm publish --provenance` under the `@feezal` scope. CI (lint + unit tests) on every PR/push.
- **Discoverability:** the in-editor package search queries the npm registry by keyword — family packages must carry the **`feezal-element`** keyword (what `typeKeyword('element')` searches for) in addition to `feezal-elements`. The name prefix (`feezal-elements-`) is what the install allowlist checks.
- **Third-party families** follow the same shape under their own scope (`@theirscope/feezal-elements-<family>`) — the prefix and manifest rules are scope-agnostic, same as single elements today.

---

## 7. Local machine & VS Code conventions

- **Sibling checkouts:** all repos next to each other — `…/source/repos/feezal`, `…/source/repos/feezal-elements-metro`, etc.
- **Multi-root workspaces:** a personal `.code-workspace` per working context (core + the family currently in progress). Keep these **out of the family repos** (they reference machine-specific sibling paths); store them locally or in a personal meta-repo.
- **Windows/WSL:** the core repo's shell rule applies unchanged in family repos — file/npm/git operations via WSL, never PowerShell.

---

## 8. What stays in the core repo

- The existing built-in categories (`basic`, `material`, `paper`, `layout`, `system`, `connection`) remain workspace packages in `www/packages/@feezal/` — they are the viewer bundle.
- **Future solo elements** (E64 mqtt-image, E65 passfail, …) also stay built-in (decided) — only themed **families** go external.
- The element **spec** ([element-spec.md](element-spec.md)) stays in core as the single authoring reference; family repos link to it. When N29 Phase B lands, spec §1's "one element per package" rule gains the family-package exception and the manifest contract.

---

## 9. Open questions (deliberately deferred)

- **Static export** of sites using installed families — bundle-append vs. documented-unsupported (decide with N27; relates A8).
- **`@feezal/element-test-utils`** — extract shared test helpers only once ≥2 family repos duplicate them.
- **Published element-spec URL** — family repos currently link to the spec in the core repo; a rendered docs site would give a stable versioned URL (relates D-items).
- **Update semantics** in the package manager for family packages (single package → trivial; nothing like Phase A's member reference-counting is needed — one of the reasons Phase B won).

---

**Relates:** ROADMAP N29 (element sets — Phase B is specified there), N27 (viewer loading), A20 (scaffolding/ecosystem), A8 (export tree-shaking), E55–E63/E83/E84/E90/E97 (the families themselves), element-spec.md §1 (package conventions).
