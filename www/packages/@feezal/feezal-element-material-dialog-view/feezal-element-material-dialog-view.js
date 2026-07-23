/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {render} from 'lit';

/**
 * feezal-element-material-dialog-view (E48)
 *
 * A modal dialog whose body is a live feezal *view* (not an HTML template).
 * The view-embedding sibling of feezal-element-material-dialog: it clones the
 * chosen `<feezal-view name>` (like feezal-element-layout-view) so the embedded
 * elements keep their normal lifecycle and MQTT bindings while shown modally.
 *
 * Pseudo-element: a ~120×40 px placeholder on the canvas. Opens on an MQTT
 * message (payload-open); closes on payload-close, backdrop click, ESC, the ✕
 * affordance, or the optional OK/Cancel buttons.
 *
 * In the viewer the overlay is rendered into a document.body portal so it is
 * never clipped by a display:none view or a CSS-transformed canvas ancestor —
 * and because feezal.views only queries inside feezal.app, the cloned view in
 * the portal never interferes with navigation.
 *
 * Panel sizing/chrome is themeable via --feezal-dialog-view-* custom
 * properties (see :host below); the `width` / `max-height` attributes are
 * convenience shorthands that set the matching property.
 */

// Custom-property token suffixes copied from the host onto the body portal
// (the portal lives outside this element's shadow tree, so :host props don't
// cascade to it — we mirror them explicitly).
const SIZE_TOKENS = ['width', 'height', 'min-height', 'max-width', 'max-height', 'radius', 'padding', 'background', 'backdrop'];

