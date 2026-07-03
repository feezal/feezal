/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// ─── Default status labels ─────────────────────────────────────────────────────
// Humanised fallbacks used when no state-labels override map is provided.
const DEFAULT_LABELS = {
    docked:    'Docked',
    idle:      'Idle',
    cleaning:  'Cleaning',
    paused:    'Paused',
    returning: 'Returning home',
    error:     'Error',
};

// Humanise an arbitrary raw state string: "returning_to_base" → "Returning to base".
function humanise(state) {
    if (state === null || state === undefined || state === '') return '—';
    const s = String(state).replace(/[_-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// State → colour var (mapped to theme tokens exposed as --feezal-vacuum-*).
function stateColorVar(state) {
    switch (state) {
        case 'cleaning':  return 'var(--feezal-vacuum-active-color)';
        case 'returning': return 'var(--feezal-vacuum-active-color)';
        case 'paused':    return 'var(--feezal-vacuum-paused-color)';
        case 'error':     return 'var(--feezal-vacuum-error-color)';
        case 'docked':
        case 'idle':
        default:          return 'var(--feezal-vacuum-idle-color)';
    }
}

// ─── Element ──────────────────────────────────────────────────────────────────
class FeezalElementMaterialVacuum extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Vacuum', category: 'Device', color: '#1565c0', icon: 'cleaning_services'},
            description: 'Robot-vacuum control card — top-down robot illustration reflecting the current state, a status label, battery indicator, control buttons (start/pause/stop/return/locate), and an optional fan-speed chip row.',
            // ── N12 Auto-Discovery descriptor ─────────────────────────────────
            // HA MQTT `vacuum` component. state_topic carries the state string
            // (or a JSON object navigated via value_template → message-property).
            discovery: {
                component: 'vacuum',
                map: {
                    state_topic:    {attr: 'subscribe'},
                    command_topic:  {attr: 'publish-command'},
                    fan_speed_list: {attr: 'fan-speeds', transform: 'join'},
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:           'label',
                },
            },
            attributes: [
                // ── Primary state ──────────────────────────────────────────────
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Vacuum state topic (docked, idle, cleaning, paused, returning, error, …).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default: payload'},
                // ── Commands ───────────────────────────────────────────────────
                {name: 'publish-command', type: 'mqttTopic', help: 'Topic the control buttons publish their command payload to.'},
                {name: 'payload-start',       type: 'string', default: 'start',       help: 'Payload for Start / Resume. Default: start'},
                {name: 'payload-pause',       type: 'string', default: 'pause',       help: 'Payload for Pause. Default: pause'},
                {name: 'payload-stop',        type: 'string', default: 'stop',        help: 'Payload for Stop. Default: stop'},
                {name: 'payload-return-home', type: 'string', default: 'return_home', help: 'Payload for Return home. Default: return_home'},
                {name: 'payload-locate',      type: 'string', default: 'locate',      help: 'Payload for Locate. Default: locate'},
                // ── Battery ────────────────────────────────────────────────────
                {name: 'subscribe-battery', type: 'mqttTopic', help: 'Optional: battery level topic (0–100).'},
                {name: 'message-property-battery', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the battery message. Default: payload'},
                // ── Fan speed ──────────────────────────────────────────────────
                {name: 'subscribe-fan-speed', type: 'mqttTopic', help: 'Optional: topic publishing the current fan speed.'},
                {name: 'message-property-fan-speed', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the fan-speed message. Default: payload'},
                {name: 'publish-fan-speed', type: 'mqttTopic', help: 'Optional: topic to publish the selected fan speed to.'},
                {name: 'fan-speeds', type: 'string', default: '',
                    help: 'Comma-separated fan-speed names (e.g. quiet,standard,turbo). When empty, the fan-speed row is hidden.'},
                // ── Area / room ────────────────────────────────────────────────
                {name: 'subscribe-area', type: 'mqttTopic', help: 'Optional: current cleaning area / room name topic.'},
                {name: 'message-property-area', type: 'string', default: 'payload',
                    help: 'Dot-notation path within the area message. Default: payload'},
                // ── Display ────────────────────────────────────────────────────
                {name: 'state-labels', type: 'string', default: '{}',
                    help: 'JSON map overriding status labels per state, e.g. {"docked":"On dock","cleaning":"Vacuuming"}.'},
                {name: 'show-locate', type: 'boolean', default: true,
                    help: 'Show the Locate button.'},
                {name: 'label', type: 'string', default: '', help: 'Optional card title shown at the bottom.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                // Theme-aware colour tokens. Leave blank to inherit from theme.
                {property: '--feezal-vacuum-active-color', type: 'color',
                    default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                    help: 'Robot / label colour while cleaning or returning home.'},
                {property: '--feezal-vacuum-paused-color', type: 'color',
                    default: 'var(--accent-color, #ff9800)',
                    help: 'Robot / label tint while paused.'},
                {property: '--feezal-vacuum-idle-color', type: 'color',
                    default: 'var(--secondary-text-color, #9e9e9e)',
                    help: 'Robot / label colour while docked or idle.'},
                {property: '--feezal-vacuum-error-color', type: 'color',
                    default: 'var(--error-color, #f44336)',
                    help: 'Robot / label colour and "!" overlay on error.'},
                {property: '--feezal-vacuum-text-color', type: 'color',
                    default: 'var(--primary-text-color, #212121)',
                    help: 'Status label, battery and button text colour.'},
                {property: '--feezal-vacuum-battery-color', type: 'color',
                    default: 'var(--success-color, #4caf50)',
                    help: 'Battery bar colour when charge is high.'},
            ],
            restrict:     {minWidth: 140, minHeight: 200},
            defaultStyle: {width: '180px', height: '240px'},
        };
    }

    static properties = {
        // subscribe + messageProperty are inherited from FeezalElement.
        publishCommand:     {type: String,  reflect: true, attribute: 'publish-command'},
        payloadStart:       {type: String,  reflect: true, attribute: 'payload-start'},
        payloadPause:       {type: String,  reflect: true, attribute: 'payload-pause'},
        payloadStop:        {type: String,  reflect: true, attribute: 'payload-stop'},
        payloadReturnHome:  {type: String,  reflect: true, attribute: 'payload-return-home'},
        payloadLocate:      {type: String,  reflect: true, attribute: 'payload-locate'},
        subscribeBattery:   {type: String,  reflect: true, attribute: 'subscribe-battery'},
        msgPropBattery:     {type: String,  reflect: true, attribute: 'message-property-battery'},
        subscribeFanSpeed:  {type: String,  reflect: true, attribute: 'subscribe-fan-speed'},
        msgPropFanSpeed:    {type: String,  reflect: true, attribute: 'message-property-fan-speed'},
        publishFanSpeed:    {type: String,  reflect: true, attribute: 'publish-fan-speed'},
        fanSpeeds:          {type: String,  reflect: true, attribute: 'fan-speeds'},
        subscribeArea:      {type: String,  reflect: true, attribute: 'subscribe-area'},
        msgPropArea:        {type: String,  reflect: true, attribute: 'message-property-area'},
        stateLabels:        {type: String,  reflect: true, attribute: 'state-labels'},
        showLocate:         {type: Boolean, reflect: true, attribute: 'show-locate'},
        label:              {type: String,  reflect: true},
        // Internal state — never as class fields (Lit 3 rule)
        _state:    {state: true},   // null | string
        _battery:  {state: true},   // null | number (0–100)
        _fanSpeed: {state: true},   // null | string
        _area:     {state: true},   // null | string
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 6px;
            position: relative;

            /* ── Theme-aware colour tokens ────────────────────────────────────
               Override per-element via the Style inspector or a theme rule.  */
            --feezal-vacuum-active-color:  var(--primary-color,        var(--sl-color-primary-600, #0284c7));
            --feezal-vacuum-paused-color:  var(--accent-color,         #ff9800);
            --feezal-vacuum-idle-color:    var(--secondary-text-color, #9e9e9e);
            --feezal-vacuum-error-color:   var(--error-color,          #f44336);
            --feezal-vacuum-text-color:    var(--primary-text-color,   var(--feezal-color, #212121));
            --feezal-vacuum-battery-color: var(--success-color,        #4caf50);
        }

        /* Control-button icons rely on the 'Material Icons' font being present;
           NEVER use <md-icon> here — its font is not loaded and renders as text. */
        .mi {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            line-height: 1;
            font-size: 20px;
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }

        .robot-wrap {
            width: 100%;
            flex: 1;
            min-height: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        svg.robot {
            width: 100%;
            height: 100%;
            max-height: 96px;
            overflow: visible;
            display: block;
        }
        svg.robot.cleaning .rotor {
            transform-origin: 100px 100px;
            animation: vac-spin 3s linear infinite;
        }
        @keyframes vac-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
        }

        .status {
            font-size: 15px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }
        .area {
            font-size: 10px;
            opacity: 0.65;
            text-align: center;
            color: var(--feezal-vacuum-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
            margin-top: -2px;
        }

        .battery {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 90%;
            color: var(--feezal-vacuum-text-color);
        }
        .battery .mi { font-size: 16px; opacity: 0.7; }
        .battery-bar {
            flex: 1;
            height: 5px;
            background: color-mix(in srgb, var(--feezal-vacuum-idle-color) 40%, transparent);
            border-radius: 3px;
            overflow: hidden;
        }
        .battery-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.4s, background 0.4s;
        }
        .battery-pct {
            font-size: 11px;
            min-width: 30px;
            text-align: right;
            opacity: 0.8;
        }

        .controls {
            display: flex;
            gap: 4px;
            justify-content: center;
            flex-wrap: wrap;
            width: 100%;
        }
        .controls button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            padding: 0;
            cursor: pointer;
            border-radius: 50%;
            border: 1px solid color-mix(in srgb, var(--feezal-vacuum-idle-color) 60%, transparent);
            background: var(--feezal-bg, #fff);
            color: var(--feezal-vacuum-text-color);
            transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .controls button:hover {
            border-color: var(--feezal-vacuum-active-color);
            color: var(--feezal-vacuum-active-color);
        }

        .fan-row {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
            width: 100%;
        }
        .fan-chip {
            font: inherit;
            font-size: 11px;
            padding: 2px 10px;
            cursor: pointer;
            border-radius: 12px;
            border: 1px solid color-mix(in srgb, var(--feezal-vacuum-idle-color) 60%, transparent);
            background: var(--feezal-bg, #fff);
            color: var(--feezal-vacuum-text-color);
            transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .fan-chip.selected {
            background: var(--feezal-vacuum-active-color);
            border-color: var(--feezal-vacuum-active-color);
            color: #fff;
        }

        .label {
            font-size: 11px;
            opacity: 0.65;
            text-align: center;
            color: var(--feezal-vacuum-text-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }
    `];

    constructor() {
        super();
        this.publishCommand    = '';
        this.payloadStart      = 'start';
        this.payloadPause      = 'pause';
        this.payloadStop       = 'stop';
        this.payloadReturnHome = 'return_home';
        this.payloadLocate     = 'locate';
        this.subscribeBattery  = '';
        this.msgPropBattery    = '';
        this.subscribeFanSpeed = '';
        this.msgPropFanSpeed   = '';
        this.publishFanSpeed   = '';
        this.fanSpeeds         = '';
        this.subscribeArea     = '';
        this.msgPropArea       = '';
        this.stateLabels       = '{}';
        this.showLocate        = true;
        this.label             = '';
        this._state            = null;
        this._battery          = null;
        this._fanSpeed         = null;
        this._area             = null;
    }

    // This element manages all subscriptions itself.
    _subscribe() { /* intentionally empty — see connectedCallback */ }

    connectedCallback() {
        super.connectedCallback();

        // Primary state (subscribe + message-property inherited from FeezalElement).
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._state = (v === null || v === undefined) ? null : String(v).toLowerCase().trim();
            });
        }
        if (this.subscribeBattery) {
            this.addSubscription(this.subscribeBattery, msg => {
                const v = Number(this.getProperty(msg, this.msgPropBattery || this.messageProperty));
                if (!isNaN(v)) this._battery = Math.max(0, Math.min(100, v));
            });
        }
        if (this.subscribeFanSpeed) {
            this.addSubscription(this.subscribeFanSpeed, msg => {
                const v = this.getProperty(msg, this.msgPropFanSpeed || this.messageProperty);
                this._fanSpeed = (v === null || v === undefined) ? null : String(v);
            });
        }
        if (this.subscribeArea) {
            this.addSubscription(this.subscribeArea, msg => {
                const v = this.getProperty(msg, this.msgPropArea || this.messageProperty);
                this._area = (v === null || v === undefined || v === '') ? null : String(v);
            });
        }
    }

    // ─── Derived state ────────────────────────────────────────────────────────
    get _labelMap() {
        if (this.stateLabels) {
            try { return {...DEFAULT_LABELS, ...JSON.parse(this.stateLabels)}; } catch { /* fall through */ }
        }
        return DEFAULT_LABELS;
    }

    _statusText(state) {
        if (state === null) return feezal.isEditor ? DEFAULT_LABELS.docked : '—';
        return this._labelMap[state] ?? humanise(state);
    }

    get _fanList() {
        return this.fanSpeeds
            ? this.fanSpeeds.split(',').map(s => s.trim()).filter(Boolean)
            : [];
    }

    // ─── Publish helpers ──────────────────────────────────────────────────────
    _sendCommand(payload) {
        if (feezal.isEditor) return;           // never publish in editor
        if (this.publishCommand) feezal.connection.pub(this.publishCommand, payload);
    }

    _setFanSpeed(speed) {
        if (feezal.isEditor) return;
        this._fanSpeed = speed;
        if (this.publishFanSpeed) feezal.connection.pub(this.publishFanSpeed, speed);
    }

    // ─── Robot illustration ───────────────────────────────────────────────────
    _renderRobot(state) {
        const color = stateColorVar(state);
        return svg`
            <!-- Rotating body group (spins only while cleaning) -->
            <g class="rotor">
                <!-- Main disc -->
                <circle cx="100" cy="100" r="70"
                    fill="${color}" fill-opacity="0.15"
                    stroke="${color}" stroke-width="4"/>
                <!-- Bumper line across the front -->
                <path d="M46,78 A70,70 0 0 1 154,78" fill="none"
                    stroke="${color}" stroke-width="4" stroke-linecap="round"/>
                <!-- Small sensor dot -->
                <circle cx="100" cy="58" r="7" fill="${color}"/>
            </g>
            <!-- Error "!" overlay -->
            ${state === 'error' ? svg`
                <text x="100" y="112" text-anchor="middle" dominant-baseline="middle"
                    font-size="52" font-weight="700"
                    fill="var(--feezal-vacuum-error-color)"
                    style="font-family:inherit">!</text>
            ` : svg``}
        `;
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    render() {
        // Unconfigured-state hint: show a plausible "docked" preview in editor.
        const state    = this._state ?? (feezal.isEditor ? 'docked' : null);
        const color    = stateColorVar(state);
        const battery  = this._battery ?? (feezal.isEditor ? 85 : null);
        const fanList  = this._fanList;
        const current  = this._fanSpeed ?? (feezal.isEditor && fanList.length ? fanList[0] : null);
        const isCleaning = state === 'cleaning';
        const isPaused   = state === 'paused';

        // Battery colour: green high → amber → red low.
        let batColor = 'var(--feezal-vacuum-battery-color)';
        if (battery !== null) {
            if (battery <= 15) batColor = 'var(--feezal-vacuum-error-color)';
            else if (battery <= 35) batColor = 'var(--feezal-vacuum-paused-color)';
        }

        return html`
            <div class="robot-wrap">
                <svg class="robot ${isCleaning ? 'cleaning' : ''}" viewBox="0 0 200 200"
                    style="opacity:${isPaused ? 0.6 : 1}">
                    ${this._renderRobot(state)}
                </svg>
            </div>

            <div class="status" style="color:${color}">${this._statusText(state)}</div>
            ${this._area ? html`<div class="area">${this._area}</div>` : ''}

            ${battery !== null ? html`
                <div class="battery">
                    <span class="mi">battery_full</span>
                    <div class="battery-bar">
                        <div class="battery-fill"
                            style="width:${Math.round(battery)}%;background:${batColor}"></div>
                    </div>
                    <span class="battery-pct">${Math.round(battery)}&nbsp;%</span>
                </div>
            ` : ''}

            <div class="controls">
                <button title="Start / Resume" @click="${() => this._sendCommand(this.payloadStart)}">
                    <span class="mi">play_arrow</span>
                </button>
                <button title="Pause" @click="${() => this._sendCommand(this.payloadPause)}">
                    <span class="mi">pause</span>
                </button>
                <button title="Stop" @click="${() => this._sendCommand(this.payloadStop)}">
                    <span class="mi">stop</span>
                </button>
                <button title="Return home" @click="${() => this._sendCommand(this.payloadReturnHome)}">
                    <span class="mi">home</span>
                </button>
                ${this.showLocate ? html`
                    <button title="Locate" @click="${() => this._sendCommand(this.payloadLocate)}">
                        <span class="mi">location_searching</span>
                    </button>
                ` : ''}
            </div>

            ${fanList.length ? html`
                <div class="fan-row">
                    ${fanList.map(speed => html`
                        <button class="fan-chip ${current === speed ? 'selected' : ''}"
                            @click="${() => this._setFanSpeed(speed)}">
                            ${speed}
                        </button>
                    `)}
                </div>
            ` : ''}

            ${this.label ? html`<div class="label">${this.label}</div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-vacuum', FeezalElementMaterialVacuum);
export {FeezalElementMaterialVacuum};

// ── Follow-up: standard flat inspector is used for now. A custom two-tab N6
//    inspector (Topics + Config, capability-gated battery/fan-speed/area
//    sections) is a sensible future enhancement, matching the climate element.
