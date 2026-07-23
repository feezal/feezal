/* global feezal */
import {html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (metro chrome) over SensorController state.
// E138: the MOTION slice — presence/occupancy character (expected activity),
// active tile colour derives from the accent var (SensorController.activeColorVar()
// → --accent-color for every motion-slice type).
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-motion (E55, E138)
 *
 * Front-only Metro tile for a motion/presence sensor — the Device occupancy
 * card's (material-motion) contract in tile form: same payload matching
 * (payload-active/payload-clear incl. JSON {state} and boolean coercion),
 * the motion `type` variants (motion / presence / radar / zone — here they
 * pick the default icon), availability `!` badge and the same discovery
 * descriptor incl. `device_class` → type. The tile background carries the
 * state: accent while clear, the accent colour while motion is detected.
 *
 * `icon-active`/`icon-clear` override the type icon per state.
 */

class FeezalElementMetroMotion extends MetroTileBase {
    static get feezal() {
        return {
            // E138: MOTION slice — palette name "Motion".
            palette: {name: 'Motion', category: 'Metro', color: '#1ba1e2', icon: 'sensors'},
            description: 'Metro motion/presence tile (motion, presence, radar, zone): accent while clear, active accent colour while triggered. Display-only. Same MQTT contract as the Circle motion card.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137/E138: the shared sensor contract (subscribe/payloads/type/
                // icons/texts + the E124 battery trio) — MOTION slice of the
                // vocabulary, declared ONCE by the controller package.
                ...sensorAttributesFor('motion'),
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-active-color', type: 'color',
                    default: 'var(--accent-color, #fa6800)',
                    help: 'Tile colour while motion is detected / the zone is occupied (theme accent by default).'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            // E137: the discovery map is the controller package's fragment (motion slice).
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('motion')},
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
        /* E138: active default = the accent var (SensorController.activeColorVar()
           resolves the motion slice to --accent-color); --feezal-metro-active-color
           stays the per-element override. */
        :host { --feezal-metro-active-color: var(--accent-color, #fa6800); }
        .face { transition: background 0.15s; }
        :host([data-active]) .face { background: var(--feezal-metro-active-color); }
        .front { cursor: default; }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
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

customElements.define('feezal-element-metro-motion', FeezalElementMetroMotion);
export {FeezalElementMetroMotion};
