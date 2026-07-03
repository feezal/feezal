import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

class FeezalSidebarEditor extends LitElement {
    static properties = {
        themeMode:      {type: String, reflect: true},
        selectionColor: {type: String, reflect: true},
        gridColor:      {type: String, reflect: true},
        gridSize:       {type: Number, reflect: true},
        gridVisible:    {type: Boolean, reflect: true},
        snapping:       {type: String, reflect: true},
        preventEditorMqtt: {type: Boolean, reflect: true},
        // AI assistant (U9) — server-side config, fetched/saved by this panel.
        _aiProvider: {state: true},
        _aiEndpoint: {state: true},
        _aiApiKey:   {state: true},
        _aiModel:    {state: true},
        _aiMaxRounds:{state: true},
        _aiNumCtx:   {state: true},
        _aiHasKey:   {state: true},
        _aiStatus:   {state: true},
        // A13 — server restart/update (docker-backed, capability-gated)
        _caps:         {state: true},
        _serverBusy:   {state: true},
        _serverStatus: {state: true},
        _aiBusy:     {state: true}
    };

    static styles = css`
        :host { display: block; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        .form { margin: 12px; display: flex; flex-direction: column; gap: 12px; }
        .row { display: flex; gap: 12px; align-items: flex-end; }
        .row > * { flex: 1; }
        sl-select, sl-input { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .color-label {
            display: flex; flex-direction: column; gap: 4px; flex: 1;
            font-size: var(--sl-input-label-font-size-small, 12px);
            color: var(--sl-input-label-color, inherit);
        }
        input[type="color"] {
            width: 100%; height: 28px; padding: 2px 3px;
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px;
            background: var(--feezal-bg, white); cursor: pointer;
            box-sizing: border-box;
        }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .section-sep { border: none; border-top: 1px solid var(--feezal-border, #e4e4e7); margin: 4px 0; }
        .section-title {
            display: flex; align-items: center; gap: 6px;
            font-weight: 600; font-size: 12px; color: var(--feezal-color, #333);
        }
        .section-title .material-icons { font-size: 17px; color: var(--sl-color-primary-600, #0284c7); }
        .ai-actions { display: flex; gap: 8px; }
        .ai-actions .btn {
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); border-radius: 6px; padding: 5px 12px;
            font-size: 12px; cursor: pointer; font: inherit;
        }
        .ai-actions .btn.primary { background: var(--sl-color-primary-600, #0284c7); border-color: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .ai-actions .btn:disabled { opacity: .5; cursor: default; }
        .ai-status { font-size: 11px; min-height: 14px; }
        .ai-status.ok  { color: var(--sl-color-success-600, #2e7d32); }
        .ai-status.err { color: var(--sl-color-danger-600, #d32f2f); }
    `;

    constructor() {
        super();
        this.themeMode = 'os';
        this.selectionColor = '#0284c7';
        this.gridColor = '#cccccc';
        this.gridSize = 24;
        this.gridVisible = false;
        this.snapping = 'elements';
        this.preventEditorMqtt = true;
        this._aiProvider = 'openai-compatible';
        this._aiEndpoint = '';
        this._aiApiKey   = '';
        this._aiModel    = '';
        this._aiMaxRounds = '';
        this._aiNumCtx   = '';
        this._aiHasKey   = false;
        this._aiStatus   = '';
        this._aiBusy     = false;
        this._caps       = null;
        this._serverBusy = false;
        this._serverStatus = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadAiConfig();
        this._loadCapabilities();
    }

    async _loadAiConfig() {
        try {
            const cfg = await (await fetch('/api/ai/config')).json();
            this._aiProvider = cfg.provider || 'openai-compatible';
            this._aiEndpoint = cfg.endpoint || '';
            this._aiModel    = cfg.model || '';
            this._aiMaxRounds = cfg.maxToolRounds != null ? String(cfg.maxToolRounds) : '';
            this._aiNumCtx   = cfg.numCtx != null ? String(cfg.numCtx) : '';
            this._aiHasKey   = Boolean(cfg.hasKey);
        } catch { /* leave defaults */ }
    }

