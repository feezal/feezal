/* global feezal */
/**
 * @feezal/feezal-controller-untis (E191, per the E137 architecture)
 *
 * School timetables from untis2mqtt (github.com/hobbyquaker/untis2mqtt) as a
 * Lit Reactive Controller, shared by the untis elements (day card, week grid,
 * list, now/next badge, school hours). The bridge publishes one retained tree
 * per child under `<prefix>/status/<child>` (default prefix `untis`):
 *
 *   <child>/<day>/{date,school,start,end,start_planned,end_planned,timetable}
 *                                         <day> = today | tomorrow | next
 *   <child>/now, <child>/next_lesson      the lesson now / the next one
 *   <child>/week, <child>/week/next       {monday, days: [day + timetable]}
 *   <child>/homework|exams|absences|messages
 *   <prefix>/status/school/time_grid      [{period, start: "07:40", end}]
 *
 * Payloads are `{"val", "ts", "lc"}` by default or bare with
 * `--no-json-payloads`; the envelope is unwrapped either way.
 *
 * THE CHILD is a topic prefix (`subscribe`, e.g. `untis/status/mia`). Further
 * children go into `children`; with more than one the view renders a
 * switcher, and a switch is mirrored by every untis element on the page that
 * knows the same child. Only the active child is subscribed.
 *
 * Views tell the controller which items they read (`items`, relative to the
 * child prefix) and whether they need the school's time grid. The view-neutral
 * render helpers (switcher, tabs, lesson cells, the pure data shaping) live
 * here too, like audioPanel in the audio controller, so a second family
 * (eink) reuses them; each family supplies its chrome and colours.
 */
import {css, html} from '@feezal/feezal-element';
import {currentLocale, resolveLocaleChain} from '@feezal/feezal-element/feezal-locale.js';

// ── the contract ──────────────────────────────────────────────────────────────

/** Shared attribute descriptors — spread into every family's `feezal.attributes`. */
export const untisAttributes = [
    {name: 'subscribe', type: 'mqttTopic',
        help: 'The child\'s topic prefix, e.g. untis/status/mia — the element reads the items below it. ' +
            'untis/status/all gives the household\'s earliest start and latest end (school hours only).'},
    {name: 'message-property', type: 'string', default: 'payload',
        help: 'Dot-notation path to the value within each message. The {"val": …} envelope of untis2mqtt is unwrapped ' +
            'either way. Default: payload'},
    {name: 'label', type: 'string', default: '',
        help: 'Name of this child, shown in the header and the switcher. Empty = the last topic segment.'},
    {name: 'children', type: 'objectList',
        itemFields: [{key: 'topic', placeholder: 'untis/status/ben'}, {key: 'label', placeholder: 'Ben'}],
        help: 'Further children (topic prefix + name). With more than one child the viewer shows a switcher; ' +
            'switching one untis element switches every other one that knows the same child.'},
];

/** Attribute names this controller consumes (parity-set derivation, E114). */
export const UNTIS_CONSUMED_ATTRIBUTES = untisAttributes.map(a => a.name);

/** Shared discovery.map fragment — the recognizer (server/src/mqtt/recognizers/untis.js) hands over the child prefix. */
export const untisDiscoveryMap = {
    name:           'label',
    base_topic:     {attr: 'subscribe'},
    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
};

export const UNTIS_DAYS = ['today', 'tomorrow', 'next'];
export const UNTIS_WEEKS = ['this', 'next'];
export const UNTIS_LISTS = ['homework', 'exams', 'absences', 'messages'];

// ── text ──────────────────────────────────────────────────────────────────────

