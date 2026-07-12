/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@carbon/web-components/es/components/toggle/toggle.js';

class FeezalElementCarbonSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Switch',
                category: 'Carbon',
                color: '#393939'
            },
            description: 'IBM Carbon toggle switch. Subscribes to an MQTT topic for state and publishes ON/OFF on toggle.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',     type: 'mqttTopic', help: 'Topic to publish ON or OFF to on toggle.'},
                {name: 'label',       type: 'string',  help: 'Optional label shown above the switch.'},
                {name: 'payload-on',  type: 'string',  help: 'Payload published when switched on.', default: 'ON'},
                {name: 'payload-off', type: 'string',  help: 'Payload published when switched off.', default: 'OFF'},
                {name: 'state-labels', type: 'boolean', help: 'Show the On / Off state text beside the toggle.', default: false}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-switch-track-on',    type: 'color', default: 'var(--primary-color)', help: 'Track colour when ON.'},
                {property: '--feezal-switch-track-off',   type: 'color', default: 'var(--primary-background-color)', help: 'Track colour when OFF.'},
                {property: '--feezal-switch-border-on',   type: 'color', default: 'transparent', help: 'Track border colour when ON. Carbon has no track border — transparent keeps the stock look.'},
                {property: '--feezal-switch-border-off',  type: 'color', default: 'transparent', help: 'Track border colour when OFF. Carbon has no track border — transparent keeps the stock look.'},
                {property: '--feezal-switch-thumb-on',    type: 'color', default: '#ffffff', help: 'Thumb (handle) colour.'},
                {property: '--feezal-switch-label-color', type: 'color', default: 'var(--primary-text-color)', help: 'Label text colour.'},
            ],
            defaultStyle: {width: '120px', height: '32px'},
            discovery: {
                component: 'switch',
                map: {
                    state_topic:    'subscribe',
                    command_topic:  'publish',
                    payload_on:     'payload-on',
                    payload_off:    'payload-off',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'}
                }
            }
        };
    }

    static properties = {
        publish:     {type: String,  reflect: true},
        label:       {type: String,  reflect: true},
        payloadOn:   {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff:  {type: String,  reflect: true, attribute: 'payload-off'},
        stateLabels: {type: Boolean, reflect: true, attribute: 'state-labels'},
        _on:         {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            /* Let the focus ring extend past the element box. */
            overflow: visible;
            --feezal-switch-track-on:    var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --feezal-switch-track-off:   var(--primary-background-color, #8d8d8d);
            --feezal-switch-border-on:   transparent;
            --feezal-switch-border-off:  transparent;
            --feezal-switch-thumb-on:    #ffffff;
            --feezal-switch-label-color: var(--primary-text-color, var(--feezal-color, #333));
            /* Carbon token wiring — the toggle's ON track is support-success. */
            --cds-support-success:  var(--feezal-switch-track-on);
            --cds-toggle-off:       var(--feezal-switch-track-off);
            --cds-icon-on-color:    var(--feezal-switch-thumb-on);
            --cds-text-primary:     var(--feezal-switch-label-color);
            --cds-text-secondary:   var(--feezal-switch-label-color);
            --cds-focus:            var(--feezal-switch-track-on);
        }
    `];

    constructor() {
        super();
        this.publish     = '';
        this.label       = '';
        this.payloadOn   = 'ON';
        this.payloadOff  = 'OFF';
        this.stateLabels = false;
        this._on         = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._on = v === this.payloadOn || v === true || v === 1 || v === '1';
            });
        }
    }

    /**
     * Carbon's toggle track has no border in any normal state (only
     * read-only mode draws one), so a track border can't be wired through
     * --cds-* tokens. Adopt a small sheet into the cds-toggle shadow root —
     * an inset outline adds the border without shifting the layout, and the
     * --feezal-switch-border-* properties inherit across the boundary.
     */
    firstUpdated(changed) {
        super.firstUpdated?.(changed);
        const toggle = this.shadowRoot.querySelector('cds-toggle');
        toggle?.updateComplete.then(() => {
            if (!toggle.shadowRoot || typeof CSSStyleSheet !== 'function') return;
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`
                .cds--toggle__switch {
                    outline: 1px solid var(--feezal-switch-border-off, transparent);
                    outline-offset: -1px;
                }
                .cds--toggle__switch--checked {
                    outline-color: var(--feezal-switch-border-on, transparent);
                }`);
            toggle.shadowRoot.adoptedStyleSheets = [...toggle.shadowRoot.adoptedStyleSheets, sheet];
        });
    }

    _toggle(e) {
        this._on = e.detail.toggled;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        return html`
            <cds-toggle
                .toggled="${this._on}"
                label-text="${this.label}"
                label-a="${this.stateLabels ? 'On' : ''}"
                label-b="${this.stateLabels ? 'Off' : ''}"
                @cds-toggle-changed="${this._toggle}"></cds-toggle>`;
    }
}

customElements.define('feezal-element-carbon-switch', FeezalElementCarbonSwitch);
export {FeezalElementCarbonSwitch};
