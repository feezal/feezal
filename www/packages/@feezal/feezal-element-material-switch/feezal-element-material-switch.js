/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/switch/switch.js';

class FeezalElementMaterialSwitch extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Switch',
                category: 'Material',
                color: '#4a6080'
            },
            description: 'Material Design 3 toggle switch. Subscribes to an MQTT topic for state and publishes ON/OFF on toggle.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.state" to navigate into a JSON payload.'},
                {name: 'publish',        type: 'mqttTopic', help: 'Topic to publish ON or OFF to on toggle.'},
                {name: 'label',          type: 'string',  help: 'Optional label shown to the right of the switch.'},
                {name: 'payload-on',     type: 'string',  help: 'Payload published when switched on.', default: 'ON'},
                {name: 'payload-off',    type: 'string',  help: 'Payload published when switched off.', default: 'OFF'},
                {name: 'icons',          type: 'boolean', help: 'Show check / x icons inside the thumb.', default: false}
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-switch-track-on',    type: 'color', default: 'var(--primary-color)', help: 'Track colour when ON.'},
                {property: '--feezal-switch-track-off',   type: 'color', default: 'var(--primary-background-color)', help: 'Track colour when OFF.'},
                {property: '--feezal-switch-thumb-on',    type: 'color', default: 'var(--primary-text-color)', help: 'Thumb (handle) colour when ON.'},
                {property: '--feezal-switch-thumb-off',   type: 'color', default: 'var(--disabled-text-color)', help: 'Thumb (handle) colour when OFF.'},
                {property: '--feezal-switch-outline-off', type: 'color', default: 'var(--primary-color)', help: 'Track outline colour when OFF.'},
                {property: '--feezal-switch-label-color', type: 'color', default: 'var(--primary-text-color)', help: 'Label text colour.'},
                {property: '--feezal-switch-size', default: '100cqh', help: 'Track height, drives overall switch size. Default scales with the element height.'},
            ],
            defaultStyle: {width: '80px', height: '32px'},
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
        publish:    {type: String,  reflect: true},
        label:      {type: String,  reflect: true},
        payloadOn:  {type: String,  reflect: true, attribute: 'payload-on'},
        payloadOff: {type: String,  reflect: true, attribute: 'payload-off'},
        icons: {type: Boolean, reflect: true},
        _on:   {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            gap: 8px;
            /* Default size — container-type:size collapses to 0 without an
               explicit height (markup without inline width/height, e.g.
               hand-written or AI-generated sites). Inline styles and the
               editor's defaultStyle override these. */
            width: 80px;
            height: 32px;
            /* Let the MD3 state layer (hover/focus ripple) and the label extend
               past the element box instead of being clipped by the base
               overflow:hidden. */
            overflow: visible;
            /* E38: scale the switch + label with the element size. The track
               height follows the element height (cqh); an explicit
               --feezal-switch-size still wins. */
            container-type: size;

            /* ── Exposed colours (on + off state) ──
               Theme variables first so the switch tracks the active theme;
               concrete fallbacks keep it visible in a theme-less viewer. */
            --feezal-switch-color:        var(--primary-color, var(--sl-color-primary-600, #0284c7)); /* legacy alias → on-track */
            --feezal-switch-track-on:     var(--feezal-switch-color);
            --feezal-switch-track-off:    var(--primary-background-color, #d0d4d8);
            --feezal-switch-thumb-on:     var(--primary-text-color, #ffffff);
            --feezal-switch-thumb-off:    var(--disabled-text-color, #757575);
            --feezal-switch-outline-off:  var(--primary-color, #757575);
            --feezal-switch-label-color:  var(--primary-text-color, #333);
            --feezal-switch-size:         100cqh;

            /* ── Size tokens (proportional to --feezal-switch-size = track height) ── */
            --md-switch-track-height:            var(--feezal-switch-size);
            --md-switch-track-width:             calc(var(--feezal-switch-size) * 1.625);
            --md-switch-handle-height:           calc(var(--feezal-switch-size) * 0.5);
            --md-switch-handle-width:            calc(var(--feezal-switch-size) * 0.5);
            --md-switch-selected-handle-height:  calc(var(--feezal-switch-size) * 0.75);
            --md-switch-selected-handle-width:   calc(var(--feezal-switch-size) * 0.75);
            --md-switch-pressed-handle-height:   calc(var(--feezal-switch-size) * 0.875);
            --md-switch-pressed-handle-width:    calc(var(--feezal-switch-size) * 0.875);
            --md-switch-with-icon-handle-height: calc(var(--feezal-switch-size) * 0.75);
            --md-switch-with-icon-handle-width:  calc(var(--feezal-switch-size) * 0.75);
            --md-switch-state-layer-size:        calc(var(--feezal-switch-size) * 1.25);

            /* ── Colour tokens ── */
            --md-sys-color-primary: var(--feezal-switch-track-on);
            /* ON (selected) */
            --md-switch-selected-track-color:          var(--feezal-switch-track-on);
            --md-switch-selected-hover-track-color:    var(--feezal-switch-track-on);
            --md-switch-selected-focus-track-color:    var(--feezal-switch-track-on);
            --md-switch-selected-pressed-track-color:  var(--feezal-switch-track-on);
            --md-switch-selected-handle-color:         var(--feezal-switch-thumb-on);
            --md-switch-selected-hover-handle-color:   var(--feezal-switch-thumb-on);
            --md-switch-selected-focus-handle-color:   var(--feezal-switch-thumb-on);
            --md-switch-selected-pressed-handle-color: var(--feezal-switch-thumb-on);
            --md-switch-selected-icon-color:           var(--feezal-switch-track-on);
            --md-switch-selected-hover-icon-color:     var(--feezal-switch-track-on);
            --md-switch-selected-focus-icon-color:     var(--feezal-switch-track-on);
            --md-switch-selected-pressed-icon-color:   var(--feezal-switch-track-on);
            /* OFF (unselected) */
            --md-switch-track-color:                 var(--feezal-switch-track-off);
            --md-switch-hover-track-color:           var(--feezal-switch-track-off);
            --md-switch-focus-track-color:           var(--feezal-switch-track-off);
            --md-switch-pressed-track-color:         var(--feezal-switch-track-off);
            --md-switch-track-outline-color:         var(--feezal-switch-outline-off);
            --md-switch-hover-track-outline-color:   var(--feezal-switch-outline-off);
            --md-switch-focus-track-outline-color:   var(--feezal-switch-outline-off);
            --md-switch-pressed-track-outline-color: var(--feezal-switch-outline-off);
            --md-switch-handle-color:                var(--feezal-switch-thumb-off);
            --md-switch-hover-handle-color:          var(--feezal-switch-thumb-off);
            --md-switch-focus-handle-color:          var(--feezal-switch-thumb-off);
            --md-switch-pressed-handle-color:        var(--feezal-switch-thumb-off);
            --md-switch-icon-color:                  var(--feezal-switch-track-off);
            --md-switch-hover-icon-color:            var(--feezal-switch-track-off);
            --md-switch-focus-icon-color:            var(--feezal-switch-track-off);
            --md-switch-pressed-icon-color:          var(--feezal-switch-track-off);
        }
        .label {
            font-size: 40cqmin;
            color: var(--feezal-switch-label-color);
            user-select: none;
            white-space: nowrap;
        }
        .editor-ph {
            display: flex; align-items: center; gap: 6px;
            font-size: 12px; color: var(--feezal-switch-color); user-select: none;
        }
        .editor-ph .track {
            width: 44px; height: 24px; border-radius: 12px;
            background: #b0bec5; position: relative;
        }
        .editor-ph .thumb {
            width: 20px; height: 20px; border-radius: 50%;
            background: #fff; position: absolute; top: 2px; left: 2px;
        }
    `];

    constructor() {
        super();
        this.publish    = '';
        this.label      = '';
        this.payloadOn  = 'ON';
        this.payloadOff = 'OFF';
        this.icons = false;
        this._on   = false;
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

    _toggle(e) {
        this._on = e.target.selected;
        if (this.publish) {
            feezal.connection.pub(this.publish, this._on ? this.payloadOn : this.payloadOff);
        }
    }

    render() {
        return html`
            <md-switch ?selected="${this._on}" ?icons="${this.icons}"
                @change="${this._toggle}"></md-switch>
            ${this.label ? html`<span class="label">${this.label}</span>` : ''}`;
    }
}

customElements.define('feezal-element-material-switch', FeezalElementMaterialSwitch);
export {FeezalElementMaterialSwitch};
