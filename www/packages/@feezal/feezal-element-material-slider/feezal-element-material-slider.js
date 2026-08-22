/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, feezalEmit, numericPublishPayload, publishJsonKeyAttribute} from '@feezal/feezal-element';
import '@material/web/slider/slider.js';

import {sliderDiscovery} from '@feezal/feezal-element/feezal-discovery-fragments.js';
/** B17: explicit step wins; otherwise derive from the range: (max − min) / 100.
 *  The default 0–100 range yields 1 (today's behaviour); sub-integer ranges
 *  (Homematic LEVEL 0–1) get a usable granularity instead of collapsing to
 *  two positions. Exported for unit tests. */
function deriveStep(step, min, max) {
    const explicit = Number(step);
    if (step !== undefined && step !== null && step !== '' && !isNaN(explicit) && explicit > 0) {
        return explicit;
    }

    const range = Number(max) - Number(min);
    if (!isFinite(range) || range <= 0) return 1;
    // Round to avoid float noise (0.010000000000000002 → 0.01).
    return Number((range / 100).toPrecision(12));
}

class FeezalElementMaterialSlider extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Slider',
                category: 'Material',
                color: '#4a6080'
            },
            description: 'Material Design 3 slider. Subscribes to an MQTT topic for the current value and publishes the numeric value on change.',
            // E156: sliders drive the settable numeric axes of other
            // components — a light's brightness / colour temp, and `number`.
            discovery: sliderDiscovery,
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.level" to navigate into a JSON payload.'},
                {name: 'publish',  type: 'mqttTopic', help: 'Topic to publish the numeric value to on change.'},
                {name: 'min',      type: 'number',  help: 'Minimum value.', default: 0},
                {name: 'max',      type: 'number',  help: 'Maximum value.', default: 100},
                {name: 'step',     type: 'number',  help: 'Step size. Empty: derived from the range — (max − min) / 100 — so sub-integer ranges (e.g. Homematic 0–1) stay usable; 1 for the default 0–100 range. An explicit value wins.'},
                {name: 'labeled',  type: 'boolean', help: 'Show a value label bubble above the thumb while dragging.', default: false},
                publishJsonKeyAttribute
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-slider-color',        type: 'color', default: 'var(--primary-color)', help: 'Active track and thumb colour (used as default for --feezal-slider-knob-color).'},
                {property: '--feezal-slider-track-color',  type: 'color', default: 'var(--divider-color)', help: 'Inactive track colour.'},
                {property: '--feezal-slider-knob-color',   type: 'color', default: 'var(--feezal-slider-color)',    help: 'Thumb / knob colour. Defaults to the active track colour.'},
                {property: '--feezal-slider-track-width',  default: '4px',  help: 'Track height in CSS units, e.g. "4px" or "6px".'},
                {property: '--feezal-slider-knob-size',    default: '20px', help: 'Thumb diameter in CSS units, e.g. "20px".'},
            ],
            defaultStyle: {width: '160px', height: '48px'}
        };
    }

    static properties = {
        publish: {type: String,  reflect: true},
        min:     {type: Number,  reflect: true},
        max:     {type: Number,  reflect: true},
        step:    {type: Number,  reflect: true},
        labeled: {type: Boolean, reflect: true},
        publishJsonKey: {type: String, reflect: true, attribute: 'publish-json-key'},
        _value:  {state: true}
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            /* E38: track + handle scale with the element height (cqh = 1% of height);
               explicit --feezal-slider-track-width / --feezal-slider-knob-size still win. */
            container-type: size;
            --feezal-slider-color:        var(--primary-color);
            --feezal-slider-track-color:  var(--divider-color);
            --feezal-slider-knob-color:   var(--feezal-slider-color);
            --feezal-slider-track-width:  8cqh;
            --feezal-slider-knob-size:    42cqh;
            /* MD3 token wiring */
            --md-sys-color-primary:              var(--feezal-slider-color);
            --md-sys-color-surface:              var(--feezal-bg, #fff);
            --md-sys-color-on-surface:           var(--feezal-color, #333);
            --md-slider-inactive-track-color:    var(--feezal-slider-track-color);
            --md-slider-handle-color:            var(--feezal-slider-knob-color);
            --md-slider-active-track-height:     var(--feezal-slider-track-width);
            --md-slider-inactive-track-height:   var(--feezal-slider-track-width);
            --md-slider-handle-height:           var(--feezal-slider-knob-size);
            --md-slider-handle-width:            var(--feezal-slider-knob-size);
            --md-slider-state-layer-size:        calc(var(--feezal-slider-knob-size) * 2);
        }
        /* min-inline-size:0 lets the track shrink/grow with the element instead of
           clipping at narrow widths (E38). */
        md-slider { width: 100%; min-inline-size: 0; }
        .editor-ph {
            flex: 1; height: var(--feezal-slider-track-width, 4px); border-radius: 2px;
            background: linear-gradient(to right, var(--feezal-slider-color) 50%, var(--feezal-slider-track-color, var(--feezal-border, #ccc)) 50%);
            position: relative;
        }
        .editor-ph::after {
            content: '';
            position: absolute; left: 50%; top: 50%;
            transform: translate(-50%, -50%);
            width: var(--feezal-slider-knob-size, 20px); height: var(--feezal-slider-knob-size, 20px);
            border-radius: 50%;
            background: var(--feezal-slider-knob-color, var(--feezal-slider-color));
        }
    `];

    constructor() {
        super();
        this.publish = '';
        this.min     = 0;
        this.max     = 100;
        // B17: step is deliberately NOT defaulted to 1 — when unset it is
        // derived from the range (see effectiveStep), so sub-integer ranges
        // (Homematic LEVEL 0–1) don't collapse to two positions.
        this.labeled = false;
        this.publishJsonKey = '';
        this._value  = 0;
    }

    get effectiveStep() {
        return deriveStep(this.step, this.min, this.max);
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (!isNaN(v)) this._value = v;
            });
        }
    }

    // ── U113 public contract: .value + composed feezal-change ──────────────
    // Scripts (fzl.val / fzl.on) and system-form read the value and listen
    // here instead of reaching into the shadow root. feezal-change fires for
    // USER edits only — MQTT-driven updates are state, not input.
    get value() { return Number(this._value); }
    set value(v) { const n = Number(v); if (!isNaN(n)) this._value = n; }

    _change(e) {
        this._value = e.target.value;
        if (this.publish) {
            feezal.connection.pub(this.publish, numericPublishPayload(this._value, this.publishJsonKey));
        }
        feezalEmit(this, 'change');
    }

    render() {
        return html`
            <md-slider
                min="${this.min}" max="${this.max}" step="${this.effectiveStep}"
                value="${this._value}"
                ?labeled="${this.labeled}"
                @change="${this._change}">
            </md-slider>`;
    }
}

customElements.define('feezal-element-material-slider', FeezalElementMaterialSlider);
export {FeezalElementMaterialSlider, deriveStep};
