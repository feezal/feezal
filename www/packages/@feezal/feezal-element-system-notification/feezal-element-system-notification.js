/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@feezal/feezal-element/feezal-topic-input.js';
import {LitElement} from 'lit';

/**
 * feezal-element-system-notification (E53)
 *
 * Transient toast notifications driven by MQTT. A pseudo-element (System
 * category): invisible in the viewer, a small chip in the editor. Each message
 * on the subscribed topic shows a toast with severity styling and timeout.
 *
 * Toasts render in a shared host element appended to document.body — like the
 * material-dialog portal, this escapes display:none (inactive) views and
 * CSS-transformed ancestors, so notifications appear regardless of which view
 * is active. The element deliberately does NOT use dynamic-subscriptions:
 * notifications are a site-level concern, the subscription stays live always.
 *
 * Editor behaviour: live toasts are suppressed on the canvas; the custom
 * inspector provides a "Preview notification" button instead (same pattern as
 * material-dialog's dialog preview).
 */

const SEVERITIES = ['info', 'success', 'warning', 'error'];
const SEVERITY_ICONS = {info: 'info', success: 'check_circle', warning: 'warning', error: 'error'};

// ── Shared toast host (document.body portal) ────────────────────────────────

class FeezalNotificationToasts extends LitElement {
    static properties = {
        _toasts: {state: true},
    };

    static styles = css`
        :host {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            pointer-events: none;
            font-family: Roboto, sans-serif;
        }
        .toast {
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            min-width: 220px;
            max-width: 360px;
            padding: 10px 12px;
            border-radius: 6px;
            border-left: 4px solid var(--_sev);
            background: var(--secondary-background-color, #fff);
            color: var(--primary-text-color, #333);
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            box-sizing: border-box;
            animation: feezal-toast-in 0.18s ease;
        }
        @keyframes feezal-toast-in {
            from { opacity: 0; transform: translateX(24px); }
            to   { opacity: 1; transform: translateX(0); }
        }
        .toast.info    { --_sev: var(--info-color, #2196f3); }
        .toast.success { --_sev: var(--success-color, #4caf50); }
        .toast.warning { --_sev: var(--warning-color, #ff9800); }
        .toast.error   { --_sev: var(--error-color, #e53935); }
        .ticon {
            font-family: 'Material Icons';
            font-size: 20px;
            line-height: 1;
            margin-top: 1px;
            color: var(--_sev);
        }
        .body { flex: 1; min-width: 0; }
        .title { font-size: 13px; font-weight: 600; margin-bottom: 2px; overflow-wrap: break-word; }
        .text  { font-size: 13px; line-height: 1.4; overflow-wrap: break-word; white-space: pre-line; }
        .close {
            border: none;
            background: none;
            color: inherit;
            opacity: 0.55;
            cursor: pointer;
            font-size: 15px;
            line-height: 1;
            padding: 0;
            margin-top: 1px;
        }
        .close:hover { opacity: 1; }
    `;

    constructor() {
        super();
        this._toasts = [];
        this._seq = 0;
    }

    /**
     * Show a toast.
     * @param toast {title, text, severity, timeout (s, 0 = sticky), hideClose}
     * @param opts  {maxVisible, dedupe}
     */
    show(toast, {maxVisible = 4, dedupe = false} = {}) {
        this._syncTheme();

        if (dedupe) {
            const last = this._toasts[this._toasts.length - 1];
            if (last && last.text === toast.text && last.title === toast.title && last.severity === toast.severity) {
                return;
            }
        }

        const t = {...toast, id: ++this._seq};
        const max = Math.max(1, Number(maxVisible) || 4);
        const toasts = [...this._toasts, t];
        while (toasts.length > max) {
            clearTimeout(toasts.shift().timer);
        }

        if (t.timeout > 0) {
            t.timer = setTimeout(() => this.dismiss(t.id), t.timeout * 1000);
        }

        this._toasts = toasts;
    }

    dismiss(id) {
        const t = this._toasts.find(x => x.id === id);
        if (!t) {
            return;
        }
        clearTimeout(t.timer);
        this._toasts = this._toasts.filter(x => x.id !== id);
    }

    // The host lives on document.body, outside <feezal-site> where the theme
    // class is set — mirror that class here so the theme's CSS custom
    // properties (declared per-class in document.head) reach the toasts.
    _syncTheme() {
        const site = document.querySelector('feezal-site');
        const theme = site && [...site.classList].find(c => c.startsWith('feezal-theme-'));
        [...this.classList].filter(c => c.startsWith('feezal-theme-')).forEach(c => this.classList.remove(c));
        if (theme) {
            this.classList.add(theme);
        }
    }

    render() {
        return html`${this._toasts.map(t => html`
            <div class="toast ${SEVERITIES.includes(t.severity) ? t.severity : 'info'}">
                <span class="ticon">${SEVERITY_ICONS[t.severity] || SEVERITY_ICONS.info}</span>
                <div class="body">
                    ${t.title ? html`<div class="title">${t.title}</div>` : ''}
                    <div class="text">${t.text}</div>
                </div>
                ${t.hideClose ? '' : html`<button class="close" title="Dismiss" @click=${() => this.dismiss(t.id)}>&#10005;</button>`}
            </div>`)}`;
    }
}

