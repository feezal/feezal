/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-material-schedule (E52)
 *
 * A UI for EDITING schedules, not executing them: renders the current
 * schedule from the (retained) subscribe topic and publishes the edited
 * schedule as JSON to the publish topic. Whatever consumes it — she,
 * Node-RED, a thermostat adapter — owns the actual scheduling.
 *
 * Schedule JSON contract (generic feezal format — docs/schedule-format.md):
 *   {
 *     "type": "boolean" | "number",
 *     "week": { "mon": [{"from": "06:30", "to": "08:00", "value": true}], … "sun": [] },
 *     "default": false,          // value outside all blocks
 *     "exceptions": []           // reserved (tier 2); preserved verbatim
 *   }
 *
 * Decisions honoured (roadmap, July 2026):
 * - Explicit Save: edits stay local until Save (retained publish); Revert
 *   restores the last received payload; a remote update while dirty shows a
 *   "changed remotely" hint instead of clobbering the draft.
 * - Naive wall-clock "HH:MM" strings — no timezone handling anywhere.
 * - Drag-paint from/to blocks (drag empty space to create, drag block edges
 *   to resize, tap to select → delete / edit value) with snapping (`step`
 *   minutes); pointer events, touch-friendly.
 * - "Effective value now" chip + now-line, computed client-side.
 */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = {mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su'};
const MIN_PER_DAY = 24 * 60;

/** "06:30" → 390. Invalid → null. */
export function timeToMin(t) {
    const m = String(t ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
        return null;
    }
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || min > 59 || (h === 24 && min > 0)) {
        return null;
    }
    return h * 60 + min;
}

/** 390 → "06:30". */
export function minToTime(min) {
    const m = Math.min(MIN_PER_DAY, Math.max(0, Math.round(min)));
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Snap minutes to the grid step. */
export function snapMin(min, step) {
    const s = Math.max(1, Number(step) || 15);
    return Math.min(MIN_PER_DAY, Math.max(0, Math.round(min / s) * s));
}

/**
 * Parse an incoming schedule payload into the normalized internal shape
 * {type, week: {day: [{from, to, value}] sorted}, default, exceptions}.
 * Unparseable/missing → an empty schedule of `fallbackType` (never crashes).
 */
export function parseSchedule(payload, fallbackType = 'boolean') {
    const empty = type => ({
        type,
        week: Object.fromEntries(DAYS.map(d => [d, []])),
        default: type === 'number' ? 0 : false,
        exceptions: [],
    });

    let raw = payload;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return empty(fallbackType);
        }
    }
    if (!raw || typeof raw !== 'object') {
        return empty(fallbackType);
    }

    // Payload wins over the attribute for rendering (decided).
    const type = raw.type === 'number' ? 'number' : raw.type === 'boolean' ? 'boolean' : fallbackType;
    const out = empty(type);
    if (raw.default !== undefined) {
        out.default = raw.default;
    }
    if (Array.isArray(raw.exceptions)) {
        out.exceptions = raw.exceptions;   // reserved — preserved verbatim
    }

    const week = raw.week && typeof raw.week === 'object' ? raw.week : {};
    for (const day of DAYS) {
        const blocks = Array.isArray(week[day]) ? week[day] : [];
        out.week[day] = blocks
            .map(b => ({from: timeToMin(b?.from), to: timeToMin(b?.to), value: b?.value ?? (type === 'number' ? 0 : true)}))
            .filter(b => b.from !== null && b.to !== null && b.to > b.from)
            .sort((a, b) => a.from - b.from);
    }
    return out;
}

/** Serialize the internal shape back to the published JSON contract. */
export function serializeSchedule(schedule) {
    return JSON.stringify({
        type: schedule.type,
        week: Object.fromEntries(DAYS.map(day => [day, (schedule.week[day] || []).map(b => ({
            from: minToTime(b.from),
            to: minToTime(b.to),
            value: b.value,
        }))])),
        default: schedule.default,
        exceptions: schedule.exceptions || [],
    });
}

/**
 * "Effective value now" — what the schedule says at `now` (a Date).
 * Exceptions are ignored in the MVP. Returns {value, until} where `until`
 * is the "HH:MM" the current value holds to (block end / next block start /
 * midnight), or null at the very end of the day.
 */
