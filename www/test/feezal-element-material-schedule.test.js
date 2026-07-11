import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {
    timeToMin, minToTime, snapMin, parseSchedule, serializeSchedule,
    effectiveNow, clampBlock, DAYS,
} from '../packages/@feezal/feezal-element-material-schedule/feezal-element-material-schedule.js';

let subs;
let published;

beforeEach(() => {
    subs = {};
    published = [];
    feezal.isEditor = false;
    feezal.connection = {
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(),
        pub: vi.fn((topic, payload, options = {}) => published.push({topic, payload, options})),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
});

const deliver = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));

const SCHEDULE = {
    type: 'boolean',
    week: {
        mon: [{from: '06:30', to: '08:00', value: true}],
        sat: [{from: '08:00', to: '10:00', value: true}],
    },
    default: false,
    exceptions: [],
};

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-material-schedule');
    el.setAttribute('subscribe', attrs.subscribe ?? 'home/heating/schedule');
    el.setAttribute('publish', attrs.publish ?? 'home/heating/schedule');
    for (const [k, v] of Object.entries(attrs)) {
        if (k !== 'subscribe' && k !== 'publish') el.setAttribute(k, v);
    }
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('time helpers', () => {
    it('timeToMin / minToTime round-trip; 24:00 is a valid end', () => {
        expect(timeToMin('06:30')).toBe(390);
        expect(timeToMin('00:00')).toBe(0);
        expect(timeToMin('24:00')).toBe(1440);
        expect(timeToMin('24:01')).toBeNull();
        expect(timeToMin('9:75')).toBeNull();
        expect(timeToMin('noon')).toBeNull();
        expect(minToTime(390)).toBe('06:30');
        expect(minToTime(1440)).toBe('24:00');
    });

    it('snapMin snaps to the step and clamps to the day', () => {
        expect(snapMin(97, 15)).toBe(90);
        expect(snapMin(98, 15)).toBe(105);
        expect(snapMin(-10, 15)).toBe(0);
        expect(snapMin(9999, 15)).toBe(1440);
        expect(snapMin(97, 60)).toBe(120);
    });

    it('clampBlock restricts to the free gap containing the drag start', () => {
        const blocks = [{from: 360, to: 480}, {from: 720, to: 780}];
        expect(clampBlock(blocks, -1, 300, 600)).toEqual([300, 360]);   // clipped at the next block
        expect(clampBlock(blocks, -1, 600, 800)).toEqual([600, 720]);   // between the blocks
        expect(clampBlock(blocks, 0, 300, 900)).toEqual([300, 720]);    // own block excluded
        const [f, t] = clampBlock(blocks, -1, 400, 420);                // start inside a block
        expect(t <= f).toBe(true);                                      // → inverted, caller rejects
    });
});

describe('parseSchedule / serializeSchedule (format contract)', () => {
    it('normalizes the documented shape, sorting blocks and dropping invalid ones', () => {
        const s = parseSchedule({
            type: 'boolean',
            week: {
                mon: [
                    {from: '12:00', to: '13:00', value: true},
                    {from: '06:30', to: '08:00', value: true},
                    {from: 'garbage', to: '10:00', value: true},   // dropped
                    {from: '10:00', to: '09:00', value: true},     // to <= from → dropped
                ],
            },
            default: false,
        });
        expect(s.week.mon.map(b => [b.from, b.to])).toEqual([[390, 480], [720, 780]]);
        expect(s.week.sun).toEqual([]);
        expect(s.default).toBe(false);
    });

    it('unparseable / missing payloads yield an empty schedule of the fallback type (never crash)', () => {
        for (const bad of [null, undefined, '', '{oops', 42, 'text']) {
            const s = parseSchedule(bad, 'number');
            expect(s.type).toBe('number');
            expect(DAYS.every(d => Array.isArray(s.week[d]) && s.week[d].length === 0)).toBe(true);
        }
    });

    it('a typed payload wins over the fallback type (decided)', () => {
        expect(parseSchedule({type: 'number', week: {}}, 'boolean').type).toBe('number');
        expect(parseSchedule({week: {}}, 'number').type).toBe('number');
    });

    it('preserves the reserved exceptions field verbatim through a round-trip', () => {
        const s = parseSchedule({...SCHEDULE, exceptions: [{date: '2026-12-24', blocks: [], priority: 1}]});
        const out = JSON.parse(serializeSchedule(s));
        expect(out.exceptions).toEqual([{date: '2026-12-24', blocks: [], priority: 1}]);
    });

    it('serializes back to HH:MM strings on all seven days', () => {
        const out = JSON.parse(serializeSchedule(parseSchedule(SCHEDULE)));
        expect(out.week.mon).toEqual([{from: '06:30', to: '08:00', value: true}]);
        expect(out.week.tue).toEqual([]);
        expect(Object.keys(out.week)).toEqual(DAYS);
        expect(out.type).toBe('boolean');
        expect(out.default).toBe(false);
    });
});

