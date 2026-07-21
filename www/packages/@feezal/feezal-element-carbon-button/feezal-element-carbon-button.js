/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, publishLocalAttribute} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/button/button.js';

class FeezalElementCarbonButton extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Button',
                category: 'Carbon',
                color: '#393939'
            },
            description: 'IBM Carbon button. Publishes a configurable payload to an MQTT topic on click; ' +
                'optionally reflects the state it controls via subscribe (active highlight).',
            attributes: [
                {name: 'label',   type: 'string',  help: 'Button label text.', default: 'Button'},
                {name: 'publish', type: 'mqttTopic', help: 'MQTT topic to publish to on click.'},
                publishLocalAttribute,
                {name: 'payload', type: 'string',  help: 'Payload published on click.', default: '1'},
                // E79: state feedback — the button highlights while the state
                // it controls is active (same contract as material-button).
                {name: 'subscribe', type: 'mqttTopic', help: 'State feedback topic — payloads matching payload-active/-inactive drive the active highlight.'},
                {name: 'message-property', type: 'string', default: 'payload', help: 'Dot-notation path to the state value within feedback messages. Default: payload.'},
                {name: 'payload-active',   type: 'string', default: '1', help: 'Feedback payload meaning active (highlight on). Empty together with payload-inactive = feature off.'},
                {name: 'payload-inactive', type: 'string', default: '0', help: 'Feedback payload meaning inactive. Any other payload leaves the state unchanged.'},
                {name: 'disabled', type: 'boolean', default: false, help: 'Disable the button (blocks clicking/publishing). UI-only guard — the MQTT topic itself stays writable; E50 conditions can toggle this from state.'},
                {name: 'variant', type: 'select',
                    options: ['primary', 'secondary', 'tertiary', 'ghost', 'danger'],
                    default: 'primary',
                    help: 'Carbon button kind: primary (solid), secondary, tertiary (outline), ghost (text only), danger (destructive red).'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-button-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Button fill / accent colour (base token).'},
                {property: '--feezal-button-active-color',   type: 'color', default: 'var(--feezal-button-color)', help: 'Accent colour while the state feedback is active. Defaults to the base colour.'},
                {property: '--feezal-button-inactive-color', type: 'color', default: 'var(--feezal-button-color)', help: 'Accent colour while inactive. Defaults to the base colour.'},
            ],
            defaultStyle: {width: '120px', height: '48px'}
        };
    }

    static properties = {
        publishLocal: {type: Boolean, reflect: true, attribute: 'publish-local'},
        label:   {type: String, reflect: true},
        publish: {type: String, reflect: true},
        payload: {type: String, reflect: true},
        variant: {type: String, reflect: true},
        payloadActive:   {type: String,  reflect: true, attribute: 'payload-active'},
        payloadInactive: {type: String,  reflect: true, attribute: 'payload-inactive'},
        disabled:        {type: Boolean, reflect: true},
        // E79: reflected so theme rules can target feezal-element-carbon-button[active].
        active:          {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: stretch;
            justify-content: stretch;
            --feezal-button-color:          var(--primary-color, var(--sl-color-primary-600, #0284c7));
            /* E79: state-feedback colours — both default to the base token, so
               nothing changes visually until a theme/style overrides them. The
               private --_btn-color switches with the [active] host attribute
               and feeds the Carbon button tokens. */
            --feezal-button-active-color:   var(--feezal-button-color);
            --feezal-button-inactive-color: var(--feezal-button-color);
            --_btn-color:                   var(--feezal-button-inactive-color);
            /* Carbon token wiring — hover/active states derive from the base. */
            --cds-button-primary:           var(--_btn-color);
            --cds-button-primary-hover:     color-mix(in srgb, var(--_btn-color) 85%, #000);
            --cds-button-primary-active:    color-mix(in srgb, var(--_btn-color) 70%, #000);
            --cds-button-secondary:         color-mix(in srgb, var(--_btn-color) 30%, var(--feezal-bg, #fff));
            --cds-button-secondary-hover:   color-mix(in srgb, var(--_btn-color) 40%, var(--feezal-bg, #fff));
            --cds-button-secondary-active:  color-mix(in srgb, var(--_btn-color) 50%, var(--feezal-bg, #fff));
            --cds-button-tertiary:          var(--_btn-color);
            --cds-button-tertiary-hover:    color-mix(in srgb, var(--_btn-color) 85%, #000);
            --cds-button-tertiary-active:   color-mix(in srgb, var(--_btn-color) 70%, #000);
            --cds-button-focus-color:       var(--_btn-color);
            --cds-focus:                    var(--_btn-color);
            --cds-link-primary:             var(--_btn-color);
            --cds-text-primary:             var(--primary-text-color, var(--feezal-color, #333));
        }
        :host([active]) {
            --_btn-color: var(--feezal-button-active-color);
        }
        cds-button {
            flex: 1;
            display: flex;
        }
        cds-button::part(button) {
            width: 100%;
            height: 100%;
            align-items: center;
        }
    `];

    constructor() {
        super();
        this.publishLocal = false;
        this.label   = 'Button';
        this.publish = '';
        this.payload = '1';
        this.variant = 'primary';
        this.payloadActive   = '1';
        this.payloadInactive = '0';
        this.disabled = false;
        this.active   = false;
    }

    connectedCallback() {
        super.connectedCallback();
        // E79: optional state feedback.
        if (this.subscribe && (this.payloadActive || this.payloadInactive)) {
            this.addSubscription(this.subscribe, msg => {
                const v = String(this.getProperty(msg, this.messageProperty));
                if (v === String(this.payloadActive)) this.active = true;
                else if (v === String(this.payloadInactive)) this.active = false;
            });
        }
    }

    _click() {
        if (this.disabled) return;
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload, {local: this.publishLocal});
        }
    }

    render() {
        return html`
            <cds-button
                kind="${this.variant}"
                ?disabled="${this.disabled}"
                @click="${this._click}">${this.label}</cds-button>`;
    }
}

customElements.define('feezal-element-carbon-button', FeezalElementCarbonButton);
export {FeezalElementCarbonButton};
