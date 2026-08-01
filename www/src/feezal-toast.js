import {LitElement, html, css} from 'lit';
import {repeat} from 'lit/directives/repeat.js';

/**
 * U85 — the editor's notification channel.
 *
 * Before this, feedback was ad-hoc: a bespoke toast for the switch-family
 * report, another for reconnects, inline banners elsewhere — and the most
 * important message of all (a failed deploy, B98) had nowhere to go.
 *
 * One stacked, bottom-centre queue. Success/info auto-dismiss; warnings and
 * errors stay until dismissed (`duration: 0`) because they usually need an
 * action. An optional action button runs a callback and closes the toast.
 *
 * Usage from the editor shell:
 *   this.toast('Deployed', {variant: 'success'});
 *   this.toast(msg, {variant: 'danger', duration: 0,
 *                    action: {label: 'Retry', run: () => this._deploy()}});
 *
 * Styling deliberately uses the --feezal-* editor vars (set by
 * feezal-app-editor's dark-mode blocks) so dark mode needs no extra wiring.
 */

const DEFAULT_DURATION = 4000;
let _seq = 0;

class FeezalToast extends LitElement {
    static properties = {
        _items: {state: true},
    };

    static styles = css`
        :host {
            position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
            z-index: 20050;                 /* above dialogs (20002), below the connection overlay */
            display: flex; flex-direction: column; gap: 8px; align-items: center;
            pointer-events: none;           /* the stack never blocks the canvas */
        }
        .toast {
            pointer-events: auto;
            display: flex; align-items: center; gap: 12px;
            max-width: 560px; padding: 10px 14px; border-radius: 8px;
            font-size: 12.5px; line-height: 1.35;
            background: var(--feezal-bg, #fff); color: var(--feezal-color, #222);
            border: 1px solid var(--feezal-border, #d0d0d0);
            border-left-width: 4px;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
        }
        .toast.success { border-left-color: var(--success-color, #16a34a); }
        .toast.info    { border-left-color: var(--info-color, #0284c7); }
        .toast.warning { border-left-color: var(--warning-color, #f59e0b); }
        .toast.danger  { border-left-color: var(--error-color, #dc2626); }
        .msg { flex: 1; white-space: pre-wrap; word-break: break-word; }
        button {
            font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
            padding: 4px 10px; border-radius: 5px; flex: 0 0 auto;
            background: transparent; color: inherit;
            border: 1px solid var(--feezal-border, #d0d0d0);
        }
        button:hover {
            background: var(--feezal-btn-hover, rgba(0, 0, 0, 0.06));
            border-color: var(--feezal-btn-hover-border, var(--sl-color-primary-300, #7dd3fc));
            color: var(--feezal-btn-hover-color, inherit);
        }
        .close { border: 0; opacity: 0.6; font-size: 15px; line-height: 1; padding: 2px 4px; }
        .close:hover { opacity: 1; background: transparent; border: 0; }
        @media (prefers-reduced-motion: no-preference) {
            .toast { animation: rise 0.16s ease-out; }
            @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
        }
    `;

    constructor() {
        super();
        this._items = [];
        this._timers = new Map();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        for (const t of this._timers.values()) clearTimeout(t);
        this._timers.clear();
    }

    /**
     * @param {string} message
     * @param {{variant?: 'success'|'info'|'warning'|'danger', duration?: number,
     *          action?: {label: string, run: Function}}} [opts]
     *        duration 0 = sticky (the default for warning/danger).
     * @returns {number} the toast id (pass to dismiss()).
     */
    show(message, opts = {}) {
        const variant = opts.variant || 'info';
        const sticky = variant === 'danger' || variant === 'warning';
        const duration = opts.duration === undefined ? (sticky ? 0 : DEFAULT_DURATION) : opts.duration;
        const id = ++_seq;
        this._items = [...this._items, {id, message: String(message), variant, action: opts.action}];
        if (duration > 0) {
            this._timers.set(id, setTimeout(() => this.dismiss(id), duration));
        }
        return id;
    }

    dismiss(id) {
        clearTimeout(this._timers.get(id));
        this._timers.delete(id);
        this._items = this._items.filter(t => t.id !== id);
    }

    render() {
        return html`${repeat(this._items, t => t.id, t => html`
            <div class="toast ${t.variant}" role="${t.variant === 'danger' ? 'alert' : 'status'}">
                <span class="msg">${t.message}</span>
                ${t.action ? html`
                    <button @click="${() => { this.dismiss(t.id); t.action.run(); }}">${t.action.label}</button>` : ''}
                <button class="close" title="Dismiss" @click="${() => this.dismiss(t.id)}">✕</button>
            </div>`)}`;
    }
}

window.customElements.define('feezal-toast', FeezalToast);
export {FeezalToast};