const TEXT = {
    en: {
        today: 'Today', tomorrow: 'Tomorrow', next: 'Next school day',
        this_week: 'This week', next_week: 'Next week',
        no_school: 'No school', free: 'free', now: 'Now', after: 'Next', until: 'until', from: 'from',
        no_lessons: 'No more lessons', waiting: 'Waiting for data…', nothing: 'Nothing to show',
        homework: 'Homework', exams: 'Exams', absences: 'Absences', messages: 'Messages',
        excused: 'excused', unexcused: 'not excused', planned: 'planned', done: 'done', due: 'due',
        cancelled: 'cancelled', additional: 'extra', exam: 'exam', event: 'event', moved: 'moved',
    },
    de: {
        today: 'Heute', tomorrow: 'Morgen', next: 'Nächster Schultag',
        this_week: 'Diese Woche', next_week: 'Nächste Woche',
        no_school: 'Kein Unterricht', free: 'frei', now: 'Jetzt', after: 'Danach', until: 'bis', from: 'ab',
        no_lessons: 'Keine Stunden mehr', waiting: 'Warte auf Daten…', nothing: 'Nichts anzuzeigen',
        homework: 'Hausaufgaben', exams: 'Prüfungen', absences: 'Fehlzeiten', messages: 'Nachrichten',
        excused: 'entschuldigt', unexcused: 'nicht entschuldigt', planned: 'geplant', done: 'erledigt', due: 'fällig',
        cancelled: 'entfällt', additional: 'zusätzlich', exam: 'Prüfung', event: 'Veranstaltung', moved: 'verlegt',
    },
};

/** A UI string in the site locale (en fallback). */
export function untisText(key, locale = currentLocale()) {
    for (const l of resolveLocaleChain(locale)) {
        const t = TEXT[l]?.[key];
        if (t !== undefined) return t;
    }
    return key;
}

// ── pure helpers ──────────────────────────────────────────────────────────────

/** Unwrap the mqtt-smarthome `{"val", "ts"}` envelope; parse JSON text. */
export function unwrap(v) {
    if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
        try { v = JSON.parse(v); } catch { return v; }
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && 'val' in v && ('ts' in v || 'lc' in v)) return v.val;
    return v;
}

/** `"2030-03-04T07:40:00+01:00"` → `"07:40"` — the school's local time, whatever the viewer's zone. */
export function hhmm(iso) {
    const m = /T(\d{2}:\d{2})/.exec(String(iso || ''));
    return m ? m[1] : '';
}

/** A short date in the site locale; `weekday` adds the day name. Dates are ISO dates (`2030-03-04`). */
export function formatDate(date, {weekday = true, year = false, locale = currentLocale()} = {}) {
    const d = String(date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    const opts = {day: 'numeric', month: 'numeric', timeZone: 'UTC'};
    if (weekday) opts.weekday = 'short';
    if (year) opts.year = 'numeric';
    try { return new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, opts); } catch { return d; }
}

/** The weekday name alone (`Mon`, `Mo`). */
export function weekdayName(date, locale = currentLocale()) {
    const d = String(date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    try { return new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, {weekday: 'short', timeZone: 'UTC'}); } catch { return d; }
}

/** The viewer's local date as an ISO date. */
export function localToday(now = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** `[1, 2]` → `"1–2"`, `[3]` → `"3"`, none → `""`. */
export function periodLabel(lesson) {
    const ps = Array.isArray(lesson?.periods) ? lesson.periods : (lesson?.period != null ? [lesson.period] : []);
    if (!ps.length) return '';
    return ps.length === 1 ? String(ps[0]) : `${ps[0]}–${ps[ps.length - 1]}`;
}

const list = v => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v])).map(String);

/** The last topic segment, the child's name when nothing else is given. */
export function childName(topic) {
    const parts = String(topic || '').split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}

/** `untis/status/mia` → `untis/status/school` — the school-wide items sit next to the children. */
export function schoolBase(childTopic) {
    const parts = String(childTopic || '').split('/').filter(Boolean);
    if (parts.length < 2) return '';
    parts[parts.length - 1] = 'school';
    return parts.join('/');
}

/**
 * The child list: the `subscribe` child first (named by `label`), then the
 * `children` entries ({topic, label} objects or plain topic strings), without
 * duplicates or empty topics.
 */
