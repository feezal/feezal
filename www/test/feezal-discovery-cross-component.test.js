/**
 * E156 — cross-component discovery.
 *
 * Discovery used to match an element only to entities whose component EQUALS
 * its own, which is too strict: a lamp can be driven as a plain on/off switch,
 * and a slider can drive a lamp's brightness or a `number` entity. Elements now
 * declare `discovery.accepts` variants, each with its own map, an optional
 * `when(config)` guard and a label suffix.
 *
 * Two properties matter most and are pinned hardest:
 *   - a *-slider must NEVER be offered a read-only value (the item's guardrail:
 *     a sensor has no command topic, so it must not appear at all), and
 *   - a Homematic dimmer driven as a switch must get payloads 1/0, never the
 *     1.005 OLD_LEVEL sentinel a light card uses — which depends on the map's
 *     key ORDER, so it is asserted rather than assumed.
 */
import {describe, it, expect, beforeAll} from 'vitest';

import {
    elementAcceptsComponent, acceptedComponents, discoveryCandidates,
    discoveryVariantsFor, stampDiscovery,
} from '../src/feezal-discovery-stamp.js';
import {switchAcceptsLight, sliderDiscovery}
    from '@feezal/feezal-element/feezal-discovery-fragments.js';

class SwitchFixture extends HTMLElement {
    static feezal = {
        attributes: [{name: 'label'}],
        discovery: {
            component: 'switch',
            accepts: [switchAcceptsLight],
            map: {
                state_topic: 'subscribe', command_topic: 'publish',
                payload_on: 'payload-on', payload_off: 'payload-off', name: 'label',
            },
        },
    };
}

class SliderFixture extends HTMLElement {
    static feezal = {attributes: [{name: 'label'}], discovery: sliderDiscovery};
}

beforeAll(() => {
    if (!customElements.get('feezal-test-e156-switch')) customElements.define('feezal-test-e156-switch', SwitchFixture);
    if (!customElements.get('feezal-test-e156-slider')) customElements.define('feezal-test-e156-slider', SliderFixture);
});

const entity = (component, config, id = 'dev-1') => ({component, config, discovery_id: id, name: config.name});
const stamp = (tag, ent, variant = null) => {
    const el = document.createElement(tag);
    stampDiscovery(el, ent, variant);
    return el;
};
const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));

// ── the mechanism ───────────────────────────────────────────────────────────
describe('multi-component acceptance', () => {
    const cls = () => customElements.get('feezal-test-e156-switch');

    it('a switch accepts both switch and light entities', () => {
        expect(acceptedComponents(cls())).toEqual(['switch', 'light']);
        expect(elementAcceptsComponent(cls(), 'switch')).toBe(true);
        expect(elementAcceptsComponent(cls(), 'light')).toBe(true);
        expect(elementAcceptsComponent(cls(), 'sensor')).toBe(false);
        expect(elementAcceptsComponent(cls(), undefined)).toBe(false);
    });

    it('a slider has no base component — everything arrives via accepts', () => {
        const slider = customElements.get('feezal-test-e156-slider');
        expect(slider.feezal.discovery.component).toBeUndefined();
        // E158 widened this beyond ['light', 'number'] — climate setpoints and
        // cover positions are settable numeric axes too.
        expect(acceptedComponents(slider).sort())
            .toEqual(['climate', 'cover', 'light', 'number', 'water_heater']);
        expect(elementAcceptsComponent(slider, 'sensor')).toBe(false);
    });
});

