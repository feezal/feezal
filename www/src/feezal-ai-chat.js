/* global feezal */
import {LitElement, html, css} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {marked} from 'marked';
import DOMPurify from 'dompurify';

// Open Markdown links in a new tab, safely. Registered once at module load.
DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});

/**
 * feezal-ai-chat — U9 AI assistant panel (Phase 1: design mode).
 *
 * A right-docked, resizable chat panel. The model always returns the full
 * proposed view HTML; in design mode we never show that HTML — instead we parse
 * it, validate it, and present a simple "Change view?" confirmation, then apply
 * it to the live canvas via the `onApply` callback.
 *
 * Theming: all colours route through feezal CSS custom properties so the panel
 * follows the editor's light/dark theme (the app-editor propagates the dark vars
 * into this element's host — see its `:host(.dark) feezal-ai-chat` rule).
 */
const LS_CONV   = 'feezal:ai:conversation';
const LS_CONVID = 'feezal:ai:convId';
const LS_MODEL  = 'feezal:selectedModel';
const LS_AGENT  = 'feezal:ai:agentMode';

function newId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c' + Date.now();
}

const BLOCKED_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'style'];

class FeezalAiChat extends LitElement {
    static properties = {
        onApply:           {attribute: false},
        buildSourceContext:{attribute: false},
        editorMode:        {type: String},
        viewNames:         {attribute: false},
        _targetView:       {state: true},
        _messages:        {state: true},
        _input:           {state: true},
        _streaming:       {state: true},
        _streamingText:   {state: true},
        _error:           {state: true},
        _pendingApply:    {state: true},
        _applyError:      {state: true},
        _autoApply:       {state: true},
        _models:          {state: true},
        _selectedModel:   {state: true},
        _provider:        {state: true},
        _toast:           {state: true},
        _history:         {state: true},
        _historyOpen:     {state: true},
        _extraFiles:      {state: true},
        _includeView:     {state: true},
        _dragOver:        {state: true},
        _agentMode:       {state: true},
        _activity:        {state: true},
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #1f2328);
            font-size: 13px;
            box-sizing: border-box;
            border-left: 1px solid var(--feezal-border, #e4e4e7);
        }
        * { box-sizing: border-box; }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }

