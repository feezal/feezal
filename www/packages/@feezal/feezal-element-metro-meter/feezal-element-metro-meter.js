/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-element-metro-tile';
import {AiedgeController, aiedgeAttributes, formatMeterValue} from '@feezal/feezal-controller-aiedge';

/**
 * feezal-element-metro-meter (E147)
 *
 * Metro live-tile meter card — the Metro-family view over the shared
 * AiedgeController. The tile face carries the big value + unit, the
 * consumption rate and an error badge; the flip side surfaces the detail an
 * MQTT meter publishes that a plain value tile throws away: current action /
 * status, the last-reading age (with a stale warning) and the raw
 * (pre-correction) reading. Built for jomjol's AI-on-the-edge meters but works
 * with any MQTT meter — same controller as the glass / circle meter cards.
 */
class FeezalElementMetroMeter extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Meter', category: 'Metro', color: '#4a9d7f', icon: 'speed'},
            description: 'Metro meter tile: value + rate + error badge on the front, action/status + reading age + raw on the back. ' +
                'Built for AI-on-the-edge meters but works with any MQTT meter. Same controller as the glass/circle meter cards.',
            attributes: [
                // MetroTileBase.tileAttributes already carries size + label + icon
                // (`label` overlaps the shared meter contract — drop the controller's).
                ...MetroTileBase.tileAttributes,
                // E137: the shared meter contract — declared ONCE by the controller.
                ...aiedgeAttributes.filter(a => a.name !== 'label'),
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic (AI-on-the-edge `…/connection`) — a ! badge appears while unavailable.'},
                {name: 'payload-available',   type: 'string', default: 'connected',       help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'connection lost', help: 'Payload meaning unavailable.'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        // ── JSON mode (AI-on-the-edge `…/json`) ──
        subscribeJson:            {type: String, reflect: true, attribute: 'subscribe-json'},
        messagePropertyValue:     {type: String, reflect: true, attribute: 'message-property-value'},
        messagePropertyRate:      {type: String, reflect: true, attribute: 'message-property-rate'},
        messagePropertyError:     {type: String, reflect: true, attribute: 'message-property-error'},
        messagePropertyTimestamp: {type: String, reflect: true, attribute: 'message-property-timestamp'},
        messagePropertyRaw:       {type: String, reflect: true, attribute: 'message-property-raw'},
        // ── Separate mode (any generic meter) ──
        subscribeValue:           {type: String, reflect: true, attribute: 'subscribe-value'},
        subscribeRate:            {type: String, reflect: true, attribute: 'subscribe-rate'},
        messagePropertyRateValue: {type: String, reflect: true, attribute: 'message-property-rate-value'},
        // ── Status / action ──
        subscribeStatus:          {type: String, reflect: true, attribute: 'subscribe-status'},
        messagePropertyStatus:    {type: String, reflect: true, attribute: 'message-property-status'},
        // ── Display ──
        unit:                     {type: String, reflect: true},
        rateUnit:                 {type: String, reflect: true, attribute: 'rate-unit'},
        decimals:                 {type: String, reflect: true},
        staleAfter:               {type: String, reflect: true, attribute: 'stale-after'},
        showRate:                 {type: Boolean, reflect: true, attribute: 'show-rate'},
        showStatus:               {type: Boolean, reflect: true, attribute: 'show-status'},
        showTimestamp:            {type: Boolean, reflect: true, attribute: 'show-timestamp'},
        showRaw:                  {type: Boolean, reflect: true, attribute: 'show-raw'},
        // ── Availability (defaults tuned for AI-on-the-edge) ──
        subscribeAvailability:    {type: String, reflect: true, attribute: 'subscribe-availability'},
        payloadAvailable:         {type: String, reflect: true, attribute: 'payload-available'},
        payloadUnavailable:       {type: String, reflect: true, attribute: 'payload-unavailable'},
    };

    static styles = [MetroTileBase.styles, css`
        .value {
            font-size: min(var(--_metro-value-size), 30cqh); font-weight: 300; line-height: 1;
            font-variant-numeric: tabular-nums; max-width: 96%;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .value .unit { font-size: var(--_metro-unit-size); opacity: 0.85; margin-left: 3px; font-weight: 400; }
        .rate { font-size: var(--_metro-unit-size); font-weight: 600; opacity: 0.9; margin-top: 2px; }
        .err {
            font-size: calc(var(--_metro-unit-size) * 0.85); font-weight: 600; opacity: 0.95;
            max-width: 92%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .brow { font-size: var(--_metro-unit-size); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .brow.age.stale { color: var(--error-color, #e51400); font-weight: 600; }
        .brow.raw { opacity: 0.75; }
        .placeholder { text-align: center; opacity: 0.7; }
    `];

    constructor() {
        super();
        // JSON mode
        this.subscribeJson = '';
        this.messagePropertyValue = '';
        this.messagePropertyRate = '';
        this.messagePropertyError = '';
        this.messagePropertyTimestamp = '';
        this.messagePropertyRaw = '';
        // Separate mode
        this.subscribeValue = '';
        this.subscribeRate = '';
        this.messagePropertyRateValue = '';
        // Status / action
        this.subscribeStatus = '';
        this.messagePropertyStatus = '';
        // Display
        this.unit = '';
        this.rateUnit = '';
        this.decimals = '';
        this.staleAfter = '';
        this.showRate = true;
        this.showStatus = true;
        this.showTimestamp = true;
        this.showRaw = false;
        // Availability (override the base online/offline defaults)
        this.subscribeAvailability = '';
        this.payloadAvailable = 'connected';
        this.payloadUnavailable = 'connection lost';
        // E137: the behavior layer — wires/parses; this view renders.
        this.meter = new AiedgeController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.meter.rewireIfChanged();
    }

    // B67: availability badge (top-right ! while unavailable).
    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        const m = this.meter;
        const v = formatMeterValue(m.value, this.decimals);
        const sample = feezal.isEditor && !this.subscribeJson && !this.subscribeValue;
        const disp = v !== null ? v : (sample ? '371.8' : '—');
        const showRate = this.showRate && m.rate !== null && m.rate !== undefined && m.rate !== '';
        return html`
            <div class="value">${disp}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</div>
            ${showRate ? html`<div class="rate">↗ ${formatMeterValue(m.rate, this.decimals)}${this.rateUnit ? ' ' + this.rateUnit : ''}</div>` : ''}
            ${m.faulted ? html`<div class="err" title="${m.error}">⚠ ${m.error}</div>` : ''}`;
    }

    renderBack() {
        const m = this.meter;
        const rows = [];
        if (this.showStatus && m.status) {
            rows.push(html`<div class="brow status" title="${m.status}">${m.status}</div>`);
        }
        if (this.showTimestamp && m.age) {
            rows.push(html`<div class="brow age ${m.stale ? 'stale' : ''}">${m.stale ? '⚠ ' : ''}${m.age}</div>`);
        }
        if (this.showRaw && m.raw !== null && m.raw !== undefined && m.raw !== '') {
            rows.push(html`<div class="brow raw">raw ${m.raw}</div>`);
        }
        if (!rows.length) {
            return html`<div class="placeholder">${feezal.isEditor ? 'details' : 'collecting…'}</div>`;
        }
        return rows;
    }
}

customElements.define('feezal-element-metro-meter', FeezalElementMetroMeter);
export {FeezalElementMetroMeter};
