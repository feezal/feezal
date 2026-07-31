/* global feezal */
import {feezalBoolean, html} from '@feezal/feezal-element';
import {findColorRange, resolveRangeColor} from '@feezal/feezal-element/feezal-color-ranges.js';
import {formatNumber} from '@feezal/feezal-element/feezal-locale.js';
import {svg} from 'lit';

/**
 * @feezal/feezal-gauge (E151)
 *
 * Shared analogue-gauge geometry + attribute contract for the family gauge
 * cards (circle-gauge, glass-gauge, metro-gauge). Intentionally NOT named
 * `feezal-element-*` — the server's package scan treats every
 * `feezal-element-*` directory as a dashboard element and would try to
 * palette/bundle it (see server/src/build/elements.js `_scan()`). Pure
 * code-sharing package, same precedent as `@feezal/feezal-glass` and
 * `@feezal/feezal-metro`.
 *
 * Extracted verbatim from `feezal-element-circle-gauge` (E139) when the glass
 * and metro families got their gauges — the dial maths is derived ONCE here so
 * every family's needle lands on the same angle for the same value.
 *
 * Exports:
 *   • the geometry primitives (`polar`, `arcPath`, radii) on the 0..100 viewBox
 *   • `parseRanges` / `bandColor` — the `ranges` colour-band contract
 *   • `gaugeAttributes` / `gaugeDiscoveryMap` — the shared inspector contract
 *   • `GaugeMixin(Base)` — value wiring (subscribe / message-property / min /
 *     max / decimals) plus `renderDial()`, so a family card is just chrome
 *     around `${this.renderDial()}`.
 *
 * Colours are read from `--feezal-dial-*` custom properties, so each family
 * defaults them into its own design language (see docs/element-spec.md §5.1).
 */

// ─── Geometry — 0° = top, clockwise, matches material-light / material-gauge ──
export const CX = 50, CY = 50;
export const ARC_START = 225, ARC_SWEEP = 270; // arc / needle scale (gap at the bottom)

export function polar(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(CX + r * Math.cos(rad)).toFixed(2), +(CY + r * Math.sin(rad)).toFixed(2)];
}

export function arcPath(fromDeg, toDeg, r) {
    const [ax, ay] = polar(fromDeg, r);
    const [bx, by] = polar(toDeg, r);
    const large = (((toDeg - fromDeg) % 360) + 360) % 360 > 180 ? 1 : 0;
    return `M${ax},${ay} A${r},${r} 0 ${large},1 ${bx},${by}`;
}

export const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || 0));

/** A `ranges` value that is a NAMED site range (U65), not inline JSON. */
const isRangeName = raw =>
    typeof raw === 'string' && raw.trim() && !raw.trim().startsWith('[');

/**
 * Parse the `ranges` attribute → sorted [{from:Number, color:String}].
 * U65: a bare NAME references a site-wide range (`<feezal-site color-ranges>`)
 * — a `bands` range yields its bands (needle zones render); gradient/enum
 * ranges have no band geometry, so they yield [] here and only colour the
 * fill via bandColor().
 */
export function parseRanges(raw) {
    if (!raw) return [];
    if (isRangeName(raw)) {
        const range = findColorRange(raw.trim());
        return range?.type === 'bands' ? range.bands.map(b => ({...b})) : [];
    }
    try {
        const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(a)) return [];
        return a
            .map(r => ({from: Number(r.from), color: String(r.color || '')}))
            .filter(r => Number.isFinite(r.from) && r.color)
            .sort((x, y) => x.from - y.from);
    } catch { return []; }
}

/**
 * The colour band `v` sits in, or `fallback` when no band matches.
 * U65: with a named range, ANY range type resolves — a gradient range gives
 * the gauge a smoothly blending fill, an enum matches stringy values.
 */
export function bandColor(ranges, v, fallback = 'var(--feezal-dial-fill-color)') {
    if (isRangeName(ranges)) {
        return resolveRangeColor(findColorRange(String(ranges).trim()), v) || fallback;
    }
    let c = fallback;
    for (const b of parseRanges(ranges)) if (v >= b.from) c = b.color;
    return c;
}

// ── Geometry radii (viewBox 0..100) ──
export const R_TRACK = 43;   // arc / ring centre-line radius
export const R_TICK_O = 38;  // tick outer radius (inside the track)
export const R_TICK_I = 34;  // major tick inner radius
export const R_TICK_MI = 36; // minor tick inner radius
export const R_LABEL = 28;   // tick-label radius
export const R_NEEDLE = 33;  // needle tip radius

