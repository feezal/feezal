/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {switchAcceptsLight} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {FeezalElementFancyLight} from './feezal-element-fancy-light.js';
import {fancyStyleDescriptors, fancyCommonAttributes} from './fancy-shared.js';

/**
 * feezal-element-fancy-switch (E139/E162) — the plain on/off card, and the
 * family's motion showpiece: switching ON slides the knob with overshoot,
 * flashes a radial trim-path wipe and fires a two-burst multi-colour
 * confetti explosion (choreography derived from a user-supplied reference —
 * see the generator); switching OFF is a satisfying shrink-down (imploding
 * ring, knob slides home with a squash).
 *
 * Wiring: FeezalElementFancyLight locked to plain on/off (the circle-switch
 * precedent) — same LightController behavior layer, no brightness seek.
 */
class FeezalElementFancySwitch extends FeezalElementFancyLight {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Fancy', color: '#7a5c9e', icon: 'toggle_on'},
            description: 'Animated switch card — the knob slides with overshoot, switching on celebrates ' +
                'with a radial flash and a confetti burst, switching off shrinks down. Tap toggles.',
            discovery: {
                component: 'switch',
                accepts: [switchAcceptsLight],
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:           'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Switch state topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                {name: 'payload-on',  type: 'string', default: 'ON',  help: 'Payload value meaning on (also published on tap).'},
                {name: 'payload-off', type: 'string', default: 'OFF', help: 'Payload value meaning off (also published on tap).'},
                {name: 'publish', type: 'mqttTopic', help: 'Command topic a tap publishes to.'},
                ...fancyCommonAttributes,
                {name: 'label-on',  type: 'string', default: 'On', defaultI18n: {de: 'Ein'},
                    help: 'Displayed state text while on. Display only — NOT the MQTT payload (payload-on).'},
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

    animationKey() { return 'switch'; }

    /** Plain on/off — never the brightness-glow seek. */
    seekFraction() { return null; }

    stateText() {
        return this.light.on ? (this.labelOn || 'On') : (this.labelOff || 'Off');
    }

    renderPose() {
        const on = this.light.on;
        const knobX = on ? 62 : 38;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <rect class="${on ? 'tone-active' : 'tone-base'}" x="28" y="35" width="44" height="20" rx="10"/>
            <circle cx="${knobX}" cy="45" r="8"
                style="fill: var(--primary-background-color)"/>
        </svg>`;
    }
}

customElements.define('feezal-element-fancy-switch', FeezalElementFancySwitch);
export {FeezalElementFancySwitch};
