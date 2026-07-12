/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/slider/slider.js';
import {deriveStep} from './derive-step.js';

class FeezalElementCarbonSlider extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Slider',
                category: 'Carbon',
                color: '#393939'
            },
            description: 'IBM Carbon slider. Subscribes to an MQTT topic for the current value and publishes the numeric value on change.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.level" to navigate into a JSON payload.'},
                {name: 'publish',  type: 'mqttTopic', help: 'Topic to publish the numeric value to on change.'},
                {name: 'min',      type: 'number',  help: 'Minimum value.', default: 0},
                {name: 'max',      type: 'number',  help: 'Maximum value.', default: 100},
                {name: 'step',     type: 'number',  help: 'Step size. Empty: derived from the range — (max − min) / 100 — so sub-integer ranges (e.g. Homematic 0–1) stay usable; 1 for the default 0–100 range. An explicit value wins.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-slider-color',       type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Filled track and handle colour.'},
                {property: '--feezal-slider-track-color', type: 'color', default: 'var(--divider-color, #e0e0e0)', help: 'Unfilled track colour.'},
                {property: '--feezal-slider-label-color', type: 'color', default: 'var(--primary-text-color, #333)', help: 'Min/max label colour.'},
            ],
            defaultStyle: {width: '200px', height: '48px'}
        };
    }

    static properties = {
        publish: {type: String,  reflect: true},
        min:     {type: Number,  reflect: true},
        max:     {type: Number,  reflect: true},
        step:    {type: Number,  reflect: true},
        _value:  {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            overflow: visible;
            --feezal-slider-color:       var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-slider-track-color: var(--divider-color, #e0e0e0);
            --feezal-slider-label-color: var(--primary-text-color, var(--feezal-color, #333));
            /* Carbon token wiring — filled track/handle follow border-interactive
               (with interactive as the pressed accent); the rest of the track
               follows border-subtle. */
            --cds-border-interactive:  var(--feezal-slider-color);
            --cds-interactive:         var(--feezal-slider-color);
            --cds-icon-primary:        var(--feezal-slider-color);
            --cds-border-subtle:       var(--feezal-slider-track-color);
            --cds-border-subtle-01:    var(--feezal-slider-track-color);
            --cds-text-primary:        var(--feezal-slider-label-color);
            --cds-text-secondary:      var(--feezal-slider-label-color);
            --cds-focus:               var(--feezal-slider-color);
        }
        cds-slider { width: 100%; }
    `];

    constructor() {
        super();
        this.publish = '';
        this.min     = 0;
        this.max     = 100;
        // B17: step deliberately NOT defaulted — derived from the range when unset.
        this._value  = 0;
    }

    get effectiveStep() {
        return deriveStep(this.step, this.min, this.max);
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

    _change(e) {
        this._value = e.detail.value;
        if (this.publish) {
            feezal.connection.pub(this.publish, String(this._value));
        }
    }

    render() {
        return html`
            <cds-slider
                min="${this.min}" max="${this.max}" step="${this.effectiveStep}"
                value="${this._value}"
                hide-text-input
                @cds-slider-changed="${this._change}">
            </cds-slider>`;
    }
}

customElements.define('feezal-element-carbon-slider', FeezalElementCarbonSlider);
export {FeezalElementCarbonSlider, deriveStep};
