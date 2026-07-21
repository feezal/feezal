/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, publishLocalAttribute} from '@feezal/feezal-element';
import '@material/web/fab/fab.js';

class FeezalElementMaterialFab extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'FAB', category: 'Simple', color: '#4a6080', icon: 'add_circle'},
            description: 'MD3 Floating Action Button — publishes a payload on click.',
            attributes: [
                {name: 'icon',     type: 'string',    help: 'Material icon name inside the FAB (e.g. "add", "edit").'},
                {name: 'label',    type: 'string',    help: 'Text label (makes the FAB extended).'},
                {name: 'publish',  type: 'mqttTopic', help: 'Topic to publish to on click.'},
                publishLocalAttribute,
                {name: 'payload',  type: 'string',    help: 'Payload to publish. Default: 1'},
                {name: 'size',     type: 'select',    options: ['small', 'medium', 'large'], help: 'FAB size. Default: medium'},
                {name: 'variant',  type: 'select',    options: ['surface', 'primary', 'secondary', 'tertiary'], help: 'Color variant.'},
                {name: 'disabled', type: 'boolean',   help: 'Disable the button.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-fab-color', type: 'color', default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))', help: 'FAB fill colour.'},
            ],
            defaultStyle: {width: '56px', height: '56px'},
        };
    }

    static properties = {
        publishLocal: {type: Boolean, reflect: true, attribute: 'publish-local'},
        icon:     {type: String,  reflect: true},
        label:    {type: String,  reflect: true},
        publish:  {type: String,  reflect: true},
        payload:  {type: String,  reflect: true},
        size:     {type: String,  reflect: true},
        variant:  {type: String,  reflect: true},
        disabled: {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            --feezal-fab-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            /*
             * B13: md-fab resolves its fill from the component-level container
             * tokens (per variant), not directly from the sys tokens. Set them
             * all so the exposed --feezal-fab-color (and the active feezal theme)
             * always take effect regardless of the selected variant, with a white
             * icon for contrast.
             */
            --md-fab-container-color:           var(--feezal-fab-color);
            --md-fab-primary-container-color:   var(--feezal-fab-color);
            --md-fab-secondary-container-color: var(--feezal-fab-color);
            --md-fab-tertiary-container-color:  var(--feezal-fab-color);
            --md-fab-icon-color:                #fff;
            --md-fab-primary-icon-color:        #fff;
            --md-fab-secondary-icon-color:      #fff;
            --md-fab-tertiary-icon-color:       #fff;
        }
        .editor-ph {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 16px;
            min-width: 40px;
            min-height: 40px;
            border-radius: 16px;
            background: var(--feezal-fab-color);
            color: #fff;
            font-size: 14px;
            font-family: 'Material Symbols Outlined', 'Material Icons', sans-serif;
            box-shadow: 0 3px 5px rgba(0,0,0,0.3);
        }
    `];

    constructor() {
        super();
        this.publishLocal = false;
        this.icon     = 'add';
        this.label    = '';
        this.publish  = '';
        this.payload  = '1';
        this.size     = 'medium';
        this.variant  = 'primary';
        this.disabled = false;
    }

    _onClick() {
        if (!this.publish) return;
        feezal.connection.pub(this.publish, this.payload, {local: this.publishLocal});
    }

    render() {
        return html`
            <md-fab
                size="${this.size || 'medium'}"
                variant="${this.variant || 'primary'}"
                label="${this.label || ''}"
                ?disabled="${this.disabled}"
                @click="${this._onClick}">
                <feezal-icon slot="icon" name="${this.icon || 'add'}"></feezal-icon>
            </md-fab>`;
    }
}

customElements.define('feezal-element-material-fab', FeezalElementMaterialFab);
export {FeezalElementMaterialFab};
