/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';

/**
 * feezal-element-metro-climate (E55)
 *
 * Thermostat tile: front shows the current temperature (+ small setpoint);
 * the back holds a setpoint stepper and, when configured, mode chips.
 */
class FeezalElementMetroClimate extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Climate', category: 'Metro', color: '#1ba1e2', icon: 'thermostat'},
            description: 'Metro thermostat tile: current temperature on the front, setpoint stepper + mode chips on the back.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                // U39: grouped inspector; message-property-* twins tuck behind Advanced.
                {name: 'subscribe', type: 'mqttTopic', section: 'Connection', help: 'Current temperature topic.'},
                {name: 'message-property', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within current-temperature messages. Default: payload'},
                {name: 'subscribe-setpoint', type: 'mqttTopic', section: 'Connection', help: 'Setpoint state topic.'},
                {name: 'message-property-setpoint', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within setpoint messages. Default: payload'},
                {name: 'publish-setpoint', type: 'mqttTopic', section: 'Connection', help: 'Setpoint command topic (enables the back stepper).'},
                {name: 'subscribe-mode', type: 'mqttTopic', section: 'Connection', help: 'Mode state topic.'},
                {name: 'message-property-mode', type: 'string', default: 'payload', section: 'Connection', advanced: true,
                    help: 'Dot-notation path within mode messages. Default: payload'},
                {name: 'publish-mode', type: 'mqttTopic', section: 'Connection', help: 'Mode command topic (enables the back mode chips).'},
                {name: 'step', type: 'number', default: 0.5, section: 'Setpoint', help: 'Setpoint stepper increment.'},
                {name: 'min',  type: 'number', default: 5,  section: 'Setpoint', help: 'Setpoint minimum.'},
                {name: 'max',  type: 'number', default: 30, section: 'Setpoint', help: 'Setpoint maximum.'},
                {name: 'unit', type: 'string', default: '°C', section: 'Setpoint', help: 'Temperature unit.'},
                {name: 'modes', type: 'objectList', itemFields: [{key: '', placeholder: 'heat'}], section: 'Display',
                    help: 'Selectable modes, e.g. off / heat / cool / auto.'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {
                component: 'climate',
                map: {
                    current_temperature_topic:  'subscribe',
                    temperature_state_topic:    'subscribe-setpoint',
                    temperature_command_topic:  'publish-setpoint',
                    mode_state_topic:           'subscribe-mode',
                    mode_command_topic:         'publish-mode',
                    modes:                      'modes',
                    min_temp:                   'min',
                    max_temp:                   'max',
                    temp_step:                  'step',
                    name:                       'label',
                    value_template:             {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        subSetpoint:     {type: String, reflect: true, attribute: 'subscribe-setpoint'},
        msgPropSetpoint: {type: String, reflect: true, attribute: 'message-property-setpoint'},
        pubSetpoint:     {type: String, reflect: true, attribute: 'publish-setpoint'},
        step: {type: Number, reflect: true},
        min:  {type: Number, reflect: true},
        max:  {type: Number, reflect: true},
        unit: {type: String, reflect: true},
        subMode:     {type: String, reflect: true, attribute: 'subscribe-mode'},
        msgPropMode: {type: String, reflect: true, attribute: 'message-property-mode'},
        pubMode:     {type: String, reflect: true, attribute: 'publish-mode'},
        modes:       {type: String, reflect: true},
        _current:  {state: true},
        _setpoint: {state: true},
        _mode:     {state: true},
    };

    static styles = [MetroTileBase.styles, css`
        .current { font-size: min(34px, 30cqh); font-weight: 300; line-height: 1; }
        .setpoint { font-size: 12px; opacity: 0.85; }
        .stepper { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .stepper .val { font-size: 20px; font-weight: 300; min-width: 4ch; text-align: center; }
        .chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .chips .mbtn { padding: 2px 8px; font-size: 11px; }
    `];

    constructor() {
        super();
        this.subSetpoint = '';
        this.msgPropSetpoint = '';
        this.pubSetpoint = '';
        this.step = 0.5;
        this.min = 5;
        this.max = 30;
        this.unit = '°C';
        this.subMode = '';
        this.msgPropMode = '';
        this.pubMode = '';
        this.modes = '[]';
        this._current = null;
        this._setpoint = null;
        this._mode = '';
    }

    connectedCallback() {
        super.connectedCallback();
        const sub = (topic, cb) => { if (topic) this.addSubscription(topic, cb); };
        sub(this.subscribe, msg => {
            const v = Number(this.getProperty(msg, this.messageProperty));
            if (!isNaN(v)) this._current = v;
        });
        sub(this.subSetpoint, msg => {
            const v = Number(this.getProperty(msg, this.msgPropSetpoint || this.messageProperty));
            if (!isNaN(v)) this._setpoint = v;
        });
        sub(this.subMode, msg => {
            const v = this.getProperty(msg, this.msgPropMode || this.messageProperty);
            if (v !== null && v !== undefined) this._mode = String(v);
        });
    }

    _modeList() {
        try {
            const r = JSON.parse(this.modes || '[]');
            return (Array.isArray(r) ? r : []).map(String).filter(Boolean);
        } catch {
            return [];
        }
    }

    _stepSetpoint(direction) {
        if (feezal.isEditor) return;
        const step = Number(this.step) || 0.5;
        const current = this._setpoint ?? (this.min + this.max) / 2;
        const next = Math.min(this.max, Math.max(this.min, Math.round((current + direction * step) * 100) / 100));
        this._setpoint = next;
        if (this.pubSetpoint) feezal.connection.pub(this.pubSetpoint, String(next));
    }

    _setMode(mode) {
        if (feezal.isEditor) return;
        this._mode = mode;
        if (this.pubMode) feezal.connection.pub(this.pubMode, mode);
    }

    renderFront() {
        const current = this._current ?? (feezal.isEditor && !this.subscribe ? 21.5 : null);
        return html`
            <div class="current">${current === null ? '—' : `${current}${this.unit}`}</div>
            ${this._setpoint !== null ? html`<div class="setpoint">→ ${this._setpoint}${this.unit}</div>` : ''}`;
    }

    renderBack() {
        const modes = this._modeList();
        const hasModes = modes.length > 0;
        return html`
            <div class="stepper">
                <button class="mbtn" @click="${() => this._stepSetpoint(-1)}">−</button>
                <span class="val">${this._setpoint === null ? '—' : `${this._setpoint}${this.unit}`}</span>
                <button class="mbtn" @click="${() => this._stepSetpoint(1)}">+</button>
            </div>
            ${hasModes ? html`
                <div class="chips">
                    ${modes.map(mode => html`
                        <button class="mbtn ${this._mode === mode ? 'active' : ''}"
                            @click="${() => this._setMode(mode)}">${mode}</button>`)}
                </div>` : ''}`;
    }
}

customElements.define('feezal-element-metro-climate', FeezalElementMetroClimate);
export {FeezalElementMetroClimate};
