/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';
import {GaugeMixin, gaugeAttributes, gaugeDiscoveryMap} from '@feezal/feezal-gauge';
import {readonlyClimateAxes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-glass-gauge (E151)
 *
 * Frosted-glass analogue gauge — the Glass family's dial card, closing the
 * gauge parity gap against circle-gauge / panel-gauge / material-gauge. Same
 * dial contract as circle-gauge (three looks, colour ranges, ticks, min/max,
 * unit, decimals, show-value) rendered inside the Glass card chrome: frost
 * tint, `degrade` solid fallback, squircle, `--feezal-glass-*` vars and the
 * availability badge. Display-only view over the same value wiring as
 * glass-value — see feezal-element-glass-button for the family conventions.
 */

class FeezalElementGlassGauge extends GaugeMixin(FeezalElement) {
    static get feezal() {
        return {
            palette: {name: 'Gauge', category: 'Glass', color: '#7aa5c9', icon: 'speed'},
            description: 'Frosted-glass gauge card — a numeric value on a circular scale with three looks (arc / ring / needle), configurable ticks and colour ranges.',
            baseAttribute: 'value',
            discovery: {component: 'sensor', map: gaugeDiscoveryMap,
                // B85: read-only thermostat numerics (actual temperature,
                // humidity, valve) live inside the climate entity.
                accepts: readonlyClimateAxes},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'label', type: 'string', help: 'Label shown under the dial.'},
                ...gaugeAttributes,
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
                // N31 / B67: opt-in availability — a badge appears while unavailable
                // (the last value stays shown). Base class wires the subscription.
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Optional availability topic — a badge appears while unavailable.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Fill / progress colour when no colour-range matches.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-dial-track-color',  type: 'color', default: 'var(--divider-color)', help: 'Empty scale / track colour.'},
                {property: '--feezal-dial-needle-color', type: 'color', default: 'var(--primary-text-color)', help: 'Needle colour (needle look).'},
                {property: '--feezal-dial-tick-color',   type: 'color', default: 'var(--secondary-text-color)', help: 'Tick + tick-label colour.'},
                {property: '--feezal-dial-track-width',  default: '8',  help: 'Track / fill thickness — unitless, % of the dial viewBox.'},
                {property: '--feezal-dial-value-size',   default: '20', help: 'Value font size — unitless, % of the dial viewBox.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '172px', height: '172px'},
            restrict: {minWidth: 70, minHeight: 70},
        };
    }

    static properties = {
        size:    {type: String, reflect: true},
        label:   {type: String, reflect: true},
        degrade: {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        :host {
            /* §5.1: the dial vars map onto the Glass palette — the fill takes
               the family accent, the rest anchors to the canonical theme vars
               (each with a literal last-resort fallback). */
            --feezal-dial-fill-color:   var(--feezal-glass-accent, #ff9f0a);
            --feezal-dial-track-color:  var(--divider-color);
            --feezal-dial-needle-color: var(--feezal-glass-color, #1d1d1f);
            --feezal-dial-text-color:   var(--feezal-glass-color, #1d1d1f);
            --feezal-dial-tick-color:   var(--feezal-glass-muted, rgba(29,29,31,0.55));
            --feezal-dial-track-width: 8;
            --feezal-dial-value-size: 20;
        }
        .card {
            align-items: center; justify-content: center;
            gap: 2px; padding: 8px;
            /* B67: the availability badge anchors to the shared .card, which is
               already position:absolute -- do NOT override to position:relative
               here (see glass-value). */
        }
        .unavail {
            position: absolute; top: 6px; right: 8px;
            font-size: 14px; line-height: 1;
            color: var(--error-color);
            opacity: 0.85; pointer-events: none; z-index: 2;
        }
        .gauge-wrap {
            flex: 1 1 auto; min-height: 0; aspect-ratio: 1;
            display: flex; align-items: center; justify-content: center;
        }
        svg.dial { width: 100%; height: 100%; display: block; overflow: visible; }
        .label {
            flex: 0 0 auto;
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            max-width: 100%;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.subscribe = '';
        this.label = '';
        this.degrade = false;
    }

    updated(changed) {
        super.updated(changed);
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size')) applySizePreset(this);
    }

    render() {
        return html`
            <div class="card">
                ${this.subscribeAvailability && !this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <div class="gauge-wrap">${this.renderDial()}</div>
                ${this.label || feezal.isEditor ? html`<span class="label">${this.label || 'Gauge'}</span>` : ''}
            </div>`;
    }
}

customElements.define('feezal-element-glass-gauge', FeezalElementGlassGauge);
export {FeezalElementGlassGauge};
