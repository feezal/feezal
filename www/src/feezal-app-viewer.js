import {PolymerElement, html} from '@polymer/polymer/polymer-element';

import '@polymer/app-route/app-location.js';
import '@polymer/app-route/app-route.js';

import './feezal-site';
import './feezal-view';

class FeezalAppViewer extends PolymerElement {
    static get properties() {
        return {
            route: {
                type: Object
            },
            nav: {
                type: Object,
                notify: true,
                observer: '_navChanged'
            },
            views: {
                type: Array
            }
        };
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
                    height: 100%;
        
                }
        
                #container-view {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    padding: 0;
                    
                 
                }
                
                feezal-view {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    padding: 0;
                }
            </style>
            <app-location route="{{route}}" use-hash-as-path></app-location>
            <app-route
                route="{{route}}"
                pattern="/:view"
                data="{{nav}}">
            </app-route>
            
            
            
            <div id="container">
                <div id="container-view">
                    <slot></slot>
                </div>
            </div>
            

        `;
    }

    connectedCallback() {
        super.connectedCallback();
        const firstView = feezal.views[0].name;
        console.log(this.nav.view, feezal.views, firstView);
        if (!this.nav.view) {
            location.hash = '/' + firstView;
        }
    }

    _navChanged(d) {
        if (feezal.site) {
            feezal.site.view = d.view;
        }
    }
}

window.customElements.define('feezal-app-viewer', FeezalAppViewer);

