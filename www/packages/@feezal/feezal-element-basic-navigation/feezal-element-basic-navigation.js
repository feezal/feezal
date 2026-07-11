/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class FeezalElementBasicNavigation extends FeezalElement {
    static get feezal() {
        return {
            palette: {category: 'Basic', name: 'Navigation', color: '#4a6080'},
            description: 'Renders a set of buttons for navigating between feezal views.',
            attributes: [
                {
                    name: 'views',
                    type: 'string',
                    help: 'Comma-separated list of view names to show buttons for. Leave empty to show all views.'
                },
                {
                    name: 'orientation',
                    type: 'select',
                    options: ['horizontal', 'vertical'],
                    default: 'horizontal',
                    help: 'Layout direction of the navigation buttons.'
                },
                {
                    name: 'active-color',
                    type: 'color',
                    help: 'Background colour of the currently-active view button. Defaults to --primary-color.'
                },
                {
                    name: 'hide-tabbar',
                    type: 'boolean',
                    default: false,
                    help: 'Hide the global view tab bar when this navigation element is present on a view.'
                }
            ],
            styles: ['top', 'left', 'width', 'height', 'background', 'border', 'border-radius', 'padding'],
            defaultStyle: {width: '200px', height: '40px'}
        };
    }

    static properties = {
        views:       {type: String,  reflect: true},
        orientation: {type: String,  reflect: true},
        activeColor: {type: String,  reflect: true, attribute: 'active-color'},
        hideTabbar:  {type: Boolean, reflect: true, attribute: 'hide-tabbar'},
        _activeView: {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host { display: flex; box-sizing: border-box; }
        :host([orientation="vertical"]) { flex-direction: column; }
        :host(:not([orientation="vertical"])) { flex-direction: row; flex-wrap: wrap; }
        button {
            flex: 1 0 auto; border: 1px solid var(--primary-color, #0284c7);
            background: transparent; color: var(--primary-text-color, inherit);
            cursor: pointer; padding: 6px 10px; font-size: 13px;
            transition: background 0.15s, color 0.15s; border-radius: 3px; margin: 2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        button:hover { background: rgba(0,0,0,0.08); }
        button.active {
            background: var(--nav-active-color, var(--primary-color, #0284c7));
            color: #fff; border-color: var(--nav-active-color, var(--primary-color, #0284c7));
        }
        .editor-placeholder {
            flex: 1; border: 2px dashed #4a6080; background: #e8edf2; border-radius: 4px;
            display: flex; align-items: center; justify-content: center; gap: 4px;
            font-size: 11px; color: #4a6080; user-select: none; box-sizing: border-box;
        }
        .editor-placeholder .icon { font-family: 'Material Icons'; font-size: 16px; font-style: normal; }
    `];

    constructor() {
        super();
        this.views       = '';
        this.orientation = 'horizontal';
        this.activeColor = '';
        this.hideTabbar  = false;
        this._activeView = '';
    }

    // B23: the active view must follow the current view from ANY source
    // (nav element / navbar / swipe / URL hash / deep link / MQTT), not only
    // this element's own clicks. Same mechanism as material-navbar (E46): a
    // MutationObserver on feezal-site's reflected `view` attribute — the old
    // custom `view-changed` event only ever fired for this element's own
    // navigation, so the highlight was wrong on first load and never followed
    // external view switches.
    connectedCallback() {
        super.connectedCallback();
        this._readActive();
        this._navObserver = new MutationObserver(() => this._readActive());
        if (feezal.site) {
            this._navObserver.observe(feezal.site, {attributes: true, attributeFilter: ['view']});
            this._navObserverAttached = true;
        }
    }

    disconnectedCallback() {
        this._navObserver?.disconnect();
        this._navObserverAttached = false;
        super.disconnectedCallback();
    }

    firstUpdated() {
        // First-load timing: feezal.site may only become available (or gain
        // its initial `view`) after this element connected — attach the
        // observer late if needed and re-read the active view.
        if (feezal.site && this._navObserver && !this._navObserverAttached) {
            this._navObserver.observe(feezal.site, {attributes: true, attributeFilter: ['view']});
            this._navObserverAttached = true;
        }

        this._readActive();
    }

    _readActive() {
        this._activeView = (feezal.site && (feezal.site.getAttribute('view') || feezal.site.view)) || '';
    }

    _viewList() {
        if (this.views && this.views.trim()) {
            return this.views.split(',').map(v => v.trim()).filter(Boolean);
        }
        // Fall back to all views registered on the site
        if (feezal.site) {
            return Array.from(feezal.site.querySelectorAll('feezal-view'))
                .map(v => v.getAttribute('name'))
                .filter(Boolean);
        }
        return [];
    }

    _navigate(viewName) {
        if (feezal.site) {
            // B23: set the reflected property (like material-navbar) — drives
            // updateVisibility + hash sync, and the attribute reflection is
            // what all navigation elements' observers listen to.
            feezal.site.view = viewName;
        }
    }

    render() {
        const activeStyle = this.activeColor ? `--nav-active-color: ${this.activeColor};` : '';
        return html`
            <style>:host { ${activeStyle} }</style>
            ${this._viewList().map(v => html`
                <button class="${this._activeView === v ? 'active' : ''}" @click="${() => this._navigate(v)}">${v}</button>
            `)}`;
    }
}

customElements.define('feezal-element-basic-navigation', FeezalElementBasicNavigation);
export {FeezalElementBasicNavigation};
