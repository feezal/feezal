/* global feezal */
import {html, css} from '@feezal/feezal-element';
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

const TYPE_ICONS = {
    motion: 'directions_walk',
    presence: 'person',
    radar: 'radar',
    zone: 'meeting_room',
};

class FeezalElementMetroOccupancy extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Occupancy', category: 'Metro', color: '#1ba1e2', icon: 'sensors'},
            description: 'Metro occupancy tile (motion/presence/radar/zone): accent while clear, active colour while detected. Display-only. Same MQTT contract as the Device occupancy card.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                {name: 'payload-active', type: 'string', default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',  type: 'string', default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type', type: 'select', options: ['motion', 'presence', 'radar', 'zone'], default: 'motion',
                    help: 'Sensor kind — picks the default icon (walker, person, radar, room). Overridden by icon-active/icon-clear when set.'},
                {name: 'icon-active', type: 'icon', help: 'Icon shown while detected — overrides the type icon (empty = type icon).'},
                {name: 'icon-clear',  type: 'icon', help: 'Icon shown while clear — overrides the type icon (empty = type icon).'},
                {name: 'text-active', type: 'string', default: 'detected', help: 'State text while detected.'},
                {name: 'text-clear',  type: 'string', default: 'clear',    help: 'State text while clear.'},
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
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:  'subscribe',
                    payload_on:   'payload-active',
                    payload_off:  'payload-clear',
                    device_class: {attr: 'type', valueMap: {motion: 'motion', occupancy: 'presence', presence: 'presence', _default: 'motion'}},
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
        payloadActive: {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:  {type: String, reflect: true, attribute: 'payload-clear'},
        type:          {type: String, reflect: true},
        iconActive:    {type: String, reflect: true, attribute: 'icon-active'},
        iconClear:     {type: String, reflect: true, attribute: 'icon-clear'},
        textActive:    {type: String, reflect: true, attribute: 'text-active'},
        textClear:     {type: String, reflect: true, attribute: 'text-clear'},
        subscribeAvailability: {type: String, reflect: true, attribute: 'subscribe-availability'},
        msgPropAvailability:   {type: String, reflect: true, attribute: 'message-property-availability'},
        payloadAvailable:      {type: String, reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String, reflect: true, attribute: 'payload-unavailable'},
        discoveryId:   {type: String, reflect: true, attribute: 'discovery-id'},
        _active:    {state: true},
        _available: {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        :host { --feezal-metro-active-color: var(--warning-color, #fa6800); }
        .face { transition: background 0.15s; }
        :host([data-active]) .face { background: var(--feezal-metro-active-color); }
        .front { cursor: default; }
        .state { font-size: 12px; text-transform: lowercase; opacity: 0.85; }
    `];

    constructor() {
        super();
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'motion';
        this.iconActive = '';
        this.iconClear = '';
        this.textActive = 'detected';
        this.textClear = 'clear';
        this.subscribeAvailability = '';
        this.msgPropAvailability = '';
        this.payloadAvailable = 'online';
        this.payloadUnavailable = 'offline';
        this.discoveryId = '';
        this._active = false;
        this._available = true;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                // material-motion coercion: JSON {state} payloads + booleans.
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                this._active = String(v) === String(this.payloadActive) ||
                    v === true || v === 1 || v === '1';
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
        if (changed.has('_active')) this.toggleAttribute('data-active', this._active);
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const stateIcon = this._active ? this.iconActive : this.iconClear;
        const icon = stateIcon || TYPE_ICONS[this.type] || TYPE_ICONS.motion;
        return html`
            <feezal-icon name="${icon}"></feezal-icon>
            <div class="state">${this._active ? (this.textActive || 'detected') : (this.textClear || 'clear')}</div>`;
    }
}

customElements.define('feezal-element-metro-occupancy', FeezalElementMetroOccupancy);
export {FeezalElementMetroOccupancy};
