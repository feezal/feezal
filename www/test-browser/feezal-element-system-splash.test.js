/**
 * Component tests for feezal-element-system-splash (E39) in a real browser.
 *
 * The splash times its overlay against `connected` / `message` events on
 * feezal.connection, so the test double is a real EventTarget (helpers'
 * fakeConnection is a plain object) with `emitConnected()` / `emitMessage()`
 * drivers plus the sub/pub surface the base class expects. Fake timers drive
 * the quiet window / fallback / spinner-delay / fade deterministically.
 *
 * The optional Lottie path is exercised through the shared loader's
 * `__setLottieFactoryForTests` seam, so lottie-web itself is never loaded.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '@feezal/feezal-element-system-splash';
import {__setLottieFactoryForTests} from '@feezal/feezal-lottie';
import {mount, until} from './helpers.js';

/** feezal.connection stand-in that is a real EventTarget. */
function eventConnection() {
    const target = new EventTarget();
    target.connected = false;
    target.sub = () => ({});
    target.unsubscribe = () => {};
    target.pub = () => {};
    target.subCount = () => 0;
    target.emitConnected = () => {
        target.connected = true;
        target.dispatchEvent(new CustomEvent('connected', {detail: {reconnect: 0}}));
    };
    target.emitMessage = (topic = 'dev/x', payload = '1') => {
        target.dispatchEvent(new CustomEvent('message', {detail: {topic, payload}}));
    };
    return target;
}

let conn;

function setup(overrides = {}) {
    conn = eventConnection();
    window.feezal = {
        isEditor: false,
        views: [],
        connection: conn,
        resolveAsset: p => (p ? 'resolved/' + p : ''),
        ...overrides,
    };
    document.body.innerHTML = '';
    return window.feezal;
}

const overlay = el => el.shadowRoot.querySelector('.overlay');

beforeEach(() => {
    setup();
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';   // disconnect releases the place-once claim
    __setLottieFactoryForTests(null);
});

describe('viewer overlay + settle window', () => {
    it('renders a full-screen overlay immediately in the viewer', async () => {
        const el = await mount('feezal-element-system-splash', {});
        const o = overlay(el);
        expect(o).not.toBeNull();
        expect(getComputedStyle(o).position).toBe('fixed');
    });

    it('hides after connect + a settle-window of MQTT quiet', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-system-splash', {
            'settle-window': '400', timeout: '30', 'spinner-delay': '30000',
        });
        expect(overlay(el)).not.toBeNull();

        conn.emitConnected();
        vi.advanceTimersByTime(399);
        await el.updateComplete;
        expect(overlay(el)).not.toBeNull();          // still within the quiet window
        expect(overlay(el).classList.contains('fading')).toBe(false);

        vi.advanceTimersByTime(2);                   // quiet window elapses → fade
        await el.updateComplete;
        expect(overlay(el).classList.contains('fading')).toBe(true);

        vi.advanceTimersByTime(250);                 // fade completes → removed
        await el.updateComplete;
        expect(overlay(el)).toBeNull();
        expect(el._done).toBe(true);
    });

    it('every message resets the quiet timer', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-system-splash', {
            'settle-window': '400', timeout: '30', 'spinner-delay': '30000',
        });
        conn.emitConnected();

        vi.advanceTimersByTime(300);
        conn.emitMessage();                          // reset — 300ms of silence discarded
        vi.advanceTimersByTime(300);
        await el.updateComplete;
        expect(overlay(el).classList.contains('fading')).toBe(false);   // only 300ms since reset

        vi.advanceTimersByTime(150);                 // now 450ms since the last message
        await el.updateComplete;
        expect(overlay(el).classList.contains('fading')).toBe(true);
    });
});

describe('backstops', () => {
    it('hard-cap timeout hides the splash even when the connection never comes up', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-system-splash', {
            'settle-window': '400', timeout: '1', 'spinner-delay': '30000',
        });
        // No emitConnected() at all.
        expect(overlay(el)).not.toBeNull();

        vi.advanceTimersByTime(1000);                // timeout (1s) from element connect
        await el.updateComplete;
        expect(overlay(el).classList.contains('fading')).toBe(true);

        vi.advanceTimersByTime(250);
        await el.updateComplete;
        expect(overlay(el)).toBeNull();
    });
});

describe('spinner', () => {
    it('appears only after spinner-delay', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-system-splash', {
            'settle-window': '400', timeout: '30', 'spinner-delay': '1000',
        });
        expect(el.shadowRoot.querySelector('.spinner')).toBeNull();

        vi.advanceTimersByTime(999);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.spinner')).toBeNull();

        vi.advanceTimersByTime(2);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.spinner')).not.toBeNull();
    });
});

describe('editor mode', () => {
    it('renders only the placeholder chip — no overlay, no timers', async () => {
        setup({isEditor: true});
        const el = await mount('feezal-element-system-splash', {});
        expect(el.shadowRoot.querySelector('.ph')).not.toBeNull();
        expect(overlay(el)).toBeNull();
        // A connect event must not arm anything in the editor.
        conn.emitConnected();
        await el.updateComplete;
        expect(overlay(el)).toBeNull();
    });
});

describe('place-once (multiple instances)', () => {
    it('the second instance no-ops and warns; the first keeps the overlay', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const a = await mount('feezal-element-system-splash', {});
        const b = await mount('feezal-element-system-splash', {});
        expect(overlay(a)).not.toBeNull();
        expect(overlay(b)).toBeNull();          // secondary renders nothing
        expect(b._secondary).toBe(true);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('lottie boot animation (shared loader)', () => {
    it('creates a Lottie animation instead of the spinner, via the shared loader', async () => {
        const created = [];
        const factory = {
            loadAnimation(opts) {
                const inst = {opts, destroyed: false, destroy() { this.destroyed = true; }};
                created.push(inst);
                return inst;
            },
        };
        __setLottieFactoryForTests(factory);

        const el = await mount('feezal-element-system-splash', {
            lottie: 'boot.json', 'spinner-delay': '20',
        });

        const inst = await until(() => created[0]);
        expect(inst.opts.path).toBe('resolved/boot.json');   // resolved via feezal.resolveAsset
        expect(inst.opts.renderer).toBe('svg');
        expect(el.shadowRoot.querySelector('.lottie-stage')).not.toBeNull();

        // Even past spinner-delay, the CSS spinner never shows when Lottie is set.
        await new Promise(r => setTimeout(r, 60));
        expect(el.shadowRoot.querySelector('.spinner')).toBeNull();

        // Disconnect destroys the animation instance.
        el.remove();
        await new Promise(r => setTimeout(r, 10));
        expect(inst.destroyed).toBe(true);
    });
});
