/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class FeezalElementBasicChart extends FeezalElement {
    static get feezal() {
        return {
            palette: {category: 'Basic', name: 'Chart', color: '#4a6080'},
            description: 'Buffers incoming MQTT numeric values and renders them as a sparkline chart.',
            attributes: [
                'subscribe',
                {name: 'history',   type: 'number',  help: 'Number of data points to keep in the buffer (oldest are dropped). Minimum 2.', default: 50},
                {name: 'color',     type: 'color',   help: 'Line and fill colour. Accepts any CSS colour value or a theme variable like var(--primary-color).', default: ''},
                {name: 'label',     type: 'string',  help: 'Optional text caption shown below the chart.'},
                {name: 'min',       type: 'number',  help: 'Fixed Y-axis minimum. Leave empty for auto-scaling.'},
                {name: 'max',       type: 'number',  help: 'Fixed Y-axis maximum. Leave empty for auto-scaling.'},
                {name: 'show-dots', type: 'boolean', help: 'Show a filled dot at the most-recent data point.', default: true},
                {name: 'fill',      type: 'boolean', help: 'Fill the area under the line with a semi-transparent version of the line colour.', default: false}
            ],
            styles: ['top', 'left', 'width', 'height', 'background', 'border', 'border-radius', 'padding'],
            defaultStyle: {width: '120px', height: '60px'}
        };
    }

    static properties = {
        history:  {type: Number,  reflect: true},
        color:    {type: String,  reflect: true},
        label:    {type: String,  reflect: true},
        min:      {type: Number,  reflect: true},
        max:      {type: Number,  reflect: true},
        showDots: {type: Boolean, reflect: true, attribute: 'show-dots'},
        fill:     {type: Boolean, reflect: true},
        _values:  {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: stretch;
            overflow: hidden; box-sizing: border-box;
        }
        svg { flex: 1; width: 100%; overflow: visible; }
        .label {
            text-align: center; font-size: 11px; color: var(--feezal-color, #555);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            line-height: 1.4; padding: 0 2px;
        }
        .editor-placeholder {
            flex: 1; border: 2px dashed #4a6080; background: #e8edf2;
            border-radius: 4px; display: flex; align-items: center; justify-content: center;
            gap: 4px; font-size: 11px; color: #4a6080; box-sizing: border-box; user-select: none;
        }
        .editor-placeholder .icon { font-family: 'Material Icons'; font-size: 16px; font-style: normal; }
    `];

    constructor() {
        super();
        this.history  = 50;
        this.color    = '';
        this.label    = '';
        this.min      = undefined;
        this.max      = undefined;
        this.showDots = true;
        this.fill     = false;
        this._values  = [];
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => this._onMessage(msg));
        }
    }

    _onMessage(msg) {
        const v = Number(this.getProperty(msg, this.messageProperty));
        if (isNaN(v)) return;
        const limit = Math.max(2, this.history || 50);
        this._values = [...this._values, v].slice(-limit);
    }

    _buildSvg() {
        const vals = this._values;
        if (vals.length < 2) return html``;

        const w = 100, h = 100;
        const rawMin = this.min !== undefined && this.min !== null ? Number(this.min) : Math.min(...vals);
        const rawMax = this.max !== undefined && this.max !== null ? Number(this.max) : Math.max(...vals);
        const range = rawMax - rawMin || 1;
        const accent = this.color || 'var(--sl-color-primary-600, #0284c7)';

        const toX = i => (i / (vals.length - 1)) * w;
        const toY = v => h - ((v - rawMin) / range) * h * 0.85 - h * 0.075;

        const pts = vals.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(' ');

        const fillPath = this.fill
            ? `M${toX(0).toFixed(2)},${h} L${pts.replace(/ /g, ' L')} L${toX(vals.length - 1).toFixed(2)},${h} Z`
            : null;

        const lastX = toX(vals.length - 1);
        const lastY = toY(vals[vals.length - 1]);

        return html`
            <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                ${fillPath ? html`<path d="${fillPath}" fill="${accent}" opacity="0.18"/>` : ''}
                <polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                ${this.showDots ? html`<circle cx="${lastX}" cy="${lastY}" r="3" fill="${accent}"/>` : ''}
            </svg>`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">show_chart</span> Chart
                </div>
                ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
        }
        return html`
            ${this._buildSvg()}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-basic-chart', FeezalElementBasicChart);
export {FeezalElementBasicChart};
