// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';

import './feezal-site.js';
import './feezal-view.js';
import {viewFromHash, viewPathFromHash} from './hash-view.js';
import {FeezalVisibility} from './feezal-visibility.js';

class FeezalAppViewer extends LitElement {
    static styles = css`
        :host { display: block; width: 100%; height: 100%; }
        #container { width: 100%; display: flex; flex-flow: row; position: absolute; height: 100%; }
        #container-view { display: block; position: relative; width: 100%; height: 100%; padding: 0; }
    `;

    connectedCallback() {
        super.connectedCallback();

        this._onHashChange = () => {
            // B41: route the FULL hash path, not just the top-level view. A
            // hash-only URL change never reloads the page — it fires only this
            // handler — so a deep link #/<view>/<embedded> typed into an open
            // viewer (or reached via back/forward) must land on the layout-app
            // sub-view here. Delegate to the site's view command, which owns
            // the nested-path contract (N30): `view/embedded` routes into the
            // shell, and a bare sub-view name is offered to the visible shell
            // before switching top-level.
            const {view, embedded} = viewPathFromHash();
            if (feezal.site && view) {
                feezal.site.applyControlCommand('view', embedded ? `${view}/${embedded}` : view);
            }
        };

        window.addEventListener('hashchange', this._onHashChange);

        // Navigate to first view if no hash
        this.updateComplete.then(() => {
            const firstView = feezal.views[0];
            if (firstView && !viewFromHash()) {
                location.hash = '/' + firstView.getAttribute('name');
            } else {
                this._onHashChange();
            }
            // N37: pause hidden views' subscriptions (viewer only — the
            // editor keeps everything live). Site/view attributes decide.
            if (feezal.site && !feezal.visibility) {
                feezal.visibility = new FeezalVisibility(feezal.site);
            }
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this._onHashChange);
        feezal.visibility?.dispose?.();
        feezal.visibility = null;
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
