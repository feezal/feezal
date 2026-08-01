/**
 * E165 — the multivalue controller's pure logic, unit-level (the family cards
 * exercise it end-to-end in test-browser/feezal-multivalue.test.js): values
 * parsing, the grid template expansion, formatting, the stack split, the grid
 * pivot with row units, topic-deduped wiring and the editor-only template
 * expansion guard.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {
    MultivalueController, parseValues, expandGrid, sampleValues,
    multivalueAttributes, MULTIVALUE_CONSUMED_ATTRIBUTES,
} from '../packages/@feezal/feezal-controller-multivalue/feezal-controller-multivalue.js';

/** Minimal host: attribute map + the FeezalElement surface the controller uses. */
function makeHost(attrs = {}) {
    const subs = [];
    const host = {
        attrs: {...attrs},
        subs,
        updates: 0,
        getAttribute(name) { return this.attrs[name] ?? null; },
        setAttribute(name, v) { this.attrs[name] = String(v); },
        addController() {},
        requestUpdate() { this.updates++; },
        addSubscription(topic, cb) { subs.push({topic, cb}); },
        _unsubscribe() { subs.length = 0; },
        getProperty(msg, prop) {
            if (!prop || prop === 'payload') return msg.payload;
            let res = msg;
            for (const p of String(prop).split('.')) res = res?.[p];
            return res;
        },
    };
    return host;
}

beforeEach(() => {
    window.feezal = {isEditor: false};
});

describe('parseValues', () => {
    it('parses an array, filters non-objects, survives garbage', () => {
        expect(parseValues('[{"property":"payload.a"},null,42,"x"]')).toEqual([{property: 'payload.a'}]);
        expect(parseValues('')).toEqual([]);
        expect(parseValues('not json')).toEqual([]);
        expect(parseValues('{"an":"object"}')).toEqual([]);
    });
});

describe('expandGrid (template generator)', () => {
    it('expands rows × cols with the pattern and row/col keys', () => {
        const out = expandGrid('power, voltage', ' a ,b ', 'payload.{row}_{col}');
        expect(out).toHaveLength(4);
        expect(out[0]).toEqual({property: 'payload.power_a', label: 'power a', row: 'power', col: 'a'});
        expect(out[3].property).toBe('payload.voltage_b');
    });

    it('returns empty without rows, cols or a pattern', () => {
        expect(expandGrid('', 'a', 'p')).toEqual([]);
        expect(expandGrid('r', '', 'p')).toEqual([]);
        expect(expandGrid('r', 'a', '')).toEqual([]);
    });
});

describe('format', () => {
    const mv = () => new MultivalueController(makeHost());

    it('formats numbers with per-value decimals and clamps them to 0..6', () => {
        expect(mv().format(21.567, {decimals: 1})).toBe('21.6');
        expect(mv().format(3, {decimals: 99})).toBe('3.000000');
    });

    it('empty/nullish → em dash; non-numeric passes through; objects stringify', () => {
        expect(mv().format(null)).toBe('—');
        expect(mv().format('')).toBe('—');
        expect(mv().format('open', {})).toBe('open');
        expect(mv().format({a: 1}, {})).toBe('{"a":1}');
    });
});

describe('stack()', () => {
    it('marks the role:primary entry, everything else secondary', () => {
        const host = makeHost({values: JSON.stringify([
            {property: 'payload.h', label: 'H', role: 'secondary'},
            {property: 'payload.t', label: 'T', role: 'primary'},
        ])});
        const {primary, secondaries} = new MultivalueController(host).stack();
        expect(primary.label).toBe('T');
        expect(secondaries.map(v => v.label)).toEqual(['H']);
    });

    it('without a marked role the first entry is the primary', () => {
        const host = makeHost({values: JSON.stringify([{label: 'A'}, {label: 'B'}])});
        expect(new MultivalueController(host).stack().primary.label).toBe('A');
    });

    it('empty config in the viewer → nothing (no sample leakage)', () => {
        const {primary, secondaries} = new MultivalueController(makeHost()).stack();
        expect(primary).toBe(null);
        expect(secondaries).toEqual([]);
    });

    it('empty config in the editor → the stack sample', () => {
        window.feezal.isEditor = true;
        const {primary} = new MultivalueController(makeHost()).stack();
        expect(primary.label).toBe('Temperature');
    });
});

