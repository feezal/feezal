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
 * **E154 — movement.** A motor lock takes a second or two to turn, and the card
 * used to snap between locked ⇄ unlocked with nothing shown in between. The
 * controller now owns a transitional state (`movement` = locking / unlocking /
 * opening / moving) driven by the E128 `MovementController`:
 *   - a user command enters it immediately (the device confirms only when done),
 *   - an optional movement datapoint (Keymatic `DIRECTION` — NONE / UP / DOWN /
 *     UNDEFINED, verified against OpenCCU-Base `rf_keymatic.xml`; Keymatic has
 *     no `WORKING`, `DIRECTION` plays that role) is the authority while wired,
 *     so movement started elsewhere (a physical key turn) shows too,
 *   - without a movement datapoint the expected STATE ends it,
 *   - a `movement-timeout` fallback always resolves it.
 * Devices that expose no movement signal are unaffected: the transitional state
 * then only spans a local command, exactly like a card without the feature.
 *
 * E137 packaging: controller + attribute fragment + discovery.map fragment as
 * one unit; `LOCK_CONSUMED_ATTRIBUTES` feeds the E114 parity-set derivation.
 */

import {batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {MovementController, parseDirection} from '@feezal/feezal-element/feezal-movement.js';

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
    {name: 'subscribe-error',        type: 'mqttTopic', help: 'Optional device error/fault topic. Non-OK values show a fault badge with the text.'},
    {name: 'message-property-error', type: 'string', help: 'Property path within error messages. Defaults to message-property.'},
    // E154: optional movement signal — the motor is turning. Keymatic publishes
    // DIRECTION (NONE / UP / DOWN / UNDEFINED); other locks may publish a plain
    // boolean "working" flag. Both shapes are read by the same attribute.
    {name: 'subscribe-direction', type: 'mqttTopic', section: 'Movement',
        help: 'Optional movement topic (Homematic Keymatic DIRECTION: NONE / UP / DOWN / UNDEFINED, or a boolean "motor running" flag). While it reports movement the card shows a transitional locking / unlocking state instead of snapping.'},
    {name: 'message-property-direction', type: 'string', default: 'payload.val', section: 'Movement',
        help: 'Property path for the movement topic (mqtt-smarthome: payload.val).'},
    {name: 'payload-direction-lock',   type: 'string', default: 'DOWN', size: 'half', section: 'Movement',
        help: 'Value on the movement topic meaning the motor is LOCKING. The Homematic enum index (2) is also accepted. Which way a Keymatic turns is device/mounting specific — swap this with the unlock value if the card names the wrong direction.'},
    {name: 'payload-direction-unlock', type: 'string', default: 'UP', size: 'half', section: 'Movement',
        help: 'Value on the movement topic meaning the motor is UNLOCKING. The Homematic enum index (1) is also accepted. Anything else (NONE / UNDEFINED / 0 / false) reads as "not moving".'},
    {name: 'movement-timeout', type: 'number', default: 20, section: 'Movement',
        help: 'Seconds after a command (or a lost movement signal) before the card gives up the transitional state and shows the reported one. Keeps a card from being stuck on "locking…".'},
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
    // E154: observed-only movement datapoint (Keymatic DIRECTION) — the
    // recognizer emits these keys ONLY when the datapoint is actually seen on
    // the broker, never guessed (the E127/E128 rule).
    direction_topic:            {attr: 'subscribe-direction'},
    message_property_direction: {attr: 'message-property-direction'},
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
        this._movement = null;  // E154: MovementController, created in wire()
    }

    // ── E154: movement ───────────────────────────────────────────────────────
    /** '' while idle, else 'locking' | 'unlocking' | 'opening' | 'moving'. */
    get movement() { return this._movement?.intent ?? ''; }
    /** True while the motor is (believed to be) turning. */
    get moving()   { return this.movement !== ''; }
    /** Human-readable transitional text, '' while idle. */
    get movementText() {
        return {locking: 'locking…', unlocking: 'unlocking…', opening: 'opening…', moving: 'moving…'}[this.movement] || '';
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return v === null ? fallback : v;
    }

    /** `fallback` is the descriptor default for topics whose payload shape is
     *  fixed by the dialect (E154's mqtt-smarthome `payload.val`) — it wins
     *  over the element-level message-property, which describes the STATE
     *  payload, not this one. */
    _prop(msg, specific, fallback) {
        return this.host.getProperty(msg, this._attr(specific) || fallback || this._attr('message-property') || 'payload');
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
            this._attr('subscribe-error'), this._attr('subscribe-battery-low'),
            this._attr('subscribe-direction'), this._attr('movement-timeout')].join('|');
    }

    hostConnected() {
        this.wire();
    }

    hostDisconnected() {
        // E154: drop the pending transitional-state timer with the subscriptions.
        this._movement?.dispose();
        this._movement = null;
    }

    wire() {
        this.__sig = this.signature();

        // E154: the transitional-state holder. Recreated with the subscriptions
        // so a live topic edit re-reads signalWired / the timeout.
        const directionTopic = this._attr('subscribe-direction');
        const timeout = Number(this._attr('movement-timeout', '20'));
        this._movement?.dispose();
        this._movement = new MovementController({
            onChange: () => this.host.requestUpdate(),
            timeoutMs: (Number.isFinite(timeout) && timeout > 0 ? timeout : 20) * 1000,
            signalWired: Boolean(directionTopic),
        });

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
                // E154: a jam resolves the transitional state immediately —
                // whatever the motor was doing, it is over and it failed.
                if (this.state === 'jammed') this._movement.signal(false);
                else this._movement.report(this.state);
                this.host.requestUpdate();
            });
        }

        // E154: optional movement datapoint (Keymatic DIRECTION / a boolean
        // motor flag). While wired it is the authority on when movement ends.
        if (directionTopic) {
            this.host.addSubscription(directionTopic, msg => {
                const raw = this._prop(msg, 'message-property-direction', 'payload.val');
                const dir = parseDirection(raw,
                    this._attr('payload-direction-unlock', 'UP'),
                    this._attr('payload-direction-lock', 'DOWN'));
                // A plain boolean "motor running" flag has no direction: treat a
                // truthy value as movement of unknown intent.
                const booleanActive = raw === true || raw === 'true';
                if (dir) this._movement.signal(true, dir === 'up' ? 'unlocking' : 'locking');
                else if (booleanActive) this._movement.signal(true, 'moving');
                else this._movement.signal(false);
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
    lock()   {
        this._cmd(this._attr('publish'), this._attr('payload-lock', 'LOCK'));
        this._movement?.command('locking', 'locked');       // E154
    }
    /** Publish the unlock command. */
    unlock() {
        this._cmd(this._attr('publish'), this._attr('payload-unlock', 'UNLOCK'));
        this._movement?.command('unlocking', 'unlocked');   // E154
    }
    /** Publish the OPEN command — separate topic if configured, else the main one. */
    open()   {
        const payload = this._attr('payload-open') || 'OPEN';
        this._cmd(this._attr('publish-open') || this._attr('publish'), payload);
        // OPEN releases the latch: the lock ends up unlocked.
        this._movement?.command('opening', 'unlocked');     // E154
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
