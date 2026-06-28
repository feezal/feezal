/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/progress/linear-progress.js';

class FeezalElementMaterialProgressLinear extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Linear Progress', category: 'Material', color: '#4a6080', icon: 'linear_scale'},
            description: 'MD3 linear progress bar — subscribes to a numeric value topic.',
            attributes: [
                {name: 'subscribe',     type: 'mqttTopic', help: 'Topic to read current value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'min',           type: 'number',    help: 'Minimum value. Default: 0'},
                {name: 'max',           type: 'number',    help: 'Maximum value. Default: 100'},
                {name: 'indeterminate', type: 'boolean',   help: 'Show indeterminate (animated) progress.'},
                {name: 'label',         type: 'string',    help: 'Label text shown above the bar.'},
                {name: 'show-value',    type: 'boolean',   help: 'Show current numeric value beside the bar.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '200px', height: '32px'},
        };
    }

    static properties = {
        subscribe:     {type: String,  reflect: true},
        min:           {type: Number,  reflect: true},
        max:           {type: Number,  reflect: true},
        indeterminate: {type: Boolean, reflect: true},
        label:         {type: String,  reflect: true},
        showValue:     {type: Boolean, reflect: true, attribute: 'show-value'},
        _value:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
            padding: 4px;
            box-sizing: border-box;
            --md-sys-color-primary: var(--sl-color-primary-600, #0284c7);
            --md-linear-progress-track-color: var(--divider-color, #e0e0e0);
            --md-linear-progress-active-indicator-color: var(--sl-color-primary-600, #0284c7);
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
        .editor-ph {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
        }
        .editor-bar {
            height: 4px;
            border-radius: 2px;
            background: linear-gradient(to right,
                var(--sl-color-primary-600, #0284c7) 60%,
                var(--divider-color, #e0e0e0) 60%);
        }
    `];

    constructor() {
        super();
        this.subscribe     = '';
        this.min           = 0;
        this.max           = 100;
        this.indeterminate = false;
        this.label         = '';
        this.showValue     = false;
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
                    ${this.label ? html`<div class="label-row"><span>${this.label}</span></div>` : ''}
                    <div class="editor-bar"></div>
                </div>`;
        }
        return html`
            ${this.label || this.showValue ? html`
                <div class="label-row">
                    <span>${this.label}</span>
                    ${this.showValue ? html`<span>${this._value}</span>` : ''}
                </div>` : ''}
            <md-linear-progress
                value="${this._progress}"
                ?indeterminate="${this.indeterminate}">
            </md-linear-progress>`;
    }
}

customElements.define('feezal-element-material-progress-linear', FeezalElementMaterialProgressLinear);
export {FeezalElementMaterialProgressLinear};
