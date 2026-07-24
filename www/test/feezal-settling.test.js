import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import {SettlingController} from '../packages/@feezal/feezal-element/feezal-settling.js';

// E127 — settling suppression for ramping actuators (Homematic dimmers).

describe('SettlingController', () => {
    let applied;
    const apply = v => applied.push(v);

    beforeEach(() => {
        applied = [];
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('idle (nothing wired)', () => {
        it('applies live reports directly', () => {
            const s = new SettlingController({apply});
            s.live(0.5);
            expect(applied).toEqual([0.5]);
        });
    });

    describe('hold-at-target after own command', () => {
        it('swallows intermediate ramp reports and settles on the target value', () => {
            const s = new SettlingController({apply});
            s.command(0);                    // user sets 0 while dimmer is at 1
            s.live(0.95);                    // Homematic echoes the ramp
            s.live(0.5);
            expect(applied).toEqual([]);     // no jumping
            s.live(0);                       // target reached
            expect(applied).toEqual([0]);
            s.live(0.7);                     // hold is over — normal report applies
            expect(applied).toEqual([0, 0.7]);
        });

        it('reconciles to the last report on settle-timeout (interrupted ramp)', () => {
            const s = new SettlingController({apply, timeoutMs: 5000});
            s.command(0);
            s.live(0.6);
            s.live(0.4);                     // ramp stops short (device clamped)
            vi.advanceTimersByTime(5000);
            expect(applied).toEqual([0.4]);
        });

        it('sentinel targets (1.005 OLD_LEVEL) settle via WORKING=false', () => {
            const s = new SettlingController({apply, workingWired: true});
            s.command(1.005);                // device never echoes 1.005
            s.working(true);
            s.live(0.3);
            s.live(0.7);                     // restored OLD_LEVEL
            expect(applied).toEqual([]);
            s.working(false);
            expect(applied).toEqual([0.7]);  // settled on the final value
        });
    });

    describe('WORKING-driven suppression of external ramps', () => {
        it('buffers idle reports and cancels them when WORKING=true arrives late', () => {
            const s = new SettlingController({apply, workingWired: true, reportDelayMs: 100});
            s.live(0.95);                    // first intermediate report arrives BEFORE WORKING…
            expect(applied).toEqual([]);     // …but is buffered, not shown
            vi.advanceTimersByTime(50);
            s.working(true);                 // WORKING lands within the buffer → cancel
            s.live(0.5);
            vi.advanceTimersByTime(500);
            expect(applied).toEqual([]);
            s.live(0.2);
            s.working(false);
            expect(applied).toEqual([0.2]);  // only the settled value renders
        });

        it('applies buffered reports after the delay when no WORKING follows', () => {
            const s = new SettlingController({apply, workingWired: true, reportDelayMs: 100});
            s.live(0.42);
            vi.advanceTimersByTime(100);
            expect(applied).toEqual([0.42]);
        });

        it('a ramp without WORKING messages cannot starve the display', () => {
            const s = new SettlingController({apply, workingWired: true, reportDelayMs: 100});
            s.live(0.9);                     // timer starts with the first buffered report
            vi.advanceTimersByTime(60);
            s.live(0.8);                     // updates the pending value, does not restart the timer
            vi.advanceTimersByTime(40);
            expect(applied).toEqual([0.8]);
        });

        it('external ramp reconciles via safety timeout when WORKING=false is lost', () => {
            const s = new SettlingController({apply, workingWired: true, timeoutMs: 5000});
            s.working(true);
            s.live(0.3);
            vi.advanceTimersByTime(5000);
            expect(applied).toEqual([0.3]);
        });
    });

    describe('settled-topic mode (RedMatic LEVEL_NOTWORKING)', () => {
        it('live reports never drive apply; settled reports always do', () => {
            const s = new SettlingController({apply, settledWired: true});
            s.live(0.95);
            s.live(0.5);
            expect(applied).toEqual([]);
            s.settled(0);
            expect(applied).toEqual([0]);
        });

        it('hold ends on the settled report, timeout falls back to last live', () => {
            const s = new SettlingController({apply, settledWired: true, timeoutMs: 5000});
            s.command(0.8);
            s.live(0.4);
            vi.advanceTimersByTime(5000);    // settled topic never confirmed
            expect(applied).toEqual([0.4]);
        });

        it('B60: WORKING is ignored when a settled topic is wired (no stale-value jump)', () => {
            // Reporter's real sequence (HM-LC-Dim1L-CV via RedMatic): set 0.22 from
            // a previous 0.78. RedMatic delivers WORKING=false BEFORE LEVEL_NOTWORKING,
            // and the only interim LEVEL report is ~the old value (0.775). Acting on
            // the WORKING=false edge used to apply 0.775 then correct to 0.22 — a jump.
            const s = new SettlingController({apply, settledWired: true, workingWired: true, timeoutMs: 5000});
            s.command(0.22);      // user set → hold at target
            s.live(0.775);        // sole interim LEVEL report ≈ old value, swallowed
            s.working(false);     // arrives before the settled value → must be ignored now
            s.settled(0.22);      // authoritative LEVEL_NOTWORKING
            expect(applied).toEqual([0.22]);   // 0.775 never surfaces
        });
    });

    it('dispose clears all timers', () => {
        const s = new SettlingController({apply, workingWired: true, reportDelayMs: 100});
        s.live(0.5);
        s.command(1);
        s.dispose();
        vi.advanceTimersByTime(10_000);
        expect(applied).toEqual([]);
    });
});
