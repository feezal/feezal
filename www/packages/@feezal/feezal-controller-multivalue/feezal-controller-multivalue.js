/* global feezal */
/**
 * @feezal/feezal-controller-multivalue (E165, per the E137 architecture)
 *
 * The multi-value readout MQTT contract as a Lit Reactive Controller — one
 * card showing SEVERAL values from a multi-datapoint device (a 3-phase
 * powermeter's voltage/power/current per phase, a climate sensor's
 * temperature + humidity). The family element is a VIEW: it reads the
 * controller's resolved value list / grid and renders its own chrome; the
 * controller owns the `values` config parsing, subscription wiring with
 * topic de-duplication (N values on one topic = ONE subscription), per-value
 * extraction and locale formatting, and the grid pivot.
 *
 * Two layouts, both supported by every adopting family:
 *   stack — one `role: primary` value rendered big, the rest as smaller
 *           secondary readouts (temperature big, humidity small above it).
 *   grid  — values carry `row` + `col` keys and pivot into a table
 *           (power/voltage/current rows × L1/L2/L3 columns).
 *
 * Template generator: `grid-rows` + `grid-cols` + `grid-pattern`
 * ({row}/{col} placeholders) expand ONCE into the `values` list when it is
 * empty (editor only) — a fill helper, not a live mode, so the expanded list
 * stays hand-editable for irregular devices.
 *
 * Config is read from HOST ATTRIBUTES (the saved-markup source of truth) —
 * uniform across families regardless of their property naming.
 */

import {formatNumber} from '@feezal/feezal-element/feezal-locale.js';

/** Parse the `values` attribute → array of plain config entries. */
export function parseValues(raw) {
    if (!raw) return [];
    try {
        const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(a) ? a.filter(v => v && typeof v === 'object') : [];
    } catch { return []; }
}

/**
 * Template generator: expand rows × cols × pattern into a values list.
 * rows/cols are comma-separated tokens; pattern carries {row} and {col}
 * placeholders and becomes each value's `property`
 * (e.g. `payload.{row}_{col}` → `payload.power_a`).
 */
