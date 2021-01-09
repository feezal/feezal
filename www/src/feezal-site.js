import {PolymerElement, html} from '@polymer/polymer/polymer-element';
import '@polymer/iron-pages';

class FeezalSite extends PolymerElement {
    static get properties() {
        return {
            view: {
                type: String,
                observer: '_viewChanged',
                reflectToAttribute: true,
                notify: true
            },
            views: {
                type: Array,
                notify: true
            },
            viewRole: {
                type: String,
                reflectToAttribute: true
            },
            childPosition: {
                type: String,
                reflectToAttribute: true
            },

            persistant: {
                type: Boolean,
                reflectToAttribute: true,
                value: false
            },
            pageTitle: {
                type: String,
                reflectToAttribute: true
            },
            subscribeTopic: {
                type: String,
                reflectToAttribute: true
            },
            publishTopic: {
                type: String,
                reflectToAttribute: true
            }

        };
    }

    static get feezal() {
        return {
            styles: [
                '--primary-text-color',
                '--primary-background-color',
                '--secondary-text-color',
                '--disabled-text-color',
                '--divider-color',
                '--error-color'
            ]
        };
    }

    static get template() {
        return html`
            <style>
                iron-pages {
                    display: flex;
                    width: 100%;
                    height: 100%;
                    overflow: scroll;
                    padding: 0;
                    margin: 0;
                    background-color: grey;
                }
                feezal-view {
                    margin: var(--feezal-view-margin);
                }
                
                :host(.dark) {
                    --primary-background-color: black
                }
                    
                
                
            </style>
            <iron-pages id="pages" attr-for-selected="name" selected="[[view]]" items="{{views}}">
                <slot></slot>
            </iron-pages>
        `;
    }

    connectedCallback() {
        super.connectedCallback();

        if (feezal.app.nav && feezal.app.nav.view) {
            this.view = feezal.app.nav.view;
        } else {
            this.view = feezal.views[0].getAttribute('name');
            location.hash = '/' + this.view;
        }

        if (!feezal.isEditor && this.subscribeTopic) {
            feezal.connection.subscribe(this.subscribeTopic + '/view', message => {
                this.view = message.payload;
            });
            feezal.connection.subscribe(this.subscribeTopic + '/reload', message => {
                window.location.reload();
            });
        }

        if (this.title) {
            document.querySelector('title').innerHTML = this.pageTitle;
        }
    }

    get currentView() {
        return this.$.pages.shadowRoot.selectedItem;
    }

    _viewChanged(e) {
        // Console.log('view._viewChanged', e);
        this.updateVisibility();
        if (!feezal.isEditor && this.publishTopic) {
            feezal.connection.publish(this.publishTopic + '/view', this.view);
        }

        if (!feezal.isEditor && this.subscribeTopic) {
            feezal.connection.subscribe(this.subscribeTopic + '/view', message => {
                location.hash = '/' + message.payload;
            });
            feezal.connection.subscribe(this.subscribeTopic + '/addclass', message => {
                this.classList.add(message.payload);
            });
            feezal.connection.subscribe(this.subscribeTopic + '/removeclass', message => {
                this.classList.remove(message.payload);
            });
        }
    }

    updateVisibility() {
        const views = [...feezal.views];
        views.forEach(v => {
            const name = v.getAttribute('name');
            v.visible = name === this.view;
        });
    }
}

window.customElements.define('feezal-site', FeezalSite);
