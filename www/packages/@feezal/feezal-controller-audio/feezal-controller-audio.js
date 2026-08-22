/* global feezal */
/**
 * @feezal/feezal-controller-audio (E188, per the E137 architecture)
 *
 * The audio-processor behaviour (sound mode / EQ, tone and per-channel
 * levels, the boolean flags, AV sync) as a Lit Reactive Controller, shared by
 * glass/metro/circle-audio. Speaks the mqtt-smarthome item tree lgsb2mqtt
 * publishes (github.com/hobbyquaker/lgsb2mqtt, prefix = `--name`, default
 * `soundbar`) — and any bridge with the same `<base>/<item>` shape:
 *
 *   <status base>/eq + eq_list                    sound mode + its options
 *   <status base>/bass, treble, woofer, rear_level, top_level, center_level,
 *                 side_level, dialog_level, av_sync   (+ <item>/min, <item>/max)
 *   <status base>/night_mode, auto_volume, drc, auto_power, tv_remote, neuralx, rear
 *   <command base>/<item>                          writes
 *
 * EVERYTHING IS CAPABILITY-DRIVEN. The item set depends on the model (a
 * DS90QY reports every channel; smaller bars lack several), so the
 * controller subscribes to the status base with wildcards and renders ONLY
 * the items the bridge actually retained — never a catalogue of sliders that
 * do nothing. Ranges come from each item's own `/min` and `/max` sidecars
 * (they differ per model); a level without a range falls back to the
 * catalogue default.
 */
import {css, html} from '@feezal/feezal-element';

/** The catalogue: what an item IS when it shows up. Order = render order. */
export const AUDIO_ITEMS = [
    {key: 'eq',           kind: 'mode',  label: 'Sound mode', list: 'eq_list'},
    {key: 'bass',         kind: 'level', label: 'Bass',     min: -6,   max: 6,   step: 1},
    {key: 'treble',       kind: 'level', label: 'Treble',   min: -6,   max: 6,   step: 1},
    {key: 'woofer',       kind: 'level', label: 'Woofer',   min: -15,  max: 6,   step: 1},
    {key: 'center_level', kind: 'level', label: 'Center',   min: -6,   max: 6,   step: 1},
    {key: 'side_level',   kind: 'level', label: 'Side',     min: -6,   max: 6,   step: 1},
    {key: 'rear_level',   kind: 'level', label: 'Rear',     min: -6,   max: 6,   step: 1},
    {key: 'top_level',    kind: 'level', label: 'Top',      min: -6,   max: 6,   step: 1},
    {key: 'dialog_level', kind: 'level', label: 'Dialog',   min: -6,   max: 6,   step: 1},
    {key: 'av_sync',      kind: 'level', label: 'AV sync',  min: 0,    max: 300, step: 10, unit: 'ms'},
    {key: 'night_mode',   kind: 'flag',  label: 'Night mode'},
    {key: 'auto_volume',  kind: 'flag',  label: 'Auto volume'},
    {key: 'drc',          kind: 'flag',  label: 'DRC'},
    {key: 'neuralx',      kind: 'flag',  label: 'Neural:X'},
    {key: 'rear',         kind: 'flag',  label: 'Rear speakers'},
    {key: 'auto_power',   kind: 'flag',  label: 'Auto power'},
    {key: 'tv_remote',    kind: 'flag',  label: 'TV remote'},
];

