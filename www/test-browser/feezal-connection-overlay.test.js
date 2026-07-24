/**
 * U60 — editor connection-lost overlay: grace-period banner → blocking modal →
 * auto-clear + reconnected toast, driven by `feezal.connection` events.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {FeezalConnectionOverlay} from '../src/feezal-connection-overlay.js';
import {until} from './helpers.js';

// Shrink the timers so the escalation is testable without long waits.
const REAL_GRACE = FeezalConnectionOverlay.GRACE_MS;
const REAL_TOAST = FeezalConnectionOverlay.TOAST_MS;

async function mountOverlay(conn) {
    const el = document.createElement('feezal-connection-overlay');
    el.connection = conn;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('feezal-connection-overlay (U60)', () => {
    let conn;
    beforeEach(() => {
        FeezalConnectionOverlay.GRACE_MS = 40;
        FeezalConnectionOverlay.TOAST_MS = 40;
        conn = new EventTarget();           // stands in for feezal.connection
        document.body.innerHTML = '';
    });
    afterEach(() => {
        FeezalConnectionOverlay.GRACE_MS = REAL_GRACE;
        FeezalConnectionOverlay.TOAST_MS = REAL_TOAST;
    });

    const q = (el, sel) => el.shadowRoot.querySelector(sel);

    it('renders nothing while connected', async () => {
        const el = await mountOverlay(conn);
        expect(el.shadowRoot.textContent.trim()).toBe('');
    });

    it('shows a subtle banner immediately on disconnect, no modal yet', async () => {
        const el = await mountOverlay(conn);
        conn.dispatchEvent(new Event('disconnected'));
        await el.updateComplete;
        expect(q(el, '.banner')).toBeTruthy();
        expect(q(el, '.backdrop')).toBeNull();   // grace period — not blocking yet
        expect(el._state).toBe('grace');
    });

    it('escalates to a blocking modal (Retry + Reload) after the grace period', async () => {
        const el = await mountOverlay(conn);
        conn.dispatchEvent(new Event('disconnected'));
        await until(() => q(el, '.backdrop'));
        expect(el._state).toBe('lost');
        const buttons = [...el.shadowRoot.querySelectorAll('.actions button')].map(b => b.textContent.trim());
        expect(buttons).toEqual(['Retry now', 'Reload app']);
        // Modal has no close affordance (non-dismissable).
        expect(el.shadowRoot.querySelector('.modal [aria-label="Close"], .modal .close')).toBeNull();
        // Retry is guarded (no real socket) and must not throw.
        expect(() => q(el, '.actions button.primary').click()).not.toThrow();
    });

    it('auto-clears and flashes a reconnected toast on reconnect', async () => {
        const el = await mountOverlay(conn);
        conn.dispatchEvent(new Event('disconnected'));
        await until(() => q(el, '.backdrop'));            // escalated
        conn.dispatchEvent(new Event('connected'));
        await el.updateComplete;
        expect(el._state).toBe('ok');
        expect(q(el, '.backdrop')).toBeNull();            // overlay torn down
        expect(q(el, '.toast')).toBeTruthy();             // brief success toast
        await until(() => !q(el, '.toast'));              // toast auto-dismisses
    });

    it('a transient blip that recovers within the grace period never blocks', async () => {
        const el = await mountOverlay(conn);
        conn.dispatchEvent(new Event('disconnected'));
        await el.updateComplete;
        expect(el._state).toBe('grace');
        conn.dispatchEvent(new Event('connected'));       // recovered before GRACE_MS
        await el.updateComplete;
        expect(el._state).toBe('ok');
        // Give the (now-cleared) grace timer a chance to have fired — it must not.
        await new Promise(r => setTimeout(r, 60));
        expect(el._state).toBe('ok');
        expect(q(el, '.backdrop')).toBeNull();
    });
});
