/**
 * @feezal/feezal-controller-sensor (E137)
 *
 * The boolean-sensor MQTT contract as a Lit Reactive Controller — the
 * behavior layer shared by every family's sensor card (Circle
 * material-motion, glass-occupancy, metro-occupancy, eink-sensor, …). The
 * family element is a VIEW: it reads the controller's plain state fields
 * and renders its own chrome; the controller owns subscriptions, payload
 * matching (incl. the z2m JSON `{state}` coercion and boolean coercion),
 * the E132 type vocabulary and the E124 low-battery contract.
 *
 * E137 packaging: controller class + attribute-descriptor fragment +
 * discovery.map fragment ship as ONE unit, and `consumes` declares the
 * attribute names the controller reads — the E114 parity test derives the
 * parity set from this declaration instead of a hand-maintained list.
 *
 * Config is read from HOST ATTRIBUTES (the saved-markup source of truth) —
 * uniform across families regardless of their property naming.
 */

import {
    SENSOR_TYPES, SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP,
    sensorType, batteryLowAttributes, batteryLowFromValue,
} from '@feezal/feezal-element/feezal-sensor-types.js';

// Re-export the vocabulary so views need a single import.
export {SENSOR_TYPES, SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP, sensorType, batteryLowFromValue};

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const sensorAttributes = [
    {name: 'subscribe', type: 'mqttTopic', help: 'Topic reporting the boolean sensor state.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
    {name: 'payload-active', type: 'string', default: 'ON', help: 'Payload meaning triggered / detected / occupied.'},
    {name: 'payload-clear',  type: 'string', default: 'OFF', help: 'Payload meaning clear / vacant.'},
    {name: 'type', type: 'select', options: SENSOR_TYPE_OPTIONS, default: 'motion',
        help: 'E132: sensor class — picks the default per-state icons, texts and (for alarm classes like water-leak/smoke) the error-coloured active state. Overridden by icon-active/icon-clear when set.'},
    {name: 'icon-active', type: 'icon', help: 'Icon shown while triggered — overrides the type default (empty = type default).'},
    {name: 'icon-clear',  type: 'icon', help: 'Icon shown while clear — overrides the type default (empty = type default).'},
    {name: 'text-active', type: 'string', default: '', help: 'State text while triggered. Empty = the type default (e.g. "Leak!" for water-leak).'},
    {name: 'text-clear',  type: 'string', default: '', help: 'State text while clear. Empty = the type default.'},
    // E124: dedicated low-battery warning (badge, never a blackout).
    ...batteryLowAttributes,
];

/** Shared discovery.map fragment (HA `binary_sensor`) — single-sourced. */
export const sensorDiscoveryMap = {
    state_topic:  {attr: 'subscribe'},
    payload_on:   {attr: 'payload-active'},
    payload_off:  {attr: 'payload-clear'},
    device_class: {attr: 'type', valueMap: SENSOR_DEVICE_CLASS_MAP},
    // N31 availability + E124 battery are auto-stamped from the canonical
    // records — no map lines needed.
    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
    name:           'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const SENSOR_CONSUMED_ATTRIBUTES = sensorAttributes.map(a => a.name);

export class SensorController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.active = false;
        this.batteryLow = false;
    }

    // ── attribute access (the saved markup is the source of truth) ──
    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    _prop(msg, specific) {
        return this.host.getProperty(msg, this._attr(specific) || this._attr('message-property') || 'payload');
    }

    get type() { return this._attr('type', 'motion'); }
    get typeInfo() { return sensorType(this.type); }

    /** Effective per-state icon (host override → type default). */
    icon(active = this.active) {
        return (active ? this._attr('icon-active') : this._attr('icon-clear'))
            || (active ? this.typeInfo.icon : this.typeInfo.iconClear);
    }

    /** Effective per-state text (host override → type default). */
    text(active = this.active) {
        return active
            ? (this._attr('text-active') || this.typeInfo.textActive)
            : (this._attr('text-clear') || this.typeInfo.textClear);
    }

    get alarm() { return Boolean(this.typeInfo.alarm); }

    signature() {
        return [this._attr('subscribe'), this._attr('subscribe-battery-low')].join('|');
    }

    hostConnected() {
        this.wire();
    }

    // hostDisconnected: the host's own disconnectedCallback tears every
    // subscription down (they live in host._subscriptions).

    /** Wire (or re-wire after host._unsubscribe()) all subscriptions. */
    wire() {
        this.__sig = this.signature();
        const subscribe = this._attr('subscribe');
        if (subscribe) {
            this.host.addSubscription(subscribe, msg => {
                // z2m JSON {state} coercion + boolean coercion (family contract).
                let v = this._prop(msg, 'message-property');
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this.active = String(v) === String(this._attr('payload-active', 'ON')) ||
                    v === true || v === 1 || v === '1';
                this.host.requestUpdate();
            });
        }
        const battery = this._attr('subscribe-battery-low');
        if (battery) {
            this.host.addSubscription(battery, msg => {
                const v = this._prop(msg, 'message-property-battery-low');
                this.batteryLow = batteryLowFromValue(v,
                    this._attr('payload-battery-low', 'true'),
                    Number(this._attr('battery-low-threshold', '15')));
                this.host.requestUpdate();
            });
        }
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }
}
