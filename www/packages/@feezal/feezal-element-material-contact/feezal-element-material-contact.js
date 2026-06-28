/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── SVG helpers ───────────────────────────────────────────────────────────────
function windowSvg(isOpen) {
    return svg`
        <rect x="4" y="4" width="52" height="52" rx="3"
              fill="none" stroke="currentColor" stroke-width="3.5"/>
        <line x1="4" y1="30" x2="56" y2="30" stroke="currentColor" stroke-width="2"/>
        <line x1="30" y1="4" x2="30" y2="56" stroke="currentColor" stroke-width="2"/>
        ${isOpen ? svg`
            <rect x="33" y="7" width="19" height="20" rx="1"
                  fill="var(--feezal-contact-open-color)" fill-opacity="0.35"
                  stroke="var(--feezal-contact-open-color)" stroke-width="1.5"/>
            <line x1="39" y1="11" x2="47" y2="19"
                  stroke="var(--feezal-contact-open-color)" stroke-width="1.5" stroke-linecap="round"/>
        ` : ''}`;
}

function doorSvg(isOpen) {
    return svg`
        <rect x="8" y="3" width="44" height="56" rx="2"
              fill="none" stroke="currentColor" stroke-width="3.5"/>
        <rect x="10" y="4" width="40" height="53" rx="1"
              fill="${isOpen ? 'var(--feezal-contact-open-color)' : 'none'}"
              fill-opacity="${isOpen ? 0.2 : 0}"
              stroke="currentColor" stroke-width="${isOpen ? 1.5 : 1}"/>
        <circle cx="39" cy="31" r="3.5" fill="currentColor" opacity="0.65"/>
        ${isOpen ? svg`
            <path d="M53 20 L59 20 M56 16 L60 20 L56 24"
                  fill="none" stroke="var(--feezal-contact-open-color)"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ` : ''}`;
}

function genericSvg(isOpen) {
    const c = isOpen ? 'var(--feezal-contact-open-color)' : 'currentColor';
    return svg`
        <circle cx="30" cy="30" r="24"
                fill="${isOpen ? 'var(--feezal-contact-open-color)' : 'none'}"
                fill-opacity="${isOpen ? 0.15 : 0}"
                stroke="${c}" stroke-width="3"/>
        <line x1="18" y1="30" x2="42" y2="30" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
        ${isOpen ? svg`
            <line x1="30" y1="18" x2="30" y2="42" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
        ` : ''}`;
}

function waterleakSvg(isOpen) {
    const c = isOpen ? 'var(--feezal-contact-open-color)' : 'currentColor';
    return svg`
        <path d="M30,6 C24,16 10,28 10,40 C10,50 19,56 30,56 C41,56 50,50 50,40 C50,28 36,16 30,6 Z"
              fill="${isOpen ? 'var(--feezal-contact-open-color)' : 'none'}"
              fill-opacity="${isOpen ? 0.35 : 0}"
              stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
        ${isOpen ? svg`
            <path d="M20,50 Q25,45 30,50 Q35,55 40,50"
                  fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        ` : svg`
            <line x1="30" y1="35" x2="30" y2="47" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>
        `}`;
}

function fireAlarmSvg(isOpen) {
    const c = isOpen ? 'var(--feezal-contact-open-color)' : 'currentColor';
    return svg`
        <path d="M30,5 C24,14 16,24 16,35 C16,45 22,54 30,57 C38,54 44,45 44,35 C44,24 36,14 30,5 Z"
              fill="${isOpen ? 'var(--feezal-contact-open-color)' : 'none'}"
              fill-opacity="${isOpen ? 0.3 : 0}"
              stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
        ${isOpen ? svg`
            <path d="M30,22 C27,26 22,32 24,39 C25,43 28,47 30,49 C32,47 35,43 36,39 C38,32 33,26 30,22 Z"
                  fill="white" fill-opacity="0.55" stroke="none"/>
        ` : svg`
            <circle cx="30" cy="38" r="4" fill="${c}" opacity="0.4"/>
            <line x1="30" y1="20" x2="30" y2="31" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
        `}`;
}

