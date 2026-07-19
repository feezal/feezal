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
        childPosition: {type: String, attribute: 'child-position', reflect: true},
        // U41 — flow layout knobs (only meaningful when child-position="flow").
        flowGap:       {type: String, attribute: 'flow-gap', reflect: true},
        flowDirection: {type: String, attribute: 'flow-direction', reflect: true},
        flowJustify:   {type: String, attribute: 'flow-justify', reflect: true},
        flowAlign:     {type: String, attribute: 'flow-align', reflect: true}
    };

    static styles = css`
        :host([child-position="absolute"]) ::slotted(*) {
            position: absolute;
        }
        /* U41 — flow layout: the slot is a wrapping flex container, so the
           view's elements float left-to-right, row by row (tiles), and keep
           their own width/height (percentages work — they are flex items).
           Lives in feezal-view so the viewer and static export render
           identically to the editor. */
        :host([child-position="flow"]) slot {
            display: flex;
            flex-wrap: wrap;
            flex-direction: var(--feezal-flow-direction, row);
            gap: var(--feezal-flow-gap, 8px);
            justify-content: var(--feezal-flow-justify, flex-start);
            align-items: var(--feezal-flow-align, flex-start);
            align-content: var(--feezal-flow-align, flex-start);
            width: 100%;
            min-height: 100%;
            box-sizing: border-box;
        }
        /* Flow items stay in flex flow but must be POSITIONED (relative) — the
           editor injects a click-catching :host(.feezal-editable)::after overlay
           with position:absolute;inset:0, which only stays contained to the tile
           when the tile itself is a positioned ancestor. A static tile lets that
           overlay escape and cover the whole canvas (cursor:move everywhere,
           dead view tabs, off-by-coordinates selection). No !important — the
           drag lift sets position:fixed inline, and the editor strips legacy
           top/left from flow tiles so relative doesn't offset them. */
        :host([child-position="flow"]) ::slotted(*) { position: relative; }
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
                    dropdown: ['absolute', 'flow']
                },
                // U41 — flow knobs; U39 conditional visibility hides them unless
                // the view is in flow mode.
                {name: 'flow-gap', type: 'number', default: 8, section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Gap between elements (px).'},
                {name: 'flow-direction', type: 'select', options: ['row', 'column'], default: 'row', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Main axis: row = left→right then wrap; column = top→bottom then wrap.'},
                {name: 'flow-justify', type: 'select', options: ['start', 'center', 'end', 'space-between'], default: 'start', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Alignment along the main axis.'},
                {name: 'flow-align', type: 'select', options: ['start', 'center', 'end', 'stretch'], default: 'start', section: 'Flow layout',
                    visibleWhen: {attr: 'child-position', equals: 'flow'}, help: 'Alignment along the cross axis.'}
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
        // U41 — the legacy `static` value is aliased to `flow` at load (no file
        // migration; the next save writes `flow`).
        if (changed.has('childPosition') && this.childPosition === 'static') {
            this.childPosition = 'flow';
        }
        if (changed.has('flowGap') || changed.has('flowDirection') ||
            changed.has('flowJustify') || changed.has('flowAlign')) {
            this._syncFlowVars();
        }
    }

    /** U41 — map the flow-* attributes onto the CSS custom properties the slot reads. */
    _syncFlowVars() {
        const set = (prop, val) => val ? this.style.setProperty(prop, val) : this.style.removeProperty(prop);
        set('--feezal-flow-gap', (this.flowGap ?? '') !== '' ? `${this.flowGap}px` : '');
        set('--feezal-flow-direction', this.flowDirection || '');
        set('--feezal-flow-justify', this.flowJustify || '');
        set('--feezal-flow-align', this.flowAlign || '');
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
