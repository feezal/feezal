/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/progress/linear-progress.js';

class FeezalElementMaterialProgress extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Progress', category: 'Material', color: '#4a6080', icon: 'data_usage'},
            description: 'MD3 progress indicator — linear bar or circular ring. Subscribes to a numeric value topic.',
            attributes: [
                {name: 'subscribe',        type: 'mqttTopic',
                    help: 'Topic to read current value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message (e.g. "payload.state").'},
                {name: 'mode',             type: 'select', options: ['linear', 'circular'], default: 'linear',
                    help: 'Display style: linear bar or circular ring.'},
                {name: 'min',              type: 'number',
                    help: 'Minimum value. Default: 0'},
                {name: 'max',              type: 'number',
                    help: 'Maximum value. Default: 100'},
                {name: 'indeterminate',    type: 'boolean',
                    help: 'Show indeterminate animated progress instead of a value.'},
                {name: 'label',            type: 'string',
                    help: 'Label text shown above (linear) or below (circular) the indicator.'},
                {name: 'show-value',       type: 'boolean',
                    help: 'Show current numeric value (linear: beside label; circular: centred inside ring).'},
                {name: 'unit',             type: 'string',
                    help: 'Unit suffix shown beside the centre value in circular mode.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-progress-color',
                    type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Active indicator colour.'},
                {property: '--feezal-progress-track-color',
                    type: 'color',
                    default: 'var(--divider-color, #e0e0e0)',
                    help: 'Inactive track colour.'},
                {property: '--feezal-progress-thickness',
                    type: 'string',
                    default: '4px',
                    help: 'Bar height (linear) or ring stroke width (circular), in px — e.g. 4px or 8px.'},
            ],
            defaultStyle: {width: '200px', height: '32px'},
        };
    }

    static properties = {
        subscribe:     {type: String,  reflect: true},
        mode:          {type: String,  reflect: true},
        min:           {type: Number,  reflect: true},
        max:           {type: Number,  reflect: true},
        indeterminate: {type: Boolean, reflect: true},
        label:         {type: String,  reflect: true},
        showValue:     {type: Boolean, reflect: true, attribute: 'show-value'},
        unit:          {type: String,  reflect: true},
        _value:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-sizing: border-box;
            --feezal-progress-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-progress-track-color: var(--divider-color, #e0e0e0);
            --feezal-progress-thickness: 4px;
            /* Wire MD3 linear tokens */
            --md-linear-progress-track-color: var(--feezal-progress-track-color);
            --md-linear-progress-active-indicator-color: var(--feezal-progress-color);
            --md-linear-progress-track-height: var(--feezal-progress-thickness);
            --md-linear-progress-active-indicator-height: var(--feezal-progress-thickness);
        }

        /* ── Linear ─────────────────────────────────────────────────── */
        .linear-wrap {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
            width: 100%;
            height: 100%;
            padding: 4px;
            box-sizing: border-box;
        }
        .label-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--secondary-text-color, #666);
        }
        md-linear-progress {
            width: 100%;
        }
        /* editor placeholder */
        .editor-linear {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
            padding: 4px;
            box-sizing: border-box;
        }
        .editor-bar {
            height: var(--feezal-progress-thickness, 4px);
            border-radius: 2px;
            background: linear-gradient(to right,
                var(--feezal-progress-color) 60%,
                var(--feezal-progress-track-color) 60%);
        }

        /* ── Circular ────────────────────────────────────────────────── */
        .circular-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            gap: 4px;
            padding: 4px;
            box-sizing: border-box;
        }
        .svg-area {
            position: relative;
            flex: 1 1 auto;
            min-height: 0;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        /*
         * No viewBox — SVG coordinates are in CSS px.
         * aspect-ratio keeps it square; max-width/height ensure it fits in
         * both portrait and landscape element proportions.
         */
        .ring-svg {
            max-width: 100%;
            max-height: 100%;
            aspect-ratio: 1;
            display: block;
            overflow: visible;
        }
        /*
         * CSS geometry properties (SVG 2 / CSS Geometry).
         * For a square SVG: 50% = half the edge length, so the circle is
         * centred and fills the element. stroke-width uses the same px unit
         * as --feezal-progress-thickness.
         */
        circle {
            fill: none;
            cx: 50%;
            cy: 50%;
            r: calc(50% - var(--feezal-progress-thickness, 4px) / 2 - 1px);
            stroke-width: var(--feezal-progress-thickness, 4px);
        }
        .track-circle {
            stroke: var(--feezal-progress-track-color);
        }
        .indicator-circle {
            stroke: var(--feezal-progress-color);
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: 50% 50%;
            transition: stroke-dasharray 0.3s ease;
        }
        .indicator-circle.spin {
            animation: ring-spin 1.4s linear infinite;
        }
        @keyframes ring-spin {
            from { transform: rotate(-90deg); }
            to   { transform: rotate(270deg); }
        }
        .centre-value {
            position: absolute;
            font-size: 14px;
            font-weight: 500;
            color: var(--primary-text-color, #333);
            text-align: center;
            line-height: 1;
            pointer-events: none;
        }
        .centre-unit {
            font-size: 0.7em;
            color: var(--secondary-text-color, #666);
        }
        .circular-label {
            font-size: 12px;
            color: var(--secondary-text-color, #666);
            flex-shrink: 0;
        }
    `];

    constructor() {
        super();
        this.subscribe     = '';
        this.mode          = 'linear';
        this.min           = 0;
        this.max           = 100;
        this.indeterminate = false;
        this.label         = '';
        this.showValue     = false;
        this.unit          = '';
        this._value        = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = parseFloat(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._value = v;
            });
        }
    }

    get _progress() {
        const range = (this.max - this.min) || 1;
        return Math.max(0, Math.min(1, (this._value - this.min) / range));
    }

    _renderLinear() {
        return html`
            <div class="linear-wrap">
                ${this.label || this.showValue ? html`
                    <div class="label-row">
                        <span>${this.label}</span>
                        ${this.showValue ? html`<span>${this._value}</span>` : ''}
                    </div>` : ''}
                <md-linear-progress
                    value="${this._progress}"
                    ?indeterminate="${this.indeterminate}">
                </md-linear-progress>
            </div>`;
    }

    _renderCircular() {
        const p = this.indeterminate ? 0.25 : this._progress;
        const dashArr = `${p} ${1 - p}`;
        return html`
            <div class="circular-wrap">
                <div class="svg-area">
                    <svg class="ring-svg" xmlns="http://www.w3.org/2000/svg">
                        <circle class="track-circle" pathLength="1" stroke-dasharray="1"></circle>
                        <circle class="indicator-circle ${this.indeterminate ? 'spin' : ''}"
                            pathLength="1" stroke-dasharray="${dashArr}"></circle>
                    </svg>
                    ${this.showValue ? html`
                        <div class="centre-value">
                            ${Math.round(this._value)}<span class="centre-unit">${this.unit}</span>
                        </div>` : ''}
                </div>
                ${this.label ? html`<div class="circular-label">${this.label}</div>` : ''}
            </div>`;
    }

    render() {
        return this.mode === 'circular' ? this._renderCircular() : this._renderLinear();
    }
}

customElements.define('feezal-element-material-progress', FeezalElementMaterialProgress);
export {FeezalElementMaterialProgress};
