/**
 * E109 — native evcc recognizer. evcc publishes a flat, retained MQTT tree with
 * NO Home Assistant discovery, so a native recognizer synthesizes the normalized
 * entities: one `energy-flow` site entity + one `evcc-loadpoint` per loadpoint,
 * detected by STRUCTURE (the root prefix is user-configurable). Topic/sign facts
 * from docs.evcc.io + evcc-io/evcc core/keys.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(String(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

// A representative evcc retained burst: site + a wallbox (lp1) + a heat-pump (lp2).
function feedEvcc(root = 'evcc') {
    nat.handleNativeMessage(`${root}/site/grid/power`, buf('-6.7'));
    nat.handleNativeMessage(`${root}/site/battery/soc`, buf('51.2'));
    nat.handleNativeMessage(`${root}/site/battery/power`, buf('524.58'));
    nat.handleNativeMessage(`${root}/site/homePower`, buf('300'));
    nat.handleNativeMessage(`${root}/site/pvPower`, buf('2.09'));
    nat.handleNativeMessage(`${root}/loadpoints/1/title`, buf('Wallbox'));
    nat.handleNativeMessage(`${root}/loadpoints/1/mode`, buf('pv'));
    nat.handleNativeMessage(`${root}/loadpoints/1/chargePower`, buf('0'));
    nat.handleNativeMessage(`${root}/loadpoints/2/title`, buf('Wärmepumpe'));
    nat.handleNativeMessage(`${root}/loadpoints/2/mode`, buf('off'));
    nat.handleNativeMessage(`${root}/loadpoints/2/chargerFeature/heating`, buf('true'));
}

beforeEach(() => nat.clearNativeEntities());

describe('E109 — evcc site entity (energy-flow)', () => {
    it('synthesizes one energy-flow site entity wiring the power topics', () => {
        feedEvcc();
        const site = byId('evcc:evcc:site');
        expect(site).toBeTruthy();
        expect(site.component).toBe('energy-flow');
        expect(site.config.subscribe_solar).toBe('evcc/site/pvPower');
        expect(site.config.subscribe_grid).toBe('evcc/site/grid/power');
        expect(site.config.subscribe_load).toBe('evcc/site/homePower');
        expect(site.config.subscribe_battery).toBe('evcc/site/battery/power');
        expect(site.config.subscribe_battery_soc).toBe('evcc/site/battery/soc');
    });

    it('flags invert_battery (evcc battery power is +=discharge) and wires the EV node to lp1', () => {
        feedEvcc();
        const site = byId('evcc:evcc:site');
        expect(site.config.invert_battery).toBe(true);
        expect(site.config.subscribe_charge).toBe('evcc/loadpoints/1/chargePower');
    });

    it('maps the LWT to N31 availability', () => {
        feedEvcc();
        const {availability_normalized: a} = byId('evcc:evcc:site').config;
        expect(a.entries).toEqual([{topic: 'evcc/status'}]);
        expect(a.payloadAvailable).toBe('online');
        expect(a.payloadUnavailable).toBe('offline');
    });
});

describe('E109 — evcc loadpoint entities', () => {
    it('synthesizes one evcc-loadpoint per loadpoint with read + /set command topics', () => {
        feedEvcc();
        const lp1 = byId('evcc:evcc:lp:1');
        expect(lp1).toBeTruthy();
        expect(lp1.component).toBe('evcc-loadpoint');
        expect(lp1.name).toBe('Wallbox');
        expect(lp1.config.subscribe_mode).toBe('evcc/loadpoints/1/mode');
        expect(lp1.config.publish_mode).toBe('evcc/loadpoints/1/mode/set');
        expect(lp1.config.subscribe_charge_power).toBe('evcc/loadpoints/1/chargePower');
        expect(lp1.config.publish_limit_soc).toBe('evcc/loadpoints/1/limitSoc/set');
        // phases: read the active count, write the configured count
        expect(lp1.config.subscribe_phases).toBe('evcc/loadpoints/1/phasesActive');
        expect(lp1.config.publish_phases).toBe('evcc/loadpoints/1/phasesConfigured/set');
    });

    it('detects a heating loadpoint via chargerFeature/heating', () => {
        feedEvcc();
        const lp2 = byId('evcc:evcc:lp:2');
        expect(lp2.name).toBe('Wärmepumpe');
        expect(lp2.config.heating).toBe('true');
        // the wallbox is not heating — the key is omitted (absent = not heating)
        expect(byId('evcc:evcc:lp:1').config.heating).toBeUndefined();
    });
});

describe('E109 — structure-based detection (configurable root prefix)', () => {
    it('detects an evcc root that is not the literal "evcc" prefix', () => {
        feedEvcc('home/energy');
        expect(byId('evcc:home/energy:site')).toBeTruthy();
        expect(byId('evcc:home/energy:site').config.subscribe_grid).toBe('home/energy/site/grid/power');
        expect(byId('evcc:home/energy:lp:1')).toBeTruthy();
    });

    it('ignores unrelated topics', () => {
        nat.handleNativeMessage('zigbee2mqtt/lamp', buf('ON'));
        nat.handleNativeMessage('hm/status/Foo:1/STATE', buf('true'));
        expect(nat.getNativeEntities().filter(e => e.source === 'evcc')).toHaveLength(0);
    });
});
