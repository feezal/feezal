/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/button/elevated-button.js';
import '@material/web/button/filled-tonal-button.js';

class FeezalElementMaterialButton extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Button',
                category: 'Simple',
                color: '#4a6080'
            },
            description: 'Material Design 3 button. Publishes a configurable payload to an MQTT topic on click; ' +
                'optionally reflects the state it controls via subscribe (active highlight).',
            attributes: [
                {name: 'label',   type: 'string',  help: 'Button label text.', default: 'Button'},
                {name: 'publish', type: 'mqttTopic', help: 'MQTT topic to publish to on click.'},
                {name: 'payload', type: 'string',  help: 'Payload published on click.', default: '1'},
                // E79: state feedback — the button highlights while the state
                // it controls is active.
                {name: 'subscribe', type: 'mqttTopic', help: 'State feedback topic — payloads matching payload-active/-inactive drive the active highlight.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Dot-notation path to the state value within feedback messages. Default: payload.'},
                {name: 'payload-active',   type: 'string', default: '1', help: 'Feedback payload meaning active (highlight on). Empty together with payload-inactive = feature off.'},
                {name: 'payload-inactive', type: 'string', default: '0', help: 'Feedback payload meaning inactive. Any other payload leaves the state unchanged.'},
                {name: 'disabled', type: 'boolean', default: false, help: 'Disable the button (blocks clicking/publishing). UI-only guard — the MQTT topic itself stays writable; E50 conditions can toggle this from state.'},
                {name: 'variant', type: 'select',
                    options: ['filled', 'outlined', 'text', 'elevated', 'tonal'],
                    default: 'filled',
                    help: 'Visual style: filled (solid), outlined (border only), text, elevated (shadow), tonal (secondary container).'},
                {name: 'icon',    type: 'string',  help: 'Optional Material Icons ligature shown before the label.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-button-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Button fill / accent colour (base token).'},
                {property: '--feezal-button-active-color',   type: 'color', default: 'var(--feezal-button-color)', help: 'Accent colour while the state feedback is active. Defaults to the base colour.'},
                {property: '--feezal-button-inactive-color', type: 'color', default: 'var(--feezal-button-color)', help: 'Accent colour while inactive. Defaults to the base colour.'},
            ],
            defaultStyle: {width: '120px', height: '40px'}
        };
    }

    static properties = {
        label:   {type: String, reflect: true},
        publish: {type: String, reflect: true},
        payload: {type: String, reflect: true},
        variant: {type: String, reflect: true},
        icon:    {type: String, reflect: true},
        payloadActive:   {type: String,  reflect: true, attribute: 'payload-active'},
        payloadInactive: {type: String,  reflect: true, attribute: 'payload-inactive'},
        disabled:        {type: Boolean, reflect: true},
        // E79: reflected as a boolean host attribute so theme rules/classes can
        // target feezal-element-material-button[active] beyond the CSS tokens.
        active:          {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: stretch;
            justify-content: stretch;
            --feezal-button-color:             var(--primary-color, var(--sl-color-primary-600, #0284c7));
            /* E79: state-feedback colours — both default to the base token, so
               nothing changes visually until a theme/style overrides them. The
               private --_btn-color switches with the [active] host attribute
               and feeds the MD3 tokens, so all five variants render the state. */
            --feezal-button-active-color:      var(--feezal-button-color);
            --feezal-button-inactive-color:    var(--feezal-button-color);
            --_btn-color:                      var(--feezal-button-inactive-color);
            --md-sys-color-primary:            var(--_btn-color);
            --md-sys-color-on-primary:         #fff;
            --md-sys-color-secondary-container: color-mix(in srgb, var(--_btn-color) 15%, var(--feezal-bg, #fff));
            --md-sys-color-on-secondary-container: var(--_btn-color);
            --md-sys-color-surface:            var(--feezal-bg, #fff);
            --md-sys-color-on-surface:         var(--feezal-color, #333);
        }
        :host([active]) {
            --_btn-color: var(--feezal-button-active-color);
        }
        md-filled-button, md-outlined-button, md-text-button,
        md-elevated-button, md-filled-tonal-button {
            width: 100%;
            height: 100%;
        }
        .editor-ph {
            flex: 1;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid var(--feezal-button-color); border-radius: 20px;
            font-size: 12px; color: var(--feezal-button-color); gap: 4px;
            background: color-mix(in srgb, var(--feezal-button-color) 8%, transparent);
            user-select: none;
        }
    `];

    constructor() {
        super();
        this.label   = 'Button';
        this.publish = '';
        this.payload = '1';
        this.variant = 'filled';
        this.icon    = '';
        this.payloadActive   = '1';
        this.payloadInactive = '0';
        this.disabled = false;
        this.active   = false;
    }

    connectedCallback() {
        super.connectedCallback();
        // E79: state feedback — matching payloads drive the active highlight;
        // anything else leaves the state unchanged. Both payloads empty =
        // feature off (today's fire-and-forget behaviour).
        if (this.subscribe && (this.payloadActive || this.payloadInactive)) {
            this.addSubscription(this.subscribe, msg => {
                const v = String(this.getProperty(msg, this.messageProperty));
                if (this.payloadActive !== '' && v === String(this.payloadActive)) {
                    this.active = true;
                } else if (this.payloadInactive !== '' && v === String(this.payloadInactive)) {
                    this.active = false;
                }
            });
        }
    }

    _click() {
        if (this.disabled) return;   // E79: UI guard only — not a security boundary
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload);
        }
    }

    _iconSlot() {
        return this.icon
            ? html`<feezal-icon slot="icon" name="${this.icon}"></feezal-icon>`
            : '';
    }

    render() {

        switch (this.variant) {
            case 'outlined':
                return html`<md-outlined-button ?disabled="${this.disabled}" @click="${this._click}">${this._iconSlot()}${this.label}</md-outlined-button>`;
            case 'text':
                return html`<md-text-button ?disabled="${this.disabled}" @click="${this._click}">${this._iconSlot()}${this.label}</md-text-button>`;
            case 'elevated':
                return html`<md-elevated-button ?disabled="${this.disabled}" @click="${this._click}">${this._iconSlot()}${this.label}</md-elevated-button>`;
            case 'tonal':
                return html`<md-filled-tonal-button ?disabled="${this.disabled}" @click="${this._click}">${this._iconSlot()}${this.label}</md-filled-tonal-button>`;
            default:
                return html`<md-filled-button ?disabled="${this.disabled}" @click="${this._click}">${this._iconSlot()}${this.label}</md-filled-button>`;
        }
    }
}

customElements.define('feezal-element-material-button', FeezalElementMaterialButton);
export {FeezalElementMaterialButton};
