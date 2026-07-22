/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-sensor (E55)
 *
 * Sensor tile: big value + unit on the front; the back shows the recent
 * trend (SVG polyline of the last `points` values) with min/max readouts.
 */
class FeezalElementMetroSensor extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Sensor', category: 'Metro', color: '#1ba1e2', icon: 'monitoring'},
            description: 'Metro sensor tile: big value on the front, recent trend (min/max + polyline) on the back.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'unit',   type: 'string', help: 'Unit shown after the value.'},
                {name: 'digits', type: 'number', default: '', help: 'Fixed decimal places for numeric payloads. Empty = as received.'},
                {name: 'points', type: 'number', default: 30, min: 2, max: 200, help: 'Trend buffer length (values kept for the back-side graph).'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
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
        unit:    {type: String, reflect: true},
        digits:  {type: Number, reflect: true},
        points:  {type: Number, reflect: true},
        _values: {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        .value { font-size: min(var(--_metro-value-size), 30cqh); font-weight: 300; line-height: 1; }   /* E129 */
        .unit { font-size: var(--_metro-unit-size); opacity: 0.85; }   /* E129 */
        .trend svg { width: 100%; height: 48px; display: block; }
        .minmax { display: flex; justify-content: space-between; font-size: 11px; opacity: 0.85; }
    `];

    constructor() {
        super();
        this.unit = '';
        this.digits = null;
        this.points = 30;
        this._values = [];
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (isNaN(v)) return;
                const n = Math.max(2, Math.min(200, Number(this.points) || 30));
                this._values = [...this._values, v].slice(-n);
            });
        }
    }

    _format(v) {
        if (this.digits !== null && this.digits !== undefined && this.digits !== '' && !isNaN(Number(v))) {
            return Number(v).toFixed(Number(this.digits));
        }
        return String(v);
    }

    renderFront() {
        const latest = this._values.at(-1) ?? (feezal.isEditor && !this.subscribe ? 42 : null);
        return html`
            <div class="value">${latest === null ? '—' : this._format(latest)}</div>
            ${this.unit ? html`<div class="unit">${this.unit}</div>` : ''}`;
    }

    renderBack() {
        if (this._values.length < 2) {
            return html`<div style="text-align:center;opacity:.7">collecting…</div>`;
        }
        const values = this._values;
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        const span = hi - lo || 1;
        const points = values.map((v, i) =>
            `${(i / (values.length - 1)) * 100},${30 - ((v - lo) / span) * 28 + 1}`).join(' ');
        return html`
            <div class="trend">
                <svg viewBox="0 0 100 32" preserveAspectRatio="none">
                    ${svg`<polyline points="${points}" fill="none"
                        stroke="var(--feezal-metro-text, #fff)" stroke-width="1.5"
                        vector-effect="non-scaling-stroke"/>`}
                </svg>
            </div>
            <div class="minmax">
                <span>min ${this._format(lo)}</span>
                <span>max ${this._format(hi)}</span>
            </div>`;
    }
}

customElements.define('feezal-element-metro-sensor', FeezalElementMetroSensor);
export {FeezalElementMetroSensor};
