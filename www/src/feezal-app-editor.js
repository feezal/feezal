import {LitElement, html, css} from 'lit';

// Shoelace light theme — must be imported before any sl-* component renders.
// Defines all CSS custom properties that Shoelace components depend on.
// This file is editor-only; the viewer bundle never imports feezal-app-editor.
import '@shoelace-style/shoelace/dist/themes/light.css';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

import {loadMonaco, syncMonacoStyles} from './feezal-monaco-loader.js';
import {viewFromHash} from './hash-view.js';
import './feezal-welcome-tour.js';

import './feezal-menu.js';
import './feezal-palette.js';
import './feezal-site.js';
import './feezal-view.js';
import './feezal-component.js';
import './feezal-icon.js';
import './feezal-icon-input.js';
import './feezal-sidebar-inspector.js';
import {stripCanvasZIndex} from './feezal-sidebar-inspector.js';
import './feezal-sidebar-assets.js';
import './feezal-sidebar-themes.js';
import './feezal-sidebar-viewer.js';
import './feezal-sidebar-editor.js';
import './feezal-site-manager.js';
import './feezal-sidebar-history.js';
import './feezal-sidebar-packages.js';
import './feezal-ai-chat.js';
import './feezal-capacitor-dialog.js';
import './feezal-export-dialog.js';
import './feezal-generate-dialog.js';
import {clippyStyles, clippyMarkup, clippyEnabled} from './feezal-clippy.js';

class FeezalAppEditor extends LitElement {
    static properties = {
        views:           {type: Array},
        changes:         {type: Boolean},
        deploying:       {type: Boolean},
        viewSelected:    {type: Boolean},
        sidebar:         {type: String},
        _navView:        {state: true},
        paletteVisible:  {type: Boolean},
        sidebarVisible:  {type: Boolean},
        gridVisible:     {type: Boolean},
        gridSize:        {type: Number},
        selectionColor:  {type: String},
        gridColor:       {type: String},
        snapping:        {type: String},
        preventEditorMqtt: {type: Boolean},
        _canScrollLeft:  {state: true},
        _canScrollRight: {state: true},
        _searchOpen:     {state: true},
        _searchQuery:    {state: true},
        _darkMode:        {state: true},
        _themeMode:       {state: true},
        _sidebarWidth:    {state: true},
        _version:         {state: true},
        _viewCtx:         {state: true},
        _actionMenuPos:   {state: true},
        _sourceMode:      {state: true},
        _sourceError:     {state: true},
        _sourceHelpOpen:  {state: true},
        _folders:         {state: true},
        _collapsed:       {state: true},
        _dropHint:        {state: true},
        _dragArmed:       {state: true},
        _editFolderId:    {state: true},
        _folderMenu:      {state: true},
        _aiConfigured:    {state: true},
        _aiPanelOpen:     {state: true},
        _aiPanelWidth:    {state: true},
        _componentEdit:   {state: true},   // U32: {name, viewName, returnView} while editing a component
        _componentDialog: {state: true},   // U32: create-component dialog state {rows, error}
        _componentMapping: {state: true},  // U52: attribute-mapping dialog state {rows, error} while in edit mode
        _componentDeleteInfo: {state: true} // U32: delete-with-instances dialog {name, count, views}
    };

