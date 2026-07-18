/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-glass-occupancy (E58)
 *
 * Frosted-glass motion/presence card. Same MQTT capability contract as the
 * Device occupancy card (feezal-element-material-motion) — attribute names,
 * payload matching incl. JSON {state} and boolean coercion, the `type`
 * variants (motion / presence / radar / zone — here they pick the default
 * icon), availability badge and the same HA discovery descriptor incl.
 * `device_class` → type. The card highlights while motion is detected.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

const TYPE_ICONS = {
    motion: 'directions_walk',
    presence: 'person',
    radar: 'radar',
    zone: 'meeting_room',
};

class FeezalElementGlassOccupancy extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Occupancy', category: 'Glass', color: '#7aa5c9', icon: 'sensors'},
            description: 'Frosted-glass occupancy card — highlights while motion/presence is detected. ' +
                'Same MQTT contract as the Device occupancy card.',
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:  {attr: 'subscribe'},
                    payload_on:   {attr: 'payload-active'},
                    payload_off:  {attr: 'payload-clear'},
                    device_class: {attr: 'type', valueMap: {motion: 'motion', occupancy: 'presence', presence: 'presence', _default: 'motion'}},
                    // N31: availability is mapped automatically from the canonical discovery record.
                    value_template:        {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'subscribe',        type: 'mqttTopic', help: 'Topic reporting motion or presence state.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Property path within the message payload (dot-notation). Default: payload'},
                {name: 'payload-active',   type: 'string', default: 'ON',  help: 'Payload meaning motion detected / zone occupied.'},
                {name: 'payload-clear',    type: 'string', default: 'OFF', help: 'Payload meaning no motion / zone vacant.'},
                {name: 'type', type: 'select', options: ['motion', 'presence', 'radar', 'zone'], default: 'motion',
                    help: 'Sensor kind — picks the default icon (walker, person, radar, room).'},
                {name: 'icon',  type: 'string', help: 'Explicit icon name — overrides the type default.'},
                {name: 'text-active', type: 'string', default: 'Detected', help: 'State text while detected.'},
                {name: 'text-clear',  type: 'string', default: 'Clear',    help: 'State text while clear.'},
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
                {property: '--feezal-glass-active-color', type: 'color', default: 'var(--warning-color, #ff9f0a)', help: 'Icon/state colour while detected.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
            ],
            defaultStyle: {width: '150px', height: '110px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        payloadActive: {type: String,  reflect: true, attribute: 'payload-active'},
        payloadClear:  {type: String,  reflect: true, attribute: 'payload-clear'},
        type:          {type: String,  reflect: true},
        icon:          {type: String,  reflect: true},
        textActive:    {type: String,  reflect: true, attribute: 'text-active'},
        textClear:     {type: String,  reflect: true, attribute: 'text-clear'},
        label:         {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:       {type: Boolean, reflect: true},
        discoveryId:   {type: String,  reflect: true, attribute: 'discovery-id'},
        _active:    {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
        .card {
            position: absolute; inset: 0; box-sizing: border-box;
            display: flex; flex-direction: column; justify-content: space-between;
            padding: 11cqmin; gap: 2px;
            border-radius: var(--feezal-glass-radius, 24px);
            background: var(--feezal-glass-tint, rgba(255,255,255,0.55));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            color: var(--feezal-glass-color, #1d1d1f);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: background 0.2s ease;
            user-select: none;
            --_state-color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
        .card.active {
            background: var(--feezal-glass-on-tint, rgba(255,255,255,0.82));
            --_state-color: var(--feezal-glass-active-color, #ff9f0a);
        }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        feezal-icon { font-size: 20cqmin; line-height: 1; color: var(--_state-color); transition: color 0.2s ease; }
        .state { font-size: 13cqmin; font-weight: 700; color: var(--_state-color); }
        .label {
            font-size: 11cqmin; font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; top: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
    `];

    constructor() {
        super();
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'motion';
        this.icon = '';
        this.textActive = 'Detected';
        this.textClear = 'Clear';
        this.label = '';
        this.degrade = false;
        this.discoveryId = '';
        this._active = false;
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    /** Topic attributes changed at runtime (inspector edits on the live
     * canvas) → updated() rewires instead of keeping the stale topics. */
    _wireSignature() {
        return String(this.subscribe);
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();

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
    }

    render() {
        return html`
            <div class="card ${this._active ? 'active' : ''}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || TYPE_ICONS[this.type] || TYPE_ICONS.motion}"></feezal-icon>
                <span class="state">${this._active ? (this.textActive || 'Detected') : (this.textClear || 'Clear')}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Occupancy' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-occupancy', FeezalElementGlassOccupancy);
export {FeezalElementGlassOccupancy};
