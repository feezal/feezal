/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {readonlyClimateAxes, NUMERIC_SENSOR_ICONS} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {parseRanges} from '@feezal/feezal-gauge';
import {formatValueDisplay} from '@feezal/feezal-element/feezal-locale.js';

/**
 * feezal-element-circle-value (E114 / E139)
 *
 * Circle/Material numeric value card. Always renders a Circle-family disc; two
 * display modes:
 *   • readout (default) — a clean ring with an optional icon, the big
 *     numeral+unit inside and a label below (the sibling of glass-value).
 *   • fill — the disc becomes a liquid gauge that fills from the bottom
 *     between configurable min/max, with optional colour-range bands and
 *     horizontal graduation ticks; the numeral floats centred on top.
 *
 * Display-only readout, no control. Mirrors the glass-value wiring contract
 * (subscribe / message-property / unit / decimals + live rewire).
 */

// B100: `parseRanges` used to be a private copy here that predated U65 — it
// handled only inline JSON, so a card given a site-wide NAMED colour range
// ("temp") silently rendered an unbanded fill while every gauge banded
// correctly. Import the one implementation instead.

class FeezalElementCircleValue extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Value', category: 'Circle', color: '#1565c0', icon: 'pin'},
            description: 'Numeric value card — a Circle-family disc with a big numeral, unit and label. Optional fill ' +
                'mode turns the disc into a liquid gauge (min/max) with colour-range bands and graduation ticks. Display-only.',
            baseAttribute: 'value',
            discovery: {
                component: 'sensor',
                // B85: a thermostat's actual temperature, humidity and valve
                // position live INSIDE its climate entity, so a sensor-only
                // picker could never see them. Read-only axes; never a
                // command topic.
                accepts: readonlyClimateAxes,
                map: {
                    state_topic:         {attr: 'subscribe'},
                    unit_of_measurement: {attr: 'unit'},
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                    // E160: stamp a device_class-appropriate icon (humidity, pressure, CO2, PM…).
                    device_class:      {attr: 'icon', valueMap: NUMERIC_SENSOR_ICONS},
                    // E161: a discovered mdi:* icon (mapped to a Material Symbol)
                    // wins over the device_class default; an unmapped one is
                    // skipped so the device_class icon above stands. Order matters.
                    icon:              {attr: 'icon', transform: 'mdiIcon'},
                    name:                'label',
                },
            },
            attributes: [
                {name: 'label',     type: 'string', help: 'Label shown under the disc.'},
                {name: 'icon',      type: 'string', default: '', help: 'Optional icon shown above the numeral (readout mode only). Empty = no icon.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'unit',      type: 'string', help: 'Unit rendered after the value (e.g. °C).'},
                {name: 'decimals',  type: 'number', min: 0, max: 6, help: 'Round numeric values to this many decimals. Empty = show the payload as-is.'},
                // ── Fill mode (E139) ──────────────────────────────────────────
                {name: 'mode',      type: 'select', options: ['readout', 'fill'], default: 'readout',
                    help: 'readout = plain numeral in a ring; fill = liquid gauge that fills the disc from the bottom between min and max.'},
                {name: 'min',       type: 'number', default: 0,   help: 'Fill mode: value at an empty disc (bottom).'},
                {name: 'max',       type: 'number', default: 100, help: 'Fill mode: value at a full disc (top).'},
                {name: 'ticks',     type: 'number', default: 0, min: 0, max: 20,
                    help: 'Fill mode: number of horizontal graduation lines across the disc (0 = none).'},
                {name: 'ranges',    type: 'string', default: '',
                    help: 'Fill mode: JSON colour bands, e.g. [{"from":0,"color":"#2196f3"},{"from":18,"color":"#4caf50"},{"from":24,"color":"#e53935"}]. ' +
                        'Each band colours values from its "from" up to the next band. Empty = single fill colour.'},
                // B67: opt-in availability — a badge appears while unavailable
                // (only shown when an availability topic is wired).
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Optional availability topic — a badge appears while unavailable (the last value stays shown).'},
                {name: 'message-property-availability', type: 'string', default: 'payload', help: 'Property path within availability messages. Defaults to message-property.'},
                {name: 'payload-available',   type: 'string', default: 'online',  help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'offline', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-value-icon-color',  type: 'color', default: 'var(--accent-color)', help: 'Icon colour (readout mode).'},
                {property: '--feezal-value-text-color',  type: 'color', default: 'var(--primary-text-color)', help: 'Value numeral colour.'},
                {property: '--feezal-value-label-color', type: 'color', default: 'var(--secondary-text-color)', help: 'Label colour.'},
                {property: '--feezal-value-track-color', type: 'color', default: 'var(--divider-color)', help: 'Fill-mode graduation tick colour.'},
                {property: '--feezal-value-fill-color',  type: 'color', default: 'var(--accent-color)', help: 'Fill colour when no colour-range matches.'},
                {property: '--feezal-value-font-size',  default: '18cqi', help: 'Value font size (cqi scales with card width; a px value also works, e.g. 20px).'},
                {property: '--feezal-value-unit-size',  default: '10cqi', help: 'Unit font size.'},
                {property: '--feezal-value-icon-size',  default: '16cqi', help: 'Icon font size (readout mode).'},
                {property: '--feezal-value-label-size', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '110px', height: '140px'},
            restrict: {minWidth: 60, minHeight: 70},
        };
    }

    static properties = {
        label:    {type: String, reflect: true},
        icon:     {type: String, reflect: true},
        unit:     {type: String, reflect: true},
        decimals: {type: String, reflect: true},
        mode:     {type: String, reflect: true},
        min:      {type: String, reflect: true},
        max:      {type: String, reflect: true},
        ticks:    {type: String, reflect: true},
        ranges:   {type: String, reflect: true},
        value:    {type: String, reflect: true},
        _value:   {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column;
            align-items: center; justify-content: flex-start;
            gap: 4px; padding: 6px; box-sizing: border-box;
            position: relative;   /* B67: anchor the availability badge */
            /* overflow visible so an oversized value/unit is never clipped
               (the fill is clipped locally via .fill-clip). */
            overflow: visible; text-align: center;
            /* cqi units scale the disc content with the card width. */
            container-type: inline-size;
            --feezal-value-icon-color:  var(--accent-color);
            --feezal-value-text-color:  var(--primary-text-color);
            --feezal-value-label-color: var(--secondary-text-color);
            --feezal-value-track-color: var(--divider-color);
            --feezal-value-fill-color:  var(--accent-color);
            /* E139: currentColor drives the disc ring — anchor it to the text
               colour so the ring matches the other Circle cards. */
            color: var(--feezal-value-text-color);
        }
        /* E139: concentric with the light/climate ring — square footprint, disc
           centred inside at ~90% (a hair inset from the ring's outer edge). */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc {
            position: relative;
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            /* E139: same neutral ring as the other Circle cards (currentColor). */
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 0.5cqi;
        }
        /* The fill (bands + ticks) is clipped to the circle here so the readout
           can overflow the disc freely — the value/unit are never truncated. */
        .fill-clip { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; }
        /* Fill mode: colour bands stacked bottom→top across [min,max], clipped
           at the waterline with clip-path (bands keep full-scale proportions);
           graduation ticks are horizontal rules; the numeral floats on top. */
        .bands { position: absolute; inset: 0; display: flex; flex-direction: column-reverse; }
        .bands > span { display: block; width: 100%; }
        .ticks { position: absolute; inset: 0; pointer-events: none; }
        .ticks > i {
            position: absolute; left: 0; right: 0; height: 0;
            border-top: 1px solid var(--feezal-value-track-color); opacity: 0.6;
        }
        .readout {
            position: relative; z-index: 1;
            display: flex; flex-direction: column; align-items: center; gap: 0.5cqi;
        }
        feezal-icon {
            font-size: var(--feezal-value-icon-size, 16cqi);
            line-height: 1; color: var(--feezal-value-icon-color);
        }
        .value {
            font-size: var(--feezal-value-font-size, 18cqi);
            font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums;
            color: var(--feezal-value-text-color);
            /* Always show the full number + unit — no ellipsis. If it overflows
               the disc, reduce --feezal-value-font-size. */
            white-space: nowrap;
        }
        .value .unit {
            font-size: var(--feezal-value-unit-size, 10cqi);
            font-weight: 500; opacity: 0.6; margin-left: 2px;
        }
        .label {
            font-size: var(--feezal-value-label-size, 12px);
            font-weight: 600; line-height: 1.2;
            color: var(--feezal-value-label-color);
            white-space: nowrap;
        }
        /* B67: availability badge — top-right corner. */
        .unavail {
            position: absolute; top: 6px; right: 6px;
            width: 16px; height: 16px;
            color: var(--error-color);
            opacity: 0.85; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
    `];

    constructor() {
        super();
        this.label = '';
        this.icon = '';
        this.unit = '';
        this.decimals = '';
        this.mode = 'readout';
        this.min = '0';
        this.max = '100';
        this.ticks = '0';
        this.ranges = '';
        this.value = '';
        this._value = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._wireSubscriptions();
    }

    _wireSubscriptions() {
        this.__wireSig = this.subscribe ?? '';
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._value = this.getProperty(msg, this.messageProperty);
            });
        }
    }

    updated(changed) {
        super.updated(changed);
        // Topic set on the live canvas → rewire (see glass-value).
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
    }

    get _numeric() {
        const raw = this._value ?? this.value;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }

    get displayValue() {
        // N41: was a raw toFixed while glass localized (N38) — the same reading
        // rendered 1234.5 here and 1.234,5 there. One implementation now.
        return formatValueDisplay(this._value ?? this.value, {decimals: this.decimals});
    }

    /** Fill fraction 0..1 from the current numeric value within [min,max]. */
    get _fraction() {
        const n = this._numeric ?? (feezal.isEditor ? 21.5 : null);
        if (n === null) return 0;
        const lo = Number(this.min), hi = Number(this.max);
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return 0;
        return Math.max(0, Math.min(1, (n - lo) / (hi - lo)));
    }

    _renderFill() {
        const ranges = parseRanges(this.ranges);
        const lo = Number(this.min), hi = Number(this.max);
        const span = (Number.isFinite(hi) && Number.isFinite(lo) && hi !== lo) ? hi - lo : 1;
        // Colour bands across the full [min,max] scale, bottom→top. clip-path
        // then reveals only the bottom `fraction`, so proportions stay honest.
        let bands;
        if (ranges.length) {
            bands = ranges.map((r, i) => {
                const from = Math.max(lo, r.from);
                const to = i + 1 < ranges.length ? Math.min(hi, ranges[i + 1].from) : hi;
                const h = Math.max(0, (to - from) / span) * 100;
                return html`<span style="flex: 0 0 ${h}%; background:${r.color}"></span>`;
            });
            const firstFrom = Math.max(lo, ranges[0].from);
            if (firstFrom > lo) {
                const h = ((firstFrom - lo) / span) * 100;
                bands.unshift(html`<span style="flex: 0 0 ${h}%; background:var(--feezal-value-fill-color)"></span>`);
            }
        } else {
            bands = [html`<span style="flex: 1 1 auto; background:var(--feezal-value-fill-color)"></span>`];
        }
        const clipTop = (1 - this._fraction) * 100;
        const nTicks = Math.max(0, Math.min(20, parseInt(this.ticks, 10) || 0));
        const ticks = [];
        for (let i = 1; i < nTicks; i++) {
            ticks.push(html`<i style="top:${(1 - i / nTicks) * 100}%"></i>`);
        }
        return html`
            <div class="bands" style="clip-path: inset(${clipTop}% 0 0 0)">${bands}</div>
            ${ticks.length ? html`<div class="ticks">${ticks}</div>` : ''}`;
    }

    render() {
        const fill = this.mode === 'fill';
        return html`
            ${this.subscribeAvailability && !this._available ? html`
                <div class="unavail" title="Device unavailable">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
                    </svg>
                </div>` : ''}
            <div class="disc-wrap">
                <div class="disc">
                    ${fill ? html`<div class="fill-clip">${this._renderFill()}</div>` : ''}
                    <div class="readout">
                        ${!fill && this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : ''}
                        <span class="value">${this.displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                    </div>
                </div>
            </div>
            <span class="label">${this.label || (feezal.isEditor ? 'Value' : '')}</span>`;
    }
}

customElements.define('feezal-element-circle-value', FeezalElementCircleValue);
export {FeezalElementCircleValue};
