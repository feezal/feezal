/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';
import {applySizePreset, glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {availabilityAttributes} from '@feezal/feezal-element/feezal-discovery-fragments.js';
import {
    UntisController, untisAttributes, untisDiscoveryMap, untisStyles, untisChildSwitcher, untisText,
    formatDate, hhmm, localToday, lessonClass, lessonParts, lessonBadge, lessonProgress,
} from '@feezal/feezal-controller-untis';

/**
 * feezal-element-glass-untis-now (E191)
 *
 * Frosted-glass now/next badge for untis2mqtt: the lesson taking place now
 * (subject, room, teacher, until when, a progress bar) and the next one (with
 * its date when it is not today). Changes and extra lessons are marked like in
 * the day card. untis2mqtt only names lessons that take place, so a cancelled
 * lesson never shows here. All behaviour lives in
 * @feezal/feezal-controller-untis; this is the glass view.
 */

const NOW_SIZES = {'2x2': [172, 172], '4x2': [354, 172]};

class FeezalElementGlassUntisNow extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Untis now', category: 'Glass', color: '#7aa5c9', icon: 'schedule'},
            description: 'Frosted-glass badge from untis2mqtt: the lesson now (room, teacher, until when, progress) and the ' +
                'next one. With several children a switcher appears.',
            discovery: {component: 'untis', map: untisDiscoveryMap},
            attributes: [
                {name: 'size', type: 'select', options: ['', '2x2', '4x2'], default: '',
                    help: 'Preset size: 2x2 = square, 4x2 = wide. Empty keeps the current/manual size.'},
                ...untisAttributes,
                {name: 'show-next', type: 'boolean', default: true, help: 'Show the next lesson below the current one.'},
                ...availabilityAttributes(),
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-accent', type: 'color', default: 'var(--primary-color)', help: 'Progress bar and child chip.'},
                {property: '--feezal-untis-change-color', type: 'color', default: 'var(--warning-color)', help: 'Changed lessons (teacher, room, extra, moved).'},
            ],
            defaultStyle: {width: '354px', height: '172px'},
            restrict: {minWidth: 140, minHeight: 96},
        };
    }

    static properties = {
        size:      {type: String, reflect: true},
        label:     {type: String, reflect: true},
        childList: {type: String, attribute: 'children'},
        showNext:  {type: Boolean, converter: feezalBoolean, attribute: 'show-next'},
        discoveryId: {type: String, reflect: true, attribute: 'discovery-id'},
        degrade:   {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, untisStyles, css`
        .card { --_untis-accent: var(--feezal-glass-accent, var(--primary-color)); }
        .card { justify-content: flex-start; align-items: stretch; text-align: left; gap: 4px; padding: 10px 12px; font-size: 13px; }
        .slot { display: flex; gap: 8px; align-items: stretch; min-width: 0; }
        .slot .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .subj { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .now .subj { font-size: 22px; line-height: 1.1; }
        .meta { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar { height: 4px; border-radius: 2px; background: var(--_untis-line); overflow: hidden; margin-top: 2px; }
        .bar .fill { height: 100%; background: var(--_untis-accent); }
        .swatch { width: 5px; }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.childList = '';
        this.showNext = true;
        this.discoveryId = '';
        this.degrade = false;
        // the progress bar follows the clock; untis2mqtt republishes `now` only when it changes
        this.untis = new UntisController(this, {items: ['now', 'next_lesson'], tick: 30000});
    }

    // The controller owns the subscriptions; suppress the base class path.
    _subscribe() { /* intentionally empty — UntisController.wire() */ }

    updated(changed) {
        super.updated?.(changed);
        if (changed.has('size')) applySizePreset(this, NOW_SIZES);
        this.untis.rewireIfChanged();
    }

    _slot(l, kind) {
        const p = lessonParts(l);
        const badge = lessonBadge(l);
        const progress = kind === 'now' ? lessonProgress(l) : null;
        const date = String(l.date || l.start || '').slice(0, 10);
        const when = kind === 'now'
            ? `${untisText('until')} ${hhmm(l.end)}`
            : `${date && date !== localToday() ? `${formatDate(date)} ` : ''}${hhmm(l.start)}–${hhmm(l.end)}`;
        return html`<div class="slot ${kind} ${lessonClass(l)}">
            <span class="swatch" style="${l.color ? `background:${l.color}` : ''}"></span>
            <span class="body">
                <span class="tag muted">${untisText(kind === 'now' ? 'now' : 'after')} · ${when}</span>
                <span class="subj" title="${l.subject_long || ''}">${p.subject} ${badge ? html`<span class="badge">${badge}</span>` : ''}</span>
                <span class="meta muted">${p.room}${l.teacher?.length || l.changes?.teacher ? html` · ${p.teacher}` : ''}</span>
                ${progress !== null ? html`<span class="bar"><span class="fill" style="width:${Math.round(progress * 100)}%; display:block"></span></span>` : ''}
            </span>
        </div>`;
    }

    render() {
        const c = this.untis;
        const now = c.get('now');
        const next = c.get('next_lesson');
        const waiting = now === undefined && next === undefined;
        return html`
            <div class="card">
                <div class="untis-head">${untisChildSwitcher(c)}</div>
                ${waiting ? html`<div class="untis-empty">${untisText('waiting')}</div>` : html`
                    ${now ? this._slot(now, 'now') : ''}
                    ${next && (this.showNext || !now) ? this._slot(next, 'next') : ''}
                    ${!now && !next ? html`<div class="untis-empty">${untisText('no_lessons')}</div>` : ''}`}
                ${glassBadgeTray({unavailable: !this._available})}
            </div>`;
    }
}

customElements.define('feezal-element-glass-untis-now', FeezalElementGlassUntisNow);
export {FeezalElementGlassUntisNow};
