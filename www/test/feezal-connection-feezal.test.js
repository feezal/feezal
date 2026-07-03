import {describe, it, expect, vi, beforeEach} from 'vitest';
import {io} from 'socket.io-client';

import '../src/feezal-connection-feezal.js';

vi.mock('socket.io-client', () => ({
    io: vi.fn()
}));

// Minimal fake Socket.IO client: records emit calls, lets tests fire
// server-sent events via fire().
function makeFakeSocket() {
    const handlers = {};
    return {
        on: (event, cb) => { (handlers[event] ??= []).push(cb); },
        fire: (event, ...args) => (handlers[event] || []).forEach(cb => cb(...args)),
        emit: vi.fn()
    };
}

let socket;

beforeEach(() => {
    socket = makeFakeSocket();
    io.mockReset();
    io.mockReturnValue(socket);
});

function makeConnected() {
    const el = document.createElement('feezal-connection-feezal');
    el.connect();
    return el;
}

describe('connect()', () => {
    it('opens a socket on the default socket.io path with reconnection', () => {
        makeConnected();
        expect(io).toHaveBeenCalledWith({path: '/socket.io', reconnection: true});
    });

    it('sets connected and dispatches "connected" on socket connect', () => {
        const el = makeConnected();
        const onConnected = vi.fn();
        el.addEventListener('connected', onConnected);

        socket.fire('connect');

        expect(el.connected).toBe(true);
        expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it('counts reconnects in the "connected" detail', () => {
        const el = makeConnected();
        const details = [];
        el.addEventListener('connected', e => details.push(e.detail.reconnect));

        socket.fire('connect');
        socket.fire('disconnect');
        socket.fire('connect');

        expect(details).toEqual([0, 1]);
    });

    it('dispatches "connected" neither bubbling nor composed (must not cross the wrapper shadow boundary)', () => {
        // Regression: a composed event escaped the feezal-connection wrapper's
        // shadow root and fired alongside the wrapper's own re-dispatch, so
        // every listener saw 'connected' twice → loadViews ran twice.
        const el = makeConnected();
        let event;
        el.addEventListener('connected', e => { event = e; });

        socket.fire('connect');

        expect(event.bubbles).toBe(false);
        expect(event.composed).toBe(false);
    });

    it('clears connected and dispatches "disconnected" on socket disconnect', () => {
        const el = makeConnected();
        const onDisconnected = vi.fn();
        el.addEventListener('disconnected', onDisconnected);

        socket.fire('connect');
        socket.fire('disconnect');

        expect(el.connected).toBe(false);
        expect(onDisconnected).toHaveBeenCalledTimes(1);
    });

    it('re-dispatches incoming "input" messages as "message" events', () => {
        const el = makeConnected();
        const onMessage = vi.fn();
        el.addEventListener('message', e => onMessage(e.detail));

        const message = {topic: 'home/temp', payload: '21.5', retain: true};
        socket.fire('input', message);

        expect(onMessage).toHaveBeenCalledWith(message);
    });

    it('feeds incoming topics into the server autocomplete trie', () => {
        makeConnected();
        socket.fire('input', {topic: 'home/temp', payload: '1'});
        expect(socket.emit).toHaveBeenCalledWith('topicSeen', 'home/temp');
    });

    it('does not emit topicSeen for messages without a topic', () => {
        makeConnected();
        socket.fire('input', {payload: 'x'});
        socket.fire('input', null);
        expect(socket.emit).not.toHaveBeenCalledWith('topicSeen', expect.anything());
    });

    it('logs but survives connect_error', () => {
        makeConnected();
        expect(() => socket.fire('connect_error', new Error('nope'))).not.toThrow();
    });
});

describe('socket command pass-through', () => {
    it('subscribe/unsubscribe/publish emit the matching socket events', () => {
        const el = makeConnected();
        el.subscribe(['a/#', 'b/+']);
        el.unsubscribe(['a/#']);
        el.publish({topic: 'a/b', payload: 'on'});
        expect(socket.emit).toHaveBeenCalledWith('subscribe', ['a/#', 'b/+']);
        expect(socket.emit).toHaveBeenCalledWith('unsubscribe', ['a/#']);
        expect(socket.emit).toHaveBeenCalledWith('send', {topic: 'a/b', payload: 'on'});
    });

    it('deploy and getSite forward the acknowledgement callback', () => {
        const el = makeConnected();
        const deployCb = () => {};
        const getSiteCb = () => {};
        el.deploy({site: 'demo'}, deployCb);
        el.getSite('demo', getSiteCb);
        expect(socket.emit).toHaveBeenCalledWith('deploy', {site: 'demo'}, deployCb);
        expect(socket.emit).toHaveBeenCalledWith('getSite', 'demo', getSiteCb);
    });
});
