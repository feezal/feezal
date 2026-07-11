/* global feezal */
import {LitElement, html, css} from 'lit';

/**
 * feezal-element-system-connection-status
 *
 * Pseudo-element: in the editor it renders as a labelled placeholder.
 * In the viewer it renders a disconnection overlay anchored to the viewport
 * (position:fixed inside shadow DOM, which is always viewport-relative).
 *
 * Subscribes to feezal-connection lifecycle events, not to any MQTT topic.
 * The overlay disappears automatically when the connection is restored.
 */
class FeezalElementSystemConnectionStatus extends LitElement {
    static get feezal() {
        return {
            palette: {
                name: 'Connection Status',
                category: 'System',
                color: '#455a64'
            },
            description: 'Shows an overlay (banner or dialog) when the MQTT connection is lost. ' +
                'Does nothing while the broker is reachable. ' +
                'Position and size on the canvas are irrelevant — the overlay is always anchored to the viewport.',
            links: [
                {label: 'MQTT connection troubleshooting', url: 'https://mosquitto.org/documentation/'},
            ],
            attributes: [
                {name: 'display',           type: 'select',  options: ['banner', 'dialog'], default: 'banner',             label: 'Display style'},
                {name: 'position',          type: 'select',  options: ['top', 'bottom'],    default: 'top',                label: 'Banner position'},
                {name: 'backdrop',          type: 'boolean',                               default: false,                label: 'Show backdrop'},
                {name: 'backdrop-opacity',  type: 'number',                                default: 0.5,                  label: 'Backdrop opacity (0–1)'},
                {name: 'backdrop-color',    type: 'color',                                 default: '#000000',             label: 'Backdrop color'},
                {name: 'block-interaction', type: 'boolean',                               default: true,                 label: 'Block dashboard interaction'},
                {name: 'title',             type: 'string',                                default: 'Connection lost',     label: 'Title'},
                {name: 'message',           type: 'string',                                default: 'Reconnecting\u2026', label: 'Message ({countdown} = elapsed seconds)'},
                {name: 'show-countdown',    type: 'boolean',                               default: true,                 label: 'Show elapsed-time countdown'},
                {name: 'animate',           type: 'select',  options: ['none', 'fade', 'slide'], default: 'fade',         label: 'Entry animation'}
            ]
        };
    }

    static properties = {
        display:            {type: String,  reflect: true},
        position:           {type: String,  reflect: true},
        backdrop:           {type: Boolean, reflect: true},
        backdropOpacity:    {type: Number,  reflect: true, attribute: 'backdrop-opacity'},
        backdropColor:      {type: String,  reflect: true, attribute: 'backdrop-color'},
        blockInteraction:   {type: Boolean, reflect: true, attribute: 'block-interaction'},
        title:              {type: String,  reflect: true},
        message:            {type: String,  reflect: true},
        showCountdown:      {type: Boolean, reflect: true, attribute: 'show-countdown'},
        animate:            {type: String,  reflect: true},
        _disconnected:      {state: true},
        _elapsed:           {state: true}
    };

    static styles = css`
        :host {
            display: block;
            overflow: visible;
        }

        /* ── Editor placeholder ── */
        .editor-placeholder {
            width: 100%;
            height: 100%;
            min-width: 120px;
            min-height: 36px;
            border: 2px dashed #455a64;
            background: #eceff1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 12px;
            color: #455a64;
            box-sizing: border-box;
            user-select: none;
        }
        .editor-placeholder .icon {
            font-family: 'Material Icons';
            font-size: 18px;
            font-style: normal;
        }

        /* ── Viewer overlay ── */

        /* Backdrop: full-viewport semi-transparent layer */
        .backdrop {
            position: fixed;
            inset: 0;
            z-index: 9998;
        }

        /* Banner: strip at top or bottom of viewport */
        .banner {
            position: fixed;
            left: 0;
            right: 0;
            z-index: 9999;
            background: #c62828;
            color: #fff;
            padding: 10px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            font-family: 'Roboto', sans-serif;
        }
        .banner.top    { top: 0; }
        .banner.bottom { bottom: 0; }

        /* Dialog: centred card */
        .dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: #c62828;
            color: #fff;
            padding: 24px 32px;
            border-radius: 8px;
            min-width: 260px;
            text-align: center;
            font-family: 'Roboto', sans-serif;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .overlay-title {
            font-weight: 600;
            font-size: 15px;
        }
        .overlay-message {
            font-size: 13px;
            opacity: 0.88;
            margin-top: 4px;
        }

        /* Animations */
        :host([animate="fade"]) .banner,
        :host([animate="fade"]) .dialog {
            animation: feezal-cs-fade 0.3s ease forwards;
        }
        :host([animate="slide"]) .banner.top {
            animation: feezal-cs-slide-down 0.3s ease forwards;
        }
        :host([animate="slide"]) .banner.bottom {
            animation: feezal-cs-slide-up 0.3s ease forwards;
        }
        :host([animate="slide"]) .dialog {
            animation: feezal-cs-fade 0.3s ease forwards;
        }

        @keyframes feezal-cs-fade       { from { opacity: 0; } to { opacity: 1; } }
        @keyframes feezal-cs-slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes feezal-cs-slide-up   { from { transform: translateY(100%);  } to { transform: translateY(0); } }
    `;

