/**
 * U66 — colour pickers can express transparency.
 *
 * The native input[type=color] is #rrggbb by spec: no alpha channel exists to
 * expose, so "add a transparency slider" meant swapping the control
 * (sl-color-picker with `opacity`) on every colour-authoring surface — the
 * styles inspector, the attribute inspector (both its sites), and the
 * background editor's solid + gradient stops.
 *
 * Three behaviours are the contract:
 *  1. alpha round-trips — an rgba()/8-digit-hex value survives the swatch
 *     instead of being flattened to opaque or reset to black;
 *  2. the swatch never lies — unresolvable shows the checkerboard ('' value),
 *     resolvable (var(--…) included) shows the real colour;
 *  3. the theme-var alpha rule (decision 2b): alpha on a var() keeps the var
 *     via color-mix(in srgb, var(--x) NN%, transparent) rather than silently
 *     freezing the theme colour to a literal.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-sidebar-inspector-styles.js';
import '../src/feezal-sidebar-inspector-attributes.js';
import '../src/feezal-style-editor-background.js';
import {resolveCssColor, composeThemeAlpha, normalizeHexa, literalToHexa}
    from '../src/feezal-color-util.js';
import {setupFeezal} from './helpers.js';

class ColorTestTarget extends HTMLElement {
    static feezal = {
        attributes: [{name: 'accent', type: 'color'}],
        styles: [{property: '--test-fill-color', type: 'color', default: 'var(--primary-color, #0284c7)'}],
    };
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }
}
if (!customElements.get('feezal-test-u66-target')) {
    customElements.define('feezal-test-u66-target', ColorTestTarget);
}

beforeEach(() => setupFeezal());

function mountTarget() {
    const box = document.createElement('div');
    box.style.cssText = '--primary-color:#0284c7;--accent-color:rgba(255,0,0,0.5);';
    document.body.append(box);
    const target = document.createElement('feezal-test-u66-target');
    box.append(target);
    return {box, target};
}

describe('resolveCssColor — the one swatch resolver (U66)', () => {
    it('keeps alpha through every literal form', () => {
        expect(literalToHexa('rgba(0, 128, 255, 0.5)')).toBe('#0080ff80');
        expect(literalToHexa('#abcd')).toBe('#aabbccdd');
        expect(literalToHexa('#0080FF80')).toBe('#0080ff80');
        expect(literalToHexa('rgb(0 128 255 / 0.25)')).toBe('#0080ff40');
    });

    it('resolves names and var() against the element, alpha included', () => {
        const {box, target} = mountTarget();
        expect(resolveCssColor('tomato', target)).toBe('#ff6347');
        expect(resolveCssColor('var(--primary-color)', target)).toBe('#0284c7');
        // a theme var that IS translucent resolves with its alpha
        expect(resolveCssColor('var(--accent-color)', target)).toBe('#ff000080');
        // the color-mix alpha form resolves to the mixed colour
        const mixed = resolveCssColor('color-mix(in srgb, var(--primary-color) 40%, transparent)', target);
        expect(mixed).toMatch(/^#[0-9a-f]{8}$/);
        expect(mixed.slice(7)).toBe('66');   // 40% alpha ≈ 0x66
        box.remove();
    });

    it('returns "" for unresolvable — never black', () => {
        expect(resolveCssColor('', null)).toBe('');
        expect(resolveCssColor('definitely-not-a-colour', document.body)).toBe('');
    });
});

describe('composeThemeAlpha — decision 2b', () => {
    const {box, target} = {box: null, target: null};
    const resolve = host => v => resolveCssColor(v, host);

    it('alpha-only move on a var() keeps the var as color-mix', () => {
        const m = mountTarget();
        // picker reports the var's own RGB with new alpha 40% (0x66)
        const out = composeThemeAlpha('var(--primary-color)', '#0284c766', resolve(m.target));
        expect(out).toBe('color-mix(in srgb, var(--primary-color) 40%, transparent)');
        m.box.remove();
    });

    it('back to 100% alpha returns the plain var()', () => {
        const m = mountTarget();
        const out = composeThemeAlpha(
            'color-mix(in srgb, var(--primary-color) 40%, transparent)',
            '#0284c7ff', resolve(m.target));
        expect(out).toBe('var(--primary-color)');
        m.box.remove();
    });

    it('a fallback chain is embedded whole', () => {
        const m = mountTarget();
        const out = composeThemeAlpha('var(--primary-color, #0284c7)', '#0284c780', resolve(m.target));
        expect(out).toBe('color-mix(in srgb, var(--primary-color, #0284c7) 50%, transparent)');
        m.box.remove();
    });

    it('an RGB change becomes a literal — a different colour is not "the theme colour"', () => {
        const m = mountTarget();
        expect(composeThemeAlpha('var(--primary-color)', '#ff000080', resolve(m.target)))
            .toBe('#ff000080');
        m.box.remove();
    });

    it('a literal authored value stays a literal', () => {
        expect(composeThemeAlpha('#123456', '#12345680', () => '')).toBe('#12345680');
        expect(composeThemeAlpha('', '#abcdefff', () => '')).toBe('#abcdef');
    });
});

describe('styles inspector swatch (U66)', () => {
    async function mountStyles(inlineValue) {
        const {box, target} = mountTarget();
        if (inlineValue) target.style.setProperty('--test-fill-color', inlineValue);
        target.classList.add('feezal-selected');
        const panel = document.createElement('feezal-sidebar-inspector-styles');
        panel.selectedElems = [target];
        document.body.append(panel);
        await panel.updateComplete;
        await new Promise(r => setTimeout(r, 50));
        await panel.updateComplete;
        return {box, target, panel};
    }

    it('is an alpha-capable sl-color-picker, valued with the alpha kept', async () => {
        const {box, panel} = await mountStyles('rgba(0, 128, 255, 0.5)');
        const picker = panel.shadowRoot.querySelector('sl-color-picker');
        expect(picker).toBeTruthy();
        expect(picker.opacity).toBe(true);
        expect(picker.value.toLowerCase()).toBe('#0080ff80');
        expect(picker.classList.contains('unresolved')).toBe(false);
        box.remove();
        panel.remove();
    });

    it('resolves the var() default honestly instead of black', async () => {
        const {box, panel} = await mountStyles(null);   // no inline value → default
        const picker = panel.shadowRoot.querySelector('sl-color-picker');
        expect(picker.value.toLowerCase()).toContain('#0284c7');
        box.remove();
        panel.remove();
    });

    it('a pick writes back through the theme-alpha rule', async () => {
        const {box, target, panel} = await mountStyles('var(--primary-color)');
        window.feezal = window.feezal || {};
        feezal.app = feezal.app || {change() {}};
        const picker = panel.shadowRoot.querySelector('sl-color-picker');
        // simulate the picker reporting an alpha-only move (RGB unchanged)
        picker.value = '#0284c766';
        picker.dispatchEvent(new CustomEvent('sl-change', {bubbles: true}));
        expect(target.style.getPropertyValue('--test-fill-color'))
            .toBe('color-mix(in srgb, var(--primary-color) 40%, transparent)');
        box.remove();
        panel.remove();
    });
});

describe('attribute inspector swatch (U66)', () => {
    it('shows rgba honestly and an empty trigger for unresolvable', async () => {
        const {box, target} = mountTarget();
        const panel = document.createElement('feezal-sidebar-inspector-attributes');
        panel.selectedElems = [target];
        document.body.append(panel);
        expect(panel._toCssColorHex('rgba(0,128,255,0.5)')).toBe('#0080ff80');
        expect(panel._toCssColorHex('var(--primary-color)')).toBe('#0284c7');
        expect(panel._toCssColorHex('')).toBe('');
        box.remove();
        panel.remove();
    });
});

describe('background editor (U66)', () => {
    it('gradient stops round-trip a color-mix alpha form', () => {
        const ed = document.createElement('feezal-style-editor-background');
        document.body.append(ed);
        const stops = ed._parseStops(
            'color-mix(in srgb, var(--primary-color) 40%, transparent) 0%, #ff000080 100%');
        expect(stops).toEqual([
            {color: 'color-mix(in srgb, var(--primary-color) 40%, transparent)', pos: 0},
            {color: '#ff000080', pos: 100},
        ]);
        ed.remove();
    });

    it('still parses the classic forms (rgb stop, var stop)', () => {
        const ed = document.createElement('feezal-style-editor-background');
        document.body.append(ed);
        const stops = ed._parseStops('rgba(1,2,3,0.5) 0%, var(--accent-color) 50%, #abc 100%');
        expect(stops?.map(s => s.pos)).toEqual([0, 50, 100]);
        expect(stops[1].color).toBe('var(--accent-color)');
        ed.remove();
    });

    it('the solid swatch is alpha-capable', async () => {
        const ed = document.createElement('feezal-style-editor-background');
        const host = document.createElement('feezal-test-u66-target');
        document.body.append(host, ed);
        ed.elements = [host];
        ed.element = host;
        await ed.updateComplete;
        const picker = ed.shadowRoot.querySelector('sl-color-picker');
        expect(picker).toBeTruthy();
        expect(picker.opacity).toBe(true);
        host.remove();
        ed.remove();
    });
});
