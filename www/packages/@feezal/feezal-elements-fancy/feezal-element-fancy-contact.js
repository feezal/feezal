/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {sabotageBadge, faultBadge, feezalFaultStyles} from '@feezal/feezal-element/feezal-hm-fault.js';
import {ContactController, contactAttributes, contactDiscoveryMap} from '@feezal/feezal-controller-contact';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-contact (E139) — the window/door/garage visibly swings
 * open and closed (window incl. the Homematic tilt tristate — three poses
 * with clips between them). Behavior = the shared ContactController (E137).
 */
class FeezalElementFancyContact extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Contact', category: 'Fancy', color: '#7a5c9e', icon: 'sensor_door'},
            description: 'Animated contact card — the window/door/garage swings open and closed ' +
                '(window includes the tilt state). Flat duotone vector animation, theme-recoloured.',
            discovery: {component: 'binary_sensor', map: contactDiscoveryMap},
            attributes: [
                ...contactAttributes,
                ...fancyCommonAttributes,
                {name: 'text-open',   type: 'string', default: '', defaultI18n: {de: 'Offen'}, help: 'State word while open. Blank = "Open".'},
                {name: 'text-closed', type: 'string', default: '', defaultI18n: {de: 'Geschlossen'}, help: 'State word while closed. Blank = "Closed".'},
                {name: 'text-tilted', type: 'string', default: '', defaultI18n: {de: 'Gekippt'}, help: 'State word while tilted. Blank = "Tilted". Window type only.'},
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Topic reporting device availability — a badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', section: 'Availability', default: 'payload', help: 'Property path within availability messages.'},
                {name: 'payload-available',   type: 'string', section: 'Availability', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', section: 'Availability', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: fancyStyleDescriptors,
            defaultStyle: {width: '140px', height: '150px'},
            restrict: {minWidth: 80, minHeight: 90},
        };
    }

    static properties = {
        subscribe:     {type: String, reflect: true},
        payloadOpen:   {type: String, reflect: true, attribute: 'payload-open'},
        payloadClosed: {type: String, reflect: true, attribute: 'payload-closed'},
        payloadTilted: {type: String, reflect: true, attribute: 'payload-tilted'},
        type:          {type: String, reflect: true},
        textOpen:   {type: String, attribute: 'text-open'},
        textClosed: {type: String, attribute: 'text-closed'},
        textTilted: {type: String, attribute: 'text-tilted'},
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
    };

    static styles = [...fancyBadgeStyles, feezalFaultStyles, fancyCardStyles];

    constructor() {
        super();
        this.subscribe = '';
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
        this.contact = new ContactController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.contact.rewireIfChanged();
    }

    animationKey() {
        const t = this.type || 'window';
        return `contact-${['window', 'door', 'garagedoor', 'generic'].includes(t) ? t : 'window'}`;
    }

    stateKey() { return this.contact.state; }

    stateText() {
        if (this.contact.tilted) return this.textTilted || 'Tilted';
        return this.contact.open ? (this.textOpen || 'Open') : (this.textClosed || 'Closed');
    }

    renderPose() {
        const {state} = this.contact;
        const t = this.type || 'window';
        const baseStroke = 'fill: none; stroke: var(--feezal-fancy-base-color, var(--secondary-text-color))';
        if (t === 'window') {
            // mirror of the animation's mock-perspective Dreh-Kipp window:
            // Rahmen + Flügel stroke quads, half-transparent glass, and the
            // handle on the free edge (closed = down, open = left, tilted = up)
            const handleDeg = state === 'open' ? 90 : state === 'tilted' ? 180 : 0;
            const sashTf = state === 'open' ? 'rotate(-24 21 50)'
                : state === 'tilted' ? 'translate(0 16.83) scale(1 0.78)' : '';
            return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <path d="M14,14 L84,20 L84,80 L14,86 Z" stroke-width="4.5" style="${baseStroke}"/>
                <g transform="${sashTf}">
                    <path class="tone-active" d="M24.5,24.5 L74.5,29.5 L74.5,71.5 L24.5,75.5 Z"
                        opacity="0.38"/>
                    <path d="M21.5,21.5 L77.5,26.5 L77.5,74.5 L21.5,78.5 Z"
                        stroke-width="3" style="${baseStroke}"/>
                    <circle class="tone-base" cx="71.5" cy="50.5" r="2.5"/>
                    <rect class="tone-base" x="70.1" y="50.5" width="2.8" height="10.5" rx="1.4"
                        transform="rotate(${handleDeg} 71.5 50.5)"/>
                </g>
            </svg>`;
        }
        let sash;
        if (t === 'garagedoor') {
            sash = svg`<rect class="tone-active" x="24" y="${state === 'open' ? 16 : 21}"
                width="52" height="${state === 'open' ? 10 : 52}" rx="2"/>`;
        } else {
            const deg = state === 'open' ? -55 : 0;
            sash = svg`<rect class="tone-active" x="24" y="21" width="52" height="52" rx="2"
                transform="rotate(${deg} 24 47)"/>`;
        }
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <rect class="tone-base" x="12" y="12" width="76" height="76" rx="4"
                stroke-width="7" style="${baseStroke}"/>
            ${sash}
        </svg>`;
    }

    renderBadges() {
        return html`
            ${batteryLowBadge(this.contact.batteryLow)}
            ${sabotageBadge(this.contact.sabotage)}
            ${faultBadge(this.contact.error)}
        `;
    }
}

customElements.define('feezal-element-fancy-contact', FeezalElementFancyContact);
export {FeezalElementFancyContact};
