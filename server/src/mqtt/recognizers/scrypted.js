'use strict';

/**
 * Scrypted camera recognizer (E169).
 *
 * Scrypted's MQTT plugin publishes standard homeassistant/* discovery for the
 * NON-camera interfaces of its devices (binary_sensor motion/audio, sensor,
 * switch, light, lock) — but never a `camera` component and no image payloads:
 * the video surface is the (paid) Scrypted NVR web endpoint, which the
 * basic-scrypted element embeds by URL. So the HA discovery path alone leaves
 * a Scrypted camera invisible in the camera pickers.
 *
 * This recognizer watches the SAME discovery configs the HA path consumes and
 * synthesizes one `scrypted-camera` entity per Scrypted device that exposes a
 * MotionSensor interface — for a camera platform that is the telltale (every
 * camera publishes motion; a standalone Scrypted motion sensor matches too,
 * which is acceptable picker noise, not a wiring error). The wire shapes, read
 * from the plugin's autodiscovery.ts:
 *
 *   topic:     homeassistant/<component>/<nodeId>/<iface>/config
 *   nodeId:    scrypted-<mqttId>-<device.id>      (device.id = NVR device id)
 *   unique_id: scrypted-<mqttId>-<device.id>-<iface>
 *   payload:   { name, stat_t/state_topic, dev: {name, …}, … }
 *
 * device.id is the LAST dash-segment of the nodeId (Scrypted ids are plain
 * decimal strings; the mqttId before it may itself contain dashes). The
 * promoted config carries the device id + name + motion topic; the NVR card
 * URL (base + token) cannot travel over MQTT — the editor asks for it once
 * and composes `src`, exactly the Frigate-URL pattern.
 */

const scryptedRecognizer = {
    id: 'scrypted',
    state: {devices: new Map()},   // deviceId → {name, motionTopic, hasMotion}

    match(topic) {
        if (!topic.startsWith('homeassistant/')) return null;
        const parts = topic.split('/');
        // homeassistant/<component>/<nodeId>/<iface>/config
        if (parts.length !== 5 || parts[4] !== 'config') return null;
        const nodeId = parts[2];
        if (!nodeId.startsWith('scrypted-')) return null;
        const deviceId = nodeId.split('-').pop();
        if (!deviceId || deviceId === 'scrypted') return null;
        return {deviceId, iface: parts[3], component: parts[1]};
    },

    accumulate(state, parsed, _value, payload) {
        if (!payload) return null;   // config deletes / non-JSON: nothing to learn
        if (!state.devices.has(parsed.deviceId)) {
            state.devices.set(parsed.deviceId, {name: '', motionTopic: '', hasMotion: false});
        }
        const entry = state.devices.get(parsed.deviceId);
        // The device block's name is the device's own; a config-level `name`
        // is the per-entity one (device + interface) — only used as fallback.
        const devName = payload.dev?.name || payload.device?.name;
        if (devName) entry.name = devName;
        else if (!entry.name && payload.name) entry.name = String(payload.name);
        if (parsed.iface === 'MotionSensor') {
            entry.hasMotion = true;
            entry.motionTopic = payload.stat_t || payload.state_topic || entry.motionTopic;
        }
        return entry.hasMotion ? {deviceId: parsed.deviceId, ...entry} : null;
    },

    promote(channelState) {
        return {
            discovery_id: 'scrypted:' + channelState.deviceId,
            component: 'scrypted-camera',
            source: 'scrypted',
            sourceLabel: 'Scrypted',
            name: channelState.name || 'Camera ' + channelState.deviceId,
            config: {
                name: channelState.name || 'Camera ' + channelState.deviceId,
                camera_id: channelState.deviceId,
                motion_topic: channelState.motionTopic,
            },
        };
    },

    reset() { this.state.devices.clear(); },
};

module.exports = {scryptedRecognizer};
