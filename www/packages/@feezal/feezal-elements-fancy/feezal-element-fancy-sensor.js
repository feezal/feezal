/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {sabotageBadge, faultBadge, feezalFaultStyles} from '@feezal/feezal-element/feezal-hm-fault.js';
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-fancy-sensor (E139) — animated ALARM sensor card (the E138
 * alarm slice: water-leak, smoke, gas, CO, vibration, tamper, generic).
 *
 * Unlike the Lottie-driven siblings, each TYPE gets its OWN duotone SVG pose
 * with a CSS-driven "triggered" animation (a leak ripples, a flame flickers,
 * gas wafts up, a vibration shakes with side waves, CO/tamper/generic radiate
 * alarm rings). Keeping the motion in CSS lets a single card carry a distinct
 * animation per type without one Lottie per type — so `animationKey()` returns
 * null (no lottie chunk) and the pose IS the animation (in the viewer and the
 * editor alike; `prefers-reduced-motion` freezes the accents in place). The
 * active tone defaults to the ERROR colour for alarm classes (E138 rule); the
 * look/frame/duotone stays consistent with fancy-contact.
 */
class FeezalElementFancySensor extends FancyBase {
    static get feezal() {
        return {
            palette: {name: 'Sensor', category: 'Fancy', color: '#7a5c9e', icon: 'warning'},
            description: 'Animated alarm-sensor card (leak, smoke, gas, CO, vibration, tamper, generic) — ' +
                'each type has its own duotone animation that triggers on alarm. Active tone defaults to the error colour.',
            discovery: {component: 'binary_sensor', map: sensorDiscoveryMapFor('alarm')},
            attributes: [
                ...sensorAttributesFor('alarm'),
                ...fancyCommonAttributes,
                ...availabilityAttributes({section: 'Availability'}),
            ],
            styles: fancyStyleDescriptors,
            defaultStyle: {width: '140px', height: '150px'},
            restrict: {minWidth: 80, minHeight: 90},
        };
    }

    static properties = {
        subscribe:      {type: String, reflect: true},
        payloadActive:  {type: String, reflect: true, attribute: 'payload-active'},
        payloadClear:   {type: String, reflect: true, attribute: 'payload-clear'},
        type:           {type: String, reflect: true},
        textActive:     {type: String, attribute: 'text-active'},
        textClear:      {type: String, attribute: 'text-clear'},
        subscribeBatteryLow: {type: String, reflect: true, attribute: 'subscribe-battery-low'},
        msgPropBatteryLow:   {type: String, reflect: true, attribute: 'message-property-battery-low'},
        payloadBatteryLow:   {type: String, reflect: true, attribute: 'payload-battery-low'},
        batteryLowThreshold: {type: Number, reflect: true, attribute: 'battery-low-threshold'},
    };