export function expandGrid(rowsCsv, colsCsv, pattern) {
    const rows = String(rowsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
    const cols = String(colsCsv || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!rows.length || !cols.length || !pattern) return [];
    const out = [];
    for (const row of rows) {
        for (const col of cols) {
            out.push({
                property: pattern.replaceAll('{row}', row).replaceAll('{col}', col),
                label: `${row} ${col}`,
                row,
                col,
            });
        }
    }
    return out;
}

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const multivalueAttributes = [
    {name: 'subscribe', type: 'mqttTopic',
        help: 'Default topic for ALL values — the common case where one JSON payload carries every datapoint (zigbee2mqtt). A value with its own topic in the list overrides it.'},
    {name: 'layout', type: 'select', options: ['stack', 'grid'], default: 'stack',
        help: 'stack = one primary value big with smaller secondary readouts; grid = values pivot into a table by their row/col keys.'},
    {name: 'values', type: 'objectList', itemFields: [
        {key: 'property', placeholder: 'payload.temperature'},
        {key: 'label', placeholder: 'label'},
        {key: 'unit', placeholder: '°C'},
        {key: 'decimals', placeholder: '1'},
        {key: 'role', type: 'select', options: ['', 'primary', 'secondary']},
        {key: 'row', placeholder: 'grid row'},
        {key: 'col', placeholder: 'grid col'},
        // U104: full mqttTopic row field — broker autocomplete in the list editor.
        {key: 'topic', type: 'mqttTopic', placeholder: '(default topic)'},
    ], help: 'One entry per value. property = dot-path into the message (default topic\'s payload); role marks the big value in stack layout (first entry when none is marked); row + col place the value in grid layout; topic overrides the element topic for this value.'},
    {name: 'grid-rows', type: 'string', default: '', section: 'Grid template',
        help: 'Template generator: comma-separated row tokens (e.g. power, voltage, current). With grid-cols and grid-pattern set and the values list EMPTY, the list is generated once from the template — then edit it freely.'},
    {name: 'grid-cols', type: 'string', default: '', section: 'Grid template',
        help: 'Template generator: comma-separated column tokens (e.g. a, b, c).'},
    {name: 'grid-pattern', type: 'string', default: '', section: 'Grid template',
        help: 'Template generator: property pattern with {row} and {col} placeholders, e.g. payload.{row}_{col} → payload.power_a.'},
    // B67: opt-in availability — the base class wires the subscription.
    {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Optional availability topic — a badge appears while unavailable.'},
    {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
    {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
];

/**
 * Shared discovery.map fragment (HA `sensor`). A single picked sensor seeds
 * the card with a one-entry values list via the `topic`+`name` lines — the
 * real multi-fill (every numeric sensor of the device in one pick) is the
 * picker's device-fill path, which writes `values` directly.
 */
export const multivalueDiscoveryMap = {
    state_topic: {attr: 'subscribe'},
    name:        'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const MULTIVALUE_CONSUMED_ATTRIBUTES = multivalueAttributes.map(a => a.name);

/** Editor sample so an unconfigured card previews its layout on the canvas. */
export function sampleValues(layout) {
    if (layout === 'grid') {
        return expandGrid('power, voltage, current', 'L1, L2, L3', 'payload.{row}_{col}')
            .map((v, i) => ({...v, unit: ['W', 'V', 'A'][Math.floor(i / 3)],
                sample: [[230, 231, 229], [412, 380, 405], [1.8, 1.6, 1.7]][Math.floor(i / 3)][i % 3]}));
    }
    return [
        {label: 'Humidity', unit: '%', role: 'secondary', sample: 55},
        {label: 'Temperature', unit: '°C', role: 'primary', decimals: 1, sample: 21.5},
    ];
}

export class MultivalueController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        /** live raw values, index-aligned with the parsed config list */
        this._data = [];
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    get layout() { return this._attr('layout', 'stack') === 'grid' ? 'grid' : 'stack'; }

    /** Parsed config entries (no live data). */
    get config() { return parseValues(this._attr('values')); }

    /**
     * Config + live data resolved for rendering: [{...entry, raw, display}].
     * Falls back to the layout's editor sample when nothing is configured.
     */
    values() {
        const cfg = this.config;
        if (!cfg.length) {
            if (!feezal.isEditor) return [];
            return sampleValues(this.layout).map(v => ({...v, raw: v.sample, display: this.format(v.sample, v)}));
        }
        return cfg.map((v, i) => {
            const raw = this._data[i];
            return {...v, raw, display: this.format(raw, v)};
        });
    }

    /** Per-value locale formatting (N38): decimals when set, '—' when empty. */
    format(raw, cfg = {}) {
        if (raw === null || raw === undefined || raw === '') return '—';
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        }
        const d = cfg.decimals === '' || cfg.decimals === undefined || cfg.decimals === null
            ? undefined : Math.max(0, Math.min(6, Number(cfg.decimals) || 0));
        return formatNumber(n, d === undefined ? {} : {digits: d});
    }

    /** Stack layout split: {primary, secondaries} (first entry when none marked). */
    stack() {
        const all = this.values();
        if (!all.length) return {primary: null, secondaries: []};
        let primary = all.find(v => v.role === 'primary');
        if (!primary) primary = all[0];
        return {primary, secondaries: all.filter(v => v !== primary)};
    }

    /**
     * Grid pivot: {cols: [...], rows: [{key, cells: [value|null, ...]}]} in
     * first-appearance order. Values without row/col keys are appended as
     * full-width extras.
     */
    grid() {
        const all = this.values();
        const cols = [];
        const rowOrder = [];
        const byRow = new Map();
        const extras = [];
        for (const v of all) {
            if (!v.row && !v.col) { extras.push(v); continue; }
            const row = String(v.row ?? '');
            const col = String(v.col ?? '');
            if (!cols.includes(col)) cols.push(col);
            if (!byRow.has(row)) { byRow.set(row, new Map()); rowOrder.push(row); }
            byRow.get(row).set(col, v);
        }
        return {
            cols,
            rows: rowOrder.map(key => ({key, cells: cols.map(c => byRow.get(key).get(c) ?? null)})),
            extras,
        };
    }

    /** One unit for a whole grid row when every cell agrees (row-header suffix). */
    rowUnit(row) {
        const units = [...new Set(row.cells.filter(Boolean).map(c => c.unit || ''))];
        return units.length === 1 ? units[0] : '';
    }

    signature() {
        return [this._attr('subscribe'), this._attr('values')].join('|');
    }

    hostConnected() {
        this.wire();
    }

    // hostDisconnected: the host's own disconnectedCallback tears every
    // subscription down (they live in host._subscriptions).

    /** Wire (or re-wire after host._unsubscribe()) — one subscription per unique topic. */
    wire() {
        this.__sig = this.signature();
        const cfg = this.config;
        const fallback = this._attr('subscribe');
        const byTopic = new Map();   // topic → [index, ...]
        cfg.forEach((v, i) => {
            const topic = (v.topic || fallback || '').trim();
            if (!topic) return;
            if (!byTopic.has(topic)) byTopic.set(topic, []);
            byTopic.get(topic).push(i);
        });
        for (const [topic, indices] of byTopic) {
            this.host.addSubscription(topic, msg => {
                for (const i of indices) {
                    this._data[i] = this.host.getProperty(msg, cfg[i].property || 'payload');
                }
                this.host.requestUpdate();
            });
        }
    }

    /** Call from the host's updated() to re-wire on live config edits. */
    rewireIfChanged() {
        this.maybeExpandTemplate();
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this._data = [];
            this.host._unsubscribe();
            this.wire();
        }
    }

    /**
     * Template generator (editor only): with rows+cols+pattern set and the
     * values list EMPTY, expand ONCE into the `values` attribute — the list
     * stays hand-editable afterwards; re-expansion needs the list cleared.
     */
    maybeExpandTemplate() {
        if (!feezal.isEditor || this.config.length) return;
        const expanded = expandGrid(this._attr('grid-rows'), this._attr('grid-cols'), this._attr('grid-pattern'));
        if (!expanded.length) return;
        this.host.setAttribute('values', JSON.stringify(expanded));
        if (!this.host.getAttribute('layout')) this.host.setAttribute('layout', 'grid');
        feezal.app?.change?.(true);
    }
}
