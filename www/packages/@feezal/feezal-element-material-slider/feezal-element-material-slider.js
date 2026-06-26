/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/slider/slider.js';

class FeezalElementMaterialSlider extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Slider',
                category: 'Material',
                color: '#1565c0'
            },
            description: 'Material Design 3 slider. Subscribes to an MQTT topic for the current value and publishes the numeric value on change.',
            attributes: [
                'subscribe',
                {name: 'publish',  type: 'mqttTopic', help: 'Topic to publish the numeric value to on change.'},
                {name: 'min',      type: 'number',  help: 'Minimum value.', default: 0},
                {name: 'max',      type: 'number',  help: 'Maximum value.', default: 100},
                {name: 'step',     type: 'number',  help: 'Step size.', default: 1},
                {name: 'labeled',  type: 'boolean', help: 'Show a value label bubble above the thumb while dragging.', default: false}
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '160px', height: '48px'}
        };
    }

    static properties = {
        publish: {type: String,  reflect: true},
        min:     {type: Number,  reflect: true},
        max:     {type: Number,  reflect: true},
        step:    {type: Number,  reflect: true},
        labeled: {type: Boolean, reflect: true},
        _value:  {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            --md-sys-color-primary:       var(--sl-color-primary-600, #0284c7);
            --md-sys-color-surface:       var(--feezal-bg, #fff);
            --md-sys-color-on-surface:    var(--feezal-color, #333);
        }
        md-slider { width: 100%; }
        .editor-ph {
            flex: 1; height: 4px; border-radius: 2px;
            background: linear-gradient(to right, var(--sl-color-primary-600, #0284c7) 50%, var(--feezal-border, #ccc) 50%);
            position: relative;
        }
        .editor-ph::after {
            content: '';
            position: absolute; left: 50%; top: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px;
            border-radius: 50%;
            background: var(--sl-color-primary-600, #0284c7);
        }
    `];

    constructor() {
        super();
        this.publish = '';
        this.min     = 0;
        this.max     = 100;
        this.step    = 1;
        this.labeled = false;
        this._value  = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._value = v;
            });
        }
    }

    _change(e) {
        this._value = e.target.value;
        if (this.publish) {
            feezal.connection.pub(this.publish, String(this._value));
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph"></div>`;
        }
        return html`
            <md-slider
                min="${this.min}" max="${this.max}" step="${this.step}"
                value="${this._value}"
                ?labeled="${this.labeled}"
                @change="${this._change}">
            </md-slider>`;
    }
}

customElements.define('feezal-element-material-slider', FeezalElementMaterialSlider);
export {FeezalElementMaterialSlider};
