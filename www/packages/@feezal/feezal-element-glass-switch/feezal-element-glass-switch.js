/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-glass-switch (E58)
 *
 * Frosted-glass switch card — tap toggles a plain on/off device (relay,
 * plug, fan, …). Same MQTT contract as feezal-element-material-switch
 * (subscribe / publish / payload-on / payload-off) plus the family's
 * availability badge. glass-light minus brightness/colour — use that card
 * for dimmable devices.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

export function payloadMatch(value, configured) {
    if (String(value).toLowerCase() === String(configured).toLowerCase()) return true;
    if (value === true && /^(on|true|1|yes)$/i.test(String(configured))) return true;
    if (value === false && /^(off|false|0|no)$/i.test(String(configured))) return true;
    return false;
}

class FeezalElementGlassSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Glass', color: '#7aa5c9', icon: 'power_settings_new'},
            description: 'Frosted-glass switch card — tap toggles a plain on/off device. Same MQTT contract as the material switch; use the glass light card for dimmables.',
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    // N31: availability is mapped automatically from the canonical discovery record.
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:           'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'On/off state topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Property path within message payloads (dot-notation). Default: payload'},
                {name: 'publish', type: 'mqttTopic', help: 'Topic to publish payload-on / payload-off to on tap.'},
                {name: 'payload-on',  type: 'string', default: 'ON',  help: 'Payload published for / matched against the ON state. Default: ON'},
                {name: 'payload-off', type: 'string', default: 'OFF', help: 'Payload published for / matched against the OFF state. Default: OFF'},
                {name: 'text-on',  type: 'string', default: 'On',  help: 'State text while on.'},
                {name: 'text-off', type: 'string', default: 'Off', help: 'State text while off.'},
                {name: 'icon-on',  type: 'icon', help: 'Icon shown while ON (empty = the base icon).'},
                {name: 'icon-off', type: 'icon', help: 'Icon shown while OFF (empty = the base icon).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a badge appears when unavailable, the card stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path for the availability topic. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'icon',  type: 'string', default: 'power_settings_new', help: 'Icon name.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#30d158', help: 'Icon/state colour while on.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        publish:    {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        textOn:     {type: String, reflect: true, attribute: 'text-on'},
        textOff:    {type: String, reflect: true, attribute: 'text-off'},
        iconOn:     {type: String, reflect: true, attribute: 'icon-on'},
        iconOff:    {type: String, reflect: true, attribute: 'icon-off'},
        // N31: availability inherited from FeezalElement.
        label:      {type: String, reflect: true},
        icon:       {type: String, reflect: true},
        degrade:    {type: Boolean, reflect: true},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        _on:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
        .card {
            position: absolute; inset: 0; box-sizing: border-box; cursor: pointer;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 11cqmin; gap: 2px;
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.55));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: transform 0.15s ease, background 0.2s ease;
            user-select: none; touch-action: manipulation;
        }
        @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.82)); }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        feezal-icon {
            font-size: 20cqmin; line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon { color: var(--feezal-glass-accent, #30d158); }
        .state { font-size: 13cqmin; font-weight: 700; }
        .label {
            font-size: 11cqmin; font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; top: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
    `];

    constructor() {
        super();
        this.publish = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.textOn = 'On';
        this.textOff = 'Off';
        this.iconOn = '';
        this.iconOff = '';
        this.label = '';
        this.icon = 'power_settings_new';
        this.degrade = false;
        this.discoveryId = '';
        this._on = false;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Topic attributes changed at runtime (inspector edits on the live
     * canvas) → updated() rewires instead of keeping the stale topics. */
    _wireSignature() {
        return String(this.subscribe);
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = payloadMatch(v, this.payloadOn);
            });
        }
    }

    toggle() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        const icon = (this._on ? this.iconOn : this.iconOff) || this.icon || 'power_settings_new';
        return html`
            <div class="card ${this._on ? 'on' : ''}" role="button" tabindex="0"
                @click="${this.toggle}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${icon}"></feezal-icon>
                <span class="state">${this._on ? (this.textOn || 'On') : (this.textOff || 'Off')}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Switch' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-switch', FeezalElementGlassSwitch);
export {FeezalElementGlassSwitch};
