/**
 * E151 — the family gauge cards (circle / glass / metro) over the shared
 * `@feezal/feezal-gauge` dial. All three render the identical geometry for the
 * same value, so the tests run the same assertions across every tag: needle
 * angle mapping, arc/ring fill length, colour-range bands and tick geometry.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {setupFeezal, mount} from './helpers.js';
import {ARC_START, ARC_SWEEP, R_NEEDLE, R_TRACK, polar, parseRanges, bandColor} from '@feezal/feezal-gauge';
import '../packages/@feezal/feezal-element-circle-gauge/feezal-element-circle-gauge.js';
import '../packages/@feezal/feezal-element-glass-gauge/feezal-element-glass-gauge.js';
import '../packages/@feezal/feezal-element-metro-gauge/feezal-element-metro-gauge.js';

const TAGS = [
    'feezal-element-circle-gauge',
    'feezal-element-glass-gauge',
    'feezal-element-metro-gauge',
];

const RANGES = JSON.stringify([
    {from: 0, color: '#4caf50'},
    {from: 70, color: '#ff9800'},
    {from: 90, color: '#e53935'},
]);

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const dial = el => el.renderRoot.querySelector('svg.dial');
const text = el => el.renderRoot.textContent;

describe('E151 — gauge parity across circle / glass / metro', () => {
    for (const tag of TAGS) {
        it(`${tag} renders the subscribed value with unit and decimals`, async () => {
            const el = await mount(tag, {subscribe: 'stat/temp', unit: '°C', decimals: '1'});
            feezal.connection.deliver('stat/temp', '21.47');
            await el.updateComplete;
            expect(text(el)).toContain('21.5');
            expect(text(el)).toContain('°C');
        });

        it(`${tag} maps the value onto the needle angle`, async () => {
            const el = await mount(tag, {subscribe: 'stat/v', look: 'needle', min: '0', max: '200'});
            feezal.connection.deliver('stat/v', '50');       // 25 % of the scale
            await el.updateComplete;
            // The needle tip sits at ARC_START + 25 % of the sweep, radius R_NEEDLE.
            const [nx, ny] = polar(ARC_START + ARC_SWEEP * 0.25, R_NEEDLE);
            const needle = [...dial(el).querySelectorAll('path')]
                .find(p => p.getAttribute('d')?.includes(`L${nx},${ny}`));
            expect(needle, `${tag}: no needle path pointing at 25 %`).toBeTruthy();
        });

        it(`${tag} fills the arc proportionally and takes the colour band`, async () => {
            const el = await mount(tag, {subscribe: 'stat/v', look: 'arc', ranges: RANGES});
            feezal.connection.deliver('stat/v', '95');       // → the #e53935 band
            await el.updateComplete;
            const fill = [...dial(el).querySelectorAll('path')]
                .find(p => p.getAttribute('stroke') === '#e53935');
            expect(fill, `${tag}: arc fill did not take the range colour`).toBeTruthy();
            // The fill ends at 95 % of the sweep.
            const [ex, ey] = polar(ARC_START + ARC_SWEEP * 0.95, R_TRACK);
            expect(fill.getAttribute('d')).toContain(`${ex},${ey}`);
        });

        it(`${tag} ring look fills clockwise via stroke-dasharray`, async () => {
            const el = await mount(tag, {subscribe: 'stat/v', look: 'ring', min: '0', max: '100'});
            feezal.connection.deliver('stat/v', '25');
            await el.updateComplete;
            const circ = 2 * Math.PI * R_TRACK;
            const fill = [...dial(el).querySelectorAll('circle')]
                .find(c => c.getAttribute('stroke-dasharray'));
            expect(fill).toBeTruthy();
            const [drawn] = fill.getAttribute('stroke-dasharray').split(' ').map(Number);
            expect(drawn).toBeCloseTo(circ * 0.25, 1);
        });

        it(`${tag} draws major + minor ticks and tick labels`, async () => {
            const el = await mount(tag, {
                look: 'needle', ticks: '4', 'minor-ticks': '1', 'tick-labels': 'true',
                min: '0', max: '100',
            });
            await el.updateComplete;
            const lines = dial(el).querySelectorAll('line');
            // 5 majors (0..4 inclusive) + 4 minors between them.
            expect(lines.length).toBe(9);
            const labels = [...dial(el).querySelectorAll('text')].map(t => t.textContent);
            for (const v of ['0', '25', '50', '75', '100']) expect(labels).toContain(v);
        });

        it(`${tag} clamps out-of-range values to the scale ends`, async () => {
            const el = await mount(tag, {subscribe: 'stat/v', look: 'arc', min: '0', max: '10'});
            feezal.connection.deliver('stat/v', '999');
            await el.updateComplete;
            expect(el._frac).toBe(1);
            feezal.connection.deliver('stat/v', '-5');
            await el.updateComplete;
            expect(el._frac).toBe(0);
        });

        it(`${tag} show-value=false hides the numeral`, async () => {
            const el = await mount(tag, {subscribe: 'stat/v', 'show-value': 'false'});
            feezal.connection.deliver('stat/v', '42');
            await el.updateComplete;
            expect(text(el)).not.toContain('42');
        });

        it(`${tag} rewires when the topic changes on the live canvas`, async () => {
            const el = await mount(tag, {subscribe: 'stat/a'});
            feezal.connection.deliver('stat/a', '11');
            await el.updateComplete;
            expect(text(el)).toContain('11');
            el.setAttribute('subscribe', 'stat/b');
            await el.updateComplete;
            feezal.connection.deliver('stat/b', '22');
            await el.updateComplete;
            expect(text(el)).toContain('22');
            expect(feezal.connection.subCount()).toBe(1);
        });

        it(`${tag} is discoverable as a sensor view`, () => {
            const {discovery} = customElements.get(tag).feezal;
            expect(discovery.component).toBe('sensor');
            expect(discovery.map.state_topic).toEqual({attr: 'subscribe'});
            expect(discovery.map.unit_of_measurement).toEqual({attr: 'unit'});
        });
    }

    it('all three families derive the same needle angle for the same value', async () => {
        const els = [];
        for (const tag of TAGS) {
            const el = await mount(tag, {subscribe: 'stat/v', look: 'needle', min: '-20', max: '60'});
            els.push(el);
        }
        feezal.connection.deliver('stat/v', '20');           // exactly mid-scale
        for (const el of els) await el.updateComplete;
        const fracs = els.map(el => el._frac);
        expect(fracs).toEqual([0.5, 0.5, 0.5]);
    });
});

describe('E151 — shared gauge helpers', () => {
    it('parseRanges sorts and drops malformed bands', () => {
        const parsed = parseRanges('[{"from":90,"color":"#e53935"},{"from":"x","color":"#000"},{"from":0,"color":"#4caf50"}]');
        expect(parsed).toEqual([{from: 0, color: '#4caf50'}, {from: 90, color: '#e53935'}]);
    });

    it('parseRanges tolerates broken JSON', () => {
        expect(parseRanges('not json')).toEqual([]);
        expect(parseRanges('')).toEqual([]);
    });

    it('bandColor picks the highest matching band, else the fallback', () => {
        expect(bandColor(RANGES, 95)).toBe('#e53935');
        expect(bandColor(RANGES, 70)).toBe('#ff9800');
        expect(bandColor(RANGES, 5)).toBe('#4caf50');
        expect(bandColor('', 5, 'red')).toBe('red');
    });
});
