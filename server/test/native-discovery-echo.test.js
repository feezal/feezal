/**
 * E182 — native echo2mqtt recognizer. echo2mqtt publishes a native
 * `echo/status/<device>/…` tree; HA MQTT discovery has no media_player
 * component, so feezal recognizes the native tree and synthesizes ONE `media`
 * entity per Echo that wires a media card in a single pick.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

const MEDIA = {
    state: 'PLAYING', title: 'Blackbird', artist: 'The Beatles',
    album: 'White Album', provider: 'Amazon Music',
    imageUrl: 'https://art.example/cover.jpg', mediaId: 'x1',
};

beforeEach(() => nat.clearNativeEntities());

describe('E182 — echo2mqtt media entities', () => {
    it('synthesizes one media entity from a per-device media message', () => {
        nat.handleNativeMessage('echo/status/Kitchen/media', buf(MEDIA));

        const e = byId('echo:Kitchen');
        expect(e).toBeTruthy();
        expect(e.component).toBe('media');
        expect(e.source).toBe('echo');
        expect(e.sourceLabel).toBe('Echo');
        expect(e.name).toBe('Kitchen');
    });

    it('learns every device from the bridge roster, with the friendly name', () => {
        nat.handleNativeMessage('echo/status/bridge/devices', buf([
            {name: 'Küche', topic: 'Kueche', serial: 'G01', type: 'ECHO'},
            {name: 'Bad', topic: 'Bad', serial: 'G02', type: 'ECHO_DOT'},
        ]));

        expect(byId('echo:Kueche')?.name).toBe('Küche');
        expect(byId('echo:Bad')?.name).toBe('Bad');
    });

    it('stamps every metadata field onto the ONE combined media topic with its own path', () => {
        nat.handleNativeMessage('echo/status/Bad/media', buf(MEDIA));
        const cfg = byId('echo:Bad').config;

        const media = 'echo/status/Bad/media';
        expect(cfg.state_topic).toBe(media);
        expect(cfg.title_topic).toBe(media);
        expect(cfg.artist_topic).toBe(media);
        expect(cfg.album_topic).toBe(media);
        expect(cfg.provider_topic).toBe(media);
        expect(cfg.artwork_topic).toBe(media);
        expect(cfg.state_value_template).toBe('{{ value_json.state }}');
        expect(cfg.title_value_template).toBe('{{ value_json.title }}');
        expect(cfg.provider_value_template).toBe('{{ value_json.provider }}');
        expect(cfg.artwork_value_template).toBe('{{ value_json.imageUrl }}');
    });

    it('wires transport in TOPIC command mode (echo2mqtt has one topic per command)', () => {
        nat.handleNativeMessage('echo/status/Bad/audioPlayerState', buf('PLAYING'));
        const cfg = byId('echo:Bad').config;

        expect(cfg.command_topic).toBe('echo/set/Bad');
        expect(cfg.command_mode).toBe('topic');
        expect(cfg.payload_play).toBe('play');
        expect(cfg.payload_next).toBe('next');
        expect(cfg.payload_previous).toBe('previous');
    });

    it('wires volume and mute with the ON/OFF dialect echo2mqtt speaks', () => {
        nat.handleNativeMessage('echo/status/Bad/volume', buf('40'));
        const cfg = byId('echo:Bad').config;

        expect(cfg.volume_topic).toBe('echo/status/Bad/volume');
        expect(cfg.volume_command_topic).toBe('echo/set/Bad/volume');
        expect(cfg.mute_topic).toBe('echo/status/Bad/isMuted');
        expect(cfg.mute_command_topic).toBe('echo/set/Bad/isMuted');
        expect(cfg.payload_mute_on).toBe('ON');
        expect(cfg.payload_mute_off).toBe('OFF');
    });

    it('puts repeat into two-state toggle mode (the bridge only knows on/off)', () => {
        nat.handleNativeMessage('echo/status/Bad/media', buf(MEDIA));
        const cfg = byId('echo:Bad').config;

        expect(cfg.repeat_mode).toBe('toggle');
        expect(cfg.repeat_command_topic).toBe('echo/set/Bad/repeat');
        expect(cfg.payload_repeat_on).toBe('on');
        expect(cfg.shuffle_command_topic).toBe('echo/set/Bad/shuffle');
        expect(cfg.payload_shuffle_on).toBe('on');
    });

    it('stamps availability from the per-device connected topic', () => {
        nat.handleNativeMessage('echo/status/Bad/media', buf(MEDIA));
        const cfg = byId('echo:Bad').config;

        expect(cfg.availability_topic).toBe('echo/status/Bad/connected');
        expect(cfg.availability_normalized.payloadAvailable).toBe('true');
        expect(cfg.availability_normalized.payloadUnavailable).toBe('false');
    });

    it('ignores bridge-level and unrelated topics', () => {
        nat.handleNativeMessage('echo/status/bridge/connected', buf('2'));
        nat.handleNativeMessage('echo/status/Bad/lastVoiceCommand', buf('play swr3'));
        nat.handleNativeMessage('echo/set/Bad/play', buf('1'));

        expect(byId('echo:bridge')).toBeNull();
        expect(nat.getNativeEntities().filter(e => e.source === 'echo')).toHaveLength(0);
    });
});