customElements.define('feezal-notification-toasts', FeezalNotificationToasts);

// ── The element ─────────────────────────────────────────────────────────────

class FeezalElementSystemNotification extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Notification', category: 'System', color: '#455a64', icon: 'notifications'},
            description: 'Shows a transient toast notification for every message on the subscribed topic. ' +
                'Pseudo-element — position/size don\'t matter; toasts appear top-right regardless of the ' +
                'active view, so one element per site is enough.',
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic (wildcards allowed) whose messages become toasts.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the toast text within the MQTT message. Default "payload"; use e.g. "payload.message" for JSON payloads. Messages without a value at this path are ignored.'},
                {name: 'title', type: 'string', default: '', help: 'Static title line above the message. Empty = no title.'},
                {name: 'title-property', type: 'string', help: 'Dot-notation path to a per-message title within the message (overrides "title").'},
                {name: 'severity', type: 'select', options: SEVERITIES, default: 'info', help: 'Default severity styling.'},
                {name: 'severity-property', type: 'string', help: 'Dot-notation path to a per-message severity (info | success | warning | error) within the message.'},
                {name: 'timeout', type: 'number', default: 6, min: 0, help: 'Seconds until a toast dismisses itself. 0 = sticky until closed.'},
                {name: 'timeout-property', type: 'string', help: 'Dot-notation path to a per-message timeout (seconds) within the message.'},
                {name: 'hide-close', type: 'boolean', default: false, help: 'Hide the dismiss (×) button on toasts.'},
                {name: 'max-visible', type: 'number', default: 4, min: 1, help: 'Maximum number of toasts shown at once; the oldest is dropped.'},
                {name: 'dedupe', type: 'boolean', default: false, help: 'Suppress a toast that is identical to the most recent visible one.'},
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '140px', height: '40px'},
            inspector: 'feezal-element-system-notification-inspector',
        };
    }

    static properties = {
        toastTitle:       {type: String,  reflect: true, attribute: 'title'},
        titleProperty:    {type: String,  reflect: true, attribute: 'title-property'},
        severity:         {type: String,  reflect: true},
        severityProperty: {type: String,  reflect: true, attribute: 'severity-property'},
        timeout:          {type: Number,  reflect: true},
        timeoutProperty:  {type: String,  reflect: true, attribute: 'timeout-property'},
        hideClose:        {type: Boolean, reflect: true, attribute: 'hide-close'},
        maxVisible:       {type: Number,  reflect: true, attribute: 'max-visible'},
        dedupe:           {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; }

        /* Editor chip */
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; font-size: 11px; text-align: center;
            color: var(--secondary-text-color, #777);
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
        .ph .material-icons { font-family: 'Material Icons'; font-size: 16px; }
    `];

    /** Shared body-level toast host, created lazily on first use. */
    static get toastHost() {
        let host = document.querySelector('feezal-notification-toasts');
        if (!host) {
            host = document.createElement('feezal-notification-toasts');
            document.body.append(host);
        }
        return host;
    }

    constructor() {
        super();
        this.toastTitle = '';
        this.titleProperty = '';
        this.severity = 'info';
        this.severityProperty = '';
        this.timeout = 6;
        this.timeoutProperty = '';
        this.hideClose = false;
        this.maxVisible = 4;
        this.dedupe = false;
    }

    // Manual subscription management: the primary topic may be a wildcard, so
    // the base class's exact-topic control channel does not apply here.
    _subscribe() { /* managed manually */ }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => this._onMessage(msg));
        }
    }

    _onMessage(msg) {
        // E53 decision: no live toasts on the editor canvas — the inspector's
        // "Preview notification" button covers styling preview instead.
        if (feezal.isEditor) {
            return;
        }

        const text = this._str(this.getProperty(msg, this.messageProperty));
        if (text === undefined || text === '') {
            return;
        }

        const title = (this.titleProperty && this._str(this.getProperty(msg, this.titleProperty))) || this.toastTitle || '';

        FeezalElementSystemNotification.toastHost.show({
            title,
            text,
            severity: this._severityFor(msg),
            timeout: this._timeoutFor(msg),
            hideClose: this.hideClose,
        }, {maxVisible: this.maxVisible, dedupe: this.dedupe});
    }

    _str(v) {
        if (v === undefined || v === null) {
            return undefined;
        }
        return (typeof v === 'object') ? JSON.stringify(v) : String(v);
    }

    _severityFor(msg) {
        if (this.severityProperty) {
            let s = this.getProperty(msg, this.severityProperty);
            if (s !== undefined && s !== null) {
                s = String(s).toLowerCase();
                if (s === 'warn') s = 'warning';
                if (s === 'err' || s === 'danger') s = 'error';
                if (SEVERITIES.includes(s)) {
                    return s;
                }
            }
        }
        return SEVERITIES.includes(this.severity) ? this.severity : 'info';
    }

    _timeoutFor(msg) {
        if (this.timeoutProperty) {
            const t = Number(this.getProperty(msg, this.timeoutProperty));
            if (Number.isFinite(t) && t >= 0) {
                return t;
            }
        }
        const t = Number(this.timeout);
        return (Number.isFinite(t) && t >= 0) ? t : 6;
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="ph"><span class="material-icons">notifications</span> Notification</div>`;
        }
        // Viewer: invisible — toasts render in the shared document.body host.
        return html``;
    }
}

