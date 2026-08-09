/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {FeezalSearchBase} from '@feezal/feezal-element/feezal-search-filter.js';

/**
 * feezal-element-basic-search (E170)
 *
 * Minimal search bar that live-filters the elements of its view: typing
 * hides every sibling whose `label`/`href` does not match (debounced,
 * case-insensitive substring; elements with neither attribute stay
 * visible). Viewer-only — the editor canvas never filters. Deliberately
 * NO in-field clear button (basic family stays minimal); Escape clears.
 */
class FeezalElementBasicSearch extends FeezalSearchBase {
    static get feezal() {
        return {
            palette: {name: 'Search', category: 'Basic', color: '#4a6080', icon: 'search'},
            description: 'Search bar that live-filters this view: elements whose label or link URL does not ' +
                'match the (debounced, case-insensitive) query are hidden; elements without a label stay visible. ' +
                'Absolutely-positioned views hide in place, flow/grid views reflow. Escape clears. ' +
                'Filtering runs in the viewer only — the editor canvas always shows every element.',
            attributes: [
                ...FeezalSearchBase.searchAttributes,
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-search-color', type: 'color', default: 'var(--primary-text-color)', help: 'Input text colour.'},
                {property: '--feezal-search-bg', type: 'color', default: 'var(--primary-background-color)', help: 'Input background.'},
                {property: '--feezal-search-border-color', type: 'color', default: 'var(--divider-color)', help: 'Input border colour.'},
                {property: '--feezal-search-font-size', default: '14px', help: 'Input font size.'},
            ],
            defaultStyle: {width: '220px', height: '36px'},
            restrict: {minWidth: 100, minHeight: 28},
        };
    }

    static styles = [feezalBaseStyles, css`
        :host { display: block; }
        .search { width: 100%; height: 100%; display: flex; align-items: stretch; }
        input {
            flex: 1; min-width: 0; box-sizing: border-box; padding: 0 10px;
            font: inherit; font-size: var(--feezal-search-font-size, 14px);
            color: var(--feezal-search-color, var(--primary-text-color));
            background: var(--feezal-search-bg, var(--primary-background-color));
            border: 1px solid var(--feezal-search-border-color, var(--divider-color));
            border-radius: 4px; outline: none;
        }
        input:focus { border-color: var(--primary-color); }
        input::placeholder { color: var(--secondary-text-color); }
        /* the native search-cancel affordance is enough for basic */
    `];

    render() {
        return this.renderSearchInput({clearButton: false});
    }
}

customElements.define('feezal-element-basic-search', FeezalElementBasicSearch);
export {FeezalElementBasicSearch};
