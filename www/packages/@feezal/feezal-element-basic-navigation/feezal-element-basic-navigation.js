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

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor) {
            this._activeView = feezal.site?.getAttribute('view') || '';
            this._onViewChange = () => {
                this._activeView = feezal.site?.getAttribute('view') || '';
            };
            feezal.site?.addEventListener('view-changed', this._onViewChange);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._onViewChange) {
            feezal.site?.removeEventListener('view-changed', this._onViewChange);
        }
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
            feezal.site.setAttribute('view', viewName);
            feezal.site.dispatchEvent(new CustomEvent('view-changed', {detail: {view: viewName}}));
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-placeholder"><span class="icon">swap_horiz</span> Navigation</div>`;
        }

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
