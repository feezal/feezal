'use strict';

/**
 * wiim2mqtt native recognizer (E186).
 *
 * The bridge (github.com/hobbyquaker/wiim2mqtt) connects ONE WiiM streamer
 * per instance to MQTT in the mqtt-smarthome shape, topic prefix = `--name`
 * (default `wiim`, configurable):
 *
 *   <prefix>/status/<item>     retained, {"val":…,"ts":…,"lc":…} by default
 *                              → every field is stamped with the path
 *                              `payload.val`. A `--no-json-payloads` bridge
 *                              sends bare values; that is detected from the
 *                              message shape and the paths are left at
 *                              `payload`.
 *   <prefix>/set/<item>        volume, mute, play, pause, stop, next, prev,
 *                              toggle, seek, repeat, shuffle, source, preset
 *   <prefix>/connected         0 | 1 | 2  (available on 2)
 *
 * It publishes HA discovery too, but HA MQTT discovery has no media_player
 * component — the same reason the Alexa path has a native recognizer.
 *
 * There is no device roster (one instance = one device), so the prefix is
 * fingerprinted on the bridge's distinctive item names instead:
 * `<prefix>/status/play_state` and `<prefix>/status/source_list` — specific
 * enough not to collide with an unrelated `foo/status/volume`. The default
 * `wiim` prefix is accepted on any listed item; a custom `--name` is learned
 * from a fingerprint item and every topic is built from the prefix it was
 * seen under.
 *
 * The promoted record wires a media card completely in one pick — including
 * the shared SOURCE select (`source` + `source_list` → the contract's
 * `subscribe-source` / `subscribe-source-list` / `publish-source`) and the
 * preset row (`preset_list` / `preset_max` / `set/preset`) this bridge
 * exposed the need for. Transport is `command-mode: topic`; note the verb is
 * `prev`, not `previous`. Repeat is the tri-state off/one/all the controller
 * cycles natively.
 */

const DEFAULT_PREFIXES = ['wiim'];

// Items whose presence alone identifies a wiim2mqtt tree (learns the prefix).
const FINGERPRINT = new Set(['play_state', 'source_list']);

// Items accepted under a KNOWN prefix (cheap per-device confirmation).
const ITEMS = new Set(['play_state', 'source_list', 'volume', 'mute', 'title', 'artist', 'album',
    'album_art', 'duration', 'position', 'repeat', 'shuffle', 'source', 'preset_list', 'preset_max']);

const wiimRecognizer = {
    id: 'wiim',
    // prefix → {json: bool} — whether the bridge wraps payloads in {"val":…}
    state: {devices: new Map(), prefixes: new Set(DEFAULT_PREFIXES)},

    match(topic) {
        const parts = topic.split('/');
        if (parts.length !== 3 || parts[1] !== 'status') return null;
        const [prefix, , item] = parts;
        if (!prefix || !item) return null;
        if (FINGERPRINT.has(item)) return {prefix, item, fingerprint: true};
        if (!this.state.prefixes.has(prefix)) return null;
        if (!ITEMS.has(item)) return null;
        return {prefix, item};
    },

    accumulate(state, parsed, value, payload) {
        if (parsed.fingerprint) state.prefixes.add(parsed.prefix);
        const known = state.devices.get(parsed.prefix) || {json: true};
        // `--no-json-payloads`: the value arrives bare. A {"val":…} envelope
        // parses to an object carrying `val`; anything else means plain.
        const wrapped = payload && typeof payload === 'object' && !Array.isArray(payload) && 'val' in payload;
        known.json = wrapped;
        state.devices.set(parsed.prefix, known);
        return {prefix: parsed.prefix};
    },

    promote(channelState) {
        return this._entity(channelState.prefix);
    },

    _entity(prefix) {
        const known = this.state.devices.get(prefix) || {json: true};
        const path = known.json ? '{{ value_json.val }}' : undefined;
        const status = item => `${prefix}/status/${item}`;
        const set = item => `${prefix}/set/${item}`;
        const connected = `${prefix}/connected`;
        const cfg = {
            name: prefix,
            state_topic: status('play_state'),
            title_topic: status('title'),
            artist_topic: status('artist'),
            album_topic: status('album'),
            artwork_topic: status('album_art'),
            position_topic: status('position'),
            duration_topic: status('duration'),
            // Transport: one topic per command → topic mode; the bridge's
            // skip-back verb is `prev`.
            command_topic: `${prefix}/set`,
            command_mode: 'topic',
            payload_play: 'play',
            payload_pause: 'pause',
            payload_stop: 'stop',
            payload_next: 'next',
            payload_previous: 'prev',
            seek_command_topic: set('seek'),
            volume_topic: status('volume'),
            volume_command_topic: set('volume'),
            mute_topic: status('mute'),
            mute_command_topic: set('mute'),
            payload_mute_on: 'true',
            payload_mute_off: 'false',
            shuffle_topic: status('shuffle'),
            shuffle_command_topic: set('shuffle'),
            payload_shuffle_on: 'true',
            payload_shuffle_off: 'false',
            // off / one / all — the controller's native cycle.
            repeat_topic: status('repeat'),
            repeat_command_topic: set('repeat'),
            repeat_mode: 'cycle',
            // E186: the shared source/preset capability.
            source_topic: status('source'),
            source_list_topic: status('source_list'),
            source_command_topic: set('source'),
            preset_list_topic: status('preset_list'),
            preset_max_topic: status('preset_max'),
            preset_command_topic: set('preset'),
            availability_topic: connected,
            availability_normalized: {
                entries: [{topic: connected}],
                mode: 'all',
                payloadAvailable: '2',
                payloadUnavailable: '0',
            },
        };
        if (path) {
            for (const key of ['state', 'title', 'artist', 'album', 'artwork', 'position', 'duration',
                'volume', 'mute', 'shuffle', 'repeat', 'source', 'source_list', 'preset_list', 'preset_max']) {
                cfg[`${key}_value_template`] = path;
            }
        }
        return {
            discovery_id: 'wiim:' + prefix,
            component: 'media',
            source: 'wiim',
            sourceLabel: 'WiiM',
            name: prefix,
            config: cfg,
        };
    },

    reset() {
        this.state.devices.clear();
        this.state.prefixes = new Set(DEFAULT_PREFIXES);
    },
};

module.exports = {wiimRecognizer};
