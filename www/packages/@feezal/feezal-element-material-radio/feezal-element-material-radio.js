/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/radio/radio.js';

let _uid = 0;

class FeezalElementMaterialRadio extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Radio', category: 'Simple', color: '#4a6080', icon: 'radio_button_checked'},
            description: 'MD3 radio button group — subscribes to current value and publishes the selected option.',
            attributes: [
                {name: 'subscribe',   type: 'mqttTopic', help: 'Topic to read the current selected value from.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish the selected value to.'},
                {name: 'options',     type: 'objectList', itemFields: [{key: 'value'}, {key: 'label'}], help: 'Radio options — one row per option (value published, label shown). Stored as a JSON array.'},
                {name: 'orientation', type: 'select',    options: ['vertical', 'horizontal'], help: 'Layout direction. Default: vertical'},
                {name: 'disabled',    type: 'boolean',   help: 'Disable all radio buttons.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-radio-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Radio button selected colour.'},
            ],
            defaultStyle: {width: '160px', height: '96px'},
        };
    }

    static properties = {
        subscribe:   {type: String,  reflect: true},
        publish:     {type: String,  reflect: true},
        options:     {type: String,  reflect: true},
        orientation: {type: String,  reflect: true},
        disabled:    {type: Boolean, reflect: true},
        _value:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box;
            padding: 4px;
            --feezal-radio-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary: var(--feezal-radio-color);
        }
        .group {
            display: flex;
            gap: 8px;
        }
        .group[horizontal] {
            flex-direction: row;
            flex-wrap: wrap;
        }
        .group:not([horizontal]) {
            flex-direction: column;
        }
        .option {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            font-size: 14px;
            color: var(--primary-text-color, #333);
        }
        .editor-ph {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 4px;
        }
        .editor-opt {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--secondary-text-color, #666);
        }
        .editor-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid var(--feezal-radio-color);
            flex-shrink: 0;
        }
    `];

    constructor() {
        super();
        this.subscribe   = '';
        this.publish     = '';
        this.options     = '[{"value":"a","label":"Option A"},{"value":"b","label":"Option B"}]';
        this.orientation = 'vertical';
        this.disabled    = false;
        this._value      = '';
        this._uid        = `radio-${++_uid}`;
    }

    get _options() {
        try {
            return JSON.parse(this.options);
        } catch {
            return [];
        }
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = String(this.getProperty(msg, this.messageProperty) ?? '');
            });
        }
    }

    _onChange(e) {
        if (!e.target.checked) return;
        this._value = e.target.value;
        if (this.publish) feezal.connection.pub(this.publish, this._value);
    }

    render() {
        const opts = this._options;
        return html`
            <div class="group" ?horizontal="${this.orientation === 'horizontal'}">
                ${opts.map(o => html`
                    <label class="option">
                        <md-radio
                            name="${this._uid}"
                            value="${o.value ?? o}"
                            ?checked="${String(o.value ?? o) === this._value}"
                            ?disabled="${this.disabled}"
                            @change="${this._onChange}">
                        </md-radio>
                        ${o.label ?? o.value ?? o}
                    </label>`)}
            </div>`;
    }
}

customElements.define('feezal-element-material-radio', FeezalElementMaterialRadio);
export {FeezalElementMaterialRadio};
