import {describe, it, expect, vi} from 'vitest';

import '../src/feezal-connection.js';

const FeezalConnection = customElements.get('feezal-connection');

// Create an instance without attaching it to the document, so
// connectedCallback (backend import, global queue flush) never runs and we
// exercise the pure subscription/fan-out logic only.
function makeConnection() {
    return document.createElement('feezal-connection');
}

describe('FeezalConnection.topicMatch', () => {
    const match = FeezalConnection.topicMatch;

    it('matches an exact topic and captures nothing', () => {
        expect(match('a/b/c', 'a/b/c')).toEqual([]);
    });

    it('matches everything with a bare # and captures the whole topic', () => {
        expect(match('a/b/c', '#')).toEqual(['a/b/c']);
    });

    it('captures a single level with +', () => {
        expect(match('home/kitchen/temp', 'home/+/temp')).toEqual(['kitchen']);
    });

    it('captures multiple + levels in order', () => {
        expect(match('home/kitchen/temp', '+/+/+')).toEqual(['home', 'kitchen', 'temp']);
    });

    it('captures the remainder with a trailing #', () => {
        expect(match('home/kitchen/temp/celsius', 'home/#')).toEqual(['kitchen/temp/celsius']);
    });

    it('rejects a mismatching literal level', () => {
        expect(match('home/kitchen/temp', 'home/bath/temp')).toBeNull();
    });

    it('rejects when the topic is longer than the wildcard', () => {
        expect(match('a/b/c', 'a/b')).toBeNull();
    });

    it('rejects when the topic is shorter than the wildcard', () => {
        expect(match('a/b', 'a/b/c')).toBeNull();
    });

    it('matches a trailing # even with no remaining levels', () => {
        expect(match('a/b', 'a/b/#')).toEqual([]);
    });

    it('+ does not span multiple levels', () => {
        expect(match('a/b/c', 'a/+')).toBeNull();
    });

    it('mixes + and # captures', () => {
        expect(match('home/kitchen/light/power', 'home/+/#')).toEqual(['kitchen', 'light/power']);
    });
});

describe('subscription bookkeeping', () => {
    it('sub() registers a subscription and returns it', () => {
        const el = makeConnection();
        const cb = () => {};
        const sub = el.sub('a/b', cb);
        expect(el.subscriptions).toHaveLength(1);
        expect(sub).toEqual({topic: 'a/b', options: {}, callback: cb});
    });

    it('sub() accepts the callback in the options position', () => {
        const el = makeConnection();
        const cb = () => {};
        const sub = el.sub('a/b', cb);
        expect(sub.callback).toBe(cb);
        expect(sub.options).toEqual({});
    });

    it('sub() ignores falsy topics', () => {
        const el = makeConnection();
        expect(el.sub('', () => {})).toBeUndefined();
        expect(el.sub(null, () => {})).toBeUndefined();
        expect(el.subscriptions).toHaveLength(0);
    });

    it('sub() forwards a new topic to the backend only when connected', () => {
        const el = makeConnection();
        el.conn = {subscribe: vi.fn(), unsubscribe: vi.fn()};

        el.connected = false;
        el.sub('a/b', () => {});
        expect(el.conn.subscribe).not.toHaveBeenCalled();

        el.connected = true;
        el.sub('c/d', () => {});
        expect(el.conn.subscribe).toHaveBeenCalledWith(['c/d']);
    });

    it('sub() does not re-subscribe an already-subscribed topic', () => {
        const el = makeConnection();
        el.conn = {subscribe: vi.fn(), unsubscribe: vi.fn()};
        el.connected = true;
        el.sub('a/b', () => {});
        el.sub('a/b', () => {});
        expect(el.conn.subscribe).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe() removes the subscription and unsubscribes the backend for the last one', () => {
        const el = makeConnection();
        el.conn = {subscribe: vi.fn(), unsubscribe: vi.fn()};
        el.connected = true;
        const s1 = el.sub('a/b', () => {});
        const s2 = el.sub('a/b', () => {});

        el.unsubscribe(s1);
        expect(el.subscriptions).toHaveLength(1);
        expect(el.conn.unsubscribe).not.toHaveBeenCalled();

        el.unsubscribe(s2);
        expect(el.subscriptions).toHaveLength(0);
        expect(el.conn.unsubscribe).toHaveBeenCalledWith(['a/b']);
    });

    it('unsubscribe() tolerates undefined', () => {
        const el = makeConnection();
        expect(() => el.unsubscribe(undefined)).not.toThrow();
    });
});

describe('message fan-out', () => {
    it('_spreadMessage() delivers only to matching subscriptions', () => {
        const el = makeConnection();
        const exact = vi.fn();
        const wildcard = vi.fn();
        const other = vi.fn();
        el.sub('home/kitchen/temp', exact);
        el.sub('home/#', wildcard);
        el.sub('office/+', other);

        const message = {topic: 'home/kitchen/temp', payload: 21.5};
        el._spreadMessage(message);

        expect(exact).toHaveBeenCalledWith(message);
        expect(wildcard).toHaveBeenCalledWith(message);
        expect(other).not.toHaveBeenCalled();
    });

    it('pub() with {local: true} loops back without a backend', () => {
        const el = makeConnection();
        const cb = vi.fn();
        el.sub('local/topic', cb);
        el.pub('local/topic', 'hello', {local: true});
        expect(cb).toHaveBeenCalledWith({topic: 'local/topic', payload: 'hello'});
    });

    it('pub() forwards to the backend when connected', () => {
        const el = makeConnection();
        el.conn = {publish: vi.fn()};
        el.connected = true;
        el.pub('a/b', 'on', {retain: true});
        expect(el.conn.publish).toHaveBeenCalledWith({topic: 'a/b', payload: 'on'}, {retain: true});
    });

    it('pub() is blocked while disconnected', () => {
        const el = makeConnection();
        el.conn = {publish: vi.fn()};
        el.connected = false;
        el.pub('a/b', 'on');
        expect(el.conn.publish).not.toHaveBeenCalled();
    });
});
