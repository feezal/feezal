// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
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
            /* Safe-area insets (iOS notch/dynamic island/home indicator with
               viewport-fit=cover): the site's own background paints the inset
               strips while the views stay clear of the system UI. 0 on
               devices without insets, so desktop/editor are unaffected. */
            padding: env(safe-area-inset-top) env(safe-area-inset-right)
                     env(safe-area-inset-bottom) env(safe-area-inset-left);
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

        // Read initial view from URL hash. feezal-app-editor also derives
        // its nav.view from the hash, so this is equivalent for both contexts
        // and works correctly in the viewer where feezal.app.nav doesn't exist.
        const hashView = location.hash.replace(/^#\/?/, '');
        if (hashView) {
            this.view = hashView;
        } else {
            this.view = feezal.views[0].getAttribute('name');
            location.hash = '/' + this.view;
        }

        if (!feezal.isEditor) {
            // Mirror the initial theme class (injected by the server into feezal-site)
            // to document.body so that portals appended to body inherit the CSS vars.
            [...this.classList]
                .filter(c => c.startsWith('feezal-theme-'))
                .forEach(c => document.body.classList.add(c));
        }

        if (!feezal.isEditor && this.subscribe) {
            feezal.connection.sub(this.subscribe + '/view', message => {
                this.view = message.payload;
            });
            feezal.connection.sub(this.subscribe + '/reload', () => {
                window.location.reload();
            });
            feezal.connection.sub(this.subscribe + '/theme', message => {
                const raw = String(message.payload || '').trim();
                // Accept either the full class name (feezal-theme-dark-mint) or just the suffix (dark-mint).
                const cls = raw.startsWith('feezal-theme-') ? raw : 'feezal-theme-' + raw;
                // Remove all currently active theme classes, then apply the new one.
                [...document.body.classList]
                    .filter(c => c.startsWith('feezal-theme-'))
                    .forEach(c => document.body.classList.remove(c));
                document.body.classList.add(cls);
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

        if (!feezal.isEditor) {
            // Keep the address-bar hash in sync regardless of what triggered the
            // view change (MQTT message, navigation element, or initial load).
            const expectedHash = '#/' + view;
            if (location.hash !== expectedHash) {
                location.hash = expectedHash;
            }
        }

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

            // Viewer: mirror the view background to the document so the iOS
            // status-bar area (black-translucent + viewport-fit=cover) and
            // overscroll bounce show the view's colour instead of white.
            if (!feezal.isEditor) {
                document.documentElement.style.background = bg;
                document.body.style.background = bg;
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
