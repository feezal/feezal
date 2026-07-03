// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';

import './feezal-site.js';
import './feezal-view.js';

class FeezalAppViewer extends LitElement {
    static styles = css`
        :host { display: block; width: 100%; height: 100%; }
        #container { width: 100%; display: flex; flex-flow: row; position: absolute; height: 100%; }
        #container-view { display: block; position: relative; width: 100%; height: 100%; padding: 0; }
    `;

    connectedCallback() {
        super.connectedCallback();

        this._onHashChange = () => {
            const view = location.hash.replace(/^#\/?/, '');
            if (feezal.site) {
                feezal.site.view = view;
            }
        };

        window.addEventListener('hashchange', this._onHashChange);

        // Navigate to first view if no hash
        this.updateComplete.then(() => {
            const firstView = feezal.views[0];
            if (firstView && !location.hash.replace('#', '').replace('/', '')) {
                location.hash = '/' + firstView.getAttribute('name');
            } else {
                this._onHashChange();
            }
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this._onHashChange);
    }

    render() {
        return html`
            <div id="container">
                <div id="container-view">
                    <slot></slot>
                </div>
            </div>
        `;
    }
}

window.customElements.define('feezal-app-viewer', FeezalAppViewer);
