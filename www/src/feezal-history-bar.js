// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';
import {loadMonaco, syncMonacoStyles} from './feezal-monaco-loader.js';

/**
 * feezal-history-bar
 *
 * Rendered inside the viewer when window.feezal.historyBanner is set
 * (i.e. the viewer was opened with ?sha=<hash>).
 *
 * Shows:
 *   ← Older  [sha7 — commit label]  Newer →  [Source]  [Compare with ▼]  [✕ Live]
 *
 * "Source" opens a full-viewport Monaco read-only HTML editor.
 * "Compare with" opens a Monaco diff editor against any other commit.
 */

function labelFor(message) {
    if (!message) return 'Auto-save';
    if (message.startsWith('init:'))    return 'Initial version';
    if (message.startsWith('restore:')) return message.replace(/^restore:\s*/, '').replace(/\s*\([a-f0-9]{7}\)$/, '');
    if (message.startsWith('save:'))    return message.replace(/^save:\s*/, '');
    return message;
}

class FeezalHistoryBar extends LitElement {
    static properties = {
        _history:        {state: true},
        _overlay:        {state: true},
        _overlayLoading: {state: true},
    };

    static styles = css`
        :host { display: block; }

        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1;
            letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap;
            -webkit-font-smoothing: antialiased;
        }

        /* ── Navigation bar ─────────────────────────────────────────── */
        #bar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
            background: #1565c0; color: #fff;
            display: flex; align-items: center; gap: 8px;
            padding: 0 10px; height: 38px;
            font-family: sans-serif; font-size: 13px; box-sizing: border-box;
        }

        .nav-link {
            color: #fff; text-decoration: none;
            padding: 2px 10px;
            border: 1px solid rgba(255,255,255,0.45); border-radius: 4px;
            font-size: 12px; white-space: nowrap;
            display: flex; align-items: center; gap: 4px;
        }
        .nav-link:hover { background: rgba(255,255,255,0.15); }
        .nav-link.disabled {
            border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.35);
            pointer-events: none;
        }

        .label {
            flex: 1; text-align: center;
            font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            opacity: 0.95;
        }

        .action-btn {
            background: none; border: 1px solid rgba(255,255,255,0.45); border-radius: 4px;
            cursor: pointer; color: #fff; font-size: 12px; padding: 2px 10px;
            display: flex; align-items: center; gap: 4px; white-space: nowrap;
        }
        .action-btn:hover { background: rgba(255,255,255,0.15); }
        .action-btn .material-icons { font-size: 15px; }

        .compare-wrap { position: relative; }
        .compare-select {
            background: transparent; border: 1px solid rgba(255,255,255,0.45); border-radius: 4px;
            color: #fff; font-size: 12px; padding: 2px 8px; cursor: pointer;
            outline: none; max-width: 200px;
        }
        .compare-select option { background: #1565c0; color: #fff; }

        /* ── Editor / diff panel below the top bar ─────────── */
        .overlay {
            position: fixed; top: 38px; left: 0; right: 0; bottom: 0; z-index: 100000;
            background: #1e1e1e;
            display: flex; flex-direction: column;
        }
        .overlay-header {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 14px; flex-shrink: 0;
            background: #2d2d2d; border-bottom: 1px solid #444;
            font-size: 13px; color: rgba(255,255,255,0.85);
        }
        .overlay-title { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .overlay-sha {
            font-family: Consolas, monospace; font-size: 11px;
            color: rgba(255,255,255,0.45); flex-shrink: 0;
        }
        .overlay-close {
            background: none; border: none; cursor: pointer; padding: 2px 8px;
            border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 18px; line-height: 1;
        }
        .overlay-close:hover { background: rgba(255,255,255,0.1); color: white; }
        .overlay-editor { flex: 1; min-height: 0; position: relative; overflow: hidden; }
        .overlay-loading {
            flex: 1; display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.5); font-size: 13px; gap: 10px;
        }
        .spinner {
            width: 18px; height: 18px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: rgba(255,255,255,0.7);
            border-radius: 50%; animation: spin 0.7s linear infinite;
            flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Push down the viewer body by the bar height */
        :host { margin-bottom: 0; }
    `;