describe('effectiveNow', () => {
    const schedule = parseSchedule({
        type: 'number',
        week: {wed: [{from: '06:00', to: '08:00', value: 21.5}, {from: '17:00', to: '22:00', value: 22}]},
        default: 17,
    });
    const wed = (h, m) => new Date(2026, 6, 8, h, m);   // 2026-07-08 is a Wednesday

    it('inside a block → block value until block end', () => {
        expect(effectiveNow(schedule, wed(7, 0))).toEqual({value: 21.5, until: '08:00'});
    });

    it('between blocks → default until next block start', () => {
        expect(effectiveNow(schedule, wed(12, 0))).toEqual({value: 17, until: '17:00'});
    });

    it('after the last block → default until midnight', () => {
        expect(effectiveNow(schedule, wed(23, 0))).toEqual({value: 17, until: '24:00'});
    });

    it('weeks start Monday: Sunday maps to the sun key', () => {
        const s = parseSchedule({type: 'boolean', week: {sun: [{from: '00:00', to: '24:00', value: true}]}, default: false});
        expect(effectiveNow(s, new Date(2026, 6, 12, 12, 0)).value).toBe(true);   // 2026-07-12 is a Sunday
    });
});

describe('element: remote state, dirty draft, save/revert (E52 decisions)', () => {
    it('renders blocks from the retained payload', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;
        const blocks = el.renderRoot.querySelectorAll('.block');
        expect(blocks).toHaveLength(2);
        expect(el.renderRoot.textContent).toContain('now:');
    });

    it('editing marks dirty; Save publishes retained and clears dirty', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;

        el.addBlock('tue', 6 * 60, 8 * 60);
        await el.updateComplete;
        expect(el._dirty).toBe(true);
        expect(el.renderRoot.textContent).toContain('unsaved');

        el.renderRoot.querySelector('.btn.save').click();
        await el.updateComplete;
        expect(published).toHaveLength(1);
        expect(published[0].topic).toBe('home/heating/schedule');
        expect(published[0].options).toEqual({retain: true});
        const out = JSON.parse(published[0].payload);
        expect(out.week.tue).toEqual([{from: '06:00', to: '08:00', value: true}]);
        expect(out.week.mon).toEqual([{from: '06:30', to: '08:00', value: true}]);
        expect(el._dirty).toBe(false);
    });

    it('Revert restores the last received schedule', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;
        el.addBlock('tue', 360, 480);
        await el.updateComplete;
        expect(el._dirty).toBe(true);

        el.renderRoot.querySelectorAll('.btn')[0].click();   // Revert
        await el.updateComplete;
        expect(el._dirty).toBe(false);
        expect(el._schedule.week.tue).toEqual([]);
    });

    it('a remote update while dirty never clobbers the draft — hint instead', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;
        el.addBlock('tue', 360, 480);
        await el.updateComplete;

        deliver('home/heating/schedule', {...SCHEDULE, week: {mon: []}});
        await el.updateComplete;
        expect(el._schedule.week.tue).toHaveLength(1);        // draft intact
        expect(el.renderRoot.textContent).toContain('changed remotely');

        // Revert now adopts the remote version
        el.renderRoot.querySelectorAll('.btn')[0].click();
        await el.updateComplete;
        expect(el._schedule.week.mon).toEqual([]);
        expect(el.renderRoot.textContent).not.toContain('changed remotely');
    });

    it('a clean element adopts remote updates immediately', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;
        deliver('home/heating/schedule', {...SCHEDULE, week: {mon: [{from: '05:00', to: '06:00', value: true}]}});
        await el.updateComplete;
        expect(el._schedule.week.mon).toEqual([{from: 300, to: 360, value: true}]);
        expect(el._dirty).toBe(false);
    });

    it('Save never publishes in editor mode', async () => {
        feezal.isEditor = true;
        const el = await mount();
        el.addBlock('mon', 360, 480);
        el._save();
        expect(published).toEqual([]);
    });
});

