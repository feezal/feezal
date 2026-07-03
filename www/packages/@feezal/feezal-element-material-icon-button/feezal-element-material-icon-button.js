/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/iconbutton/icon-button.js';

class FeezalElementMaterialIconButton extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Icon', category: 'Material', color: '#4a6080', icon: 'smart_button'},
            description: 'MD3 icon button — publishes on tap. Enable toggle to subscribe/publish boolean state.',
            attributes: [
                {name: 'icon',        type: 'string',    help: 'Material icon name (e.g. "home", "power_settings_new").'},
                {name: 'icon-off',    type: 'string',    help: 'Icon shown when in OFF/unselected state (toggle mode only).'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish to on click.'},
                {name: 'payload',     type: 'string',    help: 'Payload to publish (action mode). Default: 1'},
                {name: 'toggle',      type: 'boolean',   help: 'Enable toggle mode: button tracks on/off state.'},
                {name: 'subscribe',   type: 'mqttTopic', help: 'Topic to read ON/OFF state from (toggle mode).'},
                {name: 'payload-on',  type: 'string',    help: 'Payload meaning ON/selected. Default: ON'},
                {name: 'payload-off', type: 'string',    help: 'Payload meaning OFF/unselected. Default: OFF'},
                {name: 'disabled',    type: 'boolean',   help: 'Disable the button.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-icon-button-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Icon and selected state colour.'},
            ],
            defaultStyle: {width: '48px', height: '48px'},
        };
    }

    static properties = {
        icon:       {type: String,  reflect: true},
        iconOff:    {type: String,  reflect: true, attribute: 'icon-off'},
        publish:    {type: String,  reflect: true},
        payload:    {type: String,  reflect: true},
        toggle:     {type: Boolean, reflect: true},
        subscribe:  {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        disabled:   {type: Boolean, reflect: true},
        _on:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            /* E38: scale the icon + touch target with the element size (cqmin = 1%
               of the smaller of the element's width/height, so it stays square). */
            container-type: size;
            --feezal-icon-button-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary: var(--feezal-icon-button-color);
            --md-sys-color-on-surface: var(--primary-text-color, #333);
            --md-icon-button-icon-size: 55cqmin;
            --md-icon-button-state-layer-width: 92cqmin;
            --md-icon-button-state-layer-height: 92cqmin;
        }
        md-icon-button { width: 100%; height: 100%; }
        .editor-ph {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: color-mix(in srgb, var(--feezal-icon-button-color) 12%, transparent);
            color: var(--feezal-icon-button-color);
            font-size: 20px;
            font-family: 'Material Symbols Outlined', 'Material Icons', sans-serif;
        }
    `];

    constructor() {
        super();
        this.icon       = 'touch_app';
        this.iconOff    = '';
        this.publish    = '';
        this.payload    = '1';
        this.toggle     = false;
        this.subscribe  = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this.disabled   = false;
        this._on        = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.toggle && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1' || v === 'true';
            });
        }
    }

    _onClick() {
        if (!this.publish) return;
        if (this.toggle) {
            this._on = !this._on;
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        } else {
            feezal.connection.pub(this.publish, this.payload);
        }
    }

    render() {
        // <feezal-icon> resolves set-prefixed names (mdi:…, knx-uf:…) through
        // the icon registry; bare names render the Material Icons ligature.
        // ::slotted(*) still sizes it to the scaled --md-icon-button-icon-size.
        if (this.toggle) {
            return html`
                <md-icon-button
                    toggle
                    ?selected="${this._on}"
                    ?disabled="${this.disabled}"
                    @click="${this._onClick}">
                    <feezal-icon slot="selected" name="${this.icon}"></feezal-icon>
                    <feezal-icon name="${this.iconOff || this.icon}"></feezal-icon>
                </md-icon-button>`;
        }
        return html`
            <md-icon-button
                ?disabled="${this.disabled}"
                @click="${this._onClick}">
                <feezal-icon name="${this.icon}"></feezal-icon>
            </md-icon-button>`;
    }
}

customElements.define('feezal-element-material-icon-button', FeezalElementMaterialIconButton);
export {FeezalElementMaterialIconButton};
