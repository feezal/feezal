/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-switch (E55)
 *
 * Binary Metro tile: the whole tile toggles on tap (WP7-style) — accent
 * colour when ON, dimmed when OFF. Back: explicit ON / OFF buttons.
 */
class FeezalElementMetroSwitch extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Metro', color: '#1ba1e2', icon: 'power_settings_new'},
            description: 'Metro switch tile: tap toggles (accent = ON, dimmed = OFF); the back has explicit ON/OFF buttons.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish payload-on / payload-off to.'},
                {name: 'payload-on',  type: 'string', default: 'ON',  help: 'Payload published for / matched against the ON state. Default: ON'},
                {name: 'payload-off', type: 'string', default: 'OFF', help: 'Payload published for / matched against the OFF state. Default: OFF'},
                {name: 'icon-on',  type: 'icon', help: 'Icon shown while ON (empty = the base icon).'},
                {name: 'icon-off', type: 'icon', help: 'Icon shown while OFF (empty = the base icon).'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-off-color', type: 'color', default: '#333333', help: 'Tile colour in the OFF state.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        publish:    {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        iconOn:     {type: String, reflect: true, attribute: 'icon-on'},
        iconOff:    {type: String, reflect: true, attribute: 'icon-off'},
        _on:        {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-off-color: #333; }
        .face { transition: background 0.15s; }
        :host(:not([data-on])) .face { background: var(--feezal-metro-off-color); }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
    `];

    constructor() {
        super();
        this.publish = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.iconOn = '';
        this.iconOff = '';
        this._on = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const raw = v === null || v === undefined ? '' : String(v);
                if (raw === this.payloadOn) this._on = true;
                else if (raw === this.payloadOff) this._on = false;
                else this._on = Boolean(this._payloadCast(Boolean, v));
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Attribute hook for the OFF-state styling (host-level selector).
        if (changed.has('_on')) this.toggleAttribute('data-on', this._on);
    }

    _set(on) {
        if (feezal.isEditor) return;
        this._on = on;
        if (this.publish) {
            feezal.connection.pub(this.publish, on ? this.payloadOn : this.payloadOff);
        }
    }

    baseAction() {
        this._set(!this._on);
    }

    renderFront() {
        const icon = (this._on ? this.iconOn : this.iconOff) || this.icon;
        return html`
            ${icon ? html`<feezal-icon name="${icon}"></feezal-icon>` : ''}
            <div class="state">${this._on ? 'on' : 'off'}</div>`;
    }

    renderBack() {
        return html`
            <button class="mbtn ${this._on ? 'active' : ''}" @click="${() => this._set(true)}">ON</button>
            <button class="mbtn ${this._on ? '' : 'active'}" @click="${() => this._set(false)}">OFF</button>`;
    }
}

customElements.define('feezal-element-metro-switch', FeezalElementMetroSwitch);
export {FeezalElementMetroSwitch};
