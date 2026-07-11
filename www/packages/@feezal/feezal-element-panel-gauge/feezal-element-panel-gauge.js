/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-panel-gauge (E56)
 *
 * Analog needle gauge — 240° dial with tick scale, optional coloured zone
 * bands (green/amber/red) and a spring-damped needle: the physics convey
 * rate-of-change in a way a number can't. Value + unit readout under the
 * pivot.
 *
 * The needle runs on its own rAF spring toward the target value and writes
 * the rotation directly to the SVG node — no Lit re-render per frame.
 */
class FeezalElementPanelGauge extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Gauge', category: 'Panel', color: '#455a64', icon: 'speed'},
            description: 'Analog needle gauge with spring-damped needle, tick scale and optional coloured zone bands (e.g. green/amber/red).',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'min',    type: 'number', default: 0,   help: 'Scale minimum.'},
                {name: 'max',    type: 'number', default: 100, help: 'Scale maximum.'},
                {name: 'unit',   type: 'string', help: 'Unit shown next to the value readout.'},
                {name: 'label',  type: 'string', help: 'Engraved label under the gauge.'},
                {name: 'digits', type: 'number', default: 0, help: 'Decimal places of the value readout.'},
                {name: 'start-angle', type: 'number', default: 150,
                    help: 'Dial angle of the scale minimum, in degrees — 0 = 12 o\'clock, clockwise positive. Default 150 (lower left).'},
                {name: 'sweep-angle', type: 'number', default: 240, min: 10, max: 360,
                    help: 'Angular size of the scale in degrees; the maximum sits at start-angle + sweep-angle. Default 240.'},
                {name: 'ticks', type: 'number', default: 10, min: 0,
                    help: 'Number of major scale intervals (0 = no tick scale).'},
                {name: 'minor-ticks', type: 'number', default: 5, min: 0,
                    help: 'Minor subdivisions per major interval (0 or 1 = none).'},
                {name: 'tick-labels', type: 'number', default: 2, min: 0,
                    help: 'Numeral at every Nth major tick — 1 = every major tick, 0 = no numerals. Default 2.'},
                {name: 'show-value', type: 'boolean', default: true, help: 'Show the value readout under the pivot.'},
                {name: 'value-prefix', type: 'string', help: 'Text before the value readout.'},
                {name: 'value-suffix', type: 'string', help: 'Text after the value readout (after the unit).'},
                {name: 'zones', type: 'objectList',
                    itemFields: [
                        {key: 'from', type: 'number'},
                        {key: 'to', type: 'number'},
                        {key: 'color', type: 'color'},
                    ],
                    help: 'Coloured scale bands, e.g. 0–60 green, 60–80 amber, 80–100 red.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-panel-gauge-needle-color', type: 'color',
                    default: '#e53935',
                    help: 'Needle colour.'},
                {property: '--feezal-panel-gauge-value-color', type: 'color',
                    default: 'var(--feezal-panel-text, #aeb7bd)',
                    help: 'Value readout colour.'},
                {property: '--feezal-panel-gauge-value-size',
                    default: '9px',
                    help: 'Value readout font size (viewBox units — the dial is 100 units wide, default 9px).'},
                {property: '--feezal-panel-face', type: 'color', default: '#1b2024', help: 'Dial face colour (shared --feezal-panel-face family var).'},
                {property: '--feezal-panel-bezel', type: 'color', default: '#3c454d', help: 'Bezel/ring colour (shared across panel-* elements).'},
                {property: '--feezal-panel-text', type: 'color', default: '#aeb7bd', help: 'Scale/label colour (shared across panel-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 60},
            defaultStyle: {width: '140px', height: '140px'},
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         'subscribe',
                    name:                'label',
                    unit_of_measurement: 'unit',
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        min:        {type: Number,  reflect: true},
        max:        {type: Number,  reflect: true},
        unit:       {type: String,  reflect: true},
        label:      {type: String,  reflect: true},
        digits:     {type: Number,  reflect: true},
        startAngle: {type: Number,  reflect: true, attribute: 'start-angle'},
        sweepAngle: {type: Number,  reflect: true, attribute: 'sweep-angle'},
        ticks:      {type: Number,  reflect: true},
        minorTicks: {type: Number,  reflect: true, attribute: 'minor-ticks'},
        tickLabels: {type: Number,  reflect: true, attribute: 'tick-labels'},
        showValue:  {type: Boolean, reflect: true, attribute: 'show-value'},
        valuePrefix: {type: String, reflect: true, attribute: 'value-prefix'},
        valueSuffix: {type: String, reflect: true, attribute: 'value-suffix'},
        zones:  {type: String, reflect: true},
        _value: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 2px; box-sizing: border-box; overflow: hidden;
            --feezal-panel-gauge-needle-color: #e53935;
        }
        svg { flex: 1; min-height: 0; width: 100%; }
        .label {
            flex: 0 0 auto; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--feezal-panel-text, #aeb7bd);
            max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    // Dial geometry: start-angle/sweep-angle attributes (0° = 12 o'clock,
    // clockwise); defaults give the classic 240° dial (150° → 390°).
    static _CX = 50;
    static _CY = 52;
    static _R = 40;

    constructor() {
        super();
        this.min = 0;
        this.max = 100;
        this.unit = '';
        this.label = '';
        this.digits = 0;
        this.startAngle = 150;
        this.sweepAngle = 240;
        this.ticks = 10;
        this.minorTicks = 5;
        this.tickLabels = 2;
        this.showValue = true;
        this.valuePrefix = '';
        this.valueSuffix = '';
        this.zones = '[]';
        this._value = null;
        // Needle spring state (non-reactive; rAF writes the DOM directly).
        this.__angle = null;
        this.__velocity = 0;
        this.__raf = null;
        this.__lastT = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._value = v;
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        cancelAnimationFrame(this.__raf);
        this.__raf = null;
    }

    _displayValue() {
        // Unconfigured hint on the editor canvas: park at 65 %.
        return this._value ?? (feezal.isEditor && !this.subscribe
            ? this.min + (this.max - this.min) * 0.65 : null);
    }

    _valueToAngle(v) {
        const span = this.max - this.min || 1;
        const t = Math.min(1, Math.max(0, (v - this.min) / span));
        return (Number(this.startAngle) || 0) + t * (Number(this.sweepAngle) || 240);
    }

    _polar(angleDeg, r) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return {
            x: FeezalElementPanelGauge._CX + r * Math.cos(rad),
            y: FeezalElementPanelGauge._CY + r * Math.sin(rad),
        };
    }

    _arcPath(a0, a1, r) {
        if (a1 - a0 >= 360) a1 = a0 + 359.9;   // full circle degenerates (start == end point)
        const p0 = this._polar(a0, r);
        const p1 = this._polar(a1, r);
        const large = a1 - a0 > 180 ? 1 : 0;
        return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
    }

    _zoneRows() {
        try {
            const r = JSON.parse(this.zones || '[]');
            return (Array.isArray(r) ? r : []).filter(z => z && isFinite(z.from) && isFinite(z.to));
        } catch {
            return [];
        }
    }

    // ── Needle spring ─────────────────────────────────────────────────────────

    updated(changed) {
        super.updated(changed);
        const v = this._displayValue();
        if (v === null) return;
        const target = this._valueToAngle(v);
        if (this.__angle === null) {
            // First value: settle instantly (no swing-in from zero on load).
            this.__angle = target;
        }
        // Re-apply after every render — the template recreates the needle
        // node without its rotation attribute.
        this._applyNeedle();
        if (Math.abs(target - this.__angle) > 0.01 && !this.__raf) {
            this.__lastT = performance.now();
            this.__raf = requestAnimationFrame(t => this._springStep(t));
        }
    }

    _springStep(t) {
        this.__raf = null;
        const v = this._displayValue();
        if (v === null) return;
        const target = this._valueToAngle(v);
        const dt = Math.min(0.05, (t - this.__lastT) / 1000 || 0.016);
        this.__lastT = t;

        // Under-damped spring: visible overshoot + settle, hardware feel.
        const STIFFNESS = 120;
        const DAMPING = 11;
        this.__velocity += (target - this.__angle) * STIFFNESS * dt;
        this.__velocity *= Math.exp(-DAMPING * dt);
        this.__angle += this.__velocity * dt;

        this._applyNeedle();

        if (Math.abs(target - this.__angle) > 0.05 || Math.abs(this.__velocity) > 0.05) {
            this.__raf = requestAnimationFrame(tt => this._springStep(tt));
        } else {
            this.__angle = target;
            this.__velocity = 0;
            this._applyNeedle();
        }
    }

    _applyNeedle() {
        const needle = this.renderRoot?.querySelector('.needle');
        if (needle) needle.setAttribute('transform', `rotate(${this.__angle} ${FeezalElementPanelGauge._CX} ${FeezalElementPanelGauge._CY})`);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _ticks() {
        const {_R} = FeezalElementPanelGauge;
        const ticks = [];
        const majors = Math.max(0, Math.round(Number(this.ticks) || 0));
        if (majors === 0) return ticks;
        const minors = Math.max(1, Math.round(Number(this.minorTicks) || 1));
        const labelEvery = Math.max(0, Math.round(Number(this.tickLabels) || 0));
        const start = Number(this.startAngle) || 0;
        const sweep = Number(this.sweepAngle) || 240;
        for (let i = 0; i <= majors * minors; i++) {
            const angle = start + (i / (majors * minors)) * sweep;
            const major = i % minors === 0;
            const p0 = this._polar(angle, _R);
            const p1 = this._polar(angle, _R - (major ? 6 : 3));
            ticks.push(svg`<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}"
                stroke="var(--feezal-panel-text, #aeb7bd)" stroke-width="${major ? 1.4 : 0.6}"
                opacity="${major ? 0.9 : 0.5}"/>`);
            if (major && labelEvery > 0 && (i / minors) % labelEvery === 0) {
                const value = this.min + (i / (majors * minors)) * (this.max - this.min);
                const pt = this._polar(angle, _R - 11);
                ticks.push(svg`<text x="${pt.x}" y="${pt.y + 2}" text-anchor="middle" font-size="5.5"
                    fill="var(--feezal-panel-text, #aeb7bd)">${Number(value.toFixed(this.digits))}</text>`);
            }
        }
        return ticks;
    }

    render() {
        const {_CX, _CY, _R} = FeezalElementPanelGauge;
        const v = this._displayValue();
        const readout = v === null ? '—'
            : `${this.valuePrefix || ''}${v.toFixed(Math.max(0, this.digits))}${this.unit ? ' ' + this.unit : ''}${this.valueSuffix || ''}`;
        return html`
            <svg viewBox="0 0 100 100">
                <circle cx="${_CX}" cy="${_CY}" r="47" fill="var(--feezal-panel-face, #1b2024)"
                    stroke="var(--feezal-panel-bezel, #3c454d)" stroke-width="3"/>
                ${this._zoneRows().map(z => svg`
                    <path d="${this._arcPath(this._valueToAngle(Number(z.from)), this._valueToAngle(Number(z.to)), _R + 2.5)}"
                        stroke="${z.color || 'var(--success-color, #43a047)'}" stroke-width="3.5" fill="none"/>`)}
                ${this._ticks()}
                <g class="needle">
                    <polygon points="${_CX - 1.6},${_CY + 6} ${_CX + 1.6},${_CY + 6} ${_CX},${_CY - _R + 6}"
                        fill="var(--feezal-panel-gauge-needle-color)"/>
                </g>
                <circle cx="${_CX}" cy="${_CY}" r="4" fill="#454f58" stroke="#171c20" stroke-width="1"/>
                ${this.showValue ? svg`
                    <text class="readout" x="${_CX}" y="${_CY + 22}" text-anchor="middle"
                        style="font-size: var(--feezal-panel-gauge-value-size, 9px)"
                        fill="var(--feezal-panel-gauge-value-color, var(--feezal-panel-text, #aeb7bd))"
                        font-family="ui-monospace, monospace">${readout}</text>` : ''}
            </svg>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }

    firstUpdated() {
        this._applyNeedle();
    }
}

customElements.define('feezal-element-panel-gauge', FeezalElementPanelGauge);
export {FeezalElementPanelGauge};
