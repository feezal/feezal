import {PolymerElement, html} from '@polymer/polymer/polymer-element';
import {camelToDashCase} from '@polymer/polymer/lib/utils/case-map.js';

import '@polymer/paper-input/paper-input';
import '@polymer/paper-toggle-button/paper-toggle-button';
import '@polymer/paper-input/paper-textarea';

import materialDesignIcons from './material-design-icons';

class FeezalSidebarInspectorAttribute extends PolymerElement {
    static get properties() {
        return {
            half: {
                type: Boolean,
                reflectToAttribute: true
            },
            item: Object
        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    overflow: hidden;
                    display: inline-block;
                    width: 100%;
                }
                :host([half]) {
                    width: calc(50% - 2px);
                }
                .paper-input-container {
                    padding: 0 !important;
                    max-width: 100%;
                }
                .toggle-button-container {
                    padding-top: 18px;
                    padding-bottom: 12px;
                }
                paper-toggle-button {
                    font-size: 16px;
                    --paper-toggle-button-label-color: var(--paper-input-container-color, var(--secondary-text-color));
                }   
                paper-textarea {
                    --paper-input-container-input: {
                        font-family: Consolas, Monaco, "Andale Mono", monospace;
                        font-size: 12px;
                        overflow: scroll;
                        max-width: 100%;
                    };
                 } 
                 paper-dropdown-menu {
                    width: 100%;
                 }
            </style>
            
            <template is="dom-if" if="[[item.elem.input]]">
                <paper-input type="[[item.elem.inputType]]" class$="[[item.class]]" label="[[item.label]]" value="[[item.value]]" min="[[item.elem.min]]" max="[[item.elem.max]]" step="[[item.elem.step]]" on-value-changed="_change" on-blur="_blur"</paper-input>
            </template>
            
            <template is="dom-if" if="[[item.elem.dropdown]]">
                <paper-dropdown-menu label="[[item.label]]" value="[[item.value]]" on-value-changed="_change" apply-immediatly>
                    <paper-listbox slot="dropdown-content">
                         <template is="dom-repeat" items="[[item.elem.data]]">
                            <paper-item>[[item]]</paper-item>
                         </template>
                    </paper-listbox>
                </paper-dropdown-menu>
                   
            </template>
            
             <template is="dom-if" if="[[item.elem.textarea]]">
                <paper-textarea rows="8" label="[[item.label]]" value="[[item.value]]" on-value-changed="_change" on-blur="_blur"></paper-textarea>
            </template>
            
            <template is="dom-if" if="[[item.elem.checkbox]]">
                <div class="toggle-button-container">
                    <paper-toggle-button class$="[[item.class]]" label="[[item.label]]" checked="[[_boolean(item.value)]]" on-checked-changed="_change" apply-immediatly>[[item.label]]</paper-toggle-button>
                </div>
            </template>
        `;
    }

    connectedCallback() {
        super.connectedCallback();
    }

    _boolean(val) {
        return Boolean(val);
    }

    _blur(event) {
        if (event.target.hasChange) {
            feezal.app.change();
        }
    }

    _change(event) {
        const attr = event.target.label;
        let invalid = false;
        let change = false;
        feezal.editor.selectedElems.forEach(elem => {
            const elemClass = window.customElements.get(elem.localName);
            const attrOptions = elemClass.feezal.attributes.find(a => a.name === attr);
            if (attrOptions && attrOptions.validator) {
                if (!attrOptions.validator(event.detail.value)) {
                    invalid = true;
                    return;
                }
            }
            if (typeof event.detail.value === 'boolean') {
                if (elem.hasAttribute(attr) !== event.detail.value) {
                    change = true;
                    if (event.detail.value) {
                        elem.setAttribute(attr, event.detail.value);
                    } else {
                        elem.removeAttribute(attr);
                    }
                }
            } else if (elem.getAttribute(attr) !== event.detail.value) {
                change = true;
                elem.setAttribute(attr, event.detail.value);
            }
        });
        event.target.hasChange = change;
        if (change && event.target.hasAttribute('apply-immediatly')) {
            feezal.app.change();
        }

        event.target.invalid = invalid;
    }
}

window.customElements.define('feezal-sidebar-inspector-attribute', FeezalSidebarInspectorAttribute);

class FeezalSidebarInspectorAttributes extends PolymerElement {
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
                    display: inline-block;
                }
            </style>
            
            <template is="dom-repeat" items="[[items]]">
                <feezal-sidebar-inspector-attribute half="[[item.elem.half]]" item="[[item]]"></feezal-sidebar-inspector-attribute>
            </template>
            
        `;
    }

    _attributes(attr) {
        const {properties} = window.customElements.get(this.element.name ? 'feezal-view' : this.element.localName);

        const elemClass = window.customElements.get(this.element.name ? 'feezal-view' : this.element.localName);
        const options = elemClass.feezal;

        let attribute;
        const elem = {};

        if (typeof attr === 'object') {
            attribute = attr.name;
            if (attr.size === 'half') {
                elem.half = true;
            }
        } else {
            attribute = attr;
        }

        // Console.log('_attributes', attribute)

        const type = properties[attribute] && properties[attribute].type;

        if (attribute.dropdown) {
            elem.dropdown = true;
            elem.data = attribute.dropdown;
        } else {
            switch (type) {
                case Boolean:
                    elem.checkbox = true;
                    break;
                case Number:
                    elem.input = true;
                    elem.inputType = 'number';
                    break;
                default:
                    elem.input = true;
            }
        }

        /*

        If (attributes[attribute] && typeof attributes[attribute].dropdown !== 'undefined') {
            elem = {dropdown: true};

            switch (attributes[attribute].dropdown) {
                case 'material-design-icons':
                    elem.data = materialDesignIcons;
                    break;
                default:
            }

        }

        */

        const item = {
            label: camelToDashCase(attribute),
            value: this.element[attribute],
            elem
        };
        // Console.log(item)
        return item;
    }

    _selectedElemsChanged() {
        // Console.log('... ?')
        if (this.selectedElems.length === 0) {
            this.set('items', []);
        } else {
            this.element = this.selectedElems[0];
            // Todo restrict to poperties available in all selected elems
            const elemClass = window.customElements.get(this.element.name ? 'feezal-view' : this.element.localName);
            // Console.log('attribute editor', this.element.localName, elemClass.properties)
            const {properties} = elemClass;
            const editorOptions = elemClass.feezal || {};
            const attributeOptions = editorOptions.attributes || [];
            const attributes = [
                ...Object.keys(properties).filter(property => ['subscribeTopic', 'publishTopic', 'label'].includes(property)),
                ...attributeOptions
            ];
            const items = attributes.map(attribute => {
                return this._attributes(attribute);
            });
            this.set('items', items);
            // Console.log('... !')
        }
    }

    connectedCallback() {
        super.connectedCallback();
    }
}

window.customElements.define('feezal-sidebar-inspector-attributes', FeezalSidebarInspectorAttributes);
