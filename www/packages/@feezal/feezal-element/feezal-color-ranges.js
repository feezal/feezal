/* global feezal */
/**
 * @feezal/feezal-element/feezal-color-ranges — site-wide named colour ranges
 * (U65): arbitrary value→colour mappings the user creates once on the site and
 * reuses from any colour knob.
 *
 * ## The data
 *
 * Ranges live in ONE place: the `color-ranges` attribute of `<feezal-site>`,
 * as a JSON array — in the site HTML, so export and the offline viewer work
 * with no server. Three shapes:
 *
 *   {"name": "temp", "type": "bands",
 *    "bands": [{"from": 0, "color": "var(--ok-color)"}, {"from": 70, "color": "#ff9800"}]}
 *
 *   {"name": "load", "type": "gradient", "space": "oklch",
 *    "stops": [{"at": 0, "color": "#4caf50"}, {"at": 100, "color": "#e53935"}]}
 *
 *   {"name": "mode", "type": "enum", "default": "var(--secondary-text-color)",
 *    "map": {"heat": "#e53935", "cool": "#2196f3"}}
 *
 * `bands` is deliberately the EXISTING gauge `ranges` shape (`from` + `color`,
 * last match wins), so `@feezal/feezal-gauge` ranges migrate byte-for-byte and
 * a named range can drive a gauge dial. `gradient` blends between stops via
 * `color-mix()` — in OKLCH by default (perceptually even), `space` overrides
 * per range. `enum` maps non-numeric values. Band/stop/map colours may be
 * theme vars (`var(--error-color)`) — they are emitted verbatim into a custom
 * property and resolve at use time, so ranges never fight the theme.
 *
 * ## The mechanism — paired properties on the element's inline style
 *
 * A colour var `--x` is driven by writing companion properties next to it
 * (U65 storage shape B — one shared source, the range name optional):
 *
 *   --x-source-topic:    "stat/temp"       ← always present on a bound colour
 *   --x-source-property: payload.val       ← optional (default: payload)
 *   --x-range:           temp              ← present = Range mode (map value
 *                                            through the named range); absent
 *                                            = Subscribe mode (the payload IS
 *                                            the colour, written verbatim)
 *
 * The runtime resolves the binding and writes the CONCRETE colour into `--x`
 * itself. Elements keep reading `var(--x, fallback)` and never learn about
 * ranges; an element whose binding never fires simply keeps the last written
 * (serialized) colour — no half-state, and static export works for free.
 *
 * An empty `-source-topic` with a `-range` set falls back to the element's
 * own `subscribe` + `message-property` attributes (the element's primary
 * value), so a gauge's fill can colour by its own reading with zero extra
 * config.
 *
 * Topics are stored verbatim; values that would break a CSS declaration
 * (whitespace, `;`, quotes, …) are double-quoted — `cssQuote`/`cssUnquote`
 * are the one implementation of that rule.
 */

export const SOURCE_TOPIC_SUFFIX = '-source-topic';
export const SOURCE_PROPERTY_SUFFIX = '-source-property';
export const RANGE_SUFFIX = '-range';

// ── storage-safe custom-property strings ─────────────────────────────────────

