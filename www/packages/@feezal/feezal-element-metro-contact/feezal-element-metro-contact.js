/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-contact (E55)
 *
 * Front-only Metro tile for a binary sensor — material-contact's contract in
 * tile form: `type` picks a stylised SVG (window with tilt state + mirrored
 * handle, door, generic, water leak, fire alarm, garage door), payload
 * matching uses the same string/boolean coercion, availability shows a badge,
 * and the discovery descriptor maps `device_class` onto the type. The tile
 * itself carries the state colour: accent while closed, open/tilt colour
 * while open/tilted.
 *
 * `icon-open`/`icon-closed` override the SVG with configured icons (any
 * icon-set name) for the respective state.
 */

// ── material-contact helpers (private there — duplicated, keep in sync) ─────

// Compare a received MQTT value (may be JS number/bool after JSON parsing)
// against a user-configured payload string.
function payloadMatch(value, configured) {
    if (String(value) === String(configured)) return true;
    if (value === true  && /^(on|true|1|yes)$/i.test(String(configured)))  return true;
    if (value === false && /^(off|false|0|no)$/i.test(String(configured))) return true;
    return false;
}

function windowSvg(state, mirrorHandle) {
    const isOpen   = state === 'open';
    const isTilted = state === 'tilted';
    const isActive = isOpen || isTilted;
    const hx = mirrorHandle ? 6 : 54;
    const hy = 30;
    const lx = isOpen ? (mirrorHandle ? hx + 12 : hx - 12) : hx;
    const ly = isOpen ? hy : (isTilted ? hy - 14 : hy + 14);
    return svg`
        <rect x="4" y="4" width="52" height="52" rx="3"
              fill="none" stroke="currentColor" stroke-width="3.5"/>
        ${isActive ? svg`
            <rect x="6" y="6" width="48" height="48" rx="2" fill="currentColor" fill-opacity="0.25"/>
        ` : ''}
        <line x1="4" y1="30" x2="56" y2="30" stroke="currentColor" stroke-width="2"/>
        <line x1="30" y1="4" x2="30" y2="56" stroke="currentColor" stroke-width="2"/>
        <circle cx="${hx}" cy="${hy}" r="3.5" fill="currentColor"/>
        <line x1="${hx}" y1="${hy}" x2="${lx}" y2="${ly}"
              stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
}

function doorSvg(isOpen) {
    return svg`
        <rect x="8" y="3" width="44" height="56" rx="2"
              fill="none" stroke="currentColor" stroke-width="3.5"/>
        <rect x="10" y="4" width="40" height="53" rx="1"
              fill="${isOpen ? 'currentColor' : 'none'}" fill-opacity="${isOpen ? 0.2 : 0}"
              stroke="currentColor" stroke-width="${isOpen ? 1.5 : 1}"/>
        <circle cx="39" cy="31" r="3.5" fill="currentColor" opacity="0.65"/>
        ${isOpen ? svg`
            <path d="M53 20 L59 20 M56 16 L60 20 L56 24"
                  fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ` : ''}`;
}

function genericSvg(isOpen) {
    return svg`
        <circle cx="30" cy="30" r="24"
                fill="${isOpen ? 'currentColor' : 'none'}" fill-opacity="${isOpen ? 0.15 : 0}"
                stroke="currentColor" stroke-width="3"/>
        <line x1="18" y1="30" x2="42" y2="30" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        ${isOpen ? svg`
            <line x1="30" y1="18" x2="30" y2="42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        ` : ''}`;
}

function waterleakSvg(isOpen) {
    return svg`
        <path d="M30,6 C24,16 10,28 10,40 C10,50 19,56 30,56 C41,56 50,50 50,40 C50,28 36,16 30,6 Z"
              fill="${isOpen ? 'currentColor' : 'none'}" fill-opacity="${isOpen ? 0.35 : 0}"
              stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
        ${isOpen ? svg`
            <path d="M20,50 Q25,45 30,50 Q35,55 40,50"
                  fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        ` : svg`
            <line x1="30" y1="35" x2="30" y2="47" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>
        `}`;
}

function fireAlarmSvg(isOpen) {
    return svg`
        <path d="M30,5 C24,14 16,24 16,35 C16,45 22,54 30,57 C38,54 44,45 44,35 C44,24 36,14 30,5 Z"
              fill="${isOpen ? 'currentColor' : 'none'}" fill-opacity="${isOpen ? 0.3 : 0}"
              stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
        ${isOpen ? svg`
            <path d="M30,22 C27,26 22,32 24,39 C25,43 28,47 30,49 C32,47 35,43 36,39 C38,32 33,26 30,22 Z"
                  fill="white" fill-opacity="0.55" stroke="none"/>
        ` : svg`
            <circle cx="30" cy="38" r="4" fill="currentColor" opacity="0.4"/>
            <line x1="30" y1="20" x2="30" y2="31" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
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
                  fill="currentColor" fill-opacity="0.45"
                  stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        ` : svg`
            <line x1="5"  y1="19" x2="55" y2="19" stroke="currentColor" stroke-width="2"/>
            <line x1="5"  y1="31" x2="55" y2="31" stroke="currentColor" stroke-width="2"/>
            <line x1="5"  y1="43" x2="55" y2="43" stroke="currentColor" stroke-width="2"/>
            <circle cx="30" cy="38" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        `}`;
}

class FeezalElementMetroContact extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Metro', color: '#1ba1e2', icon: 'sensor_door'},
            description: 'Metro contact tile (window/door/leak/fire/garage): stylised state visual or configurable per-state icons; accent while closed, alarm colour while open, tilt state supported. Display-only.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'payload-open',   type: 'string', default: 'ON',  help: 'Payload meaning the contact is open.'},
                {name: 'payload-closed', type: 'string', default: 'OFF', help: 'Payload meaning the contact is closed.'},
                {name: 'payload-tilted', type: 'string', default: '',    help: 'Payload meaning the window is tilted/vented (e.g. Homematic: 2). Leave blank to disable tilt state. Window type only.'},
                {name: 'type', type: 'select', options: ['window', 'door', 'generic', 'waterleak', 'firealarm', 'garagedoor'], default: 'window',
                    help: 'Visual style — window frame (with tilt), door, generic circle, water droplet (leak), flame (fire/smoke alarm), or garage door. Overridden by icon-open/icon-closed when set.'},
                {name: 'mirror', type: 'boolean', default: false, help: 'Show the window handle on the left side instead of the right. Window type only.'},
                {name: 'icon-open',   type: 'icon', help: 'Icon shown while open — overrides the type visual (empty = type visual).'},
                {name: 'icon-closed', type: 'icon', help: 'Icon shown while closed — overrides the type visual (empty = type visual).'},
                {name: 'text-open',   type: 'string', default: 'open',   help: 'State text while open.'},
                {name: 'text-tilted', type: 'string', default: 'tilted', help: 'State text while tilted.'},
                {name: 'text-closed', type: 'string', default: 'closed', help: 'State text while closed.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-open-color', type: 'color',
                    default: 'var(--error-color, #e51400)',
                    help: 'Tile colour while the contact is open.'},
                {property: '--feezal-metro-tilt-color', type: 'color',
                    default: 'var(--info-color, #1ba1e2)',
                    help: 'Tile colour while the window is tilted.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:  'subscribe',
                    payload_on:   'payload-open',
                    payload_off:  'payload-closed',
                    device_class: {attr: 'type', valueMap: {window: 'window', door: 'door', moisture: 'waterleak', smoke: 'firealarm', garage_door: 'garagedoor', _default: 'window'}},
                    availability_topic:    'subscribe-availability',
                    payload_available:     'payload-available',
                    payload_not_available: 'payload-unavailable',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        payloadOpen:   {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClosed: {type: String,  reflect: true, attribute: 'payload-closed'},
        payloadTilted: {type: String,  reflect: true, attribute: 'payload-tilted'},
        type:          {type: String,  reflect: true},
        mirror:        {type: Boolean, reflect: true},
        iconOpen:      {type: String,  reflect: true, attribute: 'icon-open'},
        iconClosed:    {type: String,  reflect: true, attribute: 'icon-closed'},
        textOpen:      {type: String,  reflect: true, attribute: 'text-open'},
        textTilted:    {type: String,  reflect: true, attribute: 'text-tilted'},
        textClosed:    {type: String,  reflect: true, attribute: 'text-closed'},
        subscribeAvailability: {type: String, reflect: true, attribute: 'subscribe-availability'},
        msgPropAvailability:   {type: String, reflect: true, attribute: 'message-property-availability'},
        payloadAvailable:      {type: String, reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String, reflect: true, attribute: 'payload-unavailable'},
        discoveryId:   {type: String,  reflect: true, attribute: 'discovery-id'},
        _state:     {state: true},   // 'closed' | 'open' | 'tilted'
        _available: {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        :host {
            --feezal-metro-open-color: var(--error-color, #e51400);
            --feezal-metro-tilt-color: var(--info-color, #1ba1e2);
        }
        .face { transition: background 0.15s; }
        :host([data-state='open'])   .face { background: var(--feezal-metro-open-color); }
        :host([data-state='tilted']) .face { background: var(--feezal-metro-tilt-color); }
        .front { cursor: default; }
        .state { font-size: 12px; text-transform: lowercase; opacity: 0.85; }
        svg.contact { height: min(42px, 45cqh); aspect-ratio: 1; overflow: visible; }
    `];

    constructor() {
        super();
        this.payloadOpen = 'ON';
        this.payloadClosed = 'OFF';
        this.payloadTilted = '';
        this.type = 'window';
        this.mirror = false;
        this.iconOpen = '';
        this.iconClosed = '';
        this.textOpen = 'open';
        this.textTilted = 'tilted';
        this.textClosed = 'closed';
        this.subscribeAvailability = '';
        this.msgPropAvailability = '';
        this.payloadAvailable = 'online';
        this.payloadUnavailable = 'offline';
        this.discoveryId = '';
        this._state = 'closed';
        this._available = true;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                if (this.payloadTilted && payloadMatch(v, this.payloadTilted)) {
                    this._state = 'tilted';
                } else if (payloadMatch(v, this.payloadOpen)) {
                    this._state = 'open';
                } else {
                    this._state = 'closed';
                }
            });
        }
        if (this.subscribeAvailability) {
            this.addSubscription(this.subscribeAvailability, msg => {
                const v = this.getProperty(msg, this.msgPropAvailability || this.messageProperty);
                const s = String(v).toLowerCase();
                this._available = String(v) === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('_state')) this.setAttribute('data-state', this._state);
    }

    _shapeSvg(state) {
        const isOpen = state === 'open';
        if (this.type === 'door')       return doorSvg(isOpen);
        if (this.type === 'generic')    return genericSvg(isOpen);
        if (this.type === 'waterleak')  return waterleakSvg(isOpen);
        if (this.type === 'firealarm')  return fireAlarmSvg(isOpen);
        if (this.type === 'garagedoor') return garageDoorSvg(isOpen);
        return windowSvg(state, this.mirror);
    }

    _stateText() {
        if (this._state === 'open') return this.textOpen || 'open';
        if (this._state === 'tilted') return this.textTilted || 'tilted';
        return this.textClosed || 'closed';
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        // Configured per-state icons override the type visual (tilted uses
        // the open icon — it is a "not closed" state).
        const stateIcon = this._state === 'closed' ? this.iconClosed : this.iconOpen;
        const visual = stateIcon
            ? html`<feezal-icon name="${stateIcon}"></feezal-icon>`
            : html`<svg class="contact" viewBox="0 0 60 60">${this._shapeSvg(this._state)}</svg>`;
        return html`
            ${visual}
            <div class="state">${this._stateText()}</div>`;
    }
}

customElements.define('feezal-element-metro-contact', FeezalElementMetroContact);
export {FeezalElementMetroContact};
