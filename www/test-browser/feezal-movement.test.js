/**
 * E128 / E154 — movement indication.
 *
 * E128 (covers): E127's numeric SettlingController applied to the blind
 * position/tilt (hold-at-target, WORKING gating, LEVEL_NOTWORKING) plus the
 * `DIRECTION` travel indicator, all inside `CoverController` so every cover
 * family gets it at once.
 *
 * E154 (locks): the DISCRETE-state analog — a transitional locking / unlocking
 * / opening state held between the command and the device's confirmation,
 * driven by the shared `MovementController`.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setupFeezal, mount, until} from './helpers.js';
import {parseDirection, MovementController} from '@feezal/feezal-element/feezal-movement.js';
import '../packages/@feezal/feezal-element-circle-cover/feezal-element-circle-cover.js';
import '../packages/@feezal/feezal-element-glass-cover/feezal-element-glass-cover.js';
import '../packages/@feezal/feezal-element-metro-cover/feezal-element-metro-cover.js';
import '../packages/@feezal/feezal-element-eink-cover/feezal-element-eink-cover.js';
import '../packages/@feezal/feezal-element-circle-lock/feezal-element-circle-lock.js';
import '../packages/@feezal/feezal-element-glass-lock/feezal-element-glass-lock.js';
import '../packages/@feezal/feezal-element-metro-lock/feezal-element-metro-lock.js';

const COVERS = [
    'feezal-element-circle-cover',
    'feezal-element-glass-cover',
    'feezal-element-metro-cover',
    'feezal-element-eink-cover',
];
const LOCKS = [
    'feezal-element-circle-lock',
    'feezal-element-glass-lock',
    'feezal-element-metro-lock',
];

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

// ── The shared value reading ────────────────────────────────────────────────
describe('parseDirection() — the Homematic DIRECTION contract', () => {
    it('reads the enum option names', () => {
        expect(parseDirection('UP')).toBe('up');
        expect(parseDirection('DOWN')).toBe('down');
        expect(parseDirection('NONE')).toBe('');
        expect(parseDirection('UNDEFINED')).toBe('');
    });

    it('reads the enum device values (0 NONE / 1 UP / 2 DOWN / 3 UNDEFINED)', () => {
        expect(parseDirection(1)).toBe('up');
        expect(parseDirection(2)).toBe('down');
        expect(parseDirection(0)).toBe('');
        expect(parseDirection(3)).toBe('');
    });

    it('honours configured payloads and is case-insensitive', () => {
        expect(parseDirection('opening', 'OPENING', 'CLOSING')).toBe('up');
        expect(parseDirection('Closing', 'OPENING', 'CLOSING')).toBe('down');
    });

    it('reads absent / empty / false as idle', () => {
        for (const v of [null, undefined, '', false, '  ', 'garbage']) {
            expect(parseDirection(v), String(v)).toBe('');
        }
    });
});

// ── E128 — cover settling + direction ───────────────────────────────────────
describe('E128 — cover ramp settling', () => {
    const wire = (extra = {}) => mount('feezal-element-circle-cover', {
        'payload-mode': 'separate',
        'subscribe-position': 'hm/status/blind/LEVEL',
        'publish-position': 'hm/set/blind/LEVEL',
        'message-property-position': 'payload',
        min: '0', max: '100',
        ...extra,
    });

    it('holds the slider at the commanded target while intermediate reports stream in', async () => {
        const el = await wire();
        feezal.connection.deliver('hm/status/blind/LEVEL', '0');
        await el.updateComplete;
        expect(el.cover.position).toBe(0);

        el.cover.setPosition(80);
        expect(el.cover.position).toBe(80);
        // The blind travels: 0 → 80 is reported step by step.
        for (const v of ['12', '31', '55', '73']) feezal.connection.deliver('hm/status/blind/LEVEL', v);
        expect(el.cover.position).toBe(80);          // never jumped to a mid-travel value

        feezal.connection.deliver('hm/status/blind/LEVEL', '80');
        expect(el.cover.position).toBe(80);          // target reached → settled
        feezal.connection.deliver('hm/status/blind/LEVEL', '42');
        expect(el.cover.position).toBe(42);          // reports flow again
    });

    it('WORKING suppresses reports from a change made elsewhere and applies the final one', async () => {
        const el = await wire({
            'subscribe-working': 'hm/status/blind/WORKING',
            'message-property-working': 'payload',
            'report-delay-ms': '0',
        });
        feezal.connection.deliver('hm/status/blind/LEVEL', '10');
        expect(el.cover.position).toBe(10);

        feezal.connection.deliver('hm/status/blind/WORKING', 'true');
        for (const v of ['30', '55', '70']) feezal.connection.deliver('hm/status/blind/LEVEL', v);
        expect(el.cover.position).toBe(10);          // travel swallowed

        feezal.connection.deliver('hm/status/blind/LEVEL', '90');
        feezal.connection.deliver('hm/status/blind/WORKING', 'false');
        expect(el.cover.position).toBe(90);          // settled on the last report
    });

    it('a settled-values topic takes over the slider; the live topic stops driving it', async () => {
        const el = await wire({
            'subscribe-settled': 'hm/status/blind/LEVEL_NOTWORKING',
            'message-property-settled': 'payload',
        });
        feezal.connection.deliver('hm/status/blind/LEVEL', '35');
        expect(el.cover.position).toBeNull();        // live topic no longer applies

        feezal.connection.deliver('hm/status/blind/LEVEL_NOTWORKING', '35');
        expect(el.cover.position).toBe(35);
    });

    it('STOP abandons the hold so the halted position shows immediately', async () => {
        const el = await wire();
        feezal.connection.deliver('hm/status/blind/LEVEL', '0');
        el.cover.setPosition(100);
        feezal.connection.deliver('hm/status/blind/LEVEL', '20');
        expect(el.cover.position).toBe(100);         // still holding at the target

        el.cover.stop();
        feezal.connection.deliver('hm/status/blind/LEVEL', '37');
        expect(el.cover.position).toBe(37);          // the blind halted here
    });

    it('reconciles to the last report when the target is never echoed (timeout)', async () => {
        vi.useFakeTimers();
        try {
            const el = await wire({'settle-timeout': '1'});
            feezal.connection.deliver('hm/status/blind/LEVEL', '0');
            el.cover.setPosition(90);
            feezal.connection.deliver('hm/status/blind/LEVEL', '64');   // device clamped
            expect(el.cover.position).toBe(90);
            vi.advanceTimersByTime(1100);
            expect(el.cover.position).toBe(64);
        } finally {
            vi.useRealTimers();
        }
    });

    it('scales the Homematic 0…1 LEVEL range through the settler', async () => {
        const el = await wire({max: '1'});
        feezal.connection.deliver('hm/status/blind/LEVEL', '0.25');
        expect(el.cover.position).toBe(25);
    });

    it('the tilt slider settles on its own target', async () => {
        const el = await wire({
            'slat-angle': 'hm/status/blind/LEVEL_2',
            'publish-slat-angle': 'hm/set/blind/LEVEL_2',
            'message-property-tilt': 'payload',
        });
        feezal.connection.deliver('hm/status/blind/LEVEL_2', '0');
        el.cover.setTilt(70);
        feezal.connection.deliver('hm/status/blind/LEVEL_2', '25');
        expect(el.cover.tilt).toBe(70);              // held at the target
        feezal.connection.deliver('hm/status/blind/LEVEL_2', '70');
        expect(el.cover.tilt).toBe(70);
    });

    it('leaves the json (z2m/HA) path untouched — reports apply immediately', async () => {
        const el = await mount('feezal-element-circle-cover', {
            'payload-mode': 'json', subscribe: 'z2m/blind', publish: 'z2m/blind/set',
        });
        el.cover.setPosition(80);
        feezal.connection.deliver('z2m/blind', {position: 30});
        await el.updateComplete;
        expect(el.cover.position).toBe(30);
    });
});

describe('E128 — cover travel-direction indicator', () => {
    for (const tag of COVERS) {
        it(`${tag} shows the indicator only while the direction topic reports travel`, async () => {
            const el = await mount(tag, {
                'payload-mode': 'separate',
                'subscribe-position': 'hm/status/blind/LEVEL',
                'subscribe-direction': 'hm/status/blind/DIRECTION',
                'message-property-direction': 'payload',
            });
            const badge = () => el.renderRoot.querySelector('.feezal-move-badge, .badge-tl');
            expect(badge()).toBeNull();

            feezal.connection.deliver('hm/status/blind/DIRECTION', 'UP');
            await el.updateComplete;
            expect(el.cover.direction).toBe('up');
            expect(el.cover.moving).toBe(true);
            expect(badge(), `${tag}: no indicator while travelling`).toBeTruthy();

            feezal.connection.deliver('hm/status/blind/DIRECTION', 'NONE');
            await el.updateComplete;
            expect(el.cover.direction).toBe('');
            expect(badge()).toBeNull();
        });
    }

    it('an unwired direction topic never shows the indicator', async () => {
        const el = await mount('feezal-element-glass-cover', {
            'payload-mode': 'separate', 'subscribe-position': 'hm/status/blind/LEVEL',
        });
        feezal.connection.deliver('hm/status/blind/LEVEL', '50');
        await el.updateComplete;
        expect(el.cover.direction).toBe('');
        expect(el.renderRoot.querySelector('.feezal-move-badge')).toBeNull();
    });

    it('every cover family declares the full E128 contract (parity)', () => {
        const expected = ['subscribe-working', 'message-property-working', 'subscribe-settled',
            'message-property-settled', 'settle-timeout', 'report-delay-ms',
            'subscribe-direction', 'message-property-direction',
            'payload-direction-up', 'payload-direction-down'];
        for (const tag of COVERS) {
            const names = customElements.get(tag).feezal.attributes.map(a => a.name || a);
            for (const n of expected) expect(names, `${tag} missing ${n}`).toContain(n);
        }
    });
});

// ── E154 — lock movement ────────────────────────────────────────────────────
describe('E154 — MovementController (the discrete-state settling analog)', () => {
    it('a command enters the transitional state and the expected report ends it', () => {
        const m = new MovementController({timeoutMs: 5000});
        expect(m.moving).toBe(false);
        m.command('locking', 'locked');
        expect(m.intent).toBe('locking');
        m.report('unlocked');        // an echo of the OLD state must not cut it short
        expect(m.moving).toBe(true);
        m.report('locked');
        expect(m.moving).toBe(false);
    });

    it('with a movement signal wired, the signal — not the state report — ends it', () => {
        const m = new MovementController({timeoutMs: 5000, signalWired: true});
        m.command('locking', 'locked');
        m.report('locked');
        expect(m.moving).toBe(true);      // the motor is still turning
        m.signal(false);
        expect(m.moving).toBe(false);
    });

    it('movement started elsewhere enters the state with the signal hint', () => {
        const m = new MovementController({timeoutMs: 5000, signalWired: true});
        m.signal(true, 'unlocking');
        expect(m.intent).toBe('unlocking');
        m.signal(false);
        expect(m.intent).toBe('');
    });

    it('always resolves on the timeout', () => {
        vi.useFakeTimers();
        try {
            const m = new MovementController({timeoutMs: 1000});
            m.command('opening', 'unlocked');
            expect(m.moving).toBe(true);
            vi.advanceTimersByTime(1100);
            expect(m.moving).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('notifies on entering and leaving, not on every repeat', () => {
        const onChange = vi.fn();
        const m = new MovementController({onChange, timeoutMs: 5000, signalWired: true});
        m.signal(true, 'locking');
        m.signal(true, 'locking');
        m.signal(true, 'locking');
        expect(onChange).toHaveBeenCalledTimes(1);
        m.signal(false);
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});

describe('E154 — lock cards show the movement', () => {
    for (const tag of LOCKS) {
        it(`${tag} holds a transitional state from the command until STATE confirms`, async () => {
            const el = await mount(tag, {
                subscribe: 'hm/status/key/STATE', publish: 'hm/set/key/STATE',
                'payload-locked': 'false', 'payload-unlocked': 'true',
                'payload-lock': 'false', 'payload-unlock': 'true',
            });
            feezal.connection.deliver('hm/status/key/STATE', 'false');
            await el.updateComplete;
            expect(el.lock.state).toBe('locked');
            expect(el.lock.moving).toBe(false);

            el.lock.unlock();
            await el.updateComplete;
            expect(el.lock.movement).toBe('unlocking');
            expect(el.renderRoot.textContent).toContain('unlocking');

            feezal.connection.deliver('hm/status/key/STATE', 'true');
            await el.updateComplete;
            expect(el.lock.moving).toBe(false);
            expect(el.lock.state).toBe('unlocked');
        });

        it(`${tag} follows the DIRECTION datapoint for movement started elsewhere`, async () => {
            const el = await mount(tag, {
                subscribe: 'hm/status/key/STATE',
                'subscribe-direction': 'hm/status/key/DIRECTION',
                'message-property-direction': 'payload',
            });
            expect(el.lock.moving).toBe(false);

            feezal.connection.deliver('hm/status/key/DIRECTION', 'DOWN');   // → locking
            await el.updateComplete;
            expect(el.lock.movement).toBe('locking');
            expect(el.renderRoot.querySelector('.feezal-moving')).toBeTruthy();

            feezal.connection.deliver('hm/status/key/DIRECTION', 'NONE');
            await el.updateComplete;
            expect(el.lock.moving).toBe(false);
            expect(el.renderRoot.querySelector('.feezal-moving')).toBeNull();
        });

        it(`${tag} drops the transitional state when the lock jams`, async () => {
            const el = await mount(tag, {
                subscribe: 'stat/lock', publish: 'cmd/lock',
                'subscribe-direction': 'stat/dir', 'message-property-direction': 'payload',
            });
            el.lock.lock();
            await el.updateComplete;
            expect(el.lock.moving).toBe(true);

            feezal.connection.deliver('stat/lock', 'JAMMED');
            await el.updateComplete;
            expect(el.lock.moving).toBe(false);
            expect(el.lock.jammed).toBe(true);
        });

        it(`${tag} stays idle when no movement signal is wired and nothing was commanded`, async () => {
            const el = await mount(tag, {subscribe: 'stat/lock'});
            feezal.connection.deliver('stat/lock', 'UNLOCKED');
            await el.updateComplete;
            expect(el.lock.moving).toBe(false);
            expect(el.renderRoot.querySelector('.feezal-moving')).toBeNull();
        });
    }

    it('the swapped direction mapping is one attribute', async () => {
        const el = await mount('feezal-element-glass-lock', {
            subscribe: 'stat/lock',
            'subscribe-direction': 'stat/dir', 'message-property-direction': 'payload',
            'payload-direction-lock': 'UP', 'payload-direction-unlock': 'DOWN',
        });
        feezal.connection.deliver('stat/dir', 'UP');
        await el.updateComplete;
        expect(el.lock.movement).toBe('locking');
    });

    it('a plain boolean motor flag reads as movement of unknown intent', async () => {
        const el = await mount('feezal-element-glass-lock', {
            subscribe: 'stat/lock',
            'subscribe-direction': 'stat/working', 'message-property-direction': 'payload',
        });
        feezal.connection.deliver('stat/working', 'true');
        await el.updateComplete;
        expect(el.lock.movement).toBe('moving');
        feezal.connection.deliver('stat/working', 'false');
        await el.updateComplete;
        expect(el.lock.moving).toBe(false);
    });

    it('the transitional state resolves on the movement timeout', async () => {
        const el = await mount('feezal-element-metro-lock', {
            subscribe: 'stat/lock', publish: 'cmd/lock', 'movement-timeout': '1',
        });
        el.lock.lock();
        expect(el.lock.moving).toBe(true);
        await until(() => el.lock.moving === false, {timeout: 3000});
        expect(el.lock.moving).toBe(false);
    });

    it('every lock family declares the full E154 contract (parity)', () => {
        const expected = ['subscribe-direction', 'message-property-direction',
            'payload-direction-lock', 'payload-direction-unlock', 'movement-timeout'];
        for (const tag of LOCKS) {
            const names = customElements.get(tag).feezal.attributes.map(a => a.name || a);
            for (const n of expected) expect(names, `${tag} missing ${n}`).toContain(n);
        }
    });
});
