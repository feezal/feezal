import {PolymerElement, html} from '@polymer/polymer/polymer-element';

class FeezalView extends PolymerElement {
    static get properties() {
        return {
            name: {
                type: String,
                reflectToAttribute: true
            },
            visible: {
                type: Boolean,
                observer: '_visibleChange'
            },
            childPosition: {
                type: String,
                value: 'absolute',
                reflectToAttribute: true
            }
        };
    }

    static get template() {
        return html`
            <style>
                :host([child-position="absolute"]) ::slotted(*) {
                    position: absolute;
                }
               
            </style>
            <slot></slot>
        `;
    }

    static get feezal() {
        return {
            attributes: [
                {
                    name: 'childPosition',
                    dropdown: ['absolute', 'relative']
                }
            ],
            styles: [
                'width',
                'height',
                'background'
            ]
        };
    }

    _visibleChange(visible) {
        const elems = this.querySelectorAll('*');
        elems.forEach(element => {
            if (element.tagName.startsWith('FEEZAL-ELEMENT-')) {
                element.visible = visible;
            }
        });
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribeTopic) {
            feezal.connection.subscribe(this.subscribeTopic + '/addclass', message => {
                this.classList.add(message.payload);
            });
            feezal.connection.subscribe(this.subscribeTopic + '/removeclass', message => {
                this.classList.remove(message.payload);
            });
        }
    }
}

window.customElements.define('feezal-view', FeezalView);

export {FeezalView};
