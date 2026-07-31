/* global feezal */
import {html, css, batteryLowBadge} from '@feezal/feezal-element';
import {svg} from 'lit';
import {sabotageBadge, faultBadge, feezalFaultStyles} from '@feezal/feezal-element/feezal-hm-fault.js';
import {SensorController, sensorAttributesFor, sensorDiscoveryMapFor} from '@feezal/feezal-controller-sensor';
import {FancyBase, fancyCardStyles, fancyStyleDescriptors, fancyCommonAttributes,
    fancyBadgeStyles} from './fancy-shared.js';

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

    _water(active) {
        return svg`
            <ellipse class="base-fill puddle" cx="50" cy="80" rx="24" ry="5" opacity="0.35"/>
            <path class="${active ? 'on-fill' : 'base-fill'} drop"
                d="M50 20 C58 42 68 52 68 63 A18 18 0 1 1 32 63 C32 52 42 42 50 20 Z"/>
            ${active ? svg`
                <ellipse class="on-stroke wave w1" cx="50" cy="80" rx="10" ry="3"/>
                <ellipse class="on-stroke wave w2" cx="50" cy="80" rx="10" ry="3"/>` : ''}`;
    }

    _smoke(active) {
        if (!active) {
            return svg`
                <rect class="base-fill" x="30" y="70" width="40" height="9" rx="4"/>
                <circle class="base-stroke" cx="50" cy="48" r="17" stroke-width="3.5"/>
                <circle class="base-fill" cx="50" cy="48" r="4.5"/>`;
        }
        return svg`
            <rect class="base-fill" x="30" y="70" width="40" height="9" rx="4"/>
            <path class="on-fill flame"
                d="M50 24 C64 40 62 52 56 60 C61 49 51 46 50 57 C45 51 43 60 47 69 C36 65 33 51 40 42 C43 53 49 49 50 42 C51 33 46 30 50 24 Z"/>
            <path class="on-fill flame-core" style="fill: var(--primary-background-color)"
                d="M50 46 C55 54 52 62 50 66 C48 62 45 56 50 46 Z"/>`;
    }

    _gas(active) {
        return svg`
            <rect class="base-fill" x="34" y="58" width="32" height="28" rx="5"/>
            <circle class="cut" cx="50" cy="72" r="6.5"/>
            ${active ? svg`
                <path class="on-stroke waft f1" d="M42 56 q5 -6 0 -12 q-5 -6 0 -12"/>
                <path class="on-stroke waft f2" d="M50 56 q5 -6 0 -12 q-5 -6 0 -12"/>
                <path class="on-stroke waft f3" d="M58 56 q5 -6 0 -12 q-5 -6 0 -12"/>` : ''}`;
    }

    _co(active) {
        const tone = active ? 'on-fill' : 'base-fill';
        return svg`
            <rect class="${tone}" x="41" y="46" width="18" height="7" rx="3.5"/>
            <circle class="${tone}" cx="35" cy="50" r="15"/>
            <circle class="cut" cx="35" cy="50" r="7"/>
            <circle class="${tone}" cx="66" cy="50" r="11"/>
            <circle class="cut" cx="66" cy="50" r="5"/>
            ${active ? svg`<circle class="on-stroke pulse" cx="50" cy="50" r="26"/>` : ''}`;
    }

    _vibration(active) {
        return svg`
            <g class="${active ? 'shake' : ''}">
                <rect class="${active ? 'on-fill' : 'base-fill'}" x="39" y="28" width="22" height="44" rx="5"/>
                <rect class="cut" x="44" y="34" width="12" height="26" rx="2"/>
                <circle class="cut" cx="50" cy="66" r="2.5"/>
            </g>
            ${active ? svg`
                <path class="on-stroke vwave"   d="M29 42 q-6 8 0 16"/>
                <path class="on-stroke vwave d" d="M23 37 q-9 13 0 26"/>
                <path class="on-stroke vwave"   d="M71 42 q6 8 0 16"/>
                <path class="on-stroke vwave d" d="M77 37 q9 13 0 26"/>` : ''}`;
    }

    _tamper(active) {
        return svg`
            <rect class="${active ? 'on-fill' : 'base-fill'}" x="32" y="52" width="36" height="30" rx="5"/>
            <circle class="cut" cx="50" cy="65" r="4"/>
            <path class="${active ? 'on-stroke' : 'base-stroke'}" stroke-width="6"
                d="${active ? 'M40 52 V42 a10 10 0 0 1 19 -3' : 'M40 52 V42 a10 10 0 0 1 20 0 V52'}"/>
            ${active ? svg`<circle class="on-stroke pulse" cx="50" cy="60" r="28"/>` : ''}`;
    }

    _generic(active) {
        return svg`
            <circle class="${active ? 'on-fill' : 'base-fill'}" cx="50" cy="50" r="8"/>
            ${active ? svg`
                <circle class="on-stroke ring r1" cx="50" cy="50" r="9"/>
                <circle class="on-stroke ring r2" cx="50" cy="50" r="9"/>
                <circle class="on-stroke ring r3" cx="50" cy="50" r="9"/>`
            : svg`<circle class="base-stroke" cx="50" cy="50" r="22" stroke-width="3" opacity="0.5"/>`}`;
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
