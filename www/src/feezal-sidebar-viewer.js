import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';

/**
 * feezal-sidebar-viewer
 *
 * Connection and site settings sidebar panel.
 * Only the mqtt backend remains — node-red has been removed.
 */
class FeezalSidebarViewer extends LitElement {
    static properties = {
        connection:   {type: Object},
        site:         {type: Object},
        _certStatus:  {state: true},
        _showPaste:   {state: true},
        _pemText:     {state: true},
        _certBusy:    {state: true},
    };

    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        sl-tab-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        sl-tab::part(base) { font-size: 13px; padding: 10px 8px; }
        sl-tab-panel::part(base) { height: 100%; overflow-y: auto; padding: 12px; box-sizing: border-box; }
        sl-input, sl-select { width: 100%; margin-top: 8px; }
        sl-input:first-child, sl-select:first-child { margin-top: 0; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-select::part(display-input) { color: var(--feezal-color, #333); background: var(--feezal-bg, #fff); }
        .row { display: flex; gap: 8px; align-items: flex-end; }
        .row > sl-input, .row > sl-select { flex: 1; }
        .row > sl-input.port { flex: 0 0 80px; }
        .section-label {
            font-size: 11px; color: var(--feezal-color, #888); letter-spacing: 0.05em;
            text-transform: uppercase; margin-top: 16px; margin-bottom: 4px;
            padding-bottom: 4px; border-bottom: 1px solid var(--feezal-border, #eee);
        }
        /* TLS cert section */
        .cert-info-row {
            display: flex; align-items: center; gap: 6px; margin-top: 8px;
        }
        .cert-badge-ok {
            flex-shrink: 0; font-size: 10px; padding: 1px 5px; border-radius: 8px;
            font-weight: 700; background: #dcfce7; color: #16a34a;
        }
        .cert-badge-none {
            font-size: 11px; padding: 2px 6px; border-radius: 10px;
            font-weight: 600; background: #f3f4f6; color: #9ca3af;
        }
        .cert-cn {
            flex: 1; font-size: 12px; color: var(--feezal-color, #555);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-style: italic;
        }
        .cert-remove-btn {
            flex-shrink: 0; background: none; border: none; cursor: pointer;
            padding: 2px 5px; border-radius: 4px; font-size: 13px; line-height: 1;
            color: var(--feezal-color, #666); opacity: 0.45;
            transition: opacity 0.15s, background 0.15s, color 0.15s;
        }
        .cert-remove-btn:hover { opacity: 1; background: rgba(200,0,0,0.08); color: #c62828; }
        .cert-actions { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
        sl-textarea { width: 100%; margin-top: 6px; }
        sl-textarea::part(textarea) {
            font-family: monospace; font-size: 11px;
            background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333);
            border-color: var(--feezal-border, #ccc);
        }
        .cert-save-row { display: flex; justify-content: flex-end; margin-top: 6px; }
        input[type=file] { display: none; }
        /* Confirmation dialog — float above all editor overlays (inspector handles: 20000) */
        #dlg-remove-ca { --sl-z-index-dialog: 20001; }
        /* Dark mode — mirror the pattern used in feezal-app-editor dialogs */
        :host-context(.dark) #dlg-remove-ca {
            --sl-panel-background-color: #2e2e2e;
            --sl-panel-border-color: #3d3d3d;
            --sl-color-neutral-0:   #1e1e1e;
            --sl-color-neutral-100: #252525;
            --sl-color-neutral-200: #3d3d3d;
            --sl-color-neutral-600: rgba(255,255,255,0.55);
            --sl-color-neutral-700: rgba(255,255,255,0.75);
            --sl-color-neutral-900: rgba(255,255,255,0.9);
            --sl-color-neutral-1000: rgba(255,255,255,0.95);
        }
        :host-context(.dark) #dlg-remove-ca::part(panel) { color: rgba(255,255,255,0.88); }
        :host-context(.dark) #dlg-remove-ca p { color: rgba(255,255,255,0.85); }
        :host-context(.dark) #dlg-remove-ca sl-button:not([variant])::part(base) {
            background-color: #3a3a3a; border-color: #555; color: rgba(255,255,255,0.8);
        }
    `;

    constructor() {
        super();
        this.connection  = {backend: 'mqtt'};
        this.site        = {name: feezal.siteName};
        this._certStatus = null;
        this._showPaste  = false;
        this._pemText    = '';
        this._certBusy   = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadCertStatus();
    }

    async _loadCertStatus() {
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/certs`);
            if (r.ok) this._certStatus = await r.json();
        } catch { /* ignore — server may not have a dataDir */ }
    }

    async _uploadPem(pem) {
        this._certBusy = true;
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/certs`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({type: 'ca', pem}),
            });
            if (r.ok) {
                this._showPaste = false;
                this._pemText   = '';
                await this._loadCertStatus();
            }
        } catch { /* ignore */ }
        this._certBusy = false;
    }

    async _removeCert(type) {
        this._certBusy = true;
        try {
            await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/certs/${type}`, {method: 'DELETE'});
            await this._loadCertStatus();
        } catch { /* ignore */ }
        this._certBusy = false;
    }

    async _confirmRemoveCA() {
        await this._removeCert('ca');
        this.renderRoot.querySelector('#dlg-remove-ca')?.hide();
    }

    _handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        file.text().then(text => this._uploadPem(text));
        e.target.value = '';
    }

    // ── URI ↔ structured fields ──────────────────────────────────────────────

    /** Parse a broker URI into structured fields stored on the connection object. */
    _parseUri(uri) {
        if (!uri) return;
        try {
            const u = new URL(uri);
            this.connection = {
                ...this.connection,
                uri,
                _protocol: u.protocol.replace(':', '') || 'mqtt',
                _host: u.hostname || '',
                _port: u.port || '',
                _username: u.username || '',
                _password: u.password || ''
            };
        } catch {
            // Not a valid URL — keep the raw URI field, clear structured fields
            this.connection = {...this.connection, uri, _host: '', _port: '', _protocol: 'mqtt', _username: '', _password: ''};
        }
    }

    /** Build a URI string from the structured fields and store it as connection.uri. */
    _buildUri() {
        const c = this.connection;
        const proto = c._protocol || 'mqtt';
        const host = c._host || 'localhost';
        const port = c._port ? `:${c._port}` : '';
        const auth = c._username
            ? `${encodeURIComponent(c._username)}${c._password ? ':' + encodeURIComponent(c._password) : ''}@`
            : '';
        this.connection = {...c, uri: `${proto}://${auth}${host}${port}`};
    }

    updated(changed) {
        // When connection is set externally with a uri but without structured fields,
        // parse the URI into structured fields for display.
        if (changed.has('connection')) {
            const c = this.connection;
            if (c.uri && !c._host) {
                this._parseUri(c.uri);
            }
        }
    }

    render() {
        const c = this.connection;
        const s = this.site;
        const isTls = c._protocol === 'mqtts' || c._protocol === 'wss';
        const hasCa = this._certStatus?.ca;
        return html`
            <sl-tab-group>
                <sl-tab slot="nav" panel="connection">Connection</sl-tab>
                <sl-tab slot="nav" panel="site">Site</sl-tab>

                <sl-tab-panel name="connection">
                    <div class="section-label">Broker</div>
                    <div class="row">
                        <sl-select label="Protocol" size="small"
                            .value="${c._protocol || 'mqtt'}"
                            @sl-change="${e => { this.connection = {...this.connection, _protocol: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                            <sl-option value="mqtt">mqtt://</sl-option>
                            <sl-option value="mqtts">mqtts://</sl-option>
                            <sl-option value="ws">ws://</sl-option>
                            <sl-option value="wss">wss://</sl-option>
                        </sl-select>
                    </div>
                    <div class="row">
                        <sl-input label="Host" size="small" placeholder="localhost"
                            .value="${c._host || ''}"
                            @sl-change="${e => { this.connection = {...this.connection, _host: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                        </sl-input>
                        <sl-input class="port" label="Port" size="small" type="number" placeholder="1883"
                            .value="${c._port || ''}"
                            @sl-change="${e => { this.connection = {...this.connection, _port: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                        </sl-input>
                    </div>
                    <div class="section-label">Authentication</div>
                    <sl-input label="Username" size="small" placeholder="(none)"
                        .value="${c._username || ''}"
                        @sl-change="${e => { this.connection = {...this.connection, _username: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                    </sl-input>
                    <sl-input label="Password" size="small" type="password" placeholder="(none)"
                        .value="${c._password || ''}"
                        @sl-change="${e => { this.connection = {...this.connection, _password: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                    </sl-input>

                    ${isTls ? html`
                        <div class="section-label">TLS</div>
                        ${hasCa ? html`
                            <div class="cert-info-row">
                                <span class="cert-badge-ok">✓</span>
                                <span class="cert-cn" title="${this._certStatus.caCn || ''}">
                                    ${this._certStatus.caCn || 'CA certificate'}
                                </span>
                                <button class="cert-remove-btn" title="Remove CA certificate"
                                    @click="${() => this.renderRoot.querySelector('#dlg-remove-ca').show()}">
                                    ✕
                                </button>
                            </div>
                        ` : html`
                            <div class="cert-info-row">
                                <span style="font-size:13px;color:var(--feezal-color,#333)">CA certificate</span>
                                <span class="cert-badge-none">none</span>
                            </div>
                            <div class="cert-actions">
                                <sl-button size="small" ?loading="${this._certBusy}"
                                    @click="${() => this.renderRoot.querySelector('#ca-file-input').click()}">
                                    Upload file
                                </sl-button>
                                <sl-button size="small" variant="text"
                                    @click="${() => { this._showPaste = !this._showPaste; }}">
                                    ${this._showPaste ? 'Cancel' : 'Paste PEM'}
                                </sl-button>
                            </div>
                            <input id="ca-file-input" type="file" accept=".pem,.crt,.cer,.ca"
                                @change="${this._handleFileUpload}">
                            ${this._showPaste ? html`
                                <sl-textarea size="small" rows="5"
                                    placeholder="-----BEGIN CERTIFICATE-----&#10;..."
                                    .value="${this._pemText}"
                                    @sl-input="${e => this._pemText = e.target.value}">
                                </sl-textarea>
                                <div class="cert-save-row">
                                    <sl-button size="small" variant="primary"
                                        ?disabled="${!this._pemText.includes('-----BEGIN ')}"
                                        ?loading="${this._certBusy}"
                                        @click="${() => this._uploadPem(this._pemText)}">
                                        Save
                                    </sl-button>
                                </div>
                            ` : ''}
                        `}
                    ` : ''}

                    <div class="section-label">Client</div>
                    <sl-input label="Client ID" size="small" placeholder="(auto)"
                        .value="${c.clientId || ''}"
                        @sl-change="${e => this._setConn('clientId', e.target.value)}">
                    </sl-input>
                    <div class="section-label">Last Will</div>
                    <sl-input label="Topic" size="small"
                        .value="${c.lwt || ''}"
                        @sl-change="${e => this._setConn('lwt', e.target.value)}">
                    </sl-input>
                    <sl-input label="Payload" size="small"
                        .value="${c.lwp || ''}"
                        @sl-change="${e => this._setConn('lwp', e.target.value)}">
                    </sl-input>
                    <div class="section-label">On Connect</div>
                    <sl-input label="Topic" size="small"
                        .value="${c.oct || ''}"
                        @sl-change="${e => this._setConn('oct', e.target.value)}">
                    </sl-input>
                    <sl-input label="Payload" size="small"
                        .value="${c.ocp || ''}"
                        @sl-change="${e => this._setConn('ocp', e.target.value)}">
                    </sl-input>
                </sl-tab-panel>

                <sl-tab-panel name="site">
                    <sl-input label="Name" size="small" disabled
                        .value="${s.name || ''}">
                    </sl-input>
                    <sl-input label="Title" size="small"
                        .value="${s.pageTitle || ''}"
                        @sl-change="${e => this._setSite('pageTitle', e.target.value)}">
                    </sl-input>
                    <sl-input label="Subscribe Topic" size="small"
                        .value="${s.subscribe || ''}"
                        @sl-change="${e => this._setSite('subscribe', e.target.value)}">
                    </sl-input>
                    <sl-input label="Publish Topic" size="small"
                        .value="${s.publish || ''}"
                        @sl-change="${e => this._setSite('publish', e.target.value)}">
                    </sl-input>
                </sl-tab-panel>
            </sl-tab-group>

            <!-- CA certificate removal confirmation dialog -->
            <sl-dialog id="dlg-remove-ca" label="Remove CA certificate">
                <p>Remove <strong>${this._certStatus?.caCn ? `\u201c${this._certStatus.caCn}\u201d` : 'the CA certificate'}</strong>?<br>
                TLS connections to brokers signed by this CA will fail until a new certificate is uploaded.</p>
                <sl-button slot="footer" variant="default"
                    @click="${() => this.renderRoot.querySelector('#dlg-remove-ca').hide()}">
                    Cancel
                </sl-button>
                <sl-button slot="footer" variant="danger" ?loading="${this._certBusy}"
                    @click="${this._confirmRemoveCA}">
                    Remove
                </sl-button>
            </sl-dialog>
        `;
    }

    _setConn(key, value) {
        this.connection = {...this.connection, [key]: value};
        this._applyConnection();
        feezal.app.change(true);
    }

    _setSite(key, value) {
        this.site = {...this.site, [key]: value};
        this._applySite();
        feezal.app.change(true);
    }

    _applyConnection() {
        // Connection is read back by feezal-app-editor on deploy
    }

    _applySite() {
        if (feezal.site) {
            const s = this.site;
            Object.entries(s).forEach(([key, value]) => {
                const attr = key.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
                if (value === false) {
                    feezal.site.removeAttribute(attr);
                } else if (value === true) {
                    feezal.site.setAttribute(attr, attr);
                } else if (value) {
                    feezal.site.setAttribute(attr, value);
                }
            });
        }
    }
}

window.customElements.define('feezal-sidebar-viewer', FeezalSidebarViewer);
