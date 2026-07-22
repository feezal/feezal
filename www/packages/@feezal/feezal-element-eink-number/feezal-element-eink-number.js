/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';

/**
 * feezal-element-eink-number (E57)
 *
 * E-ink numeric value card: oversized numeral + unit, uppercase label,
 * thick rule. Display-only. Same wiring contract as glass-sensor
 * (subscribe / message-property / unit / decimals / label).
 *
 * Redraw discipline: renderSignature() is the ROUNDED display string —
 * a republished unchanged value never touches the panel (E57).
 */

class FeezalElementEinkNumber extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Number', category: 'Eink', color: '#222222', icon: 'thermostat'},
            description: 'E-ink numeric card — oversized numeral with unit and label, 1-bit, redraw-deduped.',
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
                {name: 'subscribe', type: 'mqttTopic', help: 'Value topic.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                {name: 'unit',      type: 'string', help: 'Unit rendered after the value (e.g. °C).'},
                {name: 'decimals',  type: 'number', min: 0, max: 6, help: 'Round numeric values to this many decimals. Empty = show the payload as-is. Also the redraw-dedup granularity.'},
                {name: 'label',     type: 'string', help: 'Label under the value (rendered uppercase).'},
                {name: 'footer',    type: 'string', help: 'Optional footer line (e.g. min/max), below the rule.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Value font size.'},
                {property: '--feezal-eink-font-size-unit', default: '14px', help: 'Unit font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '180px', height: '120px'},
            restrict: {minWidth: 70, minHeight: 60},
        };
    }

    static properties = {
        label:    {type: String, reflect: true},
        unit:     {type: String, reflect: true},
        decimals: {type: String, reflect: true},
        value:    {type: String, reflect: true},
        footer:   {type: String, reflect: true},
        _value:   {state: true},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 2px; }
        .footer {
            font-size: var(--feezal-eink-font-size-label, 13px);
            padding-top: 3px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.unit = '';
        this.decimals = '';
        this.value = '';
        this.footer = '';
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
        if (this.isConnected && this.__wireSig !== undefined && (this.subscribe ?? '') !== this.__wireSig) {
            this._unsubscribe();
            this._wireSubscriptions();
        }
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

    /** E57 redraw dedup: only the ROUNDED string counts as a visible change. */
    renderSignature() {
        return this.displayValue;
    }

    render() {
        return html`
            <div class="card">
                <span class="value">${this.displayValue}${this.unit ? html`<span class="unit">${this.unit}</span>` : ''}</span>
                <span class="label">${this.label || (feezal.isEditor ? 'Number' : '')}</span>
                ${this.footer ? html`<div class="rule footer">${this.footer}</div>` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-number', FeezalElementEinkNumber);
export {FeezalElementEinkNumber};
