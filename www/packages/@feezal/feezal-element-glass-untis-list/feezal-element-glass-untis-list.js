/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {
    UntisController, untisAttributes, untisDiscoveryMap, untisStyles, untisChildSwitcher, untisText,
    UNTIS_LISTS, listRows, formatDate, hhmm,
} from '@feezal/feezal-controller-untis';

/**
 * feezal-element-glass-untis-list (E191)
 *
 * Frosted-glass list card for untis2mqtt — homework, exams, absences or the
 * WebUntis inbox, which one is the `list` attribute. Homework shows what is
 * still to do and exams what is still to come, unless `show-past`. A school
 * that does not let parents see a list leaves its topic out; the card then
 * keeps waiting. All behaviour lives in @feezal/feezal-controller-untis; this
 * is the glass view.
 */

const LIST_SIZES = {'4x2': [354, 172], '4x4': [354, 354], '2x4': [172, 354]};
const ICONS = {homework: 'menu_book', exams: 'quiz', absences: 'event_busy', messages: 'mail'};
const join = v => (Array.isArray(v) ? v.join(', ') : (v || ''));

class FeezalElementGlassUntisList extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Untis list', category: 'Glass', color: '#7aa5c9', icon: 'checklist'},
            description: 'Frosted-glass list from untis2mqtt: homework (open by default), exams (upcoming by default), ' +
                'absences or the WebUntis messages — chosen by the list attribute. With several children a switcher appears.',
            discovery: {component: 'untis', map: untisDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '4x2', '4x4', '2x4'], default: '',
                    help: 'Preset size: 4x2 = wide, 4x4 = square, 2x4 = narrow column. Empty keeps the current/manual size.'},
                ...untisAttributes,
                {name: 'list', type: 'select', options: UNTIS_LISTS, default: 'homework',
                    help: 'What the card lists: homework, exams, absences or messages (the WebUntis inbox, previews only).'},
                {name: 'show-past', type: 'boolean', default: false,
                    help: 'Homework: also done and overdue ones. Exams: also past ones. No effect on absences and messages.'},
                {name: 'max-items', type: 'number', default: 0, min: 0, help: 'Show at most this many entries (0 = all).'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Child chip, count and unread marks.'},
                {property: '--feezal-untis-change-color', type: 'color', default: 'var(--warning-color)', help: 'Homework due tomorrow, unexcused absences.'},
                {property: '--feezal-untis-cancel-color', type: 'color', default: 'var(--error-color)', help: 'Overdue homework.'},
            ],
            defaultStyle: {width: '354px', height: '354px'},
            restrict: {minWidth: 160, minHeight: 96},
        };
    }

    static properties = {
        size:      {type: String, reflect: true},
        label:     {type: String, reflect: true},
        childList: {type: String, attribute: 'children'},
        list:      {type: String, reflect: true},
        showPast:  {type: Boolean, reflect: true, attribute: 'show-past'},
        maxItems:  {type: Number, attribute: 'max-items'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:   {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, untisStyles, css`
        .card { --_untis-accent: var(--feezal-glass-accent, var(--primary-color)); }
        .card { justify-content: flex-start; align-items: stretch; text-align: left; gap: 6px; padding: 10px 12px; font-size: 13px; }
        .title { display: flex; align-items: center; gap: 6px; font-weight: 700; }
        .title feezal-icon { font-size: 18px; color: var(--_untis-accent); }
        .count { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--_untis-accent); }
        .rows { display: flex; flex-direction: column; gap: 6px; overflow: auto; min-height: 0; flex: 1; }
        .row { display: flex; flex-direction: column; gap: 1px; padding-bottom: 5px; border-bottom: 1px solid var(--_untis-line); min-width: 0; }
        .row:last-child { border-bottom: none; }
        .line1 { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
        .line1 .what { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .line1 .when { font-size: 11px; flex: none; font-variant-numeric: tabular-nums; }
        .text { font-size: 12px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .row.done { opacity: 0.55; }
        .row.done .what { text-decoration: line-through; }
        .row.soon .when, .row.unexcused .when { color: var(--_untis-change); font-weight: 700; }
        .row.overdue .when { color: var(--_untis-cancel); font-weight: 700; }
        .row.unread .what::before { content: '●'; color: var(--_untis-accent); margin-right: 4px; }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.childList = '';
        this.list = 'homework';
        this.showPast = false;
        this.maxItems = 0;
        this.discoveryId = '';
        this.degrade = false;
        this.untis = new UntisController(this, {items: host => [UNTIS_LISTS.includes(host.list) ? host.list : 'homework']});
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — UntisController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, LIST_SIZES);
        this.untis.rewireIfChanged();
    }

    get _kind() { return UNTIS_LISTS.includes(this.list) ? this.list : 'homework'; }

    _homework(h, today, tomorrow) {
        const state = h.completed ? 'done' : (h.due < today ? 'overdue' : (h.due <= tomorrow ? 'soon' : ''));
        return html`<div class="row ${state}">
            <div class="line1"><span class="what">${h.subject}</span>
                <span class="when muted">${untisText('due')} ${formatDate(h.due)}</span></div>
            ${h.text ? html`<div class="text">${h.text}</div>` : ''}
            ${h.remark ? html`<div class="text muted">${h.remark}</div>` : ''}
        </div>`;
    }

    _exam(e) {
        return html`<div class="row">
            <div class="line1"><span class="what">${[e.subject, e.name || e.type].filter(Boolean).join(' · ')}</span>
                <span class="when muted">${formatDate(e.date || e.start)} ${hhmm(e.start)}</span></div>
            ${e.text || join(e.room) ? html`<div class="text muted">${[e.text, join(e.room)].filter(Boolean).join(' · ')}</div>` : ''}
        </div>`;
    }

    _absence(a) {
        return html`<div class="row ${a.excused ? '' : 'unexcused'}">
            <div class="line1"><span class="what">${a.reason || formatDate(a.date)}</span>
                <span class="when muted">${formatDate(a.date)} ${hhmm(a.start)}–${hhmm(a.end)}</span></div>
            <div class="text muted">${a.excused ? untisText('excused') : untisText('unexcused')}${a.text ? ` · ${a.text}` : ''}</div>
        </div>`;
    }

    _message(m) {
        return html`<div class="row ${m.read ? '' : 'unread'}">
            <div class="line1"><span class="what">${m.subject}</span>
                <span class="when muted">${formatDate(m.sent)}</span></div>
            <div class="text muted">${[m.sender, m.preview].filter(Boolean).join(' — ')}</div>
        </div>`;
    }

    render() {
        const c = this.untis;
        const kind = this._kind;
        const items = c.get(kind);
        const now = new Date();
        const p = n => String(n).padStart(2, '0');
        const iso = d => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        const today = iso(now);
        const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
        const rows = listRows(kind, items, {showPast: this.showPast, today, now: now.getTime(), max: Number(this.maxItems) || 0});
        const all = listRows(kind, items, {showPast: this.showPast, today, now: now.getTime()});
        const count = kind === 'messages' ? (Array.isArray(items) ? items.filter(m => !m.read).length : 0) : all.length;
        const row = {homework: h => this._homework(h, today, tomorrow), exams: e => this._exam(e),
            absences: a => this._absence(a), messages: m => this._message(m)}[kind];
        return html`
            <div class="card">
                <div class="untis-head">${untisChildSwitcher(c)}</div>
                <div class="title"><feezal-icon name="${ICONS[kind]}"></feezal-icon>${untisText(kind)}
                    ${items !== undefined && count ? html`<span class="count">${count}</span>` : ''}</div>
                <div class="rows">
                    ${items === undefined ? html`<div class="untis-empty">${untisText('waiting')}</div>`
                        : rows.length ? rows.map(row) : html`<div class="untis-empty">${untisText('nothing')}</div>`}
                </div>
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-untis-list', FeezalElementGlassUntisList);
export {FeezalElementGlassUntisList};