    static styles = css`
        :host { display: block; width: 100%; height: 100%; }

        #menu {
            height: 42px; background-color: #f8f8f8; width: 100%;
            display: flex; flex-direction: row; box-sizing: border-box; color: #333;
            border-bottom: 1px solid #e4e4e7;
        }
        #menu-left {
            flex: 0 0 175px; box-sizing: border-box;
            display: flex; align-items: baseline;
            padding: 0 12px; color: var(--sl-color-primary-600);
            font-size: 18px; font-style: italic; font-weight: 600;
            /* centre the baseline-aligned group vertically within the 42px bar */
            line-height: 42px;
        }
        #menu-center {
            flex-grow: 1; display: flex; flex-direction: row; height: 42px;
        }
        #menu-right { display: flex; align-items: center; padding: 0 2px; overflow: hidden; box-sizing: border-box; }
        /* Toolbar segment above the AI panel column: keeps #menu-right and the
           sidebar-toggle chevron aligned with the body when the panel opens, and
           holds the (rightmost) AI toggle button while the panel is open.
           border-box so the padding stays inside the flex-basis width — otherwise
           these columns render wider than the body panels (#sidebar-panels /
           #ai-panel, which have no padding) and shift the chevron + inspector
           button left of the sidebar border. */
        #menu-ai-space { display: flex; align-items: center; justify-content: flex-end; padding: 0 6px; box-sizing: border-box; }
        .icon-btn.active { background: rgba(0,0,0,0.1); }

        /* AI assistant panel — a flex column at the right of #container (U9).
           It takes its own space so the canvas shrinks rather than being covered. */
        #ai-panel {
            flex: 0 0 auto; height: 100%;
            display: flex; flex-direction: row;
        }
        #ai-resize {
            flex: 0 0 5px; cursor: ew-resize; background: var(--feezal-border, #e4e4e7);
        }
        #ai-resize:hover { background: var(--sl-color-primary-600, #0284c7); }
        :host(.dark) #ai-resize { background: #3d3d3d; }
        #ai-panel feezal-ai-chat { flex: 1; min-width: 0; }
        .nav-btn {
            flex: 0 0 auto; background: none; border: none; cursor: pointer; color: #666;
            padding: 6px 5px; font-size: 20px; line-height: 1; border-radius: 4px;
            display: flex; align-items: center;
        }
        .nav-btn:hover { color: #333; background: rgba(0,0,0,0.07); }
        .nav-btn.active { color: #333; background: rgba(0,0,0,0.1); }
        #container {
            width: 100%; display: flex; flex-flow: row; position: absolute;
            height: calc(100% - 42px);
        }
        #container-view {
            display: flex; flex-direction: column; position: relative; width: 100%; height: 100%;
            padding: 0; -webkit-user-select: none; user-select: none; overflow: hidden;
        }
        /* feezal-site is the slotted canvas; give it all remaining height after the tab bar */
        ::slotted(feezal-site) { flex: 1; min-height: 0; }
        #container-view-menu { display: flex; }
        /* Custom folder-aware view tab bar (U8) */
        #view-tabs {
            flex: 1; min-width: 0; display: flex; align-items: stretch;
            overflow-x: auto; overflow-y: hidden; background: #f5f5f5;
            /* B21: the separator is drawn as an inset shadow (behind the tabs)
               instead of a border below them, so the active tab's own
               border-bottom coincides with the separator line. */
            box-shadow: inset 0 -2px 0 var(--sl-color-neutral-200, #d4d4d8);
            scrollbar-width: none;
        }
        #view-tabs::-webkit-scrollbar { height: 0; }

        /* U32 — component-edit banner + create-component dialog table.
           Solid backgrounds — the strip behind the banner stays light even in
           dark mode, so translucent tints would not follow the editor theme. */
        #component-edit-banner {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 12px; box-sizing: border-box;
            background: #e8f3fb;
            border-bottom: 1px solid var(--sl-color-primary-600, #0284c7);
            color: #333;
            font-size: 13px;
        }
        #component-edit-banner .material-icons { font-size: 18px; opacity: 0.7; }
        :host(.dark) #component-edit-banner {
            background: #24384a;
            border-bottom-color: var(--sl-color-primary-400, #38bdf8);
            color: rgba(255,255,255,0.85);
            /* Default sl-button (Cancel) draws from the neutral tokens — same
               overrides the dark dialogs use. (sl-button reflects
               variant="default", so :not([variant]) selectors never match.) */
            --sl-color-neutral-0:   #3a3a3a;
            --sl-color-neutral-300: #555;
            --sl-color-neutral-700: rgba(255,255,255,0.8);
            /* B49: default-variant HOVER draws from the primary tokens
               (primary-50 bg / primary-300 border / primary-700 text) — the
               light-theme values flash a pale blue on the dark banner. */
            --sl-color-primary-50:  #2e4d63;
            --sl-color-primary-300: #4a7aa0;
            --sl-color-primary-700: rgba(255,255,255,0.92);
        }
        .component-param-table {
            width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px;
        }
        .component-param-table th {
            text-align: left; font-weight: 500; opacity: 0.7; padding: 4px 6px;
            border-bottom: 1px solid var(--feezal-border, #ddd);
        }
        .component-param-table td { padding: 3px 6px; border-bottom: 1px solid var(--feezal-border, #eee); }
        .component-param-value {
            max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-family: Consolas, monospace;
        }
        .component-param-table input {
            width: 110px; padding: 3px 6px; font-size: 12px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px;
        }
        /* Dark mode: the --feezal-* vars are scoped to the sidebars, so the
           slotted dialog table needs explicit overrides (same values). */
        :host(.dark) .component-param-table th { border-bottom-color: #3d3d3d; }
        :host(.dark) .component-param-table td { border-bottom-color: #3d3d3d; }
        :host(.dark) .component-param-table input {
            background: #252525; color: rgba(255,255,255,0.88); border-color: #444;
        }
        :host(.dark) .component-param-table input::placeholder { color: rgba(255,255,255,0.35); }
        #view-tabs.drop-end { box-shadow: inset -3px 0 0 var(--sl-color-primary-600, #0284c7), inset 0 -2px 0 var(--sl-color-neutral-200, #d4d4d8); }
        .ftab {
            flex: 0 0 auto; box-sizing: border-box;
            display: flex; align-items: center; gap: 4px;
            height: 41px; padding: 0 12px;
            padding-left: calc(12px + var(--depth, 0) * 16px);
            font-size: 14px; color: #444; cursor: pointer; white-space: nowrap;
            border-right: 1px solid rgba(0,0,0,0.06);
            /* B21: the tab's 2px bottom border occupies the same rows as the
               bar separator (drawn behind the tabs as an inset shadow on
               #view-tabs) — so the active underline sits ON the separator,
               not above it. background-clip keeps hover/folder backgrounds
               out of the border area so the separator stays visible there. */
            border-bottom: 2px solid transparent;
            background-clip: padding-box;
            position: relative; user-select: none;
        }
        /* U55: hold-to-drag armed — visible "lift" cue so the user knows the
           tab is now draggable (a quick click never arms). */
        .ftab.drag-armed {
            transform: scale(1.04);
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            z-index: 3;
            cursor: grab;
        }
        .ftab:hover { background: #e9e9e9; }
        /* --tab-active-color: set by the inspector while the view itself is
           selected (orange), so view-selection is visible in the tab bar. */
        .ftab.view.active { color: var(--tab-active-color, var(--sl-color-primary-600, #0284c7)); border-bottom-color: currentColor; }
        .ftab.folder { background: rgba(0,0,0,0.035); color: #555; }
        .ftab.folder:hover { background: rgba(0,0,0,0.07); }
        .ftab.folder.open { background: rgba(2,132,199,0.12); }
        .ftab.folder.contains-active { color: var(--sl-color-primary-600, #0284c7); border-bottom-color: currentColor; }
        .ftab .ftab-icon { font-size: 18px; opacity: 0.7; }
        .ftab .ftab-caret { font-size: 18px; opacity: 0.6; margin-left: -2px; }
        .ftab .ftab-sep { opacity: 0.5; margin: 0 1px; }
        .ftab .ftab-active-view { font-weight: 600; }
        .ftab .ftab-nub {
            width: 6px; height: 6px; border-left: 1px solid rgba(0,0,0,0.25);
            border-bottom: 1px solid rgba(0,0,0,0.25); margin-right: 2px; align-self: center;
            margin-top: -4px;
        }
        .ftab.drop-before { box-shadow: inset 2px 0 0 var(--sl-color-primary-600, #0284c7); }
        .ftab.drop-after  { box-shadow: inset -2px 0 0 var(--sl-color-primary-600, #0284c7); }
        .ftab.drop-into   { background: rgba(2,132,199,0.18); outline: 1px dashed var(--sl-color-primary-600, #0284c7); outline-offset: -2px; }
        .view-ctx-label { padding: 4px 14px 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .55; }
        .ctx-icon { font-size: 16px; opacity: .7; }
        /* Tab bar scroll / search chrome */
        .tab-nav-btn {
            flex: 0 0 auto; background: #f5f5f5; border: none; cursor: pointer;
            color: #555; width: 24px; padding: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; font-weight: 600;
            border-bottom: 2px solid var(--sl-color-neutral-200, #d4d4d8);
        }
        .tab-nav-btn:disabled { color: #bbb; cursor: default; }
        .tab-nav-btn:not([disabled]):hover { background: #e0e0e0; }
        #btn-view-search {
            flex: 0 0 auto; background: #f5f5f5; border: none; cursor: pointer;
            color: #555; padding: 0 4px;
            display: flex; align-items: center;
            border-bottom: 2px solid var(--sl-color-neutral-200, #d4d4d8);
        }
        #btn-view-search:hover { background: #e0e0e0; }
        /* Inline search field that replaces the tab list when open */
        #view-search {
            flex: 1; min-width: 0; display: flex; flex-direction: column;
            background: #f5f5f5;
            border-bottom: 2px solid var(--sl-color-neutral-200, #d4d4d8);
            position: relative;
        }
        #view-search-bar {
            display: flex; align-items: center; height: 37px; padding: 0 8px; gap: 6px;
        }
        #view-search-input {
            flex: 1; border: 1px solid #ccc; border-radius: 4px;
            padding: 4px 8px; font-size: 13px; outline: none;
        }
        #view-search-input:focus { border-color: var(--sl-color-primary-500); }
        #view-search-results {
            position: absolute; top: 100%; left: 0; right: 0;
            background: white; border: 1px solid #ccc; border-top: none;
            border-radius: 0 0 4px 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            z-index: 200; max-height: 220px; overflow-y: auto;
        }
        .search-result {
            padding: 7px 12px; cursor: pointer; font-size: 13px;
        }
        .search-result:hover { background: #f5f5f5; }
        .search-result-empty { padding: 8px 12px; font-size: 12px; color: #999; }
        #add-view {
            display: flex; align-items: center; padding: 0 2px;
            background: #f5f5f5;
            border-bottom: 2px solid var(--sl-color-neutral-200, #d4d4d8);
        }
        .icon-btn {
            background: none; border: none; cursor: pointer; color: #444;
            padding: 0; font-size: 20px; line-height: 1; margin: auto 2px;
            border-radius: 4px; display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; flex-shrink: 0;
        }
        .icon-btn:hover { background: rgba(0,0,0,0.07); }
        .icon-btn:disabled { opacity: 0.35; cursor: default; }
        .icon-btn.dark { color: #555; }
        .icon-btn.dark:hover { background: rgba(0,0,0,0.08); }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal;
            font-style: normal;
            font-size: 20px;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            -webkit-font-smoothing: antialiased;
        }
        #toolbar { display: flex; flex-grow: 1; align-items: center; }
        /* ── Unified Deploy split button ────────────────────────────────────── */
        #btn-deploy-wrap {
            display: flex; align-items: center; margin: auto 6px; margin-top: 4.5px;
        }
        #btn-deploy-main {
            height: 32px; padding: 0 12px;
            background: #666; border: none; cursor: pointer;
            border-radius: 4px 0 0 4px;
            color: white; font-weight: 600; font-size: 13px;
            display: flex; align-items: center; gap: 6px;
            border-right: 1px solid rgba(255,255,255,0.22);
            transition: background 0.15s;
        }
        #btn-deploy-caret {
            height: 32px; width: 26px; padding: 0;
            background: #666; border: none; cursor: pointer;
            border-radius: 0 4px 4px 0;
            color: white; display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
        }
        #btn-deploy-main.has-changes,
        #btn-deploy-caret.has-changes { background: var(--sl-color-primary-600); }
        #btn-deploy-main:not([disabled]):hover,
        #btn-deploy-caret:not([disabled]):hover { filter: brightness(1.12); }
        #btn-deploy-main:disabled,
        #btn-deploy-caret:disabled { opacity: 0.65; cursor: default; }
        /* Action dropdown menu */
        .action-menu {
            position: fixed; z-index: 10000;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.22);
            min-width: 160px; padding: 4px 0;
            font-size: 13px; color: var(--feezal-color, #333);
            user-select: none;
        }
        .action-menu-item {
            padding: 7px 14px; cursor: pointer; white-space: nowrap;
            display: flex; align-items: center; gap: 10px;
        }
        .action-menu-item .material-icons { font-size: 16px; opacity: 0.7; }
        .action-menu-item:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .action-menu-item:hover .material-icons { opacity: 1; }
        .action-menu-sep { height: 1px; background: var(--feezal-border, #ddd); margin: 4px 0; }
        :host(.dark) .action-menu {
            background: #2e2e2e; border-color: #3d3d3d;
            color: rgba(255,255,255,0.85); box-shadow: 0 4px 20px rgba(0,0,0,.5);
        }
        :host(.dark) .action-menu-sep { background: #3d3d3d; }
        .spinner {
            width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        #sidebar-panels {
            flex: 0 0 auto; overflow: hidden;
            display: flex; flex-direction: column; height: 100%;
        }
        #sidebar-resize {
            flex: 0 0 4px; cursor: col-resize; background: #e4e4e7;
            transition: background 0.15s;
        }
        #sidebar-resize:hover { background: rgba(2,132,199,0.55); }
        .sidebar-panel { flex: 1; min-height: 0; }
        /* Sidebar panels hide via the HTML hidden attribute set by Lit's ?hidden binding.
           Shadow DOM :host { display:block/flex } rules can outcompete the UA's
           [hidden]{display:none} depending on the browser, so enforce it here from
           the outer (higher-priority) shadow tree. */
        .sidebar-panel[hidden] { display: none !important; }
        #sidebar-select {
            flex-grow: 1; margin: auto 6px; padding: 4px 6px; border: 1px solid #666; border-radius: 4px;
            background: #555; color: white; font-size: 12px; cursor: pointer; display: none;
        }
        #grid {
            width: 100%; height: calc(100% - 35px); position: absolute;
            top: 35px; left: 0; pointer-events: none; display: none;
        }
        #hsnap1, #hsnap2 {
            position: absolute; width: 100%; height: 1px;
            border-bottom: 1px dotted #cccccc; left: 0; display: none;
        }
        #vsnap1, #vsnap2 {
            position: absolute; height: calc(100% - 35px); width: 1px;
            border-right: 1px dotted #cccccc; top: 35px; display: none;
        }

        /* Rename view dialog — now using sl-dialog (respects dark/light mode) */
        #viewdialog::part(panel) { min-width: 300px; }

        /* Ensure all editor dialogs float above canvas elements (Shoelace default is 700) */
        #viewdialog, #deletedialog, #exporterrordialog, #folderdialog,
        #componentdialog, #componentrenamedialog, #componentdeletedialog { --sl-z-index-dialog: 9999; }

        /* View tab context menu */
        .view-ctx-menu {
            position: fixed; z-index: 10000;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.22);
            min-width: 150px; padding: 4px 0;
            font-size: 13px; color: var(--feezal-color, #333);
            user-select: none;
        }
        .view-ctx-item {
            padding: 6px 14px; cursor: pointer; white-space: nowrap;
            display: flex; align-items: center; gap: 10px;
        }
        .view-ctx-item:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .view-ctx-item.danger:hover { background: #c62828; }
        .view-ctx-sep { height: 1px; background: var(--feezal-border, #ddd); margin: 4px 0; }
        :host(.dark) .view-ctx-menu {
            background: #2e2e2e;
            border-color: #3d3d3d;
            color: rgba(255,255,255,0.85);
            box-shadow: 0 4px 20px rgba(0,0,0,.5);
        }
        :host(.dark) .view-ctx-sep { background: #3d3d3d; }

        /* Folder popup menu (cascading, select-style) */
        .folder-menu, .folder-submenu {
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc);
            border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.22);
            min-width: 170px; padding: 4px 0;
            font-size: 13px; color: var(--feezal-color, #333);
            user-select: none;
        }
        .folder-menu { position: fixed; z-index: 10000; }
        .folder-submenu {
            position: absolute; left: 100%; top: -5px;
            display: none;
        }
        .fmenu-item {
            position: relative; padding: 6px 14px; cursor: pointer;
            white-space: nowrap; display: flex; align-items: center; gap: 10px;
        }
        .fmenu-item:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .fmenu-item:hover .fmenu-icon, .fmenu-item:hover .fmenu-caret { opacity: 1; }
        .fmenu-item.has-sub:hover > .folder-submenu { display: block; }
        .fmenu-item.active { color: var(--sl-color-primary-600, #0284c7); font-weight: 600; }
        .fmenu-item.active:hover { color: #fff; }
        .fmenu-icon { font-size: 16px; opacity: .7; }
        .fmenu-label { flex: 1; }
        .fmenu-caret { font-size: 18px; opacity: .7; margin-right: -4px; }
        .fmenu-empty { padding: 6px 14px; opacity: .5; font-style: italic; }
        :host(.dark) .folder-menu, :host(.dark) .folder-submenu {
            background: #2e2e2e;
            border-color: #3d3d3d;
            color: rgba(255,255,255,0.85);
            box-shadow: 0 4px 20px rgba(0,0,0,.5);
        }
        /* sl-dialog dark mode \u2014 set Shoelace panel vars on the dialog element itself
           so they cascade into its shadow DOM and override the light-theme defaults. */
        :host(.dark) #viewdialog,
        :host(.dark) #deletedialog,
        :host(.dark) #exporterrordialog,
        :host(.dark) #folderdialog,
        :host(.dark) #componentdialog,
        :host(.dark) #componentrenamedialog,
        :host(.dark) #componentmappingdialog,
        :host(.dark) #componentdeletedialog {
            --sl-panel-background-color: #2e2e2e;
            --sl-panel-border-color: #3d3d3d;
            --sl-color-neutral-0:   #1e1e1e;
            --sl-color-neutral-100: #252525;
            --sl-color-neutral-200: #3d3d3d;
            --sl-color-neutral-300: #555;
            --sl-color-neutral-600: rgba(255,255,255,0.55);
            --sl-color-neutral-700: rgba(255,255,255,0.75);
            --sl-color-neutral-900: rgba(255,255,255,0.9);
            --sl-color-neutral-1000: rgba(255,255,255,0.95);
            /* B49: default-variant sl-button HOVER draws from the primary
               tokens (primary-50 bg / primary-300 border / primary-700 text)
               — without dark values the hover flashes pale blue. */
            --sl-color-primary-50:  #2e4d63;
            --sl-color-primary-300: #4a7aa0;
            --sl-color-primary-700: rgba(255,255,255,0.92);
        }
        /* Slotted body content is light-DOM and does not inherit the Shoelace token
           overrides above — set color explicitly so it reads well on dark panels. */
        :host(.dark) #viewdialog p,
        :host(.dark) #deletedialog p,
        :host(.dark) #exporterrordialog p,
        :host(.dark) #componentdialog p,
        :host(.dark) #componentmappingdialog p,
        :host(.dark) #componentdeletedialog p { color: rgba(255,255,255,0.85); }
        /* The dialog panel shadow DOM inherits color from the document default (dark text).
           Override via ::part(panel) so title, close button and body all read correctly. */
        :host(.dark) #viewdialog::part(panel),
        :host(.dark) #deletedialog::part(panel),
        :host(.dark) #exporterrordialog::part(panel),
        :host(.dark) #folderdialog::part(panel),
        :host(.dark) #componentdialog::part(panel),
        :host(.dark) #componentrenamedialog::part(panel),
        :host(.dark) #componentmappingdialog::part(panel),
        :host(.dark) #componentdeletedialog::part(panel) { color: rgba(255,255,255,0.88); }
        /* Default (neutral) sl-button inside dark dialogs: subtle dark grey, gentle hover. */
        :host(.dark) #viewdialog sl-button:not([variant])::part(base),
        :host(.dark) #deletedialog sl-button:not([variant])::part(base),
        :host(.dark) #exporterrordialog sl-button:not([variant])::part(base),
        :host(.dark) #folderdialog sl-button:not([variant])::part(base),
        :host(.dark) #componentdialog sl-button:not([variant])::part(base),
        :host(.dark) #componentrenamedialog sl-button:not([variant])::part(base),
        :host(.dark) #componentmappingdialog sl-button:not([variant])::part(base),
        :host(.dark) #componentdeletedialog sl-button:not([variant])::part(base) {
            background-color: #3a3a3a; border-color: #555; color: rgba(255,255,255,0.8);
        }
        :host(.dark) #viewdialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #deletedialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #exporterrordialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #folderdialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #componentdialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #componentrenamedialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #componentmappingdialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #componentdeletedialog sl-button:not([variant])::part(base):hover {
            background-color: #4a4a4a; border-color: #666; color: rgba(255,255,255,0.95);
        }
        /* sl-input inside dark dialog — ::part() overrides so background/text are readable */
        :host(.dark) #viewdialog sl-input::part(base),
        :host(.dark) #folderdialog sl-input::part(base),
        :host(.dark) #componentdialog sl-input::part(base),
        :host(.dark) #componentrenamedialog sl-input::part(base) {
            background: #2e2e2e; border-color: #3d3d3d; color: rgba(255,255,255,0.88);
        }
        :host(.dark) #viewdialog sl-input::part(input),
        :host(.dark) #folderdialog sl-input::part(input),
        :host(.dark) #componentdialog sl-input::part(input),
        :host(.dark) #componentrenamedialog sl-input::part(input) {
            background: #2e2e2e; color: rgba(255,255,255,0.88);
        }
        :host(.dark) #viewdialog sl-input::part(form-control-label),
        :host(.dark) #folderdialog sl-input::part(form-control-label) {
            color: rgba(255,255,255,0.6);
        }

        /* ── Dark mode ──────────────────────────────────────────────────── */
        :host(.dark) #menu {
            background-color: #1e1e1e; color: rgba(255,255,255,0.9);
            border-bottom-color: #333;
        }
        :host(.dark) #menu-left { color: var(--sl-color-primary-400); }
        :host(.dark) .icon-btn { color: rgba(255,255,255,0.78); }
        :host(.dark) .icon-btn:hover { background: rgba(255,255,255,0.1); }
        :host(.dark) .icon-btn.active { background: rgba(255,255,255,0.2); }
        :host(.dark) .icon-btn.dark { color: rgba(255,255,255,0.78); }
        :host(.dark) .icon-btn.dark:hover { background: rgba(255,255,255,0.1); }
        :host(.dark) .nav-btn { color: rgba(255,255,255,0.6); }
        :host(.dark) .nav-btn:hover { color: white; background: rgba(255,255,255,0.12); }
        :host(.dark) .nav-btn.active { color: white; background: rgba(255,255,255,0.22); }
        :host(.dark) #sidebar-resize { background: #3d3d3d; }
        :host(.dark) #sidebar-resize:hover { background: rgba(2,132,199,0.5); }
        :host(.dark) #view-tabs { background: #2e2e2e; box-shadow: inset 0 -2px 0 #3d3d3d; }
        :host(.dark) #view-tabs.drop-end { box-shadow: inset -3px 0 0 var(--sl-color-primary-400, #38bdf8), inset 0 -2px 0 #3d3d3d; }
        :host(.dark) .ftab { color: rgba(255,255,255,0.7); border-right-color: rgba(255,255,255,0.06); }
        :host(.dark) .ftab:hover { background: rgba(255,255,255,0.08); }
        :host(.dark) .ftab.view.active { color: var(--sl-color-primary-400, #38bdf8); }
        :host(.dark) .ftab.folder { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.78); }
        :host(.dark) .ftab.folder:hover { background: rgba(255,255,255,0.1); }
        :host(.dark) .ftab.folder.contains-active { color: var(--sl-color-primary-400, #38bdf8); }
        :host(.dark) .ftab .ftab-nub { border-color: rgba(255,255,255,0.3); }
        :host(.dark) .tab-nav-btn {
            background: #2e2e2e; color: rgba(255,255,255,0.6); border-bottom-color: #444;
        }
        :host(.dark) .tab-nav-btn:not([disabled]):hover { background: #3a3a3a; }
        :host(.dark) #btn-view-search {
            background: #2e2e2e; color: rgba(255,255,255,0.6); border-bottom-color: #444;
        }
        :host(.dark) #btn-view-search:hover { background: #3a3a3a; }
        :host(.dark) #add-view { background: #2e2e2e; border-bottom-color: #444; }
        :host(.dark) #view-search { background: #2e2e2e; border-bottom-color: #444; }
        :host(.dark) #view-search-input { background: #222; color: rgba(255,255,255,0.9); border-color: #555; }
        :host(.dark) #view-search-results { background: #222; border-color: #555; }
        :host(.dark) .search-result { color: rgba(255,255,255,0.9); }
        :host(.dark) .search-result:hover { background: #3a3a3a; }
        :host(.dark) .search-result-empty { color: #888; }

        /* Propagate dark-mode palette into child panel shadow DOMs via CSS custom properties */
        :host(.dark) feezal-palette,
        :host(.dark) feezal-sidebar-inspector,
        :host(.dark) feezal-sidebar-themes,
        :host(.dark) feezal-sidebar-viewer,
        :host(.dark) feezal-sidebar-editor,
        :host(.dark) feezal-sidebar-assets,
        :host(.dark) feezal-sidebar-history,
        :host(.dark) feezal-sidebar-packages,
        :host(.dark) feezal-capacitor-dialog,
        :host(.dark) feezal-export-dialog,
        :host(.dark) feezal-generate-dialog,
        :host(.dark) feezal-ai-chat {
            --feezal-bg:     #2e2e2e;
            --feezal-bg-sub: #262626;
            --feezal-border: #3d3d3d;
            --feezal-color:  rgba(255,255,255,0.85);
            color:           rgba(255,255,255,0.85);
            --sl-color-neutral-0:   #1e1e1e;
            --sl-color-neutral-50:  #222;
            --sl-color-neutral-100: #262626;
            --sl-color-neutral-200: #3d3d3d;
            --sl-color-neutral-300: #555;
            --sl-color-neutral-600: rgba(255,255,255,0.6);
            --sl-color-neutral-700: rgba(255,255,255,0.75);
            --sl-color-neutral-900: rgba(255,255,255,0.9);
            --sl-input-background-color: #252525;
            --sl-input-border-color: #444;
            --sl-input-border-color-hover: #555;
            --sl-input-color: #bdbdbd;
            --sl-input-color-hover: #bdbdbd;
            --sl-input-color-focus: #bdbdbd;
            --sl-input-label-color: rgba(255,255,255,0.6);
            --sl-input-placeholder-color: rgba(255,255,255,0.25);
            --sl-input-icon-color: rgba(255,255,255,0.4);
            --feezal-btn-hover: rgba(255,255,255,0.1);
        }
        :host(.dark) feezal-sidebar-inspector {
            --feezal-sel-badge-bg:     rgba(2,132,199, 0.15);
            --feezal-sel-badge-color:  #7dd3fc;
            --feezal-sel-badge-border: #0ea5e9;
            /* U46: dark values for the shared paperclip in the canvas-mode popup. */
            --feezal-clippy-bg:     #3a3626;
            --feezal-clippy-fg:     rgba(255,255,255,0.9);
            --feezal-clippy-border: #5a5330;
        }
        /* Same panel color as the #viewdialog/#deletedialog family above */
        :host(.dark) feezal-capacitor-dialog,
        :host(.dark) feezal-export-dialog,
        :host(.dark) feezal-generate-dialog {
            --sl-panel-background-color: #2e2e2e;
            --sl-panel-border-color: #3d3d3d;
            --feezal-btn-hover-border: #666;
            --feezal-btn-hover-color: rgba(255,255,255,0.95);
        }
        :host(.dark) feezal-generate-dialog {
            --feezal-tile-border: #3d3d3d;
            --feezal-tile-bg:     #262626;
            --feezal-tile-hover:  #333a44;
            --feezal-badge-bg:    #3a3a3a;
            --feezal-badge-fg:    rgba(255,255,255,0.7);
            --feezal-dialog-bg:   #2e2e2e;
            /* Shoelace only themes the resting input bg via the big block above;
               set the focus/hover bg too so the filter field stays dark. */
            --sl-input-background-color-focus: #252525;
            --sl-input-background-color-hover: #252525;
        }

        /* ── Source view (N15) ──────────────────────────────────────────── */
        #source-panel {
            flex: 1; min-height: 0;
            display: flex; flex-direction: column;
        }
        /* ── Source view (N15) ──────────────────────────────────────────── */
        #source-panel {
            flex: 1; min-height: 0;
            display: flex; flex-direction: column;
        }
        #source-editor { flex: 1; min-height: 0; position: relative; overflow: hidden; }
        .source-mode-btn { flex: 0 0 auto; }
        .source-mode-btn.active { background: rgba(2,132,199,0.18) !important; color: var(--sl-color-primary-600, #0284c7) !important; }

        /* ── Monaco source-mode shortcuts modal ───────────────────────── */
        .source-help-overlay {
            position: fixed; inset: 0; z-index: 10000;
            background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
        }
        .source-help-modal {
            position: relative;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
            border-radius: 8px; padding: 22px 26px;
            min-width: 360px; max-width: 90vw; max-height: 80vh; overflow: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        }
        .source-help-modal h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
        .source-help-modal table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .source-help-modal td { padding: 5px 4px; }
        .source-help-modal td:first-child { font-family: monospace; white-space: nowrap; min-width: 150px; opacity: 0.72; }
        .source-help-modal tr:not(:last-child) td { border-bottom: 1px solid var(--feezal-border, #eee); }
        .source-help-close {
            position: absolute; top: 10px; right: 12px;
            background: none; border: none; cursor: pointer;
            font-size: 20px; line-height: 1; color: var(--feezal-color, #888);
        }
        .source-help-close:hover { color: #c00; }
        /* U46: opt-in paperclip assistant — shared markup + styles (feezal-clippy.js)
           so the canvas-mode and source-mode popups can never drift. Dark values
           are piped through --feezal-clippy-* below. */
        ${clippyStyles}
        :host(.dark) {
            --feezal-clippy-bg: #3a3626;
            --feezal-clippy-fg: rgba(255,255,255,0.9);
            --feezal-clippy-border: #5a5330;
        }
        :host(.dark) .source-help-modal {
            background: #2e2e2e; color: rgba(255,255,255,0.88);
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        }
        :host(.dark) .source-help-modal tr:not(:last-child) td { border-bottom-color: #3d3d3d; }
        :host(.dark) .source-help-close { color: rgba(255,255,255,0.6); }
        :host(.dark) .source-help-close:hover { color: #ff6b6b; }

        /* Source-mode syntax-error badge in the top bar */
        .source-error-badge {
            display: inline-flex; align-items: center; gap: 4px;
            align-self: center; margin: 0 8px;
            background: #c62828; color: #fff;
            font-size: 12px; font-weight: 600;
            padding: 3px 9px; border-radius: 4px;
            white-space: nowrap; cursor: default;
        }
        .source-error-badge .material-icons { font-size: 15px; }
    `;

