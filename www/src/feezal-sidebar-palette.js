import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/iron-pages/iron-pages';
import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';
import '@polymer/paper-input/paper-input';

class FeezalSidebarPalette extends PolymerElement {
    static get properties() {
        return {

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
               
            </div>    
        `;
    }
}

window.customElements.define('feezal-sidebar-palette', FeezalSidebarPalette);
