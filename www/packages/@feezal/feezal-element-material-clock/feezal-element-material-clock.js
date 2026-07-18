/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

// ── Geometry helpers ─────────────────────────────────────────────────────────
const CX = 50, CY = 50, R = 44;

function polarXY(angleDeg, r) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return [+(CX + r * Math.cos(rad)).toFixed(2), +(CY + r * Math.sin(rad)).toFixed(2)];
}

// Clock hands: returns [x, y] tip for given angle and hand length
function handTip(angleDeg, len) { return polarXY(angleDeg, len); }

// Format a Date for the digital display
function fmtDigital(date, showSeconds, timezone) {
    try {
        const opts = {hour: '2-digit', minute: '2-digit', hour12: false};
        if (showSeconds) opts.second = '2-digit';
        if (timezone)    opts.timeZone = timezone;
        return new Intl.DateTimeFormat(undefined, opts).format(date);
    } catch {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = showSeconds ? `:${String(date.getSeconds()).padStart(2, '0')}` : '';
        return `${h}:${m}${s}`;
    }
}

function fmtDate(date, timezone) {
    try {
        const opts = {year: 'numeric', month: 'short', day: 'numeric'};
        if (timezone) opts.timeZone = timezone;
        return new Intl.DateTimeFormat(undefined, opts).format(date);
    } catch {
        return date.toLocaleDateString();
    }
}

