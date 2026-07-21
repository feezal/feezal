# U7 ✅ — Monaco editor for template attributes

*Archived roadmap item — Editor UX. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

Elements add `editor: true` to their template attribute descriptor (e.g. `feezal-element-basic-template`). The inspector renders `feezal-template-editor` (new Lit component) instead of `sl-textarea` for those attributes. The component lazy-loads Monaco on first use, shows a spinner during load, debounces change events (300 ms), syncs theme (`vs` / `vs-dark` from `feezal.app._darkMode`), and includes an expand overlay button for large templates. Phase 1 static completion provider triggers on `${` and offers `msg.payload`, `msg.topic`, `msg.payloadString`, `JSON.stringify(…)`, plus extra `variables` from the descriptor (e.g. `seconds` for countdown-dialog). Phase 2 (live payload key completions) deferred — requires server-side payload caching.

Shared infrastructure: `feezal-monaco-loader.js` (single lazy `import('monaco-editor')` cache), `vite-plugin-monaco-editor` in `vite.config.js` (workers: `editorWorkerService`, `html`, `css`, `typescript`). Monaco adds ~3 MB / 984 kB gzip to the editor's async chunks — viewer bundle unaffected.

**Implemented in:** `feezal-template-editor.js` (new), `feezal-monaco-loader.js` (new), `feezal-sidebar-inspector-attributes.js`, `vite.config.js`, `www/package.json`, `feezal-element-basic-template` v1.0.2.
