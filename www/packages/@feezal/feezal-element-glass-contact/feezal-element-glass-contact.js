/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {ContactController, contactAttributes, contactDiscoveryMap} from '@feezal/feezal-controller-contact';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-contact (E58)
 *
 * Frosted-glass window/door contact card. Same MQTT capability contract as
 * feezal-element-material-contact (attribute names, payload matching incl.
 * tilt, availability badge, HA discovery) — only the look differs: an icon +
 * label squircle whose card highlights and states "Open"/"Tilted" when the
 * contact is not closed. Like the material sibling it has no custom
 * inspector — the flat attribute form fits the contract.
 */

// E137: payloadMatch is cross-controller shared machinery now — re-exported
// here for back-compat with prior importers.
export {payloadMatch} from '@feezal/feezal-element';

const TYPE_ICONS = {
    window: 'sensor_window',
    door: 'sensor_door',
    generic: 'radio_button_checked',
    waterleak: 'water_drop',
    firealarm: 'local_fire_department',
    garagedoor: 'garage',
};

class FeezalElementGlassContact extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Glass', color: '#7aa5c9', icon: 'sensor_window'},
            description: 'Frosted-glass contact card — highlights while the window/door is open or tilted. ' +
                'Same MQTT contract as the material contact card.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'binary_sensor', map: contactDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared contact contract (subscribe/payloads/type +
                // the E124 battery trio) — declared ONCE by the controller.
                ...contactAttributes.filter(a => a.name !== 'type'),
                {name: 'type', type: 'select', options: ['window', 'door', 'generic', 'waterleak', 'firealarm', 'garagedoor'], default: 'window',
                    help: 'Default icon: window, door, generic, water droplet (leak), flame (fire/smoke), garage door.'},
                {name: 'icon',  type: 'string', help: 'Explicit icon name — overrides the type default.'},
                {name: 'text-open',   type: 'string', default: 'Open',   help: 'State text while open.'},
                {name: 'text-closed', type: 'string', default: 'Closed', help: 'State text while closed.'},
                {name: 'text-tilted', type: 'string', default: 'Tilted', help: 'State text while tilted.'},
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
                {property: '--feezal-glass-open-color', type: 'color', default: 'var(--warning-color, #ff9f0a)', help: 'Icon/state colour while open.'},
                {property: '--feezal-glass-tilt-color', type: 'color', default: 'var(--info-color, #0a84ff)', help: 'Icon/state colour while tilted.'},
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
        size:                  {type: String,  reflect: true},
        payloadOpen:           {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClosed:         {type: String,  reflect: true, attribute: 'payload-closed'},
        payloadTilted:         {type: String,  reflect: true, attribute: 'payload-tilted'},
        type:                  {type: String,  reflect: true},
        icon:                  {type: String,  reflect: true},
        textOpen:              {type: String,  reflect: true, attribute: 'text-open'},
        textClosed:            {type: String,  reflect: true, attribute: 'text-closed'},
        textTilted:            {type: String,  reflect: true, attribute: 'text-tilted'},
        label:                 {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
        degrade:               {type: Boolean, reflect: true},
        _state:     {state: true},   // 'closed' | 'open' | 'tilted'
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card {
            gap: 2px;
            transition: background 0.2s ease;
            --_state-color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .card.open   { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); --_state-color: var(--feezal-glass-open-color, #ff9f0a); }
        .card.tilted { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); --_state-color: var(--feezal-glass-tilt-color, #0a84ff); }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--_state-color); transition: color 0.2s ease; }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; color: var(--_state-color); }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* E124: low-battery warning, bottom-left (⚠ unavail owns top-right). */
        .batt {
            position: absolute; bottom: 8px; left: 10px;
            font-size: 14px; color: var(--warning-color, #ff9800); opacity: 0.9;
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
        this.payloadOpen = 'ON';
        this.payloadClosed = 'OFF';
        this.payloadTilted = '';
        this.type = 'window';
        this.icon = '';
        this.textOpen = 'Open';
        this.textClosed = 'Closed';
        this.textTilted = 'Tilted';
        this.label = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.contact = new ContactController(this);
        this.degrade = false;
        this._state = 'closed';
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.contact.rewireIfChanged();
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
    }

    _stateText() {
        if (this.contact.state === 'open') return this.textOpen || 'Open';
        if (this.contact.state === 'tilted') return this.textTilted || 'Tilted';
        return this.textClosed || 'Closed';
    }

    render() {
        return html`
            <div class="card ${this.contact.state}">
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                ${this.contact.batteryLow ? html`<feezal-icon class="batt" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
                <feezal-icon name="${this.icon || TYPE_ICONS[this.type] || TYPE_ICONS.window}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Contact' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-contact', FeezalElementGlassContact);
export {FeezalElementGlassContact};
