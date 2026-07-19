/**
 * E102 WP3 — climate device-profile presets + the stamping picker.
 *
 * Unit: each profile's build() returns the expected key attributes and the
 *       base-topic/channel → topic assembly is correct.
 * DOM:  the <feezal-climate-profiles> picker emits one feezal-attribute-changed
 *       per stamped attribute, and the overwrite confirmation gates when the
 *       element already has a non-default `modes` attribute.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {CLIMATE_PROFILES, getClimateProfile, hmTopics} from '../src/climate-profiles.js';
import '../src/feezal-climate-profiles.js';

const byId = id => getClimateProfile(id);

describe('hmTopics() — topic assembly', () => {
    it('assembles status/set/paramset around the prefix, matching hm2mqtt shapes', () => {
        const t = hmTopics('hm', 'TRV/4');
        expect(t.status('SET_TEMPERATURE')).toBe('hm/status/TRV/4/SET_TEMPERATURE');
        expect(t.set('AUTO_MODE')).toBe('hm/set/TRV/4/AUTO_MODE');
        expect(t.paramset()).toBe('hm/paramset/TRV/4/VALUES');
    });

    it('defaults the prefix to hm and trims stray slashes', () => {
        const t = hmTopics('', '/OEQ1234567:1/');
        expect(t.set('CONTROL_MODE')).toBe('hm/set/OEQ1234567:1/CONTROL_MODE');
        expect(t.paramset()).toBe('hm/paramset/OEQ1234567:1/VALUES');
    });
});

describe('CLIMATE_PROFILES — five templates', () => {
    it('exposes exactly the five expected profile ids', () => {
        expect(CLIMATE_PROFILES.map(p => p.id)).toEqual([
            'hm2mqtt-bidcos', 'hm2mqtt-hmip', 'nodered-flows', 'z2m-trv', 'generic',
        ]);
    });

    it('hm2mqtt-bidcos: AUTO_MODE/MANU_MODE/BOOST_MODE + off sentinel 4.5', () => {
        const m = byId('hm2mqtt-bidcos').build('hm', 'TRV/4');
        expect(m['payload-mode']).toBe('separate');
        expect(m['subscribe-setpoint']).toBe('hm/status/TRV/4/SET_TEMPERATURE');
        expect(m['publish-setpoint']).toBe('hm/set/TRV/4/SET_TEMPERATURE');
        expect(m['subscribe-mode']).toBe('hm/status/TRV/4/CONTROL_MODE');
        expect(m['subscribe-valve']).toBe('hm/status/TRV/4/VALVE_STATE');
        expect(m['valve-min']).toBe('0');
        expect(m['valve-max']).toBe('100');
        // metro reads actual from `subscribe`; material/glass from `subscribe-actual`.
        expect(m.subscribe).toBe('hm/status/TRV/4/ACTUAL_TEMPERATURE');
        expect(m['subscribe-actual']).toBe('hm/status/TRV/4/ACTUAL_TEMPERATURE');

        const modes = m.modes;
        const auto = modes.find(x => x.label === 'Auto');
        const manu = modes.find(x => x.label === 'Manu');
        const off = modes.find(x => x.label === 'Off');
        const boost = modes.find(x => x.label === 'Boost');
        expect(auto).toMatchObject({value: 0, publish: 'hm/set/TRV/4/AUTO_MODE', payload: 'true'});
        expect(manu).toMatchObject({value: 1, publish: 'hm/set/TRV/4/MANU_MODE', payload: '$setpoint'});
        expect(off).toMatchObject({value: 1, publish: 'hm/set/TRV/4/MANU_MODE', payload: '4.5'});
        expect(off['match-setpoint-max']).toBe(4.5);
        expect(boost).toMatchObject({value: 3, momentary: true, publish: 'hm/set/TRV/4/BOOST_MODE', payload: 'true', off: 'restore'});
    });

    it('hm2mqtt-hmip: putParamset VALUES object payloads + valve-max 1 + BOOST_MODE toggle', () => {
        const m = byId('hm2mqtt-hmip').build('hm', 'HEAT:1');
        expect(m['subscribe-setpoint']).toBe('hm/status/HEAT:1/SET_POINT_TEMPERATURE');
        expect(m['subscribe-mode']).toBe('hm/status/HEAT:1/SET_POINT_MODE');
        expect(m['subscribe-valve']).toBe('hm/status/HEAT:1/LEVEL');
        expect(m['valve-max']).toBe('1');   // HmIP LEVEL 0…1

        const modes = m.modes;
        const auto = modes.find(x => x.label === 'Auto');
        const manu = modes.find(x => x.label === 'Manu');
        const off = modes.find(x => x.label === 'Off');
        const boost = modes.find(x => x.label === 'Boost');
        expect(auto).toMatchObject({value: 0, publish: 'hm/set/HEAT:1/CONTROL_MODE', payload: '0'});
        // Off/Manu are combined via the putParamset VALUES topic with an object payload.
        expect(manu.publish).toBe('hm/paramset/HEAT:1/VALUES');
        expect(manu.payload).toEqual({CONTROL_MODE: 1, SET_POINT_TEMPERATURE: '$setpoint'});
        expect(off.publish).toBe('hm/paramset/HEAT:1/VALUES');
        expect(off.payload).toEqual({CONTROL_MODE: 1, SET_POINT_TEMPERATURE: 4.5});
        expect(off['match-setpoint-max']).toBe(4.5);
        expect(boost).toMatchObject({value: 3, momentary: true, publish: 'hm/set/HEAT:1/BOOST_MODE', payload: 'true'});
        expect(boost.off).toEqual({publish: 'hm/set/HEAT:1/BOOST_MODE', payload: 'false'});
    });

    it('nodered-flows: single logical command topics, no paramset', () => {
        const m = byId('nodered-flows').build('living/thermostat');
        expect(m['publish-mode']).toBe('living/thermostat/mode/set');
        expect(m['publish-setpoint']).toBe('living/thermostat/setpoint/set');
        expect(m['subscribe-valve']).toBe('living/thermostat/valve');
        // no paramset topics anywhere in the map
        expect(JSON.stringify(m)).not.toContain('paramset');
        expect(m.modes.map(x => x.value)).toEqual(['auto', 'manu', 'off', 'boost']);
        expect(m.modes.find(x => x.value === 'boost')).toMatchObject({momentary: true, off: 'restore'});
    });

    it('z2m-trv: json mode with system_mode / occupied_heating_setpoint map', () => {
        const m = byId('z2m-trv').build('zigbee2mqtt/TRV');
        expect(m['payload-mode']).toBe('json');
        expect(m.subscribe).toBe('zigbee2mqtt/TRV');
        expect(m.publish).toBe('zigbee2mqtt/TRV/set');
        expect(m['json-map']).toMatchObject({
            setpoint: 'occupied_heating_setpoint',
            actual: 'local_temperature',
            mode: 'system_mode',
        });
        expect(m.modes.map(x => x.value)).toEqual(['off', 'heat', 'auto']);
    });

    it('generic: minimal base subscribe/publish, empty modes, no HM specifics', () => {
        const m = byId('generic').build('house/heat');
        expect(m['payload-mode']).toBe('separate');
        expect(m['subscribe-setpoint']).toBe('house/heat/setpoint');
        expect(m['publish-setpoint']).toBe('house/heat/setpoint/set');
        expect(m.modes).toEqual([]);
        expect(JSON.stringify(m)).not.toContain('CONTROL_MODE');
    });
});

describe('<feezal-climate-profiles> — stamping picker DOM', () => {
    let picker;
    let target;
    let events;

    beforeEach(async () => {
        target = document.createElement('div');   // stand-in climate element
        document.body.append(target);
        picker = document.createElement('feezal-climate-profiles');
        picker.element = target;
        events = [];
        picker.addEventListener('feezal-attribute-changed', e => events.push(e.detail));
        document.body.append(picker);
        await picker.updateComplete;
    });

    it('Stamp emits one feezal-attribute-changed per attribute in the map', async () => {
        picker._profileId = 'hm2mqtt-bidcos';
        picker._baseTopic = 'hm';
        picker._channel = 'TRV/4';
        await picker.updateComplete;

        picker.shadowRoot.querySelector('.stamp-btn').click();
        await picker.updateComplete;

        const map = getClimateProfile('hm2mqtt-bidcos').build('hm', 'TRV/4');
        expect(events.length).toBe(Object.keys(map).length);
        // one event per attribute name, no duplicates
        expect(new Set(events.map(e => e.name)).size).toBe(events.length);
        // the modes value is passed through as an ARRAY (commit path stringifies)
        const modesEvent = events.find(e => e.name === 'modes');
        expect(Array.isArray(modesEvent.value)).toBe(true);
        expect(modesEvent.value.find(x => x.label === 'Off')['match-setpoint-max']).toBe(4.5);
    });

    it('gates behind an overwrite confirmation when modes is already non-default', async () => {
        target.setAttribute('modes', JSON.stringify([{value: 'heat', label: 'Heat'}]));
        picker._profileId = 'generic';
        picker._baseTopic = 'house';
        await picker.updateComplete;

        picker.shadowRoot.querySelector('.stamp-btn').click();
        await picker.updateComplete;

        // nothing stamped yet; confirmation panel visible
        expect(events.length).toBe(0);
        const confirm = picker.shadowRoot.querySelector('.confirm');
        expect(confirm).toBeTruthy();

        // confirm → stamp proceeds
        confirm.querySelector('button.danger').click();
        await picker.updateComplete;
        expect(events.length).toBeGreaterThan(0);
        expect(picker.shadowRoot.querySelector('.confirm')).toBeFalsy();
    });

    it('empty / default modes stamps immediately without confirmation', async () => {
        target.setAttribute('modes', '[]');   // default-ish empty array
        picker._profileId = 'generic';
        await picker.updateComplete;

        picker.shadowRoot.querySelector('.stamp-btn').click();
        await picker.updateComplete;

        expect(events.length).toBeGreaterThan(0);
        expect(picker.shadowRoot.querySelector('.confirm')).toBeFalsy();
    });
});
