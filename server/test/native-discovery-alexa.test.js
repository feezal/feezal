/**
 * E182 — native alexa-remote-mqtt (formerly echo2mqtt) recognizer. The bridge
 * publishes a native `<prefix>/status/<device>/…` tree; HA MQTT discovery has
 * no media_player component, so feezal recognizes the native tree and
 * synthesizes ONE `media` entity per Echo that wires a media card in a single
 * pick. The topic prefix is configurable in the bridge (and its default
 * changed from `echo` to `alexa` with the rename), so it must never be
 * hardcoded here.
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

beforeEach(() => {
    nat.clearNativeEntities();
    nat.recognizers.find(r => r.id === 'alexa').reset();
});

describe('E182 — Alexa media entities', () => {
    it('synthesizes one media entity from a per-device media message', () => {
        nat.handleNativeMessage('alexa/status/Kitchen/media', buf(MEDIA));

        const e = byId('alexa:Kitchen');
        expect(e).toBeTruthy();
        expect(e.component).toBe('media');
        expect(e.source).toBe('alexa');
        expect(e.sourceLabel).toBe('Alexa');
        expect(e.name).toBe('Kitchen');
    });

    it('learns every device from the bridge roster, with the friendly name', () => {
        nat.handleNativeMessage('alexa/status/bridge/devices', buf([
            {name: 'Küche', topic: 'Kueche', serial: 'G01', type: 'ECHO'},
            {name: 'Bad', topic: 'Bad', serial: 'G02', type: 'ECHO_DOT'},
        ]));

        expect(byId('alexa:Kueche')?.name).toBe('Küche');
        expect(byId('alexa:Bad')?.name).toBe('Bad');
    });

    it('stamps every metadata field onto the ONE combined media topic with its own path', () => {
        nat.handleNativeMessage('alexa/status/Bad/media', buf(MEDIA));
        const cfg = byId('alexa:Bad').config;

        const media = 'alexa/status/Bad/media';
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

    it('wires transport in TOPIC command mode (the bridge has one topic per command)', () => {
        nat.handleNativeMessage('alexa/status/Bad/audioPlayerState', buf('PLAYING'));
        const cfg = byId('alexa:Bad').config;

        expect(cfg.command_topic).toBe('alexa/set/Bad');
        expect(cfg.command_mode).toBe('topic');
        expect(cfg.payload_play).toBe('play');
        expect(cfg.payload_next).toBe('next');
        expect(cfg.payload_previous).toBe('previous');
    });

    it('wires volume and mute with the ON/OFF dialect the bridge speaks', () => {
        nat.handleNativeMessage('alexa/status/Bad/volume', buf('40'));
        const cfg = byId('alexa:Bad').config;

        expect(cfg.volume_topic).toBe('alexa/status/Bad/volume');
        expect(cfg.volume_command_topic).toBe('alexa/set/Bad/volume');
        expect(cfg.mute_topic).toBe('alexa/status/Bad/isMuted');
        expect(cfg.mute_command_topic).toBe('alexa/set/Bad/isMuted');
        expect(cfg.payload_mute_on).toBe('ON');
        expect(cfg.payload_mute_off).toBe('OFF');
    });

    it('puts repeat into two-state toggle mode (the bridge only knows on/off)', () => {
        nat.handleNativeMessage('alexa/status/Bad/media', buf(MEDIA));
        const cfg = byId('alexa:Bad').config;

        expect(cfg.repeat_mode).toBe('toggle');
        expect(cfg.repeat_command_topic).toBe('alexa/set/Bad/repeat');
        expect(cfg.payload_repeat_on).toBe('on');
        expect(cfg.shuffle_command_topic).toBe('alexa/set/Bad/shuffle');
        expect(cfg.payload_shuffle_on).toBe('on');
    });

    it('stamps availability from the per-device connected topic', () => {
        nat.handleNativeMessage('alexa/status/Bad/media', buf(MEDIA));
        const cfg = byId('alexa:Bad').config;

        expect(cfg.availability_topic).toBe('alexa/status/Bad/connected');
        expect(cfg.availability_normalized.payloadAvailable).toBe('true');
        expect(cfg.availability_normalized.payloadUnavailable).toBe('false');
    });

    it('ignores bridge-level and unrelated topics', () => {
        nat.handleNativeMessage('alexa/status/bridge/connected', buf('2'));
        nat.handleNativeMessage('alexa/status/Bad/lastVoiceCommand', buf('play swr3'));
        nat.handleNativeMessage('alexa/set/Bad/play', buf('1'));

        expect(byId('alexa:bridge')).toBeNull();
        expect(nat.getNativeEntities().filter(e => e.source === 'alexa')).toHaveLength(0);
    });
});

describe('E182 — the topic prefix is not hardcoded', () => {
    it('still recognizes the pre-rename echo2mqtt prefix', () => {
        nat.handleNativeMessage('echo/status/Hobbyraum/media', buf(MEDIA));

        const e = byId('alexa:Hobbyraum');
        expect(e).toBeTruthy();
        expect(e.config.state_topic).toBe('echo/status/Hobbyraum/media');
        expect(e.config.command_topic).toBe('echo/set/Hobbyraum');
    });

    it('LEARNS a custom prefix from its roster and wires every topic under it', () => {
        // A user-configured prefix is unknown until the roster identifies it…
        nat.handleNativeMessage('haus/status/Wohnzimmer/media', buf(MEDIA));
        expect(byId('alexa:Wohnzimmer')).toBeNull();

        nat.handleNativeMessage('haus/status/bridge/devices', buf([{name: 'Wohnzimmer', topic: 'Wohnzimmer'}]));
        const e = byId('alexa:Wohnzimmer');
        expect(e).toBeTruthy();
        expect(e.config.state_topic).toBe('haus/status/Wohnzimmer/media');
        expect(e.config.volume_command_topic).toBe('haus/set/Wohnzimmer/volume');
        expect(e.config.availability_topic).toBe('haus/status/Wohnzimmer/connected');

        // …and afterwards its per-device topics are recognized on their own.
        nat.handleNativeMessage('haus/status/Kueche/volume', buf('30'));
        expect(byId('alexa:Kueche')?.config.command_topic).toBe('haus/set/Kueche');
    });

    it('does NOT swallow an unrelated tree that merely looks similar', () => {
        nat.handleNativeMessage('shelly/status/livingroom/volume', buf('40'));
        nat.handleNativeMessage('foo/status/bar/media', buf('something'));

        expect(nat.getNativeEntities().filter(e => e.source === 'alexa')).toHaveLength(0);
    });

    it('keeps ONE card per device when the bridge is re-prefixed (id is prefix-independent)', () => {
        nat.handleNativeMessage('echo/status/Bad/media', buf(MEDIA));
        nat.handleNativeMessage('alexa/status/Bad/media', buf(MEDIA));

        const alexaEntities = nat.getNativeEntities().filter(e => e.source === 'alexa');
        expect(alexaEntities).toHaveLength(1);
        // …and it followed the bridge to the new prefix.
        expect(alexaEntities[0].config.command_topic).toBe('alexa/set/Bad');
    });
});
