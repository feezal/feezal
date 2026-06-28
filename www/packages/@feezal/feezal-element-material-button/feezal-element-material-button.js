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
                category: 'Material',
                color: '#4a6080'
            },
            description: 'Material Design 3 button. Publishes a configurable payload to an MQTT topic on click.',
            attributes: [
                {name: 'label',   type: 'string',  help: 'Button label text.', default: 'Button'},
                {name: 'publish', type: 'mqttTopic', help: 'MQTT topic to publish to on click.'},
                {name: 'payload', type: 'string',  help: 'Payload published on click.', default: '1'},
                {name: 'variant', type: 'select',
                    options: ['filled', 'outlined', 'text', 'elevated', 'tonal'],
                    default: 'filled',
                    help: 'Visual style: filled (solid), outlined (border only), text, elevated (shadow), tonal (secondary container).'},
                {name: 'icon',    type: 'string',  help: 'Optional Material Icons ligature shown before the label.'}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-button-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'Button fill / accent colour.'},
            ],
            defaultStyle: {width: '120px', height: '40px'}
        };
    }

    static properties = {
        label:   {type: String, reflect: true},
        publish: {type: String, reflect: true},
        payload: {type: String, reflect: true},
        variant: {type: String, reflect: true},
        icon:    {type: String, reflect: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: stretch;
            justify-content: stretch;
            --feezal-button-color:             var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary:            var(--feezal-button-color);
            --md-sys-color-on-primary:         #fff;
            --md-sys-color-secondary-container: var(--sl-color-primary-100, #e0f2fe);
            --md-sys-color-on-secondary-container: var(--sl-color-primary-900, #0c4a6e);
            --md-sys-color-surface:            var(--feezal-bg, #fff);
            --md-sys-color-on-surface:         var(--feezal-color, #333);
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
    }

    _click() {
        if (this.publish) {
            feezal.connection.pub(this.publish, this.payload);
        }
    }

    _iconSlot() {
        return this.icon
            ? html`<span slot="icon" style="font-family:'Material Icons';font-style:normal">${this.icon}</span>`
            : '';
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="editor-ph">⬡ ${this.label || 'Button'}</div>`;
        }
        switch (this.variant) {
            case 'outlined':
                return html`<md-outlined-button @click="${this._click}">${this._iconSlot()}${this.label}</md-outlined-button>`;
            case 'text':
                return html`<md-text-button @click="${this._click}">${this._iconSlot()}${this.label}</md-text-button>`;
            case 'elevated':
                return html`<md-elevated-button @click="${this._click}">${this._iconSlot()}${this.label}</md-elevated-button>`;
            case 'tonal':
                return html`<md-filled-tonal-button @click="${this._click}">${this._iconSlot()}${this.label}</md-filled-tonal-button>`;
            default:
                return html`<md-filled-button @click="${this._click}">${this._iconSlot()}${this.label}</md-filled-button>`;
        }
    }
}

customElements.define('feezal-element-material-button', FeezalElementMaterialButton);
export {FeezalElementMaterialButton};
