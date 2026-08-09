/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {FeezalSearchBase} from '@feezal/feezal-element/feezal-search-filter.js';

/**
 * feezal-element-metro-search (E170)
 *
 * Metro-style search bar — flat accent-coloured strip, sharp corners, white
 * type — that live-filters the elements of its view by label/href
 * (debounced, case-insensitive; elements with neither attribute stay
 * visible). × clears; viewer-only filtering. Behavior in FeezalSearchBase;
 * this is the Metro VIEW. Deliberately NOT a flip tile — a search bar has
 * no back side; it aligns with the tile mosaic via plain width/height.
 */
class FeezalElementMetroSearch extends FeezalSearchBase {
    static get feezal() {
        return {
            palette: {name: 'Search', category: 'Metro', color: '#00aba9', icon: 'search'},
            description: 'Flat Metro search bar that live-filters this view: elements whose label or link URL ' +
                'does not match the (debounced, case-insensitive) query are hidden; elements without a label ' +
                'stay visible. × or Escape clears. Filtering runs in the viewer only.',
            attributes: [
                ...FeezalSearchBase.searchAttributes,
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-metro-accent', type: 'color', default: 'var(--primary-color)',
                    help: 'Bar colour (theme accent by default — WP7 cyan with feezal-theme-metro).'},
                {property: '--feezal-metro-text', type: 'color', default: '#ffffff', help: 'Bar text/icon colour.'},
                {property: '--feezal-search-font-size', default: '15px', help: 'Input font size.'},
            ],
            defaultStyle: {width: '310px', height: '44px'},
            restrict: {minWidth: 120, minHeight: 36},
        };
    }

    static styles = [feezalBaseStyles, css`
        :host { display: block; }
        .search {
            width: 100%; height: 100%; box-sizing: border-box;
            display: flex; align-items: center; gap: 4px; padding: 0 4px 0 12px;
            background: var(--feezal-metro-accent, var(--primary-color));
            color: var(--feezal-metro-text, #ffffff);
            font-family: 'Segoe UI', 'Segoe UI Light', -apple-system, sans-serif;
        }
        input {
            flex: 1; min-width: 0; border: none; background: none; outline: none; padding: 0;
            font: inherit; font-size: var(--feezal-search-font-size, 15px); font-weight: 300;
            color: inherit;
        }
        input::placeholder { color: var(--feezal-metro-text, #ffffff); opacity: 0.65; }
        input::-webkit-search-cancel-button { display: none; }
        .sx {
            flex: 0 0 auto; width: 32px; height: 32px; border: none; cursor: pointer;
            background: none; font-size: 20px; line-height: 1; color: inherit; opacity: 0.85;
        }
        .sx:hover { opacity: 1; background: rgba(0,0,0,0.15); }
    `];

    render() {
        return this.renderSearchInput();
    }
}

customElements.define('feezal-element-metro-search', FeezalElementMetroSearch);
export {FeezalElementMetroSearch};
