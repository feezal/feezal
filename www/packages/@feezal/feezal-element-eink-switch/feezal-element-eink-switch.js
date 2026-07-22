/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles, payloadMatch} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-switch (E57)
 *
 * E-ink switch card — tap toggles a plain on/off device (relay, plug,
 * fan, …). Same MQTT contract as feezal-element-glass-switch
 * (subscribe / publish / payload-on / payload-off + availability badge),
 * rendered in the family's 1-bit discipline: thick rules, oversized
 * uppercase state word, whole card INVERTS while on. No transitions,
 * no colors, no shadows — state changes swap content instantly.
 *
 * Redraw discipline: renderSignature() is state word + badges (E57) —
 * a republished unchanged state never touches the panel.
 */

class FeezalElementEinkSwitch extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Eink', color: '#222222', icon: 'power_settings_new'},
            description: 'E-ink switch card — tap toggles a plain on/off device, inverted block while on, 1-bit, redraw-deduped. Same MQTT contract as the glass switch.',
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
                {name: 'text-on',  type: 'string', default: 'On',  help: 'State word while on (rendered uppercase).'},
                {name: 'text-off', type: 'string', default: 'Off', help: 'State word while off (rendered uppercase).'},
                {name: 'icon-on',  type: 'icon', help: 'Icon shown while ON (empty = the base icon).'},
                {name: 'icon-off', type: 'icon', help: 'Icon shown while OFF (empty = the base icon).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable, the card stays usable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'label', type: 'string', help: 'Label under the state (rendered uppercase).'},
                {name: 'icon',  type: 'string', default: 'power_settings_new', help: 'Icon name.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '22px', help: 'State word font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '180px', height: '120px'},
            restrict: {minWidth: 70, minHeight: 60},
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
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        _on:        {state: true},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 2px; align-items: flex-start; cursor: pointer; touch-action: manipulation; }
        feezal-icon { font-size: var(--feezal-eink-icon-size, 28px); line-height: 1; }
        .state { font-size: var(--feezal-eink-font-size-value, 22px); line-height: 1.05;
            text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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

    /** E57 redraw dedup: state word + badges are the visible output. */
    renderSignature() {
        return [this._on, this._available].join('|');
    }

    render() {
        const icon = (this._on ? this.iconOn : this.iconOff) || this.icon || 'power_settings_new';
        return html`
            <div class="card ${this._on ? 'inv' : ''}" role="button" tabindex="0"
                @click="${this.toggle}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } }}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                <feezal-icon name="${icon}"></feezal-icon>
                <span class="state">${this._on ? (this.textOn || 'On') : (this.textOff || 'Off')}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Switch' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-switch', FeezalElementEinkSwitch);
export {FeezalElementEinkSwitch};
