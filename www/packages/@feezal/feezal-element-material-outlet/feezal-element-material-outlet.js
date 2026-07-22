/* global feezal */
/**
 * feezal-element-material-outlet (E121)
 *
 * Smart plug / outlet card: material-light's card chrome and centre power
 * button WITHOUT the brightness ring — implemented as a thin subclass of
 * FeezalElementMaterialLight locked to its on_off mode (E122), so there is
 * exactly one rendering/publishing code path for "big round power button".
 *
 * Differences from the light:
 *   - own palette entry (Outlet, power icon) — discoverability for "smart
 *     plug" without knowing it is technically a light in on_off mode;
 *   - attribute surface reduced to the on/off + availability contract (no
 *     brightness/CT/colour/effect/white attrs, no mode select);
 *   - generic attribute inspector (the light's custom E35 inspector is not
 *     inherited — nothing capability-shaped remains to configure).
 *
 * Styling reuses the --feezal-light-* tokens so outlets and lights follow the
 * same theme mapping automatically.
 */
import {FeezalElementMaterialLight} from '@feezal/feezal-element-material-light';

class FeezalElementMaterialOutlet extends FeezalElementMaterialLight {
    static get feezal() {
        return {
            // E130: palette name aligned with glass-switch/metro-switch — the
            // tag stays feezal-element-material-outlet (the material-switch
            // tag belongs to the MD3 toggle control; zero dashboard breakage).
            palette: {name: 'Switch', category: 'Material', color: '#1565c0', icon: 'power'},
            description: 'Switch / smart-plug card — a large round power button that subscribes to an ' +
                'on/off state topic and publishes on tap. Same look and theme tokens as the Material ' +
                'light card, without any dimming controls.',
            // E130: same discovery contract as glass-switch/metro-switch —
            // wired to this card's separate-mode attrs (subscribe-state /
            // publish-state; the state read falls back to message-property).
            // N31 maps availability automatically from the canonical record.
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe-state',
                    command_topic:  'publish-state',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:           'label',
                },
            },
            attributes: [
                {name: 'payload-mode', type: 'select', options: ['separate', 'json'], default: 'separate', help: 'separate = dedicated on/off state topic; json = single topic carrying a JSON object.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'JSON mode: base topic carrying the state JSON object. Separate mode: on/off state topic (fallback for subscribe-state). Also serves as base for dynamic attribute overrides via `<subscribe>/#`.'},
                {name: 'publish',   type: 'mqttTopic', help: 'json mode: command topic (usually …/set) that accepts a partial JSON object.'},
                {name: 'json-map',  type: 'string', default: '', help: 'json mode: optional JSON string overriding the default property→key map.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Property path within message payloads (dot-notation).'},
                {name: 'subscribe-state',   type: 'mqttTopic', help: 'Separate mode: on/off state topic. Falls back to `subscribe` when empty.'},
                {name: 'message-property-state', type: 'string', default: 'payload', help: 'Property path for the on/off state topic. Defaults to message-property.'},
                {name: 'publish-state',     type: 'mqttTopic', help: 'Topic to publish on/off.'},
                {name: 'payload-on',        type: 'string', default: 'on',  help: 'Payload representing "on".'},
                {name: 'payload-off',       type: 'string', default: 'off', help: 'Payload representing "off".'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability. When unavailable a small badge is shown; the control stays usable.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning the device is available.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning the device is unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path for availability topic. Defaults to message-property.'},
                {name: 'label', type: 'string', default: '', help: 'Optional label shown below the button.'},
                {name: 'label-off', type: 'string', default: 'off', help: 'Displayed centre text while the outlet is off (localise, e.g. "aus"). Display only — NOT the MQTT payload (payload-off).'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Shared with material-light so both follow one theme mapping.
                {property: '--feezal-light-on-color',      type: 'color', default: 'var(--primary-text-color)'},
                {property: '--feezal-light-off-color',     type: 'color', default: 'var(--secondary-text-color)'},
                {property: '--feezal-light-surface-color', type: 'color', default: 'var(--primary-background-color)'},
                {property: '--feezal-light-text-color',    type: 'color', default: 'var(--primary-text-color)'},
                {property: '--feezal-light-error-color',   type: 'color', default: 'var(--error-color)'}
            ],
            restrict: {minWidth: 60, minHeight: 60},
            defaultStyle: {width: '180px', height: '220px'}
        };
    }

    constructor() {
        super();
        // E122's switch-only mode IS this element. Not offered as an
        // attribute — an outlet has no other mode.
        this.mode = 'on_off';
    }
}

customElements.define('feezal-element-material-outlet', FeezalElementMaterialOutlet);
export {FeezalElementMaterialOutlet};
