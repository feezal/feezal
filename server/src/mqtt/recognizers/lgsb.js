'use strict';

/**
 * lgsb2mqtt native recognizer (E188).
 *
 * The bridge (github.com/hobbyquaker/lgsb2mqtt) connects ONE LG soundbar per
 * instance to MQTT in the mqtt-smarthome shape, prefix = `--name` (default
 * `soundbar`), `{"val":…}` payloads by default:
 *
 *   <prefix>/status/volume (+ volume/min, volume/max), mute
 *   <prefix>/status/play/{state,position,duration,title,artist,album}   READ-ONLY
 *   <prefix>/status/input + input_list                                  routing
 *   <prefix>/status/eq + eq_list, bass, treble, woofer, rear_level, top_level,
 *                  center_level, side_level, dialog_level (+ <item>/min|max),
 *                  night_mode, auto_volume, drc, auto_power, tv_remote,
 *                  neuralx, rear, av_sync                               processor
 *   <prefix>/set/<item>                                                  writes
 *   <prefix>/connected  0 | 1 | 2
 *
 * It promotes TWO entities per bridge:
 *   - a `media` card for the media half — volume/mute, the play metadata
 *     while streaming, the `input` select through the shared source
 *     capability (E186). The soundbar has NO transport set topics
 *     (`play/state` is read-only), so NO command_topic is stamped: the card
 *     renders as a renderer, not a player (transport degrades when unwired).
 *   - an `audio` entity for the processor half (the `*-audio` element):
 *     it takes the status/set BASES and discovers the model's item set
 *     itself from what the bridge retains.
 *
 * No roster: the prefix is fingerprinted on `status/eq_list` /
 * `status/input_list` / `status/play/state`; the default `soundbar` prefix is
 * accepted on any listed item.
 */

const DEFAULT_PREFIXES = ['soundbar'];

const FINGERPRINT = new Set(['eq_list', 'input_list', 'play/state']);

const ITEMS = new Set(['volume', 'mute', 'input', 'input_list', 'eq', 'eq_list', 'bass', 'treble', 'woofer',
    'rear_level', 'top_level', 'center_level', 'side_level', 'dialog_level', 'night_mode', 'auto_volume',
    'drc', 'auto_power', 'tv_remote', 'neuralx', 'rear', 'av_sync', 'power',
    'play/state', 'play/position', 'play/duration', 'play/title', 'play/artist', 'play/album']);

const lgsbRecognizer = {
    id: 'lgsb',
    state: {devices: new Map(), prefixes: new Set(DEFAULT_PREFIXES)},

    match(topic) {
        const parts = topic.split('/');
        if (parts.length < 3 || parts.length > 5 || parts[1] !== 'status') return null;
        const prefix = parts[0];
        // `play/state` is a two-segment item; `<item>/min|max` are range
        // sidecars of a one-segment item — strip them to the item itself.
        let item = parts.slice(2).join('/');
        if (/\/(min|max)$/.test(item)) item = item.replace(/\/(min|max)$/, '');
        if (!prefix || !item) return null;
        if (FINGERPRINT.has(item)) return {prefix, item, fingerprint: true};
        if (!this.state.prefixes.has(prefix)) return null;
        if (!ITEMS.has(item)) return null;
        return {prefix, item};
    },

    accumulate(state, parsed, value, payload) {
        if (parsed.fingerprint) state.prefixes.add(parsed.prefix);
        const known = state.devices.get(parsed.prefix) || {json: true};
        known.json = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && 'val' in payload);
        state.devices.set(parsed.prefix, known);
        return {prefix: parsed.prefix};
    },

    promote(channelState) {
        return [this._media(channelState.prefix), this._audio(channelState.prefix)];
    },

    _path(prefix) {
        const known = this.state.devices.get(prefix) || {json: true};
        return known.json ? '{{ value_json.val }}' : undefined;
    },

    _availability(prefix) {
        const connected = `${prefix}/connected`;
        return {
            availability_topic: connected,
            availability_normalized: {
                entries: [{topic: connected}], mode: 'all',
                payloadAvailable: '2', payloadUnavailable: '0',
            },
        };
    },

    _media(prefix) {
        const path = this._path(prefix);
        const status = item => `${prefix}/status/${item}`;
        const set = item => `${prefix}/set/${item}`;
        const cfg = {
            name: prefix,
            state_topic: status('play/state'),
            title_topic: status('play/title'),
            artist_topic: status('play/artist'),
            album_topic: status('play/album'),
            position_topic: status('play/position'),
            duration_topic: status('play/duration'),
            // NO command_topic — play/state is read-only on this bridge.
            volume_topic: status('volume'),
            volume_command_topic: set('volume'),
            mute_topic: status('mute'),
            mute_command_topic: set('mute'),
            payload_mute_on: 'true',
            payload_mute_off: 'false',
            // E186: the shared source capability — the soundbar's INPUT.
            source_topic: status('input'),
            source_list_topic: status('input_list'),
            source_command_topic: set('input'),
            ...this._availability(prefix),
        };
        if (path) {
            for (const key of ['state', 'title', 'artist', 'album', 'position', 'duration', 'volume', 'mute',
                'source', 'source_list']) cfg[`${key}_value_template`] = path;
        }
        return {
            discovery_id: `lgsb:${prefix}:media`,
            component: 'media',
            source: 'lgsb',
            sourceLabel: 'LG Soundbar',
            name: prefix,
            config: cfg,
        };
    },

    _audio(prefix) {
        const path = this._path(prefix);
        const cfg = {
            name: `${prefix} audio`,
            state_base_topic: `${prefix}/status`,
            command_base_topic: `${prefix}/set`,
            ...this._availability(prefix),
        };
        if (path) cfg.value_template = path;
        return {
            discovery_id: `lgsb:${prefix}:audio`,
            component: 'audio',
            source: 'lgsb',
            sourceLabel: 'LG Soundbar',
            name: `${prefix} audio`,
            config: cfg,
        };
    },

    reset() {
        this.state.devices.clear();
        this.state.prefixes = new Set(DEFAULT_PREFIXES);
    },
};

module.exports = {lgsbRecognizer};