class FeezalElementMaterialDialogView extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Dialog View', category: 'Material', color: '#4a6080'},
            description: 'Opens a modal dialog showing a feezal view (with its live elements) when an ' +
                'MQTT message is received. A view-based alternative to the template-body Dialog element.',
            attributes: [
                {name: 'view',              dropdown: 'views',                    label: 'View', help: 'The feezal view rendered as the dialog body.'},
                {name: 'title',             type: 'string',    default: '',       help: 'Dialog title text. Header hidden when empty.'},
                {name: 'subscribe',         type: 'mqttTopic',                    help: 'Topic to listen on for open/close payloads.'},
                {name: 'payload-open',      type: 'string',    default: 'open',   help: 'Payload that opens the dialog.'},
                {name: 'payload-close',     type: 'string',    default: 'close',  help: 'Payload that closes the dialog silently.'},
                {name: 'ok-label',          type: 'string',    default: '',       help: 'OK button label. Hidden when empty.'},
                {name: 'ok-publish',        type: 'mqttTopic',                    help: 'Topic published when OK is pressed. If empty, closes silently.'},
                {name: 'ok-payload',        type: 'string',    default: 'ok',     help: 'Payload published when OK is pressed.'},
                {name: 'cancel-label',      type: 'string',    default: '',       help: 'Cancel button label. Hidden when empty.'},
                {name: 'cancel-publish',    type: 'mqttTopic',                    help: 'Topic published when Cancel is pressed. If empty, closes silently.'},
                {name: 'cancel-payload',    type: 'string',    default: 'cancel', help: 'Payload published when Cancel is pressed.'},
                {name: 'close-on-backdrop', type: 'boolean',   default: true,     help: 'Close the dialog when the backdrop is clicked.'},
                {name: 'show-close',        type: 'boolean',   default: true,     help: 'Show a top-right ✕ close affordance.'},
                {name: 'hide-header',       type: 'boolean',   default: false,    help: 'Hide the header bar (title + ✕) entirely, regardless of title/show-close. (Default-false boolean so the setting survives save/reload.)'},
                {name: 'width',             type: 'string',    default: '',       help: 'Convenience: sets --feezal-dialog-view-width (e.g. "600px").'},
                {name: 'height',            type: 'string',    default: '',       help: 'Convenience: sets --feezal-dialog-view-height (e.g. "400px"). Empty: auto (content height).'},
                {name: 'min-height',        type: 'string',    default: '',       help: 'Convenience: sets --feezal-dialog-view-min-height (e.g. "300px") — raises the floor so a dialog with little content does not collapse.'},
                {name: 'max-height',        type: 'string',    default: '',       help: 'Convenience: sets --feezal-dialog-view-max-height (e.g. "85vh").'},
            ],
            baseAttribute: 'view',
            styles: ['top', 'left'],
            defaultStyle: {width: '120px', height: '40px'},
            inspector: 'feezal-element-material-dialog-view-inspector',
        };
    }

    static properties = {
        view:            {type: String,  reflect: true},
        dialogTitle:     {type: String,  reflect: true, attribute: 'title'},
        subscribe:       {type: String,  reflect: true},
        payloadOpen:     {type: String,  reflect: true, attribute: 'payload-open'},
        payloadClose:    {type: String,  reflect: true, attribute: 'payload-close'},
        okLabel:         {type: String,  reflect: true, attribute: 'ok-label'},
        okPublish:       {type: String,  reflect: true, attribute: 'ok-publish'},
        okPayload:       {type: String,  reflect: true, attribute: 'ok-payload'},
        cancelLabel:     {type: String,  reflect: true, attribute: 'cancel-label'},
        cancelPublish:   {type: String,  reflect: true, attribute: 'cancel-publish'},
        cancelPayload:   {type: String,  reflect: true, attribute: 'cancel-payload'},
        closeOnBackdrop: {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'close-on-backdrop'},
        showClose:       {type: Boolean, reflect: true, converter: feezalBoolean, attribute: 'show-close'},
        hideHeader:      {type: Boolean, reflect: true, attribute: 'hide-header'},
        width:           {type: String,  reflect: true},
        height:          {type: String,  reflect: true},
        minHeight:       {type: String,  reflect: true, attribute: 'min-height'},
        maxHeight:       {type: String,  reflect: true, attribute: 'max-height'},
        _open:           {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block;
            overflow: visible;

            /* ── Exposed panel sizing / chrome (E48) ── */
            --feezal-dialog-view-width: 600px;
            --feezal-dialog-view-height: auto;
            --feezal-dialog-view-min-height: auto;
            --feezal-dialog-view-max-width: calc(100vw - 32px);
            --feezal-dialog-view-max-height: 85vh;
            --feezal-dialog-view-radius: 8px;
            --feezal-dialog-view-padding: 0px;
            --feezal-dialog-view-background: var(--md-sys-color-surface, var(--primary-background-color, #fff));
            --feezal-dialog-view-backdrop: rgba(0,0,0,0.5);
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

        /* ── Editor preview (static — no live clone) ── */
        .backdrop {
            position: fixed;
            inset: 0;
            background: var(--feezal-dialog-view-backdrop, rgba(0,0,0,0.5));
            z-index: 9998;
        }
        .dialog-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            width: var(--feezal-dialog-view-width, 600px);
            height: var(--feezal-dialog-view-height, auto);
            min-height: var(--feezal-dialog-view-min-height, auto);
            max-width: var(--feezal-dialog-view-max-width, calc(100vw - 32px));
            max-height: var(--feezal-dialog-view-max-height, 85vh);
            background: var(--feezal-dialog-view-background, #fff);
            color: var(--primary-text-color, #333);
            border-radius: var(--feezal-dialog-view-radius, 8px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .dialog-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 16px 10px;
            font-size: 16px;
            font-weight: 600;
            font-family: 'Roboto', sans-serif;
            color: var(--primary-text-color, #333);
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
            flex: 1;
            overflow: auto;
            padding: var(--feezal-dialog-view-padding, 0px);
            position: relative;
        }
        .preview-note {
            width: 100%;
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            color: #607d8b;
            opacity: 0.85;
            background-image:
                linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%),
                linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            box-sizing: border-box;
        }
        .dialog-footer {
            padding: 8px 16px 14px;
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
        this.view          = '';
        this.dialogTitle   = '';
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
        this.width         = '';
        this.height        = '';
        this.minHeight     = '';
        this.maxHeight     = '';
        this._open         = false;
        this._portal       = null;
    }

    // Prevent the base class from subscribing via subscribe/# — managed manually.
    _subscribe() { /* managed manually */ }

    connectedCallback() {
        super.connectedCallback();

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const payload = (msg && typeof msg === 'object') ? msg.payload : msg;
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
                    this._openPortal();
                } else {
                    this._clearPortal();
                }
            } else if (this._open && this._portal) {
                // B25: keep the open portal's chrome in sync with live property
                // changes (title / show-close / hide-header / sizing). Only the
                // lit template re-renders — the imperatively injected view
                // clone in .dialog-body is left untouched.
                this._syncTokens();
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

    /** Mirror the host's --feezal-dialog-view-* props onto the portal root so
     * the panel (outside this shadow tree) can resolve them, applying the
     * width / max-height convenience attributes on top. */
    _syncTokens() {
        const cs = getComputedStyle(this);
        for (const t of SIZE_TOKENS) {
            const v = cs.getPropertyValue(`--feezal-dialog-view-${t}`).trim();
            if (v) this._portal.style.setProperty(`--feezal-dialog-view-${t}`, v);
        }
        if (this.width) this._portal.style.setProperty('--feezal-dialog-view-width', this.width);
        if (this.height) this._portal.style.setProperty('--feezal-dialog-view-height', this.height);
        if (this.minHeight) this._portal.style.setProperty('--feezal-dialog-view-min-height', this.minHeight);
        if (this.maxHeight) this._portal.style.setProperty('--feezal-dialog-view-max-height', this.maxHeight);
    }

    /** Build a live clone of the target view, or return an {error} sentinel. */
    _buildViewClone() {
        if (!this.view) return {error: 'No view selected.'};

        // Recursion guard: a dialog-view must not embed the view it lives on.
        const hostViewName = this.closest('feezal-view')?.getAttribute('name');
        if (hostViewName && hostViewName === this.view) {
            return {error: `Dialog View cannot embed its own view ("${this.view}").`};
        }

        const src = feezal.site && feezal.site.querySelector(`feezal-view[name="${this.view}"]`);
        if (!src) return {error: `View "${this.view}" not found.`};

        const clone = src.cloneNode(true);
        // The source view may be inactive → carry a display:none from
        // feezal-site.updateVisibility(); clear it so the embedded copy shows.
        clone.style.display = '';
        // Give absolutely-positioned child elements a containing block.
        if (!clone.style.position) clone.style.position = 'relative';
        // Make sure the embedded elements go live even if they use
        // dynamic-subscriptions (which gate on `visible`).
        clone.querySelectorAll('*').forEach(el => {
            if (el.tagName.startsWith('FEEZAL-ELEMENT-')) el.visible = true;
        });
        return {clone};
    }

    _openPortal() {
        if (!this._portal) {
            this._portal = document.createElement('div');
            this._portal.setAttribute('feezal-dialog-view-portal', '');
        }
        document.body.appendChild(this._portal);
        this._syncTokens();
        render(this._renderPortalContent(), this._portal);

        // Imperatively inject the cloned view (a DOM node, not a lit template).
        const body = this._portal.querySelector('.dialog-body');
        if (body) {
            const {clone, error} = this._buildViewClone();
            if (clone) {
                body.replaceChildren(clone);
            } else {
                const note = document.createElement('div');
                note.className = 'preview-note';
                note.textContent = error;
                body.replaceChildren(note);
            }
        }
    }

    _footerTemplate(handlerScope) {
        const ok = this.okLabel
            ? html`<button class="dialog-btn dialog-btn-ok" @click=${() => handlerScope._handleOk()}>${this.okLabel}</button>`
            : html``;
        const cancel = this.cancelLabel
            ? html`<button class="dialog-btn dialog-btn-cancel" @click=${() => handlerScope._handleCancel()}>${this.cancelLabel}</button>`
            : html``;
        return (this.okLabel || this.cancelLabel)
            ? html`<div class="dialog-footer">${cancel}${ok}</div>`
            : html``;
    }

    _headerTemplate() {
        // B25: hide-header removes the whole bar, regardless of
        // title/show-close; otherwise the bar shows when either is set.
        // (Default-false boolean — a default-true one could never persist
        // its "off" state: Lit reflects constructor defaults, so the absent
        // attribute would flip back to true on reload.)
        if (this.hideHeader) return html``;
        const closeBtn = this.showClose
            ? html`<button class="dialog-close" title="Close" @click=${() => this._close()}>close</button>`
            : html``;
        if (!this.dialogTitle && !this.showClose) return html``;
        return html`
            <div class="dialog-header">
                <span>${this.dialogTitle}</span>
                <span class="spacer"></span>
                ${closeBtn}
            </div>`;
    }

    /** Portal content — the .dialog-body is filled imperatively in _openPortal(). */
    _renderPortalContent() {
        return html`
            <style>
                [feezal-dialog-view-portal] * { box-sizing: border-box; }
                [feezal-dialog-view-portal] .backdrop {
                    position: fixed; inset: 0;
                    background: var(--feezal-dialog-view-backdrop, rgba(0,0,0,0.5)); z-index: 9998;
                }
                [feezal-dialog-view-portal] .dialog-panel {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;
                    width: var(--feezal-dialog-view-width, 600px);
                    height: var(--feezal-dialog-view-height, auto);
                    min-height: var(--feezal-dialog-view-min-height, auto);
                    max-width: var(--feezal-dialog-view-max-width, calc(100vw - 32px));
                    max-height: var(--feezal-dialog-view-max-height, 85vh);
                    background: var(--feezal-dialog-view-background, #fff);
                    color: var(--primary-text-color, #333);
                    border-radius: var(--feezal-dialog-view-radius, 8px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    display: flex; flex-direction: column; overflow: hidden;
                    animation: feezal-dialog-view-in 0.18s ease;
                }
                @keyframes feezal-dialog-view-in {
                    from { opacity: 0; transform: translate(-50%, -48%); }
                    to   { opacity: 1; transform: translate(-50%, -50%); }
                }
                [feezal-dialog-view-portal] .dialog-header {
                    display: flex; align-items: center; gap: 8px;
                    padding: 14px 16px 10px; font-size: 16px; font-weight: 600;
                    font-family: 'Roboto', sans-serif; color: var(--primary-text-color, #333);
                }
                [feezal-dialog-view-portal] .dialog-header .spacer { flex: 1; }
                [feezal-dialog-view-portal] .dialog-close {
                    font-family: 'Material Icons'; font-style: normal; font-size: 20px; line-height: 1;
                    border: none; background: none; color: var(--secondary-text-color, #777);
                    cursor: pointer; padding: 2px; border-radius: 50%;
                }
                [feezal-dialog-view-portal] .dialog-close:hover { background: rgba(0,0,0,0.08); }
                [feezal-dialog-view-portal] .dialog-body {
                    flex: 1; overflow: auto; padding: var(--feezal-dialog-view-padding, 0px); position: relative;
                }
                [feezal-dialog-view-portal] .preview-note {
                    width: 100%; min-height: 120px; display: flex; align-items: center; justify-content: center;
                    font-family: 'Roboto', sans-serif; font-size: 13px; color: #607d8b; padding: 16px; text-align: center;
                }
                [feezal-dialog-view-portal] .dialog-footer {
                    padding: 8px 16px 14px; display: flex; justify-content: flex-end; gap: 8px;
                }
                [feezal-dialog-view-portal] .dialog-btn {
                    padding: 8px 18px; border: none; border-radius: 4px; font-size: 14px;
                    font-family: 'Roboto', sans-serif; cursor: pointer; font-weight: 500; transition: filter .15s;
                }
                [feezal-dialog-view-portal] .dialog-btn:hover { filter: brightness(0.88); }
                [feezal-dialog-view-portal] .dialog-btn-ok {
                    background: var(--primary-color, var(--sl-color-primary-600, #0284c7)); color: #fff;
                }
                [feezal-dialog-view-portal] .dialog-btn-cancel {
                    background: var(--secondary-background-color, #e0e0e0); color: var(--primary-text-color, #333);
                }
            </style>
            <div class="backdrop" @click=${() => this._handleBackdropClick()}></div>
            <div class="dialog-panel">
                ${this._headerTemplate()}
                <div class="dialog-body"></div>
                ${this._footerTemplate(this)}
            </div>`;
    }

    /** Editor preview panel — static (no live clone) to avoid duplicating live
     * elements onto the canvas; shows the selected view name. */
    _renderPreviewPanel() {
        const label = this.view
            ? html`<div class="preview-note">View: <b>&nbsp;${this.view}</b></div>`
            : html`<div class="preview-note">No view selected</div>`;
        return html`
            <div class="dialog-panel">
                ${this._headerTemplate()}
                <div class="dialog-body">${label}</div>
                ${this._footerTemplate(this)}
            </div>`;
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-placeholder">
                    <span class="icon">web_asset</span>
                    <span>Dialog View</span>
                </div>
                ${this._open ? html`
                    <div class="backdrop" @click=${() => { this._open = false; }}></div>
                    ${this._renderPreviewPanel()}` : html``}`;
        }

        // Viewer: overlay is rendered into a document.body portal in updated().
        return html``;
    }
}

customElements.define('feezal-element-material-dialog-view', FeezalElementMaterialDialogView);

// ── Custom inspector ───────────────────────────────────────────────────────────

class FeezalElementMaterialDialogViewInspector extends FeezalElement {
    static properties = {
        element: {attribute: false},
    };

    static styles = css`
        :host { display: block; padding: 12px; }

        .preview-btn {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            width: 100%; padding: 8px 16px; margin-bottom: 16px;
            background: #4a6080; color: #fff; border: none; border-radius: 4px;
            font-family: 'Roboto', sans-serif; font-size: 13px; font-weight: 500;
            cursor: pointer; transition: background 0.15s;
        }
        .preview-btn:hover { background: #3a5070; }
        .preview-btn .icon { font-family: 'Material Icons'; font-size: 16px; font-style: normal; }

        .section { margin-bottom: 12px; }
        .section-title {
            font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
            color: var(--feezal-color, #888); margin-bottom: 6px;
        }
        .row { margin-bottom: 6px; }
        .half-row { display: flex; gap: 8px; }
        .half-row > * { flex: 1; min-width: 0; }

        sl-input, sl-checkbox, sl-select { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-checkbox { color: var(--feezal-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
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

    _viewNames() {
        try {
            return [...window.feezal.views].map(v => v.getAttribute('name')).filter(Boolean);
        } catch {
            return [];
        }
    }

    render() {
        if (!this.element) return html``;
        const el = this.element;
        const views = this._viewNames();

        return html`
            <button class="preview-btn" @click=${() => { el._open = true; }}>
                <span class="icon">open_in_new</span> Preview Dialog
            </button>

            <div class="section">
                <div class="section-title">Content</div>
                <div class="row">
                    <sl-select label="view" size="small" hoist
                        .value=${el.view || ''}
                        @sl-change=${e => this._set('view', e.target.value)}>
                        ${views.map(n => html`<sl-option value=${n}>${n}</sl-option>`)}
                    </sl-select>
                </div>
                <div class="row">
                    <sl-input label="title" size="small" autocomplete="off"
                        .value=${el.dialogTitle || ''}
                        @sl-change=${e => this._set('title', e.target.value)}>
                    </sl-input>
                </div>
            </div>

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
                    <sl-input label="width" size="small" autocomplete="off" placeholder="600px"
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
                    <sl-input label="max-height" size="small" autocomplete="off" placeholder="85vh"
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

customElements.define('feezal-element-material-dialog-view-inspector', FeezalElementMaterialDialogViewInspector);
export {FeezalElementMaterialDialogView, FeezalElementMaterialDialogViewInspector};
