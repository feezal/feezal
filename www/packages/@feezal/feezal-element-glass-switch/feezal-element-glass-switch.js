/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset, payloadMatch, glassCardStyles} from '@feezal/feezal-glass';

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
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
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
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        size:       {type: String, reflect: true},
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

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card {
            cursor: pointer;
            gap: 2px;
            transition: transform 0.15s ease, background 0.2s ease;
            touch-action: manipulation;
        }
        .card:active { transform: scale(0.97); }
        .card.on { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            transition: color 0.2s ease;
        }
        .card.on feezal-icon { color: var(--feezal-glass-accent, #30d158); }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; top: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
    `];

    constructor() {
        super();
        this.size = '';
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
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
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
