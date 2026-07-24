/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {AiedgeController, aiedgeAttributes, formatMeterValue} from '@feezal/feezal-controller-aiedge';

/**
 * feezal-element-circle-meter (E147)
 *
 * Circle-family meter card — a view over the shared AiedgeController, the sibling
 * of the glass / metro meter cards. Surfaces the richer set an AI-on-the-edge (or
 * any MQTT) meter publishes that a plain value readout throws away: value + unit,
 * consumption rate, current action / status, an error badge, and the last-reading
 * age with a stale warning — rendered inside the Circle-family disc/ring chrome.
 */
class FeezalElementCircleMeter extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Meter', category: 'Circle', color: '#1565c0', icon: 'speed'},
            description: 'Circle-family meter card (value + rate + action/status + error + reading age) rendered in a ' +
                'disc/ring. Built for AI-on-the-edge meters but works with any MQTT meter. Same controller as the glass/metro meter cards.',
            attributes: [
                {name: 'icon', type: 'string', default: 'speed', help: 'Icon name.'},
                // E137: the shared meter contract — declared ONCE by the controller.
                ...aiedgeAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic (AI-on-the-edge `…/connection`).'},
                {name: 'payload-available',   type: 'string', default: 'connected', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'connection lost', help: 'Payload meaning unavailable.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-value-icon-color',  type: 'color', default: 'var(--accent-color)', help: 'Icon colour.'},
                {property: '--feezal-value-text-color',  type: 'color', default: 'var(--primary-text-color)', help: 'Value numeral colour.'},
                {property: '--feezal-value-muted-color', type: 'color', default: 'var(--secondary-text-color)', help: 'Secondary line (rate / status / age / raw) colour.'},
                {property: '--feezal-value-label-color', type: 'color', default: 'var(--secondary-text-color)', help: 'Label colour.'},
                {property: '--feezal-value-font-size',  default: '18cqi', help: 'Value font size (cqi scales with card width; a px value also works, e.g. 20px).'},
                {property: '--feezal-value-unit-size',  default: '10cqi', help: 'Unit font size.'},
                {property: '--feezal-value-icon-size',  default: '14cqi', help: 'Icon font size.'},
                {property: '--feezal-value-label-size', default: '12px', help: 'Label / secondary line font size.'},
            ],
            defaultStyle: {width: '120px', height: '160px'},
            restrict: {minWidth: 80, minHeight: 100},
        };
    }

    static properties = {
        icon:              {type: String, reflect: true},
        subscribeJson:     {type: String, reflect: true, attribute: 'subscribe-json'},
        subscribeValue:    {type: String, reflect: true, attribute: 'subscribe-value'},
        subscribeRate:     {type: String, reflect: true, attribute: 'subscribe-rate'},
        subscribeStatus:   {type: String, reflect: true, attribute: 'subscribe-status'},
        unit:              {type: String, reflect: true},
        rateUnit:          {type: String, reflect: true, attribute: 'rate-unit'},
        decimals:          {type: String, reflect: true},
        staleAfter:        {type: String, reflect: true, attribute: 'stale-after'},
        label:             {type: String, reflect: true},
        showRate:          {type: Boolean, reflect: true, attribute: 'show-rate'},
        showStatus:        {type: Boolean, reflect: true, attribute: 'show-status'},
        showTimestamp:     {type: Boolean, reflect: true, attribute: 'show-timestamp'},
        showRaw:           {type: Boolean, reflect: true, attribute: 'show-raw'},
        discoveryId:       {type: String, reflect: true, attribute: 'discovery-id'},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column;
            align-items: center; justify-content: flex-start;
            gap: 3px; padding: 6px; box-sizing: border-box;
            position: relative;   /* anchor the availability badge */
            overflow: hidden; text-align: center;
            /* cqi units scale the disc content with the card width. */
            container-type: inline-size;
            --feezal-value-icon-color:  var(--accent-color, #4a9d7f);
            --feezal-value-text-color:  var(--primary-text-color, #1d1d1f);
            --feezal-value-muted-color: var(--secondary-text-color, rgba(29,29,31,0.6));
            --feezal-value-label-color: var(--secondary-text-color, rgba(29,29,31,0.55));
            /* currentColor drives the disc ring — anchor it to the text colour so
               the ring matches the other Circle cards. */
            color: var(--feezal-value-text-color);
        }
        /* Concentric with the light/climate/value ring — square footprint, disc
           centred inside at ~90% (a hair inset from the ring's outer edge). */
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc {
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 0.5cqi;
            overflow: hidden;
        }
        feezal-icon {
            font-size: var(--feezal-value-icon-size, 14cqi);
            line-height: 1; color: var(--feezal-value-icon-color);
        }
        .value {
            font-size: var(--feezal-value-font-size, 18cqi);
            font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums;
            color: var(--feezal-value-text-color);
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .value .unit {
            font-size: var(--feezal-value-unit-size, 10cqi);
            font-weight: 500; opacity: 0.6; margin-left: 2px;
        }
        .rate, .status, .age, .raw {
            font-size: var(--feezal-value-label-size, 12px); line-height: 1.2;
            color: var(--feezal-value-muted-color, rgba(29,29,31,0.6));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
        .rate { font-weight: 600; }
        .age.stale { color: var(--error-color, #d32f2f); font-weight: 600; }
        .label {
            font-size: var(--feezal-value-label-size, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-value-label-color);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
        .err {
            font-size: 10px; font-weight: 700; color: var(--error-color, #d32f2f);
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail { position: absolute; top: 6px; right: 8px; font-size: 14px; color: var(--error-color, #d32f2f); opacity: 0.85; }
    `];

    constructor() {
        super();
        this.icon = 'speed';
        this.subscribeJson = '';
        this.subscribeValue = '';
        this.subscribeRate = '';
        this.subscribeStatus = '';
        this.unit = '';
        this.rateUnit = '';
        this.decimals = '';
        this.staleAfter = '';
        this.label = '';
        this.showRate = true;
        this.showStatus = true;
        this.showTimestamp = true;
        this.showRaw = false;
        this.discoveryId = '';
        // E137: the behavior layer — wires/parses; this view renders.
        this.meter = new AiedgeController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.meter.rewireIfChanged();
    }

    get _displayValue() {
        const v = formatMeterValue(this.meter.value, this.decimals);
        if (v !== null) return v;
        return feezal.isEditor ? '371.8' : '—';
    }

    render() {
        const m = this.meter;
        const showRate = this.showRate && m.rate !== null && m.rate !== undefined && m.rate !== '';
        const rateSample = feezal.isEditor && !showRate && !this.subscribeJson && !this.subscribeRate;
        return html`
            ${this.subscribeAvailability && !this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
            <div class="disc-wrap">
                <div class="disc">
                    <feezal-icon name="${this.icon || 'speed'}"></feezal-icon>
                    <span class="value">${this._displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                </div>
            </div>
            ${showRate ? html`<span class="rate">↗ ${formatMeterValue(m.rate, this.decimals)}${this.rateUnit ? ' ' + this.rateUnit : ''}</span>`
                : rateSample ? html`<span class="rate">↗ 0.02 ${this.rateUnit || ''}</span>` : ''}
            ${m.faulted ? html`<span class="err" title="${m.error}">⚠ ${m.error}</span>` : ''}
            ${this.showStatus && m.status ? html`<span class="status" title="${m.status}">${m.status}</span>` : ''}
            ${this.showTimestamp && m.age ? html`<span class="age ${m.stale ? 'stale' : ''}">${m.stale ? '⚠ ' : ''}${m.age}</span>` : ''}
            ${this.showRaw && m.raw != null && m.raw !== '' ? html`<span class="raw">raw ${m.raw}</span>` : ''}
            ${this.label ? html`<span class="label">${this.label || (feezal.isEditor ? 'Meter' : '')}</span>` : ''}
        `;
    }
}

customElements.define('feezal-element-circle-meter', FeezalElementCircleMeter);
export {FeezalElementCircleMeter};
