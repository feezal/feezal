import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import 'dragselect';

import '@polymer/iron-pages/iron-pages';
import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';

import './feezal-sidebar-inspector-styles';
import './feezal-sidebar-inspector-attributes';

import '@polymer/paper-input/paper-input';

class FeezalSidebarInspector extends PolymerElement {
    static get properties() {
        return {
            tab: {
                type: Number,
                value: 0
            },
            viewSelected: {
                type: Boolean,
                value: false,
                notify: true
            },

            selectedElems: {
                type: Array,
                value: [],
                observer: '_selectedElemsChanged',
                notify: true
            },
            editorConfig: {
                type: Object,
                value: {}
            },
            currentView: {
                type: Array,
                value: []
            },
            view: {
                type: String,
                observer: '_viewChanged',
                notify: true
            },
            snapping: {
                type: String,
                value: 'off',
                observer: '_snappingChanged'
            },
            gridSize: {
                type: Number,
                value: 24,
                observer: '_gridSizeChanged',
                reflectToAttribute: true
            },
            gridVisible: {
                type: Boolean,
                reflectToAttribute: true,
                observer: '_gridVisibleChanged'
            }
        };
    }

    static get template() {
        return html`
            <style>
                :host {
                    display: block;
                    height: 100%;
                    max-height: 100%;
                    background-color: white;

                    box-sizing: border-box;
                    
                }
                iron-pages {
                    height: calc(100% - 48px);
                }
                .paper-form {
                    height: 100%;
                    overflow: scroll;
                }
                paper-tabs {
                    --paper-tabs-selection-bar-color: var(--paper-indigo-700);
              
                    background-color: #eee;
                }
                paper-tab {
                    --paper-tab-ink: gray;
                }
                
                #editor-form {
                    margin: 12px;
                }                

            </style>
            
            <paper-tabs selected="{{tab}}" >
                <paper-tab>Attributes</paper-tab>
                <paper-tab>Styles</paper-tab>
            </paper-tabs>
            
            <iron-pages selected="{{tab}}">
                <div class="paper-form">
                    <feezal-sidebar-inspector-attributes selected-elems="[[selectedElems]]"></feezal-sidebar-inspector-attributes>
                </div>        
                <div class="paper-form">
                    <feezal-sidebar-inspector-styles selected-elems="[[selectedElems]]"></feezal-sidebar-inspector-styles>
                </div>
            </iron-pages>
            `;
    }

    connectedCallback() {
        super.connectedCallback();

        feezal.connection.addEventListener('connected', e => {
            if (!e.detail.reconnect) {
                feezal.connection.getSite(feezal.siteName, data => {
                    console.log('getSite', data);
                    this.loadViews(data.views);
                    if (data.viewer && data.viewer.connection) {
                        feezal.app.shadowRoot.querySelector('feezal-sidebar-viewer').backend = data.viewer.connection.backend;
                        feezal.app.shadowRoot.querySelector('feezal-sidebar-viewer')[data.viewer.connection.backend + 'Config'] = data.viewer.connection.config || {};
                    }

                    this._keyboard();
                });
            }
        });
    }

    restoreViews(data) {
        this.dragselect = {};

        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => {
            el.remove();
        });