    async _saveAi() {
        this._aiBusy = true;
        this._aiStatus = '';
        try {
            const body = {
                provider: this._aiProvider,
                endpoint: this._aiEndpoint.trim(),
                model:    this._aiModel.trim(),
                maxToolRounds: this._aiMaxRounds === '' ? '' : this._aiMaxRounds,
                numCtx:   this._aiNumCtx === '' ? '' : this._aiNumCtx,
            };
            // Only send apiKey when the user typed one; empty keeps the stored key.
            if (this._aiApiKey) body.apiKey = this._aiApiKey;
            const res = await fetch('/api/ai/config', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'save failed');
            this._aiHasKey = data.hasKey;
            this._aiApiKey = '';
            this._aiStatus = 'ok:Saved';
            window.dispatchEvent(new CustomEvent('feezal:ai-config-changed', {detail: data}));
        } catch (err) {
            this._aiStatus = 'err:' + err.message;
        } finally {
            this._aiBusy = false;
        }
    }

    async _testAi() {
        this._aiBusy = true;
        this._aiStatus = '';
        try {
            // Save first so the test uses the latest fields.
            await this._saveAi();
            const res = await fetch('/api/ai/models');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'connection failed');
            this._aiStatus = `ok:Connected — ${(data.models || []).length} models`;
        } catch (err) {
            this._aiStatus = 'err:' + err.message;
        } finally {
            this._aiBusy = false;
        }
    }

    render() {
        return html`
            <div class="form">
                <sl-select label="Color theme" size="small"
                    .value="${this.themeMode}"
                    @sl-change="${e => { this.themeMode = e.target.value; this._notify('theme-mode'); }}">
                    <sl-option value="os">OS preference</sl-option>
                    <sl-option value="light">Light</sl-option>
                    <sl-option value="dark">Dark</sl-option>
                </sl-select>
                <div class="row">
                    <label class="color-label">
                        Selection color
                        <input type="color" .value="${this.selectionColor}"
                            @input="${e => { this.selectionColor = e.target.value; this._notify('selection-color'); }}">
                    </label>
                    <label class="color-label">
                        Grid color
                        <input type="color" .value="${this.gridColor}"
                            @input="${e => { this.gridColor = e.target.value; this._notify('grid-color'); }}">
                    </label>
                </div>
                <sl-select label="Snapping" size="small"
                    .value="${this.snapping}"
                    @sl-change="${e => { this.snapping = e.target.value; this._notify('snapping'); }}">
                    <sl-option value="off">off</sl-option>
                    <sl-option value="elements">elements</sl-option>
                    <sl-option value="grid">grid</sl-option>
                </sl-select>
                <div class="row">
                    <sl-input label="Grid size" size="small" type="number"
                        .value="${String(this.gridSize)}"
                        @sl-change="${e => { this.gridSize = Number(e.target.value); this._notify('grid-size'); }}">
                    </sl-input>
                    <sl-switch size="small"
                        .checked="${this.gridVisible}"
                        @sl-change="${e => { this.gridVisible = e.target.checked; this._notify('grid-visible'); }}">
                        Show Grid
                    </sl-switch>
                </div>
                <sl-switch size="small"
                    .checked="${this.preventEditorMqtt}"
                    @sl-change="${e => { this.preventEditorMqtt = e.target.checked; this._notify('prevent-editor-mqtt'); }}">
                    Prevent MQTT element manipulation in editor
                </sl-switch>

                <hr class="section-sep">
                <div class="section-title"><span class="material-icons">android</span> AI assistant</div>
                <sl-select label="Provider" size="small"
                    .value="${this._aiProvider}"
                    @sl-change="${e => { this._aiProvider = e.target.value; }}">
                    <sl-option value="openai-compatible">OpenAI-compatible</sl-option>
                    <sl-option value="anthropic">Anthropic</sl-option>
                    <sl-option value="ollama">Ollama (local)</sl-option>
                </sl-select>
                <sl-input label="Endpoint" size="small"
                    placeholder="${this._aiProvider === 'ollama' ? 'http://localhost:11434' : (this._aiProvider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1')}"
                    .value="${this._aiEndpoint}"
                    @sl-input="${e => { this._aiEndpoint = e.target.value; }}">
                </sl-input>
                ${this._aiProvider === 'ollama' ? '' : html`
                    <sl-input label="API key" size="small" type="password" password-toggle
                        placeholder="${this._aiHasKey ? '•••••••• (saved)' : 'sk-…'}"
                        .value="${this._aiApiKey}"
                        @sl-input="${e => { this._aiApiKey = e.target.value; }}">
                    </sl-input>`}
                <sl-input label="Default model" size="small"
                    placeholder="${this._aiProvider === 'ollama' ? 'llama3.1' : (this._aiProvider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4o')}"
                    .value="${this._aiModel}"
                    @sl-input="${e => { this._aiModel = e.target.value; }}">
                </sl-input>
                <sl-input label="Agent tool-call limit" size="small" type="number" min="1" max="100"
                    placeholder="20 (default)"
                    help-text="Max model round-trips per message in agent mode. Higher = more thorough multi-device wiring, but slower/costlier. Blank uses the default."
                    .value="${this._aiMaxRounds}"
                    @sl-input="${e => { this._aiMaxRounds = e.target.value; }}">
                </sl-input>
                ${this._aiProvider === 'ollama' ? html`
                    <sl-input label="Context window (num_ctx)" size="small" type="number" min="512" step="512"
                        placeholder="model default"
                        help-text="Ollama context size. Agent mode accumulates tool results — a small window (Ollama often defaults to ~4k) silently truncates and the model returns empty. Try 8192–16384. Blank uses the model default."
                        .value="${this._aiNumCtx}"
                        @sl-input="${e => { this._aiNumCtx = e.target.value; }}">
                    </sl-input>` : ''}
                <div class="ai-actions">
                    <button class="btn primary" ?disabled="${this._aiBusy}" @click="${this._saveAi}">Save</button>
                    <button class="btn" ?disabled="${this._aiBusy}" @click="${this._testAi}">Test connection</button>
                </div>
                ${this._aiStatus ? html`<div class="ai-status ${this._aiStatus.startsWith('ok:') ? 'ok' : 'err'}">${this._aiStatus.slice(this._aiStatus.indexOf(':') + 1)}</div>` : ''}

                ${this._caps && (this._caps.restart || this._caps.selfUpdate) ? html`
                    <hr class="section-sep">
                    <div class="section-title"><span class="material-icons">dns</span> Server</div>
                    <div class="ai-actions">
                        ${this._caps.restart ? html`
                            <button class="btn" ?disabled="${this._serverBusy}"
                                @click="${this._restartServer}">Restart</button>` : ''}
                        ${this._caps.selfUpdate ? html`
                            <button class="btn" ?disabled="${this._serverBusy}"
                                @click="${this._updateServer}">Update…</button>` : ''}
                    </div>
                    <div class="ai-status ${this._serverStatus.startsWith('err') ? 'err' : 'ok'}">${this._serverStatus.replace(/^(ok|err):/, '')}</div>
                ` : ''}
            </div>
        `;
    }

    // ── A13: restart / update the feezal server ─────────────────────────────

    async _loadCapabilities() {
        try {
            this._caps = await (await fetch('/api/server/capabilities')).json();
        } catch { this._caps = null; }
        this.requestUpdate();
    }

    /** Poll until the server responds again, then reload the editor. */
    async _waitForServer(graceMs) {
        await new Promise(r => setTimeout(r, graceMs));
        for (let i = 0; i < 120; i++) {
            try {
                const r = await fetch('/api/server/capabilities', {cache: 'no-store'});
                if (r.ok) { location.reload(); return; }
            } catch { /* still down */ }
            await new Promise(r => setTimeout(r, 2000));
            this._serverStatus = 'ok:waiting for the server to come back…';
            this.requestUpdate();
        }
        this._serverStatus = 'err:server did not come back — check the host';
        this._serverBusy = false;
    }

    async _restartServer() {
        if (!confirm('Restart the feezal server? The editor reloads when it is back.')) return;
        this._serverBusy = true;
        this._serverStatus = 'ok:restarting…';
        try {
            const r = await fetch('/api/server/restart', {method: 'POST'});
            if (!r.ok) throw new Error((await r.json()).error || 'restart failed');
            this._waitForServer(2000);
        } catch (err) {
            this._serverStatus = 'err:' + err.message;
            this._serverBusy = false;
        }
    }

    async _updateServer() {
        if (!confirm('Update feezal to the latest image and restart? ' +
            'A one-shot watchtower container pulls the new image and recreates the server. ' +
            'The editor reloads when it is back.')) return;
        this._serverBusy = true;
        this._serverStatus = 'ok:starting update…';
        try {
            const r = await fetch('/api/server/update', {method: 'POST'});
            if (!r.ok) throw new Error((await r.json()).error || 'update failed');
            this._serverStatus = 'ok:updating — the server will restart…';
            this._waitForServer(8000);
        } catch (err) {
            this._serverStatus = 'err:' + err.message;
            this._serverBusy = false;
        }
    }

    _notify(attr) {
        this.dispatchEvent(new CustomEvent(attr + '-changed', {bubbles: true, composed: true, detail: {value: this[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]}}));
    }
}

window.customElements.define('feezal-sidebar-editor', FeezalSidebarEditor);

