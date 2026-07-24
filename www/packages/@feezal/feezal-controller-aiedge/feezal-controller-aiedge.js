/* global feezal */
/**
 * @feezal/feezal-controller-aiedge (E147)
 *
 * The "meter reader" MQTT contract as a Lit Reactive Controller — shared by the
 * glass / metro / circle meter cards. Built for jomjol's AI-on-the-edge-device
 * (water/gas/energy meters, E146) but deliberately generic: at heart it is a
 * meter card (value + rate + reading-age + fault), so it serves any MQTT meter.
 *
 * Two wiring modes:
 *  - **JSON** (`subscribe-json`): AI-on-the-edge publishes `…/<seq>/json` bundling
 *    `{value, raw, pre, error, rate, timestamp}` (quoted strings) — one topic,
 *    each field read via a key path (defaults `payload.value`, `.rate`, …).
 *  - **Separate** (`subscribe-value` [+ `subscribe-rate`]): a plain value (and
 *    optional rate) topic for any other meter; the payload IS the value.
 * Plus `subscribe-status` (the device's current processing step / last action)
 * and availability from the base (N31, the device's `…/connection` topic).
 *
 * Config is read from HOST ATTRIBUTES (uniform across families). E137 packaging:
 * controller + attribute fragment as one unit; `AIEDGE_CONSUMED_ATTRIBUTES`
 * feeds the E114 parity-set derivation.
 */