describe('grid()', () => {
    const host = makeHost({layout: 'grid', values: JSON.stringify([
        {property: 'payload.p_a', row: 'power', col: 'a', unit: 'W'},
        {property: 'payload.p_b', row: 'power', col: 'b', unit: 'W'},
        {property: 'payload.v_a', row: 'voltage', col: 'a', unit: 'V'},
        {property: 'payload.v_b', row: 'voltage', col: 'b', unit: 'V'},
        {property: 'payload.extra', label: 'Total'},
    ])});
    const mv = new MultivalueController(host);

    it('pivots by row/col in first-appearance order, extras separate', () => {
        const g = mv.grid();
        expect(g.cols).toEqual(['a', 'b']);
        expect(g.rows.map(r => r.key)).toEqual(['power', 'voltage']);
        expect(g.rows[0].cells.map(c => c?.property)).toEqual(['payload.p_a', 'payload.p_b']);
        expect(g.extras.map(v => v.label)).toEqual(['Total']);
    });

    it('a missing cell is null, not skipped', () => {
        const h = makeHost({values: JSON.stringify([
            {row: 'r1', col: 'a'}, {row: 'r1', col: 'b'}, {row: 'r2', col: 'b'},
        ])});
        const g = new MultivalueController(h).grid();
        expect(g.rows[1].cells[0]).toBe(null);
        expect(g.rows[1].cells[1]).not.toBe(null);
    });

    it('rowUnit joins only a uniform row unit', () => {
        const g = mv.grid();
        expect(mv.rowUnit(g.rows[0])).toBe('W');
        const mixed = {cells: [{unit: 'W'}, {unit: 'V'}]};
        expect(mv.rowUnit(mixed)).toBe('');
    });
});

describe('wire() — topic-deduped subscriptions', () => {
    it('N values on one topic = ONE subscription; per-value topics add their own', () => {
        const host = makeHost({subscribe: 'zigbee/dev', values: JSON.stringify([
            {property: 'payload.a'},
            {property: 'payload.b'},
            {property: 'payload', topic: 'other/topic'},
        ])});
        const mv = new MultivalueController(host);
        mv.wire();
        expect(host.subs.map(s => s.topic)).toEqual(['zigbee/dev', 'other/topic']);

        host.subs[0].cb({payload: {a: 1, b: 2}});
        expect(host.updates).toBe(1);
        const all = mv.values();
        expect(all[0].display).toBe('1');
        expect(all[1].display).toBe('2');
    });

    it('rewireIfChanged resets data and rewires only on a config change', () => {
        const host = makeHost({subscribe: 't', values: JSON.stringify([{property: 'payload'}])});
        const mv = new MultivalueController(host);
        mv.wire();
        host.subs[0].cb({payload: 5});
        mv.rewireIfChanged();                     // unchanged → data kept
        expect(mv.values()[0].display).toBe('5');
        host.attrs.subscribe = 't2';
        mv.rewireIfChanged();                     // changed → torn down + rewired
        expect(host.subs.map(s => s.topic)).toEqual(['t2']);
        expect(mv.values()[0].display).toBe('—');
    });
});

describe('maybeExpandTemplate (editor-only fill helper)', () => {
    const tmpl = {'grid-rows': 'p, v', 'grid-cols': 'a, b', 'grid-pattern': 'payload.{row}_{col}'};

    it('expands ONCE into an empty values list and defaults layout to grid', () => {
        window.feezal.isEditor = true;
        window.feezal.app = {change() {}};
        const host = makeHost(tmpl);
        new MultivalueController(host).maybeExpandTemplate();
        expect(parseValues(host.attrs.values)).toHaveLength(4);
        expect(host.attrs.layout).toBe('grid');
    });

    it('never re-clobbers a non-empty list and never writes in the viewer', () => {
        window.feezal.isEditor = true;
        window.feezal.app = {change() {}};
        const host = makeHost({...tmpl, values: '[{"property":"payload.x"}]'});
        new MultivalueController(host).maybeExpandTemplate();
        expect(parseValues(host.attrs.values)).toHaveLength(1);

        window.feezal.isEditor = false;
        const viewer = makeHost(tmpl);
        new MultivalueController(viewer).maybeExpandTemplate();
        expect(viewer.attrs.values).toBeUndefined();
    });
});

describe('contract exports', () => {
    it('the consumed-attribute list mirrors the fragment (E114 parity source)', () => {
        expect(MULTIVALUE_CONSUMED_ATTRIBUTES).toEqual(multivalueAttributes.map(a => a.name));
        expect(MULTIVALUE_CONSUMED_ATTRIBUTES).toContain('values');
        expect(MULTIVALUE_CONSUMED_ATTRIBUTES).toContain('layout');
    });

    it('sampleValues covers both layouts', () => {
        expect(sampleValues('stack').some(v => v.role === 'primary')).toBe(true);
        expect(sampleValues('grid').filter(v => v.row && v.col)).toHaveLength(9);
    });
});
