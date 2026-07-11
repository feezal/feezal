/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LitElement} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import DOMPurify from 'dompurify';

/**
 * feezal-element-basic-svg (E51)
 *
 * Renders an SVG asset INLINE (shadow DOM, not <img>) and binds its
 * internals to MQTT — the floor-plan / schematic use case: rooms light up
 * with the lights, pipes recolor with the flow temperature, a needle
 * rotates with a sensor value, sub-shapes publish on click.
 *
 * Three tiers, all in the MVP (decided July 2026):
 *   1. Display — `src` from the Asset Manager (asset-only), fetched,
 *      sanitized (DOMPurify SVG profile) and injected inline; scales to the
 *      element box via viewBox + `preserve-aspect-ratio`.
 *   2. Value bindings — `bindings` JSON attribute, one row per binding:
 *      {selector, subscribe, target, map|range|format?, publish?, payload?}.
 *      Targets: fill | stroke | opacity | visibility | class | text |
 *      rotate | translate | scale. No-match semantics: revert to the SVG's
 *      pristine value (captured on first apply) — a broken payload can't
 *      leave stale state (same revert model as E50).
 *   3. Click regions — rows with a `publish` topic publish `payload` on
 *      click/tap of the sub-shape (hover cursor + keyboard operable).
 *
 * Siblings with E50 conditions, deliberately separate schemas: conditions
 * act boolean on the HOST element; these rows target SUB-NODES via CSS
 * selector with continuous mappings. Host-level conditions still work on
 * this element like on any other.
 */

/** Linear-interpolate two hex colors (#rgb or #rrggbb). Falls back to a hard switch at t=0.5. */
export function lerpColor(a, b, t) {
    const parse = c => {
        const m = String(c).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!m) {
            return null;
        }
        let hex = m[1];
        if (hex.length === 3) {
            hex = hex.split('').map(ch => ch + ch).join('');
        }
        return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    };
    const ca = parse(a);
    const cb = parse(b);
    if (!ca || !cb) {
        return t < 0.5 ? String(a) : String(b);
    }
    const mix = ca.map((v, i) => Math.round(v + t * (cb[i] - v)));
    return '#' + mix.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute a binding row's output for an incoming value.
 * At most one mapping field per row: `map` (discrete lookup), `range`
 * (clamped linear interpolation — numbers AND colors), `format`
 * (`${value}` template). No mapping field = raw passthrough.
 *
 * @returns {{matched: boolean, out: string|null}} — matched:false means
 *          "revert to pristine" (unmatched map key / non-numeric range input).
 */
export function computeBindingOutput(row, value) {
    const raw = (value !== null && typeof value === 'object') ? JSON.stringify(value) : String(value ?? '');

    if (row.map && typeof row.map === 'object') {
        if (Object.prototype.hasOwnProperty.call(row.map, raw)) {
            return {matched: true, out: String(row.map[raw])};
        }
        return {matched: false, out: null};
    }

    if (row.range && typeof row.range === 'object') {
        const n = Number(raw);
        if (raw.trim() === '' || !Number.isFinite(n)) {
            return {matched: false, out: null};
        }
        const [i0, i1] = Array.isArray(row.range.in) ? row.range.in.map(Number) : [0, 1];
        const [o0, o1] = Array.isArray(row.range.out) ? row.range.out : [0, 1];
        let t = (n - i0) / ((i1 - i0) || 1);
        t = Math.min(1, Math.max(0, t));   // clamped (decided)
        if (typeof o0 === 'number' && typeof o1 === 'number') {
            const out = o0 + t * (o1 - o0);
            return {matched: true, out: String(Math.round(out * 1000) / 1000)};
        }
        return {matched: true, out: lerpColor(o0, o1, t)};
    }

    if (row.format !== undefined && row.format !== null && row.format !== '') {
        return {matched: true, out: String(row.format).split('${value}').join(raw)};
    }

    return {matched: true, out: raw};
}

const TARGETS = ['fill', 'stroke', 'opacity', 'visibility', 'class', 'text', 'rotate', 'translate', 'scale'];
const TRANSFORM_TARGETS = new Set(['rotate', 'translate', 'scale']);

function transformValue(target, out) {
    if (target === 'rotate') {
        return `rotate(${Number(out) || 0}deg)`;
    }
    if (target === 'scale') {
        return `scale(${Number(out) || 1})`;
    }
    // translate: "x,y" / "x y" or a single number for both axes
    const parts = String(out).split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const [x = 0, y = parts.length > 1 ? 0 : undefined] = parts;
    return `translate(${x}px, ${y ?? x}px)`;
}

