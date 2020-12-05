import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import {camelToDashCase} from '@polymer/polymer/lib/utils/case-map.js';

import '@polymer/app-route/app-location.js';
import '@polymer/app-route/app-route.js';
import '@polymer/app-storage/app-localstorage/app-localstorage-document.js';

import '@polymer/iron-icon/iron-icon';
import '@polymer/iron-icons/iron-icons';
import '@polymer/iron-icons/image-icons';
import '@polymer/iron-icons/hardware-icons';

import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';
import '@polymer/paper-button/paper-button';

import '@polymer/paper-icon-button/paper-icon-button';
import '@polymer/paper-dialog/paper-dialog';
import '@polymer/paper-dropdown-menu/paper-dropdown-menu.js';
import '@polymer/paper-item/paper-item.js';
import '@polymer/paper-listbox/paper-listbox.js';
import '@polymer/paper-spinner/paper-spinner.js';

import './feezal-menu';
import './feezal-palette';
import './feezal-site';
import './feezal-view';
import './feezal-sidebar-inspector';
import './feezal-sidebar-assets';
import './feezal-sidebar-themes';
import './feezal-sidebar-palette';
import './feezal-sidebar-viewer';
import './feezal-sidebar-editor';

class FeezalAppEditor extends PolymerElement {
    static get properties() {
        return {
            route: {
                type: Object,
                observer: '_routeChanged'
            },
            nav: {
                type: Object,
                observer: '_navChanged'
            },
            views: {
                type: Array
            },
            changes: {
                type: Boolean,
                value: false,
                notify: true,
                observer: '_changesChanged'
            },
            deploying: {
                type: Boolean,
                value: false,
                notify: true
            },
            viewSelected: {
                type: Boolean
            },
            clipboardEmpty: {
                type: Boolean,
                value: true
            },
            history: {
                type: Array,
                value: []
            },
            hasHistory: {
                type: Boolean,
                value: false
            },
            currentState: {
                type: String
            },
            sidebar: {
                type: String,
                value: 'View',
                observer: '_sidebarChanged'
            },
            gridSize: {
                type: Number,
                value: 24
            },
            paletteVisible: {
                type: Boolean,
                value: true,
                observer: '_paletteVisibleChanged'
            },
            sidebarVisible: {
                type: Boolean,
                value: true,
                observer: '_sidebarVisibleChanged'
            }
        };
    }

    _collapseIcon(visible) {
        return visible ? 'hardware:keyboard-arrow-left' : 'hardware:keyboard-arrow-right';
    }

    _collapseIconReverse(visible) {
        return visible ? 'hardware:keyboard-arrow-right' : 'hardware:keyboard-arrow-left';
    }

