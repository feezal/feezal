'use strict';

/**
 * WLED native recognizer (A30 — extracted from native-discovery.js).
 *
 * WLED with MQTT enabled publishes a native `wled/<deviceTopic>/…`
 * tree; this recognizer synthesizes the normalized entity shape the framework
 * consumes. Self-contained — it builds its config inline and needs none of the
 * shared HM helpers. See native-discovery.js for the recognizer contract.
 */

const wledRecognizer = {
    id: 'wled',
    state: {devices: new Set()},

    match(topic) {
        // wled/<deviceTopic>/v (full state) OR wled/<deviceTopic>/status (LWT).
        if (!topic.startsWith('wled/')) return null;
        const parts = topic.split('/');
        if (parts.length !== 3) return null;            // deviceTopic is a single level
        const leaf = parts[2];
        if (leaf !== 'v' && leaf !== 'status') return null;
        return {deviceTopic: parts[1]};
    },

    accumulate(state, parsed /* , value */) {
        state.devices.add(parsed.deviceTopic);
        return parsed;
    },

    promote(channelState) {
        const dt = channelState.deviceTopic;
        const status = 'wled/' + dt + '/status';
        return {
            discovery_id: 'wled:' + dt,
            component: 'wled',
            source: 'wled',
            sourceLabel: 'WLED',
            name: dt,
            config: {
                name: dt,
                device_topic: 'wled/' + dt,
                availability_topic: status,
                // Inside config (HA convention — _applyDiscovery reads cfg.availability_normalized).
                availability_normalized: {
                    entries: [{topic: status}],
                    mode: 'all',
                    payloadAvailable: 'online',
                    payloadUnavailable: 'offline',
                },
            },
        };
    },

    reset() { this.state.devices.clear(); },
};

module.exports = {wledRecognizer};
