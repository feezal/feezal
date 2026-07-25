/* global feezal */
import {feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
import {LockController, lockAttributes, lockDiscoveryMap} from '@feezal/feezal-controller-lock';
import {feezalMovementStyles} from '@feezal/feezal-element/feezal-movement.js';
import {applySizePreset, glassCardStyles, glassPopupStyles, FeezalGlassCard} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-lock (E143)
 *
 * Frosted-glass smart-door-lock card — a view over the shared LockController.
 * Same MQTT contract as circle-lock (attribute names, payload matching,
 * jammed = fault, availability, HA `lock` discovery) — only the look differs.
 *
 * Interaction (Apple-Home style, like glass-light): **tap toggles** locked ↔
 * unlocked; **long-press or the ⋯ button** opens a details popup with the
 * explicit Lock / Unlock / Open actions.
 */

const STATE_ICON = {locked: 'lock', unlocked: 'lock_open', jammed: 'lock'};
const LONG_PRESS_MS = 450;

class FeezalElementGlassLock extends FeezalGlassCard {
    static get feezal() {
        return {
            palette: {name: 'Lock', category: 'Glass', color: '#7aa5c9', icon: 'lock'},
            description: 'Frosted-glass smart-door-lock card — locked / unlocked / jammed. Tap toggles lock/unlock; ' +
                'long-press (or the ⋯ button) opens a popup with the Lock / Unlock / Open actions. ' +
                'Same MQTT contract as the circle lock card.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'lock', map: lockDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                // E137: the shared lock contract — declared ONCE by the controller.
                ...lockAttributes,
                {name: 'label', type: 'string', help: 'Card label.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-locked-color',   type: 'color', default: 'var(--primary-text-color)',   help: 'Icon/state colour when locked.'},
                {property: '--feezal-glass-unlocked-color', type: 'color', default: 'var(--accent-color, #4caf50)', help: 'Icon/state colour when unlocked.'},
                {property: '--feezal-glass-jammed-color',   type: 'color', default: 'var(--error-color, #d32f2f)',  help: 'Icon/state colour when jammed.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '28px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-state', default: '15px', help: 'State line font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Details (⋯) button icon size.'},
            ],
            defaultStyle: {width: '172px', height: '150px'},
            restrict: {minWidth: 80, minHeight: 90},
        };
    }

    static properties = {
        size:            {type: String,  reflect: true},
        payloadLock:     {type: String,  reflect: true, attribute: 'payload-lock'},
        payloadUnlock:   {type: String,  reflect: true, attribute: 'payload-unlock'},
        payloadOpen:     {type: String,  reflect: true, attribute: 'payload-open'},
        payloadLocked:   {type: String,  reflect: true, attribute: 'payload-locked'},
        payloadUnlocked: {type: String,  reflect: true, attribute: 'payload-unlocked'},
        payloadJammed:   {type: String,  reflect: true, attribute: 'payload-jammed'},
        publish:         {type: String,  reflect: true},
        publishOpen:     {type: String,  reflect: true, attribute: 'publish-open'},
        subscribeError:  {type: String,  reflect: true, attribute: 'subscribe-error'},
        label:           {type: String,  reflect: true},
        // N31: availability + subscribe/message-property inherited from FeezalElement.
        discoveryId:     {type: String,  reflect: true, attribute: 'discovery-id'},
        // E154: movement contract (declared so a live attribute edit triggers
        // updated() -> rewireIfChanged()).
        subscribeDirection: {type: String, reflect: true, attribute: 'subscribe-direction'},
        msgPropDirection:   {type: String, reflect: true, attribute: 'message-property-direction'},
        payloadDirectionLock:   {type: String, reflect: true, attribute: 'payload-direction-lock'},
        payloadDirectionUnlock: {type: String, reflect: true, attribute: 'payload-direction-unlock'},
        movementTimeout:    {type: String, reflect: true, attribute: 'movement-timeout'},
        degrade:         {type: Boolean, reflect: true},
    };

    static styles = [feezalBatteryStyles, feezalBaseStyles, glassCardStyles, glassPopupStyles, feezalMovementStyles, css`
        .card {
            gap: 4px; cursor: pointer; touch-action: manipulation;
            transition: transform 0.15s ease, background 0.2s ease;
            --_state-color: var(--feezal-glass-locked-color, var(--feezal-glass-muted, rgba(29,29,31,0.75)));
        }
        .card:active { transform: scale(0.97); }
        .card.unlocked { --_state-color: var(--feezal-glass-unlocked-color, #4caf50); background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        .card.jammed   { --_state-color: var(--feezal-glass-jammed-color, #d32f2f);   background: var(--feezal-glass-on-tint, rgba(255,255,255,0.62)); }
        .err-line { font-size: 9px; font-weight: 600; color: var(--feezal-glass-jammed-color, #d32f2f); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 28px); line-height: 1; color: var(--_state-color); transition: color 0.2s ease; }
        .state { font-size: var(--feezal-glass-font-size-state, 15px); font-weight: 700; color: var(--_state-color); }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail {
            position: absolute; top: 8px; right: 10px;
            font-size: 12px; color: var(--error-color, #d32f2f); opacity: 0.85;
        }
        /* Popup actions — one full-width button per lock command. */
        .lock-actions { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
        .lock-actions button {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            padding: 9px 12px; border: 1.5px solid currentColor; border-radius: 12px;
            background: transparent; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600;
            color: var(--feezal-glass-color, #1d1d1f);
        }
        .lock-actions button:hover { background: var(--feezal-glass-on-tint, rgba(255,255,255,0.5)); }
        .lock-actions button feezal-icon { font-size: 18px; color: inherit; }
    `];

    constructor() {
        super();
        this.size = '';
        this.payloadLock = 'LOCK';
        this.payloadUnlock = 'UNLOCK';
        this.payloadOpen = '';
        this.payloadLocked = 'LOCKED';
        this.payloadUnlocked = 'UNLOCKED';
        this.payloadJammed = 'JAMMED';
        this.publish = '';
        this.publishOpen = '';
        this.subscribeError = '';
        this.label = '';
        this.discoveryId = '';
        // E154
        this.subscribeDirection = '';
        this.msgPropDirection = '';
        this.payloadDirectionLock = '';
        this.payloadDirectionUnlock = '';
        this.movementTimeout = '';
        this.degrade = false;
        this._pressTimer = null;
        this._longPressed = false;
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.lock = new LockController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.lock.rewireIfChanged();
        if (changed.has('size')) applySizePreset(this);
        // Promote the details popup into the top layer + position it (glass-light pattern).
        if (changed.has('_details') && this._details) {
            const popup = this.renderRoot.querySelector('.details');
            if (popup?.showPopover && !popup.matches(':popover-open')) {
                try { popup.showPopover(); } catch { /* fixed+z-index fallback */ }
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._pressTimer);
    }

    /** Any command topic configured → the card is interactive. */
    get _interactive() { return Boolean(this.publish || this.publishOpen); }

    /** Tap toggles: locked → unlock, everything else → lock. */
    _toggle() {
        if (feezal.isEditor || !this._interactive) return;
        if (this.lock.state === 'locked') this.lock.unlock();
        else this.lock.lock();
    }

    // ── interaction: tap toggles, long-press (or ⋯) opens the popup ──
    _onPointerDown() {
        if (feezal.isEditor || !this._interactive) return;
        this._longPressed = false;
        clearTimeout(this._pressTimer);
        this._pressTimer = setTimeout(() => {
            this._longPressed = true;
            this.openDetails();
        }, LONG_PRESS_MS);
    }

    _onPointerUp() {
        clearTimeout(this._pressTimer);
        if (this._suppressTap) { this._suppressTap = false; return; }
        if (!this._longPressed && !this._details) this._toggle();
    }

    _onPointerLeave() { clearTimeout(this._pressTimer); }

    _stateText() {
        // E154: the transitional text wins while the motor turns.
        if (this.lock.movementText) return this.lock.movementText;
        const s = this.lock.state;
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : (feezal.isEditor ? 'Lock' : '—');
    }

    _renderDetails() {
        return html`
            <div class="details" popover="manual">
                <div class="title">${this.label || 'Lock'}</div>
                <div class="lock-actions">
                    <button @click="${() => { this.lock.lock(); this._closeDetails(); }}">
                        <feezal-icon name="lock"></feezal-icon> Lock</button>
                    <button @click="${() => { this.lock.unlock(); this._closeDetails(); }}">
                        <feezal-icon name="lock_open"></feezal-icon> Unlock</button>
                    ${this.lock.canOpen ? html`
                        <button @click="${() => { this.lock.open(); this._closeDetails(); }}">
                            <feezal-icon name="meeting_room"></feezal-icon> Open</button>` : ''}
                </div>
            </div>`;
    }

    render() {
        // E135: a fault (jammed state OR error signal) shows the jammed visual.
        const disp = this.lock.faulted ? 'jammed' : (this.lock.state ?? '');
        return html`
            <div class="card ${disp}" role="button" tabindex="0"
                @pointerdown="${this._onPointerDown}"
                @pointerup="${this._onPointerUp}"
                @pointerleave="${this._onPointerLeave}"
                @keydown="${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._toggle(); } }}">
                ${this._interactive ? html`
                    <button class="flip-btn" title="Actions"
                        @pointerdown="${e => e.stopPropagation()}"
                        @pointerup="${e => e.stopPropagation()}"
                        @click="${e => { e.stopPropagation(); this.openDetails(); }}">tune</button>` : ''}
                ${!this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                ${batteryLowBadge(this.lock.batteryLow)}
                <feezal-icon class="${this.lock.moving ? 'feezal-moving' : ''}"
                    name="${STATE_ICON[disp] || 'lock'}"></feezal-icon>
                <span class="state">${this._stateText()}</span>
                ${this.lock.error ? html`<span class="err-line" title="${this.lock.error}">⚠ ${this.lock.error}</span>` : ''}
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
            </div>
            ${this._details ? this._renderDetails() : ''}
        `;
    }
}

customElements.define('feezal-element-glass-lock', FeezalElementGlassLock);
export {FeezalElementGlassLock};
