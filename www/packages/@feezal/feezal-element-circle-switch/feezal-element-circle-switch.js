/* global feezal */
/**
 * feezal-element-circle-switch (E121)
 *
 * Switch / smart-plug card for the Circle family: a large round power button
 * that subscribes to an on/off state topic and publishes on tap. Same MQTT
 * contract as feezal-element-glass-switch / feezal-element-metro-switch
 * (subscribe / publish / payload-on / payload-off + availability).
 *
 * B92: this used to be a thin subclass of feezal-element-circle-light locked
 * to on_off mode (E122), driving the LightController. But that controller
 * reads/writes the light's `subscribe-state` / `publish-state` topics, while
 * the shared `switchAcceptsLight` discovery fragment (a lamp offered as a plain
 * switch) — and the native `switch` component — stamp `subscribe` / `publish`,
 * exactly like glass/metro-switch. The two never met: a discovered outlet had
 * `publish` set but the controller published to an empty `publish-state`, so
 * nothing went out (glass-switch, publishing to `publish`, worked). Decoupling
 * to a plain switch that reads/writes `subscribe` / `publish` fixes it and
 * aligns all three switch families on one contract. Legacy instances that
 * still carry `subscribe-state` / `publish-state` keep working (see the wiring
 * fallbacks below).
 *
 * The power-button visual reuses the light card's on_off render and its
 * --feezal-light-* theme tokens, so outlets and lights follow the same theme
 * mapping; --feezal-light-on-color is re-pointed to the primary colour (E139:
 * a switch has no colour ring, so ON must read as clearly coloured/active).
 */
