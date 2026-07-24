/**
 * E147 — AiedgeController (the shared meter-card behaviour): JSON-mode field
 * extraction, the generic separate-topic mode, error / timestamp / stale
 * handling, and the formatting helpers.
 */
import {describe, it, expect} from 'vitest';
import {
    AiedgeController, aiedgeAttributes, AIEDGE_CONSUMED_ATTRIBUTES,
    formatMeterValue, relativeTime,
} from '../packages/@feezal/feezal-controller-aiedge/feezal-controller-aiedge.js';

function fakeHost(attrs = {}) {
    const subs = [];
    return {
        getAttribute: n => (n in attrs ? attrs[n] : null),
        addController() {},
        addSubscription(topic, cb) { subs.push({topic, cb}); },
        // dot-path navigation from the message object (mirrors FeezalElement.getProperty)
        getProperty: (msg, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), msg),
        requestUpdate() {},
        _unsubscribe() { subs.length = 0; },
        deliver(topic, msg) { subs.filter(s => s.topic === topic).forEach(s => s.cb(msg)); },
    };
}

const T0 = Date.parse('2026-07-24T10:00:00Z');

describe('formatMeterValue / relativeTime', () => {
    it('rounds to decimals, passes non-numerics, handles empty', () => {
        expect(formatMeterValue('371.7657', '2')).toBe('371.77');
        expect(formatMeterValue('371.7657', '')).toBe('371.7657');
        expect(formatMeterValue(null, '2')).toBe(null);
        expect(formatMeterValue('', '2')).toBe(null);
    });
    it('renders compact relative ages', () => {
        expect(relativeTime(0, T0)).toBe('');
        expect(relativeTime(T0 - 10_000, T0)).toBe('just now');
        expect(relativeTime(T0 - 3 * 60_000, T0)).toBe('3 min ago');
        expect(relativeTime(T0 - 5 * 3_600_000, T0)).toBe('5 h ago');
        expect(relativeTime(T0 - 3 * 86_400_000, T0)).toBe('3 d ago');
    });
});

describe('AiedgeController — JSON mode', () => {
    const wire = (attrs, payload) => {
        const host = fakeHost(attrs);
        const c = new AiedgeController(host);
        c.wire();
        host.deliver(attrs['subscribe-json'], {payload});
        return c;
    };

    it('extracts value/rate/raw/error/timestamp from one json topic', () => {
        const c = wire({'subscribe-json': 'm/json'}, {
            value: '371.7657', raw: '00371.7657', pre: '00371.0000',
            error: 'no error', rate: '0.000020', timestamp: '2026-07-24T10:00:00Z',
        });
        expect(c.value).toBe('371.7657');
        expect(c.rate).toBe('0.000020');
        expect(c.raw).toBe('00371.7657');
        expect(c.error).toBe('');            // "no error" → not faulted
        expect(c.faulted).toBe(false);
        expect(c.timestamp).toBe(T0);
    });

    it('parses a stringified JSON payload', () => {
        const c = wire({'subscribe-json': 'm/json'}, '{"value":"5.5","error":"no error"}');
        expect(c.value).toBe('5.5');
    });

    it('surfaces a real error as a fault', () => {
        const c = wire({'subscribe-json': 'm/json'}, {value: '5', error: 'E90 no match'});
        expect(c.error).toBe('E90 no match');
        expect(c.faulted).toBe(true);
    });

    it('flags stale readings past stale-after and reports the age', () => {
        const host = fakeHost({'subscribe-json': 'm/json', 'stale-after': '60'});
        const c = new AiedgeController(host);
        c.wire();
        host.deliver('m/json', {payload: {value: '5', timestamp: '2026-07-24T10:00:00Z'}});
        c.__now = T0 + 120_000;              // 2 min later, threshold 60 s
        expect(c.stale).toBe(true);
        expect(c.age).toBe('2 min ago');
        c.__now = T0 + 30_000;               // 30 s later — within threshold
        expect(c.stale).toBe(false);
    });

    it('never warns stale when stale-after is 0', () => {
        const host = fakeHost({'subscribe-json': 'm/json', 'stale-after': '0'});
        const c = new AiedgeController(host);
        c.wire();
        host.deliver('m/json', {payload: {value: '5', timestamp: '2026-07-24T10:00:00Z'}});
        c.__now = T0 + 999_000;
        expect(c.stale).toBe(false);
    });
});

describe('AiedgeController — separate (generic) mode + status', () => {
    it('reads a plain value and rate from separate topics', () => {
        const host = fakeHost({'subscribe-value': 'm/v', 'subscribe-rate': 'm/r'});
        const c = new AiedgeController(host);
        c.wire();
        host.deliver('m/v', {payload: '42.0'});
        host.deliver('m/r', {payload: '0.5'});
        expect(c.value).toBe('42.0');
        expect(c.rate).toBe('0.5');
    });

    it('reads the status/action line', () => {
        const host = fakeHost({'subscribe-value': 'm/v', 'subscribe-status': 'm/status'});
        const c = new AiedgeController(host);
        c.wire();
        host.deliver('m/status', {payload: 'digitizing'});
        expect(c.status).toBe('digitizing');
    });
});

describe('E137 packaging', () => {
    it('the consumed-attribute set is derived and non-trivial', () => {
        expect(AIEDGE_CONSUMED_ATTRIBUTES).toEqual(aiedgeAttributes.map(a => a.name));
        expect(AIEDGE_CONSUMED_ATTRIBUTES).toContain('subscribe-json');
        expect(AIEDGE_CONSUMED_ATTRIBUTES).toContain('subscribe-status');
        expect(AIEDGE_CONSUMED_ATTRIBUTES.length).toBeGreaterThan(10);
    });
});