// ── switch ← light ──────────────────────────────────────────────────────────
describe('a light offered to a switch', () => {
    it('wires a zigbee on/off light through its state + command topics', () => {
        const el = stamp('feezal-test-e156-switch', entity('light', {
            name: 'Küchenlampe',
            state_topic: 'zigbee2mqtt/lamp', command_topic: 'zigbee2mqtt/lamp/set',
            payload_on: 'ON', payload_off: 'OFF',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/lamp',
            publish: 'zigbee2mqtt/lamp/set',
            'payload-on': 'ON',
            'payload-off': 'OFF',
        });
    });

    it('drives a Homematic dimmer with 1/0, not the 1.005 OLD_LEVEL sentinel', () => {
        const el = stamp('feezal-test-e156-switch', entity('light', {
            name: 'Flurlicht',
            on_off_source: 'brightness',
            payload_on: '1.005',            // what a LIGHT card would use
            payload_off: '0',
            brightness_state_topic: 'hm/status/Flur:1/LEVEL',
            brightness_command_topic: 'hm/set/Flur:1/LEVEL',
            message_property_brightness: 'payload.val',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'hm/status/Flur:1/LEVEL',
            publish: 'hm/set/Flur:1/LEVEL',
            'payload-on': '1',              // NOT 1.005 — a switch cannot restore a level
            'payload-off': '0',
            'message-property': 'payload.val',
        });
    });

    it('wires a Homematic relay light (E122 switch-only) incl. the native message_property dialect', () => {
        // The hm recognizer classifies a switch actuator channel named with a
        // light word as component `light` in relay mode — its record carries
        // message_property: 'payload.val' and NO value_template. The crossing
        // map must translate that dialect too, or the switch card keeps the
        // 'payload' default and never parses state.
        const el = stamp('feezal-test-e156-switch', entity('light', {
            name: 'Licht Terrasse',
            payload_mode: 'separate',
            state_topic: 'hm/status/Terrasse/STATE',
            state_command_topic: 'hm/set/Terrasse/STATE',
            supported_color_modes: ['onoff'],
            payload_on: 'true', payload_off: 'false',
            message_property: 'payload.val',
            message_property_state: 'payload.val',
        }));
        expect(attrs(el)).toMatchObject({
            subscribe: 'hm/status/Terrasse/STATE',
            publish: 'hm/set/Terrasse/STATE',
            'payload-on': 'true',
            'payload-off': 'false',
            'message-property': 'payload.val',
        });
    });

    it('a plain switch entity still uses the switch map', () => {
        const el = stamp('feezal-test-e156-switch', entity('switch', {
            name: 'Steckdose', state_topic: 'stat/plug', command_topic: 'cmnd/plug',
            payload_on: 'ON', payload_off: 'OFF',
        }));
        expect(attrs(el)).toMatchObject({subscribe: 'stat/plug', publish: 'cmnd/plug'});
    });

    it('an on/off-only light lands here too', () => {
        const el = stamp('feezal-test-e156-switch', entity('light', {
            state_topic: 'stat/relay', command_topic: 'cmnd/relay',
            supported_color_modes: ['onoff'],
        }));
        expect(attrs(el)).toMatchObject({subscribe: 'stat/relay', publish: 'cmnd/relay'});
    });
});

// ── slider ← light axes + number ────────────────────────────────────────────
describe('a light offered to a slider — one row per settable axis', () => {
    const slider = () => customElements.get('feezal-test-e156-slider');

    const dimmableCT = entity('light', {
        name: 'Wohnzimmer',
        state_topic: 'zigbee2mqtt/wz',
        brightness_state_topic: 'zigbee2mqtt/wz/brightness',
        brightness_command_topic: 'zigbee2mqtt/wz/set/brightness',
        brightness_scale: 254,
        color_temp_state_topic: 'zigbee2mqtt/wz/ct',
        color_temp_command_topic: 'zigbee2mqtt/wz/set/ct',
        min_mireds: 153, max_mireds: 500,
    });

    it('yields exactly two rows, labelled by axis', () => {
        const rows = discoveryCandidates(slider(), [dimmableCT]);
        expect(rows).toHaveLength(2);
        expect(rows.map(r => r.label)).toEqual([
            expect.stringContaining('brightness'),
            expect.stringContaining('color temp'),
        ]);
        expect(new Set(rows.map(r => r.entity))).toEqual(new Set([dimmableCT]));  // one entity
    });

    it('the brightness row wires that axis and its scale', () => {
        const [brightness] = discoveryCandidates(slider(), [dimmableCT]);
        const el = stamp('feezal-test-e156-slider', brightness.entity, brightness.variant);
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/wz/brightness',
            publish: 'zigbee2mqtt/wz/set/brightness',
            max: '254',
        });
    });

    it('the colour-temp row wires the mired range as-is', () => {
        const ct = discoveryCandidates(slider(), [dimmableCT])[1];
        const el = stamp('feezal-test-e156-slider', ct.entity, ct.variant);
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/wz/ct',
            publish: 'zigbee2mqtt/wz/set/ct',
            min: '153',
            max: '500',
        });
    });

    it('a light with no settable axis is not offered at all', () => {
        // An on/off relay lamp: a switch match, never a slider one.
        const relay = entity('light', {
            state_topic: 'stat/relay', command_topic: 'cmnd/relay',
            supported_color_modes: ['onoff'],
        });
        expect(discoveryCandidates(slider(), [relay])).toEqual([]);
    });

    it('a dimmable-but-not-CT light yields only the brightness row', () => {
        const dimOnly = entity('light', {
            brightness_state_topic: 'stat/b', brightness_command_topic: 'cmnd/b',
        });
        const rows = discoveryCandidates(slider(), [dimOnly]);
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toContain('brightness');
    });
});

describe('the settable-only guardrail', () => {
    const slider = () => customElements.get('feezal-test-e156-slider');

    it('never offers a read-only sensor to a slider', () => {
        const temperature = entity('sensor', {
            name: 'Temperatur', state_topic: 'stat/temp', unit_of_measurement: '°C',
        });
        expect(elementAcceptsComponent(slider(), 'sensor')).toBe(false);
        expect(discoveryCandidates(slider(), [temperature])).toEqual([]);
    });

    it('never offers a `number` that has no command topic', () => {
        const readOnly = entity('number', {name: 'Zähler', state_topic: 'stat/n', min: 0, max: 10});
        expect(discoveryCandidates(slider(), [readOnly])).toEqual([]);
        expect(discoveryVariantsFor(slider(), readOnly)).toEqual([]);
    });

    it('offers a settable `number` with its range', () => {
        const number = entity('number', {
            name: 'Zielwert', state_topic: 'stat/n', command_topic: 'cmnd/n',
            min: 5, max: 35, step: 0.5,
        });
        const rows = discoveryCandidates(slider(), [number]);
        expect(rows).toHaveLength(1);
        const el = stamp('feezal-test-e156-slider', rows[0].entity, rows[0].variant);
        expect(attrs(el)).toMatchObject({
            subscribe: 'stat/n', publish: 'cmnd/n', min: '5', max: '35', step: '0.5',
        });
    });
});

describe('regression — single-component elements are untouched', () => {
    it('an element with only a base component still yields one row per entity', () => {
        const cls = customElements.get('feezal-test-e156-switch');
        const rows = discoveryCandidates(cls, [
            entity('switch', {name: 'A', state_topic: 'a'}, 'a'),
            entity('switch', {name: 'B', state_topic: 'b'}, 'b'),
            entity('sensor', {name: 'C', state_topic: 'c'}, 'c'),   // not accepted
        ]);
        expect(rows).toHaveLength(2);
        expect(rows.every(r => r.variant === null)).toBe(true);
    });
});
