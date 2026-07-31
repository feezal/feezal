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
 * modal, and it can be skipped. On save it writes the connection onto the
 * Connection sidebar and deploys it (so the server bridge connects), then closes.
 *
 * Guidance baked in (per the product decisions):
 *  - recommend ws:// / wss:// (browsers speak only WebSocket MQTT);
 *  - a page served over https:// must use wss:// (browsers block ws:// there);
 *  - wss:// needs every viewing device to trust the broker's TLS certificate;
 *  - DIRECT is the default + recommended viewer mode;
 *  - the Direct/Bridge switch is disabled for mqtt://|mqtts:// (a browser cannot
 *    open those, so bridge mode is required).
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
    };

    static styles = css`
        /* Bigger than the sidebar: this is a focused first-run modal. */
        sl-dialog::part(panel) { max-width: 560px; }
        sl-dialog::part(body) { font-size: 15px; }
        .intro { font-size: 15px; line-height: 1.5; margin: 0 0 18px; color: var(--feezal-color, #333); }
        .section { font-size: 12px; text-transform: uppercase; letter-spacing: .05em;
            opacity: .6; margin: 18px 0 8px; }
        .row { display: flex; gap: 12px; align-items: flex-end; }
        .row > * { flex: 1; }
        .row > .port { flex: 0 0 120px; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { font-size: 14px; }
        sl-input::part(input), sl-select::part(display-input) { font-size: 16px; height: 2.6em; }
        sl-select::part(expand-icon) { font-size: 16px; }
        sl-switch { margin-top: 12px; font-size: 15px; }
        .hint { font-size: 13px; line-height: 1.5; margin: 8px 0 0; opacity: .8; }
        .hint.warn {
            opacity: 1; padding: 8px 12px; border-radius: 6px;
            background: var(--feezal-badge-bg, #fff4e5); color: var(--warning-color, #b45309);
            border: 1px solid var(--warning-color, #f59e0b);
        }
        .hint.warn strong { color: inherit; }
        .footer { display: flex; gap: 8px; align-items: center; }
        .footer .spacer { flex: 1; }
        .saving { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; opacity: .8; }
        .saving sl-spinner { font-size: 16px; --track-width: 2px; }
    `;

    constructor() {
        super();
        this._protocol = 'ws';
        this._host = '';
        this._port = '';
        this._username = '';
        this._password = '';
        this._viaServer = false;    // DIRECT is the default + recommended viewer mode
        this._protocolVersion = 4;
        this._saving = false;
    }

    /** The Connection sidebar owns the persisted connection object. */
    _viewerSidebar() {
        return window.feezal?.app?.shadowRoot?.querySelector('feezal-sidebar-viewer') || null;
    }

    _parseUri(uri) {
        try {
            const u = new URL(uri);
            return {
                _protocol: (u.protocol.replace(':', '') || 'ws'),
                _host: u.hostname || '',
                _port: u.port || '',
                _username: u.username ? decodeURIComponent(u.username) : '',
                _password: u.password ? decodeURIComponent(u.password) : '',
            };
        } catch { return {}; }
    }

    /** Open the dialog, pre-filled from any existing connection. */
    open() {
        const c = this._viewerSidebar()?.connection || {};
        const s = c.uri && !c._host ? {...c, ...this._parseUri(c.uri)} : c;
        this._protocol = s._protocol || 'ws';
        this._host = s._host || '';
        this._port = s._port || '';
        this._username = s._username || '';
        this._password = s._password || '';
        this._viaServer = s.viaServer === true;
        this._protocolVersion = s.protocolVersion || 4;
        this._saving = false;
        this.requestUpdate();
        this.updateComplete.then(() => this.renderRoot.querySelector('sl-dialog')?.show());
    }

    _close(reason) {
        this.renderRoot.querySelector('sl-dialog')?.hide();
        this.dispatchEvent(new CustomEvent('feezal-connect-closed', {detail: {reason}, bubbles: true, composed: true}));
    }

    get _isTcp() { return this._protocol === 'mqtt' || this._protocol === 'mqtts'; }
    get _isTls() { return this._protocol === 'mqtts' || this._protocol === 'wss'; }
    // Effective mode: mqtt(s):// forces bridge (a browser can't open it).
    get _bridge() { return this._isTcp || this._viaServer === true; }

    _buildConnection() {
        const proto = this._protocol || 'ws';
        const host = (this._host || '').trim();
        const port = String(this._port || '').trim();
        const auth = this._username
            ? `${encodeURIComponent(this._username)}${this._password ? ':' + encodeURIComponent(this._password) : ''}@`
            : '';
        return {
            backend: 'mqtt',
            _protocol: proto, _host: host, _port: port,
            _username: this._username || '', _password: this._password || '',
            viaServer: this._bridge,
            protocolVersion: this._protocolVersion || 4,
            uri: `${proto}://${auth}${host}${port ? ':' + port : ''}`,
        };
    }

    _save() {
        const host = (this._host || '').trim();
        if (!host) return;
        const vs = this._viewerSidebar();
        if (vs) vs.connection = this._buildConnection();
        this._saving = true;
        this.requestUpdate();
        // Deploy so the connection is persisted and the server bridge connects.
        const done = () => { this._saving = false; this._close('saved'); };
        if (window.feezal?.app?._deploy) window.feezal.app._deploy(done);
        else done();
    }

    render() {
        const httpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
        // ws:// from an https:// page is blocked by the browser — only matters
        // for a DIRECT viewer (bridge mode connects to the same-origin server).
        const wsOnHttps = httpsPage && this._protocol === 'ws' && !this._bridge;
        const portPlaceholder = {ws: '9001', wss: '8084', mqtt: '1883', mqtts: '8883'}[this._protocol] || '';
        return html`
            <sl-dialog label="Connect your MQTT broker" @sl-request-close="${e => { if (e.detail.source === 'overlay') e.preventDefault(); }}">
                <p class="intro">
                    feezal talks to your smart home over MQTT. Point it at your broker to start —
                    you can change this anytime in the Connection sidebar, or <b>skip</b> for now.
                </p>

                <div class="section">Broker</div>
                <div class="row">
                    <sl-select label="Protocol" .value="${this._protocol}"
                        @sl-change="${e => { this._protocol = e.target.value; }}">
                        <sl-option value="ws">ws://</sl-option>
                        <sl-option value="wss">wss://</sl-option>
                        <sl-option value="mqtt">mqtt://</sl-option>
                        <sl-option value="mqtts">mqtts://</sl-option>
                    </sl-select>
                    <sl-input label="Host" placeholder="192.168.1.10" .value="${this._host}"
                        @sl-input="${e => { this._host = e.target.value; }}"></sl-input>
                    <sl-input class="port" label="Port" type="number" placeholder="${portPlaceholder}" .value="${this._port}"
                        @sl-input="${e => { this._port = e.target.value; }}"></sl-input>
                </div>
                <p class="hint">
                    Prefer <b>ws://</b> or <b>wss://</b> — browsers can only open MQTT over WebSockets, so those
                    connect directly from the dashboard. <b>mqtt://</b> / <b>mqtts://</b> work only through the
                    feezal server (bridge mode).
                </p>

                <div class="section">Authentication <span style="text-transform:none;opacity:.7">(if your broker needs it)</span></div>
                <div class="row">
                    <sl-input label="Username" placeholder="(none)" .value="${this._username}"
                        @sl-input="${e => { this._username = e.target.value; }}"></sl-input>
                    <sl-input label="Password" type="password" password-toggle placeholder="(none)" .value="${this._password}"
                        @sl-input="${e => { this._password = e.target.value; }}"></sl-input>
                </div>

                <div class="section">Viewer connection</div>
                <sl-switch ?checked="${this._bridge}" ?disabled="${this._isTcp}"
                    @sl-change="${e => { this._viaServer = e.target.checked; }}">
                    Connect via the feezal server (bridge mode)
                </sl-switch>
                <p class="hint">
                    ${this._isTcp ? html`
                        <b>Bridge mode is required</b> for mqtt:// / mqtts:// — a browser can't open those protocols,
                        so the dashboard connects to the feezal server, which relays to your broker.`
                    : this._bridge ? html`
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
                        ${this._bridge
                            ? html`With a self-signed / private-CA broker, the <b>feezal server</b> must trust its certificate —
                                add the CA under <b>Connection → TLS</b> in the sidebar.`
                            : html`With <b>wss://</b>, every browser and device that opens the dashboard must
                                <b>trust the broker's TLS certificate</b> — install a self-signed certificate on each of them first.`}
                    </p>` : ''}

                <div slot="footer" class="footer">
                    ${this._saving ? html`<span class="saving"><sl-spinner></sl-spinner> Connecting &amp; deploying…</span>` : ''}
                    <span class="spacer"></span>
                    <sl-button variant="text" ?disabled="${this._saving}" @click="${() => this._close('skipped')}">Skip for now</sl-button>
                    <sl-button variant="primary" ?loading="${this._saving}" ?disabled="${!this._host.trim() || this._saving}"
                        @click="${this._save}">Save &amp; connect</sl-button>
                </div>
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-connect-dialog', FeezalConnectDialog);
export {FeezalConnectDialog};
