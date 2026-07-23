import {describe, it, expect, vi, beforeEach} from 'vitest';

import '../src/feezal-palette.js';

// Palette entries resolve through the custom-element registry: register a few
// fake elements with the different palette-config shapes once per file.
class PaletteButton extends HTMLElement {
    static feezal = {palette: {name: 'Test Button', category: 'Basic'}};
}
class PaletteLegacy extends HTMLElement {
    static paletteOptions = {palette: {name: 'Legacy Knob', category: 'Paper'}};
}
class PaletteBare extends HTMLElement {}
customElements.define('feezal-element-pal-button', PaletteButton);
customElements.define('feezal-element-pal-legacy', PaletteLegacy);
customElements.define('feezal-element-pal-bare', PaletteBare);

// The element wires interact.js drag handlers on attach — these tests build
// the element unattached and drive the category logic directly.
function makePalette() {
    return document.createElement('feezal-palette');
}

function makeSiteWithComponents(...names) {
    const site = document.createElement('div');
    names.forEach(name => {
        const template = document.createElement('template');
        template.setAttribute('feezal-component', name);
        site.append(template);
    });
    return site;
}

beforeEach(() => {
    localStorage.clear();   // isolate palette-collapse state per test
    feezal.elements = [
        '@feezal/feezal-element-pal-button',
        '@feezal/feezal-element-pal-legacy',
        '@feezal/feezal-element-pal-bare',
        '@feezal/feezal-element-pal-unregistered',
    ];
    feezal.site = makeSiteWithComponents();
});

describe('_rebuildCategories()', () => {
    it('groups registered elements by their palette category', () => {
        const el = makePalette();
        el._rebuildCategories();
        const byName = Object.fromEntries(el.categories.map(c => [c.name, c.elements]));
        expect(byName.Basic).toEqual([{el: 'feezal-element-pal-button', name: 'Test Button', category: 'Basic'}]);
        expect(byName.Paper[0].name).toBe('Legacy Knob');
    });

    it('defaults elements without palette config to Other under their tag name', () => {
        const el = makePalette();
        el._rebuildCategories();
        const other = el.categories.find(c => c.name === 'Other');
        expect(other.elements[0]).toEqual({el: 'feezal-element-pal-bare', name: 'feezal-element-pal-bare', category: 'Other'});
    });

    it('skips packages whose custom element is not registered', () => {
        const el = makePalette();
        el._rebuildCategories();
        const all = el.categories.flatMap(c => c.elements.map(e => e.el));
        expect(all).not.toContain('feezal-element-pal-unregistered');
    });

    it('lists site components first, in the fixed category order', () => {
        feezal.site = makeSiteWithComponents('thermostat');
        const el = makePalette();
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Components', 'Basic', 'Paper', 'Other']);
    });

    it('creates a feezal-component palette entry per site component', () => {
        feezal.site = makeSiteWithComponents('thermostat', 'gauge');
        const el = makePalette();
        el._rebuildCategories();
        const components = el.categories.find(c => c.name === 'Components');
        expect(components.elements).toEqual([
            {el: 'feezal-component', name: 'thermostat', component: 'thermostat'},
            {el: 'feezal-component', name: 'gauge', component: 'gauge'},
        ]);
    });

    it('ignores component templates without a name', () => {
        feezal.site = makeSiteWithComponents('');
        const el = makePalette();
        el._rebuildCategories();
        expect(el.categories.find(c => c.name === 'Components')).toBeUndefined();
    });

    it('filters elements and components by name, case-insensitively', () => {
        feezal.site = makeSiteWithComponents('thermostat');
        const el = makePalette();
        el.filter = 'BUTTON';
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Basic']);

        el.filter = 'thermo';
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Components']);
    });

    // B42: the filter also matches the category and the tag name (family) —
    // "paper" or "lcars" must find the family even though no element NAME
    // contains it.
    it('filters by category name', () => {
        const el = makePalette();
        el.filter = 'paper';
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Paper']);
        expect(el.categories[0].elements.map(e => e.name)).toEqual(['Legacy Knob']);
    });

    it('filters by tag/family name', () => {
        class LcarsEl extends HTMLElement {
            static feezal = {palette: {name: 'Gauge', category: 'LCARS'}};
        }
        customElements.define('feezal-element-lcars-gauge', LcarsEl);
        feezal.elements = ['@feezal/feezal-element-pal-button', '@feezal/feezal-element-lcars-gauge'];
        const el = makePalette();
        el.filter = 'lcars';
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['LCARS']);
    });

    it('ignores surrounding whitespace in the filter', () => {
        const el = makePalette();
        el.filter = '  button  ';
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Basic']);
    });

    it('sorts unknown categories alphabetically after the known ones', () => {
        class ZebraEl extends HTMLElement {
            static feezal = {palette: {name: 'Zebra', category: 'Zebra'}};
        }
        class AlphaEl extends HTMLElement {
            static feezal = {palette: {name: 'Alpha', category: 'Alpha'}};
        }
        customElements.define('feezal-element-pal-zebra', ZebraEl);
        customElements.define('feezal-element-pal-alpha', AlphaEl);
        feezal.elements = ['@feezal/feezal-element-pal-button', '@feezal/feezal-element-pal-zebra', '@feezal/feezal-element-pal-alpha'];
        const el = makePalette();
        el._rebuildCategories();
        expect(el.categories.map(c => c.name)).toEqual(['Basic', 'Alpha', 'Zebra']);
    });
});