    constructor() {
        super();
        this.display          = 'banner';
        this.position         = 'top';
        this.backdrop         = false;
        this.backdropOpacity  = 0.5;
        this.backdropColor    = '#000000';
        this.blockInteraction = true;
        this.title            = 'Connection lost';
        this.message          = 'Reconnecting\u2026';
        this.showCountdown    = true;
        this.animate          = 'fade';
        this._disconnected    = false;
        this._elapsed         = 0;
        this._ticker          = null;
        this._showTimer       = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._onConnected    = () => this._handleConnected();
        this._onDisconnected = () => this._handleDisconnected();

        // feezal-connection is always earlier in the DOM than our element.
        const connEl = document.querySelector('feezal-connection');
        if (connEl) {
            connEl.addEventListener('connected',    this._onConnected);
            connEl.addEventListener('disconnected', this._onDisconnected);

            // If already disconnected on attach (e.g. broker was never reachable),
            // apply a grace period before showing the overlay.
            if (!connEl.connected) {
                this._scheduleShow();
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._clearTimers();
        const connEl = document.querySelector('feezal-connection');
        if (connEl && this._onConnected) {
            connEl.removeEventListener('connected',    this._onConnected);
            connEl.removeEventListener('disconnected', this._onDisconnected);
        }
    }

    _handleConnected() {
        clearTimeout(this._showTimer);
        this._showTimer = null;
        this._disconnected = false;
        this._clearTicker();
    }

    _handleDisconnected() {
        this._scheduleShow();
    }

    // Show overlay after a 3-second grace period (avoids flash on initial load).
    _scheduleShow() {
        if (this._showTimer) return;
        this._showTimer = setTimeout(() => {
            this._showTimer  = null;
            this._disconnected = true;
            this._elapsed    = 0;
            this._startTicker();
        }, 3000);
    }

    _startTicker() {
        this._clearTicker();
        this._ticker = setInterval(() => { this._elapsed++; }, 1000);
    }

    _clearTicker() {
        if (this._ticker) {
            clearInterval(this._ticker);
            this._ticker = null;
        }
    }

    _clearTimers() {
        this._clearTicker();
        clearTimeout(this._showTimer);
        this._showTimer = null;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">wifi_off</span>
                    <span>Connection Status</span>
                </div>`;
        }

        if (!this._disconnected) return html``;

        const backdropStyle = `background:${this.backdropColor};opacity:${this.backdropOpacity};`
            + (this.blockInteraction ? 'pointer-events:all;' : 'pointer-events:none;');

        const msg = this.showCountdown
            ? (this.message || '').replace('{countdown}', this._elapsed)
            : (this.message || '');

        const titleHtml  = this.title ? html`<div class="overlay-title">${this.title}</div>` : html``;
        const msgHtml    = msg ? html`<div class="overlay-message">${msg}</div>` : html``;
        const backdropHtml = this.backdrop
            ? html`<div class="backdrop" style="${backdropStyle}"></div>`
            : html``;

        if (this.display === 'dialog') {
            return html`
                ${backdropHtml}
                <div class="dialog"
                    style="${this.blockInteraction ? 'pointer-events:all' : 'pointer-events:none'}">
                    ${titleHtml}${msgHtml}
                </div>`;
        }

        // Default: banner
        return html`
            ${backdropHtml}
            <div class="banner ${this.position || 'top'}"
                style="${this.blockInteraction ? 'pointer-events:all' : 'pointer-events:none'}">
                ${titleHtml}${msgHtml}
            </div>`;
    }
}

window.customElements.define('feezal-element-system-connection-status', FeezalElementSystemConnectionStatus);