export function effectiveNow(schedule, now = new Date()) {
    const day = DAYS[(now.getDay() + 6) % 7];   // JS: 0=Sun → our week starts Mon
    const min = now.getHours() * 60 + now.getMinutes();
    const blocks = schedule.week[day] || [];

    const current = blocks.find(b => b.from <= min && min < b.to);
    if (current) {
        return {value: current.value, until: minToTime(current.to)};
    }
    const next = blocks.find(b => b.from > min);
    return {value: schedule.default, until: next ? minToTime(next.from) : (min >= MIN_PER_DAY ? null : '24:00')};
}

/**
 * Clamp a block's [from, to] to the free gap containing `from` (no
 * overlaps with neighbours, day bounds respected). `index` is the block's
 * position in the day array (-1 for a new block). A `from` inside another
 * block yields an empty/inverted interval — callers reject it.
 */
export function clampBlock(blocks, index, from, to) {
    let lo = 0;
    let hi = MIN_PER_DAY;
    blocks.forEach((b, i) => {
        if (i === index) {
            return;
        }
        if (b.to <= from) {
            lo = Math.max(lo, b.to);          // neighbour ends before the start
        } else if (b.from >= from) {
            hi = Math.min(hi, b.from);        // neighbour begins after the start
        } else {
            lo = Math.max(lo, b.to);          // start lies inside this neighbour
        }
    });
    return [Math.max(lo, from), Math.min(hi, to)];
}

