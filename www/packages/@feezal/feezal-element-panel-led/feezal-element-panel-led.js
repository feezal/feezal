/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-panel-led (E56)
 *
 * Indicator lamp — the classic status pilot light of an instrument panel:
 * a recessed bezel with a glowing lens. Two modes:
 *
 *  - Simple: the payload is cast to boolean (payload-on / payload-off match
 *    exactly when set) → lit in the on-colour, dark otherwise.
 *  - Mapped: the `states` list maps payloads to {color, mode} — mode
 *    steady | blink | blink-fast. First matching row wins; no match falls
 *    back to the simple-mode boolean cast.
 *
 * Family look (shared --feezal-panel-* vars): dark console face, engraved
 * label. Degrades fine on flat themes — it is just a coloured dot then.
 */
class FeezalElementPanelLed extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'LED', category: 'Panel', color: '#455a64', icon: 'radio_button_checked'},
            description: 'Indicator lamp (pilot light). Payload → lit/dark, or a payload→colour/blink mapping via the states list.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'label',       type: 'string', help: 'Engraved label under the lamp.'},
                {name: 'payload-on',  type: 'string', help: 'Exact payload for the lit state. Empty = boolean cast of the payload.'},
                {name: 'payload-off', type: 'string', help: 'Exact payload for the dark state. Empty = boolean cast of the payload.'},
                {name: 'states', type: 'objectList',
                    itemFields: [
                        {key: 'payload', placeholder: 'e.g. alarm'},
                        {key: 'color', type: 'color'},
                        {key: 'mode', type: 'select', options: ['steady', 'blink', 'blink-fast']},
                    ],
                    help: 'Optional payload→state mapping: colour + steady/blink per payload. First match wins; no match falls back to on/off.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-panel-led-on-color', type: 'color',
                    default: 'var(--success-color, #43a047)',
                    help: 'Lens colour when lit (simple mode).'},
                {property: '--feezal-panel-led-off-color', type: 'color',
                    default: '#1c221f',
                    help: 'Lens colour when dark.'},
                {property: '--feezal-panel-bezel', type: 'color', default: '#3c454d', help: 'Bezel/ring colour (shared across panel-* elements).'},
                {property: '--feezal-panel-text', type: 'color', default: '#aeb7bd', help: 'Engraved label colour (shared across panel-* elements).'},
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '60px', height: '72px'},
            discovery: {
                component: 'binary_sensor',
                map: {
                    state_topic:    'subscribe',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        label:      {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        states:     {type: String, reflect: true},
        _value:     {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 6px; box-sizing: border-box; overflow: hidden;
            --feezal-panel-led-on-color: var(--success-color, #43a047);
            --feezal-panel-led-off-color: #1c221f;
        }
        .lens-wrap { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; }
        .lens {
            /* Sized by the host box; kept round via aspect-ratio. */
            height: 100%; max-height: 100%; aspect-ratio: 1; max-width: 100%;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%),
                var(--_led-color, var(--feezal-panel-led-off-color, #1c221f));
            border: 3px solid var(--feezal-panel-bezel, #3c454d);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.55);
            box-sizing: border-box;
        }
        .lens.lit {
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.35),
                0 0 10px 2px color-mix(in srgb, var(--_led-color) 65%, transparent);
        }
        .lens.blink      { animation: feezal-led-blink 1s   step-end infinite; }
        .lens.blink-fast { animation: feezal-led-blink 0.3s step-end infinite; }
        @keyframes feezal-led-blink {
            50% { background:
                radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%),
                var(--feezal-panel-led-off-color, #1c221f);
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.55); }
        }
        .label {
            flex: 0 0 auto; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--feezal-panel-text, #aeb7bd);
            max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.payloadOn = '';
        this.payloadOff = '';
        this.states = '[]';
        this._value = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    _stateRows() {
        try {
            const r = JSON.parse(this.states || '[]');
            return Array.isArray(r) ? r.filter(s => s && s.payload !== undefined) : [];
        } catch {
            return [];
        }
    }

    /** Resolve the current visual state: {lit, color, mode}. */
    _resolve() {
        // Unconfigured hint on the editor canvas: show the lamp lit.
        const value = this._value ?? (feezal.isEditor && !this.subscribe ? true : null);
        const raw = value === null || value === undefined ? '' : String(value);

        const mapped = this._stateRows().find(s => String(s.payload) === raw);
        if (mapped) {
            return {lit: true, color: mapped.color || 'var(--feezal-panel-led-on-color)', mode: mapped.mode || 'steady'};
        }

        let lit;
        if (this.payloadOn !== '' && raw === this.payloadOn) lit = true;
        else if (this.payloadOff !== '' && raw === this.payloadOff) lit = false;
        else lit = Boolean(this._payloadCast(Boolean, value));
        return {lit, color: 'var(--feezal-panel-led-on-color)', mode: 'steady'};
    }

    render() {
        const {lit, color, mode} = this._resolve();
        const blink = lit && mode !== 'steady' ? mode : '';
        return html`
            <div class="lens-wrap">
                <div class="lens ${lit ? 'lit' : ''} ${blink}"
                    style="${lit ? `--_led-color:${color}` : ''}"></div>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-panel-led', FeezalElementPanelLed);
export {FeezalElementPanelLed};
