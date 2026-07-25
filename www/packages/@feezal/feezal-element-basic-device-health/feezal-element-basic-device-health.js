/* global feezal */
import {FeezalElement, feezalBoolean, html, css} from '@feezal/feezal-element';
import {LitElement} from 'lit';
import {friendlyName} from '@feezal/feezal-element/feezal-friendly-name.js';
import {batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {decodeHmFault, isSabotageActive} from '@feezal/feezal-element/feezal-hm-fault.js';

/**
 * feezal-element-basic-device-health (E135, overhauled)
 *
 * The wall-panel "is everything okay?" board. Surfaces low-battery, unreachable
 * (unavailable), and — for Homematic — fault + sabotage signals across ALL
 * ecosystems (Homematic, zigbee2mqtt, ESPHome, Tasmota, …) in one list.
 *
 * The device list is resolved AT EDIT TIME by the custom inspector: it reads the
 * server's autodiscovery registry (`/api/discovery/devices`), keeps every device
 * that carries a canonical battery/availability/fault/sabotage record, derives a
 * friendly name (the same `friendlyName` used when linking a discovered device),
 * and stamps a concrete `devices` JSON list onto the element. The VIEWER just
 * subscribes to the listed topics — no discovery access, no name derivation at
 * runtime. Uncheck a device in the inspector to exclude it from the board.
 */

// Severity → sort weight + colour var (higher = worse, shown first).
const SEV = {sabotage: 3, fault: 2, battery: 1, unreach: 0};

/** Last non-empty topic segment (…/status/Fenster:1/STATE → "Fenster:1"). */
function topicLeaf(topic) {
    return String(topic || '').split('/').filter(Boolean).pop() || '';
}
/** Root topic segment as a coarse source label (zigbee2mqtt/… → "zigbee2mqtt"). */
function sourceOf(topic) {
    return String(topic || '').split('/').filter(Boolean)[0] || '';
}

/**
 * Turn autodiscovery entities into the board's device list. Keeps only devices
 * with an actionable health signal; battery is BOOLEAN-only (a percentage-only
 * source carries no `payloadLow` and is skipped).
 *
 * B72: one entry per physical DEVICE, not per entity. z2m/ESPHome expose many
 * entities per device — each with a distinct name, and (ESPHome especially)
 * each carrying the same availability — so merging by name duplicated them.
 * Key on the device identity instead (`config.device.identifiers[0]` →
 * `node_id` → shared availability/battery topic → friendly name), take the
 * label from `config.device.name` when present, and union the signals.
 * Pure — unit-tested without a browser.
 */
export function buildHealthDevices(entities) {
    const byKey = new Map();
    for (const ent of entities || []) {
        const cfg = ent.config || {};
        const bat = cfg.battery_low_normalized;
        const av  = cfg.availability_normalized;
        const err = cfg.error_normalized;
        const sab = cfg.sabotage_normalized;

        const battery = (bat && bat.payloadLow !== undefined)
            ? {topic: bat.topic, prop: bat.property || 'payload', low: bat.payloadLow} : null;
        const a0 = av && Array.isArray(av.entries) ? av.entries[0] : null;
        const avail = a0
            ? {topic: a0.topic, prop: a0.property || 'payload', unavail: av.payloadUnavailable, avail: av.payloadAvailable} : null;
        const fault = (err && err.topic)
            ? {topic: err.topic, prop: err.property || 'payload', deviceType: err.deviceType} : null;
        const sabotage = (sab && sab.topic)
            ? {topic: sab.topic, prop: sab.property || 'payload', enc: sab.encoding, deviceType: sab.deviceType} : null;

        if (!battery && !avail && !fault && !sabotage) continue;

        const primary = (battery || avail || fault || sabotage).topic;
        // Device label: prefer the physical device name (shared across a device's
        // entities), else the entity name, else the topic leaf.
        const rawName = cfg.device?.name
            || ((ent.name && ent.name !== ent.component) ? ent.name : topicLeaf(cfg.state_topic || primary));
        const name = friendlyName(rawName) || topicLeaf(primary) || 'Device';
        const source = sourceOf(cfg.state_topic || primary);

        // Dedup key: device identity first (z2m/ESPHome group a device's many
        // distinct-named entities under one `device.identifiers`), else the
        // friendly name (collapses Homematic channels that share a name).
        const key = cfg.device?.identifiers?.[0] || ent.node_id || name;

        const cur = byKey.get(key);
        if (cur) {
            if (battery && !cur.battery) cur.battery = battery;
            if (avail && !cur.avail) cur.avail = avail;
            if (fault && !cur.fault) cur.fault = fault;
            if (sabotage && !cur.sabotage) cur.sabotage = sabotage;
            continue;
        }
        byKey.set(key, {
            id: String(key), name, source,
            ...(battery ? {battery} : {}),
            ...(avail ? {avail} : {}),
            ...(fault ? {fault} : {}),
            ...(sabotage ? {sabotage} : {}),
        });
    }
    return [...byKey.values()];
}

/**
 * Is an availability payload "unavailable"? Mirrors the base class N31 logic:
 * unwrap a z2m `{"state":…}` object, then compare against the entity's
 * payloadAvailable / payloadUnavailable, falling back to the offline/false/0
 * convention.
 */
export function isDeviceUnavailable(value, unavail, avail) {
    let v = value;
    if (v && typeof v === 'object' && 'state' in v) v = v.state;
    const s = String(v).toLowerCase();
    if (avail !== undefined && avail !== null && s === String(avail).toLowerCase()) return false;
    if (unavail !== undefined && unavail !== null && s === String(unavail).toLowerCase()) return true;
    return ['offline', 'false', '0', 'unavailable'].includes(s);
}

class FeezalElementBasicDeviceHealth extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Device Health', category: 'Basic', color: '#4a6080', icon: 'health_and_safety'},
            description: 'Device-health board: low battery, unreachable devices, and Homematic fault/sabotage across ' +
                'all ecosystems (Homematic, zigbee2mqtt, ESPHome, …). Pick which discovered devices to watch in the inspector.',
            inspector: 'feezal-element-basic-device-health-inspector',
            attributes: [
                {name: 'title', type: 'string', default: 'Device Health', help: 'Board heading.'},
                // Curated device list, stamped by the custom inspector (JSON).
                {name: 'devices', type: 'string', default: '[]', help: 'Watched devices (managed by the inspector checklist).'},
                {name: 'show-battery', type: 'boolean', default: true, help: 'Include low-battery warnings.'},
                {name: 'show-unreach', type: 'boolean', default: true, help: 'Include unreachable / unavailable devices.'},
                {name: 'show-ok', type: 'boolean', default: true, help: 'Show an "all OK" state when nothing is wrong (else the board is empty).'},
            ],
            styles: ['top', 'left', 'width', 'height',
                {property: '--feezal-health-sabotage-color', type: 'color', default: 'var(--error-color, #d32f2f)', help: 'Sabotage (alarm) colour.'},
                {property: '--feezal-health-fault-color', type: 'color', default: 'var(--warning-color, #f0a30a)', help: 'Fault (warning) colour.'},
                {property: '--feezal-health-muted-color', type: 'color', default: 'var(--secondary-text-color, #666)', help: 'Battery / unreachable colour.'},
            ],
            defaultStyle: {width: '260px', height: '200px'},
        };
    }

    static properties = {
        title:       {type: String, reflect: true},
        devices:     {type: String, reflect: true},
        showBattery: {type: Boolean, reflect: true, attribute: 'show-battery', converter: feezalBoolean},
        showUnreach: {type: Boolean, reflect: true, attribute: 'show-unreach', converter: feezalBoolean},
        showOk:      {type: Boolean, reflect: true, attribute: 'show-ok', converter: feezalBoolean},
        _issues:     {state: true},
    };

    static styles = [FeezalElement.styles, css`
        :host { display: block; box-sizing: border-box; }
        .board {
            width: 100%; height: 100%; box-sizing: border-box; padding: 10px 12px;
            background: var(--secondary-background-color, #f5f5f5); border-radius: 8px;
            display: flex; flex-direction: column; gap: 6px; overflow: hidden;
            color: var(--primary-text-color, #222);
        }
        .head { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; }
        .head feezal-icon { font-size: 18px; }
        .list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
        .row { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 1.3; }
        .row feezal-icon { font-size: 15px; }
        .row .dev { font-weight: 600; }
        .row .issue { opacity: 0.85; }
        .row.sabotage { color: var(--feezal-health-sabotage-color, #d32f2f); font-weight: 700; }
        .row.fault    { color: var(--feezal-health-fault-color, #f0a30a); }
        .row.battery, .row.unreach { color: var(--feezal-health-muted-color, #666); }
        .ok { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #2e7d32; opacity: 0.9; }
        .ok feezal-icon { font-size: 18px; }
        .empty { font-size: 12px; opacity: 0.6; font-style: italic; }
    `];

    constructor() {
        super();
        this.title = 'Device Health';
        this.devices = '[]';
        this.showBattery = true;
        this.showUnreach = true;
        this.showOk = true;
        this._issues = new Map();   // `${device}|${type}` → {device, type, text, severity}
    }

    _subscribe() { /* the board manages its own per-device subscriptions */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;
        this._wireDevices();
    }

    /** JSON-parse `devices` → subscribe each present signal topic. */
    _wireDevices() {
        let list;
        try { list = JSON.parse(this.devices || '[]'); } catch { list = []; }
        if (!Array.isArray(list)) return;
        for (const d of list) {
            if (d.battery?.topic) this.addSubscription(d.battery.topic, msg =>
                this._setIssue(d.name, 'battery',
                    this.showBattery && batteryLowFromValue(this.getProperty(msg, d.battery.prop || 'payload'), String(d.battery.low ?? 'true')),
                    'Battery low', SEV.battery));
            if (d.avail?.topic) this.addSubscription(d.avail.topic, msg =>
                this._setIssue(d.name, 'unreach',
                    this.showUnreach && isDeviceUnavailable(this.getProperty(msg, d.avail.prop || 'payload'), d.avail.unavail, d.avail.avail),
                    'Unavailable', SEV.unreach));
            if (d.fault?.topic) this.addSubscription(d.fault.topic, msg => {
                const t = decodeHmFault(d.fault.deviceType, this.getProperty(msg, d.fault.prop || 'payload'));
                this._setIssue(d.name, 'fault', !!t, t || 'Fault', SEV.fault);
            });
            if (d.sabotage?.topic) this.addSubscription(d.sabotage.topic, msg =>
                this._setIssue(d.name, 'sabotage',
                    isSabotageActive(this.getProperty(msg, d.sabotage.prop || 'payload'), d.sabotage.enc, d.sabotage.deviceType),
                    'Sabotage', SEV.sabotage));
        }
    }

    _setIssue(device, type, active, text, severity) {
        const key = `${device}|${type}`;
        if (active) this._issues.set(key, {device, type, text, severity});
        else this._issues.delete(key);
        this._issues = new Map(this._issues);   // trigger update
    }

    _icon(type) {
        return {sabotage: 'gpp_bad', fault: 'warning', battery: 'battery_alert', unreach: 'wifi_off'}[type] || 'error';
    }

    render() {
        const issues = [...this._issues.values()].sort((a, b) => b.severity - a.severity || a.device.localeCompare(b.device));
        let watched = 0;
        try { watched = (JSON.parse(this.devices || '[]') || []).length; } catch { watched = 0; }
        const sample = feezal.isEditor
            ? [{device: 'Haustür', type: 'sabotage', text: 'Sabotage', severity: 3},
                {device: 'Heizung Bad', type: 'fault', text: 'Communication error', severity: 2},
                {device: 'Sensor Küche', type: 'battery', text: 'Battery low', severity: 1},
                {device: 'Lampe Flur', type: 'unreach', text: 'Unavailable', severity: 0}]
            : issues;
        const showEmptyHint = feezal.isEditor && watched === 0;
        return html`
            <div class="board">
                <div class="head"><feezal-icon name="health_and_safety"></feezal-icon> ${this.title || 'Device Health'}</div>
                ${showEmptyHint
                    ? html`<div class="empty">No devices selected — open the inspector to pick devices to watch.</div>`
                    : sample.length ? html`
                        <div class="list">
                            ${sample.map(i => html`
                                <div class="row ${i.type}">
                                    <feezal-icon name="${this._icon(i.type)}"></feezal-icon>
                                    <span class="dev">${i.device}</span><span class="issue">· ${i.text}</span>
                                </div>`)}
                        </div>`
                        : this.showOk ? html`<div class="ok"><feezal-icon name="check_circle"></feezal-icon> All devices OK</div>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-basic-device-health', FeezalElementBasicDeviceHealth);
export {FeezalElementBasicDeviceHealth};

/* ─────────────────────────────────────────────────────────────────────────
 * Custom inspector (N6) — device checklist built from the discovery registry.
 * Editor-only; renders in the inspector panel, emits feezal-attribute-changed.
 * ───────────────────────────────────────────────────────────────────────── */
class FeezalElementBasicDeviceHealthInspector extends LitElement {
    static properties = {
        element:     {attribute: false},
        _candidates: {state: true},
        _included:   {state: true},
        _loading:    {state: true},
        _error:      {state: true},
    };

    static styles = css`
        :host { display: block; padding: 8px; font-size: 12px; color: var(--feezal-color, #333); }
        .opts { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .opts .field { display: flex; flex-direction: column; gap: 2px; }
        .opts label.cap { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--feezal-color, #333); }
        sl-checkbox::part(label) { font-size: 11px; color: var(--feezal-color, #333); }
        .bar { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .bar .count { flex: 1; opacity: 0.7; }
        .bar button, .msg button {
            font: inherit; font-size: 11px; cursor: pointer; padding: 2px 8px;
            background: var(--feezal-bg-sub, #f0f0f0); color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px;
        }
        .grp { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; margin: 8px 0 2px; }
        .row { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
        .row .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row .sig { display: flex; gap: 3px; opacity: 0.55; }
        .row .sig feezal-icon { font-size: 14px; }
        .msg { opacity: 0.7; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    `;

    constructor() {
        super();
        this.element = null;
        this._candidates = [];
        this._included = new Set();
        this._loading = false;
        this._error = '';
    }

    willUpdate(changed) {
        if (changed.has('element') && this.element) this._load();
    }

    async _load() {
        this._loading = true; this._error = '';
        let entities = [];
        try {
            const r = await fetch('/api/discovery/devices');
            if (r.ok) { const j = await r.json(); entities = j.devices || []; }
            else this._error = 'Discovery registry unavailable.';
        } catch { this._error = 'Discovery registry unavailable.'; }
        this._candidates = buildHealthDevices(entities);

        let stored = [];
        try { stored = JSON.parse(this.element?.getAttribute('devices') || '[]'); } catch { stored = []; }
        if (Array.isArray(stored) && stored.length) {
            this._included = new Set(stored.map(d => d.id).filter(Boolean));
        } else {
            // Fresh board: watch everything by default and stamp the list.
            this._included = new Set(this._candidates.map(d => d.id));
            if (this._candidates.length) this._emit();
        }
        this._loading = false;
    }

    _emit() {
        const list = this._candidates.filter(d => this._included.has(d.id));
        this._change('devices', JSON.stringify(list));
    }

    _change(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true, detail: {name, value},
        }));
    }

    _toggle(id, on) {
        if (on) this._included.add(id); else this._included.delete(id);
        this._included = new Set(this._included);
        this._emit();
    }

    _setAll(on) {
        this._included = on ? new Set(this._candidates.map(d => d.id)) : new Set();
        this._emit();
    }

    _signals(d) {
        const out = [];
        if (d.sabotage) out.push({icon: 'gpp_bad', title: 'Sabotage'});
        if (d.fault) out.push({icon: 'warning', title: 'Fault'});
        if (d.battery) out.push({icon: 'battery_alert', title: 'Low battery'});
        if (d.avail) out.push({icon: 'wifi', title: 'Availability'});
        return out;
    }

    _bool(name, label, dflt) {
        const raw = this.element?.getAttribute(name);
        const on = raw === null || raw === undefined ? dflt : raw !== 'false';
        return html`<sl-checkbox size="small" ?checked="${on}"
            @sl-change="${e => this._change(name, e.target.checked)}">${label}</sl-checkbox>`;
    }

    render() {
        const groups = new Map();
        for (const d of this._candidates) {
            const g = d.source || 'other';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(d);
        }
        return html`
            <div class="opts">
                <div class="field">
                    <label class="cap">Title</label>
                    <sl-input size="small" autocomplete="off"
                        .value="${this.element?.getAttribute('title') ?? 'Device Health'}"
                        @sl-change="${e => this._change('title', e.target.value)}"></sl-input>
                </div>
                ${this._bool('show-battery', 'Show low battery', true)}
                ${this._bool('show-unreach', 'Show unavailable', true)}
                ${this._bool('show-ok', 'Show "all OK"', true)}
            </div>

            ${this._loading
                ? html`<div class="msg">Loading discovered devices…</div>`
                : !this._candidates.length
                    ? html`<div class="msg">${this._error || 'No discovered devices report a battery or availability signal yet.'}
                        <button @click="${this._load}">Refresh</button></div>`
                    : html`
                        <div class="bar">
                            <span class="count">${this._included.size} / ${this._candidates.length} watched</span>
                            <button @click="${() => this._setAll(true)}">All</button>
                            <button @click="${() => this._setAll(false)}">None</button>
                            <button @click="${this._load}" title="Re-scan discovery">↻</button>
                        </div>
                        ${[...groups.entries()].map(([src, items]) => html`
                            <div class="grp">${src}</div>
                            ${items.map(d => html`
                                <label class="row">
                                    <sl-checkbox size="small" ?checked="${this._included.has(d.id)}"
                                        @sl-change="${e => this._toggle(d.id, e.target.checked)}"></sl-checkbox>
                                    <span class="nm" title="${d.name}">${d.name}</span>
                                    <span class="sig">${this._signals(d).map(s =>
                                        html`<feezal-icon name="${s.icon}" title="${s.title}"></feezal-icon>`)}</span>
                                </label>`)}
                        `)}`}
        `;
    }
}

customElements.define('feezal-element-basic-device-health-inspector', FeezalElementBasicDeviceHealthInspector);
export {FeezalElementBasicDeviceHealthInspector};
