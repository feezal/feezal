/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/switch/switch.js';

class FeezalElementMaterialSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Switch',
                category: 'Material',
                color: '#4a6080'
            },
            description: 'Material Design 3 toggle switch. Subscribes to an MQTT topic for state and publishes ON/OFF on toggle.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',        type: 'mqttTopic', help: 'Topic to publish ON or OFF to on toggle.'},
                {name: 'label',          type: 'string',  help: 'Optional label shown to the right of the switch.'},
                {name: 'payload-on',     type: 'string',  help: 'Payload published when switched on.', default: 'ON'},
                {name: 'payload-off',    type: 'string',  help: 'Payload published when switched off.', default: 'OFF'},
                {name: 'icons',          type: 'boolean', help: 'Show check / x icons inside the thumb.', default: false}
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '80px', height: '32px'}
        };
    }

    static properties = {
        publish:    {type: String,  reflect: true},
        label:      {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        icons: {type: Boolean, reflect: true},
        _on:   {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            gap: 8px;
            --md-sys-color-primary:       var(--sl-color-primary-600, #0284c7);
            --md-sys-color-on-primary:    #fff;
            --md-switch-track-width:      52px;
            --md-switch-track-height:     32px;
        }
        .label {
            font-size: 13px;
            color: var(--feezal-color, #333);
            user-select: none;
        }
        .editor-ph {
            display: flex; align-items: center; gap: 6px;
            font-size: 12px; color: #1565c0; user-select: none;
        }
        .editor-ph .track {
            width: 44px; height: 24px; border-radius: 12px;
            background: #b0bec5; position: relative;
        }
        .editor-ph .thumb {
            width: 20px; height: 20px; border-radius: 50%;
            background: #fff; position: absolute; top: 2px; left: 2px;
        }
    `];

    constructor() {
        super();
        this.publish    = '';
        this.label      = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this.icons = false;
        this._on   = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1';
            });
        }
    }

    _toggle(e) {
        this._on = e.target.selected;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-ph">
                    <div class="track"><div class="thumb"></div></div>
                    ${this.label ? html`<span class="label">${this.label}</span>` : ''}
                </div>`;
        }
        return html`
            <md-switch ?selected="${this._on}" ?icons="${this.icons}"
                @change="${this._toggle}"></md-switch>
            ${this.label ? html`<span class="label">${this.label}</span>` : ''}`;
    }
}

customElements.define('feezal-element-material-switch', FeezalElementMaterialSwitch);
export {FeezalElementMaterialSwitch};
