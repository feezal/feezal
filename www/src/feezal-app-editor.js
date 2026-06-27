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

import './feezal-menu.js';
import './feezal-palette.js';
import './feezal-site.js';
import './feezal-view.js';
import './feezal-sidebar-inspector.js';
import './feezal-sidebar-assets.js';
import './feezal-sidebar-themes.js';
import './feezal-sidebar-palette.js';
import './feezal-sidebar-viewer.js';
import './feezal-sidebar-editor.js';
import './feezal-site-manager.js';
import './feezal-sidebar-history.js';

class FeezalAppEditor extends LitElement {
    static properties = {
        views:           {type: Array},
        changes:         {type: Boolean},
        deploying:       {type: Boolean},
        exporting:       {type: Boolean},
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
        _canScrollLeft:  {state: true},
        _canScrollRight: {state: true},
        _searchOpen:     {state: true},
        _searchQuery:    {state: true},
        _darkMode:        {state: true},
        _themeMode:       {state: true},
        _sidebarWidth:    {state: true},
        _version:         {state: true},
        _viewCtx:         {state: true},
        _actionMenuPos:   {state: true}
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
        #menu-right { display: flex; align-items: center; padding: 0 2px; overflow: hidden; }
        .icon-btn.active { background: rgba(0,0,0,0.1); }
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
        /* sl-tab-group for view switching — panels are hidden, only the nav bar is used */
        #view-tabs { flex: 1; min-width: 0; }
        #view-tabs::part(body)  { display: none; }
        #view-tabs::part(nav)   { background: #f5f5f5; }
        /* Same tab height as right-sidebar sub-tabs (Attributes/Styles) */
        sl-tab::part(base) { font-size: 14px; padding: 10px; }
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
        #viewdialog, #deletedialog, #exporterrordialog { --sl-z-index-dialog: 9999; }

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
        /* sl-dialog dark mode \u2014 set Shoelace panel vars on the dialog element itself
           so they cascade into its shadow DOM and override the light-theme defaults. */
        :host(.dark) #viewdialog,
        :host(.dark) #deletedialog,
        :host(.dark) #exporterrordialog {
            --sl-panel-background-color: #2e2e2e;
            --sl-panel-border-color: #3d3d3d;
            --sl-color-neutral-0:   #1e1e1e;
            --sl-color-neutral-100: #252525;
            --sl-color-neutral-200: #3d3d3d;
            --sl-color-neutral-600: rgba(255,255,255,0.55);
            --sl-color-neutral-700: rgba(255,255,255,0.75);
            --sl-color-neutral-900: rgba(255,255,255,0.9);
            --sl-color-neutral-1000: rgba(255,255,255,0.95);
        }
        /* Slotted body content is light-DOM and does not inherit the Shoelace token
           overrides above — set color explicitly so it reads well on dark panels. */
        :host(.dark) #viewdialog p,
        :host(.dark) #deletedialog p,
        :host(.dark) #exporterrordialog p { color: rgba(255,255,255,0.85); }
        /* The dialog panel shadow DOM inherits color from the document default (dark text).
           Override via ::part(panel) so title, close button and body all read correctly. */
        :host(.dark) #viewdialog::part(panel),
        :host(.dark) #deletedialog::part(panel),
        :host(.dark) #exporterrordialog::part(panel) { color: rgba(255,255,255,0.88); }
        /* Default (neutral) sl-button inside dark dialogs: subtle dark grey, gentle hover. */
        :host(.dark) #viewdialog sl-button:not([variant])::part(base),
        :host(.dark) #deletedialog sl-button:not([variant])::part(base),
        :host(.dark) #exporterrordialog sl-button:not([variant])::part(base) {
            background-color: #3a3a3a; border-color: #555; color: rgba(255,255,255,0.8);
        }
        :host(.dark) #viewdialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #deletedialog sl-button:not([variant])::part(base):hover,
        :host(.dark) #exporterrordialog sl-button:not([variant])::part(base):hover {
            background-color: #4a4a4a; border-color: #666; color: rgba(255,255,255,0.95);
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
        :host(.dark) #view-tabs { --sl-color-neutral-200: #3d3d3d; --sl-color-neutral-600: rgba(255,255,255,0.6); --sl-color-neutral-700: rgba(255,255,255,0.75); }
        :host(.dark) #view-tabs::part(nav) { background: #2e2e2e; border-bottom-color: #3d3d3d; }
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
        :host(.dark) feezal-sidebar-palette,
        :host(.dark) feezal-sidebar-viewer,
        :host(.dark) feezal-sidebar-editor,
        :host(.dark) feezal-sidebar-assets,
        :host(.dark) feezal-sidebar-history {
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
        }
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
        this.sidebar         = localStorage.getItem('sidebar')                    ?? 'inspector';

        this.views            = [];
        this.changes          = false;
        this.deploying        = false;
        this.exporting        = false;
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
        // Dark mode: localStorage override or OS preference
        this._themeMode = localStorage.getItem('themeMode') ?? 'os';
        this._darkMode = this._computeDark(this._themeMode);
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
        // Keep the sl-tab-group in sync with _navView (URL hash or programmatic changes).
        if ((changed.has('_navView') || changed.has('views')) && this._navView) {
            const tabGroup = this.shadowRoot.querySelector('#view-tabs');
            if (tabGroup && typeof tabGroup.show === 'function') {
                tabGroup.show(this._navView);
            }
            // Scroll the active tab into view and refresh arrow button state.
            requestAnimationFrame(() => {
                const activeTab = this.shadowRoot.querySelector(`sl-tab[panel="${this._navView}"]`);
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
                        @click="${this._collapsePalette}">
                        <span class="material-icons">${this.paletteVisible ? 'chevron_left' : 'chevron_right'}</span>
                    </button>

                    <div id="toolbar">
                        <button class="icon-btn" title="Copy (Ctrl+C)" ?disabled="${this.viewSelected}" @click="${this._clickCopy}"><span class="material-icons">content_copy</span></button>
                        <button class="icon-btn" title="Paste (Ctrl+V)" @click="${this._clickPaste}"><span class="material-icons">content_paste</span></button>
                        <button class="icon-btn" title="Cut (Ctrl+X)" ?disabled="${this.viewSelected}" @click="${this._clickCut}"><span class="material-icons">content_cut</span></button>
                        <button class="icon-btn" title="Delete (Del)" ?disabled="${this.viewSelected}" @click="${this._delete}"><span class="material-icons">delete</span></button>
                        <button class="icon-btn" title="Undo (Ctrl+Z)" ?disabled="${!hasHistory}" @click="${this._undo}"><span class="material-icons">undo</span></button>
                        <button class="icon-btn" style="margin-left:20px;font-size:15px;font-weight:600" title="Keyboard shortcuts (Ctrl+I)" @click="${this._openShortcuts}">?</button>
                    </div>

                    <feezal-site-manager .darkMode="${this._darkMode}"></feezal-site-manager>
                    <div id="btn-deploy-wrap">
                        <button id="btn-deploy-main"
                            class="${this.changes ? 'has-changes' : ''}"
                            ?disabled="${this.deploying || this.exporting}"
                            @click="${this._deploy}">
                            ${(this.deploying || this.exporting)
                                ? html`<div class="spinner"></div>`
                                : html`<span class="material-icons">upload_file</span>`}
                            Deploy
                        </button>
                        <button id="btn-deploy-caret"
                            class="${this.changes ? 'has-changes' : ''}"
                            ?disabled="${this.deploying || this.exporting}"
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
                        </div>
                    ` : ''}

                    <button class="icon-btn" title="${this.sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}"
                        @click="${this._collapseSidebar}">
                        <span class="material-icons">${this.sidebarVisible ? 'chevron_right' : 'chevron_left'}</span>
                    </button>
                </div>

                <div id="menu-right" style="${this.sidebarVisible ? `flex: 0 0 ${this._sidebarWidth}px` : 'display:none'}">
                    <button class="icon-btn ${this.sidebar === 'inspector' ? 'active' : ''}" title="Inspector" @click="${() => this._setSidebar('inspector')}"><span class="material-icons">tune</span></button>
                    <button class="icon-btn ${this.sidebar === 'themes' ? 'active' : ''}" title="Theme" @click="${() => this._setSidebar('themes')}"><span class="material-icons">palette</span></button>
                    <button class="icon-btn ${this.sidebar === 'viewer' ? 'active' : ''}" title="Viewer Settings" @click="${() => this._setSidebar('viewer')}"><span class="material-icons">cast</span></button>
                    <button class="icon-btn ${this.sidebar === 'editor' ? 'active' : ''}" title="Editor Settings" @click="${() => this._setSidebar('editor')}"><span class="material-icons">build</span></button>
                    <button class="icon-btn ${this.sidebar === 'assets' ? 'active' : ''}" title="Assets" @click="${() => this._setSidebar('assets')}"><span class="material-icons">perm_media</span></button>
                    <button class="icon-btn ${this.sidebar === 'palette' ? 'active' : ''}" title="Palette" @click="${() => this._setSidebar('palette')}"><span class="material-icons">widgets</span></button>
                    <button class="icon-btn ${this.sidebar === 'history' ? 'active' : ''}" title="Version history" @click="${() => this._setSidebar('history')}"><span class="material-icons">history</span></button>
                </div>
            </div>

            <div id="container">
                <feezal-palette id="palette" style="${this.paletteVisible ? '' : 'display:none'}"></feezal-palette>

                <div id="container-view">
                    <div id="container-view-menu">
                        <!-- Scroll left — hidden while search is open -->
                        <button class="tab-nav-btn" title="Scroll left"
                            ?hidden="${this._searchOpen}"
                            ?disabled="${!this._canScrollLeft}"
                            @click="${this._scrollTabsLeft}">‹</button>

                        <!-- Tab group — hidden while search is open -->
                        <sl-tab-group id="view-tabs" no-scroll-controls
                            ?hidden="${this._searchOpen}"
                            @sl-tab-show="${e => this._tabClick(e.detail.name)}"
                            @wheel="${this._onTabWheel}">
                            ${this.views.map(v => html`
                                <sl-tab slot="nav" panel="${v.name}"
                                    @dblclick="${e => this._editView(e, v.name)}"
                                    @contextmenu="${e => { e.preventDefault(); e.stopPropagation(); this._showViewCtxMenu(e.clientX, e.clientY, v.name); }}">
                                    ${v.name}
                                </sl-tab>
                                <sl-tab-panel name="${v.name}"></sl-tab-panel>
                            `)}
                        </sl-tab-group>

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
                            <button class="icon-btn dark" title="Add view" @click="${this._addView}">
                                <span class="material-icons">note_add</span>
                            </button>
                        </div>
                    </div>

                    <slot></slot>

                    <div id="grid"></div>
                    <div id="hsnap1"></div>
                    <div id="vsnap1"></div>
                    <div id="hsnap2"></div>
                    <div id="vsnap2"></div>
                </div>

                <div id="sidebar-resize"
                    style="${this.sidebarVisible ? '' : 'display:none'}"
                    @mousedown="${this._onResizeStart}"></div>
                <div id="sidebar-panels" style="${this.sidebarVisible ? `flex-basis: ${this._sidebarWidth}px` : 'display:none'}">
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
                    <feezal-sidebar-palette class="sidebar-panel" ?hidden="${this.sidebar !== 'palette'}"></feezal-sidebar-palette>
                    <feezal-sidebar-viewer class="sidebar-panel" ?hidden="${this.sidebar !== 'viewer'}"></feezal-sidebar-viewer>
                    <feezal-sidebar-editor class="sidebar-panel"
                        ?hidden="${this.sidebar !== 'editor'}"
                        .themeMode="${this._themeMode}"
                        .selectionColor="${this.selectionColor}"
                        .gridColor="${this.gridColor}"
                        .gridSize="${this.gridSize}"
                        .gridVisible="${this.gridVisible}"
                        .snapping="${this.snapping}"
                        @theme-mode-changed="${e => this._setThemeMode(e.detail.value)}"
                        @selection-color-changed="${e => { this.selectionColor = e.detail.value; localStorage.setItem('selectionColor', this.selectionColor); }}"
                        @grid-color-changed="${e => { this.gridColor = e.detail.value; localStorage.setItem('gridColor', this.gridColor); }}"
                        @grid-size-changed="${e => { this.gridSize = e.detail.value; localStorage.setItem('gridSize', this.gridSize); }}"
                        @grid-visible-changed="${e => { this.gridVisible = e.detail.value; localStorage.setItem('gridVisible', this.gridVisible); }}"
                        @snapping-changed="${e => { this.snapping = e.detail.value; localStorage.setItem('snapping', this.snapping); }}">
                    </feezal-sidebar-editor>
                    <feezal-sidebar-history class="sidebar-panel"
                        ?hidden="${this.sidebar !== 'history'}">
                    </feezal-sidebar-history>
                </div>
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
                    <div class="view-ctx-item"
                        @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._editView(null, n); }}">
                        Rename
                    </div>
                    <div class="view-ctx-item"
                        @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._duplicateView(n); }}">
                        Duplicate
                    </div>
                    <div class="view-ctx-sep"></div>
                    <div class="view-ctx-item danger"
                        @click="${() => { const n = this._viewCtx.name; this._viewCtx = null; this._confirmDeleteView(n); }}">
                        Delete
                    </div>
                </div>
            ` : ''}
        `;
    }

    connectedCallback() {
        super.connectedCallback();

        // Apply dark mode root vars immediately so Shoelace dropdowns look correct from the start.
        this._syncDarkModeRoot();

        // Hash-based routing
        this._navView = location.hash.replace(/^#\/?/, '') || '';
        this._onHashChange = () => {
            this._navView = location.hash.replace(/^#\/?/, '');
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

        // Fetch version info (non-blocking — best effort).
        fetch('/api/version')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                this._version = data.version ?? null;
            })
            .catch(() => {});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this._onHashChange);
        this._darkMq?.removeEventListener('change', this._darkMqHandler);
        document.removeEventListener('copy',  this._onDocCopy);
        document.removeEventListener('paste', this._onDocPaste);
        document.removeEventListener('cut',   this._onDocCut);
        document.removeEventListener('pointerdown', this._onDocPointerActionMenu, true);
    }

    // -------------------------------------------------------------------
    // Tab bar scroll & view search (U11 / U12)

    _getNavEl() {
        const tg = this.shadowRoot?.querySelector('#view-tabs');
        return tg?.shadowRoot?.querySelector('.tab-group__nav') ?? null;
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
            const tab = this.shadowRoot.querySelector(`sl-tab[panel="${name}"]`);
            if (tab) tab.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
            this._updateScrollState();
        });
    }

    // -------------------------------------------------------------------
    // Navigation

    _setView(name) {
        this._navView = name;
        location.hash = '/' + name;
        if (feezal.site) {
            feezal.site.view = name;
        }
    }

    _tabClick(name) {
        this._setView(name);
        feezal.editor.selectElement(feezal.getView(name));
    }

    // -------------------------------------------------------------------
    // Palette & Sidebar toggle

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
        if (this._history.length > 1) {
            this._history.pop();
            const prevHtml = this._history[this._history.length - 1];
            this.requestUpdate();
            this.shadowRoot.querySelector('feezal-sidebar-inspector').restoreViews(prevHtml);
        }
    }

    _openShortcuts() {
        const inspector = this.shadowRoot.querySelector('feezal-sidebar-inspector');
        if (inspector) inspector._shortcutsOpen = true;
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
        const path = feezal.siteName === 'default' ? '/view/' : '/view/' + feezal.siteName + '/';
        window.open(path, 'feezal-' + feezal.siteName);
    }

    _deploy() {
        this.deploying = true;
        const deployTpl = document.createElement('template');
        deployTpl.innerHTML = feezal.site.outerHTML;
        deployTpl.content.querySelector('feezal-site').removeAttribute('tabindex');
        this._clean(deployTpl.content);

        const {connection, site} = this.shadowRoot.querySelector('feezal-sidebar-viewer');
        const themesSidebar = this.shadowRoot.querySelector('feezal-sidebar-themes');
        const viewer = {
            theme: themesSidebar ? themesSidebar.theme : null,
            themeOverrides: themesSidebar ? themesSidebar.themeOverrides : {},
            classes: themesSidebar ? themesSidebar.classes : {}
        };
        const elements = [...deployTpl.content.querySelectorAll('*')].map(el => el.tagName);
        const html = [...deployTpl.content.childNodes].map(n => n.outerHTML).join('\n');

        const siteData = {...(site || {})};
        siteData.name = feezal.siteName;

        feezal.connection.deploy({html, elements, connection, site: siteData, viewer}, () => {
            this.changes = false;
            feezal.hasChanges = false;
            this.deploying = false;
        });
    }

    _export() {
        const viewerSidebar = this.shadowRoot.querySelector('feezal-sidebar-viewer');
        const uri = viewerSidebar && viewerSidebar.connection && viewerSidebar.connection.uri;
        if (uri && /^mqtts?:\/\//.test(uri)) {
            this.shadowRoot.querySelector('#exporterrordialog').show();
            return;
        }

        this.exporting = true;
        const a = document.createElement('a');
        a.href = `/api/sites/${feezal.siteName}/export`;
        a.download = `${feezal.siteName}.zip`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Reset state after a short delay — we can't detect download completion
        setTimeout(() => { this.exporting = false; }, 2000);
    }

    // -------------------------------------------------------------------
    // Edit utilities

    _removeClassesFromChildren(parent, classes) {
        for (const cl of classes) {
            parent.querySelectorAll('.' + cl).forEach(el => el.classList.remove(cl));
        }
    }

    _clean(container) {
        this._removeClassesFromChildren(container, ['feezal-editable', 'feezal-selected', 'iron-selected', 'ds-selectable']);
        container.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        // Strip theme classes from feezal-site — theme is stored in viewer.json, not views.html.
        const site = container.querySelector('feezal-site');
        if (site) {
            [...site.classList].filter(c => c.startsWith('feezal-theme-')).forEach(c => site.classList.remove(c));
            // Remove leftover empty class attribute so the stored HTML stays clean.
            if (!site.className) site.removeAttribute('class');
        }
    }

    _clone(element) {
        const clone = element.cloneNode(false);
        clone.style.cursor = '';
        return clone;
    }

    // -------------------------------------------------------------------
    // Copy / Paste / Cut

    _clickCopy()  { document.execCommand('copy'); }
    _clickPaste() { this._pasteInternal(); }
    _clickCut()   { document.execCommand('cut'); }

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
        if (/^\s*<feezal-element-/.test(htmlData)) {
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
        feezal.editor._deleteElems();
        this.viewSelected = true;
    }

    // -------------------------------------------------------------------
    // View management

    _showViewCtxMenu(x, y, name) {
        this._viewCtx = {x, y, name};
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
}

window.customElements.define('feezal-app-editor', FeezalAppEditor);
