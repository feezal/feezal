/**
 * E163 — native Frigate recognizer. Frigate publishes a rich native MQTT tree
 * but NO homeassistant/* discovery, so the recognizer synthesizes one `camera`
 * entity per camera from the per-camera topics (motion + per-class snapshot),
 * wiring basic-camera completely: mqtt-image snapshot feed, events topic +
 * camera filter, thumbs base, motion/count chips, LWT availability.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(String(v));
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

// JPEG magic bytes — snapshots are binary; the recognizer only reads the topic.
const jpeg = () => Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0]);

beforeEach(() => nat.clearNativeEntities());

describe('E163 — Frigate camera entities', () => {
    it('synthesizes one camera entity per camera with the full wiring', () => {
        nat.handleNativeMessage('frigate/hof/motion', buf('OFF'));
        nat.handleNativeMessage('frigate/hof/person/snapshot', jpeg());
        nat.handleNativeMessage('frigate/hof/car/snapshot', jpeg());
        nat.handleNativeMessage('frigate/tuer/motion', buf('ON'));

        const hof = byId('frigate:hof');
        expect(hof).toBeTruthy();
        expect(hof.component).toBe('camera');
        expect(hof.sourceLabel).toBe('Frigate');
        // person preferred as the feed class
        expect(hof.config.topic).toBe('frigate/hof/person/snapshot');
        expect(hof.config.events_topic).toBe('frigate/events');
        expect(hof.config.camera_name).toBe('hof');
        expect(hof.config.thumbs_topic).toBe('frigate/hof');
        // chips: motion + one per detected class
        const chipTopics = hof.config.chips.map(c => c.subscribe).sort();
        expect(chipTopics).toEqual(['frigate/hof/car', 'frigate/hof/motion', 'frigate/hof/person']);
        // availability from the LWT
        expect(hof.config.availability_normalized.entries[0].topic).toBe('frigate/available');

        // a camera known only from motion still promotes (person assumed)
        const tuer = byId('frigate:tuer');
        expect(tuer).toBeTruthy();
        expect(tuer.config.topic).toBe('frigate/tuer/person/snapshot');
    });

    it('never mistakes reserved frigate topics for cameras', () => {
        nat.handleNativeMessage('frigate/events', buf('{"type":"new"}'));
        nat.handleNativeMessage('frigate/stats', buf('{}'));
        nat.handleNativeMessage('frigate/available', buf('online'));
        expect(nat.getNativeEntities().filter(e => e.source === 'frigate')).toHaveLength(0);
    });

    it('learns a camera from the retained toggle states alone (no detection yet)', () => {
        // A fresh server start on a quiet system sees only the retained
        // per-camera config toggles — no object snapshot exists before the
        // first detection. frigate/<cam>/<toggle>/state must promote.
        nat.handleNativeMessage('frigate/terrasse/motion/state', buf('ON'));
        nat.handleNativeMessage('frigate/terrasse/detect/state', buf('ON'));
        nat.handleNativeMessage('frigate/terrasse/snapshots/state', buf('ON'));

        const cam = byId('frigate:terrasse');
        expect(cam).toBeTruthy();
        expect(cam.component).toBe('camera');
        // no class seen yet → person assumed for the feed topic
        expect(cam.config.topic).toBe('frigate/terrasse/person/snapshot');
        // toggle segments are NOT object classes — only the motion chip exists
        const chipTopics = cam.config.chips.map(c => c.subscribe);
        expect(chipTopics).toEqual(['frigate/terrasse/motion']);
    });
});