describe('element: block editing', () => {
    it('addBlock clamps against neighbours and rejects sub-step slivers', async () => {
        const el = await mount({step: '15'});
        expect(el.addBlock('mon', 360, 480)).toBe(0);
        expect(el.addBlock('mon', 300, 420)).toBe(0);         // clipped to 300–360
        expect(el._schedule.week.mon.map(b => [b.from, b.to])).toEqual([[300, 360], [360, 480]]);
        expect(el.addBlock('mon', 365, 370)).toBe(-1);        // inside existing → too small
    });

    it('number type: new blocks get a sensible value; setBlockValue clamps to min/max', async () => {
        const el = await mount({type: 'number', min: '5', max: '30', 'step-value': '0.5'});
        const index = el.addBlock('mon', 360, 480);
        expect(el._schedule.week.mon[index].value).toBe(17.5);   // (5+30)/2 → step-rounded

        el.setBlockValue('mon', index, '99');
        expect(el._schedule.week.mon[index].value).toBe(30);     // clamped
        el.setBlockValue('mon', index, '21.5');
        expect(el._schedule.week.mon[index].value).toBe(21.5);

        // the last used value seeds the next block
        const j = el.addBlock('tue', 360, 480);
        expect(el._schedule.week.tue[j].value).toBe(21.5);
    });

    it('deleteBlock removes the selected block and re-marks dirty state', async () => {
        const el = await mount();
        deliver('home/heating/schedule', SCHEDULE);
        await el.updateComplete;
        el.deleteBlock('mon', 0);
        await el.updateComplete;
        expect(el._schedule.week.mon).toEqual([]);
        expect(el._dirty).toBe(true);
    });

    it('resizeBlock respects neighbours', async () => {
        const el = await mount();
        el.addBlock('mon', 360, 480);
        el.addBlock('mon', 600, 720);
        el.resizeBlock('mon', 0, 360, 900);                   // clipped at 600
        expect(el._schedule.week.mon[0].to).toBe(600);
    });

    it('tapping a block selects it; the toolbar edits number values', async () => {
        const el = await mount({type: 'number'});
        deliver('home/heating/schedule', {type: 'number', week: {mon: [{from: '06:00', to: '08:00', value: 21}]}, default: 17});
        await el.updateComplete;

        el.renderRoot.querySelector('.block').dispatchEvent(new Event('pointerdown', {bubbles: true}));
        await el.updateComplete;
        const input = el.renderRoot.querySelector('.toolbar input');
        expect(input).toBeTruthy();
        input.value = '22.5';
        input.dispatchEvent(new Event('change'));
        await el.updateComplete;
        expect(el._schedule.week.mon[0].value).toBe(22.5);
        expect(el._dirty).toBe(true);
    });
});
