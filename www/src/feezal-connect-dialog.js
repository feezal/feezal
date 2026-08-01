import {LitElement, html, css} from 'lit';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';

import {feezalDialogChrome, FEEZAL_Z} from './feezal-editor-chrome.js';   // N43

/**
 * First-run MQTT broker setup. Shown before the welcome tour whenever the site
 * has no broker host configured (see feezal-app-editor._maybeFirstRunSetup). It
 * is the same connection form as the Connection sidebar, but larger and in a
 * modal, and it can be skipped.
 *
 *  - Defaults to mqtt://localhost:1883 (the common local broker).
 *  - Recommends ws:// / wss:// (browsers speak only WebSocket MQTT), and DIRECT
 *    is the default + recommended viewer mode; the Direct/Bridge switch is
 *    disabled+forced for mqtt://|mqtts:// (a browser can't open those).
 *  - https:// page → must use wss:// (browsers block ws:// there); wss:// needs
 *    each viewing device to trust the broker's TLS certificate.
 *  - "Test connection" applies the settings to the server bridge WITHOUT closing
 *    the dialog and shows the live bridge status (yellow while connecting, green
 *    when connected, red + error on failure). "Save & connect" applies + closes.
 */
class FeezalConnectDialog extends LitElement {
    static properties = {
        _protocol: {state: true},
        _host: {state: true},
        _port: {state: true},
        _username: {state: true},
        _password: {state: true},
        _viaServer: {state: true},
        _protocolVersion: {state: true},
        _saving: {state: true},
        _bridge: {state: true},     // server↔broker status {connected, uri, lastError} | null
        _testing: {state: true},    // a test is in flight (yellow "connecting")
        _testUri: {state: true},
        _certStatus: {state: true}, // {ca, caCn, cert, key} | null — TLS cert presence
        _pasteFor: {state: true},   // null | 'ca' | 'cert' | 'key' — which PEM paste box is open
        _pemText: {state: true},
        _certBusy: {state: true},
    };

    static styles = [feezalDialogChrome, css`
        /* A comfortable, wide modal — this is a focused first-run form. */
        sl-dialog { --width: 640px; }
        /* Bigger inputs than the sidebar, and Shoelace vertically centres the
           text within --sl-input-height (never override part(input) height —
           that breaks the centering). */
        :host {
            --sl-input-height-medium: 2.6rem;
            --sl-input-font-size-medium: 1rem;
        }
        .intro { font-size: 15px; line-height: 1.5; margin: 0 0 18px; color: var(--feezal-color, #333); }
        .section { font-size: 12px; text-transform: uppercase; letter-spacing: .05em;
            opacity: .6; margin: 18px 0 8px; }
        .section .muted { text-transform: none; opacity: .8; }
        .row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
        .row > sl-input { flex: 1 1 160px; }
        .row .proto { flex: 0 0 130px; }
        .row .port { flex: 0 0 110px; }
        sl-switch { margin-top: 12px; font-size: 15px; }
        .hint { font-size: 13px; line-height: 1.5; margin: 8px 0 0; opacity: .85; }
        .hint.warn {
            opacity: 1; padding: 8px 12px; border-radius: 6px;
            background: var(--feezal-badge-bg, #fff4e5); color: var(--warning-color, #b45309);
            border: 1px solid var(--warning-color, #f59e0b);
        }
        .hint.warn strong { color: inherit; }

        /* Connection status — same shape as the Connection sidebar, plus a yellow
           "connecting" state. */
        .status {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            font-size: 14px; margin-top: 6px;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--feezal-badge-bg, #9ca3af); flex: 0 0 auto; }
        .dot.ok  { background: #2e9d4f; }
        .dot.err { background: #d64545; }
        .dot.connecting { background: #eab308; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        .status .uri { opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .status-error { color: #e06666; font-size: 13px; margin-top: 4px; word-break: break-word; }

        /* TLS cert rows (mirrors the Connection sidebar). */
        .cert-info-row { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 14px; }
        .cert-label { color: var(--feezal-color, #333); }
        .cert-badge-ok { color: #2e9d4f; font-weight: 700; }
        .cert-badge-none { opacity: .55; font-size: 13px; }
        .cert-cn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .8; }
        .cert-remove-btn {
            border: none; background: none; cursor: pointer; opacity: .55;
            color: var(--feezal-color, #333); font-size: 15px; line-height: 1; padding: 2px 6px; border-radius: 4px;
        }
        .cert-remove-btn:hover { opacity: 1; background: rgba(214,69,69,0.12); color: #d64545; }
        .cert-actions { display: flex; gap: 6px; margin: 4px 0; flex-wrap: wrap; }
        .cert-save-row { display: flex; justify-content: flex-end; margin-top: 6px; }
        input[type=file] { display: none; }

        .footer { display: flex; gap: 8px; align-items: center; }
        .footer .spacer { flex: 1; }

        /* Default (non-primary) sl-button hover — draw from the editor dark
           tokens instead of Shoelace's light neutral, which reads white in dark
           mode. (Same fix as feezal-generate-dialog; keep the two in sync.) */
    `];

