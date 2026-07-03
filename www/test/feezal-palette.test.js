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
