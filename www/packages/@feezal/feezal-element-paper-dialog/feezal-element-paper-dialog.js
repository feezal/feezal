/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {render} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-paper-dialog (E86)
 *
 * Paper-styled counterpart of feezal-element-material-dialog — a drop-in
 * equivalent exposing the identical attribute set (incl. the B24 sizing and
 * B25 header contract); only the chrome differs (paper sheet: 2px corners,
 * paper elevation shadow, flat uppercase text buttons, --paper-dialog-*
 * theme tokens).
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas. Opens a modal
 * dialog on an MQTT message (payload-open); closes on payload-close,
 * backdrop click, ESC, the ✕, or a button press. The overlay renders into a
 * document.body portal so it is never trapped inside a display:none view.
 *
 * Previously this element was a non-functional stub (hardcoded header +
 * lorem ipsum, only a `subscribe` attribute) wrapping @polymer/paper-dialog.
 * Rebuilt on the Lit base: the material dialogs' portal / payload / header
 * contract cannot be expressed through iron-overlay-behavior, and parity is
 * the point — the paper look is reproduced with paper design tokens.
 */
class FeezalElementPaperDialog extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Dialog', category: 'Paper', color: '#4a6080'},
            description: 'Opens a modal dialog when an MQTT message is received. ' +
                'Supports ok/cancel buttons that each publish a configurable payload. ' +
                'Paper-styled twin of the Material Dialog — identical attributes.',
            attributes: [
                {name: 'title',            type: 'string',    default: '',       help: 'Dialog title text.'},
                {name: 'template',         textarea: true, editor: true, variables: ['msg'], help: 'HTML body of the dialog. Use ${msg.payload} and other ${msg.*} properties from the triggering MQTT message.'},
                {name: 'icon',             type: 'string',    default: '',       help: 'Optional Material icon name shown above the message (e.g. "warning").'},
                {name: 'subscribe',        type: 'mqttTopic',                    help: 'Topic to listen on for open/close payloads.'},
                {name: 'payload-open',     type: 'string',    default: 'open',   help: 'Payload that opens the dialog.'},
                {name: 'payload-close',    type: 'string',    default: 'close',  help: 'Payload that closes the dialog silently.'},
                {name: 'ok-label',         type: 'string',    default: '',       help: 'OK button label. Hidden when empty.'},
                {name: 'ok-publish',       type: 'mqttTopic',                    help: 'Topic published when OK is pressed. If empty, closes silently.'},
                {name: 'ok-payload',       type: 'string',    default: 'ok',     help: 'Payload published when OK is pressed.'},
                {name: 'cancel-label',     type: 'string',    default: '',       help: 'Cancel button label. Hidden when empty.'},
                {name: 'cancel-publish',   type: 'mqttTopic',                    help: 'Topic published when Cancel is pressed. If empty, closes silently.'},
                {name: 'cancel-payload',   type: 'string',    default: 'cancel', help: 'Payload published when Cancel is pressed.'},
                {name: 'close-on-backdrop',type: 'boolean',   default: true,     help: 'Close the dialog when the backdrop is clicked.'},
                {name: 'show-close',       type: 'boolean',   default: true,     help: 'Show a top-right ✕ close affordance.'},
                {name: 'hide-header',      type: 'boolean',   default: false,    help: 'Hide the header bar (title + ✕) entirely, regardless of title/show-close. (Default-false boolean so the setting survives save/reload.)'},
                {name: 'width',            type: 'string',    default: '480px',  help: 'Dialog panel width.'},
                {name: 'height',           type: 'string',    default: '',       help: 'Dialog panel height. Empty: auto (content height).'},
                {name: 'min-height',       type: 'string',    default: '',       help: 'Dialog panel minimum height — raises the floor so a dialog with little content does not collapse.'},
                {name: 'max-height',       type: 'string',    default: '80vh',   help: 'Dialog panel max height.'},
            ],
            styles: ['top', 'left'],
            defaultStyle: {width: '120px', height: '40px'},
        };
    }

    static properties = {
        dialogTitle:     {type: String,  reflect: true, attribute: 'title'},
        template:        {type: String,  reflect: true},
        icon:            {type: String,  reflect: true},
        subscribe:       {type: String,  reflect: true},
        payloadOpen:     {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClose:    {type: String,  reflect: true, attribute: 'payload-close'},
        okLabel:         {type: String,  reflect: true, attribute: 'ok-label'},
        okPublish:       {type: String,  reflect: true, attribute: 'ok-publish'},
        okPayload:       {type: String,  reflect: true, attribute: 'ok-payload'},
        cancelLabel:     {type: String,  reflect: true, attribute: 'cancel-label'},
        cancelPublish:   {type: String,  reflect: true, attribute: 'cancel-publish'},
        cancelPayload:   {type: String,  reflect: true, attribute: 'cancel-payload'},
        closeOnBackdrop: {type: Boolean, reflect: true, attribute: 'close-on-backdrop'},
        showClose:       {type: Boolean, reflect: true, attribute: 'show-close'},
        hideHeader:      {type: Boolean, reflect: true, attribute: 'hide-header'},
        width:           {type: String,  reflect: true},
        height:          {type: String,  reflect: true},
        minHeight:       {type: String,  reflect: true, attribute: 'min-height'},
        maxHeight:       {type: String,  reflect: true, attribute: 'max-height'},
        _open:           {state: true},
        _msg:            {state: true},
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
            border: 2px dashed #4a6080;
            background: #eceff1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 12px;
            color: #4a6080;
            box-sizing: border-box;
            user-select: none;
        }
        .editor-placeholder .icon {
            font-family: 'Material Icons';
            font-size: 18px;
            font-style: normal;
        }

        /* ── Dialog overlay (editor preview) — paper sheet chrome ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9998;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: var(--paper-dialog-background-color, var(--primary-background-color, #fff));
            color: var(--paper-dialog-color, var(--primary-text-color, #333));
            border-radius: 2px;
            box-shadow: 0 16px 24px 2px rgba(0,0,0,0.14), 0 6px 30px 5px rgba(0,0,0,0.12), 0 8px 10px -5px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .dialog-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 20px 24px 0;
            font-size: 20px;
            font-weight: 500;
            font-family: 'Roboto', sans-serif;
            color: var(--paper-dialog-color, var(--primary-text-color, #333));
        }
        .dialog-header .spacer { flex: 1; }
        .dialog-close {
            font-family: 'Material Icons';
            font-style: normal;
            font-size: 20px;
            line-height: 1;
            border: none;
            background: none;
            color: var(--secondary-text-color, #777);
            cursor: pointer;
            padding: 2px;
            border-radius: 50%;
        }
        .dialog-close:hover { background: rgba(0,0,0,0.08); }
        .dialog-body {
            padding: 16px 24px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            font-family: 'Roboto', sans-serif;
        }
        .dialog-icon {
            font-family: 'Material Icons';
            font-size: 40px;
            font-style: normal;
            color: var(--primary-color, #3f51b5);
        }
        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: var(--paper-dialog-color, var(--primary-text-color, #555));
            text-align: center;
        }
        .dialog-footer {
            padding: 8px;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .dialog-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 2px;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            cursor: pointer;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: none;
            transition: background 0.15s;
        }
        .dialog-btn-ok { color: var(--primary-color, #3f51b5); }
        .dialog-btn-cancel { color: var(--secondary-text-color, #666); }
        .dialog-btn:hover { background: rgba(0,0,0,0.07); }
    `];

    constructor() {
        super();
        this.dialogTitle   = '';
        this.template      = '';
        this.icon          = '';
        this.subscribe     = '';
        this.payloadOpen   = 'open';
        this.payloadClose  = 'close';
        this.okLabel       = '';
        this.okPublish     = '';
        this.okPayload     = 'ok';
        this.cancelLabel   = '';
        this.cancelPublish = '';
        this.cancelPayload = 'cancel';
        this.closeOnBackdrop = true;
        this.showClose     = true;
        this.hideHeader    = false;
        this.width         = '480px';
        this.height        = '';
        this.minHeight     = '';
        this.maxHeight     = '80vh';
        this._open         = false;
        this._msg          = {};
        this._portal       = null;
    }

    /** Evaluate the body template against the last triggering message. */
    _evalTemplate() {
        if (!this.template) return '';
        try {
            // eslint-disable-next-line no-new-func
            return new Function('msg', 'return `' + this.template + '`;')(this._msg || {});
        } catch (err) {
            console.error('[feezal-paper-dialog] template error:', err.message);
            return '';
        }
    }

    // Prevent the base class from subscribing via subscribe/#
    _subscribe() { /* managed manually */ }

    connectedCallback() {
        super.connectedCallback();

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                // Keep the triggering message so the body template can read msg.*
                this._msg = (msg && typeof msg === 'object') ? msg : {payload: msg};
                const payload = this._msg.payload;
                if (String(payload) === this.payloadOpen) {
                    this._open = true;
                } else if (String(payload) === this.payloadClose) {
                    this._open = false;
                }
            });
        }

        this._onKeyDown = e => {
            if (e.key === 'Escape' && this._open) this._close();
        };
        document.addEventListener('keydown', this._onKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this._onKeyDown);
        this._clearPortal();
    }

    _clearPortal() {
        if (this._portal) {
            render(html``, this._portal);
            this._portal.remove();
        }
    }

    updated(changed) {
        super.updated(changed);
        // In the viewer the overlay is rendered into a document.body portal so
        // it is never trapped inside a display:none view or a CSS-transformed
        // canvas ancestor.
        if (!feezal.isEditor) {
            if (changed.has('_open')) {
                if (this._open) {
                    if (!this._portal) {
                        this._portal = document.createElement('div');
                        this._portal.setAttribute('feezal-paper-dialog-portal', '');
                    }
                    document.body.appendChild(this._portal);
                    render(this._renderPortalContent(), this._portal);
                } else {
                    this._clearPortal();
                }
            } else if (this._open && this._portal) {
                // Keep the open portal in sync with live property changes
                // (title / show-close / hide-header / a new message's template).
                render(this._renderPortalContent(), this._portal);
            }
        }
    }

    _close() {
        this._open = false;
    }

    _handleOk() {
        if (!feezal.isEditor && this.okPublish) feezal.connection.pub(this.okPublish, this.okPayload);
        this._close();
    }

    _handleCancel() {
        if (!feezal.isEditor && this.cancelPublish) feezal.connection.pub(this.cancelPublish, this.cancelPayload);
        this._close();
    }

    _handleBackdropClick() {
        if (this.closeOnBackdrop) this._close();
    }

    /**
     * Unified header bar — title + top-right ✕ — same contract as the
     * material dialogs (B25). hide-header removes the bar entirely; otherwise
     * it shows when a title or the close affordance (show-close) is present.
     * `inline: true` renders with inline styles for the portal (which has no
     * shadow stylesheet), `false` uses the shadow classes (editor preview).
     */
    _headerTemplate(inline) {
        if (this.hideHeader) return html``;
        if (!this.dialogTitle && !this.showClose) return html``;
        const closeBtn = this.showClose
            ? (inline
                ? html`<button style="font-family:'Material Icons';font-style:normal;font-size:20px;line-height:1;border:none;background:none;color:var(--secondary-text-color,#777);cursor:pointer;padding:2px;border-radius:50%;" title="Close" @click=${() => this._close()}>close</button>`
                : html`<button class="dialog-close" title="Close" @click=${() => this._close()}>close</button>`)
            : html``;
        return inline
            ? html`<div style="display:flex;align-items:center;gap:8px;padding:20px 24px 0;font-size:20px;font-weight:500;font-family:Roboto,sans-serif;"><span>${this.dialogTitle}</span><span style="flex:1"></span>${closeBtn}</div>`
            : html`<div class="dialog-header"><span>${this.dialogTitle}</span><span class="spacer"></span>${closeBtn}</div>`;
    }

    _renderPortalContent() {
        const panelStyle = [
            `width:${this.width || '480px'}`,
            'max-width:calc(100vw - 32px)',
            `height:${this.height || 'auto'}`,
            `min-height:${this.minHeight || 'auto'}`,
            `max-height:${this.maxHeight || '80vh'}`,
            'position:fixed',
            'top:50%',
            'left:50%',
            'transform:translate(-50%,-50%)',
            'z-index:9999',
            'background:var(--paper-dialog-background-color,var(--primary-background-color,#fff))',
            'color:var(--paper-dialog-color,var(--primary-text-color,#333))',
            'border-radius:2px',
            'box-shadow:0 16px 24px 2px rgba(0,0,0,0.14), 0 6px 30px 5px rgba(0,0,0,0.12), 0 8px 10px -5px rgba(0,0,0,0.4)',
            'display:flex',
            'flex-direction:column',
            'overflow:hidden',
        ].join(';');

        const iconTpl = this.icon
            ? html`<feezal-icon style="font-size:40px;color:var(--primary-color,#3f51b5);" name="${this.icon}"></feezal-icon>`
            : html``;
        const body = this._evalTemplate();
        const msgTpl = body
            ? html`<div style="font-size:14px;line-height:1.5;color:var(--paper-dialog-color,var(--primary-text-color,#555));text-align:center;">${unsafeHTML(body)}</div>`
            : html``;
        const btnBase = 'padding:8px 12px;border:none;border-radius:2px;font-size:14px;font-family:Roboto,sans-serif;cursor:pointer;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;background:none;';
        const okTpl = this.okLabel
            ? html`<button style="${btnBase}color:var(--primary-color,#3f51b5);" @click=${() => this._handleOk()}>${this.okLabel}</button>`
            : html``;
        const cancelTpl = this.cancelLabel
            ? html`<button style="${btnBase}color:var(--secondary-text-color,#666);" @click=${() => this._handleCancel()}>${this.cancelLabel}</button>`
            : html``;

        return html`
            <style>[feezal-paper-dialog-portal] button{transition:background .15s}[feezal-paper-dialog-portal] button:hover{background:rgba(0,0,0,0.07)}</style>
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;"
                 @click=${() => this._handleBackdropClick()}></div>
            <div style="${panelStyle}">
                ${this._headerTemplate(true)}
                <div style="padding:16px 24px;flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:Roboto,sans-serif;">
                    ${iconTpl}${msgTpl}
                </div>
                ${(this.okLabel || this.cancelLabel)
                    ? html`<div style="padding:8px;display:flex;justify-content:flex-end;gap:8px;">${cancelTpl}${okTpl}</div>`
                    : html``}
            </div>`;
    }

    _renderDialogPanel() {
        const panelStyle = `width:${this.width || '480px'};height:${this.height || 'auto'};min-height:${this.minHeight || 'auto'};max-height:${this.maxHeight || '80vh'};`;

        const iconTpl  = this.icon ? html`<feezal-icon class="dialog-icon" name="${this.icon}"></feezal-icon>` : html``;
        const body     = this._evalTemplate();
        const msgTpl   = body
            ? html`<div class="dialog-message">${unsafeHTML(body)}</div>`
            : html``;
        const okTpl    = this.okLabel
            ? html`<button class="dialog-btn dialog-btn-ok" @click=${() => this._handleOk()}>${this.okLabel}</button>`
            : html``;
        const cancelTpl = this.cancelLabel
            ? html`<button class="dialog-btn dialog-btn-cancel" @click=${() => this._handleCancel()}>${this.cancelLabel}</button>`
            : html``;

        return html`
            <div class="dialog-panel" style="${panelStyle}">
                ${this._headerTemplate(false)}
                <div class="dialog-body">${iconTpl}${msgTpl}</div>
                ${(this.okLabel || this.cancelLabel)
                    ? html`<div class="dialog-footer">${cancelTpl}${okTpl}</div>`
                    : html``}
            </div>`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">web_asset</span>
                    <span>Paper Dialog</span>
                </div>
                ${this._open ? html`
                    <div class="backdrop" @click=${() => { this._open = false; }}></div>
                    ${this._renderDialogPanel()}` : html``}`;
        }

        // Viewer: overlay is rendered into a document.body portal in updated().
        return html``;
    }
}

window.customElements.define('feezal-element-paper-dialog', FeezalElementPaperDialog);

export {FeezalElementPaperDialog};
