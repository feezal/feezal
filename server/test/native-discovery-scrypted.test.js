/**
 * E169 — native Scrypted camera recognizer. Scrypted's MQTT plugin publishes
 * standard homeassistant/* discovery for a camera's sensor interfaces but no
 * `camera` component; the recognizer watches those configs and synthesizes one
 * `scrypted-camera` entity per device exposing a MotionSensor interface, with
 * the NVR device id the editor needs to compose the card URL.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

// A realistic Scrypted MotionSensor discovery config (autodiscovery.ts shape):
// nodeId scrypted-<mqttId>-<device.id>, device block with the camera's name.
const motionConfig = (deviceId, name) => ({
    name: name + ' Motion',
    unique_id: `scrypted-mqtt0-${deviceId}-MotionSensor`,
    stat_t: `scrypted/${deviceId}/motionDetected`,
    pl_on: 'true',
    pl_off: 'false',
    dev: {name, ids: 'abcd1234', mf: 'Reolink', mdl: 'RLC-810A'},
});

beforeEach(() => nat.clearNativeEntities());

describe('E169 — Scrypted camera entities', () => {
    it('synthesizes a scrypted-camera entity from a MotionSensor config', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-62/MotionSensor/config',
            buf(motionConfig('62', 'Hoftür')));

        const cam = byId('scrypted:62');
        expect(cam).toBeTruthy();
        expect(cam.component).toBe('scrypted-camera');
        expect(cam.source).toBe('scrypted');
        expect(cam.sourceLabel).toBe('Scrypted');
        expect(cam.name).toBe('Hoftür');
        expect(cam.config.camera_id).toBe('62');
        expect(cam.config.motion_topic).toBe('scrypted/62/motionDetected');
    });

    it('the device id survives a dashed mqttId (last segment wins)', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-my-mqtt-id-104/MotionSensor/config',
            buf(motionConfig('104', 'Garage')));
        const cam = byId('scrypted:104');
        expect(cam).toBeTruthy();
        expect(cam.config.camera_id).toBe('104');
    });

    it('a device without a MotionSensor interface never promotes', () => {
        nat.handleNativeMessage('homeassistant/switch/scrypted-mqtt0-77/OnOff/config',
            buf({name: 'Siren', unique_id: 'scrypted-mqtt0-77-OnOff',
                stat_t: 'scrypted/77/on', dev: {name: 'Siren'}}));
        expect(byId('scrypted:77')).toBeNull();
    });

    it('other interfaces of the SAME device refine but do not duplicate', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-62/MotionSensor/config',
            buf(motionConfig('62', 'Hoftür')));
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-62/AudioSensor/config',
            buf({name: 'Hoftür Audio', unique_id: 'scrypted-mqtt0-62-AudioSensor',
                stat_t: 'scrypted/62/audioDetected', dev: {name: 'Hoftür'}}));
        const cams = nat.getNativeEntities().filter(e => e.source === 'scrypted');
        expect(cams).toHaveLength(1);
        expect(cams[0].config.camera_id).toBe('62');
    });

    it('non-Scrypted discovery configs are ignored', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/zigbee-abc/motion/config',
            buf({name: 'Flur Motion', stat_t: 'z2m/flur/motion'}));
        nat.handleNativeMessage('homeassistant/light/kitchen/light/config',
            buf({name: 'Kitchen'}));
        expect(nat.getNativeEntities().filter(e => e.source === 'scrypted')).toHaveLength(0);
    });

    it('a device-name-less config falls back to the entity name, then the id', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-9/MotionSensor/config',
            buf({name: 'Terrasse Motion', unique_id: 'scrypted-mqtt0-9-MotionSensor',
                stat_t: 'scrypted/9/motionDetected'}));
        expect(byId('scrypted:9').name).toBe('Terrasse Motion');

        nat.clearNativeEntities();
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-9/MotionSensor/config',
            buf({unique_id: 'scrypted-mqtt0-9-MotionSensor', stat_t: 'scrypted/9/motionDetected'}));
        expect(byId('scrypted:9').name).toBe('Camera 9');
    });

    it('an empty (delete) payload never throws or promotes', () => {
        nat.handleNativeMessage('homeassistant/binary_sensor/scrypted-mqtt0-62/MotionSensor/config', Buffer.alloc(0));
        expect(byId('scrypted:62')).toBeNull();
    });
});