    static get template() {
        return html`
            <style>
                :host {
                    width: 100%;
                    height: 100%;
                }
                
                
                #container {
                    width: 100%;
                    display: flex;
                    flex-flow: row;
                    position: absolute;
                    height: calc(100% - 42px);
                    --feezal-view-margin: auto;
                }
        
                #container-view {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    padding: 0;
                    -webkit-touch-callout: none; 
                    -webkit-user-select: none;
                    user-select: none;
                }
                
                #container-view-menu {
                    display: flex;
                    flex-direction: row;
                    box-sizing: border-box;
                }
                
                
                #container-view-menu paper-tabs {
                    background-color: #eee;
                    --paper-tabs-selection-bar-color: var(--paper-indigo-700);
                    flex-grow: 1;
                }
                
                #container-view-menu paper-tab {
                    min-width: 60px;
                    --paper-tab-ink: gray;
                }
                
                #add-view {
                    display: flex;
                    width: 48px;
                    height: 48px;
                    background-color: #eee;
                }
                #add-view paper-icon-button {
                    margin: auto;
                    color: #666;
                }
                
                
                ::slotted(feezal-site) {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: calc(100% - 48px);
                    padding: 0;
                }
                
                ::slotted(feezal-site:focus) {
                    outline: 0;
                    box-shadow: 0px -2px 1px rgba(250,120,0,0.2);
                }
        
                #menu {
                    height: 42px;
                    background-color: #444;
                    width: 100%;
                    display: flex;
                    flex-direction: row;
                    box-sizing: border-box;
                    color: white;
                }
        
                #menu-left {
                    width: 138px;
                    font-size: 18px;
                    font-style: italic;
                    font-weight: 600;
                    margin-left: 12px;
                    margin-top: 12px;
                    color: rgba(250, 120, 0, 0.8);
                }
                
                
                
                #menu-center {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: row;
                    height: 42px;
                }
                #menu-right {
                    display: flex;
                    width: 350px;
                }
                        
                #sidebarhead {
                    margin: 10px;
                    flex-grow: 1;
                }
                iron-pages {
                    flex: 0 0 350px;
                    border-left: 2px solid #444;
                    --paper-input-container-underline: {
                        border-width: 1px;
                    }
                }
                
                #viewdialog {
                    margin: 0;
                    --paper-input-container-underline: {
                        border-width: 1px;
                    }
                }
                #viewdialog #delete {
                    background-color: orangered;
                    color: white;
                    margin-left: 24px;
                    height: 32px;
                }

                #hsnap1, #hsnap2 {
                    position: absolute;
                    width: 100%;
                    height: 1px;
                    border-bottom: 1px dotted rgba(0,0,0,0.3);
                    left: 0;
                    display: none;
                    box-sizing: border-box;
                }
                #vsnap1, #vsnap2 {
                    position: absolute;
                    height: calc(100% - 48px);
                    width: 1px;
                    border-right: 1px dotted rgba(0,0,0,0.3);
                    top: 48px;
                    display: none;
                    box-sizing: border-box;
                }
                #grid {
                    width: 100%;
                    height: calc(100% - 48px);
                    position: absolute;
                    top: 48px;
                    left: 0;
                
                    pointer-events: none;
                }
                iron-icon.small {
                    --iron-icon-height: 16px;
                    --iron-icon-width: 16px;
                }
                #toolbar {
                    display: inline-block;
                    flex-grow: 1;
                    margin: auto;
                }
                
                
                #menu-center paper-icon-button {
                    width: 30px;
                    height: 30px;
                    --paper-icon-button-ink-color: #ddd;
                    margin: auto;
                }
                
                #deploy, #view {
                    height: 34px;
                    margin: auto;
                    margin-right: 12px;
                    background-color: rgba(250, 120, 0, 0.8);
                }
                #deploy[disabled] {
                    background-color: #333;
                }
                #deploycontainer {
                    display: none;
                }
                .feezal-sidebar {
                    margin: 6px;
                }
                .feezal-menu-icon {
                    padding-right: 12px;
                }

            </style>
            
            <app-location route="{{route}}" use-hash-as-path></app-location>
            <app-route
                route="{{route}}"
                pattern="/:view"
                data="{{nav}}">
            </app-route>
            
            <app-localstorage-document key="paletteVisible" data="{{paletteVisible}}"></app-localstorage-document>
            <app-localstorage-document key="sidebarVisible" data="{{sidebarVisible}}"></app-localstorage-document>
            <app-localstorage-document key="gridVisible" data="{{gridVisible}}"></app-localstorage-document>
            <app-localstorage-document key="gridSize" data="{{gridSize}}"></app-localstorage-document>
            <app-localstorage-document key="snapping" data="{{snapping}}"></app-localstorage-document>
            <app-localstorage-document key="sidebar" data="{{sidebar}}"></app-localstorage-document>
            
            <div id="menu">
                <div id="menu-left">
                    Feezal
                </div>
                
                <div id="menu-center">
                    <paper-icon-button on-click="_collapsePalette" icon="[[_collapseIcon(paletteVisible)]]"></paper-icon-button>
                    
                    <div id="toolbar">
                        <paper-icon-button on-click="_clickCopy" icon="content-copy" disabled="[[viewSelected]]"></paper-icon-button>
                        <paper-icon-button on-click="_clickPaste" icon="content-paste" ></paper-icon-button>
                        <paper-icon-button on-click="_clickCut" icon="content-cut" disabled="[[viewSelected]]"></paper-icon-button>
                        <paper-icon-button on-click="_delete" icon="delete" disabled="[[viewSelected]]"></paper-icon-button>
                        <paper-icon-button on-click="_undo" icon="undo" disabled="[[!_hasHistory(history.*)]]"></paper-icon-button>
                    </div>
                    
                    <paper-button id="view" raised on-click="_view"><iron-icon class="small" icon="hardware:tv"></iron-icon>&nbsp;&nbsp;View</paper-button>
                    <paper-button id="deploy" raised on-click="_deploy" disabled="[[deploying]]"><iron-icon class="small" icon="file-upload"></iron-icon> Deploy <div style="display: inline-block; padding-left: 6px; padding-top: 3px;"><paper-spinner active="[[deploying]]"></paper-spinner></div></paper-button>
                    
                    <paper-icon-button on-click="_collapseSidebar" icon="[[_collapseIconReverse(sidebarVisible)]]"></paper-icon-button>
                </div>
                
                <div id="menu-right">
                   <span id="sidebarhead" on-click="_siderbarheadClick"></span>
                   <paper-menu-button id="sidebarmenubutton" style="padding-top: 0" dynamic-align horizontal-offset="46">
                      <paper-icon-button icon="menu" slot="dropdown-trigger" alt="menu"></paper-icon-button>
                      <paper-listbox id="sidebarmenu" style="min-width: 300px;" slot="dropdown-content" selected="{{sidebar}}" attr-for-selected="value">
                        <paper-item value="inspector"><iron-icon icon="zoom-in" class="feezal-menu-icon"></iron-icon>Element/View Inspector</paper-item>
                        <paper-item value="themes"><iron-icon icon="image:palette" class="feezal-menu-icon"></iron-icon>Theme</paper-item>
                        <paper-item value="viewer"><iron-icon icon="hardware:tv" class="feezal-menu-icon"></iron-icon>Viewer Settings</paper-item>
                        <paper-item value="editor"><iron-icon icon="settings" class="feezal-menu-icon"></iron-icon>Editor Settings</paper-item>
                        <paper-item value="assets"><iron-icon icon="folder-open" class="feezal-menu-icon"></iron-icon>Asset Manager</paper-item>
                        <paper-item value="palette"><iron-icon icon="list" class="feezal-menu-icon"></iron-icon>Palette Manager</paper-item>
                      </paper-listbox>
                    </paper-menu-button>
                </div>
            </div>
            <div id="container">
                <feezal-palette id="palette"></feezal-palette>
                
                <div id="container-view">
                    <div id="container-view-menu">
                        <paper-tabs id="tabs" selected="{{nav.view}}" attr-for-selected="view" scrollable mutable-data>
                            <template is="dom-repeat" items="[[views]]" mutable-data>
                                <paper-tab on-click="_tabClick" view="[[item.name]]" on-dblclick="_editView">[[item.name]]</paper-tab>
                            </template>
                        </paper-tabs>
                        <div id="add-view">
                            <paper-icon-button icon="note-add" on-click="_addView"></paper-icon-button>
                        </div>
                    </div>
                    
                    <slot></slot>
                    
                    <div id="grid"></div>
                    <div id="hsnap1"></div>
                    <div id="vsnap1"></div>        
                    <div id="hsnap2"></div>
                    <div id="vsnap2"></div>        
                </div>
                
                <iron-pages id="sidebar" attr-for-selected="sidebar" selected="[[sidebar]]">
                    <feezal-sidebar-inspector sidebar="inspector" view-selected="{{viewSelected}}" view="[[nav.view]]" snapping="{{snapping}}" grid-size="{{gridSize}}" grid-visible="{{gridVisible}}"></feezal-sidebar-inspector>
                    <feezal-sidebar-assets sidebar="assets"></feezal-sidebar-assets>
                    <feezal-sidebar-themes sidebar="themes"></feezal-sidebar-themes>
                    <feezal-sidebar-palette sidebar="palette"></feezal-sidebar-palette>
                    <feezal-sidebar-viewer sidebar="viewer"></feezal-sidebar-viewer>
                    <feezal-sidebar-editor sidebar="editor" grid-size="{{gridSize}}" grid-visible="{{gridVisible}}" snapping="{{snapping}}"></feezal-sidebar-editor>
                </iron-pages>
            </div>

            <paper-dialog id="viewdialog" no-overlap horizontal-align="left" vertical-align="top">
                <paper-input label="View Name" on-change="_renameView" on-value-changed="_checkViewName"></paper-input>
                <paper-button id="delete" raised on-click="_deleteView"><iron-icon icon="delete"></iron-icon>Delete View</paper-button>   
            </paper-dialog>
            
            <template id="clipboard"></template>
            <template id="deploycontainer"></template>
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('copy', e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) {
                this._copy(e);
            }
        });
        document.addEventListener('paste', e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) {
                this._paste(e);
            }
        });
        document.addEventListener('cut', e => {
            if (this.querySelectorAll('feezal-site:focus').length > 0) {
                this._cut(e);
            }
        });
    }

    _sidebarChanged() {
        if (this.$.sidebarmenu.querySelector('.iron-selected')) {
            this.$.sidebarhead.innerHTML = this.$.sidebarmenu.querySelector('.iron-selected').innerHTML;
        } else {
            this.$.sidebarhead.innerHTML = this.$.sidebarmenu.querySelector('*').innerHTML;
        }
    }

    _siderbarheadClick() {
        this.$.sidebarmenubutton.open();
    }

    _clickCopy() {
        document.execCommand('copy');
    }

    _clickPaste() {
        console.log('_clickPaste');
        this._pasteInternal();
    }

    _clickCut() {
        document.execCommand('cut');
    }

    _collapsePalette() {
        this.paletteVisible = !this.paletteVisible;
    }

    _collapseSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
    }

    _paletteVisibleChanged(visible) {
        this.$.palette.style.display = visible ? 'block' : 'none';
        this.shadowRoot.querySelector('#menu-left').style.display = visible ? 'block' : 'none';
    }

    _sidebarVisibleChanged(visible) {
        this.$.sidebar.style.display = visible ? 'block' : 'none';
        this.shadowRoot.querySelector('#menu-right').style.display = visible ? 'flex' : 'none';
    }

    _tabClick(e) {
        feezal.editor.selectedElems = [feezal.getView(e.model.item.name)];
    }

    _navChanged(d) {
        if (feezal.site) {
            feezal.site.view = d.view;
        }
    }

    _routeChanged(r) {
        //console.log('app-editor._routeChanged', r);

    }

    _changesChanged(changes) {
        feezal.hasChanges = changes;
        this.$.deploy.style.color = changes ? 'white' : '#444';
    }

    change(noHistory) {
        this.set('changes', true);
        if (!noHistory) {
            this.addHistory();
        }
    }

    _hasHistory() {
        const hasHistory = this.history && this.history.length > 1;
        return hasHistory;
    }

    _undo() {
        if (this._hasHistory()) {
            this.pop('history');
            this.shadowRoot.querySelector('feezal-sidebar-inspector').restoreViews(this.history[this.history.length - 1]);
        }
    }

    _removeClassesFromChildren(parent, classes) {
        classes.forEach(cl => {
            parent.querySelectorAll('.' + cl).forEach(element => {
                element.classList.remove(cl);
            });
        });
    }

    addHistory() {
        const pages = feezal.site;

        if (this.history.length > 4) {
            this.history.shift();
        }

        this.push('history', pages.innerHTML);
        this.notifyPath('history.splices');
    }

    _clean(container) {
        this._removeClassesFromChildren(container, [
            'feezal-editable',
            'feezal-selected',
            'iron-selected',
            'ds-selectable'
        ]);
        container.querySelectorAll('.dragselect-rectangle').forEach(element => {
            // Console.log('remove dragselect')
            element.remove();
        });
    }

    _view() {
        this.viewer = window.open('../viewer/' + feezal.siteName, 'feezal-' + feezal.siteName);
    }

    _deploy() {
        this.deploying = true;
        const pages = feezal.site;

        this.$.deploycontainer.innerHTML = pages.outerHTML;

        this.$.deploycontainer.content.querySelector('feezal-site').removeAttribute('tabindex');

        this._clean(this.$.deploycontainer.content);

        const {connection, site} = this.shadowRoot.querySelector('feezal-sidebar-viewer');
        const elements = [...this.$.deploycontainer.content.querySelectorAll('*')].map(element => element.tagName);
        const html = [...this.$.deploycontainer.content.childNodes].map(n => n.outerHTML).join('\n');

        site.name = feezal.siteName;

        feezal.connection.deploy({
            html,
            elements,
            connection,
            site
        }, () => {
            this.changes = false;
            this.deploying = false;
        });
    }

    _clone(element) {
        const clone = element.cloneNode(false);
        clone.style.cursor = '';
        return clone;
    }

    _clearTemplate(tpl) {
        while (tpl.firstChild) {
            tpl.firstChild.remove();
        }
    }

    _copy(event) {
        console.log('_copy');
        this._clearTemplate(this.$.clipboard.content);

        feezal.editor.selectedElems.forEach(element => {
            this.$.clipboard.content.append(this._clone(element));
        });

        this._clean(this.$.clipboard.content);

        const html = this.$.clipboard.innerHTML;

        event.clipboardData.setData('text/plain', html);
        event.preventDefault();
    }

    _pasteInternal() {
        const newSelection = [];
        this.$.clipboard.content.childNodes.forEach(element => {
            const moveX = 25;
            const moveY = 25;

            element.style.left = (Number(element.style.left.replace('px', '')) + moveX) + 'px';
            element.style.top = (Number(element.style.top.replace('px', '')) + moveY) + 'px';

            const clone = this._clone(element);
            newSelection.push(clone);
            feezal.view.append(clone);
            feezal.editor.initElem(clone);
        });
        feezal.editor.selectElement(newSelection);
    }

    _paste(event) {
        console.log('_paste');
        const html = (event.clipboardData || window.clipboardData).getData('text');
        this._clearTemplate(this.$.clipboard.content);

        if (/^\s*<feezal-element-/.test(html)) {
            this.$.clipboard.innerHTML = html;
        }

        this._pasteInternal();
        event.preventDefault();
    }

    _cut(event) {
        this._copy(event);
        this._delete();
    }

    _delete() {
        feezal.editor._deleteElems();
        this.viewSelected = true;
    }

    _deleteView() {
        const view = feezal.site.querySelector('[name="' + this.editViewName + '"]');
        view.remove();
        this.views = this.views.slice();
        this.$.viewdialog.close();
        feezal.app.views = [...feezal.views];
        setTimeout(() => {
            this.set('nav.view', '');
        }, 0);
    }

    _checkViewName() {
        if (!this.views) {
            return;
        }

        const oldName = this.editViewName;
        const name = this.$.viewdialog.querySelector('paper-input').value;
        const valid = true;
        const invalid = oldName !== name && this.views.map(v => v.name).includes(name);
        this.$.viewdialog.querySelector('paper-input').invalid = invalid;
    }

    _renameView(event) {
        const tabs = this.shadowRoot.querySelector('paper-tabs');
        const oldName = this.editViewName;
        const newName = event.target.value;
        if (oldName === newName) {
            this.$.viewdialog.close();
            return;
        }

        if (this.$.viewdialog.querySelector('paper-input').invalid) {
            return;
        }

        const view = feezal.site.querySelector('[name="' + oldName + '"]');
        view.name = newName;
        this.editViewName = newName;
        this.$.viewdialog.querySelector('paper-input').value = newName;
        this.$.viewdialog.close();
        this.views = this.views.slice();
        setTimeout(() => {
            this.set('nav.view', newName);
        }, 0);
    }

    _editView(event) {
        const view = event.target.innerHTML;
        this.editViewName = view;
        this.$.viewdialog.querySelector('paper-input').value = view;
        this.$.viewdialog.positionTarget = event.target;
        this.$.viewdialog.open();
    }

    _nextView(name, number) {
        const n = name + (number || '');
        if (this.views.map(v => v.name).includes(n)) {
            return this._nextView(name, (number || 0) + 1);
        }

        return n;
    }

    _addView() {
        const element = document.createElement('feezal-view');
        const name = this._nextView('view', 1);
        element.setAttribute('name', name);
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.background = 'white';
        feezal.site.append(element);
        const currentView = feezal.site.querySelector('.iron-selected');
        if (currentView) {
            console.log(currentView);
            element.style.cssText = currentView.style.cssText;
        }

        this.set('nav.view', name);
        feezal.app.views = [...feezal.views];
    }
}

window.customElements.define('feezal-app-editor', FeezalAppEditor);

