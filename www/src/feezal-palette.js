import interact from 'interactjs';
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';

class FeezalPalette extends LitElement {
    static properties = {
        categories: {type: Array},
        filter: {type: String}
    };

    static styles = css`
        :host {
            display: inline-flex;
            flex-direction: column;
            height: 100%;
            background-color: var(--feezal-bg, white);
            flex: 0 0 175px;
            box-sizing: border-box;
            border-right: 2px solid var(--feezal-border, #e4e4e7);
        }
        #palette-menu {
            background: var(--feezal-bg-sub, #f5f5f5);
            border-bottom: 2px solid var(--feezal-border, #d4d4d8);
            height: 40.5px;
            padding: 0 6px;
            display: flex;
            align-items: center;
            box-sizing: border-box;
        }
        #palette-menu sl-input { flex: 1; min-width: 0; overflow: hidden; width: 161px;}
        #palette-list {
            overflow-y: auto;
            flex: 1;
        }
        .category { width: 100%; display: block; box-sizing: border-box; }
        .header {
            font-size: 15px;
            font-weight: 500;
            padding: 12px 4px 4px;
            height: 36px;
            box-sizing: border-box;
            color: var(--feezal-color, inherit);
        }
        .element {
            box-sizing: border-box;
            padding: 4px;
            height: 30px;
            width: calc(100% - 8px);
            margin: 4px;
            border: 1px solid var(--sl-color-primary-300);
            background-color: var(--feezal-bg-sub, #f5f5f5);
            border-radius: 4px;
            font-size: 13px;
            cursor: grab;
            user-select: none;
        }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); }
        sl-input::part(base):focus-within { border-color: var(--feezal-border, #ccc); box-shadow: none; }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
    `;

    constructor() {
        super();
        this.categories = [];
        this.filter = '';
    }

    render() {
        return html`
            <div id="palette-menu">
                <sl-input size="small" placeholder="filter" clearable
                    autocomplete="off"
                    .value="${this.filter}"
                    @sl-input="${e => { this.filter = e.target.value; this._rebuildCategories(); }}"
                    @sl-clear="${() => { this.filter = ''; this._rebuildCategories(); }}">
                </sl-input>
            </div>
            <div id="palette-list">
                ${this.categories.map(cat => html`
                    <div class="category">
                        <div class="header">${cat.name}</div>
                        ${cat.elements.map(el => html`
                            <div class="element"
                                style="${el.color ? `background-color:${el.color}` : ''}"
                                data-el="${el.el}">${el.name}</div>
                        `)}
                    </div>
                `)}
            </div>
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        // WebComponentsReady was a polyfill event — modern browsers never fire it.
        // Run after first render instead.
        this.updateComplete.then(() => {
            this._rebuildCategories();
            this._initInteract();
        });
    }

    _rebuildCategories() {
        const categories = {};
        // feezal.elements contains package names like '@feezal/feezal-element-paper-button'.
        // The actual custom element tag is the package name without the @scope/ prefix.
        (feezal.elements || []).forEach(pkgName => {
            const tagName = pkgName.replace(/^@[^/]+\//, '');
            const cls = window.customElements.get(tagName);
            if (!cls) {
                return;
            }

            const config = (cls.paletteOptions || cls.feezal || {}).palette || {name: tagName, category: 'Other'};
            if (!this.filter || config.name.toLowerCase().includes(this.filter.toLowerCase())) {
                if (!categories[config.category]) {
                    categories[config.category] = [];
                }

                categories[config.category].push({el: tagName, ...config});
            }
        });
        this.categories = Object.entries(categories)
            .map(([name, elements]) => ({name, elements}))
            .sort((a, b) => {
                const ORDER = ['Basic', 'Device', 'System', 'Material', 'Paper'];
                const ai = ORDER.indexOf(a.name);
                const bi = ORDER.indexOf(b.name);
                if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            });
    }

    _initInteract() {
        interact('.element', {context: this.renderRoot})
            .draggable({
                restrict: {
                    restriction: feezal.container,
                    elementRect: {top: 0, left: 0, bottom: 1, right: 1},
                    endOnly: true
                },
                onstart: event => {
                    const viewRect = feezal.view.getBoundingClientRect();
                    this.newElem = document.createElement(event.target.dataset.el);
                    feezal.view.append(this.newElem);
                    const newElementRect = this.newElem.getBoundingClientRect();
                    feezal.editor.initElem(this.newElem, true);
                    this.newElem.style.outlineWidth = '2px';
                    this.newElem.style.top = (event.clientY - viewRect.y - (newElementRect.height / 2)) + 'px';
                    this.newElem.style.left = (event.clientX - viewRect.x - (newElementRect.width / 2)) + 'px';
                },
                onmove: event => {
                    if (event.dx) {
                        const x = (Number.parseFloat(this.newElem.style.left) || 0) + event.dx;
                        this.newElem.style.left = x + 'px';
                    }

                    if (event.dy) {
                        const y = (Number.parseFloat(this.newElem.style.top) || 0) + event.dy;
                        this.newElem.style.top = y + 'px';
                    }
                },
                onend: () => {
                    if (!this.newElem) {
                        return;
                    }

                    let x = Number.parseFloat(this.newElem.style.left);
                    const y = Number.parseFloat(this.newElem.style.top);

                    if (x + this.newElem.getBoundingClientRect().width < 0) {
                        this.newElem.remove();
                        delete this.newElem;
                        return;
                    }

                    if (x < 0) {
                        x = 0;
                    }

                    this.newElem.style.left = x + 'px';
                    this.newElem.style.top = y + 'px';
                    feezal.editor.selectElement(this.newElem);
                    this.newElem.style.outlineWidth = null;
                    feezal.app.change();
                }
            });
    }
}

window.customElements.define('feezal-palette', FeezalPalette);
