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
        unsubscribe: vi.fn()
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
        expect(client.publish).toHaveBeenCalledWith('a/b', '42');
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