describe('_applySnappedPos clamping (palette-drag restrict)', () => {
    // The palette drag moves the new element manually, so it doesn't get the
    // interact `restrict` modifier a regular element drag has — the displayed
    // position is clamped to the view bounds instead (raw _dragPos stays
    // unclamped for the drag-back-to-palette cancel gesture).
    function setup() {
        feezal.view = {getBoundingClientRect: () => ({x: 0, y: 0, width: 800, height: 600})};
        feezal.editor = {_snap: vi.fn(() => undefined)};
        const palette = makePalette();
        palette.newElem = document.createElement('div');
        palette.newElem.getBoundingClientRect = () => ({width: 100, height: 50});
        return palette;
    }

    it('keeps an in-bounds position unchanged', () => {
        const palette = setup();
        palette._dragPos = {x: 200, y: 150};
        palette._applySnappedPos();
        expect(palette.newElem.style.left).toBe('200px');
        expect(palette.newElem.style.top).toBe('150px');
    });

    it('clamps negative positions to the view origin', () => {
        const palette = setup();
        palette._dragPos = {x: -250, y: -40};
        palette._applySnappedPos();
        expect(palette.newElem.style.left).toBe('0px');
        expect(palette.newElem.style.top).toBe('0px');
        // Raw position stays unclamped (cancel gesture reads it in onend).
        expect(palette._dragPos.x).toBe(-250);
    });

    it('clamps to the far edges minus the element size (1px bottom reserve)', () => {
        const palette = setup();
        palette._dragPos = {x: 5000, y: 5000};
        palette._applySnappedPos();
        expect(palette.newElem.style.left).toBe('700px');   // 800 - 100
        expect(palette.newElem.style.top).toBe('549px');    // 600 - 50 - 1
    });

    it('the border clamp wins over a snap target outside the view', () => {
        const palette = setup();
        feezal.editor._snap = () => ({x: 820, y: 610, range: 100});
        palette._dragPos = {x: 790, y: 590};
        palette._applySnappedPos();
        expect(palette.newElem.style.left).toBe('700px');
        expect(palette.newElem.style.top).toBe('549px');
    });
});

