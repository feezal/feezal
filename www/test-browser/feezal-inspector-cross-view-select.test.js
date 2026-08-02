/**
 * B109 — selecting across views must not leave the previous view's element
 * marked.
 *
 * `selectElement` cleared `feezal-selected` only within the ACTIVE view. The
 * canvas hides inactive views, so a leftover class there was invisible — until
 * the Layers tree, which mirrors the class site-wide, showed two selected rows
 * at once. The stale class is latent state for anything reading selection
 * across views, so the sweep is site-wide and lives in selectElement rather
 * than on the tree's path.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

let feezal, site, ctx;

function addView(name, labels = []) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    view.style.cssText = 'position:relative; display:block; width:300px; height:200px;';
    for (const label of labels) {
        const el = document.createElement('feezal-element-basic-number');
        el.setAttribute('label', label);
        el.className = 'feezal-editable';
        el.feezalEditable = true;
        el.style.cssText = 'position:absolute; left:10px; top:10px; width:60px; height:30px;';
        view.append(el);
    }
    site.append(view);
    return view;
}

const elByLabel = label => site.querySelector(`[label="${label}"]`);
const markedSiteWide = () => [...site.querySelectorAll('.feezal-selected')]
    .map(el => el.getAttribute('label') || el.localName).sort();

beforeEach(() => {
    feezal = setupFeezal({isEditor: true, ready: true});
    site = document.createElement('div');
    document.body.append(site);
    feezal.site = site;
    feezal.getView = name => site.querySelector(`feezal-view[name="${name}"]`);

    ctx = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        view: 'one', selectedElems: [], viewSelected: false,
        _selectedElemsChanged: () => {}, _updateSelection: () => {},
        dispatchEvent: () => {}, requestUpdate: () => {},
    })) {
        Object.defineProperty(ctx, k, {value: v, writable: true});
    }
});

afterEach(() => { document.body.innerHTML = ''; });

describe('B109 — cross-view selection', () => {
    it('clears the previous view element when selecting on another view', () => {
        addView('one', ['a']);
        addView('two', ['b']);

        ctx.selectElement(elByLabel('a'));
        expect(markedSiteWide()).toEqual(['a']);

        // What the Layers tree does: switch the view, then select there.
        ctx.view = 'two';
        ctx.selectElement(elByLabel('b'));
        expect(markedSiteWide()).toEqual(['b']);       // exactly one, on the new view
    });

    it('clears across views when selecting the view itself (empty canvas click)', () => {
        addView('one', ['a']);
        addView('two', ['b']);
        ctx.selectElement(elByLabel('a'));

        ctx.view = 'two';
        ctx.selectElement();                            // falsy → select the view
        expect(markedSiteWide()).toEqual([]);
    });

    it('still supports a multi-selection within one view', () => {
        addView('one', ['a', 'b', 'c']);
        ctx.selectElement([elByLabel('a'), elByLabel('c')]);
        expect(markedSiteWide()).toEqual(['a', 'c']);
    });

    it('replacing a multi-selection leaves nothing behind on either view', () => {
        addView('one', ['a', 'b']);
        addView('two', ['c']);
        ctx.selectElement([elByLabel('a'), elByLabel('b')]);
        expect(markedSiteWide()).toEqual(['a', 'b']);

        ctx.view = 'two';
        ctx.selectElement(elByLabel('c'));
        expect(markedSiteWide()).toEqual(['c']);
    });

    it('falls back to the active view when there is no site element', () => {
        // selectElement runs in contexts where feezal.site may be unset (bare
        // prototype receivers in tests, early boot) — it must not throw.
        const view = addView('one', ['a']);
        feezal.site = null;
        expect(() => ctx.selectElement(elByLabel('a'))).not.toThrow();
        expect([...view.querySelectorAll('.feezal-selected')]).toHaveLength(1);
    });
});
