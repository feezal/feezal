/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LitElement} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

/**
 * feezal-element-material-navbar (E46)
 *
 * A view-navigation bar/rail: a row (horizontal) or column (vertical) of
 * destination items; tapping one navigates to the target view by setting
 * feezal-site's `view` (which drives updateVisibility + hash sync). The active
 * item follows the current view from ANY source (nav / swipe / MQTT / deep
 * link) via a MutationObserver on feezal-site's reflected `view` attribute.
 *
 * `items` is a JSON array accepting bare view-name strings OR
 * {label, view, icon?, subscribe-badge?} objects (mix allowed). Empty →
 * auto-populate from all views in document order.
 */
class FeezalElementMaterialNavbar extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Navbar', category: 'Material', color: '#4a6080', icon: 'bottom_navigation'},
            description: 'A navigation bar/rail that switches between views. Items are view names or ' +
                '{label, view, icon, subscribe-badge} objects; empty auto-fills from all views. Active item ' +
                'follows the current view from any source.',
            inspector: 'feezal-element-material-navbar-inspector',
            attributes: [
                {name: 'items', type: 'json', default: '[]', help: 'Destinations (managed in the inspector).'},
                {name: 'orientation', type: 'select', options: ['horizontal', 'vertical'], default: 'horizontal', help: 'Bar (horizontal) or rail (vertical).'},
                {name: 'show-labels', type: 'select', options: ['always', 'active', 'never'], default: 'always', help: 'When to show item labels.'},
                {name: 'show-icons', type: 'boolean', default: true, help: 'Render item icons when provided.'},
                {name: 'align', type: 'select', options: ['start', 'center', 'space-between'], default: 'space-between', help: 'How items distribute along the main axis.'},
                {name: 'item-width', type: 'string', default: '', help: 'E81: item size along the bar — empty = auto (content-sized, today\'s behaviour), a CSS length (e.g. "72px") = fixed size, "equal" = all items share the bar evenly. Applies to the height in vertical orientation.'},
                'subscribe',
                'publish',
            ],
            styles: ['top', 'left', 'width', 'height', 'background', 'border', 'border-radius', 'padding'],
            restrict: {minWidth: 60, minHeight: 40},
            defaultStyle: {width: '400px', height: '64px'},
        };
    }

    static properties = {
        items:       {type: String,  reflect: true},
        orientation: {type: String,  reflect: true},
        showLabels:  {type: String,  reflect: true, attribute: 'show-labels'},
        showIcons:   {type: Boolean, reflect: true, attribute: 'show-icons'},
        align:       {type: String,  reflect: true},
        itemWidth:   {type: String,  reflect: true, attribute: 'item-width'},
        _active:     {state: true},
        _external:   {state: true},
        _badges:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; box-sizing: border-box; overflow: hidden;
            background: var(--feezal-navbar-background, var(--md-sys-color-surface-container, var(--primary-background-color, #f2f3f5)));
            box-shadow: var(--feezal-navbar-elevation, none);
            gap: var(--feezal-navbar-gap, 4px);
            padding: 4px;
        }
        :host([orientation="vertical"]) { flex-direction: column; }
        .item {
            flex: 0 1 auto; min-width: 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
            padding: var(--feezal-navbar-item-padding, 6px 12px);
            border: none; background: none; cursor: pointer; position: relative;
            color: var(--feezal-navbar-color, var(--md-sys-color-on-surface-variant, var(--secondary-text-color, #666)));
            border-radius: var(--feezal-navbar-radius, 16px);
            font: inherit; overflow: hidden;
        }
        .item .mi { font-family: 'Material Icons'; font-style: normal; font-weight: normal;
            font-size: var(--feezal-navbar-icon-size, 24px); line-height: 1; }
        .item .label { font-size: var(--feezal-navbar-label-size, 12px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        .item.active {
            color: var(--feezal-navbar-active-color, var(--md-sys-color-on-secondary-container, #fff));
            background: var(--feezal-navbar-active-indicator, var(--md-sys-color-secondary-container, var(--primary-color, #0284c7)));
        }
        .item .badge {
            position: absolute; top: 4px; right: 8px; min-width: 8px; height: 16px; padding: 0 4px;
            box-sizing: border-box; border-radius: 8px; background: var(--error-color, #e53935); color: #fff;
            font-size: 10px; line-height: 16px; text-align: center;
        }
        .item .badge.dot { min-width: 8px; width: 8px; height: 8px; padding: 0; top: 6px; right: 10px; }
        .empty { margin: auto; font-size: 12px; color: var(--secondary-text-color, #888); }
    `];

    constructor() {
        super();
        this.items = '[]';
        this.orientation = 'horizontal';
        this.showLabels = 'always';
        this.showIcons = true;
        this.align = 'space-between';
        this.itemWidth = '';
        this._active = '';
        this._external = null;
        this._badges = {};
    }

    // Parse `items` into a normalised array of {label, view, icon, badge}.
    _items() {
        let raw;
        try { raw = JSON.parse(this.items || '[]'); } catch { raw = []; }
        if (!Array.isArray(raw)) raw = [];
        let list = raw.map(it => typeof it === 'string'
            ? {view: it, label: it}
            : {view: it.view, label: it.label || it.view, icon: it.icon, badge: it['subscribe-badge']})
            .filter(it => it.view);
        if (list.length === 0 && feezal.site) {
            list = [...feezal.site.querySelectorAll('feezal-view')]
                .map(v => v.getAttribute('name')).filter(Boolean)
                .map(v => ({view: v, label: v}));
        }
        return list;
    }

    connectedCallback() {
        super.connectedCallback();
        this._readActive();
        this._navObserver = new MutationObserver(() => this._readActive());
        if (feezal.site) this._navObserver.observe(feezal.site, {attributes: true, attributeFilter: ['view']});
    }

    disconnectedCallback() {
        this._navObserver?.disconnect();
        super.disconnectedCallback();
    }

    _readActive() {
        this._active = (feezal.site && (feezal.site.getAttribute('view') || feezal.site.view)) || '';
    }

    // Override the base subscribe: external active-view topic + per-item badges.
    _subscribe() {
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) return;
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => { this._external = String(this.getProperty(msg, this.messageProperty) ?? ''); });
        }
        for (const it of this._items()) {
            if (!it.badge) continue;
            this.addSubscription(it.badge, msg => {
                this._badges = {...this._badges, [it.badge]: this.getProperty(msg, this.messageProperty)};
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Re-subscribe badges when the items list changes.
        if (changed.has('items') && !(feezal.isEditor && feezal.preventEditorMqtt !== false)) {
            this._unsubscribe();
            this._subscribe();
        }
    }

    _navigate(view) {
        if (feezal.isEditor) return;                 // taps inert in the editor
        if (feezal.site) feezal.site.view = view;    // drives updateVisibility + hash sync
        if (this.publish) feezal.connection?.pub?.(this.publish, view);
    }

    render() {
        const items = this._items();
        if (items.length === 0) {
            return html`<div class="empty">${feezal.isEditor ? 'Navbar — add items (or add views)' : ''}</div>`;
        }
        const active = this._external != null ? this._external : this._active;
        const justify = this.align === 'start' ? 'flex-start' : (this.align === 'center' ? 'center' : 'space-between');
        const dir = this.orientation === 'vertical' ? 'column' : 'row';
        return html`
            <style>:host { flex-direction: ${dir}; justify-content: ${justify}; }</style>
            ${items.map(it => this._renderItem(it, it.view === active))}`;
    }

    /** E81: item size along the bar — '' = auto (flex: 0 1 auto, the CSS
     * default), 'equal' = items share the bar evenly, any CSS length = fixed
     * flex-basis (main axis: width horizontally, height vertically). */
    _itemStyle() {
        const w = (this.itemWidth || '').trim();
        if (!w) return '';
        if (w === 'equal') return 'flex:1 1 0;';
        return `flex:0 0 ${w};`;
    }

    _renderItem(it, isActive) {
        const showLabel = this.showLabels === 'always' || (this.showLabels === 'active' && isActive);
        const badgeVal = it.badge != null ? this._badges[it.badge] : undefined;
        return html`
            <button class="item ${isActive ? 'active' : ''}" style="${this._itemStyle()}"
                @click="${() => this._navigate(it.view)}" title="${it.label}">
                ${this.showIcons && it.icon ? html`<feezal-icon class="mi" name="${it.icon}"></feezal-icon>` : ''}
                ${showLabel ? html`<span class="label">${it.label}</span>` : ''}
                ${this._renderBadge(badgeVal)}
            </button>`;
    }

    _renderBadge(val) {
        if (val === undefined || val === null || val === '' || val === false || val === 0 || val === '0') return '';
        const num = Number(val);
        if (Number.isFinite(num)) return html`<span class="badge">${num}</span>`;
        // truthy non-numeric → dot
        return html`<span class="badge dot"></span>`;
    }
}

customElements.define('feezal-element-material-navbar', FeezalElementMaterialNavbar);
export {FeezalElementMaterialNavbar};

// ─── N6 custom inspector ────────────────────────────────────────────────────────
// Items list-builder: add/reorder/remove destinations, pick a view, label, icon, badge topic.

const ORIENT = ['horizontal', 'vertical'];
const LABELS = ['always', 'active', 'never'];
const ALIGN  = ['start', 'center', 'space-between'];

class FeezalElementMaterialNavbarInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tick:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0; }
        .sec-head .spacer { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
        sl-input, sl-select { width: 100%; }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        .hint { font-size: 10px; opacity: 0.6; line-height: 1.4; }
        .btn { border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 5px; padding: 3px 9px; font: inherit; font-size: 11px; cursor: pointer; }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .item { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; }
        .item-head { display: flex; align-items: center; gap: 4px; }
        .item-num { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%;
            background: var(--sl-color-primary-600, #5c6bc0); color: #fff; font-size: 11px;
            display: flex; align-items: center; justify-content: center; }
        .item-head sl-select { flex: 1; min-width: 0; }
        .ib { flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px; }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .item .grid { display: flex; gap: 6px; margin-top: 6px; }
        .item .grid .field { flex: 1; min-width: 0; }
        .item input { width: 100%; box-sizing: border-box; padding: 3px 4px; font: inherit; font-size: 11px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; }
    `;

    constructor() { super(); this.element = null; this._tick = 0; }

    _attr(name, dflt = '') { return this.element?.getAttribute(name) ?? dflt; }
    _emit(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {bubbles: true, composed: true, detail: {name, value}}));
    }
    _viewNames() {
        if (!window.feezal || !feezal.site) return [];
        return [...feezal.site.querySelectorAll('feezal-view')].map(v => v.getAttribute('name')).filter(Boolean);
    }
    _items() {
        try { const r = JSON.parse(this.element?.getAttribute('items') || '[]'); return Array.isArray(r) ? r : []; }
        catch { return []; }
    }
    _normalized() {
        // Always work with object form in the editor for uniform editing.
        return this._items().map(it => typeof it === 'string'
            ? {view: it} : {view: it.view, label: it.label, icon: it.icon, 'subscribe-badge': it['subscribe-badge']});
    }
    _save(items) {
        // Drop empty optional keys to keep the JSON tidy.
        const clean = items.map(it => {
            const o = {view: it.view || ''};
            if (it.label && it.label !== it.view) o.label = it.label;
            if (it.icon) o.icon = it.icon;
            if (it['subscribe-badge']) o['subscribe-badge'] = it['subscribe-badge'];
            return o;
        });
        this._emit('items', clean);
        this._tick++;
    }
    _add() {
        const views = this._viewNames();
        this._save([...this._normalized(), {view: views[0] || ''}]);
    }
    _set(i, key, val) { const items = this._normalized(); if (!items[i]) return; if (val === '' || val == null) delete items[i][key]; else items[i][key] = val; this._save(items); }
    _move(i, d) { const items = this._normalized(); const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; this._save(items); }
    _remove(i) { const items = this._normalized(); items.splice(i, 1); this._save(items); }
    _edit(view) { if (view && feezal.app) feezal.app._setView(view); }

    render() {
        if (!this.element) return html``;
        const items = this._normalized();
        const views = this._viewNames();
        return html`
            <div class="section">
                <div class="sec-head">Layout</div>
                <div class="sec-body">
                    <div class="row">
                        <div class="field">
                            <label>Orientation</label>
                            <sl-select size="small" value="${this._attr('orientation', 'horizontal')}"
                                @sl-change="${e => this._emit('orientation', e.target.value)}">
                                ${ORIENT.map(o => html`<sl-option value="${o}">${o}</sl-option>`)}
                            </sl-select>
                        </div>
                        <div class="field">
                            <label>Align</label>
                            <sl-select size="small" value="${this._attr('align', 'space-between')}"
                                @sl-change="${e => this._emit('align', e.target.value)}">
                                ${ALIGN.map(a => html`<sl-option value="${a}">${a}</sl-option>`)}
                            </sl-select>
                        </div>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Labels</label>
                            <sl-select size="small" value="${this._attr('show-labels', 'always')}"
                                @sl-change="${e => this._emit('show-labels', e.target.value)}">
                                ${LABELS.map(l => html`<sl-option value="${l}">${l}</sl-option>`)}
                            </sl-select>
                        </div>
                        <div class="field">
                            <label>Item width</label>
                            <sl-input size="small" autocomplete="off" placeholder="auto · 72px · equal"
                                value="${this._attr('item-width', '')}"
                                @sl-change="${e => this._emit('item-width', e.target.value)}"></sl-input>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">Items <span class="spacer"></span><button class="btn" @click="${this._add}">+ add</button></div>
                <div class="sec-body">
                    ${items.length === 0
                        ? html`<div class="hint">No items — the navbar shows all views by default. Add items to curate/label them.</div>`
                        : items.map((it, i) => this._renderItem(it, i, items.length, views))}
                </div>
            </div>
        `;
    }

    _renderItem(it, i, count, views) {
        return html`
            <div class="item">
                <div class="item-head">
                    <span class="item-num">${i + 1}</span>
                    <sl-select size="small" value="${it.view || ''}"
                        @sl-change="${e => this._set(i, 'view', e.target.value)}">
                        ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                    </sl-select>
                    <button class="ib" title="Edit this view" @click="${() => this._edit(it.view)}">&#9998;</button>
                    <button class="ib" title="Move up" ?disabled="${i === 0}" @click="${() => this._move(i, -1)}">&#8593;</button>
                    <button class="ib" title="Move down" ?disabled="${i === count - 1}" @click="${() => this._move(i, 1)}">&#8595;</button>
                    <button class="ib danger" title="Remove" @click="${() => this._remove(i)}">&times;</button>
                </div>
                <div class="grid">
                    <div class="field">
                        <label>label</label>
                        <input .value="${it.label ?? ''}" placeholder="${it.view || ''}" @change="${e => this._set(i, 'label', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>icon</label>
                        <input .value="${it.icon ?? ''}" placeholder="e.g. home" @change="${e => this._set(i, 'icon', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>badge topic</label>
                        <input .value="${it['subscribe-badge'] ?? ''}" placeholder="mqtt/topic" @change="${e => this._set(i, 'subscribe-badge', e.target.value)}">
                    </div>
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-material-navbar-inspector', FeezalElementMaterialNavbarInspector);
export {FeezalElementMaterialNavbarInspector};