describe('collapsed-category persistence', () => {
    it('toggles a category and persists the collapsed set', () => {
        const el = makePalette();
        el._toggleCategory('Basic');
        expect(el._collapsed.has('Basic')).toBe(true);
        expect(JSON.parse(localStorage.getItem('feezal-palette-collapsed'))).toEqual(['Basic']);

        el._toggleCategory('Basic');
        expect(el._collapsed.has('Basic')).toBe(false);
        expect(JSON.parse(localStorage.getItem('feezal-palette-collapsed'))).toEqual([]);
    });

    it('restores the collapsed set from localStorage', () => {
        localStorage.setItem('feezal-palette-collapsed', JSON.stringify(['Paper']));
        expect(makePalette()._collapsed.has('Paper')).toBe(true);
    });

    it('starts expanded when the stored value is corrupt', () => {
        localStorage.setItem('feezal-palette-collapsed', '{not json');
        expect(makePalette()._collapsed.size).toBe(0);
    });

    it('first run (no stored value): collapses everything except Basic on first rebuild', () => {
        const el = makePalette();               // localStorage cleared in beforeEach
        el._rebuildCategories();
        const names = el.categories.map(c => c.name);
        expect(names).toContain('Basic');
        expect(el._collapsed.has('Basic')).toBe(false);
        for (const n of names.filter(n => n !== 'Basic')) {
            expect(el._collapsed.has(n)).toBe(true);
        }
        // Persisted, so it only happens once.
        expect(JSON.parse(localStorage.getItem('feezal-palette-collapsed'))).not.toContain('Basic');
    });

    it('an existing empty stored value keeps SHIPPED families expanded; an unknown family still defaults collapsed', () => {
        // Not first run (collapsed key present), and no "seen" record yet →
        // migration seeds seen with the shipped families, so Basic/Paper stay
        // expanded, but the unrecognised "Other" category defaults collapsed.
        localStorage.setItem('feezal-palette-collapsed', '[]');
        const el = makePalette();
        el._rebuildCategories();
        expect(el._collapsed.has('Basic')).toBe(false);
        expect(el._collapsed.has('Paper')).toBe(false);
        expect(el._collapsed.has('Other')).toBe(true);   // new/unknown → collapsed
    });

    it('a newly appeared family defaults collapsed without disturbing existing choices (the Eink upgrade case)', () => {
        // User had already seen Basic/Paper/Other and left Paper expanded
        // (only Other collapsed). A freshly installed "Eink" family appears.
        localStorage.setItem('feezal-palette-collapsed', JSON.stringify(['Other']));
        localStorage.setItem('feezal-palette-seen', JSON.stringify(['Basic', 'Paper', 'Other']));
        class PaletteEink extends HTMLElement {
            static feezal = {palette: {name: 'Eink Thing', category: 'Eink'}};
        }
        customElements.define('feezal-element-pal-eink', PaletteEink);
        feezal.elements = [...feezal.elements, '@feezal/feezal-element-pal-eink'];

        const el = makePalette();
        el._rebuildCategories();
        expect(el._collapsed.has('Eink')).toBe(true);     // new family collapses
        expect(el._collapsed.has('Paper')).toBe(false);   // user's expand preserved
        expect(el._collapsed.has('Other')).toBe(true);    // untouched
        expect(JSON.parse(localStorage.getItem('feezal-palette-seen'))).toContain('Eink');
    });
});

describe('component context menu actions', () => {
    beforeEach(() => {
        feezal.app = {
            _openComponentEdit: vi.fn(),
            _componentRenameOpen: vi.fn(),
            _componentDeleteRequest: vi.fn(),
        };
    });

    it('routes edit/rename/delete to the editor app and closes the menu', () => {
        const el = makePalette();
        for (const [action, spy] of [
            ['edit', feezal.app._openComponentEdit],
            ['rename', feezal.app._componentRenameOpen],
            ['delete', feezal.app._componentDeleteRequest],
        ]) {
            el._componentCtx = {x: 0, y: 0, name: 'thermostat'};
            el._componentCtxAction(action);
            expect(spy).toHaveBeenCalledWith('thermostat');
            expect(el._componentCtx).toBeNull();
        }
    });

    it('does nothing without an open context menu', () => {
        const el = makePalette();
        el._componentCtx = null;
        el._componentCtxAction('edit');
        expect(feezal.app._openComponentEdit).not.toHaveBeenCalled();
    });
});
