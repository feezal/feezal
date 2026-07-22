/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {SENSOR_TYPE_OPTIONS, SENSOR_DEVICE_CLASS_MAP, sensorType, batteryLowAttributes, batteryLowFromValue} from '@feezal/feezal-element/feezal-sensor-types.js';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-occupancy (E58)
 *
 * Frosted-glass motion/presence card. Same MQTT capability contract as the
 * Device occupancy card (feezal-element-material-motion) — attribute names,
 * payload matching incl. JSON {state} and boolean coercion, the `type`
 * variants (motion / presence / radar / zone — here they pick the default
 * icon), availability badge and the same HA discovery descriptor incl.
 * `device_class` → type. The card highlights while motion is detected.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

class FeezalElementGlassOccupancy extends FeezalElement {
    static get feezal() {
        return {
            // E132: palette name "Sensor" — the generalized boolean-sensor
            // card (motion + water/smoke/gas/… hazard classes). The tag stays
            // glass-occupancy until the alias mechanism exists.
            palette: {name: 'Sensor', category: 'Glass', color: '#7aa5c9', icon: 'sensors'},
            description: 'Frosted-glass boolean-sensor card (motion, presence, water leak, smoke, gas, …) — ' +
                'highlights while triggered, error-coloured for alarm classes. Same MQTT contract as the Circle sensor card.',
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:  {attr: 'subscribe'},
                    payload_on:   {attr: 'payload-active'},
                    payload_off:  {attr: 'payload-clear'},
                    device_class: {attr: 'type', valueMap: SENSOR_DEVICE_CLASS_MAP},   // E132: shared hazard-aware map
                    // N31: availability is mapped automatically from the canonical discovery record.
                    value_template:        {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'subscribe',        type: 'mqttTopic', help: 'Topic reporting motion or presence state.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Property path within the message payload (dot-notation). Default: payload'},
                {name: 'payload-active',   type: 'string', default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',    type: 'string', default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type', type: 'select', options: SENSOR_TYPE_OPTIONS, default: 'motion',
                    help: 'E132: sensor class — picks the default per-state icons, texts and (for alarm classes like water-leak/smoke) the error-coloured active state.'},
                {name: 'icon',  type: 'string', help: 'Explicit icon name — overrides the type default in BOTH states.'},
                {name: 'icon-active', type: 'icon', help: 'Icon shown while triggered — overrides the type default (empty = type default).'},
                {name: 'icon-clear',  type: 'icon', help: 'Icon shown while clear — overrides the type default (empty = type default).'},
                {name: 'text-active', type: 'string', default: '', help: 'State text while triggered. Empty = the type default (e.g. "Leak!" for water-leak).'},
                {name: 'text-clear',  type: 'string', default: '', help: 'State text while clear. Empty = the type default.'},
                // E124: dedicated low-battery warning (shared descriptor trio).
                ...batteryLowAttributes,
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-active-color', type: 'color', default: 'var(--warning-color, #ff9f0a)', help: 'Icon/state colour while detected.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        size:          {type: String,  reflect: true},
        payloadActive: {type: String,  reflect: true, attribute: 'payload-active'},
        payloadClear:  {type: String,  reflect: true, attribute: 'payload-clear'},
        type:          {type: String,  reflect: true},
        icon:          {type: String,  reflect: true},
        iconActive:    {type: String,  reflect: true, attribute: 'icon-active'},
        iconClear:     {type: String,  reflect: true, attribute: 'icon-clear'},
        textActive:    {type: String,  reflect: true, attribute: 'text-active'},
        textClear:     {type: String,  reflect: true, attribute: 'text-clear'},
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        label:         {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:       {type: Boolean, reflect: true},
        discoveryId:   {type: String,  reflect: true, attribute: 'discovery-id'},
        _active:     {state: true},
        _batteryLow: {state: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card {
            gap: 2px;
            transition: background 0.2s ease;
            --_state-color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .card.active {
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62));
            --_state-color: var(--feezal-glass-active-color, #ff9f0a);
        }
        /* E132: alarm classes (water-leak/smoke/gas/co/tamper) show their
           ACTIVE state in the error colour — not a neutral state chip. */
        :host([data-alarm]) .card.active { --_state-color: var(--error-color, #d32f2f); }
        /* E124: low-battery warning, bottom-left (⚠ unavail owns top-right). */
        .batt {
            position: absolute; bottom: 8px; left: 10px;
            font-size: 14px; color: var(--warning-color, #ff9800); opacity: 0.9;
        }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--_state-color); transition: color 0.2s ease; }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; color: var(--_state-color); }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; top: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* E105: much wider than tall → horizontal layout (Apple-Home wide
           tile): icon left, state/label stacked right of it. */
        @container (min-aspect-ratio: 2/1) {
            .card {
                display: grid;
                grid-template: 'icon state' auto 'icon label' auto / auto 1fr;
                align-content: center;
                align-items: center;
                column-gap: 10px;
                text-align: left;
            }
            .card > feezal-icon { grid-area: icon; }
            .card .state { grid-area: state; align-self: end; }
            .card .label { grid-area: label; align-self: start; }
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'motion';
        this.icon = '';
        this.iconActive = '';
        this.iconClear = '';
        this.textActive = '';
        this.textClear = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.label = '';
        this.degrade = false;
        this.discoveryId = '';
        this._active = false;
        this._batteryLow = false;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Topic attributes changed at runtime (inspector edits on the live
     * canvas) → updated() rewires instead of keeping the stale topics. */
    _wireSignature() {
        return [this.subscribe, this.subscribeBatteryLow].join('|');
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
        if (changed.has('type')) this.toggleAttribute('data-alarm', Boolean(sensorType(this.type).alarm));
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

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

    render() {
        return html`
            <div class="card ${this._active ? 'active' : ''}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                ${this._batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
                <feezal-icon name="${this.icon
                    || (this._active ? this.iconActive : this.iconClear)
                    || (this._active ? sensorType(this.type).icon : sensorType(this.type).iconClear)}"></feezal-icon>
                <span class="state">${this._active
                    ? (this.textActive || sensorType(this.type).textActive)
                    : (this.textClear || sensorType(this.type).textClear)}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Sensor' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-occupancy', FeezalElementGlassOccupancy);
export {FeezalElementGlassOccupancy};
