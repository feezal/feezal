import {LitElement, html, css} from 'lit';

/**
 * feezal-connection-overlay (U60)
 *
 * Editor-only feedback when the Socket.IO link to the feezal server drops.
 * The editor looks fully functional while disconnected, but nothing works —
 * no deploy, no save, no site/view load, no live MQTT. This surfaces that.
 *
 * Escalation (avoids nagging on the common transient blips a reconnect fixes
 * on its own): on `disconnected` we immediately show a subtle top banner; only
 * after GRACE_MS of continuous disconnection do we promote to a non-closable,
 * blocking modal (status + Retry now + Reload app). On `connected` we tear the
 * whole thing down automatically and flash a brief "reconnected" toast.
 *
 * Wired to `feezal.connection` (the events are `connected` — bubbles/composed —
 * and `disconnected`, dispatched on the connection element without bubbling, so
 * we listen on it directly). The observed target is injectable via `.connection`
 * for testing; it defaults to `window.feezal.connection`.
 *
 * Editor-bundle only; mounted once by the editor shell.
 */
class FeezalConnectionOverlay extends LitElement {
    /** Grace period before the subtle banner escalates to the blocking modal. */
    static GRACE_MS = 7000;
    /** How long the "reconnected" toast lingers. */
    static TOAST_MS = 2500;

    static properties = {
        connection: {type: Object},
        _state:     {state: true},   // 'ok' | 'grace' | 'lost'
        _elapsed:   {state: true},   // seconds since the drop
        _attempts:  {state: true},   // socket.io reconnect attempts (0 if unknown)
        _toast:     {state: true},   // show the transient "reconnected" toast
    };

    constructor() {
        super();
        this.connection = null;
        this._state = 'ok';
        this._elapsed = 0;
        this._attempts = 0;
        this._toast = false;
        this._graceTimer = null;
        this._elapsedTimer = null;
        this._toastTimer = null;
        this._lostAt = 0;
        this._onConnected = () => this._handleConnected();
        this._onDisconnected = () => this._handleDisconnected();
        this._onReconnectAttempt = n => { this._attempts = Number(n) || this._attempts + 1; };
    }

    connectedCallback() {
        super.connectedCallback();
        this._bind();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unbind();
        this._clearTimers();
    }

    /** Resolve and attach to the connection element (idempotent). */
    _bind() {
        const conn = this.connection || (typeof window !== 'undefined' && window.feezal?.connection) || null;
        if (!conn || conn === this._bound) return;
        this._unbind();
        this._bound = conn;
        conn.addEventListener('connected', this._onConnected);
        conn.addEventListener('disconnected', this._onDisconnected);
    }

    _unbind() {
        if (!this._bound) return;
        this._bound.removeEventListener('connected', this._onConnected);
        this._bound.removeEventListener('disconnected', this._onDisconnected);
        this._detachSocket();
        this._bound = null;
    }

    /** Socket.IO manager exposes reconnect attempts — attach if reachable. */
    _attachSocket() {
        const sock = this._bound?.conn?.socket;
        const mgr = sock?.io;
        if (mgr && mgr !== this._mgr && typeof mgr.on === 'function') {
            this._mgr = mgr;
            mgr.on('reconnect_attempt', this._onReconnectAttempt);
        }
    }

    _detachSocket() {
        if (this._mgr && typeof this._mgr.off === 'function') {
            this._mgr.off('reconnect_attempt', this._onReconnectAttempt);
        }
        this._mgr = null;
    }

    _clearTimers() {
        clearTimeout(this._graceTimer); this._graceTimer = null;
        clearInterval(this._elapsedTimer); this._elapsedTimer = null;
        clearTimeout(this._toastTimer); this._toastTimer = null;
    }

