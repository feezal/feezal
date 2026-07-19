// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
import {LitElement, html, css} from 'lit';
import {viewPathFromHash} from './hash-view.js';

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
        publish: {type: String, attribute: 'publish', reflect: true},
        // N26 — view playlist / signage rotation. All reflected so the config
        // travels with the serialized site HTML (live viewer AND static export).
        playlist: {type: String, reflect: true},
        playlistEnabled: {type: Boolean, attribute: 'playlist-enabled', reflect: true},
        playlistDwell: {type: Number, attribute: 'playlist-dwell', reflect: true},
        playlistResume: {type: Number, attribute: 'playlist-resume', reflect: true},
        playlistTransition: {type: String, attribute: 'playlist-transition', reflect: true}
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
        /* Editor only (the viewer host gets the .feezal-viewer class): a
           theme-aware checkerboard fills the canvas so the area OUTSIDE a
           fixed-size view's width/height reads as "outside the view". The view
           element paints its own background on top, covering its own area. */
        :host(:not(.feezal-viewer)) {
            background-color: var(--secondary-background-color, #2a2a2e);
            background-image: repeating-conic-gradient(rgba(128,128,128,0.16) 0% 25%, transparent 0% 50%);
            background-size: 24px 24px;
            background-position: 0 0;
            background-attachment: local;
        }
        :host(.dark) {
            --primary-background-color: black;
        }
        /* N26 — optional fade on view switches. Views toggle display, and a
           none→block transition restarts the animation. Viewer-only: the
           feezal-viewer class is added in connectedCallback outside the editor. */
        :host(.feezal-viewer[playlist-transition="fade"]) ::slotted(feezal-view) {
            animation: feezal-view-fade-in 0.5s ease;
        }
        @keyframes feezal-view-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
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

    constructor() {
        super();
        this.playlist = '';
        this.playlistEnabled = false;
        this.playlistDwell = 10;
        this.playlistResume = 60;
        this.playlistTransition = 'none';
        // N30 — registered "view routers" (layout-app shells that embed and
        // swap sub-views). Empty on a plain site → every code path below
        // reduces to the pre-N30 single-level behaviour.
        this._routers = new Set();
        this._pendingEmbedded = null;
    }

    // ── N30: layout-app view-router integration ──────────────────────────────
    // A layout-app registers itself so the site's active-view contract (hash,
    // <publish>/view, inbound <subscribe>/view) covers the sub-view it shows.
    // Router interface (duck-typed): routableViews():string[],
    // routeToEmbedded(name):void, activeEmbedded():string|null.

    registerViewRouter(el) {
        this._routers.add(el);
        // A router that mounts after the initial view may be the target of a
        // pending deep-link (#/view/embedded) — try to apply it now.
        this._applyPendingEmbedded();
    }

    unregisterViewRouter(el) {
        this._routers.delete(el);
    }

    /** Routers whose containing view is the active top-level view. */
    _visibleRouters() {
        return [...this._routers].filter(r =>
            r.isConnected && r.closest('feezal-view')?.getAttribute('name') === this.view);
    }

    /** The full active-view path: `view` or `view/embedded` when a visible router shows a sub-view. */
    _currentViewPath() {
        const emb = this._visibleRouters()[0]?.activeEmbedded?.();
        return emb ? `${this.view}/${emb}` : this.view;
    }

    /** Route a pending deep-link/inbound embedded view into the visible router (once it exists). */
    _applyPendingEmbedded() {
        if (!this._pendingEmbedded) return;
        const emb = this._pendingEmbedded;
        const router = this._visibleRouters().find(r => r.routableViews?.().includes(emb));
        if (!router) return;                 // router not ready yet — keep pending
        this._pendingEmbedded = null;
        router.routeToEmbedded?.(emb);       // programmatic: site drives the sync below
    }

    /**
     * A visible router's sub-view changed (user picked a drawer entry) — resync
     * the hash and republish the full path. Called by the layout-app.
     */
    notifyRouterView(el) {
        if (feezal.isEditor || !this._visibleRouters().includes(el)) return;
        this._syncPathHashAndPublish();
    }

    /** Write the address-bar hash + publish `<publish>/view` for the current full path. */
    _syncPathHashAndPublish() {
        const path = this._currentViewPath();
        const cur = viewPathFromHash();
        const curPath = cur.embedded ? `${cur.view}/${cur.embedded}` : cur.view;
        if (curPath !== path) {
            location.hash = '/' + path;
        }
        if (this.publish) {
            feezal.connection.pub(this.publish + '/view', path);
        }
    }

    render() {
        return html`<slot></slot>`;
    }

    connectedCallback() {
        super.connectedCallback();

        // Read initial view from URL hash. feezal-app-editor also derives
        // its nav.view from the hash, so this is equivalent for both contexts
        // and works correctly in the viewer where feezal.app.nav doesn't exist.
        const {view: hashView, embedded} = viewPathFromHash();
        if (hashView) {
            // N30: a deep-link #/view/embedded stashes the embedded view; it is
            // routed into the layout-app once it registers (order-independent).
            this._pendingEmbedded = embedded;
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
            // Site-wide control topics — every running viewer instance obeys
            // them. N24 additionally mirrors the same command set per client
            // under <subscribe>/clients/<id>/… (see feezal-presence.js); both
            // paths route through applyControlCommand().
            for (const cmd of ['view', 'reload', 'theme', 'playlist', 'addclass', 'removeclass']) {
                feezal.connection.sub(this.subscribe + '/' + cmd, message => {
                    this.applyControlCommand(cmd, message.payload);
                });
            }
        }

        if (!feezal.isEditor) {
            // N26 — playlist / signage rotation (viewer only, purely client-side:
            // works identically in the live viewer and in static exports).
            this.classList.add('feezal-viewer');
            this._playlistOn = this.playlistEnabled;
            this._playlistActivity = () => this._playlistUserActivity();
            for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
                window.addEventListener(type, this._playlistActivity, {passive: true});
            }

            this._playlistArm();
        }

        if (this.pageTitle) {
            document.querySelector('title').innerHTML = this.pageTitle;
        }
    }

    // ── N26: view playlist / signage rotation ────────────────────────────────

    /** Parse the playlist attribute (`name` or `name:seconds`, comma-separated) into existing views. */
    _playlistEntries() {
        const names = new Set([...feezal.views].map(v => v.getAttribute('name')));
        return String(this.playlist || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(entry => {
                const match = entry.match(/^(.*?)(?::(\d+))?$/);
                return {name: match[1].trim(), dwell: match[2] ? Number(match[2]) : null};
            })
            .filter(e => names.has(e.name));
    }

    /** Schedule the next rotation step (dwell of the current entry, else the default). */
    _playlistArm() {
        clearTimeout(this._playlistTimer);
        this._playlistTimer = null;
        if (feezal.isEditor || !this._playlistOn || this._playlistResumeTimer) {
            return;
        }

        const entries = this._playlistEntries();
        if (entries.length < 2) {
            return;
        }

        const current = entries.find(e => e.name === this.view);
        const dwell = (current?.dwell || this.playlistDwell || 10) * 1000;
        this._playlistTimer = setTimeout(() => this._playlistAdvance(1), dwell);
    }

    /** Switch to the next/previous playlist entry and re-arm the timer. */
    _playlistAdvance(direction) {
        const entries = this._playlistEntries();
        if (entries.length === 0) {
            return;
        }

        const idx = entries.findIndex(e => e.name === this.view);
        const next = (idx + direction + entries.length) % entries.length;
        const target = entries[next].name;
        if (target !== this.view) {
            this._playlistSwitching = true;
            this.view = target;
        }

        this._playlistArm();
    }

    /**
     * Any user interaction (or a direct view command / navigation element)
     * pauses rotation; it resumes after the configured idle timeout. Repeated
     * activity keeps re-arming the resume timer.
     */
    _playlistUserActivity() {
        if (feezal.isEditor || !this._playlistOn) {
            return;
        }

        clearTimeout(this._playlistTimer);
        this._playlistTimer = null;
        clearTimeout(this._playlistResumeTimer);
        this._playlistResumeTimer = setTimeout(() => {
            this._playlistResumeTimer = null;
            this._playlistAdvance(1);
        }, (this.playlistResume || 60) * 1000);
    }

    /**
     * Apply one site control command — shared by the site-wide control topics
     * (<subscribe>/<cmd>, all instances) and the N24 per-client variants
     * (<subscribe>/clients/<id>/<cmd>, one instance).
     */
    applyControlCommand(cmd, payload) {
        switch (cmd) {
            case 'view':
                this._applyViewCommand(String(payload ?? ''));
                break;
            case 'reload':
                window.location.reload();
                break;
            case 'theme': {
                const raw = String(payload || '').trim();
                // Accept either the full class name (feezal-theme-dark-mint) or just the suffix (dark-mint).
                const cls = raw.startsWith('feezal-theme-') ? raw : 'feezal-theme-' + raw;
                // Swap the theme class on the site element too, not just body: the
                // deployed HTML bakes the active theme class onto <feezal-site>,
                // and custom properties set directly on it would override the
                // ones inherited from the new body class.
                for (const el of [document.body, this]) {
                    [...el.classList]
                        .filter(c => c.startsWith('feezal-theme-'))
                        .forEach(c => el.classList.remove(c));
                    el.classList.add(cls);
                }

                break;
            }
            case 'playlist':
                this._playlistCommand(String(payload ?? '').trim().toLowerCase());
                break;
            case 'addclass':
                this.classList.add(payload);
                break;
            case 'removeclass':
                this.classList.remove(payload);
                break;
            // unknown commands are ignored
        }
    }

    /**
     * N30: apply an inbound `view` command. Accepts a bare view name or the
     * nested `view/embedded` form. A bare name is offered to the visible
     * router FIRST (so `page2` swaps inside the shell instead of dumping the
     * user onto a raw top-level view); only if no visible router hosts it does
     * the site switch top-level as before. On a plain site (no routers) this is
     * exactly `this.view = payload`.
     */
    _applyViewCommand(raw) {
        const slash = raw.indexOf('/');
        if (slash >= 0) {
            const top = raw.slice(0, slash);
            this._pendingEmbedded = raw.slice(slash + 1) || null;
            if (this.view !== top) this.view = top;   // _viewChanged applies the embedded
            else this._applyPendingEmbedded();
            return;
        }
        const router = this._visibleRouters().find(r => r.routableViews?.().includes(raw));
        if (router) {
            router.routeToEmbedded?.(raw);
            this._syncPathHashAndPublish();
            return;
        }
        this._pendingEmbedded = null;
        this.view = raw;
    }

    /** `<site>/playlist` control commands: on / off / pause / next / prev. */
    _playlistCommand(cmd) {
        switch (cmd) {
            case 'on':
                this._playlistOn = true;
                clearTimeout(this._playlistResumeTimer);
                this._playlistResumeTimer = null;
                this._playlistArm();
                break;
            case 'off':
                this._playlistOn = false;
                clearTimeout(this._playlistTimer);
                clearTimeout(this._playlistResumeTimer);
                this._playlistTimer = this._playlistResumeTimer = null;
                break;
            case 'pause':
                this._playlistUserActivity();
                break;
            case 'next':
                this._playlistAdvance(1);
                break;
            case 'prev':
                this._playlistAdvance(-1);
                break;
            // unknown payloads are ignored
        }
    }

    updated(changed) {
        if (changed.has('view')) {
            this._viewChanged(this.view);
            // N26: a view switch not initiated by the playlist itself (MQTT view
            // command, navigation element, swipe) counts as user activity — the
            // rotation pauses and resumes after the idle timeout. The initial
            // view assignment (old value undefined) is not a switch.
            if (!feezal.isEditor && changed.get('view') !== undefined) {
                if (this._playlistSwitching) {
                    this._playlistSwitching = false;
                } else {
                    this._playlistUserActivity();
                }
            }
        }
    }

    _viewChanged(view) {
        this.updateVisibility();
        this._syncViewBackground();
        // N30: a top-level switch to a shell view applies any pending deep-link
        // /inbound embedded view into that view's router before we sync.
        this._applyPendingEmbedded();

        if (!feezal.isEditor) {
            // Keep the address-bar hash in sync + publish `<publish>/view`.
            // On a plain view this is `view`; on a shell view it is
            // `view/embedded` (N30). Compare decoded (B30): the browser
            // percent-encodes umlauts, so a raw comparison would re-write the
            // hash on every switch.
            this._syncPathHashAndPublish();
        }
        // (addclass/removeclass moved to connectedCallback with the other
        // control topics — subscribing here re-subscribed them on EVERY view
        // change, leaking one subscription pair per switch.)
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

        clearTimeout(this._playlistTimer);
        clearTimeout(this._playlistResumeTimer);
        this._playlistTimer = this._playlistResumeTimer = null;
        if (this._playlistActivity) {
            for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
                window.removeEventListener(type, this._playlistActivity);
            }

            this._playlistActivity = null;
        }
    }
}

window.customElements.define('feezal-site', FeezalSite);