    constructor() {
        super();
        this._history        = null;
        this._overlay        = null;
        this._overlayLoading = false;
        this._monacoEditor   = null;
    }

    connectedCallback() {
        super.connectedCallback();
        const banner = window.feezal?.historyBanner;
        if (!banner) return;
        this._onKeydown = e => {
            if (this._overlay && e.key === 'Escape') this._closeOverlay();
        };
        document.addEventListener('keydown', this._onKeydown);
        this._loadHistory(banner.siteName);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this._onKeydown);
        this._monacoEditor?.dispose();
    }

    async _loadHistory(siteName) {
        try {
            const res = await fetch(`/api/sites/${siteName}/history`);
            const data = await res.json();
            this._history = data.supported ? (data.history || []) : [];
        } catch {
            this._history = [];
        }
    }

    render() {
        const banner = window.feezal?.historyBanner;
        if (!banner) return html``;

        const {sha, prevSha, nextSha, label, siteName} = banner;

        const otherCommits = (this._history || []).filter(c => !c.sha.startsWith(sha) && !sha.startsWith(c.sha.slice(0, 7)));

        return html`
            ${this._overlay ? this._renderOverlay() : ''}
            <div id="bar">
                <a class="nav-link ${!prevSha ? 'disabled' : ''}"
                   href="${prevSha ? `/viewer/${siteName}?sha=${prevSha}` : '#'}"
                   @click="${this._navigate}">
                    <span class="material-icons" style="font-size:14px">arrow_back</span> Older
                </a>
                <a class="nav-link ${!nextSha ? 'disabled' : ''}"
                   href="${nextSha ? `/viewer/${siteName}?sha=${nextSha}` : '#'}"
                   @click="${this._navigate}">
                    Newer <span class="material-icons" style="font-size:14px">arrow_forward</span>
                </a>

                <span class="label">
                    <span style="font-family:Consolas,monospace;opacity:.55;margin-right:6px">${sha.slice(0, 7)}</span>${label}
                </span>

                <button class="action-btn" title="View HTML source at this commit" @click="${this._viewSource}">
                    <span class="material-icons">code</span> Source
                </button>

                ${otherCommits.length > 0 ? html`
                    <div class="compare-wrap">
                        <select class="compare-select" @change="${this._onCompareChange}">
                            <option value="">Compare with…</option>
                            ${otherCommits.map(c => html`
                                <option value="${c.sha}">${c.sha.slice(0, 7)} — ${labelFor(c.message)}</option>
                            `)}
                        </select>
                    </div>
                ` : ''}

                <a class="nav-link" href="/viewer/${siteName}" title="Return to live version"
                   @click="${this._navigate}">
                    ✕ Live
                </a>
            </div>
        `;
    }

    _renderOverlay() {
        const {mode, sha, otherSha, label} = this._overlay;
        const title = mode === 'source'
            ? `Source — ${label}`
            : `Diff: ${sha.slice(0, 7)} vs. ${otherSha.slice(0, 7)}`;

        return html`
            <div class="overlay">
                <div class="overlay-header">
                    <button class="overlay-close" title="Close (Esc)" @click="${this._closeOverlay}">×</button>
                    <span class="overlay-title">${title}</span>
                    <span class="overlay-sha">${sha.slice(0, 7)}</span>
                </div>
                ${this._overlayLoading
                    ? html`<div class="overlay-loading"><span class="spinner"></span> Loading…</div>`
                    : html`<div class="overlay-editor" id="overlay-editor"></div>`}
            </div>
        `;
    }

    async _viewSource() {
        const banner = window.feezal?.historyBanner;
        if (!banner) return;
        this._overlayLoading = true;
        this._overlay = {mode: 'source', sha: banner.sha, otherSha: '', label: banner.label};
        let content = '';
        try {
            content = await this._fetchFile(banner.siteName, banner.sha);
        } catch (err) {
            content = `Error: ${err.message}`;
        } finally {
            this._overlayLoading = false;
        }
        this._overlay = {...this._overlay, content};
        await this.updateComplete;
        this._mountMonacoSource(content);
    }

    async _onCompareChange(e) {
        const otherSha = e.target.value;
        if (!otherSha) return;
        e.target.value = '';   // reset select
        const banner = window.feezal?.historyBanner;
        if (!banner) return;

        const otherLabel = labelFor(this._history?.find(c => c.sha === otherSha)?.message || '');
        this._overlayLoading = true;
        this._overlay = {mode: 'diff', sha: banner.sha, otherSha, label: banner.label};

        let thisContent = '', otherContent = '';
        try {
            [thisContent, otherContent] = await Promise.all([
                this._fetchFile(banner.siteName, banner.sha),
                this._fetchFile(banner.siteName, otherSha)
            ]);
        } catch (err) {
            thisContent = `Error: ${err.message}`;
        } finally {
            this._overlayLoading = false;
        }
        this._overlay = {...this._overlay, thisContent, otherContent};
        await this.updateComplete;
        this._mountMonacoDiff(thisContent, otherContent);
    }

    /**
     * Navigate keeping the currently selected view: the plain hrefs carry no
     * fragment, so following them would drop the #/view hash and reset the
     * dashboard to its first view on every history step. Appending the hash
     * at click time preserves whatever view the user is looking at — across
     * Older/Newer pagination and back to Live.
     */
    _navigate(event) {
        event.preventDefault();
        this._go(event.currentTarget.getAttribute('href') + location.hash);
    }

    /** Extracted for tests — happy-dom cannot observe real navigation. */
    _go(url) {
        window.location.href = url;
    }

    _closeOverlay() {
        this._monacoEditor?.dispose();
        this._monacoEditor = null;
        this._overlay = null;
    }

    async _mountMonacoSource(content) {
        const wrap = this.shadowRoot.getElementById('overlay-editor');
        if (!wrap) return;
        this._monacoEditor?.dispose();
        const monaco = await loadMonaco();
        this._monacoEditor = monaco.editor.create(wrap, {
            value:               content ?? '',
            language:            'html',
            theme:               'vs-dark',
            readOnly:            true,
            minimap:             {enabled: false},
            lineNumbers:         'on',
            automaticLayout:     true,
            scrollBeyondLastLine: false,
            fontSize:            13,
            fontFamily:          'Consolas, "Courier New", monospace',
            wordWrap:            'on'
        });
        syncMonacoStyles(this.shadowRoot);
    }

    async _mountMonacoDiff(leftContent, rightContent) {
        const wrap = this.shadowRoot.getElementById('overlay-editor');
        if (!wrap) return;
        this._monacoEditor?.dispose();
        const monaco = await loadMonaco();
        this._monacoEditor = monaco.editor.createDiffEditor(wrap, {
            theme:               'vs-dark',
            readOnly:            true,
            minimap:             {enabled: false},
            automaticLayout:     true,
            scrollBeyondLastLine: false,
            fontSize:            13,
            fontFamily:          'Consolas, "Courier New", monospace',
            renderSideBySide:    true,
            wordWrap:            'on'
        });
        this._monacoEditor.setModel({
            original: monaco.editor.createModel(leftContent ?? '', 'html'),
            modified: monaco.editor.createModel(rightContent ?? '', 'html')
        });
        syncMonacoStyles(this.shadowRoot);
    }

    async _fetchFile(siteName, sha) {
        const res = await fetch(`/api/sites/${siteName}/history/${sha}/file?path=site.html`);
        if (!res.ok) throw new Error(await res.text());
        return res.text();
    }
}

customElements.define('feezal-history-bar', FeezalHistoryBar);
export {FeezalHistoryBar, labelFor};