// Values on the error field that mean "no fault" (case-insensitive). Everything
// else is an active error surfaced as a badge + text. AI-on-the-edge uses the
// literal string "no error".
const ERROR_OK = new Set(['', '0', 'false', 'no error', 'no_error', 'noerror', 'none', 'ok', 'null', 'undefined', 'nan']);

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const aiedgeAttributes = [
    // ── JSON mode (AI-on-the-edge `…/json`) ──
    {name: 'subscribe-json', type: 'mqttTopic', help: 'AI-on-the-edge `…/json` topic bundling value/rate/error/timestamp. Reads every field from one topic.'},
    {name: 'message-property-value',     type: 'string', default: 'payload.value',     help: 'Path to the value within the JSON payload (dot-notation).'},
    {name: 'message-property-rate',      type: 'string', default: 'payload.rate',      help: 'Path to the consumption rate within the JSON payload.'},
    {name: 'message-property-error',     type: 'string', default: 'payload.error',     help: 'Path to the error/fault field within the JSON payload.'},
    {name: 'message-property-timestamp', type: 'string', default: 'payload.timestamp', help: 'Path to the last-reading timestamp (ISO-8601) within the JSON payload.'},
    {name: 'message-property-raw',       type: 'string', default: 'payload.raw',       help: 'Path to the raw (pre-correction) reading within the JSON payload.'},
    // ── Separate mode (any generic meter) ──
    {name: 'subscribe-value',    type: 'mqttTopic', help: 'Generic value topic (use instead of subscribe-json for a non-AI-on-the-edge meter). The payload is the value.'},
    {name: 'message-property',   type: 'string', default: 'payload', help: 'Path to the value within a separate value topic. Default "payload".'},
    {name: 'subscribe-rate',     type: 'mqttTopic', help: 'Optional separate rate topic (generic meters). The payload is the rate.'},
    {name: 'message-property-rate-value', type: 'string', default: 'payload', help: 'Path to the rate within a separate rate topic. Default "payload".'},
    // ── Status / action ──
    {name: 'subscribe-status',   type: 'mqttTopic', help: 'Optional topic reporting the current processing step / last action (AI-on-the-edge `…/status`).'},
    {name: 'message-property-status', type: 'string', default: 'payload', help: 'Path to the status text. Default "payload".'},
    // ── Display ──
    {name: 'unit',       type: 'string', help: 'Unit rendered after the value (e.g. m³, kWh).'},
    {name: 'rate-unit',  type: 'string', help: 'Unit rendered after the rate (e.g. m³/min).'},
    {name: 'decimals',   type: 'number', min: 0, max: 6, help: 'Round the numeric value to this many decimals. Empty = as received.'},
    {name: 'stale-after', type: 'number', min: 0, default: 0, help: 'Seconds after the last-reading timestamp before a stale warning shows. 0 = never warn.'},
    {name: 'label',      type: 'string', help: 'Card label.'},
    {name: 'show-rate',      type: 'boolean', default: true,  help: 'Show the consumption-rate line.'},
    {name: 'show-status',    type: 'boolean', default: true,  help: 'Show the action/status line.'},
    {name: 'show-timestamp', type: 'boolean', default: true,  help: 'Show the last-reading age ("3 min ago").'},
    {name: 'show-raw',       type: 'boolean', default: false, help: 'Show the raw (pre-correction) reading on a secondary line.'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const AIEDGE_CONSUMED_ATTRIBUTES = aiedgeAttributes.map(a => a.name);

/** Round a numeric meter value to `decimals` places; pass non-numerics through. */
export function formatMeterValue(raw, decimals) {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    if (decimals !== '' && decimals !== null && decimals !== undefined && Number.isFinite(n)) {
        return n.toFixed(Math.max(0, Math.min(6, Number(decimals) || 0)));
    }
    return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
}

/** Compact relative age ("just now" / "3 min ago" / "2 h ago" / "5 d ago"). */
export function relativeTime(ms, now) {
    if (!ms) return '';
    const secs = Math.max(0, Math.round((now - ms) / 1000));
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs} h ago`;
    return `${Math.round(hrs / 24)} d ago`;
}

export class AiedgeController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        // ── state (plain fields, E137) ──
        this.value = null;      // formatted-source raw value (view formats via decimals)
        this.rate = null;
        this.error = '';        // active fault text, '' = no error
        this.status = '';       // current processing step / last action
        this.raw = null;        // raw (pre-correction) reading
        this.timestamp = null;  // last-reading epoch ms, or null
        this._tick = null;      // heartbeat so the relative age refreshes without new messages
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        // Treat an EMPTY attribute as unset → use the fallback. A view that
        // reflects the fragment's message-property attributes with an empty
        // default would otherwise stamp `message-property-value=""` and blank
        // the path; empty always means "use the default here".
        return (v === null || v === '') ? fallback : v;
    }

    /** Read a field, JSON-parsing a stringified payload first so key paths work. */
    _field(msg, path) {
        let m = msg;
        if (typeof msg?.payload === 'string') {
            const s = msg.payload.trim();
            if (s.startsWith('{') || s.startsWith('[')) {
                try { m = {...msg, payload: JSON.parse(s)}; } catch { /* not JSON — keep raw */ }
            }
        }
        return this.host.getProperty(m, path);
    }

    get faulted() { return !!this.error; }

    /** True when a stale-after threshold is set and the last reading is older. */
    get stale() {
        const after = Number(this._attr('stale-after', '0'));
        if (!after || !this.timestamp) return false;
        return (this._now() - this.timestamp) / 1000 > after;
    }

    /** Relative age string for the last reading ('' when unknown). */
    get age() { return relativeTime(this.timestamp, this._now()); }

    /** Overridable clock hook (kept out of the render path for testability). */
    _now() { return this.__now ?? Date.now(); }

    signature() {
        return ['subscribe-json', 'subscribe-value', 'subscribe-rate', 'subscribe-status',
            'message-property-value', 'message-property-rate', 'message-property',
            'message-property-rate-value', 'message-property-status']
            .map(a => this._attr(a)).join('|');
    }

    hostConnected() {
        this.wire();
        // Heartbeat: refresh the relative age / stale flag roughly every 20 s.
        this._tick = setInterval(() => {
            if (this.timestamp) this.host.requestUpdate();
        }, 20_000);
    }

    hostDisconnected() {
        if (this._tick) { clearInterval(this._tick); this._tick = null; }
    }

    wire() {
        this.__sig = this.signature();
        const json = this._attr('subscribe-json');

        if (json) {
            // JSON mode: one topic, every field via its key path.
            this.host.addSubscription(json, msg => {
                this.value = this._field(msg, this._attr('message-property-value', 'payload.value'));
                this.rate = this._field(msg, this._attr('message-property-rate', 'payload.rate'));
                this.raw = this._field(msg, this._attr('message-property-raw', 'payload.raw'));
                this._setError(this._field(msg, this._attr('message-property-error', 'payload.error')));
                this._setTimestamp(this._field(msg, this._attr('message-property-timestamp', 'payload.timestamp')));
                this.host.requestUpdate();
            });
        } else if (this._attr('subscribe-value')) {
            // Separate mode: plain value (+ optional rate) topics.
            this.host.addSubscription(this._attr('subscribe-value'), msg => {
                this.value = this.host.getProperty(msg, this._attr('message-property', 'payload'));
                this.host.requestUpdate();
            });
            const rate = this._attr('subscribe-rate');
            if (rate) {
                this.host.addSubscription(rate, msg => {
                    this.rate = this.host.getProperty(msg, this._attr('message-property-rate-value', 'payload'));
                    this.host.requestUpdate();
                });
            }
        }

        const status = this._attr('subscribe-status');
        if (status) {
            this.host.addSubscription(status, msg => {
                const v = this.host.getProperty(msg, this._attr('message-property-status', 'payload'));
                this.status = (v === null || v === undefined) ? '' : String(v);
                this.host.requestUpdate();
            });
        }
    }

    _setError(v) {
        const raw = (v === null || v === undefined) ? '' : String(v).trim();
        this.error = ERROR_OK.has(raw.toLowerCase()) ? '' : raw;
    }

    _setTimestamp(v) {
        if (v === null || v === undefined || v === '') { this.timestamp = null; return; }
        const t = typeof v === 'number' ? v : Date.parse(String(v));
        this.timestamp = Number.isFinite(t) ? t : null;
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }
}