export function parseChildren(subscribe, label, childrenAttr) {
    const out = [];
    const add = (topic, name) => {
        topic = String(topic || '').trim().replace(/\/+$/, '');
        if (!topic || out.some(c => c.topic === topic)) return;
        out.push({topic, label: String(name || '').trim() || childName(topic)});
    };
    add(subscribe, label);
    let extra = childrenAttr;
    if (typeof extra === 'string') {
        try { extra = extra.trim() ? JSON.parse(extra) : []; } catch { extra = []; }
    }
    for (const c of Array.isArray(extra) ? extra : []) {
        if (typeof c === 'string') add(c, '');
        else if (c && typeof c === 'object') add(c.topic, c.label);
    }
    return out;
}

/**
 * The rows of a day: its lessons in start order, and — with the school's time
 * grid known — a `free` row for every period between two lessons that no
 * lesson covers.
 */
export function dayRows(lessons, timeGrid = []) {
    const sorted = (Array.isArray(lessons) ? lessons : []).slice()
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    if (!sorted.length || !Array.isArray(timeGrid) || !timeGrid.length) return sorted.map(lesson => ({lesson}));
    const covered = new Set(sorted.flatMap(l => l.periods || (l.period != null ? [l.period] : [])));
    const ps = [...covered].filter(Number.isFinite);
    const first = Math.min(...ps), last = Math.max(...ps);
    const rows = sorted.map(lesson => ({lesson, sort: lesson.period ?? Infinity, start: String(lesson.start)}));
    for (const g of timeGrid) {
        if (g.period > first && g.period < last && !covered.has(g.period)) {
            rows.push({free: g.period, sort: g.period, start: g.start, end: g.end});
        }
    }
    return rows.sort((a, b) => (a.sort - b.sort) || 0).map(({sort, ...r}) => r);
}

/**
 * A week as a grid: the period rows (from the time grid, else from the
 * lessons) and per day the cells, each lesson placed at its first period and
 * spanning its periods. Lessons in the same period share a cell.
 */
export function weekGrid(week, timeGrid = []) {
    const days = Array.isArray(week?.days) ? week.days : [];
    let periods = (Array.isArray(timeGrid) ? timeGrid : []).map(g => ({period: g.period, start: g.start, end: g.end}));
    if (!periods.length) {
        const seen = new Set(days.flatMap(d => (d.timetable || []).flatMap(l => l.periods || (l.period != null ? [l.period] : []))));
        periods = [...seen].filter(Number.isFinite).sort((a, b) => a - b).map(period => ({period, start: '', end: ''}));
    }
    const rowOf = new Map(periods.map((p, i) => [p.period, i]));
    return {
        periods,
        days: days.map(d => {
            const cells = new Map();
            for (const l of d.timetable || []) {
                const ps = l.periods?.length ? l.periods : (l.period != null ? [l.period] : []);
                const row = rowOf.get(ps[0]);
                if (row === undefined) continue;
                const span = Math.max(1, ps.filter(p => rowOf.has(p)).length);
                const cell = cells.get(row) || {row, span: 1, lessons: []};
                cell.span = Math.max(cell.span, span);
                cell.lessons.push(l);
                cells.set(row, cell);
            }
            return {date: d.date, holiday: d.holiday || null, school: d.school, cells: [...cells.values()].sort((a, b) => a.row - b.row)};
        }),
    };
}

/**
 * The rows a list shows. Homework: open only (not done, not overdue) unless
 * `showPast`; exams: upcoming only unless `showPast`; absences and messages:
 * all, newest first (as published). `max` > 0 cuts the list.
 */
export function listRows(kind, items, {showPast = false, today = localToday(), now = Date.now(), max = 0} = {}) {
    let rows = Array.isArray(items) ? items.slice() : [];
    if (kind === 'homework') {
        if (!showPast) rows = rows.filter(h => !h.completed && String(h.due) >= today);
        rows.sort((a, b) => String(a.due).localeCompare(String(b.due)));
    } else if (kind === 'exams') {
        if (!showPast) rows = rows.filter(e => !e.end || Date.parse(e.end) > now);
        rows.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    }
    return max > 0 ? rows.slice(0, max) : rows;
}

/** Position of `now` within a lesson, 0…1, or null outside it. */
export function lessonProgress(lesson, now = Date.now()) {
    const s = Date.parse(lesson?.start), e = Date.parse(lesson?.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || now < s || now > e) return null;
    return (now - s) / (e - s);
}

