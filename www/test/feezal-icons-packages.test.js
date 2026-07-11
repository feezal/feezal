import {describe, it, expect} from 'vitest';

// N23 reference icon packages — import the REAL package entries so the test
// executes their actual registerIcons() calls against the real registry.
import {iconSets} from '../src/feezal-icon.js';
import '../packages/@feezal/feezal-icons-mdi/index.js';
import '../packages/@feezal/feezal-icons-knx-uf/index.js';
import '../packages/@feezal/feezal-icons-fa/index.js';

describe('@feezal/feezal-icons-mdi', () => {
    const set = () => iconSets().get('mdi');

    it('registers 7400+ icons with HA-compatible kebab names', () => {
        expect(set().names.length).toBeGreaterThan(7000);
        expect(set().names).toContain('lightbulb');
        expect(set().names).toContain('ab-testing');            // mdiAbTesting → ab-testing
        expect(set().names).toContain('power-settings');
    });

    it('renders theme-aware inline SVG', () => {
        const svg = set().render('lightbulb');
        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('fill="currentColor"');
        expect(svg).toMatch(/^<svg /);
    });

    it('renders empty for unknown names', () => {
        expect(set().render('definitely-not-an-icon')).toBe('');
    });
});

describe('@feezal/feezal-icons-knx-uf', () => {
    const set = () => iconSets().get('knx-uf');

    it('registers ~940 icons with upstream names', () => {
        expect(set().names.length).toBeGreaterThan(900);
        expect(set().names).toContain('audio_audio');
        expect(set().names).toContain('fts_sunblind');
    });

    it('renders optimized, theme-aware SVG (no prolog, no fixed dimensions)', () => {
        const svg = set().render('audio_audio');
        expect(svg).toMatch(/^<svg /);
        expect(svg).toContain('viewBox=');
        expect(svg).toContain('currentColor');                  // white → currentColor
        expect(svg).not.toContain('<?xml');
        expect(svg).not.toContain('DOCTYPE');
        expect(svg).not.toMatch(/<svg[^>]*\swidth=/);           // removeDimensions → 1em scaling works
    });

    it('every icon is themed and none kept a fixed white', () => {
        const {names, render} = set();
        const offenders = names.filter(n => /#fff\b|#ffffff\b/i.test(render(n)));
        expect(offenders).toEqual([]);
    });
});

describe('@feezal/feezal-icons-fa (N28)', () => {
    it('registers THREE sets from one package: fa-solid, fa-regular, fa-brands', () => {
        expect(iconSets().get('fa-solid')).toBeTruthy();
        expect(iconSets().get('fa-regular')).toBeTruthy();
        expect(iconSets().get('fa-brands')).toBeTruthy();
    });

    it('carries the expected upstream volume per style', () => {
        expect(iconSets().get('fa-solid').names.length).toBeGreaterThan(1900);
        expect(iconSets().get('fa-regular').names.length).toBeGreaterThan(200);
        expect(iconSets().get('fa-brands').names.length).toBeGreaterThan(500);
        expect(iconSets().get('fa-solid').names).toContain('house');
        expect(iconSets().get('fa-regular').names).toContain('heart');
        expect(iconSets().get('fa-brands').names).toContain('github');
    });

    it('renders theme-aware, unsized inline SVG (license comment + xmlns stripped)', () => {
        const svg = iconSets().get('fa-solid').render('house');
        expect(svg).toMatch(/^<svg /);
        expect(svg).toContain('viewBox=');
        expect(svg).toContain('currentColor');
        expect(svg).not.toContain('xmlns=');
        expect(svg).not.toContain('<!--');
        expect(svg).not.toMatch(/<svg[^>]*\swidth=/);            // 1em scaling works
    });

    it('renders empty for unknown names', () => {
        expect(iconSets().get('fa-brands').render('not-a-brand')).toBe('');
    });
});

describe('<feezal-icon> renders the packaged sets end to end', () => {
    it('mounts mdi, knx-uf and fa glyphs', () => {
        for (const name of ['mdi:lightbulb', 'knx-uf:fts_sunblind', 'fa-solid:house', 'fa-brands:github']) {
            const el = document.createElement('feezal-icon');
            el.setAttribute('name', name);
            document.body.append(el);
            expect(el.shadowRoot.querySelector('svg'), name).not.toBeNull();
        }
    });
});

describe('knx-uf variant families — stable framing (basic-icon-value)', () => {
    const TENS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    it('all tens-step families share ONE viewBox — no shift across values', () => {
        const {names, render} = iconSets().get('knx-uf');
        const all = new Set(names);
        const bases = names.filter(n => n.endsWith('_10')).map(n => n.slice(0, -3))
            .filter(b => TENS.every(s => all.has(`${b}_${s}`)));
        expect(bases.length).toBeGreaterThanOrEqual(12);
        expect(bases).toContain('fts_garage_door');
        expect(bases).toContain('fts_shutter');
        for (const base of bases) {
            const viewBoxes = new Set(
                [...TENS, 0, '00'].map(s => render(`${base}_${s}`))
                    .filter(Boolean)
                    .map(svg => svg.match(/viewBox="([^"]*)"/)[1]));
            expect(viewBoxes.size, base).toBe(1);
        }
    });
});
