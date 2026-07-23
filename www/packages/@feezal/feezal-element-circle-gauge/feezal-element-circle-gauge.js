/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-circle-gauge (E139)
 *
 * Circle-family gauge — the styled, richer sibling of the plain
 * feezal-element-material-gauge (Material category). Renders a numeric MQTT
 * value on a circular scale in the Circle design language (width-sized,
 * top-anchored, concentric with the light/climate ring), with three
 * configurable looks and gauge dressing:
 *
 *   • arc    — a 270° speedometer arc, value fills from the start; the fill
 *              takes the active colour-range band (or the fill colour).
 *   • ring   — a full 360° progress ring, value fills clockwise from the top.
 *   • needle — a 270° analogue dial: colour-range zones on the scale, a needle
 *              pointing at the value, ticks + optional numeric labels.
 *
 * Ticks (major + minor), numeric tick labels and colour ranges are all
 * configurable; every colour is a theme-anchored CSS custom property. Pure
 * Lit / SVG, display-only readout (no control surface).
 */

// ─── Geometry — 0° = top, clockwise, matches material-light / material-gauge ──
const CX = 50, CY = 50;
const ARC_START = 225, ARC_SWEEP = 270; // arc / needle scale (gap at the bottom)

function polar(deg, r) {
    const rad = (deg - 90) * Math.PI / 180;
    return [+(CX + r * Math.cos(rad)).toFixed(2), +(CY + r * Math.sin(rad)).toFixed(2)];
}
function arcPath(fromDeg, toDeg, r) {
    const [ax, ay] = polar(fromDeg, r);
    const [bx, by] = polar(toDeg, r);
    const large = (((toDeg - fromDeg) % 360) + 360) % 360 > 180 ? 1 : 0;
    return `M${ax},${ay} A${r},${r} 0 ${large},1 ${bx},${by}`;
}
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || 0));

// Parse the `ranges` attribute → sorted [{from:Number, color:String}].
function parseRanges(raw) {
    if (!raw) return [];
    try {
        const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(a)) return [];
        return a
            .map(r => ({from: Number(r.from), color: String(r.color || '')}))
            .filter(r => Number.isFinite(r.from) && r.color)
            .sort((x, y) => x.from - y.from);
    } catch { return []; }
}

// ── Geometry radii (viewBox 0..100) ──
const R_TRACK = 43;   // arc / ring centre-line radius
const R_TICK_O = 38;  // tick outer radius (inside the track)
const R_TICK_I = 34;  // major tick inner radius
const R_TICK_MI = 36; // minor tick inner radius
const R_LABEL = 28;   // tick-label radius
const R_NEEDLE = 33;  // needle tip radius

