import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

/**
 * feezal-style-editor-background (N34)
 *
 * The first custom style-group editor: a unified Background editor with the
 * modes None / Solid colour / Image / Gradient. Declared on an element's
 * `feezal().styles` as
 *     {group: 'background', editor: 'feezal-style-editor-background', label: 'Background'}
 * and mounted by the style inspector, which passes the selection in via
 * `.elements` (primary in `.element`) and applies the multi-property
 * `feezal-style-changed` events ({props: {'background-image': …, …}},
 * null = remove) this editor emits.
 *
 * The editor owns the whole background longhand family (`static covers`) and
 * never writes the `background` shorthand — but it always CLEARS it, so a
 * pre-existing inline shorthand (whose values the CSSOM already exposes
 * through the longhand getters used for reading) migrates to longhands on
 * the first edit.
 *
 * Editor-bundle only (www/src/): authoring UI — only the authored inline
 * style travels with the saved/exported site.
 */

const SIZES = ['cover', 'contain', 'auto'];
const REPEATS = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];
const ANCHORS = [
    'left top', 'center top', 'right top',
    'left center', 'center center', 'right center',
    'left bottom', 'center bottom', 'right bottom',
];

class FeezalStyleEditorBackground extends LitElement {
    /** Longhand family owned by this editor (+ the shorthand, kept cleared). */
    static covers = [
        'background',
        'background-color',
        'background-image',
        'background-size',
        'background-repeat',
        'background-position',
    ];

    static properties = {
        elements: {type: Array},
        element:  {type: Object},
        _mode:    {state: true},   // 'none' | 'solid' | 'image' | 'gradient'
        _mixed:   {state: true},
        _color:   {state: true},
        _url:     {state: true},
        _size:    {state: true},   // cover | contain | auto | custom
        _sizeCustom: {state: true},
        _repeat:  {state: true},
        _position: {state: true},  // one of ANCHORS or 'custom'
        _posCustom: {state: true},
        _gradType:  {state: true}, // linear | radial
        _gradAngle: {state: true},
        _gradShape: {state: true}, // circle | ellipse
        _stops:     {state: true}, // [{color, pos}]
    };

    constructor() {
        super();
        this.elements = [];
        this.element = null;
        this._mode = 'none';
        this._mixed = false;
        this._color = '#808080';
        this._url = '';
        this._size = 'cover';
        this._sizeCustom = '';
        this._repeat = 'no-repeat';
        this._position = 'center center';
        this._posCustom = '';
        this._gradType = 'linear';
        this._gradAngle = 180;
        this._gradShape = 'ellipse';
        this._stops = [{color: '#0284c7', pos: 0}, {color: '#1e293b', pos: 100}];
    }

    static styles = css`
        :host { display: block; font-size: 12px; color: var(--feezal-color, #333); }
        .modes { display: flex; gap: 2px; margin-bottom: 8px; }
        .modes button {
            flex: 1; padding: 4px 0; font-size: 11px; cursor: pointer;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #333);
            border-radius: 3px;
        }
        .modes button.active {
            background: var(--sl-color-primary-600, #0284c7);
            border-color: var(--sl-color-primary-600, #0284c7);
            color: #fff;
        }
        .mixed-note { font-size: 11px; color: var(--feezal-color, #999); opacity: 0.7; margin-bottom: 6px; }
        .row { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
        .row > sl-input, .row > sl-select { flex: 1; min-width: 0; }
        .row label { font-size: 11px; color: var(--feezal-color, #666); flex-shrink: 0; }
        input[type=color] {
            width: 32px; height: 28px; padding: 2px; flex-shrink: 0; cursor: pointer;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff); border-radius: 3px;
        }
        input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type=color]::-webkit-color-swatch { border: none; border-radius: 2px; }
        sl-input::part(base), sl-select::part(combobox) {
            background: var(--feezal-bg, #fff);
            border-color: var(--feezal-border, #ccc);
            color: var(--feezal-color, #333);
        }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }

        /* 3×3 position anchor grid */
        .anchor-grid {
            display: grid; grid-template-columns: repeat(3, 20px); gap: 2px; flex-shrink: 0;
        }
        .anchor-grid button {
            width: 20px; height: 20px; padding: 0; cursor: pointer;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff); border-radius: 2px;
            display: flex; align-items: center; justify-content: center;
        }
        .anchor-grid button::after {
            content: ''; width: 6px; height: 6px; border-radius: 50%;
            background: var(--feezal-color, #999); opacity: 0.35;
        }
        .anchor-grid button.active { border-color: var(--sl-color-primary-600, #0284c7); }
        .anchor-grid button.active::after { background: var(--sl-color-primary-600, #0284c7); opacity: 1; }

        /* gradient stops */
        .stop-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
        .stop-row sl-input { flex: 1; min-width: 0; }
        .stop-row .pct { width: 58px; flex: none; }
        .stop-btn {
            width: 20px; height: 24px; padding: 0; border: none; background: none; cursor: pointer;
            color: var(--feezal-color, #666); font-size: 13px; border-radius: 3px; opacity: 0.6;
        }
        .stop-btn:hover { opacity: 1; }
        .stop-btn:disabled { opacity: 0.15; cursor: default; }
        .add-stop {
            border: 1px dashed var(--feezal-border, #ccc); background: none; cursor: pointer;
            color: var(--feezal-color, #666); font-size: 11px; border-radius: 3px;
            padding: 3px 8px; margin-bottom: 6px;
        }
        .preview {
            height: 28px; border-radius: 3px; border: 1px solid var(--feezal-border, #ccc);
            margin-bottom: 6px;
        }
    `;

