/**
 * E135 (overhauled) — device-health board. The device list is resolved at edit
 * time (buildHealthDevices, from the discovery registry) and stamped as JSON;
 * the viewer subscribes to the listed topics and shows low battery, unavailable
 * devices, and Homematic fault/sabotage, severity-sorted, across all ecosystems.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {
    buildHealthDevices, isDeviceUnavailable,
} from '../packages/@feezal/feezal-element-basic-device-health/feezal-element-basic-device-health.js';
import '../src/feezal-icon.js';   // real <feezal-icon> so icons render, not ligature text
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal({isEditor: false}); });

const je = val => ({val, ts: 1});

// ── Pure builder ──────────────────────────────────────────────────────────

describe('buildHealthDevices', () => {
    const hm = {
        discovery_id: 'sensor/hm1', component: 'sensor', name: 'Fenster Küche:1',
        config: {
            state_topic: 'hm/status/Fenster Küche:1/STATE',
            battery_low_normalized: {topic: 'hm/status/Fenster Küche:0/LOWBAT', property: 'payload.val', payloadLow: true},
            availability_normalized: {entries: [{topic: 'hm/status/Fenster Küche:0/UNREACH', property: 'payload.val'}], mode: 'all', payloadAvailable: false, payloadUnavailable: true},
            sabotage_normalized: {topic: 'hm/status/Fenster Küche:1/ERROR', property: 'payload.val', encoding: 'error7'},
        },
    };
    const z2m = {
        discovery_id: 'binary_sensor/z1', component: 'binary_sensor', name: 'licht_hobbyraum',
        config: {
            state_topic: 'zigbee2mqtt/licht_hobbyraum',
            battery_low_normalized: {topic: 'zigbee2mqtt/licht_hobbyraum', property: 'payload.battery_low', payloadLow: true},
            availability_normalized: {entries: [{topic: 'zigbee2mqtt/licht_hobbyraum/availability'}], mode: 'latest'},
        },
    };
    const pctOnly = {   // percentage-only battery, no boolean flag → skipped (boolean-only rule)
        discovery_id: 'sensor/z2', component: 'sensor', name: 'thermostat_bad',
        config: {state_topic: 'zigbee2mqtt/thermostat_bad', battery_low_normalized: {topic: 'zigbee2mqtt/thermostat_bad', property: 'payload.battery'}},
    };
    const nada = {discovery_id: 'switch/x', component: 'switch', name: 'relay', config: {state_topic: 'z/relay', command_topic: 'z/relay/set'}};

    it('keeps only devices with an actionable signal; derives a friendly name + source', () => {
        const list = buildHealthDevices([hm, z2m, pctOnly, nada]);
        expect(list.map(d => d.name)).toEqual(['Fenster Küche', 'Licht Hobbyraum']);
        const hmOut = list[0];
        expect(hmOut.source).toBe('hm');
        expect(hmOut.battery).toEqual({topic: 'hm/status/Fenster Küche:0/LOWBAT', prop: 'payload.val', low: true});
        expect(hmOut.avail).toEqual({topic: 'hm/status/Fenster Küche:0/UNREACH', prop: 'payload.val', unavail: true, avail: false});
        expect(hmOut.sabotage.enc).toBe('error7');
        const z = list[1];
        expect(z.source).toBe('zigbee2mqtt');
        expect(z.battery.prop).toBe('payload.battery_low');
        expect(z.avail.topic).toBe('zigbee2mqtt/licht_hobbyraum/availability');
    });

    it('drops a percentage-only battery source (boolean-only rule)', () => {
        expect(buildHealthDevices([pctOnly])).toEqual([]);
    });

    it('merges multiple entities of one device by friendly name', () => {
        const a = {discovery_id: 'a', component: 'sensor', name: 'Tür', config: {state_topic: 'z/tuer', battery_low_normalized: {topic: 'z/tuer', payloadLow: true}}};
        const b = {discovery_id: 'b', component: 'binary_sensor', name: 'Tür', config: {state_topic: 'z/tuer', availability_normalized: {entries: [{topic: 'z/tuer/availability'}]}}};
        const list = buildHealthDevices([a, b]);
        expect(list).toHaveLength(1);
        expect(list[0].battery).toBeTruthy();
        expect(list[0].avail).toBeTruthy();
    });
});

describe('isDeviceUnavailable', () => {
    it('handles offline/online, z2m {state} objects, and explicit payloads', () => {
        expect(isDeviceUnavailable('offline')).toBe(true);
        expect(isDeviceUnavailable('online')).toBe(false);
        expect(isDeviceUnavailable({state: 'offline'})).toBe(true);
        expect(isDeviceUnavailable(true, true, false)).toBe(true);    // HM UNREACH=true
        expect(isDeviceUnavailable(false, true, false)).toBe(false);  // HM UNREACH=false
    });
});

// ── Viewer (list-driven) ────────────────────────────────────────────────────

const DEVICES = JSON.stringify([
    {id: 'a', name: 'Haustür', source: 'hm',
        sabotage: {topic: 'hm/status/Haustür:1/ERROR', prop: 'payload.val', enc: 'error7'},
        battery:  {topic: 'hm/status/Haustür:0/LOWBAT', prop: 'payload.val', low: true}},
    {id: 'b', name: 'Sensor Küche', source: 'zigbee2mqtt',
        battery: {topic: 'zigbee2mqtt/kueche', prop: 'payload.battery_low', low: true},
        avail:   {topic: 'zigbee2mqtt/kueche/availability', prop: 'payload'}},
    {id: 'c', name: 'Heizung Bad', source: 'hm',
        fault: {topic: 'hm/status/Heizung:4/FAULT_REPORTING', prop: 'payload.val', deviceType: 'HM-CC-RT-DN'}},
]);
const rows = el => [...el.renderRoot.querySelectorAll('.row')];

describe('device-health viewer', () => {
    it('aggregates battery / availability / fault / sabotage from every source, severity-sorted', async () => {
        const el = await mount('feezal-element-basic-device-health', {devices: DEVICES});
        feezal.connection.deliver('hm/status/Haustür:1/ERROR', je(7));                 // classic sabotage
        feezal.connection.deliver('zigbee2mqtt/kueche/availability', 'offline');        // z2m unavailable
        feezal.connection.deliver('zigbee2mqtt/kueche', {battery_low: true});           // z2m low battery
        feezal.connection.deliver('hm/status/Heizung:4/FAULT_REPORTING', je(4));        // HM TRV fault
        await el.updateComplete;
        const r = rows(el);
        expect(r.length).toBe(4);
        expect(r[0].classList.contains('sabotage')).toBe(true);
        expect(r[0].textContent).toContain('Haustür');
        expect(r[3].classList.contains('unreach')).toBe(true);
        expect(el.renderRoot.textContent).toContain('Communication error');   // TRV enum decoded
        expect(el.renderRoot.textContent).toContain('Battery low');
        expect(el.renderRoot.textContent).toContain('Unavailable');
    });

    it('clears an issue when the signal returns to OK', async () => {
        const el = await mount('feezal-element-basic-device-health', {devices: DEVICES});
        feezal.connection.deliver('zigbee2mqtt/kueche/availability', 'offline');
        await el.updateComplete;
        expect(rows(el).length).toBe(1);
        feezal.connection.deliver('zigbee2mqtt/kueche/availability', 'online');
        await el.updateComplete;
        expect(rows(el).length).toBe(0);
        expect(el.renderRoot.textContent).toContain('All devices OK');
    });

    it('honours the show-battery toggle', async () => {
        const el = await mount('feezal-element-basic-device-health', {devices: DEVICES, 'show-battery': 'false'});
        feezal.connection.deliver('zigbee2mqtt/kueche', {battery_low: true});
        await el.updateComplete;
        expect(rows(el).length).toBe(0);
    });

    it('renders icons via <feezal-icon>, not raw .material-icons ligature text', async () => {
        const el = await mount('feezal-element-basic-device-health', {devices: DEVICES});
        feezal.connection.deliver('hm/status/Haustür:1/ERROR', je(7));
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.head feezal-icon')).toBeTruthy();
        expect(el.renderRoot.querySelector('.row feezal-icon')).toBeTruthy();
        expect(el.renderRoot.querySelector('.material-icons')).toBeNull();
        expect(el.renderRoot.querySelector('.head').textContent).not.toContain('health_and_safety');
    });
});
