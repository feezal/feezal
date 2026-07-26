/**
 * B81 + E158 — the settable numeric axes a continuous control can drive.
 *
 * **B81** — E156's slider←light axes only ever recognised the *separate-mode*
 * dialect (one command topic per axis, which is what Homematic emits). A
 * zigbee2mqtt lamp uses the **JSON schema**: one `command_topic` taking an
 * object, with brightness as a KEY inside it. `brightness_command_topic` is
 * absent, so `settable('brightness_command_topic')` was false and no z2m lamp
 * ever appeared in a slider's picker.
 *
 * The fix needed an element change, not only a map change: no slider or knob
 * could publish JSON — all four did `pub(topic, String(value))`. Hence
 * `publish-json-key`, pinned here both at the payload level and end-to-end
 * through the stamp.
 *
 * **E158** — two more axes on the same mechanism: a thermostat setpoint and a
 * blind position. Both publish a plain number, so neither uses the JSON key —
 * asserted, because wiring a JSON key onto a Homematic LEVEL topic would send
 * an object to a device expecting a scalar.
 *
 * The inherited guardrail is re-pinned for every new component: an on/off-only
 * lamp, an open/close-only blind and a read-only thermostat yield NO row.
 */
import {describe, it, expect, beforeAll} from 'vitest';

import {
    acceptedComponents, discoveryCandidates, discoveryVariantsFor, stampDiscovery,
} from '../src/feezal-discovery-stamp.js';
import {
    sliderDiscovery, settableAxes, lightSettableAxes,
    climateSetpointAxes, coverPositionAxes,
} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {numericPublishPayload} from '@feezal/feezal-element';

class SliderFixture extends HTMLElement {
    static feezal = {attributes: [{name: 'label'}], discovery: sliderDiscovery};
}

beforeAll(() => {
    if (!customElements.get('feezal-test-axes-slider')) {
        customElements.define('feezal-test-axes-slider', SliderFixture);
    }
});

const entity = (component, config, id = 'dev-1') => ({component, config, discovery_id: id, name: config.name});
const slider = () => customElements.get('feezal-test-axes-slider');
const rows = ent => discoveryCandidates(slider(), [ent]);
const stampRow = row => {
    const el = document.createElement('feezal-test-axes-slider');
    stampDiscovery(el, row.entity, row.variant);
    return el;
};
const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));

// ── B81: the publish payload itself ─────────────────────────────────────────
describe('numericPublishPayload', () => {
    it('publishes a bare string when no key is set (unchanged behaviour)', () => {
        expect(numericPublishPayload(128, '')).toBe('128');
        expect(numericPublishPayload(128, undefined)).toBe('128');
        expect(numericPublishPayload(0.5, null)).toBe('0.5');
    });

    it('wraps the value in a single-key object when a key is set', () => {
        expect(numericPublishPayload(128, 'brightness')).toBe('{"brightness":128}');
        expect(numericPublishPayload(370, 'color_temp')).toBe('{"color_temp":370}');
    });

    it('keeps the value NUMERIC in the JSON, not a string', () => {
        // {"brightness":"128"} is rejected by z2m — the quotes matter.
        expect(JSON.parse(numericPublishPayload('128', 'brightness')).brightness).toBe(128);
        expect(typeof JSON.parse(numericPublishPayload('0.5', 'brightness')).brightness).toBe('number');
    });
});

