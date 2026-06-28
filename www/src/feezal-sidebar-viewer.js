import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

/**
 * feezal-sidebar-viewer
 *
 * Connection and site settings sidebar panel.
 * Only the mqtt backend remains — node-red has been removed.
 */
class FeezalSidebarViewer extends LitElement {
    static properties = {
        connection: {type: Object},
        site:       {type: Object}
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
    `;

    constructor() {
        super();
        this.connection = {backend: 'mqtt'};
        this.site = {name: feezal.siteName};
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