        header {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px;
            border-bottom: 1px solid var(--feezal-border, #e4e4e7);
            background: var(--feezal-bg-sub, #fafafa);
        }
        header .title {
            display: flex; align-items: center; gap: 6px;
            font-weight: 600; font-size: 13px; flex: 1; min-width: 0;
        }
        header .title .material-icons { font-size: 18px; color: var(--sl-color-primary-600, #0284c7); }
        select.model {
            max-width: 150px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px;
            padding: 2px 4px; font-size: 11px;
        }
        .hbtn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; border: none; border-radius: 4px;
            background: transparent; color: inherit; cursor: pointer;
        }
        .hbtn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .hbtn.active { background: var(--feezal-btn-hover, rgba(0,0,0,0.12)); }
        .hbtn .material-icons { font-size: 18px; }

        .history-list { display: flex; flex-direction: column; gap: 2px; }
        .history-item {
            display: flex; align-items: center; gap: 8px; padding: 7px 8px;
            border-radius: 6px; cursor: pointer;
        }
        .history-item:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.05)); }
        .history-item.active { background: color-mix(in srgb, var(--sl-color-primary-600, #0284c7) 12%, transparent); }
        .history-item .history-title {
            flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .history-item .hbtn { opacity: 0; }
        .history-item:hover .hbtn { opacity: 0.7; }

        .stream {
            flex: 1; overflow-y: auto; padding: 12px;
            display: flex; flex-direction: column; gap: 14px;
        }
        .msg { display: flex; flex-direction: column; max-width: 100%; }
        .msg.user { align-items: flex-end; }
        .msg.user .bubble {
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
            border-radius: 12px 12px 2px 12px; padding: 7px 11px;
            max-width: 85%; white-space: pre-wrap; word-break: break-word;
        }
        .msg.assistant .bubble {
            white-space: pre-wrap; word-break: break-word; line-height: 1.5;
        }
        .msg.assistant pre {
            background: var(--feezal-bg-sub, #f4f4f5); border: 1px solid var(--feezal-border, #e4e4e7);
            border-radius: 6px; padding: 8px; overflow-x: auto; font-size: 12px;
        }
        .muted { color: var(--sl-color-neutral-600, #777); font-style: italic; }

        .dots span {
            display: inline-block; width: 5px; height: 5px; margin-right: 3px;
            border-radius: 50%; background: var(--sl-color-neutral-600, #888);
            animation: blink 1.4s infinite both;
        }
        .dots span:nth-child(2) { animation-delay: .2s; }
        .dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%, 80%, 100% { opacity: .2; } 40% { opacity: 1; } }

        .card {
            border: 1px solid var(--sl-color-primary-600, #0284c7);
            border-radius: 8px; padding: 10px; margin-top: 8px;
            background: color-mix(in srgb, var(--sl-color-primary-600, #0284c7) 7%, transparent);
        }
        .card.err { border-color: var(--sl-color-danger-600, #d32f2f);
            background: color-mix(in srgb, var(--sl-color-danger-600, #d32f2f) 8%, transparent); }
        .card .card-title { font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .card .card-title .material-icons { font-size: 18px; }
        .card .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .card .raw { margin-top: 8px; }
        .card .raw pre { max-height: 180px; overflow: auto; font-size: 11px; margin: 6px 0 0;
            background: var(--feezal-bg-sub, #f4f4f5); border: 1px solid var(--feezal-border, #ddd);
            border-radius: 6px; padding: 8px; }
        .card summary { cursor: pointer; color: var(--sl-color-neutral-600, #777); font-size: 12px; }

        .btn {
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); border-radius: 6px; padding: 5px 12px;
            font-size: 12px; cursor: pointer; font: inherit;
        }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .btn.primary { background: var(--sl-color-primary-600, #0284c7); border-color: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .btn.primary:hover { filter: brightness(1.05); }

        .error-banner {
            margin: 0 12px; padding: 8px 10px; border-radius: 6px;
            background: color-mix(in srgb, var(--sl-color-danger-600, #d32f2f) 12%, transparent);
            color: var(--sl-color-danger-700, #b91c1c); font-size: 12px;
        }

        .composer { border-top: 1px solid var(--feezal-border, #e4e4e7); padding: 8px; }
        .composer.dragover { outline: 2px dashed var(--sl-color-primary-600, #0284c7); outline-offset: -4px; }
        .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
        .chip {
            display: inline-flex; align-items: center; gap: 3px; max-width: 160px;
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #444); border-radius: 12px; padding: 2px 8px;
            font: inherit; font-size: 11px; cursor: pointer;
        }
        .chip .material-icons { font-size: 13px; opacity: .7; }
        .chip.on { background: color-mix(in srgb, var(--sl-color-primary-600, #0284c7) 14%, transparent);
            border-color: var(--sl-color-primary-600, #0284c7); color: var(--sl-color-primary-700, #0369a1); }
        .chip.file { cursor: default; }
        .chip .chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chip .chip-x { border: none; background: none; cursor: pointer; color: inherit; font-size: 14px; line-height: 1; padding: 0 0 0 2px; }
        .chip.add { font-size: 14px; line-height: 1; padding: 2px 9px; color: var(--sl-color-neutral-600, #777); }
        .target-row {
            display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
            font-size: 11px; color: var(--sl-color-neutral-600, #777);
        }
        .target-row .material-icons { font-size: 14px; }
        .target-select {
            flex: 1; min-width: 0; background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px; padding: 2px 4px; font-size: 11px;
        }
        .composer .box {
            display: flex; align-items: flex-end; gap: 6px;
            border: 1px solid var(--feezal-border, #ccc); border-radius: 10px;
            padding: 6px 6px 6px 10px; background: var(--feezal-bg, #fff);
        }
        .composer textarea {
            flex: 1; border: none; outline: none; resize: none; font: inherit;
            background: transparent; color: var(--feezal-color, #333);
            min-height: 4.2em; max-height: 160px; line-height: 1.4;
        }
        .send {
            flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%;
            background: var(--sl-color-primary-600, #0284c7); color: #fff; cursor: pointer;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .send:disabled { opacity: .4; cursor: default; }
        .send .material-icons { font-size: 18px; }
        .hint { color: var(--sl-color-neutral-600, #888); font-size: 10px; margin: 4px 2px 0; }

        .toast {
            position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%);
            background: var(--sl-color-neutral-900, #18181b); color: #fff;
            padding: 6px 12px; border-radius: 6px; font-size: 12px; pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .empty { text-align: center; color: var(--sl-color-neutral-600, #888);
            margin: auto; padding: 20px; line-height: 1.6; }

        /* ── Activity animation (U27): shiny sweeping border + text shimmer ── */
        .composer .box.busy {
            border: 1px solid transparent;
            background:
                linear-gradient(var(--feezal-bg, #fff), var(--feezal-bg, #fff)) padding-box,
                linear-gradient(90deg,
                    var(--sl-color-primary-500, #38bdf8), #a855f7,
                    var(--sl-color-primary-500, #38bdf8), #a855f7) border-box;
            background-size: 100% 100%, 300% 100%;
            animation: feezal-ai-shine 2.2s linear infinite;
        }
        @keyframes feezal-ai-shine { to { background-position: 0 0, 300% 0; } }

        .shimmer {
            background: linear-gradient(90deg,
                var(--sl-color-neutral-500, #888) 20%,
                var(--sl-color-primary-500, #38bdf8) 50%,
                var(--sl-color-neutral-500, #888) 80%);
            background-size: 200% 100%;
            -webkit-background-clip: text; background-clip: text;
            color: transparent;
            animation: feezal-ai-shimmer 1.6s linear infinite;
        }
        @keyframes feezal-ai-shimmer { to { background-position: -200% 0; } }

        .activity { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
        .activity .material-icons { font-size: 14px; }
        .narration { margin-bottom: 5px; font-size: 12.5px; opacity: 0.9; }

        /* ── Markdown (U28) — theme-agnostic via translucent surfaces ── */
        .markdown > :first-child { margin-top: 0; }
        .markdown > :last-child { margin-bottom: 0; }
        .markdown p { margin: 0 0 6px; }
        .markdown h1, .markdown h2, .markdown h3, .markdown h4 { margin: 8px 0 4px; font-size: 13px; font-weight: 600; line-height: 1.3; }
        .markdown ul, .markdown ol { margin: 4px 0; padding-left: 20px; }
        .markdown li { margin: 2px 0; }
        .markdown a { color: var(--sl-color-primary-600, #0284c7); }
        .markdown code { font-family: Consolas, 'Courier New', monospace; font-size: 12px; background: rgba(127,127,127,0.16); padding: 1px 4px; border-radius: 3px; }
        .markdown pre { background: rgba(127,127,127,0.10); border: 1px solid var(--feezal-border, rgba(127,127,127,0.28)); border-radius: 6px; padding: 8px 10px; overflow-x: auto; margin: 6px 0; }
        .markdown pre code { background: none; padding: 0; }
        .markdown blockquote { margin: 6px 0; padding-left: 10px; border-left: 3px solid var(--feezal-border, rgba(127,127,127,0.4)); color: var(--sl-color-neutral-600, #777); }
        .markdown table { border-collapse: collapse; margin: 6px 0; font-size: 12px; display: block; overflow-x: auto; }
        .markdown th, .markdown td { border: 1px solid var(--feezal-border, rgba(127,127,127,0.3)); padding: 3px 6px; }
        .markdown img { max-width: 100%; }
        .markdown hr { border: none; border-top: 1px solid var(--feezal-border, rgba(127,127,127,0.3)); margin: 8px 0; }

        .chip.agent { gap: 3px; }
        .chip.agent input { margin: 0; width: 12px; height: 12px; accent-color: var(--sl-color-primary-600, #0284c7); }
        .chip.agent.on { background: rgba(2,132,199,0.14); border-color: rgba(2,132,199,0.4); }

        @media (prefers-reduced-motion: reduce) {
            .composer .box.busy { animation: none; }
            .shimmer { animation: none; color: var(--sl-color-primary-600, #0284c7); }
        }
    `;

    constructor() {
        super();
        this.onApply        = null;
        this.buildSourceContext = null;
        this.editorMode     = 'design';
        this.viewNames      = [];
        this._targetView    = '';
        this._messages      = [];
        this._input         = '';
        this._streaming     = false;
        this._streamingText = null;
        this._error         = null;
        this._pendingApply  = null;
        this._applyError    = null;
        this._autoApply     = false;
        this._models        = [];
        this._selectedModel = localStorage.getItem(LS_MODEL) || '';
        this._provider      = '';
        this._toast         = '';
        this._topics        = [];
        this._controller    = null;
        this._toastTimer    = null;
        this._history       = [];
        this._historyOpen   = false;
        this._extraFiles    = [];
        this._includeView   = true;
        this._dragOver      = false;
        this._agentMode     = localStorage.getItem(LS_AGENT) !== '0';   // default on
        this._activity      = '';
        this._conversationId = localStorage.getItem(LS_CONVID) || newId();
        localStorage.setItem(LS_CONVID, this._conversationId);
        this._restore();
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadConfig();
        this._loadTopics();
    }

    // ── Config / models / topics ─────────────────────────────────────────────

    async _loadConfig() {
        try {
            const cfg = await (await fetch('/api/ai/config')).json();
            this._provider = cfg.provider || '';
            if (!this._selectedModel) this._selectedModel = cfg.model || '';
            await this._loadModels(cfg.model);
        } catch { /* panel still usable; errors surface on send */ }
    }

    async _loadModels(fallbackModel) {
        try {
            const res = await fetch('/api/ai/models');
            if (!res.ok) throw new Error();
            const {models} = await res.json();
            this._models = models || [];
        } catch {
            this._models = fallbackModel ? [fallbackModel] : [];
        }
        if (!this._selectedModel && this._models.length) this._selectedModel = this._models[0];
        if (this._selectedModel && !this._models.includes(this._selectedModel)) {
            this._models = [this._selectedModel, ...this._models];
        }
    }

    async _loadTopics() {
        try {
            const res = await fetch('/api/topics/completions?prefix=');
            const {completions} = await res.json();
            this._topics = (completions || []).map(c => c.topic || c).filter(Boolean);
        } catch { this._topics = []; }
    }

    // ── Context ──────────────────────────────────────────────────────────────

    _catalogue() {
        if (this._catalogueCache) return this._catalogueCache;
        const pkgs = (window.feezal && feezal.elements) || [];
        const tags = [...pkgs].map(p => String(p).replace(/^@[^/]+\//, ''));
        const out = [];
        for (const tag of tags) {
            const cls = customElements.get(tag);
            const f = cls && cls.feezal;
            if (!f) continue;
            const attributes = (f.attributes || []).map(a => (typeof a === 'string' ? a : a.name));
            out.push({
                tag,
                name: (f.palette && f.palette.name) || tag,
                category: (f.palette && f.palette.category) || '',
                attributes,
                defaultStyle: f.defaultStyle || {},
            });
        }
        this._catalogueCache = out;
        return out;
    }

    _catalogueTagSet() {
        const pkgs = (window.feezal && feezal.elements) || [];
        return new Set([...pkgs].map(p => String(p).replace(/^@[^/]+\//, '').toLowerCase()));
    }

    _currentView() {
        return (window.feezal && feezal.view) || null;
    }

    _buildContext() {
        const cat = {elements: this._catalogue(), topics: this._topics, files: this._extraFiles};
        // Source mode: the active view comes from the Monaco buffer (provided by
        // the host) for the selected target view. Design mode: the live canvas.
        if (this.editorMode === 'source' && typeof this.buildSourceContext === 'function') {
            const base = this._includeView ? (this.buildSourceContext(this._targetView) || {}) : {};
            return {viewHtml: this._cleanContextHtml(base.viewHtml || ''), viewName: base.viewName || this._targetView, ...cat};
        }
        const view = this._includeView ? this._currentView() : null;
        return {
            viewHtml: this._cleanContextHtml(view ? view.innerHTML : ''),
            viewName: view ? (view.getAttribute('name') || '') : '',
            ...cat,
        };
    }

    /**
     * Strip editor-internal noise from the view HTML before sending it as
     * context, so the model never sees (and echoes) classes like `ds-selectable`
     * or `feezal-editable`. Keeps `feezal-element` and user `feezal-class-*`.
     */
    _cleanContextHtml(htmlStr) {
        if (!htmlStr) return htmlStr;
        const EDITOR = ['feezal-editable', 'feezal-selected', 'iron-selected', 'ds-selectable'];
        const tpl = document.createElement('template');
        tpl.innerHTML = htmlStr;
        tpl.content.querySelectorAll('.dragselect-rectangle').forEach(el => el.remove());
        tpl.content.querySelectorAll('[class]').forEach(el => {
            EDITOR.forEach(c => el.classList.remove(c));
            if (!el.getAttribute('class')) el.removeAttribute('class');
        });
        return [...tpl.content.childNodes]
            .map(n => (n.outerHTML !== undefined ? n.outerHTML : n.textContent)).join('');
    }

    // ── File context ─────────────────────────────────────────────────────────

    _openFilePicker() {
        const input = this.renderRoot.querySelector('#file-input');
        if (input) input.click();
    }
    async _onFilePick(e) {
        await this._addFiles(e.target.files);
        e.target.value = '';
    }
    async _addFiles(fileList) {
        const files = [...(fileList || [])];
        for (const f of files) {
            if (f.size > 200 * 1024) { this._showToast(`${f.name} too large (>200 kB)`); continue; }
            try {
                const content = await f.text();
                this._extraFiles = [...this._extraFiles, {name: f.name, content}];
            } catch { /* unreadable */ }
        }
    }
    _removeFile(idx) {
        this._extraFiles = this._extraFiles.filter((_, i) => i !== idx);
    }
    _onDragOver(e) { e.preventDefault(); this._dragOver = true; }
    _onDragLeave() { this._dragOver = false; }
    async _onDrop(e) {
        e.preventDefault();
        this._dragOver = false;
        if (e.dataTransfer && e.dataTransfer.files) await this._addFiles(e.dataTransfer.files);
    }

    /** Rough request-size estimate (bytes + ~tokens) for the size indicator. */
    _sizeEstimate() {
        let bytes = 0;
        try {
            bytes = JSON.stringify({m: this._messages, c: this._buildContext(), i: this._input}).length;
        } catch { /* circular — ignore */ }
        const tokens = Math.round(bytes / 4);
        return tokens >= 1000 ? `~${(tokens / 1000).toFixed(1)}k tokens` : `~${tokens} tokens`;
    }

    updated(changed) {
        if (changed.has('viewNames') && this.viewNames && this.viewNames.length &&
            !this.viewNames.includes(this._targetView)) {
            this._targetView = this.viewNames[0];
        }
    }

    // ── Sending / streaming ──────────────────────────────────────────────────

    async _send() {
        const text = this._input.trim();
        if (!text || this._streaming) return;
        this._error = null;
        this._pendingApply = null;
        this._applyError = null;
        this._messages = [...this._messages, {role: 'user', content: text}];
        this._input = '';
        this._persist();
        this._streaming = true;
        this._streamingText = '';
        this._activity = '';
        this._controller = new AbortController();
        this.updateComplete.then(() => {
            this._scrollDown();
            const ta = this.renderRoot.querySelector('.composer textarea');
            if (ta) ta.style.height = '';   // shrink back to the default size
        });

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    messages: this._messages.map(m => ({role: m.role, content: m.content})),
                    context: this._buildContext(),
                    model: this._selectedModel || undefined,
                    agent: this._agentMode,
                }),
                signal: this._controller.signal,
            });
            if (!res.ok || !res.body) {
                const e = await res.json().catch(() => ({error: 'HTTP ' + res.status}));
                throw new Error(e.error || ('HTTP ' + res.status));
            }
            await this._readStream(res.body);
            const content = this._streamingText || '';
            this._streamingText = null;
            this._streaming = false;
            this._activity = '';
            if (!content.trim()) {
                // Empty reply — don't store a phantom "(proposed a change)" bubble.
                this._error = 'The assistant returned an empty response. Try again.';
            } else {
                this._messages = [...this._messages, {role: 'assistant', content}];
                this._persist();
                this._afterAssistant(content);
            }
        } catch (err) {
            this._streaming = false;
            this._activity = '';
            if (this._controller && this._controller.signal.aborted) {
                if (this._streamingText) {
                    this._messages = [...this._messages,
                        {role: 'assistant', content: this._streamingText + ' *[stopped]*'}];
                    this._persist();
                }
            } else {
                this._error = err.message;
            }
            this._streamingText = null;
        }
        this.updateComplete.then(() => this._scrollDown());
    }

    _stop() {
        if (this._controller) this._controller.abort();
    }

    async _readStream(body) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let streamErr = null;
        for (;;) {
            const {value, done} = await reader.read();
            if (done) break;
            buf += decoder.decode(value, {stream: true});
            let idx;
            let stop = false;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
                const frame = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                const {event, obj} = this._parseFrame(frame);
                if (!obj) continue;
                if (event === 'token') {
                    this._activity = '';   // final answer is arriving
                    this._streamingText = (this._streamingText || '') + (obj.token || '');
                    this._scrollDown();
                } else if (event === 'tool') {
                    this._activity = this._toolLabel(obj);
                } else if (event === 'error') {
                    streamErr = obj.error || 'stream error'; stop = true; break;
                } else if (event === 'done') {
                    stop = true; break;
                }
            }
            if (stop) break;
        }
        try { await reader.cancel(); } catch { /* ignore */ }
        if (streamErr) throw new Error(streamErr);
    }

    _parseFrame(frame) {
        let event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) return {event, obj: null};
        try { return {event, obj: JSON.parse(data)}; } catch { return {event, obj: null}; }
    }

    // ── Proposal handling ────────────────────────────────────────────────────

    _afterAssistant(content) {
        let proposed = this._extractHtml(content);
        if (proposed === null) return;              // an answer, not an edit
        // New-view directive: `<!-- @new-view: Name -->` at the top of the block
        // targets a brand-new view instead of replacing the current one.
        let newView = null;
        const nv = proposed.match(/^\s*<!--\s*@new-view:\s*(.+?)\s*-->\s*/i);
        if (nv) { newView = nv[1].trim(); proposed = proposed.slice(nv[0].length); }
        // Auto-correct the common hallucination: a right-name/wrong-category tag
        // (e.g. <feezal-element-switch> → <feezal-element-material-switch>) so it
        // doesn't dead-end at validation. Only rewrites when the element *name*
        // uniquely matches a real catalogue tag.
        const {html: fixed, fixes} = this._correctTags(proposed);
        if (fixes.length) {
            proposed = fixed;
            this._showToast(`Fixed ${fixes.length} element tag${fixes.length > 1 ? 's' : ''} (${fixes[0][0]} → ${fixes[0][1].replace('feezal-element-', '')})`);
        }
        const v = this._validate(proposed);
        if (!v.ok) { this._applyError = v.reason; this._pendingApply = {html: proposed, newView}; return; }
        if (this._autoApply) this._doApply(proposed, newView);
        else this._pendingApply = {html: proposed, newView};
    }

    /**
     * Rewrite unknown `feezal-element-*` tags to a real catalogue tag when the
     * element *name* (last hyphen segment) matches exactly — fixing hallucinated
     * or category-dropped tags like `feezal-element-switch`. Prefers the
     * `material` family when several categories share the name. Returns the
     * (possibly) rewritten HTML plus the list of [from, to] fixes applied.
     */
    _correctTags(htmlStr) {
        const known = this._catalogueTagSet();
        if (!known.size) return {html: htmlStr, fixes: []};
        const elements = this._catalogue();
        const fixes = [];
        const seen = {};
        const html = htmlStr.replace(/<\/?\s*(feezal-element-[a-z0-9-]+)/gi, (m, tag) => {
            const lower = tag.toLowerCase();
            if (known.has(lower)) return m;
            const repl = (lower in seen) ? seen[lower] : (seen[lower] = this._bestTagMatch(lower, elements));
            if (!repl || repl === lower) return m;
            if (!fixes.some(f => f[0] === lower)) fixes.push([lower, repl]);
            return m.replace(tag, repl);
        });
        return {html, fixes};
    }

    _bestTagMatch(unknownTag, elements) {
        const CAT_PREF = ['material', 'basic', 'paper', 'layout'];
        const uLast = unknownTag.replace(/^feezal-element-/, '').split('-').pop();
        let best = null, bestScore = -1;
        for (const e of elements) {
            const tag = String(e.tag || '').toLowerCase();
            const parts = tag.replace(/^feezal-element-/, '').split('-');
            if (parts[parts.length - 1] !== uLast) continue;   // element name must match
            const idx = CAT_PREF.indexOf(parts.length > 1 ? parts[0] : '');
            const score = idx >= 0 ? (10 - idx) : 0;
            if (score > bestScore) { bestScore = score; best = tag; }
        }
        return best;
    }

    /** Extract the proposed view HTML from the first fenced block, or null. */
    _extractHtml(text) {
        const m = text.match(/```html\s*\n?([\s\S]*?)```/i) ||
                  text.match(/```\s*\n?([\s\S]*?)```/);
        if (!m) return null;
        const code = m[1].replace(/\s+$/, '');
        // Only treat a generic (unlabelled) fence as a view edit if it actually
        // contains feezal elements — otherwise it's just an example/answer.
        if (!/```html/i.test(m[0]) && !/<feezal-element/i.test(code)) return null;
        return code;
    }

    /** Client-side safety validation — never trust model output. */
    _validate(htmlStr) {
        if (/<\s*script/i.test(htmlStr)) return {ok: false, reason: 'output contains <script>'};
        const tpl = document.createElement('template');
        tpl.innerHTML = htmlStr;
        const catalogue = this._catalogueTagSet();
        for (const el of tpl.content.querySelectorAll('*')) {
            const tag = el.tagName.toLowerCase();
            if (BLOCKED_TAGS.includes(tag)) return {ok: false, reason: `output contains <${tag}>`};
            if (tag.includes('-')) {
                if (!tag.startsWith('feezal-element-')) return {ok: false, reason: `unknown custom element <${tag}>`};
                if (catalogue.size && !catalogue.has(tag)) return {ok: false, reason: `unknown element <${tag}>`};
            }
            for (const attr of el.attributes) {
                const n = attr.name.toLowerCase();
                if (n.startsWith('on')) return {ok: false, reason: `event-handler attribute "${n}"`};
                if (/javascript:/i.test(attr.value)) return {ok: false, reason: `javascript: URL in "${n}"`};
            }
        }
        return {ok: true};
    }

    _doApply(htmlStr, newView) {
        if (typeof this.onApply === 'function') this.onApply(htmlStr, this._targetView, newView || null);
        this._pendingApply = null;
        this._applyError = null;
        this._showToast(newView ? `New view "${newView}" created` : 'View updated');
    }

    _accept() { if (this._pendingApply) this._doApply(this._pendingApply.html, this._pendingApply.newView); }
    _discard() { this._pendingApply = null; this._applyError = null; }
    _alwaysAccept() {
        this._autoApply = true;
        if (this._pendingApply) this._doApply(this._pendingApply.html, this._pendingApply.newView);
    }

    _showToast(msg) {
        this._toast = msg;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { this._toast = ''; }, 2200);
    }

    // ── Persistence (Phase 1: localStorage) ──────────────────────────────────

    _persist() {
        try { localStorage.setItem(LS_CONV, JSON.stringify(this._messages)); } catch { /* quota */ }
        this._saveServer();
    }
    _restore() {
        try {
            const raw = localStorage.getItem(LS_CONV);
            if (raw) this._messages = JSON.parse(raw) || [];
        } catch { this._messages = []; }
    }
    /** Persist to the server so the conversation appears in the history timeline. */
    _saveServer() {
        if (!this._messages.length) return;
        const firstUser = this._messages.find(m => m.role === 'user');
        const title = (firstUser ? firstUser.content : '').slice(0, 80);
        fetch('/api/ai/conversations/' + encodeURIComponent(this._conversationId), {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, messages: this._messages}),
        }).catch(() => { /* offline / no dataDir — localStorage still holds it */ });
    }

    _newConversation() {
        this._conversationId = newId();
        localStorage.setItem(LS_CONVID, this._conversationId);
        this._messages = [];
        this._pendingApply = null;
        this._applyError = null;
        this._error = null;
        this._autoApply = false;
        this._historyOpen = false;
        try { localStorage.setItem(LS_CONV, '[]'); } catch { /* quota */ }
    }

    async _toggleHistory() {
        this._historyOpen = !this._historyOpen;
        if (this._historyOpen) await this._loadHistory();
    }
    async _loadHistory() {
        try {
            const {conversations} = await (await fetch('/api/ai/conversations')).json();
            this._history = conversations || [];
        } catch { this._history = []; }
    }
    async _loadConversation(id) {
        try {
            const c = await (await fetch('/api/ai/conversations/' + encodeURIComponent(id))).json();
            this._conversationId = c.id;
            localStorage.setItem(LS_CONVID, c.id);
            this._messages = c.messages || [];
            try { localStorage.setItem(LS_CONV, JSON.stringify(this._messages)); } catch { /* quota */ }
            this._pendingApply = null; this._applyError = null; this._error = null;
            this._historyOpen = false;
            this.updateComplete.then(() => this._scrollDown());
        } catch { /* ignore */ }
    }
    async _deleteConversation(id, e) {
        e.stopPropagation();
        try { await fetch('/api/ai/conversations/' + encodeURIComponent(id), {method: 'DELETE'}); } catch { /* ignore */ }
        if (id === this._conversationId) this._newConversation();
        await this._loadHistory();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _onModelChange(e) {
        this._selectedModel = e.target.value;
        localStorage.setItem(LS_MODEL, this._selectedModel);
    }
    _onInput(e) { this._input = e.target.value; this._autoGrow(e.target); }

    _autoGrow(ta) {
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }

    _toggleAgent() {
        this._agentMode = !this._agentMode;
        localStorage.setItem(LS_AGENT, this._agentMode ? '1' : '0');
    }

    /** Human label for a tool-activity SSE event (U26 agent mode). */
    _toolLabel(obj) {
        const names = {
            search_topics:     'searching topics',
            get_topic_payload: 'reading payload',
            search_discovery:  'searching devices',
        };
        const base = names[obj && obj.name] || ('running ' + ((obj && obj.name) || 'tool'));
        const arg = obj && obj.args && (obj.args.query || obj.args.topic);
        return arg ? `${base}: ${arg}` : base + '…';
    }
    _onKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
    }
    _scrollDown() {
        const el = this.renderRoot && this.renderRoot.querySelector('.stream');
        if (el) el.scrollTop = el.scrollHeight;
    }
    /** Strip the proposed-view html fence from a message for display. */
    _displayText(content) {
        return content
            .replace(/```html\s*\n?[\s\S]*?```/i, '')
            .replace(/```\s*\n?[\s\S]*?```/, m => (/<feezal-element/i.test(m) ? '' : m))
            .trim();
    }

    /** Streaming bubble: the running findings narration plus the current tool activity. */
    _streamBubble() {
        const narration = this._streamingText ? this._displayText(this._streamingText) : '';
        return html`
            ${narration ? html`<div class="narration markdown">${this._renderMarkdown(narration)}</div>` : ''}
            ${this._activity
                ? html`<div class="activity shimmer"><span class="material-icons">bolt</span>${this._activity}</div>`
                : (narration ? '' : html`<span class="dots"><span></span><span></span><span></span></span>`)}
        `;
    }

    // ── Render ───────────────────────────────────────────────────────────────

    render() {
        return html`
            <header>
                <div class="title"><span class="material-icons">android</span> Assistant</div>
                <select class="model" @change="${this._onModelChange}" title="Model">
                    ${this._models.length
                        ? this._models.map(m => html`<option value="${m}" ?selected="${m === this._selectedModel}">${m}</option>`)
                        : html`<option>${this._selectedModel || 'no models'}</option>`}
                </select>
                <button class="hbtn ${this._historyOpen ? 'active' : ''}" title="History" @click="${this._toggleHistory}">
                    <span class="material-icons">history</span>
                </button>
                <button class="hbtn" title="New conversation" @click="${this._newConversation}">
                    <span class="material-icons">add</span>
                </button>
            </header>

            <div class="stream">
                ${this._historyOpen ? this._renderHistory() : html`
                ${this._messages.length === 0 && !this._streaming ? html`
                    <div class="empty">
                        Ask me to change the current view —<br>
                        e.g. "add a temperature label bound to <code>home/kitchen/temp</code>".
                    </div>` : ''}

                ${this._messages.map(m => this._renderMessage(m))}

                ${this._streaming ? html`
                    <div class="msg assistant">
                        <div class="bubble">${this._streamBubble()}</div>
                    </div>` : ''}

                ${this._renderProposal()}
                `}
            </div>

            ${this._error ? html`<div class="error-banner">${this._error}</div>` : ''}
            ${this._toast ? html`<div class="toast">${this._toast}</div>` : ''}

            <div class="composer ${this._dragOver ? 'dragover' : ''}"
                @dragover="${this._onDragOver}" @dragleave="${this._onDragLeave}" @drop="${this._onDrop}">
                ${this.editorMode === 'source' && this.viewNames && this.viewNames.length ? html`
                    <div class="target-row">
                        <span class="material-icons">layers</span>
                        <span>Working on view:</span>
                        <select class="target-select" @change="${e => { this._targetView = e.target.value; }}">
                            ${this.viewNames.map(n => html`<option value="${n}" ?selected="${n === this._targetView}">${n}</option>`)}
                        </select>
                    </div>` : ''}
                <div class="chips">
                    <button class="chip ${this._includeView ? 'on' : ''}" title="Include the current view in context"
                        @click="${() => { this._includeView = !this._includeView; }}">
                        <span class="material-icons">dashboard</span> view
                    </button>
                    ${this._extraFiles.map((f, i) => html`
                        <span class="chip file" title="${f.name}">
                            <span class="material-icons">description</span>
                            <span class="chip-name">${f.name}</span>
                            <button class="chip-x" title="Remove" @click="${() => this._removeFile(i)}">×</button>
                        </span>`)}
                    <button class="chip agent ${this._agentMode ? 'on' : ''}"
                        title="Agent mode — let the assistant search topics, peek payloads and look up discovered devices"
                        @click="${this._toggleAgent}">
                        <input type="checkbox" .checked="${this._agentMode}" tabindex="-1"
                            @click="${e => e.preventDefault()}">
                        agent
                    </button>
                    <button class="chip add" title="Add files to context" @click="${this._openFilePicker}">+</button>
                    <input id="file-input" type="file" multiple hidden @change="${this._onFilePick}">
                </div>
                <div class="box ${this._streaming ? 'busy' : ''}">
                    <textarea rows="3" placeholder="${this._dragOver ? 'Drop files to add to context…' : 'Describe a change…'}"
                        .value="${this._input}"
                        @input="${this._onInput}"
                        @keydown="${this._onKeydown}"
                        ?disabled="${this._streaming}"></textarea>
                    ${this._streaming
                        ? html`<button class="send" title="Stop" @click="${this._stop}"><span class="material-icons">stop</span></button>`
                        : html`<button class="send" title="Send" ?disabled="${!this._input.trim()}" @click="${this._send}"><span class="material-icons">arrow_upward</span></button>`}
                </div>
                <div class="hint">Enter to send · Shift+Enter for newline${this._streaming ? '' : ' · ' + this._sizeEstimate()}${this._agentMode ? ' · agent on' : ''}${this._autoApply ? ' · auto-apply on' : ''}</div>
            </div>
        `;
    }

    _renderMessage(m) {
        if (m.role === 'user') {
            // User text stays verbatim (may contain topics/JSON/code the user typed).
            return html`<div class="msg user"><div class="bubble">${m.content}</div></div>`;
        }
        const text = this._displayText(m.content);
        return html`<div class="msg assistant"><div class="bubble markdown">${
            text ? this._renderMarkdown(text) : html`<span class="muted">(proposed a change)</span>`
        }</div></div>`;
    }

    /** Render untrusted assistant Markdown as sanitized HTML (U28). */
    _renderMarkdown(text) {
        const rawHtml = marked.parse(String(text || ''), {gfm: true, breaks: true});
        const clean = DOMPurify.sanitize(rawHtml, {USE_PROFILES: {html: true}});
        return unsafeHTML(clean);
    }

    _renderHistory() {
        return html`
            <div class="history-list">
                ${this._history.length === 0
                    ? html`<div class="empty">No saved conversations yet.</div>`
                    : this._history.map(c => html`
                        <div class="history-item ${c.id === this._conversationId ? 'active' : ''}"
                            @click="${() => this._loadConversation(c.id)}">
                            <span class="material-icons" style="font-size:16px;opacity:.55">chat_bubble_outline</span>
                            <span class="history-title">${c.title || '(untitled)'}</span>
                            <button class="hbtn" title="Delete" @click="${e => this._deleteConversation(c.id, e)}">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>`)}
            </div>`;
    }

    _renderProposal() {
        if (this._applyError) {
            return html`
                <div class="card err">
                    <div class="card-title"><span class="material-icons">error</span> Can't apply</div>
                    <div>${this._applyError}</div>
                    <div class="actions" style="margin-top:8px">
                        <button class="btn" @click="${this._discard}">Dismiss</button>
                    </div>
                    ${this._pendingApply ? html`
                        <details class="raw"><summary>View as HTML</summary>
                            <pre>${this._pendingApply.html}</pre>
                        </details>` : ''}
                </div>`;
        }
        if (!this._pendingApply) return '';
        return html`
            <div class="card">
                <div class="card-title"><span class="material-icons">${this._pendingApply.newView ? 'add_box' : 'auto_fix_high'}</span> ${this._pendingApply.newView ? `Create new view “${this._pendingApply.newView}”?` : 'Changing the current view…'}</div>
                <div class="actions">
                    <button class="btn primary" @click="${this._accept}">Accept</button>
                    <button class="btn" @click="${this._discard}">Discard</button>
                    <button class="btn" @click="${this._alwaysAccept}" title="Apply this and future changes automatically this session">Always accept</button>
                </div>
                <details class="raw"><summary>View as HTML</summary>
                    <pre>${this._pendingApply.html}</pre>
                </details>
            </div>`;
    }
}

window.customElements.define('feezal-ai-chat', FeezalAiChat);
export {FeezalAiChat};
