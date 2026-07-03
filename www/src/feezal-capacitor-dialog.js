/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';

/**
 * A9 Tier 2a — pre-export dialog for the Capacitor mobile-app project.
 *
 * App name + app id (auto-derived from the name until edited), the icon that
 * will be used, and a broker-reachability warning when the connection points
 * at localhost. Export downloads the project ZIP and persists the values as
 * viewer.app (saved with the next deploy).
 */

/** Mirror of the server's deriveAppId — keeps the field live while typing. */
export function deriveAppId(name) {
    let slug = String(name).toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '');
    if (!slug) slug = 'app';
    if (/^[0-9]/.test(slug)) slug = 'app' + slug;
    return 'io.feezal.' + slug;
}

export function isLocalhostUri(uri) {
    return /^[a-z+]+:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(String(uri || ''));
}

class FeezalCapacitorDialog extends LitElement {
    static properties = {
        _appName: {state: true},
        _appId:   {state: true},
        _idEdited: {state: true},
        _uri:     {state: true},
        _canBuild: {state: true},   // A9 Tier 2b: server-side APK builds available
        _build:   {state: true},    // null | {jobId, status, log: []}
    };

    static styles = css`
        sl-dialog { --width: 420px; --sl-z-index-dialog: 20002; }
        sl-input { margin-top: 10px; }
        /* Same idiom as the sidebars: pin the input parts to the feezal vars so
           Shoelace's (unthemed) hover/focus state tokens never flash white. */
        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-input::part(base):focus-within { border-color: var(--feezal-border, #ccc); box-shadow: none; }
        /* Neutral buttons: house hover (--feezal-btn-hover, set in dark mode by
           feezal-app-editor) instead of Shoelace's primary tint, which stays
           light regardless of dark mode. Fallbacks mirror the Shoelace light
           hover, so light mode looks exactly like every other sl-button.
           (No :host-context() here — Chromium dropped support for it. And
           [variant="default"], not :not([variant]) — Shoelace reflects the
           default variant onto the attribute.) */
        sl-button[variant='default']::part(base):hover {
            background-color: var(--feezal-btn-hover, var(--sl-color-primary-50, #f0f9ff));
            border-color: var(--feezal-btn-hover-border, var(--sl-color-primary-300, #7dd3fc));
            color: var(--feezal-btn-hover-color, var(--sl-color-primary-700, #0369a1));
        }
        .icon-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
        .icon-row img { width: 44px; height: 44px; border-radius: 9px; border: 1px solid var(--feezal-border, #ddd); background: #fff; }
        .icon-row .hint { font-size: 12px; color: var(--feezal-color, #666); line-height: 1.4; }
        .warn {
            margin-top: 12px; padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5;
            background: rgba(180, 83, 9, 0.12); border: 1px solid rgba(180, 83, 9, 0.4);
            color: var(--sl-color-warning-700, #b45309);
        }
        .note { margin-top: 12px; font-size: 11px; color: var(--feezal-color, #888); line-height: 1.5; }
        .build-log {
            height: 280px; overflow: auto; margin: 0; padding: 8px;
            background: #14161a; color: #cfd8dc; border-radius: 6px;
            font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-all;
        }
    `;

    constructor() {
        super();
        this._appName = '';
        this._appId = '';
        this._idEdited = false;
        this._uri = '';
        this._canBuild = false;
        this._build = null;
        this._events = null;
    }

    /** Open with the persisted values (viewer.app) from the settings sidebar. */
    open() {
        const sidebar = feezal.app?.shadowRoot?.querySelector('feezal-sidebar-viewer');
        const stored = (sidebar && sidebar.app) || {};
        this._appName = stored.name || feezal.siteName;
        this._appId = stored.id || deriveAppId(this._appName);
        this._idEdited = Boolean(stored.id);
        this._uri = (sidebar && sidebar.connection && sidebar.connection.uri) || '';
        this._build = null;
        fetch('/api/server/capabilities')
            .then(r => r.json())
            .then(caps => { this._canBuild = Boolean(caps.dockerBuilds); })
            .catch(() => { this._canBuild = false; });
        this.renderRoot.querySelector('sl-dialog').show();
    }

    _onName(value) {
        this._appName = value;
        if (!this._idEdited) this._appId = deriveAppId(value);
    }

    _persistApp() {
        // persist for re-exports (saved as viewer.app with the next deploy)
        const sidebar = feezal.app?.shadowRoot?.querySelector('feezal-sidebar-viewer');
        if (sidebar) {
            sidebar.app = {name: this._appName, id: this._appId};
            feezal.app.change(true);
        }
    }

