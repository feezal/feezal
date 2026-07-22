/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
import {render} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-eink-dialog (E57)
 *
 * E-ink sibling of feezal-element-glass-dialog — SAME attribute contract
 * (topics, payloads, ok/cancel buttons, B24 sizing, B25 header behaviour),
 * restyled to the family's 1-bit constraint set: solid white panel, thick
 * black border, black uppercase title, flat bordered buttons. NO blur, NO
 * transitions, NO animations, NO colors, NO shadows. The glass presentation
 * attrs (`degrade`, frost tint/accent styles) are intentionally absent —
 * there is nothing to degrade and nothing to tint.
 *
 * Pseudo-element: a ~120×40 px eink trigger card on the canvas.
 * Opens a full-viewport modal dialog on an MQTT message (payload-open).
 * Closes on payload-close, backdrop click, ESC, or button press.
 *
 * E57 redraw discipline: the triggering message is kept in a NON-reactive
 * field; a repeated republish of the same payload only re-renders when
 * `renderSignature()` (open-state + evaluated body) actually changes.
 */

// Eink chrome vars mirrored from the host onto the body portal (the portal
// lives outside this shadow tree, so per-element style-inspector overrides
// would not cascade to it otherwise; theme-level :root vars reach it anyway).
const EINK_TOKENS = ['fg', 'bg', 'rule', 'radius', 'font'];

