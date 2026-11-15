/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {
    UntisController, untisAttributes, untisDiscoveryMap, untisStyles, untisChildSwitcher, untisTabs, untisText,
    UNTIS_WEEKS, weekGrid, formatDate, weekdayName, localToday, lessonClass, lessonParts,
} from '@feezal/feezal-controller-untis';

/**
 * feezal-element-glass-untis-week (E191)
 *
 * Frosted-glass week grid for untis2mqtt: Monday to Friday (Saturday and
 * Sunday when they have lessons) as columns, the school's periods as rows,
 * every lesson in its subject colour spanning its periods; cancelled lessons
 * struck through, changes marked, holidays named. This week is the week of
 * the next school day (after Friday's last lesson the following one), next
 * week the one after — as untis2mqtt publishes them. All behaviour lives in
 * @feezal/feezal-controller-untis; this is the glass view.
 */

const WEEK_SIZES = {'4x4': [354, 354], '6x4': [536, 354], '8x6': [718, 536]};
const topicOf = w => (w === 'next' ? 'week/next' : 'week');

class FeezalElementGlassUntisWeek extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Untis week', category: 'Glass', color: '#7aa5c9', icon: 'calendar_view_week'},
            description: 'Frosted-glass week timetable from untis2mqtt: days as columns, periods as rows, lessons in ' +
                'their subject colours, cancellations and changes marked, holidays named. Tabs switch between this and ' +
                'next week; with several children a switcher appears.',
            discovery: {component: 'untis', map: untisDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x4', '6x4', '8x6'], default: '',
                    help: 'Preset size: 4x4 = square, 6x4 = wide, 8x6 = large. Empty keeps the current/manual size.'},
                ...untisAttributes,
                {name: 'week', type: 'select', options: UNTIS_WEEKS, default: 'this',
                    help: 'The week shown first: this = the week of the next school day, next = the week after.'},
                {name: 'show-tabs', type: 'boolean', default: true, help: 'Show the week tabs (this / next).'},
                {name: 'show-times', type: 'boolean', default: true, help: 'Show the period times next to the period numbers.'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Active tab, child chip and today\'s column.'},
                {property: '--feezal-untis-change-color', type: 'color', default: 'var(--warning-color)', help: 'Changed lessons (teacher, room, extra, moved).'},
                {property: '--feezal-untis-cancel-color', type: 'color', default: 'var(--error-color)', help: 'Cancelled lessons.'},
            ],
            defaultStyle: {width: '536px', height: '354px'},
            restrict: {minWidth: 240, minHeight: 160},
        };
    }

    static properties = {
        size:      {type: String, reflect: true},
        label:     {type: String, reflect: true},
        childList: {type: String, attribute: 'children'},
        week:      {type: String, reflect: true},
        showTabs:  {type: Boolean, converter: feezalBoolean, attribute: 'show-tabs'},
        showTimes: {type: Boolean, converter: feezalBoolean, attribute: 'show-times'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:   {type: Boolean, reflect: true},
        _week:     {state: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, untisStyles, css`
        .card { --_untis-accent: var(--feezal-glass-accent, var(--primary-color)); }
        .card { justify-content: flex-start; align-items: stretch; text-align: left; gap: 6px; padding: 10px 12px; font-size: 12px; }
        .range { font-size: 12px; font-weight: 600; }
        .grid {
            flex: 1; min-height: 0; overflow: auto; display: grid; gap: 2px;
            grid-auto-rows: minmax(1.9em, auto);
        }
        .dayhead { text-align: center; font-weight: 700; font-size: 11px; padding-bottom: 2px; border-bottom: 2px solid transparent; }
        .dayhead.today { border-bottom-color: var(--_untis-accent); color: var(--_untis-accent); }
        .ph { font-weight: 700; text-align: right; padding-right: 4px; font-variant-numeric: tabular-nums; line-height: 1.1; }
        .ph small { display: block; font-weight: 400; font-size: 9px; }
        .cell { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .lesson {
            flex: 1; min-width: 0; border-radius: 5px; padding: 1px 4px; overflow: hidden;
            border-left: 4px solid var(--_untis-line); background: color-mix(in srgb, currentColor 7%, transparent);
        }
        .lesson .subj { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lesson .meta { font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lesson.changed, .lesson.additional, .lesson.moved { box-shadow: inset 0 0 0 1px var(--_untis-change); }
        .holiday {
            display: flex; align-items: center; justify-content: center; text-align: center; padding: 4px;
            writing-mode: vertical-rl; transform: rotate(180deg); border-radius: 5px;
            background: color-mix(in srgb, currentColor 7%, transparent);
        }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.childList = '';
        this.week = 'this';
        this.showTabs = true;
        this.showTimes = true;
        this.discoveryId = '';
        this.degrade = false;
        this._week = '';
        this.untis = new UntisController(this, {items: ['week', 'week/next'], timeGrid: true});
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — UntisController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, WEEK_SIZES);
        if (changed.has('week')) this._week = '';
        this.untis.rewireIfChanged();
    }

    get _shownWeek() {
        const w = this._week || this.week;
        return UNTIS_WEEKS.includes(w) ? w : 'this';
    }

    _lesson(l) {
        const p = lessonParts(l);
        return html`<div class="${lessonClass(l)}" style="${l.color ? `border-left-color:${l.color}` : ''}"
            title="${[l.subject_long, l.text, l.info].filter(Boolean).join(' · ')}">
            <div class="subj">${p.subject}</div>
            <div class="meta muted">${p.room}</div>
        </div>`;
    }

    _grid(week) {
        const g = weekGrid(week, this.untis.grid);
        if (!g.days.length) return html`<div class="untis-empty">${untisText('no_school')}</div>`;
        const today = localToday();
        const head = 1;   // row 1 = day names
        return html`<div class="grid" style="grid-template-columns: auto repeat(${g.days.length}, minmax(0, 1fr));">
            ${g.days.map((d, i) => html`<div class="dayhead ${d.date === today ? 'today' : ''}"
                style="grid-row:1;grid-column:${i + 2}">${weekdayName(d.date)} ${formatDate(d.date, {weekday: false})}</div>`)}
            ${g.periods.map((p, r) => html`<div class="ph muted" style="grid-row:${r + 1 + head};grid-column:1">${p.period}${
                this.showTimes && p.start ? html`<small>${p.start}</small>` : ''}</div>`)}
            ${g.days.map((d, i) => d.holiday && !d.cells.length
                ? html`<div class="holiday muted" style="grid-row:${1 + head} / span ${Math.max(1, g.periods.length)};grid-column:${i + 2}">${d.holiday}</div>`
                : d.cells.map(c => html`<div class="cell" style="grid-row:${c.row + 1 + head} / span ${c.span};grid-column:${i + 2}">
                    ${c.lessons.map(l => this._lesson(l))}</div>`))}
        </div>`;
    }

    render() {
        const c = this.untis;
        const which = this._shownWeek;
        const week = c.get(topicOf(which));
        const days = week?.days || [];
        const range = days.length ? `${formatDate(days[0].date, {weekday: false})} – ${formatDate(days[days.length - 1].date, {weekday: false})}` : '';
        return html`
            <div class="card">
                <div class="untis-head">${untisChildSwitcher(c)}
                    ${this.showTabs ? untisTabs(UNTIS_WEEKS.map(w => ({value: w, label: untisText(`${w}_week`)})), which, w => { this._week = w; }) : ''}
                    <span class="range muted">${range}</span>
                </div>
                ${week === undefined ? html`<div class="untis-empty">${untisText('waiting')}</div>` : this._grid(week)}
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-untis-week', FeezalElementGlassUntisWeek);
export {FeezalElementGlassUntisWeek};
