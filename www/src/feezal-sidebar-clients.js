/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

/**
 * feezal-sidebar-clients (N24) — live list of connected viewers.
 *
 * Purely an MQTT client of the presence convention: subscribes
 * `<publish>/clients/+/status` (retained status JSON per viewer, cleared on
 * disconnect) and publishes per-client commands to
 * `<subscribe>/clients/<id>/<cmd>` — anything this panel can do, an
 * automation can do too.
 */
class FeezalSidebarClients extends LitElement {
    static properties = {
        _clients: {state: true},   // id → status object
        _renames: {state: true},   // id → pending rename input value
        _topic:   {state: true},   // subscribed wildcard (for the empty-state hint)
        _cmdBase: {state: true},   // site subscribe topic (command tree; '' = commands unavailable)
    };

    static styles = css`
        :host {
            display: block; height: 100%; padding: 10px; font-size: 12px;
            color: var(--feezal-color, #333); background: var(--feezal-bg, #fff);
            box-sizing: border-box; overflow-y: auto;
        }
        h3 { margin: 2px 0 4px; font-size: 13px; }
        .hint { font-size: 11px; opacity: 0.65; line-height: 1.5; margin-bottom: 10px; }
        .client { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 10px; }
        .head {
            display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #2e7d32; flex: 0 0 auto; }
        .conn { font-weight: 400; font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .meta { font-size: 11px; opacity: 0.7; line-height: 1.5; word-break: break-all; }
        .row { display: flex; gap: 6px; align-items: end; }
        .row > * { flex: 1; min-width: 0; }
        .row sl-button { flex: 0 0 auto; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
    `;

    constructor() {
        super();
        this._clients = {};
        this._renames = {};
        this._topic = '';
        this._cmdBase = '';
        this._sub = null;
        this._appObserver = null;
        this._siteObserver = null;
        this._observedSite = null;
    }

    connectedCallback() {
        super.connectedCallback();
        // The editor restores the persisted sidebar tab on reload, so this
        // panel can attach BEFORE getSite has built the site DOM — activate()
        // then resolves no topic and the panel stayed dead until a tab
        // switch. feezal.site is a live getter over feezal.app's light DOM:
        // watch feezal.app for the site element (re)appearing.
        this._appObserver = new MutationObserver(() => this.activate());
        if (feezal.app) {
            this._appObserver.observe(feezal.app, {childList: true});
        }

        this.activate();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._appObserver?.disconnect();
        this._appObserver = null;
        this._siteObserver?.disconnect();
        this._siteObserver = null;
        this._observedSite = null;
        if (this._sub) {
            feezal.connection.unsubscribe(this._sub);
            this._sub = null;
        }
    }

    /** (Re)attach the wildcard subscription — called on tab open, when the
     * site appears in feezal.app and when its publish/subscribe topics
     * change. Idempotent for an unchanged topic. */
    activate() {
        const site = feezal.site;
        if (site && this._observedSite !== site) {
            // Rewire live when the site topics change in the settings —
            // re-targeted if the site element itself was replaced.
            this._siteObserver?.disconnect();
            this._siteObserver = new MutationObserver(() => this.activate());
            this._siteObserver.observe(site, {attributes: true, attributeFilter: ['publish', 'subscribe']});
            this._observedSite = site;
        }

        // Status is viewer-PUBLISHED state → lives under the site publish
        // topic; commands go out under the site subscribe topic.
        this._cmdBase = site?.getAttribute?.('subscribe') || '';
        const base = site?.getAttribute?.('publish');
        const topic = base ? `${base}/clients/+/status` : '';
        if (topic === this._topic && this._sub) return;
        console.debug('[feezal-clients] ' + (site
            ? (topic ? 'subscribing ' + topic : 'site has no publish topic — not subscribing')
            : 'site not loaded yet — waiting'));

        if (this._sub) {
            feezal.connection.unsubscribe(this._sub);
            this._sub = null;
        }

        this._clients = {};
        this._topic = topic;
        if (!topic) return;

        this._sub = feezal.connection.sub(topic, msg => {
            const id = String(msg.topic).slice(base.length + '/clients/'.length, -'/status'.length);
            if (!id || id.includes('/')) return;
            const next = {...this._clients};
            const p = msg.payload;
            if (p && typeof p === 'object' && p.connectedSince) {
                next[id] = p;
            } else {
                delete next[id];   // cleared retained status → offline
            }

            this._clients = next;
        });
    }

