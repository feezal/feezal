import {LitElement, html, css, render, nothing} from 'lit';

const RESERVED_SITE_NAMES = ['_global', 'themes'];
const isReservedSiteName = n => RESERVED_SITE_NAMES.includes(n) || n.startsWith('_');

/**
 * feezal-site-manager
 *
 * Compact site-picker toolbar control.
 * Shows the current site name; clicking opens a popover with the full site list
 * (filterable by typing) and actions: switch, new, duplicate, rename, delete.
 *
 * Placement: in the editor toolbar's left section.
 */
class FeezalSiteManager extends LitElement {
    static properties = {
        sites:          {state: true},
        darkMode:       {type: Boolean},
        _open:          {state: true},
        _filter:        {state: true},
        _newDialog:     {state: true},
        _newName:       {state: true},
        _newError:      {state: true},
        _renaming:      {state: true},
        _renameValue:   {state: true},
        _confirmDelete: {state: true},
        _dropX:         {state: true},
        _dropY:         {state: true},
        _busy:          {state: true}
    };

    static styles = css`
        :host {
            display: flex;
            align-items: center;
        }

        /* Trigger button — split-button style matching #btn-deploy-wrap */
        .trigger {
            display: flex; align-items: center; gap: 5px;
            height: 32px; margin: auto 6px; margin-top: 4.5px; padding: 0 0 0 10px;
            background: #555; border: none; border-radius: 4px;
            cursor: pointer; color: white;
            font-size: 13px; font-weight: 600; max-width: 200px;
            box-sizing: border-box;
        }
        .trigger:hover { background: #666; }
        .trigger .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trigger .arrow {
            height: 100%; width: 26px; flex-shrink: 0;
            border-left: 1px solid rgba(255,255,255,0.22);
            margin-left: 4px;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Material Icons'; font-size: 20px; line-height: 1;
            font-weight: normal; font-style: normal;
            -webkit-font-smoothing: antialiased;
        }
        .trigger .t-icon {
            font-family: 'Material Icons'; font-size: 17px; line-height: 1;
            display: inline-block; white-space: nowrap; -webkit-font-smoothing: antialiased;
            opacity: 0.8; flex-shrink: 0;
        }

        /* Dropdown (position:fixed, positioned by JS) */
        .dropdown {
            position: fixed;
            background: white; border: 1px solid #ccc; border-radius: 6px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.2); z-index: 9999;
            min-width: 220px; max-width: 320px;
            display: flex; flex-direction: column;
            max-height: 400px;
        }
        .filter-row {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .filter-input {
            width: 100%; box-sizing: border-box;
            border: 1px solid #ccc; border-radius: 4px;
            padding: 5px 8px; font-size: 13px; outline: none;
        }
        .filter-input:focus { border-color: rgba(250,120,0,0.8); }
        .site-list {
            list-style: none; margin: 0; padding: 4px 0;
            overflow-y: auto; flex: 1;
        }
        .site-row {
            display: flex; align-items: center;
            padding: 4px 8px; gap: 4px; font-size: 13px;
            min-height: 32px;
        }
        .site-row.active .site-name-link { font-weight: 600; color: rgba(250,120,0,0.9); }
        .site-row.confirm { background: #fff3f3; flex-wrap: wrap; gap: 6px; }
        .site-name-link {
            flex: 1; cursor: pointer; padding: 2px 4px; border-radius: 3px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .site-name-link:hover { background: #f5f5f5; }
        .row-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .row-btn {
            background: none; border: none; cursor: pointer;
            font-size: 14px; padding: 2px 5px; border-radius: 3px;
            color: #555; display: flex; align-items: center; justify-content: center;
        }
        .row-btn:hover { background: #f0f0f0; }
        .row-btn.danger { color: #c62828; }
        .row-btn.danger:hover { background: #ffebee; }
        .row-btn:disabled { opacity: 0.4; cursor: default; }
        .rename-input {
            flex: 1; border: 1px solid #aaa; border-radius: 4px;
            padding: 3px 6px; font-size: 13px; outline: none;
        }
        .rename-input:focus { border-color: rgba(250,120,0,0.8); }
        .confirm-text { flex: 1; font-size: 12px; color: #c62828; }
        .empty-msg { padding: 10px 12px; font-size: 12px; color: #999; }
        .footer {
            padding: 8px; border-top: 1px solid #eee;
        }
        .add-btn {
            width: 100%; background: none; border: 1px dashed #aaa; border-radius: 4px;
            padding: 6px; font-size: 13px; cursor: pointer; color: #555;
        }
        .add-btn:hover { background: #f5f5f5; border-color: rgba(250,120,0,0.6); }

        /* New-site dialog */
        dialog {
            border: none; border-radius: 8px; padding: 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.25); min-width: 320px; max-width: 400px;
        }
        dialog::backdrop { background: rgba(0,0,0,0.35); }
        .dialog-inner { padding: 24px; }
        .dialog-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
        .dialog-field { margin-bottom: 12px; }
        .dialog-field label { display: block; font-size: 12px; color: #555; margin-bottom: 4px; }
        .dialog-field input, .dialog-field select {
            width: 100%; box-sizing: border-box;
            border: 1px solid #ccc; border-radius: 4px;
            padding: 6px 8px; font-size: 13px; outline: none;
        }
        .dialog-field input:focus { border-color: rgba(250,120,0,0.8); }
        .dialog-error { color: #c62828; font-size: 12px; min-height: 16px; margin-bottom: 8px; }
        .dialog-btns { display: flex; gap: 8px; justify-content: flex-end; }
        .dialog-btns button {
            padding: 7px 16px; border: none; border-radius: 4px;
            cursor: pointer; font-size: 13px;
        }
        .btn-cancel { background: #eee; color: #333; }
        .btn-primary { background: rgba(250,120,0,0.85); color: white; font-weight: 600; }
        .btn-primary:disabled { opacity: 0.6; cursor: default; }
    `;

