import {LitElement, html, css} from 'lit';

/**
 * feezal-site
 *
 * Top-level site container. Manages which feezal-view is currently visible.
 * Replaces the Polymer/iron-pages implementation.
 */
class FeezalSite extends LitElement {
    static properties = {
        view: {type: String, reflect: true},
        persistant: {type: Boolean, reflect: true},
        pageTitle: {type: String, attribute: 'page-title', reflect: true},
        subscribe: {type: String, attribute: 'subscribe', reflect: true},
        publish: {type: String, attribute: 'publish', reflect: true}
    };

    static styles = css`
        :host {
            display: flex;
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 0;
            margin: 0;
            /* background synced at runtime to the current view's background;
               background-attachment:local extends the color across the full
               scrollable canvas area (beyond the view's explicit dimensions). */
            background: var(--feezal-canvas-bg, grey);
            background-attachment: local;
            /* Standard scrollbar-color (Chrome 121+, Firefox): thumb over canvas bg.
               When set, Chrome ignores ::-webkit-scrollbar pseudo-element rules,
               so the feezal-site rules in the global stylesheet take over instead. */
            scrollbar-color: rgba(128,128,128,0.5) var(--feezal-canvas-bg, grey);
            scrollbar-width: thin;
        }
        feezal-view {
            margin: var(--feezal-view-margin);
        }
        :host(.dark) {
            --primary-background-color: black;
        }
    `;

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

    render() {
        return html`<slot></slot>`;
    }

    connectedCallback() {
        super.connectedCallback();

        if (feezal.app.nav && feezal.app.nav.view) {
            this.view = feezal.app.nav.view;
        } else {
            this.view = feezal.views[0].getAttribute('name');
            location.hash = '/' + this.view;
        }

        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe + '/view', message => {
                this.view = message.payload;
            });
            feezal.connection.sub(this.subscribe + '/reload', () => {
                window.location.reload();
            });
        }

        if (this.pageTitle) {
            document.querySelector('title').innerHTML = this.pageTitle;
        }
    }

    updated(changed) {
        if (changed.has('view')) {
            this._viewChanged(this.view);
        }
    }

    _viewChanged(view) {
        this.updateVisibility();
        this._syncViewBackground();

        if (!feezal.isEditor && this.publish) {
            feezal.connection.pub(this.publish + '/view', view);
        }

        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe + '/addclass', message => {
                this.classList.add(message.payload);
            });
            feezal.connection.sub(this.subscribe + '/removeclass', message => {
                this.classList.remove(message.payload);
            });
        }
    }

    updateVisibility() {
        [...feezal.views].forEach(v => {
            v.visible = v.getAttribute('name') === this.view;
        });
    }

    _syncViewBackground() {
        if (this._bgObserver) {
            this._bgObserver.disconnect();
            this._bgObserver = null;
        }
        const currentView = [...feezal.views].find(v => v.getAttribute('name') === this.view);
        if (!currentView) return;
        const sync = () => {
            const bg = currentView.style.background || currentView.style.backgroundColor || '';
            if (bg) {
                this.style.setProperty('--feezal-canvas-bg', bg);
            } else {
                this.style.removeProperty('--feezal-canvas-bg');
            }
        };
        sync();
        this._bgObserver = new MutationObserver(sync);
        this._bgObserver.observe(currentView, {attributes: true, attributeFilter: ['style']});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._bgObserver) {
            this._bgObserver.disconnect();
            this._bgObserver = null;
        }
    }
}

window.customElements.define('feezal-site', FeezalSite);