// ── preview data (editor canvas only, before the first message) ──────────────

const SAMPLE_DATE = '2030-03-04';
const at = (hm) => `${SAMPLE_DATE}T${hm}:00+01:00`;
const lesson = (p, from, to, subject, long, teacher, room, extra = {}) => ({
    date: SAMPLE_DATE, start: at(from), end: at(to), period: p[0], periods: p, subject, subject_long: long,
    teacher: [teacher], room: [room], class: ['5b'], group: [], status: 'regular', moved: false, changes: {},
    text: '', info: '', notes: '', homework: false, color: null, ...extra,
});
const SAMPLE_LESSONS = [
    lesson([1, 2], '08:00', '09:30', 'M', 'Mathematics', 'Abc', '101', {color: '#4a90d9'}),
    lesson([3], '09:50', '10:35', 'E', 'English', 'Def', '204', {status: 'changed', color: '#e8a33d',
        changes: {room: {from: ['102'], to: ['204']}}}),
    lesson([4], '10:40', '11:25', 'BIO', 'Biology', 'Ghi', '012', {status: 'cancelled', color: '#5bb974'}),
    lesson([5, 6], '11:45', '13:15', 'SP', 'Sports', 'Jkl', 'GYM', {color: '#b37ad6'}),
];
const SAMPLE = {
    timetable: SAMPLE_LESSONS,
    date: SAMPLE_DATE, school: true,
    start: at('08:00'), end: at('13:15'), start_planned: at('08:00'), end_planned: at('13:15'),
    now: SAMPLE_LESSONS[0], next_lesson: SAMPLE_LESSONS[1],
    week: {monday: SAMPLE_DATE, days: [0, 1, 2, 3, 4].map(i => ({
        date: `2030-03-0${4 + i}`, school: true, holiday: null,
        timetable: SAMPLE_LESSONS.map(l => ({...l, date: `2030-03-0${4 + i}`})),
    }))},
    homework: [{assigned: '2030-03-01', due: '2099-03-05', subject: 'M', teacher: ['Abc'], text: 'Workbook p. 12', remark: '', completed: false, attachments: 0}],
    exams: [{date: '2099-03-11', start: '2099-03-11T08:00:00+01:00', end: '2099-03-11T09:30:00+01:00', subject: 'E', type: 'Test', name: 'Vocabulary test', text: '', teacher: ['Def'], room: ['204']}],
    absences: [{date: '2030-02-10', start: '2030-02-10T08:00:00+01:00', end: '2030-02-10T13:15:00+01:00', reason: 'Illness', text: '', excused: true, excuse_status: 'excused'}],
    messages: [{sent: '2030-03-01T16:20:00+01:00', subject: 'Field trip', preview: 'Please hand in the consent form…', sender: 'Office', read: false, attachments: false}],
    time_grid: [[1, '08:00', '08:45'], [2, '08:45', '09:30'], [3, '09:50', '10:35'], [4, '10:40', '11:25'],
        [5, '11:45', '12:30'], [6, '12:30', '13:15']].map(([period, start, end]) => ({period, start, end})),
};

/** What the editor canvas shows for an item before any data arrived. */
export function untisSample(item) {
    const key = String(item).split('/').pop();
    if (item === 'week/next') return SAMPLE.week;
    return SAMPLE[key];
}

// ── the controller ────────────────────────────────────────────────────────────

const CHILD_EVENT = 'feezal-untis-child';

export class UntisController {
    /**
     * @param {import('lit').ReactiveControllerHost & HTMLElement} host
     * @param {{items?: string[] | ((host) => string[]), timeGrid?: boolean, tick?: number}} options
     *   items: the child's items the view reads (relative paths); timeGrid: also read the school's
     *   time grid; tick: re-render every `tick` ms (time-dependent views).
     */
    constructor(host, {items = [], timeGrid = false, tick = 0} = {}) {
        this.host = host;
        this.options = {items, timeGrid, tick};
        host.addController?.(this);
        this.data = new Map();
        this.timeGrid = [];
        this._activeTopic = '';
        this._onChild = e => {
            if (e.detail?.source === this) return;
            const i = this.children.findIndex(c => c.topic === e.detail?.topic);
            if (i >= 0 && this.children[i].topic !== this.child?.topic) this.select(i, {broadcast: false});
        };
    }

