/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {formatNumber} from '@feezal/feezal-element/feezal-locale.js';
import {ClimateController, climateAttributes, climateDiscoveryMap} from '@feezal/feezal-controller-climate';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

/**
 * feezal-element-fancy-climate (E139) — animated thermostat card: heat waves
 * rise from the radiator while it is heating (valve open, or setpoint above
 * actual when no valve topic is wired). Tap left/right of the stage steps the
 * setpoint. Behavior = the shared ClimateController (E137).
 */
class FeezalElementFancyClimate extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Fancy', color: '#7a5c9e', icon: 'thermostat'},
            description: 'Animated thermostat card — heat waves rise while heating. ' +
                'Shows actual → setpoint; tap left/right of the radiator to step the setpoint.',
            discovery: {component: 'climate', aliasComponents: ['water_heater'], map: climateDiscoveryMap},
            attributes: [
                ...climateAttributes,
                ...fancyCommonAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Topic reporting device availability — a badge appears while unavailable.'},
                {name: 'message-property-availability', type: 'string', section: 'Availability', default: 'payload', help: 'Property path within availability messages.'},
                {name: 'payload-available',   type: 'string', section: 'Availability', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', section: 'Availability', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: fancyStyleDescriptors,
            defaultStyle: {width: '150px', height: '160px'},
            restrict: {minWidth: 90, minHeight: 100},
        };
    }

    static properties = {
        subscribe:        {type: String, reflect: true},
        publish:          {type: String, reflect: true},
        payloadMode:      {type: String, reflect: true, attribute: 'payload-mode'},
        subscribeActual:  {type: String, reflect: true, attribute: 'subscribe-actual'},
        subscribeValve:   {type: String, reflect: true, attribute: 'subscribe-valve'},
        min:              {type: Number, reflect: true},
        max:              {type: Number, reflect: true},
        step:             {type: Number, reflect: true},
        unit:             {type: String, reflect: true},
    };

    static styles = [...fancyBadgeStyles, fancyCardStyles, css`
        .stage { cursor: pointer; }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.publish = '';
        this.subscribeActual = '';
        this.subscribeValve = '';
        this.min = 5;
        this.max = 30;
        this.step = 0.5;
        this.unit = '°C';
        this.climate = new ClimateController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.climate.rewireIfChanged();
    }

    animationKey() { return 'climate'; }

    _heating() {
        const c = this.climate;
        if (c.valve !== null && c.valve !== undefined) return c.valve > 0;
        const mode = String(c.mode || '').toLowerCase();
        if (mode === 'off') return false;
        return c.setpoint !== null && c.actual !== null && c.setpoint > c.actual;
    }

    stateKey() { return this._heating() ? 'heating' : 'idle'; }

    stateText() {
        const c = this.climate;
        const f = v => v === null || v === undefined ? '—' : formatNumber(v);
        return c.setpoint === null && c.actual === null ? '—'
            : `${f(c.actual)} → ${f(c.setpoint)}${this.unit}`;
    }

    _tap(e) {
        if (feezal.isEditor) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const right = (e.clientX - rect.left) >= rect.width / 2;
        const step = this.step || 0.5;
        const current = this.climate.setpoint ?? ((this.min + this.max) / 2);
        const next = Math.min(this.max, Math.max(this.min, current + (right ? step : -step)));
        this.climate.setSetpoint(next);
    }

    renderPose() {
        const heating = this._heating();
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            ${heating ? svg`
                <ellipse class="tone-active" cx="34" cy="30" rx="3.5" ry="8" opacity="0.9"/>
                <ellipse class="tone-active" cx="50" cy="24" rx="3.5" ry="8" opacity="0.7"/>
                <ellipse class="tone-active" cx="66" cy="30" rx="3.5" ry="8" opacity="0.9"/>
            ` : ''}
            <rect class="tone-base" x="21" y="45" width="10" height="34" rx="4"/>
            <rect class="tone-base" x="37" y="45" width="10" height="34" rx="4"/>
            <rect class="tone-base" x="53" y="45" width="10" height="34" rx="4"/>
            <rect class="tone-base" x="69" y="45" width="10" height="34" rx="4"/>
        </svg>`;
    }

    renderBadges() {
        return html`${batteryLowBadge(this.climate.batteryLow)}`;
    }

    render() {
        return html`<div @click="${e => this._tap(e)}">${super.render()}</div>`;
    }
}

customElements.define('feezal-element-fancy-climate', FeezalElementFancyClimate);
export {FeezalElementFancyClimate};
