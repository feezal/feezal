/**
 * E185 — the volume slider gate. Reported from a real broker log: dragging
 * published a command PER input event (17,16,15,…,11) and the bridge echoed a
 * status per command, delivered out of order (…14,13,11,12), which yanked the
 * knob around under the finger.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {VolumeGate, VOLUME_THROTTLE_MS} from '../packages/@feezal/feezal-controller-media/feezal-controller-media.js';

let sent;
const gate = (opts = {}) => new VolumeGate({publish: v => sent.push(v), ...opts});

beforeEach(() => { sent = []; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('VolumeGate — throttling the drag', () => {
    it('collapses a burst of drag values into one publish plus the final one', () => {
        const g = gate();
        // The reported drag: seven input events within a few milliseconds.
        [17, 16, 15, 14, 13, 12, 11].forEach(v => g.input(v, Date.now()));
        expect(sent).toEqual([17]);              // leading publish only
        vi.advanceTimersByTime(VOLUME_THROTTLE_MS + 10);
        expect(sent).toEqual([17, 11]);          // trailing flush keeps the LAST value
    });

    it('never loses the final value — commit always publishes', () => {
        const g = gate();
        g.input(40, Date.now());
        g.input(41, Date.now());
        g.commit(42, Date.now());
        expect(sent.at(-1)).toBe(42);
        vi.advanceTimersByTime(1000);
        expect(sent.at(-1)).toBe(42);            // the pending 41 was cancelled
    });

    it('a slow drag publishes each step (throttle only collapses bursts)', () => {
        const g = gate();
        let t = Date.now();
        g.input(10, t);
        t += VOLUME_THROTTLE_MS + 5;
        g.input(20, t);
        t += VOLUME_THROTTLE_MS + 5;
        g.input(30, t);
        expect(sent).toEqual([10, 20, 30]);
    });
});

describe('VolumeGate — suppressing echoes while dragging', () => {
    it('rejects device updates for the WHOLE drag, however long it lasts', () => {
        const g = gate({settleMs: 500});
        g.beginDrag();
        expect(g.accepts()).toBe(false);
        vi.advanceTimersByTime(60_000);          // a long, slow drag
        expect(g.accepts(Date.now() + 60_000)).toBe(false);
    });

    it('keeps rejecting for the settle window after release, then accepts again', () => {
        const now = Date.now();
        const g = gate({settleMs: 500});
        g.beginDrag();
        g.commit(20, now);
        g.endDrag(now);
        expect(g.accepts(now + 100)).toBe(false);   // stale echo of an earlier value
        expect(g.accepts(now + 600)).toBe(true);    // window closed — device wins again
    });

    it('settleMs 0 disables the hold once released (device value takes over at once)', () => {
        const now = Date.now();
        const g = gate({settleMs: 0});
        g.beginDrag();
        g.endDrag(now);
        expect(g.accepts(now)).toBe(true);
    });

    it('dispose() drops a pending publish and clears the drag lock', () => {
        const g = gate();
        g.input(10, Date.now());
        g.input(11, Date.now());
        g.beginDrag();
        g.dispose();
        vi.advanceTimersByTime(1000);
        expect(sent).toEqual([10]);              // the trailing 11 never fires
        expect(g.accepts(Date.now() + 10_000)).toBe(true);
    });
});
