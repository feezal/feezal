/**
 * @feezal/feezal-controller-contact (E137)
 *
 * The door/window-contact MQTT contract as a Lit Reactive Controller —
 * shared by every family's contact card (Circle material-contact,
 * glass-contact, metro-contact, eink-contact, …). The controller owns the
 * state subscription (open / closed / tilted via the shared payloadMatch,
 * incl. the B27 tristate), and the **E124 low-battery contract** — this is
 * where contacts finally get the dedicated battery warning instead of the
 * folded-into-availability compromise.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment
 * as one unit; `consumes` feeds the E114 parity-set derivation. Config is
 * read from HOST ATTRIBUTES (uniform across families).
 */

import {payloadMatch} from '@feezal/feezal-element';
import {batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';

export {payloadMatch, batteryLowFromValue};

export const CONTACT_TYPES = ['window', 'door', 'generic', 'waterleak', 'firealarm', 'garagedoor'];

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const contactAttributes = [
    {name: 'subscribe', type: 'mqttTopic', help: 'Contact state topic.'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
    {name: 'payload-open',   type: 'string', default: 'ON',  help: 'Payload value meaning the contact is open.'},
    {name: 'payload-closed', type: 'string', default: 'OFF', help: 'Payload value meaning the contact is closed.'},
    {name: 'payload-tilted', type: 'string', default: '',
        help: 'Payload meaning the window is tilted/vented (e.g. Homematic rotary handle: 1). Leave blank to disable the tilt state. Window type only.'},
    {name: 'type', type: 'select', options: CONTACT_TYPES, default: 'window',
        help: 'Visual style — window (with tilt + handle), door, generic contact, water leak, fire alarm, or garage door.'},
    // E124: dedicated low-battery warning — contacts are battery devices;
    // a weak battery is a badge, never a blackout (state keeps updating).
    ...batteryLowAttributes,
];

/** Shared discovery.map fragment (HA `binary_sensor`) — single-sourced. */
export const contactDiscoveryMap = {
    state_topic:    {attr: 'subscribe'},
    payload_on:     {attr: 'payload-open'},
    payload_off:    {attr: 'payload-closed'},
    // Set by the native Homematic ROTARY_HANDLE recognizer; HA/z2m
    // binary_sensor entities lack it → skipped (undefined config key).
    payload_tilted: {attr: 'payload-tilted'},
    device_class:   {attr: 'type', valueMap: {window: 'window', door: 'door', moisture: 'waterleak', smoke: 'firealarm', garage_door: 'garagedoor', _default: 'window'}},
    // N31 availability + E124 battery auto-stamp from the canonical records.
    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
    name:           'label',
};

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const CONTACT_CONSUMED_ATTRIBUTES = contactAttributes.map(a => a.name);

export class ContactController {
    /** @param {import('lit').ReactiveControllerHost & HTMLElement} host */
    constructor(host) {
        this.host = host;
        host.addController?.(this);
        // ── state (plain fields, E137 decided) ──
        this.state = 'closed';        // 'open' | 'closed' | 'tilted'
        this.batteryLow = false;
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    _prop(msg, specific) {
        return this.host.getProperty(msg, this._attr(specific) || this._attr('message-property') || 'payload');
    }

    get type() { return this._attr('type', 'window'); }
    get open() { return this.state === 'open'; }
    get tilted() { return this.state === 'tilted'; }

    signature() {
        return [this._attr('subscribe'), this._attr('subscribe-battery-low')].join('|');
    }

    hostConnected() {
        this.wire();
    }

    wire() {
        this.__sig = this.signature();
        const subscribe = this._attr('subscribe');
        if (subscribe) {
            this.host.addSubscription(subscribe, msg => {
                const v = this._prop(msg, 'message-property');
                const tilted = this._attr('payload-tilted');
                if (tilted && payloadMatch(v, tilted)) this.state = 'tilted';
                else if (payloadMatch(v, this._attr('payload-open', 'ON'))) this.state = 'open';
                else this.state = 'closed';
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