    willUpdate(changed) {
        if (changed.has('elements')) this._readFromElement();
    }

    /** Re-read the authored state (called by the inspector on out-of-band changes). */
    refresh() {
        this._readFromElement();
        this.requestUpdate();
    }

    // ── Reading ───────────────────────────────────────────────────────────

    _readFromElement() {
        const el = (this.elements && this.elements[0]) || this.element;
        if (!el) { this._mode = 'none'; this._mixed = false; return; }

        // Mixed detection across the selection (reads come from the primary).
        const covered = FeezalStyleEditorBackground.covers;
        this._mixed = (this.elements?.length ?? 0) > 1 && this.elements.some(e =>
            covered.some(p => e.style.getPropertyValue(p) !== el.style.getPropertyValue(p)));

        // Inline longhands (an inline `background` shorthand is expanded into
        // these by the CSSOM, so it reads correctly too). Fallback: read the
        // shorthand directly for engines that don't expand it.
        let image = el.style.getPropertyValue('background-image').trim();
        let color = el.style.getPropertyValue('background-color').trim();
        if (!image && !color) {
            const short = el.style.getPropertyValue('background').trim();
            if (short.includes('url(') || short.includes('gradient')) image = short;
            else if (short) color = short;
        }

        if (image.includes('url(')) {
            this._mode = 'image';
            const m = image.match(/url\(\s*(['"]?)(.*?)\1\s*\)/);
            this._url = m ? m[2] : '';
            this._readImageDetails(el);
        } else if (image.includes('gradient')) {
            this._mode = 'gradient';
            this._parseGradient(image);
        } else if (color) {
            this._mode = 'solid';
            this._color = this._hexish(color) || this._color;
        } else {
            this._mode = 'none';
        }
    }

    _readImageDetails(el) {
        const size = el.style.getPropertyValue('background-size').trim();
        if (!size || SIZES.includes(size)) {
            this._size = size || 'auto';
            this._sizeCustom = '';
        } else {
            this._size = 'custom';
            this._sizeCustom = size;
        }
        this._repeat = el.style.getPropertyValue('background-repeat').trim() || 'repeat';
        const pos = this._normalizePosition(el.style.getPropertyValue('background-position').trim());
        if (!pos) {
            this._position = 'center center';
            this._posCustom = '';
        } else if (ANCHORS.includes(pos)) {
            this._position = pos;
            this._posCustom = '';
        } else {
            this._position = 'custom';
            this._posCustom = pos;
        }
    }

    /** Map single-keyword / reordered positions onto the 3×3 anchor naming. */
    _normalizePosition(pos) {
        if (!pos) return '';
        const parts = pos.split(/\s+/);
        if (parts.length === 1) {
            if (parts[0] === 'center') return 'center center';
            if (['left', 'right'].includes(parts[0])) return `${parts[0]} center`;
            if (['top', 'bottom'].includes(parts[0])) return `center ${parts[0]}`;
            return pos;
        }
        if (parts.length === 2) {
            const [a, b] = parts;
            if (['top', 'bottom'].includes(a) && ['left', 'right', 'center'].includes(b)) return `${b} ${a}`;
            return pos;
        }
        return pos;
    }

    _hexish(color) {
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
            return color.length === 4 ? '#' + [...color.slice(1)].map(c => c + c).join('') : color;
        }
        const m = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
        if (m) {
            const hex = n => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0');
            return '#' + hex(m[1]) + hex(m[2]) + hex(m[3]);
        }
        const NAMED = {
            black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
            blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
            gray: '#808080', grey: '#808080', silver: '#c0c0c0', orange: '#ffa500',
            purple: '#800080', brown: '#a52a2a', pink: '#ffc0cb',
        };
        return NAMED[color.toLowerCase()] || '';
    }

    /** Parse the gradients we serialise; anything else keeps the defaults. */
    _parseGradient(image) {
        let m = image.match(/^linear-gradient\(\s*([\d.]+)deg\s*,\s*(.*)\)$/);
        if (m) {
            this._gradType = 'linear';
            this._gradAngle = parseFloat(m[1]);
            this._stops = this._parseStops(m[2]) || this._stops;
            return;
        }
        m = image.match(/^radial-gradient\(\s*(circle|ellipse)\s*,\s*(.*)\)$/);
        if (m) {
            this._gradType = 'radial';
            this._gradShape = m[1];
            this._stops = this._parseStops(m[2]) || this._stops;
        }
    }

    _parseStops(text) {
        const stops = [];
        // Split on commas that are not inside parentheses (rgb()/rgba() stops).
        for (const part of text.split(/,(?![^(]*\))/)) {
            const m = part.trim().match(/^(.+?)\s+([\d.]+)%$/);
            if (!m) return null;
            const color = this._hexish(m[1].trim());
            if (!color) return null;
            stops.push({color, pos: parseFloat(m[2])});
        }
        return stops.length >= 2 ? stops : null;
    }

    // ── Writing ───────────────────────────────────────────────────────────

    /** Emit a multi-property change; the shorthand is always cleared. */
    _emit(props) {
        this.dispatchEvent(new CustomEvent('feezal-style-changed', {
            detail: {props: {background: null, ...props}},
            bubbles: true,
            composed: true,
        }));
    }

    _sizeValue() {
        return this._size === 'custom' ? (this._sizeCustom.trim() || 'cover') : this._size;
    }

    _positionValue() {
        return this._position === 'custom' ? (this._posCustom.trim() || 'center center') : this._position;
    }

    _gradientValue() {
        const stops = this._stops.map(s => `${s.color} ${s.pos}%`).join(', ');
        return this._gradType === 'radial'
            ? `radial-gradient(${this._gradShape}, ${stops})`
            : `linear-gradient(${this._gradAngle}deg, ${stops})`;
    }

    _emitCurrent() {
        if (this._mode === 'none') {
            this._emit({
                'background-color': null,
                'background-image': null,
                'background-size': null,
                'background-repeat': null,
                'background-position': null,
            });
        } else if (this._mode === 'solid') {
            this._emit({
                'background-color': this._color,
                'background-image': null,
                'background-size': null,
                'background-repeat': null,
                'background-position': null,
            });
        } else if (this._mode === 'image') {
            this._emit({
                'background-image': this._url.trim() ? `url('${this._url.trim()}')` : null,
                'background-size': this._sizeValue(),
                'background-repeat': this._repeat,
                'background-position': this._positionValue(),
            });
        } else if (this._mode === 'gradient') {
            this._emit({
                'background-color': null,
                'background-image': this._gradientValue(),
                'background-size': null,
                'background-repeat': null,
                'background-position': null,
            });
        }
    }

    _setMode(mode) {
        if (mode === this._mode) return;
        this._mode = mode;
        if (mode === 'image' && !this._url) {
            // Sensible photo defaults, matching the N33 quick action.
            this._size = 'cover';
            this._repeat = 'no-repeat';
            this._position = 'center center';
            // Nothing to apply yet without a URL — wait for one.
            return;
        }
        this._emitCurrent();
    }

    // ── Gradient stop editing ─────────────────────────────────────────────

    _stopChanged(i, patch) {
        this._stops = this._stops.map((s, idx) => idx === i ? {...s, ...patch} : s);
        this._emitCurrent();
    }

    _moveStop(i, dir) {
        const j = i + dir;
        if (j < 0 || j >= this._stops.length) return;
        const stops = [...this._stops];
        [stops[i], stops[j]] = [stops[j], stops[i]];
        this._stops = stops;
        this._emitCurrent();
    }

    _removeStop(i) {
        if (this._stops.length <= 2) return;
        this._stops = this._stops.filter((_, idx) => idx !== i);
        this._emitCurrent();
    }

    _addStop() {
        const last = this._stops[this._stops.length - 1];
        this._stops = [...this._stops, {color: last?.color || '#ffffff', pos: 100}];
        this._emitCurrent();
    }

    // ── Render ────────────────────────────────────────────────────────────

    render() {
        return html`
            ${this._mixed ? html`<div class="mixed-note">— values vary across the selection; edits apply to all —</div>` : ''}
            <div class="modes">
                ${['none', 'solid', 'image', 'gradient'].map(m => html`
                    <button class="${this._mode === m ? 'active' : ''}"
                        @click="${() => this._setMode(m)}">${m[0].toUpperCase() + m.slice(1)}</button>
                `)}
            </div>
            ${this._mode === 'solid' ? this._renderSolid() : ''}
            ${this._mode === 'image' ? this._renderImage() : ''}
            ${this._mode === 'gradient' ? this._renderGradient() : ''}
        `;
    }

    _renderSolid() {
        return html`
            <div class="row">
                <label>colour</label>
                <input type="color" .value="${this._color}"
                    @input="${e => { this._color = e.target.value; this._emitCurrent(); }}">
            </div>
        `;
    }

    _renderImage() {
        return html`
            <div class="row">
                <sl-input size="small" placeholder="/assets/…  (asset manager → Set as background)"
                    .value="${this._url}"
                    @sl-change="${e => { this._url = e.target.value; this._emitCurrent(); }}">
                </sl-input>
            </div>
            <div class="row">
                <label>size</label>
                <sl-select size="small" .value="${this._size}"
                    @sl-change="${e => { this._size = e.target.value; this._emitCurrent(); }}">
                    ${[...SIZES, 'custom'].map(s => html`<sl-option value="${s}">${s}</sl-option>`)}
                </sl-select>
            </div>
            ${this._size === 'custom' ? html`
                <div class="row">
                    <sl-input size="small" placeholder="e.g. 100% auto" .value="${this._sizeCustom}"
                        @sl-change="${e => { this._sizeCustom = e.target.value; this._emitCurrent(); }}">
                    </sl-input>
                </div>
            ` : ''}
            <div class="row">
                <label>repeat</label>
                <sl-select size="small" .value="${this._repeat}"
                    @sl-change="${e => { this._repeat = e.target.value; this._emitCurrent(); }}">
                    ${REPEATS.map(r => html`<sl-option value="${r}">${r}</sl-option>`)}
                </sl-select>
            </div>
            <div class="row">
                <label>position</label>
                <div class="anchor-grid">
                    ${ANCHORS.map(a => html`
                        <button title="${a}" class="${this._position === a ? 'active' : ''}"
                            @click="${() => { this._position = a; this._posCustom = ''; this._emitCurrent(); }}"></button>
                    `)}
                </div>
                <sl-input size="small" placeholder="custom…" .value="${this._position === 'custom' ? this._posCustom : ''}"
                    @sl-change="${e => {
                        const v = e.target.value.trim();
                        if (v) { this._position = 'custom'; this._posCustom = v; }
                        else { this._position = 'center center'; this._posCustom = ''; }
                        this._emitCurrent();
                    }}">
                </sl-input>
            </div>
        `;
    }

    _renderGradient() {
        return html`
            <div class="preview" style="background: ${this._gradientValue()}"></div>
            <div class="row">
                <label>type</label>
                <sl-select size="small" .value="${this._gradType}"
                    @sl-change="${e => { this._gradType = e.target.value; this._emitCurrent(); }}">
                    <sl-option value="linear">linear</sl-option>
                    <sl-option value="radial">radial</sl-option>
                </sl-select>
                ${this._gradType === 'linear' ? html`
                    <sl-input class="pct" size="small" type="number" .value="${String(this._gradAngle)}"
                        @sl-change="${e => { this._gradAngle = parseFloat(e.target.value) || 0; this._emitCurrent(); }}">
                        <span slot="suffix">°</span>
                    </sl-input>
                ` : html`
                    <sl-select size="small" .value="${this._gradShape}"
                        @sl-change="${e => { this._gradShape = e.target.value; this._emitCurrent(); }}">
                        <sl-option value="ellipse">ellipse</sl-option>
                        <sl-option value="circle">circle</sl-option>
                    </sl-select>
                `}
            </div>
            ${this._stops.map((s, i) => html`
                <div class="stop-row">
                    <input type="color" .value="${s.color}"
                        @input="${e => this._stopChanged(i, {color: e.target.value})}">
                    <sl-input class="pct" size="small" type="number" min="0" max="100" .value="${String(s.pos)}"
                        @sl-change="${e => this._stopChanged(i, {pos: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))})}">
                        <span slot="suffix">%</span>
                    </sl-input>
                    <button class="stop-btn" title="Move up" ?disabled="${i === 0}"
                        @click="${() => this._moveStop(i, -1)}">↑</button>
                    <button class="stop-btn" title="Move down" ?disabled="${i === this._stops.length - 1}"
                        @click="${() => this._moveStop(i, 1)}">↓</button>
                    <button class="stop-btn" title="Remove stop" ?disabled="${this._stops.length <= 2}"
                        @click="${() => this._removeStop(i)}">×</button>
                </div>
            `)}
            <button class="add-stop" @click="${() => this._addStop()}">+ add stop</button>
        `;
    }
}

window.customElements.define('feezal-style-editor-background', FeezalStyleEditorBackground);

export {FeezalStyleEditorBackground};