customElements.define('feezal-element-system-notification', FeezalElementSystemNotification);

// ── Custom inspector ─────────────────────────────────────────────────────────
// Editor-only: uses <sl-*> tags without importing Shoelace (loaded by the
// editor, never bundled into the viewer) — same pattern as material-dialog.

class FeezalElementSystemNotificationInspector extends FeezalElement {
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
            background: #607d8b;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s;
        }
        .preview-btn:hover { background: #506d7b; }
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
        .checks { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }

        sl-input, sl-select { width: 100%; }

        sl-input::part(form-control-label),
        sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-checkbox { color: var(--feezal-color, inherit); }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
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

    _preview() {
        const el = this.element;
        const timeout = Number(el.timeout);
        FeezalElementSystemNotification.toastHost.show({
            title: el.toastTitle || '',
            text: 'This is a preview notification',
            severity: SEVERITIES.includes(el.severity) ? el.severity : 'info',
            timeout: (Number.isFinite(timeout) && timeout >= 0) ? timeout : 6,
            hideClose: false,   // preview toasts are always dismissible
        }, {maxVisible: el.maxVisible || 4, dedupe: false});
    }

    render() {
        if (!this.element) {
            return html``;
        }
        const el = this.element;

        return html`
            <button class="preview-btn" @click=${() => this._preview()}>
                <span class="icon">notifications</span> Preview Notification
            </button>

            <div class="section">
                <div class="section-title">Trigger</div>
                <div class="row">
                    <feezal-topic-input label="subscribe" size="small"
                        .value=${el.subscribe || ''}
                        @sl-change=${e => this._set('subscribe', e.target.value)}>
                    </feezal-topic-input>
                </div>
                <div class="row">
                    <sl-input label="message-property" size="small" autocomplete="off"
                        placeholder="payload"
                        .value=${el.messageProperty === 'payload' ? '' : (el.messageProperty || '')}
                        @sl-change=${e => this._set('message-property', e.target.value || 'payload')}>
                    </sl-input>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Content</div>
                <div class="row half-row">
                    <sl-input label="title" size="small" autocomplete="off"
                        .value=${el.toastTitle || ''}
                        @sl-change=${e => this._set('title', e.target.value)}>
                    </sl-input>
                    <sl-input label="title-property" size="small" autocomplete="off"
                        .value=${el.titleProperty || ''}
                        @sl-change=${e => this._set('title-property', e.target.value)}>
                    </sl-input>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Behaviour</div>
                <div class="row half-row">
                    <sl-select label="severity" size="small"
                        .value=${SEVERITIES.includes(el.severity) ? el.severity : 'info'}
                        @sl-change=${e => this._set('severity', e.target.value)}>
                        ${SEVERITIES.map(s => html`<sl-option value=${s}>${s}</sl-option>`)}
                    </sl-select>
                    <sl-input label="severity-property" size="small" autocomplete="off"
                        .value=${el.severityProperty || ''}
                        @sl-change=${e => this._set('severity-property', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row half-row">
                    <sl-input label="timeout (s)" size="small" autocomplete="off" type="number" min="0"
                        .value=${String(el.timeout ?? 6)}
                        @sl-change=${e => this._set('timeout', e.target.value)}>
                    </sl-input>
                    <sl-input label="timeout-property" size="small" autocomplete="off"
                        .value=${el.timeoutProperty || ''}
                        @sl-change=${e => this._set('timeout-property', e.target.value)}>
                    </sl-input>
                </div>
                <div class="row">
                    <sl-input label="max-visible" size="small" autocomplete="off" type="number" min="1"
                        .value=${String(el.maxVisible ?? 4)}
                        @sl-change=${e => this._set('max-visible', e.target.value)}>
                    </sl-input>
                </div>
                <div class="checks">
                    <sl-checkbox size="small" ?checked=${el.dedupe}
                        @sl-change=${e => this._set('dedupe', e.target.checked)}>
                        Suppress consecutive identical toasts
                    </sl-checkbox>
                    <sl-checkbox size="small" ?checked=${el.hideClose}
                        @sl-change=${e => this._set('hide-close', e.target.checked)}>
                        Hide the dismiss (×) button
                    </sl-checkbox>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-element-system-notification-inspector', FeezalElementSystemNotificationInspector);

export {FeezalElementSystemNotification, FeezalNotificationToasts};
