import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';

// Maps discovery component names to feezal element tag names.
// Entries for not-yet-built elements are included so they appear in the list
// (disabled) to give users a preview of what's coming.
const COMPONENT_ELEMENT_MAP = {
    light:         'feezal-element-material-light',
    climate:       'feezal-element-material-climate',
    cover:         'feezal-element-material-shutter',
    switch:        'feezal-element-material-switch',
    fan:           'feezal-element-material-fan',
    humidifier:    'feezal-element-material-humidifier',
    lock:          'feezal-element-material-door-lock',
    vacuum:        'feezal-element-material-vacuum',
    sensor:        'feezal-element-basic-value',
    binary_sensor: 'feezal-element-material-contact',
    select:        'feezal-element-paper-dropdown',
};

const COMPONENT_ICONS = {
    light:         'lightbulb',
    climate:       'thermostat',
    cover:         'blinds',
    switch:        'toggle_on',
    fan:           'mode_fan',
    humidifier:    'water_drop',
    lock:          'lock',
    vacuum:        'cleaning_services',
    sensor:        'sensors',
    binary_sensor: 'sensor_door',
    select:        'list',
};

class FeezalSidebarPalette extends LitElement {
    static properties = {
        _devices: {state: true},
        _loading: {state: true},
        _filter:  {state: true},
    };

    static styles = css`
        :host { display: block; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; overflow-y: auto; }
        .header {
            display: flex; align-items: center; gap: 8px; padding: 8px 12px;
            border-bottom: 1px solid var(--feezal-border, #e4e4e7);
            background: var(--feezal-bg-sub, #f5f5f5);
            position: sticky; top: 0; z-index: 1;
        }
        .header h3 { margin: 0; font-size: 13px; font-weight: 600; flex: 1; color: var(--feezal-color, #333); }
        .refresh-btn {
            background: none; border: none; cursor: pointer; padding: 2px; border-radius: 4px;
            color: var(--feezal-color, #666); line-height: 1; display: flex; align-items: center;
        }
        .refresh-btn:hover { background: var(--feezal-border, #e0e0e0); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .refresh-btn.spinning .material-icons { animation: spin 1s linear infinite; display: inline-block; }
        .filter-wrap { padding: 6px 12px; border-bottom: 1px solid var(--feezal-border, #e4e4e7); }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); }
        sl-input::part(base):focus-within { border-color: var(--feezal-border, #ccc); box-shadow: none; }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); font-size: 12px; }
        .empty {
            padding: 24px 16px; text-align: center;
            font-size: 12px; color: var(--feezal-color, #999); line-height: 1.6;
        }
        .section-header {
            padding: 8px 12px 3px; font-size: 10px; font-weight: 700; opacity: 0.5;
            color: var(--feezal-color, #555); text-transform: uppercase; letter-spacing: 0.06em;
        }
        .device-row {
            display: flex; align-items: center; gap: 8px; padding: 5px 12px;
            border-bottom: 1px solid var(--feezal-border, #f0f0f0);
        }
        .device-row:hover { background: var(--feezal-bg-sub, #f8f8f8); }
        .device-icon {
            font-size: 18px; flex-shrink: 0; opacity: 0.6;
            color: var(--feezal-color, #555);
        }
        .device-info { flex: 1; min-width: 0; }
        .device-name { font-size: 12px; font-weight: 500; color: var(--feezal-color, #333); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .device-topic { font-size: 10px; opacity: 0.5; color: var(--feezal-color, #666); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .add-btn {
            flex-shrink: 0; font-size: 11px; padding: 3px 8px;
            background: var(--sl-color-primary-600, #0284c7); color: #fff;
            border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;
        }
        .add-btn:hover:not(:disabled) { background: var(--sl-color-primary-700, #0369a1); }
        .add-btn:disabled { opacity: 0.38; cursor: default; background: var(--feezal-border, #ccc); color: #888; }
    `;

    constructor() {
        super();
        this._devices = [];
        this._loading = false;
        this._filter  = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this._fetch();
    }

    async _fetch() {
        this._loading = true;
        try {
            const r = await fetch('/api/discovery/devices');
            if (r.ok) {
                const {devices} = await r.json();
                this._devices = devices || [];
            }
        } catch { /* offline */ } finally {
            this._loading = false;
        }
    }

