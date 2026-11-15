/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {
    UntisController, untisAttributes, untisDiscoveryMap, untisStyles, untisChildSwitcher, untisTabs, untisText,
    UNTIS_DAYS, dayRows, formatDate, hhmm, periodLabel, lessonClass, lessonParts, lessonBadge,
} from '@feezal/feezal-controller-untis';

/**
 * feezal-element-glass-untis-day (E191)
 *
 * Frosted-glass day card for untis2mqtt: the lessons of today, tomorrow or
 * the next school day in period order, each in its subject colour, cancelled
 * lessons struck through, changed teacher/room/subject marked old → new, free
 * periods between lessons shown when the school's time grid is known. Tabs
 * switch the day, the chips the child. All behaviour lives in
 * @feezal/feezal-controller-untis; this is the glass view.
 */

const DAY_SIZES = {'2x4': [172, 354], '4x4': [354, 354], '4x6': [354, 536]};
const ITEMS = UNTIS_DAYS.flatMap(d => [`${d}/timetable`, `${d}/date`]);

class FeezalElementGlassUntisDay extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Untis day', category: 'Glass', color: '#7aa5c9', icon: 'today'},
            description: 'Frosted-glass school day from untis2mqtt: the lessons of today, tomorrow or the next school day ' +
                'with subject colours, cancelled lessons struck through, changed teachers and rooms marked. Tabs switch ' +
                'the day; with several children a switcher appears. Auto-wired by the untis2mqtt discovery.',
            discovery: {component: 'untis', map: untisDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x4', '4x4', '4x6'], default: '',
                    help: 'Preset size: 2x4 = narrow column, 4x4 = square, 4x6 = tall. Empty keeps the current/manual size.'},
                ...untisAttributes,
                {name: 'day', type: 'select', options: UNTIS_DAYS, default: 'today',
                    help: 'The day shown first: today, tomorrow or the next school day (skips weekends and holidays).'},
                {name: 'show-tabs', type: 'boolean', default: true, help: 'Show the day tabs (today / tomorrow / next).'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Active tab and child chip.'},
                {property: '--feezal-untis-change-color', type: 'color', default: 'var(--warning-color)', help: 'Changed lessons (teacher, room, extra, moved).'},
                {property: '--feezal-untis-cancel-color', type: 'color', default: 'var(--error-color)', help: 'Cancelled lessons.'},
            ],
            defaultStyle: {width: '354px', height: '354px'},
            restrict: {minWidth: 160, minHeight: 120},
        };
    }

    static properties = {
        size:     {type: String, reflect: true},
        label:    {type: String, reflect: true},
        childList: {type: String, attribute: 'children'},
        day:      {type: String, reflect: true},
        showTabs: {type: Boolean, converter: feezalBoolean, attribute: 'show-tabs'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:  {type: Boolean, reflect: true},
        _day:     {state: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, untisStyles, css`
        .card { --_untis-accent: var(--feezal-glass-accent, var(--primary-color)); }
        .card { justify-content: flex-start; align-items: stretch; text-align: left; gap: 6px; padding: 10px 12px; font-size: 13px; }
        .date { font-size: 12px; font-weight: 600; }
        .rows { display: flex; flex-direction: column; gap: 4px; overflow: auto; min-height: 0; flex: 1; }
        .lesson { display: flex; gap: 8px; align-items: center; min-width: 0; }
        .period { width: 2.4em; flex: none; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
        .time { width: 3em; flex: none; font-size: 11px; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .body { flex: 1; min-width: 0; }
        .subj { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .meta { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .text { font-size: 11px; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .free { font-size: 11px; padding-left: calc(2.4em + 8px); }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.childList = '';
        this.day = 'today';
        this.showTabs = true;
        this.discoveryId = '';
        this.degrade = false;
        this._day = '';
        this.untis = new UntisController(this, {items: ITEMS, timeGrid: true});
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — UntisController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, DAY_SIZES);
        if (changed.has('day')) this._day = '';
        this.untis.rewireIfChanged();
    }

    get _shownDay() {
        const d = this._day || this.day;
        return UNTIS_DAYS.includes(d) ? d : 'today';
    }

    _row(r) {
        if (r.free !== undefined) {
            return html`<div class="free muted">${r.free} · ${r.start}–${r.end} · ${untisText('free')}</div>`;
        }
        const l = r.lesson;
        const p = lessonParts(l);
        const badge = lessonBadge(l);
        return html`<div class="${lessonClass(l)}">
            <span class="period">${periodLabel(l)}</span>
            <span class="swatch" style="${l.color ? `background:${l.color}` : ''}"></span>
            <span class="time muted">${hhmm(l.start)}<br>${hhmm(l.end)}</span>
            <span class="body">
                <div class="subj" title="${l.subject_long || ''}">${p.subject} ${badge ? html`<span class="badge">${badge}</span>` : ''}</div>
                <div class="meta muted">${p.teacher}${l.room?.length || l.changes?.room ? html` · ${p.room}` : ''}</div>
                ${l.text || l.info ? html`<div class="text muted">${l.text || l.info}</div>` : ''}
            </span>
        </div>`;
    }

    render() {
        const c = this.untis;
        const day = this._shownDay;
        const lessons = c.get(`${day}/timetable`);
        const date = c.get(`${day}/date`);
        const rows = dayRows(lessons, c.grid);
        return html`
            <div class="card">
                <div class="untis-head">${untisChildSwitcher(c)}
                    ${this.showTabs ? untisTabs(UNTIS_DAYS.map(d => ({value: d, label: untisText(d)})), day, d => { this._day = d; }) : ''}
                </div>
                <div class="date">${this.showTabs ? '' : html`${untisText(day)} · `}${formatDate(date)}</div>
                <div class="rows">
                    ${lessons === undefined ? html`<div class="untis-empty">${untisText('waiting')}</div>`
                        : rows.length ? rows.map(r => this._row(r))
                            : html`<div class="untis-empty">${untisText('no_school')}</div>`}
                </div>
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-untis-day', FeezalElementGlassUntisDay);
export {FeezalElementGlassUntisDay};