class FeezalElementBasicSvg extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'SVG', category: 'Basic', color: '#4a6080', icon: 'polyline'},
            description: 'Inline SVG (floor plan / schematic) with per-shape MQTT bindings: ' +
                'recolor, rotate, show/hide or fill text on sub-shapes by CSS selector, and ' +
                'publish on shape clicks.',
            attributes: [
                {name: 'src', type: 'string', help: 'SVG asset URL (upload via the Asset Manager, e.g. assets/floorplan.svg). Fetched, sanitized and rendered inline.'},
                {name: 'preserve-aspect-ratio', type: 'select',
                 options: ['xMidYMid meet', 'xMidYMid slice', 'none'], default: 'xMidYMid meet',
                 help: 'How the SVG scales into the element box (SVG preserveAspectRatio).'},
                {name: 'bindings', type: 'string',
                 help: 'JSON array of binding rows — edited via the custom inspector.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within MQTT messages (applies to all binding rows). Default: payload'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '240px', height: '180px'},
            restrict: {minWidth: 40, minHeight: 40},
            inspector: 'feezal-element-basic-svg-inspector',
        };
    }

    static properties = {
        src:                 {type: String, reflect: true},
        preserveAspectRatio: {type: String, reflect: true, attribute: 'preserve-aspect-ratio'},
        bindings:            {type: String, attribute: 'bindings'},
        _markup:             {state: true},
        _error:              {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; position: relative; }
        .wrap, .wrap svg { width: 100%; height: 100%; display: block; }
        .hint {
            display: flex; align-items: center; justify-content: center; height: 100%;
            padding: 8px; box-sizing: border-box; text-align: center;
            font-size: 12px; color: var(--secondary-text-color, #888);
            border: 1px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
        .badge {
            position: absolute; right: 4px; bottom: 4px; z-index: 1;
            font-size: 10px; padding: 1px 6px; border-radius: 8px;
            background: color-mix(in srgb, var(--sl-color-primary-600, #0284c7) 15%, transparent);
            color: var(--sl-color-primary-600, #0284c7);
            pointer-events: none;
        }
        .clickable { cursor: pointer; }
        .clickable:focus-visible { outline: 2px solid var(--sl-color-primary-600, #0284c7); }
    `];

    constructor() {
        super();
        this.src = '';
        this.preserveAspectRatio = 'xMidYMid meet';
        this.bindings = '';
        this._markup = '';
        this._error = '';
        this._rowState = [];        // per row: {node, captured, pristine, lastValue, hasValue}
        this._bindingsSubscribed = false;
    }

    /** Parsed binding rows ([] on unparseable/absent). */
    get bindingRows() {
        try {
            const rows = JSON.parse(this.bindings || '[]');
            return Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object') : [];
        } catch {
            return [];
        }
    }

    // ── Subscriptions (dynamic-subscription gated via the base class) ────────

    _subscribe() {
        super._subscribe();          // base `subscribe` topic + control channel
        if (this._bindingsSubscribed) {
            return;
        }
        this._bindingsSubscribed = true;
        this.bindingRows.forEach((row, index) => {
            if (!row.subscribe) {
                return;
            }
            this.addSubscription(row.subscribe, msg => {
                const value = this.getProperty(msg, this.messageProperty);
                const state = (this._rowState[index] ||= {});
                state.lastValue = value;
                state.hasValue = true;
                this._applyRow(row, index, value);
            });
        });
    }

    _unsubscribe() {
        super._unsubscribe();
        this._bindingsSubscribed = false;
    }

    // ── SVG loading ──────────────────────────────────────────────────────────

    connectedCallback() {
        super.connectedCallback();
        this._loadSvg();
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('src')) {
            this._loadSvg();
        }
        if (changed.has('bindings')) {
            // rows edited: reset state + resubscribe with the new rows
            this._rowState = [];
            if (this._bindingsSubscribed) {
                this._unsubscribe();
                this._subscribe();
            }
        }
        if (changed.has('_markup') || changed.has('bindings') || changed.has('preserveAspectRatio')) {
            this._wireSvg();
        }
    }

    async _loadSvg() {
        const src = this.src;
        if (!src) {
            this._markup = '';
            this._error = '';
            return;
        }
        try {
            const res = await fetch(src);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const text = await res.text();
            if (this.src !== src) {
                return;   // src changed while fetching
            }
            // Sanitize even self-hosted assets — an uploaded SVG may carry
            // scripts / event handlers / external hrefs.
            this._markup = DOMPurify.sanitize(text, {USE_PROFILES: {svg: true, svgFilters: true}});
            this._error = '';
        } catch (err) {
            this._markup = '';
            this._error = `${src}: ${err.message}`;
        }
    }

    /** After (re)injection: scale the svg, resolve binding nodes, re-apply last values, wire clicks. */
    _wireSvg() {
        const svg = this.renderRoot.querySelector('.wrap svg');
        if (!svg) {
            return;
        }
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', this.preserveAspectRatio || 'xMidYMid meet');

        this.bindingRows.forEach((row, index) => {
            const state = (this._rowState[index] ||= {});
            let node = null;
            try {
                node = row.selector ? svg.querySelector(row.selector) : null;
            } catch { /* invalid selector */ }
            if (state.node !== node) {
                // fresh injection → pristine must be re-captured on this node
                state.node = node;
                state.captured = false;
            }
            if (!node) {
                return;
            }

            // Tier 3: click region
            if (row.publish && !node._feezalSvgClick) {
                node._feezalSvgClick = true;
                node.classList.add('clickable');
                node.setAttribute('tabindex', '0');
                node.setAttribute('role', 'button');
                const fire = () => {
                    if (feezal.isEditor) {
                        return;
                    }
                    feezal.connection.pub(row.publish, row.payload ?? '1');
                };
                node.addEventListener('click', fire);
                node.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fire();
                    }
                });
            }

            if (state.hasValue) {
                this._applyRow(row, index, state.lastValue);
            }
        });
    }

    // ── Binding application (pristine capture + revert) ─────────────────────

    _readTarget(node, target) {
        if (target === 'text') {
            return node.textContent;
        }
        if (target === 'class') {
            return node.getAttribute('class') || '';
        }
        if (TRANSFORM_TARGETS.has(target)) {
            return node.style.transform || '';
        }
        return node.style.getPropertyValue(target);
    }

    _writeTarget(node, target, value) {
        if (target === 'text') {
            node.textContent = value;
        } else if (target === 'class') {
            node.setAttribute('class', value);
        } else if (TRANSFORM_TARGETS.has(target)) {
            node.style.transformBox = 'fill-box';
            node.style.transformOrigin = 'center';
            node.style.transform = value;
        } else if (value === '' || value === null) {
            node.style.removeProperty(target);
        } else {
            node.style.setProperty(target, value);
        }
    }

    _applyRow(row, index, value) {
        const state = this._rowState[index];
        const node = state?.node;
        const target = TARGETS.includes(row.target) ? row.target : null;
        if (!node || !target) {
            return;
        }

        if (!state.captured) {
            state.captured = true;
            state.pristine = this._readTarget(node, target);
        }

        const result = computeBindingOutput(row, value);
        if (!result.matched) {
            // Revert to the SVG's original — a broken payload can't leave stale state.
            this._writeTarget(node, target, state.pristine);
            return;
        }

        let out = result.out;
        if (target === 'class') {
            out = (state.pristine ? state.pristine + ' ' : '') + out;
        } else if (TRANSFORM_TARGETS.has(target)) {
            out = transformValue(target, out);
        }
        this._writeTarget(node, target, out);
    }

    render() {
        const rowCount = this.bindingRows.length;
        return html`
            ${this._markup
                ? html`<div class="wrap">${unsafeHTML(this._markup)}</div>`
                : html`<div class="hint">${this._error
                    ? html`SVG failed to load — ${this._error}`
                    : html`Set an SVG asset via <b>src</b>`}</div>`}
            ${feezal.isEditor && rowCount ? html`<div class="badge">${rowCount} binding${rowCount === 1 ? '' : 's'}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-basic-svg', FeezalElementBasicSvg);

// ── Custom inspector ─────────────────────────────────────────────────────────
// Editor-only; uses <sl-*> tags without importing Shoelace (editor bundle
// defines them) — same pattern as system-notification / material-dialog.

const MODES = ['raw', 'map', 'range', 'format'];

function rowMode(row) {
    if (row.map) return 'map';
    if (row.range) return 'range';
    if (row.format !== undefined && row.format !== '') return 'format';
    return 'raw';
}

class FeezalElementBasicSvgInspector extends LitElement {
    static properties = {
        element: {attribute: false},
        _rows:   {state: true},
    };

    static styles = css`
        :host { display: block; padding: 12px; }
        .row-block {
            border: 1px solid var(--feezal-border, #ddd); border-radius: 6px;
            padding: 8px; margin-bottom: 8px;
            display: flex; flex-direction: column; gap: 6px;
        }
        .row-head { display: flex; align-items: center; gap: 6px; }
        .row-head .sel { flex: 1; min-width: 0; }
        .del {
            border: none; background: none; cursor: pointer; padding: 2px;
            color: var(--feezal-color, #888); font-size: 14px; line-height: 1;
        }
        .del:hover { color: var(--error-color, #d32f2f); }
        .pair { display: flex; gap: 6px; }
        .pair > * { flex: 1; min-width: 0; }
        .map-rows { display: flex; flex-direction: column; gap: 4px; }
        .map-row { display: flex; gap: 4px; align-items: center; }
        .map-row > sl-input { flex: 1; min-width: 0; }
        .add-btn, .add-map {
            border: 1px dashed var(--feezal-border, #bbb); border-radius: 4px;
            background: none; cursor: pointer; padding: 6px;
            color: var(--feezal-color, #666); font: inherit; font-size: 12px;
            width: 100%;
        }
        .add-map { padding: 3px; font-size: 11px; width: auto; align-self: flex-start; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
        .top { margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
    `;

    constructor() {
        super();
        this.element = null;
        this._rows = [];
    }

    willUpdate(changed) {
        if (changed.has('element') && this.element) {
            this._rows = this.element.bindingRows;
        }
    }

    _set(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true,
            detail: {name, value},
        }));
    }

    _commitRows() {
        this._rows = [...this._rows];
        this._set('bindings', JSON.stringify(this._rows));
    }

    _patch(index, patch) {
        Object.assign(this._rows[index], patch);
        this._commitRows();
    }

    _setMode(index, mode) {
        const row = this._rows[index];
        delete row.map;
        delete row.range;
        delete row.format;
        if (mode === 'map') {
            row.map = {};
        } else if (mode === 'range') {
            row.range = {in: [0, 100], out: [0, 1]};
        } else if (mode === 'format') {
            row.format = '${value}';
        }
        this._commitRows();
    }

    _patchRange(index, part, at, value) {
        const range = this._rows[index].range || (this._rows[index].range = {in: [0, 100], out: [0, 1]});
        const arr = [...(range[part] || [0, 0])];
        const n = Number(value);
        arr[at] = (part === 'in') ? (Number.isFinite(n) ? n : 0) : (Number.isFinite(n) && value.trim() !== '' ? n : value);
        range[part] = arr;
        this._commitRows();
    }

    _mapEntries(row) {
        return Object.entries(row.map || {});
    }

    _patchMap(index, entries) {
        this._rows[index].map = Object.fromEntries(entries.filter(([k]) => k !== ''));
        // keep empty-key drafts in the UI state without persisting them
        this._draftMaps = {...(this._draftMaps || {}), [index]: entries};
        this._commitRows();
    }

    render() {
        if (!this.element) {
            return html``;
        }
        const el = this.element;
        return html`
            <div class="top">
                <sl-input label="src" size="small" autocomplete="off"
                    help-text="SVG asset URL (Asset Manager)"
                    .value=${el.src || ''}
                    @sl-change=${e => this._set('src', e.target.value)}>
                </sl-input>
                <sl-select label="preserve-aspect-ratio" size="small"
                    .value=${(el.preserveAspectRatio || 'xMidYMid meet').replace(/ /g, '_')}
                    @sl-change=${e => this._set('preserve-aspect-ratio', e.target.value.replace(/_/g, ' '))}>
                    ${['xMidYMid meet', 'xMidYMid slice', 'none'].map(v => html`
                        <sl-option value=${v.replace(/ /g, '_')}>${v}</sl-option>`)}
                </sl-select>
                <sl-input label="message-property" size="small" autocomplete="off" placeholder="payload"
                    .value=${el.messageProperty === 'payload' ? '' : (el.messageProperty || '')}
                    @sl-change=${e => this._set('message-property', e.target.value || 'payload')}>
                </sl-input>
            </div>

            <div class="label" style="margin-bottom:6px">Bindings</div>
            ${this._rows.map((row, i) => this._renderRow(row, i))}
            <button class="add-btn" @click=${() => { this._rows.push({selector: '', subscribe: '', target: 'fill'}); this._commitRows(); }}>
                ＋ add binding
            </button>
        `;
    }

    _renderRow(row, i) {
        const mode = rowMode(row);
        const mapEntries = (this._draftMaps || {})[i] || this._mapEntries(row);
        return html`
            <div class="row-block">
                <div class="row-head">
                    <sl-input class="sel" size="small" autocomplete="off" placeholder="#selector"
                        .value=${row.selector || ''}
                        @sl-change=${e => this._patch(i, {selector: e.target.value})}>
                    </sl-input>
                    <button class="del" title="Remove binding" @click=${() => { this._rows.splice(i, 1); this._commitRows(); }}>✕</button>
                </div>
                <sl-input size="small" autocomplete="off" placeholder="subscribe topic"
                    .value=${row.subscribe || ''}
                    @sl-change=${e => this._patch(i, {subscribe: e.target.value})}>
                </sl-input>
                <div class="pair">
                    <sl-select size="small" .value=${TARGETS.includes(row.target) ? row.target : 'fill'}
                        @sl-change=${e => this._patch(i, {target: e.target.value})}>
                        ${TARGETS.map(t => html`<sl-option value=${t}>${t}</sl-option>`)}
                    </sl-select>
                    <sl-select size="small" .value=${mode}
                        @sl-change=${e => this._setMode(i, e.target.value)}>
                        ${MODES.map(m => html`<sl-option value=${m}>${m}</sl-option>`)}
                    </sl-select>
                </div>

                ${mode === 'map' ? html`
                    <div class="map-rows">
                        ${mapEntries.map(([k, v], mi) => html`
                            <div class="map-row">
                                <sl-input size="small" autocomplete="off" placeholder="payload"
                                    .value=${k}
                                    @sl-change=${e => { const es = [...mapEntries]; es[mi] = [e.target.value, v]; this._patchMap(i, es); }}>
                                </sl-input>
                                <span>→</span>
                                <sl-input size="small" autocomplete="off" placeholder="value"
                                    .value=${String(v)}
                                    @sl-change=${e => { const es = [...mapEntries]; es[mi] = [k, e.target.value]; this._patchMap(i, es); }}>
                                </sl-input>
                                <button class="del" @click=${() => { const es = mapEntries.filter((_, x) => x !== mi); this._patchMap(i, es); }}>✕</button>
                            </div>`)}
                        <button class="add-map" @click=${() => this._patchMap(i, [...mapEntries, ['', '']])}>＋ mapping</button>
                    </div>` : ''}

                ${mode === 'range' ? html`
                    <div class="label">in → out (numbers or #colors, clamped)</div>
                    <div class="pair">
                        <sl-input size="small" autocomplete="off" placeholder="in from" .value=${String(row.range?.in?.[0] ?? 0)}
                            @sl-change=${e => this._patchRange(i, 'in', 0, e.target.value)}></sl-input>
                        <sl-input size="small" autocomplete="off" placeholder="in to" .value=${String(row.range?.in?.[1] ?? 100)}
                            @sl-change=${e => this._patchRange(i, 'in', 1, e.target.value)}></sl-input>
                    </div>
                    <div class="pair">
                        <sl-input size="small" autocomplete="off" placeholder="out from" .value=${String(row.range?.out?.[0] ?? 0)}
                            @sl-change=${e => this._patchRange(i, 'out', 0, e.target.value)}></sl-input>
                        <sl-input size="small" autocomplete="off" placeholder="out to" .value=${String(row.range?.out?.[1] ?? 1)}
                            @sl-change=${e => this._patchRange(i, 'out', 1, e.target.value)}></sl-input>
                    </div>` : ''}

                ${mode === 'format' ? html`
                    <sl-input size="small" autocomplete="off" placeholder="\${value} °C"
                        .value=${row.format || ''}
                        @sl-change=${e => this._patch(i, {format: e.target.value})}>
                    </sl-input>` : ''}

                <div class="pair">
                    <sl-input size="small" autocomplete="off" placeholder="publish on click (optional)"
                        .value=${row.publish || ''}
                        @sl-change=${e => this._patch(i, {publish: e.target.value})}>
                    </sl-input>
                    <sl-input size="small" autocomplete="off" placeholder="click payload"
                        .value=${row.payload ?? ''}
                        @sl-change=${e => this._patch(i, {payload: e.target.value})}>
                    </sl-input>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-basic-svg-inspector', FeezalElementBasicSvgInspector);

export {FeezalElementBasicSvg};
