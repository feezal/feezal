// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';

/**
 * feezal-view
 *
 * A single page/view within a feezal-site. Contains dashboard elements.
 * Replaces the Polymer implementation.
 */
class FeezalView extends LitElement {
    static properties = {
        name: {type: String, reflect: true},
        visible: {type: Boolean},
        childPosition: {type: String, attribute: 'child-position', reflect: true}
    };

    static styles = css`
        :host([child-position="absolute"]) ::slotted(*) {
            position: absolute;
        }
        ::slotted(.feezal-placeholder) {
            display: block;
            background-color: rgba(var(--feezal-selection-rgb, 2,132,199), 0.1);
            border: 1px dashed rgba(var(--feezal-selection-rgb, 2,132,199), 0.4);
        }
        ::slotted(.feezal-editable) {
            cursor: move;
        }
        ::slotted(.feezal-editable[locked]) {
            cursor: default;
        }
        ::slotted(.feezal-selected) {
            outline: 2px solid rgba(var(--feezal-selection-rgb, 2,132,199), 0.9) !important;
            outline-offset: 1px;
        }
    `;

    static get feezal() {
        return {
            attributes: [
                {
                    name: 'childPosition',
                    dropdown: ['absolute', 'static']
                }
            ],
            // N34: `background` is a style GROUP — the editor renders the rich
            // Background editor (None/Solid/Image/Gradient) in place of a raw
            // value row; the widget owns the whole background-* longhand family
            // (covers declared on the editor class). Editor-only: the viewer
            // never resolves the editor tag.
            styles: ['width', 'height',
                {group: 'background', editor: 'feezal-style-editor-background', label: 'Background'}]
        };
    }

    constructor() {
        super();
        this.childPosition = 'absolute';
    }

    render() {
        return html`<slot></slot>`;
    }

    updated(changed) {
        if (changed.has('visible')) {
            this._visibleChange(this.visible);
        }
    }

    _visibleChange(visible) {
        // Hide/show the view itself so inactive views don't stack on screen.
        this.style.display = visible ? '' : 'none';

        this.querySelectorAll('*').forEach(element => {
            if (element.tagName.startsWith('FEEZAL-ELEMENT-')) {
                element.visible = visible;
            }
        });
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe + '/addclass', message => {
                this.classList.add(message.payload);
            });
            feezal.connection.sub(this.subscribe + '/removeclass', message => {
                this.classList.remove(message.payload);
            });
        }
    }
}

window.customElements.define('feezal-view', FeezalView);

export {FeezalView};
