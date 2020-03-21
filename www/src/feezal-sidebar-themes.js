import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/paper-dropdown-menu/paper-dropdown-menu';
import '@polymer/paper-item/paper-item';

class FeezalSidebarThemes extends PolymerElement {
    static get properties() {
        return {
            currentTheme: {
                type: String,
                value: 'default',
                observer: '_currentThemeChanged'
            },
            themes: {
                type: Array
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
                 <paper-dropdown-menu label="Theme" value="{{currentTheme}}">
                    <paper-listbox slot="dropdown-content">
                        <template is="dom-repeat" items="[[themes]]">
                            <paper-item>[[item]]</paper-item>
                        </template>
                    </paper-listbox>
                 </paper-dropdown-menu>
               
            </div>

        `;
    }

    connectedCallback() {
        super.connectedCallback();
        this.themes = ['default', ...feezal.themes];
    }

    _currentThemeChanged(val) {
        if (feezal.ready) {
            const classes = feezal.site.className.split(" ").filter(c => !c.startsWith('feezal-theme-'));
            feezal.site.className = (val === 'default' ? classes : [val, ...classes]).join(' ').trim();
        }
    }

    siteReady() {
        const match = feezal.site.className.match(/(feezal-theme-[^\s]+)/);
        if (match) {
            this.currentTheme = match[1];
        }
    }
}

window.customElements.define('feezal-sidebar-themes', FeezalSidebarThemes);
