/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/progress/circular-progress.js';

class FeezalElementMaterialProgressCircular extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Circular Progress', category: 'Material', color: '#4a6080', icon: 'donut_large'},
            description: 'MD3 circular progress indicator — subscribes to a numeric value topic.',
            attributes: [
                {name: 'subscribe',     type: 'mqttTopic', help: 'Topic to read current value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'min',           type: 'number',    help: 'Minimum value. Default: 0'},
                {name: 'max',           type: 'number',    help: 'Maximum value. Default: 100'},
                {name: 'indeterminate', type: 'boolean',   help: 'Show indeterminate spinning animation.'},
                {name: 'show-value',    type: 'boolean',   help: 'Show current value in the centre of the ring.'},
                {name: 'label',         type: 'string',    help: 'Label text shown below the ring.'},
                {name: 'unit',          type: 'string',    help: 'Unit suffix shown beside the centre value.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-progress-circular-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Progress ring indicator colour.'},
            ],
            defaultStyle: {width: '80px', height: '80px'},
        };
    }

    static properties = {
        subscribe:     {type: String,  reflect: true},
        min:           {type: Number,  reflect: true},
        max:           {type: Number,  reflect: true},
        indeterminate: {type: Boolean, reflect: true},
        showValue:     {type: Boolean, reflect: true, attribute: 'show-value'},
        label:         {type: String,  reflect: true},
        unit:          {type: String,  reflect: true},
        _value:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            --feezal-progress-circular-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary: var(--feezal-progress-circular-color);
            --md-circular-progress-active-indicator-color: var(--feezal-progress-circular-color);
        }
        .wrap {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .centre-value {
            position: absolute;
            font-size: 14px;
            font-weight: 500;
            color: var(--primary-text-color, #333);
            text-align: center;
            line-height: 1;
        }
        .centre-unit {
            font-size: 10px;
            color: var(--secondary-text-color, #666);
        }
        .label {
            font-size: 12px;
            color: var(--secondary-text-color, #666);
            margin-top: 4px;
        }
        md-circular-progress {
            width: 100%;
            height: 100%;
        }
        .editor-ph {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .editor-ring {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 4px solid var(--divider-color, #e0e0e0);
            border-top-color: var(--feezal-progress-circular-color);
            box-sizing: border-box;
        }
    `];

    constructor() {
        super();
        this.subscribe     = '';
        this.min           = 0;
        this.max           = 100;
        this.indeterminate = false;
        this.showValue     = false;
        this.label         = '';
        this.unit          = '';
        this._value        = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
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

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-ph">
                    <div class="editor-ring"></div>
                    ${this.label ? html`<div class="label">${this.label}</div>` : ''}
                </div>`;
        }
        return html`
            <div class="wrap">
                <md-circular-progress
                    value="${this._progress}"
                    ?indeterminate="${this.indeterminate}">
                </md-circular-progress>
                ${this.showValue ? html`
                    <div class="centre-value">
                        ${Math.round(this._value)}<span class="centre-unit">${this.unit}</span>
                    </div>` : ''}
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-progress-circular', FeezalElementMaterialProgressCircular);
export {FeezalElementMaterialProgressCircular};
