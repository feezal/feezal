/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

/**
 * feezal-element-layout-app (E47)
 *
 * A full-bleed app shell: a top app bar + a collapsible left navigation drawer,
 * whose content area embeds a named view and swaps it as the user picks drawer
 * entries (the bar/drawer chrome persists). Modern MD3/Lit replacement for the
 * legacy paper-app-layout (removed), in the Layout category. The top bar can be
 * hidden entirely (hide-header) — a floating hamburger keeps the overlay drawer
 * reachable.
 *
 * Embed & swap: in the viewer the active entry's <feezal-view> is cloned into
 * the content pane (inactive display:none stripped); in the editor a placeholder
 * is shown (never a live nested render → no recursion). The drawer is persistent
 * above `breakpoint` (tracked by the element's OWN width via ResizeObserver, so
 * it's correct at any editor preview size) and an overlay + hamburger below it.
 */
class FeezalElementLayoutApp extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'App', category: 'Layout', color: '#4a7080', icon: 'space_dashboard'},
            description: 'A full-bleed app shell: top bar + navigation drawer whose entries swap the embedded ' +
                'content view. Drawer is persistent when wide, an overlay + hamburger when narrow. Manage entries, ' +
                'title and actions in the inspector.',
            inspector: 'feezal-element-layout-app-inspector',
            attributes: [
                {name: 'items', type: 'json', default: '[]', help: 'Drawer entries [{label, icon, view}] (managed in the inspector).'},
                {name: 'title', type: 'string', default: '', help: 'Top-bar title.'},
                {name: 'hide-header', type: 'boolean', default: false,
                    help: 'Hide the top app bar (title + actions). When the drawer is in overlay mode a floating hamburger button appears over the content instead.'},
                {name: 'subscribe-title', type: 'string', help: 'Optional — drive the title from an MQTT topic.'},
                {name: 'active-view', type: 'string', help: 'Initially selected content view (defaults to the first entry).'},
                {name: 'breakpoint', type: 'number', default: 768, help: 'Element width below which the drawer becomes an overlay.'},
                {name: 'drawer-persistent', type: 'boolean', default: true, help: 'If off, the drawer is always an overlay (hamburger at all sizes).'},
                {name: 'entry-style', type: 'select', options: ['pill', 'list'], default: 'pill',
                    help: 'Drawer entry look: "pill" = MD3 rounded chips with side inset; "list" = flat edge-to-edge rows, hover/active highlight the full drawer width.'},
                {name: 'actions', type: 'json', default: '[]', help: 'Top-bar action buttons [{icon, publish, payload}] (managed in the inspector).'},
                'subscribe',
                'publish',
            ],
            styles: ['background', 'border'],
            restrict: {move: false, resize: false, minWidth: 240, minHeight: 160},
            defaultStyle: {top: '0px', left: '0px', width: '100%', height: '100%'},
        };
    }

    static properties = {
        items:           {type: String,  reflect: true},
        title:           {type: String,  reflect: true},
        hideHeader:      {type: Boolean, reflect: true, attribute: 'hide-header'},
        subscribeTitle:  {type: String,  reflect: true, attribute: 'subscribe-title'},
        activeView:      {type: String,  reflect: true, attribute: 'active-view'},
        breakpoint:      {type: Number,  reflect: true},
        drawerPersistent:{type: Boolean, reflect: true, attribute: 'drawer-persistent'},
        entryStyle:      {type: String,  reflect: true, attribute: 'entry-style'},
        actions:         {type: String,  reflect: true},
        _active:         {state: true},
        _narrow:         {state: true},
        _drawerOpen:     {state: true},
        _liveTitle:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; container-type: inline-size; }
        .shell { display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box;
            background: var(--feezal-app-drawer-bg, var(--primary-background-color, #fafafa)); }
        .bar {
            flex: 0 0 auto; display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 10px; box-sizing: border-box;
            background: var(--feezal-app-bar-bg, var(--md-sys-color-primary, var(--primary-color, #0284c7)));
            color: var(--feezal-app-bar-color, var(--md-sys-color-on-primary, #fff));
            z-index: 2;
        }
        .bar .title { flex: 1; min-width: 0; font-size: 18px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar .actions { display: flex; gap: 2px; }
        .iconbtn { border: none; background: none; color: inherit; cursor: pointer; width: 40px; height: 40px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .iconbtn:hover { background: rgba(255,255,255,0.16); }
        .iconbtn.dark:hover { background: rgba(0,0,0,0.08); }
        .mi { font-family: 'Material Icons'; font-style: normal; font-weight: normal; font-size: 22px; line-height: 1; }
        .body { flex: 1; min-height: 0; display: flex; position: relative; }
        .drawer {
            flex: 0 0 auto; width: var(--feezal-app-drawer-width, 220px); box-sizing: border-box;
            background: var(--feezal-app-drawer-bg, var(--md-sys-color-surface-container, #f2f3f5));
            color: var(--feezal-app-drawer-color, var(--md-sys-color-on-surface, #222));
            border-right: 1px solid var(--divider-color, rgba(128,128,128,0.2));
            padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
        }
        .entry {
            display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: none; background: none; cursor: pointer;
            color: inherit; font: inherit; text-align: left; border-radius: 24px; width: 100%; box-sizing: border-box;
        }
        .entry:hover { background: rgba(128,128,128,0.12); }
        .entry.active { background: var(--feezal-app-active-indicator, var(--md-sys-color-secondary-container, rgba(2,132,199,0.16)));
            color: var(--feezal-app-active-color, var(--md-sys-color-on-secondary-container, var(--primary-color, #0284c7))); font-weight: 600; }
        .entry .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* entry-style="list": flat edge-to-edge rows — no pill radius, no side
           inset; hover/active highlight the full drawer width. */
        :host([entry-style="list"]) .drawer { padding: 8px 0; gap: 0; }
        :host([entry-style="list"]) .entry { border-radius: 0; padding: 11px 16px; }
        .content { flex: 1; min-width: 0; position: relative; overflow: auto; }
        #content { width: 100%; height: 100%; }
        .ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            color: var(--secondary-text-color, #888); font-size: 13px;
            background-image:
                linear-gradient(45deg, rgba(128,128,128,0.06) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.06) 75%),
                linear-gradient(45deg, rgba(128,128,128,0.06) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.06) 75%);
            background-size: 20px 20px; background-position: 0 0, 10px 10px; }
        .scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.4); z-index: 3; }

        /* hide-header: floating hamburger so the overlay drawer stays reachable */
        .fab-menu {
            position: absolute; top: 10px; left: 10px; z-index: 5;
            width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--feezal-app-bar-bg, var(--md-sys-color-primary, var(--primary-color, #0284c7)));
            color: var(--feezal-app-bar-color, var(--md-sys-color-on-primary, #fff));
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
        }

        /* Narrow: drawer becomes an overlay driven by the hamburger. */
        :host(.narrow) .drawer { position: absolute; top: 0; bottom: 0; left: 0; z-index: 4; transform: translateX(-100%);
            transition: transform 0.2s ease; box-shadow: 2px 0 12px rgba(0,0,0,0.25); }
        :host(.narrow) .drawer.open { transform: translateX(0); }
    `];

    constructor() {
        super();
        this.items = '[]';
        this.title = '';
        this.hideHeader = false;
        this.subscribeTitle = '';
        this.activeView = '';
        this.breakpoint = 768;
        this.drawerPersistent = true;
        this.entryStyle = 'pill';
        this.actions = '[]';
        this._active = '';
        this._narrow = false;
        this._drawerOpen = false;
        this._liveTitle = null;
        this._mounted = undefined;
    }

    _subscribe() {
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) return;
        if (this.subscribeTitle) {
            this.addSubscription(this.subscribeTitle, msg => { this._liveTitle = String(this.getProperty(msg, this.messageProperty) ?? ''); });
        }
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => { const v = String(this.getProperty(msg, this.messageProperty) ?? ''); if (v) this._select(v, false); });
        }
    }

    _entries() {
        try { const r = JSON.parse(this.items || '[]'); return (Array.isArray(r) ? r : []).filter(e => e && e.view); }
        catch { return []; }
    }
    _actions() {
        try { const r = JSON.parse(this.actions || '[]'); return (Array.isArray(r) ? r : []).filter(a => a && a.icon); }
        catch { return []; }
    }

    connectedCallback() {
        super.connectedCallback();
        this._ro = new ResizeObserver(() => {
            const narrow = this.clientWidth > 0 && this.clientWidth < (Number(this.breakpoint) || 768);
            const persistent = this.drawerPersistent !== false;
            const nowNarrow = narrow || !persistent;
            if (nowNarrow !== this._narrow) {
                this._narrow = nowNarrow;
                this.classList.toggle('narrow', nowNarrow);
                if (!nowNarrow) this._drawerOpen = false;
            }
        });
        this._ro.observe(this);
        // N30: register as a site "view router" so the site's active-view
        // contract (URL hash, <publish>/view, inbound <subscribe>/view) covers
        // the sub-view this shell shows. Viewer only — the editor never routes.
        if (!feezal.isEditor) feezal.site?.registerViewRouter?.(this);
    }
    disconnectedCallback() {
        this._ro?.disconnect();
        if (!feezal.isEditor) feezal.site?.unregisterViewRouter?.(this);
        super.disconnectedCallback();
    }

    // ── N30: view-router interface (consumed by feezal-site) ─────────────────
    /** Drawer-entry view names this shell can show. */
    routableViews() { return this._entries().map(e => e.view); }
    /** The sub-view currently embedded, or null. */
    activeEmbedded() { return this._active || null; }
    /** Programmatic route from the site (inbound MQTT / deep-link) — no re-notify. */
    routeToEmbedded(view) {
        if (!view || !this.routableViews().includes(view)) return;
        this._active = view;
        if (this._narrow) this._drawerOpen = false;
        this._embed(true);
    }

    firstUpdated() {
        this._initialized = true;
        // Keep an _active already set by an N30 deep-link route (registerViewRouter
        // → routeToEmbedded runs in connectedCallback, before this).
        if (!this._active) this._active = this.activeView || (this._entries()[0]?.view) || '';
        this._embed(true);
    }
    updated(changed) {
        super.updated(changed);
        if (!this._initialized) return;
        if (changed.has('items') && !this._entries().some(e => e.view === this._active)) {
            this._active = this.activeView || (this._entries()[0]?.view) || '';
        }
        if (changed.has('items') || changed.has('activeView')) this._embed(true);
    }

    _select(view, closeDrawer = true) {
        if (!view) return;
        this._active = view;
        if (closeDrawer && this._narrow) this._drawerOpen = false;
        this._embed(true);
        // N30: tell the site so it syncs the URL hash to #/<view>/<embedded>
        // and publishes the nested path on <publish>/view.
        if (!feezal.isEditor) feezal.site?.notifyRouterView?.(this);
        // Element-level publish kept for back-compat (deprecated in favour of
        // the site view contract; see N30).
        if (this.publish && !feezal.isEditor) feezal.connection?.pub?.(this.publish, view);
    }

    _embed(force) {
        const content = this.renderRoot && this.renderRoot.querySelector('#content');
        if (!content) return;
        if (feezal.isEditor) { content.replaceChildren(); return; }   // editor uses the .ph placeholder overlay
        const name = this._active;
        if (!force && name === this._mounted) return;
        this._mounted = name;
        if (!name || !feezal.site) { content.replaceChildren(); return; }
        const view = feezal.site.querySelector(`feezal-view[name="${name}"]`);
        if (!view) { content.replaceChildren(); return; }
        const clone = view.cloneNode(true);
        clone.style.display = '';
        content.replaceChildren(clone);
    }

    _doAction(a) {
        if (feezal.isEditor) return;
        if (a.publish) feezal.connection?.pub?.(a.publish, a.payload ?? '');
    }

    render() {
        const entries = this._entries();
        const title = this._liveTitle != null ? this._liveTitle : (this.title || '');
        const showHam = this._narrow;
        return html`
            <div class="shell">
                ${this.hideHeader ? '' : html`
                    <div class="bar">
                        ${showHam ? html`<button class="iconbtn" title="Menu" @click="${() => { this._drawerOpen = !this._drawerOpen; }}"><span class="mi">menu</span></button>` : ''}
                        <div class="title">${title}</div>
                        <div class="actions">
                            ${this._actions().map(a => html`<button class="iconbtn" title="${a.icon}" @click="${() => this._doAction(a)}"><feezal-icon class="mi" name="${a.icon}"></feezal-icon></button>`)}
                        </div>
                    </div>`}
                <div class="body">
                    ${this.hideHeader && showHam && !this._drawerOpen ? html`
                        <button class="fab-menu" title="Menu" @click="${() => { this._drawerOpen = true; }}"><span class="mi">menu</span></button>` : ''}
                    <div class="drawer ${this._drawerOpen ? 'open' : ''}">
                        ${entries.length === 0
                            ? html`<div style="opacity:.6;padding:10px;font-size:12px">${feezal.isEditor ? 'Add drawer entries in the inspector →' : ''}</div>`
                            : entries.map(e => html`
                                <button class="entry ${e.view === this._active ? 'active' : ''}" @click="${() => this._select(e.view)}">
                                    ${e.icon ? html`<feezal-icon class="mi" name="${e.icon}"></feezal-icon>` : ''}
                                    <span class="label">${e.label || e.view}</span>
                                </button>`)}
                    </div>
                    ${this._narrow && this._drawerOpen ? html`<div class="scrim" @click="${() => { this._drawerOpen = false; }}"></div>` : ''}
                    <div class="content">
                        <div id="content"></div>
                        ${feezal.isEditor ? html`<div class="ph">${this._active ? `View: ${this._active}` : '(no view selected)'}</div>` : ''}
                    </div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-layout-app', FeezalElementLayoutApp);
export {FeezalElementLayoutApp};

// ─── N6 custom inspector ────────────────────────────────────────────────────────

class FeezalElementLayoutAppInspector extends LitElement {
    static properties = {element: {attribute: false}, _tick: {state: true}};

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0; }
        .sec-head .spacer { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .row { display: flex; gap: 6px; align-items: center; }
        .row > .field { flex: 1; min-width: 0; }
        sl-input, sl-select { width: 100%; }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        input { width: 100%; box-sizing: border-box; padding: 4px 6px; font: inherit; font-size: 12px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); border: 1px solid var(--feezal-border, #ccc); border-radius: 4px; }
        .hint { font-size: 10px; opacity: 0.6; line-height: 1.4; }
        .btn { border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 5px; padding: 3px 9px; font: inherit; font-size: 11px; cursor: pointer; }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .item { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; }
        .item-head { display: flex; align-items: center; gap: 4px; }
        .item-num { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; background: var(--sl-color-primary-600, #5c6bc0);
            color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
        .item-head sl-select { flex: 1; min-width: 0; }
        .ib { flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px; }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .grid { display: flex; gap: 6px; margin-top: 6px; }
        .grid .field { flex: 1; min-width: 0; }
    `;

    constructor() { super(); this.element = null; this._tick = 0; }

    _attr(n, d = '') { return this.element?.getAttribute(n) ?? d; }
    _emit(name, value) { this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {bubbles: true, composed: true, detail: {name, value}})); }
    _viewNames() { return (window.feezal && feezal.site) ? [...feezal.site.querySelectorAll('feezal-view')].map(v => v.getAttribute('name')).filter(Boolean) : []; }
    _json(attr) { try { const r = JSON.parse(this._attr(attr, '[]')); return Array.isArray(r) ? r : []; } catch { return []; } }

    // Reuse E9/E45's synchronous-hide view creation.
    _createView(name) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', name);
        const current = feezal.site.querySelector(`feezal-view[name="${feezal.site.view}"]`);
        v.style.cssText = current ? current.style.cssText : 'width:100%;height:100%;background:white';
        v.style.display = 'none';
        v.visible = false;
        feezal.site.append(v);
        feezal.app.views = [...feezal.site.querySelectorAll('feezal-view')];
        feezal.site.updateVisibility?.();
        feezal.app.requestUpdate();
    }
    _uniqueViewName(base = 'page') { const used = new Set(this._viewNames()); let i = 1, n; do { n = base + i++; } while (used.has(n)); return n; }

    // ── entries ──
    _entries() { return this._json('items').map(e => ({label: e.label, icon: e.icon, view: e.view})); }
    _saveEntries(list) { this._emit('items', list.map(e => { const o = {view: e.view || ''}; if (e.label) o.label = e.label; if (e.icon) o.icon = e.icon; return o; })); this._tick++; }
    _addEntry() { const name = this._uniqueViewName('page'); this._createView(name); this._saveEntries([...this._entries(), {view: name, label: name}]); }
    _setEntry(i, k, v) { const l = this._entries(); if (!l[i]) return; if (v === '' || v == null) delete l[i][k]; else l[i][k] = v; this._saveEntries(l); }
    _moveEntry(i, d) { const l = this._entries(); const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; this._saveEntries(l); }
    _removeEntry(i) { const l = this._entries(); l.splice(i, 1); this._saveEntries(l); }
    _editView(v) { if (v && feezal.app) feezal.app._setView(v); }

    // ── actions ──
    _acts() { return this._json('actions').map(a => ({icon: a.icon, publish: a.publish, payload: a.payload})); }
    _saveActs(list) { this._emit('actions', list.map(a => ({icon: a.icon || '', publish: a.publish || '', payload: a.payload ?? ''}))); this._tick++; }
    _addAct() { this._saveActs([...this._acts(), {icon: '', publish: '', payload: ''}]); }
    _setAct(i, k, v) { const l = this._acts(); if (!l[i]) return; l[i][k] = v; this._saveActs(l); }
    _removeAct(i) { const l = this._acts(); l.splice(i, 1); this._saveActs(l); }

    render() {
        if (!this.element) return html``;
        const entries = this._entries();
        const views = this._viewNames();
        const acts = this._acts();
        return html`
            <div class="section">
                <div class="sec-head">Top bar</div>
                <div class="sec-body">
                    <div class="field"><label>Title</label>
                        <input .value="${this._attr('title')}" @change="${e => this._emit('title', e.target.value)}"></div>
                    <div class="field"><label>Subscribe title (MQTT)</label>
                        <feezal-topic-input size="small" value="${this._attr('subscribe-title')}" placeholder="mqtt/topic" @sl-change="${e => this._emit('subscribe-title', e.target.value)}"></feezal-topic-input></div>
                    <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('hide-header')}"
                            @sl-change="${e => this._emit('hide-header', e.target.checked)}"></sl-switch>
                        Hide top bar (floating hamburger when the drawer is an overlay)
                    </label>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Drawer entries <span class="spacer"></span><button class="btn" @click="${this._addEntry}">+ add</button></div>
                <div class="sec-body">
                    ${entries.length === 0
                        ? html`<div class="hint">No entries yet. “+ add” creates a page view and adds an entry — ✎ to edit it.</div>`
                        : entries.map((e, i) => html`
                            <div class="item">
                                <div class="item-head">
                                    <span class="item-num">${i + 1}</span>
                                    <sl-select size="small" value="${e.view || ''}" @sl-change="${ev => this._setEntry(i, 'view', ev.target.value)}">
                                        ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                                    </sl-select>
                                    <button class="ib" title="Edit this view" @click="${() => this._editView(e.view)}">&#9998;</button>
                                    <button class="ib" title="Up" ?disabled="${i === 0}" @click="${() => this._moveEntry(i, -1)}">&#8593;</button>
                                    <button class="ib" title="Down" ?disabled="${i === entries.length - 1}" @click="${() => this._moveEntry(i, 1)}">&#8595;</button>
                                    <button class="ib danger" title="Remove" @click="${() => this._removeEntry(i)}">&times;</button>
                                </div>
                                <div class="grid">
                                    <div class="field"><label>label</label>
                                        <input .value="${e.label ?? ''}" placeholder="${e.view || ''}" @change="${ev => this._setEntry(i, 'label', ev.target.value)}"></div>
                                    <div class="field"><label>icon</label>
                                        <feezal-icon-input .value="${e.icon ?? ''}" placeholder="e.g. home"
                                            @feezal-change="${ev => { ev.stopPropagation(); this._setEntry(i, 'icon', ev.detail.value); }}"></feezal-icon-input></div>
                                </div>
                            </div>`)}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Actions <span class="spacer"></span><button class="btn" @click="${this._addAct}">+ add</button></div>
                <div class="sec-body">
                    ${acts.length === 0 ? html`<div class="hint">Top-bar icon buttons that publish a payload on tap.</div>` : ''}
                    ${acts.map((a, i) => html`
                        <div class="item">
                            <div class="grid" style="margin-top:0">
                                <div class="field"><label>icon</label>
                                    <feezal-icon-input .value="${a.icon ?? ''}" placeholder="e.g. refresh"
                                        @feezal-change="${e => { e.stopPropagation(); this._setAct(i, 'icon', e.detail.value); }}"></feezal-icon-input></div>
                                <div class="field"><label>publish topic</label><feezal-topic-input size="small" value="${a.publish ?? ''}" placeholder="mqtt/topic" @sl-change="${e => this._setAct(i, 'publish', e.target.value)}"></feezal-topic-input></div>
                                <div class="field"><label>payload</label><input .value="${a.payload ?? ''}" @change="${e => this._setAct(i, 'payload', e.target.value)}"></div>
                                <button class="ib danger" title="Remove" @click="${() => this._removeAct(i)}">&times;</button>
                            </div>
                        </div>`)}
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Drawer</div>
                <div class="sec-body">
                    <div class="field"><label>Entry style</label>
                        <sl-select size="small" value="${this._attr('entry-style', 'pill') === 'list' ? 'list' : 'pill'}"
                            @sl-change="${e => this._emit('entry-style', e.target.value)}">
                            <sl-option value="pill">pill — rounded chips with inset</sl-option>
                            <sl-option value="list">list — flat full-width rows</sl-option>
                        </sl-select></div>
                    <div class="field"><label>Overlay breakpoint (px)</label>
                        <input type="number" .value="${this._attr('breakpoint', '768')}" @change="${e => this._emit('breakpoint', e.target.value)}"></div>
                    <label style="display:flex;align-items:center;gap:8px;font-size:11px">
                        <sl-switch size="small" ?checked="${this.element.hasAttribute('drawer-persistent') || this._attr('drawer-persistent') !== 'false'}"
                            @sl-change="${e => this._emit('drawer-persistent', e.target.checked)}"></sl-switch>
                        Persistent drawer when wide
                    </label>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-layout-app-inspector', FeezalElementLayoutAppInspector);
export {FeezalElementLayoutAppInspector};
