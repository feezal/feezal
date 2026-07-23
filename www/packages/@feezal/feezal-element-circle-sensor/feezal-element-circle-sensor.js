/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137/E138: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (Circle chrome: the E134 state disc). E138 split the alarm
// slice of the type vocabulary onto this dedicated card; the sibling
// feezal-element-circle-motion carries the motion slice + its SVG visuals.
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementCircleSensor extends FeezalElement {
    static get feezal() {
        return {
            // E138: palette name "Sensor" — the alarm slice of the boolean-sensor
            // vocabulary (water leak / smoke / gas / CO / vibration / tamper / …).
            // Motion / occupancy sensors live on the sibling material-motion card.
            palette: {name: 'Sensor', category: 'Circle', color: '#1565c0', icon: 'sensors'},
            description: 'Alarm-character boolean sensor card — water leak, smoke, gas, CO, vibration, tamper … Renders ' +
                'the E134 circle state disc with the type icon, error-coloured while triggered. Boolean-sensor behavior ' +
                'from the shared controller (alarm slice of the E132 type vocabulary); motion sensors use material-motion.',
            // E137/E138: the discovery map is the controller package's alarm-slice
            // fragment — routes smoke/moisture/gas/CO/vibration/tamper classes only.
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('alarm')},
            attributes: [
                // E137/E138: the shared sensor contract, alarm slice — declared
                // ONCE by the controller package, spread by every family view.
                ...sensorAttributesFor('alarm'),
                {name: 'label',                  type: 'string',    default: '',    help: 'Optional card label shown below the visual.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-sensor-active-color', type: 'color', default: 'var(--error-color)', help: 'Colour shown when the sensor is triggered. E138: the alarm-slice active default is --error-color (SensorController.activeColorVar()); override per element.'},
                {property: '--feezal-sensor-text-color',   type: 'color', default: 'var(--primary-text-color)', help: 'Label / state text colour.'},
                {property: '--feezal-sensor-error-color',  type: 'color', default: 'var(--error-color)', help: 'Colour for alarm-class triggered state and the unavailability badge.'},
            ],
            restrict:     {minWidth: 60, minHeight: 80},
            defaultStyle: {width: '80px', height: '120px'},
        };
    }

    static properties = {
        subscribe:             {type: String, reflect: true},
        payloadActive:         {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:          {type: String, reflect: true, attribute: 'payload-clear'},
        type:                  {type: String, reflect: true},
        iconActive:            {type: String, reflect: true, attribute: 'icon-active'},
        iconClear:             {type: String, reflect: true, attribute: 'icon-clear'},
        textActive:            {type: String, reflect: true, attribute: 'text-active'},
        textClear:             {type: String, reflect: true, attribute: 'text-clear'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow:   {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:     {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:     {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold:   {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        label:                 {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        // E137: sensor state lives on the SensorController.
        discoveryId:           {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBatteryStyles, feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;
            /* E134: the state disc sizes its content in cqi (card width). */
            container-type: inline-size;
            /* E138: alarm-slice active default → --error-color (activeColorVar). */
            --feezal-sensor-active-color: var(--error-color, #b00020);
            --feezal-sensor-text-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-sensor-error-color:  var(--error-color, #b00020);
            color: var(--feezal-sensor-text-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-sensor-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* B50/E134: width-sized, TOP-anchored — the exact material-light
           ring pattern (.ring-wrap: width:100% + flex-shrink:0, NOT flex:1,
           so the disc never stretches to the card height → always a circle,
           never an ellipse). Rows below (label) stack underneath and clip on
           too-short cards, exactly like the light card's controls. */
        /* E139: the disc sits in a square (aspect-ratio:1) wrap = the light/climate
           ring footprint and is centred, so its centre aligns concentrically with
           those rings across every Circle card. */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        /* E134: the circle state disc — width-sized circle at the top of the
           card, centred type icon, ring/fill while active, ERROR colour for
           alarm classes, muted while clear. cqi units scale with the card. */
        .disc {
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 1cqi;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .disc feezal-icon { font-size: 26cqi; line-height: 1; opacity: 0.55; }
        .disc .htext { font-size: 8cqi; font-weight: 600; opacity: 0.75; }
        .disc.active {
            color: var(--feezal-sensor-active-color);
            border-color: var(--feezal-sensor-active-color);
            background: color-mix(in srgb, var(--feezal-sensor-active-color) 16%, transparent);
        }
        .disc.active feezal-icon { opacity: 1; }
        .disc.alarm.active {
            color: var(--feezal-sensor-error-color);
            border-color: var(--feezal-sensor-error-color);
            background: color-mix(in srgb, var(--feezal-sensor-error-color) 16%, transparent);
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-sensor-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.payloadActive         = 'ON';
        this.payloadClear          = 'OFF';
        this.type                  = 'generic';
        this.iconActive            = '';
        this.iconClear             = '';
        this.textActive            = '';
        this.textClear             = '';
        this.subscribeBatteryLow   = '';
        this.msgPropBatteryLow     = '';
        this.payloadBatteryLow     = 'true';
        this.batteryLowThreshold   = 15;
        this.label                 = '';
        this.discoveryId           = '';
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.sensor = new SensorController(this);
    }

    // Device cards manage subscriptions manually; suppress the base-class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.sensor.rewireIfChanged();
    }

    render() {
        const s = this.sensor;
        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${batteryLowBadge(s.batteryLow)}
            <div class="disc-wrap">
                <div class="disc ${s.active ? 'active' : ''} ${s.alarm ? 'alarm' : ''}">
                    <feezal-icon name="${s.icon()}"></feezal-icon>
                    <span class="htext">${s.text()}</span>
                </div>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-sensor', FeezalElementCircleSensor);
export {FeezalElementCircleSensor};
