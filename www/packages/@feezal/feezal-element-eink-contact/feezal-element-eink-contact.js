/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
// E137: the contact behavior lives in the shared controller — this element
// is a VIEW (eink chrome: inverted block while not closed).
import {ContactController, contactAttributes, contactDiscoveryMap} from '@feezal/feezal-controller-contact';

/**
 * feezal-element-eink-contact (E57)
 *
 * E-ink window/door contact card: oversized state word (OPEN / CLOSED /
 * TILTED), whole card inverts while not closed. Same wiring contract as the
 * other contact cards (open/closed/tilted payloads + E124 battery).
 */

class FeezalElementEinkContact extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Eink', color: '#222222', icon: 'sensor_door'},
            description: 'E-ink contact card — OPEN/CLOSED/TILTED state word, inverted while open, 1-bit.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'binary_sensor', map: contactDiscoveryMap},
            attributes: [
                // E137: the shared contact contract (subscribe/payloads/type +
                // the E124 battery quartet) — declared ONCE by the controller.
                ...contactAttributes,
                {name: 'text-open',   type: 'string', default: '', help: 'State word while open. Blank = "Open".'},
                {name: 'text-closed', type: 'string', default: '', help: 'State word while closed. Blank = "Closed".'},
                {name: 'text-tilted', type: 'string', default: '', help: 'State word while tilted. Blank = "Tilted".'},
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
        subscribe:     {type: String, reflect: true},
        msgProp:       {type: String, reflect: true, attribute: 'message-property'},
        payloadOpen:   {type: String, reflect: true, attribute: 'payload-open'},
        payloadClosed: {type: String, reflect: true, attribute: 'payload-closed'},
        payloadTilted: {type: String, reflect: true, attribute: 'payload-tilted'},
        type:          {type: String, reflect: true},
        textOpen:   {type: String, reflect: true, attribute: 'text-open'},
        textClosed: {type: String, reflect: true, attribute: 'text-closed'},
        textTilted: {type: String, reflect: true, attribute: 'text-tilted'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
        label:       {type: String, reflect: true},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 2px; align-items: flex-start; }
        feezal-icon { font-size: var(--feezal-eink-icon-size, 28px); line-height: 1; }
        .state { font-size: var(--feezal-eink-font-size-value, 22px); line-height: 1.05;
            text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.msgProp = '';
        this.payloadOpen = 'ON';
        this.payloadClosed = 'OFF';
        this.payloadTilted = '';
        this.type = 'window';
        this.textOpen = '';
        this.textClosed = '';
        this.textTilted = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.label = '';
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.contact = new ContactController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.contact.rewireIfChanged();
    }

    _stateText() {
        if (this.contact.state === 'open') return this.textOpen || 'Open';
        if (this.contact.state === 'tilted') return this.textTilted || 'Tilted';
        return this.textClosed || 'Closed';
    }

    _icon() {
        const icons = {window: 'window', door: 'sensor_door', generic: 'sensors',
            waterleak: 'water_damage', firealarm: 'local_fire_department', garagedoor: 'garage'};
        return icons[this.type] || 'window';
    }

    /** E57 redraw dedup: state word + badges are the visible output. */
    renderSignature() {
        return [this.contact.state, this.contact.batteryLow, this._available].join('|');
    }

    render() {
        return html`
            <div class="card ${this.contact.state === 'closed' ? '' : 'inv'}">
                ${!this._available ? html`<span class="badge-tr" title="Device unavailable">!</span>` : ''}
                ${this.contact.batteryLow ? html`<feezal-icon class="badge-tl" name="battery_alert" title="Battery low"></feezal-icon>` : ''}
                <feezal-icon name="${this._icon()}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Contact' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-contact', FeezalElementEinkContact);
export {FeezalElementEinkContact};
