import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/paper-input/paper-input';
import '@polymer/paper-swatch-picker';



class FeezalSidebarInspectorStyles extends PolymerElement {
    static get properties() {
        return {
            selectedElems: {
                type: Array,
                value: [],
                observer: '_selectedElemsChanged'
            },
            items: {
                type: Array,
                value: []
            }
        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    display: block;
                    margin: 12px;
                }
                paper-input.small {
                    width: calc(50% - 2px);
                }
                paper-input {
                    display: inline-block;
                    width: calc(100% - 60px);
                }
                paper-swatch-picker {
                    display: inline-block;
                    border: 1px solid #444;
                }
            </style>
            
            <template is="dom-repeat" items="[[items]]">
                <div>
                    <paper-input invalid="[[item.invalid]]" class$="[[item.class]]" css-property="[[item.property]]" label="[[item.property]]" value="[[item.value]]" on-value-changed="_change" on-blur="_blur"></paper-input>
                    <template is="dom-if" if="[[item.color]]">
                        <paper-swatch-picker horizontal-align="right" css-property="[[item.property]]" label="[[item.property]]" color="[[item.value]]" on-color-picker-selected="_colorSelected"></paper-swatch-picker>
                    </template>
                </div>
            </template>
            
        `;
    }

    _colorSelected(event) {
        console.log(event.target.cssProperty, event.target.color);
    }

    _blur(event) {
        if (this.selectedElems.length > 0) {
            const attr = event.target.label;
            const elem = this.selectedElems[0];
            if (!event.target.invalid && elem.style[attr] !== event.detail.value) {
                event.target.value = elem.style[attr];
            }
        }
    }

    _change(event) {
        if (event.target.focused) {
            const attr = event.target.cssProperty;
            let invalid = false;
            this.selectedElems.forEach(elem => {
                const prev = elem.style.getPropertyValue(attr);
                if (prev !== event.detail.value) {
                    elem.style.setProperty(attr, event.detail.value);
                    invalid = invalid || prev === elem.style.getPropertyValue(attr); // (prev.replace(/\s*,\s*/g, ',') === elem.style[attr].replace(/\s*,\s*/g, ','));
                }
            });
            if (!invalid) {
                feezal.app.change();
            }

            event.target.invalid = invalid;
        }
    }

    setStyle(target, changes) {
        if (target.classList.contains('feezal-selected')) {
            changes.forEach(property => {
                const allEqual = this.selectedElems.map(el => el.style.getPropertyValue(property)).every(val => val === target.style.getPropertyValue(property));
                this.set('items.' + this.options.styles.indexOf(property) + '.value', allEqual ? target.style.getPropertyValue(property) : '');
            });
        }
    }

    _property(property) {
        const item = {};
        if (typeof property === 'string') {
            property = {
                property,
                label: property
            };
        }

        item.value = this.selectedElems[0].style.getPropertyValue(property.property);
        this.selectedElems.forEach(el => {
            if (item.value !== el.style.getPropertyValue(property.property)) {
                delete item.value;
            }
        });

        Object.assign(item, property);

        switch (property) {
            case 'top':
            case 'left':
            case 'width':
            case 'height':
                item.class = 'small';
                break;
            default:
        }

        // Console.log(item, property);
        return item;
    }

    _selectedElemsChanged() {
        if (this.selectedElems.length === 0) {
            this.set('values', {});
            this.set('items', []);
        } else {
            this.element = this.selectedElems[0];
            this.options = window.customElements.get(this.element.name ? 'feezal-view' : this.element.localName).feezal;
            // Todo restrict to properties available in all selected elems

            this.set('items', this.options.styles.map(prop => this._property(prop)));
        }
    }

    connectedCallback() {
        super.connectedCallback();
    }
}

window.customElements.define('feezal-sidebar-inspector-styles', FeezalSidebarInspectorStyles);