class FeezalElementCircleGauge extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Gauge', category: 'Circle', color: '#1565c0', icon: 'speed'},
            description: 'Circle-family gauge — a numeric value on a circular scale with three looks (arc / ring / needle), ' +
                'configurable ticks and colour ranges. Display-only readout in the Circle design language.',
            baseAttribute: 'value',
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         {attr: 'subscribe'},
                    unit_of_measurement: {attr: 'unit'},
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'look', type: 'select', options: ['arc', 'ring', 'needle'], default: 'arc',
                    help: 'arc = 270° fill arc; ring = full 360° progress ring; needle = analogue dial with a pointing needle over colour-range zones.'},
                {name: 'min', type: 'number', default: 0,   help: 'Scale minimum (arc start).'},
                {name: 'max', type: 'number', default: 100, help: 'Scale maximum (arc end).'},
                {name: 'unit', type: 'string', help: 'Unit shown after / below the value.'},
                {name: 'decimals', type: 'number', min: 0, max: 6, help: 'Round the value to this many decimals. Empty = show the payload as-is.'},
                {name: 'show-value', type: 'boolean', default: true, help: 'Show the numeric value in the centre.'},
                {name: 'ticks', type: 'number', default: 0, min: 0, max: 24,
                    help: 'Number of major tick divisions around the scale (0 = none).'},
                {name: 'minor-ticks', type: 'number', default: 0, min: 0, max: 10,
                    help: 'Minor ticks between each pair of major ticks (0 = none).'},
                {name: 'tick-labels', type: 'boolean', default: false,
                    help: 'Show the numeric scale value at each major tick.'},
                {name: 'ranges', type: 'string', default: '',
                    help: 'JSON colour bands, e.g. [{"from":0,"color":"#4caf50"},{"from":70,"color":"#ff9800"},{"from":90,"color":"#e53935"}]. ' +
                        'arc/ring: the fill takes the band the value sits in. needle: the scale is drawn as coloured zones. Empty = single colour.'},
                {name: 'label', type: 'string', help: 'Caption shown below the gauge.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-dial-track-color',  type: 'color', default: 'var(--divider-color)',      help: 'Empty scale / track colour.'},
                {property: '--feezal-dial-fill-color',   type: 'color', default: 'var(--primary-color)',      help: 'Fill / progress colour when no colour-range matches.'},
                {property: '--feezal-dial-needle-color', type: 'color', default: 'var(--primary-text-color)', help: 'Needle colour (needle look).'},
                {property: '--feezal-dial-text-color',   type: 'color', default: 'var(--primary-text-color)', help: 'Value numeral colour.'},
                {property: '--feezal-dial-tick-color',   type: 'color', default: 'var(--secondary-text-color)', help: 'Tick + tick-label colour.'},
                {property: '--feezal-dial-label-color',  type: 'color', default: 'var(--secondary-text-color)', help: 'Caption colour.'},
                {property: '--feezal-dial-track-width',  default: '8',  help: 'Track / fill thickness — unitless, % of the circle viewBox.'},
                {property: '--feezal-dial-value-size',   default: '20', help: 'Value font size — unitless, % of the circle viewBox.'},
                {property: '--feezal-dial-label-size',   default: '12px', help: 'Caption font size.'},
            ],
            defaultStyle: {width: '130px', height: '150px'},
            restrict: {minWidth: 70, minHeight: 80},
        };
    }

    static properties = {
        subscribe:  {type: String, reflect: true},
        look:       {type: String, reflect: true},
        min:        {type: String, reflect: true},
        max:        {type: String, reflect: true},
        unit:       {type: String, reflect: true},
        decimals:   {type: String, reflect: true},
        showValue:  {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-value'},
        ticks:      {type: String, reflect: true},
        minorTicks: {type: String, reflect: true, attribute: 'minor-ticks'},
        tickLabels: {type: Boolean, reflect: true, attribute: 'tick-labels'},
        ranges:     {type: String, reflect: true},
        label:      {type: String, reflect: true},
        value:      {type: String, reflect: true},
        _value:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column;
            align-items: center; justify-content: flex-start;
            gap: 4px; padding: 6px; box-sizing: border-box;
            overflow: hidden; text-align: center;
            container-type: inline-size;
            --feezal-dial-track-color:  var(--divider-color, rgba(0,0,0,0.15));
            --feezal-dial-fill-color:   var(--primary-color, #1565c0);
            --feezal-dial-needle-color: var(--primary-text-color, #1d1d1f);
            --feezal-dial-text-color:   var(--primary-text-color, #1d1d1f);
            --feezal-dial-tick-color:   var(--secondary-text-color, rgba(29,29,31,0.55));
            --feezal-dial-label-color:  var(--secondary-text-color, rgba(29,29,31,0.55));
            --feezal-dial-track-width: 8;
            --feezal-dial-value-size: 20;
            color: var(--feezal-dial-text-color);
        }
        /* E139: concentric with the light/climate ring — square footprint, the
           gauge sits at ~92% inside it, top-anchored, caption stacked below. */
        .gauge-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        svg.dial { width: 92%; height: 92%; display: block; overflow: visible; }
        .label {
            font-size: var(--feezal-dial-label-size, 12px);
            font-weight: 600; line-height: 1.2;
            color: var(--feezal-dial-label-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.look = 'arc';
        this.min = '0';
        this.max = '100';
        this.unit = '';
        this.decimals = '';
        this.showValue = true;
        this.ticks = '0';
        this.minorTicks = '0';
        this.tickLabels = false;
        this.ranges = '';
        this.label = '';
        this.value = '';
        this._value = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    _wireSubscriptions() {
        this.__wireSig = this.subscribe ?? '';
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
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
    // Value used for display/needle — a mid-scale sample in the editor when unwired.
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
        const d = this.decimals;
        if (d !== '' && d !== null && d !== undefined) {
            return Number(v).toFixed(Math.max(0, Math.min(6, Number(d) || 0)));
        }
        // No explicit decimals: show integers cleanly, else up to 1 dp.
        return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
    }
    _bandColor(v) {
        const bands = parseRanges(this.ranges);
        let c = 'var(--feezal-dial-fill-color)';
        for (const b of bands) if (v >= b.from) c = b.color;
        return c;
    }

    // ── Ticks (major + minor + optional labels) over an angular span ──
    _renderTicks(startDeg, sweepDeg, full) {
        const major = clampInt(this.ticks, 0, 24);
        if (!major) return '';
        const minor = clampInt(this.minorTicks, 0, 10);
        const out = [];
        const steps = full ? major : major;          // segments count
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
            if (minor && i < steps) {
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

    // ── Looks ──
    _renderArc() {
        const tw = 'calc(var(--feezal-dial-track-width, 8) * 1px)';
        const end = ARC_START + ARC_SWEEP;
        const valAngle = ARC_START + ARC_SWEEP * this._frac;
        const fillColor = this._bandColor(this._sample ?? this._lo);
        const vsize = Number(getComputedStyle(this).getPropertyValue('--feezal-dial-value-size')) || 20;
        return svg`
            <path d="${arcPath(ARC_START, end, R_TRACK)}" fill="none"
                stroke="var(--feezal-dial-track-color)" stroke-linecap="round"
                style="stroke-width:${tw}" pointer-events="none"/>
            ${this._frac > 0.001 ? svg`<path d="${arcPath(ARC_START, valAngle, R_TRACK)}" fill="none"
                stroke="${fillColor}" stroke-linecap="round"
                style="stroke-width:${tw}" pointer-events="none"/>` : ''}
            ${this._renderTicks(ARC_START, ARC_SWEEP, false)}
            ${this._centerValue(CY, vsize)}`;
    }

    _renderRing() {
        const tw = 'calc(var(--feezal-dial-track-width, 8) * 1px)';
        const circ = 2 * Math.PI * R_TRACK;
        const fillColor = this._bandColor(this._sample ?? this._lo);
        const vsize = Number(getComputedStyle(this).getPropertyValue('--feezal-dial-value-size')) || 20;
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
            ${this._centerValue(CY, vsize)}`;
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
        const vsize = (Number(getComputedStyle(this).getPropertyValue('--feezal-dial-value-size')) || 20) * 0.8;
        return svg`
            ${scale}
            ${this._renderTicks(ARC_START, ARC_SWEEP, false)}
            <!-- needle -->
            <path d="M${bx1},${by1} L${nx},${ny} L${bx2},${by2} Z"
                fill="var(--feezal-dial-needle-color)" pointer-events="none"/>
            <circle cx="${CX}" cy="${CY}" r="4.2" fill="var(--feezal-dial-needle-color)" pointer-events="none"/>
            <circle cx="${CX}" cy="${CY}" r="1.8" fill="var(--feezal-dial-track-color)" pointer-events="none"/>
            ${this._centerValue(CY + 22, vsize)}`;
    }

    render() {
        const look = this.look || 'arc';
        const body = look === 'ring'   ? this._renderRing()
                   : look === 'needle' ? this._renderNeedle()
                   :                     this._renderArc();
        return html`
            <div class="gauge-wrap">
                <svg class="dial" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>
            </div>
            ${this.label || feezal.isEditor ? html`<div class="label">${this.label || 'Gauge'}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-gauge', FeezalElementCircleGauge);
export {FeezalElementCircleGauge};