// ── Element ───────────────────────────────────────────────────────────────────
class FeezalElementMaterialClock extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Clock', category: 'Simple', color: '#4a6080', icon: 'schedule'},
            description: 'Clock element — analog SVG clock or digital display. Shows the browser\'s local time by default; optionally subscribes to an MQTT topic for a remote device time.',
            attributes: [
                {name: 'mode',           type: 'select', options: ['analog', 'analog-minimal', 'digital', 'digital-clean'], default: 'analog',
                    help: 'Display style: analog SVG clock, analog without labels, 7-segment-style digital, or clean typographic digital.'},
                {name: 'subscribe-time', type: 'mqttTopic',
                    help: 'Optional MQTT topic carrying a Unix timestamp (seconds or ms) or ISO 8601 string. Overrides local time.'},
                {name: 'timezone',       type: 'string',  default: '', help: 'IANA timezone string (e.g. America/New_York). Defaults to the browser\'s local timezone.'},
                {name: 'show-seconds',   type: 'boolean', default: false, help: 'Show the seconds hand (analog) or seconds digits (digital).'},
                {name: 'show-date',      type: 'boolean', default: false, help: 'Show the current date below the clock face.'},
                {name: 'label',          type: 'string',  default: '',   help: 'Optional label below the clock (e.g. timezone name).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-clock-face-color',   type: 'color', default: 'var(--secondary-background-color)', help: 'Analog clock face background.'},
                {property: '--feezal-clock-hand-color',   type: 'color', default: 'var(--primary-text-color)',         help: 'Hour and minute hands colour.'},
                {property: '--feezal-clock-second-color', type: 'color', default: 'var(--accent-color, #f44336)',      help: 'Second hand / digit accent colour.'},
                {property: '--feezal-clock-text-color',   type: 'color', default: 'var(--primary-text-color)',         help: 'Tick labels, digit and label text colour.'},
                {property: '--feezal-clock-rim-color',    type: 'color', default: 'var(--secondary-text-color)',         help: 'Analog clock rim / tick-mark colour.'},
            ],
            restrict:     {minWidth: 60, minHeight: 60},
            defaultStyle: {width: '160px', height: '160px'},
        };
    }

    static properties = {
        mode:          {type: String,  reflect: true},
        subscribeTime: {type: String,  reflect: true, attribute: 'subscribe-time'},
        timezone:      {type: String,  reflect: true},
        showSeconds:   {type: Boolean, reflect: true, attribute: 'show-seconds'},
        showDate:      {type: Boolean, reflect: true, attribute: 'show-date'},
        label:         {type: String,  reflect: true},
        _now:    {state: true},   // Date object — updated by timer or MQTT
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 6px;
            box-sizing: border-box;
            overflow: hidden;
            gap: 3px;
            --feezal-clock-face-color:   var(--secondary-background-color, var(--feezal-bg-sub, #f5f5f5));
            --feezal-clock-hand-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-clock-second-color: var(--accent-color, #f44336);
            --feezal-clock-text-color:   var(--primary-text-color, var(--feezal-color, #333));
            --feezal-clock-rim-color:    var(--primary-text-color, var(--feezal-color, #333));
        }
        .clock-wrap { flex: 1; width: 100%; min-height: 0; display: flex; align-items: center; justify-content: center; }
        svg.analog { width: min(100%, 100%); height: min(100%, 100%); display: block; }
        .digital {
            font-variant-numeric: tabular-nums;
            font-size: clamp(18px, 5vw, 48px);
            font-weight: 300;
            letter-spacing: 0.04em;
            color: var(--feezal-clock-text-color);
            white-space: nowrap;
        }
        .digital-clean {
            font-variant-numeric: tabular-nums;
            font-size: clamp(16px, 4.5vw, 40px);
            font-weight: 200;
            color: var(--feezal-clock-text-color);
            white-space: nowrap;
        }
        .date-line {
            font-size: 11px; opacity: 0.6;
            color: var(--feezal-clock-text-color);
        }
        .label {
            font-size: 10px; opacity: 0.5;
            color: var(--feezal-clock-text-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.mode          = 'analog';
        this.subscribeTime = '';
        this.timezone      = '';
        this.showSeconds   = false;
        this.showDate      = false;
        this.label         = '';
        this._now          = new Date();
        // non-reactive
        this.__timer    = null;
        this.__mqttTime = null;  // Date set from MQTT; null = use local
    }

    connectedCallback() {
        super.connectedCallback();
        // Tick every second to keep the display live
        this.__timer = setInterval(() => {
            this._now = this.__mqttTime ?? new Date();
        }, 1000);
        this._now = new Date();

        if (this.subscribeTime) {
            this.addSubscription(this.subscribeTime, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                const ts = Number(v);
                if (!isNaN(ts)) {
                    // Detect seconds vs milliseconds (seconds < 1e10)
                    this.__mqttTime = new Date(ts < 1e10 ? ts * 1000 : ts);
                } else {
                    const parsed = new Date(v);
                    if (!isNaN(parsed.getTime())) this.__mqttTime = parsed;
                }
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.__timer) { clearInterval(this.__timer); this.__timer = null; }
    }

    // Resolve displayed Date to the configured timezone for hour/minute extraction.
    // Returns parts: {h24, min, sec} already adjusted for tz.
    _timeParts(date) {
        try {
            if (this.timezone) {
                const s = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric', minute: 'numeric', second: 'numeric',
                    hour12: false, timeZone: this.timezone,
                }).format(date);
                // Format: "HH:MM:SS"
                const [h, m, sec] = s.split(':').map(Number);
                return {h24: h % 24, min: m, sec: sec || 0};
            }
        } catch { /* fall through */ }
        return {h24: date.getHours(), min: date.getMinutes(), sec: date.getSeconds()};
    }

    _analogSvg(date, minimal) {
        const {h24, min, sec} = this._timeParts(date);
        const hourAngle   = ((h24 % 12) / 12 + min / 720) * 360;
        const minAngle    = (min / 60 + sec / 3600) * 360;
        const secAngle    = (sec / 60) * 360;

        const [hx, hy]  = handTip(hourAngle, 26);
        const [mx, my]  = handTip(minAngle, 36);
        const [sx, sy]  = handTip(secAngle, 38);

        // 12 tick marks (major every 5 steps, minor each step)
        const ticks = Array.from({length: 60}, (_, i) => {
            const major  = i % 5 === 0;
            const angle  = (i / 60) * 360;
            const [ix, iy] = polarXY(angle, R - 0.5);
            const [ox, oy] = polarXY(angle, R - (major ? 7 : 4));
            return {ix, iy, ox, oy, major};
        });

        return svg`
            <!-- face -->
            <circle cx="${CX}" cy="${CY}" r="${R}"
                    fill="var(--feezal-clock-face-color)"
                    stroke="var(--feezal-clock-rim-color)" stroke-width="2"/>
            <!-- tick marks -->
            ${minimal ? '' : ticks.map(t => svg`
                <line x1="${t.ix}" y1="${t.iy}" x2="${t.ox}" y2="${t.oy}"
                      stroke="var(--feezal-clock-rim-color)"
                      stroke-width="${t.major ? 2 : 1}" opacity="${t.major ? 0.8 : 0.4}"/>`)}
            <!-- hour labels (analog full only) -->
            ${minimal ? '' : [12, 3, 6, 9].map(n => {
                const [lx, ly] = polarXY((n / 12) * 360, R - 14);
                return svg`<text x="${lx}" y="${+ly + 3.5}"
                    text-anchor="middle" font-size="8" font-weight="600"
                    fill="var(--feezal-clock-text-color)">${n}</text>`;
            })}
            <!-- hour hand -->
            <line x1="${CX}" y1="${CY}" x2="${hx}" y2="${hy}"
                  stroke="var(--feezal-clock-hand-color)"
                  stroke-width="4" stroke-linecap="round"/>
            <!-- minute hand -->
            <line x1="${CX}" y1="${CY}" x2="${mx}" y2="${my}"
                  stroke="var(--feezal-clock-hand-color)"
                  stroke-width="2.5" stroke-linecap="round"/>
            <!-- second hand -->
            ${this.showSeconds ? svg`
                <line x1="${CX}" y1="${CY}" x2="${sx}" y2="${sy}"
                      stroke="var(--feezal-clock-second-color)"
                      stroke-width="1.5" stroke-linecap="round"/>
                <line x1="${CX}" y1="${CY}" x2="${polarXY((secAngle + 180) % 360, 10)[0]}"
                      y2="${polarXY((secAngle + 180) % 360, 10)[1]}"
                      stroke="var(--feezal-clock-second-color)"
                      stroke-width="1.5" stroke-linecap="round"/>
            ` : ''}
            <!-- centre dot -->
            <circle cx="${CX}" cy="${CY}" r="3.5" fill="var(--feezal-clock-hand-color)"/>
            ${this.showSeconds ? svg`
                <circle cx="${CX}" cy="${CY}" r="2" fill="var(--feezal-clock-second-color)"/>
            ` : ''}`;
    }

    render() {
        const now     = this._now;
        const minimal = this.mode === 'analog-minimal';
        const digital = this.mode === 'digital' || this.mode === 'digital-clean';
        const cls     = this.mode === 'digital-clean' ? 'digital-clean' : 'digital';

        if (digital) {
            return html`
                <div class="${cls}">${fmtDigital(now, this.showSeconds, this.timezone)}</div>
                ${this.showDate ? html`<div class="date-line">${fmtDate(now, this.timezone)}</div>` : ''}
                ${this.label   ? html`<div class="label">${this.label}</div>` : ''}`;
        }

        return html`
            <div class="clock-wrap">
                <svg class="analog" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    ${this._analogSvg(now, minimal)}
                </svg>
            </div>
            ${this.showDate ? html`<div class="date-line">${fmtDate(now, this.timezone)}</div>` : ''}
            ${this.label   ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-material-clock', FeezalElementMaterialClock);
export {FeezalElementMaterialClock};
