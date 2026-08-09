'use strict';

/**
 * alexa-remote-mqtt / echo2mqtt native recognizer (E182).
 *
 * The bridge (github.com/hobbyquaker/alexa-remote-mqtt, formerly echo2mqtt)
 * connects Amazon Echo devices to MQTT. It CAN publish Home Assistant
 * discovery configs, but HA MQTT discovery has no `media_player` component —
 * that path necessarily fans one Echo out into loose sensors, buttons and
 * switches, which would generate a pile of unrelated cards instead of one
 * media card. So feezal recognizes the native tree and synthesizes ONE `media`
 * entity per device:
 *
 *   <prefix>/status/<device>/media              JSON {state,title,artist,album,provider,imageUrl}
 *   <prefix>/status/<device>/audioPlayerState   PLAYING | PAUSED | IDLE | …
 *   <prefix>/status/<device>/volume             0-100
 *   <prefix>/status/<device>/isMuted            ON | OFF
 *   <prefix>/status/<device>/connected          true | false   (availability)
 *   <prefix>/status/bridge/devices              JSON roster (name, topic, serial, …)
 *   <prefix>/set/<device>/{play,pause,next,previous,shuffle,repeat,volume,isMuted}
 *
 * **Topic prefix.** The default changed from `echo` to `alexa` with the
 * rename, and it is configurable in the bridge either way — so the prefix is
 * NOT hardcoded here. Both defaults are recognized out of the box, and any
 * custom prefix is LEARNED from its roster topic (`…/status/bridge/devices`,
 * a strong fingerprint: that exact three-segment tail plus a device array).
 * Every promoted topic is then built from the prefix the device was actually
 * seen under, so a renamed or re-prefixed bridge needs no code change.
 *
 * The promoted record wires a media card completely in one pick. Every
 * metadata field is stamped onto the SINGLE combined `media` topic with a
 * different message path (`payload.title`, `payload.artist`, …) — the media
 * controller dedupes subscriptions per topic, so that is one subscription and
 * one atomic update instead of five retained reads.
 *
 * Transport uses the controller's `command_mode: 'topic'`: the bridge has one
 * topic per command (`<prefix>/set/<device>/play`), so the action name becomes
 * the last topic segment rather than a payload.
 */

// Topic segments under <prefix>/status/ that are NOT device names.
const RESERVED = new Set(['bridge']);

// Prefixes recognized without having seen a roster first: the current default
// and the pre-rename one (echo2mqtt).
const DEFAULT_PREFIXES = ['alexa', 'echo'];

// Per-device leaves cheap enough to treat as a device fingerprint.
const DEVICE_LEAVES = new Set(['media', 'audioPlayerState', 'volume']);

const alexaRecognizer = {
    id: 'alexa',
    // device key → {name, prefix}; prefixes → every prefix seen so far.
    state: {devices: new Map(), prefixes: new Set(DEFAULT_PREFIXES)},

    match(topic) {
        const parts = topic.split('/');
        if (parts.length !== 4 || parts[1] !== 'status') return null;
        const [prefix, , device, leaf] = parts;
        if (!prefix || !device) return null;
        // The roster names every device authoritatively AND identifies the
        // prefix — accepted from any prefix, which is how a custom one is
        // learned.
        if (device === 'bridge' && leaf === 'devices') return {roster: true, prefix};
        if (RESERVED.has(device)) return null;
        // Per-device topics only count under a known/learned prefix, so this
        // cannot swallow an unrelated `foo/status/bar/volume` tree.
        if (!this.state.prefixes.has(prefix)) return null;
        if (!DEVICE_LEAVES.has(leaf)) return null;
        return {device, prefix};
    },

    accumulate(state, parsed, value, payload) {
        if (parsed.roster) {
            // JSON list of {name, topic, serial, type, capabilities}. `topic` is
            // the sanitized name used in the topic tree; fall back to `name`.
            // The roster is a JSON ARRAY, which the framework's parsePayload()
            // deliberately drops (it only yields objects) — so read it from the
            // extracted value, which does carry parsed arrays.
            const list = Array.isArray(value) ? value
                : Array.isArray(payload) ? payload
                    : (payload?.devices || value?.devices || []);
            const devices = [];
            for (const d of list) {
                const topicName = d && (d.topic || d.name);
                if (!topicName || RESERVED.has(topicName)) continue;
                state.devices.set(topicName, {name: d.name || topicName, prefix: parsed.prefix});
                devices.push(topicName);
            }
            // Only trust a prefix that actually carried a device roster.
            if (devices.length) state.prefixes.add(parsed.prefix);
            return devices.length ? {rosterDevices: devices} : null;
        }
        const known = state.devices.get(parsed.device);
        if (!known) state.devices.set(parsed.device, {name: parsed.device, prefix: parsed.prefix});
        else known.prefix = parsed.prefix;          // a re-prefixed bridge moves with it
        return {device: parsed.device};
    },

    promote(channelState) {
        if (channelState.rosterDevices) {
            return channelState.rosterDevices.map(d => this._entity(d));
        }
        return this._entity(channelState.device);
    },

    _entity(device) {
        const known = this.state.devices.get(device) || {};
        const name = known.name || device;
        const prefix = known.prefix || DEFAULT_PREFIXES[0];
        const status = `${prefix}/status/${device}`;
        const media = `${status}/media`;
        const connected = `${status}/connected`;
        return {
            // Prefix-independent: re-prefixing the bridge must not duplicate
            // the card (the dupe-guard keys on this id).
            discovery_id: 'alexa:' + device,
            component: 'media',
            source: 'alexa',
            sourceLabel: 'Alexa',
            name,
            config: {
                name,
                // One combined JSON feeds state + every metadata field; the
                // controller opens a single subscription for them.
                state_topic: media,
                state_value_template: '{{ value_json.state }}',
                title_topic: media,
                title_value_template: '{{ value_json.title }}',
                artist_topic: media,
                artist_value_template: '{{ value_json.artist }}',
                album_topic: media,
                album_value_template: '{{ value_json.album }}',
                provider_topic: media,
                provider_value_template: '{{ value_json.provider }}',
                artwork_topic: media,
                artwork_value_template: '{{ value_json.imageUrl }}',
                // Transport: one topic per command → topic mode.
                command_topic: `${prefix}/set/${device}`,
                command_mode: 'topic',
                payload_play: 'play',
                payload_pause: 'pause',
                payload_next: 'next',
                payload_previous: 'previous',
                // Volume + mute (the bridge speaks ON/OFF for isMuted).
                volume_topic: `${status}/volume`,
                volume_command_topic: `${prefix}/set/${device}/volume`,
                mute_topic: `${status}/isMuted`,
                mute_command_topic: `${prefix}/set/${device}/isMuted`,
                payload_mute_on: 'ON',
                payload_mute_off: 'OFF',
                // Shuffle + repeat are boolean on/off here, so repeat runs in
                // the controller's two-state toggle mode.
                shuffle_command_topic: `${prefix}/set/${device}/shuffle`,
                payload_shuffle_on: 'on',
                payload_shuffle_off: 'off',
                repeat_command_topic: `${prefix}/set/${device}/repeat`,
                repeat_mode: 'toggle',
                payload_repeat_on: 'on',
                payload_repeat_off: 'off',
                availability_topic: connected,
                availability_normalized: {
                    entries: [{topic: connected}],
                    mode: 'all',
                    payloadAvailable: 'true',
                    payloadUnavailable: 'false',
                },
            },
        };
    },

    reset() {
        this.state.devices.clear();
        this.state.prefixes = new Set(DEFAULT_PREFIXES);
    },
};

module.exports = {alexaRecognizer};
