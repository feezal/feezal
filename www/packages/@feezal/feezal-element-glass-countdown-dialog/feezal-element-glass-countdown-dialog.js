/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-glass-countdown-dialog (E101)
 *
 * Frosted-glass sibling of feezal-element-material-countdown-dialog — SAME
 * attribute contract (duration, warn-seconds, auto-confirm publish,
 * ${seconds} / ${msg.*} template variables), restyled with the glass family
 * chrome: translucent blurred panel, squircle corners, accent-coloured ring.
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas.
 * On an MQTT payload-open message, opens a modal dialog and starts a countdown.
 * At zero it publishes payload-confirm and closes. Cancel closes and publishes
 * payload-cancel. The ring shrinks as time elapses and turns amber → red in the
 * last warn-seconds seconds.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

const RING_R         = 38;
const RING_CX        = 44;
const RING_CY        = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R; // ≈ 238.76

class FeezalElementGlassCountdownDialog extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Confirm', category: 'Glass', color: '#7aa5c9'},
            description: 'Frosted-glass countdown modal opened by an MQTT message. ' +
                'Auto-executes the confirm action when the timer reaches zero, or can be cancelled.',
            attributes: [
                {name: 'title',           type: 'string',    default: '',                    help: 'Dialog title text.'},
                {name: 'template',        textarea: true, editor: true, variables: ['msg', 'seconds'], help: 'Body text of the countdown dialog. Use ${seconds} for the remaining time and ${msg.*} for properties from the triggering MQTT message.'},
                {name: 'duration',        type: 'number',    default: 10,                    help: 'Countdown duration in seconds.'},
                {name: 'subscribe',       type: 'mqttTopic',                                 help: 'Topic to listen on for the open payload.'},
                {name: 'payload-open',    type: 'string',    default: 'open',                help: 'Payload that opens the dialog and starts the countdown.'},
                {name: 'publish-confirm', type: 'mqttTopic',                                 help: 'Topic published when the countdown reaches zero.'},
                {name: 'payload-confirm', type: 'string',    default: 'confirm',             help: 'Payload published on countdown completion.'},
                {name: 'publish-cancel',  type: 'mqttTopic',                                 help: 'Topic published when Cancel is pressed.'},
                {name: 'payload-cancel',  type: 'string',    default: 'cancel',              help: 'Payload published on cancel.'},
                {name: 'cancel-label',    type: 'string',    default: 'Cancel',              help: 'Cancel button label.'},
                {name: 'warn-seconds',    type: 'number',    default: 3,                     help: 'Seconds remaining at which the ring turns amber/red.'},
                {name: 'degrade',         type: 'boolean',   default: false,                 help: 'Replace the live backdrop blur with a semi-opaque solid panel — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Countdown ring colour (normal state).'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint of the panel (defaults from the theme).'},
            ],
            defaultStyle: {width: '120px', height: '40px'},
        };
    }

    static properties = {
        dialogTitle:    {type: String,  reflect: true, attribute: 'title'},
        template:       {type: String,  reflect: true},
        duration:       {type: Number,  reflect: true},
        subscribe:      {type: String,  reflect: true},
        payloadOpen:    {type: String,  reflect: true, attribute: 'payload-open'},
        publishConfirm: {type: String,  reflect: true, attribute: 'publish-confirm'},
        payloadConfirm: {type: String,  reflect: true, attribute: 'payload-confirm'},
        publishCancel:  {type: String,  reflect: true, attribute: 'publish-cancel'},
        payloadCancel:  {type: String,  reflect: true, attribute: 'payload-cancel'},
        cancelLabel:    {type: String,  reflect: true, attribute: 'cancel-label'},
        warnSeconds:    {type: Number,  reflect: true, attribute: 'warn-seconds'},
        degrade:        {type: Boolean, reflect: true},
        _open:          {state: true},
        _remaining:     {state: true},
        _msg:           {state: true},
    };

    static styles = [feezalBaseStyles, css`
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
            border: 2px dashed #7aa5c9;
            background: color-mix(in srgb, #7aa5c9 10%, transparent);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 12px;
            color: #7aa5c9;
            box-sizing: border-box;
            user-select: none;
        }
        .editor-placeholder .icon {
            font-family: 'Material Icons';
            font-size: 18px;
            font-style: normal;
        }

        /* ── Dialog overlay — frosted glass panel ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.35);
            z-index: 9998;
            pointer-events: all;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: var(--feezal-glass-tint, rgba(255,255,255,0.7));
            -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            backdrop-filter: blur(var(--feezal-glass-blur, 20px));
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            color: var(--feezal-glass-color, #1d1d1f);
            border-radius: var(--feezal-glass-radius, 24px);
            box-shadow: 0 16px 48px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 28px 20px;
            min-width: 260px;
            max-width: 380px;
            animation: feezal-glass-cd-in 0.18s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        @supports (corner-shape: squircle) { .dialog-panel { corner-shape: squircle; } }
        :host([degrade]) .dialog-panel {
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        @keyframes feezal-glass-cd-in {
            from { opacity: 0; transform: translate(-50%, -48%); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        .dialog-header {
            font-size: 16px;
            font-weight: 700;
            color: var(--feezal-glass-color, #1d1d1f);
            margin-bottom: 12px;
            text-align: center;
        }

        /* Ring + number — track like the glass sliders' rail, progress in the
           family accent, amber/red in the last warn-seconds. */
        .ring-wrap {
            position: relative;
            width: 88px;
            height: 88px;
            margin-bottom: 10px;
        }
        .ring-svg {
            width: 88px;
            height: 88px;
        }
        .ring-bg {
            fill: none;
            stroke: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 12%, transparent);
            stroke-width: 6;
        }
        .ring-progress {
            fill: none;
            stroke-width: 6;
            stroke-linecap: round;
            transform: rotate(-90deg);
            transform-origin: center;
            transition: stroke-dashoffset 0.9s linear, stroke 0.3s ease;
        }
        .ring-progress.ok     { stroke: var(--feezal-glass-accent, #ff9f0a); }
        .ring-progress.warn   { stroke: #ff9800; }
        .ring-progress.danger { stroke: #e53935; }
        .ring-number {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            color: var(--feezal-glass-color, #1d1d1f);
        }

        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: var(--feezal-glass-color, #1d1d1f);
            text-align: center;
            margin-bottom: 16px;
        }
        .dialog-btn {
            padding: 8px 20px;
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            border-radius: 14px;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            font-weight: 600;
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 10%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
            transition: filter 0.15s;
        }
        .dialog-btn:hover { filter: brightness(0.9); }
    `];

    constructor() {
        super();
        this.dialogTitle    = '';
        this.template       = 'Proceeding in ${seconds}…';
        this.duration       = 10;
        this.subscribe      = '';
        this.payloadOpen    = 'open';
        this.publishConfirm = '';
        this.payloadConfirm = 'confirm';
        this.publishCancel  = '';
        this.payloadCancel  = 'cancel';
        this.cancelLabel    = 'Cancel';
        this.warnSeconds    = 3;
        this.degrade        = false;
        this._open          = false;
        this._remaining     = 0;
        this._msg           = {};
        this._timer         = null;
    }

    /** Evaluate the body template against the last message and the live count. */
    _evalTemplate(seconds) {
        if (!this.template) return '';
        try {
            // eslint-disable-next-line no-new-func
            return new Function('msg', 'seconds', 'return `' + this.template + '`;')(this._msg || {}, seconds);
        } catch (err) {
            console.error('[feezal-glass-countdown] template error:', err.message);
            return '';
        }
    }

    // Prevent base class subscribe/# handling
    _subscribe() { /* managed manually */ }

    connectedCallback() {
        super.connectedCallback();

        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._msg = (msg && typeof msg === 'object') ? msg : {payload: msg};
                if (String(this._msg.payload) === this.payloadOpen) {
                    this._startCountdown();
                }
            });
        }

        this._onKeyDown = e => {
            if (e.key === 'Escape' && this._open) this._handleCancel();
        };
        document.addEventListener('keydown', this._onKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._clearTimer();
        document.removeEventListener('keydown', this._onKeyDown);
    }

    _startCountdown() {
        this._clearTimer();
        this._remaining = this.duration > 0 ? this.duration : 10;
        this._open      = true;

        this._timer = setInterval(() => {
            this._remaining--;
            if (this._remaining <= 0) {
                this._clearTimer();
                this._open = false;
                if (this.publishConfirm) {
                    feezal.connection.pub(this.publishConfirm, this.payloadConfirm);
                }
            }
        }, 1000);
    }

    _clearTimer() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    _handleCancel() {
        this._clearTimer();
        this._open = false;
        if (this.publishCancel) {
            feezal.connection.pub(this.publishCancel, this.payloadCancel);
        }
    }

    _ringState(remaining) {
        const warn = this.warnSeconds > 0 ? this.warnSeconds : 3;
        if (remaining <= Math.floor(warn / 2)) return 'danger';
        if (remaining <= warn)                 return 'warn';
        return 'ok';
    }

    _renderDialog(remaining, previewMode) {
        const dur      = this.duration > 0 ? this.duration : 10;
        const progress = (remaining / dur) * RING_CIRCUMFERENCE;
        const offset   = RING_CIRCUMFERENCE - progress;
        const state    = this._ringState(remaining);

        const msg = this._evalTemplate(remaining);

        return html`
            <div class="dialog-panel" style="${previewMode
                ? 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;opacity:0.9;'
                : ''}">
                ${this.dialogTitle
                    ? html`<div class="dialog-header">${this.dialogTitle}</div>`
                    : html``}

                <div class="ring-wrap">
                    ${svg`
                        <svg class="ring-svg" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
                            <circle class="ring-bg"
                                cx="${RING_CX}" cy="${RING_CY}" r="${RING_R}"/>
                            <circle
                                class="ring-progress ${state}"
                                cx="${RING_CX}" cy="${RING_CY}" r="${RING_R}"
                                stroke-dasharray="${RING_CIRCUMFERENCE}"
                                stroke-dashoffset="${offset}"/>
                        </svg>`}
                    <div class="ring-number">${remaining}</div>
                </div>

                ${msg ? html`<div class="dialog-message">${unsafeHTML(msg)}</div>` : html``}

                <button class="dialog-btn" @click=${() => this._handleCancel()}>
                    ${this.cancelLabel || 'Cancel'}
                </button>
            </div>`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">timer</span>
                    <span>Countdown Dialog</span>
                </div>`;
        }

        if (!this._open) return html``;

        return html`
            <div class="backdrop"></div>
            ${this._renderDialog(this._remaining, false)}`;
    }
}

customElements.define('feezal-element-glass-countdown-dialog', FeezalElementGlassCountdownDialog);
export {FeezalElementGlassCountdownDialog};
