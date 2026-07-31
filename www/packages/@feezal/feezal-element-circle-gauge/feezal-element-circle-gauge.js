/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {GaugeMixin, gaugeAttributes, gaugeDiscoveryMap} from '@feezal/feezal-gauge';
import {readonlyClimateAxes} from '@feezal/feezal-element/feezal-discovery-fragments.js';

/**
 * feezal-element-circle-gauge (E139)
 *
 * Circle-family gauge — the styled, richer sibling of the plain
 * feezal-element-material-gauge (Material category). Renders a numeric MQTT
 * value on a circular scale in the Circle design language (width-sized,
 * top-anchored, concentric with the light/climate ring), with three
 * configurable looks and gauge dressing:
 *
 *   • arc    — a 270° speedometer arc, value fills from the start; the fill
 *              takes the active colour-range band (or the fill colour).
 *   • ring   — a full 360° progress ring, value fills clockwise from the top.
 *   • needle — a 270° analogue dial: colour-range zones on the scale, a needle
 *              pointing at the value, ticks + optional numeric labels.
 *
 * Ticks (major + minor), numeric tick labels and colour ranges are all
 * configurable; every colour is a theme-anchored CSS custom property. Pure
 * Lit / SVG, display-only readout (no control surface).
 *
 * E151: the dial maths, the value wiring and the attribute contract moved to
 * `@feezal/feezal-gauge` so the glass and metro gauges render the identical
 * geometry — this file is now the Circle chrome around `renderDial()`.
 */

class FeezalElementCircleGauge extends GaugeMixin(FeezalElement) {
    static get feezal() {
        return {
            palette: {name: 'Gauge', category: 'Circle', color: '#1565c0', icon: 'speed'},
            description: 'Circle-family gauge — a numeric value on a circular scale with three looks (arc / ring / needle), ' +
                'configurable ticks and colour ranges. Display-only readout in the Circle design language.',
            baseAttribute: 'value',
            discovery: {component: 'sensor', map: gaugeDiscoveryMap,
                // B85: read-only thermostat numerics (actual temperature,
                // humidity, valve) live inside the climate entity.
                accepts: readonlyClimateAxes},
            attributes: [
                ...gaugeAttributes,
                {name: 'label', type: 'string', help: 'Caption shown below the gauge.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-dial-track-color',  type: 'color', default: 'var(--divider-color)',      help: 'Empty scale / track colour.'},
                {property: '--feezal-dial-fill-color',   type: 'color', default: 'var(--primary-color)',      help: 'Fill / progress colour when no colour-range matches.'},
                {property: '--feezal-dial-needle-color', type: 'color', default: 'var(--primary-text-color)', help: 'Needle colour (needle look).'},
                {property: '--feezal-dial-text-color',   type: 'color', default: 'var(--primary-text-color)', help: 'Value numeral colour.'},
                {property: '--feezal-dial-tick-color',   type: 'color', default: 'var(--secondary-text-color)', help: 'Tick + tick-label colour.'},
                {property: '--feezal-dial-label-color',  type: 'color', default: 'var(--secondary-text-color)', help: 'Caption colour.'},
                {property: '--feezal-dial-track-width',  default: '8',  help: 'Track / fill thickness — unitless, % of the circle viewBox.'},
                {property: '--feezal-dial-value-size',   default: '20', help: 'Value font size — unitless, % of the circle viewBox.'},
                {property: '--feezal-dial-label-size',   default: '12px', help: 'Caption font size.'},
            ],
            defaultStyle: {width: '130px', height: '150px'},
            restrict: {minWidth: 70, minHeight: 80},
        };
    }

    static properties = {
        label: {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column;
            align-items: center; justify-content: flex-start;
            gap: 4px; padding: 6px; box-sizing: border-box;
            overflow: hidden; text-align: center;
            container-type: inline-size;
            --feezal-dial-track-color:  var(--divider-color);
            --feezal-dial-fill-color:   var(--primary-color);
            --feezal-dial-needle-color: var(--primary-text-color);
            --feezal-dial-text-color:   var(--primary-text-color);
            --feezal-dial-tick-color:   var(--secondary-text-color);
            --feezal-dial-label-color:  var(--secondary-text-color);
            --feezal-dial-track-width: 8;
            --feezal-dial-value-size: 20;
            color: var(--feezal-dial-text-color);
        }
        /* E139: concentric with the light/climate ring — square footprint, the
           gauge sits at ~92% inside it, top-anchored, caption stacked below. */
        .gauge-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        svg.dial { width: 92%; height: 92%; display: block; overflow: visible; }
        .label {
            font-size: var(--feezal-dial-label-size, 12px);
            font-weight: 600; line-height: 1.2;
            color: var(--feezal-dial-label-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            max-width: 100%;
        }
    `];

    constructor() {
        super();
        this.subscribe = '';
        this.label = '';
    }

    render() {
        return html`
            <div class="gauge-wrap">${this.renderDial()}</div>
            ${this.label || feezal.isEditor ? html`<div class="label">${this.label || 'Gauge'}</div>` : ''}`;
    }
}

customElements.define('feezal-element-circle-gauge', FeezalElementCircleGauge);
export {FeezalElementCircleGauge};
