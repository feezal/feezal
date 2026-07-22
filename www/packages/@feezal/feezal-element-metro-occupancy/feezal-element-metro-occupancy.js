/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP, sensorType, batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-occupancy (E55)
 *
 * Front-only Metro tile for a motion/presence sensor — the Device occupancy
 * card's (material-motion) contract in tile form: same payload matching
 * (payload-active/payload-clear incl. JSON {state} and boolean coercion),
 * the same `type` variants (motion / presence / radar / zone — here they
 * pick the default icon), availability `!` badge and the same discovery
 * descriptor incl. `device_class` → type. The tile background carries the
 * state: accent while clear, active colour while motion is detected.
 *
 * `icon-active`/`icon-clear` override the type icon per state.
 */

class FeezalElementMetroOccupancy extends MetroTileBase {
    static get feezal() {
        return {
            // E132: palette name "Sensor" — the generalized boolean-sensor
            // tile (motion + water/smoke/gas/… hazard classes). The tag stays
            // metro-occupancy until the alias mechanism exists.
            palette: {name: 'Sensor', category: 'Metro', color: '#1ba1e2', icon: 'sensors'},
            description: 'Metro boolean-sensor tile (motion, presence, water leak, smoke, gas, …): accent while clear, active/alarm colour while triggered. Display-only. Same MQTT contract as the Circle sensor card.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'payload-active', type: 'string', default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',  type: 'string', default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type', type: 'select', options: SENSOR_TYPE_OPTIONS, default: 'motion',
                    help: 'E132: sensor class — picks the default per-state icons, texts and (for alarm classes like water-leak/smoke) the error-coloured active state. Overridden by icon-active/icon-clear when set.'},
                {name: 'icon-active', type: 'icon', help: 'Icon shown while triggered — overrides the type default (empty = type default).'},
                {name: 'icon-clear',  type: 'icon', help: 'Icon shown while clear — overrides the type default (empty = type default).'},
                {name: 'text-active', type: 'string', default: '', help: 'State text while triggered. Empty = the type default (e.g. "Leak!" for water-leak).'},
                {name: 'text-clear',  type: 'string', default: '', help: 'State text while clear. Empty = the type default.'},
                // E124: dedicated low-battery warning (shared descriptor trio).
                ...batteryLowAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-active-color', type: 'color',
                    default: 'var(--warning-color, #fa6800)',
                    help: 'Tile colour while motion is detected / the zone is occupied.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:  'subscribe',
                    payload_on:   'payload-active',
                    payload_off:  'payload-clear',
                    device_class: {attr: 'type', valueMap: SENSOR_DEVICE_CLASS_MAP},   // E132: shared hazard-aware map
                    // N31: availability is mapped automatically from the canonical discovery record.
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        payloadActive: {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:  {type: String, reflect: true, attribute: 'payload-clear'},
        type:          {type: String, reflect: true},
        iconActive:    {type: String, reflect: true, attribute: 'icon-active'},
        iconClear:     {type: String, reflect: true, attribute: 'icon-clear'},
        textActive:    {type: String, reflect: true, attribute: 'text-active'},
        textClear:     {type: String, reflect: true, attribute: 'text-clear'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        // N31: availability inherited from FeezalElement.
        discoveryId:   {type: String, reflect: true, attribute: 'discovery-id'},
        _active:     {state: true},
        _batteryLow: {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-active-color: var(--warning-color, #fa6800); }
        .face { transition: background 0.15s; }
        :host([data-active]) .face { background: var(--feezal-metro-active-color); }
        /* E132: alarm classes (water-leak/smoke/gas/co/tamper) go error-red
           while triggered — an active fire alarm is not a neutral state chip. */
        :host([data-alarm][data-active]) .face { background: var(--error-color, #e51400); }
        .front { cursor: default; }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
        /* E124: low-battery warning, top-left (the ! badge owns top-right). */
        .batt {
            position: absolute; top: 4px; left: 6px;
            font-size: 15px; color: var(--feezal-metro-text, #fff); opacity: 0.9;
        }
    `];

    constructor() {
        super();
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'motion';
        this.iconActive = '';
        this.iconClear = '';
        this.textActive = '';
        this.textClear = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.discoveryId = '';
        this._active = false;
        this._batteryLow = false;
        this._available = true;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                // material-motion coercion: JSON {state} payloads + booleans.
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._active = String(v) === String(this.payloadActive) ||
                    v === true || v === 1 || v === '1';
            });
        }
        // E124: dedicated low-battery warning — a weak battery is a badge,
        // never a blackout (the state above keeps updating).
        if (this.subscribeBatteryLow) {
            this.addSubscription(this.subscribeBatteryLow, msg => {
                const v = this.getProperty(msg, this.msgPropBatteryLow || this.messageProperty);
                this._batteryLow = batteryLowFromValue(v, this.payloadBatteryLow, this.batteryLowThreshold);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('_active')) this.toggleAttribute('data-active', this._active);
        if (changed.has('type')) this.toggleAttribute('data-alarm', Boolean(sensorType(this.type).alarm));
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const t = sensorType(this.type);
        const icon = (this._active ? this.iconActive : this.iconClear)
            || (this._active ? t.icon : t.iconClear);
        const text = this._active ? (this.textActive || t.textActive) : (this.textClear || t.textClear);
        return html`
            ${this._batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
            <feezal-icon name="${icon}"></feezal-icon>
            <div class="state">${text}</div>`;
    }
}

customElements.define('feezal-element-metro-occupancy', FeezalElementMetroOccupancy);
export {FeezalElementMetroOccupancy};
