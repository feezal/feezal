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
            styles: ['width', 'height', 'background']
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