    constructor() {
        super();
        this._protocol = 'mqtt';
        this._host = 'localhost';
        this._port = '1883';
        this._username = '';
        this._password = '';
        this._viaServer = false;    // DIRECT is the default + recommended viewer mode
        this._protocolVersion = 4;
        this._saving = false;
        this._bridge = null;
        this._testing = false;
        this._testUri = '';
        this._pollTimer = null;
        this._certStatus = null;
        this._pasteFor = null;
        this._pemText = '';
        this._certBusy = false;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopPoll();
    }

    /** The Connection sidebar owns the persisted connection object. */
    _viewerSidebar() {
        return window.feezal?.app?.shadowRoot?.querySelector('feezal-sidebar-viewer') || null;
    }

    _parseUri(uri) {
        try {
            const u = new URL(uri);
            return {
                _protocol: (u.protocol.replace(':', '') || 'mqtt'),
                _host: u.hostname || '',
                _port: u.port || '',
                _username: u.username ? decodeURIComponent(u.username) : '',
                _password: u.password ? decodeURIComponent(u.password) : '',
            };
        } catch { return {}; }
    }

    /** Open the dialog, pre-filled from any existing connection (else the
     *  mqtt://localhost:1883 defaults). */
    open() {
        const c = this._viewerSidebar()?.connection || {};
        const s = c.uri && !c._host ? {...c, ...this._parseUri(c.uri)} : c;
        this._protocol = s._protocol || 'mqtt';
        this._host = s._host || (s.uri ? '' : 'localhost');
        this._port = s._port || (s.uri ? '' : '1883');
        this._username = s._username || '';
        this._password = s._password || '';
        this._viaServer = s.viaServer === true;
        this._protocolVersion = s.protocolVersion || 4;
        this._saving = false;
        this._testing = false;
        this._testUri = '';
        this._pasteFor = null;
        this._pemText = '';
        this.requestUpdate();
        this._startPoll();
        this._loadCertStatus();
        this.updateComplete.then(() => this.renderRoot.querySelector('sl-dialog')?.show());
    }

    _startPoll() {
        this._pollBridge();
        if (!this._pollTimer) this._pollTimer = setInterval(() => this._pollBridge(), 1500);
    }