        this._viewChanged();
    }

    loadViews(data) {
        this.dragselect = {};

        feezal.app.innerHTML = data;

        feezal.app.views = [...feezal.views];

        feezal.app._removeClassesFromChildren(feezal.site, [
            'feezal-selected'
        ]);

        feezal.site.querySelectorAll('.dragselect-rectangle').forEach(el => {
            el.remove();
        });
        feezal.ready = true;

        feezal.app.shadowRoot.querySelector('feezal-sidebar-themes').siteReady();

        feezal.app.addHistory();

        this._viewChanged();
        feezal.site.setAttribute('tabindex', 1);
        feezal.site.view = feezal.app.nav.view;
        feezal.site.updateVisibility();
    }

    _snappingChanged() {

    }

    _gridSizeChanged() {
        Object.assign(feezal.app.shadowRoot.querySelector('#grid').style, {
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent ${this.gridSize - 1}px, rgba(0, 0, 0, 0.1) ${this.gridSize - 1}px, #CCC ${this.gridSize}px), repeating-linear-gradient(-90deg, transparent, transparent ${this.gridSize - 1}px, rgba(0, 0, 0, 0.1) ${this.gridSize - 2}px, rgba(0, 0, 0, 0.1) ${this.gridSize}px)`,
            backgroundSize: `${this.gridSize}px ${this.gridSize}px`
        });
    }

    _gridVisibleChanged(val) {
        feezal.app.shadowRoot.querySelector('#grid').style.display = val ? 'block' : 'none';
    }

    _viewChanged() {
        if (!feezal.ready) {
            return;
        }
        // Console.log('feezal-editor _viewChanged', this.view)

        const views = [...feezal.site.querySelectorAll('feezal-view')].map(v => v.name);

        if (!views.includes(this.view)) {
            this.view = views[0];
            location.hash = '/' + this.view;
        }

        const view = feezal.getView(this.view);

        if (!this.dragselect) {
            this.dragselect = {};
        }

        if (!this.dragselect[this.view]) {
            const selector = document.createElement('div');

            selector.style.position = 'absolute';
            if (!this.customStyles) {
                selector.style.background = 'rgba(0, 0, 0, 0.1)';
                selector.style.border = '1px dotted rgba(250, 120, 0, 0.8)';
                selector.style.display = 'none';
                selector.style.pointerEvents = 'none'; // Fix for issue #8 (ie11+)
                selector.classList.add('dragselect-rectangle');
            }

            view.append(selector);

            this.dragselect[this.view] = new DragSelect({
                area: view,
                selector,
                selectedClass: 'feezal-selected',
                onDragStartBegin: element => {
                    if (element.target.tagName !== 'FEEZAL-VIEW') {
                        this.dragselect[this.view].break();
                        return false;
                    }
                },
                callback: elements => {
                    const selectedElems = [...view.querySelectorAll('.feezal-selected')];
                    if (selectedElems.length > 0) {
                        this.set('selectedElems', selectedElems);
                        this.set('viewSelected', false);
                    } else {
                        this.set('selectedElems', [view]);
                        this.set('viewSelected', true);
                    }
                }
            });
        }

        this.dragselect[this.view].start();

        this.currentView = [view];

        [...view.children].forEach(el => {
            if (el.localName.startsWith('feezal-element-') && !el.feezalEditable) {
                this.initElem(el);
            } else {
                this.dragselect[this.view].removeSelection(el);
            }
        });

        this.selectElement();
    }

    _keyboard() {
        console.log('keyboard');
        window.addEventListener('keydown', event => {
            if (feezal.app.querySelector('feezal-site:focus')) {
                console.log(event)
                switch (event.key) {
                    case 'Delete':
                        if (!this.viewSelected) {
                            this._deleteElems();
                        }

                        break;
                    case 'Escape':
                        if (!this.viewSelected) {
                            this.selectElement(this.currentView);
                        }
                        break;
                    case 'ArrowRight':
                        if (!this.viewSelected) {
                            this._moveElems(event.altKey ? this.gridSize : 1, 0, true);
                        }

                        break;
                    case 'ArrowLeft':
                        if (!this.viewSelected) {
                            this._moveElems(-(event.altKey ? this.gridSize : 1), 0, true);
                        }

                        break;
                    case 'ArrowUp':
                        if (!this.viewSelected) {
                            this._moveElems(0, -(event.altKey ? this.gridSize : 1), true);
                        }

                        break;
                    case 'ArrowDown':
                        if (!this.viewSelected) {
                            this._moveElems(0, event.altKey ? this.gridSize : 1, true);
                        }
                        break;

                    case 'z':
                        if ((event.metaKey || event.ctrlKey) && !this.viewSelected) {
                            feezal.app._undo();
                        }
                        break;
                    /*
                    case 'c':
                        if (event.ctrlKey && !this.viewSelected) {
                            feezal.app._copy();
                        }

                        break;
                    case 'v':
                        if (event.ctrlKey && !this.viewSelected) {
                            feezal.app._paste();
                        }

                        break;
                    case 'x':
                        if (event.ctrlKey && !this.viewSelected) {
                            feezal.app._cut();
                        }
                    */

                    case 'a':
                        if (event.metaKey || event.ctrlKey) {
                            console.log('selectAll', feezal.view.querySelectorAll('.feezal-element'));
                            this.selectElement(feezal.view.querySelectorAll('.feezal-element'));
                        }
                    break;
                    default:
                        return;
                }
            }

            event.stopPropagation();
        });
    }

    _deleteElems() {
        this.selectedElems.forEach(el => {
            feezal.view.removeChild(el);
        });
        this.selectedElems = [];
        feezal.app.change();
    }

    _selectedElemsChanged() {
        // Console.log('_selectedElemsChanged', this.selectedElems)
        const tabs = feezal.app.shadowRoot.querySelector('#container-view-menu paper-tabs');
        if (this.selectedElems.length === 1 && this.selectedElems[0].tagName === 'FEEZAL-VIEW') {
            tabs.style.setProperty('--paper-tabs-selection-bar-color', 'orange');
        } else {
            tabs.style.removeProperty('--paper-tabs-selection-bar-color');
        }

        feezal.app.sidebar = 'inspector';
    }

    _moveElems(dx, dy, restrict) {
        const changes = [];
        this.selectedElems.forEach(el => {
            if (dx) {
                const x = (parseFloat(el.style.left.replace('px', '')) || 0) + parseFloat(dx);
                el.style.left = x + 'px';
                changes.push('left');
            }

            if (dy) {
                const y = (parseFloat(el.style.top.replace('px', '')) || 0) + parseFloat(dy);
                el.style.top = y + 'px';
                changes.push('top');
            }

            if (event.dx && this.selectedElems.map(el => el.style.left).every(val => val === this.selectedElems[0].style.left)) {
                changes.push('left');
            }

            if (event.dy && this.selectedElems.map(el => el.style.top).every(val => val === this.selectedElems[0].style.top)) {
                changes.push('top');
            }

            this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(this.selectedElems[0], changes);
        });
        if (!this.dragElement) {
            clearTimeout(this.changeTimeout);
            this.changeTimeout = setTimeout(() => {
                feezal.app.change();
            }, 3000);
        }
    }

    _snapSize(x, y) {
        if (this.resizeElement) {
            const rect = this.resizeElement.getBoundingClientRect();
            const elX = parseFloat(this.resizeElement.style.left.replace('px', ''));
            const elY = parseFloat(this.resizeElement.style.top.replace('px', ''));
            const snap = this._snap(x + rect.x, y + rect.y);
            if (snap) {
                const obj = {range: snap.range};
                if (snap.x) {
                    obj.width = snap.x - rect.x;
                }

                if (snap.y) {
                    obj.height = snap.y - rect.y;
                }

                return obj;
            }
        }
    }

    _snap(x, y) {
        if (this.snapping === 'off') {
            return;
        }

        const view = feezal.getView(this.view);
        const viewRect = view.getBoundingClientRect();

        if (this.snapping === 'grid') {
            return {
                x: Math.floor(Math.round((x - viewRect.x) / this.gridSize) * this.gridSize + viewRect.x),
                y: Math.floor(Math.round((y - viewRect.y) / this.gridSize) * this.gridSize + viewRect.y),
                range: Math.floor(this.gridSize / 2.5)
            };
        }

        const vsnap1 = feezal.container.querySelector('#vsnap1');
        const hsnap1 = feezal.container.querySelector('#hsnap1');
        const vsnap2 = feezal.container.querySelector('#vsnap2');
        const hsnap2 = feezal.container.querySelector('#hsnap2');

        x -= viewRect.x;
        y = y - viewRect.y + 48;

        let range;

        if (false && this.dragElement) {
            const elemRect = this.dragElement.getBoundingClientRect();
            range = Math.round((elemRect.width > elemRect.height ? elemRect.width : elemRect.height) / 2);
        } else {
            range = 24;
        }

        let nearX = 10000;
        let nearY = 10000;

        const obj = {};

        [...view.children].forEach(el => {
            let snapX;
            let snapY;
            if (el.localName.startsWith('feezal-element-') && el !== this.resizeElement && el !== this.dragElement) {
                const rect = el.getBoundingClientRect();

                const tx = rect.x - viewRect.x;
                const ty = rect.y + 48 - viewRect.y;

                const tr = tx + rect.width;
                const tb = ty + rect.height;

                const distX = Math.abs(x - tx);
                const distY = Math.abs(y - ty);
                const distR = Math.abs(x - tr);
                const distB = Math.abs(y - tb);

                if (distX < range || distR < range) {
                    if (distX <= distR) {
                        if (distX < nearX) {
                            nearX = distX;
                            snapX = tx;
                        }
                    } else if (distR < nearX) {
                        nearX = distR;
                        snapX = tr;
                    }
                }

                if (distY < range || distB < range) {
                    if (distY <= distB) {
                        if (distY < nearY) {
                            nearY = distY;
                            snapY = ty;
                        }
                    } else if (distB < nearY) {
                        nearY = distB;
                        snapY = tb;
                    }
                }
            }

            if (typeof snapX !== 'undefined') {
                this.vsnapSwap = !this.vsnapSwap;
                Object.assign((this.vsnapSwap ? vsnap1 : vsnap2).style, {left: snapX + 'px', display: 'block'});

                obj.x = snapX + viewRect.x;
                obj.range = range;
            }

            if (typeof snapY !== 'undefined') {
                this.hsnapSwap = !this.hsnapSwap;
                Object.assign((this.hsnapSwap ? hsnap1 : hsnap2).style, {top: snapY + 'px', display: 'block'});

                obj.y = snapY + viewRect.y - 48;
                obj.range = range;
            }
        });

        if (obj.range) {
            return obj;
        }
    }

    initElem(el, created) {
        if (el.feezalEditable) {
            return;
        }

        el.feezalEditable = true;
        el.classList.add('feezal-editable');
        const elemOptions = window.customElements.get(el.localName) && window.customElements.get(el.localName).feezal || {};

        if (!elemOptions) {
            console.error(el.localName, 'feezal property missing')
            return;
        }

        if (created && elemOptions.defaultStyle) {
            Object.assign(el.style, elemOptions.defaultStyle);
        }

        interact(el)
            .draggable({
                restrict: {
                    restriction: () => this.dragRect,
                    elementRect: {top: 0, left: 0, bottom: 1, right: 1}
                },
                snap: {
                    targets: [
                        (x, y) => this._snap(x, y)
                    ],
                    relativePoints: [
                        {x: 0, y: 0}, // Snap relative to the element's top-left,
                        {x: 1, y: 0}, // Snap relative to the element's top-left,
                        {x: 0, y: 1}, // Snap relative to the element's top-left,
                        {x: 1, y: 1} // Snap relative to the element's top-left,
                    ]
                }
            })
            .resizable({
                edges: {left: true, right: true, bottom: true, top: true},
                restrictEdges: {
                    outer: 'parent'
                },
                margin: 5,
                restrictSize: {
                    min: {
                        width: (elemOptions.restrict && elemOptions.restrict.minWidth) || 12,
                        height: (elemOptions.restrict && elemOptions.restrict.minHeight) || 12
                    }
                },
                snapSize: {
                    targets: [
                        (x, y) => this._snapSize(x, y)
                    ]
                }
            })
            .on('dragstart', event => {
                const view = feezal.getView(this.view);
                const viewRect = view.getBoundingClientRect();
                const targetRect = event.target.getBoundingClientRect();
                this.dragElement = event.target;

                if (!event.target.classList.contains('feezal-selected')) {
                    this.dragselect[this.view].setSelection(event.target, true);
                }

                const groupRect = {
                    top: targetRect.top,
                    left: targetRect.left,
                    bottom: targetRect.bottom,
                    right: targetRect.right
                };

                this.selectedElems.forEach(el => {
                    if (event.target !== el) {
                        const elRect = el.getBoundingClientRect();
                        if (elRect.top < groupRect.top) {
                            groupRect.top = elRect.top;
                        }

                        if (elRect.left < groupRect.left) {
                            groupRect.left = elRect.left;
                        }

                        if (elRect.bottom > groupRect.bottom) {
                            groupRect.bottom = elRect.bottom;
                        }

                        if (elRect.right > groupRect.right) {
                            groupRect.right = elRect.right;
                        }
                    }
                });
                this.dragRect = {
                    top: viewRect.top + (targetRect.top - groupRect.top),
                    left: viewRect.left + (targetRect.left - groupRect.left),
                    bottom: viewRect.bottom + (targetRect.bottom - groupRect.bottom),
                    right: viewRect.right + (targetRect.right - groupRect.right)
                };
            })
            .on('dragmove', event => {
                const {target} = event;
                this.dragselect[this.view].removeSelectables(target);
                this._moveElems(event.dx, event.dy);
            })
            .on('dragend', event => {
                setTimeout(() => {
                    this.dragselect[this.view].addSelectables(event.target);
                }, 10);
                const vsnap1 = feezal.container.querySelector('#vsnap1');
                const hsnap1 = feezal.container.querySelector('#hsnap1');
                const vsnap2 = feezal.container.querySelector('#vsnap2');
                const hsnap2 = feezal.container.querySelector('#hsnap2');

                vsnap1.style.display = 'none';
                hsnap1.style.display = 'none';
                vsnap2.style.display = 'none';
                hsnap2.style.display = 'none';

                this.dragElement = null;
                feezal.app.change();
            })
            .on('resizestart', event => {
                // Console.log('resizestart', event.target)
                this.resizeElement = event.target;
                if (!event.target.classList.contains('feezal-selected')) {
                    this.dragselect[this.view].setSelection(event.target, true);
                }
            })
            .on('resizemove', event => {
                const {target} = event;

                const changes = [];

                let x = parseFloat(target.style.left.replace('px', '')) || 0; // Target.xCoord || 0;
                let y = parseFloat(target.style.top.replace('px', '')) || 0; // Target.yCoord || 0;

                const {width} = event.rect;
                const {height} = event.rect;

                // Update the element's style
                if (target.style.width !== width + 'px') {
                    target.style.width = width + 'px';
                    changes.push('width');
                }

                if (target.style.height !== height + 'px') {
                    target.style.height = height + 'px';
                    changes.push('height');
                }

                // Translate when resizing from top or left edges
                x += event.deltaRect.left;
                y += event.deltaRect.top;

                if (target.style.left !== x + 'px') {
                    target.style.left = x + 'px';
                    changes.push('left');
                }

                if (target.style.top !== y + 'px') {
                    target.style.top = y + 'px';
                    changes.push('top');
                }

                this.shadowRoot.querySelector('feezal-sidebar-inspector-styles').setStyle(target, changes);
            })
            .on('resizeend', event => {
                setTimeout(() => {
                    this.dragselect[this.view].addSelectables(event.target);
                }, 10);
                this.resizeElement = null;
                feezal.app.change();
            });

        this.dragselect[this.view].addSelectables(el);
    }

    selectElement(element) {
        this.dragselect[this.view].setSelection(element);
        this.updateSelection();
    }

    updateSelection() {
        if (!feezal.view) {
            return;
        }
        const selectedElems = [...feezal.view.querySelectorAll('.feezal-selected')];
        if (selectedElems.length > 0) {
            this.set('selectedElems', selectedElems);
            this.set('viewSelected', false);
        } else {
            this.set('selectedElems', []);
            this.set('selectedView', [feezal.view]);
            this.set('viewSelected', true);
        }
    }
}

window.customElements.define('feezal-sidebar-inspector', FeezalSidebarInspector);
