/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {CoverController, coverAttributes, coverDiscoveryMap} from '@feezal/feezal-controller-cover';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-cover (E139) — the blind actually travels: the
 * animation SEEKS by the reported position (position % → frame within the
 * travel segment), so the blind stands where the device says — settling-aware
 * for free, because it renders the controller's position, not the commands.
 * Tap toggles open/close (top half opens, bottom half closes).
 */
class FeezalElementFancyCover extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Cover', category: 'Fancy', color: '#7a5c9e', icon: 'blinds'},
            description: 'Animated cover card — the blind travels to the reported position. ' +
                'Tap the upper half to open, the lower half to close. Theme-recoloured duotone animation.',
            discovery: {component: 'cover', map: coverDiscoveryMap},
            attributes: [
                ...coverAttributes,
                ...fancyCommonAttributes,
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
        subscribe:       {type: String, reflect: true},
        publishPosition: {type: String, reflect: true, attribute: 'publish-position'},
        publishCommand:  {type: String, reflect: true, attribute: 'publish-command'},
        positionMin:     {type: Number, reflect: true, attribute: 'position-min'},
        positionMax:     {type: Number, reflect: true, attribute: 'position-max'},
    };

    static styles = [...fancyBadgeStyles, fancyCardStyles, css`
        .stage { cursor: pointer; }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.publishPosition = '';
        this.publishCommand = '';
        this.cover = new CoverController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.cover.rewireIfChanged();
    }

    animationKey() { return 'cover'; }

    stateKey() { return null; }   // this card seeks, it never plays

    seekFraction() {
        // position: 100 = open (blind up) → travel fraction 0
        const pos = this.cover.position;
        return {name: 'travel', t: pos === null ? 0 : 1 - (pos / 100)};
    }

    stateText() {
        const pos = this.cover.position;
        if (pos === null) return '—';
        return `${Math.round(pos)} %`;
    }

    _tap(e) {
        if (feezal.isEditor) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const upper = (e.clientY - rect.top) < rect.height / 2;
        if (upper) this.cover.up();
        else this.cover.down();
    }

    renderPose() {
        const pos = this.cover.position;
        const closedness = pos === null ? 0 : 1 - (pos / 100);
        const h = 6 + closedness * 58;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            <rect class="tone-base" x="12" y="12" width="76" height="76" rx="4"
                fill="none" style="stroke: var(--feezal-fancy-base-color, var(--secondary-text-color))" stroke-width="7"/>
            <rect class="tone-active" x="18" y="18" width="64" height="${h}" rx="2"/>
        </svg>`;
    }

    render() {
        return html`<div @click="${e => this._tap(e)}">${super.render()}</div>`;
    }
}

customElements.define('feezal-element-fancy-cover', FeezalElementFancyCover);
export {FeezalElementFancyCover};
