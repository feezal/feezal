/* global feezal */
/**
 * @feezal/feezal-controller-lock (E137)
 *
 * The smart-door-lock MQTT contract as a Lit Reactive Controller — shared by
 * every family's lock card (circle-lock, glass-lock, metro-lock, …). The
 * controller owns the state subscription (locked / unlocked / jammed), the
 * lock/unlock command publishing, the **E124 low-battery contract** (smart
 * locks are battery devices), and an optional **E135 error signal** carrying
 * the device's specific fault text (Keymatic clutch/motor faults, HmIP
 * jammed/load/end-stop errors). Config is read from HOST ATTRIBUTES (uniform
 * across families); availability is inherited from the FeezalElement base (N31).
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment as
 * one unit; `LOCK_CONSUMED_ATTRIBUTES` feeds the E114 parity-set derivation.
 */

import {batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';

export {batteryLowFromValue};

// E135: values on the error topic that mean "no fault" (case-insensitive).
// Everything else is treated as an active error and surfaced as text.
const ERROR_OK = new Set(['', '0', 'false', 'no error', 'no_error', 'noerror', 'none', 'ok', 'null', 'undefined']);

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const lockAttributes = [
    {name: 'subscribe',        type: 'mqttTopic', help: 'Topic receiving the lock state.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
    {name: 'publish',          type: 'mqttTopic', help: 'Topic to publish lock/unlock commands to.'},
    {name: 'payload-lock',     type: 'string', default: 'LOCK',     help: 'Command payload to lock.'},
    {name: 'payload-unlock',   type: 'string', default: 'UNLOCK',   help: 'Command payload to unlock.'},
    // Homematic locks (Keymatic / HmIP-DLD) have an OPEN action distinct from
    // unlock — it fully opens the door (releases the latch). Offered only when
    // configured (zigbee locks have no such action). Published to `publish-open`
    // if set, else to the main `publish` topic (HA `payload_open` convention).
    {name: 'publish-open',     type: 'mqttTopic', help: 'Optional separate topic for the OPEN action (fully opens the door, e.g. Homematic Keymatic OPEN). Leave blank to publish the open payload on the main command topic instead.'},
    {name: 'payload-open',     type: 'string', default: '',         help: 'Command payload that fully OPENS the door. Blank = no open action (most zigbee locks). Set it to offer an Open button.'},
    {name: 'payload-locked',   type: 'string', default: 'LOCKED',   help: 'State payload meaning locked.'},
    {name: 'payload-unlocked', type: 'string', default: 'UNLOCKED', help: 'State payload meaning unlocked.'},
    {name: 'payload-jammed',   type: 'string', default: 'JAMMED',   help: 'State payload meaning jammed.'},
    // E135: optional device fault signal — Keymatic ERROR (clutch/motor) or
    // HmIP-DLD fault flags. Any non-OK value is shown as an error badge + text.
    {name: 'subscribe-error',        type: 'mqttTopic', help: 'Optional device error/fault topic (E135). Non-OK values show a fault badge with the text.'},
    {name: 'message-property-error', type: 'string', help: 'Property path within error messages. Defaults to message-property.'},
    // E124: dedicated low-battery warning — smart locks are battery devices;
    // a weak battery is a badge, never a blackout (state keeps updating).
    ...batteryLowAttributes,
];

/** Shared discovery.map fragment (HA `lock`) — single-sourced. */
export const lockDiscoveryMap = {
    state_topic:    {attr: 'subscribe'},
    command_topic:  {attr: 'publish'},
    payload_lock:   {attr: 'payload-lock'},
    payload_unlock: {attr: 'payload-unlock'},
    state_locked:   {attr: 'payload-locked'},
    state_unlocked: {attr: 'payload-unlocked'},
    state_jammed:   {attr: 'payload-jammed'},
    // HA `lock` open action: payload_open published on the command topic.
    payload_open:   {attr: 'payload-open'},
    // Native-recognizer extras (undefined for HA/z2m locks → skipped): a
    // separate OPEN command topic (Homematic Keymatic OPEN datapoint) and a
    // device fault topic (E135) with its own value path.
    open_command_topic:     {attr: 'publish-open'},
    error_topic:            {attr: 'subscribe-error'},
    message_property_error: {attr: 'message-property-error'},
    // N31 availability + E124 battery auto-stamp from the canonical records.
    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
    name:           'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const LOCK_CONSUMED_ATTRIBUTES = lockAttributes.map(a => a.name);

export class LockController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.state = null;      // 'locked' | 'unlocked' | 'jammed' | null (unknown)
        this.batteryLow = false;
        this.error = '';        // E135: active fault text, '' = no error
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    _prop(msg, specific) {
        return this.host.getProperty(msg, this._attr(specific) || this._attr('message-property') || 'payload');
    }

    get locked()   { return this.state === 'locked'; }
    get unlocked() { return this.state === 'unlocked'; }
    get jammed()   { return this.state === 'jammed'; }
    /** True when the device reports a fault (jammed state OR an error signal). */
    get faulted()  { return this.state === 'jammed' || !!this.error; }
    /** Whether the OPEN action is available (Homematic locks only, when configured). */
    get canOpen()  { return !!this._attr('payload-open') || !!this._attr('publish-open'); }

    signature() {
        return [this._attr('subscribe'), this._attr('message-property'),
            this._attr('subscribe-error'), this._attr('subscribe-battery-low')].join('|');
    }

    hostConnected() {
        this.wire();
    }

    wire() {
        this.__sig = this.signature();

        const subscribe = this._attr('subscribe');
        if (subscribe) {
            this.host.addSubscription(subscribe, msg => {
                let v = this._prop(msg, 'message-property');
                // Tolerate a JSON object/string carrying a `state` field.
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* raw */ }
                } else if (v && typeof v === 'object' && 'state' in v) {
                    v = v.state;
                }
                const s = String(v).toUpperCase();
                if      (s === this._attr('payload-jammed',   'JAMMED').toUpperCase())   this.state = 'jammed';
                else if (s === this._attr('payload-locked',   'LOCKED').toUpperCase())   this.state = 'locked';
                else if (s === this._attr('payload-unlocked', 'UNLOCKED').toUpperCase()) this.state = 'unlocked';
                else this.state = null;
                this.host.requestUpdate();
            });
        }

        // E135: optional device fault text (Keymatic ERROR / HmIP-DLD flags).
        const error = this._attr('subscribe-error');
        if (error) {
            this.host.addSubscription(error, msg => {
                const v = this._prop(msg, 'message-property-error');
                const raw = (v === null || v === undefined) ? '' : String(v).trim();
                this.error = ERROR_OK.has(raw.toLowerCase()) ? '' : raw;
                this.host.requestUpdate();
            });
        }

        // E124: dedicated low-battery warning.
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

    /** Publish the lock command. */
    lock()   { this._cmd(this._attr('publish'), this._attr('payload-lock',   'LOCK')); }
    /** Publish the unlock command. */
    unlock() { this._cmd(this._attr('publish'), this._attr('payload-unlock', 'UNLOCK')); }
    /** Publish the OPEN command — separate topic if configured, else the main one. */
    open()   {
        const payload = this._attr('payload-open') || 'OPEN';
        this._cmd(this._attr('publish-open') || this._attr('publish'), payload);
    }

    _cmd(topic, payload) {
        if (topic) feezal.connection.pub(topic, payload);
    }

    /** Call from the host's updated() to re-wire on live topic edits. */
    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
        }
    }
}