import {FeezalElement, feezalBaseStyles, html, css, payloadMatch} from '@feezal/feezal-element';
import {switchAcceptsLight, availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {svg} from 'lit';

// Arc geometry (matches feezal-element-circle-light so the button footprint is
// identical): the power disc fills the brightness ring's outer footprint.
const CX = 50;
const CY = 50;
const TRACK_R = 40;
const RING_W  = 7;
const POWER_R = TRACK_R + RING_W / 2;

class FeezalElementCircleSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Switch', category: 'Circle', color: '#1565c0', icon: 'power'},
            description: 'Switch / smart-plug card — a large round power button that subscribes to an ' +
                'on/off state topic and publishes on tap. Same MQTT contract as the glass/metro switch, ' +
                'with the Circle light card\'s look and theme tokens.',
            // E130 / B92: same discovery contract as glass-switch / metro-switch
            // — a native `switch`, or a `light` offered as a plain on/off switch
            // (switchAcceptsLight), both stamp subscribe / publish. N31 maps
            // availability automatically from the canonical record.
            discovery: {
                component: 'switch',
                accepts: [switchAcceptsLight],
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:           'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'On/off state topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Property path within message payloads (dot-notation). Default: payload'},
                {name: 'publish', type: 'mqttTopic', help: 'Topic to publish payload-on / payload-off to on tap.'},
                {name: 'payload-on',  type: 'string', default: 'on',  help: 'Payload published for / matched against the ON state. Default: on'},
                {name: 'payload-off', type: 'string', default: 'off', help: 'Payload published for / matched against the OFF state. Default: off'},
                ...availabilityAttributes(),
                {name: 'label', type: 'string', default: '', help: 'Optional label shown below the button.'},
                {name: 'label-off', type: 'string', default: 'off', defaultI18n: {de: 'aus', es: 'apagado', fr: 'éteint', it: 'spento', pl: 'wyłączony', pt: 'desligado', tr: 'kapalı'}, help: 'Displayed centre text while the outlet is off (localise, e.g. "aus"). Display only — NOT the MQTT payload (payload-off).'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Shared with the Circle light so both follow one theme mapping.
                {property: '--feezal-light-on-color',      type: 'color', default: 'var(--primary-color)', help: 'Power-button colour while ON (active). Defaults to the accent/primary colour.'},
                {property: '--feezal-light-off-color',     type: 'color', default: 'var(--secondary-text-color)', help: 'Power-button colour while OFF (muted).'},
                {property: '--feezal-light-surface-color', type: 'color', default: 'var(--primary-background-color)'},
                {property: '--feezal-light-text-color',    type: 'color', default: 'var(--primary-text-color)'},
                {property: '--feezal-light-error-color',   type: 'color', default: 'var(--error-color)'}
            ],
            restrict: {minWidth: 60, minHeight: 60},
            defaultStyle: {width: '180px', height: '220px'}
        };
    }

    static properties = {
        publish:     {type: String, reflect: true},
        payloadOn:   {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff:  {type: String, reflect: true, attribute: 'payload-off'},
        // N31: availability inherited from FeezalElement.
        label:       {type: String, reflect: true},
        labelOff:    {type: String, attribute: 'label-off'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        _on:         {state: true},
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

            /* E139: a switch has no colour ring, so ON must read as clearly
               coloured (active) rather than the light card's white-on-colour. */
            --feezal-light-on-color:      var(--primary-color);
            --feezal-light-off-color:     var(--secondary-text-color);
            --feezal-light-surface-color: var(--primary-background-color);
            --feezal-light-text-color:    var(--primary-text-color);
            --feezal-light-error-color:   var(--error-color);
        }
        .unavail {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 18px;
            height: 18px;
            color: var(--feezal-light-error-color);
            opacity: 0.8;
            pointer-events: none;
            z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
        .ring-wrap { width: 100%; flex-shrink: 0; }
        svg {
            width: 100%;
            display: block;
            aspect-ratio: 1;
            overflow: visible;
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }
        .label {
            font-size: 11px; opacity: 0.65; text-align: center;
            color: var(--feezal-light-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;
        }
    `];

    constructor() {
        super();
        this.publish     = '';
        this.payloadOn   = 'on';
        this.payloadOff  = 'off';
        this.label       = '';
        this.labelOff    = 'off';
        this.discoveryId = '';
        this._on         = false;
    }

    // Device cards manage the primary subscription manually; suppress the base
    // path (availability wiring is separate and stays active — N31).
    _subscribe() { /* intentionally empty — see connectedCallback */ }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    // B92: the state topic is `subscribe`, but a legacy instance discovered by
    // the previous (light-controller) build carries `subscribe-state` — honour
    // it so saved dashboards keep working.
    _stateTopic()   { return this.subscribe || this.getAttribute('subscribe-state') || ''; }
    _commandTopic() { return this.publish   || this.getAttribute('publish-state')   || ''; }

    _wireSignature() {
        return `${this._stateTopic()}`;
    }

    updated(changed) {
        super.updated(changed);
        if (this.isConnected && this.__wireSig !== undefined && this._wireSignature() !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    _wireSubscriptions() {
        this.__wireSig = this._wireSignature();
        const topic = this._stateTopic();
        if (topic) {
            this.addSubscription(topic, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = payloadMatch(v, this.payloadOn);
            });
        }
    }

    toggle() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        const topic = this._commandTopic();
        if (topic) feezal.connection.pub(topic, this._on ? this.payloadOn : this.payloadOff);
    }

    // E122: on_off render — no ring, just a large centre power button filling
    // the ring's footprint (relay lamps / plugs have no level). Ported from
    // feezal-element-circle-light so outlets and lights look identical.
    _svgContent() {
        const isOn   = this._on;
        const accent = 'var(--feezal-light-on-color)';
        const trackC = 'var(--feezal-light-off-color)';
        return svg`
            <circle cx="${CX}" cy="${CY}" r="${POWER_R}"
                fill="var(--feezal-light-surface-color)"
                stroke="${isOn ? accent : trackC}" stroke-width="1.5"
                pointer-events="none"/>
            ${isOn ? svg`
                <circle cx="${CX}" cy="${CY}" r="${POWER_R - 1.5}"
                    fill="${accent}" opacity="0.14" pointer-events="none"/>
            ` : ''}
            <text x="${CX}" y="${CY - (isOn ? 0 : 4)}" text-anchor="middle"
                dominant-baseline="middle" font-size="22"
                fill="${isOn ? accent : trackC}" pointer-events="none">⏻</text>
            ${!isOn ? svg`
                <text x="${CX}" y="${CY + 16}" text-anchor="middle"
                    dominant-baseline="middle" font-size="9"
                    opacity="0.55" fill="var(--feezal-light-off-color)"
                    pointer-events="none">${this.labelOff || 'off'}</text>
            ` : ''}`;
    }

    render() {
        const showUnavail = this.subscribeAvailability && !this._available;
        return html`
            ${showUnavail ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>
            ` : ''}
            <div class="ring-wrap">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                    style="cursor:${feezal.isEditor ? 'default' : 'pointer'}"
                    @pointerdown="${() => this.toggle()}">
                    ${this._svgContent()}
                </svg>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-switch', FeezalElementCircleSwitch);
export {FeezalElementCircleSwitch};