    _export() {
        this._persistApp();
        const url = `/api/sites/${encodeURIComponent(feezal.siteName)}/export-capacitor` +
            `?appName=${encodeURIComponent(this._appName)}&appId=${encodeURIComponent(this._appId)}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.append(a);
        a.click();
        a.remove();
        this.renderRoot.querySelector('sl-dialog').hide();
    }

    /** A9 Tier 2b: run the build in a Docker container on the server. */
    async _buildApk() {
        this._persistApp();
        this._build = {jobId: null, status: 'starting', log: []};
        try {
            const res = await fetch(
                `/api/sites/${encodeURIComponent(feezal.siteName)}/build-apk` +
                `?appName=${encodeURIComponent(this._appName)}&appId=${encodeURIComponent(this._appId)}`,
                {method: 'POST'});
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'build failed to start');
            this._build = {jobId: data.jobId, status: 'running', log: []};
            this._events = new EventSource(`/api/build-apk/${data.jobId}/events`);
            this._events.addEventListener('log', e => {
                this._build.log.push(JSON.parse(e.data).line);
                this.requestUpdate();
                this.updateComplete.then(() => {
                    const pre = this.renderRoot.querySelector('.build-log');
                    if (pre) pre.scrollTop = pre.scrollHeight;
                });
            });
            this._events.addEventListener('done', e => {
                const {status, error} = JSON.parse(e.data);
                this._build = {...this._build, status, error};
                this._events.close();
                this._events = null;
            });
            this._events.onerror = () => {
                if (this._build?.status === 'running') {
                    this._build = {...this._build, status: 'error', error: 'connection to the build lost'};
                }
                this._events?.close();
                this._events = null;
            };
        } catch (err) {
            this._build = {jobId: null, status: 'error', log: this._build?.log || [], error: err.message};
        }
    }

    async _cancelBuild() {
        if (this._build?.jobId) {
            await fetch(`/api/build-apk/${this._build.jobId}`, {method: 'DELETE'}).catch(() => {});
        }
    }

    _closeBuild() {
        this._build = null;
        this._events?.close();
        this._events = null;
    }

    render() {
        if (this._build) return this._renderBuild();
        return html`
            <sl-dialog label="Export mobile app project">
                <sl-input label="App name" size="small"
                    .value="${this._appName}"
                    @sl-input="${e => this._onName(e.target.value)}">
                </sl-input>
                <sl-input label="App ID" size="small" help-text="Reverse-DNS, e.g. io.feezal.mysite"
                    .value="${this._appId}"
                    @sl-input="${e => { this._appId = e.target.value; this._idEdited = true; }}">
                </sl-input>
                <div class="icon-row">
                    <img src="/viewer/${encodeURIComponent(feezal.siteName)}/icons/icon-512.png?v=${Date.now()}"
                        alt="app icon">
                    <div class="hint">This icon ships as <code>resources/icon.png</code> —
                        <code>npm run assets</code> generates all native icons from it.
                        Set a custom one in Site Settings → Progressive Web App.</div>
                </div>
                ${isLocalhostUri(this._uri) ? html`
                    <div class="warn">
                        ⚠️ The broker connection points at <code>${this._uri}</code> —
                        from a phone, <code>localhost</code> is the phone itself. Set a
                        network-reachable broker address in Site Settings before building,
                        or the app will show no live values.
                    </div>` : ''}
                <div class="note">
                    The ZIP contains a Capacitor project with a step-by-step README:
                    unzip, <code>npm install</code>, <code>npm run android</code> (or
                    <code>ios</code>) — no app store required.
                </div>
                <sl-button slot="footer" @click="${() => this.renderRoot.querySelector('sl-dialog').hide()}">Cancel</sl-button>
                ${this._canBuild ? html`
                    <sl-button slot="footer"
                        ?disabled="${!this._appName.trim() || !this._appId.trim()}"
                        @click="${this._buildApk}">Build APK on server</sl-button>
                ` : ''}
                <sl-button slot="footer" variant="primary"
                    ?disabled="${!this._appName.trim() || !this._appId.trim()}"
                    @click="${this._export}">Export project</sl-button>
            </sl-dialog>
        `;
    }

    _renderBuild() {
        const b = this._build;
        return html`
            <sl-dialog label="Building APK — ${this._appName}"
                @sl-request-close="${e => { if (b.status === 'running') e.preventDefault(); }}">
                <pre class="build-log">${b.log.join('\n')}</pre>
                ${b.status === 'error' ? html`<div class="warn">Build failed: ${b.error}</div>` : ''}
                ${b.status === 'cancelled' ? html`<div class="warn">Build cancelled.</div>` : ''}
                ${b.status === 'success' ? html`<div class="note">✅ Build finished — download the APK and sideload it (see the exported project's README for install steps).</div>` : ''}
                ${b.status === 'running'
                    ? html`<sl-button slot="footer" @click="${this._cancelBuild}">Cancel build</sl-button>`
                    : html`<sl-button slot="footer" @click="${this._closeBuild}">Back</sl-button>`}
                ${b.status === 'success' ? html`
                    <sl-button slot="footer" variant="primary"
                        href="/api/build-apk/${b.jobId}/result" download>
                        Download APK
                    </sl-button>` : ''}
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-capacitor-dialog', FeezalCapacitorDialog);
export {FeezalCapacitorDialog};