class FeezalElementMaterialSchedule extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Schedule', category: 'Material', color: '#4a6080', icon: 'calendar_month'},
            description: 'Weekly schedule EDITOR (drag to paint blocks): renders the retained schedule ' +
                'JSON from the subscribe topic, publishes edits on Save. Executing the schedule is the ' +
                'consumer\'s job (she, Node-RED, …) — see docs/schedule-format.md for the JSON contract. ' +
                'Times are wall-clock (the consumer\'s clock).',
            links: [{label: 'Schedule JSON format', url: 'https://github.com/hobbyquaker/feezal/blob/master/docs/schedule-format.md'}],
            attributes: [
                {name: 'label',     type: 'string', help: 'Heading shown above the grid.'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic carrying the retained schedule JSON.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the schedule within the MQTT message. Default: payload'},
                {name: 'publish',   type: 'mqttTopic', help: 'Topic the edited schedule is published to (retained) on Save.'},
                {name: 'type',      type: 'select', options: ['boolean', 'number'], default: 'boolean',
                    help: 'Block value type: boolean = on/off painting, number = setpoint per block (thermostat). A typed payload wins over this attribute for rendering.'},
                {name: 'step',      type: 'select', options: ['5', '10', '15', '30', '60'], default: '15',
                    help: 'Snap step in minutes for drag-painting blocks.'},
                {name: 'min',        type: 'number', default: 5,  help: 'Lower bound for number-type block values.'},
                {name: 'max',        type: 'number', default: 30, help: 'Upper bound for number-type block values.'},
                {name: 'step-value', type: 'number', default: 0.5, help: 'Increment for number-type block values.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-schedule-color', type: 'color',
                 default: 'var(--primary-color, var(--sl-color-primary-600, #0284c7))',
                 help: 'Block / accent colour.'},
            ],
            defaultStyle: {width: '420px', height: '320px'},
            restrict: {minWidth: 260, minHeight: 200},
        };
    }

    static properties = {
        label:     {type: String, reflect: true},
        publish:   {type: String, reflect: true},
        type:      {type: String, reflect: true},
        step:      {type: Number, reflect: true},
        min:       {type: Number, reflect: true},
        max:       {type: Number, reflect: true},
        stepValue: {type: Number, reflect: true, attribute: 'step-value'},
        _schedule:      {state: true},   // the editable draft
        _dirty:         {state: true},
        _remoteChanged: {state: true},   // remote update arrived while dirty
        _selected:      {state: true},   // {day, index} | null
        _nowMin:        {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; box-sizing: border-box;
            font-size: 12px; color: var(--primary-text-color, #333);
            background: var(--card-background-color, var(--feezal-bg, #fff));
            border-radius: 8px; padding: 8px;
            --feezal-schedule-color: var(--primary-color, var(--sl-color-primary-600, #0284c7));
            user-select: none;
        }
        .head {
            display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
        }
        .head .title { font-weight: 600; font-size: 13px; }
        .now-chip {
            font-size: 11px; padding: 2px 8px; border-radius: 10px;
            background: color-mix(in srgb, var(--feezal-schedule-color) 12%, transparent);
            color: var(--feezal-schedule-color);
        }
        .spacer { flex: 1; }
        .dirty { font-size: 11px; color: var(--warning-color, #ff9800); }
        .remote-hint {
            font-size: 11px; color: var(--warning-color, #ff9800);
            margin-bottom: 4px;
        }
        .btn {
            border: 1px solid var(--divider-color, #ccc); border-radius: 5px;
            background: none; color: inherit; cursor: pointer;
            font: inherit; font-size: 12px; padding: 3px 10px;
        }
        .btn.save {
            background: var(--feezal-schedule-color); border-color: var(--feezal-schedule-color);
            color: #fff;
        }
        .btn:disabled { opacity: 0.4; cursor: default; }

        .grid { flex: 1; display: flex; min-height: 0; }
        .axis { width: 30px; position: relative; flex: 0 0 auto; }
        .axis .tick {
            position: absolute; right: 4px; transform: translateY(-50%);
            font-size: 9px; opacity: 0.55;
        }
        .days { flex: 1; display: flex; gap: 2px; min-width: 0; }
        .day { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .day .name { text-align: center; font-size: 10px; opacity: 0.7; margin-bottom: 2px; }
        .col {
            flex: 1; position: relative; border-radius: 3px;
            background: color-mix(in srgb, var(--primary-text-color, #333) 6%, transparent);
            touch-action: none;
        }
        .col .hourline {
            position: absolute; left: 0; right: 0; height: 1px;
            background: color-mix(in srgb, var(--primary-text-color, #333) 8%, transparent);
            pointer-events: none;
        }
        .block {
            position: absolute; left: 1px; right: 1px; border-radius: 3px;
            background: var(--feezal-schedule-color);
            color: #fff; overflow: hidden; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 9px;
        }
        .block.selected { outline: 2px solid var(--warning-color, #ff9800); z-index: 2; }
        .block .edge {
            position: absolute; left: 0; right: 0; height: 7px; cursor: ns-resize;
        }
        .block .edge.top { top: 0; }
        .block .edge.bottom { bottom: 0; }
        .nowline {
            position: absolute; left: 0; right: 0; height: 0;
            border-top: 1px dashed var(--error-color, #d32f2f);
            pointer-events: none; z-index: 3;
        }
        .toolbar {
            display: flex; align-items: center; gap: 6px; margin-top: 6px;
            font-size: 11px;
        }
        .toolbar input[type="number"] {
            width: 70px; font: inherit; padding: 2px 4px;
            background: var(--feezal-bg, #fff); color: inherit;
            border: 1px solid var(--divider-color, #ccc); border-radius: 4px;
        }
    `];

    constructor() {
        super();
        this.label = '';
        this.publish = '';
        this.type = 'boolean';
        this.step = 15;
        this.min = 5;
        this.max = 30;
        this.stepValue = 0.5;
        this._schedule = parseSchedule(null, 'boolean');
        this._remote = serializeSchedule(this._schedule);
        this._dirty = false;
        this._remoteChanged = false;
        this._selected = null;
        this._nowMin = this._currentMin();
        this._lastValue = null;
        this._drag = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this._schedule.week.mon.length && this.type === 'number' && this._schedule.type !== 'number') {
            this._schedule = parseSchedule(null, this.type);
            this._remote = serializeSchedule(this._schedule);
        }
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                this._onRemote(this.getProperty(msg, this.messageProperty));
            });
        }
        this._nowTimer = setInterval(() => {
            this._nowMin = this._currentMin();
        }, 30_000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._nowTimer);
    }

    _currentMin() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    // ── Remote / dirty state ─────────────────────────────────────────────────

    _onRemote(payload) {
        const incoming = parseSchedule(payload, this.type === 'number' ? 'number' : 'boolean');
        if (payload && typeof payload === 'object' && payload.type && payload.type !== this.type) {
            console.warn(`[feezal-element-material-schedule] payload type "${payload.type}" differs from the type attribute "${this.type}" — payload wins`);
        }
        const serialized = serializeSchedule(incoming);
        if (this._dirty) {
            // Never clobber a draft silently (decided) — hint instead.
            if (serialized !== this._remote) {
                this._remote = serialized;
                this._remoteChanged = true;
            }
            return;
        }
        this._remote = serialized;
        this._schedule = incoming;
        this._selected = null;
    }

    _markDirty() {
        this._schedule = {...this._schedule, week: {...this._schedule.week}};
        this._dirty = serializeSchedule(this._schedule) !== this._remote;
    }

    _save() {
        if (feezal.isEditor || !this.publish) {
            return;
        }
        const serialized = serializeSchedule(this._schedule);
        feezal.connection.pub(this.publish, serialized, {retain: true});
        this._remote = serialized;
        this._dirty = false;
        this._remoteChanged = false;
    }

    _revert() {
        this._schedule = parseSchedule(this._remote, this.type === 'number' ? 'number' : 'boolean');
        this._dirty = false;
        this._remoteChanged = false;
        this._selected = null;
    }

    // ── Block editing (shared by pointer interaction and tests) ─────────────

    _newBlockValue() {
        if (this._schedule.type === 'number') {
            if (this._lastValue !== null) {
                return this._lastValue;
            }
            const mid = (Number(this.min) + Number(this.max)) / 2;
            const step = Number(this.stepValue) || 0.5;
            return Math.round(mid / step) * step;
        }
        return true;
    }

    /** Insert a block (minutes), clamped against neighbours. Returns its index or -1. */
    addBlock(day, from, to, value = this._newBlockValue()) {
        const blocks = this._schedule.week[day];
        const [f, t] = clampBlock(blocks, -1, Math.min(from, to), Math.max(from, to));
        if (t - f < Math.max(1, Number(this.step) || 15)) {
            return -1;
        }
        blocks.push({from: f, to: t, value});
        blocks.sort((a, b) => a.from - b.from);
        this._markDirty();
        return blocks.findIndex(b => b.from === f && b.to === t);
    }

    resizeBlock(day, index, from, to) {
        const blocks = this._schedule.week[day];
        const block = blocks[index];
        if (!block) {
            return;
        }
        const [f, t] = clampBlock(blocks, index, Math.min(from, to), Math.max(from, to));
        if (t - f < Math.max(1, Number(this.step) || 15)) {
            return;
        }
        block.from = f;
        block.to = t;
        this._markDirty();
    }

    deleteBlock(day, index) {
        this._schedule.week[day].splice(index, 1);
        this._selected = null;
        this._markDirty();
    }

    setBlockValue(day, index, value) {
        const block = this._schedule.week[day][index];
        if (!block) {
            return;
        }
        let v = Number(value);
        if (!Number.isFinite(v)) {
            return;
        }
        v = Math.min(Number(this.max), Math.max(Number(this.min), v));
        block.value = v;
        this._lastValue = v;
        this._markDirty();
    }

    // ── Pointer interaction ──────────────────────────────────────────────────

    _yToMin(clientY, rect) {
        return snapMin((clientY - rect.top) / (rect.height || 1) * MIN_PER_DAY, this.step);
    }

    _onColDown(e, day) {
        if (feezal.isEditor || e.button > 0) {
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const min = this._yToMin(e.clientY, rect);
        this._drag = {mode: 'create', day, rect, anchor: min, moved: false, index: -1};
        e.currentTarget.setPointerCapture(e.pointerId);
        this._selected = null;
    }

    _onBlockDown(e, day, index, edge) {
        if (feezal.isEditor) {
            return;
        }
        e.stopPropagation();
        const col = e.currentTarget.closest('.col');
        const rect = col.getBoundingClientRect();
        if (edge) {
            this._drag = {mode: edge, day, index, rect, moved: false};
            col.setPointerCapture(e.pointerId);
        } else {
            // plain tap → select
            this._selected = {day, index};
        }
    }

    _onColMove(e) {
        const d = this._drag;
        if (!d) {
            return;
        }
        const min = this._yToMin(e.clientY, d.rect);
        if (d.mode === 'create') {
            if (!d.moved && min === d.anchor) {
                return;
            }
            d.moved = true;
            if (d.index === -1) {
                d.index = this.addBlock(d.day, Math.min(d.anchor, min), Math.max(d.anchor, min) || d.anchor + Number(this.step));
            } else {
                this.resizeBlock(d.day, d.index, Math.min(d.anchor, min), Math.max(d.anchor, min));
            }
        } else if (d.mode === 'resize-top' || d.mode === 'resize-bottom') {
            const block = this._schedule.week[d.day][d.index];
            if (!block) {
                return;
            }
            d.moved = true;
            if (d.mode === 'resize-top') {
                this.resizeBlock(d.day, d.index, min, block.to);
            } else {
                this.resizeBlock(d.day, d.index, block.from, min);
            }
        }
    }

    _onColUp() {
        const d = this._drag;
        this._drag = null;
        if (!d) {
            return;
        }
        if (d.mode === 'create' && d.moved && d.index >= 0) {
            this._selected = {day: d.day, index: d.index};
        }
        // re-sort after edge drags may have reordered
        this._schedule.week[d.day]?.sort((a, b) => a.from - b.from);
        this._markDirty();
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    _formatValue(value) {
        if (this._schedule.type === 'number') {
            return String(value);
        }
        return value === true || value === 'true' || value === 1 ? 'on' : 'off';
    }

    _renderNowChip() {
        const {value, until} = effectiveNow(this._schedule);
        return html`<span class="now-chip" title="Effective value now (client clock; exceptions not evaluated)">
            now: ${this._formatValue(value)}${until ? ` → ${until}` : ''}
        </span>`;
    }

    render() {
        const schedule = this._schedule;
        const sel = this._selected;
        const selectedBlock = sel ? schedule.week[sel.day]?.[sel.index] : null;
        const today = DAYS[(new Date().getDay() + 6) % 7];

        return html`
            <div class="head">
                ${this.label ? html`<span class="title">${this.label}</span>` : ''}
                ${this._renderNowChip()}
                <span class="spacer"></span>
                ${this._dirty ? html`<span class="dirty">● unsaved</span>` : ''}
                <button class="btn" ?disabled=${!this._dirty} @click=${this._revert}>Revert</button>
                <button class="btn save" ?disabled=${!this._dirty || !this.publish} @click=${this._save}>Save</button>
            </div>
            ${this._remoteChanged ? html`
                <div class="remote-hint">⚠ schedule changed remotely — Save overwrites it, Revert loads it</div>` : ''}

            <div class="grid">
                <div class="axis">
                    <div style="height: 14px"></div>
                    <div style="position: relative; height: calc(100% - 14px)">
                        ${[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => html`
                            <span class="tick" style="top: ${h / 24 * 100}%">${String(h).padStart(2, '0')}</span>`)}
                    </div>
                </div>
                <div class="days">
                    ${DAYS.map(day => html`
                        <div class="day">
                            <div class="name">${DAY_LABELS[day]}</div>
                            <div class="col" data-day="${day}"
                                @pointerdown=${e => this._onColDown(e, day)}
                                @pointermove=${this._onColMove}
                                @pointerup=${this._onColUp}
                                @pointercancel=${this._onColUp}>
                                ${[3, 6, 9, 12, 15, 18, 21].map(h => html`
                                    <div class="hourline" style="top: ${h / 24 * 100}%"></div>`)}
                                ${(schedule.week[day] || []).map((b, i) => html`
                                    <div class="block ${sel && sel.day === day && sel.index === i ? 'selected' : ''}"
                                        style="top: ${b.from / MIN_PER_DAY * 100}%; height: ${(b.to - b.from) / MIN_PER_DAY * 100}%"
                                        title="${minToTime(b.from)}–${minToTime(b.to)}${schedule.type === 'number' ? ` · ${b.value}` : ''}"
                                        @pointerdown=${e => this._onBlockDown(e, day, i, null)}>
                                        ${schedule.type === 'number' && (b.to - b.from) >= 45 ? html`<span>${b.value}</span>` : ''}
                                        <div class="edge top" @pointerdown=${e => this._onBlockDown(e, day, i, 'resize-top')}></div>
                                        <div class="edge bottom" @pointerdown=${e => this._onBlockDown(e, day, i, 'resize-bottom')}></div>
                                    </div>`)}
                                ${day === today ? html`
                                    <div class="nowline" style="top: ${this._nowMin / MIN_PER_DAY * 100}%"></div>` : ''}
                            </div>
                        </div>`)}
                </div>
            </div>

            ${selectedBlock ? html`
                <div class="toolbar">
                    <span>${DAY_LABELS[sel.day]} ${minToTime(selectedBlock.from)}–${minToTime(selectedBlock.to)}</span>
                    ${schedule.type === 'number' ? html`
                        <input type="number" .value=${String(selectedBlock.value)}
                            min=${this.min} max=${this.max} step=${this.stepValue}
                            @change=${e => this.setBlockValue(sel.day, sel.index, e.target.value)}>
                    ` : ''}
                    <button class="btn" @click=${() => this.deleteBlock(sel.day, sel.index)}>Delete</button>
                    <button class="btn" @click=${() => { this._selected = null; }}>Close</button>
                </div>` : ''}
        `;
    }
}

customElements.define('feezal-element-material-schedule', FeezalElementMaterialSchedule);
export {FeezalElementMaterialSchedule};