    render() {
        const filter = this._filter.toLowerCase();
        const filtered = filter
            ? this._devices.filter(d =>
                d.name.toLowerCase().includes(filter) ||
                (d.config?.state_topic || '').toLowerCase().includes(filter))
            : this._devices;

        // Group by component
        const groups = {};
        for (const d of filtered) (groups[d.component] ||= []).push(d);

        return html`
            <div class="header">
                <h3>Discovered Devices</h3>
                <button class="refresh-btn ${this._loading ? 'spinning' : ''}"
                    title="Refresh" @click="${this._fetch}">
                    <span class="material-icons" style="font-size:16px">refresh</span>
                </button>
            </div>
            <div class="filter-wrap">
                <sl-input size="small" placeholder="filter" clearable autocomplete="off"
                    .value="${this._filter}"
                    @sl-input="${e => { this._filter = e.target.value; }}"
                    @sl-clear="${() => { this._filter = ''; }}">
                </sl-input>
            </div>
            ${filtered.length === 0 ? html`
                <div class="empty">
                    ${this._loading
                        ? 'Loading\u2026'
                        : 'No devices discovered yet.\nConnect to a broker that publishes MQTT auto-discovery messages\n(zigbee2mqtt, ESPHome, Tasmota\u2026).'}
                </div>
            ` : Object.entries(groups).map(([component, devices]) => html`
                <div class="section-header">${component}</div>
                ${devices.map(d => this._renderDevice(d))}
            `)}
        `;
    }

    _renderDevice(d) {
        const tagName = COMPONENT_ELEMENT_MAP[d.component];
        const elExists = tagName && Boolean(window.customElements.get(tagName));
        const icon = COMPONENT_ICONS[d.component] || 'device_unknown';
        const topic = d.config?.state_topic || d.config?.command_topic || '';
        return html`
            <div class="device-row">
                <span class="device-icon material-icons">${icon}</span>
                <div class="device-info">
                    <div class="device-name" title="${d.name}">${d.name}</div>
                    <div class="device-topic" title="${topic}">${topic}</div>
                </div>
                <button class="add-btn"
                    ?disabled="${!elExists}"
                    title="${elExists ? 'Add to canvas' : 'Element not yet available'}"
                    @click="${() => this._addDevice(d)}">Add</button>
            </div>
        `;
    }

    _addDevice(entity) {
        const tagName = COMPONENT_ELEMENT_MAP[entity.component];
        if (!tagName || !window.customElements.get(tagName)) return;

        const el = document.createElement(tagName);
        feezal.view.append(el);
        feezal.editor.initElem(el, true);

        // Place near the centre of the visible canvas area
        const vw = feezal.view.clientWidth  || 400;
        const vh = feezal.view.clientHeight || 400;
        el.style.left = Math.max(0, Math.round((vw - 180) / 2)) + 'px';
        el.style.top  = Math.max(0, Math.round((vh - 220) / 2)) + 'px';

        this._applyDiscoveryMap(el, entity);

        feezal.editor.selectElement(el);
        feezal.app.change();
        feezal.app.sidebar = 'inspector'; // switch to inspector to show attributes
    }

    // Applies a discovery entity's config to an element using the element's
    // feezal().discovery.map descriptor. Shared logic with the inspector banner.
    _applyDiscoveryMap(el, entity) {
        const cls = window.customElements.get(el.localName);
        const discoveryMap = cls?.feezal?.discovery?.map;
        if (!discoveryMap) return;

        const cfg = entity.config || {};
        for (const [configKey, spec] of Object.entries(discoveryMap)) {
            const raw = cfg[configKey];
            if (raw === undefined || raw === null) continue;
            const attrName = typeof spec === 'string' ? spec : spec.attr;
            if (!attrName) continue;
            let value = raw;
            if (typeof spec === 'object') {
                if (spec.unit === 'mired\u2192kelvin') {
                    value = Math.round(1_000_000 / Number(raw));
                } else if (spec.valueMap) {
                    value = spec.valueMap[raw] ?? spec.valueMap['_default'] ?? raw;
                } else if (spec.transform === 'first') {
                    value = Array.isArray(raw) ? raw[0] : raw;
                }
            }
            el.setAttribute(attrName, String(value));
        }

        if (entity.discovery_id) el.setAttribute('discovery-id', entity.discovery_id);
    }
}

window.customElements.define('feezal-sidebar-palette', FeezalSidebarPalette);

