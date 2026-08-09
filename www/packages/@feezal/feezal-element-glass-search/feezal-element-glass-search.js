/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {FeezalSearchBase} from '@feezal/feezal-element/feezal-search-filter.js';
import {glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-search (E170)
 *
 * Frosted-glass search pill that live-filters the elements of its view by
 * their label/href (debounced, case-insensitive; elements with neither
 * attribute stay visible). × clears; viewer-only filtering. All behavior
 * lives in FeezalSearchBase — this is the glass VIEW: frost pill, the
 * family's blur/tint tokens, an in-field clear button.
 */
class FeezalElementGlassSearch extends FeezalSearchBase {
    static get feezal() {
        return {
            palette: {name: 'Search', category: 'Glass', color: '#7aa5c9', icon: 'search'},
            description: 'Frosted-glass search pill that live-filters this view: elements whose label or link ' +
                'URL does not match the (debounced, case-insensitive) query are hidden; elements without a ' +
                'label stay visible. × or Escape clears. Filtering runs in the viewer only.',
            attributes: [
                ...FeezalSearchBase.searchAttributes,
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid pill — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-search-font-size', default: '14px', help: 'Input font size.'},
                {property: '--feezal-search-color', type: 'color', default: 'var(--feezal-glass-color, #1d1d1f)', help: 'Input text colour.'},
            ],
            defaultStyle: {width: '220px', height: '52px'},
            restrict: {minWidth: 120, minHeight: 44},
        };
    }

    static properties = {
        degrade: {type: Boolean, reflect: true},
    };

    constructor() {
        super();
        this.degrade = false;
    }

    static styles = [feezalBaseStyles, glassCardStyles, css`
        /* Pill: one row, fully rounded, input transparent over the frost. */
        .card { flex-direction: row; align-items: center; justify-content: flex-start;
            padding: 0 6px 0 14px; gap: 4px;
            border-radius: calc(var(--feezal-glass-margin, 6px) + 999px); }
        :host([degrade]) .card {
            -webkit-backdrop-filter: none; backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(255,255,255,0.82));
        }
        .search { flex: 1; min-width: 0; display: flex; align-items: center; }
        input {
            flex: 1; min-width: 0; box-sizing: border-box;
            border: none; background: none; outline: none; padding: 0;
            font: inherit; font-size: var(--feezal-search-font-size, 14px);
            color: var(--feezal-search-color, var(--feezal-glass-color, #1d1d1f));
        }
        input::placeholder { color: var(--feezal-glass-muted, rgba(29,29,31,0.55)); }
        input::-webkit-search-cancel-button { display: none; }
        .sx {
            flex: 0 0 auto; width: 28px; height: 28px; border: none; cursor: pointer;
            border-radius: 50%; background: none; font-size: 18px; line-height: 1;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        }
        .sx:hover { background: rgba(128,128,128,0.15); }
    `];

    render() {
        return html`<div class="card">${this.renderSearchInput()}</div>`;
    }
}

customElements.define('feezal-element-glass-search', FeezalElementGlassSearch);
export {FeezalElementGlassSearch};
