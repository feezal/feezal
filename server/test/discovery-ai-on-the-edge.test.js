/**
 * E146 — AI-on-the-edge-device (jomjol meter reader) via Home Assistant MQTT
 * discovery. The decided integration is: rely PURELY on the device's own HA
 * discovery (no native recognizer). These tests pin that feezal's existing
 * HA-discovery path ingests AI-on-the-edge's `homeassistant/sensor/…/config`
 * payloads correctly — state topic, unit, device_class (water/gas/energy) and
 * the `<deviceRoot>/connection` availability_topic → N31 canonical record.
 *
 * The device publishes full (non-abbreviated) HA keys; the base topic
 * (`MainTopic`) is user-configurable and may contain slashes — none of which
 * matters here because the device resolves every topic in the config itself.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const disc = require('../src/mqtt/discovery.js');

const buf = obj => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));

beforeEach(() => disc.clearEntities());

// A representative AI-on-the-edge water-meter "value" sensor config, MainTopic
// = "wasserzaehler/status", sequence "zaehlerstand". Full HA keys as the device
// emits them.
const waterValueConfig = {
    name: 'wasserzaehler zaehlerstand value',
    unique_id: 'watermeter_ABCDEF_zaehlerstand_value',
    state_topic: 'wasserzaehler/status/zaehlerstand/value',
    unit_of_measurement: 'm³',
    device_class: 'water',
    state_class: 'total_increasing',
    value_template: '{{ value }}',
    availability_topic: 'wasserzaehler/status/connection',
    payload_available: 'connected',
    payload_not_available: 'connection lost',
    device: {identifiers: ['watermeter_ABCDEF'], name: 'wasserzaehler', manufacturer: 'jomjol'},
};

describe('E146 — AI-on-the-edge HA discovery ingest', () => {
    it('ingests the meter "value" sensor: component, state topic, unit, device_class', () => {
        disc.handleMessage('homeassistant/sensor/watermeter_ABCDEF/zaehlerstand_value/config', buf(waterValueConfig));
        const e = disc.getDiscoveredEntity('sensor/watermeter_ABCDEF/zaehlerstand_value');
        expect(e).toBeTruthy();
        expect(e.component).toBe('sensor');
        expect(e.config.state_topic).toBe('wasserzaehler/status/zaehlerstand/value');
        expect(e.config.unit_of_measurement).toBe('m³');
        expect(e.config.device_class).toBe('water');
    });

    it('normalizes the <deviceRoot>/connection availability_topic to the N31 record', () => {
        disc.handleMessage('homeassistant/sensor/watermeter_ABCDEF/zaehlerstand_value/config', buf(waterValueConfig));
        const {availability_normalized: avail} = disc.getDiscoveredEntity('sensor/watermeter_ABCDEF/zaehlerstand_value').config;
        expect(avail).toBeTruthy();
        expect(avail.entries).toEqual([{topic: 'wasserzaehler/status/connection'}]);
        expect(avail.payloadAvailable).toBe('connected');
        expect(avail.payloadUnavailable).toBe('connection lost');
    });

    it('routes gas and energy device_class meters through the same path', () => {
        disc.handleMessage('homeassistant/sensor/gasmeter_1/value/config', buf({
            ...waterValueConfig, unique_id: 'gas_1', state_topic: 'gaszaehler/value',
            unit_of_measurement: 'm³', device_class: 'gas',
        }));
        disc.handleMessage('homeassistant/sensor/powermeter_1/value/config', buf({
            ...waterValueConfig, unique_id: 'nrg_1', state_topic: 'stromzaehler/value',
            unit_of_measurement: 'kWh', device_class: 'energy',
        }));
        expect(disc.getDiscoveredEntity('sensor/gasmeter_1/value').config.device_class).toBe('gas');
        expect(disc.getDiscoveredEntity('sensor/powermeter_1/value').config.device_class).toBe('energy');
    });

    it('keeps each named sequence a distinct entity (multi-sequence device)', () => {
        disc.handleMessage('homeassistant/sensor/wm/main_value/config', buf({
            ...waterValueConfig, unique_id: 'wm_main', state_topic: 'wasserzaehler/main/value',
        }));
        disc.handleMessage('homeassistant/sensor/wm/garden_value/config', buf({
            ...waterValueConfig, unique_id: 'wm_garden', state_topic: 'wasserzaehler/garden/value',
        }));
        expect(disc.getDiscoveredEntity('sensor/wm/main_value').config.state_topic).toBe('wasserzaehler/main/value');
        expect(disc.getDiscoveredEntity('sensor/wm/garden_value').config.state_topic).toBe('wasserzaehler/garden/value');
        expect(disc.getDiscoveredEntities().length).toBe(2);
    });
});
