/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {AiedgeController, aiedgeAttributes, formatMeterValue} from '@feezal/feezal-controller-aiedge';
import {applySizePreset, glassCardStyles} from '@feezal/feezal-glass';

/**
 * feezal-element-glass-meter (E147)
 *
 * Frosted-glass meter card — a view over the shared AiedgeController. Surfaces
 * the richer set an AI-on-the-edge (or any MQTT) meter publishes that a plain
 * value readout throws away: value + unit, consumption rate, current action /
 * status, an error badge, and the last-reading age with a stale warning.
 */
class FeezalElementGlassMeter extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Meter', category: 'Glass', color: '#7aa5c9', icon: 'speed'},
            description: 'Frosted-glass meter card (value + rate + action/status + error + reading age). ' +
                'Built for AI-on-the-edge meters but works with any MQTT meter. Same controller as the metro/circle meter cards.',
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '2x1'], default: '',
                    help: 'Preset size: 2x2 = square (150×150), 2x1 = wide (150×75). Empty keeps the current/manual size.'},
                {name: 'icon', type: 'string', default: 'speed', help: 'Icon name.'},
                // E137: the shared meter contract — declared ONCE by the controller.
                ...aiedgeAttributes,
                {name: 'subscribe-availability', type: 'mqttTopic', help: 'Availability topic (AI-on-the-edge `…/connection`).'},
                {name: 'payload-available',   type: 'string', default: 'connected', help: 'Payload meaning available.'},
                {name: 'payload-unavailable', type: 'string', default: 'connection lost', help: 'Payload meaning unavailable.'},
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#4a9d7f', help: 'Icon colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-icon-size', default: '26px', help: 'Icon font size.'},
                {property: '--feezal-glass-font-size-value', default: '24px', help: 'Value font size.'},
                {property: '--feezal-glass-font-size-unit', default: '12px', help: 'Unit font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label / secondary line font size.'},
            ],
            defaultStyle: {width: '172px', height: '150px'},
            restrict: {minWidth: 90, minHeight: 90},
        };
    }

    static properties = {
        size:              {type: String, reflect: true},
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
        degrade:           {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card { gap: 1px; position: relative; }
        feezal-icon { font-size: var(--feezal-glass-icon-size, 26px); line-height: 1; color: var(--feezal-glass-accent, #4a9d7f); }
        .value {
            font-size: var(--feezal-glass-font-size-value, 24px); font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .value .unit { font-size: var(--feezal-glass-font-size-unit, 12px); font-weight: 500; opacity: 0.6; margin-left: 2px; }
        .rate, .status, .age, .raw {
            font-size: var(--feezal-glass-font-size-label, 12px); line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.6));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
        .rate { font-weight: 600; }
        .age.stale { color: var(--error-color, #d32f2f); font-weight: 600; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .err {
            font-size: 10px; font-weight: 700; color: var(--error-color, #d32f2f);
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .unavail { position: absolute; top: 6px; right: 8px; font-size: 14px; color: var(--error-color, #d32f2f); opacity: 0.85; }
    `];

    constructor() {
        super();
        this.size = '';
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
        this.degrade = false;
        // E137: the behavior layer — wires/parses; this view renders.
        this.meter = new AiedgeController(this);
    }

    // Device cards manage subscriptions manually; suppress the base class path.
    _subscribe() { /* intentionally empty */ }

    updated(changed) {
        super.updated(changed);
        this.meter.rewireIfChanged();
        if (changed.has('size')) applySizePreset(this);
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
            <div class="card">
                ${this.subscribeAvailability && !this._available ? html`<span class="unavail" title="Device unavailable">⚠</span>` : ''}
                <feezal-icon name="${this.icon || 'speed'}"></feezal-icon>
                <span class="value">${this._displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                ${showRate ? html`<span class="rate">↗ ${formatMeterValue(m.rate, this.decimals)}${this.rateUnit ? ' ' + this.rateUnit : ''}</span>`
                    : rateSample ? html`<span class="rate">↗ 0.02 ${this.rateUnit || ''}</span>` : ''}
                ${m.faulted ? html`<span class="err" title="${m.error}">⚠ ${m.error}</span>` : ''}
                ${this.showStatus && m.status ? html`<span class="status" title="${m.status}">${m.status}</span>` : ''}
                ${this.showTimestamp && m.age ? html`<span class="age ${m.stale ? 'stale' : ''}">${m.stale ? '⚠ ' : ''}${m.age}</span>` : ''}
                ${this.showRaw && m.raw != null && m.raw !== '' ? html`<span class="raw">raw ${m.raw}</span>` : ''}
                ${this.label ? html`<span class="label">${this.label || (feezal.isEditor ? 'Meter' : '')}</span>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-meter', FeezalElementGlassMeter);
export {FeezalElementGlassMeter};
