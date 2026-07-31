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
            // mirror of the animation's Dreh-Kipp window: SQUARE Rahmen +
            // Flügel at rest, the perspective trapezoid exists only in the
            // open/tilted states (hinge/bottom edge nailed to the frame),
            // handle on the free edge (closed = down, open = left, tilted =
            // up) foreshortened by the same offset camera. The quads and
            // handle numbers are the generator's projections verbatim
            // (CAM {30,35,240}, swing 78°, kipp 32°) — retune THERE, then
            // copy the printed values here.
            const Q = {
                closed: {sash: 'M18.75,18.75 L81.25,18.75 L81.25,81.25 L18.75,81.25 Z',
                    glass: 'M20,20 L80,20 L80,80 L20,80 Z',
                    hx: 75.5, hy: 50, deg: 0, ls: [1, 1], pr: [2.5, 2.5]},
                open: {sash: 'M18.8,18.8 L32.3,13.2 L32.3,97.1 L18.8,81.3 Z',
                    glass: 'M19,19.9 L32,15 L32,95 L19,80.2 Z',
                    hx: 30.7, hy: 54.5, deg: 90, ls: [1.30, 0.28], pr: [0.74, 3.25]},
                tilted: {sash: 'M16.9,27.2 L89.5,27.2 L81.3,81.3 L18.8,81.3 Z',
                    glass: 'M18.4,28.4 L87.8,28.4 L80.1,80.3 L20,80.3 Z',
                    hx: 78.9, hy: 56.2, deg: 180, ls: [1.08, 0.89], pr: [2.7, 2.22]},
            };
            const q = Q[state] || Q.closed;
            return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <rect x="14" y="14" width="72" height="72" rx="2" stroke-width="4.5" style="${baseStroke}"/>
                <path class="tone-active" d="${q.glass}" opacity="0.38"/>
                <path d="${q.sash}" stroke-width="3" stroke-opacity="0.72" style="${baseStroke}"/>
                <ellipse class="tone-base" cx="${q.hx}" cy="${q.hy}" rx="${q.pr[0]}" ry="${q.pr[1]}"/>
                <g transform="translate(${q.hx} ${q.hy}) rotate(${q.deg}) scale(${q.ls[0]} ${q.ls[1]})">
                    <rect class="tone-base" x="-1.4" y="0" width="2.8" height="10.5" rx="1.4"/>
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
