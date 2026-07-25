/**
 * E128 / E154 — movement indication for actuators that take visible time to
 * travel: blinds/shutters (`DIRECTION` while the motor runs) and motor door
 * locks (Keymatic `DIRECTION` while it turns).
 *
 * Two pieces, deliberately separate:
 *
 *  - `parseDirection()` — the shared value→direction reading. Homematic's
 *    `DIRECTION` is an enum (`NONE` / `UP` / `DOWN` / `UNDEFINED`, device values
 *    0…3, verified against OpenCCU-Base `rf_keymatic.xml`); depending on the
 *    interface it arrives as the option NAME or as the numeric index, so both
 *    are accepted. Any other/absent value reads as idle — an unwired movement
 *    topic simply means "no indication", exactly like E127's WORKING.
 *
 *  - `MovementController` — the DISCRETE-state analog of E127's numeric
 *    `SettlingController`, for locks. A numeric settler holds a slider at its
 *    target until the reports catch up; a lock has no numeric scale, it has a
 *    transitional "…ing" state that must be held between the command and the
 *    device's confirmation, so `SettlingController` does not fit (the E154
 *    build flagged this). The rules:
 *      • `command(intent, expected)` — the user pressed Lock/Unlock/Open:
 *        enter the transitional state immediately (the device reports STATE
 *        only once it is done, and some interfaces echo the OLD state first).
 *      • `signal(active, hint)` — the device's movement datapoint. When one is
 *        wired it is the AUTHORITY: active extends the transitional state
 *        (also for movement started elsewhere — a physical key turn), idle
 *        ends it. `hint` names the intent when there was no local command.
 *      • `report(state)` — a resolved state report. It ends the transitional
 *        state only when NO movement signal is wired (otherwise the signal
 *        does), and only once the expected state is reached — so an echo of
 *        the pre-command state cannot cut the hold short.
 *      • `timeoutMs` — the fallback that always resolves, so a lost
 *        DIRECTION=NONE or a device that never confirms cannot leave the card
 *        stuck "locking…" forever.
 */

import {svg} from 'lit';
import {css, html} from './feezal-element.js';

/** Homematic DIRECTION enum indices (OpenCCU-Base `rf_keymatic.xml`). */
const DIRECTION_INDEX = {0: '', 1: 'up', 2: 'down', 3: ''};

/**
 * Read a movement-datapoint value as `'up'` / `'down'` / `''` (idle).
 *
 * @param {*} value                 the raw datapoint value
 * @param {string} [upPayload]      configured payload meaning "up"
 * @param {string} [downPayload]    configured payload meaning "down"
 */
export function parseDirection(value, upPayload = 'UP', downPayload = 'DOWN') {
    if (value === null || value === undefined || value === false) return '';
    const raw = String(value).trim();
    if (raw === '') return '';
    const up = String(upPayload || 'UP').trim().toUpperCase();
    const down = String(downPayload || 'DOWN').trim().toUpperCase();
    const upper = raw.toUpperCase();
    if (upper === up) return 'up';
    if (upper === down) return 'down';
    // Numeric form: the enum index as published by interfaces that send the
    // device value instead of the option name.
    if (/^-?\d+(\.\d+)?$/.test(raw)) return DIRECTION_INDEX[Number(raw)] ?? '';
    return '';
}

/** True when the value reads as movement in either direction. */
export function isMoving(value, upPayload, downPayload) {
    return parseDirection(value, upPayload, downPayload) !== '';
}

export class MovementController {
    /**
     * @param {object} opts
     * @param {() => void} [opts.onChange]        called whenever the transitional state changes
     * @param {number} [opts.timeoutMs=20000]     hard fallback that always resolves
     * @param {boolean} [opts.signalWired=false]  a movement datapoint feeds signal()
     */
    constructor({onChange = () => {}, timeoutMs = 20000, signalWired = false} = {}) {
        this._onChange = onChange;
        this._timeoutMs = timeoutMs;
        this._signalWired = signalWired;
        this._intent = '';       // 'locking' | 'unlocking' | 'opening' | 'moving'
        this._expected = null;   // resolved state that ends the hold (no signal wired)
        this._timer = null;
    }

    /** True while the actuator is (believed to be) moving. */
    get moving() { return this._intent !== ''; }
    /** The transitional intent, '' while idle. */
    get intent() { return this._intent; }

    /** The user issued a command — hold the transitional state. */
    command(intent, expected = null) {
        this._set(intent, expected);
    }

    /** Movement datapoint report; `hint` names the intent for external movement. */
    signal(active, hint = 'moving') {
        if (active) {
            this._set(this._intent || hint || 'moving', this._expected);
            return;
        }
        this._stop();
    }

    /** Resolved state report (e.g. the lock's STATE datapoint). */
    report(state) {
        if (!this.moving) return;
        // A wired movement datapoint is the authority — it ends the hold.
        if (this._signalWired) return;
        if (this._expected === null || state === this._expected) this._stop();
    }

    dispose() { this._clear(); }

    _set(intent, expected) {
        const changed = this._intent !== intent;
        this._intent = intent;
        this._expected = expected;
        this._clear();
        this._timer = setTimeout(() => { this._timer = null; this._stop(); }, this._timeoutMs);
        if (changed) this._onChange();
    }

    _stop() {
        this._clear();
        if (this._intent === '') return;
        this._intent = '';
        this._expected = null;
        this._onChange();
    }

    _clear() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    }
}

/**
 * Shared movement badge (E128 covers / E154 locks) — a small pulsing chevron
 * that points the way the actuator is travelling, or a neutral pulse when the
 * direction is unknown. Positioned top-left by default (top-right is the
 * availability badge, bottom-right the E124 battery symbol); families move it
 * with the `--feezal-movement-*` custom properties. Colour is `currentColor`
 * so every family's chrome carries it without a per-family override.
 */
export const feezalMovementStyles = css`
    .feezal-move-badge {
        position: absolute;
        top: var(--feezal-movement-top, 6px);
        left: var(--feezal-movement-left, 6px);
        width: var(--feezal-movement-size, 16px);
        height: var(--feezal-movement-size, 16px);
        color: var(--feezal-movement-color, currentColor);
        opacity: 0.9; pointer-events: none; z-index: 2;
    }
    .feezal-move-badge svg { width: 100%; height: 100%; display: block; }
    /* E154: applied to the element a family already draws (the lock disc /
       icon) so a motor lock reads as "working" without adding chrome — the
       badge above is for actuators whose DIRECTION is meaningful (blinds). */
    @media (prefers-reduced-motion: no-preference) {
        .feezal-move-badge,
        .feezal-moving { animation: feezal-move-pulse 1.1s ease-in-out infinite; }
    }
    @keyframes feezal-move-pulse {
        0%, 100% { opacity: 0.25; }
        50%      { opacity: 1; }
    }
`;

/**
 * Movement badge template partial: renders nothing while idle.
 *
 * @param {''|'up'|'down'|'moving'|string} direction  '' = idle
 * @param {string} [title]                            tooltip / a11y label
 */
export function movementBadge(direction, title = 'Moving') {
    if (!direction) return '';
    // `svg` (not `html`): these fragments live inside the <svg> root below, so
    // they must be created in the SVG namespace.
    const glyph = direction === 'up'
        ? svg`<path d="M12 5 L20 15 H4 Z" fill="currentColor"/>`
        : direction === 'down'
            ? svg`<path d="M12 19 L4 9 H20 Z" fill="currentColor"/>`
            : svg`<circle cx="12" cy="12" r="6" fill="currentColor"/>`;
    return html`<span class="feezal-move-badge" title="${title}"><svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg></span>`;
}
