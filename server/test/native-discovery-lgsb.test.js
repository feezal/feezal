/**
 * E188 — native lgsb2mqtt recognizer. One bridge = one LG soundbar; it
 * promotes a media entity (renderer, not player — no transport set topics)
 * with the input select through the shared source capability, plus an
 * `audio` entity carrying the status/set bases for the processor card.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;
const wrapped = val => ({val, ts: 1, lc: 1});
const lgsb = () => nat.getNativeEntities().filter(e => e.source === 'lgsb');

beforeEach(() => {
    nat.clearNativeEntities();
    nat.recognizers.find(r => r.id === 'lgsb').reset();
});

describe('E188 — LG soundbar entities', () => {
    it('promotes a media AND an audio entity from the default prefix', () => {
        nat.handleNativeMessage('soundbar/status/volume', buf(wrapped(12)));
        expect(lgsb().map(e => [e.component, e.discovery_id]).sort()).toEqual([
            ['audio', 'lgsb:soundbar:audio'], ['media', 'lgsb:soundbar:media']]);
        expect(byId('lgsb:soundbar:media').sourceLabel).toBe('LG Soundbar');
    });

    it('the media entity is a RENDERER: metadata, volume/mute, input select — and NO command topic', () => {
        nat.handleNativeMessage('soundbar/status/play/state', buf(wrapped('play')));
        const cfg = byId('lgsb:soundbar:media').config;
        expect(cfg.state_topic).toBe('soundbar/status/play/state');
        expect(cfg.title_topic).toBe('soundbar/status/play/title');
        expect(cfg.duration_topic).toBe('soundbar/status/play/duration');
        expect(cfg.state_value_template).toBe('{{ value_json.val }}');
        expect(cfg.command_topic).toBeUndefined();
        expect(cfg.command_mode).toBeUndefined();
        expect(cfg.volume_command_topic).toBe('soundbar/set/volume');
        expect(cfg.mute_command_topic).toBe('soundbar/set/mute');
        expect(cfg.source_topic).toBe('soundbar/status/input');
        expect(cfg.source_list_topic).toBe('soundbar/status/input_list');
        expect(cfg.source_command_topic).toBe('soundbar/set/input');
        expect(cfg.availability_topic).toBe('soundbar/connected');
        expect(cfg.availability_normalized.payloadAvailable).toBe('2');
    });

    it('the audio entity hands over the two bases and the value path', () => {
        nat.handleNativeMessage('soundbar/status/eq_list', buf(wrapped(['Standard', 'Cinema'])));
        const cfg = byId('lgsb:soundbar:audio').config;
        expect(cfg.state_base_topic).toBe('soundbar/status');
        expect(cfg.command_base_topic).toBe('soundbar/set');
        expect(cfg.value_template).toBe('{{ value_json.val }}');
        expect(cfg.availability_topic).toBe('soundbar/connected');
    });

    it('range sidecars (<item>/min|max) and two-segment play items count as the item', () => {
        nat.handleNativeMessage('bar/status/woofer/max', buf(wrapped(6)));   // unknown prefix, not a fingerprint
        expect(lgsb()).toHaveLength(0);
        nat.handleNativeMessage('bar/status/play/state', buf(wrapped('stop')));
        expect(byId('bar:x')).toBeNull();
        expect(byId('lgsb:bar:media')?.config.command_topic).toBeUndefined();
        nat.handleNativeMessage('bar/status/woofer/max', buf(wrapped(6)));
        expect(lgsb()).toHaveLength(2);
    });

    it('a bare-payload bridge gets no value path; unrelated trees are ignored', () => {
        nat.handleNativeMessage('soundbar/status/volume', buf('12'));
        expect(byId('lgsb:soundbar:media').config.volume_value_template).toBeUndefined();
        expect(byId('lgsb:soundbar:audio').config.value_template).toBeUndefined();

        nat.clearNativeEntities();
        nat.handleNativeMessage('shelly/status/volume', buf(wrapped(1)));
        nat.handleNativeMessage('wiim/status/volume', buf(wrapped(1)));
        expect(lgsb()).toHaveLength(0);
    });
});
