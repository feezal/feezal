/* global feezal */
import {FeezalElement, feezalBoolean, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-countdown (E34)
 *
 * A countdown / timer display driven by MQTT. Three modes:
 *   - seconds-remaining: the topic carries the remaining seconds; the element
 *     ticks it down locally from the receive time, so it is immune to a wrong
 *     client clock.
 *   - target-timestamp: the topic carries an absolute Unix (s or ms, auto-
 *     detected) or ISO timestamp; the element counts down to it against the
 *     CLIENT clock (a wrong tablet clock shifts the result).
 *   - count-up: the topic carries a start timestamp; the element counts up from
 *     it like a stopwatch.
 *
 * The remaining/elapsed time is ALWAYS recomputed from Date.now() against a
 * stored anchor on every tick — the 1s interval only triggers a repaint, it
 * never accumulates, so there is no interval drift.
 */
class FeezalElementBasicCountdown extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Countdown', category: 'Basic', color: '#4a6080', icon: 'timer'},
            description: 'A countdown / timer display driven by MQTT — counts down remaining seconds, counts down to a target timestamp, or counts up from a start timestamp.',
            baseAttribute: 'subscribe',
            attributes: [
                {name: 'mode', type: 'select',
                    options: ['seconds-remaining', 'target-timestamp', 'count-up'],
                    default: 'seconds-remaining',
                    help: 'seconds-remaining = the topic carries the remaining seconds; ticks down locally from the receive time (immune to client-clock skew). target-timestamp = the topic carries an absolute Unix/ISO timestamp; counts down to it compared against the CLIENT clock (a wrong tablet clock shifts it). count-up = counts up from a subscribed start timestamp (stopwatch).'},
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Topic carrying the timestamp or remaining seconds.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.value" to navigate into a JSON payload.'},
                {name: 'format', type: 'select',
                    options: ['auto', 'mm:ss', 'HH:mm:ss', 'd HH:mm:ss'],
                    default: 'auto',
                    help: 'Digit format. "auto" picks the smallest that fits: mm:ss under an hour, HH:mm:ss under a day, d HH:mm:ss beyond.'},
                {name: 'show-ring', type: 'boolean', default: true,
                    help: 'Show the progress ring/bar.'},
                {name: 'total-seconds', type: 'number', default: 0,
                    help: 'Denominator for the progress ring (0 = infer from the first value seen).'},
                {name: 'warn-seconds', type: 'number', default: 10,
                    help: 'Remaining seconds at which the digits + ring turn to the error colour.'},
                {name: 'done-label', type: 'string', default: 'Done',
                    help: 'Text shown at zero.'},
                {name: 'publish-on-zero', type: 'mqttTopic',
                    help: 'Optional topic published to once when the countdown reaches zero. NOTE: every open viewer publishes at zero (2 tablets = 2 messages) — consuming automations must tolerate duplicates.'},
                {name: 'payload-zero', type: 'string', default: 'done',
                    help: 'Payload published at zero.'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-countdown-text-color', type: 'color',
                    default: 'var(--primary-text-color, #333)',
                    help: 'Digit colour.'},
                {property: '--feezal-countdown-ring-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Progress ring / bar colour.'},
                {property: '--feezal-countdown-warn-color', type: 'color',
                    default: 'var(--error-color, #d32f2f)',
                    help: 'Colour used within warn-seconds.'},
                {property: '--feezal-countdown-label-color', type: 'color',
                    default: 'var(--secondary-text-color, #9e9e9e)',
                    help: 'Colour of the done-label text.'},
                {property: '--feezal-countdown-digit-size',
                    default: '28cqmin',
                    help: 'Digit font size.'}
            ],
            restrict: {minWidth: 90, minHeight: 60},
            defaultStyle: {width: '160px', height: '100px'}
        };
    }

    static properties = {
        // subscribe + messageProperty are inherited from FeezalElement.
        mode:          {type: String, reflect: true},
        format:        {type: String, reflect: true},
        showRing:      {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-ring'},
        totalSeconds:  {type: Number, reflect: true, attribute: 'total-seconds'},
        warnSeconds:   {type: Number, reflect: true, attribute: 'warn-seconds'},
        doneLabel:     {type: String, reflect: true, attribute: 'done-label'},
        publishOnZero: {type: String, reflect: true, attribute: 'publish-on-zero'},
        payloadZero:   {type: String, reflect: true, attribute: 'payload-zero'},
        _display:      {state: true},
        _fraction:     {state: true},
        _warn:         {state: true},
        _done:         {state: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            display: block;
            container-type: size;
            overflow: hidden;
            --feezal-countdown-text-color: var(--primary-text-color, #333);
            --feezal-countdown-ring-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-countdown-warn-color: var(--error-color, #d32f2f);
            --feezal-countdown-label-color: var(--secondary-text-color, #9e9e9e);
            --feezal-countdown-digit-size: 28cqmin;
        }
        .frame {
            box-sizing: border-box;
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 6cqmin;
        }
        .dial {
            position: relative;
            flex: 1 1 auto;
            width: 100%; min-height: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .ring {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
            /* default preserveAspectRatio (xMidYMid meet) keeps the ring a
               centred circle regardless of the box aspect ratio. */
        }
        .ring-track {
            fill: none;
            stroke: var(--divider-color, #e0e0e0);
            stroke-width: 8;
        }
        .ring-prog {
            fill: none;
            stroke: var(--feezal-countdown-ring-color);
            stroke-width: 8;
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: center;
            transition: stroke-dashoffset 0.3s linear;
        }
        .digits {
            position: relative;
            font-family: ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace;
            font-variant-numeric: tabular-nums;
            font-size: var(--feezal-countdown-digit-size);
            line-height: 1;
            color: var(--feezal-countdown-text-color);
            white-space: nowrap;
        }
        .digits.done {
            color: var(--feezal-countdown-label-color);
            font-size: calc(var(--feezal-countdown-digit-size) * 0.7);
            font-family: inherit;
        }
        .bar {
            display: none;
            flex: 0 0 auto;
            width: 82%;
            height: 8cqmin;
            max-height: 12px;
            min-height: 4px;
            border-radius: 999px;
            overflow: hidden;
            background: var(--divider-color, #e0e0e0);
        }
        .bar-fill {
            height: 100%;
            border-radius: inherit;
            background: var(--feezal-countdown-ring-color);
            transition: width 0.3s linear;
        }
        /* Warn state — digits + ring/bar turn to the error colour. */
        .frame.warn .digits { color: var(--feezal-countdown-warn-color); }
        .frame.warn .ring-prog { stroke: var(--feezal-countdown-warn-color); }
        .frame.warn .bar-fill { background: var(--feezal-countdown-warn-color); }
        /* No ring/bar (show-ring off, or count-up which has no fraction). */
        .frame.no-ring .ring,
        .frame.no-ring .bar { display: none; }
        /* Much wider than tall → horizontal bar instead of the ring
           (same trick as the E105 glass wide-tile). */
        @container (min-aspect-ratio: 11/5) {
            .frame:not(.no-ring) .ring { display: none; }
            .frame:not(.no-ring) .bar { display: block; }
            .dial { flex: 0 0 auto; height: auto; }
        }
    `];

    constructor() {
        super();
        // Reactive properties — ALL initialised here, never as class fields.
        this.mode          = 'seconds-remaining';
        this.format        = 'auto';
        this.showRing      = true;
        this.totalSeconds  = 0;
        this.warnSeconds   = 10;
        this.doneLabel     = 'Done';
        this.publishOnZero = '';
        this.payloadZero   = 'done';
        this._display      = '--:--';
        this._fraction     = 0;
        this._warn         = false;
        this._done         = false;

        // Non-reactive internal state (plain fields — no reactive setter to shadow).
        this._interval      = null;
        this._valid         = false;   // a parseable value has been seen
        this._armed         = false;   // publish-on-zero armed (a value > 0 was seen)
        this._anchorValue   = 0;       // seconds-remaining: the received seconds
        this._receivedAt    = 0;       // seconds-remaining: Date.now() at receipt
        this._targetMs      = 0;       // target-timestamp: parsed target (ms)
        this._startMs       = 0;       // count-up: parsed start (ms)
        this._inferredTotal = null;    // ring denominator inferred from first value
    }

    // Custom subscription: parse the payload ourselves rather than letting the
    // base class blindly write it to an attribute. Keeps the reserved
    // <subscribe>/setattribute… control channel. Never subscribes/ticks in the
    // editor — the canvas shows a static preview.
    _subscribe() {
        if (!this.subscribe || this._subscribed || feezal.isEditor) {
            return;
        }
        this._subscribed = true;
        this.addSubscription(this.subscribe, msg => this._ingest(this.getProperty(msg, this.messageProperty)));
        this._subscribeControl(this.subscribe);
        this._startTick();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTick();
    }

    updated(changed) {
        super.updated(changed);
        // A mode change invalidates the stored anchor and the publish-on-zero arm.
        if (changed.has('mode')) {
            this._valid = false;
            this._armed = false;
            this._inferredTotal = null;
        }
        if (changed.has('mode') || changed.has('format') || changed.has('totalSeconds') ||
            changed.has('warnSeconds') || changed.has('doneLabel')) {
            this._refresh();
        }
    }

    // ── Timing ───────────────────────────────────────────────────────────────

    _startTick() {
        if (feezal.isEditor) return;
        this._stopTick();
        this._interval = setInterval(() => {
            // Skip while the view is paused (N37 unsubscribed) so a countdown
            // can't publish-on-zero from a hidden view.
            if (this._subscribed) this._refresh();
        }, 1000);
    }

    _stopTick() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    // ── Value ingestion ────────────────────────────────────────────────────────

    _ingest(raw) {
        if (this.mode === 'seconds-remaining') {
            const n = this._parseNumber(raw);
            if (!Number.isFinite(n)) {
                this._valid = false;
                this._refresh();
                return;
            }
            this._anchorValue = n;
            this._receivedAt = Date.now();
            this._valid = true;
        } else {
            // target-timestamp / count-up both parse an absolute timestamp.
            const ms = this._parseTimestamp(raw);
            if (!Number.isFinite(ms)) {
                this._valid = false;
                this._refresh();
                return;
            }
            if (this.mode === 'count-up') {
                this._startMs = ms;
            } else {
                this._targetMs = ms;
            }
            this._valid = true;
        }

        // Arm publish-on-zero + infer the ring denominator, but only from a
        // value that is currently > 0. A stale retained value already <= 0 on
        // load leaves us disarmed, so we never fire on load.
        if (this.mode !== 'count-up') {
            const rem = this._computeRemaining();
            if (rem != null && rem > 0) {
                this._armed = true;
                if (this.totalSeconds <= 0 && this._inferredTotal == null) {
                    this._inferredTotal = rem;
                }
            }
        }

        if (!this._interval) this._startTick();
        this._refresh();
    }

    /** seconds-remaining: coerce to a finite number, else NaN. */
    _parseNumber(raw) {
        const n = typeof raw === 'number' ? raw : parseFloat(raw);
        return Number.isFinite(n) ? n : NaN;
    }

    /**
     * timestamp modes: numeric (or numeric-string) < 1e12 → Unix SECONDS
     * (×1000); >= 1e12 → milliseconds; any other string → Date.parse (ISO).
     * Unparseable → NaN (never throws; the caller shows '--:--').
     */
    _parseTimestamp(raw) {
        if (raw == null) return NaN;
        if (typeof raw === 'number') {
            return Number.isFinite(raw) ? (raw < 1e12 ? raw * 1000 : raw) : NaN;
        }
        const str = String(raw).trim();
        if (str === '') return NaN;
        if (/^-?\d+(\.\d+)?$/.test(str)) {
            const n = parseFloat(str);
            return n < 1e12 ? n * 1000 : n;
        }
        return Date.parse(str); // NaN when unparseable
    }

    // ── Recompute + render state ────────────────────────────────────────────────

    /** Remaining seconds (down modes, floored at 0) / elapsed seconds (count-up).
     *  null when no valid value has been seen. Always derived from Date.now(). */
    _computeRemaining() {
        if (!this._valid) return null;
        const now = Date.now();
        if (this.mode === 'target-timestamp') {
            return Math.max(0, (this._targetMs - now) / 1000);
        }
        if (this.mode === 'count-up') {
            return Math.max(0, (now - this._startMs) / 1000);
        }
        // seconds-remaining
        return Math.max(0, this._anchorValue - (now - this._receivedAt) / 1000);
    }

    _refresh() {
        const val = this._computeRemaining();
        if (val == null) {
            this._display = '--:--';
            this._warn = false;
            this._done = false;
            this._fraction = 0;
            return;
        }
        if (this.mode === 'count-up') {
            this._display = this._format(val);
            this._warn = false;
            this._done = false;
            this._fraction = 0;
            return;
        }
        // Down modes.
        const remaining = val;
        const total = this.totalSeconds > 0 ? this.totalSeconds : (this._inferredTotal || 0);
        this._fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
        if (remaining <= 0) {
            this._done = true;
            this._warn = false;
            this._display = this.doneLabel;
        } else {
            this._done = false;
            this._warn = remaining <= this.warnSeconds;
            this._display = this._format(remaining);
        }
        this._maybeFireZero(remaining);
    }

    /** Fire publish-on-zero exactly once on the transition to <= 0, only if armed. */
    _maybeFireZero(remaining) {
        if (this.mode === 'count-up') return;
        if (this._armed && remaining <= 0) {
            this._armed = false;
            if (!feezal.isEditor && this.publishOnZero) {
                feezal.connection.pub(this.publishOnZero, this.payloadZero);
            }
        }
    }

    /** Format a positive second count into the chosen (or auto) digit layout. */
    _format(seconds) {
        const s = Math.floor(seconds);
        const pad = n => String(n).padStart(2, '0');
        let fmt = this.format || 'auto';
        if (fmt === 'auto') {
            if (s < 3600) fmt = 'mm:ss';
            else if (s < 86400) fmt = 'HH:mm:ss';
            else fmt = 'd HH:mm:ss';
        }
        if (fmt === 'mm:ss') {
            const totalMin = Math.floor(s / 60);
            return `${pad(totalMin)}:${pad(s % 60)}`;
        }
        if (fmt === 'HH:mm:ss') {
            const totalHrs = Math.floor(s / 3600);
            return `${pad(totalHrs)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
        }
        // d HH:mm:ss
        const days = Math.floor(s / 86400);
        return `${days} ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }

    // ── Render ───────────────────────────────────────────────────────────────

    render() {
        const isEd = feezal.isEditor;
        const countUp = this.mode === 'count-up';

        // Editor: static preview — 12:34 digits, ring at ~40%, never live.
        const digits   = isEd ? '12:34' : this._display;
        const fraction = isEd ? 0.4 : this._fraction;
        const warn     = isEd ? false : this._warn;
        const done     = isEd ? false : this._done;
        const showRing = this.showRing && !countUp;

        const R = 44;
        const C = 2 * Math.PI * R;
        const offset = C * (1 - Math.max(0, Math.min(1, fraction)));

        const frameClass = [
            'frame',
            warn ? 'warn' : '',
            showRing ? '' : 'no-ring'
        ].filter(Boolean).join(' ');

        return html`
            <div class="${frameClass}">
                <div class="dial">
                    <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
                        <circle class="ring-track" cx="50" cy="50" r="${R}"></circle>
                        <circle class="ring-prog" cx="50" cy="50" r="${R}"
                            stroke-dasharray="${C}" stroke-dashoffset="${offset}"></circle>
                    </svg>
                    <div class="digits ${done ? 'done' : ''}">${digits}</div>
                </div>
                <div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(1, fraction)) * 100}%"></div></div>
            </div>
        `;
    }
}

window.customElements.define('feezal-element-basic-countdown', FeezalElementBasicCountdown);

export {FeezalElementBasicCountdown};
