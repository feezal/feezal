/* global feezal */
import {html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (metro chrome) over SensorController state.
// E138: the ALARM slice — hazard character (water leak / smoke / gas / co /
// vibration / tamper / generic). Active tile colour derives from the error var
// (SensorController.activeColorVar() → --error-color for every alarm-slice type):
// a triggered fire/leak alarm is not a neutral state chip.
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-sensor (E138)
 *
 * Front-only Metro tile for an alarm/hazard binary sensor — the ALARM slice
 * of the shared sensor contract in tile form: same payload matching
 * (payload-active/payload-clear incl. JSON {state} and boolean coercion),
 * the alarm `type` variants (water-leak / smoke / gas / co / vibration /
 * tamper / generic — they pick the default icons and texts), availability `!`
 * badge, the E124 battery badge and the discovery descriptor incl.
 * `device_class` → type. The tile background carries the state: accent while
 * clear, error-red while the alarm is triggered.
 *
 * `icon-active`/`icon-clear` override the type icon per state.
 */

class FeezalElementMetroSensor extends MetroTileBase {
    static get feezal() {
        return {
            // E138: ALARM slice — palette name "Sensor".
            palette: {name: 'Sensor', category: 'Metro', color: '#1ba1e2', icon: 'sensors'},
            description: 'Metro alarm-sensor tile (water leak, smoke, gas, co, vibration, tamper): accent while clear, error-red while triggered. Display-only. Same MQTT contract as the Circle sensor card.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137/E138: the shared sensor contract (subscribe/payloads/type/
                // icons/texts + the E124 battery trio) — ALARM slice of the
                // vocabulary, declared ONCE by the controller package.
                ...sensorAttributesFor('alarm'),
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-active-color', type: 'color',
                    default: 'var(--error-color, #e51400)',
                    help: 'Tile colour while the alarm is triggered (theme error colour by default).'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            // E137: the discovery map is the controller package's fragment (alarm slice).
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('alarm')},
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

    static styles = [feezalBatteryStyles, MetroTileBase.styles, css`
        /* E138: active default = the error var (SensorController.activeColorVar()
           resolves the alarm slice to --error-color); --feezal-metro-active-color
           stays the per-element override. */
        :host { --feezal-metro-active-color: var(--error-color, #e51400); }
        .face { transition: background 0.15s; }
        :host([data-active]) .face { background: var(--feezal-metro-active-color); }
        .front { cursor: default; }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
    `];

    constructor() {
        super();
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'generic';
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
        // E132/E138: alarm-class styling hook on the host (error colour).
        this.toggleAttribute('data-alarm', this.sensor.alarm);
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        return html`
            ${batteryLowBadge(this.sensor.batteryLow)}
            <feezal-icon name="${this.sensor.icon()}"></feezal-icon>
            <div class="state">${this.sensor.text()}</div>`;
    }
}

customElements.define('feezal-element-metro-sensor', FeezalElementMetroSensor);
export {FeezalElementMetroSensor};
