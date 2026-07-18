/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {render} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-glass-dialog (E101)
 *
 * Frosted-glass sibling of feezal-element-material-dialog — SAME attribute
 * contract (topics, payloads, ok/cancel buttons, B24 sizing, B25 header
 * behaviour), restyled with the glass family chrome: translucent blurred
 * panel, squircle corners, dimmed backdrop.
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas.
 * Opens a full-viewport modal dialog on an MQTT message (payload-open).
 * Closes on payload-close, backdrop click, ESC, or button press.
 *
 * Family conventions (frost vars, degrade, squircle): see glass-button.
 */

// Glass chrome vars mirrored from the host onto the body portal (the portal
// lives outside this shadow tree, so per-element style-inspector overrides
// would not cascade to it otherwise; theme-level :root vars reach it anyway).
const GLASS_TOKENS = ['tint', 'border', 'blur', 'radius', 'color', 'muted', 'accent', 'solid'];

class FeezalElementGlassDialog extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Dialog', category: 'Glass', color: '#7aa5c9'},
            description: 'Frosted-glass modal dialog opened by an MQTT message. ' +
                'Supports ok/cancel buttons that each publish a configurable payload. ' +
                'Same wiring contract as the material Dialog.',
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
                {name: 'show-close',       type: 'boolean',   default: true,     help: 'Show a top-right ✕ close affordance (same as Dialog View).'},
                {name: 'hide-header',      type: 'boolean',   default: false,    help: 'Hide the header bar (title + ✕) entirely, regardless of title/show-close. (Default-false boolean so the setting survives save/reload.)'},
                {name: 'width',            type: 'string',    default: '480px',  help: 'Dialog panel width.'},
                {name: 'height',           type: 'string',    default: '',       help: 'Dialog panel height. Empty: auto (content height).'},
                {name: 'min-height',       type: 'string',    default: '',       help: 'Dialog panel minimum height — raises the floor so a dialog with little content does not collapse.'},
                {name: 'max-height',       type: 'string',    default: '80vh',   help: 'Dialog panel max height.'},
                {name: 'degrade',          type: 'boolean',   default: false,    help: 'Replace the live backdrop blur with a semi-opaque solid panel — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'OK button / icon accent colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint of the panel (defaults from the theme).'},
            ],
            defaultStyle: {width: '120px', height: '40px'},
            inspector: 'feezal-element-glass-dialog-inspector',
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
        degrade:         {type: Boolean, reflect: true},
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

        /* ── Dialog overlay (editor preview) — frosted glass panel ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.35);
            z-index: 9998;
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
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: feezal-glass-dialog-in 0.18s ease;
        }
        @supports (corner-shape: squircle) { .dialog-panel { corner-shape: squircle; } }
        :host([degrade]) .dialog-panel {
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
            background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
        }
        @keyframes feezal-glass-dialog-in {
            from { opacity:0; transform: translate(-50%, -48%); }
            to   { opacity:1; transform: translate(-50%, -50%); }
        }
        .dialog-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 16px 20px 0;
            font-size: 16px;
            font-weight: 700;
            color: var(--feezal-glass-color, #1d1d1f);
        }
        .dialog-header .spacer { flex: 1; }
        .dialog-close {
            font-family: 'Material Icons';
            font-style: normal;
            font-size: 20px;
            line-height: 1;
            border: none;
            background: none;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            cursor: pointer;
            padding: 2px;
            border-radius: 50%;
        }
        .dialog-close:hover { background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent); }
        .dialog-body {
            padding: 12px 20px;
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
            color: var(--feezal-glass-accent, #ff9f0a);
        }
        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: var(--feezal-glass-color, #1d1d1f);
            text-align: center;
        }
        .dialog-footer {
            padding: 8px 20px 16px;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .dialog-btn {
            padding: 8px 18px;
            border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
            border-radius: 14px;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            font-weight: 600;
            transition: filter 0.15s;
        }
        .dialog-btn:hover { filter: brightness(0.9); }
        .dialog-btn-ok {
            background: var(--feezal-glass-accent, #ff9f0a);
            border-color: transparent;
            color: #fff;
        }
        .dialog-btn-cancel {
            background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 10%, transparent);
            color: var(--feezal-glass-color, #1d1d1f);
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
        this.degrade       = false;
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
            console.error('[feezal-glass-dialog] template error:', err.message);
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

    /** Mirror the host's --feezal-glass-* vars (style-inspector overrides)
     * plus the degrade flag onto the portal root outside this shadow tree. */
    _syncGlassTokens() {
        const cs = getComputedStyle(this);
        for (const t of GLASS_TOKENS) {
            const v = cs.getPropertyValue(`--feezal-glass-${t}`).trim();
            if (v) this._portal.style.setProperty(`--feezal-glass-${t}`, v);
        }
        this._portal.toggleAttribute('degrade', Boolean(this.degrade));
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
                        this._portal.setAttribute('feezal-glass-dialog-portal', '');
                    }
                    document.body.appendChild(this._portal);
                    this._syncGlassTokens();
                    render(this._renderPortalContent(), this._portal);
                } else {
                    this._clearPortal();
                }
            } else if (this._open && this._portal) {
                // B25: keep the open portal in sync with live property changes
                // (title / show-close / hide-header / a new message's template).
                this._syncGlassTokens();
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
                [feezal-glass-dialog-portal] * { box-sizing: border-box; }
                [feezal-glass-dialog-portal] .backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 9998;
                }
                [feezal-glass-dialog-portal] .dialog-panel {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    max-width: calc(100vw - 32px);
                    background: var(--feezal-glass-tint, rgba(255,255,255,0.7));
                    -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
                    backdrop-filter: blur(var(--feezal-glass-blur, 20px));
                    border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
                    color: var(--feezal-glass-color, #1d1d1f);
                    border-radius: var(--feezal-glass-radius, 24px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.3);
                    display: flex; flex-direction: column; overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    animation: feezal-glass-dialog-in 0.18s ease;
                }
                @supports (corner-shape: squircle) {
                    [feezal-glass-dialog-portal] .dialog-panel { corner-shape: squircle; }
                }
                [feezal-glass-dialog-portal][degrade] .dialog-panel {
                    -webkit-backdrop-filter: none; backdrop-filter: none;
                    background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
                }
                @keyframes feezal-glass-dialog-in {
                    from { opacity: 0; transform: translate(-50%, -48%); }
                    to   { opacity: 1; transform: translate(-50%, -50%); }
                }
                [feezal-glass-dialog-portal] .dialog-header {
                    display: flex; align-items: center; gap: 8px;
                    padding: 16px 20px 0; font-size: 16px; font-weight: 700;
                    color: var(--feezal-glass-color, #1d1d1f);
                }
                [feezal-glass-dialog-portal] .dialog-header .spacer { flex: 1; }
                [feezal-glass-dialog-portal] .dialog-close {
                    font-family: 'Material Icons'; font-style: normal; font-size: 20px; line-height: 1;
                    border: none; background: none; color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
                    cursor: pointer; padding: 2px; border-radius: 50%;
                }
                [feezal-glass-dialog-portal] .dialog-close:hover {
                    background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 8%, transparent);
                }
                [feezal-glass-dialog-portal] .dialog-body {
                    padding: 12px 20px; flex: 1; overflow-y: auto;
                    display: flex; flex-direction: column; align-items: center; gap: 8px;
                }
                [feezal-glass-dialog-portal] .dialog-icon {
                    font-size: 40px; font-style: normal;
                    color: var(--feezal-glass-accent, #ff9f0a);
                }
                [feezal-glass-dialog-portal] .dialog-message {
                    font-size: 14px; line-height: 1.5; text-align: center;
                    color: var(--feezal-glass-color, #1d1d1f);
                }
                [feezal-glass-dialog-portal] .dialog-footer {
                    padding: 8px 20px 16px; display: flex; justify-content: flex-end; gap: 8px;
                }
                [feezal-glass-dialog-portal] .dialog-btn {
                    padding: 8px 18px; border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
                    border-radius: 14px; font-size: 14px; font-family: inherit;
                    cursor: pointer; font-weight: 600; transition: filter .15s;
                }
                [feezal-glass-dialog-portal] .dialog-btn:hover { filter: brightness(0.9); }
                [feezal-glass-dialog-portal] .dialog-btn-ok {
                    background: var(--feezal-glass-accent, #ff9f0a); border-color: transparent; color: #fff;
                }
                [feezal-glass-dialog-portal] .dialog-btn-cancel {
                    background: color-mix(in srgb, var(--feezal-glass-color, #1d1d1f) 10%, transparent);
                    color: var(--feezal-glass-color, #1d1d1f);
                }
            </style>
            <div class="backdrop" @click=${() => this._handleBackdropClick()}></div>
            ${this._panelTemplate()}`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">chat</span>
                    <span>Dialog</span>
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

customElements.define('feezal-element-glass-dialog', FeezalElementGlassDialog);

// ── Custom inspector ───────────────────────────────────────────────────────────

class FeezalElementGlassDialogInspector extends FeezalElement {
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
            background: #7aa5c9;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s;
        }
        .preview-btn:hover { background: #6a95b9; }
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
                <div class="row">
                    <sl-checkbox
                        ?checked=${el.degrade}
                        @sl-change=${e => this._set('degrade', e.target.checked || null)}>
                        degrade (no live blur — weak GPUs)
                    </sl-checkbox>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-dialog-inspector', FeezalElementGlassDialogInspector);
export {FeezalElementGlassDialog, FeezalElementGlassDialogInspector};
