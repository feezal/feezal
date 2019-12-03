import {PolymerElement, html} from '@polymer/polymer/polymer-element';
import {camelToDashCase} from '@polymer/polymer/lib/utils/case-map.js';
import {afterNextRender} from '@polymer/polymer/lib/utils/render-status.js';

import '@polymer/paper-input/paper-input';
import '@polymer/paper-toggle-button/paper-toggle-button';
import '@polymer/paper-checkbox/paper-checkbox';
import '@polymer/paper-input/paper-textarea';
import '@polymer/paper-icon-button/paper-icon-button';
import '@polymer/paper-tooltip/paper-tooltip';
import '@polymer/iron-icons/editor-icons';

import Sortable from 'sortablejs';

//import materialDesignIcons from './material-design-icons';

class FeezalEditableList extends PolymerElement {
    static get template() {
        return html`
            <style>
                ul {
                    list-style-type: none;
                    margin: 0;
                    display: block;
                    border-bottom: 1px solid var(--paper-input-container-color, var(--secondary-text-color));
                    padding: 0 6px 6px;
                }
                ul li {
                    display: flex;
                    height: 62px;
                }
                ul li paper-input {
                    margin: 6px;
                    flex-grow: 1;
                }
                ul li iron-icon {
                    padding-top: 28px;
                }
                ul li paper-icon-button {
                    margin-top: 20px;
                    flex-shrink: 0;
                }
                .drag-handle {
                    cursor: move;
                }
                #label, #add {
                    display: inline-block;
                }
                #label {
                    font-size: var(--paper-font-caption_-_font-size);
                    color: var(--secondary-text-color);
                }
            </style>
            <span id="label">[[label]]</span>
            <paper-icon-button id="add" raised on-click="_add" icon="add"></paper-icon-button>
            <ul id="list">
                <template id="rows" is="dom-repeat" items="[[value]]">
                    <li data-row="[[index]]">
                        <iron-icon class="drag-handle" icon="editor:drag-handle"></iron-icon>
                        <template is="dom-repeat" items="[[columns]]" as="col" index-as="colIndex">
                            <paper-input value="[[_getProp(item, col)]]" label="[[col]]" on-value-changed="_propChanged"></paper-input>
                        </template>
                        <paper-icon-button data-index$="[[index]]" icon="delete" class="remove" raised on-click="_remove"></paper-icon-button>            
                    </li>
                </template>
            </ul>
        `;
    }
    static get properties() {
        return {
            value: {
                type: Array,
                notify: true
            },
            columns: {
                type: Array
            },
            label: {
                type: String,
                value: 'items',
                reflectToAttribute: true
            }
        }
    }
    connectedCallback() {
        super.connectedCallback();
        this.sortable = Sortable.create(this.$.list, {
            handle: '.drag-handle',
            onEnd: () => {
                const elems = [...this.$.list.querySelectorAll('li')];
                let newValue = [];
                elems.map(el => el.dataRow).forEach(i => {
                     newValue.push(Object.assign({}, this.value[i]));
                });
                this.value = [];
                afterNextRender(this, () => {
                    this.set('value', newValue);
                });
            }
        });
    }
    _add() {
        this.value = this.value || [];
        this.push('value', Object.fromEntries(this.columns.map(key => [key, ''])))
    }
    _remove(e) {
        this.splice('value', e.target.dataset.index, 1);
    }
    _getProp(item, col) {
        console.log('_getProp', item, col);
        return item[col];
    }
    _propChanged(e) {
        console.log('set', 'value.' + e.model.parentModel.index + '.' + e.model.col, e.detail.value);
        if (typeof this.value[e.model.parentModel.index] !== 'object') {
            this.value[e.model.parentModel.index] = {};
        }
        this.value[e.model.parentModel.index][e.model.col] = e.detail.value;

        this.value = this.value.slice();
        console.log(this.value)
        //this.set('value.' + e.model.parentModel.index + '.' + e.model.col, e.detail.value);
    }
}

window.customElements.define('feezal-editable-list', FeezalEditableList);