class FeezalElementEinkDialog extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Dialog', category: 'Eink', color: '#222222', icon: 'chat'},
            description: 'E-ink modal dialog opened by an MQTT message — solid 1-bit panel, no animation. ' +
                'Supports ok/cancel buttons that each publish a configurable payload. ' +
                'Same wiring contract as the glass/material Dialog.',
            attributes: [
                {name: 'title',            type: 'string',    default: '',       help: 'Dialog title text (rendered uppercase).'},
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
                {name: 'show-close',       type: 'boolean',   default: true,     help: 'Show a top-right ✕ close affordance (same as Dialog View).'},
                {name: 'hide-header',      type: 'boolean',   default: false,    help: 'Hide the header bar (title + ✕) entirely, regardless of title/show-close. (Default-false boolean so the setting survives save/reload.)'},
                {name: 'width',            type: 'string',    default: '480px',  help: 'Dialog panel width.'},
                {name: 'height',           type: 'string',    default: '',       help: 'Dialog panel height. Empty: auto (content height).'},
                {name: 'min-height',       type: 'string',    default: '',       help: 'Dialog panel minimum height — raises the floor so a dialog with little content does not collapse.'},
                {name: 'max-height',       type: 'string',    default: '80vh',   help: 'Dialog panel max height.'},
            ],
            styles: [
                'top', 'left',
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px; the dialog panel never goes below 3px).'},
            ],
            defaultStyle: {width: '120px', height: '40px'},
            inspector: 'feezal-element-eink-dialog-inspector',
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
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        /* The trigger card is a normal eink card, but the host must NOT clip
         * nor contain the editor-preview overlay (einkCardStyles sets
         * overflow:hidden + container-type:size, which would trap the
         * fixed-position backdrop/panel inside a 120×40 box). */
        :host {
            overflow: visible;
            container-type: normal;
        }
        .card.trigger {
            justify-content: center;
            align-items: center;
            flex-direction: row;
            gap: 6px;
        }

        /* ── Dialog overlay (editor preview) — solid 1-bit panel ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 9998;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: var(--feezal-eink-bg, #fff);
            color: var(--feezal-eink-fg, #000);
            border: max(3px, var(--feezal-eink-rule, 3px)) solid var(--feezal-eink-fg, #000);
            border-radius: var(--feezal-eink-radius, 0px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: var(--feezal-eink-font, ui-monospace, 'Cascadia Mono', 'Roboto Mono', 'Courier New', monospace);
            font-weight: 700;
        }
        /* E57: no animation, ever — the dialog appears and disappears instantly. */
        .dialog-panel, .dialog-panel *, .backdrop { transition: none !important; animation: none !important; box-shadow: none !important; }
        .dialog-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 18px 0;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--feezal-eink-fg, #000);
        }
        .dialog-header .spacer { flex: 1; }
        .dialog-close {
            font-family: 'Material Icons';
            font-style: normal;
            font-size: 20px;
            line-height: 1;
            border: none;
            background: none;
            color: var(--feezal-eink-fg, #000);
            cursor: pointer;
            padding: 2px;
        }
        .dialog-body {
            padding: 12px 18px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .dialog-icon {
            font-size: 40px;
            font-style: normal;
            color: currentColor;
        }
        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: var(--feezal-eink-fg, #000);
            text-align: center;
        }
        .dialog-footer {
            padding: 10px 18px 16px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .dialog-btn {
            padding: 8px 18px;
            border: 2px solid var(--feezal-eink-fg, #000);
            border-radius: 0;
            font-size: 14px;
            font-family: inherit;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            cursor: pointer;
        }
        .dialog-btn-ok {
            background: var(--feezal-eink-fg, #000);
            color: var(--feezal-eink-bg, #fff);
        }
        .dialog-btn-cancel {
            background: var(--feezal-eink-bg, #fff);
            color: var(--feezal-eink-fg, #000);
        }
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
        // E57: NOT reactive — a republished message goes through
        // requestUpdate() and the renderSignature() dedup instead.
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
            console.error('[feezal-eink-dialog] template error:', err.message);
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
                // _msg is non-reactive — poke the eink dedup pipeline
                // (renders only if the visible output actually changed).
                this.requestUpdate();
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

    /** Mirror the host's --feezal-eink-* vars (style-inspector overrides)
     * onto the portal root outside this shadow tree. */
    _syncEinkTokens() {
        const cs = getComputedStyle(this);
        for (const t of EINK_TOKENS) {
            const v = cs.getPropertyValue(`--feezal-eink-${t}`).trim();
            if (v) this._portal.style.setProperty(`--feezal-eink-${t}`, v);
        }
    }

    /** E57 redraw dedup: open-state + everything visible inside the dialog. */
    renderSignature() {
        return [this._open, this.dialogTitle, this.icon, this._evalTemplate(),
            this.okLabel, this.cancelLabel, this.showClose, this.hideHeader].join('|');
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
                        this._portal.setAttribute('feezal-eink-dialog-portal', '');
                    }
                    document.body.appendChild(this._portal);
                    this._syncEinkTokens();
                    render(this._renderPortalContent(), this._portal);
                } else {
                    this._clearPortal();
                }
            } else if (this._open && this._portal) {
                // B25: keep the open portal in sync with live property changes
                // (title / show-close / hide-header / a new message's template).
                this._syncEinkTokens();
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
     * B25: unified header bar — title + top-right ✕ — matching Dialog View.
     * hide-header removes the bar entirely; otherwise it shows when a title
     * or the close affordance (show-close, default on) is present. The portal
     * defines the same class names in its own <style>, so one template serves
     * both the editor preview (shadow) and the viewer portal.
     */
    _headerTemplate() {
        if (this.hideHeader) return html``;
        if (!this.dialogTitle && !this.showClose) return html``;
        const closeBtn = this.showClose
            ? html`<button class="dialog-close" title="Close" @click=${() => this._close()}>close</button>`
            : html``;
        return html`<div class="dialog-header"><span>${this.dialogTitle}</span><span class="spacer"></span>${closeBtn}</div>`;
    }

    _panelTemplate() {
        // B24: explicit height / min-height so the dialog can be made taller
        // than its content (empty keeps the auto behaviour).
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
                ${this._headerTemplate()}
                <div class="dialog-body">${iconTpl}${msgTpl}</div>
                ${(this.okLabel || this.cancelLabel) ? html`<div class="dialog-footer">${cancelTpl}${okTpl}</div>` : html``}
            </div>`;
    }

    _renderPortalContent() {
        return html`
            <style>
                [feezal-eink-dialog-portal] * { box-sizing: border-box; }
                /* E57: no animation, ever. */
                [feezal-eink-dialog-portal] *, [feezal-eink-dialog-portal] *::before, [feezal-eink-dialog-portal] *::after {
                    transition: none !important; animation: none !important; box-shadow: none !important;
                }
                [feezal-eink-dialog-portal] .backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9998;
                }
                [feezal-eink-dialog-portal] .dialog-panel {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    max-width: calc(100vw - 32px);
                    background: var(--feezal-eink-bg, #fff);
                    color: var(--feezal-eink-fg, #000);
                    border: max(3px, var(--feezal-eink-rule, 3px)) solid var(--feezal-eink-fg, #000);
                    border-radius: var(--feezal-eink-radius, 0px);
                    display: flex; flex-direction: column; overflow: hidden;
                    font-family: var(--feezal-eink-font, ui-monospace, 'Cascadia Mono', 'Roboto Mono', 'Courier New', monospace);
                    font-weight: 700;
                }
                [feezal-eink-dialog-portal] .dialog-header {
                    display: flex; align-items: center; gap: 8px;
                    padding: 14px 18px 0; font-size: 16px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    color: var(--feezal-eink-fg, #000);
                }
                [feezal-eink-dialog-portal] .dialog-header .spacer { flex: 1; }
                [feezal-eink-dialog-portal] .dialog-close {
                    font-family: 'Material Icons'; font-style: normal; font-size: 20px; line-height: 1;
                    border: none; background: none; color: var(--feezal-eink-fg, #000);
                    cursor: pointer; padding: 2px;
                }
                [feezal-eink-dialog-portal] .dialog-body {
                    padding: 12px 18px; flex: 1; overflow-y: auto;
                    display: flex; flex-direction: column; align-items: center; gap: 8px;
                }
                [feezal-eink-dialog-portal] .dialog-icon {
                    font-size: 40px; font-style: normal; color: currentColor;
                }
                [feezal-eink-dialog-portal] .dialog-message {
                    font-size: 14px; line-height: 1.5; text-align: center;
                    color: var(--feezal-eink-fg, #000);
                }
                [feezal-eink-dialog-portal] .dialog-footer {
                    padding: 10px 18px 16px; display: flex; justify-content: flex-end; gap: 10px;
                }
                [feezal-eink-dialog-portal] .dialog-btn {
                    padding: 8px 18px; border: 2px solid var(--feezal-eink-fg, #000);
                    border-radius: 0; font-size: 14px; font-family: inherit; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
                }
                [feezal-eink-dialog-portal] .dialog-btn-ok {
                    background: var(--feezal-eink-fg, #000); color: var(--feezal-eink-bg, #fff);
                }
                [feezal-eink-dialog-portal] .dialog-btn-cancel {
                    background: var(--feezal-eink-bg, #fff); color: var(--feezal-eink-fg, #000);
                }
            </style>
            <div class="backdrop" @click=${() => this._handleBackdropClick()}></div>
            ${this._panelTemplate()}`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="card trigger">
                    <span class="label">Dialog</span>
                </div>
                ${this._open ? html`
                    <div class="backdrop" @click=${() => { this._open = false; }}></div>
                    ${this._panelTemplate()}` : html``}`;
        }

        // Viewer: the overlay is rendered into a document.body portal in updated()
        // so it is never clipped by a display:none view or a CSS transform context.
        return html``;
    }
}

customElements.define('feezal-element-eink-dialog', FeezalElementEinkDialog);

// ── Custom inspector ───────────────────────────────────────────────────────────

class FeezalElementEinkDialogInspector extends FeezalElement {
    static properties = {
        element: {attribute: false},
    };

    static styles = css`
        :host { display: block; padding: 12px; }

        .preview-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: 100%;
            padding: 8px 16px;
            margin-bottom: 16px;
            background: #222222;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s;
        }
        .preview-btn:hover { background: #000; }
        .preview-btn .icon {
            font-family: 'Material Icons';
            font-size: 16px;
            font-style: normal;
        }

        .section { margin-bottom: 12px; }
        .section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--feezal-color, #888);
            margin-bottom: 6px;
        }
        .row { margin-bottom: 6px; }
        .half-row { display: flex; gap: 8px; }
        .half-row > * { flex: 1; min-width: 0; }

        sl-input, sl-checkbox { width: 100%; }

        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-checkbox { color: var(--feezal-color, inherit); }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
    `;

    constructor() {
        super();
        this.element = null;
    }

    _set(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true,
            detail: {name, value},
        }));
    }

    render() {
        if (!this.element) return html``;
        const el = this.element;

        return html`
            <button class="preview-btn" @click=${() => { el._open = true; }}>
                <span class="icon">open_in_new</span> Preview Dialog
            </button>

            <div class="section">
                <div class="section-title">Trigger</div>
                <div class="row">
                    <feezal-topic-input label="subscribe" size="small"
                        .value=${el.subscribe || ''}
                        @sl-change=${e => this._set('subscribe', e.target.value)}>
                    </feezal-topic-input>
                </div>
                <div class="row half-row">
                    <sl-input label="payload-open" size="small" autocomplete="off"
                        .value=${el.payloadOpen || ''}
                        @sl-change=${e => this._set('payload-open', e.target.value)}>
                    </sl-input>
                    <sl-input label="payload-close" size="small" autocomplete="off"
                        .value=${el.payloadClose || ''}
                        @sl-change=${e => this._set('payload-close', e.target.value)}>
                    </sl-input>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Content</div>
                <div class="row">
                    <sl-input label="title" size="small" autocomplete="off"
                        .value=${el.dialogTitle || ''}
                        @sl-change=${e => this._set('title', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row">
                    <sl-input label="icon" size="small" autocomplete="off"
                        .value=${el.icon || ''}
                        @sl-change=${e => this._set('icon', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row">
                    <feezal-template-editor
                        label="template"
                        .value=${el.template || ''}
                        .variables=${['msg']}
                        .darkMode=${window.feezal?.app?._darkMode ?? false}
                        @feezal-change=${e => this._set('template', e.detail.value)}>
                    </feezal-template-editor>
                </div>
            </div>

            <div class="section">
                <div class="section-title">OK button</div>
                <div class="row">
                    <sl-input label="ok-label" size="small" autocomplete="off"
                        .value=${el.okLabel || ''}
                        @sl-change=${e => this._set('ok-label', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row half-row">
                    <feezal-topic-input label="ok-publish" size="small"
                        .value=${el.okPublish || ''}
                        @sl-change=${e => this._set('ok-publish', e.target.value)}>
                    </feezal-topic-input>
                    <sl-input label="ok-payload" size="small" autocomplete="off"
                        .value=${el.okPayload || ''}
                        @sl-change=${e => this._set('ok-payload', e.target.value)}>
                    </sl-input>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Cancel button</div>
                <div class="row">
                    <sl-input label="cancel-label" size="small" autocomplete="off"
                        .value=${el.cancelLabel || ''}
                        @sl-change=${e => this._set('cancel-label', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row half-row">
                    <feezal-topic-input label="cancel-publish" size="small"
                        .value=${el.cancelPublish || ''}
                        @sl-change=${e => this._set('cancel-publish', e.target.value)}>
                    </feezal-topic-input>
                    <sl-input label="cancel-payload" size="small" autocomplete="off"
                        .value=${el.cancelPayload || ''}
                        @sl-change=${e => this._set('cancel-payload', e.target.value)}>
                    </sl-input>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Layout</div>
                <div class="row half-row">
                    <sl-input label="width" size="small" autocomplete="off"
                        .value=${el.width || ''}
                        @sl-change=${e => this._set('width', e.target.value)}>
                    </sl-input>
                    <sl-input label="height" size="small" autocomplete="off" placeholder="auto"
                        .value=${el.height || ''}
                        @sl-change=${e => this._set('height', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row half-row">
                    <sl-input label="min-height" size="small" autocomplete="off" placeholder="auto"
                        .value=${el.minHeight || ''}
                        @sl-change=${e => this._set('min-height', e.target.value)}>
                    </sl-input>
                    <sl-input label="max-height" size="small" autocomplete="off"
                        .value=${el.maxHeight || ''}
                        @sl-change=${e => this._set('max-height', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row">
                    <sl-checkbox
                        ?checked=${el.closeOnBackdrop}
                        @sl-change=${e => this._set('close-on-backdrop', e.target.checked)}>
                        close-on-backdrop
                    </sl-checkbox>
                </div>
                <div class="row">
                    <sl-checkbox
                        ?checked=${el.showClose}
                        @sl-change=${e => this._set('show-close', e.target.checked)}>
                        show-close
                    </sl-checkbox>
                </div>
                <div class="row">
                    <sl-checkbox
                        ?checked=${el.hideHeader}
                        @sl-change=${e => this._set('hide-header', e.target.checked)}>
                        hide-header
                    </sl-checkbox>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-dialog-inspector', FeezalElementEinkDialogInspector);
export {FeezalElementEinkDialog, FeezalElementEinkDialogInspector};
