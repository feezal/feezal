/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import '@material/web/textfield/outlined-text-field.js';

/**
 * feezal-element-material-time-picker (E25)
 *
 * Interactive time input that publishes a selected time to MQTT — the
 * scheduling companion ("turn on lights at …"). Desktop uses the browser's
 * native time picker inside an MD3 outlined text field; the trailing clock
 * icon opens a touch-optimised wheel picker (drum-roll columns for hours /
 * minutes / optional seconds) rendered as a fixed overlay.
 *
 * Payload contract: accepts "HH:MM", "HH:MM:SS" or numeric seconds since
 * midnight on the subscribe topic; publishes in the configured `format`.
 */

/** Parse an incoming time payload → {h, m, s} or null. */
export function parseTime(v) {
    if (v === undefined || v === null || v === '') {
        return null;
    }
    if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v).trim())) {
        let t = Math.floor(Number(v));
        if (!Number.isFinite(t)) {
            return null;
        }
        t = ((t % 86400) + 86400) % 86400;
        return {h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60};
    }
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) {
        return null;
    }
    const h = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3] || 0);
    if (h > 23 || mm > 59 || ss > 59) {
        return null;
    }
    return {h, m: mm, s: ss};
}

/** Format {h, m, s} in the configured output format. */
export function formatTime(t, format) {
    const p = n => String(n).padStart(2, '0');
    if (format === 'seconds') {
        return t.h * 3600 + t.m * 60 + t.s;
    }
    if (format === 'HH:MM:SS') {
        return `${p(t.h)}:${p(t.m)}:${p(t.s)}`;
    }
    return `${p(t.h)}:${p(t.m)}`;
}

const WHEEL_ITEM = 36;      // px per drum entry
const WHEEL_VISIBLE = 5;    // entries visible per column

