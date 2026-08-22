/**
 * E186 — native wiim2mqtt recognizer. One bridge instance = one WiiM device,
 * mqtt-smarthome shaped (`<prefix>/status/<item>` with {"val":…} payloads),
 * no roster — so the prefix is fingerprinted on the distinctive item names
 * (`play_state`, `source_list`). The promoted media entity wires transport in
 * topic mode (verb `prev`), tri-state repeat, and the shared source/preset
 * capability this bridge exposed the need for.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;
const wrapped = val => ({val, ts: 1, lc: 1});

beforeEach(() => {
    nat.clearNativeEntities();
    nat.recognizers.find(r => r.id === 'wiim').reset();
});

describe('E186 — WiiM media entity', () => {
    it('synthesizes ONE media entity from the default prefix', () => {
        nat.handleNativeMessage('wiim/status/volume', buf(wrapped(35)));

        const e = byId('wiim:wiim');
        expect(e).toBeTruthy();
        expect(e.component).toBe('media');
        expect(e.source).toBe('wiim');
        expect(e.sourceLabel).toBe('WiiM');
        expect(nat.getNativeEntities().filter(x => x.source === 'wiim')).toHaveLength(1);
    });

    it('stamps every status item with the payload.val path and transport in TOPIC mode with `prev`', () => {
        nat.handleNativeMessage('wiim/status/play_state', buf(wrapped('playing')));
        const cfg = byId('wiim:wiim').config;

        expect(cfg.state_topic).toBe('wiim/status/play_state');
        expect(cfg.state_value_template).toBe('{{ value_json.val }}');
        expect(cfg.title_topic).toBe('wiim/status/title');
        expect(cfg.artwork_topic).toBe('wiim/status/album_art');
        expect(cfg.position_topic).toBe('wiim/status/position');
        expect(cfg.duration_topic).toBe('wiim/status/duration');
        expect(cfg.duration_value_template).toBe('{{ value_json.val }}');
        expect(cfg.command_topic).toBe('wiim/set');
        expect(cfg.command_mode).toBe('topic');
        expect(cfg.payload_previous).toBe('prev');
        expect(cfg.payload_stop).toBe('stop');
        expect(cfg.seek_command_topic).toBe('wiim/set/seek');
        expect(cfg.volume_command_topic).toBe('wiim/set/volume');
        expect(cfg.mute_command_topic).toBe('wiim/set/mute');
        expect(cfg.repeat_mode).toBe('cycle');        // off / one / all — native tri-state
        expect(cfg.repeat_command_topic).toBe('wiim/set/repeat');
    });

    it('wires the shared source select and the preset row', () => {
        nat.handleNativeMessage('wiim/status/source_list', buf(wrapped(['wifi', 'airplay', 'bluetooth'])));
        const cfg = byId('wiim:wiim').config;

        expect(cfg.source_topic).toBe('wiim/status/source');
        expect(cfg.source_list_topic).toBe('wiim/status/source_list');
        expect(cfg.source_list_value_template).toBe('{{ value_json.val }}');
        expect(cfg.source_command_topic).toBe('wiim/set/source');
        expect(cfg.preset_list_topic).toBe('wiim/status/preset_list');
        expect(cfg.preset_max_topic).toBe('wiim/status/preset_max');
        expect(cfg.preset_command_topic).toBe('wiim/set/preset');
    });

    it('availability comes from <prefix>/connected, available on 2', () => {
        nat.handleNativeMessage('wiim/status/play_state', buf(wrapped('paused')));
        const cfg = byId('wiim:wiim').config;

        expect(cfg.availability_topic).toBe('wiim/connected');
        expect(cfg.availability_normalized.payloadAvailable).toBe('2');
        expect(cfg.availability_normalized.payloadUnavailable).toBe('0');
    });

    it('a --no-json-payloads bridge (bare values) is wired without the .val path', () => {
        nat.handleNativeMessage('wiim/status/play_state', buf('playing'));
        const cfg = byId('wiim:wiim').config;

        expect(cfg.state_value_template).toBeUndefined();
        expect(cfg.title_value_template).toBeUndefined();
        expect(cfg.state_topic).toBe('wiim/status/play_state');
    });
});

describe('E186 — the topic prefix is not hardcoded', () => {
    it('learns a custom --name from a fingerprint item and wires everything under it', () => {
        // Unknown prefix, non-fingerprint item: ignored.
        nat.handleNativeMessage('kueche/status/volume', buf(wrapped(20)));
        expect(byId('wiim:kueche')).toBeNull();

        nat.handleNativeMessage('kueche/status/play_state', buf(wrapped('stopped')));
        const e = byId('wiim:kueche');
        expect(e).toBeTruthy();
        expect(e.name).toBe('kueche');
        expect(e.config.command_topic).toBe('kueche/set');
        expect(e.config.source_command_topic).toBe('kueche/set/source');
        expect(e.config.availability_topic).toBe('kueche/connected');

        // …and afterwards its plain items are recognized on their own.
        nat.handleNativeMessage('kueche/status/volume', buf(wrapped(21)));
        expect(nat.getNativeEntities().filter(x => x.source === 'wiim')).toHaveLength(1);
    });

    it('does NOT swallow an unrelated mqtt-smarthome tree', () => {
        nat.handleNativeMessage('shelly/status/volume', buf(wrapped(40)));
        nat.handleNativeMessage('hm/status/title', buf(wrapped('x')));
        nat.handleNativeMessage('wiim/set/play', buf('1'));
        nat.handleNativeMessage('wiim/connected', buf('2'));

        expect(nat.getNativeEntities().filter(x => x.source === 'wiim')).toHaveLength(0);
    });
});