    _attr(name, fallback = '') {
        const v = this.host.getAttribute(name);
        return (v === null || v === '') ? fallback : v;
    }

    /** All configured children, the `subscribe` one first. */
    get children() {
        return parseChildren(this._attr('subscribe'), this._attr('label'), this._attr('children'));
    }

    /** The child shown now ({topic, label}) or null. */
    get child() {
        const all = this.children;
        return all.find(c => c.topic === this._activeTopic) || all[0] || null;
    }

    get items() {
        const i = this.options.items;
        return (typeof i === 'function' ? i(this.host) : i) || [];
    }

    signature() {
        return [this._attr('subscribe'), this._attr('children'), this._attr('label'), this._attr('message-property'),
            this.items.join(','), this._activeTopic].join('|');
    }

    hostConnected() {
        document.addEventListener(CHILD_EVENT, this._onChild);
        if (this.options.tick > 0) this._timer = setInterval(() => this.host.requestUpdate(), this.options.tick);
        this.wire();
    }

    hostDisconnected() {
        document.removeEventListener(CHILD_EVENT, this._onChild);
        clearInterval(this._timer);
        this._timer = null;
    }

    _value(msg) {
        return unwrap(this.host.getProperty(msg, this._attr('message-property', 'payload')));
    }

    wire() {
        const child = this.child;
        this._activeTopic = child?.topic || '';
        this.__sig = this.signature();
        this.data = new Map();
        this.timeGrid = [];
        if (!child) return;
        for (const item of this.items) {
            this.host.addSubscription(`${child.topic}/${item}`, msg => {
                this.data.set(item, this._value(msg));
                this.host.requestUpdate();
            });
        }
        const school = schoolBase(child.topic);
        if (this.options.timeGrid && school) {
            this.host.addSubscription(`${school}/time_grid`, msg => {
                const v = this._value(msg);
                this.timeGrid = Array.isArray(v) ? v : [];
                this.host.requestUpdate();
            });
        }
    }

    rewireIfChanged() {
        if (this.__sig !== undefined && this.signature() !== this.__sig) {
            this.host._unsubscribe();
            this.wire();
            this.host.requestUpdate();
        }
    }

    /** True once the item arrived for the active child. */
    has(item) { return this.data.has(item); }

    /** An item of the active child — on the editor canvas a preview until data arrives. */
    get(item) {
        if (this.data.has(item)) return this.data.get(item);
        return (typeof feezal !== 'undefined' && feezal.isEditor) ? untisSample(item) : undefined;
    }

    /** The time grid — on the editor canvas a preview until it arrives. */
    get grid() {
        if (this.timeGrid.length) return this.timeGrid;
        return (typeof feezal !== 'undefined' && feezal.isEditor) ? untisSample('time_grid') : [];
    }

    /**
     * Show another child. Every other untis element on the page that knows
     * the same child follows (`broadcast`). A view-only state change — nothing
     * is published, so it is allowed in the editor too.
     */
    select(index, {broadcast = true} = {}) {
        const c = this.children[index];
        if (!c) return;
        this._activeTopic = c.topic;
        this.host._unsubscribe();
        this.wire();
        this.host.requestUpdate();
        if (broadcast) document.dispatchEvent(new CustomEvent(CHILD_EVENT, {detail: {topic: c.topic, source: this}}));
    }
}

// ── view-neutral render helpers ───────────────────────────────────────────────

/** The child switcher (only with more than one child) or the child's name. */
export function untisChildSwitcher(c, {caption = ''} = {}) {
    const all = c.children;
    const active = c.child;
    if (all.length < 2) {
        const name = caption || active?.label || '';
        return name ? html`<span class="untis-child">${name}</span>` : '';
    }
    return html`<span class="untis-switcher" role="tablist">${all.map((ch, i) => html`
        <button role="tab" class="untis-chip ${ch.topic === active?.topic ? 'on' : ''}"
            aria-selected="${ch.topic === active?.topic}"
            @click="${() => c.select(i)}">${ch.label}</button>`)}</span>`;
}

