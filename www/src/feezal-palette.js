import 'interactjs';

import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/paper-input/paper-input';

class FeezalPalette extends PolymerElement {
    static get properties() {
        return {
            categories: {
                type: Array,
                notify: true
            },
            filter: String
        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    display: inline-flex;
                    flex-direction: column;
                    height: 100%;
                    background-color: white;
                    flex: 0 0 150px;
                    box-sizing: border-box;
                    border-right: 2px solid #444;
                }
                .category {
               
                    width: 100%;
                    display: block;
                    box-sizing: border-box;
                }
                .header, .element {
                    
                    box-sizing: border-box;
                    
                    padding: 4px;
                    height: 30px;
                    
                   
                }
                .element {
                    width: calc(100% - 8px);
                    margin: 4px;
                    border: 2px solid rgba(250, 120, 0, 0.8);
                    background-color: #eee;
                    border-radius: 4px;
                }
                .header {
                    font-size: 14px;
                    font-weight: 500;
                    height: 36px;
                    padding-top: 12px;
                }
                #palette-menu {
                    background-color: #eee;
                    width: 100%;
                    height: 48px;
                    
               
    
                    --paper-input-container: {
                        padding: 2px 0px;
                    };
                    --paper-input-container-label: {
                        padding-left: 4px;
                    };
                    --paper-input-container-input: {
                        padding-left: 4px;
                    };
                    
                    --paper-input-container-underline: {
                        border-width: 0;
                    }
                   
                }
                
            </style>
            
                <div id="palette-menu">
                    <paper-input label="filter" on-value-changed="_filterChanged"></paper-input>
                </div>
                <template is="dom-repeat" items="[[categories]]">
                    <div class="category">
                        <div class="header">[[item.name]]</div>
                        <template is="dom-repeat" items="{{item.elements}}" as="element">
                            <div class="element" style$="background-color:[[element.color]]" data-el="{{element.el}}">{{element.name}}</div>
                        </template>
                    </div>
                </template>
            
        `;
    }

    _elementFilter(item) {
        return this.filter ? (item.name.toLowerCase().includes(this.filter.toLowerCase())) : true;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('WebComponentsReady', () => {
            // Console.log('WebComponentsReady')
            this._filterChanged();

            interact('.element')
                .draggable({
                    restrict: {
                        restriction: feezal.container,
                        elementRect: {top: 0, left: 0, bottom: 1, right: 1},
                        endOnly: true
                    },
                    onmove: event => {
                        const changes = [];
                        if (event.dx) {
                            const x = (Number.parseFloat(this.newElem.style.left.replace('px', '')) || 0) + event.dx;
                            this.newElem.style.left = x + 'px';
                            changes.push('left');
                        }

                        if (event.dy) {
                            const y = (Number.parseFloat(this.newElem.style.top.replace('px', '')) || 0) + event.dy;
                            this.newElem.style.top = y + 'px';
                            changes.push('top');
                        }

                        //       This.shadowRoot.querySelector('feezal-editor-styles').setStyle(target, changes);
                    },
                    onend: event => {
                        //feezal.view.append(this.newElem);
                        const viewRect = feezal.view.getBoundingClientRect();
                        const containerRect = feezal.container.getBoundingClientRect();

                        let x = Number.parseFloat(this.newElem.style.left.replace('px', ''));
                        const y = Number.parseFloat(this.newElem.style.top.replace('px', ''));
                        if (event.restrict) {
                            if (event.restrict.dx > 0) {
                                x -= event.restrict.dx;
                            } else {
                                // X = x + event.restrict.dx;
                            }
                        }

                        if (x + this.newElem.getBoundingClientRect().width < 0) {
                            this.newElem.remove();
                            delete this.newElem;
                            return;
                        }

                        if (x < 0) {
                            x = 0;
                        }

                        this.newElem.style.left = x + 'px';
                        this.newElem.style.top = y + 'px';
                        feezal.editor.selectElement(this.newElem);
                        this.newElem.style.outlineWidth = null;
                        feezal.app.change();
                    },
                    onstart: event => {
                        const viewRect = feezal.view.getBoundingClientRect();
                        const containerRect = feezal.container.getBoundingClientRect();
                        console.log(event.target.dataEl);
                        this.newElem = document.createElement(event.target.dataEl);
                        // Feezal.view.appendChild(this.dragEl);
                        feezal.view.append(this.newElem);
                        const newElementRect = this.newElem.getBoundingClientRect();
                        feezal.editor.initElem(this.newElem, true);
                        this.newElem.style.outlineWidth = '2px';

                        this.newElem.style.top = (event.clientY - viewRect.y - (newElementRect.height / 2)) + 'px';
                        this.newElem.style.left = (event.clientX - viewRect.x - containerRect.x - (newElementRect.width / 2)) + 'px';
                    }
                })
                .dropzone({
                    accept: '#view-container'
                })
                .on('drop', event => {
                });
        });
    }

    _filterChanged(event) {
        this.filter = event ? event.target.value : '';
        const categories = {};
        // Console.log('feezal.elements', feezal.elements)
        feezal.elements.forEach(element => {
            const config = window.customElements.get(element).paletteOptions || window.customElements.get(element).feezal.palette;
            if (!this.filter || config.name.toLowerCase().includes(this.filter.toLowerCase())) {
                if (!categories[config.category]) {
                    categories[config.category] = [];
                }

                categories[config.category].push({el: element, ...config});
            }
        });
        const array = [];
        Object.keys(categories).forEach(category => {
            array.push({name: category, elements: categories[category]});
        });
        this.categories = array;
    }
}

window.customElements.define('feezal-palette', FeezalPalette);
