import interact from 'interactjs';
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';

import './feezal-pwa-icon-dialog.js';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);

function ext(p) { return (p.split('.').pop() || '').toLowerCase(); }
function isImage(p) { return IMAGE_EXTS.has(ext(p)); }
function fileIcon(p) {
    if (IMAGE_EXTS.has(ext(p))) return 'image';
    if (AUDIO_EXTS.has(ext(p))) return 'audio_file';
    if (VIDEO_EXTS.has(ext(p))) return 'video_file';
    return 'insert_drive_file';
}
function basename(p) { return p.split('/').pop(); }
function dirname(p) { const parts = p.split('/'); parts.pop(); return parts.join('/'); }
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

class FeezalSidebarAssets extends LitElement {
    static properties = {
        _category:      {state: true},  // 'global' | 'site'
        _folder:        {state: true},  // current folder path e.g. '' or 'images'
        _assets:        {state: true},  // {global: [{path,size,modified},...], site: [...]}
        _uploading:     {state: true},
        _renaming:      {state: true},  // path being renamed, or null
        _renameVal:     {state: true},
        _dragging:      {state: true},  // path currently being dragged
        _dlgConfirm:    {state: true},  // {message, resolve} | null
        _dlgPrompt:     {state: true},  // {message, resolve} | null
        _dlgPromptVal:  {state: true},  // current value in prompt input
        _error:         {state: true},  // last upload error, or null
        _ctxMenu:       {state: true},  // {file, x, y} | null
        _preview:       {state: true},  // {src, name} | null
        _previewOpen:   {state: true},  // controls preview dialog
        _viewMode:      {state: true},  // 'thumbs' | 'list' | 'details'
        _sortKey:       {state: true},  // 'name' | 'type' | 'size' | 'date'
        _sortDir:       {state: true},  // 'asc' | 'desc'
        _search:        {state: true},  // search string, '' = inactive
        _thumbSize:     {state: true},  // tile px size in thumbs mode
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            background: var(--feezal-bg, #fff); box-sizing: border-box; overflow: hidden;
            font-size: 13px; color: var(--feezal-color, #333);
        }

        /* ── Site/Global tab bar ─────────────────────────────────────── */
        sl-tab-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        /* 39px tab + 2px nav track = 41px — matches the .ftab view tab bar
           left of the sidebar (same rule in the other sidebar panels). */
        sl-tab::part(base) { font-size: 14px; padding: 0 10px; height: 39px; }
        sl-tab-panel { height: 100%; }
        /* The panel body is the flex column that used to be the host: header,
           search row, breadcrumb and infobar fixed, the file zone scrolling. */
        sl-tab-panel::part(base) {
            height: 100%; display: flex; flex-direction: column;
            overflow: hidden; padding: 0; box-sizing: border-box;
        }

        /* ── Tab-bar action buttons (view mode / mkdir / upload) ─────── */
        .nav-actions {
            margin-left: auto; align-self: center; margin-right: 6px;
            display: flex; align-items: center; gap: 4px; flex-shrink: 0;
        }
        .upload-btn {
            width: 28px; height: 28px; border-radius: 4px; border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-color, #555); transition: background 0.15s;
        }
        .upload-btn:hover { background: var(--feezal-btn-hover, var(--sl-color-primary-50, #e0f2fe)); }
        .upload-btn .material-icons { font-size: 18px; }
        .mkdir-btn { width: 28px; height: 28px; border-radius: 4px; border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5); cursor: pointer; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-color, #555);
        }
        .mkdir-btn:hover { background: var(--feezal-btn-hover, var(--sl-color-primary-50, #e0f2fe)); }
        .mkdir-btn .material-icons { font-size: 18px; flex-shrink: 0; }
        .upload-btn { overflow: hidden; }
        .upload-btn .material-icons { flex-shrink: 0; }
        #file-input { display: none; }

        /* ── Breadcrumb ──────────────────────────────────────────────── */
        .breadcrumb {
            display: flex; align-items: center; padding: 4px 10px; gap: 2px;
            flex-shrink: 0; border-bottom: 1px solid var(--feezal-border, #eee);
            flex-wrap: wrap; min-height: 28px;
        }
        .crumb { cursor: pointer; color: var(--sl-color-primary-600, #0284c7); font-size: 12px; }
        .crumb:hover { text-decoration: underline; }
        .crumb-sep { color: #aaa; font-size: 12px; }

        /* ── Drop zone ───────────────────────────────────────────────── */
        .drop-zone {
            flex: 1; overflow-y: auto; padding: 8px;
            display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 80px), 1fr));
            gap: 6px; align-content: start;
        }
        .drop-zone.drag-over { outline: 2px dashed var(--sl-color-primary-500, #0ea5e9); outline-offset: -4px; }

        /* ── Tiles ───────────────────────────────────────────────────── */
        .tile {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            padding: 6px 4px; border-radius: 6px; border: 1px solid transparent;
            cursor: default; position: relative; box-sizing: border-box;
            transition: background 0.1s;
        }
        .tile:hover { background: var(--feezal-bg-sub, #f0f0f0); border-color: var(--feezal-border, #ddd); }
        .tile.folder { cursor: pointer; }
        .tile.folder.drag-target { background: var(--feezal-bg-sub, #f0f0f0); border-color: var(--feezal-border, #ddd); outline: 2px dashed var(--sl-color-primary-400, #38bdf8); }
        .list-row.drag-target, .detail-row.drag-target { background: var(--feezal-bg-sub, #e8f4fb); outline: 2px dashed var(--sl-color-primary-400, #38bdf8); outline-offset: -2px; }

        .tile-thumb {
            width: calc(var(--thumb-size, 80px) - 16px); height: calc((var(--thumb-size, 80px) - 16px) * 0.75);
            object-fit: contain; border-radius: 3px; display: block;
        }
        .tile-icon { font-size: calc(var(--thumb-size, 80px) * 0.48); color: var(--feezal-color, #888); line-height: 1; }
        .tile-icon.folder-icon { color: var(--sl-color-primary-500, #0ea5e9); }

        .tile-name {
            font-size: 11px; text-align: center; word-break: break-all;
            max-width: calc(var(--thumb-size, 80px) - 4px); line-height: 1.3; color: var(--feezal-color, #333);
        }
        .tile-name-input {
            font-size: 11px; width: calc(var(--thumb-size, 80px) - 8px); text-align: center;
            border: 1px solid var(--sl-color-primary-400, #38bdf8); border-radius: 2px;
            outline: none; padding: 1px 2px;
        }

        /* tile-actions / tile-btn are kept for folder delete button */
        .tile-actions {
            position: absolute; top: 2px; right: 2px;
            display: none; gap: 2px;
        }
        .tile:hover .tile-actions { display: flex; }
        .tile-btn {
            width: 18px; height: 18px; border-radius: 3px; border: none;
            background: rgba(0,0,0,0.08); cursor: pointer; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .tile-btn:hover { background: rgba(0,0,0,0.18); }
        .tile-btn .material-icons { font-size: 13px; color: var(--feezal-color, #555); }
        .tile-btn.del:hover { background: rgba(220,0,0,0.15); }
        .tile-btn.del .material-icons { color: #c00; }

        /* ── Tile ⋮ menu button ───────────────────────────────────────── */
        .tile-menu-btn {
            position: absolute; top: 2px; right: 2px;
            display: none; width: 20px; height: 20px; border-radius: 3px; border: none;
            background: rgba(0,0,0,0.08); cursor: pointer; padding: 0;
            align-items: center; justify-content: center;
            color: var(--feezal-color, #555);
        }
        .tile:hover .tile-menu-btn { display: flex; }
        .tile-menu-btn:hover { background: rgba(0,0,0,0.18); }
        .tile-menu-btn .material-icons { font-size: 16px; color: inherit; }

        /* ── Context menu ─────────────────────────────────────────────── */
        .ctx-backdrop { position: fixed; inset: 0; z-index: 9998; }
        .ctx-menu {
            position: fixed; z-index: 9999;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ddd);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            padding: 4px 0; min-width: 150px;
        }
        .ctx-item {
            display: flex; align-items: center; gap: 8px;
            padding: 7px 14px; font-size: 13px;
            cursor: pointer; color: var(--feezal-color, #333);
            user-select: none;
        }
        .ctx-item:hover { background: var(--feezal-bg-sub, #f0f0f0); }
        .ctx-item.del { color: #c00; }
        .ctx-item .material-icons { font-size: 16px; color: inherit; }

        /* N33: hover fly-out submenu (Set as background → Current/All views) */
        .ctx-item.has-sub { position: relative; }
        .ctx-item.has-sub .sub-arrow { margin-left: auto; font-size: 16px; color: #999; }
        .ctx-submenu {
            display: none;
            position: absolute; top: -5px; left: 100%;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ddd);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            padding: 4px 0; min-width: 130px;
        }
        .ctx-item.has-sub:hover > .ctx-submenu { display: block; }
        .ctx-submenu.left { left: auto; right: 100%; }

        /* draggable image tiles (thumbs, list, and details modes) */
        .tile.image-tile { cursor: grab; touch-action: none; }
        .tile.image-tile:active { cursor: grabbing; }
        .tile.image-tile.dragging { opacity: 0.45; outline: 2px dashed var(--sl-color-primary-400, #38bdf8); outline-offset: -2px; }
        .list-row.image-tile { cursor: grab; touch-action: none; }
        .list-row.image-tile:active { cursor: grabbing; }
        .detail-row.image-tile { cursor: grab; touch-action: none; }
        .detail-row.image-tile:active { cursor: grabbing; }

        /* Keep grabbing cursor everywhere while a tile is being dragged */
        :host(.tile-dragging) * { cursor: grabbing !important; }

        /* ── Empty state ─────────────────────────────────────────────── */
        .empty { grid-column: 1/-1; text-align: center; color: #aaa; padding: 24px 8px; font-size: 12px; }
        .uploading-overlay { grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; padding: 8px; }

        /* ── Info bar ────────────────────────────────────────────────── */
        .infobar {
            padding: 4px 10px; font-size: 11px; color: #aaa;
            border-top: 1px solid var(--feezal-border, #eee); flex-shrink: 0;
        }

        /* ── View mode toggle ────────────────────────────────────────── */
        .view-btn {
            width: 26px; height: 26px; border-radius: 4px; border: 1px solid transparent;
            background: none; cursor: pointer; padding: 0;
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-color, #666); transition: background 0.1s;
        }
        .view-btn.active {
            background: var(--feezal-bg-sub, #f0f0f0);
            border-color: var(--feezal-border, #ddd);
            color: var(--sl-color-primary-600, #0284c7);
        }
        .view-btn:hover:not(.active) { background: var(--feezal-bg-sub, #f0f0f0); }
        .view-btn .material-icons { font-size: 17px; }

        /* ── Search row ──────────────────────────────────────────────── */
        .search-row {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 10px; border-bottom: 1px solid var(--feezal-border, #eee);
            flex-shrink: 0;
        }
        .search-input {
            flex: 1; padding: 6px 8px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5);
            color: var(--feezal-color, #333); font-size: 12px; outline: none;
        }
        .search-input:focus { border-color: var(--sl-color-primary-600, #0284c7); }
        .search-clear {
            background: none; border: none; cursor: pointer; padding: 2px;
            color: #999; display: flex; align-items: center;
        }
        .search-clear:hover { color: var(--feezal-color, #333); }

        /* ── Thumb size slider ───────────────────────────────────────── */
        .thumb-slider-row {
            display: flex; align-items: center; gap: 4px;
            padding: 1px 10px 2px; border-bottom: 1px solid var(--feezal-border, #eee);
            flex-shrink: 0;
        }
        .thumb-slider-row .material-icons { font-size: 12px; color: #aaa; flex-shrink: 0; }
        .thumb-slider { flex: 1; accent-color: var(--sl-color-primary-600, #0284c7); cursor: pointer; height: 14px; }

        /* ── List mode ───────────────────────────────────────────────── */
        .list-zone {
            flex: 1; overflow-y: auto; display: flex; flex-direction: column;
        }
        .list-row {
            display: flex; align-items: center; gap: 8px;
            padding: 5px 10px; cursor: default; border-bottom: 1px solid transparent;
            transition: background 0.1s;
        }
        .list-row:hover { background: var(--feezal-bg-sub, #f0f0f0); }
        .list-row .material-icons { font-size: 18px; flex-shrink: 0; color: var(--feezal-color, #888); }
        .list-row .material-icons.folder-icon { color: var(--sl-color-primary-500, #0ea5e9); }
        .list-row-name { flex: 1; font-size: 13px; color: var(--feezal-color, #333); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* visibility:hidden keeps the button in layout so hover never changes row height */
        .list-row-menu { background: none; border: none; cursor: pointer; padding: 1px 3px; color: #bbb; visibility: hidden; }
        .list-row:hover .list-row-menu { visibility: visible; }
        .list-row-menu:hover { color: var(--feezal-color, #555); }
        .list-row-menu .material-icons { font-size: 15px; }

        /* ── Details mode ────────────────────────────────────────────── */
        .details-header {
            display: grid; grid-template-columns: 1fr 60px 70px 90px 20px;
            padding: 3px 10px; font-size: 12px; font-weight: 600;
            color: #aaa; border-bottom: 1px solid var(--feezal-border, #eee);
            flex-shrink: 0;
        }
        .details-header span { cursor: pointer; user-select: none; }
        .details-header span:hover { color: var(--feezal-color, #333); }
        .details-header span.sort-active { color: var(--sl-color-primary-600, #0284c7); }
        .detail-row {
            display: grid; grid-template-columns: 1fr 60px 70px 90px 20px;
            align-items: center; padding: 4px 10px; font-size: 13px;
            border-bottom: 1px solid transparent; transition: background 0.1s; cursor: default;
        }
        .detail-row:hover { background: var(--feezal-bg-sub, #f0f0f0); }
        .detail-row .name-cell { display: flex; align-items: center; gap: 5px; overflow: hidden; }
        .detail-row .name-cell .material-icons { font-size: 15px; flex-shrink: 0; color: #888; }
        .detail-row .name-cell .material-icons.folder-icon { color: var(--sl-color-primary-500, #0ea5e9); }
        .detail-row .cell { color: var(--feezal-color, #666); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* visibility:hidden keeps the cell in the grid so hover never changes row height */
        .detail-row .menu-cell { display: flex; justify-content: flex-end; visibility: hidden; }
        .detail-row:hover .menu-cell { visibility: visible; }
        .detail-row-menu { background: none; border: none; cursor: pointer; padding: 0 2px; color: #bbb; }
        .detail-row-menu:hover { color: var(--feezal-color, #555); }
        .detail-row-menu .material-icons { font-size: 14px; }

        /* ── Error bar ────────────────────────────────────────────────── */
        .error-bar {
            padding: 5px 10px; font-size: 12px; color: #c00;
            background: rgba(220,0,0,0.07); border-bottom: 1px solid rgba(220,0,0,0.18);
            flex-shrink: 0; display: flex; align-items: center; gap: 6px;
        }
        .error-bar span { flex: 1; }
        .error-dismiss {
            background: none; border: none; cursor: pointer;
            color: #c00; font-size: 16px; line-height: 1; padding: 0 2px;
        }

        /* ── Dialog theme (light + dark) ──────────────────────────────── */
        /* Panel background/border follow --feezal-bg/--feezal-border so the
           dialog is correct in both light and dark editor modes without a
           class toggle. feezal-app-editor sets these vars in dark mode. */
        sl-dialog {
            --sl-panel-background-color: var(--feezal-bg, #fff);
            --sl-panel-border-color: var(--feezal-border, #e0e0e0);
            /* Canvas elements (e.g. live-element overlays) can have z-index > Shoelace's
               default of 700. Force all dialogs in this component above them. */
            --sl-z-index-dialog: 10000;
        }
        sl-dialog::part(panel) { color: var(--feezal-color, #333); }
        /* Explicitly bind sl-input vars so the field adopts the theme even
           when cascade from the shadow host is insufficient. */
        sl-dialog sl-input {
            --sl-input-background-color: var(--feezal-bg-sub, #fff);
            --sl-input-border-color: var(--feezal-border, #d0d0d0);
            --sl-input-color: var(--feezal-color, #333);
            --sl-input-label-color: var(--feezal-color, #555);
        }
        /* Default (cancel) buttons */
        sl-dialog sl-button[variant="default"]::part(base) {
            background: var(--feezal-bg-sub, #f5f5f5);
            border-color: var(--feezal-border, #d0d0d0);
            color: var(--feezal-color, #333);
        }
    `;

    constructor() {
        super();
        this._category     = 'site';
        this._folder       = '';
        this._assets       = {global: [], site: []};
        this._uploading    = false;
        this._renaming     = null;
        this._renameVal    = '';
        this._dragging     = null;
        this._dlgConfirm   = null;
        this._dlgPrompt    = null;
        this._dlgPromptVal = '';
        this._error        = null;
        this._interactable = null;
        this._ctxMenu      = null;
        this._preview      = null;
        this._previewOpen  = false;
        this._viewMode     = localStorage.getItem('feezal-assets-viewmode') || 'thumbs';
        this._sortKey      = 'name';
        this._sortDir      = 'asc';
        this._search       = '';
        this._thumbSize    = parseInt(localStorage.getItem('feezal-assets-thumbsize') || '80', 10);
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
        // Register the drag handler once after first render (same pattern as
        // feezal-palette). CSS selector interactables are evaluated at drag-start
        // time, so tiles don't need to exist at registration time and we never
        // need to unset/re-register on subsequent renders.
        this.updateComplete.then(() => {
            if (feezal.editor) this._initDrag();
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._interactable) {
            this._interactable.unset();
            this._interactable = null;
        }
    }

    async _load() {
        const site = feezal.siteName || 'default';
        try {
            const res = await fetch(`/api/assets/${site}`);
            if (res.ok) this._assets = await res.json();
        } catch { /* network error */ }
    }

    // ── Computed helpers ───────────────────────────────────────────────────

    get _currentList() {
        const list = this._assets[this._category] || [];
        const prefix = this._folder ? this._folder + '/' : '';
        // Items directly in current folder
        return list
            .filter(f => {
                if (!f.path.startsWith(prefix)) return false;
                const rest = f.path.slice(prefix.length);
                // No further slash = direct child
                return !rest.includes('/');
            })
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    get _currentFolders() {
        const list = this._assets[this._category] || [];
        // Server includes explicit dir lists (covers empty folders).
        const dirs = this._assets[this._category + 'Dirs'] || [];
        const prefix = this._folder ? this._folder + '/' : '';
        const seen = new Set();
        // Explicit directory entries first (includes newly created empty folders)
        dirs.forEach(d => {
            if (!d.startsWith(prefix)) return;
            const rest = d.slice(prefix.length);
            if (rest && !rest.includes('/')) seen.add(rest);
        });
        // Also derive from file paths for belt-and-suspenders
        list.forEach(f => {
            if (!f.path.startsWith(prefix)) return;
            const rest = f.path.slice(prefix.length);
            const slash = rest.indexOf('/');
            if (slash !== -1) seen.add(rest.slice(0, slash));
        });
        return [...seen].sort();
    }

    // ── Actions ────────────────────────────────────────────────────────────

    async _upload(files) {
        const site = feezal.siteName || 'default';
        this._uploading = true;
        this._error = null;
        try {
            for (const file of files) {
                const base = this._folder ? this._folder + '/' + file.name : file.name;
                const res = await fetch(
                    `/api/assets/${site}?category=${this._category}&path=${encodeURIComponent(base)}`,
                    {method: 'POST', headers: {'Content-Type': file.type || 'application/octet-stream'}, body: file}
                );
                if (!res.ok) {
                    const body = await res.json().catch(() => ({error: res.statusText}));
                    this._error = `Upload failed for "${file.name}": ${body.error || res.status}`;
                    console.error('[assets] upload error', file.name, body);
                }
            }
        } catch (err) {
            this._error = 'Upload error: ' + err.message;
            console.error('[assets] upload error', err);
        } finally {
            this._uploading = false;
        }
        await this._load();
    }

    async _delete(filePath) {
        const site = feezal.siteName || 'default';
        const fullPath = this._folder ? this._folder + '/' + filePath : filePath;
        if (!await this._confirm(`Delete "${basename(fullPath)}"?`)) return;
        await fetch(`/api/assets/${site}?category=${this._category}&path=${encodeURIComponent(fullPath)}`, {method: 'DELETE'});
        await this._load();
    }

    async _deleteFolder(folderName) {
        const site = feezal.siteName || 'default';
        const fullPath = this._folder ? this._folder + '/' + folderName : folderName;
        if (!await this._confirm(`Delete folder "${folderName}" and all its contents?`)) return;
        await fetch(`/api/assets/${site}?category=${this._category}&path=${encodeURIComponent(fullPath)}`, {method: 'DELETE'});
        await this._load();
    }

    _startRename(filePath) {
        this._renaming  = filePath;
        this._renameVal = basename(filePath);
        this.updateComplete.then(() => {
            this.shadowRoot.querySelector('.tile-name-input')?.focus();
        });
    }

    async _commitRename(filePath) {
        if (!this._renaming) return;
        this._renaming = null;
        const newName    = this._renameVal.trim();
        if (!newName || newName === basename(filePath)) return;
        const site       = feezal.siteName || 'default';
        const dir        = dirname(filePath);
        const newPath    = dir ? dir + '/' + newName : newName;
        await fetch(`/api/assets/${site}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({category: this._category, oldPath: filePath, newPath})
        });
        await this._load();
    }

    async _mkdir() {
        const name = await this._prompt('Folder name');
        if (!name) return;
        const site     = feezal.siteName || 'default';
        const fullPath = this._folder ? this._folder + '/' + name : name;
        await fetch(`/api/assets/${site}/mkdir`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({category: this._category, path: fullPath})
        });
        await this._load();
    }

    // ── Dialog helpers ─────────────────────────────────────────────────────

    _confirm(message) {
        return new Promise(resolve => {
            this._dlgConfirm = {message, resolve};
        });
    }

    _prompt(label) {
        this._dlgPromptVal = '';
        return new Promise(resolve => {
            this._dlgPrompt = {label, resolve};
        });
    }

    _submitPrompt() {
        if (!this._dlgPrompt) return;
        const val = this._dlgPromptVal.trim();
        if (!val) return;
        this._dlgPrompt.resolve(val);
        this._dlgPrompt = null;
    }

    // ── Drag-to-canvas ─────────────────────────────────────────────────────

    _assetSrc(filePath) {
        const site = feezal.siteName || 'default';
        return this._category === 'global'
            ? `/assets/global/${filePath}`
            : `/assets/${site}/${filePath}`;
    }

    /** A9: open the PWA icon crop dialog preloaded with this asset. */
    async _setAsPwaIcon(filePath) {
        try {
            const res = await fetch(this._assetSrc(filePath));
            if (!res.ok) throw new Error('could not load asset');
            const blob = await res.blob();
            const file = new File([blob], basename(filePath), {type: blob.type});
            this.renderRoot.querySelector('feezal-pwa-icon-dialog')
                .open({site: feezal.siteName, source: file});
        } catch (err) {
            console.warn('set-as-pwa-icon failed:', err.message);
        }
    }

    /**
     * N33: apply an image asset as a view background. Global assets are
     * copied into the site first (copy-on-use, same contract as drag-drop —
     * the server suffixes on collision) so the site stays self-contained;
     * on copy failure the global URL is kept as a working fallback.
     * scope: 'current' | 'all'.
     */
    async _setAsBackground(filePath, scope) {
        let url = this._assetSrc(filePath);
        if (this._category === 'global') {
            const site = feezal.siteName || 'default';
            try {
                const res = await fetch(`/api/assets/${site}/transfer`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        srcCategory: 'global',
                        srcPath: filePath,
                        destCategory: 'site',
                        destPath: filePath,
                        copy: true,
                        unique: true
                    })
                });
                if (res.ok) {
                    const {path} = await res.json();
                    if (path) url = `/assets/${site}/${path}`;
                    await this._load();   // reflect the new file in the Site tab
                }
            } catch { /* keep the global URL as a working fallback */ }
        }
        const views = scope === 'all'
            ? [...(feezal.views ?? [])]
            : [feezal.view].filter(Boolean);
        for (const view of views) {
            view.style.backgroundImage    = `url('${url}')`;
            view.style.backgroundSize     = 'cover';
            view.style.backgroundPosition = 'center';
            view.style.backgroundRepeat   = 'no-repeat';
        }
        feezal.app.change();
        // Refresh the style inspector in case an affected view is selected —
        // it only re-reads on selection change (same nudge as B15).
        const insp = feezal.editor;
        if (insp && Array.isArray(insp.selectedElems) && insp.selectedElems.some(el => views.includes(el))) {
            insp.selectedElems = [...insp.selectedElems];
        }
    }

    _onPwaIconSaved() {
        // Setting an icon implies wanting the PWA — switch the toggle on.
        const viewerSidebar = feezal.app?.shadowRoot?.querySelector('feezal-sidebar-viewer');
        let enabled = false;
        if (viewerSidebar && !viewerSidebar.pwa) {
            viewerSidebar.pwa = true;
            feezal.app.change(true);
            enabled = true;
        }
        viewerSidebar?._loadPwaIcons?.();
        const alert = Object.assign(document.createElement('sl-alert'), {
            variant: 'success',
            closable: true,
            duration: 4000,
            innerHTML: enabled
                ? 'PWA icon set — PWA support was enabled for this site (deploy to apply).'
                : 'PWA icon updated (deploy to apply).',
        });
        document.body.append(alert);
        alert.toast();
    }

    _initDrag() {
        this._interactable = interact('.image-tile', {context: this.renderRoot})
            .draggable({
                cursorChecker: () => null,
                onstart: event => {
                    // Record what is being dragged. The canvas element is created
                    // lazily in onmove only when the pointer first enters the view,
                    // so that dragging within the sidebar (e.g. onto a folder)
                    // never touches the canvas at all.
                    this._dragSrc  = event.target.dataset.src;
                    this._dragFile = event.target.dataset.file;
                    this._dragCategory = this._category;   // source tab (for copy-on-use of globals)
                    this._dragTile = event.target;
                    this._dragTile.classList.add('dragging');
                    this.classList.add('tile-dragging');
                    // Create a floating ghost thumbnail that follows the cursor.
                    const ghost = document.createElement('div');
                    ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;width:64px;height:64px;border-radius:6px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.3);border:2px solid #38bdf8;transform:translate(-50%,-50%);opacity:0.9;';
                    ghost.style.left = event.clientX + 'px';
                    ghost.style.top  = event.clientY + 'px';
                    const img = document.createElement('img');
                    img.src = feezal.resolveAsset ? feezal.resolveAsset(this._dragSrc) : this._dragSrc;
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                    img.draggable = false;
                    ghost.appendChild(img);
                    document.body.appendChild(ghost);
                    this._ghost = ghost;
                },
                onmove: event => {
                    const vr = feezal.view ? feezal.view.getBoundingClientRect() : null;
                    const overView = vr
                        ? event.clientX >= vr.left && event.clientX <= vr.right &&
                          event.clientY >= vr.top  && event.clientY <= vr.bottom
                        : false;

                    if (this._dragElem) {
                        if (!overView) {
                            // Pointer left the canvas — destroy the element and revert
                            // to sidebar drag mode so the user can still drop onto folders.
                            interact(this._dragElem).unset();
                            this._dragElem.remove();
                            delete this._dragElem;
                            this._updateFolderHighlight(event.clientX, event.clientY);
                            // Ghost re-appears now that we're back in sidebar mode.
                            if (this._ghost) {
                                this._ghost.style.display = '';
                                this._ghost.style.left = event.clientX + 'px';
                                this._ghost.style.top  = event.clientY + 'px';
                            }
                        } else {
                            if (event.dx) this._dragElem.style.left = (parseFloat(this._dragElem.style.left) + event.dx) + 'px';
                            if (event.dy) this._dragElem.style.top  = (parseFloat(this._dragElem.style.top)  + event.dy) + 'px';
                        }
                        return;
                    }

                    // Move ghost while in sidebar mode.
                    if (this._ghost) {
                        this._ghost.style.left = event.clientX + 'px';
                        this._ghost.style.top  = event.clientY + 'px';
                    }

                    if (!feezal.view) return;
                    if (overView) {
                        // Entering the canvas — hide ghost, let the canvas element be the visual.
                        if (this._ghost) this._ghost.style.display = 'none';
                        this._clearFolderHighlight();
                        this._dragElem = document.createElement('feezal-element-basic-image');
                        this._dragElem.setAttribute('src', this._dragSrc);
                        feezal.view.append(this._dragElem);
                        feezal.editor.initElem(this._dragElem, true);
                        this._dragElem.style.outlineWidth = '2px';
                        const r = this._dragElem.getBoundingClientRect();
                        this._dragElem.style.top  = (event.clientY - vr.y - r.height / 2) + 'px';
                        this._dragElem.style.left = (event.clientX - vr.x - r.width  / 2) + 'px';
                    } else {
                        this._updateFolderHighlight(event.clientX, event.clientY);
                    }
                },
                onend: () => {
                    if (this._ghost) { this._ghost.remove(); delete this._ghost; }
                    if (this._dragTile) { this._dragTile.classList.remove('dragging'); delete this._dragTile; }
                    this.classList.remove('tile-dragging');
                    const targetFolder = this._hoverFolder;
                    this._clearFolderHighlight();
                    if (this._dragElem) {
                        let x = parseFloat(this._dragElem.style.left);
                        const y = parseFloat(this._dragElem.style.top);
                        if (x + this._dragElem.getBoundingClientRect().width < 0) {
                            this._dragElem.remove();
                        } else {
                            if (x < 0) x = 0;
                            this._dragElem.style.left = x + 'px';
                            this._dragElem.style.top  = y + 'px';
                            feezal.editor.selectElement(this._dragElem);
                            this._dragElem.style.outlineWidth = null;
                            // Copy-on-use (A14): a global asset placed on a view is
                            // copied into this site's assets and the src repointed to
                            // the site copy, so the site stays self-contained. Marks
                            // dirty when the copy resolves; falls back to the global
                            // src (still renders) if the copy fails.
                            if (this._dragCategory === 'global') {
                                this._localiseGlobalAsset(this._dragFile, this._dragElem);
                            } else {
                                feezal.app.change();
                            }
                        }
                        delete this._dragElem;
                    } else if (targetFolder != null) {
                        this._moveFile(this._dragFile, targetFolder);
                    }
                    delete this._dragSrc;
                    delete this._dragFile;
                    delete this._dragCategory;
                }
            });
    }

    _updateFolderHighlight(clientX, clientY) {
        const tiles = [...this.renderRoot.querySelectorAll('[data-folder]')];
        let found = null;
        for (const t of tiles) {
            const r = t.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                found = t;
                break;
            }
        }
        const target = found ? found.dataset.folder : null;
        if (this._hoverFolder === target) return;
        tiles.forEach(t => t.classList.remove('drag-target'));
        this._hoverFolder = target;
        if (found) found.classList.add('drag-target');
    }

    _clearFolderHighlight() {
        this.renderRoot.querySelectorAll('[data-folder].drag-target')
            .forEach(t => t.classList.remove('drag-target'));
        delete this._hoverFolder;
    }

    async _moveFile(filePath, targetFolder) {
        if (!filePath) return;
        const newPath = (targetFolder ? targetFolder + '/' : '') + basename(filePath);
        if (filePath === newPath) return;
        const site = feezal.siteName || 'default';
        await fetch(`/api/assets/${site}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({category: this._category, oldPath: filePath, newPath})
        });
        await this._load();
    }

    // ── Drop zone (upload via drag-from-OS) ────────────────────────────────

    _onDropZoneDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
    _onDropZoneDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
    _onDropZoneDrop(e)  {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const files = [...e.dataTransfer.files];
        if (files.length) this._upload(files);
    }

    // ── Context menu & preview ─────────────────────────────────────────────

    _openContextMenu(e, filePath, opts = {}) {
        e.preventDefault();
        e.stopPropagation();
        let x = e.clientX, y = e.clientY;
        if (e.type !== 'contextmenu') {
            // Triggered from ⋮ button — position menu below the button
            const r = e.currentTarget.getBoundingClientRect();
            x = r.left;
            y = r.bottom + 2;
        }
        this._ctxMenu = {
            file: filePath,
            isFolder: opts.isFolder || false,
            folderName: opts.folderName || null,
            x: Math.min(x, window.innerWidth  - 165),
            y: Math.min(y, window.innerHeight - 130),
            // N33: open the background-scope submenu to the left when the
            // menu sits too close to the right window edge for a fly-out.
            subLeft: Math.min(x, window.innerWidth - 165) > window.innerWidth - 320
        };
    }

    _openPreview(file) {
        const src = this._assetSrc(file.path);
        this._preview     = { src: feezal.resolveAsset ? feezal.resolveAsset(src) : src, name: basename(file.path) };
        this._previewOpen = true;
    }

    async _copyPath(filePath) {
        const url = this._assetSrc(filePath);
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const ta = Object.assign(document.createElement('textarea'), {value: url});
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
    }

    /**
     * Copy-on-use (A14): copy a global asset into this site's assets (never
     * overwriting — the server suffixes on collision) and repoint the freshly
     * dropped element's src at the site copy. Keeps the site self-contained so
     * the global pool stays a pure editor-side library. On failure the element
     * keeps its global src (still renders) so the drop is never lost.
     */
    async _localiseGlobalAsset(srcPath, elem) {
        const site = feezal.siteName || 'default';
        try {
            const res = await fetch(`/api/assets/${site}/transfer`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    srcCategory: 'global',
                    srcPath,
                    destCategory: 'site',
                    destPath: srcPath,
                    copy: true,
                    unique: true
                })
            });
            if (res.ok) {
                const {path} = await res.json();
                if (path && elem.isConnected) {
                    elem.setAttribute('src', `/assets/${site}/${path}`);
                    // The src is set out-of-band (after this async copy), but the
                    // attribute inspector only re-reads on selection change — nudge
                    // it with a fresh array reference so the field isn't stale (B15).
                    const insp = feezal.editor;
                    if (insp && Array.isArray(insp.selectedElems)) {
                        insp.selectedElems = [...insp.selectedElems];
                    }
                }
                await this._load();   // reflect the new file in the Site tab
            }
        } catch { /* keep the global src as a working fallback */ }
        feezal.app.change();
    }

    async _transferAsset(filePath, destCategory, copy) {
        const site = feezal.siteName || 'default';
        this._error = null;
        try {
            const res = await fetch(`/api/assets/${site}/transfer`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    srcCategory: this._category,
                    srcPath: filePath,
                    destCategory,
                    destPath: filePath,
                    copy
                })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                this._error = data.error || 'Transfer failed';
                return;
            }
            if (!copy) {
                // Switch view to destination so the user can see where it went
                this._category = destCategory;
                this.renderRoot.querySelector('sl-tab-group')?.show(destCategory);
            }
            await this._load();
        } catch (err) {
            this._error = err.message;
        }
    }

    // ── View mode / search / sort helpers ─────────────────────────────────

    _setViewMode(mode) {
        this._viewMode = mode;
        localStorage.setItem('feezal-assets-viewmode', mode);
    }

    _setThumbSize(size) {
        this._thumbSize = size;
        localStorage.setItem('feezal-assets-thumbsize', String(size));
    }

    _setSort(key) {
        if (this._sortKey === key) {
            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sortKey  = key;
            this._sortDir  = 'asc';
        }
    }

    _sortItems(files) {
        return [...files].sort((a, b) => {
            let av, bv;
            const aName = basename(a.path), bName = basename(b.path);
            if (this._sortKey === 'name') {
                av = aName.toLowerCase(); bv = bName.toLowerCase();
            } else if (this._sortKey === 'type') {
                av = aName.includes('.') ? aName.slice(aName.lastIndexOf('.') + 1).toLowerCase() : '';
                bv = bName.includes('.') ? bName.slice(bName.lastIndexOf('.') + 1).toLowerCase() : '';
            } else if (this._sortKey === 'size') {
                av = a.size || 0; bv = b.size || 0;
            } else if (this._sortKey === 'date') {
                av = a.modified ? new Date(a.modified).getTime() : 0;
                bv = b.modified ? new Date(b.modified).getTime() : 0;
            }
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return this._sortDir === 'asc' ? cmp : -cmp;
        });
    }

    get _filteredFolders() {
        if (this._search) return [];
        return this._currentFolders;
    }

    get _filteredList() {
        let files;
        if (this._search) {
            // Flat search across entire category — ignore current folder
            const q = this._search.toLowerCase();
            files = (this._assets[this._category] || []).filter(f => basename(f.path).toLowerCase().includes(q));
        } else {
            files = this._currentList;
        }
        return this._sortItems(files);
    }

    // ── List / Details row renderers ───────────────────────────────────────

    _renderListRow(file) {
        const isImg  = isImage(file.path);
        const name   = basename(file.path);
        const src    = this._assetSrc(file.path);
        const renaming = this._renaming === file.path;
        return html`
            <div class="list-row ${isImg ? 'image-tile' : ''}"
                data-src="${isImg ? src : ''}"
                data-file="${isImg ? file.path : ''}"
                @dragstart="${e => e.preventDefault()}"
                @click="${() => { if (isImg && !renaming) this._openPreview(file); }}"
                @contextmenu="${e => this._openContextMenu(e, file.path)}">
                <span class="material-icons">${isImg ? 'image' : fileIcon(file.path)}</span>
                ${renaming ? html`
                    <input class="tile-name-input" style="text-align:left;width:auto;flex:1;" .value="${this._renameVal}"
                        @input="${e => this._renameVal = e.target.value}"
                        @keydown="${e => { if (e.key === 'Enter') this._commitRename(file.path); if (e.key === 'Escape') this._renaming = null; }}"
                        @blur="${() => this._commitRename(file.path)}"
                        @click="${e => e.stopPropagation()}">
                ` : html`<span class="list-row-name" title="${file.path}">${name}</span>`}
                <button class="list-row-menu" title="More options"
                    @click="${e => this._openContextMenu(e, file.path)}">
                    <span class="material-icons">more_vert</span>
                </button>
            </div>
        `;
    }

    _renderDetailRow(file) {
        const isImg  = isImage(file.path);
        const name   = basename(file.path);
        const src    = this._assetSrc(file.path);
        const ext    = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase() : '—';
        const size   = file.size != null ? formatSize(file.size) : '—';
        const date   = file.modified ? new Date(file.modified).toLocaleDateString() : '—';
        const renaming = this._renaming === file.path;
        return html`
            <div class="detail-row ${isImg ? 'image-tile' : ''}"
                data-src="${isImg ? src : ''}"
                data-file="${isImg ? file.path : ''}"
                @dragstart="${e => e.preventDefault()}"
                @click="${() => { if (isImg && !renaming) this._openPreview(file); }}"
                @contextmenu="${e => this._openContextMenu(e, file.path)}">
                <div class="name-cell">
                    <span class="material-icons">${isImg ? 'image' : fileIcon(file.path)}</span>
                    ${renaming ? html`
                        <input class="tile-name-input" style="text-align:left;width:auto;flex:1;" .value="${this._renameVal}"
                            @input="${e => this._renameVal = e.target.value}"
                            @keydown="${e => { if (e.key === 'Enter') this._commitRename(file.path); if (e.key === 'Escape') this._renaming = null; }}"
                            @blur="${() => this._commitRename(file.path)}"
                            @click="${e => e.stopPropagation()}">
                    ` : html`<span class="cell" title="${file.path}">${name}</span>`}
                </div>
                <span class="cell">${ext}</span>
                <span class="cell">${size}</span>
                <span class="cell">${date}</span>
                <div class="menu-cell">
                    <button class="detail-row-menu" title="More options"
                        @click="${e => this._openContextMenu(e, file.path)}">
                        <span class="material-icons">more_vert</span>
                    </button>
                </div>
            </div>
        `;
    }

    // ── Render ─────────────────────────────────────────────────────────────

    _renderBreadcrumb() {
        const parts = this._folder ? this._folder.split('/') : [];
        return html`
            <div class="breadcrumb">
                <span class="crumb" @click="${() => this._folder = ''}">
                    ${this._category === 'global' ? 'Global' : 'Site'}
                </span>
                ${parts.map((p, i) => html`
                    <span class="crumb-sep">/</span>
                    <span class="crumb" @click="${() => { this._folder = parts.slice(0, i + 1).join('/'); }}">${p}</span>
                `)}
            </div>
        `;
    }

    _renderTile(file) {
        const isImg      = isImage(file.path);
        const name       = basename(file.path);
        const src        = this._assetSrc(file.path);
        const resolvedSrc = feezal.resolveAsset ? feezal.resolveAsset(src) : src;
        const renaming   = this._renaming === file.path;

        return html`
            <div class="tile ${isImg ? 'image-tile' : ''}"
                data-src="${src}" data-file="${file.path}"
                title="${name} (${formatSize(file.size)})"
                @dragstart="${e => e.preventDefault()}"
                @click="${() => { if (isImg && !renaming) this._openPreview(file); }}"
                @contextmenu="${e => this._openContextMenu(e, file.path)}">
                ${isImg
                    ? html`<img class="tile-thumb" src="${resolvedSrc}" alt="${name}" loading="lazy" draggable="false">`
                    : html`<span class="material-icons tile-icon">${fileIcon(file.path)}</span>`
                }
                ${renaming ? html`
                    <input class="tile-name-input" .value="${this._renameVal}"
                        @input="${e => this._renameVal = e.target.value}"
                        @keydown="${e => { if (e.key === 'Enter') this._commitRename(file.path); if (e.key === 'Escape') this._renaming = null; }}"
                        @blur="${() => this._commitRename(file.path)}"
                        @click="${e => e.stopPropagation()}">
                ` : html`
                    <span class="tile-name">${name}</span>
                `}
                <button class="tile-menu-btn" title="More options"
                    @click="${e => this._openContextMenu(e, file.path)}">
                    <span class="material-icons">more_vert</span>
                </button>
            </div>
        `;
    }

    _renderParentFolder() {
        const parentFolder = this._folder.includes('/')
            ? this._folder.slice(0, this._folder.lastIndexOf('/'))
            : '';
        return html`
            <div class="tile folder" data-folder="${parentFolder}" @click="${() => { this._folder = parentFolder; }}" title="Up to parent folder">
                <span class="material-icons tile-icon">arrow_upward</span>
                <span class="tile-name">..</span>
            </div>
        `;
    }

    _renderFolder(name) {
        const fullPath = (this._folder ? this._folder + '/' : '') + name;
        const renaming = this._renaming === fullPath;
        return html`
            <div class="tile folder" data-folder="${fullPath}"
                @click="${() => { if (!renaming) this._folder = fullPath; }}"
                @contextmenu="${e => this._openContextMenu(e, fullPath, {isFolder: true, folderName: name})}"
                title="${name}">
                <span class="material-icons tile-icon folder-icon">folder</span>
                ${renaming ? html`
                    <input class="tile-name-input" .value="${this._renameVal}"
                        @input="${e => this._renameVal = e.target.value}"
                        @keydown="${e => { if (e.key === 'Enter') this._commitRename(fullPath); if (e.key === 'Escape') this._renaming = null; }}"
                        @blur="${() => this._commitRename(fullPath)}"
                        @click="${e => e.stopPropagation()}">
                ` : html`
                    <span class="tile-name">${name}</span>
                `}
                <button class="tile-menu-btn" title="More options"
                    @click="${e => this._openContextMenu(e, fullPath, {isFolder: true, folderName: name})}">
                    <span class="material-icons">more_vert</span>
                </button>
            </div>
        `;
    }

    render() {
        return html`
            <link rel="stylesheet" href="/fonts/fonts.css">
            <sl-tab-group @sl-tab-show="${e => {
                // Only a real category change resets the folder — a programmatic
                // show() after a move-transfer must keep the current folder.
                if (this._category !== e.detail.name) {
                    this._category = e.detail.name;
                    this._folder = '';
                }
            }}">
                <sl-tab slot="nav" panel="site">Site</sl-tab>
                <sl-tab slot="nav" panel="global">Global</sl-tab>
                <div slot="nav" class="nav-actions">
                    <button class="view-btn ${this._viewMode === 'thumbs'  ? 'active' : ''}" title="Thumbnail view"  @click="${() => this._setViewMode('thumbs')}"><span class="material-icons">grid_view</span></button>
                    <button class="view-btn ${this._viewMode === 'list'    ? 'active' : ''}" title="List view"       @click="${() => this._setViewMode('list')}"><span class="material-icons">list</span></button>
                    <button class="view-btn ${this._viewMode === 'details' ? 'active' : ''}" title="Details view"    @click="${() => this._setViewMode('details')}"><span class="material-icons">view_list</span></button>
                    <button class="mkdir-btn" title="New folder" @click="${this._mkdir}"><span class="material-icons">create_new_folder</span></button>
                    <button class="upload-btn" title="Upload files" @click="${() => this.shadowRoot.querySelector('#file-input').click()}">
                        <span class="material-icons">upload</span>
                    </button>
                    <input id="file-input" type="file" multiple @change="${e => this._upload([...e.target.files])}">
                </div>
                <sl-tab-panel name="site">${this._category === 'site' ? this._body() : ''}</sl-tab-panel>
                <sl-tab-panel name="global">${this._category === 'global' ? this._body() : ''}</sl-tab-panel>
            </sl-tab-group>
            ${this._renderOverlays()}
        `;
    }

    /** Shared panel body — the same search/browser UI for both categories. */
    _body() {
        const folders = this._filteredFolders;
        const files   = this._filteredList;
        const count   = folders.length + files.length;

        return html`
            <!-- Search row -->
            <div class="search-row">
                <span class="material-icons" style="font-size:16px;color:#aaa;flex-shrink:0">search</span>
                <input class="search-input" type="text" placeholder="Search assets…"
                    .value="${this._search}"
                    @input="${e => { this._search = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Escape') this._search = ''; }}">
                ${this._search ? html`
                    <button class="search-clear" @click="${() => this._search = ''}">
                        <span class="material-icons" style="font-size:16px">close</span>
                    </button>
                ` : ''}
            </div>

            ${this._error ? html`
                <div class="error-bar">
                    <span>${this._error}</span>
                    <button class="error-dismiss" @click="${() => this._error = null}">×</button>
                </div>
            ` : ''}
            ${this._search ? '' : this._renderBreadcrumb()}

            ${this._viewMode === 'thumbs' ? html`
                <div class="thumb-slider-row">
                    <span class="material-icons">photo_size_select_small</span>
                    <input type="range" class="thumb-slider" min="48" max="320" step="8"
                        .value="${this._thumbSize}"
                        @input="${e => this._setThumbSize(+e.target.value)}">
                    <span class="material-icons">photo_size_select_large</span>
                </div>
            ` : ''}

            ${this._viewMode === 'thumbs' ? html`
                <div class="drop-zone"
                    style="--thumb-size:${this._thumbSize}px"
                    @dragover="${this._onDropZoneDragOver}"
                    @dragleave="${this._onDropZoneDragLeave}"
                    @drop="${this._onDropZoneDrop}">

                    ${this._uploading ? html`<div class="uploading-overlay">Uploading…</div>` : ''}

                    ${!this._search && this._folder ? this._renderParentFolder() : ''}
                    ${folders.map(name => this._renderFolder(name))}
                    ${files.map(file  => this._renderTile(file))}

                    ${!this._uploading && count === 0 ? html`
                        <div class="empty">${this._search ? 'No matching files' : 'Drop files here or click Upload'}</div>
                    ` : ''}
                </div>
            ` : this._viewMode === 'list' ? html`
                <div class="list-zone">
                    ${!this._search && this._folder ? html`
                        <div class="list-row" style="cursor:pointer"
                            data-folder="${this._folder.includes('/') ? this._folder.slice(0, this._folder.lastIndexOf('/')) : ''}"
                            @click="${() => { this._folder = this._folder.includes('/') ? this._folder.slice(0, this._folder.lastIndexOf('/')) : ''; }}">
                            <span class="material-icons">arrow_upward</span>
                            <span class="list-row-name">..</span>
                        </div>
                    ` : ''}
                    ${folders.map(name => html`
                        <div class="list-row" style="cursor:pointer"
                            data-folder="${(this._folder ? this._folder + '/' : '') + name}"
                            @click="${() => this._folder = (this._folder ? this._folder + '/' : '') + name}"
                            @contextmenu="${e => this._openContextMenu(e, (this._folder ? this._folder + '/' : '') + name, {isFolder: true, folderName: name})}">
                            <span class="material-icons folder-icon">folder</span>
                            <span class="list-row-name">${name}</span>
                            <button class="list-row-menu" @click="${e => this._openContextMenu(e, (this._folder ? this._folder + '/' : '') + name, {isFolder: true, folderName: name})}">
                                <span class="material-icons">more_vert</span>
                            </button>
                        </div>
                    `)}
                    ${files.map(file => this._renderListRow(file))}
                    ${count === 0 ? html`<div style="padding:24px 10px;text-align:center;color:#aaa;font-size:12px">${this._search ? 'No matching files' : 'Drop files here or click Upload'}</div>` : ''}
                </div>
            ` : html`
                <!-- Details view -->
                <div class="details-header">
                    <span class="${this._sortKey === 'name'  ? 'sort-active' : ''}" @click="${() => this._setSort('name')}">Name${this._sortKey === 'name'  ? (this._sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    <span class="${this._sortKey === 'type'  ? 'sort-active' : ''}" @click="${() => this._setSort('type')}">Type${this._sortKey === 'type'  ? (this._sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    <span class="${this._sortKey === 'size'  ? 'sort-active' : ''}" @click="${() => this._setSort('size')}">Size${this._sortKey === 'size'  ? (this._sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    <span class="${this._sortKey === 'date'  ? 'sort-active' : ''}" @click="${() => this._setSort('date')}">Modified${this._sortKey === 'date' ? (this._sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                    <span></span>
                </div>
                <div class="list-zone">
                    ${!this._search && this._folder ? html`
                        <div class="detail-row" style="cursor:pointer"
                            data-folder="${this._folder.includes('/') ? this._folder.slice(0, this._folder.lastIndexOf('/')) : ''}"
                            @click="${() => { this._folder = this._folder.includes('/') ? this._folder.slice(0, this._folder.lastIndexOf('/')) : ''; }}">
                            <div class="name-cell"><span class="material-icons">arrow_upward</span><span class="cell">..</span></div>
                            <span></span><span></span><span></span><span></span>
                        </div>
                    ` : ''}
                    ${folders.map(name => {
                        const fp = (this._folder ? this._folder + '/' : '') + name;
                        return html`
                            <div class="detail-row" style="cursor:pointer"
                                data-folder="${fp}"
                                @click="${() => this._folder = fp}"
                                @contextmenu="${e => this._openContextMenu(e, fp, {isFolder: true, folderName: name})}">
                                <div class="name-cell"><span class="material-icons folder-icon">folder</span><span class="cell">${name}</span></div>
                                <span class="cell">Folder</span><span class="cell">—</span><span class="cell">—</span>
                                <div class="menu-cell">
                                    <button class="detail-row-menu" @click="${e => this._openContextMenu(e, fp, {isFolder: true, folderName: name})}">
                                        <span class="material-icons">more_vert</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    })}
                    ${files.map(file => this._renderDetailRow(file))}
                    ${count === 0 ? html`<div style="padding:24px 10px;text-align:center;color:#aaa;font-size:12px">${this._search ? 'No matching files' : 'Drop files here or click Upload'}</div>` : ''}
                </div>
            `}

            <div class="infobar">${count} item${count !== 1 ? 's' : ''}${this._category === 'global' ? ' · global' : ' · site'}${this._search ? ` · matching "${this._search}"` : ''}</div>
        `;
    }

    /** Dialogs, context menu and preview — top-level so they survive tab switches. */
    _renderOverlays() {
        return html`
            <!-- Confirm dialog -->
            <sl-dialog
                label="Confirm"
                ?open="${!!this._dlgConfirm}"
                @sl-request-close="${() => { if (this._dlgConfirm) { this._dlgConfirm.resolve(false); this._dlgConfirm = null; } }}">
                <p style="margin:0">${this._dlgConfirm?.message ?? ''}</p>
                <sl-button slot="footer" variant="default"
                    @click="${() => { this._dlgConfirm?.resolve(false); this._dlgConfirm = null; }}">Cancel</sl-button>
                <sl-button slot="footer" variant="danger"
                    @click="${() => { this._dlgConfirm?.resolve(true); this._dlgConfirm = null; }}">Delete</sl-button>
            </sl-dialog>

            <!-- Prompt dialog -->
            <sl-dialog
                label="New Folder"
                ?open="${!!this._dlgPrompt}"
                @sl-after-show="${() => this.shadowRoot.querySelector('#prompt-input')?.focus()}"
                @sl-request-close="${() => { if (this._dlgPrompt) { this._dlgPrompt.resolve(null); this._dlgPrompt = null; } }}">
                <sl-input id="prompt-input"
                    label="${this._dlgPrompt?.label ?? ''}"
                    .value="${this._dlgPromptVal}"
                    @sl-input="${e => { this._dlgPromptVal = e.target.value; }}"
                    @keydown="${e => { if (e.key === 'Enter') this._submitPrompt(); }}">
                </sl-input>
                <sl-button slot="footer" variant="default"
                    @click="${() => { this._dlgPrompt?.resolve(null); this._dlgPrompt = null; }}">Cancel</sl-button>
                <sl-button slot="footer" variant="primary"
                    @click="${() => this._submitPrompt()}">OK</sl-button>
            </sl-dialog>

            <!-- Context menu -->
            ${this._ctxMenu ? html`
                <div class="ctx-backdrop" @click="${() => this._ctxMenu = null}"></div>
                <div class="ctx-menu" style="left:${this._ctxMenu.x}px; top:${this._ctxMenu.y}px;">
                    <div class="ctx-item" @click="${() => { this._startRename(this._ctxMenu.file); this._ctxMenu = null; }}">
                        <span class="material-icons">edit</span>Rename
                    </div>
                    ${!this._ctxMenu.isFolder ? html`
                        <div class="ctx-item" @click="${() => { this._copyPath(this._ctxMenu.file); this._ctxMenu = null; }}">
                            <span class="material-icons">content_copy</span>Copy path
                        </div>
                    ` : ''}
                    ${!this._ctxMenu.isFolder && isImage(this._ctxMenu.file) ? html`
                        <div class="ctx-item has-sub">
                            <span class="material-icons">wallpaper</span>Set as background
                            <span class="material-icons sub-arrow">chevron_right</span>
                            <div class="ctx-submenu ${this._ctxMenu.subLeft ? 'left' : ''}">
                                <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._setAsBackground(f, 'current'); }}">
                                    Current view
                                </div>
                                <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._setAsBackground(f, 'all'); }}">
                                    All views
                                </div>
                            </div>
                        </div>
                        <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._setAsPwaIcon(f); }}">
                            <span class="material-icons">install_mobile</span>Set as PWA icon
                        </div>
                    ` : ''}
                    ${!this._ctxMenu.isFolder && this._category === 'global' ? html`
                        <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._transferAsset(f, 'site', false); }}">
                            <span class="material-icons">drive_file_move</span>Move to site
                        </div>
                        <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._transferAsset(f, 'site', true); }}">
                            <span class="material-icons">file_copy</span>Copy to site
                        </div>
                    ` : ''}
                    ${!this._ctxMenu.isFolder && this._category === 'site' ? html`
                        <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._transferAsset(f, 'global', false); }}">
                            <span class="material-icons">drive_file_move</span>Move to global
                        </div>
                        <div class="ctx-item" @click="${() => { const f = this._ctxMenu.file; this._ctxMenu = null; this._transferAsset(f, 'global', true); }}">
                            <span class="material-icons">file_copy</span>Copy to global
                        </div>
                    ` : ''}
                    <div class="ctx-item del" @click="${() => {
                        if (this._ctxMenu.isFolder) { const fn = this._ctxMenu.folderName; this._ctxMenu = null; this._deleteFolder(fn); }
                        else { const f = this._ctxMenu.file; this._ctxMenu = null; this._delete(f); }
                    }}">
                        <span class="material-icons">delete</span>Delete
                    </div>
                </div>
            ` : ''}

            <feezal-pwa-icon-dialog @pwa-icons-saved="${this._onPwaIconSaved}"></feezal-pwa-icon-dialog>

            <!-- Image preview -->
            <sl-dialog
                label="${this._preview?.name ?? ''}"
                ?open="${this._previewOpen}"
                style="--width: fit-content"
                @sl-request-close="${() => { this._previewOpen = false; }}"
                @sl-after-hide="${() => { this._previewOpen = false; this._preview = null; }}">
                ${this._preview ? html`
                    <img src="${this._preview.src}" alt="${this._preview.name}"
                        style="max-width: min(90vw, 1200px); max-height: 80vh; display: block; object-fit: contain;">
                ` : ''}
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-sidebar-assets', FeezalSidebarAssets);

