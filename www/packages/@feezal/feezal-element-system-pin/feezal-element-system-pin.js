/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-system-pin (E44)
 *
 * A pseudo-element (System category). In the editor it renders only a small
 * placeholder; in the viewer it renders a fullscreen PIN overlay that hides when
 * the correct PIN is entered. Because inactive views are display:none, the fixed
 * overlay is only visible while THIS element's view is the active one — so it
 * acts as a per-view lock.
 *
 * ⚠️ NOT REAL SECURITY. The PIN is present in the page source and the overlay
 * lives purely in the browser — anyone can read the PIN or remove the overlay
 * with dev tools. Use it as a casual guard on a shared/kiosk display, never to
 * protect anything sensitive. (Documented in the user guide.)
 */
class FeezalElementSystemPin extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Pin', category: 'System', color: '#455a64', icon: 'lock'},
            description: 'Covers the view with a PIN entry overlay in the viewer until the correct PIN is ' +
                'entered. Pseudo-element — position/size don\'t matter. NOT real security: the PIN is ' +
                'visible in the page source and the overlay is trivially bypassable.',
            attributes: [
                {name: 'pin', help: 'The PIN required to unlock. Visible in the page source — NOT real security.'},
                {name: 'prompt', default: 'Enter PIN', help: 'Text shown above the keypad.'},
                {name: 'remember', type: 'boolean', default: false, help: 'Stay unlocked for the rest of the browser session (survives reload).'},
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '140px', height: '40px'},
        };
    }

    static properties = {
        pin:      {type: String, reflect: true},
        prompt:   {type: String, reflect: true},
        remember: {type: Boolean, reflect: true},
        _entry:   {state: true},
        _error:   {state: true},
        _unlocked:{state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; }

        /* Editor placeholder */
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; font-size: 11px; text-align: center;
            color: var(--secondary-text-color, #777);
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .ph .material-icons { font-size: 16px; }

        /* Viewer overlay — shown in the browser's TOP LAYER via the popover
           API so it paints above ANY sibling stacking context (elements with
           a user-set z-index, transformed ancestors, …). In browsers without
           popover support the attribute is inert and the fixed+z-index rules
           below act as the fallback. Overrides of the [popover] UA defaults
           (margin/border/padding/size) keep it a full-viewport cover. */
        .overlay {
            position: fixed; inset: 0; z-index: 99999;
            width: auto; height: auto; margin: 0; border: 0; padding: 0; overflow: hidden;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
            background: var(--primary-background-color, #1b1b1b);
            color: var(--primary-text-color, #eee);
            font-family: inherit;
        }
        .overlay .prompt { font-size: 18px; opacity: 0.9; }
        .dots { display: flex; gap: 12px; height: 16px; align-items: center; }
        .dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; opacity: 0.55; box-sizing: border-box; }
        .dot.filled { background: currentColor; opacity: 1; }
        .keypad { display: grid; grid-template-columns: repeat(3, 68px); gap: 12px; }
        .key {
            height: 68px; border-radius: 50%; border: 1px solid var(--divider-color, rgba(128,128,128,0.4));
            background: rgba(128,128,128,0.12); color: inherit; font-size: 24px; cursor: pointer;
            display: flex; align-items: center; justify-content: center; user-select: none;
        }
        .key:hover { background: rgba(128,128,128,0.22); }
        .key:active { transform: scale(0.94); }
        .key.wide { font-size: 15px; }
        .key.blank { visibility: hidden; cursor: default; }
        .err { color: var(--error-color, #e53935); min-height: 16px; font-size: 13px; }
        .shake { animation: feezal-pin-shake 0.35s; }
        @keyframes feezal-pin-shake {
            0%,100% { transform: translateX(0); }
            20%,60% { transform: translateX(-8px); }
            40%,80% { transform: translateX(8px); }
        }
    `];

    constructor() {
        super();
        this.pin = '';
        this.prompt = 'Enter PIN';
        this.remember = false;
        this._entry = '';
        this._error = '';
        this._unlocked = false;
    }

    // Pseudo-element — no MQTT.
    _subscribe() { /* none */ }

    connectedCallback() {
        super.connectedCallback();
        // Restore a remembered unlock for this session.
        if (!feezal.isEditor && this.remember && this.pin && this._sessionKey()) {
            try {
                if (sessionStorage.getItem(this._sessionKey()) === '1') this._unlocked = true;
            } catch { /* sessionStorage unavailable */ }
        }
    }

    _sessionKey() {
        // Session flag keyed by the PIN so different locks don't share state.
        // (Storing a marker for the PIN, not the PIN itself — though it's no
        // secret anyway. Sufficient for a casual per-session unlock.)
        return this.pin ? 'feezal-pin:' + this.pin.length + ':' + this.pin : null;
    }

    _press(d) {
        if (this._entry.length >= 32) return;
        this._error = '';
        this._entry += d;
        if (this.pin && this._entry.length >= this.pin.length) this._check();
    }

    _clear() { this._entry = ''; this._error = ''; }

    _backspace() { this._entry = this._entry.slice(0, -1); this._error = ''; }

    _check() {
        if (this._entry === this.pin) {
            this._unlocked = true;
            if (this.remember && this._sessionKey()) {
                try { sessionStorage.setItem(this._sessionKey(), '1'); } catch { /* ignore */ }
            }
        } else {
            this._error = 'Wrong PIN';
            this._entry = '';
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="ph"><span class="material-icons">lock</span> PIN Lock</div>`;
        }
        // No PIN configured, or already unlocked → render nothing (fully transparent).
        if (!this.pin || this._unlocked) return html``;
        return this._renderOverlay();
    }

    updated(changed) {
        super.updated(changed);
        // Promote the overlay into the top layer. Removing it from the DOM
        // (unlock / no pin) dismisses the popover automatically, and an
        // ancestor turning display:none (inactive view) suppresses it too.
        const overlay = this.renderRoot.querySelector('.overlay');
        if (overlay && overlay.showPopover && !overlay.matches(':popover-open')) {
            try { overlay.showPopover(); } catch { /* fixed+z-index fallback */ }
        }
    }

    _renderOverlay() {
        const len = Math.max(this.pin.length, this._entry.length);
        const dots = [];
        for (let i = 0; i < len; i++) dots.push(i < this._entry.length);
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        return html`
            <div class="overlay" popover="manual">
                <div class="prompt">${this.prompt || 'Enter PIN'}</div>
                <div class="dots ${this._error ? 'shake' : ''}">
                    ${dots.map(f => html`<div class="dot ${f ? 'filled' : ''}"></div>`)}
                </div>
                <div class="keypad">
                    ${keys.map(k => html`<div class="key" @click="${() => this._press(k)}">${k}</div>`)}
                    <div class="key wide" @click="${this._clear}">clear</div>
                    <div class="key" @click="${() => this._press('0')}">0</div>
                    <div class="key wide" @click="${this._backspace}">&#9003;</div>
                </div>
                <div class="err">${this._error}</div>
            </div>`;
    }
}

customElements.define('feezal-element-system-pin', FeezalElementSystemPin);
export {FeezalElementSystemPin};
