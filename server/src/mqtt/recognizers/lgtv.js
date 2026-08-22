'use strict';

/**
 * lgtv2mqtt native recognizer (B130 — completes the E187 remote family).
 *
 * The bridge (github.com/hobbyquaker/lgtv2mqtt) connects one LG webOS TV per
 * instance, prefix = `--name` (default `lgtv`):
 *
 *   <prefix>/status/{volume,mute,output,foregroundApp,currentChannel}
 *   <prefix>/set/{button,launch,output,volume,mute,toast,…}
 *   <prefix>/connected  0 | 1 | 2
 *
 * It publishes very few status topics, so the fingerprint is the distinctive
 * `status/foregroundApp` (nothing else names its leaf that way); a plain
 * `volume`/`mute`/`output` counts only under a known/learned prefix, so an
 * unrelated `x/status/volume` tree is never swallowed. The default `lgtv`
 * prefix is accepted out of the box; a custom `--name` is learned from its
 * foregroundApp topic, and every stamped topic follows the prefix the TV was
 * seen under.
 *
 * Promotes ONE `remote` entity per TV — the pick wires a glass/metro/circle-
 * remote completely (set base, status topics, availability). Deliberately
 * NOT a second `media` candidate: the TV carries volume/mute but no
 * metadata/transport, so a media card would be a near-empty volume slider —
 * the remote already has that row.
 */

const DEFAULT_PREFIXES = ['lgtv'];
const FINGERPRINT = new Set(['foregroundApp']);
const LEAVES = new Set(['foregroundApp', 'volume', 'mute', 'output', 'currentChannel']);

const lgtvRecognizer = {
    id: 'lgtv',
    state: {prefixes: new Set(DEFAULT_PREFIXES), seen: new Set()},

    match(topic) {
        const parts = topic.split('/');
        if (parts.length !== 3 || parts[1] !== 'status') return null;
        const [prefix, , leaf] = parts;
        if (!prefix || !leaf) return null;
        if (FINGERPRINT.has(leaf)) return {prefix, leaf, fingerprint: true};
        if (!this.state.prefixes.has(prefix)) return null;
        if (!LEAVES.has(leaf)) return null;
        return {prefix, leaf};
    },

    accumulate(state, parsed) {
        if (parsed.fingerprint) state.prefixes.add(parsed.prefix);
        state.seen.add(parsed.prefix);
        return {prefix: parsed.prefix};
    },

    promote(channelState) {
        return this._entity(channelState.prefix);
    },

    _entity(prefix) {
        const connected = `${prefix}/connected`;
        return {
            discovery_id: 'lgtv:' + prefix,
            component: 'remote',
            source: 'lgtv',
            sourceLabel: 'LG TV',
            name: prefix,
            config: {
                name: prefix,
                // The remote contract's set BASE — keys append their segment.
                command_base_topic: `${prefix}/set`,
                volume_topic: `${prefix}/status/volume`,
                mute_topic: `${prefix}/status/mute`,
                output_topic: `${prefix}/status/output`,
                // lgtv2mqtt publishes {appId, windowId, processId}; the
                // controller understands the object shape without a path.
                app_topic: `${prefix}/status/foregroundApp`,
                availability_topic: connected,
                availability_normalized: {
                    entries: [{topic: connected}],
                    mode: 'all',
                    payloadAvailable: '2',
                    payloadUnavailable: '0',
                },
            },
        };
    },

    reset() {
        this.state.prefixes = new Set(DEFAULT_PREFIXES);
        this.state.seen.clear();
    },
};

module.exports = {lgtvRecognizer};
