import {describe, it, expect, vi, beforeEach} from 'vitest';
import mqtt from 'mqtt';

import '../src/feezal-connection-mqtt.js';

vi.mock('mqtt', () => ({
    default: {connect: vi.fn()}
}));

// Minimal fake mqtt.js client: records pub/sub calls, lets tests fire events.
function makeFakeClient() {
    const handlers = {};
    return {
        on: (event, cb) => { (handlers[event] ??= []).push(cb); },
        emit: (event, ...args) => (handlers[event] || []).forEach(cb => cb(...args)),
        publish: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        end: vi.fn()
    };
}

function makeElement(config) {
    const el = document.createElement('feezal-connection-mqtt');
    el.config = config;
    return el;
}

let client;

beforeEach(() => {
    client = makeFakeClient();
    mqtt.connect.mockReset();
    mqtt.connect.mockReturnValue(client);
});

describe('connect()', () => {
    it('connects to the configured uri with a generated feezal- client id', () => {
        const el = makeElement({uri: 'ws://broker:9001'});
        el.connect();
        expect(mqtt.connect).toHaveBeenCalledTimes(1);
        const [uri, options] = mqtt.connect.mock.calls[0];
        expect(uri).toBe('ws://broker:9001');
        expect(options.clientId).toMatch(/^feezal-[0-9A-F]{8}$/);
        expect(options.will).toBeUndefined();
    });

    it('uses the configured client id verbatim', () => {
        const el = makeElement({uri: 'ws://broker:9001', clientId: 'my-client'});
        el.connect();
        expect(mqtt.connect.mock.calls[0][1].clientId).toBe('my-client');
    });

    it('sets a last-will only when both topic and payload are configured', () => {
        const el = makeElement({uri: 'ws://b', lwt: 'status/feezal', lwp: 'offline'});
        el.connect();
        expect(mqtt.connect.mock.calls[0][1].will).toEqual({
            topic: 'status/feezal', payload: 'offline', retain: false, qos: 0
        });

        const el2 = makeElement({uri: 'ws://b', lwt: 'status/feezal'});
        el2.connect();
        expect(mqtt.connect.mock.calls[1][1].will).toBeUndefined();
    });

    it('marks connected, publishes the online message and dispatches "connected"', () => {
        const el = makeElement({uri: 'ws://b', oct: 'status/feezal', ocp: 'online'});
        const connected = vi.fn();
        el.addEventListener('connected', connected);
        el.connect();

        client.emit('connect');

        expect(el.connected).toBe(true);
        expect(client.publish).toHaveBeenCalledWith('status/feezal', 'online');
        expect(connected).toHaveBeenCalledTimes(1);
    });

    it('marks disconnected and dispatches "disconnected" on close', () => {
        const el = makeElement({uri: 'ws://b'});
        const disconnected = vi.fn();
        el.addEventListener('disconnected', disconnected);
        el.connect();
        client.emit('connect');
        client.emit('close');
        expect(el.connected).toBe(false);
        expect(disconnected).toHaveBeenCalledTimes(1);
    });
});

describe('incoming messages', () => {
    function lastMessageDetail(el) {
        let detail;
        el.addEventListener('message', event => { detail = event.detail; });
        return () => detail;
    }

    it('parses JSON object payloads', () => {
        const el = makeElement({uri: 'ws://b'});
        const detail = lastMessageDetail(el);
        el.connect();
        client.emit('message', 'a/b', Buffer.from('{"val": 1}'));
        expect(detail()).toEqual({topic: 'a/b', payload: {val: 1}});
    });

    it('parses JSON array payloads', () => {
        const el = makeElement({uri: 'ws://b'});
        const detail = lastMessageDetail(el);
        el.connect();
        client.emit('message', 'a/b', Buffer.from('[1,2,3]'));
        expect(detail()).toEqual({topic: 'a/b', payload: [1, 2, 3]});
    });

    it('keeps plain string payloads as strings', () => {
        const el = makeElement({uri: 'ws://b'});
        const detail = lastMessageDetail(el);
        el.connect();
        client.emit('message', 'a/b', Buffer.from('21.5'));
        expect(detail()).toEqual({topic: 'a/b', payload: '21.5'});
    });

    it('falls back to the raw string for malformed JSON', () => {
        const el = makeElement({uri: 'ws://b'});
        const detail = lastMessageDetail(el);
        el.connect();
        client.emit('message', 'a/b', Buffer.from('{not json'));
        expect(detail()).toEqual({topic: 'a/b', payload: '{not json'});
    });
});

describe('publish / subscribe', () => {
    it('publish() stringifies the payload', () => {
        const el = makeElement({uri: 'ws://b'});
        el.connect();
        client.emit('connect');
        el.publish({topic: 'a/b', payload: 42});
        expect(client.publish).toHaveBeenCalledWith('a/b', '42', {retain: false});
    });

    // N24: presence status is a retained publish; the flag must reach mqtt.js.
    it('publish() forwards the retain flag', () => {
        const el = makeElement({uri: 'ws://b'});
        el.connect();
        client.emit('connect');
        el.publish({topic: 'a/b', payload: 'on', retain: true});
        expect(client.publish).toHaveBeenCalledWith('a/b', 'on', {retain: true});
    });

    it('publish() is blocked while disconnected or without a topic', () => {
        const el = makeElement({uri: 'ws://b'});
        el.connect();
        el.publish({topic: 'a/b', payload: 'x'});      // not connected yet
        client.emit('connect');
        el.publish({topic: '', payload: 'x'});         // no topic
        expect(client.publish).not.toHaveBeenCalled();
    });

    it('subscribe()/unsubscribe() skip falsy topics', () => {
        const el = makeElement({uri: 'ws://b'});
        el.connect();
        el.subscribe(['a/b', '', null]);
        el.unsubscribe(['a/b', undefined]);
        expect(client.subscribe).toHaveBeenCalledTimes(1);
        expect(client.subscribe).toHaveBeenCalledWith('a/b');
        expect(client.unsubscribe).toHaveBeenCalledTimes(1);
        expect(client.unsubscribe).toHaveBeenCalledWith('a/b');
    });
});

