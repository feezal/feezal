/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';
import {GaugeMixin, gaugeAttributes, gaugeDiscoveryMap} from '@feezal/feezal-gauge';

/**
 * feezal-element-metro-gauge (E151)
 *
 * Metro live-tile analogue gauge — the Metro family's dial card, closing the
 * gauge parity gap against circle-gauge / panel-gauge / material-gauge. Same
 * dial contract as circle-gauge (three looks, colour ranges, ticks, min/max,
 * unit, decimals, show-value) rendered on a flat Metro tile: solid accent
 * face, white type, the shared `size` grid and the ! availability badge.
 * Display-only — front-only tile, no flip side.
 *
 * E141 tile-state colour discipline: the dial reads the tile's own
 * `--feezal-metro-*` palette (fill/needle/value in the tile text colour,
 * track a quiet wash of it), so it stays legible on any accent. A `ranges`
 * colour band still wins for the fill — that is the point of the bands.
 */

class FeezalElementMetroGauge extends GaugeMixin(MetroTileBase) {
    static get feezal() {
        return {
            palette: {name: 'Gauge', category: 'Metro', color: '#1ba1e2', icon: 'speed'},
            description: 'Metro gauge tile: a numeric value on a circular scale with three looks (arc / ring / needle), configurable ticks and colour ranges.',
            baseAttribute: 'value',
            discovery: {component: 'sensor', map: gaugeDiscoveryMap},
            attributes: [
                ...MetroTileBase.tileAttributes,
                ...gaugeAttributes,
                // B67: opt-in availability — a ! badge appears while unavailable.
                {name: 'subscribe-availability', type: 'mqttTopic', section: 'Availability', help: 'Topic reporting device availability — a ! badge appears while unavailable.'},
                {name: 'payload-available',   type: 'string', default: 'online',  section: 'Availability', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', section: 'Availability', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-dial-fill-color',  type: 'color', default: 'var(--feezal-metro-text)', help: 'Fill / progress colour when no colour-range matches.'},
                {property: '--feezal-dial-track-color', type: 'color', help: 'Empty scale / track colour (a quiet wash of the tile text colour by default).'},
                {property: '--feezal-dial-track-width', default: '8',  help: 'Track / fill thickness — unitless, % of the dial viewBox.'},
                {property: '--feezal-dial-value-size',  default: '20', help: 'Value font size — unitless, % of the dial viewBox.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static styles = [MetroTileBase.styles, css`
        :host {
            /* E141: the dial takes the tile's own palette so it reads on any
               accent — a colour-range band still overrides the fill. */
            --feezal-dial-fill-color:   var(--feezal-metro-text, #fff);
            --feezal-dial-needle-color: var(--feezal-metro-text, #fff);
            --feezal-dial-text-color:   var(--feezal-metro-text, #fff);
            --feezal-dial-tick-color:   color-mix(in srgb, var(--feezal-metro-text, #fff) 70%, transparent);
            --feezal-dial-track-color:  color-mix(in srgb, var(--feezal-metro-text, #fff) 28%, transparent);
            --feezal-dial-track-width: 8;
            --feezal-dial-value-size: 20;
        }
        .gauge-wrap {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
        }
        svg.dial { width: min(100%, 100cqh); height: 100%; display: block; overflow: visible; }
    `];

    constructor() {
        super();
        this.subscribe = '';
    }

    // B67: availability badge (top-right ! while unavailable).
    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        return html`<div class="gauge-wrap">${this.renderDial()}</div>`;
    }
}

customElements.define('feezal-element-metro-gauge', FeezalElementMetroGauge);
export {FeezalElementMetroGauge};
