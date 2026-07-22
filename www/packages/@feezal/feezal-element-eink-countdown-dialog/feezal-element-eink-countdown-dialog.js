/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-eink-countdown-dialog (E57)
 *
 * E-ink sibling of feezal-element-glass-countdown-dialog — SAME attribute
 * contract (duration, warn-seconds, auto-confirm publish, ${seconds} /
 * ${msg.*} template variables), restyled with the 1-bit family chrome:
 * solid white panel, thick black rule, OVERSIZED tabular numeral. No ring,
 * no colours, no blur, no animation — the once-per-second numeral swap IS
 * the update; the numeral block inverts in the last warn-seconds seconds
 * (the family's attention treatment).
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas.
 * On an MQTT payload-open message, opens a modal dialog and starts a
 * countdown. At zero it publishes payload-confirm and closes. Cancel closes
 * and publishes payload-cancel.
 *
 * Dropped vs glass: `degrade` and the frost styling vars — meaningless
 * without a backdrop blur.
 */

class FeezalElementEinkCountdownDialog extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Confirm', category: 'Eink', color: '#222222', icon: 'timer'},
            description: 'E-ink countdown modal opened by an MQTT message — 1-bit, oversized numeral, redraw-deduped. ' +
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
                {name: 'warn-seconds',    type: 'number',    default: 3,                     help: 'Seconds remaining at which the numeral block inverts.'},
            ],
            styles: [
                'top', 'left',
                {property: '--feezal-eink-font-size-value', default: '72px', help: 'Countdown numeral font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '120px', height: '40px'},
        };
    }

    static properties = {
        dialogTitle:    {type: String, reflect: true, attribute: 'title'},
        template:       {type: String, reflect: true},
        duration:       {type: Number, reflect: true},
        subscribe:      {type: String, reflect: true},
        payloadOpen:    {type: String, reflect: true, attribute: 'payload-open'},
        publishConfirm: {type: String, reflect: true, attribute: 'publish-confirm'},
        payloadConfirm: {type: String, reflect: true, attribute: 'payload-confirm'},
        publishCancel:  {type: String, reflect: true, attribute: 'publish-cancel'},
        payloadCancel:  {type: String, reflect: true, attribute: 'payload-cancel'},
        cancelLabel:    {type: String, reflect: true, attribute: 'cancel-label'},
        warnSeconds:    {type: Number, reflect: true, attribute: 'warn-seconds'},
        _open:          {state: true},
        _remaining:     {state: true},
        _msg:           {state: true},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        /* Pseudo-element with a fixed overlay — undo the card containment
           (einkCardStyles' container-type/overflow would trap and clip the
           fixed-position dialog inside the 120×40 host). */
        :host {
            container-type: normal;
            overflow: visible;
        }

        /* E57: no animation, ever — dialog appears/disappears instantly. */
        *, *::before, *::after { transition: none !important; animation: none !important; }

        /* ── Editor placeholder ── */
        .editor-placeholder {
            width: 100%;
            height: 100%;
            min-width: 120px;
            min-height: 36px;
            box-sizing: border-box;
            border: 2px dashed var(--_fg);
            background: var(--_bg);
            color: var(--_fg);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            user-select: none;
        }
        .editor-placeholder .icon {
            font-family: 'Material Icons';
            font-size: 18px;
            font-style: normal;
            text-transform: none;
            letter-spacing: normal;
        }

        /* ── Dialog overlay — solid 1-bit panel ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 9998;
            pointer-events: all;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            box-sizing: border-box;
            background: var(--_bg);
            color: var(--_fg);
            border: var(--feezal-eink-rule, 3px) solid var(--_fg);
            border-radius: var(--feezal-eink-radius, 0px);
            font-family: var(--feezal-eink-font, ui-monospace, 'Cascadia Mono', 'Roboto Mono', 'Courier New', monospace);
            font-weight: 700;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 24px;
            min-width: 260px;
            max-width: 380px;
            user-select: none;
        }
        .dialog-header {
            font-size: var(--feezal-eink-font-size-label, 13px);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 10px;
            text-align: center;
        }

        /* Oversized numeral — the once-per-second swap IS the update.
           Inverts (fg-on-bg swap) in the last warn-seconds seconds. */
        .number {
            font-size: var(--feezal-eink-font-size-value, 72px);
            line-height: 1.0;
            font-variant-numeric: tabular-nums;
            padding: 4px 14px;
            margin-bottom: 10px;
        }
        .number.inv {
            background: var(--_fg);
            color: var(--_bg);
        }

        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            text-align: center;
            margin-bottom: 14px;
        }
        .dialog-btn {
            padding: 8px 20px;
            border: var(--feezal-eink-rule, 3px) solid var(--_fg);
            border-radius: 0;
            font-size: 14px;
            font-family: inherit;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            cursor: pointer;
            background: var(--_bg);
            color: var(--_fg);
        }
        .dialog-btn:active {
            background: var(--_fg);
            color: var(--_bg);
        }
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
            console.error('[feezal-eink-countdown] template error:', err.message);
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

    /** 1-bit warn state — no amber/red here, the numeral block inverts. */
    _warnState(remaining) {
        const warn = this.warnSeconds > 0 ? this.warnSeconds : 3;
        return remaining <= warn ? 'warn' : 'ok';
    }

    /** E57 redraw dedup: open state + shown seconds + warn word — each tick
     *  renders exactly once, spurious pokes never touch the panel. */
    renderSignature() {
        return [this._open, this._remaining, this._warnState(this._remaining)].join('|');
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

        const msg = this._evalTemplate(this._remaining);

        return html`
            <div class="backdrop"></div>
            <div class="dialog-panel">
                ${this.dialogTitle
                    ? html`<div class="dialog-header">${this.dialogTitle}</div>`
                    : html``}

                <div class="number ${this._warnState(this._remaining) === 'warn' ? 'inv' : ''}">${this._remaining}</div>

                ${msg ? html`<div class="dialog-message">${unsafeHTML(msg)}</div>` : html``}

                <button class="dialog-btn" @click=${() => this._handleCancel()}>
                    ${this.cancelLabel || 'Cancel'}
                </button>
            </div>`;
    }
}

customElements.define('feezal-element-eink-countdown-dialog', FeezalElementEinkCountdownDialog);
export {FeezalElementEinkCountdownDialog};
