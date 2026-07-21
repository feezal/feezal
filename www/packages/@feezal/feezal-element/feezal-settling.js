/**
 * E127 — SettlingController: suppression logic for ramping actuators.
 *
 * Homematic dimmers (and blinds, E128) ramp towards a commanded LEVEL and
 * report every intermediate value on the way — a slider that follows those
 * reports jumps around right after the user set it. This controller decides
 * which incoming reports may reach the display:
 *
 *  - command(target): the element just published a set value → hold the
 *    display at the target. Intermediate reports are swallowed until the
 *    reported value reaches the target, a settled signal arrives, or the
 *    settle timeout reconciles to the last reported value (interrupted
 *    ramps, device clamping, sentinel targets like Homematic's 1.005
 *    OLD_LEVEL restore that the device never echoes verbatim).
 *  - working(active): the device's WORKING datapoint. `true` enters/extends
 *    suppression (covers ramps started elsewhere); `false` ends it and
 *    applies the last report as the settled value.
 *  - live(value): a report from the state topic. Applied directly when idle;
 *    swallowed while holding/ramping. When a WORKING topic is wired, idle
 *    reports are buffered for `reportDelayMs` first — interfaces cannot
 *    guarantee WORKING=true precedes the first intermediate report (it
 *    arrives ≤ ~100 ms after), so a WORKING=true within the buffer cancels
 *    the pending jumpy update.
 *  - settled(value): a report from a settled-values-only topic (RedMatic's
 *    LEVEL_NOTWORKING). Always applied, ends any hold.
 *
 * The controller is value-scale-agnostic (raw device values in, raw values
 * out through the apply callback) and family-agnostic — lights use it for
 * brightness, covers (E128) for position.
 */

const TARGET_EPSILON = 1e-3;

export class SettlingController {
    /**
     * @param {object} opts
     * @param {(value: number) => void} opts.apply   applies a raw report to the element state
     * @param {number} [opts.timeoutMs=5000]         hold/ramp reconcile timeout
     * @param {number} [opts.reportDelayMs=100]      idle-report buffer while a WORKING topic is wired (0 = off)
     * @param {boolean} [opts.workingWired=false]    a WORKING topic feeds working()
     * @param {boolean} [opts.settledWired=false]    a settled topic feeds settled() — live() then never drives apply
     */
    constructor({apply, timeoutMs = 5000, reportDelayMs = 100, workingWired = false, settledWired = false}) {
        this._apply = apply;
        this._timeoutMs = timeoutMs;
        this._reportDelayMs = reportDelayMs;
        this._workingWired = workingWired;
        this._settledWired = settledWired;

        this._holding = false;      // own command in flight
        this._target = null;
        this._ramping = false;      // externally initiated ramp (WORKING=true seen)
        this._lastLive = null;      // most recent live report (raw)
        this._timeout = null;
        this._pending = null;       // {value, timer} — buffered idle report
    }

    /** The element just published `target` (raw device scale). */
    command(target) {
        this._cancelPending();
        this._holding = true;
        this._ramping = false;
        this._target = Number(target);
        this._startTimeout();
    }

    /** Report from the live state topic (raw device scale). */
    live(value) {
        this._lastLive = value;
        if (this._settledWired) return;                 // slider follows the settled topic only
        if (this._holding) {
            if (Math.abs(value - this._target) <= TARGET_EPSILON) this._settle(value);
            return;                                     // swallow intermediate ramp values
        }
        if (this._ramping) return;                      // swallow external ramp values
        if (this._workingWired && this._reportDelayMs > 0) {
            // Buffer so a trailing WORKING=true can cancel the jumpy update.
            // The timer runs from the FIRST buffered report; later reports
            // only update the pending value (a ramp without WORKING must not
            // starve the display forever).
            if (this._pending) {
                this._pending.value = value;
            } else {
                this._pending = {
                    value,
                    timer: setTimeout(() => {
                        const v = this._pending.value;
                        this._pending = null;
                        this._apply(v);
                    }, this._reportDelayMs),
                };
            }
            return;
        }
        this._apply(value);
    }

    /** WORKING datapoint report. */
    working(active) {
        if (active) {
            this._cancelPending();
            if (!this._holding && !this._ramping) {
                this._ramping = true;
                this._startTimeout();                   // safety: a lost WORKING=false must not freeze the display
            }
            return;
        }
        if (this._holding || this._ramping) this._settle(this._lastLive);
    }

    /** Report from the settled-values topic (LEVEL_NOTWORKING). */
    settled(value) {
        this._settle(value);
    }

    dispose() {
        this._clearTimeout();
        this._cancelPending();
    }

    _settle(value) {
        this._holding = false;
        this._ramping = false;
        this._target = null;
        this._clearTimeout();
        this._cancelPending();
        if (value !== null && value !== undefined && !Number.isNaN(Number(value))) this._apply(Number(value));
    }

    _startTimeout() {
        this._clearTimeout();
        this._timeout = setTimeout(() => {
            this._timeout = null;
            this._settle(this._lastLive);
        }, this._timeoutMs);
    }

    _clearTimeout() {
        if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
    }

    _cancelPending() {
        if (this._pending) { clearTimeout(this._pending.timer); this._pending = null; }
    }
}
