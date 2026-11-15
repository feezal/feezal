/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {
    UntisController, untisAttributes, untisDiscoveryMap, untisStyles, untisChildSwitcher, untisText,
    UNTIS_DAYS, formatDate, hhmm,
} from '@feezal/feezal-controller-untis';

/**
 * feezal-element-glass-untis-hours (E191)
 *
 * Frosted-glass school hours for untis2mqtt: when the first lesson that takes
 * place starts and the last one ends — today, tomorrow or on the next school
 * day. When the regular timetable says otherwise (a cancelled first or last
 * lesson) the planned time is shown struck through next to it. Pointed at
 * `untis/status/all` it shows the household's earliest start and latest end.
 * All behaviour lives in @feezal/feezal-controller-untis; this is the glass view.
 */

const HOURS_SIZES = {'2x1': [172, 64], '2x2': [172, 128], '4x1': [354, 64]};
const FIELDS = ['date', 'school', 'start', 'end', 'start_planned', 'end_planned'];

class FeezalElementGlassUntisHours extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Untis hours', category: 'Glass', color: '#7aa5c9', icon: 'alarm'},
            description: 'Frosted-glass school hours from untis2mqtt: the start of the first and the end of the last lesson ' +
                'today, tomorrow or on the next school day, with the planned times when a lesson was cancelled. Set the ' +
                'topic to untis/status/all for the whole household.',
            discovery: {component: 'untis', map: untisDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x1', '2x2', '4x1'], default: '',
                    help: 'Preset size: 2x1 = small, 2x2 = square, 4x1 = wide strip. Empty keeps the current/manual size.'},
                ...untisAttributes,
                {name: 'day', type: 'select', options: UNTIS_DAYS, default: 'next',
                    help: 'Which day: today, tomorrow, or the next school day (moves on after the last lesson, skips weekends and holidays).'},
                {name: 'show-planned', type: 'boolean', default: true,
                    help: 'Show the regular time struck through when the first or last lesson was cancelled or moved.'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Child chip.'},
                {property: '--feezal-untis-change-color', type: 'color', default: 'var(--warning-color)', help: 'A time that differs from the timetable.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
            restrict: {minWidth: 120, minHeight: 56},
        };
    }

    static properties = {
        size:        {type: String, reflect: true},
        label:       {type: String, reflect: true},
        childList:   {type: String, attribute: 'children'},
        day:         {type: String, reflect: true},
        showPlanned: {type: Boolean, converter: feezalBoolean, attribute: 'show-planned'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:     {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, untisStyles, css`
        .card { --_untis-accent: var(--feezal-glass-accent, var(--primary-color)); }
        .card { justify-content: center; align-items: stretch; text-align: left; gap: 2px; padding: 8px 12px; font-size: 12px; container-type: inline-size; }
        .day { font-size: 11px; font-weight: 600; }
        .hours { font-size: clamp(16px, 16cqi, 30px); font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; white-space: nowrap; }
        .hours .changed { color: var(--_untis-change); }
        .planned { font-size: 11px; white-space: nowrap; }
        .planned s { opacity: 0.8; }
        .off { font-size: clamp(14px, 11cqi, 22px); font-weight: 700; }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.childList = '';
        this.day = 'next';
        this.showPlanned = true;
        this.discoveryId = '';
        this.degrade = false;
        this.untis = new UntisController(this, {items: host => {
            const d = UNTIS_DAYS.includes(host.day) ? host.day : 'next';
            return FIELDS.map(f => `${d}/${f}`);
        }});
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — UntisController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, HOURS_SIZES);
        this.untis.rewireIfChanged();
    }

    render() {
        const c = this.untis;
        const d = UNTIS_DAYS.includes(this.day) ? this.day : 'next';
        const v = f => c.get(`${d}/${f}`);
        const start = v('start'), end = v('end');
        const sp = v('start_planned'), ep = v('end_planned');
        const startMoved = Boolean(start && sp && hhmm(start) !== hhmm(sp));
        const endMoved = Boolean(end && ep && hhmm(end) !== hhmm(ep));
        const waiting = start === undefined && v('school') === undefined;
        const off = !waiting && (!start || v('school') === false);
        return html`
            <div class="card">
                <div class="untis-head">${untisChildSwitcher(c)}</div>
                <div class="day muted">${untisText(d)}${v('date') ? ` · ${formatDate(v('date'))}` : ''}</div>
                ${waiting ? html`<div class="untis-empty">${untisText('waiting')}</div>`
                    : off ? html`<div class="off">${untisText('no_school')}</div>`
                        : html`<div class="hours">
                            <span class="${startMoved ? 'changed' : ''}">${hhmm(start)}</span>–<span class="${endMoved ? 'changed' : ''}">${hhmm(end)}</span>
                        </div>
                        ${this.showPlanned && (startMoved || endMoved) ? html`<div class="planned muted">${untisText('planned')}
                            <s>${hhmm(sp)}–${hhmm(ep)}</s></div>` : ''}`}
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-untis-hours', FeezalElementGlassUntisHours);
export {FeezalElementGlassUntisHours};
