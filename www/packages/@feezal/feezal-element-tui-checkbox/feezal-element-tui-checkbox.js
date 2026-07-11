/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-checkbox (E59, renamed from tui-toggle)
 *
 * Terminal checkbox: `[X] label` / `[ ] label`. Click (or Space/Enter when
 * focused) flips and publishes payload-on/payload-off — material-switch
 * contract in console clothes.
 */
class FeezalElementTuiCheckbox extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Checkbox', category: 'TUI', color: '#1e6b2f', icon: 'check_box'},
            description: 'Terminal checkbox ([X] label). Subscribes to the state and publishes payload-on/payload-off on click or Space/Enter.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish payload-on / payload-off to on toggle.'},
                {name: 'label',       type: 'string', help: 'Checkbox label.'},
                {name: 'payload-on',  type: 'string', default: 'ON',  help: 'Payload published for / matched against the ON state. Default: ON'},
                {name: 'payload-off', type: 'string', default: 'OFF', help: 'Payload published for / matched against the OFF state. Default: OFF'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 40, minHeight: 16},
            defaultStyle: {width: '180px', height: '24px'},
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        publish:    {type: String, reflect: true},
        label:      {type: String, reflect: true},
        payloadOn:  {type: String, reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String, reflect: true, attribute: 'payload-off'},
        _on:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; align-items: center; box-sizing: border-box; overflow: hidden;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
            font-size: 14px; line-height: 1.2; padding: 0 0.5ch;
            cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
        }
        :host(:focus-visible) { outline: 1px solid var(--feezal-tui-color, #33ff66); outline-offset: 1px; }
        .row { display: flex; align-items: baseline; gap: 1ch; width: 100%; min-width: 0; white-space: nowrap; }
        .box { flex: 0 0 auto; }
        .label { overflow: hidden; text-overflow: ellipsis; }
        :host(:hover) .box { text-shadow: 0 0 8px var(--feezal-tui-color, #33ff66); }
    `];

    constructor() {
        super();
        this.publish = '';
        this.label = '';
        this.payloadOn = 'ON';
        this.payloadOff = 'OFF';
        this._on = false;
        this.__onKey = e => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this._toggle();
            }
        };
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        this.addEventListener('click', this.__onClick = () => this._toggle());
        this.addEventListener('keydown', this.__onKey);
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const raw = v === null || v === undefined ? '' : String(v);
                if (raw === this.payloadOn) this._on = true;
                else if (raw === this.payloadOff) this._on = false;
                else this._on = Boolean(this._payloadCast(Boolean, v));
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('click', this.__onClick);
        this.removeEventListener('keydown', this.__onKey);
    }

    _toggle() {
        if (feezal.isEditor) return;
        this._on = !this._on;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        return html`
            <div class="row">
                <span class="box">[${this._on ? 'X' : ' '}]</span>
                <span class="label">${this.label || 'checkbox'}</span>
            </div>`;
    }
}

customElements.define('feezal-element-tui-checkbox', FeezalElementTuiCheckbox);
export {FeezalElementTuiCheckbox};
