import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/iron-pages/iron-pages';
import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';
import '@polymer/paper-input/paper-input';

class FeezalSidebarEditor extends PolymerElement {
    static get properties() {
        return {
            gridSize: {
                type: Number,
                value: 24,
                reflectToAttribute: true,
                notify: true
            },
            gridVisible: {
                type: Boolean,
                value: false,
                reflectToAttribute: true,
                notify: true
            },
            snapping: {
                type: String,
                value: 'off',
                reflectToAttribute: true,
                notify: true
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
                    margin: 12px;
                    overflow: scroll;
                }
                paper-tabs {
                    --paper-tabs-selection-bar-color: var(--paper-indigo-700);
              
                    background-color: #eee;
                }
                paper-tab {
                    --paper-tab-ink: gray;
                }
            </style>
            <div class="paper-form" id="editor-form">
                <div>
                    <paper-dropdown-menu label="snapping" value="{{snapping}}" style="width: 100%">
                        <paper-listbox slot="dropdown-content">
                            <paper-item>off</paper-item>
                            <paper-item>elements</paper-item>
                            <paper-item>grid</paper-item>
                        </paper-listbox>
                    </paper-dropdown-menu>
                </div>
                <div>
                    <paper-input style="display: inline-block; width: calc(50% - 6px)" type="number" label="grid size" value="{{gridSize}}"></paper-input>
                    <paper-checkbox style="margin-left: 6px; font-size: 15px; height: 31px; width: calc(50% - 6px); vertical-align: bottom;" checked="{{gridVisible}}">Show Grid</paper-checkbox>
                </div>
            </div>    
        `;
    }
}

window.customElements.define('feezal-sidebar-editor', FeezalSidebarEditor);