/**
 * The gauge attribute contract, shared by every family gauge. Families spread
 * this into their own descriptor and add their chrome attributes (glass:
 * size/degrade; metro: the MetroTileBase tile attributes) around it. `label`
 * is NOT part of the fragment — each family already owns a caption/label
 * attribute of its own.
 */
export const gaugeAttributes = [
    {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
    {name: 'look', type: 'select', options: ['arc', 'ring', 'needle'], default: 'arc',
        help: 'arc = 270° fill arc; ring = full 360° progress ring; needle = analogue dial with a pointing needle over colour-range zones.'},
    {name: 'min', type: 'number', default: 0,   help: 'Scale minimum (arc start).'},
    {name: 'max', type: 'number', default: 100, help: 'Scale maximum (arc end).'},
    {name: 'unit', type: 'string', help: 'Unit shown after / below the value.'},
    {name: 'decimals', type: 'number', min: 0, max: 6, help: 'Round the value to this many decimals. Empty = show the payload as-is.'},
    {name: 'grouping', type: 'boolean', default: false,
        help: 'Format the value with thousands separators per the site locale (1.234 / 1,234). Off by default — plain digits often read better on a wall panel.'},
    {name: 'show-value', type: 'boolean', default: true, help: 'Show the numeric value in the centre.'},
    {name: 'ticks', type: 'number', default: 0, min: 0, max: 24,
        help: 'Number of major tick divisions around the scale (0 = none).'},
    {name: 'minor-ticks', type: 'number', default: 0, min: 0, max: 10,
        help: 'Minor ticks between each pair of major ticks (0 = none).'},
    {name: 'tick-labels', type: 'boolean', default: false,
        help: 'Show the numeric scale value at each major tick.'},
    {name: 'ranges', type: 'string', default: '',
        help: 'JSON colour bands, e.g. [{"from":0,"color":"#4caf50"},{"from":70,"color":"#ff9800"},{"from":90,"color":"#e53935"}] — ' +
            'or the NAME of a site-wide colour range (Themes sidebar → Ranges). ' +
            'arc/ring: the fill takes the band the value sits in. needle: the scale is drawn as coloured zones (bands-type ranges only). Empty = single colour.'},
];

/** Discovery map fragment — every family gauge is a `sensor` view. */
export const gaugeDiscoveryMap = {
    state_topic:         {attr: 'subscribe'},
    unit_of_measurement: {attr: 'unit'},
    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
    name:                'label',
};

/**
 * GaugeMixin — the value wiring + dial rendering, applied over whichever base
 * class the family uses (`FeezalElement` for circle/glass, `MetroTileBase` for
 * metro). A subclass renders `${this.renderDial()}` inside its own chrome.
 *
 * The `--feezal-dial-*` custom properties it reads must be defaulted by the
 * host element (each family maps them onto its own palette).
 */
export const GaugeMixin = Base => class extends Base {
    static properties = {
        look:       {type: String, reflect: true},
        min:        {type: String, reflect: true},
        max:        {type: String, reflect: true},
        unit:       {type: String, reflect: true},
        decimals:   {type: String, reflect: true},
        showValue:  {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-value'},
        grouping:   {type: Boolean, reflect: true, converter: feezalBoolean},
        ticks:      {type: String, reflect: true},
        minorTicks: {type: String, reflect: true, attribute: 'minor-ticks'},
        tickLabels: {type: Boolean, reflect: true, attribute: 'tick-labels'},
        ranges:     {type: String, reflect: true},
        value:      {type: String, reflect: true},
        _value:     {state: true},
    };

    constructor() {
        super();
        this.look = 'arc';
        this.min = '0';
        this.max = '100';
        this.unit = '';
        this.decimals = '';
        this.grouping = false;
        this.showValue = true;
        this.ticks = '0';
        this.minorTicks = '0';
        this.tickLabels = false;
        this.ranges = '';
        this.value = '';
        this._value = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireGauge();
    }

    _wireGauge() {
        this.__gaugeWireSig = this.subscribe ?? '';
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic set on the live canvas → rewire.
        if (this.isConnected && this.__gaugeWireSig !== undefined && (this.subscribe ?? '') !== this.__gaugeWireSig) {
            this._unsubscribe();
            this._wireGauge();
        }
    }

    // ── Value helpers ──
    get _num() {
        const raw = this._value ?? this.value;
        const n = Number(raw);
        return (raw === null || raw === undefined || raw === '' || !Number.isFinite(n)) ? null : n;
    }
    get _lo() { const n = Number(this.min); return Number.isFinite(n) ? n : 0; }
    get _hi() { const n = Number(this.max); return Number.isFinite(n) ? n : 100; }
    /** Value used for display/needle — a mid-scale sample in the editor when unwired. */
    get _sample() {
        if (this._num !== null) return this._num;
        return feezal.isEditor ? this._lo + (this._hi - this._lo) * 0.66 : null;
    }
    get _frac() {
        const v = this._sample;
        if (v === null || this._hi === this._lo) return 0;
        return Math.max(0, Math.min(1, (v - this._lo) / (this._hi - this._lo)));
    }
    get _displayText() {
        const v = this._num ?? (feezal.isEditor ? this._sample : null);
        if (v === null) return '—';
        // N38: localized rendering — the site locale drives the decimal
        // separator (21,5 on a German dashboard); grouping is per-element
        // opt-in.
        const d = this.decimals;
        if (d !== '' && d !== null && d !== undefined) {
            return formatNumber(v, {digits: Math.max(0, Math.min(6, Number(d) || 0)), grouping: this.grouping});
        }
        // No explicit decimals: show integers cleanly, else up to 1 dp.
        return formatNumber(Number.isInteger(v) ? v : Math.round(v * 10) / 10, {grouping: this.grouping});
    }
    _bandColor(v) {
        return bandColor(this.ranges, v);
    }

    // ── Ticks (major + minor + optional labels) over an angular span ──
    _renderTicks(startDeg, sweepDeg, full) {
        const major = clampInt(this.ticks, 0, 24);
        if (!major) return '';
        const minor = clampInt(this.minorTicks, 0, 10);
        const out = [];
        const last = full ? major - 1 : major;        // ring: skip the 360°==0° duplicate
        for (let i = 0; i <= last; i++) {
            const f = i / major;
            const deg = startDeg + sweepDeg * f;
            const [x1, y1] = polar(deg, R_TICK_O);
            const [x2, y2] = polar(deg, R_TICK_I);
            out.push(svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="var(--feezal-dial-tick-color)" stroke-width="1.2" pointer-events="none"/>`);
            if (this.tickLabels) {
                const [lx, ly] = polar(deg, R_LABEL);
                const val = Math.round(this._lo + (this._hi - this._lo) * f);
                out.push(svg`<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central"
                    font-size="6.5" fill="var(--feezal-dial-tick-color)" pointer-events="none">${val}</text>`);
            }
            if (minor && i < major) {
                for (let j = 1; j <= minor; j++) {
                    const mf = (i + j / (minor + 1)) / major;
                    if (mf >= 1 && !full) break;
                    const md = startDeg + sweepDeg * mf;
                    const [mx1, my1] = polar(md, R_TICK_O);
                    const [mx2, my2] = polar(md, R_TICK_MI);
                    out.push(svg`<line x1="${mx1}" y1="${my1}" x2="${mx2}" y2="${my2}"
                        stroke="var(--feezal-dial-tick-color)" stroke-width="0.7" opacity="0.7" pointer-events="none"/>`);
                }
            }
        }
        return out;
    }

    _centerValue(cy, size) {
        if (!this.showValue) return '';
        return svg`
            <text x="${CX}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                font-size="${size}" font-weight="700" fill="var(--feezal-dial-text-color)"
                style="font-variant-numeric: tabular-nums" pointer-events="none"
                >${this._displayText}</text>
            ${this.unit ? svg`<text x="${CX}" y="${cy + size * 0.72}" text-anchor="middle"
                dominant-baseline="central" font-size="${size * 0.42}" opacity="0.6"
                fill="var(--feezal-dial-text-color)" pointer-events="none">${this.unit}</text>` : ''}`;
    }

    /** `--feezal-dial-value-size` as a number (unitless, % of the viewBox). */
    get _valueSize() {
        return Number(getComputedStyle(this).getPropertyValue('--feezal-dial-value-size')) || 20;
    }

    // ── Looks ──
    _renderArc() {
        const tw = 'calc(var(--feezal-dial-track-width, 8) * 1px)';
        const end = ARC_START + ARC_SWEEP;
        const valAngle = ARC_START + ARC_SWEEP * this._frac;
        const fillColor = this._bandColor(this._sample ?? this._lo);
        return svg`
            <path d="${arcPath(ARC_START, end, R_TRACK)}" fill="none"
                stroke="var(--feezal-dial-track-color)" stroke-linecap="round"
                style="stroke-width:${tw}" pointer-events="none"/>
            ${this._frac > 0.001 ? svg`<path d="${arcPath(ARC_START, valAngle, R_TRACK)}" fill="none"
                stroke="${fillColor}" stroke-linecap="round"
                style="stroke-width:${tw}" pointer-events="none"/>` : ''}
            ${this._renderTicks(ARC_START, ARC_SWEEP, false)}
            ${this._centerValue(CY, this._valueSize)}`;
    }

    _renderRing() {
        const tw = 'calc(var(--feezal-dial-track-width, 8) * 1px)';
        const circ = 2 * Math.PI * R_TRACK;
        const fillColor = this._bandColor(this._sample ?? this._lo);
        return svg`
            <circle cx="${CX}" cy="${CY}" r="${R_TRACK}" fill="none"
                stroke="var(--feezal-dial-track-color)"
                style="stroke-width:${tw}" pointer-events="none"/>
            ${this._frac > 0.001 ? svg`<circle cx="${CX}" cy="${CY}" r="${R_TRACK}" fill="none"
                stroke="${fillColor}" stroke-linecap="round"
                stroke-dasharray="${(circ * this._frac).toFixed(2)} ${circ.toFixed(2)}"
                transform="rotate(-90 ${CX} ${CY})"
                style="stroke-width:${tw}" pointer-events="none"/>` : ''}
            ${this._renderTicks(0, 360, true)}
            ${this._centerValue(CY, this._valueSize)}`;
    }

    _renderNeedle() {
        const tw = 'calc(var(--feezal-dial-track-width, 8) * 0.6px)';
        const end = ARC_START + ARC_SWEEP;
        const bands = parseRanges(this.ranges);
        // Scale: coloured zones from the ranges, else a neutral track.
        let scale;
        if (bands.length) {
            const span = (this._hi - this._lo) || 1;
            scale = bands.map((b, i) => {
                const from = Math.max(this._lo, b.from);
                const to = i + 1 < bands.length ? Math.min(this._hi, bands[i + 1].from) : this._hi;
                if (to <= from) return '';
                const a0 = ARC_START + ARC_SWEEP * ((from - this._lo) / span);
                const a1 = ARC_START + ARC_SWEEP * ((to - this._lo) / span);
                return svg`<path d="${arcPath(a0, a1, R_TRACK)}" fill="none" stroke="${b.color}"
                    stroke-linecap="butt" style="stroke-width:${tw}" pointer-events="none"/>`;
            });
        } else {
            scale = svg`<path d="${arcPath(ARC_START, end, R_TRACK)}" fill="none"
                stroke="var(--feezal-dial-track-color)" stroke-linecap="round"
                style="stroke-width:${tw}" pointer-events="none"/>`;
        }
        const valAngle = ARC_START + ARC_SWEEP * this._frac;
        const [nx, ny] = polar(valAngle, R_NEEDLE);
        const [bx1, by1] = polar(valAngle + 90, 3.2);
        const [bx2, by2] = polar(valAngle - 90, 3.2);
        return svg`
            ${scale}
            ${this._renderTicks(ARC_START, ARC_SWEEP, false)}
            <!-- needle -->
            <path d="M${bx1},${by1} L${nx},${ny} L${bx2},${by2} Z"
                fill="var(--feezal-dial-needle-color)" pointer-events="none"/>
            <circle cx="${CX}" cy="${CY}" r="4.2" fill="var(--feezal-dial-needle-color)" pointer-events="none"/>
            <circle cx="${CX}" cy="${CY}" r="1.8" fill="var(--feezal-dial-track-color)" pointer-events="none"/>
            ${this._centerValue(CY + 22, this._valueSize * 0.8)}`;
    }

    /** The dial body for the current `look` — the SVG children only. */
    renderDialBody() {
        const look = this.look || 'arc';
        return look === 'ring'   ? this._renderRing()
             : look === 'needle' ? this._renderNeedle()
             :                     this._renderArc();
    }

    /** The complete `<svg class="dial">` — what a family card renders. The
     * outer `<svg>` element is created with `html` (the `svg` tag is only for
     * fragments already inside an SVG root). */
    renderDial() {
        return html`
            <svg class="dial" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${this.renderDialBody()}</svg>`;
    }
};
