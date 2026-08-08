/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
import {LinkController, linkAttributes, linkPopup, linkPopupStyles} from '@feezal/feezal-controller-link';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-eink-link (E166)
 *
 * E-ink link panel — one tap opens a URL. All behaviour lives in
 * @feezal/feezal-controller-link; this is the 1-bit VIEW: icon + oversized
 * uppercase label, family rule/border, no animation. An `image` face renders
 * as-is (the panel cannot dither it — a monochrome asset keeps the look).
 */

class FeezalElementEinkLink extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Link', category: 'Eink', color: '#222222', icon: 'link'},
            description: 'E-ink link panel — one tap opens a URL (this tab, a new tab, or an embedded ' +
                'fullscreen popup). The target can be replaced at runtime by an MQTT message.',
            attributes: [
                // E166: the shared link contract — declared ONCE by the controller.
                ...linkAttributes,
                {name: 'icon', type: 'icon', default: 'link', help: 'Panel icon (Material name or set:name). An image replaces it.'},
                {name: 'label', type: 'string', help: 'Label (rendered uppercase).'},
                ...availabilityAttributes(),
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-icon-size', default: '28px', help: 'Icon size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '180px', height: '120px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        href:  {type: String, reflect: true},
        open:  {type: String, reflect: true},
        image: {type: String, reflect: true},
        icon:  {type: String, reflect: true},
        label: {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, einkCardStyles, linkPopupStyles, css`
        .card { gap: 2px; align-items: flex-start; cursor: pointer; }
        feezal-icon { font-size: var(--feezal-eink-icon-size, 28px); line-height: 1; }
        .face-image { width: 100%; flex: 1 1 auto; min-height: 0; object-fit: cover; }
    `];

    constructor() {
        super();
        this.href = '';
        this.open = 'same-tab';
        this.image = '';
        this.icon = 'link';
        this.label = '';
        // E166: the behavior layer — wires/routes/opens; this view renders.
        this.link = new LinkController(this);
    }

    // The controller owns the subscription; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.link.rewireIfChanged();
        this.link.syncPopup();
    }

    /** E57 redraw dedup: everything visible on the panel. */
    renderSignature() {
        return [this.icon, this.image, this.label, this._available, this.link.popupOpen].join('|');
    }

    render() {
        return html`
            <div class="card" @click="${() => this.link.activate()}">
                ${this._available ? '' : html`<span class="badge-tr" title="Device unavailable">!</span>`}
                ${this.image
                    ? html`<img class="face-image" src="${this.image}" alt="">`
                    : html`<feezal-icon name="${this.icon || 'link'}"></feezal-icon>`}
                <span class="label">${this.label || (feezal.isEditor ? 'Link' : '')}</span>
            </div>
            ${this.link.popupOpen ? linkPopup(this.link) : ''}
        `;
    }
}

customElements.define('feezal-element-eink-link', FeezalElementEinkLink);
export {FeezalElementEinkLink};