class FeezalSidebarInspectorAttribute extends PolymerElement {
    static get properties() {
        return {
            half: {
                type: Boolean,
                reflectToAttribute: true
            },
            item: {
                type: Object,
                observer: '_itemChange'
            },

        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    overflow: visible;
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
            <div id="input">
                <template is="dom-if" if="[[item.elem.input]]">
                    <paper-input type="[[item.elem.inputType]]" class$="[[item.class]]" label="[[item.label]]" value="[[item.value]]" min="[[item.elem.min]]" max="[[item.elem.max]]" step="[[item.elem.step]]" on-value-changed="_change" on-blur="_blur"</paper-input>
                </template>
                
                <template is="dom-if" if="[[item.elem.list]]">
                    <feezal-editable-list value="[[item.value]]" columns="[[item.elem.columns]]" on-value-changed="_change" apply-immediately></feezal-editable-list>
                </template>
                
                <template is="dom-if" if="[[item.elem.dropdown]]">
                    <paper-dropdown-menu label="[[item.label]]" value="[[item.value]]" on-value-changed="_change" apply-immediately>
                        <paper-listbox slot="dropdown-content">
                             <template is="dom-repeat" items="[[item.elem.options]]">
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
                        <paper-checkbox class$="[[item.class]]" label="[[item.label]]" checked="[[_boolean(item.value)]]" on-checked-changed="_change" apply-immediately>[[item.label]]</paper-checkbox>
                    </div>
                </template>
            </div>
            <template is="dom-if" if="[[item.elem.tooltip]]">
                <paper-tooltip for="input" offset="0">[[item.label]]: [[item.elem.tooltip]]</paper-tooltip>
            </template>
        `;

    }

    connectedCallback() {
        super.connectedCallback();


    }

    _itemChange(item) {
        afterNextRender(this, function() {
            /*if (item.elem.list) {
                const grid = this.shadowRoot.querySelector('vaadin-grid');

                let draggedItem;
                grid.addEventListener('grid-dragstart', e => {
                    draggedItem = e.detail.draggedItems[0];
                    grid.dropMode = 'between';
                });
                grid.addEventListener('grid-dragend', e => {
                    draggedItem = grid.dropMode = null;
                });

                grid.addEventListener('grid-drop', e => {
                    const dropTargetItem = e.detail.dropTargetItem;
                    if (draggedItem && draggedItem !== dropTargetItem) {
                        // Reorder the items
                        const items = grid.items.filter(function (i) {
                            return i !== draggedItem;
                        });
                        const dropIndex = items.indexOf(dropTargetItem)
                            + (e.detail.dropLocation === 'below' ? 1 : 0);
                        items.splice(dropIndex, 0, draggedItem);
                        grid.items = items;
                    }
                });

                this.$.add.addEventListener('click', e => {
                    console.log('add');
                })
            }*/
        })
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
        console.log('_change', event)
        const attr = event.target.label;
        let invalid = false;
        let change = false;
        feezal.editor.selectedElems.forEach(elem => {
            const elemClass = window.customElements.get(elem.localName);
            const attrOptions = elemClass.feezal.attributes.find(a => a.name === attr);
            if (attrOptions && attrOptions.validator && !attrOptions.validator(event.detail.value)) {
                invalid = true;
                return;
            }
            let value;
            if (event.detail.path) {
                value = event.target.value;
            } else {
                value = event.detail.value;
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
            } else if (typeof value === 'object') {
                console.log('change object', attr, value)
                elem.setAttribute(attr, elem._serializeValue(value));
                change = true;

            } else if (elem.getAttribute(attr) !== value) {
                change = true;
                console.log('change', attr, value)
                elem.setAttribute(attr, value);
            }
        });
        event.target.hasChange = change;
        if (change && event.target.hasAttribute('apply-immediately')) {
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

        const type = properties[attribute] && properties[attribute].type;

        if (attr.tooltip) {
            elem.tooltip = attr.tooltip;
        }

        if (attr.dropdown) {
            elem.dropdown = true;
            if (Array.isArray(attr.dropdown)) {
                elem.options = attr.dropdown;
            } else {
                switch (attr.dropdown) {
                    case 'views':
                        elem.options = Array.from(feezal.site.querySelectorAll('feezal-view')).map(el => el.name);
                        break;

                }
            }
            console.log('dropdown options', elem.options)

        } else {
            switch (type) {
                case Array:
                    elem.list = true;
                    elem.columns = attr.elemProperties || ['item'];
                    break;
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
