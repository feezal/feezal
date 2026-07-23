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
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

import './feezal-pwa-icon-dialog.js';
import './feezal-sidebar-clients.js';

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
        pwa:          {type: Boolean},
        app:          {type: Object},   // A9 Tier 2a: {name, id} for the mobile-app export
        security:     {type: Object},   // A28: {csp: {aspect: {mode, hosts}}}
        _violations:  {state: true},    // A28: recent CSP violations for the chips
        _secAdvanced: {state: true},    // A28: scripts/styles/fonts disclosure
        _certStatus:  {state: true},
        _pasteFor:    {state: true},   // null | 'ca' | 'cert' | 'key' — open paste area
        _pemText:     {state: true},
        _certBusy:    {state: true},
        _pwaIcons:    {state: true},   // {custom, meta} | null
        _pwaIconTs:   {state: true},   // cache-buster for the preview img
        _bridge:      {state: true},   // server↔broker status {connected, uri, lastError} | null
    };

    static styles = css`
        :host { display: flex; flex-direction: column; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        sl-tab-group { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(base) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        sl-tab-group::part(body) { flex: 1; min-height: 0; overflow: hidden; }
        sl-tab-group::part(nav) { background: var(--feezal-bg-sub, #f5f5f5); }
        /* 39px tab + 2px nav track = 41px — the same height as the .ftab view
           tab bar left of the sidebar, so both header bars share one bottom edge. */
        sl-tab::part(base) { font-size: 14px; padding: 0 10px; height: 39px; }
        /* height:100% on the panel itself is required — without it the slotted
           sl-tab-panel sizes to its content, part(base)'s 100% resolves against
           that auto height and the panel can never scroll. */
        sl-tab-panel { height: 100%; }
        sl-tab-panel::part(base) { height: 100%; overflow-y: auto; padding: 12px; box-sizing: border-box; }
        /* The clients list brings its own padding and scroll container. */
        sl-tab-panel[name="clients"]::part(base) { padding: 0; overflow: hidden; }
        feezal-sidebar-clients { display: block; height: 100%; }
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
        /* Server↔broker status indicator */
        .bridge-status {
            display: flex; align-items: center; gap: 7px; margin-top: 8px;
            font-size: 12px; color: var(--feezal-color, #333);
        }
        .bridge-status .uri { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8; }
        .bridge-dot {
            width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto;
            background: #9ca3af;
        }
        .bridge-dot.ok  { background: #2e7d32; }
        .bridge-dot.err { background: #c62828; }
        .bridge-error {
            margin-top: 4px; font-size: 11px; line-height: 1.4;
            color: var(--sl-color-danger-600, #c62828); word-break: break-word;
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
        /* PWA section */
        sl-switch { margin-top: 8px; --sl-input-label-color: var(--feezal-color, #333); }
        sl-switch::part(label) { font-size: 13px; color: var(--feezal-color, #333); }
        .pwa-hint { font-size: 11px; color: var(--feezal-color, #888); margin-top: 4px; line-height: 1.4; }
        /* A28 — Security tab */
        .sec-row { margin: 10px 0; display: flex; flex-direction: column; gap: 4px; }
        .sec-row-head { display: flex; align-items: baseline; gap: 6px; }
        .sec-label { font-weight: 600; font-size: 12px; }
        .sec-hint { font-size: 10px; opacity: 0.55; }
        .sec-warning { font-size: 11px; color: var(--warning-color, #b45309); line-height: 1.4; }
        .sec-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 2px; }
        .sec-chip {
            display: inline-flex; align-items: center; gap: 3px;
            font-size: 11px; padding: 2px 6px; border-radius: 10px;
            background: var(--feezal-bg-sub, #eee); border: 1px solid var(--feezal-border, #ddd);
        }
        .sec-chip.locked { opacity: 0.75; }
        .sec-chip.suggest { cursor: pointer; }
        .sec-chip-x { border: none; background: none; cursor: pointer; padding: 0 1px; color: inherit; }
        .sec-add { min-width: 170px; flex: 1; }
        .sec-violation { display: flex; align-items: center; gap: 8px; font-size: 11px; margin: 4px 0; }
        .sec-vhost { font-weight: 600; }
        details > summary { cursor: pointer; margin: 8px 0 4px; }
        .pwa-icon-row { display: flex; gap: 10px; align-items: center; margin-top: 10px; }
        .pwa-icon-preview {
            width: 48px; height: 48px; border-radius: 8px; flex: 0 0 auto;
            border: 1px solid var(--feezal-border, #ddd); object-fit: cover; background: #fff;
        }
        .pwa-icon-meta { font-size: 12px; color: var(--feezal-color, #555); }
        .pwa-icon-actions { display: flex; gap: 6px; margin-top: 4px; }
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
        this.pwa         = false;
        this.app         = {};
        this.security    = {};      // A28
        this._violations = [];      // A28
        this._secAdvanced = false;  // A28
        this._certStatus = null;
        this._pasteFor   = null;
        this._pemText    = '';
        this._certBusy   = false;
        this._pwaIcons   = null;
        this._pwaIconTs  = Date.now();
        this._bridge     = null;
        this._bridgeTimer = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadCertStatus();
        this._loadPwaIcons();
        // Poll the server↔broker status while the panel exists — also while
        // the tab is hidden, so the indicator is current the moment it opens.
        this._pollBridgeStatus();
        this._bridgeTimer = setInterval(() => this._pollBridgeStatus(), 3000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._bridgeTimer);
        this._bridgeTimer = null;
    }

    async _pollBridgeStatus() {
        try {
            const r = await fetch('/api/bridge/status');
            if (r.ok) this._bridge = await r.json();
        } catch { /* server unreachable — keep the last known status */ }
    }

    async _loadPwaIcons() {
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/pwa-icons`);
            if (r.ok) {
                this._pwaIcons = await r.json();
                this._pwaIconTs = Date.now();
            }
        } catch { /* server without dataDir */ }
    }

    _setPwa(enabled) {
        this.pwa = enabled;
        feezal.app.change(true);
    }

    _setApp(key, value) {
        const next = {...this.app};
        if (value) next[key] = value;
        else delete next[key];
        this.app = next;
        feezal.app.change(true);
    }

    _pickIconFile() {
        this.renderRoot.querySelector('#pwa-icon-file').click();
    }

    _onIconFile(e) {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        this.renderRoot.querySelector('feezal-pwa-icon-dialog')
            .open({site: feezal.siteName, source: file});
    }

    /** Re-open the crop dialog with the stored source + crop + colour. */
    async _regenerateIcon() {
        const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/pwa-icons?include=source`);
        const data = r.ok ? await r.json() : null;
        if (!data || !data.source) return;
        const bytes = Uint8Array.from(atob(data.source.data), c => c.charCodeAt(0));
        const file = new File([bytes], data.source.name);
        this.renderRoot.querySelector('feezal-pwa-icon-dialog')
            .open({site: feezal.siteName, source: file, meta: data.meta});
    }

    async _resetIcon() {
        await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/pwa-icons`, {method: 'DELETE'})
            .catch(() => {});
        this._loadPwaIcons();
    }

    async _loadCertStatus() {
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/certs`);
            if (r.ok) this._certStatus = await r.json();
        } catch { /* ignore — server may not have a dataDir */ }
    }

    async _uploadPem(pem, type = 'ca') {
        this._certBusy = true;
        try {
            const r = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/certs`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({type, pem}),
            });
            if (r.ok) {
                this._pasteFor = null;
                this._pemText  = '';
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

    _handleFileUpload(e, type = 'ca') {
        const file = e.target.files[0];
        if (!file) return;
        file.text().then(text => this._uploadPem(text, type));
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

    /** Server↔broker status: dot + label, plus the broker's last error so TLS
     * trust / auth / unreachable-host problems are visible right where the
     * connection is configured (the bridge otherwise fails silently and the
     * Clients panel just stays empty). */
    _bridgeStatusRow() {
        const b = this._bridge;
        if (!b) {
            return html`<div class="bridge-status"><span class="bridge-dot"></span><span>status unknown</span></div>`;
        }
        if (!b.uri) {
            return html`<div class="bridge-status"><span class="bridge-dot"></span><span>no broker connection configured — deploy to connect</span></div>`;
        }
        return html`
            <div class="bridge-status">
                <span class="bridge-dot ${b.connected ? 'ok' : 'err'}"></span>
                <span>${b.connected ? 'connected' : 'not connected'}</span>
                <span class="uri" title="${b.uri}">${b.uri}</span>
            </div>
            ${!b.connected && b.lastError ? html`
                <div class="bridge-error">${b.lastError.message}</div>
            ` : ''}
        `;
    }

    // One mTLS cert row (type 'cert' | 'key'): status badge + upload/paste/remove.
    _mtlsRow(type, label, accept) {
        const present = this._certStatus?.[type];
        return html`
            <div class="cert-info-row">
                <span style="font-size:13px;color:var(--feezal-color,#333)">${label}</span>
                ${present ? html`
                    <span class="cert-badge-ok">✓</span>
                    <button class="cert-remove-btn" title="Remove ${label.toLowerCase()}"
                        @click="${() => this._removeCert(type)}">
                        ✕
                    </button>
                ` : html`
                    <span class="cert-badge-none">none</span>
                    <sl-button size="small" ?loading="${this._certBusy}"
                        @click="${() => this.renderRoot.querySelector(`#${type}-file-input`).click()}">
                        Upload
                    </sl-button>
                    <sl-button size="small" variant="text"
                        @click="${() => { this._pasteFor = this._pasteFor === type ? null : type; }}">
                        ${this._pasteFor === type ? 'Cancel' : 'Paste'}
                    </sl-button>
                `}
            </div>
            <input id="${type}-file-input" type="file" accept="${accept}"
                @change="${e => this._handleFileUpload(e, type)}">
        `;
    }

    // Shared PEM paste area — open for at most one cert type at a time.
    _pasteArea(type) {
        if (this._pasteFor !== type) return '';
        return html`
            <sl-textarea size="small" rows="5"
                placeholder="-----BEGIN ...-----&#10;..."
                .value="${this._pemText}"
                @sl-input="${e => this._pemText = e.target.value}">
            </sl-textarea>
            <div class="cert-save-row">
                <sl-button size="small" variant="primary"
                    ?disabled="${!this._pemText.includes('-----BEGIN ')}"
                    ?loading="${this._certBusy}"
                    @click="${() => this._uploadPem(this._pemText, type)}">
                    Save
                </sl-button>
            </div>
        `;
    }

    render() {
        const c = this.connection;
        const s = this.site;
        const isTls = c._protocol === 'mqtts' || c._protocol === 'wss';
        const isTcp = c._protocol === 'mqtt' || c._protocol === 'mqtts';
        const hasCa = this._certStatus?.ca;
        return html`
            <sl-tab-group @sl-tab-show="${e => {
                // N24: opening the Clients tab re-checks the site topic (it may
                // have changed since the panel attached its wildcard subscription).
                if (e.detail.name === 'clients') {
                    this.renderRoot.querySelector('feezal-sidebar-clients')?.activate?.();
                }
                // A28: opening the Security tab refreshes the violation list.
                if (e.detail.name === 'security') this._loadViolations();
            }}">
                <sl-tab slot="nav" panel="connection">Connection</sl-tab>
                <sl-tab slot="nav" panel="site">Site</sl-tab>
                <sl-tab slot="nav" panel="viewer">Viewer</sl-tab>
                <sl-tab slot="nav" panel="security">Security</sl-tab>
                <sl-tab slot="nav" panel="clients">Clients</sl-tab>

                <sl-tab-panel name="connection">
                    <div class="section-label">Server connection</div>
                    ${this._bridgeStatusRow()}

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
                        <sl-input id="conn-host" label="Host" size="small" placeholder="localhost"
                            .value="${c._host || ''}"
                            @sl-input="${e => { this.connection = {...this.connection, _host: e.target.value}; }}"
                            @sl-change="${e => { this.connection = {...this.connection, _host: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                        </sl-input>
                        <sl-input class="port" label="Port" size="small" type="number" placeholder="1883"
                            .value="${c._port || ''}"
                            @sl-input="${e => { this.connection = {...this.connection, _port: e.target.value}; }}"
                            @sl-change="${e => { this.connection = {...this.connection, _port: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                        </sl-input>
                    </div>
                    <sl-select label="MQTT version" size="small"
                        .value="${String(c.protocolVersion || 4)}"
                        @sl-change="${e => this._setConn('protocolVersion', Number(e.target.value))}">
                        <sl-option value="4">3.1.1</sl-option>
                        <sl-option value="5">5.0</sl-option>
                    </sl-select>

                    <div class="section-label">Authentication</div>
                    <sl-input label="Username" size="small" placeholder="(none)"
                        .value="${c._username || ''}"
                        @sl-input="${e => { this.connection = {...this.connection, _username: e.target.value}; }}"
                        @sl-change="${e => { this.connection = {...this.connection, _username: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                    </sl-input>
                    <sl-input label="Password" size="small" type="password" placeholder="(none)"
                        .value="${c._password || ''}"
                        @sl-input="${e => { this.connection = {...this.connection, _password: e.target.value}; }}"
                        @sl-change="${e => { this.connection = {...this.connection, _password: e.target.value}; this._buildUri(); this._applyConnection(); feezal.app.change(true); }}">
                    </sl-input>

                    <!-- U43: deploy surfaced where the change was made; enabled
                         only while the broker settings differ from the deployed
                         ones ("you have unapplied changes here"). -->
                    <sl-button id="btn-apply-connection" size="small" style="margin-top:8px"
                        variant="${this._connDirty ? 'primary' : 'default'}"
                        ?disabled="${!this._connDirty || feezal.app?.deploying}"
                        @click="${this._applyConnSettings}">
                        Apply connection settings
                    </sl-button>
                    ${this._connDirty ? html`
                        <div class="pwa-hint">Broker settings changed — apply to deploy them
                        (same action as Deploy; connected viewers reload).</div>` : ''}

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
                                    @click="${() => { this._pasteFor = this._pasteFor === 'ca' ? null : 'ca'; }}">
                                    ${this._pasteFor === 'ca' ? 'Cancel' : 'Paste PEM'}
                                </sl-button>
                            </div>
                            <input id="ca-file-input" type="file" accept=".pem,.crt,.cer,.ca"
                                @change="${e => this._handleFileUpload(e, 'ca')}">
                        `}
                        ${this._pasteArea('ca')}
                        <div class="pwa-hint">
                            Trusts a self-signed / private CA for <strong>server-side</strong>
                            connections (editor, bridge). Direct browser viewers and static
                            exports use the device's own certificate store instead — see
                            "TLS and self-signed brokers" in the user guide.
                        </div>

                        <div class="section-label">Client certificate (mTLS)</div>
                        ${this._mtlsRow('cert', 'Certificate', '.pem,.crt,.cer')}
                        ${this._pasteArea('cert')}
                        ${this._mtlsRow('key', 'Private key', '.pem,.key')}
                        ${this._pasteArea('key')}
                        <div class="pwa-hint">
                            For brokers requiring mutual TLS. Used by server-side connections
                            only — the private key never leaves the server. Direct viewers and
                            exports need the certificate in the device's OS store (exports
                            include a TLS-SETUP.md with instructions).
                        </div>
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

                    <div class="section-label">Progressive Web App</div>
                    <sl-switch id="pwa-switch" size="small" ?checked="${this.pwa}"
                        @sl-change="${e => this._setPwa(e.target.checked)}">
                        Enable PWA (installable app)
                    </sl-switch>
                    <div class="pwa-hint">
                        Adds a web-app manifest and service worker to the viewer and the
                        export, so the dashboard can be installed to the home screen.
                    </div>
                    ${this.pwa ? html`
                        <div class="pwa-icon-row">
                            <img class="pwa-icon-preview" alt="app icon"
                                src="/viewer/${encodeURIComponent(feezal.siteName)}/icons/icon-192.png?v=${this._pwaIconTs}">
                            <div class="pwa-icon-meta">
                                <div>${this._pwaIcons?.custom ? 'Custom icon' : 'Default feezal icon'}</div>
                                <div class="pwa-icon-actions">
                                    <sl-button size="small" @click="${this._pickIconFile}">Upload…</sl-button>
                                    ${this._pwaIcons?.custom ? html`
                                        <sl-button size="small" @click="${this._regenerateIcon}">Adjust</sl-button>
                                        <sl-button size="small" variant="text" @click="${this._resetIcon}">Reset</sl-button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <input id="pwa-icon-file" type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            @change="${this._onIconFile}">
                    ` : ''}

                    <div class="section-label">Mobile app</div>
                    <sl-input label="App name" size="small" placeholder="${feezal.siteName}"
                        .value="${this.app?.name || ''}"
                        @sl-change="${e => this._setApp('name', e.target.value)}">
                    </sl-input>
                    <sl-input label="App ID" size="small" placeholder="io.feezal.${feezal.siteName}"
                        help-text="Reverse-DNS identifier used by Android/iOS"
                        .value="${this.app?.id || ''}"
                        @sl-change="${e => this._setApp('id', e.target.value)}">
                    </sl-input>
                    <div class="pwa-hint">
                        Export an Android/iOS Capacitor project — built on your own
                        machine, installed without an app store.
                    </div>
                    <sl-button size="small" style="margin-top:8px"
                        @click="${() => feezal.app._openCapacitorDialog()}">
                        Export project…
                    </sl-button>
                </sl-tab-panel>

                <sl-tab-panel name="viewer">
                    <div class="section-label">Viewer connection mode</div>
                    <sl-switch id="via-server-switch" size="small"
                        ?checked="${isTcp || c.viaServer === true}"
                        ?disabled="${isTcp}"
                        @sl-change="${e => this._setConn('viaServer', e.target.checked)}">
                        Connect via server
                    </sl-switch>
                    <div class="pwa-hint">
                        ${isTcp || c.viaServer === true ? html`
                            <strong>Bridge Mode:</strong> The viewer connects only to the
                            feezal server
                            ${isTcp ? html`<br><em>mqtt:// and mqtts:// cannot be opened from
                            a browser, so the server connection is required.</em>` : ''}
                        ` : html`
                            <strong>Direct mode:</strong> the viewer connects to the broker
                            itself — the broker URL <em>and credentials</em> are embedded in
                            the viewer page source, readable by anyone who can open the
                            viewer. Static exports are always direct, but never contain
                            credentials — they prompt for them at runtime.
                        `}
                    </div>

                    <div class="section-label">Deploy</div>
                    <sl-switch id="auto-reload-switch" size="small" ?checked="${s.autoReload !== 'off'}"
                        @sl-change="${e => this._setSite('autoReload', e.target.checked ? '' : 'off')}">
                        Reload viewers on deploy
                    </sl-switch>
                    <div class="pwa-hint">
                        After a deploy, all connected viewers of this site reload
                        automatically and show the new dashboard — via the server
                        connection, plus the site's <code>&lt;subscribe&gt;/reload</code>
                        control topic when wired. The editor never reloads.
                    </div>

                    <div class="section-label">Bandwidth</div>
                    <sl-switch id="pause-switch" size="small" ?checked="${s.pauseHiddenSubscriptions === true}"
                        @sl-change="${e => this._setSite('pauseHiddenSubscriptions', e.target.checked)}">
                        Pause hidden views' subscriptions
                    </sl-switch>
                    <div class="pwa-hint">
                        N37: hidden views unsubscribe their MQTT topics after the
                        grace period below and rewire instantly when shown again
                        (retained values repaint from the cache). Per-view
                        override: the view's <code>pause-subscriptions</code>
                        attribute (<code>inherit · always · never</code> —
                        <code>never</code> for views with non-retained data).
                        Viewer only; the editor stays fully subscribed.
                    </div>
                    <sl-input id="pause-grace" size="small" type="number" min="0" autocomplete="off"
                        label="Pause grace period (seconds)" placeholder="30"
                        value="${s.pauseGraceSeconds || ''}"
                        @sl-change="${e => this._setSite('pauseGraceSeconds', e.target.value)}"></sl-input>

                    <div class="section-label">Viewer presence</div>
                    <sl-switch id="presence-switch" size="small" ?checked="${s.presence !== 'off'}"
                        @sl-change="${e => this._setSite('presence', e.target.checked ? '' : 'off')}">
                        Announce connected viewers
                    </sl-switch>
                    ${s.presence !== 'off' ? html`
                        <sl-switch id="presence-toasts-switch" size="small" ?checked="${s.presenceToasts !== 'off'}"
                            @sl-change="${e => this._setSite('presenceToasts', e.target.checked ? '' : 'off')}">
                            Show connection toasts
                        </sl-switch>
                        <div class="pwa-hint">
                            U48: off silences the transient <code>Connected as "…"</code> /
                            renamed pop-ups on every viewer load (handy on a wall panel).
                            Presence and per-client commands keep working; the sticky
                            "already online in another browser" warning still shows.
                        </div>
                    ` : ''}
                    <div class="pwa-hint">
                        Each viewer publishes retained status JSON (client id, current
                        view, connected-since, user agent) to
                        <code>&lt;publish&gt;/clients/&lt;id&gt;/status</code> and obeys
                        per-client commands (<code>view · reload · theme · playlist ·
                        addclass · removeclass · rename</code>) under
                        <code>&lt;subscribe&gt;/clients/&lt;id&gt;/…</code>.
                        Requires the Publish Topic; without a Subscribe Topic viewers
                        announce themselves but take no commands. The status sits
                        retained on the broker while the viewer is online — turn off
                        to publish nothing. See the Clients sidebar for the live list.
                    </div>

                    <div class="section-label">View playlist</div>
                    <sl-switch id="playlist-switch" size="small" ?checked="${s.playlistEnabled === true}"
                        @sl-change="${e => this._setSite('playlistEnabled', e.target.checked)}">
                        Rotate views (signage mode)
                    </sl-switch>
                    <div class="pwa-hint">
                        Cycles through the listed views in the viewer. Any user
                        interaction pauses the rotation; it resumes after the idle
                        timeout. Control at runtime via
                        <code>&lt;subscribe&gt;/playlist</code>:
                        on · off · pause · next · prev.
                    </div>
                    <sl-input label="Views" size="small"
                        placeholder="overview:30, energy, weather:15"
                        help-text="Comma-separated view names, optional :seconds per view"
                        .value="${s.playlist || ''}"
                        @sl-change="${e => this._setSite('playlist', e.target.value)}">
                    </sl-input>
                    <div class="row">
                        <sl-input label="Dwell (s)" size="small" type="number" placeholder="10"
                            .value="${s.playlistDwell || ''}"
                            @sl-change="${e => this._setSite('playlistDwell', e.target.value)}">
                        </sl-input>
                        <sl-input label="Resume after (s)" size="small" type="number" placeholder="60"
                            .value="${s.playlistResume || ''}"
                            @sl-change="${e => this._setSite('playlistResume', e.target.value)}">
                        </sl-input>
                    </div>
                    <sl-select label="Transition" size="small"
                        .value="${s.playlistTransition || 'none'}"
                        @sl-change="${e => this._setSite('playlistTransition', e.target.value === 'none' ? '' : e.target.value)}">
                        <sl-option value="none">none</sl-option>
                        <sl-option value="fade">fade</sl-option>
                    </sl-select>
                </sl-tab-panel>

                <sl-tab-panel name="security">
                    ${this._renderSecurity()}
                </sl-tab-panel>

                <sl-tab-panel name="clients">
                    <feezal-sidebar-clients></feezal-sidebar-clients>
                </sl-tab-panel>
            </sl-tab-group>

            <feezal-pwa-icon-dialog
                @pwa-icons-saved="${() => { this._loadPwaIcons(); if (!this.pwa) this._setPwa(true); }}">
            </feezal-pwa-icon-dialog>

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

    // ── U43: "Apply connection settings" with dirty detection ───────────────

    /** Comparable snapshot of the deploy-relevant connection fields. */
    _connSnapshot() {
        const c = this.connection || {};
        return JSON.stringify({uri: c.uri || '', protocolVersion: c.protocolVersion || 4});
    }

    /**
     * Remember the currently DEPLOYED connection. Called when the site loads
     * (the persisted config arrives) and after every successful deploy, so
     * the Apply button reads as "you have unapplied changes here" and goes
     * quiet the moment they are applied.
     */
    markConnectionDeployed() {
        this._deployedConn = this._connSnapshot();
        this.requestUpdate();
    }

    get _connDirty() {
        // Before the first load snapshot exists, never claim dirtiness.
        return this._deployedConn !== undefined && this._deployedConn !== this._connSnapshot();
    }

    /** U43: deploys the whole site (the same action as Deploy, surfaced where
     * the change was made — one deploy semantics, per the roadmap decision). */
    _applyConnSettings() {
        if (!this._connDirty) return;
        feezal.app._deploy();
    }

    _setSite(key, value) {
        this.site = {...this.site, [key]: value};
        this._applySite();
        feezal.app.change(true);
    }

    // ── A28: per-site CSP (Security tab) ─────────────────────────────────────

    static get CSP_ASPECTS() {
        return [
            {key: 'images',  label: 'Images & cameras',        hint: 'img-src + media-src'},
            {key: 'frames',  label: 'Embedded pages (iframes)', hint: 'frame-src'},
            {key: 'connect', label: 'Network connections',      hint: "connect-src — always includes feezal + your broker"},
        ];
    }

    static get CSP_ADVANCED() {
        return [
            {key: 'scripts', label: 'Scripts', hint: 'script-src'},
            {key: 'styles',  label: 'Styles',  hint: 'style-src'},
            {key: 'fonts',   label: 'Fonts',   hint: 'font-src'},
        ];
    }

    /** directive (from a violation report) → aspect key */
    static cspAspectForDirective(directive) {
        return {
            'img-src': 'images', 'media-src': 'images', 'frame-src': 'frames',
            'connect-src': 'connect', 'script-src': 'scripts',
            'style-src': 'styles', 'font-src': 'fonts',
        }[directive] || null;
    }

    _cspAspect(key) {
        return this.security?.csp?.[key] || {mode: null, hosts: []};
    }

    _setCspAspect(key, patch) {
        const cur = this._cspAspect(key);
        const next = {...cur, ...patch};
        if (!next.mode) return;
        this.security = {
            ...this.security,
            csp: {...(this.security?.csp || {}), [key]: {mode: next.mode, hosts: next.hosts || []}},
        };
        feezal.app.change(true);
    }

    /** Origin validation mirroring the server builder (paths rejected). */
    _validOrigin(v) {
        return /^(?:(?:https?|wss?):\/\/)?(?:\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i.test((v || '').trim());
    }

    _addCspHost(key, input) {
        const v = (input.value || '').trim();
        if (!v) return;
        if (!this._validOrigin(v)) {
            input.setCustomValidity?.('scheme://host[:port] or *.example.com — no paths');
            input.reportValidity?.();
            return;
        }
        const cur = this._cspAspect(key);
        if (!cur.hosts.includes(v)) {
            this._setCspAspect(key, {mode: 'hosts', hosts: [...cur.hosts, v]});
        }
        input.value = '';
    }

    _removeCspHost(key, host) {
        const cur = this._cspAspect(key);
        this._setCspAspect(key, {hosts: cur.hosts.filter(h => h !== host)});
    }

    async _loadViolations() {
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/csp-violations`);
            this._violations = res.ok ? await res.json() : [];
        } catch {
            this._violations = [];
        }
    }

    /** A28: external hosts already used in the site markup → suggestion chips. */
    _scanSiteHosts() {
        if (!feezal.site) return [];
        const found = new Map();   // host → aspect guess
        for (const el of feezal.site.querySelectorAll('*')) {
            for (const attr of el.attributes || []) {
                const m = /^https?:\/\/([^/:?#]+(?::\d+)?)/i.exec(attr.value);
                if (!m) continue;
                const aspect = el.localName.includes('iframe') ? 'frames' : 'images';
                if (!found.has(m[1])) found.set(m[1], aspect);
            }
        }
        return [...found.entries()].map(([host, aspect]) => ({host, aspect}));
    }

    _renderCspRow({key, label, hint}, warning = false) {
        const a = this._cspAspect(key);
        const mode = a.mode || 'all';
        const brokerChip = key === 'connect' && this.connection?.uri && /^wss?:/.test(this.connection.uri)
            ? this.connection.uri.replace(/^(wss?:\/\/[^/:?#]+(?::\d+)?).*$/i, '$1') : null;
        return html`
            <div class="sec-row">
                <div class="sec-row-head">
                    <span class="sec-label">${label}</span>
                    <span class="sec-hint">${hint}</span>
                </div>
                <sl-select size="small" value="${mode}"
                    @sl-change="${e => this._setCspAspect(key, {mode: e.target.value})}">
                    <sl-option value="all">Open (any host)</sl-option>
                    <sl-option value="self">feezal only ('self')</sl-option>
                    <sl-option value="hosts">Selected hosts</sl-option>
                </sl-select>
                ${warning && mode !== 'self' && (key === 'scripts' || key === 'styles') ? html`
                    <div class="sec-warning">⚠ Loosening ${label.toLowerCase()} beyond feezal reverts the
                    no-third-party guarantee for this site — scripts from these origins can read your
                    dashboard and broker traffic.</div>` : ''}
                ${mode === 'hosts' ? html`
                    <div class="sec-chips">
                        ${brokerChip ? html`<span class="sec-chip locked" title="Your broker — always allowed">🔒 ${brokerChip}</span>` : ''}
                        ${a.hosts.map(h => html`
                            <span class="sec-chip">${h}
                                <button class="sec-chip-x" @click="${() => this._removeCspHost(key, h)}">×</button>
                            </span>`)}
                        <sl-input size="small" class="sec-add" placeholder="host, *.example.com or https://host"
                            @keydown="${e => { if (e.key === 'Enter') this._addCspHost(key, e.target); }}"
                            @sl-change="${e => this._addCspHost(key, e.target)}"></sl-input>
                    </div>` : ''}
            </div>`;
    }

    _renderSecurity() {
        const violations = this._violations || [];
        const scanned = this._scanSiteHosts()
            .filter(s => !this._cspAspect(s.aspect).hosts?.includes(s.host));
        return html`
            <div class="section">
                <div class="section-label">Content-Security-Policy (per site)</div>
                <div class="pwa-hint">
                    A28: controls which hosts this site's <b>viewer</b> may load
                    content from. Defaults keep today's behaviour (code locked to
                    feezal, content open). Changes apply on deploy. The editor's
                    policy stays fixed.
                </div>
                ${FeezalSidebarViewer.CSP_ASPECTS.map(a => this._renderCspRow(a))}
                <details ?open="${this._secAdvanced}" @toggle="${e => { this._secAdvanced = e.target.open; }}">
                    <summary class="sec-label">Advanced — Scripts / Styles / Fonts</summary>
                    ${FeezalSidebarViewer.CSP_ADVANCED.map(a => this._renderCspRow(a, true))}
                </details>

                ${scanned.length ? html`
                    <div class="section-label">Found in your dashboard</div>
                    <div class="sec-chips">
                        ${scanned.map(s => html`
                            <button class="sec-chip suggest"
                                title="Used by an element on this site — allow for ${s.aspect}"
                                @click="${() => this._setCspAspect(s.aspect, {mode: 'hosts',
                                    hosts: [...this._cspAspect(s.aspect).hosts, s.host]})}">
                                + ${s.host}</button>`)}
                    </div>` : ''}

                <div class="section-label">Recent violations
                    <sl-button size="small" @click="${this._loadViolations}">Refresh</sl-button>
                </div>
                ${violations.length === 0 ? html`<div class="pwa-hint">No blocked requests reported.</div>` : ''}
                ${violations.map(v => {
                    const aspect = FeezalSidebarViewer.cspAspectForDirective(v.directive);
                    return html`
                        <div class="sec-violation">
                            <span class="sec-vhost">blocked: ${v.host}</span>
                            <span class="sec-hint">${v.directive} · ×${v.count}</span>
                            ${aspect && this._validOrigin(v.host) ? html`
                                <sl-button size="small" @click="${() => this._setCspAspect(aspect, {mode: 'hosts',
                                    hosts: [...this._cspAspect(aspect).hosts, v.host]})}">Allow</sl-button>` : ''}
                        </div>`;
                })}
                <div class="pwa-hint">Changes apply on the next deploy (connected viewers reload automatically).</div>
            </div>`;
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
                } else {
                    // Clearing a field removes the attribute — otherwise a stale
                    // value would survive in the serialized site HTML.
                    feezal.site.removeAttribute(attr);
                }
            });
        }
    }
}

window.customElements.define('feezal-sidebar-viewer', FeezalSidebarViewer);
