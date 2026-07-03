/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LitElement} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

/**
 * feezal-element-layout-flex (E9)
 *
 * A flexbox container. Its regions are `feezal-element-basic-view` children (light
 * DOM) that each embed a named `feezal-view`. The container's own flex settings are
 * attributes; each region's flex sizing is stored as inline styles on its basic-view.
 * Regions are managed through the custom inspector (add/remove/reorder, per-region
 * flex, and "edit" navigation to that region's view).
 *
 * NOTE (known limitation): there is no cycle guard yet — do not make a region embed a
 * view that (directly or indirectly) contains this container, or the viewer will
 * recurse. A recursion guard is a follow-up.
 */
class FeezalElementLayoutFlex extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Flex', category: 'Layout', color: '#4a7080', icon: 'view_column'},
            description: 'A flexbox container that arranges embedded views (regions) in a row or column, ' +
                'with wrap, alignment and gap. Add and configure regions in the inspector.',
            inspector: 'feezal-element-layout-flex-inspector',
            attributes: [
                {name: 'flex-direction',  type: 'select', options: ['row', 'column', 'row-reverse', 'column-reverse'], default: 'row', help: 'Main-axis direction of the regions.'},
                {name: 'flex-wrap',       type: 'boolean', default: false, help: 'Wrap regions onto multiple lines (responsive reflow).'},
                {name: 'justify-content', type: 'select', options: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'], default: 'flex-start', help: 'Alignment along the main axis.'},
                {name: 'align-items',     type: 'select', options: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'], default: 'stretch', help: 'Alignment along the cross axis.'},
                {name: 'gap',             type: 'number', default: 8, help: 'Gap between regions, in px.'},
            ],
            styles: ['top', 'left', 'width', 'height', 'background', 'border', 'border-radius', 'padding'],
            restrict: {minWidth: 80, minHeight: 60},
            defaultStyle: {width: '420px', height: '260px'},
        };
    }

    static properties = {
        flexDirection:  {type: String,  reflect: true, attribute: 'flex-direction'},
        flexWrap:       {type: Boolean, reflect: true, attribute: 'flex-wrap'},
        justifyContent: {type: String,  reflect: true, attribute: 'justify-content'},
        alignItems:     {type: String,  reflect: true, attribute: 'align-items'},
        gap:            {type: Number,  reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; }
        .flex { width: 100%; height: 100%; box-sizing: border-box; }
        /* Regions must be allowed to shrink below their content size in flex. */
        ::slotted(feezal-element-basic-view) { min-width: 0; min-height: 0; }
        .empty {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center; text-align: center;
            box-sizing: border-box; padding: 12px; pointer-events: none;
            color: var(--secondary-text-color, #888); font-size: 13px;
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
    `];

    constructor() {
        super();
        this.flexDirection  = 'row';
        this.flexWrap       = false;
        this.justifyContent = 'flex-start';
        this.alignItems     = 'stretch';
        this.gap            = 8;
    }

    // A layout container has no MQTT of its own.
    _subscribe() { /* no direct subscriptions */ }

    render() {
        const hasRegions = this.children.length > 0;
        const flexStyle = [
            'display:flex', 'width:100%', 'height:100%', 'box-sizing:border-box',
            `flex-direction:${this.flexDirection || 'row'}`,
            `flex-wrap:${this.flexWrap ? 'wrap' : 'nowrap'}`,
            `justify-content:${this.justifyContent || 'flex-start'}`,
            `align-items:${this.alignItems || 'stretch'}`,
            `gap:${Number(this.gap) || 0}px`,
        ].join(';');

        return html`
            <div class="flex" style="${flexStyle}"><slot></slot></div>
            ${feezal.isEditor && !hasRegions
                ? html`<div class="empty">Flex Layout — add regions in the inspector →</div>`
                : ''}`;
    }
}

customElements.define('feezal-element-layout-flex', FeezalElementLayoutFlex);
export {FeezalElementLayoutFlex};

// ─── N6 custom inspector ────────────────────────────────────────────────────────
// Manages the container's flex attributes and its region (basic-view) children.

const DIRS    = ['row', 'column', 'row-reverse', 'column-reverse'];
const JUSTIFY = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'];
const ALIGN   = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'];

class FeezalElementLayoutFlexInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tick:   {state: true},   // bump to force a re-read of the (non-reactive) child list
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; margin-bottom: 8px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
        }
        .sec-head .spacer { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .field > label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .row { display: flex; gap: 6px; }
        .row > .field { flex: 1; min-width: 0; }
        sl-input, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-switch { color: var(--feezal-color, inherit); }
        .hint { font-size: 10px; opacity: 0.6; }
        .btn {
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); border-radius: 5px; padding: 3px 9px;
            font: inherit; font-size: 11px; cursor: pointer;
        }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .region { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; }
        .region-head { display: flex; align-items: center; gap: 4px; }
        .region-num {
            flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%;
            background: var(--sl-color-primary-600, #5c6bc0); color: #fff;
            font-size: 11px; display: flex; align-items: center; justify-content: center;
        }
        .region-head sl-select { flex: 1; min-width: 0; }
        .ib {
            flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none;
            cursor: pointer; color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px;
        }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .region-flex { display: flex; gap: 6px; margin-top: 6px; }
        .region-flex .field { flex: 1; min-width: 0; }
        .region-flex input {
            width: 100%; box-sizing: border-box; padding: 3px 4px; font: inherit; font-size: 11px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px;
        }
    `;

    constructor() {
        super();
        this.element = null;
        this._tick = 0;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _regions() {
        return this.element
            ? [...this.element.children].filter(c => c.localName === 'feezal-element-basic-view')
            : [];
    }
    _viewNames() {
        if (!window.feezal || !feezal.site) return [];
        return [...feezal.site.querySelectorAll('feezal-view')]
            .map(v => v.getAttribute('name')).filter(Boolean);
    }
    _attr(name, dflt = '') { return this.element?.getAttribute(name) ?? dflt; }

    _emit(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
    }
    _refresh() {
        this.element?.requestUpdate();
        feezal.app.change();
        this._tick++;
    }

    _uniqueViewName(base = 'region') {
        const used = new Set(this._viewNames());
        let i = 1, n;
        do { n = base + i++; } while (used.has(n));
        return n;
    }
    _createView(name) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', name);

        // Inherit the current view's inline style (size + themed background), the
        // same way feezal-app-editor._addView() does — otherwise the region view
        // has a transparent background and shows the bare grey canvas.
        const current = feezal.site.querySelector(`feezal-view[name="${feezal.site.view}"]`);
        v.style.cssText = current ? current.style.cssText : 'width:100%;height:100%;background:white';

        // Hide it SYNCHRONOUSLY. feezal-site is display:flex, so a visible 100%×100%
        // view would become a second flex child the moment it is appended and reflow
        // the canvas. That reflow leaves DragSelect's selector-area geometry stale
        // (it is only computed on start()), which then swallows canvas clicks /
        // rubber-band selection. Setting display:none inline avoids the reflow
        // entirely; `visible=false` keeps the view's own lifecycle consistent so a
        // later _setView()/updateVisibility() reveals it correctly.
        v.style.display = 'none';
        v.visible = false;

        feezal.site.append(v);
        feezal.app.views = [...feezal.site.querySelectorAll('feezal-view')];
        if (feezal.site.updateVisibility) feezal.site.updateVisibility();
        feezal.app.requestUpdate();   // let the tab bar pick up the new view

        // Belt-and-suspenders: after layout settles, recompute the active view's
        // DragSelect selector-area so click/rubber-band keep working even if the
        // tab-bar growth (new tab) nudged the canvas size.
        this._refreshDragSelect();
    }

    /** Recompute the active view's DragSelect geometry (editor-internal). */
    _refreshDragSelect() {
        requestAnimationFrame(() => {
            const ed = window.feezal && feezal.editor;
            const ds = ed && ed.dragselect && ed.dragselect[ed.view];
            if (ds) { ds.stop(); ds.start(); }
        });
    }

    _addRegion() {
        const name = this._uniqueViewName('region');
        this._createView(name);
        const bv = document.createElement('feezal-element-basic-view');
        bv.setAttribute('view', name);
        // Grow equally, allow shrink below content, fill the cross axis.
        bv.style.flexGrow = '1';
        bv.style.flexShrink = '1';
        bv.style.flexBasis = '0';
        bv.style.minWidth = '0';
        bv.style.minHeight = '0';
        this.element.appendChild(bv);
        this._refresh();
    }
    _removeRegion(bv) { bv.remove(); this._refresh(); }
    _move(bv, dir) {
        const sib = dir < 0 ? bv.previousElementSibling : bv.nextElementSibling;
        if (!sib || sib.localName !== 'feezal-element-basic-view') return;
        if (dir < 0) this.element.insertBefore(bv, sib);
        else this.element.insertBefore(sib, bv);
        this._refresh();
    }
    _setRegionView(bv, name) { bv.setAttribute('view', name); this._refresh(); }
    _setRegionStyle(bv, prop, val) {
        if (val === '' || val == null) bv.style.removeProperty(prop);
        else bv.style.setProperty(prop, val);
        this._refresh();
    }
    _editRegion(name) { if (name && feezal.app) feezal.app._setView(name); }

    // ── Render ───────────────────────────────────────────────────────────────
    render() {
        if (!this.element) return html``;
        const regions = this._regions();
        const views   = this._viewNames();

        return html`
            <div class="section">
                <div class="sec-head">Layout</div>
                <div class="sec-body">
                    <div class="field">
                        <label>Direction</label>
                        <sl-select size="small" value="${this._attr('flex-direction', 'row')}"
                            @sl-change="${e => this._emit('flex-direction', e.target.value)}">
                            ${DIRS.map(d => html`<sl-option value="${d}">${d}</sl-option>`)}
                        </sl-select>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Justify (main)</label>
                            <sl-select size="small" value="${this._attr('justify-content', 'flex-start')}"
                                @sl-change="${e => this._emit('justify-content', e.target.value)}">
                                ${JUSTIFY.map(j => html`<sl-option value="${j}">${j}</sl-option>`)}
                            </sl-select>
                        </div>
                        <div class="field">
                            <label>Align (cross)</label>
                            <sl-select size="small" value="${this._attr('align-items', 'stretch')}"
                                @sl-change="${e => this._emit('align-items', e.target.value)}">
                                ${ALIGN.map(a => html`<sl-option value="${a}">${a}</sl-option>`)}
                            </sl-select>
                        </div>
                    </div>
                    <div class="row">
                        <div class="field">
                            <label>Gap (px)</label>
                            <sl-input size="small" type="number" autocomplete="off"
                                value="${this._attr('gap', '8')}"
                                @sl-change="${e => this._emit('gap', e.target.value)}"></sl-input>
                        </div>
                        <div class="field">
                            <label>Wrap</label>
                            <sl-switch size="small" ?checked="${this.element.hasAttribute('flex-wrap')}"
                                @sl-change="${e => this._emit('flex-wrap', e.target.checked)}">wrap</sl-switch>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="sec-head">
                    Regions <span class="spacer"></span>
                    <button class="btn" @click="${this._addRegion}">+ add region</button>
                </div>
                <div class="sec-body">
                    ${regions.length === 0
                        ? html`<div class="hint">No regions yet. “Add region” creates a new view and embeds it here — click the ✎ to edit that view.</div>`
                        : regions.map((bv, i) => this._renderRegion(bv, i, regions.length, views))}
                </div>
            </div>
        `;
    }

    _renderRegion(bv, i, count, views) {
        const cur = bv.getAttribute('view') || '';
        return html`
            <div class="region">
                <div class="region-head">
                    <span class="region-num">${i + 1}</span>
                    <sl-select size="small" value="${cur}"
                        @sl-change="${e => this._setRegionView(bv, e.target.value)}">
                        ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                    </sl-select>
                    <button class="ib" title="Edit this region's view" @click="${() => this._editRegion(cur)}">&#9998;</button>
                    <button class="ib" title="Move up" ?disabled="${i === 0}" @click="${() => this._move(bv, -1)}">&#8593;</button>
                    <button class="ib" title="Move down" ?disabled="${i === count - 1}" @click="${() => this._move(bv, 1)}">&#8595;</button>
                    <button class="ib danger" title="Remove region" @click="${() => this._removeRegion(bv)}">&times;</button>
                </div>
                <div class="region-flex">
                    <div class="field">
                        <label>grow</label>
                        <input type="number" .value="${bv.style.flexGrow || ''}" placeholder="1"
                            @change="${e => this._setRegionStyle(bv, 'flex-grow', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>basis</label>
                        <input .value="${bv.style.flexBasis || ''}" placeholder="0"
                            @change="${e => this._setRegionStyle(bv, 'flex-basis', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>min-width</label>
                        <input .value="${bv.style.minWidth || ''}" placeholder="0"
                            @change="${e => this._setRegionStyle(bv, 'min-width', e.target.value)}">
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-layout-flex-inspector', FeezalElementLayoutFlexInspector);
export {FeezalElementLayoutFlexInspector};
