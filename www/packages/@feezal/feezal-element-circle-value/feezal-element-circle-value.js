/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

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

// Parse the `ranges` attribute → sorted [{from:Number, color:String}].
function parseRanges(raw) {
    if (!raw) return [];
    try {
        const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(a)) return [];
        return a
            .map(r => ({from: Number(r.from), color: String(r.color || '')}))
            .filter(r => Number.isFinite(r.from) && r.color)
            .sort((x, y) => x.from - y.from);
    } catch { return []; }
}

class FeezalElementCircleValue extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Value', category: 'Circle', color: '#1565c0', icon: 'pin'},
            description: 'Numeric value card — a Circle-family disc with a big numeral, unit and label. Optional fill ' +
                'mode turns the disc into a liquid gauge (min/max) with colour-range bands and graduation ticks. Display-only.',
            baseAttribute: 'value',
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         {attr: 'subscribe'},
                    unit_of_measurement: {attr: 'unit'},
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
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
            /* overflow visible so an oversized value/unit is never clipped
               (the fill is clipped locally via .fill-clip). */
            overflow: visible; text-align: center;
            /* cqi units scale the disc content with the card width. */
            container-type: inline-size;
            --feezal-value-icon-color:  var(--accent-color, #1565c0);
            --feezal-value-text-color:  var(--primary-text-color, #1d1d1f);
            --feezal-value-label-color: var(--secondary-text-color, rgba(29,29,31,0.55));
            --feezal-value-track-color: var(--divider-color, rgba(0,0,0,0.15));
            --feezal-value-fill-color:  var(--accent-color, #1565c0);
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
        const raw = this._value ?? this.value;
        if (raw === null || raw === undefined || raw === '') {
            return feezal.isEditor ? '21.5' : '—';
        }
        const n = Number(raw);
        if (this.decimals !== '' && this.decimals !== null && Number.isFinite(n)) {
            return n.toFixed(Math.max(0, Math.min(6, Number(this.decimals) || 0)));
        }
        return typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
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
