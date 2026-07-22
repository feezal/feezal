/* global feezal */
import {html, css} from '@feezal/feezal-element';
// E137: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (metro chrome) over SensorController state.
import {SensorController, sensorAttributes, sensorDiscoveryMap} from '@feezal/feezal-controller-sensor';
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
                // E137: the shared sensor contract (subscribe/payloads/type/
                // icons/texts + the E124 battery trio) — declared ONCE by the
                // controller package, spread by every family.
                ...sensorAttributes,
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
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMap},
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
        // E137: sensor state lives on the SensorController (plain fields +
        // host.requestUpdate) — no reactive state properties needed.
        discoveryId:   {type: String, reflect: true, attribute: 'discovery-id'},
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
        this._available = true;
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.sensor = new SensorController(this);
    }

    // The controller wires everything in hostConnected — no override needed.

    updated(changed) {
        super.updated(changed);
        this.sensor.rewireIfChanged();
        this.toggleAttribute('data-active', this.sensor.active);
        this.toggleAttribute('data-alarm', this.sensor.alarm);
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        return html`
            ${this.sensor.batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
            <feezal-icon name="${this.sensor.icon()}"></feezal-icon>
            <div class="state">${this.sensor.text()}</div>`;
    }
}

customElements.define('feezal-element-metro-occupancy', FeezalElementMetroOccupancy);
export {FeezalElementMetroOccupancy};
