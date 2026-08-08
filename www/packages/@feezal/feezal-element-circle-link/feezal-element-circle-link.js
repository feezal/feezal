/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {LinkController, linkAttributes, linkPopup, linkPopupStyles} from '@feezal/feezal-controller-link';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-circle-link (E166)
 *
 * Circle-family link — a large round button that opens a URL on tap. All
 * behaviour lives in @feezal/feezal-controller-link; this is the circle VIEW:
 * the family's disc footprint (circle-switch's proportions), icon or image
 * face, label below.
 */

class FeezalElementCircleLink extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Link', category: 'Circle', color: '#1565c0', icon: 'link'},
            description: 'Round link button — one tap opens a URL (this tab, a new tab, or an embedded ' +
                'fullscreen popup). The target can be replaced at runtime by an MQTT message.',
            attributes: [
                // E166: the shared link contract — declared ONCE by the controller.
                ...linkAttributes,
                {name: 'icon', type: 'icon', default: 'link', help: 'Button icon (Material name or set:name). An image replaces it.'},
                {name: 'label', type: 'string', default: '', help: 'Optional label shown below the button.'},
                ...availabilityAttributes(),
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-link-color', type: 'color', default: 'var(--primary-color)', help: 'Disc colour.'},
                {property: '--feezal-link-icon-color', type: 'color', default: 'var(--primary-background-color)', help: 'Icon colour on the disc.'},
                {property: '--feezal-link-text-color', type: 'color', default: 'var(--primary-text-color)', help: 'Label colour.'},
                {property: '--feezal-link-error-color', type: 'color', default: 'var(--error-color)', help: 'Unavailable badge colour.'},
            ],
            defaultStyle: {width: '180px', height: '220px'},
            restrict: {minWidth: 60, minHeight: 60},
        };
    }

    static properties = {
        href:  {type: String, reflect: true},
        open:  {type: String, reflect: true},
        image: {type: String, reflect: true},
        icon:  {type: String, reflect: true},
        label: {type: String, reflect: true},
        // N31: availability inherited from FeezalElement.
    };

    static styles = [feezalBaseStyles, linkPopupStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center;
            padding: 6px; box-sizing: border-box; overflow: hidden; gap: 8px;
            position: relative;
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            font-size: 18px; line-height: 1;
            color: var(--feezal-link-error-color, var(--error-color));
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .disc {
            width: min(100%, 76cqh); aspect-ratio: 1; border-radius: 50%;
            flex-shrink: 1; min-height: 0;
            display: flex; align-items: center; justify-content: center;
            background: var(--feezal-link-color, var(--primary-color));
            cursor: pointer; user-select: none; overflow: hidden;
            -webkit-tap-highlight-color: transparent;
        }
        .disc:active { filter: brightness(0.92); }
        feezal-icon {
            font-size: min(56px, 38cqh); line-height: 1;
            color: var(--feezal-link-icon-color, var(--primary-background-color));
        }
        .face-image { width: 100%; height: 100%; object-fit: cover; }
        .label {
            flex: 0 0 auto; font-size: 15px; font-weight: 600; text-align: center;
            color: var(--feezal-link-text-color, var(--primary-text-color));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
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

    connectedCallback() {
        super.connectedCallback();
        // The disc is sized against the host (cqh) — same container mode the
        // other circle cards use.
        this.style.containerType = 'size';
    }

    updated(changed) {
        super.updated(changed);
        this.link.rewireIfChanged();
        this.link.syncPopup();
    }

    render() {
        return html`
            ${this._available ? '' : html`<span class="unavail" title="Unavailable">!</span>`}
            <div class="disc" @click="${() => this.link.activate()}">
                ${this.image
                    ? html`<img class="face-image" src="${this.image}" alt="">`
                    : html`<feezal-icon name="${this.icon || 'link'}"></feezal-icon>`}
            </div>
            ${this.label || feezal.isEditor
                ? html`<span class="label">${this.label || (feezal.isEditor ? 'Link' : '')}</span>` : ''}
            ${this.link.popupOpen ? linkPopup(this.link) : ''}
        `;
    }
}

customElements.define('feezal-element-circle-link', FeezalElementCircleLink);
export {FeezalElementCircleLink};