/** A segmented tab row (days, weeks, lists). */
export function untisTabs(options, current, onPick) {
    return html`<span class="untis-tabs" role="tablist">${options.map(o => html`
        <button role="tab" class="untis-tab ${o.value === current ? 'on' : ''}" aria-selected="${o.value === current}"
            @click="${() => onPick(o.value)}">${o.label}</button>`)}</span>`;
}

/** The status classes of a lesson: regular | changed | cancelled | additional | exam | event, plus moved. */
export function lessonClass(l) {
    return `lesson ${l?.status || 'regular'}${l?.moved ? ' moved' : ''}`;
}

/** A changed field: the new value, the old one struck through before it. */
function changed(field, l) {
    const now = list(l[field]).join(', ');
    const ch = l.changes?.[field];
    if (!ch) return now;
    return html`<s class="was">${list(ch.from).join(', ')}</s> <span class="is">${list(ch.to).join(', ') || '–'}</span>`;
}

/** The subject, teacher and room of a lesson, changes marked. */
export function lessonParts(l) {
    return {
        subject: l.changes?.subject ? changed('subject', l) : (l.subject || l.subject_long || ''),
        teacher: changed('teacher', l),
        room: changed('room', l),
    };
}

/** The status word for a lesson that is not regular, or ''. */
export function lessonBadge(l) {
    if (!l) return '';
    if (l.status === 'cancelled') return untisText('cancelled');
    if (l.status === 'additional') return untisText('additional');
    if (l.status === 'exam') return untisText('exam');
    if (l.status === 'event') return untisText('event');
    if (l.moved) return untisText('moved');
    return '';
}

/**
 * Shared structure styles for the untis views. The colours run through
 * `--_untis-accent` (active chip/tab, the running lesson), `--_untis-change`
 * (changed lessons), `--_untis-cancel` (cancelled), `--_untis-muted`
 * (secondary text) and `--_untis-line` (separators); a family overrides them
 * on its own container. The two state colours are themable per element.
 */
export const untisStyles = css`
    :host {
        --feezal-untis-change-color: var(--warning-color);
        --feezal-untis-cancel-color: var(--error-color);
        --_untis-accent: var(--primary-color);
        --_untis-change: var(--feezal-untis-change-color);
        --_untis-cancel: var(--feezal-untis-cancel-color);
        --_untis-muted: color-mix(in srgb, currentColor 60%, transparent);
        --_untis-line: color-mix(in srgb, currentColor 22%, transparent);
    }
    .untis-head { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
    .untis-child { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .untis-switcher, .untis-tabs { display: inline-flex; gap: 3px; flex-wrap: wrap; }
    .untis-chip, .untis-tab {
        font: inherit; font-size: 0.85em; font-weight: 600; cursor: pointer; padding: 2px 8px;
        border-radius: 999px; border: 1px solid var(--_untis-line); background: transparent; color: inherit;
    }
    .untis-chip.on, .untis-tab.on { background: var(--_untis-accent); border-color: var(--_untis-accent); color: var(--primary-background-color); }
    .lesson.cancelled .subj, .lesson.cancelled .meta { text-decoration: line-through; opacity: 0.6; }
    .lesson.changed .subj, .lesson.additional .subj, .lesson.moved .subj { color: var(--_untis-change); }
    .lesson .is { color: var(--_untis-change); font-weight: 600; }
    .lesson .was { opacity: 0.6; }
    .lesson .badge {
        font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--_untis-change);
    }
    .lesson.cancelled .badge { color: var(--_untis-cancel); }
    .swatch { width: 4px; align-self: stretch; border-radius: 2px; background: var(--_untis-line); flex: none; }
    .muted { color: var(--_untis-muted); }
    .untis-empty { color: var(--_untis-muted); text-align: center; margin: auto; }
`;
