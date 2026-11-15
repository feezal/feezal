/**
 * E191 — @feezal/feezal-controller-untis: the contract, the envelope, the
 * child list and switching (shared across elements), the pure data shaping
 * (day rows with free periods, the week grid, the list filters) and the
 * editor preview. Children, teachers and rooms are invented.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {
    UntisController, untisAttributes, UNTIS_CONSUMED_ATTRIBUTES, untisDiscoveryMap,
    unwrap, hhmm, periodLabel, parseChildren, schoolBase, dayRows, weekGrid, listRows, lessonProgress,
    untisText, untisSample,
} from '../packages/@feezal/feezal-controller-untis/feezal-controller-untis.js';

beforeEach(() => {
    window.feezal = {isEditor: false, connection: {pub() {}}};
});

function host(attrs = {}) {
    const el = document.createElement('div');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.subs = [];
    el.addSubscription = (topic, cb) => el.subs.push({topic, cb});
    el._unsubscribe = () => { el.subs = []; };
    el.getProperty = (msg, path) => path.split('.').reduce((o, k) => o?.[k], msg);
    el.updates = 0;
    el.requestUpdate = () => { el.updates++; };
    el.deliver = (topic, payload) => el.subs.filter(s => s.topic === topic).forEach(s => s.cb({topic, payload}));
    return el;
}

const at = hm => `2030-03-04T${hm}:00+01:00`;
const L = (periods, from, to, extra = {}) => ({date: '2030-03-04', start: at(from), end: at(to), period: periods[0], periods,
    subject: 'M', teacher: ['Abc'], room: ['101'], status: 'regular', moved: false, changes: {}, color: null, ...extra});
const GRID = [[1, '08:00', '08:45'], [2, '08:45', '09:30'], [3, '09:50', '10:35'], [4, '10:40', '11:25'], [5, '11:45', '12:30']]
    .map(([period, start, end]) => ({period, start, end}));

describe('the contract', () => {
    it('declares the child attributes once and maps the recognizer keys onto them', () => {
        const names = untisAttributes.map(a => a.name);
        expect(names).toEqual(['subscribe', 'message-property', 'label', 'children']);
        expect(UNTIS_CONSUMED_ATTRIBUTES).toEqual(names);
        for (const target of Object.values(untisDiscoveryMap)) {
            expect(names).toContain(typeof target === 'string' ? target : target.attr);
        }
        expect(untisAttributes.find(a => a.name === 'message-property').default).toBe('payload');
    });
});

describe('pure helpers', () => {
    it('unwrap takes the value out of the {"val", "ts"} envelope, bare values pass', () => {
        expect(unwrap({val: [1], ts: 1, lc: 1})).toEqual([1]);
        expect(unwrap('{"val":null,"ts":1}')).toBe(null);
        expect(unwrap([{subject: 'M'}])).toEqual([{subject: 'M'}]);
        expect(unwrap({monday: '2030-03-04', days: []})).toEqual({monday: '2030-03-04', days: []});
        expect(unwrap('2030-03-04')).toBe('2030-03-04');
    });

    it('hhmm reads the school-local time off the ISO string; periodLabel spans double lessons', () => {
        expect(hhmm('2030-03-04T07:40:00+01:00')).toBe('07:40');
        expect(hhmm(null)).toBe('');
        expect(periodLabel({periods: [1, 2]})).toBe('1–2');
        expect(periodLabel({period: 3, periods: [3]})).toBe('3');
        expect(periodLabel({})).toBe('');
    });

    it('parseChildren puts the subscribe child first, names it, and drops duplicates', () => {
        const kids = parseChildren('untis/status/mia/', 'Mia',
            JSON.stringify([{topic: 'untis/status/ben', label: ''}, {topic: 'untis/status/mia'}, 'untis/status/student_4711']));
        expect(kids).toEqual([
            {topic: 'untis/status/mia', label: 'Mia'},
            {topic: 'untis/status/ben', label: 'ben'},
            {topic: 'untis/status/student_4711', label: 'student_4711'},
        ]);
        expect(parseChildren('', '', 'not json')).toEqual([]);
        expect(schoolBase('untis/status/mia')).toBe('untis/status/school');
        expect(schoolBase('untis/status/all')).toBe('untis/status/school');
    });

    it('dayRows orders the lessons and fills free periods between them from the time grid', () => {
        const rows = dayRows([L([4], '10:40', '11:25'), L([1, 2], '08:00', '09:30')], GRID);
        expect(rows.map(r => r.free ?? r.lesson.period)).toEqual([1, 3, 4]);
        expect(rows[1]).toEqual({free: 3, start: '09:50', end: '10:35'});
        // without a time grid: the lessons only
        expect(dayRows([L([4], '10:40', '11:25'), L([1], '08:00', '08:45')]).map(r => r.lesson.period)).toEqual([1, 4]);
        expect(dayRows(null, GRID)).toEqual([]);
    });

    it('weekGrid places each lesson at its first period, spanning its periods; parallel lessons share a cell', () => {
        const week = {monday: '2030-03-04', days: [
            {date: '2030-03-04', school: true, timetable: [L([1, 2], '08:00', '09:30'), L([4], '10:40', '11:25'),
                L([4], '10:40', '11:25', {subject: 'E', status: 'cancelled'})]},
            {date: '2030-03-05', school: false, holiday: 'Spring break', timetable: []},
        ]};
        const g = weekGrid(week, GRID);
        expect(g.periods.map(p => p.period)).toEqual([1, 2, 3, 4, 5]);
        expect(g.days[0].cells.map(c => [c.row, c.span, c.lessons.length])).toEqual([[0, 2, 1], [3, 1, 2]]);
        expect(g.days[1].holiday).toBe('Spring break');
        // no time grid: rows from the lessons' periods
        expect(weekGrid(week, []).periods.map(p => p.period)).toEqual([1, 2, 4]);
    });

    it('listRows: open homework and upcoming exams by default, everything with showPast, max cuts', () => {
        const hw = [
            {due: '2030-03-03', completed: false, subject: 'old'},
            {due: '2030-03-05', completed: true, subject: 'done'},
            {due: '2030-03-06', completed: false, subject: 'later'},
            {due: '2030-03-05', completed: false, subject: 'soon'},
        ];
        expect(listRows('homework', hw, {today: '2030-03-04'}).map(h => h.subject)).toEqual(['soon', 'later']);
        expect(listRows('homework', hw, {today: '2030-03-04', showPast: true})).toHaveLength(4);
        expect(listRows('homework', hw, {today: '2030-03-04', max: 1}).map(h => h.subject)).toEqual(['soon']);
        const now = Date.parse('2030-03-04T12:00:00+01:00');
        const exams = [{start: at('08:00'), end: at('09:00'), subject: 'past'}, {start: '2030-03-11T08:00:00+01:00', end: '2030-03-11T09:00:00+01:00', subject: 'next'}];
        expect(listRows('exams', exams, {now}).map(e => e.subject)).toEqual(['next']);
        expect(listRows('absences', [{a: 1}, {a: 2}])).toHaveLength(2);
        expect(listRows('messages', undefined)).toEqual([]);
    });

    it('lessonProgress is the position within the running lesson, null outside', () => {
        const l = L([1], '08:00', '09:00');
        expect(lessonProgress(l, Date.parse(at('08:30')))).toBeCloseTo(0.5);
        expect(lessonProgress(l, Date.parse(at('09:30')))).toBe(null);
    });

    it('untisText follows the site locale, en as fallback', () => {
        expect(untisText('no_school', 'de-AT')).toBe('Kein Unterricht');
        expect(untisText('no_school', 'fr')).toBe('No school');
    });
});

describe('the controller', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('subscribes the active child\'s items and the school time grid, unwrapping the envelope', () => {
        const el = host({subscribe: 'untis/status/mia', 'message-property': 'payload'});
        const c = new UntisController(el, {items: ['today/timetable', 'now'], timeGrid: true});
        c.wire();
        expect(el.subs.map(s => s.topic)).toEqual(['untis/status/mia/today/timetable', 'untis/status/mia/now', 'untis/status/school/time_grid']);
        el.deliver('untis/status/mia/now', {val: null, ts: 1, lc: 1});
        el.deliver('untis/status/school/time_grid', {val: GRID, ts: 1, lc: 1});
        expect(c.has('now')).toBe(true);
        expect(c.get('now')).toBe(null);
        expect(c.get('today/timetable')).toBeUndefined();
        expect(c.grid).toEqual(GRID);
    });

    it('honours a payload.val message-property and bare payloads alike', () => {
        const el = host({subscribe: 'untis/status/mia', 'message-property': 'payload.val'});
        const c = new UntisController(el, {items: ['today/start']});
        c.wire();
        el.deliver('untis/status/mia/today/start', {val: at('08:00'), ts: 1});
        expect(c.get('today/start')).toBe(at('08:00'));
        const bare = host({subscribe: 'untis/status/mia'});
        const b = new UntisController(bare, {items: ['today/start']});
        b.wire();
        bare.deliver('untis/status/mia/today/start', at('07:40'));
        expect(b.get('today/start')).toBe(at('07:40'));
    });

    it('switches the child, drops the old child\'s data, and every element knowing the child follows', () => {
        const attrs = {subscribe: 'untis/status/mia', label: 'Mia', children: JSON.stringify([{topic: 'untis/status/ben', label: 'Ben'}])};
        const a = host(attrs), b = host(attrs), other = host({subscribe: 'untis/status/zoe'});
        const ca = new UntisController(a, {items: ['now']});
        const cb = new UntisController(b, {items: ['now']});
        const co = new UntisController(other, {items: ['now']});
        for (const c of [ca, cb, co]) c.hostConnected();
        a.deliver('untis/status/mia/now', {val: 'x', ts: 1});
        expect(ca.children.map(c => c.label)).toEqual(['Mia', 'Ben']);

        ca.select(1);
        expect(ca.child.label).toBe('Ben');
        expect(ca.has('now')).toBe(false);
        expect(a.subs.map(s => s.topic)).toEqual(['untis/status/ben/now']);
        expect(cb.child.label).toBe('Ben');
        expect(b.subs.map(s => s.topic)).toEqual(['untis/status/ben/now']);
        expect(co.child.topic).toBe('untis/status/zoe');
        for (const c of [ca, cb, co]) c.hostDisconnected();
    });

    it('rewires when the configuration changes (the items follow the host)', () => {
        const el = host({subscribe: 'untis/status/mia'});
        el.day = 'today';
        const c = new UntisController(el, {items: h => [`${h.day}/start`]});
        c.wire();
        c.rewireIfChanged();
        expect(el.subs.map(s => s.topic)).toEqual(['untis/status/mia/today/start']);
        el.day = 'next';
        c.rewireIfChanged();
        expect(el.subs.map(s => s.topic)).toEqual(['untis/status/mia/next/start']);
        el.setAttribute('subscribe', 'untis/status/all');
        c.rewireIfChanged();
        expect(el.subs.map(s => s.topic)).toEqual(['untis/status/all/next/start']);
    });

    it('shows invented preview data on the editor canvas only, until real data arrives', () => {
        const el = host({subscribe: 'untis/status/mia'});
        const c = new UntisController(el, {items: ['today/timetable']});
        c.wire();
        expect(c.get('today/timetable')).toBeUndefined();
        window.feezal.isEditor = true;
        expect(c.get('today/timetable')).toBe(untisSample('today/timetable'));
        expect(c.grid.length).toBeGreaterThan(0);
        el.deliver('untis/status/mia/today/timetable', {val: [], ts: 1});
        expect(c.get('today/timetable')).toEqual([]);
    });

    it('wires nothing without a child', () => {
        const el = host({});
        const c = new UntisController(el, {items: ['now'], timeGrid: true});
        c.wire();
        expect(el.subs).toEqual([]);
        expect(c.child).toBe(null);
    });
});
