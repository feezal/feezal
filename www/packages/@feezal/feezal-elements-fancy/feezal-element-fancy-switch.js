/* global feezal */
import {html, css, payloadMatch} from '@feezal/feezal-element';
import {svg} from 'lit';
import {switchAcceptsLight} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-switch (E139/E162) — the plain on/off card, and the
 * family's motion showpiece: switching ON slides the knob with overshoot,
 * flashes a radial trim-path wipe and fires a two-burst multi-colour
 * confetti explosion (choreography derived from a user-supplied reference —
 * see the generator); switching OFF is a satisfying shrink-down (imploding
 * ring, knob slides home with a squash).
 *
 * Wiring: same simple MQTT contract as glass-switch / material-switch
 * (subscribe / message-property / publish / payload-on / payload-off) —
 * deliberately NOT a LightController view; use fancy-light for dimmables.
 */
class FeezalElementFancySwitch extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Fancy', color: '#7a5c9e', icon: 'toggle_on'},
            description: 'Animated switch card — the knob slides with overshoot, switching on celebrates ' +
                'with a radial flash and a confetti burst, switching off shrinks down. Tap toggles. ' +
                'Same MQTT contract as the glass switch; use the fancy light card for dimmables.',
            discovery: {
                component: 'switch',
                // E156: a lamp can be driven as a plain on/off switch.
                accepts: [switchAcceptsLight],
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
                {name: 'text-on',  type: 'string', default: 'On', defaultI18n: {de: 'Ein', es: 'Encendido', fr: 'Allumé', it: 'Acceso', pl: 'Włączony', pt: 'Ligado', tr: 'Açık'},  help: 'State text while on.'},
                {name: 'text-off', type: 'string', default: 'Off', defaultI18n: {de: 'Aus', es: 'Apagado', fr: 'Éteint', it: 'Spento', pl: 'Wyłączony', pt: 'Desligado', tr: 'Kapalı'}, help: 'State text while off.'},
                ...fancyCommonAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Topic reporting device availability — a badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', section: 'Availability', default: 'payload', help: 'Property path within availability messages.'},
                {name: 'payload-available',   type: 'string', section: 'Availability', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', section: 'Availability', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: fancyStyleDescriptors,
            defaultStyle: {width: '140px', height: '150px'},
            restrict: {minWidth: 80, minHeight: 90},
        };
    }

    static properties = {
        publish:    {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        textOn:     {type: String, attribute: 'text-on'},
        textOff:    {type: String, attribute: 'text-off'},
        _on:        {state: true},
    };

    static styles = [...fancyBadgeStyles, fancyCardStyles, css`
        .stage { cursor: pointer; }
    `];

    constructor() {
        super();
        this.publish = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.textOn = 'On';
        this.textOff = 'Off';
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

    animationKey() { return 'switch'; }

    stateKey() { return this._on ? 'on' : 'off'; }

    stateText() {
        return this._on ? (this.textOn || 'On') : (this.textOff || 'Off');
    }

    renderPose() {
        const on = this._on;
        const knobX = on ? 62 : 38;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <rect class="${on ? 'tone-active' : 'tone-base'}" x="28" y="35" width="44" height="20" rx="10"/>
            <circle cx="${knobX}" cy="45" r="8"
                style="fill: var(--primary-background-color)"/>
        </svg>`;
    }

    render() {
        return html`
            <div role="button" tabindex="0"
                @click="${this.toggle}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${super.render()}
            </div>
        `;
    }
}

customElements.define('feezal-element-fancy-switch', FeezalElementFancySwitch);
export {FeezalElementFancySwitch};