const CATALOGUE = new Map(AUDIO_ITEMS.map(i => [i.key, i]));
const LISTS = new Map(AUDIO_ITEMS.filter(i => i.list).map(i => [i.list, i.key]));

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const audioAttributes = [
    {name: 'subscribe', type: 'mqttTopic',
        help: 'Status BASE topic of the bridge, e.g. soundbar/status — the card subscribes to its items (eq, bass, treble, woofer, *_level, av_sync, the flags) and their /min /max ranges, and renders only what the device reports.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Dot-notation path to the value within each item message (a {"val":…} bridge → payload.val). Default: payload'},
    {name: 'publish', type: 'mqttTopic',
        help: 'Command BASE topic, e.g. soundbar/set — a change publishes to <base>/<item>.'},
    {name: 'label', type: 'string', default: '', help: 'Card label.'},
    {name: 'items', type: 'string', default: '',
        help: 'Optional comma-separated item whitelist in render order (e.g. eq, bass, treble, night_mode). Empty = every item the device reports, in catalogue order.'},
    {name: 'show-flags', type: 'boolean', default: true, help: 'Show the on/off flags (night mode, auto volume, DRC, …).'},
    {name: 'show-levels', type: 'boolean', default: true, help: 'Show the tone / channel level sliders.'},
    {name: 'show-mode', type: 'boolean', default: true, help: 'Show the sound mode / EQ select.'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const AUDIO_CONSUMED_ATTRIBUTES = audioAttributes.map(a => a.name);

/**
 * Shared discovery.map fragment — the recognizer (server/src/mqtt/recognizers/
 * lgsb.js) hands over the two BASES; the card discovers the item set itself.
 */
export const audioDiscoveryMap = {
    name:               'label',
    state_base_topic:   {attr: 'subscribe'},
    command_base_topic: 'publish',
    value_template:     {attr: 'message-property', transform: 'valueTemplateToPath'},
};

function truthy(v) {
    if (v === true || v === 1) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'on' || s === 'yes';
}

/** A list payload: array, JSON-array text, or comma-separated. */
export function audioList(v) {
    if (v === null || v === undefined) return [];
    let list = v;
    if (typeof v === 'string') {
        const t = v.trim();
        if (!t) return [];
        if (t.startsWith('[')) { try { list = JSON.parse(t); } catch { list = t.split(','); } } else list = t.split(',');
    }
    return Array.isArray(list) ? list.map(x => String(x ?? '').trim()).filter(Boolean) : [];
}

export class AudioController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        this._reset();
    }

    _reset() {
        this.values = new Map();   // item key → current value (number | boolean | string)
        this.ranges = new Map();   // item key → {min, max}
        this.lists = new Map();    // list key (eq_list) → [options]
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null || v === '' ? fallback : v;
    }

    get base() { return this._attr('subscribe').replace(/\/+$/, ''); }
    get commandBase() { return this._attr('publish').replace(/\/+$/, ''); }
    get _msgProp() { return this._attr('message-property', 'payload'); }

    /** The rows to render: catalogue order (or the `items` whitelist order), only what the device reported. */
    get items() {
        const whitelist = audioList(this._attr('items'));
        const keys = whitelist.length ? whitelist : AUDIO_ITEMS.map(i => i.key);
        const showMode = this._attr('show-mode', 'true') !== 'false';
        const showLevels = this._attr('show-levels', 'true') !== 'false';
        const showFlags = this._attr('show-flags', 'true') !== 'false';
        const out = [];
        for (const key of keys) {
            const def = CATALOGUE.get(key);
            if (!def || !this.values.has(key)) continue;
            if (def.kind === 'mode' && !showMode) continue;
            if (def.kind === 'level' && !showLevels) continue;
            if (def.kind === 'flag' && !showFlags) continue;
            const range = this.ranges.get(key) || {};
            out.push({
                ...def,
                value: this.values.get(key),
                min: Number.isFinite(range.min) ? range.min : def.min,
                max: Number.isFinite(range.max) ? range.max : def.max,
                options: def.list ? (this.lists.get(def.list) || []) : undefined,
            });
        }
        return out;
    }

    /** The current sound mode (convenience for compact chromes). */
    get mode() { return this.values.get('eq') ?? null; }

    signature() {
        return [this.base, this._msgProp].join('|');
    }

    hostConnected() { this.wire(); }

    wire() {
        this.__sig = this.signature();
        const base = this.base;
        if (!base) return;
        const read = msg => this.host.getProperty(msg, this._msgProp);
        const handle = (topic, msg) => {
            if (!topic.startsWith(base + '/')) return;
            const rel = topic.slice(base.length + 1);
            const m = /^(.+)\/(min|max)$/.exec(rel);
            if (m && CATALOGUE.has(m[1])) {
                const n = Number(read(msg));
                if (Number.isFinite(n)) this.ranges.set(m[1], {...(this.ranges.get(m[1]) || {}), [m[2]]: n});
                return;
            }
            if (LISTS.has(rel)) { this.lists.set(rel, audioList(read(msg))); return; }
            const def = CATALOGUE.get(rel);
            if (!def) return;
            const v = read(msg);
            if (v === null || v === undefined) return;
            if (def.kind === 'flag') this.values.set(rel, truthy(v));
            else if (def.kind === 'level') { const n = Number(v); if (Number.isFinite(n)) this.values.set(rel, n); }
            else this.values.set(rel, String(v));
        };
        // One-segment items + their /min /max sidecars; two levels cover both.
        for (const pattern of [`${base}/+`, `${base}/+/+`]) {
            this.host.addSubscription(pattern, msg => {
                handle(msg.topic, msg);
                this.host.requestUpdate();
            });
        }
    }

    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this._reset();
            this.host._unsubscribe();
            this.wire();
        }
    }

    // ── publishing (editor-guarded) ─────────────────────────────────────────

    _pub(item, payload) {
        const base = this.commandBase;
        if (feezal.isEditor || !base || !item) return;
        feezal.connection?.pub?.(`${base}/${item}`, payload);
    }

    /** Set a level (clamped to its range), a flag, or the mode — by item key. */
    set(key, value) {
        const def = CATALOGUE.get(key);
        if (!def) return;
        if (def.kind === 'level') {
            const range = this.ranges.get(key) || {};
            const min = Number.isFinite(range.min) ? range.min : def.min;
            const max = Number.isFinite(range.max) ? range.max : def.max;
            const n = Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
            this.values.set(key, n);
            this._pub(key, String(n));
        } else if (def.kind === 'flag') {
            const on = value === true || truthy(value);
            this.values.set(key, on);
            this._pub(key, on ? 'true' : 'false');
        } else {
            const s = String(value ?? '');
            if (!s) return;
            this.values.set(key, s);
            this._pub(key, s);
        }
        this.host.requestUpdate?.();
    }

    toggle(key) { this.set(key, !(this.values.get(key) === true)); }
}

