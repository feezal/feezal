'use strict';

/**
 * Frigate native recognizer (E163).
 *
 * Frigate (frigate.video) is an excellent pure-MQTT citizen but publishes NO
 * homeassistant/* discovery (HA uses a custom integration) — so feezal
 * recognizes its native tree and synthesizes one `camera` entity per camera:
 *
 *   frigate/<cam>/<object>/snapshot   retained JPEG bytes per detected class
 *                                     (the bridge relays binary images as
 *                                     data URLs — the mqtt-image path)
 *   frigate/<cam>/<object>            retained count per class (person, car…)
 *   frigate/<cam>/motion              ON/OFF
 *   frigate/events                    JSON event stream (the event list)
 *   frigate/available                 online/offline LWT
 *
 * The promoted record wires basic-camera completely in one pick: snapshot
 * topic (person preferred) as the mqtt-image feed, the events topic +
 * camera filter, the thumbs base, motion + per-class count chips, and
 * availability from the LWT. Cameras are learned from the per-camera topics
 * themselves (no stats parsing needed — every camera publishes motion and
 * snapshots), so the recognizer stays a cheap match on topic shape.
 */

// Topic segments under frigate/ that are NOT camera names.
const RESERVED = new Set(['events', 'reviews', 'stats', 'available', 'notifications',
    'restart', 'onvif', 'clips', 'recordings']);

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const frigateRecognizer = {
    id: 'frigate',
    state: {cameras: new Map()},   // cam → {objects: Set<string>}

    match(topic) {
        if (!topic.startsWith('frigate/')) return null;
        const parts = topic.split('/');
        const cam = parts[1];
        if (!cam || RESERVED.has(cam)) return null;
        // frigate/<cam>/motion — the cheapest per-camera signal
        if (parts.length === 3 && parts[2] === 'motion') return {cam};
        // frigate/<cam>/<object>/snapshot — a detected class exists
        if (parts.length === 4 && parts[3] === 'snapshot' && parts[2] !== 'motion') {
            return {cam, obj: parts[2]};
        }
        return null;
    },

    accumulate(state, parsed) {
        if (!state.cameras.has(parsed.cam)) state.cameras.set(parsed.cam, {objects: new Set()});
        const entry = state.cameras.get(parsed.cam);
        if (parsed.obj) entry.objects.add(parsed.obj);
        return {cam: parsed.cam, objects: [...entry.objects]};
    },

    promote(channelState) {
        const {cam, objects} = channelState;
        // person is the class users care about; else the first class seen;
        // else assume person (the snapshot topic appears with the first hit).
        const primary = objects.includes('person') ? 'person' : (objects[0] || 'person');
        const chips = [
            {subscribe: `frigate/${cam}/motion`, label: 'Motion', show: 'nonzero'},
            ...objects.map(o => ({subscribe: `frigate/${cam}/${o}`, label: cap(o), show: 'nonzero'})),
        ];
        return {
            discovery_id: 'frigate:' + cam,
            component: 'camera',
            source: 'frigate',
            sourceLabel: 'Frigate',
            name: cam,
            config: {
                name: cam,
                topic: `frigate/${cam}/${primary}/snapshot`,
                events_topic: 'frigate/events',
                camera_name: cam,
                thumbs_topic: `frigate/${cam}`,
                chips,
                availability_topic: 'frigate/available',
                availability_normalized: {
                    entries: [{topic: 'frigate/available'}],
                    mode: 'all',
                    payloadAvailable: 'online',
                    payloadUnavailable: 'offline',
                },
            },
        };
    },

    reset() { this.state.cameras.clear(); },
};

module.exports = {frigateRecognizer};
