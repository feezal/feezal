/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-value (E59)
 *
 * Terminal readout row: `label........: value` with dot leaders filling the
 * available width and a blinking cursor block that appears for a moment
 * whenever a new value arrives (suppressed under prefers-reduced-motion).
 *
 * Family look: monospace, phosphor colour + glow via the shared
 * --feezal-tui-* vars (green default; themes/styles override).
 */
class FeezalElementTuiValue extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Value', category: 'TUI', color: '#1e6b2f', icon: 'terminal'},
            description: 'Terminal dot-leader readout row (label……: value) with a blinking cursor on change.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'label',  type: 'string', help: 'Row label (left side).'},
                {name: 'unit',   type: 'string', help: 'Unit appended to the value.'},
                {name: 'digits', type: 'number', default: '', help: 'Fixed decimal places for numeric payloads. Empty = show the value as received.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 16},
            defaultStyle: {width: '240px', height: '24px'},
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         'subscribe',
                    name:                'label',
                    unit_of_measurement: 'unit',
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        label:  {type: String, reflect: true},
        unit:   {type: String, reflect: true},
        digits: {type: Number, reflect: true},
        _value:  {state: true},
        _cursor: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; align-items: center; box-sizing: border-box; overflow: hidden;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
            font-size: 14px; line-height: 1.2; padding: 0 0.5ch;
        }
        .row { display: flex; align-items: baseline; width: 100%; min-width: 0; white-space: nowrap; }
        .label { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
        /* dot leaders — a clipped run of dots stretching between label and value */
        .dots {
            flex: 1 1 0; min-width: 2ch; overflow: hidden; opacity: 0.55;
            margin: 0 0.5ch;
        }
        .dots::before {
            content: '..........................................................................';
        }
        .value { flex: 0 0 auto; }
        .cursor { display: inline-block; width: 1ch; }
        @media (prefers-reduced-motion: no-preference) {
            .cursor.on { animation: feezal-tui-blink 0.5s step-end infinite; }
        }
        @keyframes feezal-tui-blink { 50% { opacity: 0; } }
    `];

    constructor() {
        super();
        this.label = '';
        this.unit = '';
        this.digits = null;
        this._value = null;
        this._cursor = false;
        this.__cursorTimer = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
                // Cursor block blinks for a moment after each message.
                this._cursor = true;
                clearTimeout(this.__cursorTimer);
                this.__cursorTimer = setTimeout(() => { this._cursor = false; }, 2000);
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.__cursorTimer);
    }

    _display() {
        let v = this._value ?? (feezal.isEditor && !this.subscribe ? 42 : null);
        if (v === null || v === undefined) return '—';
        if (this.digits !== null && this.digits !== undefined && this.digits !== '' && !isNaN(Number(v))) {
            v = Number(v).toFixed(Number(this.digits));
        }
        return `${v}${this.unit ? ' ' + this.unit : ''}`;
    }

    render() {
        return html`
            <div class="row">
                <span class="label">${this.label || 'value'}</span>
                <span class="dots"></span>
                <span class="value">${this._display()}</span>
                <span class="cursor ${this._cursor ? 'on' : ''}">${this._cursor ? '█' : ''}</span>
            </div>`;
    }
}

customElements.define('feezal-element-tui-value', FeezalElementTuiValue);
export {FeezalElementTuiValue};
