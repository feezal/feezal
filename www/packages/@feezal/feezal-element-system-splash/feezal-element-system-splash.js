/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {loadLottie} from '@feezal/feezal-lottie';

/**
 * feezal-element-system-splash (E39)
 *
 * A FOUC / boot-jitter cover. Pseudo-element (System category): a placeholder
 * chip in the editor, a full-screen overlay in the viewer that hides once the
 * dashboard has settled into its initial state.
 *
 * The overlay hides once ALL of the following hold:
 *   1. the MQTT connection is established (`connected` on feezal.connection),
 *   2. the view's DOM is populated — implicit: this element's own
 *      connectedCallback has run, so its view is mounted, and
 *   3. a quiet window: no `message` has arrived for `settle-window` ms after
 *      connect. Broker-retained state arrives in a burst right after subscribe,
 *      so a short silence means the initial state is in. Every message resets
 *      the timer; when it expires the overlay fades out.
 *
 * Two backstops guarantee the splash never hangs (both use the same `timeout`):
 *   - a fallback armed from `connected` (messages may keep streaming forever),
 *   - a hard cap armed from element connect (the connection may never come up).
 *
 * Signals ride on feezal.connection's `connected` / `message` CustomEvents —
 * no MQTT subscription is taken, so the element never leaves a subscription
 * behind and adds zero broker traffic.
 *
 * The optional `lottie` boot animation rides on E89's shared lazy loader
 * (`@feezal/feezal-lottie`) — the ~250 kB lottie-web chunk is fetched only when
 * the `lottie` attribute is actually set, and only ONE such chunk exists for
 * the whole app (shared with basic-lottie). The animation is progressive
 * enhancement: it races the splash and NEVER blocks the hide conditions.
 */

const FADE_MS = 250;

// Place-once semantics: only the first splash instance to initialise in the
// viewer runs the overlay; later instances no-op and warn. Reset on disconnect
// of the owner so a re-placed splash (or test isolation) works cleanly.
let _splashOwner = null;

