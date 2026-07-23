/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (glass chrome) over SensorController state.
// E138: narrowed to the MOTION slice (motion / presence / radar / zone).
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-motion (E58, E138)
 *
 * Frosted-glass motion / presence card. A VIEW over SensorController, narrowed
 * to the MOTION vocabulary slice: the `type` variants (motion / presence /
 * radar / zone) pick the default icon; the card highlights while motion is
 * detected. Same MQTT capability contract as the Circle motion card
 * (feezal-element-circle-motion) — attribute names, payload matching incl.
 * JSON {state} and boolean coercion, availability badge, E124 low-battery
 * badge and the HA `binary_sensor` discovery descriptor incl. `device_class`.
 *
 * E138: the active-state accent DEFAULTS from the controller's slice colour
 * var (`activeColorVar()` → `--accent-color` for the motion slice); the
 * per-element `--feezal-glass-active-color` style override still wins.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

class FeezalElementGlassMotion extends FeezalElement {
    static get feezal() {
        return {
            // E138: MOTION slice — the motion / presence card.
            palette: {name: 'Motion', category: 'Glass', color: '#7aa5c9', icon: 'sensors'},
            description: 'Frosted-glass motion / presence card (motion, presence, radar, zone) — ' +
                'highlights while triggered. Same MQTT contract as the Circle motion card.',
            // E137/E138: discovery map is the controller package's motion-slice fragment.
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('motion')},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137/E138: the shared sensor contract, motion slice — declared
                // ONCE by the controller package, spread by every family.
                ...sensorAttributesFor('motion'),
                {name: 'icon',  type: 'string', help: 'Explicit icon name — overrides the type default in BOTH states.'},
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
                {property: '--feezal-glass-active-color', type: 'color', default: 'var(--accent-color, #ff9f0a)', help: 'Icon/state colour while detected. Defaults to the theme accent colour.'},
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
        // E137: sensor state lives on the SensorController.
    };

    static styles = [feezalBatteryStyles, feezalBaseStyles, glassCardStyles, css`
        .card {
            gap: 2px;
            transition: background 0.2s ease;
            --_state-color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        /* E138: active accent — per-element --feezal-glass-active-color override
           wins, else the controller's slice colour var (set inline on the card
           via --feezal-glass-active-default). */
        .card.active {
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62));
            --_state-color: var(--feezal-glass-active-color, var(--feezal-glass-active-default, #ff9f0a));
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
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.sensor = new SensorController(this);
        this.degrade = false;
        this.discoveryId = '';
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.sensor.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
    }

    render() {
        // E138: the active accent defaults from the controller's slice colour
        // var (motion → --accent-color); the per-element style override wins.
        const activeDefault = `var(${this.sensor.activeColorVar()}, #ff9f0a)`;
        return html`
            <div class="card ${this.sensor.active ? 'active' : ''}" style="--feezal-glass-active-default: ${activeDefault}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                ${batteryLowBadge(this.sensor.batteryLow)}
                <feezal-icon name="${this.icon || this.sensor.icon()}"></feezal-icon>
                <span class="state">${this.sensor.text()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Motion' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-motion', FeezalElementGlassMotion);
export {FeezalElementGlassMotion};
