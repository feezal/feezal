/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137/E138: the boolean-sensor behavior lives in the shared controller — this
// element is a VIEW (Circle chrome: the four dedicated motion SVG visuals). E138
// narrowed this card to the MOTION slice of the type vocabulary; the alarm-class
// state disc moved to the sibling feezal-element-circle-sensor card.
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {svg} from 'lit';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── SVG helpers ───────────────────────────────────────────────────────────────

// PIR-style: person silhouette with three radiating arcs to the right.
// Arcs are centred on (20, 30); radii 15, 22, 30.
function motionSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    const ao = isActive ? 1 : 0.35;
    return svg`
        <circle cx="20" cy="11" r="7"
                fill="${isActive ? 'currentColor' : 'none'}" fill-opacity="${isActive ? 0.85 : 0}"
                stroke="currentColor" stroke-width="2.5"/>
        <path d="M11,20 C11,20 10,40 20,40 C30,40 29,20 29,20"
              fill="${isActive ? 'currentColor' : 'none'}" fill-opacity="${isActive ? 0.7 : 0}"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M30,19 A15,15 0 0,1 30,41"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${ao}"/>
        <path d="M34,13 A22,22 0 0,1 34,47"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 0.7 : 0.25}"/>
        <path d="M39,7 A30,30 0 0,1 39,53"
              fill="none" stroke="${ac}" stroke-width="2" stroke-linecap="round"
              opacity="${isActive ? 0.45 : 0.15}"/>`;
}

// Presence/occupancy: full-body person centred inside a glowing zone circle.
function presenceSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <circle cx="30" cy="30" r="26"
                fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
                fill-opacity="${isActive ? 0.18 : 0}"
                stroke="${ac}" stroke-width="3"/>
        <circle cx="30" cy="20" r="7"
                fill="currentColor" fill-opacity="${isActive ? 1 : 0.5}"/>
        <path d="M19,31 C19,31 18,48 30,48 C42,48 41,31 41,31"
              fill="currentColor" fill-opacity="${isActive ? 1 : 0.5}" stroke="none"/>
        ${isActive ? svg`
            <circle cx="30" cy="30" r="19"
                    fill="none" stroke="${ac}" stroke-width="1.5"
                    stroke-dasharray="4 3" opacity="0.4"/>
        ` : ''}`;
}

// mmWave radar: expanding semicircular arcs from a sensor node at the bottom.
function radarSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <circle cx="30" cy="52" r="4" fill="${ac}"/>
        <path d="M16,52 A16,16 0 0,1 44,52"
              fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
              fill-opacity="${isActive ? 0.2 : 0}"
              stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 1 : 0.5}"/>
        <path d="M7,52 A25,25 0 0,1 53,52"
              fill="none" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"
              opacity="${isActive ? 0.7 : 0.3}"/>
        <path d="M-1,52 A33,33 0 0,1 61,52"
              fill="none" stroke="${ac}" stroke-width="2" stroke-linecap="round"
              opacity="${isActive ? 0.4 : 0.15}"/>`;
}

// Zone/room: rectangular area that highlights when motion is detected.
function zoneSvg(isActive) {
    const ac = isActive ? 'var(--feezal-motion-active-color)' : 'currentColor';
    return svg`
        <rect x="4" y="6" width="52" height="50" rx="2"
              fill="${isActive ? 'var(--feezal-motion-active-color)' : 'none'}"
              fill-opacity="${isActive ? 0.18 : 0}"
              stroke="${ac}" stroke-width="3"/>
        <circle cx="30" cy="24" r="6"
                fill="currentColor" fill-opacity="${isActive ? 0.9 : 0.3}"/>
        <path d="M21,34 C21,34 20,48 30,48 C40,48 39,34 39,34"
              fill="currentColor" fill-opacity="${isActive ? 0.9 : 0.3}" stroke="none"/>`;
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementCircleMotion extends FeezalElement {
    static get feezal() {
        return {
            // E138: palette name "Motion" — the motion slice of the boolean-sensor
            // vocabulary (motion / presence / radar / zone). Alarm-class sensors
            // (water/smoke/gas/…) live on the sibling material-sensor card.
            palette: {name: 'Motion', category: 'Circle', color: '#1565c0', icon: 'motion_sensor_active'},
            description: 'Motion / occupancy sensor card — PIR, presence, mmWave radar and zone visuals that light up ' +
                'while activity is detected. Boolean-sensor behavior from the shared controller (motion slice of the ' +
                'E132 type vocabulary); alarm-class sensors use the material-sensor card.',
            // E137/E138: the discovery map is the controller package's motion-slice
            // fragment — routes motion/occupancy/presence device classes only.
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('motion')},
            attributes: [
                // E137/E138: the shared sensor contract, motion slice — declared
                // ONCE by the controller package, spread by every family view.
                ...sensorAttributesFor('motion'),
                {name: 'label',                  type: 'string',    default: '',    help: 'Optional card label shown below the visual.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-motion-active-color', type: 'color', default: 'var(--accent-color)', help: 'Colour shown when motion is detected or zone is occupied. E138: the motion-slice active default is --accent-color (SensorController.activeColorVar()); override per element.'},
                {property: '--feezal-motion-text-color',   type: 'color', default: 'var(--primary-text-color)',    help: 'Label text colour.'},
                {property: '--feezal-motion-error-color',  type: 'color', default: 'var(--error-color)', help: 'Unavailability badge colour.'},
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
            /* E38: container query so the visual scales with the card width. */
            container-type: inline-size;
            /* E138: motion-slice active default → --accent-color (activeColorVar). */
            --feezal-motion-active-color: var(--accent-color, #ff9800);
            --feezal-motion-text-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-motion-error-color:  var(--error-color, #b00020);
            color: var(--feezal-motion-text-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-motion-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* E139: the motion art sits inside a circular disc — width-sized, top-
           anchored, concentric with the light/climate ring (square wrap, ~90%
           disc centred). The disc frame tints to the active colour while motion
           is detected; the per-type SVG art keeps its own detail inside. */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc {
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 1cqi;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .disc.active {
            border-color: var(--feezal-motion-active-color);
            background: color-mix(in srgb, var(--feezal-motion-active-color) 14%, transparent);
        }
        svg.motion { width: 60%; height: 60%; display: block; overflow: visible; }
        .disc .htext {
            font-size: 8cqi; font-weight: 600; opacity: 0.75; line-height: 1;
            color: var(--feezal-motion-text-color);
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-motion-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.payloadActive         = 'ON';
        this.payloadClear          = 'OFF';
        this.type                  = 'motion';
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

    /** Each motion-slice type gets its dedicated SVG visual (unknown → PIR). */
    _shapeSvg(isActive) {
        if (this.type === 'presence') return presenceSvg(isActive);
        if (this.type === 'radar')    return radarSvg(isActive);
        if (this.type === 'zone')     return zoneSvg(isActive);
        return motionSvg(isActive);
    }

    _stateText() {
        return this.sensor.active ? (this.textActive || 'Motion') : (this.textClear || 'Clear');
    }

    render() {
        const s = this.sensor;
        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${batteryLowBadge(s.batteryLow)}
            <div class="disc-wrap">
                <div class="disc ${s.active ? 'active' : ''}">
                    <svg class="motion" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${this._shapeSvg(s.active)}
                    </svg>
                    <span class="htext">${this._stateText()}</span>
                </div>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-motion', FeezalElementCircleMotion);
export {FeezalElementCircleMotion};
