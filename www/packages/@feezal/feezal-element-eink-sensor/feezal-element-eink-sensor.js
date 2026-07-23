/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (eink chrome: inverted block while active).
// E138: alarm slice of the type vocabulary (motion lives in eink-motion).
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';

/**
 * feezal-element-eink-sensor (E57 · E138 alarm slice)
 *
 * E-ink ALARM-sensor card (water-leak / smoke / gas / CO / vibration / …):
 * icon + oversized state word, whole card INVERTS while active (the 1-bit
 * "attention" treatment). Motion/occupancy/presence live in eink-motion.
 * Same contract as the other sensor cards (E132 type table + E124 battery).
 *
 * E138 note: SensorController.activeColorVar() (motion → --accent-color,
 * alarm → --error-color) is IRRELEVANT on this 1-bit display — the inverted
 * block IS the active treatment; there is no colour to set here.
 */

class FeezalElementEinkSensor extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Sensor', category: 'Eink', color: '#222222', icon: 'sensors'},
            description: 'E-ink alarm-sensor card (leak / smoke / gas / CO / …) — inverted block while active, 1-bit, redraw-deduped.',
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('alarm')},
            attributes: [
                // E137/E138: the shared sensor contract, ALARM slice of the
                // type vocabulary (subscribe/payloads/type/icons/texts + the
                // E124 battery trio) — declared ONCE.
                ...sensorAttributesFor('alarm'),
                {name: 'label', type: 'string', help: 'Label under the state (rendered uppercase).'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '22px', help: 'State word font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '180px', height: '120px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        type:       {type: String, reflect: true},
        subscribe:  {type: String, reflect: true},
        msgProp:    {type: String, reflect: true, attribute: 'message-property'},
        payloadActive: {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:  {type: String, reflect: true, attribute: 'payload-clear'},
        iconActive: {type: String, reflect: true, attribute: 'icon-active'},
        iconClear:  {type: String, reflect: true, attribute: 'icon-clear'},
        textActive: {type: String, reflect: true, attribute: 'text-active'},
        textClear:  {type: String, reflect: true, attribute: 'text-clear'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        label:       {type: String, reflect: true},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBatteryStyles, feezalBaseStyles, einkCardStyles, css`
        .card { gap: 2px; align-items: flex-start; }
        feezal-icon { font-size: var(--feezal-eink-icon-size, 28px); line-height: 1; }
        .state { font-size: var(--feezal-eink-font-size-value, 22px); line-height: 1.05;
            text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `];

    constructor() {
        super();
        this.type = 'generic'; // E138: alarm-slice default type
        this.subscribe = '';
        this.msgProp = '';
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.iconActive = '';
        this.iconClear = '';
        this.textActive = '';
        this.textClear = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.label = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.sensor = new SensorController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.sensor.rewireIfChanged();
    }

    /** E57 redraw dedup: state word + icon + badges are the visible output. */
    renderSignature() {
        return [this.sensor.active, this.sensor.icon(), this.sensor.text(),
            this.sensor.batteryLow, this._available].join('|');
    }

    render() {
        return html`
            <div class="card ${this.sensor.active ? 'inv' : ''}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                ${batteryLowBadge(this.sensor.batteryLow)}
                <feezal-icon name="${this.sensor.icon()}"></feezal-icon>
                <span class="state">${this.sensor.text()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Sensor' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-sensor', FeezalElementEinkSensor);
export {FeezalElementEinkSensor};
