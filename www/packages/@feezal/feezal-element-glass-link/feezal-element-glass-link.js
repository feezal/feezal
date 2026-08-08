/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LinkController, linkAttributes, linkPopup, linkPopupStyles} from '@feezal/feezal-controller-link';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-link (E166)
 *
 * Frosted-glass link card — one tap opens a URL. All behaviour (dynamic href
 * from a topic, open modes incl. the iframe popup, the editor guard, #/view
 * in-place routing) lives in @feezal/feezal-controller-link; this is the
 * glass VIEW: frost card, icon or image face, label.
 */

class FeezalElementGlassLink extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Link', category: 'Glass', color: '#7aa5c9', icon: 'link'},
            description: 'Frosted-glass link card — one tap opens a URL (this tab, a new tab, or an ' +
                'embedded fullscreen popup). The target can be replaced at runtime by an MQTT message.',
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (172×128), 2x1 = wide. Empty keeps the current/manual size.'},
                // E166: the shared link contract — declared ONCE by the controller.
                ...linkAttributes,
                {name: 'icon', type: 'icon', default: 'link', help: 'Card icon (Material name or set:name). An image replaces it.'},
                {name: 'label', type: 'string', help: 'Card label.'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-label-color', type: 'color', default: 'var(--feezal-glass-muted, rgba(29,29,31,0.55))', help: 'Label colour (defaults to the frost muted colour).'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        size:        {type: String, reflect: true},
        href:        {type: String, reflect: true},
        open:        {type: String, reflect: true},
        image:       {type: String, reflect: true},
        icon:        {type: String, reflect: true},
        label:       {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
        degrade:     {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, linkPopupStyles, css`
        .card { gap: 2px; cursor: pointer; }
        feezal-icon {
            font-size: var(--feezal-glass-icon-size, 28px); line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .face-image {
            width: 100%; min-height: 0;
            /* flex-basis 0, not auto: the label is a flex sibling with its
               intrinsic height, and a zero basis makes the image take exactly
               the REMAINING space — the label's room is reserved before the
               image grows. (basis auto + max-height:100% sized the image
               against the whole card and squeezed the label out.) */
            flex: 1 1 0;
            /* contain, not cover: an oversized image scales to fit the card
               rather than being cropped to fill it. */
            object-fit: contain; border-radius: calc(var(--feezal-glass-radius, 24px) - 10px);
        }
        .label {
            flex: 0 0 auto;
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-label-color, var(--feezal-glass-muted, rgba(29,29,31,0.55)));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* E105 wide layout: icon left, label beside it. */
        @container (min-aspect-ratio: 2/1) {
            .card:not(.has-image) { flex-direction: row; justify-content: flex-start; gap: 10px; text-align: left; }
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.href = '';
        this.open = 'same-tab';
        this.image = '';
        this.icon = 'link';
        this.label = '';
        this.degrade = false;
        // E166: the behavior layer — wires/routes/opens; this view renders.
        this.link = new LinkController(this);
    }

    // The controller owns the subscription; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.link.rewireIfChanged();
        this.link.syncPopup();
        if (changed.has('size')) applySizePreset(this);
    }

    render() {
        return html`
            <div class="card ${this.image ? 'has-image' : ''}" @click="${() => this.link.activate()}">
                ${glassBadgeTray({unavailable: !this._available})}
                ${this.image
                    ? html`<img class="face-image" src="${this.image}" alt="">`
                    : html`<feezal-icon name="${this.icon || 'link'}"></feezal-icon>`}
                <span class="label">${this.label || (feezal.isEditor ? 'Link' : '')}</span>
            </div>
            ${this.link.popupOpen ? linkPopup(this.link) : ''}
        `;
    }
}

customElements.define('feezal-element-glass-link', FeezalElementGlassLink);
export {FeezalElementGlassLink};
