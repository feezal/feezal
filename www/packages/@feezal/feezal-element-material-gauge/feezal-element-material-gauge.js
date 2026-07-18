/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-material-gauge
 *
 * SVG arc gauge. Subscribes to an MQTT topic and renders a circular
 * progress arc with a center value, optional label, and optional unit.
 * Pure Lit — no external library dependency.
 *
 *  ┌──────────────┐
 *  │    ╭────╮    │
 *  │  ╭╯    ╰╮   │
 *  │  │  42  │   │
 *  │  │  °C  │   │
 *  │  ╰╮    ╭╯   │
 *  │    ╰────╯   │
 *  │   Temp      │
 *  └─────────────┘
 */
class FeezalElementMaterialGauge extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Gauge',
                category: 'Simple',
                color: '#4a6080'
            },
            description: 'Circular arc gauge. Subscribes to an MQTT numeric value and visualises it as a colour-filled arc.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'min',    type: 'number', help: 'Minimum value (arc start).', default: 0},
                {name: 'max',    type: 'number', help: 'Maximum value (arc end).', default: 100},
                {name: 'unit',   type: 'string', help: 'Unit string shown below the value inside the arc.'},
                {name: 'label',  type: 'string', help: 'Caption shown below the gauge.'},
                {name: 'color',  type: 'color',  help: 'Arc fill colour. Defaults to the theme primary colour.', default: ''},
                {name: 'digits', type: 'number', help: 'Decimal places for the displayed value.', default: 0},
                {name: 'thickness', type: 'number', help: 'Arc stroke width in SVG units (1–40).', default: 12}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-gauge-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Arc fill colour.'},
            ],
            defaultStyle: {width: '120px', height: '120px'}
        };
    }

    static properties = {
        min:       {type: Number, reflect: true},
        max:       {type: Number, reflect: true},
        unit:      {type: String, reflect: true},
        label:     {type: String, reflect: true},
        color:     {type: String, reflect: true},
        digits:    {type: Number, reflect: true},
        thickness: {type: Number, reflect: true},
        _value:    {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
            --feezal-gauge-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
        }
        svg { flex: 1; width: 100%; overflow: visible; }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%; padding: 0 4px;
            color: var(--feezal-color, #333);
        }
    `];

    constructor() {
        super();
        this.min       = 0;
        this.max       = 100;
        this.unit      = '';
        this.label     = '';
        this.color     = '';
        this.digits    = 0;
        this.thickness = 12;
        this._value    = null;
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

    // ── Arc geometry ──────────────────────────────────────────────────────────
    // The arc spans 240° (from 150° to 390° / 30°) centred in a 100×100 viewBox.

    static _START_ANGLE = 150;
    static _SWEEP = 240;
    static _CX = 50;
    static _CY = 50;
    static _R  = 38;

    _polarToXY(angleDeg, r) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return {
            x: FeezalElementMaterialGauge._CX + r * Math.cos(rad),
            y: FeezalElementMaterialGauge._CY + r * Math.sin(rad)
        };
    }

    _arcPath(startAngle, endAngle, r) {
        const start   = this._polarToXY(startAngle, r);
        const end     = this._polarToXY(endAngle,   r);
        const sweep   = endAngle - startAngle;
        const large   = sweep > 180 ? 1 : 0;
        return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
    }

    _buildSvg(value, isEditor) {
        const {_START_ANGLE: SA, _SWEEP: SW, _CX: cx, _CY: cy, _R: r} = FeezalElementMaterialGauge;
        const thick    = Math.max(1, Math.min(40, this.thickness || 12));
        const halfTk   = thick / 2;
        const trackR   = r - halfTk;
        const clampMin = Math.min(this.min, this.max);
        const clampMax = Math.max(this.min, this.max);
        const clamped  = Math.max(clampMin, Math.min(clampMax, value ?? clampMin));
        const ratio    = clampMax === clampMin ? 0 : (clamped - clampMin) / (clampMax - clampMin);
        const fillEnd  = SA + SW * ratio;
        const trackPath = this._arcPath(SA, SA + SW, trackR);
        const fillPath  = ratio > 0.001 ? this._arcPath(SA, fillEnd, trackR) : null;
        const accent    = this.color || 'var(--feezal-gauge-color)';
        const trackColor = 'var(--feezal-border, #e0e0e0)';

        const formatted = isEditor ? '—' : (
            value === null || value === undefined ? '—'
            : Number(value).toFixed(Math.max(0, this.digits || 0))
        );

        return svg`
            <path d="${trackPath}" fill="none" stroke="${trackColor}"
                stroke-width="${thick}" stroke-linecap="round"/>
            ${fillPath ? svg`
                <path d="${fillPath}" fill="none" stroke="${accent}"
                    stroke-width="${thick}" stroke-linecap="round"/>
            ` : ''}
            <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="middle"
                font-size="14" font-weight="500"
                fill="var(--feezal-color, #333)">${formatted}</text>
            ${this.unit ? svg`
                <text x="${cx}" y="${cy + 13}" text-anchor="middle"
                    font-size="8.5" opacity="0.65"
                    fill="var(--feezal-color, #333)">${this.unit}</text>
            ` : ''}`;
    }

    render() {
        // When no live value has arrived yet, show the midpoint as an unconfigured-state hint.
        const value = this._value ?? (this.min + this.max) / 2;
        return html`
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                ${this._buildSvg(value, value === (this.min + this.max) / 2 && this._value === null)}
            </svg>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-gauge', FeezalElementMaterialGauge);
export {FeezalElementMaterialGauge};
