import {PolymerElement, html} from '@polymer/polymer/polymer-element';
import {camelToDashCase} from '@polymer/polymer/lib/utils/case-map.js';

import '@polymer/iron-pages/iron-pages';
import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tabs/paper-tab';
import '@polymer/paper-input/paper-input';
import '@polymer/paper-dropdown-menu/paper-dropdown-menu';
import '@polymer/paper-item/paper-item';

class FeezalSidebarViewer extends PolymerElement {
    static get properties() {
        return {
            tab: {
                type: Number,
                value: 0
            },
            connection: {
                type: Object
            },
            site: {
                type: Object,
                value: {
                    name: feezal.siteName
                }
            }
        };
    }

    static get observers() {
        return [
            '_connectionChanged(connection.*)',
            '_siteChanged(site.*)'
        ];
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
            <paper-tabs selected="{{tab}}" >
                <paper-tab>Connection</paper-tab>
                <paper-tab>Site</paper-tab>
            </paper-tabs>
            
            <iron-pages selected="{{tab}}">
                <div class="paper-form">
                    
                    <paper-dropdown-menu label="Backend" value="{{connection.backend}}">
                        <paper-listbox slot="dropdown-content">
                            <paper-item>node-red</paper-item>
                            <paper-item>mqtt</paper-item>
                        </paper-listbox>
                    </paper-dropdown-menu>
                    
                    <div class="feezal-connection" id="node-red">
                    </div>
                    
                    <div class="feezal-connection" id="mqtt">
                        <paper-input value="{{connection.uri}}" label="Broker URI"></paper-input>
                        <!--
                        <paper-input value="{{connection.user}}" label="User"></paper-input>
                        <paper-input value="{{connection.password}}" label="Password"></paper-input>
                        -->
                        <paper-input value="{{connection.clientId}}" label="Client ID"></paper-input>
                        <paper-input value="{{connection.lwt}}" label="Last Will Topic"></paper-input>
                        <paper-input value="{{connection.lwp}}" label="Last Will Payload"></paper-input>
                        <paper-input value="{{connection.oct}}" label="Connect Topic"></paper-input>
                        <paper-input value="{{connection.ocp}}" label="Connect Payload"></paper-input>
                    </div>
                
                </div>
                
                <div class="paper-form">
                    <paper-input value="{{site.name}}" label="name" disabled></paper-input>
                    <paper-input value="{{site.pageTitle}}" label="title"></paper-input>
                    <paper-input value="{{site.subscribeTopic}}" label="subscribe-topic"></paper-input>
                    <paper-input value="{{site.publishTopic}}" label="publish-topic"></paper-input>
                </div>
            </iron-pages>
        `;
    }

    constructor() {
        super();
        this.connection = {};
    }

    _siteChanged() {
        feezal.app.change(true);
        if (feezal.site) {
            for (let [key, value] of Object.entries(this.site)) {
                key = camelToDashCase(key);
                if (value === false) {
                    this.site.removeAttribute(key);
                } else if (value === true) {
                    this.site.setAttribute(key, key);
                } else {
                    feezal.site.setAttribute(key, value);
                }
            }
        }
    }

    _connectionChanged() {
        this.$.mqtt.style.display = this.connection.backend === 'mqtt' ? 'block' : 'none';
        feezal.app.change(true);
    }
}

window.customElements.define('feezal-sidebar-viewer', FeezalSidebarViewer);
