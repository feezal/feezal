/**
 * Top-bar MQTT connection dot state (_mqttDot) — pure mapping from the bridge
 * status (+ a yellow "connecting" while a deploy applies the connection) to the
 * dot's css class + tooltip. Exercised on the prototype to avoid mounting the
 * whole editor.
 */
import {describe, it, expect} from 'vitest';
import '../src/feezal-app-editor.js';

const mqttDot = customElements.get('feezal-app-editor').prototype._mqttDot;

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