    constructor() {
        super();
        this.sites          = [];
        this.darkMode       = false;
        this._open          = false;
        this._filter        = '';
        this._newDialog     = false;
        this._newName       = '';
        this._newError      = '';
        this._renaming      = null;
        this._renameValue   = '';
        this._confirmDelete = null;
        this._dropX         = 0;
        this._dropY         = 0;
        this._busy          = false;
        this._openNewDialog  = this._openNewDialog.bind(this);
        this._closeNewDialog = this._closeNewDialog.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        // Portal element lives directly in document.body so the dropdown is
        // in the root stacking context and always renders above shadow-DOM content.
        this._portalEl = document.createElement('div');
        document.body.appendChild(this._portalEl);
        this._loadSites();
        this._onDocClick = e => {
            if (this._open
                && !e.composedPath().includes(this._portalEl)
                && !e.composedPath().includes(this)) {
                this._open = false;
            }
        };
        document.addEventListener('pointerdown', this._onDocClick, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this._onDocClick, true);
        render(nothing, this._portalEl);
        this._portalEl.remove();
        this._portalEl = null;
    }

    async _loadSites() {
        try {
            const r = await fetch('/api/sites');
            const data = await r.json();
            this.sites = (data.sites || []).sort();
        } catch {
            this.sites = [feezal.siteName];
        }
    }

    _toggle(e) {
        this._open = !this._open;
        if (this._open) {
            this._filter        = '';
            this._renaming      = null;
            this._confirmDelete = null;
            this._loadSites();
            const rect = e.currentTarget.getBoundingClientRect();
            this._dropX = rect.left;
            this._dropY = rect.bottom + 4;
        }
    }

    _filteredSites() {
        if (!this._filter) return this.sites;
        const q = this._filter.toLowerCase();
        return this.sites.filter(s => s.toLowerCase().includes(q));
    }

    _switchSite(name) {
        if (name === feezal.siteName) { this._open = false; return; }
        if (feezal.hasChanges && !confirm('Switch site? Unsaved changes will be lost.')) return;
        window.location.href = `/editor/?${name}`;
    }

    // ── New site ──────────────────────────────────────────────────────────────

    _openNewDialog() {
        this._open      = false;
        this._newName   = '';
        this._newError  = '';
        this._newDialog = true;
        this.updateComplete.then(() => {
            const dlg = this.shadowRoot.querySelector('dialog');
            dlg?.showModal();
            this.shadowRoot.querySelector('#new-name-input')?.focus();
        });
    }

    _closeNewDialog() {
        this.shadowRoot.querySelector('dialog')?.close();
        this._newDialog = false;
    }

