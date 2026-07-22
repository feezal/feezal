/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
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
class FeezalElementMaterialMotion extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Occupancy', category: 'Circle', color: '#1565c0', icon: 'motion_sensor_active'},
            description: 'Motion and presence detector card. Supports PIR (motion), person-in-zone (presence), mmWave radar arcs (radar), and room-zone highlight (zone) visual styles.',
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:           {attr: 'subscribe'},
                    payload_on:            {attr: 'payload-active'},
                    payload_off:           {attr: 'payload-clear'},
                    device_class:          {attr: 'type', valueMap: {motion: 'motion', occupancy: 'presence', presence: 'presence', _default: 'motion'}},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    value_template:        {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'Topic reporting motion or presence state.'},
                {name: 'message-property',       type: 'string',    default: 'payload', help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
                {name: 'payload-active',         type: 'string',    default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',          type: 'string',    default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type',                   type: 'select',
                    options: ['motion', 'presence', 'radar', 'zone'],
                    default: 'motion',
                    help: 'Visual style — PIR silhouette with arcs (motion), person inside zone circle (presence), mmWave radar semicircles (radar), or room area highlight (zone).'},
                {name: 'label',                  type: 'string',    default: '',    help: 'Optional card label shown below the visual.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-motion-active-color', type: 'color', default: 'var(--primary-color)', help: 'Colour shown when motion is detected or zone is occupied.'},
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
        label:                 {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:           {type: String, reflect: true, attribute: 'discovery-id'},
        _active:    {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;
            --feezal-motion-active-color: var(--warning-color, var(--feezal-warning, #ff9800));
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
        .svg-wrap { flex: 1; width: 100%; min-height: 0; }
        svg.motion { width: 100%; height: 100%; display: block; overflow: visible; }
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
        this.label                 = '';
        this.discoveryId           = '';
        this._active    = false;
    }

    // Device cards manage subscriptions manually; suppress the base-class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();

        // N31: availability subscription handled by the FeezalElement base.

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._active = String(v) === String(this.payloadActive) ||
                    v === true || v === 1 || v === '1';
            });
        }
    }

    _shapeSvg(isActive) {
        if (this.type === 'presence') return presenceSvg(isActive);
        if (this.type === 'radar')    return radarSvg(isActive);
        if (this.type === 'zone')     return zoneSvg(isActive);
        return motionSvg(isActive);
    }

    render() {
        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            <div class="svg-wrap">
                <svg class="motion" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    ${this._shapeSvg(this._active)}
                </svg>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-motion', FeezalElementMaterialMotion);
export {FeezalElementMaterialMotion};
