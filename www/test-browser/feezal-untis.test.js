/**
 * E191 — the untis elements (glass) over @feezal/feezal-controller-untis,
 * fed with fixture payloads in untis2mqtt's shapes ({"val", "ts", "lc"}
 * envelopes, lesson objects, the week object, the lists). Children, teachers,
 * rooms and the school are invented.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-untis-day/feezal-element-glass-untis-day.js';
import '../packages/@feezal/feezal-element-glass-untis-week/feezal-element-glass-untis-week.js';
import '../packages/@feezal/feezal-element-glass-untis-list/feezal-element-glass-untis-list.js';
import '../packages/@feezal/feezal-element-glass-untis-now/feezal-element-glass-untis-now.js';
import '../packages/@feezal/feezal-element-glass-untis-hours/feezal-element-glass-untis-hours.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal({locale: 'en'}); });

const env = val => ({val, ts: 1, lc: 1});
const D = '2030-03-04';
const at = (hm, d = D) => `${d}T${hm}:00+01:00`;
const lesson = (periods, from, to, subject, extra = {}) => ({
    date: D, start: at(from), end: at(to), period: periods[0], periods, subject, subject_long: subject,
    teacher: ['Abc'], room: ['101'], class: ['5b'], group: [], status: 'regular', moved: false, changes: {},
    text: '', info: '', notes: '', homework: false, color: '#4a90d9', ...extra,
});
const DAY = [
    lesson([1, 2], '08:00', '09:30', 'M'),
    lesson([4], '10:40', '11:25', 'E', {status: 'changed', teacher: ['Xyz'], room: ['204'],
        changes: {teacher: {from: ['Def'], to: ['Xyz']}, room: {from: ['102'], to: ['204']}}}),
    lesson([5], '11:45', '12:30', 'BIO', {status: 'cancelled'}),
];
const GRID = [[1, '08:00', '08:45'], [2, '08:45', '09:30'], [3, '09:50', '10:35'], [4, '10:40', '11:25'], [5, '11:45', '12:30']]
    .map(([period, start, end]) => ({period, start, end}));
const MIA = 'untis/status/mia';
const BEN = 'untis/status/ben';
const two = {subscribe: MIA, label: 'Mia', children: JSON.stringify([{topic: BEN, label: 'Ben'}])};
const send = (topic, val) => feezal.connection.deliver(topic, env(val));
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const $$ = (el, sel) => [...el.shadowRoot.querySelectorAll(sel)];
const text = n => n.textContent.replace(/\s+/g, ' ').trim();

describe('glass-untis-day', () => {
    it('lists the day in period order with a free period, changes and cancellations marked', async () => {
        const el = await mount('feezal-element-glass-untis-day', {subscribe: MIA});
        send(`${MIA}/today/date`, D);
        send(`${MIA}/today/timetable`, DAY);
        send('untis/status/school/time_grid', GRID);
        await until(() => $$(el, '.lesson').length === 3);
        await el.updateComplete;
        expect($$(el, '.lesson .period').map(text)).toEqual(['1–2', '4', '5']);
        expect(text($(el, '.free'))).toContain('3');
        const changed = $(el, '.lesson.changed');
        expect(text(changed.querySelector('.meta'))).toBe('Def Xyz · 102 204');
        expect(changed.querySelector('.was')).toBeTruthy();
        expect(text($(el, '.lesson.cancelled .badge'))).toBe('cancelled');
        expect($(el, '.lesson .swatch').style.background).toContain('rgb(74, 144, 217)');
    });

    it('switches the day with the tabs and says when there is no school', async () => {
        const el = await mount('feezal-element-glass-untis-day', {subscribe: MIA});
        send(`${MIA}/today/timetable`, DAY);
        send(`${MIA}/tomorrow/timetable`, []);
        await until(() => $$(el, '.lesson').length === 3);
        $$(el, '.untis-tab')[1].click();
        await el.updateComplete;
        expect(text($(el, '.untis-empty'))).toBe('No school');
        el.setAttribute('show-tabs', 'false');
        await el.updateComplete;
        expect($(el, '.untis-tabs')).toBe(null);
    });
});

describe('glass-untis-week', () => {
    it('lays the week out as days × periods, double lessons spanning, holidays named', async () => {
        const el = await mount('feezal-element-glass-untis-week', {subscribe: MIA});
        send('untis/status/school/time_grid', GRID);
        send(`${MIA}/week`, {monday: D, days: [
            {date: D, school: true, holiday: null, timetable: DAY},
            {date: '2030-03-05', school: false, holiday: 'Spring break', timetable: []},
        ]});
        send(`${MIA}/week/next`, {monday: '2030-03-11', days: [{date: '2030-03-11', school: true, holiday: null, timetable: [DAY[0]]}]});
        await until(() => $$(el, '.cell').length === 3);
        await el.updateComplete;
        expect($$(el, '.dayhead')).toHaveLength(2);
        expect($$(el, '.ph')).toHaveLength(5);
        expect($$(el, '.cell')[0].style.gridRow).toMatch(/2 \/ span 2/);
        expect(text($(el, '.holiday'))).toBe('Spring break');
        expect($(el, '.lesson.cancelled')).toBeTruthy();
        $$(el, '.untis-tab')[1].click();
        await el.updateComplete;
        expect($$(el, '.cell')).toHaveLength(1);
    });
});

describe('glass-untis-list', () => {
    it('shows open homework, and the other lists by attribute', async () => {
        const el = await mount('feezal-element-glass-untis-list', {subscribe: MIA});
        send(`${MIA}/homework`, [
            {assigned: '2030-01-01', due: '2099-01-10', subject: 'M', teacher: ['Abc'], text: 'Workbook p. 12', remark: '', completed: false, attachments: 0},
            {assigned: '2030-01-01', due: '2099-01-11', subject: 'E', teacher: ['Def'], text: 'Vocabulary', remark: '', completed: true, attachments: 0},
            {assigned: '2000-01-01', due: '2000-01-02', subject: 'BIO', teacher: ['Ghi'], text: 'Old', remark: '', completed: false, attachments: 0},
        ]);
        await until(() => $$(el, '.row').length === 1);
        expect(text($(el, '.row .what'))).toBe('M');
        expect(text($(el, '.count'))).toBe('1');
        el.setAttribute('show-past', '');
        await el.updateComplete;
        expect($$(el, '.row')).toHaveLength(3);

        el.setAttribute('list', 'messages');
        await el.updateComplete;
        expect(feezal.connection.subCount()).toBe(1);
        send(`${MIA}/messages`, [
            {sent: '2030-03-01T16:20:00+01:00', subject: 'Field trip', preview: 'Consent form', sender: 'Office', read: false, attachments: false},
            {sent: '2030-02-01T10:00:00+01:00', subject: 'Welcome', preview: 'Hello', sender: 'Office', read: true, attachments: false},
        ]);
        await until(() => $$(el, '.row').length === 2);
        expect($$(el, '.row.unread')).toHaveLength(1);
        expect(text($(el, '.count'))).toBe('1');

        el.setAttribute('list', 'absences');
        await el.updateComplete;
        send(`${MIA}/absences`, [{date: '2030-02-10', start: at('08:00', '2030-02-10'), end: at('13:00', '2030-02-10'), reason: 'Illness', text: '', excused: false, excuse_status: ''}]);
        await until(() => $$(el, '.row.unexcused').length === 1);
        expect(text($(el, '.row .text'))).toBe('not excused');
    });
});

describe('glass-untis-now', () => {
    it('shows the lesson now and the next one, and "no more lessons" when both are null', async () => {
        const el = await mount('feezal-element-glass-untis-now', {subscribe: MIA});
        const running = lesson([1], '00:00', '23:59', 'M', {date: undefined});
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        running.start = `${iso}T00:00:00`;
        running.end = `${iso}T23:59:59`;
        send(`${MIA}/now`, running);
        send(`${MIA}/next_lesson`, DAY[1]);
        await until(() => $$(el, '.slot').length === 2);
        await el.updateComplete;
        expect(text($(el, '.slot.now .tag'))).toBe('Now · until 23:59');
        expect($(el, '.slot.now .bar .fill')).toBeTruthy();
        expect(text($(el, '.slot.next .subj'))).toContain('E');
        expect(text($(el, '.slot.next .tag'))).toContain('10:40–11:25');
        send(`${MIA}/now`, null);
        send(`${MIA}/next_lesson`, null);
        await el.updateComplete;
        expect(text($(el, '.untis-empty'))).toBe('No more lessons');
    });
});

describe('glass-untis-hours', () => {
    it('shows start and end, the planned times when they differ, and a day off', async () => {
        const el = await mount('feezal-element-glass-untis-hours', {subscribe: 'untis/status/all', day: 'tomorrow'});
        expect(feezal.connection.subCount()).toBe(6);
        send('untis/status/all/tomorrow/date', D);
        send('untis/status/all/tomorrow/school', true);
        send('untis/status/all/tomorrow/start', at('08:45'));
        send('untis/status/all/tomorrow/end', at('12:30'));
        send('untis/status/all/tomorrow/start_planned', at('08:00'));
        send('untis/status/all/tomorrow/end_planned', at('12:30'));
        await until(() => $(el, '.hours'));
        await el.updateComplete;
        expect(text($(el, '.hours'))).toBe('08:45–12:30');
        expect($(el, '.hours .changed')).toBeTruthy();
        expect(text($(el, '.planned s'))).toBe('08:00–12:30');
        send('untis/status/all/tomorrow/school', false);
        send('untis/status/all/tomorrow/start', null);
        await el.updateComplete;
        expect(text($(el, '.off'))).toBe('No school');
    });
});

describe('several children', () => {
    it('renders a switcher, and a switch in one element switches the others', async () => {
        const day = await mount('feezal-element-glass-untis-day', two);
        const hours = await mount('feezal-element-glass-untis-hours', {...two, day: 'today'});
        send(`${MIA}/today/timetable`, DAY);
        await until(() => $$(day, '.lesson').length === 3);
        expect($$(day, '.untis-chip').map(text)).toEqual(['Mia', 'Ben']);
        $$(day, '.untis-chip')[1].click();
        await day.updateComplete;
        // only the active child is subscribed; the broker's retained copy arrives on the new subscription
        expect($$(day, '.lesson')).toHaveLength(0);
        send(`${BEN}/today/timetable`, [DAY[0]]);
        await until(() => $$(day, '.lesson').length === 1);
        await hours.updateComplete;
        expect($$(hours, '.untis-chip.on').map(text)).toEqual(['Ben']);
        // one child: no switcher, the name instead
        const single = await mount('feezal-element-glass-untis-now', {subscribe: MIA, label: 'Mia'});
        expect($(single, '.untis-switcher')).toBe(null);
        expect(text($(single, '.untis-child'))).toBe('Mia');
    });
});

describe('editor canvas', () => {
    it('previews invented data before the first message, and real data replaces it', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-untis-day', {subscribe: MIA});
        expect($$(el, '.lesson').length).toBeGreaterThan(0);
        send(`${MIA}/today/timetable`, []);
        await el.updateComplete;
        expect($$(el, '.lesson')).toHaveLength(0);
        expect(feezal.connection.published).toEqual([]);
    });
});