    async _createSite() {
        const name = this._newName.trim();
        if (!name) { this._newError = 'Name is required.'; return; }
        if (isReservedSiteName(name)) { this._newError = `"${name}" is a reserved name and cannot be used.`; return; }
        if (this.sites.includes(name)) { this._newError = 'A site with that name already exists.'; return; }
        this._busy = true;
        try {
            const r = await fetch('/api/sites', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name})
            });
            if (!r.ok) throw new Error(await r.text());
            this._closeNewDialog();
            if (feezal.hasChanges && !confirm('Navigate to new site? Unsaved changes will be lost.')) return;
            window.location.href = `/editor/?${name}`;
        } catch (err) {
            this._newError = err.message || 'Failed to create site.';
        } finally {
            this._busy = false;
        }
    }

    _onNewKeydown(e) {
        if (e.key === 'Enter')  this._createSite();
        if (e.key === 'Escape') this._closeNewDialog();
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────

    async _duplicateSite(name) {
        const newName = prompt(`Duplicate "${name}" as:`, `${name}-copy`);
        if (!newName) return;
        if (isReservedSiteName(newName)) { alert(`"${newName}" is a reserved name and cannot be used.`); return; }
        if (this.sites.includes(newName)) { alert(`"${newName}" already exists.`); return; }
        this._busy = true;
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(name)}/clone`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({newName})
            });
            if (!r.ok) throw new Error(await r.text());
            await this._loadSites();
        } catch (err) {
            alert(err.message || 'Failed to duplicate site.');
        } finally {
            this._busy = false;
        }
    }

    // ── Rename ────────────────────────────────────────────────────────────────

    _startRename(name) {
        this._renaming      = name;
        this._renameValue   = name;
        this._confirmDelete = null;
        this.updateComplete.then(() => {
            // Rename input is in the portal, not the shadow DOM.
            this._portalEl?.querySelector('.fsm-rename-input')?.select();
        });
    }

    _cancelRename() {
        this._renaming = null;
    }

    _onRenameKeydown(e) {
        if (e.key === 'Enter')  this._confirmRename();
        if (e.key === 'Escape') this._cancelRename();
    }

    async _confirmRename() {
        const oldName = this._renaming;
        const newName = this._renameValue.trim();
        if (!newName || newName === oldName) { this._cancelRename(); return; }
        if (isReservedSiteName(newName)) { alert(`"${newName}" is a reserved name and cannot be used.`); return; }
        if (this.sites.includes(newName)) { alert(`"${newName}" already exists.`); return; }
        this._busy = true;
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(oldName)}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({newName})
            });
            if (!r.ok) throw new Error(await r.text());
            this._renaming = null;
            // If current site was renamed, navigate to new name.
            if (oldName === feezal.siteName) {
                window.location.href = `/editor/?${newName}`;
            } else {
                await this._loadSites();
            }
        } catch (err) {
            alert(err.message || 'Failed to rename site.');
        } finally {
            this._busy = false;
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    async _deleteSite(name) {
        this._busy = true;
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(name)}`, {method: 'DELETE'});
            if (!r.ok) throw new Error(await r.text());
            this._confirmDelete = null;
            // If current site was deleted, navigate to 'default'.
            if (name === feezal.siteName) {
                window.location.href = '/editor/?default';
            } else {
                await this._loadSites();
            }
        } catch (err) {
            alert(err.message || 'Failed to delete site.');
        } finally {
            this._busy = false;
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    updated() {
        // Keep the body-level portal in sync with current dropdown state.
        // Rendering into document.body ensures the dropdown is in the root
        // stacking context and appears above all shadow-DOM canvas elements.
        if (this._portalEl) {
            render(this._portalTpl(), this._portalEl);
        }
    }

    _portalTpl() {
        if (!this._open) return nothing;
        const current  = feezal.siteName;
        const filtered = this._filteredSites();
        return html`
            <style>
                .fsm-dropdown {
                    position: fixed;
                    background: white; border: 1px solid #ccc; border-radius: 6px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2); z-index: 2147483647;
                    min-width: 220px; max-width: 320px;
                    display: flex; flex-direction: column;
                    max-height: 400px;
                    font-family: 'Roboto', sans-serif; font-size: 13px; color: #333;
                    box-sizing: border-box;
                }
                .fsm-dropdown * { box-sizing: border-box; }
                .fsm-filter-row { padding: 8px; border-bottom: 1px solid #eee; }
                .fsm-filter-input {
                    width: 100%; border: 1px solid #ccc; border-radius: 4px;
                    padding: 5px 8px; font-size: 13px; outline: none; font-family: inherit;
                }
                .fsm-filter-input:focus { border-color: rgba(250,120,0,0.8); }
                .fsm-site-list { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; flex: 1; }
                .fsm-site-row {
                    display: flex; align-items: center;
                    padding: 4px 8px; gap: 4px; font-size: 13px; min-height: 32px;
                }
                .fsm-site-row.active .fsm-name-link { font-weight: 600; color: rgba(250,120,0,0.9); }
                .fsm-site-row.confirm { background: #fff3f3; flex-wrap: wrap; gap: 6px; }
                .fsm-name-link {
                    flex: 1; cursor: pointer; padding: 2px 4px; border-radius: 3px;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .fsm-name-link:hover { background: #f5f5f5; }
                .fsm-row-actions { display: flex; gap: 2px; flex-shrink: 0; }
                .fsm-row-btn {
                    background: none; border: none; cursor: pointer;
                    font-size: 14px; padding: 2px 5px; border-radius: 3px;
                    color: #555; display: flex; align-items: center; justify-content: center;
                    font-family: inherit;
                }
                .fsm-row-btn:hover { background: #f0f0f0; }
                .fsm-row-btn.danger { color: #c62828; }
                .fsm-row-btn.danger:hover { background: #ffebee; }
                .fsm-row-btn:disabled { opacity: 0.4; cursor: default; }
                .fsm-rename-input {
                    flex: 1; border: 1px solid #aaa; border-radius: 4px;
                    padding: 3px 6px; font-size: 13px; outline: none; font-family: inherit;
                }
                .fsm-rename-input:focus { border-color: rgba(250,120,0,0.8); }
                .fsm-confirm-text { flex: 1; font-size: 12px; color: #c62828; }
                .fsm-empty-msg { padding: 10px 12px; font-size: 12px; color: #999; }
                .fsm-footer { padding: 8px; border-top: 1px solid #eee; }
                .fsm-add-btn {
                    width: 100%; background: none; border: 1px dashed #aaa; border-radius: 4px;
                    padding: 6px; font-size: 13px; cursor: pointer; color: #555; font-family: inherit;
                }
                .fsm-add-btn:hover { background: #f5f5f5; border-color: rgba(250,120,0,0.6); }
                /* ── Dark mode ──────────────────────────────────────────── */
                .fsm-dropdown.dark { background: #252525; color: rgba(255,255,255,0.85); border-color: #3d3d3d; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
                .fsm-dropdown.dark .fsm-filter-row { border-bottom-color: #3d3d3d; }
                .fsm-dropdown.dark .fsm-filter-input { background: #1e1e1e; border-color: #444; color: rgba(255,255,255,0.85); }
                .fsm-dropdown.dark .fsm-name-link:hover { background: #3a3a3a; }
                .fsm-dropdown.dark .fsm-row-btn { color: rgba(255,255,255,0.6); }
                .fsm-dropdown.dark .fsm-row-btn:hover { background: #3a3a3a; }
                .fsm-dropdown.dark .fsm-row-btn.danger { color: #ef9a9a; }
                .fsm-dropdown.dark .fsm-row-btn.danger:hover { background: #2a1515; }
                .fsm-dropdown.dark .fsm-rename-input { background: #1e1e1e; border-color: #444; color: rgba(255,255,255,0.85); }
                .fsm-dropdown.dark .fsm-confirm-text { color: #ef9a9a; }
                .fsm-dropdown.dark .fsm-site-row.confirm { background: #2a1515; }
                .fsm-dropdown.dark .fsm-empty-msg { color: rgba(255,255,255,0.4); }
                .fsm-dropdown.dark .fsm-footer { border-top-color: #3d3d3d; }
                .fsm-dropdown.dark .fsm-add-btn { border-color: #555; color: rgba(255,255,255,0.55); }
                .fsm-dropdown.dark .fsm-add-btn:hover { background: #3a3a3a; border-color: rgba(250,120,0,0.6); }
            </style>
            <div class="fsm-dropdown${this.darkMode ? ' dark' : ''}" style="top:${this._dropY}px;left:${this._dropX}px">
                <div class="fsm-filter-row">
                    <input class="fsm-filter-input" placeholder="Filter sites…"
                        .value="${this._filter}"
                        @input="${e => { this._filter = e.target.value; }}"
                        @keydown="${e => { if (e.key === 'Escape') this._open = false; }}">
                </div>
                <ul class="fsm-site-list">
                    ${filtered.map(s => this._renderRowPortal(s, current))}
                    ${filtered.length === 0
                        ? html`<li class="fsm-empty-msg">No sites match</li>`
                        : nothing}
                </ul>
                <div class="fsm-footer">
                    <button class="fsm-add-btn" @click="${this._openNewDialog}">+ New site</button>
                </div>
            </div>`;
    }

    _renderRowPortal(name, current) {
        if (this._renaming === name) {
            return html`
                <li class="fsm-site-row">
                    <input class="fsm-rename-input" .value="${this._renameValue}"
                        @input="${e => { this._renameValue = e.target.value; }}"
                        @keydown="${this._onRenameKeydown}">
                    <div class="fsm-row-actions">
                        <button class="fsm-row-btn" title="Save rename"
                            @click="${this._confirmRename}">&#10003;</button>
                        <button class="fsm-row-btn" title="Cancel"
                            @click="${this._cancelRename}">&#10007;</button>
                    </div>
                </li>`;
        }

        if (this._confirmDelete === name) {
            return html`
                <li class="fsm-site-row confirm">
                    <span class="fsm-confirm-text">Delete &ldquo;${name}&rdquo;?</span>
                    <div class="fsm-row-actions">
                        <button class="fsm-row-btn danger" ?disabled="${this._busy}"
                            @click="${() => this._deleteSite(name)}">Delete</button>
                        <button class="fsm-row-btn"
                            @click="${() => { this._confirmDelete = null; }}">Cancel</button>
                    </div>
                </li>`;
        }

        return html`
            <li class="fsm-site-row ${name === current ? 'active' : ''}">
                <span class="fsm-name-link"
                    @click="${() => this._switchSite(name)}">${name}</span>
                <div class="fsm-row-actions">
                    <button class="fsm-row-btn" title="Rename"
                        @click="${() => this._startRename(name)}">&#9998;</button>
                    <button class="fsm-row-btn" title="Duplicate"
                        @click="${() => this._duplicateSite(name)}">&#10066;</button>
                    <button class="fsm-row-btn danger" title="Delete"
                        @click="${() => { this._confirmDelete = name; this._renaming = null; }}">&#10005;</button>
                </div>
            </li>`;
    }

    render() {
        const current  = feezal.siteName;

        return html`
            <button class="trigger" @click="${this._toggle}" title="Switch site">
                <span class="t-icon">language</span>
                <span class="name">${current}</span>
                <span class="arrow">${this._open ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
            </button>

            ${this._newDialog ? html`
                <dialog @cancel="${this._closeNewDialog}">
                    <div class="dialog-inner">
                        <div class="dialog-title">New site</div>
                        <div class="dialog-field">
                            <label for="new-name-input">Site name</label>
                            <input id="new-name-input" type="text" placeholder="my-dashboard"
                                .value="${this._newName}"
                                @input="${e => { this._newName = e.target.value; this._newError = ''; }}"
                                @keydown="${this._onNewKeydown}">
                        </div>
                        <div class="dialog-error">${this._newError}</div>
                        <div class="dialog-btns">
                            <button class="btn-cancel" @click="${this._closeNewDialog}">Cancel</button>
                            <button class="btn-primary" ?disabled="${this._busy}" @click="${this._createSite}">
                                ${this._busy ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                </dialog>` : html``}
        `;
    }

    _renderRow(name, current) {
        if (this._renaming === name) {
            return html`
                <li class="site-row">
                    <input class="rename-input" .value="${this._renameValue}"
                        @input="${e => { this._renameValue = e.target.value; }}"
                        @keydown="${this._onRenameKeydown}">
                    <div class="row-actions">
                        <button class="row-btn" title="Save rename"
                            @click="${this._confirmRename}">&#10003;</button>
                        <button class="row-btn" title="Cancel"
                            @click="${this._cancelRename}">&#10007;</button>
                    </div>
                </li>`;
        }

        if (this._confirmDelete === name) {
            return html`
                <li class="site-row confirm">
                    <span class="confirm-text">Delete &ldquo;${name}&rdquo;?</span>
                    <div class="row-actions">
                        <button class="row-btn danger" ?disabled="${this._busy}"
                            @click="${() => this._deleteSite(name)}">Delete</button>
                        <button class="row-btn"
                            @click="${() => { this._confirmDelete = null; }}">Cancel</button>
                    </div>
                </li>`;
        }

        return html`
            <li class="site-row ${name === current ? 'active' : ''}">
                <span class="site-name-link"
                    @click="${() => this._switchSite(name)}">${name}</span>
                <div class="row-actions">
                    <button class="row-btn" title="Rename"
                        @click="${() => this._startRename(name)}">&#9998;</button>
                    <button class="row-btn" title="Duplicate"
                        @click="${() => this._duplicateSite(name)}">&#10066;</button>
                    <button class="row-btn danger" title="Delete"
                        @click="${() => { this._confirmDelete = name; this._renaming = null; }}">&#10005;</button>
                </div>
            </li>`;
    }
}

window.customElements.define('feezal-site-manager', FeezalSiteManager);