// ── shared panel markup ──────────────────────────────────────────────────────

/** Structural styles every family composes; colours come from the family. */
export const audioPanelStyles = css`
    .audio { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .audio .item { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .audio .name { flex: 0 0 34%; font-size: 12px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .audio .val { flex: 0 0 auto; min-width: 3.2em; text-align: right; font-size: 11px; font-variant-numeric: tabular-nums; opacity: 0.8; }
    .audio input[type="range"] { flex: 1; min-width: 0; accent-color: var(--_audio-accent, var(--primary-color)); }
    .audio select {
        flex: 1; min-width: 0; font: inherit; font-size: 12px; color: inherit;
        background: var(--_audio-field-bg, rgba(128,128,128,0.18)); border: none; border-radius: 8px; padding: 3px 6px;
    }
    .audio .flags { display: flex; flex-wrap: wrap; gap: 4px; }
    .audio .flag {
        border: none; cursor: pointer; color: inherit; font: inherit; font-size: 11px; line-height: 1;
        padding: 5px 9px; border-radius: 999px; background: var(--_audio-field-bg, rgba(128,128,128,0.18));
    }
    .audio .flag.on { background: var(--_audio-accent, var(--primary-color)); color: var(--_audio-on-color, #fff); }
    .audio .empty { font-size: 11px; opacity: 0.6; }
`;

/** The panel template. `a` is the AudioController. */
export function audioPanel(a, {placeholder = 'Waiting for the device…'} = {}) {
    const items = a.items;
    const flags = items.filter(i => i.kind === 'flag');
    const rows = items.filter(i => i.kind !== 'flag');
    if (!items.length) {
        return html`<div class="audio"><div class="empty">${feezal.isEditor ? 'Audio settings' : placeholder}</div></div>`;
    }
    return html`
        <div class="audio">
            ${rows.map(i => i.kind === 'mode' ? html`
                <div class="item mode">
                    <span class="name">${i.label}</span>
                    <select title="${i.label}" @change="${e => a.set(i.key, e.target.value)}">
                        ${(i.options.length ? i.options : [i.value]).map(o => html`
                            <option value="${o}" ?selected="${String(o) === String(i.value)}">${o}</option>`)}
                    </select>
                </div>` : html`
                <div class="item level">
                    <span class="name">${i.label}</span>
                    <input type="range" min="${i.min}" max="${i.max}" step="${i.step ?? 1}" .value="${String(i.value)}"
                        title="${i.label}" @change="${e => a.set(i.key, e.target.value)}">
                    <span class="val">${i.value}${i.unit ? ' ' + i.unit : ''}</span>
                </div>`)}
            ${flags.length ? html`
                <div class="flags">
                    ${flags.map(f => html`
                        <button class="flag ${f.value ? 'on' : ''}" title="${f.label}" @click="${() => a.toggle(f.key)}">${f.label}</button>`)}
                </div>` : ''}
        </div>`;
}
