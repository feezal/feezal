/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LitElement} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

/**
 * feezal-element-layout-responsive (E45)
 *
 * A responsive container: it embeds a **named view** chosen by the current
 * viewport width / orientation. The breakpoint rules are an ordered JSON list on
 * the `breakpoints` attribute — the FIRST matching rule wins (so ordering is
 * priority, and portrait/landscape falls out by placing an orientation'd rule
 * above a width-only one). In the viewer, ONLY the matching view is mounted, so
 * the same device isn't subscribed twice across breakpoints.
 *
 * Rule shape: { view, minWidth?, maxWidth?, orientation? } — orientation is
 * "any" | "portrait" | "landscape". A rule with no predicate is the fallback.
 *
 * Composes with layout-flex (an embedded view may itself contain a flex layout).
 * NOTE: like layout-flex, there is no cycle guard — do not embed a view that
 * (in)directly contains this container, or the viewer recurses.
 */
class FeezalElementLayoutResponsive extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Responsive', category: 'Layout', color: '#4a7080', icon: 'devices'},
            description: 'A responsive container that embeds a different view depending on the viewport ' +
                'width / orientation. Define ordered breakpoint rules (first match wins) in the inspector; ' +
                'each maps to a view. Only the matching view is mounted in the viewer.',
            inspector: 'feezal-element-layout-responsive-inspector',
            attributes: [
                {name: 'breakpoints', type: 'json', default: '[]', help: 'Ordered breakpoint rules (managed in the inspector).'},
            ],
            styles: ['top', 'left', 'width', 'height', 'background', 'border', 'border-radius', 'padding'],
            restrict: {minWidth: 60, minHeight: 40},
            defaultStyle: {top: '0px', left: '0px', width: '100%', height: '100%'},
        };
    }

    static properties = {
        breakpoints: {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; }
        #content { width: 100%; height: 100%; }
        .ph {
            position: absolute; inset: 0; box-sizing: border-box; padding: 10px;
            display: flex; flex-direction: column; gap: 5px; overflow: auto;
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
            color: var(--secondary-text-color, #888); font-size: 12px;
        }
        .ph .title { font-weight: 600; letter-spacing: 0.02em; }
        .ph .rule { display: flex; gap: 6px; align-items: baseline; padding: 2px 5px; border-radius: 4px; }
        .ph .rule.active { background: rgba(2,132,199,0.16); color: var(--feezal-color, #333); font-weight: 600; }
        .ph .cond { opacity: 0.7; white-space: nowrap; }
        .ph .arrow { opacity: 0.5; }
        .ph .empty { opacity: 0.7; }
    `];

    constructor() {
        super();
        this.breakpoints = '[]';
        this._mountedView = undefined;
        this._onViewport = () => this._embed(false);
    }

    // A layout container has no MQTT of its own.
    _subscribe() { /* no direct subscriptions */ }

    _rules() {
        try {
            const r = JSON.parse(this.breakpoints || '[]');
            return Array.isArray(r) ? r : [];
        } catch { return []; }
    }

    _matches(rule) {
        const w = window.innerWidth;
        const has = v => v !== null && v !== undefined && v !== '';
        if (has(rule.minWidth) && w < Number(rule.minWidth)) return false;
        if (has(rule.maxWidth) && w > Number(rule.maxWidth)) return false;
        if (rule.orientation && rule.orientation !== 'any') {
            const portrait = window.innerHeight >= window.innerWidth;
            if (rule.orientation === 'portrait' && !portrait) return false;
            if (rule.orientation === 'landscape' && portrait) return false;
        }
        return true;
    }

    _activeRule() {
        return this._rules().find(r => this._matches(r)) || null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor) {
            window.addEventListener('resize', this._onViewport);
            window.addEventListener('orientationchange', this._onViewport);
        }
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this._onViewport);
        window.removeEventListener('orientationchange', this._onViewport);
        super.disconnectedCallback();
    }

    render() {
        if (feezal.isEditor) return this._renderPlaceholder();
        return html`<div id="content"></div>`;
    }

    firstUpdated() {
        this._initialized = true;
        if (!feezal.isEditor) this._embed(true);
    }

    updated(changed) {
        super.updated(changed);
        if (this._initialized && changed.has('breakpoints')) {
            if (feezal.isEditor) this.requestUpdate();
            else this._embed(true);
        }
    }

    /** Mount the view matching the current viewport (viewer only). */
    _embed(force) {
        const content = this.renderRoot && this.renderRoot.querySelector('#content');
        if (!content) return;
        const rule = this._activeRule();
        const name = rule ? rule.view : null;
        if (!force && name === this._mountedView) return;   // active view unchanged — no reflow / re-subscribe
        this._mountedView = name;
        if (!name || !feezal.site) { content.replaceChildren(); return; }
        const view = feezal.site.querySelector(`feezal-view[name="${name}"]`);
        if (!view) { content.replaceChildren(); return; }
        // Clone the named view; strip the inline display:none that
        // feezal-site.updateVisibility() leaves on inactive views.
        const clone = view.cloneNode(true);
        clone.style.display = '';
        content.replaceChildren(clone);
    }

    _renderPlaceholder() {
        const rules = this._rules();
        const active = this._activeRule();
        const cond = r => {
            const parts = [];
            if (r.minWidth) parts.push(`≥${r.minWidth}px`);
            if (r.maxWidth) parts.push(`≤${r.maxWidth}px`);
            if (r.orientation && r.orientation !== 'any') parts.push(r.orientation);
            return parts.length ? parts.join(' · ') : 'fallback (any)';
        };
        return html`
            <div class="ph">
                <div class="title">Responsive Layout</div>
                ${rules.length === 0
                    ? html`<div class="empty">No breakpoints yet — add them in the inspector →</div>`
                    : rules.map(r => html`
                        <div class="rule ${r === active ? 'active' : ''}">
                            <span class="cond">${cond(r)}</span>
                            <span class="arrow">→</span>
                            <b>${r.view || '(no view)'}</b>
                        </div>`)}
            </div>`;
    }
}

customElements.define('feezal-element-layout-responsive', FeezalElementLayoutResponsive);
export {FeezalElementLayoutResponsive};

// ─── N6 custom inspector ────────────────────────────────────────────────────────
// Manages the ordered breakpoint rules stored on the `breakpoints` JSON attribute.

const ORIENTATIONS = ['any', 'portrait', 'landscape'];

class FeezalElementLayoutResponsiveInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _tick:   {state: true},
    };

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .section { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; }
        .sec-head {
            display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-weight: 600;
            background: var(--feezal-bg-sub, #f5f5f5); border-radius: 6px 6px 0 0;
        }
        .sec-head .spacer { flex: 1; }
        .sec-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .hint { font-size: 10px; opacity: 0.6; line-height: 1.4; }
        .btn {
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); border-radius: 5px; padding: 3px 9px;
            font: inherit; font-size: 11px; cursor: pointer;
        }
        .btn:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.06)); }
        .rule { border: 1px solid var(--feezal-border, #e0e0e0); border-radius: 6px; padding: 6px; }
        .rule-head { display: flex; align-items: center; gap: 4px; }
        .rule-num {
            flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%;
            background: var(--sl-color-primary-600, #5c6bc0); color: #fff;
            font-size: 11px; display: flex; align-items: center; justify-content: center;
        }
        .rule-head sl-select { flex: 1; min-width: 0; }
        .ib {
            flex: 0 0 auto; width: 24px; height: 26px; border: none; background: none;
            cursor: pointer; color: var(--feezal-color, #555); border-radius: 4px; font-size: 14px;
        }
        .ib:hover { background: var(--feezal-btn-hover, rgba(0,0,0,0.07)); }
        .ib:disabled { opacity: 0.3; cursor: default; }
        .ib.danger:hover { color: #c62828; }
        .cond-row { display: flex; gap: 6px; margin-top: 6px; }
        .cond-row .field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .cond-row label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        .cond-row input, .cond-row select {
            width: 100%; box-sizing: border-box; padding: 3px 4px; font: inherit; font-size: 11px;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px;
        }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
    `;

    constructor() {
        super();
        this.element = null;
        this._tick = 0;
    }

    // ── Rule storage (the `breakpoints` JSON attribute) ──────────────────────
    _rules() {
        try {
            const r = JSON.parse(this.element?.getAttribute('breakpoints') || '[]');
            return Array.isArray(r) ? r : [];
        } catch { return []; }
    }
    _save(rules) {
        // Object value → the editor's _onCustomAttrChanged JSON-stringifies it,
        // sets the attribute, and marks the site dirty (one history entry).
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name: 'breakpoints', value: rules},
        }));
        this._tick++;
    }

    _viewNames() {
        if (!window.feezal || !feezal.site) return [];
        return [...feezal.site.querySelectorAll('feezal-view')]
            .map(v => v.getAttribute('name')).filter(Boolean);
    }

    _uniqueViewName(base = 'layout') {
        const used = new Set(this._viewNames());
        let i = 1, n;
        do { n = base + i++; } while (used.has(n));
        return n;
    }

    /** Create a hidden feezal-view (mirrors feezal-app-editor._addView / layout-flex). */
    _createView(name) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', name);
        const current = feezal.site.querySelector(`feezal-view[name="${feezal.site.view}"]`);
        v.style.cssText = current ? current.style.cssText : 'width:100%;height:100%;background:white';
        v.style.display = 'none';
        v.visible = false;
        feezal.site.append(v);
        feezal.app.views = [...feezal.site.querySelectorAll('feezal-view')];
        if (feezal.site.updateVisibility) feezal.site.updateVisibility();
        feezal.app.requestUpdate();
    }

    _addBreakpoint() {
        const rules = this._rules();
        const name = this._uniqueViewName('layout');
        this._createView(name);
        // First rule added is a fallback (no predicate); later ones default to a max-width.
        const rule = rules.length === 0
            ? {view: name, orientation: 'any'}
            : {view: name, maxWidth: 600, orientation: 'any'};
        this._save([...rules, rule]);
    }

    _setField(i, key, val) {
        const rules = this._rules();
        if (!rules[i]) return;
        if (val === '' || val == null) delete rules[i][key];
        else rules[i][key] = val;
        this._save(rules);
    }

    _move(i, dir) {
        const rules = this._rules();
        const j = i + dir;
        if (j < 0 || j >= rules.length) return;
        [rules[i], rules[j]] = [rules[j], rules[i]];
        this._save(rules);
    }

    _remove(i) {
        const rules = this._rules();
        rules.splice(i, 1);
        this._save(rules);
    }

    _editView(name) { if (name && feezal.app) feezal.app._setView(name); }

    render() {
        if (!this.element) return html``;
        const rules = this._rules();
        const views = this._viewNames();
        return html`
            <div class="section">
                <div class="sec-head">
                    Breakpoints <span class="spacer"></span>
                    <button class="btn" @click="${this._addBreakpoint}">+ add</button>
                </div>
                <div class="sec-body">
                    <div class="hint">
                        Rules are evaluated top-to-bottom; the <b>first match wins</b>. Put narrower / orientation-specific
                        rules first and a predicate-less <i>fallback</i> last. Blank width = unbounded.
                    </div>
                    ${rules.length === 0
                        ? html`<div class="hint">No breakpoints yet. “+ add” creates a view and a fallback rule — click ✎ to edit that view's layout.</div>`
                        : rules.map((r, i) => this._renderRule(r, i, rules.length, views))}
                </div>
            </div>
        `;
    }

    _renderRule(r, i, count, views) {
        return html`
            <div class="rule">
                <div class="rule-head">
                    <span class="rule-num">${i + 1}</span>
                    <sl-select size="small" value="${r.view || ''}"
                        @sl-change="${e => this._setField(i, 'view', e.target.value)}">
                        ${views.map(v => html`<sl-option value="${v}">${v}</sl-option>`)}
                    </sl-select>
                    <button class="ib" title="Edit this breakpoint's view" @click="${() => this._editView(r.view)}">&#9998;</button>
                    <button class="ib" title="Move up" ?disabled="${i === 0}" @click="${() => this._move(i, -1)}">&#8593;</button>
                    <button class="ib" title="Move down" ?disabled="${i === count - 1}" @click="${() => this._move(i, 1)}">&#8595;</button>
                    <button class="ib danger" title="Remove breakpoint" @click="${() => this._remove(i)}">&times;</button>
                </div>
                <div class="cond-row">
                    <div class="field">
                        <label>min width</label>
                        <input type="number" .value="${r.minWidth ?? ''}" placeholder="—"
                            @change="${e => this._setField(i, 'minWidth', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>max width</label>
                        <input type="number" .value="${r.maxWidth ?? ''}" placeholder="—"
                            @change="${e => this._setField(i, 'maxWidth', e.target.value)}">
                    </div>
                    <div class="field">
                        <label>orientation</label>
                        <select @change="${e => this._setField(i, 'orientation', e.target.value)}">
                            ${ORIENTATIONS.map(o => html`<option value="${o}" ?selected="${(r.orientation || 'any') === o}">${o}</option>`)}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-layout-responsive-inspector', FeezalElementLayoutResponsiveInspector);
export {FeezalElementLayoutResponsiveInspector};
