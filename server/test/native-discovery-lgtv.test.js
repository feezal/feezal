/**
 * B130 — native lgtv2mqtt recognizer: one `remote` entity per webOS TV.
 * Fingerprint = the distinctive status/foregroundApp; plain volume/mute/
 * output only count under a known prefix; the default `lgtv` works out of
 * the box and a custom --name is learned.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;
const lgtv = () => nat.getNativeEntities().filter(e => e.source === 'lgtv');

beforeEach(() => {
    nat.clearNativeEntities();
    nat.recognizers.find(r => r.id === 'lgtv').reset();
});

describe('B130 — LG TV remote entity', () => {
    it('synthesizes ONE remote entity from the default prefix and wires the whole contract', () => {
        nat.handleNativeMessage('lgtv/status/volume', buf('12'));
        const e = byId('lgtv:lgtv');
        expect(e).toBeTruthy();
        expect(e.component).toBe('remote');
        expect(e.sourceLabel).toBe('LG TV');
        const cfg = e.config;
        expect(cfg.command_base_topic).toBe('lgtv/set');
        expect(cfg.volume_topic).toBe('lgtv/status/volume');
        expect(cfg.mute_topic).toBe('lgtv/status/mute');
        expect(cfg.output_topic).toBe('lgtv/status/output');
        expect(cfg.app_topic).toBe('lgtv/status/foregroundApp');
        expect(cfg.availability_topic).toBe('lgtv/connected');
        expect(cfg.availability_normalized.payloadAvailable).toBe('2');
        expect(cfg.command_topic, 'not a media candidate').toBeUndefined();
        expect(lgtv()).toHaveLength(1);
    });

    it('learns a custom --name from foregroundApp and wires every topic under it', () => {
        nat.handleNativeMessage('wohnzimmer/status/volume', buf('5'));
        expect(byId('lgtv:wohnzimmer')).toBeNull();        // unknown prefix, plain leaf
        nat.handleNativeMessage('wohnzimmer/status/foregroundApp', buf({appId: 'netflix', windowId: '', processId: '1'}));
        const e = byId('lgtv:wohnzimmer');
        expect(e).toBeTruthy();
        expect(e.config.command_base_topic).toBe('wohnzimmer/set');
        expect(e.config.availability_topic).toBe('wohnzimmer/connected');
        nat.handleNativeMessage('wohnzimmer/status/mute', buf('false'));
        expect(lgtv()).toHaveLength(1);
    });

    it('does NOT swallow a similar foreign tree', () => {
        nat.handleNativeMessage('shelly/status/volume', buf('1'));
        nat.handleNativeMessage('wiim/status/mute', buf('true'));
        nat.handleNativeMessage('lgtv/set/button', buf('HOME'));
        nat.handleNativeMessage('lgtv/connected', buf('2'));
        expect(lgtv()).toHaveLength(0);
    });
});
