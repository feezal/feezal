import {LitElement, html, css} from 'lit';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';

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
    };

    static styles = css`
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

        .footer { display: flex; gap: 8px; align-items: center; }
        .footer .spacer { flex: 1; }
    `;

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
        this.requestUpdate();
        this._startPoll();
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
                    feezal talks to your smart home over MQTT. Point it at your broker to start —
                    you can change this anytime in the Connection sidebar, or <b>skip</b> for now.
                </p>

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
                    feezal server (bridge mode).
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
                ${this._isTls ? html`
                    <p class="hint">
                        ${this._bridgeMode
                            ? html`With a self-signed / private-CA broker, the <b>feezal server</b> must trust its certificate —
                                add the CA under <b>Connection → TLS</b> in the sidebar.`
                            : html`With <b>wss://</b>, every browser and device that opens the dashboard must
                                <b>trust the broker's TLS certificate</b> — install a self-signed certificate on each of them first.`}
                    </p>` : ''}

                <div class="section">Connection status</div>
                ${this._statusRow()}

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