    constructor() {
        super();
        // Persistent state from localStorage
        this.paletteVisible  = JSON.parse(localStorage.getItem('paletteVisible')  ?? 'true');
        this.sidebarVisible  = JSON.parse(localStorage.getItem('sidebarVisible')  ?? 'true');
        this.gridVisible     = JSON.parse(localStorage.getItem('gridVisible')     ?? 'false');
        this.gridSize        = JSON.parse(localStorage.getItem('gridSize')        ?? '24');
        this.selectionColor  = localStorage.getItem('selectionColor')            ?? '#0284c7';
        this.gridColor       = localStorage.getItem('gridColor')                 ?? '#cccccc';
        this.snapping        = localStorage.getItem('snapping')                  ?? 'elements';
        this.preventEditorMqtt = JSON.parse(localStorage.getItem('preventEditorMqtt') ?? 'true');
        this.sidebar         = localStorage.getItem('sidebar')                    ?? 'inspector';
        if (this.sidebar === 'palette') this.sidebar = 'inspector';   // removed tab → fall back
        if (this.sidebar === 'clients') this.sidebar = 'viewer';      // clients moved into Site Settings

        this.views            = [];
        this.changes          = false;
        this.deploying        = false;
        this.viewSelected     = true;
        this._navView         = '';
        this._history         = [];
        this._clipboardTpl    = document.createElement('template');
        this.editViewName     = '';
        this._canScrollLeft   = false;
        this._canScrollRight  = false;
        this._searchOpen      = false;
        this._searchQuery     = '';
        this._viewCtx         = null;
        this._actionMenuPos   = null;
        this._sidebarWidth    = parseInt(localStorage.getItem('sidebarWidth') ?? '350', 10);
        // Editor colour scheme: saved override, else dark by default (new users).
        this._themeMode = localStorage.getItem('themeMode') ?? 'dark';
        this._darkMode = this._computeDark(this._themeMode);
        // Source view (N15)
        this._sourceMode  = false;
        this._sourceError = null;
        this._sourceHelpOpen = false;
        this._sourceEditor = null;       // Monaco editor instance for source view
        this._monaco       = null;       // Monaco namespace (cached while in source mode)
        // View folders (U8) — editor-only tree stored in viewer.json (viewer.folders).
        this._folders       = [];        // ordered tree: {id,name,children:[]} | {view:name}
        this._collapsed     = new Set(); // folder ids that are collapsed (default expanded)
        this._dropHint      = null;      // {kind:'view'|'folder'|'bar', id, position}
        // U55: hold-to-drag — tabs render draggable=false until the pointer has
        // been held down ~300 ms on the same tab (a sloppy click stays a click;
        // the browser's native drag threshold is a few px with no delay option).
        this._dragArmed     = null;      // armed tab key (view name / folder id)
        this.__dragArmTimer = null;      // non-reactive setTimeout handle
        this._editFolderId  = null;      // folder being renamed
        this._foldersSig    = '';        // last reconciled signature to avoid update loops
        this._folderMenu    = null;      // open folder popup: {id, x, y}
        // AI assistant (U9)
        this._aiConfigured = false;
        this._aiPanelOpen  = localStorage.getItem('aiPanelOpen') === '1';
        this._aiPanelWidth = Number(localStorage.getItem('aiPanelWidth')) || 380;
        this._onAiConfigChanged = () => this._loadAiConfig();
    }

    // Compatibility accessor for external code (feezal.app.nav.view)
    get nav() {
        return {view: this._navView};
    }

    get history() { return this._history; }

    _syncDarkModeRoot() {
        // Shoelace dropdown panels are positioned inside the component's shadow DOM
        // but their CSS vars are resolved from :root (light.css). Override them here
        // so the open panel and option items render correctly in dark mode.
        const el = document.documentElement;
        if (this._darkMode) {
            el.style.setProperty('--sl-panel-background-color', '#252525');
            el.style.setProperty('--sl-panel-border-color', '#3d3d3d');
            el.style.setProperty('--sl-color-neutral-100', '#2a2a2a');
            el.style.setProperty('--sl-color-neutral-700', 'rgba(255,255,255,0.75)');
            el.style.setProperty('--sl-color-neutral-1000', 'rgba(255,255,255,0.95)');
        } else {
            ['--sl-panel-background-color', '--sl-panel-border-color',
             '--sl-color-neutral-100', '--sl-color-neutral-700', '--sl-color-neutral-1000'
            ].forEach(v => el.style.removeProperty(v));
        }
        this._syncScrollbarStyle();
    }

    _syncScrollbarStyle() {
        // Inject / update a global stylesheet for custom thin scrollbars.
        // Uses concrete color values (not CSS vars) so the values are reliable
        // across shadow DOM boundaries for ::-webkit-scrollbar pseudo-elements.
        // feezal-site / feezal-view and their descendants are explicitly reverted
        // to the browser's native scrollbars to avoid white-rectangle artefacts
        // when the custom width rule doesn't apply but background rules do.
        let s = document.getElementById('feezal-scrollbar-style');
        if (!s) {
            s = document.createElement('style');
            s.id = 'feezal-scrollbar-style';
            document.head.append(s);
        }
        const thumb      = this._darkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
        const thumbHover = this._darkMode ? 'rgba(255,255,255,0.48)' : 'rgba(0,0,0,0.48)';
        s.textContent = `
            /* ── Custom thin scrollbars for editor UI ─────────────────────── */
            html { scrollbar-width: thin; scrollbar-color: ${thumb} transparent; }
            *::-webkit-scrollbar             { width: 6px; height: 6px; }
            *::-webkit-scrollbar-track       { background: transparent; border-radius: 3px; }
            *::-webkit-scrollbar-thumb       { background: ${thumb}; border-radius: 3px; }
            *::-webkit-scrollbar-thumb:hover { background: ${thumbHover}; }
            *::-webkit-scrollbar-corner      { background: transparent; }

            /* ── feezal-site canvas scrollbars ────────────────────────────── */
            /* Type selector (0,0,1) beats * (0,0,0): overrides the transparent  */
            /* track above. --feezal-canvas-bg is set as inline style on the     */
            /* element so var() resolves correctly for these pseudo-element rules.*/
            feezal-site::-webkit-scrollbar             { width: 8px; height: 8px; }
            feezal-site::-webkit-scrollbar-track       { background: var(--feezal-canvas-bg, #888); }
            feezal-site::-webkit-scrollbar-thumb       { background: ${thumb}; border-radius: 4px; }
            feezal-site::-webkit-scrollbar-thumb:hover { background: ${thumbHover}; }
            feezal-site::-webkit-scrollbar-corner      { background: var(--feezal-canvas-bg, #888); }

            /* B18: the editor gives feezal-site tabindex=1 and focuses it
               programmatically (keyboard shortcuts / element selection). The
               browser's default focus ring then draws along the canvas edges —
               visible as a white line between the tab bar and the canvas,
               most obviously after deleting an element (site keeps focus while
               nothing is selected). The focus is a programmatic shortcut
               target, not tab-navigation — suppress the ring. */
            feezal-site:focus, feezal-site:focus-visible { outline: none; }
        `;
    }

    updated(changed) {
        // Apply dark-mode class to host for CSS :host(.dark) theming
        this.classList.toggle('dark', this._darkMode);
        if (changed.has('_darkMode')) {
            this._syncDarkModeRoot();
        }
        if (changed.has('selectionColor')) {
            this._syncSelectionColor();
        }
        if (changed.has('_darkMode') && this._sourceEditor) {
            this._sourceEditor.updateOptions({theme: this._darkMode ? 'vs-dark' : 'vs'});
            syncMonacoStyles(this.shadowRoot);
        }
        // Keep the folder tree reconciled with the current set of views.
        if (changed.has('views')) {
            this._syncFolders();
        }
        // Scroll the active view tab into view and refresh arrow button state.
        if ((changed.has('_navView') || changed.has('views') || changed.has('_folders')) && this._navView) {
            requestAnimationFrame(() => {
                const activeTab = this.shadowRoot.querySelector(`.ftab[data-view="${this._navView}"]`);
                if (activeTab) {
                    activeTab.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
                }
                this._updateScrollState();
            });
        }

        // Set up nav scroll listener once (Shoelace renders asynchronously).
        this._setupNavScrollListener();
    }

