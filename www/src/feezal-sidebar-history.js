import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';

// ── Relative-time helper ─────────────────────────────────────────────────────
const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});
function relativeTime(isoDate) {
    const diff = (new Date(isoDate) - Date.now()) / 1000; // seconds, negative = past
    const abs = Math.abs(diff);
    if (abs < 60)   return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

// Label shown for each commit based on its git message prefix.
function labelFor(message) {
    if (!message) return 'Auto-save';
    if (message.startsWith('init:'))    return 'Initial version';
    if (message.startsWith('restore:')) return message.replace(/^restore:\s*/, '').replace(/\s*\([a-f0-9]{7}\)$/, '');
    if (message.startsWith('save:'))    return 'Auto-save';
    return message;
}

function isRestoreEntry(message) { return message && message.startsWith('restore:'); }

class FeezalSidebarHistory extends LitElement {
    static properties = {
        _history:    {state: true},  // [{sha, date, message}]
        _archives:   {state: true},  // [{name, date, tipMessage}]
        _loading:    {state: true},
        _archivesOpen: {state: true},
        _activeMenu: {state: true},  // sha of the entry whose action menu is open, or null
        _confirmRestore:  {state: true},  // {sha, label} | null
        _confirmDiscard:  {state: true},  // {sha, label, count} | null
        _confirmDelArch:  {state: true},  // archive branch name | null
        _error:      {state: true},
        _busy:       {state: true},  // sha of in-flight operation
    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            background: var(--feezal-bg, #fff); box-sizing: border-box; overflow: hidden;
            font-size: 13px; color: var(--feezal-color, #333);
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .hdr {
            display: flex; align-items: center; gap: 6px;
            padding: 10px 12px 8px; border-bottom: 1px solid var(--feezal-border, #e4e4e4);
            flex-shrink: 0;
        }
        .hdr-title { flex: 1; font-weight: 600; font-size: 13px; }
        .hdr-btn {
            background: none; border: none; cursor: pointer; padding: 4px;
            border-radius: 4px; color: var(--feezal-color, #555);
            display: flex; align-items: center;
        }
        .hdr-btn:hover { background: rgba(0,0,0,0.07); }
        .hdr-btn .material-icons { font-size: 18px; }

        /* ── Scrollable body ─────────────────────────────────────────── */
        .body { flex: 1; overflow-y: auto; }

        /* ── Unsupported / empty states ─────────────────────────────── */
        .state-msg {
            padding: 24px 16px; color: #999; font-size: 12px; text-align: center;
            line-height: 1.6;
        }
        .error-msg {
            padding: 8px 12px; background: #fff3f3; color: #c62828;
            border-bottom: 1px solid #ffcdd2; font-size: 12px;
        }

        /* ── Timeline ───────────────────────────────────────────────── */
        .timeline { padding: 0 0 16px; }

        .entry {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 8px 12px; position: relative; cursor: default;
        }
        .entry:hover { background: var(--feezal-bg-sub, #f8f8f8); }
        .entry.first .dot { color: var(--sl-color-primary-600, #0284c7); }

        /* Vertical line through all entries */
        .entry::before {
            content: ''; position: absolute; left: 19px; top: 0; bottom: 0;
            width: 2px; background: var(--feezal-border, #e4e4e4);
        }
        .entry:first-child::before { top: 14px; }
        .entry:last-child::before  { bottom: calc(100% - 14px); }

        .dot {
            flex-shrink: 0; margin-top: 1px; font-size: 16px;
            color: var(--feezal-color, #aaa); z-index: 1;
            background: var(--feezal-bg, #fff); line-height: 1;
        }
        .entry:hover .dot { background: var(--feezal-bg-sub, #f8f8f8); }
        .dot .material-icons { font-size: 16px; }

        .entry-body { flex: 1; min-width: 0; }
        .entry-time {
            font-size: 11px; color: #999; white-space: nowrap;
        }
        .entry-label {
            font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            margin-top: 1px;
        }
        .entry-label.restore { color: var(--sl-color-primary-600, #0284c7); font-style: italic; }

        .entry-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

        .act-btn {
            background: none; border: none; cursor: pointer;
            padding: 3px 5px; border-radius: 4px;
            color: var(--feezal-color, #555); font-size: 11px;
            white-space: nowrap;
            display: flex; align-items: center; gap: 3px;
        }
        .act-btn:hover { background: rgba(0,0,0,0.07); }
        .act-btn .material-icons { font-size: 15px; }
        .act-btn:disabled { opacity: 0.35; cursor: default; }

        /* Floating action dropdown */
        .drop {
            position: fixed; z-index: 10000; min-width: 180px;
            background: var(--feezal-bg, #fff);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 6px;
            box-shadow: 0 4px 20px rgba(0,0,0,.22); padding: 4px 0;
        }
        .drop-item {
            padding: 7px 14px; cursor: pointer; white-space: nowrap; font-size: 13px;
            display: flex; align-items: center; gap: 10px;
        }
        .drop-item .material-icons { font-size: 16px; opacity: 0.7; }
        .drop-item:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .drop-item:hover .material-icons { opacity: 1; }
        .drop-item.danger:hover { background: #c62828; color: #fff; }
        .drop-sep { height: 1px; background: var(--feezal-border, #e4e4e4); margin: 4px 0; }

        /* ── Archives section ───────────────────────────────────────── */
        .archives-hdr {
            display: flex; align-items: center; gap: 6px;
            padding: 10px 12px 8px;
            border-top: 1px solid var(--feezal-border, #e4e4e4);
            cursor: pointer; user-select: none; flex-shrink: 0;
        }
        .archives-hdr:hover { background: var(--feezal-bg-sub, #f8f8f8); }
        .archives-hdr-label { flex: 1; font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
        .archives-hdr-arrow { font-size: 10px; color: #999; }
        .archives-badge {
            font-size: 9px; font-weight: 700; color: #fff;
            background: #888; border-radius: 10px; padding: 1px 5px;
        }

        .archive-card {
            margin: 0 12px 8px; padding: 8px 10px;
            border: 1px solid var(--feezal-border, #e4e4e4); border-radius: 6px;
            font-size: 12px;
        }
        .archive-card-date { color: #888; font-size: 11px; }
        .archive-card-msg  { margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .archive-card-actions { margin-top: 6px; display: flex; gap: 6px; }
        .archive-del-btn {
            background: none; border: 1px solid #d32f2f; color: #d32f2f; cursor: pointer;
            padding: 2px 8px; border-radius: 4px; font-size: 11px;
        }
        .archive-del-btn:hover { background: #d32f2f; color: #fff; }

        /* ── sl-dialog dark mode ─────────────────────────────────────── */
        :host-context(.dark) sl-dialog {
            --sl-panel-background-color: #2e2e2e;
            --sl-panel-border-color: #3d3d3d;
            --sl-color-neutral-0:   #1e1e1e;
            --sl-color-neutral-700: rgba(255,255,255,0.75);
            --sl-color-neutral-900: rgba(255,255,255,0.9);
            --sl-color-neutral-1000: rgba(255,255,255,0.95);
        }
    `;

    constructor() {
        super();
        this._history    = null;  // null = not loaded yet
        this._archives   = [];
        this._loading    = false;
        this._archivesOpen = false;
        this._activeMenu = null;  // {sha, x, y}
        this._confirmRestore = null;
        this._confirmDiscard = null;
        this._confirmDelArch = null;
        this._error = null;
        this._busy = null;
        this._closeMenuBound = this._closeMenu.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
        document.addEventListener('pointerdown', this._closeMenuBound);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this._closeMenuBound);
    }

    _siteName() {
        return window.feezal?.siteName || 'default';
    }

    async _load() {
        this._loading = true;
        this._error = null;
        try {
            const [histRes, archRes] = await Promise.all([
                fetch(`/api/sites/${this._siteName()}/history`),
                fetch(`/api/sites/${this._siteName()}/history/archives`)
            ]);
            const histData = await histRes.json();
            this._archives = archRes.ok ? await archRes.json() : [];
            if (!histData.supported) {
                this._history = null;
            } else {
                this._history = histData.history || [];
            }
        } catch (err) {
            this._error = err.message;
        } finally {
            this._loading = false;
        }
    }

    _closeMenu(e) {
        if (!this._activeMenu) return;
        // Don't close if the click was inside the dropdown
        const drop = this.shadowRoot?.querySelector('.drop');
        if (drop && drop.contains(e.target)) return;
        this._activeMenu = null;
    }

    _openMenu(e, sha, label) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        this._activeMenu = {sha, label, x: rect.right, y: rect.bottom + 4};
    }

    _preview(sha) {
        window.open(`/viewer/${this._siteName()}?sha=${sha}`, '_blank');
    }

    _askRestore(sha, label) {
        this._activeMenu = null;
        this._confirmRestore = {sha, label};
        requestAnimationFrame(() => this.shadowRoot.querySelector('#dlg-restore')?.show());
    }

    _askDiscard(sha, label, indexInHistory) {
        this._activeMenu = null;
        // Count how many commits would be discarded (everything above this entry)
        const count = indexInHistory;
        this._confirmDiscard = {sha, label, count};
        requestAnimationFrame(() => this.shadowRoot.querySelector('#dlg-discard')?.show());
    }

    async _doRestore() {
        const {sha, label} = this._confirmRestore;
        this.shadowRoot.querySelector('#dlg-restore').hide();
        this._confirmRestore = null;
        this._busy = sha;
        this._error = null;
        try {
            const res = await fetch(`/api/sites/${this._siteName()}/history/${sha}/restore`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({label})
            });
            if (!res.ok) throw new Error((await res.json()).error || res.statusText);
            window.location.reload();
        } catch (err) {
            this._error = `Restore failed: ${err.message}`;
            this._busy = null;
        }
    }

    async _doDiscard() {
        const {sha} = this._confirmDiscard;
        this.shadowRoot.querySelector('#dlg-discard').hide();
        this._confirmDiscard = null;
        this._busy = sha;
        this._error = null;
        try {
            const res = await fetch(`/api/sites/${this._siteName()}/history/${sha}/discard`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            if (!res.ok) throw new Error((await res.json()).error || res.statusText);
            window.location.reload();
        } catch (err) {
            this._error = `Discard failed: ${err.message}`;
            this._busy = null;
        }
    }

    async _deleteArchive(branchName) {
        this._confirmDelArch = null;
        this.shadowRoot.querySelector('#dlg-del-arch').hide();
        try {
            await fetch(`/api/sites/${this._siteName()}/history/archives`, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({branch: branchName})
            });
            await this._load();
        } catch (err) {
            this._error = `Delete failed: ${err.message}`;
        }
    }

    render() {
        return html`
            <div class="hdr">
                <span class="hdr-title">Version history</span>
                <button class="hdr-btn" title="Refresh" @click="${this._load}">
                    <span class="material-icons">refresh</span>
                </button>
            </div>

            ${this._error ? html`<div class="error-msg">${this._error}</div>` : ''}

            <div class="body">
                ${this._renderBody()}
                ${this._renderArchives()}
            </div>

            ${this._activeMenu ? this._renderDropdown() : ''}

            <!-- Restore confirmation -->
            <sl-dialog id="dlg-restore" label="Restore version">
                <p style="margin:0">
                    Restore the version from
                    <strong>${this._confirmRestore?.label}</strong>?<br><br>
                    A new save will be created at the top of the timeline. Your full
                    history is preserved — nothing is deleted.
                </p>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
                    <sl-button @click="${() => { this._confirmRestore = null; this.shadowRoot.querySelector('#dlg-restore').hide(); }}">Cancel</sl-button>
                    <sl-button variant="primary" @click="${this._doRestore}">Restore</sl-button>
                </div>
            </sl-dialog>

            <!-- Discard confirmation -->
            <sl-dialog id="dlg-discard" label="Discard saves">
                <p style="margin:0">
                    This will discard
                    <strong>${this._confirmDiscard?.count} save${this._confirmDiscard?.count !== 1 ? 's' : ''}</strong>
                    made after
                    <strong>${this._confirmDiscard?.label}</strong>.<br><br>
                    The discarded saves will be moved to <em>Archived timelines</em> and
                    can be recovered from there later.
                </p>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
                    <sl-button @click="${() => { this._confirmDiscard = null; this.shadowRoot.querySelector('#dlg-discard').hide(); }}">Cancel</sl-button>
                    <sl-button variant="danger" @click="${this._doDiscard}">
                        Discard ${this._confirmDiscard?.count} save${this._confirmDiscard?.count !== 1 ? 's' : ''}
                    </sl-button>
                </div>
            </sl-dialog>

            <!-- Delete archive confirmation -->
            <sl-dialog id="dlg-del-arch" label="Delete archive">
                <p style="margin:0">
                    Permanently delete this archived timeline?
                    <strong>This cannot be undone.</strong>
                </p>
                <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
                    <sl-button @click="${() => { this._confirmDelArch = null; this.shadowRoot.querySelector('#dlg-del-arch').hide(); }}">Cancel</sl-button>
                    <sl-button variant="danger" @click="${() => this._deleteArchive(this._confirmDelArch)}">Delete</sl-button>
                </div>
            </sl-dialog>
        `;
    }

    _renderBody() {
        if (this._loading) {
            return html`<div class="state-msg">Loading…</div>`;
        }
        if (this._history === null) {
            return html`<div class="state-msg">
                Version history is not available.<br>
                Make sure <strong>git</strong> is installed on the server.
            </div>`;
        }
        if (this._history.length === 0) {
            return html`<div class="state-msg">No saves yet.</div>`;
        }

        return html`
            <div class="timeline">
                ${this._history.map((entry, i) => this._renderEntry(entry, i))}
            </div>
        `;
    }

    _renderEntry(entry, index) {
        const isFirst  = index === 0;
        const label    = labelFor(entry.message);
        const isRestore = isRestoreEntry(entry.message);
        const isBusy   = this._busy === entry.sha;

        return html`
            <div class="entry ${isFirst ? 'first' : ''}">
                <div class="dot">
                    <span class="material-icons">${isRestore ? 'undo' : 'radio_button_checked'}</span>
                </div>
                <div class="entry-body">
                    <div class="entry-time" title="${new Date(entry.date).toLocaleString()}">${relativeTime(entry.date)}</div>
                    <div class="entry-label ${isRestore ? 'restore' : ''}">${label}</div>
                </div>
                <div class="entry-actions">
                    <button class="act-btn" title="Open preview in new tab"
                        ?disabled="${isBusy}"
                        @click="${() => this._preview(entry.sha)}">
                        <span class="material-icons">open_in_new</span>
                    </button>
                    ${!isFirst ? html`
                        <button class="act-btn" title="Actions"
                            ?disabled="${isBusy}"
                            @click="${e => this._openMenu(e, entry.sha, label)}">
                            <span class="material-icons">more_vert</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    _renderDropdown() {
        const {sha, label, x, y} = this._activeMenu;
        // Find index in history list so we can count discardable saves
        const idx = this._history?.findIndex(e => e.sha === sha) ?? -1;

        return html`
            <div class="drop" style="right:${document.documentElement.clientWidth - x + 4}px;top:${y}px">
                <div class="drop-item" @click="${() => { this._activeMenu = null; this._askRestore(sha, label); }}">
                    <span class="material-icons">undo</span> Restore to this version
                </div>
                ${idx > 0 ? html`
                    <div class="drop-sep"></div>
                    <div class="drop-item danger" @click="${() => { this._activeMenu = null; this._askDiscard(sha, label, idx); }}">
                        <span class="material-icons">delete_sweep</span> Discard ${idx} save${idx !== 1 ? 's' : ''} since this version
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderArchives() {
        if (!this._archives.length) return '';
        return html`
            <div class="archives-hdr" @click="${() => { this._archivesOpen = !this._archivesOpen; }}">
                <span class="archives-hdr-label">Archived timelines</span>
                <span class="archives-badge">${this._archives.length}</span>
                <span class="archives-hdr-arrow">${this._archivesOpen ? '▲' : '▼'}</span>
            </div>
            ${this._archivesOpen ? this._archives.map(a => html`
                <div class="archive-card">
                    <div class="archive-card-date">${relativeTime(a.date)}</div>
                    <div class="archive-card-msg">${a.tipMessage || a.name}</div>
                    <div class="archive-card-actions">
                        <button class="archive-del-btn" @click="${() => {
                            this._confirmDelArch = a.name;
                            requestAnimationFrame(() => this.shadowRoot.querySelector('#dlg-del-arch')?.show());
                        }}">Delete</button>
                    </div>
                </div>
            `) : ''}
        `;
    }
}

customElements.define('feezal-sidebar-history', FeezalSidebarHistory);
export {FeezalSidebarHistory};