function garageDoorSvg(isOpen) {
    return svg`
        <rect x="5" y="5" width="50" height="52" rx="1"
              fill="none" stroke="currentColor" stroke-width="3.5"/>
        ${isOpen ? svg`
            <line x1="5"  y1="13" x2="55" y2="13" stroke="currentColor" stroke-width="2" opacity="0.6"/>
            <line x1="5"  y1="19" x2="55" y2="19" stroke="currentColor" stroke-width="2" opacity="0.6"/>
            <path d="M14,57 L30,43 L46,57"
                  fill="var(--feezal-contact-open-color)" fill-opacity="0.45"
                  stroke="var(--feezal-contact-open-color)" stroke-width="1.5" stroke-linejoin="round"/>
        ` : svg`
            <line x1="5"  y1="19" x2="55" y2="19" stroke="currentColor" stroke-width="2"/>
            <line x1="5"  y1="31" x2="55" y2="31" stroke="currentColor" stroke-width="2"/>
            <line x1="5"  y1="43" x2="55" y2="43" stroke="currentColor" stroke-width="2"/>
            <circle cx="30" cy="38" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        `}`;
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialContact extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Device', color: '#1565c0', icon: 'sensor_window'},
            description: 'Window / door contact sensor. Shows open or closed state as a stylised SVG. Supports multi-contact mode for a compact room overview.',
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:           {attr: 'subscribe'},
                    payload_on:            {attr: 'payload-open'},
                    payload_off:           {attr: 'payload-closed'},
                    device_class:          {attr: 'type', valueMap: {window: 'window', door: 'door', moisture: 'waterleak', smoke: 'firealarm', garage_door: 'garagedoor', _default: 'window'}},
                    availability_topic:    {attr: 'subscribe-availability'},
                    payload_available:     {attr: 'payload-available'},
                    payload_not_available: {attr: 'payload-unavailable'},
                    value_template:        {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'State topic (single-contact mode).'},
                {name: 'message-property',       type: 'string',    default: 'payload', help: 'Property path within the message payload (dot-notation). Blank = top-level payload.'},
                {name: 'payload-open',           type: 'string',    default: 'ON',    help: 'Payload value meaning the contact is open.'},
                {name: 'payload-closed',         type: 'string',    default: 'OFF',   help: 'Payload value meaning the contact is closed.'},
                {name: 'type',                   type: 'select',    options: ['window', 'door', 'generic', 'waterleak', 'firealarm', 'garagedoor'], default: 'window',
                    help: 'Visual style — window frame, door, generic circle, water droplet (leak), flame (fire/smoke alarm), or garage door.'},
                {name: 'contacts',               type: 'string',    default: '[]',
                    help: 'JSON array of {subscribe, label} for multi-contact mode (up to 8). Overrides single subscribe.'},
                {name: 'label',                  type: 'string',    default: '',      help: 'Optional card label shown below the visual.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: '', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-contact-open-color',   type: 'color', default: 'var(--warning-color, #ff9800)', help: 'Colour shown when contact is open.'},
                {property: '--feezal-contact-closed-color', type: 'color', default: 'var(--primary-text-color)',     help: 'SVG outline colour when contact is closed.'},
                {property: '--feezal-contact-text-color',   type: 'color', default: 'var(--primary-text-color)',     help: 'Label text colour.'},
                {property: '--feezal-contact-error-color',  type: 'color', default: 'var(--error-color, #b00020)',   help: 'Unavailability badge colour.'},
            ],
            restrict:     {minWidth: 60, minHeight: 80},
            defaultStyle: {width: '80px', height: '120px'},
        };
    }

    static properties = {
        subscribe:             {type: String,  reflect: true},
        payloadOpen:           {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClosed:         {type: String,  reflect: true, attribute: 'payload-closed'},
        type:                  {type: String,  reflect: true},
        contacts:              {type: String,  reflect: true},
        label:                 {type: String,  reflect: true},
        subscribeAvailability: {type: String,  reflect: true, attribute: 'subscribe-availability'},
        payloadAvailable:      {type: String,  reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String,  reflect: true, attribute: 'payload-unavailable'},
        msgPropAvailability:   {type: String,  reflect: true, attribute: 'message-property-availability'},
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        _open:       {state: true},
        _multiOpen:  {state: true},
        _available:  {state: true},
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
            --feezal-contact-open-color:   var(--warning-color, var(--feezal-warning, #ff9800));
            --feezal-contact-closed-color: var(--primary-text-color, var(--feezal-color, #333));
            --feezal-contact-text-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-contact-error-color:  var(--error-color, #b00020);
            color: var(--feezal-contact-closed-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-contact-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .svg-wrap { flex: 1; width: 100%; min-height: 0; }
        svg.contact { width: 100%; height: 100%; display: block; overflow: visible; }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-contact-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
        .multi-grid {
            display: flex; flex-wrap: wrap; gap: 5px;
            width: 100%; justify-content: center; padding: 4px; flex: 1;
        }
        .multi-dot {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid currentColor; box-sizing: border-box;
            flex-shrink: 0;
        }
        .multi-dot.open {
            background: var(--feezal-contact-open-color);
            border-color: var(--feezal-contact-open-color);
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.payloadOpen           = 'ON';
        this.payloadClosed         = 'OFF';
        this.type                  = 'window';
        this.contacts              = '[]';
        this.label                 = '';
        this.subscribeAvailability = '';
        this.payloadAvailable      = 'online';
        this.payloadUnavailable    = 'offline';
        this.msgPropAvailability   = '';
        this.discoveryId           = '';
        this._open      = false;
        this._multiOpen = {};
        this._available = true;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;

        if (this.subscribeAvailability) {
            this.addSubscription(this.subscribeAvailability, msg => {
                let v = this.getProperty(msg, this.msgPropAvailability || this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                const s = String(v).toLowerCase();
                this._available = String(v) === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
            });
        }

        let contacts = [];
        try { contacts = JSON.parse(this.contacts); } catch { contacts = []; }

        if (contacts.length > 0) {
            for (const c of contacts) {
                if (!c.subscribe) continue;
                this.addSubscription(c.subscribe, msg => {
                    const v = this.getProperty(msg, this.messageProperty);
                    const isOpen = String(v) === String(this.payloadOpen) ||
                        v === true || v === 1 || v === '1';
                    this._multiOpen = {...this._multiOpen, [c.subscribe]: isOpen};
                });
            }
        } else if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._open = String(v) === String(this.payloadOpen) ||
                    v === true || v === 1 || v === '1';
            });
        }
    }

    _shapeSvg(isOpen) {
        if (this.type === 'door')       return doorSvg(isOpen);
        if (this.type === 'generic')    return genericSvg(isOpen);
        if (this.type === 'waterleak')  return waterleakSvg(isOpen);
        if (this.type === 'firealarm')  return fireAlarmSvg(isOpen);
        if (this.type === 'garagedoor') return garageDoorSvg(isOpen);
        return windowSvg(isOpen);
    }

    render() {
        let contacts = [];
        try { contacts = JSON.parse(this.contacts); } catch { contacts = []; }
        const isMulti = contacts.length > 0;

        if (feezal.isEditor) {
            return html`
                <div class="svg-wrap">
                    <svg class="contact" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${this._shapeSvg(false)}
                    </svg>
                </div>
                ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
        }

        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${isMulti ? html`
                <div class="multi-grid">
                    ${contacts.map(c => html`
                        <div class="multi-dot ${this._multiOpen[c.subscribe] ? 'open' : ''}"
                             title="${c.label || c.subscribe}"></div>`)}
                </div>
            ` : html`
                <div class="svg-wrap">
                    <svg class="contact" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${this._shapeSvg(this._open)}
                    </svg>
                </div>
            `}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-contact', FeezalElementMaterialContact);
export {FeezalElementMaterialContact};
