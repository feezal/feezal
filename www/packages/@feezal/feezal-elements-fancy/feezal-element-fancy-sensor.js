/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {sabotageBadge, faultBadge, feezalFaultStyles} from '@feezal/feezal-element/feezal-hm-fault.js';
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-sensor (E139) — animated ALARM sensor card (the E138
 * alarm slice: water-leak, smoke, gas, CO, vibration, tamper, generic): a
 * pulse ring radiates while triggered. The active tone defaults to the ERROR
 * colour — alarm semantics, per the E138 colour rules.
 */
class FeezalElementFancySensor extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Sensor', category: 'Fancy', color: '#7a5c9e', icon: 'warning'},
            description: 'Animated alarm-sensor card (leak, smoke, gas, CO, vibration, tamper) — ' +
                'a pulse radiates while triggered. Active tone defaults to the error colour.',
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('alarm')},
            attributes: [
                ...sensorAttributesFor('alarm'),
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
        subscribe:      {type: String, reflect: true},
        msgProp:        {type: String, reflect: true, attribute: 'message-property'},
        payloadActive:  {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:   {type: String, reflect: true, attribute: 'payload-clear'},
        type:           {type: String, reflect: true},
        textActive:     {type: String, attribute: 'text-active'},
        textClear:      {type: String, attribute: 'text-clear'},
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
    };

    static styles = [...fancyBadgeStyles, feezalFaultStyles, fancyCardStyles];

    constructor() {
        super();
        this.subscribe = '';
        this.msgProp = '';
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'water-leak';
        this.textActive = '';
        this.textClear = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.sensor = new SensorController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.sensor.rewireIfChanged();
    }

    animationKey() { return 'sensor'; }

    /** E138 alarm semantics: the active tone is the ERROR colour. */
    activeToneVar() { return '--error-color'; }

    stateKey() { return this.sensor.active ? 'active' : 'clear'; }

    stateText() {
        // controller resolves host override -> type default (Leak! etc.)
        return this.sensor.text();
    }

    renderPose() {
        const active = this.sensor.active;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            ${active ? svg`<circle class="tone-active" cx="50" cy="54" r="36" opacity="0.25"/>` : ''}
            <path class="tone-base" d="M50 26 L78 74 L22 74 Z"/>
            <rect class="${active ? 'tone-active' : 'tone-base'}" x="47" y="44" width="6" height="16" rx="3"
                style="${active ? '' : 'fill: var(--primary-background-color)'}"/>
            <rect class="${active ? 'tone-active' : 'tone-base'}" x="47" y="63" width="6" height="6" rx="3"
                style="${active ? '' : 'fill: var(--primary-background-color)'}"/>
        </svg>`;
    }

    renderBadges() {
        return html`
            ${batteryLowBadge(this.sensor.batteryLow)}
            ${sabotageBadge(this.sensor.sabotage)}
            ${faultBadge(this.sensor.error)}
        `;
    }
}

customElements.define('feezal-element-fancy-sensor', FeezalElementFancySensor);
export {FeezalElementFancySensor};
