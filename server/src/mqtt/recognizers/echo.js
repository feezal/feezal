'use strict';

/**
 * echo2mqtt native recognizer (E182).
 *
 * echo2mqtt (github.com/hobbyquaker/echo2mqtt) bridges Amazon Echo devices to
 * MQTT. It CAN publish Home Assistant discovery configs, but HA MQTT discovery
 * has no `media_player` component — that path necessarily fans one Echo out
 * into loose sensors, buttons and switches, which would generate a pile of
 * unrelated cards instead of one media card. So feezal recognizes the native
 * tree and synthesizes ONE `media` entity per device:
 *
 *   echo/status/<device>/media              JSON {state,title,artist,album,provider,imageUrl}
 *   echo/status/<device>/audioPlayerState   PLAYING | PAUSED | IDLE | …
 *   echo/status/<device>/volume             0-100
 *   echo/status/<device>/isMuted            ON | OFF
 *   echo/status/<device>/connected          true | false   (availability)
 *   echo/status/bridge/devices              JSON roster (name, topic, serial, …)
 *   echo/set/<device>/{play,pause,next,previous,shuffle,repeat,volume,isMuted}
 *
 * The promoted record wires a media card completely in one pick. Every
 * metadata field is stamped onto the SINGLE combined `media` topic with a
 * different message path (`payload.title`, `payload.artist`, …) — the media
 * controller dedupes subscriptions per topic, so that is one subscription and
 * one atomic update instead of five retained reads.
 *
 * Transport uses the controller's `command_mode: 'topic'`: echo2mqtt has one
 * topic per command (`echo/set/<device>/play`), so the action name becomes the
 * last topic segment rather than a payload.
 */

// Topic segments under echo/status/ that are NOT device names.
const RESERVED = new Set(['bridge']);

const echoRecognizer = {
    id: 'echo',
    state: {devices: new Map()},   // device → {name}

    match(topic) {
        if (!topic.startsWith('echo/status/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 4) return null;              // echo/status/<device>/<leaf>
        const device = parts[2];
        const leaf = parts[3];
        if (!device) return null;
        // The bridge roster names every device authoritatively.
        if (device === 'bridge' && leaf === 'devices') return {roster: true};
        if (RESERVED.has(device)) return null;
        // Cheap per-device signals that every music-capable Echo publishes.
        if (leaf === 'media' || leaf === 'audioPlayerState' || leaf === 'volume') return {device};
        return null;
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
                state.devices.set(topicName, {name: d.name || topicName});
                devices.push(topicName);
            }
            return devices.length ? {rosterDevices: devices} : null;
        }
        if (!state.devices.has(parsed.device)) state.devices.set(parsed.device, {name: parsed.device});
        return {device: parsed.device};
    },

    promote(channelState) {
        if (channelState.rosterDevices) {
            return channelState.rosterDevices.map(d => this._entity(d));
        }
        return this._entity(channelState.device);
    },

    _entity(device) {
        const name = this.state.devices.get(device)?.name || device;
        const status = `echo/status/${device}`;
        const media = `${status}/media`;
        const connected = `${status}/connected`;
        return {
            discovery_id: 'echo:' + device,
            component: 'media',
            source: 'echo',
            sourceLabel: 'Echo',
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
                command_topic: `echo/set/${device}`,
                command_mode: 'topic',
                payload_play: 'play',
                payload_pause: 'pause',
                payload_next: 'next',
                payload_previous: 'previous',
                // Volume + mute (echo2mqtt speaks ON/OFF for isMuted).
                volume_topic: `${status}/volume`,
                volume_command_topic: `echo/set/${device}/volume`,
                mute_topic: `${status}/isMuted`,
                mute_command_topic: `echo/set/${device}/isMuted`,
                payload_mute_on: 'ON',
                payload_mute_off: 'OFF',
                // Shuffle + repeat are boolean on/off here, so repeat runs in
                // the controller's two-state toggle mode.
                shuffle_command_topic: `echo/set/${device}/shuffle`,
                payload_shuffle_on: 'on',
                payload_shuffle_off: 'off',
                repeat_command_topic: `echo/set/${device}/repeat`,
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

    reset() { this.state.devices.clear(); },
};

module.exports = {echoRecognizer};