    render() {
        const hasHistory = this._history.length > 1;

        return html`
            <div id="menu">
                <div id="menu-left" style="${this.paletteVisible ? '' : 'display:none'}">
                    Feezal
                    ${this._version ? html`<span style="font-size:0.6em;opacity:0.45;font-style:normal;font-weight:400;margin-left:6px">
                        v${this._version}
                    </span>` : ''}
                </div>
                <div id="menu-center">
                    <button class="icon-btn" title="${this.paletteVisible ? 'Hide palette' : 'Show palette'}"
                        style="${this._sourceMode ? 'visibility:hidden' : ''}"
                        @click="${this._collapsePalette}">
                        <span class="material-icons">${this.paletteVisible ? 'chevron_left' : 'chevron_right'}</span>
                    </button>

                    <div id="toolbar">
                        <button class="icon-btn" title="Copy (Ctrl+C)" ?disabled="${this.viewSelected && !this._sourceMode}" @click="${this._clickCopy}"><span class="material-icons">content_copy</span></button>
                        <button class="icon-btn" title="Paste (Ctrl+V)" @click="${this._clickPaste}"><span class="material-icons">content_paste</span></button>
                        <button class="icon-btn" title="Cut (Ctrl+X)" ?disabled="${this.viewSelected && !this._sourceMode}" @click="${this._clickCut}"><span class="material-icons">content_cut</span></button>
                        <button class="icon-btn" title="Delete (Del)" ?disabled="${this.viewSelected && !this._sourceMode}" @click="${this._delete}"><span class="material-icons">delete</span></button>
                        <button class="icon-btn" title="Undo (Ctrl+Z)" ?disabled="${!hasHistory && !this._sourceMode}" @click="${this._undo}"><span class="material-icons">undo</span></button>
                        <button class="icon-btn" style="margin-left:20px;font-size:15px;font-weight:600" title="Keyboard shortcuts (Ctrl+I)" @click="${this._openShortcuts}">?</button>
                    </div>

                    <button class="icon-btn generate-btn" title="Generate elements from discovery"
                        style="${this._sourceMode ? 'visibility:hidden' : ''}"
                        @click="${this._openGenerate}">
                        <span class="material-icons">auto_awesome</span>
                    </button>

                    <button class="icon-btn source-mode-btn ${this._sourceMode ? 'active' : ''}"
                        title="${this._sourceMode ? 'Design mode (Ctrl+Shift+U)' : 'Source mode (Ctrl+Shift+U)'}"
                        ?disabled="${this._sourceMode && !!this._sourceError}"
                        @click="${this._toggleSourceMode}">
                        <span class="material-icons">code</span>
                    </button>

                    ${this._sourceMode && this._sourceError ? html`
                        <span class="source-error-badge" title="${this._sourceError}">
                            <span class="material-icons">error</span> Syntax error
                        </span>` : ''}

                    <feezal-site-manager .darkMode="${this._darkMode}"></feezal-site-manager>
                    <div id="btn-deploy-wrap">
                        <button id="btn-deploy-main"
                            class="${this.changes ? 'has-changes' : ''}"
                            ?disabled="${this.deploying || (this._sourceMode && !!this._sourceError)}"
                            @click="${this._deploy}">
                            ${this.deploying
                                ? html`<div class="spinner"></div>`
                                : html`<span class="material-icons">upload_file</span>`}
                            Deploy
                        </button>
                        <button id="btn-deploy-caret"
                            class="${this.changes ? 'has-changes' : ''}"
                            ?disabled="${this.deploying || (this._sourceMode && !!this._sourceError)}"
                            @click="${this._toggleActionMenu}">
                            <span class="material-icons">arrow_drop_down</span>
                        </button>
                    </div>
                    ${this._actionMenuPos ? html`
                        <div class="action-menu" style="left:${this._actionMenuPos.x}px;top:${this._actionMenuPos.y}px">
                            <div class="action-menu-item" @click="${() => { this._actionMenuPos = null; this._deploy(); }}">
                                <span class="material-icons">upload_file</span> Save
                            </div>
                            <div class="action-menu-sep"></div>
                            <div class="action-menu-item" @click="${() => { this._actionMenuPos = null; this._view(); }}">
                                <span class="material-icons">tv</span> View
                            </div>
                            <div class="action-menu-item" @click="${() => { this._actionMenuPos = null; this._export(); }}">
                                <span class="material-icons">download</span> Export
                            </div>
                            <div class="action-menu-item" @click="${() => { this._actionMenuPos = null; this._openCapacitorDialog(); }}">
                                <span class="material-icons">smartphone</span> Mobile app…
                            </div>
                        </div>
                    ` : ''}
                    <feezal-capacitor-dialog></feezal-capacitor-dialog>
                    <feezal-export-dialog></feezal-export-dialog>
                    <feezal-generate-dialog></feezal-generate-dialog>

                    ${this._aiConfigured && this._sourceMode && !this._aiPanelOpen ? html`
                        <button class="icon-btn" title="AI assistant"
                            @click="${() => this._setAiPanelOpen(true)}">
                            <span class="material-icons">android</span>
                        </button>` : ''}

                    <button class="icon-btn" title="${this.sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}"
                        style="${this._sourceMode ? 'visibility:hidden' : ''}"
                        @click="${this._collapseSidebar}">
                        <span class="material-icons">${this.sidebarVisible ? 'chevron_right' : 'chevron_left'}</span>
                    </button>
                </div>

                <div id="menu-right" style="${this.sidebarVisible ? `flex: 0 0 ${this._sidebarWidth}px` : 'display:none'}">
                    ${this._sourceMode ? '' : html`
                        <button class="icon-btn ${this.sidebar === 'inspector' ? 'active' : ''}" title="Inspector" @click="${() => this._setSidebar('inspector')}"><span class="material-icons">tune</span></button>
                        <button class="icon-btn ${this.sidebar === 'themes' ? 'active' : ''}" title="Theme" @click="${() => this._setSidebar('themes')}"><span class="material-icons">palette</span></button>
                        <button class="icon-btn ${this.sidebar === 'viewer' ? 'active' : ''}" title="Site Settings" @click="${() => this._setSidebar('viewer')}"><span class="material-icons">cast</span></button>
                        <button class="icon-btn ${this.sidebar === 'assets' ? 'active' : ''}" title="Assets" @click="${() => this._setSidebar('assets')}"><span class="material-icons">perm_media</span></button>
                        <button class="icon-btn ${this.sidebar === 'packages' ? 'active' : ''}" title="Packages" @click="${() => this._setSidebar('packages')}"><span class="material-icons">widgets</span></button>
                        <button class="icon-btn ${this.sidebar === 'history' ? 'active' : ''}" title="Version history" @click="${() => this._setSidebar('history')}"><span class="material-icons">history</span></button>
                        <button class="icon-btn ${this.sidebar === 'editor' ? 'active' : ''}" title="Editor Settings" @click="${() => this._setSidebar('editor')}"><span class="material-icons">build</span></button>
                        ${this._aiConfigured && !this._aiPanelOpen ? html`
                            <button class="icon-btn" style="margin-left:auto" title="AI assistant"
                                @click="${() => this._setAiPanelOpen(true)}">
                                <span class="material-icons">android</span>
                            </button>` : ''}
                    `}
                </div>

                ${this._aiConfigured && this._aiPanelOpen
                    ? html`<div id="menu-ai-space" style="flex:0 0 ${this._aiPanelWidth}px">
                        <button class="icon-btn active" title="AI assistant"
                            @click="${() => this._setAiPanelOpen(false)}">
                            <span class="material-icons">android</span>
                        </button>
                    </div>` : ''}
            </div>

            <div id="container">
                <feezal-palette id="palette" style="${(this.paletteVisible && !this._sourceMode) ? '' : 'display:none'}"></feezal-palette>

                <div id="container-view">
                    <div id="container-view-menu" style="${this._sourceMode ? 'display:none' : ''}">
                        <!-- Scroll left — hidden while search is open -->
                        <button class="tab-nav-btn" title="Scroll left"
                            ?hidden="${this._searchOpen}"
                            ?disabled="${!this._canScrollLeft}"
                            @click="${this._scrollTabsLeft}">‹</button>

                        <!-- Tab group — hidden while search is open -->
                        <div id="view-tabs"
                            class="${this._dropHint?.kind === 'bar' ? 'drop-end' : ''}"
                            ?hidden="${this._searchOpen}"
                            @wheel="${this._onTabWheel}"
                            @dragover="${this._onBarDragOver}"
                            @drop="${this._onBarDrop}">
                            ${this._tabItems().map(item => item.type === 'folder'
                                ? html`
                                    <div class="ftab folder ${this._folderMenu?.id === item.id ? 'open' : ''} ${item.containsActive ? 'contains-active' : ''} ${this._dropClass(item)} ${this._dragArmed === item.id ? 'drag-armed' : ''}"
                                        draggable="true"
                                        title="${item.name}"
                                        @pointerdown="${e => this._armDrag(e, item.id)}"
                                        @pointerup="${this._disarmDrag}"
                                        @pointerleave="${this._disarmDrag}"
                                        @pointercancel="${this._disarmDrag}"
                                        @click="${e => this._openFolderMenu(e, item.id)}"
                                        @dblclick="${() => this._beginRenameFolder(item.id)}"
                                        @contextmenu="${e => { e.preventDefault(); e.stopPropagation(); this._showFolderCtxMenu(e.clientX, e.clientY, item.id); }}"
                                        @dragstart="${e => this._onItemDragStart(e, {kind: 'folder', id: item.id})}"
                                        @dragover="${e => this._onItemDragOver(e, {kind: 'folder', id: item.id})}"
                                        @drop="${e => this._onItemDrop(e, {kind: 'folder', id: item.id})}"
                                        @dragend="${this._onItemDragEnd}">
                                        <span class="material-icons ftab-icon">folder</span>
                                        ${item.containsActive ? html`
                                            <span class="ftab-sep">›</span>
                                            <span class="ftab-active-view">${this._navView}</span>` : html`<span class="ftab-label">${item.name}</span>`}
                                        ${item.count > 0 ? html`<span class="material-icons ftab-caret">arrow_drop_down</span>` : ''}
                                    </div>`
                                : html`
                                    <div class="ftab view ${this._navView === item.name ? 'active' : ''} ${this._dropClass(item)} ${this._dragArmed === item.name ? 'drag-armed' : ''}"
                                        data-view="${item.name}"
                                        draggable="true"
                                        @pointerdown="${e => this._armDrag(e, item.name)}"
                                        @pointerup="${this._disarmDrag}"
                                        @pointerleave="${this._disarmDrag}"
                                        @pointercancel="${this._disarmDrag}"
                                        @click="${() => this._tabClick(item.name)}"
                                        @dblclick="${e => this._editView(e, item.name)}"
                                        @contextmenu="${e => { e.preventDefault(); e.stopPropagation(); this._showViewCtxMenu(e.clientX, e.clientY, item.name); }}"
                                        @dragstart="${e => this._onItemDragStart(e, {kind: 'view', name: item.name})}"
                                        @dragover="${e => this._onItemDragOver(e, {kind: 'view', name: item.name})}"
                                        @drop="${e => this._onItemDrop(e, {kind: 'view', name: item.name})}"
                                        @dragend="${this._onItemDragEnd}">
                                        <span class="ftab-label">${item.name}</span>
                                    </div>`)}
                        </div>

                        <!-- Scroll right — hidden while search is open -->
                        <button class="tab-nav-btn" title="Scroll right"
                            ?hidden="${this._searchOpen}"
                            ?disabled="${!this._canScrollRight}"
                            @click="${this._scrollTabsRight}">›</button>

                        <!-- Inline search field — shown when search is open -->
                        ${this._searchOpen ? html`
                            <div id="view-search">
                                <div id="view-search-bar">
                                    <input id="view-search-input" type="text"
                                        placeholder="Search views…"
                                        .value="${this._searchQuery}"
                                        @input="${this._onSearchInput}"
                                        @keydown="${this._onSearchKeydown}">
                                </div>
                                <div id="view-search-results">
                                    ${this._filteredViews().length === 0
                                        ? html`<div class="search-result-empty">No views match</div>`
                                        : this._filteredViews().map(v => html`
                                            <div class="search-result"
                                                @click="${() => this._activateSearchResult(v.name)}">
                                                ${v.name}
                                            </div>`)}
                                </div>
                            </div>` : html``}

                        <!-- Search toggle (always visible) -->
                        <button id="btn-view-search"
                            title="${this._searchOpen ? 'Close search' : 'Search views'}"
                            @click="${this._toggleSearch}">
                            <span class="material-icons">${this._searchOpen ? 'close' : 'search'}</span>
                        </button>

                        <div id="add-view">
                            <button class="icon-btn dark" title="New folder" @click="${this._createFolder}">
                                <span class="material-icons">create_new_folder</span>
                            </button>
                            <button class="icon-btn dark" title="Add view" @click="${this._addView}">
                                <span class="material-icons">note_add</span>
                            </button>
                        </div>
                    </div>

                    ${this._componentEdit ? html`
                        <div id="component-edit-banner">
                            <span class="material-icons">widgets</span>
                            <span>Editing component&nbsp;<strong>${this._componentEdit.name}</strong>&nbsp;— changes apply to all instances</span>
                            <span style="flex:1"></span>
                            <sl-button size="small" @click="${this._openComponentMapping}">Attribute mapping…</sl-button>
                            <sl-button size="small" @click="${this._cancelComponentEdit}">Cancel</sl-button>
                            <sl-button size="small" variant="primary" @click="${this._commitComponentEdit}">Done</sl-button>
                        </div>
                    ` : ''}

                    <slot></slot>

                    ${this._sourceMode ? html`
                        <div id="source-panel">
                            <div id="source-editor"></div>
                        </div>
                    ` : ''}

                    <div id="grid"></div>
                    <div id="hsnap1"></div>
                    <div id="vsnap1"></div>
                    <div id="hsnap2"></div>
                    <div id="vsnap2"></div>
                </div>

                <div id="sidebar-resize"
                    style="${(this.sidebarVisible && !this._sourceMode) ? '' : 'display:none'}"
                    @mousedown="${this._onResizeStart}"></div>
                <div id="sidebar-panels" style="${(this.sidebarVisible && !this._sourceMode) ? `flex-basis: ${this._sidebarWidth}px` : 'display:none'}">
                    <feezal-sidebar-inspector class="sidebar-panel"
                        ?hidden="${this.sidebar !== 'inspector'}"
                        .view="${this._navView}"
                        .snapping="${this.snapping}"
                        .gridSize="${this.gridSize}"
                        .gridVisible="${this.gridVisible}"
                        .gridColor="${this.gridColor}"
                        @view-selected-changed="${e => { this.viewSelected = e.detail.value; }}"
                        @delete-view="${e => this._confirmDeleteView(e.detail.name)}">
                    </feezal-sidebar-inspector>
                    <feezal-sidebar-assets class="sidebar-panel" ?hidden="${this.sidebar !== 'assets'}"></feezal-sidebar-assets>
                    <feezal-sidebar-themes class="sidebar-panel" ?hidden="${this.sidebar !== 'themes'}" .viewSelected="${this.viewSelected}"></feezal-sidebar-themes>
                    <feezal-sidebar-packages class="sidebar-panel" ?hidden="${this.sidebar !== 'packages'}"></feezal-sidebar-packages>
                    <feezal-sidebar-viewer class="sidebar-panel" ?hidden="${this.sidebar !== 'viewer'}"></feezal-sidebar-viewer>
                    <feezal-sidebar-editor class="sidebar-panel"
                        ?hidden="${this.sidebar !== 'editor'}"
                        .themeMode="${this._themeMode}"
                        .selectionColor="${this.selectionColor}"
                        .gridColor="${this.gridColor}"
                        .gridSize="${this.gridSize}"
                        .gridVisible="${this.gridVisible}"
                        .snapping="${this.snapping}"
                        .preventEditorMqtt="${this.preventEditorMqtt}"
                        @theme-mode-changed="${e => this._setThemeMode(e.detail.value)}"
                        @selection-color-changed="${e => { this.selectionColor = e.detail.value; localStorage.setItem('selectionColor', this.selectionColor); }}"
                        @grid-color-changed="${e => { this.gridColor = e.detail.value; localStorage.setItem('gridColor', this.gridColor); }}"
                        @grid-size-changed="${e => { this.gridSize = e.detail.value; localStorage.setItem('gridSize', this.gridSize); }}"
                        @grid-visible-changed="${e => { this.gridVisible = e.detail.value; localStorage.setItem('gridVisible', this.gridVisible); }}"
                        @snapping-changed="${e => { this.snapping = e.detail.value; localStorage.setItem('snapping', this.snapping); }}"
                        @prevent-editor-mqtt-changed="${e => { this.preventEditorMqtt = e.detail.value; localStorage.setItem('preventEditorMqtt', this.preventEditorMqtt); }}">
                    </feezal-sidebar-editor>
                    <feezal-sidebar-history class="sidebar-panel"
                        ?hidden="${this.sidebar !== 'history'}">
                    </feezal-sidebar-history>
                </div>

                ${this._aiConfigured && this._aiPanelOpen ? html`
                    <div id="ai-panel" style="width:${this._aiPanelWidth}px">
                        <div id="ai-resize" @mousedown="${this._onAiResizeStart}"></div>
                        <feezal-ai-chat
                            .editorMode="${this._sourceMode ? 'source' : 'design'}"
                            .viewNames="${this._sourceMode ? this._aiViewNames() : []}"
                            .buildSourceContext="${t => this._aiBuildSourceContext(t)}"
                            .onApply="${(h, t, nv) => this._applyAi(h, t, nv)}"></feezal-ai-chat>
                    </div>` : ''}
            </div>

            <sl-dialog id="viewdialog" label="Rename View"
                @sl-initial-focus="${e => { e.preventDefault(); this.shadowRoot.querySelector('#viewnameinput')?.focus(); }}">
                <sl-input id="viewnameinput" label="View name"
                    @sl-input="${this._checkViewName}"
                    @keydown="${e => { if (e.key === 'Enter') this._renameView(); }}">
                </sl-input>
                <div class="dialog-error" id="viewnameerror" style="color:#c62828;font-size:12px;min-height:16px;margin-top:4px"></div>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#viewdialog').hide()}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._renameView}">Rename</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="deletedialog" label="Delete View">
                <p id="deleteconfirmtext" style="margin:0"></p>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#deletedialog').hide()}">Cancel</sl-button>
                    <sl-button variant="danger" @click="${this._deleteViewConfirmed}">Delete</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="folderdialog" label="Rename Folder"
                @sl-initial-focus="${e => { e.preventDefault(); this.shadowRoot.querySelector('#foldernameinput')?.focus(); }}">
                <sl-input id="foldernameinput" label="Folder name"
                    @sl-input="${this._checkFolderName}"
                    @keydown="${e => { if (e.key === 'Enter') this._renameFolder(); }}">
                </sl-input>
                <div class="dialog-error" id="foldernameerror" style="color:#c62828;font-size:12px;min-height:16px;margin-top:4px"></div>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#folderdialog').hide()}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._renameFolder}">Rename</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="componentdialog" label="Create component" style="--width: 660px">
                <sl-input id="componentnameinput" label="Component name"
                    help-text="lowercase letters, digits and hyphens"
                    @sl-input="${() => { if (this._componentDialog?.error) this._componentDialog = {...this._componentDialog, error: ''}; }}"
                    @keydown="${e => { if (e.key === 'Enter') this._createComponentConfirmed(); }}">
                </sl-input>
                <div class="dialog-error" style="color:#c62828;font-size:12px;min-height:16px;margin-top:4px">${this._componentDialog?.error ?? ''}</div>
                ${this._componentDialog?.rows?.length ? html`
                    <table class="component-param-table">
                        <tr><th>Element</th><th>Attribute</th><th>Value</th><th>Parameterize as…</th></tr>
                        ${this._componentDialog.rows.map(row => html`
                            <tr>
                                <td>${row.tag.replace(/^feezal-element-/, '')}</td>
                                <td>${row.attr}</td>
                                <td class="component-param-value" title="${row.value}">${row.value}</td>
                                <td><input .value="${row.param}" placeholder="—" autocomplete="off"
                                    @input="${e => { row.param = e.target.value; }}"></td>
                            </tr>
                        `)}
                    </table>
                ` : html`<p style="font-size:12px;opacity:0.7">The selected elements carry no attributes to parameterize — the component will stamp them verbatim.</p>`}
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#componentdialog').hide()}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._createComponentConfirmed}">Create</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="componentmappingdialog" label="Attribute mapping" style="--width: 660px">
                <p style="font-size:12px;opacity:0.75;margin:0 0 8px">
                    Map instance attributes onto inner-element attributes: give an attribute a
                    parameter name to expose it on every instance (its current value becomes the
                    default); clear the name to bake the default back in as a fixed value.
                </p>
                <div class="dialog-error" style="color:#c62828;font-size:12px;min-height:16px">${this._componentMapping?.error ?? ''}</div>
                ${this._componentMapping?.rows?.length ? html`
                    <table class="component-param-table">
                        <tr><th>Element</th><th>Attribute</th><th>Value</th><th>Parameterize as…</th></tr>
                        ${this._componentMapping.rows.map(row => html`
                            <tr>
                                <td>${row.tag.replace(/^feezal-element-/, '')}</td>
                                <td>${row.attr}</td>
                                <td class="component-param-value" title="${row.baseValue}">${row.baseValue}</td>
                                <td><input .value="${row.param}" placeholder="—" autocomplete="off"
                                    @input="${e => { row.param = e.target.value; }}"></td>
                            </tr>
                        `)}
                    </table>
                ` : html`<p style="font-size:12px;opacity:0.7">The component's elements carry no mappable attributes.</p>`}
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#componentmappingdialog').hide()}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._applyComponentMapping}">Apply</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="componentrenamedialog" label="Rename Component"
                @sl-initial-focus="${e => { e.preventDefault(); this.shadowRoot.querySelector('#componentrenameinput')?.focus(); }}">
                <sl-input id="componentrenameinput" label="Component name"
                    @keydown="${e => { if (e.key === 'Enter') this._componentRenameConfirmed(); }}">
                </sl-input>
                <div class="dialog-error" id="componentrenameerror" style="color:#c62828;font-size:12px;min-height:16px;margin-top:4px"></div>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => this.shadowRoot.querySelector('#componentrenamedialog').hide()}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._componentRenameConfirmed}">Rename</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="componentdeletedialog" label="Delete Component">
                <p style="margin:0">
                    Component <strong>${this._componentDeleteInfo?.name}</strong> is used by
                    <strong>${this._componentDeleteInfo?.count}</strong> instance${this._componentDeleteInfo?.count === 1 ? '' : 's'}
                    on view${this._componentDeleteInfo?.views?.length === 1 ? '' : 's'}
                    <strong>${this._componentDeleteInfo?.views?.join(', ')}</strong>.
                </p>
                <p style="margin:12px 0 0">Detach all instances into plain elements and delete the definition?</p>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end;width:100%">
                    <sl-button @click="${() => { this._componentDeleteInfo = null; this.shadowRoot.querySelector('#componentdeletedialog').hide(); }}">Cancel</sl-button>
                    <sl-button variant="danger" @click="${this._componentDeleteConfirmed}">Detach all &amp; delete</sl-button>
                </div>
            </sl-dialog>

            <sl-dialog id="exporterrordialog" label="Cannot export">
                <p style="margin:0">Static export is not supported with <strong>mqtt://</strong> or <strong>mqtts://</strong> connections. Exported sites connect directly from the browser and require a WebSocket-capable MQTT broker.</p>
                <p style="margin:12px 0 0">Switch the connection protocol to <strong>ws://</strong> or <strong>wss://</strong> in the Connection settings before exporting.</p>
                <div slot="footer" style="display:flex;justify-content:flex-end;width:100%">
                    <sl-button variant="primary" @click="${() => this.shadowRoot.querySelector('#exporterrordialog').hide()}">OK</sl-button>
                </div>
            </sl-dialog>

            ${this._viewCtx ? html`
                <div class="view-ctx-menu"
                    style="left:${this._viewCtx.x}px;top:${this._viewCtx.y}px">
                    ${this._viewCtx.kind === 'folder'
                        ? html`
                            <div class="view-ctx-item"
                                @click="${() => { const id = this._viewCtx.id; this._viewCtx = null; this._beginRenameFolder(id); }}">
                                Rename folder
                            </div>
                            <div class="view-ctx-sep"></div>
                            <div class="view-ctx-item danger"
                                @click="${() => { const id = this._viewCtx.id; this._viewCtx = null; this._deleteFolder(id); }}">
                                Delete folder
                            </div>`
                        : html`
                            <div class="view-ctx-item"
                                @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._editView(null, n); }}">
                                Rename
                            </div>
                            <div class="view-ctx-item"
                                @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._duplicateView(n); }}">
                                Duplicate
                            </div>
                            ${(() => {
                                const folders = this._collectFolders();
                                const parent = this._findViewParent(this._viewCtx.name);
                                if (folders.length === 0 && parent === null) return '';
                                return html`
                                    <div class="view-ctx-sep"></div>
                                    <div class="view-ctx-label">Move to</div>
                                    ${parent !== null ? html`
                                        <div class="view-ctx-item"
                                            @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._moveViewToFolder(n, null); }}">
                                            <span class="material-icons ctx-icon">north</span> Top level
                                        </div>` : ''}
                                    ${folders.filter(f => f.id !== parent).map(f => html`
                                        <div class="view-ctx-item" style="padding-left:${14 + f.depth * 14}px"
                                            @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._moveViewToFolder(n, f.id); }}">
                                            <span class="material-icons ctx-icon">folder</span> ${f.name}
                                        </div>`)}`;
                            })()}
                            <div class="view-ctx-sep"></div>
                            <div class="view-ctx-item danger"
                                @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._confirmDeleteView(n); }}">
                                Delete
                            </div>`}
                </div>
            ` : ''}

            ${this._folderMenu ? (() => {
                const node = this._findFolder(this._folders, this._folderMenu.id);
                if (!node) return '';
                return html`
                    <div class="folder-menu"
                        style="left:${this._folderMenu.x}px;top:${this._folderMenu.y}px">
                        ${this._renderFolderMenu(node)}
                    </div>`;
            })() : ''}

            ${this._sourceHelpOpen ? html`
                <div class="source-help-overlay" @click="${() => this._sourceHelpOpen = false}">
                    <div class="source-help-modal" @click="${e => e.stopPropagation()}">
                        <button class="source-help-close" @click="${() => this._sourceHelpOpen = false}">×</button>
                        <h3>Source Editor Shortcuts</h3>
                        <table>
                            <tr><td>Ctrl+F</td><td>Find</td></tr>
                            <tr><td>Ctrl+H</td><td>Replace</td></tr>
                            <tr><td>Ctrl+Space</td><td>Trigger autocompletion (elements &amp; attributes)</td></tr>
                            <tr><td>Alt+Shift+F</td><td>Format document (views.html style)</td></tr>
                            <tr><td>Ctrl+/</td><td>Toggle line comment</td></tr>
                            <tr><td>Ctrl+Z / Ctrl+Y</td><td>Undo / Redo</td></tr>
                            <tr><td>Ctrl+D</td><td>Select next occurrence of selection</td></tr>
                            <tr><td>Alt+Click</td><td>Add another cursor</td></tr>
                            <tr><td>Alt+↑ / Alt+↓</td><td>Move line up / down</td></tr>
                            <tr><td>Ctrl+[ / Ctrl+]</td><td>Fold / unfold region</td></tr>
                            <tr><td>F1</td><td>Command palette</td></tr>
                            <tr><td>Ctrl+S</td><td>Apply &amp; deploy</td></tr>
                            <tr><td>Ctrl+Shift+U</td><td>Back to design mode</td></tr>
                        </table>
                        ${clippyEnabled() ? clippyMarkup() : ''}
                    </div>
                </div>
            ` : ''}

            <feezal-welcome-tour .editor="${this}"></feezal-welcome-tour>
        `;
    }

    connectedCallback() {
        super.connectedCallback();

        // Apply dark mode root vars immediately so Shoelace dropdowns look correct from the start.
        this._syncDarkModeRoot();

        // Hash-based routing (viewFromHash decodes percent-encoded umlauts, B30)
        this._navView = viewFromHash() || '';
        this._onHashChange = () => {
            this._navView = viewFromHash();
            if (feezal.site) {
                feezal.site.view = this._navView;
            }
        };

        window.addEventListener('hashchange', this._onHashChange);

        // Listen for OS colour-scheme changes (only applies when no manual override)
        this._darkMq = window.matchMedia('(prefers-color-scheme: dark)');
        this._darkMqHandler = e => {
            if (this._themeMode === 'os') this._darkMode = e.matches;
        };
        this._darkMq.addEventListener('change', this._darkMqHandler);

        if (!location.hash) {
            location.hash = '/';
        }

        this._onDocCopy = e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) this._copy(e);
        };
        this._onDocPaste = e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) this._paste(e);
        };
        this._onDocCut = e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) this._cut(e);
        };
        document.addEventListener('copy', this._onDocCopy);
        document.addEventListener('paste', this._onDocPaste);
        document.addEventListener('cut', this._onDocCut);

        // Close the action dropdown when clicking outside it.
        this._onDocPointerActionMenu = e => {
            if (!this._actionMenuPos) return;
            const path = e.composedPath();
            const menu  = this.shadowRoot?.querySelector('.action-menu');
            const caret = this.shadowRoot?.querySelector('#btn-deploy-caret');
            if (menu  && path.includes(menu))  return;
            if (caret && path.includes(caret)) return;
            this._actionMenuPos = null;
        };
        document.addEventListener('pointerdown', this._onDocPointerActionMenu, true);

        // Global keyboard shortcuts for source mode (N15).
        this._onDocKeySourceMode = e => {
            // Ctrl+Shift+U — toggle Design / Source
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                this._toggleSourceMode();
                return;
            }
            // Ctrl+S — save (applies source if in source mode, then deploys)
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
                if (this._sourceMode) {
                    e.preventDefault();
                    this._deploy();
                }
            }
        };
        document.addEventListener('keydown', this._onDocKeySourceMode);

        // Fetch version info (non-blocking — best effort).
        fetch('/api/version')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                this._version = data.version ?? null;
            })
            .catch(() => {});

        // AI assistant (U9) — gate the toolbar button on a configured backend.
        this._loadAiConfig();
        window.addEventListener('feezal:ai-config-changed', this._onAiConfigChanged);

        // U37 — welcome tour: re-launch request from Editor Settings, and
        // persist the seen-flag server-side once the tour ends (Skip or Done)
        // so it survives browser switches AND resets with a fresh data dir.
        this._onStartTour = () => this.startTour();
        this.addEventListener('feezal-start-tour', this._onStartTour);
        this._onTourFinished = () => {
            fetch('/api/editor/prefs', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({tourSeen: true})
            }).catch(() => { /* serverless — localStorage fallback covers it */ });
        };
        this.addEventListener('tour-finished', this._onTourFinished);
        // Auto-start on first use only: seen-flag unset AND the site carries
        // no elements yet (fresh install / blank canvas). Deferred so the
        // server-injected site markup and the first render are settled.
        setTimeout(() => this._maybeAutoStartTour(), 800);
    }

    // ── U37 — welcome tour ────────────────────────────────────────────────────

    startTour() {
        this.shadowRoot.querySelector('feezal-welcome-tour')?.start();
    }

    async _maybeAutoStartTour() {
        if (this._sourceMode) return;
        const views = [...(feezal.views ?? [])];
        if (!views.length || views.some(v => v.children.length > 0)) return;
        // The server-side flag is authoritative when reachable (deleting the
        // data dir re-triggers the tour); localStorage only covers contexts
        // without the prefs API.
        let seen;
        try {
            const r = await fetch('/api/editor/prefs');
            if (r.ok) seen = Boolean((await r.json()).tourSeen);
        } catch { /* server unreachable */ }
        if (seen === undefined) seen = Boolean(localStorage.getItem('feezalTourSeen'));
        if (!seen) this.startTour();
    }

    /** Open/close the AI panel and persist the preference (U29). */
    _setAiPanelOpen(open) {
        this._aiPanelOpen = open;
        localStorage.setItem('aiPanelOpen', open ? '1' : '0');
    }

    async _loadAiConfig() {
        try {
            const cfg = await (await fetch('/api/ai/config')).json();
            this._aiConfigured = Boolean(cfg.configured);
            if (!this._aiConfigured) this._aiPanelOpen = false;
        } catch {
            this._aiConfigured = false;
        }
    }

    /** Route an AI apply to the active editor mode. */
    _applyAi(htmlStr, targetView, newView) {
        if (newView) {
            if (this._sourceMode) this._applyAiNewViewSource(newView, htmlStr);
            else this._applyAiNewView(newView, htmlStr);
            return;
        }
        if (this._sourceMode) this._applyAiSource(htmlStr, targetView);
        else this._applyAiHtml(htmlStr);
    }

    /** A collision-free view name derived from `base`. */
    _uniqueViewName(base) {
        const clean = String(base || '').replace(/["'<>]/g, '').trim().slice(0, 60) || 'view';
        const names = new Set([...feezal.views].map(v => v.getAttribute('name')));
        if (!names.has(clean)) return clean;
        let n = 2;
        while (names.has(`${clean} ${n}`)) n++;
        return `${clean} ${n}`;
    }

    /** Create a new view from AI-proposed HTML (design mode) and navigate to it. */
    _applyAiNewView(name, htmlStr) {
        if (!feezal.site) return;
        const unique = this._uniqueViewName(name);
        const el = document.createElement('feezal-view');
        el.setAttribute('name', unique);
        const currentView = feezal.site.querySelector('feezal-view[name="' + this._navView + '"]');
        el.style.cssText = currentView ? currentView.style.cssText : 'width:100%;height:100%;background:white;';
        el.innerHTML = htmlStr;
        feezal.site.append(el);
        feezal.app.views = [...feezal.views];
        this._setView(unique);                       // make the new view current + visible
        const inspector = this.shadowRoot.querySelector('feezal-sidebar-inspector');
        if (inspector) inspector.restoreViews();     // bind interact.js on the new elements
        this.change();                               // history snapshot + mark dirty
    }

    /** Create a new view by appending a <feezal-view> block into the Monaco source buffer. */
    _applyAiNewViewSource(name, htmlStr) {
        if (!this._sourceEditor) return;
        const model = this._sourceEditor.getModel();
        if (!model) return;
        const existing = this._aiViewNames();
        let unique = String(name || '').replace(/["'<>]/g, '').trim().slice(0, 60) || 'view';
        if (existing.includes(unique)) { let n = 2; while (existing.includes(`${unique} ${n}`)) n++; unique = `${unique} ${n}`; }
        const block = `\n    <feezal-view name="${unique}" style="width:100%;height:100%;">\n${htmlStr}\n    </feezal-view>\n`;
        const text = model.getValue();
        const idx = text.lastIndexOf('</feezal-site>');
        const next = idx >= 0 ? text.slice(0, idx) + block + text.slice(idx) : text + block;
        this._sourceEditor.executeEdits('ai', [{range: model.getFullModelRange(), text: next}]);
        this.change?.(true);
    }

    /** Apply AI-proposed inner HTML to the current view as a single undo step. */
    _applyAiHtml(htmlStr) {
        const view = feezal.view;
        if (!view) return;
        view.innerHTML = htmlStr;
        const inspector = this.shadowRoot.querySelector('feezal-sidebar-inspector');
        if (inspector) inspector.restoreViews();   // rebind interact.js, keep other views
        this.change();                              // one history snapshot + mark dirty
    }

    _escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    /** View names parsed from the Monaco source buffer (source mode). */
    _aiViewNames() {
        const text = this._sourceEditor ? this._sourceEditor.getValue() : '';
        return [...text.matchAll(/<feezal-view\b[^>]*\bname=["']([^"']+)["']/gi)].map(m => m[1]);
    }

    /** Inner HTML of a named view, read from the Monaco source buffer. */
    _aiBuildSourceContext(target) {
        const text = this._sourceEditor ? this._sourceEditor.getValue() : '';
        const re = new RegExp(`<feezal-view\\b[^>]*\\bname=["']${this._escapeRe(target)}["'][^>]*>([\\s\\S]*?)</feezal-view>`, 'i');
        const m = text.match(re);
        return {viewHtml: m ? m[1].trim() : '', viewName: target};
    }

    /** Splice AI-proposed inner HTML into the target view block in the Monaco buffer. */
    _applyAiSource(htmlStr, target) {
        if (!this._sourceEditor || !target) return;
        const model = this._sourceEditor.getModel();
        if (!model) return;
        const text = model.getValue();
        const re = new RegExp(`(<feezal-view\\b[^>]*\\bname=["']${this._escapeRe(target)}["'][^>]*>)([\\s\\S]*?)(</feezal-view>)`, 'i');
        if (!re.test(text)) return;
        const next = text.replace(re, (mm, open, _inner, close) => `${open}\n${htmlStr}\n${close}`);
        // executeEdits preserves Monaco's native undo stack (Ctrl+Z reverts).
        this._sourceEditor.executeEdits('ai', [{range: model.getFullModelRange(), text: next}]);
    }

    _onAiResizeStart(e) {
        e.preventDefault();
        const startX = e.clientX;
        const startW = this._aiPanelWidth;
        const move = ev => {
            // Panel is docked right; dragging left (negative dx) widens it.
            const w = Math.min(640, Math.max(320, startW + (startX - ev.clientX)));
            this._aiPanelWidth = w;
        };
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            localStorage.setItem('aiPanelWidth', this._aiPanelWidth);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this._onHashChange);
        this._darkMq?.removeEventListener('change', this._darkMqHandler);
        document.removeEventListener('copy',  this._onDocCopy);
        document.removeEventListener('paste', this._onDocPaste);
        document.removeEventListener('cut',   this._onDocCut);
        document.removeEventListener('pointerdown', this._onDocPointerActionMenu, true);
        document.removeEventListener('keydown', this._onDocKeySourceMode);
        window.removeEventListener('feezal:ai-config-changed', this._onAiConfigChanged);
        this.removeEventListener('feezal-start-tour', this._onStartTour);
        this.removeEventListener('tour-finished', this._onTourFinished);
        this._sourceEditor?.dispose();
    }

    // -------------------------------------------------------------------
    // Tab bar scroll & view search (U11 / U12)

    _getNavEl() {
        return this.shadowRoot?.querySelector('#view-tabs') ?? null;
    }

    _setupNavScrollListener() {
        if (this._navScrollListenerReady) return;
        const nav = this._getNavEl();
        if (!nav) return;
        nav.addEventListener('scroll', () => this._updateScrollState(), {passive: true});
        // Also update when the nav is resized (e.g., window resize or sidebar toggle).
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => this._updateScrollState()).observe(nav);
        }

        this._navScrollListenerReady = true;
        this._updateScrollState();
    }

    _updateScrollState() {
        const nav = this._getNavEl();
        if (!nav) return;
        const newLeft  = nav.scrollLeft > 0;
        const newRight = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
        if (newLeft !== this._canScrollLeft || newRight !== this._canScrollRight) {
            this._canScrollLeft  = newLeft;
            this._canScrollRight = newRight;
        }
    }

    _scrollTabsLeft() {
        const nav = this._getNavEl();
        if (nav) nav.scrollBy({left: -120, behavior: 'smooth'});
    }

    _scrollTabsRight() {
        const nav = this._getNavEl();
        if (nav) nav.scrollBy({left: 120, behavior: 'smooth'});
    }

    _onTabWheel(e) {
        const nav = this._getNavEl();
        if (!nav) return;
        e.preventDefault();
        nav.scrollBy({left: e.deltaY || e.deltaX, behavior: 'auto'});
        this._updateScrollState();
    }

    _toggleSearch() {
        this._searchOpen = !this._searchOpen;
        if (this._searchOpen) {
            this._searchQuery = '';
            this.updateComplete.then(() => this.shadowRoot.querySelector('#view-search-input')?.focus());
        }
    }

    _onSearchInput(e) {
        this._searchQuery = e.target.value;
    }

    _onSearchKeydown(e) {
        if (e.key === 'Escape') {
            this._searchOpen = false;
        } else if (e.key === 'Enter') {
            const results = this._filteredViews();
            if (results.length > 0) this._activateSearchResult(results[0].name);
        }
    }

    _filteredViews() {
        if (!this._searchQuery) return this.views;
        const q = this._searchQuery.toLowerCase();
        return this.views.filter(v => v.name.toLowerCase().includes(q));
    }

    _activateSearchResult(name) {
        this._searchOpen = false;
        this._searchQuery = '';
        this._setView(name);
        feezal.editor.selectElement(feezal.getView(name));
        requestAnimationFrame(() => {
            const tab = this.shadowRoot.querySelector(`.ftab[data-view="${name}"]`);
            if (tab) tab.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
            this._updateScrollState();
        });
    }

    // -------------------------------------------------------------------
    // Navigation

    _setView(name) {
        this._navView = name;
        location.hash = '/' + name;
        if (name) this._revealView(name);
        if (feezal.site) {
            feezal.site.view = name;
        }
    }

    _tabClick(name) {
        // If in source mode, commit edits to the current view before switching.
        if (this._sourceMode) {
            this._applySource();   // apply (error stays visible but we still navigate)
            this._leaveSourceMode();
        }
        // U32: switching away from the component-edit pseudo-view commits it.
        if (this._componentEdit && name !== this._componentEdit.viewName) {
            this._commitComponentEdit();
        }
        this._setView(name);
        feezal.editor.selectElement(feezal.getView(name));
    }

    // -------------------------------------------------------------------
    // Source view (N15)

    async _toggleSourceMode() {
        if (this._sourceMode) {
            // Apply edits when returning to design mode. If the HTML has a syntax
            // error, stay in source mode so the user can fix it (markers shown).
            if (this._applySource()) this._leaveSourceMode();
        } else {
            await this._enterSourceMode();
        }
    }

    async _enterSourceMode() {
        if (!feezal.site) return;
        // U32: commit an open component edit — the source view must show the
        // persisted document, which never contains the pseudo-view.
        if (this._componentEdit) this._commitComponentEdit();

        // Serialise the WHOLE site (including the <feezal-site> root) so the source
        // view shows the same document that is stored in views.html. Editor-only
        // classes/attributes are stripped via the same _clean() path as deploy.
        const tpl = document.createElement('template');
        tpl.innerHTML = feezal.site.outerHTML;
        const siteEl = tpl.content.querySelector('feezal-site');
        if (siteEl) siteEl.removeAttribute('tabindex');
        this._clean(tpl.content);
        let content = [...tpl.content.childNodes]
            .map(n => (n.outerHTML !== undefined ? n.outerHTML : n.textContent))
            .join('\n');

        // Format with the server's prettyhtml settings so the source matches the
        // saved views.html style exactly (4-space indent, same wrapping).
        content = await this._formatHtml(content);

        this._sourceError = null;
        this._sourceMode  = true;

        // Hide feezal-site (canvas) so the source panel fills the space.
        feezal.site.style.display = 'none';

        await this.updateComplete;

        const wrap = this.shadowRoot.getElementById('source-editor');
        if (!wrap) return;

        const monaco = await loadMonaco();
        this._monaco = monaco;
        this._registerSourceCompletions(monaco);
        const theme  = this._darkMode ? 'vs-dark' : 'vs';

        this._sourceEditor = monaco.editor.create(wrap, {
            value:               content,
            language:            'html',
            theme,
            minimap:             {enabled: false},
            lineNumbers:         'on',
            automaticLayout:     true,
            scrollBeyondLastLine: false,
            fontSize:            13,
            fontFamily:          'Consolas, "Courier New", monospace',
            wordWrap:            'on',
            tabSize:             4
        });

        // Inject Monaco's document.head styles into shadow root (shadow DOM isolation fix).
        syncMonacoStyles(this.shadowRoot);

        // Validate on every change → highlight errors and gate the deploy button.
        // Any edit also marks the site dirty so the Deploy button turns blue.
        this._updateSourceMarkers(monaco);
        this._sourceEditor.onDidChangeModelContent(() => {
            this._updateSourceMarkers(monaco);
            feezal.app.change?.(true);   // mark unsaved (no canvas history entry)
        });

        // U54: open at the current view's line instead of the document top.
        this._revealActiveViewLine();
    }

    /**
     * U54 — scroll the freshly-opened source editor to the ACTIVE view's
     * `<feezal-view>` opening tag and place the cursor there. Attribute order
     * is not assumed: every `<feezal-view …>` tag is scanned and its `name`
     * attribute checked per hit (view names are unique). Not found (fresh
     * unsaved view, malformed doc) → stays at the top silently.
     */
    _revealActiveViewLine() {
        const editor = this._sourceEditor;
        const name = feezal.site?.view;
        if (!editor || !name) return;
        const model = editor.getModel();
        const text = model.getValue();
        const tagRe = /<feezal-view\b[^>]*>/g;
        let m;
        while ((m = tagRe.exec(text)) !== null) {
            const nameMatch = /\bname\s*=\s*"([^"]*)"/.exec(m[0]);
            if (nameMatch && nameMatch[1] === name) {
                const pos = model.getPositionAt(m.index);
                editor.revealLineNearTop(pos.lineNumber);
                editor.setPosition({lineNumber: pos.lineNumber, column: pos.column});
                return;
            }
        }
    }

    _leaveSourceMode() {
        this._sourceMode = false;
        this._sourceError = null;
        this._sourceEditor?.dispose();
        this._sourceEditor = null;
        this._monaco = null;
        if (feezal.site) feezal.site.style.display = '';
    }

    /** Format an HTML string via the server (same prettyhtml config as deploy). */
    async _formatHtml(html) {
        try {
            const res = await fetch('/api/format', {
                method:  'POST',
                headers: {'Content-Type': 'application/json'},
                body:    JSON.stringify({html})
            });
            if (!res.ok) return html;
            const data = await res.json();
            return typeof data.html === 'string' ? data.html.replace(/\s+$/, '') : html;
        } catch {
            return html;
        }
    }

    /**
     * Lightweight HTML tag-balance validation. Returns a list of
     * {index, length, message} errors used to drive Monaco markers.
     */
    _validateSource(text) {
        const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img',
            'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
        const errors = [];
        const stack = [];
        const tagRe = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
        let m;
        while ((m = tagRe.exec(text)) !== null) {
            const [full, closing, rawName, , selfClose] = m;
            const name = rawName.toLowerCase();
            if (closing) {
                if (!stack.length) {
                    errors.push({index: m.index, length: full.length, message: `Unexpected closing tag </${rawName}>`});
                } else if (stack[stack.length - 1].name !== name) {
                    errors.push({index: m.index, length: full.length, message: `Mismatched closing tag </${rawName}> (expected </${stack[stack.length - 1].name}>)`});
                    stack.pop();
                } else {
                    stack.pop();
                }
            } else if (!selfClose && !VOID.has(name)) {
                stack.push({name, index: m.index, length: full.length});
            }
        }
        for (const open of stack) {
            errors.push({index: open.index, length: open.length, message: `Unclosed tag <${open.name}>`});
        }
        return errors;
    }

    /** Recompute Monaco error markers + the _sourceError gate for deploy. */
    _updateSourceMarkers(monaco) {
        if (!this._sourceEditor) return;
        const model = this._sourceEditor.getModel();
        if (!model) return;
        const errs = this._validateSource(model.getValue());
        const markers = errs.map(e => {
            const start = model.getPositionAt(e.index);
            const end   = model.getPositionAt(e.index + e.length);
            return {
                severity:        monaco.MarkerSeverity.Error,
                message:         e.message,
                startLineNumber: start.lineNumber, startColumn: start.column,
                endLineNumber:   end.lineNumber,   endColumn:   end.column
            };
        });
        monaco.editor.setModelMarkers(model, 'feezal', markers);
        this._sourceError = markers.length ? markers[0].message : null;
    }

    /**
     * Register Monaco completions for feezal element tags and their attributes.
     * Registered once on the shared monaco namespace.
     */
    _registerSourceCompletions(monaco) {
        if (FeezalAppEditor._completionsRegistered) return;
        FeezalAppEditor._completionsRegistered = true;

        monaco.languages.registerCompletionItemProvider('html', {
            triggerCharacters: ['<', ' ', '-'],
            provideCompletionItems: (model, position) => {
                const before = model.getValueInRange({
                    startLineNumber: 1, startColumn: 1,
                    endLineNumber: position.lineNumber, endColumn: position.column
                });
                const lastLt = before.lastIndexOf('<');
                const lastGt = before.lastIndexOf('>');
                if (lastLt <= lastGt) return {suggestions: []};

                const fragment = before.slice(lastLt);   // '<' … cursor
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
                    startColumn: word.startColumn, endColumn: word.endColumn
                };

                // Tag name: '<' optionally followed by a partial tag, no whitespace yet.
                if (/^<[a-zA-Z0-9-]*$/.test(fragment)) {
                    return {suggestions: this._elementTagSuggestions(monaco, range)};
                }

                // Inside an open start tag → attribute completion.
                const openTag = /^<([a-zA-Z][\w-]*)/.exec(fragment);
                if (openTag) {
                    const tagName = openTag[1].toLowerCase();
                    const existing = new Set(
                        [...fragment.matchAll(/([a-zA-Z][\w-]*)\s*=/g)].map(a => a[1].toLowerCase())
                    );
                    return {suggestions: this._attributeSuggestions(monaco, tagName, existing, range)};
                }
                return {suggestions: []};
            }
        });
    }

    /** Element tag-name suggestions from the registered feezal element set. */
    _elementTagSuggestions(monaco, range) {
        const tags = (feezal.elements || []).map(pkg => pkg.replace(/^@[^/]+\//, ''));
        return tags.map(tag => {
            const cls = window.customElements.get(tag);
            const palette = (cls && (cls.paletteOptions || cls.feezal || {}).palette) || {};
            return {
                label:         tag,
                kind:          monaco.languages.CompletionItemKind.Class,
                detail:        palette.name ? `${palette.name}${palette.category ? ' · ' + palette.category : ''}` : 'feezal element',
                insertText:    tag,
                range
            };
        });
    }

    /** Attribute suggestions for a given feezal element tag. */
    _attributeSuggestions(monaco, tagName, existing, range) {
        const cls = window.customElements.get(tagName);
        const attrs = (cls && cls.feezal && cls.feezal.attributes) || [];
        return attrs
            .filter(a => a && a.name && !existing.has(a.name.toLowerCase()))
            .map(a => ({
                label:           a.name,
                kind:            monaco.languages.CompletionItemKind.Property,
                detail:          a.type || 'attribute',
                documentation:   a.help || '',
                insertText:      `${a.name}="$0"`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range
            }));
    }

    /**
     * Take Monaco content, validate it, and apply it to the whole site.
     * Sets _sourceError on failure. Returns true on success.
     */
    _applySource() {
        if (!this._sourceEditor) return false;
        const text = this._sourceEditor.getValue();

        if (this._validateSource(text).length) {
            return false;   // keep markers visible; do not apply broken HTML
        }
        this._sourceError = null;

        // The source includes the <feezal-site> root; restoreViews expects its
        // inner HTML. Fall back to the raw text if no wrapper is present.
        let inner = text;
        const tpl = document.createElement('template');
        tpl.innerHTML = text;
        const siteEl = tpl.content.querySelector('feezal-site');
        if (siteEl) inner = siteEl.innerHTML;

        // Replace the whole site contents (all views) and rebind editor state.
        const inspector = this.shadowRoot.querySelector('feezal-sidebar-inspector');
        if (inspector) {
            inspector.restoreViews(inner);
        } else {
            feezal.site.innerHTML = inner;
        }

        // Mark unsaved changes
        feezal.app.change?.();

        return true;
    }

    // -------------------------------------------------------------------
    // Palette & Sidebar toggle

    /** A9 Tier 2a: pre-export dialog for the Capacitor mobile-app project. */
    _openCapacitorDialog() {
        this.shadowRoot.querySelector('feezal-capacitor-dialog').open();
    }

    _collapsePalette() {
        this.paletteVisible = !this.paletteVisible;
        localStorage.setItem('paletteVisible', this.paletteVisible);
    }

    _collapseSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        localStorage.setItem('sidebarVisible', this.sidebarVisible);
    }

    _setSidebar(name) {
        this.sidebar = name;
        localStorage.setItem('sidebar', name);
    }

    _onResizeStart(e) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = this._sidebarWidth;
        const onMove = e => {
            const dx = startX - e.clientX;
            this._sidebarWidth = Math.min(600, Math.max(180, startWidth + dx));
        };
        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            localStorage.setItem('sidebarWidth', String(this._sidebarWidth));
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    // -------------------------------------------------------------------
    // Changes / History

    change(noHistory) {
        this.changes = true;
        feezal.hasChanges = true;
        if (!noHistory) {
            this.addHistory();
        }
    }

    addHistory() {
        if (this._history.length > 4) {
            this._history.shift();
        }

        this._history.push(feezal.site.innerHTML);
        this.requestUpdate();
    }

    _undo() {
        if (this._sourceEditorActive()) {
            this._sourceEditor.focus();
            this._sourceEditor.trigger('keyboard', 'undo', null);
            return;
        }
        if (this._history.length > 1) {
            const inspector = this.shadowRoot.querySelector('feezal-sidebar-inspector');
            // Keep the element selection across the undo: restoreViews()
            // replaces the site's innerHTML (node references die), so capture
            // a (tag, index) identity first and re-match on the restored DOM.
            // A structural undo that removed/shifted the element falls back to
            // the view selection.
            const selection = inspector.captureSelection();
            this._history.pop();
            const prevHtml = this._history[this._history.length - 1];
            this.requestUpdate();
            inspector.restoreViews(prevHtml);
            inspector.restoreSelection(selection);
        }
    }

    _openShortcuts() {
        if (this._sourceMode) {
            this._sourceHelpOpen = true;
            return;
        }
        // B43: the overlay lives inside the inspector panel — the helper
        // reveals the panel (sidebar + inspector tab) before opening, so the
        // ? button works while any other sidebar tab is active.
        this.shadowRoot.querySelector('feezal-sidebar-inspector')?._openShortcutsRevealed();
    }

    // -------------------------------------------------------------------
    // Deploy

    _syncSelectionColor() {
        const hex = this.selectionColor || '#0284c7';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        this.style.setProperty('--feezal-selection-rgb', `${r},${g},${b}`);
    }

    _setThemeMode(mode) {
        this._themeMode = mode;
        this._darkMode = this._computeDark(mode);
        localStorage.setItem('themeMode', mode);
    }

    _computeDark(mode) {
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    _toggleActionMenu(e) {
        if (this._actionMenuPos) { this._actionMenuPos = null; return; }
        const rect = e.currentTarget.getBoundingClientRect();
        this._actionMenuPos = {x: rect.left, y: rect.bottom + 4};
    }

    _view() {
        // B39: keep a trailing slash on the site segment so the opened URL reads
        // /viewer/<Site>/#/<view>, not /viewer/<Site>#/<view> (the default site
        // already ends in a slash — match it for named sites too).
        const base = feezal.siteName === 'default' ? '/viewer/' : '/viewer/' + feezal.siteName + '/';
        const hash = window.location.hash || '';
        window.open(base + hash, 'feezal-' + feezal.siteName);
    }

    _deploy() {
        // U32: an open component edit is committed first, so the pseudo-view is
        // gone and the template carries the edits before serialization.
        if (this._componentEdit) this._commitComponentEdit();
        // In source mode, apply the edited HTML first (and return to design mode).
        // A syntax error blocks the deploy — the button is also disabled in that case.
        if (this._sourceMode) {
            if (!this._applySource()) return;
            this._leaveSourceMode();
        }
        this.deploying = true;
        const deployTpl = document.createElement('template');
        deployTpl.innerHTML = feezal.site.outerHTML;
        deployTpl.content.querySelector('feezal-site').removeAttribute('tabindex');
        this._clean(deployTpl.content);

        const {connection, site, pwa, app, security} = this.shadowRoot.querySelector('feezal-sidebar-viewer');
        const themesSidebar = this.shadowRoot.querySelector('feezal-sidebar-themes');
        const viewer = {
            theme: themesSidebar ? themesSidebar.theme : null,
            themeOverrides: themesSidebar ? themesSidebar.themeOverrides : {},
            // A9: PWA opt-in — drives the viewer's manifest/service-worker
            // routes and the export's PWA bundle.
            pwa: pwa === true,
            // A9 Tier 2a: mobile-app name/id for the Capacitor export
            ...(app && (app.name || app.id) ? {app} : {}),
            // A28: per-site CSP config (Security tab) — absent = A25 baseline
            ...(security && Object.keys(security).length ? {security} : {}),
            // U25: custom class definitions are no longer stored here — they live
            // in a <style id="feezal-classes"> block inside <feezal-site> and so
            // travel with the serialized site HTML below.
            folders: this.foldersForSave()
        };
        const elements = [...deployTpl.content.querySelectorAll('*')].map(el => el.tagName);
        // U32: <template> content is inert — querySelectorAll on the document
        // fragment cannot see into it, so element tags used only inside
        // component definitions must be collected explicitly or the deployed
        // site loses their packages.
        deployTpl.content.querySelectorAll('template[feezal-component]').forEach(tpl => {
            elements.push(...[...tpl.content.querySelectorAll('*')].map(el => el.tagName));
        });
        const html = [...deployTpl.content.childNodes].map(n => n.outerHTML).join('\n');

        const siteData = {...(site || {})};
        siteData.name = feezal.siteName;

        feezal.connection.deploy({html, elements, connection, site: siteData, viewer}, () => {
            this.changes = false;
            feezal.hasChanges = false;
            this.deploying = false;
            // U43: the just-deployed connection is the new baseline for the
            // Apply-connection-settings dirty detection.
            this.shadowRoot.querySelector('feezal-sidebar-viewer')?.markConnectionDeployed?.();
            // Refresh history panel shortly after deploy so the new commit is visible
            setTimeout(() => {
                const history = this.shadowRoot.querySelector('feezal-sidebar-history');
                if (history) history._load();
            }, 800);
        });
    }

    _export() {
        const viewerSidebar = this.shadowRoot.querySelector('feezal-sidebar-viewer');
        const uri = viewerSidebar && viewerSidebar.connection && viewerSidebar.connection.uri;
        if (uri && /^mqtts?:\/\//.test(uri)) {
            this.shadowRoot.querySelector('#exporterrordialog').show();
            return;
        }

        // U34: the export dialog shows the bundle size breakdown and hosts
        // the actual ZIP download button.
        this.shadowRoot.querySelector('feezal-export-dialog').open();
    }

    // U58: the Generate wizard — bulk element scaffold from MQTT discovery.
    _openGenerate() {
        this.shadowRoot.querySelector('feezal-generate-dialog').open();
    }

    // -------------------------------------------------------------------
    // Edit utilities

    _removeClassesFromChildren(parent, classes) {
        for (const cl of classes) {
            parent.querySelectorAll('.' + cl).forEach(el => el.classList.remove(cl));
        }
    }

    _clean(container) {
        // U33: canvas stacking is DOM order — strip the inline z-index junk
        // DragSelect accumulates on canvas elements BEFORE the editable class
        // is removed (the helper matches on .feezal-editable). Also
        // self-heals sites saved while the leak existed.
        stripCanvasZIndex(container);
        this._removeClassesFromChildren(container, ['feezal-editable', 'feezal-selected', 'iron-selected', 'ds-selectable']);
        container.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        // U32: instances persist as empty tags — stamped content is regenerated
        // from the <template feezal-component> on connect. Also drop any
        // component-edit pseudo-view; it must never reach persistence (it is
        // normally already committed before any serialization path runs).
        container.querySelectorAll('feezal-component').forEach(el => {
            el.innerHTML = '';
        });
        container.querySelectorAll('feezal-view[feezal-component-edit]').forEach(el => el.remove());
        // Strip theme classes from feezal-site — theme is stored in viewer.json, not views.html.
        const site = container.querySelector('feezal-site');
        if (site) {
            [...site.classList].filter(c => c.startsWith('feezal-theme-')).forEach(c => site.classList.remove(c));
            // Remove leftover empty class attribute so the stored HTML stays clean.
            if (!site.className) site.removeAttribute('class');
        }
    }

    _clone(element) {
        // Deep clone (B31): light-DOM children must survive copy/paste and
        // duplicate — basic-template stores its content as a <template>
        // child, dialogs carry template bodies, layout elements carry their
        // children. Rendered element output lives in the shadow root and is
        // never part of the clone; feezal-component instances re-stamp
        // idempotently (and _clean empties them on the clipboard path).
        const clone = element.cloneNode(true);
        clone.style.cursor = '';
        return clone;
    }

    // -------------------------------------------------------------------
    // U32 — Composed elements: reusable parameterized components

    _componentTemplate(name) {
        return feezal.site?.querySelector(`template[feezal-component="${name}"]`) ?? null;
    }

    _componentNames() {
        return [...(feezal.site?.querySelectorAll('template[feezal-component]') ?? [])]
            .map(t => t.getAttribute('feezal-component'));
    }

    _componentInstances(name) {
        return [...(feezal.site?.querySelectorAll(`feezal-component[name="${name}"]`) ?? [])];
    }

    _restampInstances(name) {
        this._componentInstances(name).forEach(el => el._stamp?.());
    }

    /** Infer a feezal-params type for an attribute from the element's spec (or its name). */
    _inferParamType(element, attrName) {
        const cls = window.customElements.get(element.localName);
        const spec = (cls?.feezal?.attributes ?? [])
            .find(a => (typeof a === 'string' ? a : a.name) === attrName);
        const type = typeof spec === 'object' ? spec.type : undefined;
        if (type && ['mqttTopic', 'color', 'number', 'boolean', 'icon'].includes(type)) return type;
        const n = attrName.toLowerCase();
        if (n === 'subscribe' || n === 'publish' || n.includes('topic')) return 'mqttTopic';
        if (n.includes('color')) return 'color';
        return 'string';
    }

    /** Context menu → "Create component…": open the parameterize dialog. */
    _openCreateComponent(elements) {
        const elems = elements.filter(el => el.tagName !== 'FEEZAL-VIEW' && el.localName !== 'feezal-component');
        if (!elems.length) return;
        const rows = [];
        elems.forEach((el, elemIndex) => {
            for (const attr of el.attributes) {
                if (['class', 'style', 'locked', 'tabindex'].includes(attr.name)) continue;
                rows.push({
                    elemIndex,
                    tag: el.localName,
                    attr: attr.name,
                    value: attr.value,
                    param: '',
                    type: this._inferParamType(el, attr.name)
                });
            }
        });
        this._componentDialogElems = elems;
        this._componentDialog = {rows, error: ''};
        const dlg = this.shadowRoot.querySelector('#componentdialog');
        dlg.show();
        dlg.addEventListener('sl-after-show', () => {
            const input = dlg.querySelector('#componentnameinput');
            if (input) { input.value = ''; input.focus(); }
        }, {once: true});
    }

    _checkComponentName(name, excludeName) {
        if (!/^[a-z][a-z0-9-]*$/.test(name)) {
            return 'lowercase letters, digits and hyphens only, starting with a letter';
        }
        if (name !== excludeName && this._componentNames().includes(name)) {
            return `component "${name}" already exists`;
        }
        return '';
    }

    _createComponentConfirmed() {
        const dlg = this.shadowRoot.querySelector('#componentdialog');
        const name = (dlg.querySelector('#componentnameinput')?.value ?? '').trim();
        const error = this._checkComponentName(name);
        if (error) {
            this._componentDialog = {...this._componentDialog, error};
            return;
        }

        const elems = this._componentDialogElems ?? [];
        if (!elems.length || !elems[0].parentNode) { dlg.hide(); return; }
        const view = elems[0].parentNode;

        // Translate so the selection's bounding-box origin becomes the
        // template's (0,0); the instance takes over the origin position.
        const minLeft = Math.min(...elems.map(el => Number.parseFloat(el.style.left) || 0));
        const minTop = Math.min(...elems.map(el => Number.parseFloat(el.style.top) || 0));

        const template = document.createElement('template');
        template.setAttribute('feezal-component', name);
        elems.forEach(el => {
            const clone = el.cloneNode(true);
            clone.style.left = ((Number.parseFloat(el.style.left) || 0) - minLeft) + 'px';
            clone.style.top = ((Number.parseFloat(el.style.top) || 0) - minTop) + 'px';
            clone.style.cursor = '';
            template.content.append(clone);
        });
        this._clean(template.content);

        // Apply parameterization: replace attribute values with ${param}
        // placeholders; the current concrete value becomes the param default.
        const params = {};
        for (const row of this._componentDialog.rows) {
            const param = (row.param || '').trim();
            if (!param) continue;
            if (!/^[a-z][a-z0-9-]*$/.test(param)) {
                this._componentDialog = {...this._componentDialog, error: `invalid parameter name "${param}"`};
                return;
            }
            template.content.children[row.elemIndex]?.setAttribute(row.attr, '${' + param + '}');
            if (!params[param]) {
                params[param] = {type: row.type, default: row.value};
            }
        }
        template.setAttribute('feezal-params', JSON.stringify(params));

        // Template definitions live before the views inside <feezal-site>.
        feezal.site.insertBefore(template, feezal.site.querySelector('feezal-view'));

        // Replace the selection with an instance at the old origin — since the
        // instance params default to the old concrete values, visually nothing
        // changes.
        const instance = document.createElement('feezal-component');
        instance.setAttribute('name', name);
        instance.style.left = minLeft + 'px';
        instance.style.top = minTop + 'px';
        elems.forEach(el => el.remove());
        view.append(instance);
        feezal.editor.initElem(instance);
        feezal.editor.selectElement(instance);

        this.change();   // template + canvas mutations land in ONE undo snapshot
        feezal.palette?.refresh?.();
        dlg.hide();
    }

    /** Context menu → "Edit component": open the definition as a pseudo-view. */
    _openComponentEdit(name) {
        if (this._componentEdit) {
            if (this._componentEdit.name === name) { this._setView(this._componentEdit.viewName); return; }
            this._commitComponentEdit();
        }
        const template = this._componentTemplate(name);
        if (!template) return;

        const viewName = 'component:' + name;
        const view = document.createElement('feezal-view');
        view.setAttribute('name', viewName);
        view.setAttribute('feezal-component-edit', name);
        const current = feezal.getView(this._navView);
        if (current) view.style.cssText = current.style.cssText;
        view.append(template.content.cloneNode(true));   // raw ${param} placeholders stay visible
        feezal.site.append(view);

        this._componentEdit = {name, viewName, returnView: this._navView};
        this.views = [...feezal.views];
        this._setView(viewName);
    }

    /**
     * U52: "Attribute mapping…" in the edit-mode banner — the same
     * instance-attribute → inner-element/attribute table the create dialog
     * shows, for the component being edited. Rows are built from the
     * pseudo-view's live elements; a `${param}` value pre-fills its param
     * name and shows the param's default as the value.
     */
    _openComponentMapping() {
        if (!this._componentEdit) return;
        const view = feezal.getView(this._componentEdit.viewName);
        const template = this._componentTemplate(this._componentEdit.name);
        if (!view || !template) return;

        let params = {};
        try { params = JSON.parse(template.getAttribute('feezal-params') || '{}'); } catch { /* keep {} */ }
        // A pending, not-yet-committed mapping edit wins over the template.
        if (this._componentEdit.paramsOverride) params = this._componentEdit.paramsOverride;

        const rows = [];
        [...view.children].forEach((el, elemIndex) => {
            if (!el.localName?.includes('-')) return;
            for (const attr of el.attributes) {
                if (['class', 'style', 'locked', 'tabindex'].includes(attr.name)) continue;
                const m = attr.value.match(/^\$\{([a-z][a-z0-9-]*)\}$/);
                rows.push({
                    elemIndex,
                    tag: el.localName,
                    attr: attr.name,
                    param: m ? m[1] : '',
                    baseValue: m ? (params[m[1]]?.default ?? '') : attr.value,
                    type: this._inferParamType(el, attr.name),
                });
            }
        });
        this._componentMapping = {rows, error: ''};
        this.shadowRoot.querySelector('#componentmappingdialog').show();
    }

    /**
     * Apply the mapping: placeholder attrs are written onto the PSEUDO-VIEW
     * (cancel-safe — they die with the discarded view), while the updated
     * feezal-params is stashed on _componentEdit and only written to the
     * template at COMMIT, so Cancel discards the whole edit including the
     * mapping. Params still referenced elsewhere (`${p}` in text/template
     * content) survive; params no longer referenced anywhere are dropped.
     */
    _applyComponentMapping() {
        if (!this._componentEdit || !this._componentMapping) return;
        const view = feezal.getView(this._componentEdit.viewName);
        const template = this._componentTemplate(this._componentEdit.name);
        if (!view || !template) return;

        let oldParams = {};
        try { oldParams = JSON.parse(template.getAttribute('feezal-params') || '{}'); } catch { /* keep {} */ }
        if (this._componentEdit.paramsOverride) oldParams = this._componentEdit.paramsOverride;

        const newParams = {};
        for (const row of this._componentMapping.rows) {
            const param = (row.param || '').trim();
            const el = view.children[row.elemIndex];
            if (!el) continue;
            if (param) {
                if (!/^[a-z][a-z0-9-]*$/.test(param)) {
                    this._componentMapping = {...this._componentMapping, error: `invalid parameter name "${param}"`};
                    return;
                }
                el.setAttribute(row.attr, '${' + param + '}');
                if (!newParams[param]) {
                    newParams[param] = oldParams[param] ?? {type: row.type, default: row.baseValue};
                }
            } else if (el.getAttribute(row.attr)?.match(/^\$\{[a-z][a-z0-9-]*\}$/)) {
                // Un-mapped: bake the default back in as a fixed value.
                el.setAttribute(row.attr, row.baseValue);
            }
        }
        // Keep params still referenced outside attributes (text nodes,
        // nested template content) — scan the live markup after the edits.
        const markup = view.innerHTML;
        for (const [p, spec] of Object.entries(oldParams)) {
            if (!newParams[p] && markup.includes('${' + p + '}')) newParams[p] = spec;
        }

        this._componentEdit = {...this._componentEdit, paramsOverride: newParams};
        this._componentMapping = null;
        this.shadowRoot.querySelector('#componentmappingdialog').hide();
    }

    /** Done: write the pseudo-view back into the template, re-stamp instances. */
    _commitComponentEdit() {
        if (!this._componentEdit) return;
        const {name, viewName, returnView, paramsOverride} = this._componentEdit;
        this._componentEdit = null;

        const view = feezal.getView(viewName);
        const template = this._componentTemplate(name);
        if (view && template) {
            const holder = document.createElement('template');
            [...view.children].forEach(child => holder.content.append(child.cloneNode(true)));
            this._clean(holder.content);
            template.innerHTML = holder.innerHTML;
            // U52: a mapping edit stashed its params — apply with the same
            // commit (one undo step; Cancel never reaches this).
            if (paramsOverride) template.setAttribute('feezal-params', JSON.stringify(paramsOverride));
        }
        view?.remove();
        this.views = [...feezal.views];
        this._leaveComponentEditView(returnView);
        this._restampInstances(name);
        this.change();   // single undo step for the whole edit
    }

    /** Cancel: discard the pseudo-view, leave the template untouched. */
    _cancelComponentEdit() {
        if (!this._componentEdit) return;
        const {viewName, returnView} = this._componentEdit;
        this._componentEdit = null;
        feezal.getView(viewName)?.remove();
        this.views = [...feezal.views];
        this._leaveComponentEditView(returnView);
    }

    _leaveComponentEditView(returnView) {
        const names = [...feezal.views].map(v => v.getAttribute('name'));
        this._setView(names.includes(returnView) ? returnView : names[0] ?? '');
    }

    /** Called by restoreViews() after an undo/source restore replaced the site
     *  DOM: any component-edit state refers to nodes that no longer exist. */
    _onRestoreViews() {
        if (this._componentEdit) {
            const returnView = this._componentEdit.returnView;
            this._componentEdit = null;
            this._leaveComponentEditView(returnView);
        }
    }

    /** Detach: replace instances with their substituted, expanded markup. */
    _detachComponent(instances) {
        const newSelection = this._detachInstances(instances);
        feezal.editor.selectElement(newSelection.length ? newSelection : undefined);
        this.change();
    }

    _detachInstances(instances) {
        const newSelection = [];
        instances.forEach(instance => {
            const left = Number.parseFloat(instance.style.left) || 0;
            const top = Number.parseFloat(instance.style.top) || 0;
            [...instance.children].forEach(child => {
                const clone = child.cloneNode(true);
                clone.style.left = ((Number.parseFloat(clone.style.left) || 0) + left) + 'px';
                clone.style.top = ((Number.parseFloat(clone.style.top) || 0) + top) + 'px';
                instance.parentNode.insertBefore(clone, instance);
                feezal.editor.initElem(clone);
                newSelection.push(clone);
            });
            instance.remove();
        });
        return newSelection;
    }

    _componentRenameOpen(name) {
        this._componentRenameOld = name;
        const dlg = this.shadowRoot.querySelector('#componentrenamedialog');
        dlg.querySelector('#componentrenameerror').textContent = '';
        dlg.show();
        dlg.addEventListener('sl-after-show', () => {
            const input = dlg.querySelector('#componentrenameinput');
            if (input) { input.value = name; input.select(); }
        }, {once: true});
    }

    _componentRenameConfirmed() {
        const dlg = this.shadowRoot.querySelector('#componentrenamedialog');
        const input = dlg.querySelector('#componentrenameinput');
        const newName = (input?.value ?? '').trim();
        const oldName = this._componentRenameOld;
        if (newName === oldName) { dlg.hide(); return; }
        const error = this._checkComponentName(newName, oldName);
        if (error) {
            dlg.querySelector('#componentrenameerror').textContent = error;
            return;
        }
        this._componentTemplate(oldName)?.setAttribute('feezal-component', newName);
        // Instances re-stamp via their attribute observer (template renamed first).
        this._componentInstances(oldName).forEach(el => el.setAttribute('name', newName));
        this.change();   // one undo step: template + all instances
        feezal.palette?.refresh?.();
        dlg.hide();
    }

    /** Delete policy: refuse while instances exist — offer "Detach all & delete". */
    _componentDeleteRequest(name) {
        const instances = this._componentInstances(name);
        if (instances.length === 0) {
            this._componentTemplate(name)?.remove();
            this.change();
            feezal.palette?.refresh?.();
            return;
        }
        const views = [...new Set(instances
            .map(el => el.closest('feezal-view')?.getAttribute('name'))
            .filter(Boolean))];
        this._componentDeleteInfo = {name, count: instances.length, views};
        this.shadowRoot.querySelector('#componentdeletedialog').show();
    }

    _componentDeleteConfirmed() {
        const {name} = this._componentDeleteInfo ?? {};
        if (name) {
            this._detachInstances(this._componentInstances(name));
            this._componentTemplate(name)?.remove();
            this.change();   // detach-all + template removal = one undo step
            feezal.palette?.refresh?.();
        }
        this._componentDeleteInfo = null;
        this.shadowRoot.querySelector('#componentdeletedialog').hide();
    }

    // -------------------------------------------------------------------
    // Copy / Paste / Cut

    _clickCopy()  {
        if (this._sourceEditorActive()) { this._sourceClipboard('copy'); return; }
        document.execCommand('copy');
    }
    _clickPaste() {
        if (this._sourceEditorActive()) { this._sourceClipboard('paste'); return; }
        this._pasteInternal();
    }
    _clickCut()   {
        if (this._sourceEditorActive()) { this._sourceClipboard('cut'); return; }
        document.execCommand('cut');
    }

    /**
     * Copy/cut/paste for the Monaco source editor driven by toolbar buttons.
     * Monaco's own clipboard actions rely on the editor textarea owning the
     * focus + selection at execCommand time, which is unreliable when the
     * gesture originates from a toolbar button outside the editor. Drive the
     * system clipboard directly via the async Clipboard API, falling back to
     * Monaco's built-in actions when it is unavailable (e.g. insecure origin).
     */
    async _sourceClipboard(kind) {
        const ed = this._sourceEditor;
        const monaco = this._monaco;
        if (!ed) return;
        ed.focus();
        const model = ed.getModel();
        const sel = ed.getSelection();

        if (kind === 'paste') {
            let text = '';
            try {
                if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
            } catch { /* permission denied / insecure origin */ }
            if (text) {
                ed.executeEdits('toolbar-paste', [{range: sel, text, forceMoveMarkers: true}]);
                ed.pushUndoStop();
            } else {
                ed.getAction('editor.action.clipboardPasteAction')?.run();
            }
            return;
        }

        // copy / cut — operate on the selection, or the whole current line when empty.
        let text, range = sel;
        if (sel.isEmpty() && monaco) {
            const ln = sel.positionLineNumber;
            const lineCount = model.getLineCount();
            text = model.getLineContent(ln) + '\n';
            range = ln < lineCount
                ? new monaco.Range(ln, 1, ln + 1, 1)
                : new monaco.Range(ln, 1, ln, model.getLineMaxColumn(ln));
        } else {
            text = model.getValueInRange(sel);
        }

        let ok = false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                ok = true;
            }
        } catch { /* permission denied / insecure origin */ }

        if (!ok) {
            ed.getAction(kind === 'cut'
                ? 'editor.action.clipboardCutAction'
                : 'editor.action.clipboardCopyAction')?.run();
            return;
        }
        if (kind === 'cut') {
            ed.executeEdits('toolbar-cut', [{range, text: '', forceMoveMarkers: true}]);
            ed.pushUndoStop();
        }
    }

    /** True when the Monaco source editor is open and should receive toolbar edits. */
    _sourceEditorActive() {
        return this._sourceMode && !!this._sourceEditor;
    }

    _copy(event) {
        this._clipboardTpl.innerHTML = '';
        feezal.editor.selectedElems.forEach(el => this._clipboardTpl.content.append(this._clone(el)));
        this._clean(this._clipboardTpl.content);
        const clipHtml = this._clipboardTpl.innerHTML;
        event.clipboardData.setData('text/plain', clipHtml);
        event.preventDefault();
    }

    _pasteInternal() {
        const newSelection = [];
        this._clipboardTpl.content.childNodes.forEach(element => {
            element.style.left = (Number(element.style.left.replace('px', '')) + 25) + 'px';
            element.style.top  = (Number(element.style.top.replace('px', ''))  + 25) + 'px';
            const clone = this._clone(element);
            newSelection.push(clone);
            feezal.view.append(clone);
            feezal.editor.initElem(clone);
        });
        feezal.editor.selectElement(newSelection);
    }

    _paste(event) {
        const htmlData = (event.clipboardData || window.clipboardData).getData('text');
        this._clipboardTpl.innerHTML = '';
        if (/^\s*<feezal-(element-|component)/.test(htmlData)) {
            this._clipboardTpl.innerHTML = htmlData;
        }

        this._pasteInternal();
        event.preventDefault();
    }

    _cut(event) {
        this._copy(event);
        this._delete();
    }

    _delete() {
        if (this._sourceEditorActive()) {
            this._sourceEditor.focus();
            this._sourceEditor.trigger('keyboard', 'deleteRight', null);
            return;
        }
        feezal.editor._deleteElems();
        this.viewSelected = true;
    }

    // -------------------------------------------------------------------
    // View management

    _showViewCtxMenu(x, y, name) {
        this._viewCtx = {x, y, kind: 'view', name};
        // Close on outside click
        if (this._viewCtxClose) {
            document.removeEventListener('mousedown', this._viewCtxClose, true);
        }
        this._viewCtxClose = e => {
            if (e.composedPath().some(el => el.classList?.contains('view-ctx-menu'))) return;
            this._viewCtx = null;
            document.removeEventListener('mousedown', this._viewCtxClose, true);
        };
        // Defer so this mousedown doesn't immediately close the menu it just opened.
        setTimeout(() => document.addEventListener('mousedown', this._viewCtxClose, true), 0);
    }

    _editView(_e, name) {
        this.editViewName = name;
        const dlg = this.shadowRoot.querySelector('#viewdialog');
        const errEl = dlg.querySelector('#viewnameerror');
        errEl.textContent = '';
        dlg.show();
        // sl-input value must be set after the dialog opens (it renders lazily).
        dlg.addEventListener('sl-after-show', () => {
            const input = dlg.querySelector('#viewnameinput');
            if (input) { input.value = name; input.select(); }
        }, {once: true});
    }

    _checkViewName() {
        const dlg = this.shadowRoot.querySelector('#viewdialog');
        const input = dlg.querySelector('#viewnameinput');
        const name = input?.value ?? '';
        const duplicate = name !== this.editViewName && this.views.map(v => v.name).includes(name);
        dlg.querySelector('#viewnameerror').textContent = duplicate ? 'Name already exists' : '';
        return !duplicate && name.trim().length > 0;
    }

    _renameView() {
        if (!this._checkViewName()) return;
        const dlg = this.shadowRoot.querySelector('#viewdialog');
        const input = dlg.querySelector('#viewnameinput');
        const newName = input.value.trim();
        const oldName = this.editViewName;
        if (oldName === newName) { dlg.hide(); return; }

        const view = feezal.site.querySelector('[name="' + oldName + '"]');
        if (view) view.name = newName;

        this.editViewName = newName;
        dlg.hide();
        this._renameInTree(oldName, newName);
        this.views = [...feezal.views];
        setTimeout(() => this._setView(newName), 0);
        feezal.app.change();
    }

    _confirmDeleteView(name) {
        // If the view is empty, skip the confirmation dialog.
        const view = feezal.site.querySelector(`feezal-view[name="${name}"]`);
        if (!view || view.children.length === 0) {
            this.editViewName = name;
            this._deleteViewConfirmed();
            return;
        }
        this.editViewName = name;
        const dlg = this.shadowRoot.querySelector('#deletedialog');
        dlg.querySelector('#deleteconfirmtext').textContent =
            `Delete view "${name}"? This cannot be undone.`;
        dlg.show();
    }

    _deleteViewConfirmed() {
        const allNames = this.views.map(v => v.name);
        const idx = allNames.indexOf(this.editViewName);
        const nextName = idx > 0
            ? allNames[idx - 1]
            : allNames[idx + 1] ?? '';
        const view = feezal.site.querySelector('[name="' + this.editViewName + '"]');
        if (view) view.remove();
        this.shadowRoot.querySelector('#deletedialog').hide();
        this.views = [...feezal.views];
        feezal.app.views = [...feezal.views];
        setTimeout(() => this._setView(nextName), 0);
        feezal.app.change();
    }

    // Legacy path: Delete button inside the rename dialog (kept for double-click workflow).
    _deleteView() {
        const allNames = this.views.map(v => v.name);
        const idx = allNames.indexOf(this.editViewName);
        const nextName = idx > 0
            ? allNames[idx - 1]
            : allNames[idx + 1] ?? '';
        const view = feezal.site.querySelector('[name="' + this.editViewName + '"]');
        if (view) view.remove();
        this.shadowRoot.querySelector('#viewdialog').hide();
        this.views = [...feezal.views];
        feezal.app.views = [...feezal.views];
        setTimeout(() => this._setView(nextName), 0);
        feezal.app.change();
    }

    _duplicateView(name) {
        const src = feezal.site.querySelector(`feezal-view[name="${name}"]`);
        if (!src) return;
        const clone = src.cloneNode(true);
        clone.setAttribute('name', this._nextView(name + '-copy'));
        src.after(clone);
        this.views = [...feezal.views];
        feezal.app.change();
    }

    _nextView(name, number) {
        const n = name + (number || '');
        if (this.views.map(v => v.name).includes(n)) {
            return this._nextView(name, (number || 0) + 1);
        }

        return n;
    }

    _addView() {
        const el = document.createElement('feezal-view');
        const name = this._nextView('view', 1);
        el.setAttribute('name', name);
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.background = 'white';

        // Inherit style from current view
        const currentView = feezal.site.querySelector('feezal-view[name="' + this._navView + '"]');
        if (currentView) {
            el.style.cssText = currentView.style.cssText;
        }

        feezal.site.append(el);
        feezal.app.views = [...feezal.views];
        this._setView(name);
    }

    // -------------------------------------------------------------------
    // View folders (U8) — editor-only tree persisted in viewer.json

    /** Public: load the folder tree from persisted viewer config and reconcile. */
    setFolders(tree) {
        this._folders = this._reconcile(Array.isArray(tree) ? tree : []);
        this._foldersSig = JSON.stringify(this._folders);
        this.requestUpdate();
    }

    /** Snapshot of the reconciled tree for saving in viewer.json. */
    foldersForSave() {
        return this._reconcile(this._folders);
    }

    /**
     * Reconcile a stored tree against the actual views:
     *  - drop dangling view refs (view no longer exists) and duplicates,
     *  - drop malformed nodes,
     *  - cap folder nesting at 3 levels (deeper folders are flattened up),
     *  - append any unreferenced views at the top level in document order.
     */
    _reconcile(tree) {
        const viewNames = (feezal.views ? [...feezal.views] : []).map(v => v.getAttribute('name'));
        const seen = new Set();
        const usedIds = new Set();
        let folderSeq = 0;

        const walk = (nodes, depth) => {
            const out = [];
            if (!Array.isArray(nodes)) return out;
            for (const node of nodes) {
                if (node && typeof node === 'object' && typeof node.view === 'string') {
                    if (viewNames.includes(node.view) && !seen.has(node.view)) {
                        seen.add(node.view);
                        out.push({view: node.view});
                    }
                } else if (node && typeof node === 'object' && Array.isArray(node.children)) {
                    if (depth > 3) {
                        // Too deeply nested — lift this folder's contents into the parent.
                        out.push(...walk(node.children, depth));
                        continue;
                    }
                    let id = (typeof node.id === 'string' && node.id) ? node.id : 'f' + (++folderSeq);
                    while (usedIds.has(id)) id = 'f' + (++folderSeq);
                    usedIds.add(id);
                    const name = (typeof node.name === 'string' && node.name.trim()) ? node.name : 'Folder';
                    out.push({id, name, children: walk(node.children, depth + 1)});
                }
                // anything else: ignored (malformed)
            }
            return out;
        };

        const result = walk(tree, 1);
        for (const name of viewNames) {
            if (name && !seen.has(name)) {
                seen.add(name);
                result.push({view: name});
            }
        }
        return result;
    }

    /** Reconcile in place when the set of views changes; avoids update loops. */
    _syncFolders() {
        const next = this._reconcile(this._folders);
        const sig = JSON.stringify(next);
        if (sig !== this._foldersSig) {
            this._foldersSig = sig;
            this._folders = next;
        }
    }

    /** Commit a mutated tree: store, mark dirty, re-render. */
    _commitFolders(next) {
        this._folders = next;
        this._foldersSig = JSON.stringify(next);
        feezal.app.change(true);   // mark unsaved (no canvas history entry)
        this.requestUpdate();
    }

    _cloneTree() {
        return JSON.parse(JSON.stringify(this._folders));
    }

    /** Top-level tab-bar items. Folders open a popup menu (no inline fold-out). */
    _tabItems() {
        return this._folders.map(node => node.view !== undefined
            ? {type: 'view', name: node.view, depth: 0}
            : {type: 'folder', id: node.id, name: node.name,
                count: this._folderViewCount(node),
                containsActive: this._folderContainsView(node, this._navView)});
    }

    _folderViewCount(node) {
        let c = 0;
        for (const ch of node.children) {
            if (ch.view !== undefined) c++;
            else c += this._folderViewCount(ch);
        }
        return c;
    }

    /** True when the named view lives anywhere inside this folder (recursively). */
    _folderContainsView(node, name) {
        if (!name) return false;
        for (const ch of node.children) {
            if (ch.view === name) return true;
            if (ch.children && this._folderContainsView(ch, name)) return true;
        }
        return false;
    }

    /** Recursively locate the array + index of the first node matching pred. */
    _locate(nodes, pred) {
        for (let i = 0; i < nodes.length; i++) {
            if (pred(nodes[i])) return {arr: nodes, idx: i};
            if (nodes[i].children) {
                const r = this._locate(nodes[i].children, pred);
                if (r) return r;
            }
        }
        return null;
    }

    /** Remove and return the first node matching pred (mutates nodes). */
    _detach(nodes, pred) {
        for (let i = 0; i < nodes.length; i++) {
            if (pred(nodes[i])) return nodes.splice(i, 1)[0];
            if (nodes[i].children) {
                const r = this._detach(nodes[i].children, pred);
                if (r) return r;
            }
        }
        return null;
    }

    _findFolder(nodes, id) {
        for (const n of nodes) {
            if (n.children) {
                if (n.id === id) return n;
                const r = this._findFolder(n.children, id);
                if (r) return r;
            }
        }
        return null;
    }

    /** Flat list of {id, name, depth} folders for the move menu / depth checks. */
    _collectFolders(nodes = this._folders, depth = 0, acc = []) {
        for (const n of nodes) {
            if (n.children) {
                acc.push({id: n.id, name: n.name, depth});
                this._collectFolders(n.children, depth + 1, acc);
            }
        }
        return acc;
    }

    _maxFolderDepth(nodes, depth = 1) {
        let max = 0;
        for (const n of nodes) {
            if (n.children) {
                max = Math.max(max, depth, this._maxFolderDepth(n.children, depth + 1));
            }
        }
        return max;
    }

    _folderNameExists(name, exceptId) {
        return this._collectFolders().some(f => f.name === name && f.id !== exceptId);
    }

    /** Id of the folder directly containing the named view, or null for top level. */
    _findViewParent(name) {
        let parentId = null;
        const search = (nodes, parent) => {
            for (const n of nodes) {
                if (n.view === name) { parentId = parent; return true; }
                if (n.children && search(n.children, n.id)) return true;
            }
            return false;
        };
        search(this._folders, null);
        return parentId;
    }

    /** Update a renamed view inside the folder tree (keeps placement). */
    _renameInTree(oldName, newName) {
        const tree = this._cloneTree();
        const node = this._locate(tree, n => n.view === oldName);
        if (node) {
            node.arr[node.idx] = {view: newName};
            this._folders = tree;
            this._foldersSig = JSON.stringify(tree);
        }
    }

    _toggleFolder(id) {
        const next = new Set(this._collapsed);
        if (next.has(id)) next.delete(id); else next.add(id);
        this._collapsed = next;
    }

    // ---- Folder popup menu (cascading) ----------------------------------

    /** Open the popup menu for a folder anchored under its tab. */
    _openFolderMenu(e, id) {
        const rect = e.currentTarget.getBoundingClientRect();
        this._folderMenu = {id, x: rect.left, y: rect.bottom};
        if (this._folderMenuClose) {
            document.removeEventListener('mousedown', this._folderMenuClose, true);
        }
        this._folderMenuClose = ev => {
            // Keep open while interacting with the menu (or its submenus).
            if (ev.composedPath().some(el => el.classList?.contains('folder-menu'))) return;
            this._closeFolderMenu();
        };
        // Defer so this mousedown doesn't immediately close the menu it opened.
        setTimeout(() => document.addEventListener('mousedown', this._folderMenuClose, true), 0);
    }

    _closeFolderMenu() {
        this._folderMenu = null;
        if (this._folderMenuClose) {
            document.removeEventListener('mousedown', this._folderMenuClose, true);
            this._folderMenuClose = null;
        }
    }

    /** Recursively render a folder's children as menu items + nested submenus. */
    _renderFolderMenu(node) {
        const children = node.children || [];
        if (children.length === 0) {
            return html`<div class="fmenu-empty">(empty)</div>`;
        }
        return children.map(ch => ch.view !== undefined
            ? html`
                <div class="fmenu-item ${this._navView === ch.view ? 'active' : ''}"
                    @click="${() => { this._closeFolderMenu(); this._tabClick(ch.view); }}"
                    @contextmenu="${e => { e.preventDefault(); e.stopPropagation(); this._closeFolderMenu(); this._showViewCtxMenu(e.clientX, e.clientY, ch.view); }}">
                    <span class="material-icons fmenu-icon">description</span>
                    <span class="fmenu-label">${ch.view}</span>
                </div>`
            : html`
                <div class="fmenu-item has-sub"
                    @dblclick="${() => { this._closeFolderMenu(); this._beginRenameFolder(ch.id); }}"
                    @contextmenu="${e => { e.preventDefault(); e.stopPropagation(); this._closeFolderMenu(); this._showFolderCtxMenu(e.clientX, e.clientY, ch.id); }}">
                    <span class="material-icons fmenu-icon">folder</span>
                    <span class="fmenu-label">${ch.name}</span>
                    <span class="material-icons fmenu-caret">chevron_right</span>
                    <div class="folder-submenu">${this._renderFolderMenu(ch)}</div>
                </div>`);
    }

    /** Expand all ancestor folders so the named view becomes visible. */
    _revealView(name) {
        const path = [];
        const search = (nodes, chain) => {
            for (const n of nodes) {
                if (n.view === name) { path.push(...chain); return true; }
                if (n.children && search(n.children, [...chain, n.id])) return true;
            }
            return false;
        };
        search(this._folders, []);
        if (path.some(id => this._collapsed.has(id))) {
            const next = new Set(this._collapsed);
            path.forEach(id => next.delete(id));
            this._collapsed = next;
        }
    }

    // ---- Folder create / rename / delete --------------------------------

    _createFolder() {
        let name = 'Folder', i = 1;
        while (this._folderNameExists(name)) name = 'Folder ' + (++i);
        const id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        const tree = this._cloneTree();
        tree.push({id, name, children: []});
        this._commitFolders(tree);
        this._beginRenameFolder(id);
    }

    _beginRenameFolder(id) {
        this._editFolderId = id;
        const folder = this._findFolder(this._folders, id);
        const dlg = this.shadowRoot.querySelector('#folderdialog');
        dlg.querySelector('#foldernameerror').textContent = '';
        dlg.show();
        dlg.addEventListener('sl-after-show', () => {
            const input = dlg.querySelector('#foldernameinput');
            if (input) { input.value = folder ? folder.name : ''; input.select(); }
        }, {once: true});
    }

    _checkFolderName() {
        const dlg = this.shadowRoot.querySelector('#folderdialog');
        const input = dlg.querySelector('#foldernameinput');
        const name = (input?.value ?? '').trim();
        const dup = this._folderNameExists(name, this._editFolderId);
        dlg.querySelector('#foldernameerror').textContent = dup ? 'Name already exists' : '';
        return !dup && name.length > 0;
    }

    _renameFolder() {
        if (!this._checkFolderName()) return;
        const dlg = this.shadowRoot.querySelector('#folderdialog');
        const newName = dlg.querySelector('#foldernameinput').value.trim();
        const tree = this._cloneTree();
        const folder = this._findFolder(tree, this._editFolderId);
        if (folder) folder.name = newName;
        dlg.hide();
        this._commitFolders(tree);
    }

    /** Delete a folder: lift its children into the parent at the folder's position. */
    _deleteFolder(id) {
        const tree = this._cloneTree();
        const loc = this._locate(tree, n => n.id === id);
        if (!loc) return;
        const folder = loc.arr[loc.idx];
        loc.arr.splice(loc.idx, 1, ...folder.children);
        this._commitFolders(tree);
    }

    // ---- Move views in/out of folders -----------------------------------

    _moveViewToFolder(name, folderId) {
        const tree = this._cloneTree();
        const node = this._detach(tree, n => n.view === name);
        if (!node) return;
        if (folderId) {
            const folder = this._findFolder(tree, folderId);
            if (folder) folder.children.push(node);
            else tree.push(node);
        } else {
            tree.push(node);
        }
        this._commitFolders(tree);
    }

    // ---- Folder context menu -------------------------------------------

    _showFolderCtxMenu(x, y, id) {
        this._viewCtx = {x, y, kind: 'folder', id};
        if (this._viewCtxClose) document.removeEventListener('mousedown', this._viewCtxClose, true);
        this._viewCtxClose = e => {
            if (e.composedPath().some(el => el.classList?.contains('view-ctx-menu'))) return;
            this._viewCtx = null;
            document.removeEventListener('mousedown', this._viewCtxClose, true);
        };
        setTimeout(() => document.addEventListener('mousedown', this._viewCtxClose, true), 0);
    }

    // ---- Drag & drop ----------------------------------------------------

    // ---- U55: hold-to-drag arming ---------------------------------------
    // HTML5 drag has no delay option, so arming is manual: pointerdown starts
    // a timer; only when it fires (button still down on the same tab) is the
    // tab ARMED (visual lift cue). The tabs are always `draggable` — Chrome
    // samples draggability at mousedown, so flipping the attribute mid-press
    // (the first U55 implementation) only started a drag when a re-render
    // happened to win the race, i.e. almost never. Instead the native drag is
    // allowed to begin and `dragstart` vetoes it while unarmed: a quick click
    // — even a slightly moving one — never reorders, and once the lift cue
    // shows, moving the mouse reliably drags.

    _armDrag(e, key) {
        if (e.button !== 0) return;              // primary button / touch only
        clearTimeout(this.__dragArmTimer);
        this.__dragArmTimer = setTimeout(() => { this._dragArmed = key; }, 300);
    }

    _disarmDrag() {
        clearTimeout(this.__dragArmTimer);
        this.__dragArmTimer = null;
        // Keep the armed state while a native drag is in flight — dragend resets.
        if (!this._dragData) this._dragArmed = null;
    }

    _onItemDragStart(e, drag) {
        // U55: unarmed press (moved before the hold elapsed) → veto the native
        // drag AND disarm — the browser attempts only one drag per press, so a
        // later-firing arm timer could no longer start one; leaving the lift
        // cue up would promise a drag that cannot happen.
        if (this._dragArmed !== (drag.id ?? drag.name)) {
            e.preventDefault();
            this._disarmDrag();
            return;
        }
        this._dragData = drag;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', drag.name || drag.id); } catch { /* noop */ }
    }

    _onItemDragOver(e, target) {
        if (!this._dragData) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const rel = (e.clientX - rect.left) / rect.width;
        let position;
        if (target.kind === 'folder') {
            position = rel < 0.25 ? 'before' : (rel > 0.75 ? 'after' : 'into');
        } else {
            position = rel < 0.5 ? 'before' : 'after';
        }
        const key = target.id || target.name;
        if (!this._dropHint || this._dropHint.key !== key || this._dropHint.position !== position) {
            this._dropHint = {kind: target.kind, key, id: target.id, name: target.name, position};
        }
    }

    _onItemDrop(e, target) {
        if (!this._dragData) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const rel = (e.clientX - rect.left) / rect.width;
        let position;
        if (target.kind === 'folder') {
            position = rel < 0.25 ? 'before' : (rel > 0.75 ? 'after' : 'into');
        } else {
            position = rel < 0.5 ? 'before' : 'after';
        }
        this._applyDrop(target, position);
        this._onItemDragEnd();
    }

    _onBarDragOver(e) {
        if (!this._dragData) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!this._dropHint || this._dropHint.kind !== 'bar') {
            this._dropHint = {kind: 'bar'};
        }
    }

    _onBarDrop(e) {
        if (!this._dragData) return;
        e.preventDefault();
        this._applyDrop({kind: 'bar'});
        this._onItemDragEnd();
    }

    _onItemDragEnd() {
        this._dragData = null;
        this._dropHint = null;
        // U55: back to click-safe — the next drag needs a fresh hold.
        clearTimeout(this.__dragArmTimer);
        this.__dragArmTimer = null;
        this._dragArmed = null;
    }

    _applyDrop(target, position) {
        const drag = this._dragData;
        if (!drag) return;
        // U55: dropping an item onto ITSELF (before/after itself — the pointer
        // never left the tab) is order-preserving by definition — bail BEFORE
        // detaching. Without this, the detach-then-locate sequence could not
        // find the just-detached target and the fallback appended the dragged
        // item to the END (view1,view2,view3 → view2,view3,view1 on a micro-drag).
        const isSelf = drag.kind === target.kind
            && (drag.kind === 'view' ? target.name === drag.name : target.id === drag.id);
        if (isSelf) return;
        const tree = this._cloneTree();
        const dragged = drag.kind === 'view'
            ? this._detach(tree, n => n.view === drag.name)
            : this._detach(tree, n => n.id === drag.id);
        if (!dragged) return;

        if (target.kind === 'bar') {
            tree.push(dragged);
        } else if (target.kind === 'folder' && position === 'into') {
            const folder = this._findFolder(tree, target.id);
            // folder may be null if it was inside the dragged subtree — abort silently.
            if (!folder) return;
            folder.children.push(dragged);
        } else {
            const pred = target.kind === 'folder'
                ? n => n.id === target.id
                : n => n.view === target.name;
            const loc = this._locate(tree, pred);
            // U55: an unresolved target must ABORT, not relocate — the old
            // `push(dragged)` fallback turned every lookup miss into a silent
            // "move to end" (matches the existing silent abort for a folder
            // dropped into its own subtree).
            if (!loc) return;
            loc.arr.splice(loc.idx + (position === 'after' ? 1 : 0), 0, dragged);
        }

        // Reject moves that would exceed the 3-level nesting limit.
        if (this._maxFolderDepth(tree) > 3) return;
        this._commitFolders(tree);
    }

    _dropClass(item) {
        const h = this._dropHint;
        if (!h) return '';
        const key = item.id || item.name;
        if (h.key !== key) return '';
        if (h.position === 'into') return 'drop-into';
        if (h.position === 'before') return 'drop-before';
        if (h.position === 'after') return 'drop-after';
        return '';
    }
}

window.customElements.define('feezal-app-editor', FeezalAppEditor);
