/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {faultBadge, feezalFaultStyles} from '@feezal/feezal-element/feezal-hm-fault.js';
import {LockController, lockAttributes, lockDiscoveryMap} from '@feezal/feezal-controller-lock';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-lock (E139) — the shackle visibly lifts and swings
 * open on unlock; a jammed lock shakes. Tap toggles lock/unlock. Behavior =
 * the shared LockController (E137 / E143 / E144 — incl. the Keymatic OPEN
 * action and the E135 error badge).
 */
class FeezalElementFancyLock extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Lock', category: 'Fancy', color: '#7a5c9e', icon: 'lock'},
            description: 'Animated lock card — the shackle swings open on unlock, a jammed lock shakes. ' +
                'Tap toggles lock/unlock. Theme-recoloured duotone animation.',
            discovery: {component: 'lock', map: lockDiscoveryMap},
            attributes: [
                ...lockAttributes,
                ...fancyCommonAttributes,
                {name: 'text-locked',   type: 'string', default: '', defaultI18n: {de: 'Verriegelt', es: 'Bloqueado', fr: 'Verrouillé', it: 'Bloccato', pl: 'Zablokowany', pt: 'Trancado', tr: 'Kilitli'}, help: 'State word while locked. Blank = "Locked".'},
                {name: 'text-unlocked', type: 'string', default: '', defaultI18n: {de: 'Entriegelt', es: 'Desbloqueado', fr: 'Déverrouillé', it: 'Sbloccato', pl: 'Odblokowany', pt: 'Destrancado', tr: 'Kilit Açık'}, help: 'State word while unlocked. Blank = "Unlocked".'},
                {name: 'text-jammed',   type: 'string', default: '', defaultI18n: {de: 'Blockiert', es: 'Atascado', fr: 'Bloqué', it: 'Inceppato', pl: 'Zacięty', pt: 'Emperrado', tr: 'Sıkışmış'}, help: 'State word while jammed. Blank = "Jammed".'},
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Topic reporting device availability — a badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', section: 'Availability', default: 'payload', help: 'Property path within availability messages.'},
                {name: 'payload-available',   type: 'string', section: 'Availability', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', section: 'Availability', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: fancyStyleDescriptors,
            defaultStyle: {width: '140px', height: '150px'},
            restrict: {minWidth: 80, minHeight: 90},
        };
    }

    static properties = {
        subscribe:       {type: String, reflect: true},
        publish:         {type: String, reflect: true},
        payloadLocked:   {type: String, reflect: true, attribute: 'payload-locked'},
        payloadUnlocked: {type: String, reflect: true, attribute: 'payload-unlocked'},
        payloadJammed:   {type: String, reflect: true, attribute: 'payload-jammed'},
        textLocked:      {type: String, attribute: 'text-locked'},
        textUnlocked:    {type: String, attribute: 'text-unlocked'},
        textJammed:      {type: String, attribute: 'text-jammed'},
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
    };

    static styles = [...fancyBadgeStyles, feezalFaultStyles, fancyCardStyles, css`
        .stage { cursor: pointer; }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.publish = '';
        this.payloadLocked = 'LOCKED';
        this.payloadUnlocked = 'UNLOCKED';
        this.payloadJammed = 'JAMMED';
        this.textLocked = '';
        this.textUnlocked = '';
        this.textJammed = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.lock = new LockController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.lock.rewireIfChanged();
    }

    animationKey() { return 'lock'; }

    stateKey() { return this.lock.state || 'locked'; }

    stateText() {
        switch (this.lock.state) {
            case 'unlocked': return this.textUnlocked || 'Unlocked';
            case 'jammed':   return this.textJammed || 'Jammed';
            case 'locked':   return this.textLocked || 'Locked';
            default:         return '—';
        }
    }

    _tap() {
        if (feezal.isEditor) return;
        if (this.lock.state === 'unlocked') this.lock.lock();
        else this.lock.unlock();
    }

    renderPose() {
        const s = this.lock.state;
        const unlocked = s === 'unlocked';
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
            transform="${s === 'jammed' ? 'rotate(-4)' : ''}">
            <g class="${unlocked ? 'tone-active' : 'tone-base'}"
                transform="${unlocked ? 'translate(0 -10) rotate(28 64 44)' : ''}">
                <rect x="32" y="16" width="8" height="34" rx="4"/>
                <rect x="60" y="16" width="8" height="34" rx="4"/>
                <rect x="32" y="12" width="36" height="8" rx="4"/>
            </g>
            <rect class="tone-base" x="24" y="44" width="52" height="40" rx="6"/>
            <circle cx="50" cy="60" r="5" style="fill: var(--primary-background-color)"/>
            <rect x="48" y="62" width="4" height="10" rx="2" style="fill: var(--primary-background-color)"/>
        </svg>`;
    }

    renderBadges() {
        return html`
            ${batteryLowBadge(this.lock.batteryLow)}
            ${faultBadge(this.lock.error)}
        `;
    }

    render() {
        return html`<div @click="${() => this._tap()}">${super.render()}</div>`;
    }
}

customElements.define('feezal-element-fancy-lock', FeezalElementFancyLock);
export {FeezalElementFancyLock};
