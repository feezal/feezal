import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';
import {LinkController, linkAttributes, linkPopup, linkPopupStyles} from '@feezal/feezal-controller-link';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-metro-link (E166)
 *
 * Metro live-tile link — one tap opens a URL. All behaviour lives in
 * @feezal/feezal-controller-link; this is the metro VIEW: flat accent tile,
 * icon or image face, bottom-left label. Front-only (no flip back side —
 * a link has no details).
 */

class FeezalElementMetroLink extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Link', category: 'Metro', color: '#00aba9', icon: 'link'},
            description: 'Metro tile link — one tap opens a URL (this tab, a new tab, or an embedded ' +
                'fullscreen popup). The target can be replaced at runtime by an MQTT message.',
            attributes: [
                // size / label / icon — the family's shared tile rows.
                ...MetroTileBase.tileAttributes,
                // E166: the shared link contract — declared ONCE by the controller.
                ...linkAttributes,
                ...availabilityAttributes(),
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-label-color', type: 'color', default: 'var(--feezal-metro-text, #ffffff)', help: 'Tile label colour (defaults to the tile text colour).'},
            ],
            defaultStyle: {width: '150px', height: '150px'},
            restrict: {minWidth: 40, minHeight: 40},
        };
    }

    static properties = {
        href:  {type: String, reflect: true},
        open:  {type: String, reflect: true},
        image: {type: String, reflect: true},
    };

    static styles = [MetroTileBase.styles, linkPopupStyles, css`
        .front { cursor: pointer; }
        feezal-icon { font-size: min(var(--_metro-icon-size), 48cqh); line-height: 1; }
        /* contain, not cover: an oversized image scales to fit the tile
           (letterboxed on the accent) rather than being cropped to fill it.
           Anchored inside .center, whose own bottom inset (18px) is the
           family's reserved label strip — so the face clears the label by
           construction. NOT height:auto + a bottom inset: for a replaced
           element with top and bottom set, auto height means the intrinsic
           ratio wins and bottom is IGNORED — measured, the image ran under
           the label exactly that way. */
        .face-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        .tlabel { color: var(--feezal-metro-label-color, var(--feezal-metro-text, #fff)); }
    `];

    constructor() {
        super();
        this.href = '';
        this.open = 'same-tab';
        this.image = '';
        this.icon = 'link';
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

    /** Front tap (editor-guarded by MetroTileBase._frontClick). */
    baseAction() {
        this.link.activate();
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        return this.image
            ? html`<img class="face-image" src="${this.image}" alt="">`
            : html`<feezal-icon name="${this.icon || 'link'}"></feezal-icon>`;
    }

    render() {
        // The tile itself is the base render; the popup rides beside it so the
        // top-layer promotion finds it in this shadow root.
        return html`${super.render()}${this.link.popupOpen ? linkPopup(this.link) : ''}`;
    }
}

customElements.define('feezal-element-metro-link', FeezalElementMetroLink);
export {FeezalElementMetroLink};