describe('MQTT protocol version (N9)', () => {
    it('defaults to 3.1.1 (protocolVersion 4)', () => {
        makeElement({uri: 'ws://b'}).connect();
        expect(mqtt.connect.mock.calls[0][1].protocolVersion).toBe(4);
    });

    it('passes protocolVersion 5 when configured (number or string)', () => {
        makeElement({uri: 'ws://b', protocolVersion: 5}).connect();
        makeElement({uri: 'ws://b', protocolVersion: '5'}).connect();
        expect(mqtt.connect.mock.calls[0][1].protocolVersion).toBe(5);
        expect(mqtt.connect.mock.calls[1][1].protocolVersion).toBe(5);
    });
});

describe('runtime credential prompt (N10 — static exports)', () => {
    const KEY = 'feezal-mqtt-credentials';
    const overlay = () => document.querySelector('#feezal-credential-prompt');

    beforeEach(() => {
        sessionStorage.clear(); // localStorage is cleared by the shared setup
    });

    function submitPrompt({username = '', password = '', remember = false, uri} = {}) {
        const form = overlay().querySelector('form');
        if (uri !== undefined) form.querySelector('[name=uri]').value = uri;
        form.querySelector('[name=username]').value = username;
        form.querySelector('[name=password]').value = password;
        form.querySelector('[name=remember]').checked = remember;
        form.dispatchEvent(new Event('submit', {cancelable: true}));
    }

    it('shows the prompt instead of connecting when nothing is stored', () => {
        const el = makeElement({uri: 'wss://broker:8884', credentialPrompt: true});
        el.connect();
        expect(mqtt.connect).not.toHaveBeenCalled();
        expect(overlay()).toBeTruthy();
        expect(overlay().querySelector('[name=uri]').value).toBe('wss://broker:8884');
    });

    it('submit stores the credentials in sessionStorage and connects with them', () => {
        const el = makeElement({uri: 'wss://broker:8884', credentialPrompt: true});
        el.connect();
        submitPrompt({username: 'alice', password: 's3cret'});
        expect(overlay()).toBeNull();
        expect(JSON.parse(sessionStorage.getItem(KEY))).toMatchObject({username: 'alice', password: 's3cret'});
        expect(localStorage.getItem(KEY)).toBeNull();
        const [uri, options] = mqtt.connect.mock.calls[0];
        expect(uri).toBe('wss://broker:8884');
        expect(options.username).toBe('alice');
        expect(options.password).toBe('s3cret');
    });

    it('the Remember checkbox persists to localStorage instead', () => {
        const el = makeElement({uri: 'wss://b', credentialPrompt: true});
        el.connect();
        submitPrompt({username: 'a', password: 'b', remember: true});
        expect(localStorage.getItem(KEY)).toBeTruthy();
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('an edited broker URL in the prompt wins over the baked one', () => {
        const el = makeElement({uri: 'wss://old', credentialPrompt: true});
        el.connect();
        submitPrompt({username: 'a', password: 'b', uri: 'wss://new:9001'});
        expect(mqtt.connect.mock.calls[0][0]).toBe('wss://new:9001');
    });

    it('uses stored credentials without prompting', () => {
        sessionStorage.setItem(KEY, JSON.stringify({uri: 'wss://stored', username: 'u', password: 'p'}));
        const el = makeElement({uri: 'wss://baked', credentialPrompt: true});
        el.connect();
        expect(overlay()).toBeNull();
        const [uri, options] = mqtt.connect.mock.calls[0];
        expect(uri).toBe('wss://stored');
        expect(options.username).toBe('u');
    });

    it('an authorization error clears stored credentials and re-prompts', () => {
        sessionStorage.setItem(KEY, JSON.stringify({username: 'u', password: 'wrong'}));
        const el = makeElement({uri: 'wss://b', credentialPrompt: true});
        el.connect();
        client.emit('error', Object.assign(new Error('Connection refused: Not authorized'), {code: 5}));
        expect(client.end).toHaveBeenCalledWith(true);
        expect(sessionStorage.getItem(KEY)).toBeNull();
        expect(overlay()).toBeTruthy();
        expect(overlay().querySelector('[data-role=error]')).toBeTruthy();
    });

    it('non-auth errors do not clear credentials or prompt', () => {
        sessionStorage.setItem(KEY, JSON.stringify({username: 'u', password: 'p'}));
        const el = makeElement({uri: 'wss://b', credentialPrompt: true});
        el.connect();
        client.emit('error', new Error('connack timeout'));
        expect(sessionStorage.getItem(KEY)).toBeTruthy();
        expect(overlay()).toBeNull();
    });

    it('without the credentialPrompt flag nothing changes', () => {
        const el = makeElement({uri: 'ws://plain'});
        el.connect();
        expect(overlay()).toBeNull();
        expect(mqtt.connect.mock.calls[0][1].username).toBeUndefined();
    });
});
