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
    if (message.startsWith('save:'))    return message.replace(/^save:\s*/, '');
    return message;
}

function isRestoreEntry(message) { return message && message.startsWith('restore:'); }

class FeezalSidebarHistory extends LitElement {
    static properties = {
        _history:        {state: true},  // [{sha, date, message}]
        _loading:        {state: true},
        _confirmRestore: {state: true},  // {sha, label} | null
        _error:          {state: true},
        _busy:           {state: true},  // sha of in-flight operation

    };

    static styles = css`
        :host {
            display: flex; flex-direction: column; height: 100%;
            background: var(--feezal-bg, #fff); box-sizing: border-box; overflow: hidden;
            font-size: 13px; color: var(--feezal-color, #333);
        }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1;
            letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap;
            -webkit-font-smoothing: antialiased;
        }

        /* ── Header ─────────────────────────────────────────────────── */
        /* 39px content + 2px border = 41px — matches the unified sidebar
           tab bars and the .ftab view tab bar left of the sidebar. */
        .hdr {
            display: flex; align-items: center; gap: 6px;
            height: 41px; padding: 0 12px; box-sizing: border-box;
            border-bottom: 2px solid var(--feezal-border, #e4e4e4);
            background: var(--feezal-bg-sub, #f5f5f5);
            flex-shrink: 0;
        }
        .hdr-title { flex: 1; font-weight: 600; font-size: 14px; }
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
        this._history        = null;  // null = not loaded yet
        this._loading        = false;
        this._confirmRestore = null;
        this._error          = null;
        this._busy           = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._load();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    _siteName() {
        return window.feezal?.siteName || 'default';
    }

    async _load() {
        this._loading = true;
        this._error = null;
        try {
            const histRes = await fetch(`/api/sites/${this._siteName()}/history`);
            const histData = await histRes.json();
            this._history = histData.supported ? (histData.history || []) : null;
        } catch (err) {
            this._error = err.message;
        } finally {
            this._loading = false;
        }
    }

    _preview(sha) {
        window.open(`/viewer/${this._siteName()}?sha=${sha}`, '_blank');
    }

    _askRestore(sha, label) {
        this._confirmRestore = {sha, label};
        requestAnimationFrame(() => this.shadowRoot.querySelector('#dlg-restore')?.show());
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

    // ── (N16 moved to feezal-history-bar in the viewer) ─────────────────

    _REMOVED_N16_placeholder() {
        // N16 source/diff overlay moved to feezal-history-bar (viewer ?sha= bar)
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
            </div>

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
        const isFirst   = index === 0;
        const label     = labelFor(entry.message);
        const isRestore = isRestoreEntry(entry.message);
        const isBusy    = this._busy === entry.sha;

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
                    ${!isFirst ? html`
                        <button class="act-btn" title="Restore this version"
                            ?disabled="${isBusy}"
                            @click="${() => this._askRestore(entry.sha, label)}">
                            <span class="material-icons">undo</span>
                        </button>
                    ` : ''}
                    <button class="act-btn" title="Open preview in new tab"
                        ?disabled="${isBusy}"
                        @click="${() => this._preview(entry.sha)}">
                        <span class="material-icons">open_in_new</span>
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-sidebar-history', FeezalSidebarHistory);
export {FeezalSidebarHistory, labelFor, relativeTime};
