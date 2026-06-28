import interact from 'interactjs';
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';

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
        _dlgPromptVal:  {state: true}   // current value in prompt input
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            background: var(--feezal-bg, #fff); box-sizing: border-box; overflow: hidden;
            font-size: 13px; color: var(--feezal-color, #333);
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .header {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 10px; border-bottom: 1px solid var(--feezal-border, #e0e0e0);
            flex-shrink: 0;
        }
        .cat-btn {
            flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5); cursor: pointer;
            font-size: 12px; font-weight: 500; color: var(--feezal-color, #444);
            transition: background 0.15s, border-color 0.15s;
        }
        .cat-btn.active {
            background: var(--sl-color-primary-600, #0284c7); color: #fff; border-color: transparent;
        }
        .upload-btn {
            width: 28px; height: 28px; border-radius: 4px; border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-color, #555); transition: background 0.15s;
        }
        .upload-btn:hover { background: var(--sl-color-primary-50, #e0f2fe); }
        .upload-btn .material-icons { font-size: 18px; }
        .mkdir-btn { width: 28px; height: 28px; border-radius: 4px; border: 1px solid var(--feezal-border, #d0d0d0);
            background: var(--feezal-bg-sub, #f5f5f5); cursor: pointer; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            color: var(--feezal-color, #555);
        }
        .mkdir-btn:hover { background: var(--sl-color-primary-50, #e0f2fe); }
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
            display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
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
        .tile.folder:hover { background: var(--sl-color-primary-50, #e0f2fe); border-color: var(--sl-color-primary-200, #bae6fd); }

        .tile-thumb {
            width: 64px; height: 48px; object-fit: contain;
            border-radius: 3px; display: block;
        }
        .tile-icon { font-size: 40px; color: var(--feezal-color, #888); line-height: 1; }
        .tile-icon.folder-icon { color: var(--sl-color-primary-500, #0ea5e9); }

        .tile-name {
            font-size: 11px; text-align: center; word-break: break-all;
            max-width: 76px; line-height: 1.3; color: var(--feezal-color, #333);
        }
        .tile-name-input {
            font-size: 11px; width: 72px; text-align: center;
            border: 1px solid var(--sl-color-primary-400, #38bdf8); border-radius: 2px;
            outline: none; padding: 1px 2px;
        }

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

        /* draggable image tiles */
        .tile.image-tile { cursor: grab; touch-action: none; }
        .tile.image-tile:active { cursor: grabbing; }

        /* ── Empty state ─────────────────────────────────────────────── */
        .empty { grid-column: 1/-1; text-align: center; color: #aaa; padding: 24px 8px; font-size: 12px; }
        .uploading-overlay { grid-column: 1/-1; text-align: center; color: #888; font-size: 12px; padding: 8px; }

        /* ── Info bar ────────────────────────────────────────────────── */
        .infobar {
            padding: 4px 10px; font-size: 11px; color: #aaa;
            border-top: 1px solid var(--feezal-border, #eee); flex-shrink: 0;
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
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
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
        const prefix = this._folder ? this._folder + '/' : '';
        const seen = new Set();
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
        for (const file of files) {
            const base = this._folder ? this._folder + '/' + file.name : file.name;
            await fetch(
                `/api/assets/${site}?category=${this._category}&path=${encodeURIComponent(base)}`,
                {method: 'POST', headers: {'Content-Type': file.type || 'application/octet-stream'}, body: file}
            );
        }
        this._uploading = false;
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

    _initDrag() {
        interact('.image-tile', {context: this.renderRoot})
            .draggable({
                onstart: event => {
                    const src = event.target.dataset.src;
                    const viewRect = feezal.view.getBoundingClientRect();
                    this._dragElem = document.createElement('feezal-element-basic-image');
                    this._dragElem.setAttribute('src', src);
                    feezal.view.append(this._dragElem);
                    feezal.editor.initElem(this._dragElem, true);
                    this._dragElem.style.outlineWidth = '2px';
                    const r = this._dragElem.getBoundingClientRect();
                    this._dragElem.style.top  = (event.clientY - viewRect.y - r.height / 2) + 'px';
                    this._dragElem.style.left = (event.clientX - viewRect.x - r.width  / 2) + 'px';
                },
                onmove: event => {
                    if (!this._dragElem) return;
                    if (event.dx) this._dragElem.style.left = (parseFloat(this._dragElem.style.left) + event.dx) + 'px';
                    if (event.dy) this._dragElem.style.top  = (parseFloat(this._dragElem.style.top)  + event.dy) + 'px';
                },
                onend: () => {
                    if (!this._dragElem) return;
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
                        feezal.app.change();
                    }
                    delete this._dragElem;
                }
            });
    }

    updated() {
        if (feezal.editor && feezal.view) {
            try { this._initDrag(); } catch { /* no view yet */ }
        }
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
        const isImg  = isImage(file.path);
        const name   = basename(file.path);
        const src    = this._assetSrc(file.path);
        const resolvedSrc = feezal.resolveAsset ? feezal.resolveAsset(src) : src;
        const renaming = this._renaming === file.path;

        return html`
            <div class="tile ${isImg ? 'image-tile' : ''}" data-src="${src}" title="${name} (${formatSize(file.size)})">
                ${isImg
                    ? html`<img class="tile-thumb" src="${resolvedSrc}" alt="${name}" loading="lazy">`
                    : html`<span class="material-icons tile-icon">${fileIcon(file.path)}</span>`
                }
                ${renaming ? html`
                    <input class="tile-name-input" .value="${this._renameVal}"
                        @input="${e => this._renameVal = e.target.value}"
                        @keydown="${e => { if (e.key === 'Enter') this._commitRename(file.path); if (e.key === 'Escape') this._renaming = null; }}"
                        @blur="${() => this._commitRename(file.path)}">
                ` : html`
                    <span class="tile-name" @dblclick="${() => this._startRename(file.path)}">${name}</span>
                `}
                <div class="tile-actions">
                    <button class="tile-btn" title="Rename" @click="${e => { e.stopPropagation(); this._startRename(file.path); }}">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="tile-btn del" title="Delete" @click="${e => { e.stopPropagation(); this._delete(file.path); }}">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;
    }

    _renderFolder(name) {
        return html`
            <div class="tile folder" @click="${() => { this._folder = (this._folder ? this._folder + '/' : '') + name; }}" title="${name}">
                <span class="material-icons tile-icon folder-icon">folder</span>
                <span class="tile-name">${name}</span>
                <div class="tile-actions">
                    <button class="tile-btn del" title="Delete folder" @click="${e => { e.stopPropagation(); this._deleteFolder(name); }}">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            </div>
        `;
    }

    render() {
        const folders = this._currentFolders;
        const files   = this._currentList;
        const count   = folders.length + files.length;

        return html`
            <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
            <div class="header">
                <button class="cat-btn ${this._category === 'site'   ? 'active' : ''}" @click="${() => { this._category = 'site';   this._folder = ''; }}">Site</button>
                <button class="cat-btn ${this._category === 'global' ? 'active' : ''}" @click="${() => { this._category = 'global'; this._folder = ''; }}">Global</button>
                <button class="mkdir-btn" title="New folder" @click="${this._mkdir}"><span class="material-icons">create_new_folder</span></button>
                <button class="upload-btn" title="Upload files" @click="${() => this.shadowRoot.querySelector('#file-input').click()}">
                    <span class="material-icons">upload</span>
                </button>
                <input id="file-input" type="file" multiple @change="${e => this._upload([...e.target.files])}">
            </div>

            ${this._renderBreadcrumb()}

            <div class="drop-zone"
                @dragover="${this._onDropZoneDragOver}"
                @dragleave="${this._onDropZoneDragLeave}"
                @drop="${this._onDropZoneDrop}">

                ${this._uploading ? html`<div class="uploading-overlay">Uploading…</div>` : ''}

                ${folders.map(name => this._renderFolder(name))}
                ${files.map(file  => this._renderTile(file))}

                ${!this._uploading && count === 0 ? html`
                    <div class="empty">Drop files here or click Upload</div>
                ` : ''}
            </div>

            <div class="infobar">${count} item${count !== 1 ? 's' : ''}${this._category === 'global' ? ' · global' : ' · site'}</div>

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
        `;
    }
}

window.customElements.define('feezal-sidebar-assets', FeezalSidebarAssets);