const NEEDS_QUOTES = /[\s;{}"'!]/;

/** A topic/path → a token safe to store in a custom property. */
export function cssQuote(value) {
    const v = String(value ?? '');
    if (!v) return '""';
    if (!NEEDS_QUOTES.test(v)) return v;
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Inverse of cssQuote — reading back a stored custom-property value. */
export function cssUnquote(value) {
    const v = String(value ?? '').trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return v;
}

// ── range parsing ────────────────────────────────────────────────────────────

/** Parse a `color-ranges` JSON value → validated array (bad entries dropped). */
export function parseColorRanges(raw) {
    if (!raw) return [];
    let arr;
    try {
        arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return []; }
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const r of arr) {
        if (!r || typeof r !== 'object' || !r.name || typeof r.name !== 'string') continue;
        const range = {name: r.name, type: r.type, default: typeof r.default === 'string' ? r.default : ''};
        if (r.type === 'bands') {
            range.bands = (Array.isArray(r.bands) ? r.bands : [])
                .map(b => ({from: Number(b?.from), color: String(b?.color || '')}))
                .filter(b => Number.isFinite(b.from) && b.color)
                .sort((a, b) => a.from - b.from);
            if (range.bands.length === 0) continue;
        } else if (r.type === 'gradient') {
            range.space = typeof r.space === 'string' && r.space ? r.space : 'oklch';
            range.stops = (Array.isArray(r.stops) ? r.stops : [])
                .map(s => ({at: Number(s?.at), color: String(s?.color || '')}))
                .filter(s => Number.isFinite(s.at) && s.color)
                .sort((a, b) => a.at - b.at);
            if (range.stops.length === 0) continue;
        } else if (r.type === 'enum') {
            range.map = (r.map && typeof r.map === 'object') ? {...r.map} : {};
            if (Object.keys(range.map).length === 0 && !range.default) continue;
        } else {
            continue;
        }
        out.push(range);
    }
    return out;
}

// One-slot cache keyed by the raw attribute string — parse is cheap but runs
// per message otherwise.
let _cacheRaw;
let _cacheParsed = [];

/** The site's ranges (parsed, cached until the attribute string changes). */
export function getSiteColorRanges() {
    const site = (typeof feezal !== 'undefined' && feezal.site) ||
        (typeof document !== 'undefined' && document.querySelector('feezal-site'));
    const raw = site?.getAttribute?.('color-ranges') || '';
    if (raw !== _cacheRaw) {
        _cacheRaw = raw;
        _cacheParsed = parseColorRanges(raw);
    }
    return _cacheParsed;
}

/** Look a range up by name in the site's ranges. */
export function findColorRange(name) {
    if (!name) return null;
    return getSiteColorRanges().find(r => r.name === name) || null;
}

// ── resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve `value` through `range` → a CSS colour string, or '' when nothing
 * matches (callers must not write '' — the var keeps its previous value, which
 * is the safe degradation the paired-property design promises).
 */
export function resolveRangeColor(range, value) {
    if (!range) return '';
    if (range.type === 'enum') {
        const key = String(value);
        return (key in range.map ? String(range.map[key]) : '') || range.default || '';
    }
    const v = Number(value);
    if (!Number.isFinite(v)) return range.default || '';
    if (range.type === 'bands') {
        let c = '';
        for (const b of range.bands) {
            if (v >= b.from) c = b.color;
        }
        return c || range.default || '';
    }
    if (range.type === 'gradient') {
        const stops = range.stops;
        if (v <= stops[0].at) return stops[0].color;
        const last = stops[stops.length - 1];
        if (v >= last.at) return last.color;
        for (let i = 1; i < stops.length; i++) {
            if (v <= stops[i].at) {
                const a = stops[i - 1];
                const b = stops[i];
                const t = (v - a.at) / (b.at - a.at || 1);
                if (t <= 0) return a.color;
                if (t >= 1) return b.color;
                // color-mix keeps var() stop colours theme-aware — nothing is
                // resolved here, the browser blends at use time.
                const pct = Math.round((1 - t) * 1000) / 10;
                return `color-mix(in ${range.space}, ${a.color} ${pct}%, ${b.color})`;
            }
        }
        return last.color;
    }
    return '';
}

/**
 * Editor preview helper: a range as a CSS gradient string for a swatch strip.
 * Bands render as hard steps, gradients as a smooth blend, enums as equal
 * hard segments in map order. '' for an empty range.
 */
export function rangeSwatchGradient(range) {
    if (!range) return '';
    if (range.type === 'bands') {
        const n = range.bands.length;
        const segs = range.bands.map((b, i) =>
            `${b.color} ${(i / n * 100).toFixed(1)}% ${((i + 1) / n * 100).toFixed(1)}%`);
        return `linear-gradient(90deg, ${segs.join(', ')})`;
    }
    if (range.type === 'gradient') {
        const lo = range.stops[0].at;
        const span = (range.stops[range.stops.length - 1].at - lo) || 1;
        const segs = range.stops.map(s => `${s.color} ${((s.at - lo) / span * 100).toFixed(1)}%`);
        return `linear-gradient(in ${range.space} 90deg, ${segs.join(', ')})`;
    }
    if (range.type === 'enum') {
        const colors = Object.values(range.map);
        if (range.default) colors.push(range.default);
        const n = colors.length || 1;
        const segs = colors.map((c, i) =>
            `${c} ${(i / n * 100).toFixed(1)}% ${((i + 1) / n * 100).toFixed(1)}%`);
        return `linear-gradient(90deg, ${segs.join(', ')})`;
    }
    return '';
}

// ── the element-side binding runtime ─────────────────────────────────────────

/**
 * Scan an element's INLINE style for colour bindings. Returns
 * [{prop, topic, property, range}] — `prop` is the target colour var
 * (`--x`), `topic` '' means "use the element's own subscribe".
 */
export function scanColorBindings(el) {
    const bindings = [];
    const style = el.style;
    for (let i = 0; i < style.length; i++) {
        const name = style[i];
        if (!name.startsWith('--') || !name.endsWith(SOURCE_TOPIC_SUFFIX)) continue;
        const prop = name.slice(0, -SOURCE_TOPIC_SUFFIX.length);
        bindings.push({
            prop,
            topic: cssUnquote(style.getPropertyValue(name)),
            property: cssUnquote(style.getPropertyValue(prop + SOURCE_PROPERTY_SUFFIX)) || 'payload',
            range: cssUnquote(style.getPropertyValue(prop + RANGE_SUFFIX)),
        });
    }
    return bindings;
}

/**
 * Per-element colour-binding runtime, owned by FeezalElement. One MQTT
 * subscription per bound colour var; on every message the value is either
 * mapped through the named range (Range mode) or written verbatim (Subscribe
 * mode — the payload IS the colour) into the target custom property.
 *
 * Editor-gated exactly like the element's primary subscription: with
 * "prevent MQTT element manipulation in editor" on (the default), nothing
 * subscribes and nothing is written into the serialized style.
 */
export class ColorBindings {
    constructor(el) {
        this.el = el;
        this._subs = [];
        this._sig = '';
    }

    _signature(bindings) {
        return bindings.map(b => [b.prop, b.topic, b.property, b.range].join(' ')).join('');
    }

    connect() {
        const el = this.el;
        if (typeof feezal === 'undefined' || !feezal.connection) return;
        if (feezal.isEditor && feezal.preventEditorMqtt !== false) return;
        const bindings = scanColorBindings(el);
        const sig = this._signature(bindings);
        if (this._subs.length > 0 && sig === this._sig) return;   // idempotent
        this.disconnect();
        this._sig = sig;
        for (const binding of bindings) {
            // Range mode with no topic reads the element's PRIMARY value.
            const topic = binding.topic ||
                (binding.range ? (el.getAttribute('subscribe') || '') : '');
            if (!topic) continue;
            const property = binding.topic
                ? binding.property
                : (el.getAttribute('message-property') || binding.property);
            this._subs.push(feezal.connection.sub(topic, msg => {
                let value = el.getProperty(msg, property);
                if (value === undefined || value === null) return;
                // A JSON payload read whole ('payload' on a JSON string) is
                // useless as a colour but common as a range value source once
                // parsed — try to unwrap a JSON scalar.
                if (typeof value === 'string' && binding.range) {
                    const n = Number(value);
                    if (Number.isFinite(n) && value.trim() !== '') value = n;
                }
                let color;
                if (binding.range) {
                    color = resolveRangeColor(findColorRange(binding.range), value);
                } else {
                    color = typeof value === 'string' ? value.trim() : String(value);
                }
                if (!color) return;   // no match → keep the previous colour
                if (el.style.getPropertyValue(binding.prop).trim() !== color) {
                    el.style.setProperty(binding.prop, color);
                }
            }));
        }
    }

    disconnect() {
        for (const sub of this._subs) feezal.connection?.unsubscribe(sub);
        this._subs = [];
        this._sig = '';
    }

    /** Editor hook: bindings were edited on the live element — resubscribe. */
    rewire() {
        this.disconnect();
        this.connect();
    }
}
