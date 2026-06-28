/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

class FeezalElementBasicView extends FeezalElement {
    static styles = [FeezalElement.styles, css`
        :host {
            overflow: hidden;
        }
        #content {
            width: 100%;
            height: 100%;
        }
        /* Checkerboard shown in the editor to indicate an embedded view area */
        #content.editor {
            opacity: 0.25;
            background-image:
                linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%),
                linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            display: flex;
        }
    `];

    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'View',
                color: '#4a7080'
            },
            attributes: [
                {name: 'view', dropdown: 'views', label: 'View'},
                'subscribe',
                'messageProperty'
            ],
            baseAttribute: 'view',
            styles: [
                'top', 'left', 'width', 'height',
                'font', 'color', 'text-align', 'background', 'border', 'overflow'
            ],
            restrict: {minWidth: 12, minHeight: 12},
            defaultStyle: {
                width: '60px',
                height: '20px'
            }
        };
    }

    static properties = {
        view: {type: String, reflect: true},
    };

    constructor() {
        super();
        this.view = '';
    }

    render() {
        return html`<div id="content"></div>`;
    }

    firstUpdated() {
        if (feezal.isEditor) {
            this.renderRoot.querySelector('#content').classList.add('editor');
        }
        this._initialized = true;
        this._viewChanged();
    }

    updated(changed) {
        super.updated(changed);
        // firstUpdated hasn't run yet on the initial cycle; skip to avoid double call.
        if (this._initialized && changed.has('view')) {
            this._viewChanged();
        }
    }

    _viewChanged() {
        const content = this.renderRoot.querySelector('#content');
        if (!content || !this.view) {
            return;
        }
        if (feezal.isEditor) {
            content.innerHTML = `<span style="margin: auto; font-weight: bold;">View: ${this.view}</span>`;
        } else {
            const view = feezal.site.querySelector(`feezal-view[name="${this.view}"]`);
            if (view) {
                // view.outerHTML captures the live DOM — including any inline
                // style="display: none" that feezal-site.updateVisibility() put
                // there because this view is inactive in the navigation.
                // Clone the node directly and strip that style so the embedded
                // content is always visible inside this element.
                const clone = view.cloneNode(true);
                clone.style.display = '';
                content.replaceChildren(clone);
            }
        }
    }
}

window.customElements.define('feezal-element-basic-view', FeezalElementBasicView);

export {FeezalElementBasicView};