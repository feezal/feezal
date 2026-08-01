/**
 * E137/E143/E154 — the lock controller's contract, unit-level (the family lock
 * cards drive it end-to-end in the browser suites): state parsing incl. the
 * z2m JSON {state} coercion, the lock/unlock/OPEN commands, the E135 fault
 * signal's OK-vocabulary, the E124 battery contract, the E154 transitional
 * movement state and the rewire signature.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {
    LockController, lockAttributes, LOCK_CONSUMED_ATTRIBUTES,
} from '../packages/@feezal/feezal-controller-lock/feezal-controller-lock.js';

function makeHost(attrs = {}) {
    const subs = new Map();   // topic → cb
    return {
        attrs: {...attrs},
        subs,
        getAttribute(name) { return this.attrs[name] ?? null; },
        addController() {},
        requestUpdate() {},
        addSubscription(topic, cb) { subs.set(topic, cb); },
        _unsubscribe() { subs.clear(); },
        getProperty(msg, prop) {
            if (!prop || prop === 'payload') return msg.payload;
            let res = msg;
            for (const p of String(prop).split('.')) res = res?.[p];
            return res;
        },
    };
}

let published;
beforeEach(() => {
    published = [];
    window.feezal = {isEditor: false, connection: {pub: (t, p) => published.push([t, p])}};
    vi.useFakeTimers();
    return () => vi.useRealTimers();
});

const mount = attrs => {
    const host = makeHost(attrs);
    const lock = new LockController(host);
    lock.wire();
    return {host, lock};
};

describe('state parsing', () => {
    it('maps the three payloads (case-insensitive) and unknowns to null', () => {
        const {host, lock} = mount({subscribe: 'lock/state'});
        const feed = p => host.subs.get('lock/state')({payload: p});
        feed('LOCKED');   expect(lock.state).toBe('locked');
        expect(lock.locked && !lock.unlocked && !lock.jammed).toBe(true);
        feed('unlocked'); expect(lock.unlocked).toBe(true);
        feed('JAMMED');   expect(lock.jammed).toBe(true);
        expect(lock.faulted).toBe(true);   // jammed counts as faulted
        feed('garbage');  expect(lock.state).toBe(null);
    });

    it('honours custom state payloads', () => {
        const {host, lock} = mount({subscribe: 't', 'payload-locked': 'zu', 'payload-unlocked': 'auf'});
        host.subs.get('t')({payload: 'ZU'});
        expect(lock.locked).toBe(true);
        host.subs.get('t')({payload: 'auf'});
        expect(lock.unlocked).toBe(true);
    });

    it('coerces the z2m JSON {state} shape — object and string form', () => {
        const {host, lock} = mount({subscribe: 't'});
        host.subs.get('t')({payload: {state: 'LOCKED'}});
        expect(lock.locked).toBe(true);
        host.subs.get('t')({payload: '{"state":"UNLOCKED"}'});
        expect(lock.unlocked).toBe(true);
    });
});

describe('commands (incl. the Homematic OPEN action)', () => {
    it('lock/unlock publish their payloads to the command topic', () => {
        const {lock} = mount({publish: 'lock/set'});
        lock.lock();
        lock.unlock();
        expect(published).toEqual([['lock/set', 'LOCK'], ['lock/set', 'UNLOCK']]);
    });

    it('open() prefers the separate open topic; falls back to the main topic', () => {
        const {lock} = mount({'publish': 'lock/set', 'publish-open': 'lock/open', 'payload-open': 'OPEN_NOW'});
        lock.open();
        expect(published).toEqual([['lock/open', 'OPEN_NOW']]);

        const {lock: l2} = mount({publish: 'lock/set', 'payload-open': 'OPEN'});
        l2.open();
        expect(published[1]).toEqual(['lock/set', 'OPEN']);
    });

    it('canOpen only with an open payload or topic configured', () => {
        expect(mount({}).lock.canOpen).toBe(false);
        expect(mount({'payload-open': 'OPEN'}).lock.canOpen).toBe(true);
        expect(mount({'publish-open': 'lock/open'}).lock.canOpen).toBe(true);
    });

    it('no command topic → nothing published (never throws)', () => {
        const {lock} = mount({});
        lock.lock();
        expect(published).toEqual([]);
    });
});

describe('E154 — transitional movement state', () => {
    it('a command enters the transitional state; the expected report ends it', () => {
        const {host, lock} = mount({subscribe: 'lock/state', publish: 'lock/set'});
        lock.lock();
        expect(lock.moving).toBe(true);
        expect(lock.movement).toBe('locking');
        expect(lock.movementText).toBe('locking…');
        host.subs.get('lock/state')({payload: 'LOCKED'});
        expect(lock.moving).toBe(false);
    });

    it('the movement timeout resolves a stuck transitional state', () => {
        const {lock} = mount({'publish': 'lock/set', 'movement-timeout': '5'});
        lock.unlock();
        expect(lock.movement).toBe('unlocking');
        vi.advanceTimersByTime(5100);
        expect(lock.moving).toBe(false);
    });

    it('a wired DIRECTION topic drives movement, incl. the enum indices, and a jam aborts it', () => {
        const {host, lock} = mount({subscribe: 'lock/state', 'subscribe-direction': 'lock/dir'});
        const dir = v => host.subs.get('lock/dir')({payload: {val: v}});
        dir('UP');   expect(lock.movement).toBe('unlocking');
        // The hint names the intent only when none is active — a direction
        // change without an idle report in between keeps the first intent.
        dir('DOWN'); expect(lock.movement).toBe('unlocking');
        dir('NONE'); expect(lock.moving).toBe(false);
        dir(2);      expect(lock.movement).toBe('locking');    // Homematic enum index (2 = DOWN)
        dir('NONE');
        dir('UP');
        host.subs.get('lock/state')({payload: 'JAMMED'});      // jam = movement over, failed
        expect(lock.moving).toBe(false);
    });
});

describe('E135 fault + E124 battery', () => {
    it('non-OK error values surface as text; the OK vocabulary clears it', () => {
        const {host, lock} = mount({'subscribe-error': 'lock/error'});
        const err = p => host.subs.get('lock/error')({payload: p});
        err('MOTOR_ABORTED');
        expect(lock.error).toBe('MOTOR_ABORTED');
        expect(lock.faulted).toBe(true);
        for (const ok of ['NO ERROR', 'none', '0', 'false', '']) {
            err(ok);
            expect(lock.error, `"${ok}" should read as no fault`).toBe('');
        }
    });

    it('battery-low: boolean payload and numeric threshold forms', () => {
        const {host, lock} = mount({'subscribe-battery-low': 'lock/batt'});
        host.subs.get('lock/batt')({payload: 'true'});
        expect(lock.batteryLow).toBe(true);
        const {host: h2, lock: l2} = mount({'subscribe-battery-low': 'b', 'battery-low-threshold': '20'});
        h2.subs.get('b')({payload: 12});
        expect(l2.batteryLow).toBe(true);
        h2.subs.get('b')({payload: 80});
        expect(l2.batteryLow).toBe(false);
    });
});

describe('rewire + contract', () => {
    it('rewireIfChanged rewires only when a wired attribute changed', () => {
        const {host, lock} = mount({subscribe: 'a'});
        lock.rewireIfChanged();
        expect([...host.subs.keys()]).toEqual(['a']);
        host.attrs.subscribe = 'b';
        lock.rewireIfChanged();
        expect([...host.subs.keys()]).toEqual(['b']);
    });

    it('the consumed-attribute list mirrors the fragment (E114 parity source)', () => {
        expect(LOCK_CONSUMED_ATTRIBUTES).toEqual(lockAttributes.map(a => a.name));
        expect(LOCK_CONSUMED_ATTRIBUTES).toContain('payload-open');
        expect(LOCK_CONSUMED_ATTRIBUTES).toContain('subscribe-direction');
    });
});
