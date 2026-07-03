/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {render} from 'lit';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

/**
 * feezal-element-material-dialog
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas.
 * Opens a full-viewport modal dialog on an MQTT message (payload-open).
 * Closes on payload-close, backdrop click, ESC, or button press.
 *
 * In the editor a static open-state preview is rendered so the author
 * can see the dialog layout and button styling.
 */
class FeezalElementMaterialDialog extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Dialog', category: 'Material', color: '#4a6080'},
            description: 'Opens a modal dialog when an MQTT message is received. ' +
                'Supports ok/cancel buttons that each publish a configurable payload.',
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
                {name: 'width',            type: 'string',    default: '480px',  help: 'Dialog panel width.'},
                {name: 'max-height',       type: 'string',    default: '80vh',   help: 'Dialog panel max height.'},
            ],
            styles: ['top', 'left'],
            defaultStyle: {width: '120px', height: '40px'},
            inspector: 'feezal-element-material-dialog-inspector',
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
        width:           {type: String,  reflect: true},
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

        /* ── Dialog overlay ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9998;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: var(--primary-background-color, #fff);
            color: var(--primary-text-color, #333);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: feezal-dialog-in 0.18s ease;
        }
        @keyframes feezal-dialog-in {
            from { opacity:0; transform: translate(-50%, -48%); }
            to   { opacity:1; transform: translate(-50%, -50%); }
        }
        .dialog-header {
            padding: 16px 20px 0;
            font-size: 16px;
            font-weight: 600;
            font-family: 'Roboto', sans-serif;
            color: var(--primary-text-color, #333);
        }
        .dialog-body {
            padding: 12px 20px;
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
            color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
        }
        .dialog-message {
            font-size: 14px;
            line-height: 1.5;
            color: var(--primary-text-color, #555);
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
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.15s;
        }
        .dialog-btn-ok {
            background: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            color: #fff;
        }
        .dialog-btn-ok:hover { filter: brightness(0.85); }
        .dialog-btn-cancel {
            background: var(--secondary-background-color, #e0e0e0);
            color: var(--primary-text-color, #333);
        }
        .dialog-btn-cancel:hover { filter: brightness(0.9); }
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
        this.width         = '480px';
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
            console.error('[feezal-dialog] template error:', err.message);
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
        if (!feezal.isEditor && changed.has('_open')) {
            if (this._open) {
                if (!this._portal) {
                    this._portal = document.createElement('div');
                    this._portal.setAttribute('feezal-dialog-portal', '');
                }
                document.body.appendChild(this._portal);
                render(this._renderPortalContent(), this._portal);
            } else {
                this._clearPortal();
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

    _renderPortalContent() {
        const panelStyle = [
            `width:${this.width || '480px'}`,
            'max-width:calc(100vw - 32px)',
            `max-height:${this.maxHeight || '80vh'}`,
            'position:fixed',
            'top:50%',
            'left:50%',
            'transform:translate(-50%,-50%)',
            'z-index:9999',
            'background:var(--primary-background-color,#fff)',
            'color:var(--primary-text-color,#333)',
            'border-radius:8px',
            'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
            'display:flex',
            'flex-direction:column',
            'overflow:hidden',
        ].join(';');

        const iconTpl = this.icon
            ? html`<feezal-icon style="font-size:40px;color:var(--primary-color,var(--sl-color-primary-600,#0284c7));" name="${this.icon}"></feezal-icon>`
            : html``;
        const body = this._evalTemplate();
        const msgTpl = body
            ? html`<div style="font-size:14px;line-height:1.5;color:var(--primary-text-color,#555);text-align:center;">${unsafeHTML(body)}</div>`
            : html``;
        const btnBase = 'padding:8px 18px;border:none;border-radius:4px;font-size:14px;font-family:Roboto,sans-serif;cursor:pointer;font-weight:500;';
        const okTpl = this.okLabel
            ? html`<button style="${btnBase}background:var(--primary-color,var(--sl-color-primary-600,#0284c7));color:#fff;" @click=${() => this._handleOk()}>${this.okLabel}</button>`
            : html``;
        const cancelTpl = this.cancelLabel
            ? html`<button style="${btnBase}background:var(--secondary-background-color,#e0e0e0);color:var(--primary-text-color,#333);" @click=${() => this._handleCancel()}>${this.cancelLabel}</button>`
            : html``;

        return html`
            <style>[feezal-dialog-portal] button{transition:filter .15s}[feezal-dialog-portal] button:hover{filter:brightness(0.85)}</style>
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;"
                 @click=${() => this._handleBackdropClick()}></div>
            <div style="${panelStyle}">
                ${this.dialogTitle ? html`<div style="padding:16px 20px 0;font-size:16px;font-weight:600;font-family:Roboto,sans-serif;">${this.dialogTitle}</div>` : html``}
                <div style="padding:12px 20px;flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:Roboto,sans-serif;">
                    ${iconTpl}${msgTpl}
                </div>
                ${(this.okLabel || this.cancelLabel)
                    ? html`<div style="padding:8px 20px 16px;display:flex;justify-content:flex-end;gap:8px;">${cancelTpl}${okTpl}</div>`
                    : html``}
            </div>`;
    }

    _renderDialogPanel() {
        const panelStyle = `width:${this.width || '480px'};max-height:${this.maxHeight || '80vh'};`;

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
                ${this.dialogTitle ? html`<div class="dialog-header">${this.dialogTitle}</div>` : html``}
                <div class="dialog-body">${iconTpl}${msgTpl}</div>
                ${(this.okLabel || this.cancelLabel) ? html`<div class="dialog-footer">${cancelTpl}${okTpl}</div>` : html``}
            </div>`;
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
                    ${this._renderDialogPanel()}` : html``}`;
        }

        // Viewer: the overlay is rendered into a document.body portal in updated()
        // so it is never clipped by a display:none view or a CSS transform context.
        return html``;
    }
}

customElements.define('feezal-element-material-dialog', FeezalElementMaterialDialog);

// ── Custom inspector ───────────────────────────────────────────────────────────

class FeezalElementMaterialDialogInspector extends FeezalElement {
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
            background: #4a6080;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s;
        }
        .preview-btn:hover { background: #3a5070; }
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
                    <sl-input label="subscribe" size="small" autocomplete="off"
                        .value=${el.subscribe || ''}
                        @sl-change=${e => this._set('subscribe', e.target.value)}>
                    </sl-input>
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
                    <sl-input label="ok-publish" size="small" autocomplete="off"
                        .value=${el.okPublish || ''}
                        @sl-change=${e => this._set('ok-publish', e.target.value)}>
                    </sl-input>
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
                    <sl-input label="cancel-publish" size="small" autocomplete="off"
                        .value=${el.cancelPublish || ''}
                        @sl-change=${e => this._set('cancel-publish', e.target.value)}>
                    </sl-input>
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
            </div>
        `;
    }
}

customElements.define('feezal-element-material-dialog-inspector', FeezalElementMaterialDialogInspector);
export {FeezalElementMaterialDialog, FeezalElementMaterialDialogInspector};