    _handleDisconnected() {
        if (this._state !== 'ok') return;   // already tracking this outage
        this._state = 'grace';
        this._attempts = 0;
        this._lostAt = Date.now();
        this._elapsed = 0;
        this._toast = false;
        this._attachSocket();
        this._elapsedTimer = setInterval(() => {
            this._elapsed = Math.round((Date.now() - this._lostAt) / 1000);
        }, 1000);
        this._graceTimer = setTimeout(() => { this._state = 'lost'; }, FeezalConnectionOverlay.GRACE_MS);
    }

    _handleConnected() {
        const wasDown = this._state !== 'ok';
        this._clearTimers();
        this._detachSocket();
        this._state = 'ok';
        if (wasDown) {
            this._toast = true;
            this._toastTimer = setTimeout(() => { this._toast = false; }, FeezalConnectionOverlay.TOAST_MS);
        }
    }

    _retry() {
        // Force an immediate reconnect attempt (Socket.IO), guarded for tests.
        try { this._bound?.conn?.socket?.connect(); } catch { /* noop */ }
    }

    _reload() {
        if (typeof window !== 'undefined') window.location.reload();
    }

    static styles = css`
        :host { position: fixed; inset: 0; z-index: 100000; pointer-events: none; }
        .banner {
            position: absolute; top: 0; left: 0; right: 0;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            padding: 6px 12px; font-size: 13px; font-weight: 600;
            color: #fff; background: var(--error-color);
            box-shadow: 0 1px 6px rgba(0,0,0,0.3); pointer-events: auto;
        }
        .dot {
            width: 9px; height: 9px; border-radius: 50%;
            background: #fff; animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }

        .backdrop {
            position: absolute; inset: 0; background: rgba(0,0,0,0.55);
            display: flex; align-items: center; justify-content: center; pointer-events: auto;
        }
        .modal {
            background: var(--primary-background-color);
            color: var(--primary-text-color);
            border-radius: 10px; padding: 24px 28px; max-width: 420px; width: calc(100% - 48px);
            box-shadow: 0 12px 48px rgba(0,0,0,0.4); text-align: center;
        }
        .modal h2 { margin: 0 0 6px; font-size: 18px; }
        .modal .status { font-size: 13px; opacity: 0.8; margin: 0 0 4px; }
        .modal .safe { font-size: 12px; opacity: 0.65; margin: 0 0 18px; }
        .actions { display: flex; gap: 10px; justify-content: center; }
        .actions button {
            font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
            padding: 8px 16px; border-radius: 6px; border: 1px solid var(--divider-color);
            background: var(--secondary-background-color); color: var(--primary-text-color);
        }
        .actions button.primary {
            background: var(--primary-color); border-color: var(--primary-color); color: #fff;
        }
        .toast {
            position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
            padding: 8px 16px; font-size: 13px; font-weight: 600; color: #fff;
            background: #2e7d32; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: auto;
        }
    `;

    render() {
        if (this._toast) {
            return html`<div class="toast" role="status">Reconnected to server</div>`;
        }
        if (this._state === 'ok') return html``;

        const banner = html`
            <div class="banner" role="status">
                <span class="dot"></span>
                Connection to server lost — reconnecting…
            </div>`;

        if (this._state === 'grace') return banner;

        // 'lost' → blocking modal (no ✕, no click-outside-to-close) + banner.
        const attempts = this._attempts > 0 ? ` · attempt ${this._attempts}` : '';
        return html`
            ${banner}
            <div class="backdrop">
                <div class="modal" role="alertdialog" aria-modal="true" aria-label="Connection to server lost">
                    <h2>Connection to server lost</h2>
                    <p class="status">Reconnecting… (${this._elapsed}s${attempts})</p>
                    <p class="safe">Your unsaved edits stay in this browser — deploy once the connection returns.</p>
                    <div class="actions">
                        <button class="primary" @click="${this._retry}">Retry now</button>
                        <button @click="${this._reload}">Reload app</button>
                    </div>
                </div>
            </div>`;
    }
}

window.customElements.define('feezal-connection-overlay', FeezalConnectionOverlay);

export {FeezalConnectionOverlay};
