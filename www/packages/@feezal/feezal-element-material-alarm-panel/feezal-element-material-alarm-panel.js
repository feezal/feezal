/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

// ─── State → banner colour + default label ──────────────────────────────────
// These banner colours are inherent state indicators (green = safe, red = alarm,
// etc.) and are intentionally kept as literals per the element spec. The panel
// surface / text / keypad colours are routed through --feezal-alarm-* vars.
const STATE_META = {
    disarmed:   {color: '#4caf50', label: 'Disarmed'},
    arming:     {color: '#ff9800', label: 'Arming…'},
    armed_home: {color: '#2196f3', label: 'Armed Home'},
    armed_away: {color: '#f44336', label: 'Armed Away'},
    armed_night:{color: '#9c27b0', label: 'Armed Night'},
    triggered:  {color: '#f44336', label: 'ALARM!'},
    pending:    {color: '#ff9800', label: 'Pending'},
};

// Keypad layout: 1–9, then ✕ (clear), 0, ✓ (confirm).
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'confirm'];

// ─── Element ────────────────────────────────────────────────────────────────
class FeezalElementMaterialAlarmPanel extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Alarm', category: 'Material', color: '#1565c0', icon: 'security'},
            description: 'Security alarm control panel — colour-coded state banner, masked PIN entry, a numeric keypad and a row of arm-mode buttons. Arming/disarming publishes {"action","code"} to the action topic; the entered PIN is cleared immediately after publishing and never stored.',
            // NOTE (follow-up): a two-tab custom N6 inspector (Topics + Config) would
            // pair the subscribe/publish-action wiring with the modes / state-labels
            // JSON builders. Standard flat inspector is used for now.
            discovery: {
                component: 'alarm_control_panel',
                map: {
                    state_topic:        {attr: 'subscribe'},
                    command_topic:      {attr: 'publish-action'},
                    code_arm_required:  {attr: 'require-code-to-arm'},
                    value_template:     {attr: 'message-property', transform: 'valueTemplateToPath'},
                    name:               'label',
                },
            },
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic publishing the current alarm state (disarmed, arming, armed_home, armed_away, armed_night, triggered, pending).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the state value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish-action', type: 'mqttTopic',
                    help: 'Topic to publish arm/disarm actions to as JSON: {"action":"arm_home","code":"1234"}. Action is the mode value when arming, or "disarm" when disarming.'},
                {name: 'modes', type: 'objectList', itemFields: [{key: 'value'}, {key: 'label'}], default: '[{"value":"armed_home","label":"Home"},{"value":"armed_away","label":"Away"}]',
                    help: 'JSON array of arm-mode buttons: [{"value":"armed_home","label":"Home"},{"value":"armed_away","label":"Away"}]. Pressing a button arms the panel in that mode.'},
                {name: 'require-code-to-arm', type: 'boolean', default: true,
                    help: 'Whether a PIN is required to arm. If off, arming publishes with an empty code. Disarming always requires the code.'},
                {name: 'code-length', type: 'number', default: 4, min: 1, max: 12, step: 1,
                    help: 'Number of PIN digits shown in the masked display.'},
                {name: 'state-labels', type: 'string', default: '{}',
                    help: 'Optional JSON map of state→label overrides, e.g. {"disarmed":"Off","triggered":"Intruder!"}.'},
                {name: 'label', type: 'string', default: 'Alarm', help: 'Card title shown at the top of the banner.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'border-radius',
                {property: '--feezal-alarm-surface-color', type: 'color',
                    default: 'var(--secondary-background-color, var(--feezal-bg, #fff))',
                    help: 'Panel background colour.'},
                {property: '--feezal-alarm-text-color', type: 'color',
                    default: 'var(--primary-text-color, var(--feezal-color, #212121))',
                    help: 'Panel and keypad text colour.'},
                {property: '--feezal-alarm-key-color', type: 'color',
                    default: 'var(--primary-background-color, var(--feezal-bg2, #f5f5f5))',
                    help: 'Keypad / mode-button background colour.'},
                {property: '--feezal-alarm-border-color', type: 'color',
                    default: 'var(--feezal-border, #e0e0e0)',
                    help: 'Keypad / mode-button border colour.'},
            ],
            restrict:     {minWidth: 160, minHeight: 240},
            defaultStyle: {width: '220px', height: '320px'},
        };
    }

    static properties = {
        subscribe:        {type: String,  reflect: true},
        publishAction:    {type: String,  reflect: true, attribute: 'publish-action'},
        modes:            {type: String,  reflect: true},
        requireCodeToArm: {type: Boolean, reflect: true, attribute: 'require-code-to-arm'},
        codeLength:       {type: Number,  reflect: true, attribute: 'code-length'},
        stateLabels:      {type: String,  reflect: true, attribute: 'state-labels'},
        label:            {type: String,  reflect: true},
        // Internal state — never as class fields (Lit 3 rule)
        _state: {state: true},   // null | string — current alarm state
        _pin:   {state: true},   // string — accumulated PIN digits (cleared after publish)
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
            padding: 8px;
            gap: 8px;
            border-radius: 8px;
            background: var(--feezal-alarm-surface-color);
            color: var(--feezal-alarm-text-color);

            /* ── Theme-aware colour tokens ─────────────────────────────────── */
            --feezal-alarm-surface-color: var(--secondary-background-color, var(--feezal-bg,  #fff));
            --feezal-alarm-text-color:    var(--primary-text-color,         var(--feezal-color, #212121));
            --feezal-alarm-key-color:     var(--primary-background-color,   var(--feezal-bg2, #f5f5f5));
            --feezal-alarm-border-color:  var(--feezal-border, #e0e0e0);
        }
        .mi {
            font-family: 'Material Icons';
            font-style: normal;
            font-weight: normal;
            line-height: 1;
            font-size: 1.1em;
            -webkit-font-feature-settings: 'liga';
        }
        .banner {
            flex: 0 0 auto;
            border-radius: 6px;
            padding: 8px;
            text-align: center;
            color: #fff;
        }
        .banner .title {
            font-size: 11px;
            opacity: 0.85;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .banner .state {
            font-size: 16px;
            font-weight: 700;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .banner.triggered { animation: flash 0.7s steps(1) infinite; }
        .banner.pending   { animation: pulse 1.2s ease-in-out infinite; }
        @keyframes flash { 50% { opacity: 0.35; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .pin {
            flex: 0 0 auto;
            text-align: center;
            letter-spacing: 6px;
            font-size: 20px;
            min-height: 24px;
            line-height: 24px;
            color: var(--feezal-alarm-text-color);
        }
        .keypad {
            flex: 1 1 auto;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            min-height: 0;
        }
        .modes {
            flex: 0 0 auto;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        button {
            cursor: pointer;
            font: inherit;
            color: var(--feezal-alarm-text-color);
            background: var(--feezal-alarm-key-color);
            border: 1px solid var(--feezal-alarm-border-color);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        button:active { filter: brightness(0.92); }
        .keypad button { font-size: 18px; }
        .key-clear   { color: #f44336; }
        .key-confirm { color: #4caf50; }
        .modes button {
            flex: 1 1 0;
            min-width: 60px;
            padding: 8px 4px;
            font-size: 13px;
            font-weight: 600;
        }
    `];

    constructor() {
        super();
        this.subscribe        = '';
        this.publishAction    = '';
        this.modes            = '[{"value":"armed_home","label":"Home"},{"value":"armed_away","label":"Away"}]';
        this.requireCodeToArm = true;
        this.codeLength       = 4;
        this.stateLabels      = '{}';
        this.label            = 'Alarm';
        this._state           = null;
        this._pin             = '';
    }

    // The panel manages its own subscriptions.
    _subscribe() { /* intentionally empty */ }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                if (v !== null && v !== undefined) this._state = String(v);
            });
        }
    }

    // ─── Parsers ──────────────────────────────────────────────────────────────
    _parsedModes() {
        try {
            const arr = JSON.parse(this.modes);
            if (Array.isArray(arr)) {
                return arr.map(m => typeof m === 'string' ? {value: m, label: m} : m);
            }
        } catch { /* fall through */ }
        return [];
    }

    _stateLabel(state) {
        let overrides = {};
        try { overrides = JSON.parse(this.stateLabels) || {}; } catch { /* ignore */ }
        if (overrides[state]) return overrides[state];
        return STATE_META[state]?.label ?? (state || 'Unknown');
    }

    // ─── PIN keypad handling ────────────────────────────────────────────────────
    _onKey(key) {
        if (feezal.isEditor) return;
        if (key === 'clear') {
            this._pin = '';
            return;
        }
        if (key === 'confirm') {
            this._disarm();
            return;
        }
        // Digit — accumulate up to code-length.
        if (this._pin.length < this.codeLength) {
            this._pin += key;
        }
    }

    // ─── Actions ────────────────────────────────────────────────────────────────
    _arm(mode) {
        if (feezal.isEditor) return;
        if (this.requireCodeToArm && this._pin.length === 0) return;
        const action = mode.replace(/^armed_/, 'arm_'); // armed_home → arm_home
        this._publish(action);
    }

    _disarm() {
        if (feezal.isEditor) return;
        // Disarm always requires the code.
        if (this._pin.length === 0) return;
        this._publish('disarm');
    }

    _publish(action) {
        const code = this._pin;
        // Clear the PIN from the display immediately — never store or log it.
        this._pin = '';
        if (this.publishAction) {
            feezal.connection.pub(this.publishAction, JSON.stringify({action, code}));
        }
    }

    // ─── Render (unified — live in editor and viewer) ────────────────────────────
    render() {
        const state    = this._state ?? (feezal.isEditor ? 'disarmed' : null);
        const meta      = STATE_META[state] ?? {color: '#607d8b'};
        const bannerCls = state === 'triggered' ? 'triggered' : (state === 'pending' ? 'pending' : '');
        const dots      = '●'.repeat(this._pin.length) + '○'.repeat(Math.max(0, this.codeLength - this._pin.length));

        return html`
            <div class="banner ${bannerCls}" style="background:${meta.color}">
                <div class="title">${this.label || 'Alarm'}</div>
                <div class="state">${this._stateLabel(state)}</div>
            </div>

            <div class="pin">${this._pin.length ? dots : ''}</div>

            <div class="keypad">
                ${KEYPAD.map(key => {
                    if (key === 'clear') {
                        return html`<button class="key-clear" title="Clear"
                            @click="${() => this._onKey('clear')}">✕</button>`;
                    }
                    if (key === 'confirm') {
                        return html`<button class="key-confirm" title="Confirm / disarm"
                            @click="${() => this._onKey('confirm')}">✓</button>`;
                    }
                    return html`<button @click="${() => this._onKey(key)}">${key}</button>`;
                })}
            </div>

            <div class="modes">
                ${this._parsedModes().map(m => html`
                    <button @click="${() => this._arm(m.value)}">${m.label ?? m.value}</button>
                `)}
            </div>
        `;
    }
}

customElements.define('feezal-element-material-alarm-panel', FeezalElementMaterialAlarmPanel);
export {FeezalElementMaterialAlarmPanel};
