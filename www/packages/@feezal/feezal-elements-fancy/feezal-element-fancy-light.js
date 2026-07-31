/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {LightController, lightAttributes, lightDiscoveryMap} from '@feezal/feezal-controller-light';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-light (E139) — animated light card: the glow breathes
 * in while the light turns on; a known brightness scales the glow instead
 * (the seek segment). Behavior = the shared LightController (E137); this
 * element is a pure view.
 */
class FeezalElementFancyLight extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Light', category: 'Fancy', color: '#7a5c9e', icon: 'lightbulb'},
            description: 'Animated light card — the glow breathes with the state and scales with brightness. ' +
                'Tap toggles. Flat duotone vector animation, recoloured from the active theme.',
            discovery: {component: 'light', map: lightDiscoveryMap},
            attributes: [
                ...lightAttributes,
                ...fancyCommonAttributes,
                {name: 'label-on',  type: 'string', default: 'On', defaultI18n: {de: 'Ein'},
                    help: 'Displayed state text while on (brightness % is appended when known). Display only — NOT the MQTT payload (payload-on).'},
                {name: 'label-off', type: 'string', default: 'Off', defaultI18n: {de: 'Aus'},
                    help: 'Displayed state text while off. Display only — NOT the MQTT payload (payload-off).'},
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
        subscribe:  {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        publish:    {type: String, reflect: true},
        mode:       {type: String, reflect: true},
        // separate-mode state set — reflected so live topic/mode edits reach
        // updated() → rewireIfChanged() (the controller reads via getAttribute).
        // message-property is NOT re-declared here: FeezalElement already binds
        // that attribute, and a second property on the same attribute makes the
        // two reflections fight — the base default overwrote discovery-stamped
        // paths like payload.val.
        payloadMode:    {type: String, reflect: true, attribute: 'payload-mode'},
        jsonMap:        {type: String, reflect: true, attribute: 'json-map'},
        onOffSource:    {type: String, reflect: true, attribute: 'on-off-source'},
        subscribeState: {type: String, reflect: true, attribute: 'subscribe-state'},
        msgPropState:   {type: String, reflect: true, attribute: 'message-property-state'},
        publishState:   {type: String, reflect: true, attribute: 'publish-state'},
        labelOn:    {type: String, attribute: 'label-on'},
        labelOff:   {type: String, attribute: 'label-off'},
    };

    static styles = [...fancyBadgeStyles, fancyCardStyles, css`
        .stage { cursor: pointer; }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this.publish = '';
        this.mode = '';
        this.payloadMode = '';
        this.jsonMap = '';
        this.onOffSource = '';
        this.subscribeState = '';
        this.msgPropState = '';
        this.publishState = '';
        this.labelOn = 'On';
        this.labelOff = 'Off';
        this.light = new LightController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.light.rewireIfChanged();
    }

    animationKey() { return 'light'; }

    stateKey() { return this.light.on ? 'on' : 'off'; }

    seekFraction() {
        // a known brightness scrubs the glow instead of the breathing loop
        return this.light.on && this.light.brt !== null
            ? {name: 'brightness', t: this.light.brt / 100} : null;
    }

    stateText() {
        if (!this.light.on) return this.labelOff || 'Off';
        const on = this.labelOn || 'On';
        return this.light.brt !== null ? `${on} • ${Math.round(this.light.brt)} %` : on;
    }

    renderPose() {
        const on = this.light.on;
        const glowR = on ? (this.light.brt !== null ? 16 + 14 * (this.light.brt / 100) : 28) : 0;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            ${on ? svg`<circle class="tone-active" cx="50" cy="44" r="${glowR}" opacity="0.55"/>` : ''}
            <circle class="tone-base" cx="50" cy="44" r="17"/>
            <rect class="tone-base" x="43" y="63" width="14" height="10" rx="2"/>
            <rect class="tone-base" x="45" y="74" width="10" height="4" rx="2"/>
        </svg>`;
    }

    render() {
        return html`
            <div @click="${() => !feezal.isEditor && this.light.toggle()}">
                ${super.render()}
            </div>
        `;
    }
}

customElements.define('feezal-element-fancy-light', FeezalElementFancyLight);
export {FeezalElementFancyLight};