// ── B81: z2m / JSON-schema lights ───────────────────────────────────────────
describe('a zigbee2mqtt light offered to a slider (B81)', () => {
    const z2mLamp = entity('light', {
        name: 'Küchenlampe',
        schema: 'json',
        state_topic: 'zigbee2mqtt/lamp',
        command_topic: 'zigbee2mqtt/lamp/set',
        brightness: true,
        brightness_scale: 254,
        color_temp: true,
        min_mireds: 153, max_mireds: 500,
        supported_color_modes: ['color_temp'],
    });

    it('appears at all — the regression this bug is about', () => {
        expect(rows(z2mLamp).length).toBeGreaterThan(0);
    });

    it('yields a brightness row and a colour-temp row', () => {
        expect(rows(z2mLamp).map(r => r.label)).toEqual([
            expect.stringContaining('brightness'),
            expect.stringContaining('color temp'),
        ]);
    });

    it('wires brightness to the single command topic via a JSON key', () => {
        const el = stampRow(rows(z2mLamp)[0]);
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/lamp',
            publish: 'zigbee2mqtt/lamp/set',
            'publish-json-key': 'brightness',
            'message-property': 'payload.brightness',
            max: '254',            // the device's scale beats the 255 default
            min: '0',
        });
    });

    it('wires colour temp with the mired range', () => {
        const el = stampRow(rows(z2mLamp)[1]);
        expect(attrs(el)).toMatchObject({
            subscribe: 'zigbee2mqtt/lamp',
            publish: 'zigbee2mqtt/lamp/set',
            'publish-json-key': 'color_temp',
            'message-property': 'payload.color_temp',
            min: '153', max: '500',
        });
    });

    it('falls back to the JSON schema default scale when none is declared', () => {
        // A json light with no brightness_scale: the control's own 0–100
        // default would silently cap the lamp at 40 %.
        const noScale = entity('light', {
            schema: 'json', state_topic: 'z/x', command_topic: 'z/x/set', brightness: true,
        });
        const el = stampRow(rows(noScale)[0]);
        expect(attrs(el)).toMatchObject({min: '0', max: '255'});
    });

    it('recognises brightness through supported_color_modes alone', () => {
        const modeOnly = entity('light', {
            schema: 'json', state_topic: 'z/y', command_topic: 'z/y/set',
            supported_color_modes: ['xy'],
        });
        expect(rows(modeOnly).map(r => r.label)).toEqual([expect.stringContaining('brightness')]);
    });

    it('still excludes an on/off-only JSON light', () => {
        const relay = entity('light', {
            schema: 'json', state_topic: 'z/relay', command_topic: 'z/relay/set',
            supported_color_modes: ['onoff'],
        });
        expect(rows(relay)).toEqual([]);
    });

    it('a JSON light with no command topic is not settable at all', () => {
        const readOnly = entity('light', {schema: 'json', state_topic: 'z/z', brightness: true});
        expect(rows(readOnly)).toEqual([]);
    });

    it('leaves the Homematic separate-mode path alone', () => {
        const hmDimmer = entity('light', {
            name: 'Flurlicht', schema: 'separate',
            brightness_state_topic: 'hm/status/Flur:1/LEVEL',
            brightness_command_topic: 'hm/set/Flur:1/LEVEL',
            brightness_min: 0, brightness_scale: 1,
            message_property_brightness: 'payload.val',
        });
        const r = rows(hmDimmer);
        expect(r).toHaveLength(1);
        const el = stampRow(r[0]);
        expect(attrs(el)).toMatchObject({
            subscribe: 'hm/status/Flur:1/LEVEL',
            publish: 'hm/set/Flur:1/LEVEL',
            max: '1',
            'message-property': 'payload.val',
        });
        // and crucially: no JSON key — a LEVEL topic takes a scalar.
        expect(el.hasAttribute('publish-json-key')).toBe(false);
    });
});

// ── E158: climate setpoint ──────────────────────────────────────────────────
describe('a thermostat setpoint offered to a slider (E158)', () => {
    const trv = entity('climate', {
        name: 'Heizung Bad',
        temperature_state_topic: 'hm/status/HEIZ:4/SET_TEMPERATURE',
        temperature_command_topic: 'hm/set/HEIZ:4/SET_TEMPERATURE',
        min_temp: 4.5, max_temp: 30.5, temp_step: 0.5,
        message_property_setpoint: 'payload.val',
        current_temperature_topic: 'hm/status/HEIZ:4/ACTUAL_TEMPERATURE',
    });

    it('is offered as a labelled setpoint row', () => {
        const r = rows(trv);
        expect(r).toHaveLength(1);
        expect(r[0].label).toContain('setpoint');
    });

    it('wires value, range and step', () => {
        const el = stampRow(rows(trv)[0]);
        expect(attrs(el)).toMatchObject({
            subscribe: 'hm/status/HEIZ:4/SET_TEMPERATURE',
            publish: 'hm/set/HEIZ:4/SET_TEMPERATURE',
            min: '4.5', max: '30.5', step: '0.5',
            'message-property': 'payload.val',
        });
        expect(el.hasAttribute('publish-json-key')).toBe(false);
    });

    it('never wires the read-only actual temperature as the value', () => {
        // current_temperature_topic is present on the entity above; the slider
        // drives the SETPOINT, so it must not end up subscribed to the actual.
        const el = stampRow(rows(trv)[0]);
        expect(el.getAttribute('subscribe')).not.toContain('ACTUAL_TEMPERATURE');
    });

    it('excludes a climate entity with no settable setpoint', () => {
        const readOnly = entity('climate', {
            name: 'Nur Anzeige',
            current_temperature_topic: 'stat/temp', min_temp: 5, max_temp: 30,
        });
        expect(rows(readOnly)).toEqual([]);
        expect(discoveryVariantsFor(slider(), readOnly)).toEqual([]);
    });

    it('a water_heater rides the same axis (E150-shaped)', () => {
        const boiler = entity('water_heater', {
            name: 'Boiler',
            temperature_state_topic: 'stat/boiler/set',
            temperature_command_topic: 'cmnd/boiler/set',
            min_temp: 30, max_temp: 80, temp_step: 1,
        });
        const r = rows(boiler);
        expect(r).toHaveLength(1);
        expect(attrs(stampRow(r[0]))).toMatchObject({
            subscribe: 'stat/boiler/set', publish: 'cmnd/boiler/set', min: '30', max: '80',
        });
    });
});