    static styles = [...fancyBadgeStyles, feezalFaultStyles, fancyCardStyles, css`
        /* Per-type duotone pose + its "triggered" animation. Base = chrome
           colour, on = the active/alarm accent (both element-scoped so the user
           colour overrides apply, and alarm types default to the error tone). */
        .sp { width: 100%; height: 100%; display: block; }
        .sp .base-fill   { fill: var(--sp-base); }
        .sp .base-stroke { fill: none; stroke: var(--sp-base); stroke-linecap: round; stroke-linejoin: round; }
        .sp .on-fill     { fill: var(--sp-on); }
        .sp .on-stroke   { fill: none; stroke: var(--sp-on); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
        .sp .cut         { fill: var(--primary-background-color); }
        .sp * { transform-box: fill-box; transform-origin: center; }

        /* radiating alarm rings (generic / CO / tamper) */
        .sp .ring, .sp .pulse { opacity: 0; }
        .sp.on .ring  { animation: sp-ring 2.2s ease-out infinite; }
        .sp.on .ring.r2 { animation-delay: 0.73s; }
        .sp.on .ring.r3 { animation-delay: 1.46s; }
        .sp.on .pulse { animation: sp-ring 1.7s ease-out infinite; }
        @keyframes sp-ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(3.4); opacity: 0; } }

        /* water — the drop bobs, ripples spread on the puddle */
        .sp.on .drop { animation: sp-bob 1.7s ease-in-out infinite; }
        @keyframes sp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
        .sp .wave { opacity: 0; }
        .sp.on .wave  { animation: sp-ring 1.9s ease-out infinite; }
        .sp.on .wave.w2 { animation-delay: 0.95s; }

        /* smoke — the flame flickers from its base */
        .sp .flame, .sp .flame-core { transform-origin: bottom; }
        .sp.on .flame      { animation: sp-flame 0.5s ease-in-out infinite alternate; }
        .sp.on .flame-core { animation: sp-flame 0.42s ease-in-out infinite alternate; }
        @keyframes sp-flame { 0% { transform: scaleY(1) scaleX(1) skewX(0); } 100% { transform: scaleY(1.1) scaleX(0.93) skewX(3deg); } }

        /* gas — wisps waft up */
        .sp .waft { opacity: 0; }
        .sp.on .waft { animation: sp-waft 2.4s ease-in-out infinite; }
        .sp.on .waft.f2 { animation-delay: 0.8s; }
        .sp.on .waft.f3 { animation-delay: 1.6s; }
        @keyframes sp-waft { 0% { transform: translateY(8px); opacity: 0; } 25% { opacity: 0.75; } 100% { transform: translateY(-16px); opacity: 0; } }

        /* vibration — the device shakes, side waves flash */
        .sp.on .shake { animation: sp-shake 0.28s linear infinite; }
        @keyframes sp-shake { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(-2px, 1px); } 50% { transform: translate(2px, -1px); } 75% { transform: translate(-1px, -1px); } }
        .sp .vwave { opacity: 0; }
        .sp.on .vwave { animation: sp-vwave 0.9s ease-out infinite; }
        .sp.on .vwave.d { animation-delay: 0.32s; }
        @keyframes sp-vwave { 0% { opacity: 0.75; } 100% { opacity: 0; } }

        @media (prefers-reduced-motion: reduce) {
            .sp * { animation: none !important; }
            /* freeze the accents visibly on so the triggered state still reads */
            .sp.on .ring, .sp.on .pulse, .sp.on .wave, .sp.on .waft, .sp.on .vwave { opacity: 0.5; }
        }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.payloadActive = 'ON';
        this.payloadClear = 'OFF';
        this.type = 'water-leak';
        this.textActive = '';
        this.textClear = '';
        this.subscribeBatteryLow = '';
        this.msgPropBatteryLow = '';
        this.payloadBatteryLow = 'true';
        this.batteryLowThreshold = 15;
        this.sensor = new SensorController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.sensor.rewireIfChanged();
    }

    // No Lottie: the per-type CSS pose IS the animation (see the class header).
    animationKey() { return null; }

    /** E138 alarm semantics: the active tone is the ERROR colour. */
    activeToneVar() { return '--error-color'; }

    stateKey() { return this.sensor.active ? 'active' : 'clear'; }

    stateText() { return this.sensor.text(); }

    renderPose() {
        const active = this.sensor.active;
        const t = this.type || 'generic';
        // Element-scoped duotone: base chrome + the active accent. Alarm classes
        // default the accent to the error colour; user --feezal-fancy-* overrides
        // (fancyStyleDescriptors) win either way.
        const onDefault = this.sensor.alarm ? 'var(--error-color)' : 'var(--primary-color)';
        const rootStyle = `--sp-base: var(--feezal-fancy-base-color, var(--secondary-text-color));` +
            `--sp-on: var(--feezal-fancy-active-color, ${onDefault});`;
        return svg`<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
            class="sp t-${t} ${active ? 'on' : ''}" style="${rootStyle}">${this._poseFor(t, active)}</svg>`;
    }

    _poseFor(t, active) {
        switch (t) {
            case 'water-leak': return this._water(active);
            case 'smoke':      return this._smoke(active);
            case 'gas':        return this._gas(active);
            case 'co':         return this._co(active);
            case 'vibration':  return this._vibration(active);
            case 'tamper':     return this._tamper(active);
            default:           return this._generic(active);
        }
    }

    // ── per-type poses ────────────────────────────────────────────────────────

    // Every pose is drawn to sit optically centred at (50,50) inside a ~44px
    // envelope, so a row of mixed types lines up (same height, same weight).

    _water(active) {
        return svg`
            <ellipse class="base-fill puddle" cx="50" cy="73" rx="13" ry="3.2" opacity="0.3"/>
            <path class="${active ? 'on-fill' : 'base-fill'} drop"
                d="M50 30 C56 44 63 49 63 57 A13 13 0 1 1 37 57 C37 49 44 44 50 30 Z"/>
            ${active ? svg`
                <ellipse class="on-stroke wave w1" cx="50" cy="73" rx="9" ry="3"/>
                <ellipse class="on-stroke wave w2" cx="50" cy="73" rx="9" ry="3"/>` : ''}`;
    }

    _smoke(active) {
        if (!active) {
            return svg`
                <circle class="base-stroke" cx="50" cy="50" r="18" stroke-width="3.5"/>
                <circle class="base-fill" cx="50" cy="50" r="4.5"/>`;
        }
        return svg`
            <rect class="base-fill" x="34" y="68" width="32" height="8" rx="4"/>
            <path class="on-fill flame"
                d="M50 30 C61 44 59 55 54 62 C58 52 50 49 49 58 C45 53 43 61 47 68 C37 64 35 52 41 44 C43 54 49 50 50 44 C51 36 47 34 50 30 Z"/>
            <path class="on-fill flame-core" style="fill: var(--primary-background-color)"
                d="M50 48 C54 55 51 61 50 64 C49 61 46 56 50 48 Z"/>`;
    }

    _gas(active) {
        return svg`
            <rect class="base-fill" x="36" y="31" width="28" height="38" rx="6"/>
            <circle class="cut" cx="50" cy="50" r="7"/>
            ${active ? svg`
                <path class="on-stroke waft f1" d="M42 29 q5 -6 0 -12 q-5 -6 0 -12"/>
                <path class="on-stroke waft f2" d="M50 29 q5 -6 0 -12 q-5 -6 0 -12"/>
                <path class="on-stroke waft f3" d="M58 29 q5 -6 0 -12 q-5 -6 0 -12"/>` : ''}`;
    }

    _co(active) {
        const tone = active ? 'on-fill' : 'base-fill';
        return svg`
            <rect class="${tone}" x="41" y="47" width="18" height="6" rx="3"/>
            <circle class="${tone}" cx="40" cy="50" r="13"/>
            <circle class="cut" cx="40" cy="50" r="6"/>
            <circle class="${tone}" cx="63" cy="50" r="10"/>
            <circle class="cut" cx="63" cy="50" r="4.5"/>
            ${active ? svg`<circle class="on-stroke pulse" cx="50" cy="50" r="24"/>` : ''}`;
    }

    _vibration(active) {
        return svg`
            <g class="${active ? 'shake' : ''}">
                <rect class="${active ? 'on-fill' : 'base-fill'}" x="39" y="30" width="22" height="40" rx="5"/>
                <rect class="cut" x="44" y="35" width="12" height="24" rx="2"/>
                <circle class="cut" cx="50" cy="64" r="2.2"/>
            </g>
            ${active ? svg`
                <path class="on-stroke vwave"   d="M30 44 q-6 6 0 12"/>
                <path class="on-stroke vwave d" d="M24 39 q-9 11 0 22"/>
                <path class="on-stroke vwave"   d="M70 44 q6 6 0 12"/>
                <path class="on-stroke vwave d" d="M76 39 q9 11 0 22"/>` : ''}`;
    }

    _tamper(active) {
        return svg`
            <rect class="${active ? 'on-fill' : 'base-fill'}" x="33" y="46" width="34" height="26" rx="5"/>
            <circle class="cut" cx="50" cy="58" r="3.5"/>
            <path class="${active ? 'on-stroke' : 'base-stroke'}" stroke-width="6"
                d="${active ? 'M40 46 V38 a10 10 0 0 1 19 -3' : 'M40 46 V38 a10 10 0 0 1 20 0 V46'}"/>
            ${active ? svg`<circle class="on-stroke pulse" cx="50" cy="56" r="26"/>` : ''}`;
    }

    _generic(active) {
        return svg`
            <circle class="${active ? 'on-fill' : 'base-fill'}" cx="50" cy="50" r="7.5"/>
            ${active ? svg`
                <circle class="on-stroke ring r1" cx="50" cy="50" r="8"/>
                <circle class="on-stroke ring r2" cx="50" cy="50" r="8"/>
                <circle class="on-stroke ring r3" cx="50" cy="50" r="8"/>`
            : svg`<circle class="base-stroke" cx="50" cy="50" r="20" stroke-width="3" opacity="0.5"/>`}`;
    }

    renderBadges() {
        return html`
            ${batteryLowBadge(this.sensor.batteryLow)}
            ${sabotageBadge(this.sensor.sabotage)}
            ${faultBadge(this.sensor.error)}
        `;
    }
}

customElements.define('feezal-element-fancy-sensor', FeezalElementFancySensor);
export {FeezalElementFancySensor};