class FeezalElementMaterialTimePicker extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Time Picker', category: 'Material', color: '#4a6080', icon: 'schedule'},
            description: 'Time input publishing "HH:MM", "HH:MM:SS" or seconds since midnight. ' +
                'The clock icon opens a touch-friendly wheel picker.',
            attributes: [
                {name: 'label',     type: 'string',    default: 'Time', help: 'Floating label above the field.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic to read the current time value from (HH:MM, HH:MM:SS or seconds since midnight).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.time" to navigate into a JSON payload.'},
                {name: 'publish',   type: 'mqttTopic', help: 'Topic to publish the selected time to.'},
                {name: 'format',    type: 'select', options: ['HH:MM', 'HH:MM:SS', 'seconds'], default: 'HH:MM',
                    help: 'Published payload format: "HH:MM" / "HH:MM:SS" string or total seconds since midnight.'},
                {name: 'step',      type: 'number', default: 1, min: 1, max: 30,
                    help: 'Minute increment in the wheel picker (e.g. 5 for 5-minute steps).'},
                {name: 'show-seconds', type: 'boolean', default: false, help: 'Show a seconds column in the wheel picker (and seconds in the native field).'},
                {name: 'publish-on-change', type: 'boolean', default: false,
                    help: 'Publish on every wheel step instead of only on confirm (OK) / field commit.'},
                {name: 'disabled',  type: 'boolean', help: 'Disable user input.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-time-picker-color', type: 'color',
                 default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                 help: 'Accent colour (focus border, wheel highlight, OK button).'},
            ],
            defaultStyle: {width: '160px', height: '60px'},
            restrict: {minWidth: 110, minHeight: 48},
        };
    }

    static properties = {
        label:           {type: String,  reflect: true},
        publish:         {type: String,  reflect: true},
        format:          {type: String,  reflect: true},
        step:            {type: Number,  reflect: true},
        showSeconds:     {type: Boolean, reflect: true, attribute: 'show-seconds'},
        publishOnChange: {type: Boolean, reflect: true, attribute: 'publish-on-change'},
        disabled:        {type: Boolean, reflect: true},
        _time:           {state: true},   // {h, m, s}
        _wheelOpen:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            --feezal-time-picker-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            --md-sys-color-primary: var(--feezal-time-picker-color);
            --md-sys-color-on-surface: var(--primary-text-color, #333);
            --md-sys-color-surface: var(--card-background-color, #fff);
            --md-sys-color-outline: var(--divider-color, #ccc);
        }
        md-outlined-text-field { width: 100%; }
        .clock-btn {
            border: none; background: none; cursor: pointer; padding: 2px;
            font-family: 'Material Icons'; font-size: 20px;
            color: var(--secondary-text-color, #666);
        }

        /* ── Wheel overlay ─────────────────────────────────────────────── */
        .backdrop {
            position: fixed; inset: 0; z-index: 20000;
            background: rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
        }
        .panel {
            background: var(--secondary-background-color, #fff);
            color: var(--primary-text-color, #333);
            border-radius: 12px; padding: 14px 16px 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.35);
            user-select: none; touch-action: pan-y;
        }
        .panel .title { font-size: 13px; opacity: 0.7; margin-bottom: 8px; text-align: center; }
        .drums {
            position: relative; display: flex; gap: 4px;
            height: ${WHEEL_ITEM * WHEEL_VISIBLE}px;
        }
        .drums::before {
            /* centre-row highlight */
            content: ''; position: absolute; left: 0; right: 0;
            top: ${WHEEL_ITEM * 2}px; height: ${WHEEL_ITEM}px;
            border-top: 1px solid var(--feezal-time-picker-color);
            border-bottom: 1px solid var(--feezal-time-picker-color);
            pointer-events: none; opacity: 0.6;
        }
        .drum {
            width: 56px; height: 100%;
            overflow-y: scroll;
            scroll-snap-type: y mandatory;
            scrollbar-width: none;
        }
        .drum::-webkit-scrollbar { display: none; }
        .drum .pad { height: ${WHEEL_ITEM * 2}px; }
        .drum .item {
            height: ${WHEEL_ITEM}px; display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-variant-numeric: tabular-nums;
            scroll-snap-align: center; cursor: pointer;
        }
        .colon { display: flex; align-items: center; font-size: 18px; opacity: 0.6; }
        .buttons { display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; }
        .buttons button {
            border: none; border-radius: 6px; padding: 7px 14px; cursor: pointer;
            font: inherit; font-size: 13px;
            background: none; color: var(--primary-text-color, #333);
        }
        .buttons button.ok {
            background: var(--feezal-time-picker-color); color: #fff;
        }
    `];

    constructor() {
        super();
        this.label = 'Time';
        this.publish = '';
        this.format = 'HH:MM';
        this.step = 1;
        this.showSeconds = false;
        this.publishOnChange = false;
        this.disabled = false;
        this._time = null;
        this._wheelOpen = false;
        this._settleTimers = {};
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const t = parseTime(this.getProperty(msg, this.messageProperty));
                if (t) {
                    this._time = t;
                }
            });
        }
    }

    // ── Publishing ──────────────────────────────────────────────────────────

    _pub() {
        if (feezal.isEditor || !this.publish || !this._time) {
            return;
        }
        feezal.connection.pub(this.publish, formatTime(this._time, this.format));
    }

    // ── Native field ────────────────────────────────────────────────────────

    _fieldValue() {
        if (!this._time) {
            return '';
        }
        return formatTime(this._time, this.showSeconds ? 'HH:MM:SS' : 'HH:MM');
    }

    _onFieldChange(e) {
        const t = parseTime(e.target.value);
        if (t) {
            this._time = t;
            this._pub();
        }
    }

    // ── Wheel picker ────────────────────────────────────────────────────────

    _minuteValues() {
        const step = Math.min(30, Math.max(1, Math.floor(Number(this.step) || 1)));
        const values = [];
        for (let m = 0; m < 60; m += step) {
            values.push(m);
        }
        return values;
    }

    _openWheel() {
        if (feezal.isEditor || this.disabled) {
            return;
        }
        this._draft = {...(this._time || {h: 0, m: 0, s: 0})};
        this._wheelOpen = true;
        this.updateComplete.then(() => this._scrollDrumsToDraft());
    }

    _scrollDrumsToDraft() {
        const minutes = this._minuteValues();
        const position = (drum, index) => {
            const el = this.renderRoot.querySelector(`.drum[data-col="${drum}"]`);
            if (el) {
                el.scrollTop = index * WHEEL_ITEM;
            }
        };
        position('h', this._draft.h);
        const mIndex = minutes.reduce((best, v, i) => Math.abs(v - this._draft.m) < Math.abs(minutes[best] - this._draft.m) ? i : best, 0);
        position('m', mIndex);
        if (this.showSeconds) {
            position('s', this._draft.s);
        }
    }

    /** Scroll settle → adopt the centred entry of the column. */
    _onDrumScroll(e, col, values) {
        clearTimeout(this._settleTimers[col]);
        this._settleTimers[col] = setTimeout(() => {
            const index = Math.min(values.length - 1, Math.max(0, Math.round(e.target.scrollTop / WHEEL_ITEM)));
            if (this._draft[col] !== values[index]) {
                this._draft[col] = values[index];
                if (this.publishOnChange) {
                    this._time = {...this._draft};
                    this._pub();
                }
            }
        }, 120);
    }

    _pickItem(col, value, index) {
        const el = this.renderRoot.querySelector(`.drum[data-col="${col}"]`);
        if (el) {
            el.scrollTo({top: index * WHEEL_ITEM, behavior: 'smooth'});
        }
        this._draft[col] = value;
    }

    _confirmWheel() {
        this._time = {...this._draft};
        this._wheelOpen = false;
        this._pub();
    }

    _cancelWheel() {
        this._wheelOpen = false;
    }

    _renderDrum(col, values, selected) {
        return html`
            <div class="drum" data-col="${col}"
                @scroll="${e => this._onDrumScroll(e, col, values)}">
                <div class="pad"></div>
                ${values.map((v, i) => html`
                    <div class="item" @click="${() => this._pickItem(col, v, i)}">
                        ${String(v).padStart(2, '0')}
                    </div>`)}
                <div class="pad"></div>
            </div>`;
    }

    render() {
        const minutes = this._minuteValues();
        return html`
            <md-outlined-text-field
                label="${this.label || 'Time'}"
                type="time"
                step="${this.showSeconds ? 1 : 60}"
                .value="${this._fieldValue()}"
                ?disabled="${this.disabled}"
                @change="${this._onFieldChange}">
                <button slot="trailing-icon" class="clock-btn" title="Open wheel picker"
                    tabindex="-1" @click="${this._openWheel}">schedule</button>
            </md-outlined-text-field>

            ${this._wheelOpen ? html`
                <div class="backdrop" @click="${e => { if (e.target === e.currentTarget) this._cancelWheel(); }}">
                    <div class="panel">
                        <div class="title">${this.label || 'Time'}</div>
                        <div class="drums">
                            ${this._renderDrum('h', Array.from({length: 24}, (_, i) => i), this._draft.h)}
                            <div class="colon">:</div>
                            ${this._renderDrum('m', minutes, this._draft.m)}
                            ${this.showSeconds ? html`
                                <div class="colon">:</div>
                                ${this._renderDrum('s', Array.from({length: 60}, (_, i) => i), this._draft.s)}
                            ` : ''}
                        </div>
                        <div class="buttons">
                            <button @click="${this._cancelWheel}">Cancel</button>
                            <button class="ok" @click="${this._confirmWheel}">OK</button>
                        </div>
                    </div>
                </div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-time-picker', FeezalElementMaterialTimePicker);
export {FeezalElementMaterialTimePicker};