// ── E158: cover position ────────────────────────────────────────────────────
describe('a blind position offered to a slider (E158)', () => {
    const hmBlind = entity('cover', {
        name: 'Rolladen Wohnzimmer',
        payload_mode: 'separate',
        position_state_topic: 'hm/status/Rolladen:1/LEVEL',
        position_command_topic: 'hm/set/Rolladen:1/LEVEL',
        position_min: 0, position_max: 1,
        message_property_position: 'payload.val',
    });

    it('wires the Homematic LEVEL range as-is (0…1, not 0–100)', () => {
        const r = rows(hmBlind);
        expect(r).toHaveLength(1);
        expect(r[0].label).toContain('position');
        expect(attrs(stampRow(r[0]))).toMatchObject({
            subscribe: 'hm/status/Rolladen:1/LEVEL',
            publish: 'hm/set/Rolladen:1/LEVEL',
            min: '0', max: '1',
            'message-property': 'payload.val',
        });
    });

    it('wires an HA / z2m cover through its set-position topic', () => {
        const z2mBlind = entity('cover', {
            name: 'Jalousie',
            position_topic: 'zigbee2mqtt/blind',
            set_position_topic: 'zigbee2mqtt/blind/set/position',
            position_template: '{{ value_json.position }}',
            position_open: 100, position_closed: 0,
        });
        const r = rows(z2mBlind);
        expect(r).toHaveLength(1);
        expect(attrs(stampRow(r[0]))).toMatchObject({
            subscribe: 'zigbee2mqtt/blind',
            publish: 'zigbee2mqtt/blind/set/position',
            min: '0', max: '100',
            'message-property': 'payload.position',
        });
    });

    it('publishes a plain number, never a JSON object', () => {
        // Both cover dialects take a scalar on a dedicated topic.
        for (const variant of coverPositionAxes) {
            const alsoSet = Object.values(variant.map)
                .filter(s => typeof s === 'object' && s.alsoSet)
                .flatMap(s => Object.keys(s.alsoSet));
            expect(alsoSet).not.toContain('publish-json-key');
        }
    });

    it('excludes an open/close-only blind', () => {
        const noPosition = entity('cover', {
            name: 'Garage',
            command_topic: 'cmnd/garage', payload_open: 'OPEN', payload_close: 'CLOSE',
            state_topic: 'stat/garage',
        });
        expect(rows(noPosition)).toEqual([]);
    });

    it('excludes a cover that reports position but cannot be positioned', () => {
        const reportOnly = entity('cover', {
            name: 'Nur Melder', position_topic: 'stat/pos', command_topic: 'cmnd/x',
        });
        expect(rows(reportOnly)).toEqual([]);
    });
});

// ── composition ─────────────────────────────────────────────────────────────
describe('settableAxes composition', () => {
    it('is exactly the light, climate and cover axes', () => {
        expect(settableAxes).toEqual([
            ...lightSettableAxes, ...climateSetpointAxes, ...coverPositionAxes,
        ]);
    });

    it('the slider accepts all of them plus number', () => {
        expect(acceptedComponents(slider()).sort())
            .toEqual(['climate', 'cover', 'light', 'number', 'water_heater']);
    });

    it('every variant is settable-gated — no axis is offered unconditionally', () => {
        // The guardrail as a structural property: a variant with no `when`
        // would offer read-only entities the moment its component matched.
        for (const variant of settableAxes) {
            expect(typeof variant.when).toBe('function');
        }
    });

    it('a sensor is still never offered', () => {
        expect(rows(entity('sensor', {name: 'T', state_topic: 'stat/t'}))).toEqual([]);
    });
});
