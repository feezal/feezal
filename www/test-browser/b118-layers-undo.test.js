/**
 * B118 — after deleting an element through the Layers tree's context menu,
 * Ctrl+Z did nothing until the canvas was clicked. The click on the menu item
 * takes keyboard focus off feezal-site, and undo/redo were gated on canvas
 * focus. Undo/redo are editor-level: they must work from any editor panel as
 * long as no text field is being edited.
 *
 * Real inspector key handler + real Layers panel + real focus movement
 * (userEvent clicks), the editor shell stubbed.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {userEvent} from '@vitest/browser/context';
import '../src/feezal-sidebar-inspector.js';
import '../src/feezal-sidebar-layers.js';
import {setupFeezal, until} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

let feezal, site, inspector, panel;

function addElement(view, label) {
    const el = document.createElement('feezal-element-basic-number');
    el.classList.add('feezal-editable');
    el.setAttribute('label', label);
    view.append(el);
    return el;
}

const keyCombo = (target, key, mods = {}) => target.dispatchEvent(new KeyboardEvent('keydown', {
    key, ctrlKey: true, bubbles: true, composed: true, cancelable: true, ...mods,
}));

beforeEach(async () => {
    feezal = setupFeezal({isEditor: true, ready: true});
    localStorage.removeItem('feezal-layers-open-views');
    document.body.innerHTML = '';
    site = document.createElement('feezal-site');
    site.setAttribute('tabindex', 1);
    document.body.append(site);
    feezal.site = site;
    feezal.getView = name => site.querySelector(`feezal-view[name="${name}"]`);

    inspector = Object.create(FeezalSidebarInspector.prototype);
    for (const [k, v] of Object.entries({
        view: 'main', selectedElems: [], viewSelected: false, _shortcutsOpen: false, _ctxMenu: {},
    }))Object.defineProperty(inspector, k, {value: v, writable: true});
    inspector.dispatchEvent = () => true;

    feezal.app = {
        shadowRoot: {querySelector: sel => (sel === 'feezal-sidebar-inspector' ? inspector : null)},
        querySelector: sel => document.querySelector(sel),
        change: vi.fn(),
        _undo: vi.fn(),
        _redoStep: vi.fn(),
        _setView: vi.fn(name => { site.view = name; }),
    };
    inspector._keyboard();

    const view = document.createElement('feezal-view');
    view.setAttribute('name', 'main');
    site.append(view);
    site.view = 'main';
    addElement(view, 'a');

    panel = document.createElement('feezal-sidebar-layers');
    panel.view = 'main';
    document.body.append(panel);
    await panel.updateComplete;
});

afterEach(() => {
    window.removeEventListener('keydown', inspector._keyHandler);
    document.body.innerHTML = '';
});

async function deleteViaLayersMenu() {
    const row = panel.shadowRoot.querySelector('li');
    await userEvent.click(row);                 // selects → canvas gets focus
    expect(document.activeElement).toBe(site);
    row.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 40, clientY: 60}));
    await until(() => Boolean(panel.shadowRoot.querySelector('.ctx')));
    const del = [...panel.shadowRoot.querySelectorAll('.ctx-item')].find(i => i.textContent.trim() === 'Delete');
    await userEvent.click(del);                 // a real click moves focus off the canvas
    expect(site.querySelector('feezal-element-basic-number')).toBeNull();
    expect(feezal.app.change).toHaveBeenCalled();
}

describe('B118 — undo/redo after a Layers context-menu delete', () => {
    it('Ctrl+Z reaches undo without clicking the canvas first', async () => {
        await deleteViaLayersMenu();
        expect(document.activeElement).not.toBe(site);
        keyCombo(document.activeElement || document.body, 'z');
        expect(feezal.app._undo).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Shift+Z and Ctrl+Y reach redo the same way', async () => {
        await deleteViaLayersMenu();
        keyCombo(document.activeElement || document.body, 'Z', {shiftKey: true});
        keyCombo(document.activeElement || document.body, 'y');
        expect(feezal.app._redoStep).toHaveBeenCalledTimes(2);
        expect(feezal.app._undo).not.toHaveBeenCalled();
    });

    it('a text field in a sidebar keeps its own undo', async () => {
        const input = panel.shadowRoot.querySelector('.search input');
        input.focus();
        keyCombo(input, 'z');
        keyCombo(input, 'y');
        expect(feezal.app._undo).not.toHaveBeenCalled();
        expect(feezal.app._redoStep).not.toHaveBeenCalled();
    });

    it('other canvas shortcuts still need canvas focus', async () => {
        await deleteViaLayersMenu();
        const spy = vi.spyOn(inspector, 'selectElement');
        keyCombo(document.activeElement || document.body, 'a');
        expect(spy).not.toHaveBeenCalled();
    });
});
