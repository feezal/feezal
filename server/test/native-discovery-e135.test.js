/**
 * E135 — the Homematic contact recognizer emits a presence-checked
 * `sabotage_normalized` record: classic contacts encode sabotage as ERROR == 7
 * (encoding 'error7'); HmIP as a SABOTAGE bool on :0 (encoding 'bool').
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const je = (val, hm, ts = Date.now()) => Buffer.from(JSON.stringify(hm ? {val, ts, lc: ts, hm} : {val, ts, lc: ts}));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

beforeEach(() => nat.clearNativeEntities());

describe('E135 — contact sabotage emission', () => {
    it('classic contact: emits sabotage_normalized as ERROR (encoding error7)', () => {
        nat.handleNativeMessage('hm/status/Fenster Küche:1/STATE',
            je(0, {device: 'd1', deviceName: 'Fenster Küche', deviceType: 'HM-Sec-SC', channelType: 'SHUTTER_CONTACT', channel: 1}));
        nat.handleNativeMessage('hm/status/Fenster Küche:1/ERROR',
            je(0, {device: 'd1', channelType: 'SHUTTER_CONTACT', channel: 1}));
        const e = byId('hm-contact:d1');
        expect(e).toBeTruthy();
        expect(e.config.sabotage_normalized).toEqual({
            topic: 'hm/status/Fenster Küche:1/ERROR', property: 'payload.val', encoding: 'error7',
        });
    });

    it('HmIP contact: emits sabotage_normalized as the :0 SABOTAGE bool (encoding bool)', () => {
        nat.handleNativeMessage('hm/status/Tür:1/STATE',
            je(0, {device: 'd2', deviceName: 'Haustür', deviceType: 'HmIP-SWDO', channelType: 'SHUTTER_CONTACT', channel: 1}));
        nat.handleNativeMessage('hm/status/Tür:0/SABOTAGE',
            je(false, {device: 'd2', channelType: 'MAINTENANCE', channelIndex: 0, channel: 0}));
        const e = byId('hm-contact:d2');
        expect(e.config.sabotage_normalized).toEqual({
            topic: 'hm/status/Tür:0/SABOTAGE', property: 'payload.val', encoding: 'bool',
        });
    });

    it('motion sensor: emits sabotage_normalized from its ERROR datapoint', () => {
        nat.handleNativeMessage('hm/status/Bewegung Flur:1/MOTION',
            je(0, {device: 'm1', deviceName: 'Bewegung Flur', deviceType: 'HM-Sec-MDIR', channelType: 'MOTION_DETECTOR', channel: 1}));
        nat.handleNativeMessage('hm/status/Bewegung Flur:1/ERROR',
            je(0, {device: 'm1', channelType: 'MOTION_DETECTOR', channel: 1}));
        expect(byId('hm-sensor:m1').config.sabotage_normalized).toEqual({
            topic: 'hm/status/Bewegung Flur:1/ERROR', property: 'payload.val', encoding: 'error7',
        });
    });

    it('no sabotage record when neither datapoint is observed (presence-checked)', () => {
        nat.handleNativeMessage('hm/status/Fenster:1/STATE',
            je(0, {device: 'd3', deviceName: 'Fenster', deviceType: 'HM-Sec-SC', channelType: 'SHUTTER_CONTACT', channel: 1}));
        expect(byId('hm-contact:d3').config.sabotage_normalized).toBeUndefined();
    });
});
