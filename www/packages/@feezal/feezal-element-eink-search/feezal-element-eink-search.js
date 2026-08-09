/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {FeezalSearchBase} from '@feezal/feezal-element/feezal-search-filter.js';

/**
 * feezal-element-eink-search (E170)
 *
 * E-ink search field — 1-bit look: white ground, solid black border, no
 * greys, no animation — that live-filters the elements of its view by
 * label/href (debounced, case-insensitive; elements with neither attribute
 * stay visible). × clears; viewer-only filtering. Behavior in
 * FeezalSearchBase; this is the e-ink VIEW. Deliberately no colour knobs
 * (1-bit family) and no redraw-dedup base — an interactive input redraws
 * by definition.
 */
class FeezalElementEinkSearch extends FeezalSearchBase {
    static get feezal() {
        return {
            palette: {name: 'Search', category: 'Eink', color: '#222222', icon: 'search'},
            description: 'E-ink search field (1-bit look) that live-filters this view: elements whose label or ' +
                'link URL does not match the (debounced, case-insensitive) query are hidden; elements without ' +
                'a label stay visible. × or Escape clears. Filtering runs in the viewer only.',
            attributes: [
                ...FeezalSearchBase.searchAttributes,
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-search-font-size', default: '14px', help: 'Input font size.'},
            ],
            defaultStyle: {width: '220px', height: '40px'},
            restrict: {minWidth: 110, minHeight: 32},
        };
    }

    static styles = [feezalBaseStyles, css`
        :host { display: block; }
        .search {
            width: 100%; height: 100%; box-sizing: border-box;
            display: flex; align-items: center; gap: 2px; padding: 0 2px 0 10px;
            background: #ffffff; border: 2px solid #000000;
            font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
        }
        input {
            flex: 1; min-width: 0; border: none; background: none; outline: none; padding: 0;
            font: inherit; font-size: var(--feezal-search-font-size, 14px);
            color: #000000;
        }
        input::placeholder { color: #000000; opacity: 1; font-style: italic; }
        input::-webkit-search-cancel-button { display: none; }
        .sx {
            flex: 0 0 auto; width: 28px; height: 28px; border: none; cursor: pointer;
            background: #ffffff; color: #000000; font-size: 18px; line-height: 1; font-weight: 700;
        }
        .sx:hover { background: #000000; color: #ffffff; }
    `];

    render() {
        return this.renderSearchInput();
    }
}

customElements.define('feezal-element-eink-search', FeezalElementEinkSearch);
export {FeezalElementEinkSearch};
