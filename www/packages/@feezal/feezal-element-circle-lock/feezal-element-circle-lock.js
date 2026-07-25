/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
import {LockController, lockAttributes, lockDiscoveryMap} from '@feezal/feezal-controller-lock';
import {feezalMovementStyles} from '@feezal/feezal-element/feezal-movement.js';
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
class FeezalElementCircleLock extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Lock', category: 'Circle', color: '#1565c0', icon: 'lock'},
            description: 'Smart door lock card — shows locked / unlocked / jammed state with a padlock SVG. Lock and unlock command buttons included.',
            // E137: behavior + discovery map come from the controller package.
            discovery: {component: 'lock', map: lockDiscoveryMap},
            attributes: [
                ...lockAttributes,
                {name: 'label',                  type: 'string', default: '',         help: 'Optional card label.'},
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
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
        publish:               {type: String, reflect: true},
        publishOpen:           {type: String, reflect: true, attribute: 'publish-open'},
        payloadLock:           {type: String, reflect: true, attribute: 'payload-lock'},
        payloadUnlock:         {type: String, reflect: true, attribute: 'payload-unlock'},
        payloadOpen:           {type: String, reflect: true, attribute: 'payload-open'},
        payloadLocked:         {type: String, reflect: true, attribute: 'payload-locked'},
        payloadUnlocked:       {type: String, reflect: true, attribute: 'payload-unlocked'},
        payloadJammed:         {type: String, reflect: true, attribute: 'payload-jammed'},
        subscribeError:        {type: String, reflect: true, attribute: 'subscribe-error'},
        label:                 {type: String, reflect: true},
        // N31: availability + subscribe/message-property inherited from FeezalElement.
        discoveryId:           {type: String, reflect: true, attribute: 'discovery-id'},
        // E154: movement contract (declared so a live attribute edit triggers
        // updated() -> rewireIfChanged()).
        subscribeDirection: {type: String, reflect: true, attribute: 'subscribe-direction'},
        msgPropDirection:   {type: String, reflect: true, attribute: 'message-property-direction'},
        payloadDirectionLock:   {type: String, reflect: true, attribute: 'payload-direction-lock'},
        payloadDirectionUnlock: {type: String, reflect: true, attribute: 'payload-direction-unlock'},
        movementTimeout:    {type: String, reflect: true, attribute: 'movement-timeout'},
    };

    static styles = [feezalBatteryStyles, feezalBaseStyles, feezalMovementStyles, css`
        /* E124: low-battery badge — top-left (opposite the top-right unavail). */
        .feezal-batt-badge { top: 4px; left: 4px; bottom: auto; right: auto; }
        .err-line {
            font-size: 9px; font-weight: 600; letter-spacing: 0.02em;
            color: var(--feezal-lock-jammed-color, #b00020);
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 4px;
            position: relative;
            container-type: inline-size;
            --feezal-lock-locked-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-lock-unlocked-color: var(--accent-color, var(--success-color, #4caf50));
            --feezal-lock-jammed-color:   var(--error-color, #b00020);
            --feezal-lock-text-color:     var(--primary-text-color, var(--feezal-color, #333));
            --feezal-lock-error-color:    var(--error-color, #b00020);
            /* E139: currentColor drives the neutral disc ring — anchor it to the
               text colour so the ring matches the other Circle cards. */
            color: var(--feezal-lock-text-color);
        }
        .unavail {
            position: absolute; top: 4px; right: 4px;
            width: 18px; height: 18px;
            color: var(--feezal-lock-error-color);
            opacity: 0.8; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        /* E139: the padlock sits inside a circular disc — width-sized, top-anchored,
           concentric with the light/climate ring (square wrap, ~90% disc centred).
           The disc frame tints by lock state (unlocked = accent, jammed = error,
           locked = neutral); the padlock SVG keeps its own state colouring inside. */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc {
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            transition: background 0.2s ease, border-color 0.2s ease;
        }
        .disc.unlocked {
            border-color: var(--feezal-lock-unlocked-color);
            background: color-mix(in srgb, var(--feezal-lock-unlocked-color) 14%, transparent);
        }
        .disc.jammed {
            border-color: var(--feezal-lock-jammed-color);
            background: color-mix(in srgb, var(--feezal-lock-jammed-color) 14%, transparent);
        }
        svg.lock { width: 62%; height: 62%; display: block; overflow: visible; }
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
        this.publishOpen           = '';
        this.payloadOpen           = '';
        this.subscribeError        = '';
        this.label                 = '';
        this.discoveryId           = '';
        // E154
        this.subscribeDirection = '';
        this.msgPropDirection = '';
        this.payloadDirectionLock = '';
        this.payloadDirectionUnlock = '';
        this.movementTimeout = '';
        // E137: the behavior layer \u2014 wires/parses/publishes; this view renders.
        this.lock = new LockController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        // E137: live-canvas topic edits re-wire through the controller.
        this.lock.rewireIfChanged();
    }

    render() {
        // E135: a fault (jammed state OR an error signal) shows the jammed visual.
        const dispState = this.lock.faulted ? 'jammed' : (this.lock.state ?? 'locked');
        // E154: while the motor turns, the transitional text replaces the
        // resolved state and the disc pulses \u2014 no silent flip.
        const stateText = this.lock.movementText
            || (this.lock.state
                ? this.lock.state.charAt(0).toUpperCase() + this.lock.state.slice(1)
                : '\u2014');

        return html`
            ${!this._available ? html`<div class="unavail">${UNAVAIL}</div>` : ''}
            ${batteryLowBadge(this.lock.batteryLow)}
            <div class="disc-wrap">
                <div class="disc ${dispState} ${this.lock.moving ? 'feezal-moving' : ''}">
                    <svg class="lock" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        ${lockSvg(dispState)}
                    </svg>
                </div>
            </div>
            <span class="state-label">${stateText}</span>
            ${this.lock.error ? html`<span class="err-line" title="${this.lock.error}">\u26a0 ${this.lock.error}</span>` : ''}
            ${(this.publish || this.publishOpen) ? html`
                <div class="btn-row">
                    <button @click="${() => this.lock.lock()}">Lock</button>
                    <button @click="${() => this.lock.unlock()}">Unlock</button>
                    ${this.lock.canOpen ? html`<button @click="${() => this.lock.open()}">Open</button>` : ''}
                </div>
            ` : ''}
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-lock', FeezalElementCircleLock);
export {FeezalElementCircleLock};