class FeezalElementSystemSplash extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Splash', category: 'System', color: '#455a64', icon: 'hourglass_empty'},
            description: 'Covers the viewer with a full-screen splash on first load until the MQTT ' +
                'connection is up and the retained-message burst has settled — prevents flash-of-' +
                'unstyled-content and boot jitter. Pseudo-element — position/size don\'t matter; place ' +
                'one per site. Optional logo, CSS spinner (after a delay) or a Lottie boot animation.',
            attributes: [
                {name: 'settle-window', type: 'number', default: 400, min: 0,
                    help: 'Milliseconds of MQTT silence (no message on any topic) after connect that count ' +
                        'as "settled". Retained state arrives in a burst right after subscribe; a short quiet ' +
                        'window means the initial values are in. Every message resets this timer.'},
                {name: 'timeout', type: 'number', default: 3, min: 0,
                    help: 'Fallback in seconds — a hard cap so the splash never hangs. Counts from connect ' +
                        '(in case messages keep streaming and the quiet window never opens) and, if the ' +
                        'connection never establishes, from page load.'},
                {name: 'spinner-delay', type: 'number', default: 1000, min: 0,
                    help: 'Milliseconds before the spinner appears. Fast loads see only a clean colour flash; ' +
                        'the spinner shows only if the wait exceeds this delay. Ignored when a Lottie ' +
                        'animation is set (that shows immediately and replaces the spinner).'},
                {name: 'logo', type: 'string', default: '',
                    help: 'Optional logo image URL (upload via the Asset Manager, e.g. assets/logo.png). ' +
                        'Centered above the spinner/animation, sized to ~40% width / ~30% height. ' +
                        'Empty = colour-only splash.'},
                {name: 'lottie', type: 'string', default: '',
                    help: 'Optional Lottie animation JSON URL (Asset Manager) shown instead of the spinner, ' +
                        'immediately (not after spinner-delay). May combine with a logo (logo above, ' +
                        'animation below). The lottie-web library is lazy-loaded — the chunk is fetched only ' +
                        'when this attribute is set, and shared with the Lottie element. Boot-timing caveat: ' +
                        'the chunk fetch races the splash — the colour/logo show instantly and the animation ' +
                        'pops in when it arrives; on fast loads the splash may hide before the animation ever ' +
                        'renders. The animation is progressive enhancement and never blocks the hide.'},
            ],
            styles: [
                {property: '--feezal-splash-background', type: 'color',
                    default: 'var(--primary-background-color, #fff)',
                    help: 'Solid background colour of the splash overlay (defaults to the theme background).'},
                {property: '--feezal-splash-spinner-color', type: 'color',
                    default: 'var(--primary-color, #0284c7)',
                    help: 'Colour of the CSS spinner (defaults to the theme primary colour).'},
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '140px', height: '40px'},
        };
    }

    static properties = {
        settleWindow: {type: Number, reflect: true, attribute: 'settle-window'},
        timeout:      {type: Number, reflect: true},
        spinnerDelay: {type: Number, reflect: true, attribute: 'spinner-delay'},
        logo:         {type: String, reflect: true},
        lottie:       {type: String, reflect: true},
        _fading:      {state: true},
        _done:        {state: true},
        _showSpinner: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; }

        /* Editor placeholder chip */
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; font-size: 11px; text-align: center;
            color: var(--secondary-text-color, #777);
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .ph .material-icons { font-size: 16px; }

        /* Viewer overlay — fixed positioning escapes the element's view box. */
        .overlay {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; align-items: center; justify-content: center;
            background: var(--feezal-splash-background, var(--primary-background-color, #fff));
            opacity: 1;
            transition: opacity ${FADE_MS}ms ease;
        }
        .overlay.fading { opacity: 0; }

        .content {
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px;
        }
        .logo { max-width: 40vw; max-height: 30vh; object-fit: contain; }
        .lottie-stage { width: 200px; height: 200px; }
        .lottie-stage svg { width: 100%; height: 100%; display: block; }

        .spinner {
            width: 40px; height: 40px; box-sizing: border-box; border-radius: 50%;
            border: 4px solid color-mix(in srgb,
                var(--feezal-splash-spinner-color, var(--primary-color, #0284c7)) 22%, transparent);
            border-top-color: var(--feezal-splash-spinner-color, var(--primary-color, #0284c7));
            animation: feezal-splash-spin 0.9s linear infinite;
        }
        @keyframes feezal-splash-spin { to { transform: rotate(360deg); } }

        @media (prefers-reduced-motion: reduce) {
            .spinner { animation-duration: 1.6s; }
            .overlay { transition-duration: 0ms; }
        }
    `];

    constructor() {
        super();
        this.settleWindow = 400;
        this.timeout = 3;
        this.spinnerDelay = 1000;
        this.logo = '';
        this.lottie = '';
        this._fading = false;
        this._done = false;
        this._showSpinner = false;

        // Non-reactive runtime state.
        this._secondary = false;      // this instance lost the place-once race
        this._connectedArmed = false; // connect handler already ran once
        this._hideStarted = false;
        this._quietTimer = null;
        this._fallbackTimer = null;
        this._hardCapTimer = null;
        this._spinnerTimer = null;
        this._fadeTimer = null;
        this._anim = null;
        this._lottieToken = 0;

        this._onConnected = this._onConnected.bind(this);
        this._onMessage = this._onMessage.bind(this);
    }

    // Pseudo-element: no MQTT subscription machinery (signals ride on events).
    _subscribe() { /* none */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) {
            return;   // editor: placeholder chip only, no overlay, no timers.
        }

        // Place-once: the first splash wins, the rest no-op with a warning.
        if (_splashOwner && _splashOwner !== this && _splashOwner.isConnected) {
            this._secondary = true;
            console.warn('feezal-element-system-splash: multiple splash elements present — ' +
                'only the first initialises; this one is inactive.');
            return;
        }
        _splashOwner = this;

        // Signal wiring — connected/message events on feezal.connection. The
        // connection is a real EventTarget in the viewer; test doubles may not
        // implement addEventListener, so guard (the backstop timer still hides).
        const conn = feezal.connection;
        if (conn && typeof conn.addEventListener === 'function') {
            conn.addEventListener('connected', this._onConnected);
            conn.addEventListener('message', this._onMessage);
            if (conn.connected) {
                this._onConnected();   // connection already up before we mounted
            }
        }

        // Hard cap from element connect — guarantees a hide even if the
        // connection never establishes (no `connected` event ever fires).
        this._hardCapTimer = setTimeout(() => this._hide(), this._timeoutMs());

        // Spinner appears only if the wait exceeds spinner-delay (and no Lottie).
        this._spinnerTimer = setTimeout(() => {
            if (!this._done && !this._hideStarted && !this.lottie) {
                this._showSpinner = true;
            }
        }, this._spinnerDelayMs());

        // Lottie is progressive enhancement — fire-and-forget, never blocks.
        if (this.lottie) {
            this._loadLottie();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._detachListeners();
        this._clearTimers();
        clearTimeout(this._fadeTimer);
        this._destroyLottie();
        if (_splashOwner === this) {
            _splashOwner = null;
        }
    }

    // ── Signal handlers ──────────────────────────────────────────────────────

    _onConnected() {
        if (this._done || this._hideStarted || this._connectedArmed) {
            return;
        }
        this._connectedArmed = true;
        // Fallback: cap the wait from connect in case messages never go quiet.
        this._fallbackTimer = setTimeout(() => this._hide(), this._timeoutMs());
        // Arm the quiet window; every subsequent message resets it.
        this._armQuiet();
    }

    _onMessage() {
        if (this._done || this._hideStarted || !this._connectedArmed) {
            return;
        }
        this._armQuiet();
    }

    _armQuiet() {
        clearTimeout(this._quietTimer);
        this._quietTimer = setTimeout(() => this._hide(), this._settleMs());
    }

    // ── Hide / fade ──────────────────────────────────────────────────────────

    _hide() {
        if (this._hideStarted || this._done) {
            return;
        }
        this._hideStarted = true;
        this._clearTimers();
        this._detachListeners();
        this._fading = true;
        this._fadeTimer = setTimeout(() => {
            this._done = true;
            this._destroyLottie();
        }, FADE_MS);
    }

    _clearTimers() {
        clearTimeout(this._quietTimer);
        clearTimeout(this._fallbackTimer);
        clearTimeout(this._hardCapTimer);
        clearTimeout(this._spinnerTimer);
    }

    _detachListeners() {
        const conn = feezal.connection;
        if (conn && typeof conn.removeEventListener === 'function') {
            conn.removeEventListener('connected', this._onConnected);
            conn.removeEventListener('message', this._onMessage);
        }
    }

    // ── Lottie (shared lazy loader) ──────────────────────────────────────────

    async _loadLottie() {
        const token = ++this._lottieToken;
        let lottie;
        try {
            lottie = await loadLottie();
        } catch {
            return;   // optional — a missing library never blocks the splash.
        }
        if (token !== this._lottieToken || !this.isConnected || this._done) {
            return;
        }
        await this.updateComplete;   // ensure the .lottie-stage container exists
        if (token !== this._lottieToken || !this.isConnected || this._done) {
            return;
        }
        const container = this.renderRoot?.querySelector('.lottie-stage');
        if (!container) {
            return;
        }
        const path = feezal.resolveAsset ? feezal.resolveAsset(this.lottie) : this.lottie;
        try {
            this._anim = lottie.loadAnimation({
                container, renderer: 'svg', loop: true, autoplay: true, path,
            });
        } catch { /* a broken animation must never throw or block the hide */ }
    }

    _destroyLottie() {
        if (this._anim) {
            try {
                this._anim.destroy();
            } catch { /* ignore */ }
            this._anim = null;
        }
    }

    // ── Numeric guards ───────────────────────────────────────────────────────

    _settleMs()      { return this._num(this.settleWindow, 400); }
    _timeoutMs()     { return this._num(this.timeout, 3) * 1000; }
    _spinnerDelayMs() { return this._num(this.spinnerDelay, 1000); }

    _num(v, def) {
        const n = Number(v);
        return (Number.isFinite(n) && n >= 0) ? n : def;
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="ph"><span class="material-icons">hourglass_empty</span> Splash</div>`;
        }
        if (this._secondary || this._done) {
            return html``;
        }
        const logoSrc = this.logo
            ? (feezal.resolveAsset ? feezal.resolveAsset(this.logo) : this.logo)
            : '';
        return html`
            <div class="overlay ${this._fading ? 'fading' : ''}">
                <div class="content">
                    ${logoSrc ? html`<img class="logo" src=${logoSrc} alt="">` : ''}
                    ${this.lottie
                        ? html`<div class="lottie-stage"></div>`
                        : (this._showSpinner ? html`<div class="spinner"></div>` : '')}
                </div>
            </div>`;
    }
}

customElements.define('feezal-element-system-splash', FeezalElementSystemSplash);
export {FeezalElementSystemSplash};
