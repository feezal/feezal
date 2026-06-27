/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// ── Unavailability badge ─────────────────────────────────────────────────────
const UNAVAIL = html`<svg viewBox="0 0 24 24"><path fill="currentColor"
    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

// ── Padlock SVG ───────────────────────────────────────────────────────────────
// state: 'locked' | 'unlocked' | 'jammed' | null (unknown)
function lockSvg(state) {
    const isLocked   = state === 'locked';
    const isUnlocked = state === 'unlocked';
    const isJammed   = state === 'jammed';

    // Colour tokens
    const bodyCol = isJammed   ? 'var(--feezal-lock-jammed-color)'
                  : isUnlocked ? 'var(--feezal-lock-unlocked-color)'
                  : 'var(--feezal-lock-locked-color)';

    // Shackle sits in body when locked, raised when unlocked
    const shackleY2 = isUnlocked ? 18 : 28;

    return svg`
        <!-- shackle (U-shape) -->
        <path d="M21,${shackleY2} L21,16 A9,9 0 0,1 39,16 L39,${shackleY2}"
              fill="none" stroke="${bodyCol}" stroke-width="5"
              stroke-linecap="round" stroke-linejoin="round"/>
        <!-- lock body -->
        <rect x="13" y="28" width="34" height="28" rx="5"
              fill="${bodyCol}" fill-opacity="0.9"/>
        <!-- keyhole or jammed X -->
        ${isJammed ? svg`
            <line x1="22" y1="36" x2="38" y2="48" stroke="white" stroke-width="3" stroke-linecap="round"/>
            <line x1="38" y1="36" x2="22" y2="48" stroke="white" stroke-width="3" stroke-linecap="round"/>
        ` : svg`
            <circle cx="30" cy="39" r="4.5" fill="white" opacity="0.85"/>
            <line x1="30" y1="43.5" x2="30" y2="51" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
        `}`;
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialDoorLock extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Door lock', category: 'Device', color: '#1565c0', icon: 'lock'},
            description: 'Smart door lock card — shows locked / unlocked / jammed state with a padlock SVG. Lock and unlock command buttons included.',
            discovery: {
                component: 'lock',
                map: {
                    state_topic:           {attr: 'subscribe'},
                    command_topic:         {attr: 'publish'},
                    payload_lock:          {attr: 'payload-lock'},
                    payload_unlock:        {attr: 'payload-unlock'},
                    state_locked:          {attr: 'payload-locked'},
                    state_unlocked:        {attr: 'payload-unlocked'},
                    state_jammed:          {attr: 'payload-jammed'},
                    availability_topic:    {attr: 'subscribe-availability'},
                    payload_available:     {attr: 'payload-available'},
                    payload_not_available: {attr: 'payload-unavailable'},
                    name:                  'label',
                },
            },
            attributes: [
                {name: 'subscribe',              type: 'mqttTopic', help: 'Topic receiving the lock state.'},
                {name: 'publish',                type: 'mqttTopic', help: 'Topic to publish lock/unlock commands to.'},
                {name: 'payload-lock',           type: 'string', default: 'LOCK',     help: 'Command payload to lock.'},
                {name: 'payload-unlock',         type: 'string', default: 'UNLOCK',   help: 'Command payload to unlock.'},
                {name: 'payload-locked',         type: 'string', default: 'LOCKED',   help: 'State payload meaning locked.'},
                {name: 'payload-unlocked',       type: 'string', default: 'UNLOCKED', help: 'State payload meaning unlocked.'},
                {name: 'payload-jammed',         type: 'string', default: 'JAMMED',   help: 'State payload meaning jammed.'},
                {name: 'label',                  type: 'string', default: '',         help: 'Optional card label.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic.'},
                {name: 'payload-available',      type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable',    type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-lock-locked-color',   type: 'color', default: 'var(--primary-text-color)',    help: 'Padlock colour when locked.'},
                {property: '--feezal-lock-unlocked-color', type: 'color', default: 'var(--accent-color, #4caf50)', help: 'Padlock colour when unlocked.'},
                {property: '--feezal-lock-jammed-color',   type: 'color', default: 'var(--error-color, #b00020)',  help: 'Padlock colour when jammed.'},
                {property: '--feezal-lock-text-color',     type: 'color', default: 'var(--primary-text-color)',    help: 'Label and state text colour.'},
                {property: '--feezal-lock-error-color',    type: 'color', default: 'var(--error-color, #b00020)',  help: 'Unavailability badge colour.'},
            ],
            restrict:     {minWidth: 80, minHeight: 100},
            defaultStyle: {width: '120px', height: '160px'},
        };
    }

    static properties = {
        subscribe:             {type: String, reflect: true},
        publish:               {type: String, reflect: true},
        payloadLock:           {type: String, reflect: true, attribute: 'payload-lock'},
        payloadUnlock:         {type: String, reflect: true, attribute: 'payload-unlock'},
        payloadLocked:         {type: String, reflect: true, attribute: 'payload-locked'},
        payloadUnlocked:       {type: String, reflect: true, attribute: 'payload-unlocked'},
        payloadJammed:         {type: String, reflect: true, attribute: 'payload-jammed'},
        label:                 {type: String, reflect: true},
        subscribeAvailability: {type: String, reflect: true, attribute: 'subscribe-availability'},
        payloadAvailable:      {type: String, reflect: true, attribute: 'payload-available'},
        payloadUnavailable:    {type: String, reflect: true, attribute: 'payload-unavailable'},
        discoveryId:           {type: String, reflect: true, attribute: 'discovery-id'},
        _lockState: {state: true},   // 'locked' | 'unlocked' | 'jammed' | null
        _available: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;
            --feezal-lock-locked-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-lock-unlocked-color: var(--accent-color, var(--success-color, #4caf50));
            --feezal-lock-jammed-color:   var(--error-color, #b00020);
            --feezal-lock-text-color:     var(--primary-text-color, var(--feezal-color, #333));
            --feezal-lock-error-color:    var(--error-color, #b00020);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-lock-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .svg-wrap { flex: 1; width: 100%; min-height: 0; }
        svg.lock { width: 100%; height: 100%; display: block; overflow: visible; }
        .state-label {
            font-size: 11px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.06em; color: var(--feezal-lock-text-color);
        }
        .btn-row { display: flex; gap: 4px; align-items: center; }
        button {
            padding: 4px 10px; border: 1.5px solid currentColor; border-radius: 4px;
            background: transparent; cursor: pointer; font-size: 11px;
            color: var(--feezal-lock-text-color); font-weight: 600;
        }
        button:hover { opacity: 0.7; }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-lock-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe             = '';
        this.publish               = '';
        this.payloadLock           = 'LOCK';
        this.payloadUnlock         = 'UNLOCK';
        this.payloadLocked         = 'LOCKED';
        this.payloadUnlocked       = 'UNLOCKED';
        this.payloadJammed         = 'JAMMED';
        this.label                 = '';
        this.subscribeAvailability = '';
        this.payloadAvailable      = 'online';
        this.payloadUnavailable    = 'offline';
        this.discoveryId           = '';
        this._lockState = null;
        this._available = true;
    }

    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;

        if (this.subscribeAvailability) {
            this.addSubscription(this.subscribeAvailability, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* not JSON */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                const s = String(v).toLowerCase();
                this._available = String(v) === this.payloadAvailable ||
                    (s !== String(this.payloadUnavailable).toLowerCase() &&
                     s !== 'offline' && s !== 'false' && s !== '0' && s !== 'unavailable');
            });
        }

        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'string') {
                    try { const p = JSON.parse(v); if (p && 'state' in p) v = p.state; } catch { /* raw */ }
                } else if (v && typeof v === 'object' && 'state' in v) { v = v.state; }
                const s = String(v).toUpperCase();
                if      (s === this.payloadJammed.toUpperCase())   this._lockState = 'jammed';
                else if (s === this.payloadLocked.toUpperCase())   this._lockState = 'locked';
                else if (s === this.payloadUnlocked.toUpperCase()) this._lockState = 'unlocked';
                else this._lockState = null;
            });
        }
    }

    _cmd(payload) {
        if (this.publish) feezal.connection.pub(this.publish, payload);
    }

    render() {
        const stateText = this._lockState
            ? this._lockState.charAt(0).toUpperCase() + this._lockState.slice(1)
            : '\u2014';

        if (feezal.isEditor) {
            return html`
                <div class="svg-wrap">
                    <svg class="lock" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${lockSvg('locked')}
                    </svg>
                </div>
                ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
        }

        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            <div class="svg-wrap">
                <svg class="lock" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    ${lockSvg(this._lockState)}
                </svg>
            </div>
            <span class="state-label">${stateText}</span>
            ${this.publish ? html`
                <div class="btn-row">
                    <button @click="${() => this._cmd(this.payloadLock)}">Lock</button>
                    <button @click="${() => this._cmd(this.payloadUnlock)}">Unlock</button>
                </div>
            ` : ''}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-door-lock', FeezalElementMaterialDoorLock);
export {FeezalElementMaterialDoorLock};