    _pub(id, cmd, payload) {
        if (!this._cmdBase) return;
        feezal.connection.pub(`${this._cmdBase}/clients/${id}/${cmd}`, payload);
    }

    _viewNames() {
        return feezal.views ? [...feezal.views].map(v => v.getAttribute('name')).filter(Boolean) : [];
    }

    _themeNames() {
        return (feezal.themes || []).map(t => t.replace(/^@[^/]+\//, ''));
    }

    _since(iso) {
        if (!iso) return '';
        const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min`;
        return `${Math.floor(mins / 60)} h ${mins % 60} min`;
    }

    render() {
        const ids = Object.keys(this._clients).sort();
        return html`
            <h3>Clients</h3>
            <div class="hint">
                Connected viewers announcing themselves under
                <code>${this._topic || '— set a site Publish Topic first —'}</code>.
                Actions publish to the client's command subtree
                (<code>${this._cmdBase ? this._cmdBase + '/clients/…' : '— set a site Subscribe Topic to enable them —'}</code>)
                — automations can do the same.
            </div>
            ${ids.length === 0 ? html`<div class="hint">No viewers online.</div>` : ''}
            ${ids.map(id => {
                const c = this._clients[id];
                return html`
                    <div class="client">
                        <div class="head">
                            <span class="dot"></span>
                            <span>${id}</span>
                            <span class="conn">${c.connection || ''}</span>
                        </div>
                        <div class="body">
                            <div class="meta">
                                view: <b>${c.view || '—'}</b> · online ${this._since(c.connectedSince)}
                                ${c.userAgent ? html`<br>${c.userAgent}` : ''}
                            </div>
                            <div class="row">
                                <div class="field">
                                    <label>Switch view</label>
                                    <sl-select size="small" hoist placeholder="view…" .value="${c.view || ''}" ?disabled="${!this._cmdBase}"
                                        @sl-change="${e => { if (e.target.value && e.target.value !== c.view) this._pub(id, 'view', e.target.value); }}">
                                        ${this._viewNames().map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                                    </sl-select>
                                </div>
                                <div class="field">
                                    <label>Set theme</label>
                                    <sl-select size="small" hoist placeholder="theme…" value="" ?disabled="${!this._cmdBase}"
                                        @sl-change="${e => { if (e.target.value) { this._pub(id, 'theme', e.target.value); e.target.value = ''; } }}">
                                        ${this._themeNames().map(t => html`<sl-option value="${t}">${t.replace(/^feezal-theme-/, '')}</sl-option>`)}
                                    </sl-select>
                                </div>
                                <sl-button size="small" title="Reload this viewer" ?disabled="${!this._cmdBase}"
                                    @click="${() => this._pub(id, 'reload', '1')}">Reload</sl-button>
                            </div>
                            <div class="row">
                                <sl-input size="small" placeholder="new id (e.g. hallway-panel)" ?disabled="${!this._cmdBase}"
                                    .value="${this._renames[id] || ''}"
                                    @sl-input="${e => { this._renames = {...this._renames, [id]: e.target.value}; }}">
                                </sl-input>
                                <sl-button size="small" ?disabled="${!this._cmdBase || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(this._renames[id] || '')}"
                                    @click="${() => { this._pub(id, 'rename', this._renames[id]); this._renames = {...this._renames, [id]: ''}; }}">
                                    Rename
                                </sl-button>
                            </div>
                        </div>
                    </div>`;
            })}
        `;
    }
}

window.customElements.define('feezal-sidebar-clients', FeezalSidebarClients);
