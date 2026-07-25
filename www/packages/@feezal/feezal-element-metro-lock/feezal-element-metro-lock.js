/* global feezal */
import {html, css, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
import {LockController, lockAttributes, lockDiscoveryMap} from '@feezal/feezal-controller-lock';
import {feezalMovementStyles} from '@feezal/feezal-element/feezal-movement.js';
import {MetroTileBase} from '@feezal/feezal-metro';

/**
 * feezal-element-metro-lock (E143)
 *
 * Metro smart-door-lock tile — a view over the shared LockController. The tile
 * face is display-only (accent while locked, amber while unlocked, error while
 * jammed/faulted); the back carries the Lock / Unlock / Open actions so an
 * accidental tap can't unlock the door. Open is offered only when configured
 * (Homematic locks). Same MQTT contract as the circle/glass lock cards.
 */

const STATE_ICON = {locked: 'lock', unlocked: 'lock_open', jammed: 'lock'};

class FeezalElementMetroLock extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Lock', category: 'Metro', color: '#1ba1e2', icon: 'lock'},
            description: 'Metro smart-door-lock tile: locked / unlocked / jammed state colour; the back has Lock / Unlock / Open buttons. Same MQTT contract as the circle lock card.',
            // E137: the discovery map is the controller package's fragment.
            discovery: {component: 'lock', map: lockDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                // E137: the shared lock contract — declared ONCE by the controller
                // (incl. the E135 error signal + E124 battery trio).
                ...lockAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                // E141: LOCKED defaults to the family accent; all three states overridable.
                {property: '--feezal-metro-locked-color',   type: 'color', default: 'var(--feezal-metro-accent)',    help: 'Tile colour while locked (defaults to the family accent).'},
                {property: '--feezal-metro-unlocked-color', type: 'color', default: 'var(--warning-color, #f0a30a)', help: 'Tile colour while unlocked.'},
                {property: '--feezal-metro-jammed-color',   type: 'color', default: 'var(--error-color, #e51400)',  help: 'Tile colour while jammed / faulted.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        payloadLock:     {type: String, reflect: true, attribute: 'payload-lock'},
        payloadUnlock:   {type: String, reflect: true, attribute: 'payload-unlock'},
        payloadOpen:     {type: String, reflect: true, attribute: 'payload-open'},
        payloadLocked:   {type: String, reflect: true, attribute: 'payload-locked'},
        payloadUnlocked: {type: String, reflect: true, attribute: 'payload-unlocked'},
        payloadJammed:   {type: String, reflect: true, attribute: 'payload-jammed'},
        publish:         {type: String, reflect: true},
        publishOpen:     {type: String, reflect: true, attribute: 'publish-open'},
        subscribeError:  {type: String, reflect: true, attribute: 'subscribe-error'},
        // N31: availability + subscribe/message-property inherited from FeezalElement.
        discoveryId:     {type: String, reflect: true, attribute: 'discovery-id'},
        // E154: movement contract (declared so a live attribute edit triggers
        // updated() -> rewireIfChanged()).
        subscribeDirection: {type: String, reflect: true, attribute: 'subscribe-direction'},
        msgPropDirection:   {type: String, reflect: true, attribute: 'message-property-direction'},
        payloadDirectionLock:   {type: String, reflect: true, attribute: 'payload-direction-lock'},
        payloadDirectionUnlock: {type: String, reflect: true, attribute: 'payload-direction-unlock'},
        movementTimeout:    {type: String, reflect: true, attribute: 'movement-timeout'},
    };

    static styles = [feezalBatteryStyles, MetroTileBase.styles, feezalMovementStyles, css`
        :host {
            --feezal-metro-locked-color:   var(--feezal-metro-accent);
            --feezal-metro-unlocked-color: var(--warning-color, #f0a30a);
            --feezal-metro-jammed-color:   var(--error-color, #e51400);
        }
        .face { transition: background 0.15s; }
        :host([data-state='locked'])   .face { background: var(--feezal-metro-locked-color); }
        :host([data-state='unlocked']) .face { background: var(--feezal-metro-unlocked-color); }
        :host([data-state='jammed'])   .face { background: var(--feezal-metro-jammed-color); }
        .front { cursor: default; }
        .state { font-size: var(--_metro-unit-size); text-transform: lowercase; opacity: 0.85; }   /* E129 */
        .err-line { font-size: calc(var(--_metro-unit-size) * 0.8); opacity: 0.9; max-width: 92%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `];

    constructor() {
        super();
        this.payloadLock = 'LOCK';
        this.payloadUnlock = 'UNLOCK';
        this.payloadOpen = '';
        this.payloadLocked = 'LOCKED';
        this.payloadUnlocked = 'UNLOCKED';
        this.payloadJammed = 'JAMMED';
        this.publish = '';
        this.publishOpen = '';
        this.subscribeError = '';
        this.discoveryId = '';
        // E154
        this.subscribeDirection = '';
        this.msgPropDirection = '';
        this.payloadDirectionLock = '';
        this.payloadDirectionUnlock = '';
        this.movementTimeout = '';
        // E137: the behavior layer — wires/parses/publishes; this view renders.
        this.lock = new LockController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.lock.rewireIfChanged();
        this.setAttribute('data-state', this.lock.faulted ? 'jammed' : (this.lock.state ?? 'locked'));
    }

    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const disp = this.lock.faulted ? 'jammed' : (this.lock.state ?? 'locked');
        // E154: the transitional text + a pulsing icon while the motor turns.
        const stateText = this.lock.movementText || this.lock.state || 'lock';
        return html`
            ${batteryLowBadge(this.lock.batteryLow)}
            <feezal-icon class="${this.lock.moving ? 'feezal-moving' : ''}"
                name="${STATE_ICON[disp] || 'lock'}"></feezal-icon>
            <div class="state">${stateText}</div>
            ${this.lock.error ? html`<div class="err-line" title="${this.lock.error}">⚠ ${this.lock.error}</div>` : ''}`;
    }

    renderBack() {
        if (!this.publish && !this.publishOpen) return null;
        return html`
            <button class="mbtn ${this.lock.locked ? 'active' : ''}" @click="${() => this.lock.lock()}">Lock</button>
            <button class="mbtn ${this.lock.unlocked ? 'active' : ''}" @click="${() => this.lock.unlock()}">Unlock</button>
            ${this.lock.canOpen ? html`<button class="mbtn" @click="${() => this.lock.open()}">Open</button>` : ''}`;
    }
}

customElements.define('feezal-element-metro-lock', FeezalElementMetroLock);
export {FeezalElementMetroLock};
