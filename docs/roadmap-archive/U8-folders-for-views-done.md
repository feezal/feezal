# U8 — Folders for views ✅ done

*Archived roadmap item — Editor UX. Open items: [../ROADMAP.md](../ROADMAP.md) · Index: [README.md](README.md)*

Views can be organised into a folder hierarchy in the editor. **Folders are an editor-only concept** — the viewer and static exports are unaffected and continue to show all views flat.

**Implementation** (`www/src/feezal-app-editor.js`, load wiring in `www/src/feezal-sidebar-inspector.js`):
- The folder tree is persisted under `viewer.folders` in `viewer.json` (flows through the existing deploy `viewer` config; no server change needed). Each node is a folder `{id, name, children:[]}` or a view ref `{view}`. Never written to `views.html`.
- The view tab bar was replaced with a custom folder-aware tab bar (`#view-tabs`) that renders folders and views in tree order, with collapse/expand, indentation, and a per-folder view count.
- **Create folder** button (`create_new_folder`) next to "Add view"; new folders open a rename dialog immediately.
- **Right-click a view tab**: Rename, Duplicate, Move to (Top level + each folder), Delete.
- **Right-click a folder tab**: Rename folder, Delete folder (children lifted to the parent at the folder's position).
- **Drag & drop**: reorder views/folders, drop a view/folder *into* a folder (centre), reorder *before/after* (edges), drag to the empty bar area for top level. Visual drop indicators (insertion line / folder highlight / end-of-bar). Nesting capped at 3 levels (`_maxFolderDepth` rejects deeper moves).
- **Reconciliation** (`_reconcile`): on load and whenever the view set changes, dangling view refs and duplicates are dropped, malformed nodes ignored, over-deep folders flattened, and any unreferenced views appended at the top level — covering all the views.html ↔ viewer.json drift cases. Renames update the tree in place (`_renameInTree`) so placement is preserved. Empty folders are kept.
- The viewer route and static export compose their HTML from `views.html` + theme/overrides/classes only and never reference `folders`, so both stay flat automatically.
