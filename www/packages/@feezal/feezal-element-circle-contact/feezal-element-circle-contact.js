/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
// E137: the contact behavior lives in the shared controller — this element
// is a VIEW (Circle chrome: the E134 state disc, mirroring material-sensor /
// material-light). E138 dropped the leak/fire alarm "types" — those are
// alarm-character sensors and belong on the material-sensor card.
import {ContactController, contactAttributes, contactDiscoveryMap} from '@feezal/feezal-controller-contact';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementCircleContact extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Circle', color: '#1565c0', icon: 'sensor_window'},
            description: 'Window / door / garage contact sensor. Renders the E134 circle state disc with the type ' +
                'icon and state word — primary-coloured while open, tilt colour while tilted, muted while closed. ' +
                'For room overviews compose multiple contact elements (U32 component or repeater).',
// E137: the discovery map is the controller package's fragment.
            discovery: {component: 'binary_sensor', map: contactDiscoveryMap},
            attributes: [
                // E137: the shared contact contract — declared ONCE by the
                // controller package (incl. the E124 battery trio). `type` is
                // spread through as-is (E138: window / door / generic / garage).
                ...contactAttributes,
                {name: 'text-open',   type: 'string', default: '', help: 'State word while open. Blank = "Open".'},
                {name: 'text-tilted', type: 'string', default: '', help: 'State word while tilted. Blank = "Tilted". Window type only.'},
                {name: 'text-closed', type: 'string', default: '', help: 'State word while closed. Blank = "Closed".'},
                {name: 'label',                  type: 'string',    default: '',      help: 'Optional card label shown below the disc.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',      type: 'string',    default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string',    default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-contact-open-color',   type: 'color', default: 'var(--primary-color)',      help: 'Disc colour while the contact is open.'},
                {property: '--feezal-contact-tilt-color',   type: 'color', default: 'var(--info-color)',         help: 'Disc colour while the window is tilted.'},
                {property: '--feezal-contact-text-color',   type: 'color', default: 'var(--primary-text-color)', help: 'Label / state text colour.'},
                {property: '--feezal-contact-error-color',  type: 'color', default: 'var(--error-color)',        help: 'Unavailability badge colour.'},
            ],
            restrict:     {minWidth: 60, minHeight: 80},
            defaultStyle: {width: '80px', height: '120px'},
        };
    }

    static properties = {
        subscribe:             {type: String,  reflect: true},
        payloadOpen:           {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClosed:         {type: String,  reflect: true, attribute: 'payload-closed'},
        payloadTilted:         {type: String,  reflect: true, attribute: 'payload-tilted'},
        type:                  {type: String,  reflect: true},
        textOpen:              {type: String,  reflect: true, attribute: 'text-open'},
        textTilted:            {type: String,  reflect: true, attribute: 'text-tilted'},
        textClosed:            {type: String,  reflect: true, attribute: 'text-closed'},
        // E124 — dedicated low-battery warning
        subscribeBatteryLow:   {type: String,  reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:     {type: String,  reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:     {type: String,  reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold:   {type: Number,  reflect: true, attribute: 'battery-low-threshold'},
        label:                 {type: String,  reflect: true},
        // N31: availability inherited from FeezalElement.
        // E137: contact state lives on the ContactController.
        discoveryId:           {type: String,  reflect: true, attribute: 'discovery-id'},
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
            /* E134: the state disc sizes its content in cqi (card width). */
            container-type: inline-size;
            /* E138: open default → --primary-color (ContactController.activeColorVar). */
            --feezal-contact-open-color:  var(--primary-color, #1565c0);
            --feezal-contact-tilt-color:  var(--info-color, #2196f3);
            --feezal-contact-text-color:  var(--primary-text-color, var(--feezal-color, #333));
            --feezal-contact-error-color: var(--error-color, #b00020);
            color: var(--feezal-contact-text-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-contact-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* B50/E134: width-sized, TOP-anchored — the material-light ring pattern
           (.disc-wrap: width:100% + flex-shrink:0, NOT flex:1, so the disc never
           stretches to the card height → always a circle, never an ellipse).
           Rows below (label) stack underneath and clip on short cards. */
        /* E139: the disc sits in a square (aspect-ratio:1) wrap = the light/climate
           ring footprint and is centred, so its centre aligns concentrically with
           those rings across every Circle card. */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        /* E134: the circle state disc — width-sized circle at the top of the
           card, centred type icon + state word, ring/fill while open/tilted,
           muted while closed. cqi units scale with the card. */
        .disc {
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 1cqi;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .disc feezal-icon { font-size: 26cqi; line-height: 1; opacity: 0.55; }
        .disc .htext { font-size: 8cqi; font-weight: 600; opacity: 0.75; }
        .disc.open {
            color: var(--feezal-contact-open-color);
            border-color: var(--feezal-contact-open-color);
            background: color-mix(in srgb, var(--feezal-contact-open-color) 16%, transparent);
        }
        .disc.tilted {
            color: var(--feezal-contact-tilt-color);
            border-color: var(--feezal-contact-tilt-color);
            background: color-mix(in srgb, var(--feezal-contact-tilt-color) 16%, transparent);
        }
        .disc.open feezal-icon,
        .disc.tilted feezal-icon { opacity: 1; }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-contact-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.payloadOpen           = 'ON';
        this.payloadClosed         = 'OFF';
        this.payloadTilted         = '';
        this.type                  = 'window';
        this.textOpen              = '';
        this.textTilted            = '';
        this.textClosed            = '';
        this.subscribeBatteryLow   = '';
        this.msgPropBatteryLow     = '';
        this.payloadBatteryLow     = 'true';
        this.batteryLowThreshold   = 15;
        this.label                 = '';
        this.discoveryId           = '';
        // E137: the behavior layer — wires/parses/matches; this view renders.
        this.contact = new ContactController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.contact.rewireIfChanged();
    }

    _icon() {
        const open = this.contact.state !== 'closed';
        switch (this.type) {
            case 'door':       return open ? 'door_open' : 'door_front';
            case 'generic':    return open ? 'radio_button_checked' : 'radio_button_unchecked';
            case 'garagedoor': return 'garage';
            default:           return 'sensor_window'; // window
        }
    }

    _stateText() {
        if (this.contact.state === 'open')   return this.textOpen   || 'Open';
        if (this.contact.state === 'tilted') return this.textTilted || 'Tilted';
        return this.textClosed || 'Closed';
    }

    render() {
        const state = this.contact.state; // 'closed' | 'open' | 'tilted'
        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${batteryLowBadge(this.contact.batteryLow)}
            <div class="disc-wrap">
                <div class="disc ${state === 'open' ? 'open' : ''} ${state === 'tilted' ? 'tilted' : ''}">
                    <feezal-icon name="${this._icon()}"></feezal-icon>
                    <span class="htext">${this._stateText()}</span>
                </div>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-contact', FeezalElementCircleContact);
export {FeezalElementCircleContact};
