/**
 * Top-bar MQTT connection dot state (_mqttDot) — pure mapping from the bridge
 * status (+ a yellow "connecting" while a deploy applies the connection) to the
 * dot's css class + tooltip. Exercised on the prototype to avoid mounting the
 * whole editor.
 */
import {describe, it, expect} from 'vitest';
import '../src/feezal-app-editor.js';

const mqttDot = customElements.get('feezal-app-editor').prototype._mqttDot;
const shouldShowConnect = customElements.get('feezal-app-editor').prototype._shouldShowConnect;

describe('top-bar MQTT dot state', () => {
    it('green when the bridge is connected', () => {
        const d = mqttDot.call({deploying: false, _bridge: {connected: true, uri: 'ws://x:9001'}});
        expect(d.cls).toBe('ok');
        expect(d.label).toContain('ws://x:9001');
    });

    it('red with the error when a broker is configured but not connected', () => {
        const d = mqttDot.call({deploying: false, _bridge: {connected: false, uri: 'ws://x:9001', lastError: {message: 'ECONNREFUSED'}}});
        expect(d.cls).toBe('err');
        expect(d.label).toContain('ECONNREFUSED');
    });

    it('grey/unknown when no broker is configured', () => {
        expect(mqttDot.call({deploying: false, _bridge: null}).cls).toBe('unknown');
        expect(mqttDot.call({deploying: false, _bridge: {uri: ''}}).cls).toBe('unknown');
    });

    it('yellow/connecting while a deploy is applying the connection', () => {
        const d = mqttDot.call({deploying: true, _bridge: {connected: true, uri: 'ws://x'}});
        expect(d.cls).toBe('connecting');
    });
});

describe('first-run connect-dialog gating (_shouldShowConnect)', () => {
    const show = b => shouldShowConnect.call({}, b);
    it('does NOT show when the broker is configured and connected', () => {
        expect(show({connected: true, uri: 'mqtt://localhost:1883'})).toBe(false);
    });
    it('shows when no broker is CONFIRMED unconfigured (a status without uri)', () => {
        expect(show({uri: ''})).toBe(true);
        expect(show({})).toBe(true);
    });
    it('an UNKNOWN status (fetch failed / route unavailable) never nags (B123)', () => {
        expect(show(null)).toBe(false);
        expect(show(undefined)).toBe(false);
    });
    it('shows when the configured broker failed to connect', () => {
        expect(show({connected: false, uri: 'mqtt://x:1883', lastError: {message: 'ECONNREFUSED'}})).toBe(true);
    });
    it('does NOT show while still connecting (uri, not connected, no error yet)', () => {
        expect(show({connected: false, uri: 'mqtt://x:1883', lastError: null})).toBe(false);
    });
});
