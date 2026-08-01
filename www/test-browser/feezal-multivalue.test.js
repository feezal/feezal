/**
 * E165 — the multivalue controller + family cards. One card, several values:
 * stack (primary + smaller secondaries) and grid (row/col pivot), the
 * one-topic-many-properties wiring (topic dedupe), per-value topic override,
 * the grid template generator, and the editor sample.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-multivalue/feezal-element-glass-multivalue.js';
import '../packages/@feezal/feezal-element-metro-multivalue/feezal-element-metro-multivalue.js';
import '../packages/@feezal/feezal-element-eink-multivalue/feezal-element-eink-multivalue.js';
import '../packages/@feezal/feezal-element-circle-multivalue/feezal-element-circle-multivalue.js';
import {expandGrid, parseValues, sampleValues} from '@feezal/feezal-controller-multivalue';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => {
    feezal = setupFeezal();
});

const STACK_VALUES = JSON.stringify([
    {property: 'payload.temperature', label: 'Temp', unit: '°C', decimals: 1, role: 'primary'},
    {property: 'payload.humidity', label: 'Hum', unit: '%', role: 'secondary'},
]);

describe('E165 — stack layout (primary + secondaries)', () => {
    // The connection layer JSON-parses {…}/[…] payloads before delivery, so
    // the fake delivers parsed objects here (the camera tests deliver strings
    // because THEIR payloads arrive as strings/data URLs).
    it('one JSON payload feeds every value; primary big, secondary above', async () => {
        const el = await mount('feezal-element-glass-multivalue', {
            subscribe: 'zigbee/climate1', values: STACK_VALUES,
        });
        feezal.connection.deliver('zigbee/climate1', {temperature: 21.53, humidity: 55});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toContain('21.5');
        expect(el.shadowRoot.querySelector('.value .unit').textContent).toBe('°C');
        const sec = el.shadowRoot.querySelector('.secondaries');
        expect(sec.textContent).toContain('Hum');
        expect(sec.textContent).toContain('55');
    });

    // Per-value topics with NO element-level subscribe: the base class wires
    // its 6 control-channel topics only off `subscribe`, so the counts below
    // are purely the controller's.
    it('N values on one topic wire exactly ONE subscription (dedupe)', async () => {
        await mount('feezal-element-metro-multivalue', {
            values: JSON.stringify([
                {property: 'payload.temperature', topic: 'zigbee/climate1'},
                {property: 'payload.humidity', topic: 'zigbee/climate1'},
            ]),
        });
        expect(feezal.connection.subCount()).toBe(1);
    });

    it('a per-value topic override wires its own subscription', async () => {
        const el = await mount('feezal-element-eink-multivalue', {
            values: JSON.stringify([
                {property: 'payload.temperature', label: 'Temp', role: 'primary', topic: 'zigbee/climate1'},
                {property: 'payload', label: 'Ext', topic: 'sensor/outdoor'},
            ]),
        });
        expect(feezal.connection.subCount()).toBe(2);
        feezal.connection.deliver('sensor/outdoor', '7.5');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.secondaries').textContent).toContain('7.5');
    });

    it('without a role, the first entry is the primary', async () => {
        const el = await mount('feezal-element-circle-multivalue', {
            subscribe: 't', values: JSON.stringify([
                {property: 'payload.a', label: 'A'},
                {property: 'payload.b', label: 'B'},
            ]),
        });
        feezal.connection.deliver('t', {a: 1, b: 2});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toContain('1');
        expect(el.shadowRoot.querySelector('.secondaries').textContent).toContain('B');
    });
});

describe('E165 — grid layout (row/col pivot)', () => {
    const GRID_VALUES = JSON.stringify(
        expandGrid('power, voltage', 'a, b, c', 'payload.{row}_{col}')
            .map(v => ({...v, unit: v.row === 'power' ? 'W' : 'V'})));

    it('pivots values into a table with column and row headers', async () => {
        const el = await mount('feezal-element-glass-multivalue', {
            subscribe: 'zigbee/meter', layout: 'grid', values: GRID_VALUES,
        });
        feezal.connection.deliver('zigbee/meter', {
            power_a: 100, power_b: 200, power_c: 300,
            voltage_a: 230, voltage_b: 231, voltage_c: 229,
        });
        await el.updateComplete;
        const table = el.shadowRoot.querySelector('table.grid');
        const headCells = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        expect(headCells).toEqual(['', 'a', 'b', 'c']);
        const rows = [...table.querySelectorAll('tbody tr')];
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('th').textContent).toContain('power');
        expect(rows[0].querySelector('th').textContent).toContain('W');   // uniform row unit
        expect([...rows[0].querySelectorAll('td')].map(td => td.textContent.trim())).toEqual(['100', '200', '300']);
        expect([...rows[1].querySelectorAll('td')].map(td => td.textContent.trim())).toEqual(['230', '231', '229']);
    });

    it('renders on every family (parity smoke)', async () => {
        for (const tag of ['feezal-element-metro-multivalue', 'feezal-element-eink-multivalue', 'feezal-element-circle-multivalue']) {
            const el = await mount(tag, {subscribe: 'm', layout: 'grid', values: GRID_VALUES});
            feezal.connection.deliver('m', {power_a: 1});
            await el.updateComplete;
            expect(el.shadowRoot.querySelector('table.grid'), tag).not.toBeNull();
            el.remove();
        }
    });
});

describe('E165 — grid template generator', () => {
    it('expandGrid builds one entry per row × col with the pattern applied', () => {
        const out = expandGrid('power, voltage', 'a, b', 'payload.{row}_{col}');
        expect(out).toHaveLength(4);
        expect(out[0]).toMatchObject({property: 'payload.power_a', row: 'power', col: 'a'});
        expect(out[3]).toMatchObject({property: 'payload.voltage_b', row: 'voltage', col: 'b'});
    });

    it('editor: an empty values list expands ONCE from the template attributes', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-multivalue', {
            'subscribe': 'zigbee/meter',
            'grid-rows': 'power, voltage', 'grid-cols': 'a, b',
            'grid-pattern': 'payload.{row}_{col}',
        });
        await el.updateComplete;
        const expanded = parseValues(el.getAttribute('values'));
        expect(expanded).toHaveLength(4);
        expect(el.getAttribute('layout')).toBe('grid');
        // hand-edit survives: shrink the list, template must NOT re-expand
        el.setAttribute('values', JSON.stringify(expanded.slice(0, 2)));
        await el.updateComplete;
        expect(parseValues(el.getAttribute('values'))).toHaveLength(2);
    });

    it('viewer: the template never writes attributes', async () => {
        const el = await mount('feezal-element-glass-multivalue', {
            'grid-rows': 'power', 'grid-cols': 'a', 'grid-pattern': 'payload.{row}_{col}',
        });
        await el.updateComplete;
        expect(el.hasAttribute('values')).toBe(false);
    });
});

describe('E165 — editor sample', () => {
    it('an unconfigured card previews the stack sample in the editor only', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-multivalue', {});
        expect(el.shadowRoot.querySelector('.value').textContent).toContain('21');
        expect(el.shadowRoot.querySelector('.secondaries').textContent).toContain('Humidity');

        feezal.isEditor = false;
        const viewer = await mount('feezal-element-glass-multivalue', {});
        expect(viewer.shadowRoot.querySelector('.value')).toBeNull();
    });

    it('sampleValues covers both layouts', () => {
        expect(sampleValues('stack').some(v => v.role === 'primary')).toBe(true);
        expect(sampleValues('grid').filter(v => v.row && v.col)).toHaveLength(9);
    });
});