    _stopPoll() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    }

    async _pollBridge() {
        try {
            const r = await fetch('/api/bridge/status');
            if (r.ok) {
                this._bridge = await r.json();
                // A test settles once the bridge reflects our uri and has a verdict.
                if (this._testing && this._bridge?.uri === this._testUri &&
                    (this._bridge.connected || this._bridge.lastError)) {
                    this._testing = false;
                }
            }
        } catch { /* server unreachable — leave the last state */ }
    }

    _close(reason) {
        this._stopPoll();
        this.renderRoot.querySelector('sl-dialog')?.hide();
        this.dispatchEvent(new CustomEvent('feezal-connect-closed', {detail: {reason}, bubbles: true, composed: true}));
    }

    get _isTcp() { return this._protocol === 'mqtt' || this._protocol === 'mqtts'; }
    get _isTls() { return this._protocol === 'mqtts' || this._protocol === 'wss'; }
    // Effective mode: mqtt(s):// forces bridge (a browser can't open it).
    get _bridgeMode() { return this._isTcp || this._viaServer === true; }

    _buildConnection() {
        const proto = this._protocol || 'mqtt';
        const host = (this._host || '').trim();
        const port = String(this._port || '').trim();
        const auth = this._username
            ? `${encodeURIComponent(this._username)}${this._password ? ':' + encodeURIComponent(this._password) : ''}@`
            : '';
        return {
            backend: 'mqtt',
            _protocol: proto, _host: host, _port: port,
            _username: this._username || '', _password: this._password || '',
            viaServer: this._bridgeMode,
            protocolVersion: this._protocolVersion || 4,
            uri: `${proto}://${auth}${host}${port ? ':' + port : ''}`,
        };
    }

    /** Apply the entered settings to the server bridge (deploy) — the shared step
     *  of Test and Save. Returns the built connection's uri. */
    _apply(done) {
        const conn = this._buildConnection();
        const vs = this._viewerSidebar();
        if (vs) vs.connection = conn;
        if (window.feezal?.app?._deploy) window.feezal.app._deploy(done);
        else done && done();
        return conn.uri;
    }

    /** Test connection — apply + poll the bridge status; does NOT close. */
    _test() {
        if (!(this._host || '').trim()) return;
        this._testUri = this._apply();
        this._testing = true;
        this.requestUpdate();
        this._startPoll();
    }

    _save() {
        if (!(this._host || '').trim()) return;
        this._saving = true;
        this.requestUpdate();
        this._apply(() => { this._saving = false; this._close('saved'); });
    }

    // ── TLS certs (same endpoints + behaviour as the Connection sidebar) ──────
    async _loadCertStatus() {
        try {
            const site = window.feezal?.siteName || 'default';
            const r = await fetch(`/api/sites/${encodeURIComponent(site)}/certs`);
            if (r.ok) this._certStatus = await r.json();
        } catch { /* no dataDir — ignore */ }
    }

    async _uploadPem(pem, type = 'ca') {
        this._certBusy = true;
        try {
            const site = window.feezal?.siteName || 'default';
            const r = await fetch(`/api/sites/${encodeURIComponent(site)}/certs`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({type, pem}),
            });
            if (r.ok) { this._pasteFor = null; this._pemText = ''; await this._loadCertStatus(); }
        } catch { /* ignore */ }
        this._certBusy = false;
    }

    async _removeCert(type) {
        this._certBusy = true;
        try {
            const site = window.feezal?.siteName || 'default';
            await fetch(`/api/sites/${encodeURIComponent(site)}/certs/${type}`, {method: 'DELETE'});
            await this._loadCertStatus();
        } catch { /* ignore */ }
        this._certBusy = false;
    }

    _handleFileUpload(e, type = 'ca') {
        const file = e.target.files[0];
        if (!file) return;
        file.text().then(text => this._uploadPem(text, type));
        e.target.value = '';
    }

    // One mTLS cert row (type 'cert'|'key'): status badge + upload/paste/remove.
    _mtlsRow(type, label, accept) {
        const present = this._certStatus?.[type];
        return html`
            <div class="cert-info-row">
                <span class="cert-label">${label}</span>
                ${present ? html`
                    <span class="cert-badge-ok">✓</span>
                    <button class="cert-remove-btn" title="Remove ${label.toLowerCase()}" @click="${() => this._removeCert(type)}">✕</button>
                ` : html`
                    <span class="cert-badge-none">none</span>
                    <sl-button size="small" ?loading="${this._certBusy}"
                        @click="${() => this.renderRoot.querySelector(`#${type}-file-input`).click()}">Upload</sl-button>
                    <sl-button size="small" variant="text"
                        @click="${() => { this._pasteFor = this._pasteFor === type ? null : type; }}">
                        ${this._pasteFor === type ? 'Cancel' : 'Paste'}</sl-button>
                `}
            </div>
            <input id="${type}-file-input" type="file" accept="${accept}" @change="${e => this._handleFileUpload(e, type)}">
        `;
    }

    // Shared PEM paste box — open for at most one cert type at a time.
    _pasteArea(type) {
        if (this._pasteFor !== type) return '';
        return html`
            <sl-textarea size="small" rows="5" placeholder="-----BEGIN ...-----&#10;..."
                .value="${this._pemText}" @sl-input="${e => this._pemText = e.target.value}"></sl-textarea>
            <div class="cert-save-row">
                <sl-button size="small" variant="primary"
                    ?disabled="${!this._pemText.includes('-----BEGIN ')}" ?loading="${this._certBusy}"
                    @click="${() => this._uploadPem(this._pemText, type)}">Save</sl-button>
            </div>
        `;
    }

    /** The TLS section — CA + client cert/key, shown only for mqtts:// / wss://. */
    _tlsSection() {
        const hasCa = this._certStatus?.ca;
        return html`
            <div class="section">TLS certificates</div>
            <div class="cert-info-row">
                <span class="cert-label">CA certificate</span>
                ${hasCa ? html`
                    <span class="cert-badge-ok">✓</span>
                    <span class="cert-cn" title="${this._certStatus.caCn || ''}">${this._certStatus.caCn || 'CA certificate'}</span>
                    <button class="cert-remove-btn" title="Remove CA certificate" @click="${() => this._removeCert('ca')}">✕</button>
                ` : html`
                    <span class="cert-badge-none">none</span>
                    <sl-button size="small" ?loading="${this._certBusy}"
                        @click="${() => this.renderRoot.querySelector('#ca-file-input').click()}">Upload file</sl-button>
                    <sl-button size="small" variant="text"
                        @click="${() => { this._pasteFor = this._pasteFor === 'ca' ? null : 'ca'; }}">
                        ${this._pasteFor === 'ca' ? 'Cancel' : 'Paste PEM'}</sl-button>
                    <input id="ca-file-input" type="file" accept=".pem,.crt,.cer,.ca" @change="${e => this._handleFileUpload(e, 'ca')}">
                `}
            </div>
            ${this._pasteArea('ca')}
            <div class="section" style="margin-top:12px">Client certificate <span class="muted">(mTLS, optional)</span></div>
            ${this._mtlsRow('cert', 'Certificate', '.pem,.crt,.cer')}
            ${this._pasteArea('cert')}
            ${this._mtlsRow('key', 'Private key', '.pem,.key')}
            ${this._pasteArea('key')}
            <p class="hint">
                ${this._bridgeMode
                    ? html`Used by the <b>Feezal server</b> (bridge mode). The private key never leaves the server.`
                    : html`Direct viewers need the certificate in each device's OS trust store — this uploads it for the <b>Feezal server</b> (used when testing here and in bridge mode).`}
            </p>
        `;
    }

    /** Connection-status row (dot + label + error), with a yellow "connecting"
     *  state while a test is establishing. Same shape as the Connection sidebar. */
    _statusRow() {
        if (this._testing) {
            return html`
                <div class="status">
                    <span class="dot connecting"></span>
                    <span>Trying to connect to <b>${this._testUri}</b>…</span>
                </div>`;
        }
        const b = this._bridge;
        if (!b || !b.uri) {
            return html`<div class="status"><span class="dot"></span><span>Not connected — enter your broker, then <b>Test connection</b>.</span></div>`;
        }
        return html`
            <div class="status">
                <span class="dot ${b.connected ? 'ok' : 'err'}"></span>
                <span>${b.connected ? 'Connected' : 'Not connected'}</span>
                <span class="uri" title="${b.uri}">${b.uri}</span>
            </div>
            ${!b.connected && b.lastError ? html`<div class="status-error">${b.lastError.message}</div>` : ''}
        `;
    }

    render() {
        const httpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
        const wsOnHttps = httpsPage && this._protocol === 'ws' && !this._bridgeMode;
        const portPlaceholder = {ws: '9001', wss: '8084', mqtt: '1883', mqtts: '8883'}[this._protocol] || '';
        const canSubmit = Boolean((this._host || '').trim()) && !this._saving;
        return html`
            <sl-dialog label="Connect your MQTT broker" @sl-request-close="${e => { if (e.detail.source === 'overlay') e.preventDefault(); }}">
                <p class="intro">
                    Feezal talks to your smart home over MQTT. Point it at your broker to start —
                    you can change this anytime in the Connection sidebar, or <b>skip</b> for now.
                </p>

                <div class="section">Connection status</div>
                ${this._statusRow()}

                <div class="section">Broker</div>
                <div class="row">
                    <sl-select class="proto" label="Protocol" .value="${this._protocol}" hoist
                        @sl-change="${e => { this._protocol = e.target.value; }}">
                        <sl-option value="mqtt">mqtt://</sl-option>
                        <sl-option value="mqtts">mqtts://</sl-option>
                        <sl-option value="ws">ws://</sl-option>
                        <sl-option value="wss">wss://</sl-option>
                    </sl-select>
                    <sl-input label="Host" placeholder="localhost" .value="${this._host}"
                        @sl-input="${e => { this._host = e.target.value; }}"></sl-input>
                    <sl-input class="port" label="Port" type="number" placeholder="${portPlaceholder}" .value="${this._port}"
                        @sl-input="${e => { this._port = e.target.value; }}"></sl-input>
                </div>
                <p class="hint">
                    Prefer <b>ws://</b> or <b>wss://</b> — browsers can only open MQTT over WebSockets, so those
                    connect directly from the dashboard. <b>mqtt://</b> / <b>mqtts://</b> work only through the
                    Feezal server (bridge mode).
                </p>

                <div class="section">Authentication <span class="muted">(if your broker needs it)</span></div>
                <div class="row">
                    <sl-input label="Username" placeholder="(none)" .value="${this._username}"
                        @sl-input="${e => { this._username = e.target.value; }}"></sl-input>
                    <sl-input label="Password" type="password" password-toggle placeholder="(none)" .value="${this._password}"
                        @sl-input="${e => { this._password = e.target.value; }}"></sl-input>
                </div>

                <div class="section">Viewer connection</div>
                <sl-switch ?checked="${this._bridgeMode}" ?disabled="${this._isTcp}"
                    @sl-change="${e => { this._viaServer = e.target.checked; }}">
                    Connect via the feezal server (bridge mode)
                </sl-switch>
                <p class="hint">
                    ${this._isTcp ? html`
                        <b>Bridge mode is required</b> for mqtt:// / mqtts:// — a browser can't open those protocols,
                        so the dashboard connects to the feezal server, which relays to your broker.`
                    : this._bridgeMode ? html`
                        <b>Bridge mode:</b> the dashboard connects to the feezal server, which relays to your broker.`
                    : html`
                        <b>Direct mode (recommended):</b> the dashboard connects to your broker itself — no server round-trip.
                        The broker URL and any credentials are embedded in the viewer page.`}
                </p>
                ${wsOnHttps ? html`
                    <p class="hint warn">
                        <strong>This editor is served over HTTPS</strong>, so a direct viewer must use <b>wss://</b> —
                        browsers block <b>ws://</b> from an https:// page. Switch the protocol to wss://, or use bridge mode.
                    </p>` : ''}
                ${this._isTls && !this._bridgeMode ? html`
                    <p class="hint">
                        With <b>wss://</b>, every browser and device that opens the dashboard must
                        <b>trust the broker's TLS certificate</b> — install a self-signed certificate on each of them first.
                    </p>` : ''}
                ${this._isTls ? this._tlsSection() : ''}

                <div slot="footer" class="footer">
                    <sl-button variant="text" ?disabled="${this._saving}" @click="${() => this._close('skipped')}">Skip for now</sl-button>
                    <span class="spacer"></span>
                    <sl-button ?disabled="${!canSubmit}" @click="${this._test}">Test connection</sl-button>
                    <sl-button variant="primary" ?loading="${this._saving}" ?disabled="${!canSubmit}"
                        @click="${this._save}">Save &amp; connect</sl-button>
                </div>
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-connect-dialog', FeezalConnectDialog);
export {FeezalConnectDialog};
