/**
 * U87 — the element outline / layers panel: paint-order listing, labels and
 * topic hints, selection mirroring (plain / ctrl / shift), the lock toggle,
 * drag-to-restack, and live tracking of DOM changes.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-sidebar-layers.js';
import {setupFeezal, until} from './helpers.js';

let feezal;
let view;
let inspector;

/** A stand-in for the real inspector: the panel calls selectElement on it. */
function fakeInspector() {
    return {
        selectElement: vi.fn(),
        setLocked: vi.fn(),
    };
}

function addElement(tag, attrs = {}) {
    const el = document.createElement(tag);
    el.classList.add('feezal-editable');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    view.append(el);
    return el;
}

async function mountPanel(selected = []) {
    const panel = document.createElement('feezal-sidebar-layers');
    panel.selectedElems = selected;
    // the panel looks for the inspector via closest() then via feezal.app
    feezal.app = {shadowRoot: {querySelector: () => inspector}, change: vi.fn(), toast: vi.fn()};
    document.body.append(panel);
    await panel.updateComplete;
    return panel;
}

const rows = panel => [...panel.shadowRoot.querySelectorAll('li')];
const labels = panel => rows(panel).map(li => li.querySelector('.label').textContent.trim());

beforeEach(() => {
    feezal = setupFeezal();
    inspector = fakeInspector();
    document.body.innerHTML = '';
    view = document.createElement('feezal-view');
    document.body.append(view);
    feezal.view = view;
});

describe('listing', () => {
    it('lists the view elements TOP-MOST first (reverse DOM/paint order)', async () => {
        addElement('feezal-element-basic-number', {label: 'bottom'});
        addElement('feezal-element-basic-icon', {label: 'middle'});
        addElement('feezal-element-basic-text', {label: 'top'});
        const panel = await mountPanel();
        expect(labels(panel)).toEqual(['top', 'middle', 'bottom']);
    });

    it('falls back through label → name → tag, and shows a topic hint', async () => {
        addElement('feezal-element-basic-number', {subscribe: 'home/kitchen/temp'});
        addElement('feezal-element-basic-icon', {label: 'Lamp', publish: 'home/lamp/set'});
        const panel = await mountPanel();
        expect(labels(panel)).toEqual(['Lamp', 'basic-number']);
        const topics = rows(panel).map(li => li.querySelector('.topic')?.textContent.trim());
        expect(topics).toEqual(['home/lamp/set', 'home/kitchen/temp']);
    });

    it('ignores non-canvas children (the classes style block, text nodes)', async () => {
        view.append(document.createElement('style'));
        view.append(document.createTextNode('  '));
        addElement('feezal-element-basic-number', {label: 'only'});
        const panel = await mountPanel();
        expect(labels(panel)).toEqual(['only']);
    });

    it('shows an empty state for a view with no elements', async () => {
        const panel = await mountPanel();
        expect(rows(panel)).toHaveLength(0);
        expect(panel.shadowRoot.querySelector('.empty').textContent).toContain('no elements');
    });

    it('tracks DOM changes made elsewhere (palette drop, delete)', async () => {
        addElement('feezal-element-basic-number', {label: 'one'});
        const panel = await mountPanel();
        expect(rows(panel)).toHaveLength(1);

        addElement('feezal-element-basic-icon', {label: 'two'});
        await until(() => rows(panel).length === 2);
        expect(labels(panel)).toEqual(['two', 'one']);

        view.querySelector('[label="one"]').remove();
        await until(() => rows(panel).length === 1);
        expect(labels(panel)).toEqual(['two']);
    });
});

describe('selection mirroring', () => {
    it('a plain click selects just that element', async () => {
        const a = addElement('feezal-element-basic-number', {label: 'a'});
        addElement('feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel();
        rows(panel)[1].click();                       // 'a' is the bottom row
        expect(inspector.selectElement).toHaveBeenCalledWith([a]);
    });

    it('ctrl+click adds and removes from the selection', async () => {
        const a = addElement('feezal-element-basic-number', {label: 'a'});
        const b = addElement('feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel([a]);
        rows(panel)[0].dispatchEvent(new MouseEvent('click', {ctrlKey: true, bubbles: true}));
        expect(inspector.selectElement).toHaveBeenCalledWith([a, b]);

        inspector.selectElement.mockClear();
        panel.selectedElems = [a, b];
        await panel.updateComplete;
        rows(panel)[0].dispatchEvent(new MouseEvent('click', {ctrlKey: true, bubbles: true}));
        expect(inspector.selectElement).toHaveBeenCalledWith([a]);   // b removed
    });

    it('shift+click selects the range in list order', async () => {
        const a = addElement('feezal-element-basic-number', {label: 'a'});
        const b = addElement('feezal-element-basic-icon', {label: 'b'});
        const c = addElement('feezal-element-basic-text', {label: 'c'});
        const panel = await mountPanel([c]);            // c is the top row
        rows(panel)[2].dispatchEvent(new MouseEvent('click', {shiftKey: true, bubbles: true}));
        expect(inspector.selectElement).toHaveBeenCalledWith([c, b, a]);
    });

    it('marks the selected rows', async () => {
        const a = addElement('feezal-element-basic-number', {label: 'a'});
        addElement('feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel([a]);
        expect(rows(panel).map(li => li.classList.contains('selected'))).toEqual([false, true]);
    });
});

describe('lock toggle', () => {
    it('toggles the attribute, tells the inspector and marks the site dirty', async () => {
        const a = addElement('feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel();
        const lock = rows(panel)[0].querySelector('.lock');

        lock.click();
        expect(a.hasAttribute('locked')).toBe(true);
        expect(inspector.setLocked).toHaveBeenCalledWith(a, true);
        expect(feezal.app.change).toHaveBeenCalled();

        await panel.updateComplete;
        panel.shadowRoot.querySelector('.lock').click();
        expect(a.hasAttribute('locked')).toBe(false);
    });

    it('a lock click does NOT also select the row', async () => {
        addElement('feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel();
        rows(panel)[0].querySelector('.lock').click();
        expect(inspector.selectElement).not.toHaveBeenCalled();
    });
});

describe('drag to restack', () => {
    const dt = () => ({effectAllowed: '', setData() {}, getData: () => ''});

    it('dropping a top row onto a lower one sends it back in paint order', async () => {
        addElement('feezal-element-basic-number', {label: 'bottom'});
        addElement('feezal-element-basic-icon', {label: 'top'});
        const panel = await mountPanel();
        expect(labels(panel)).toEqual(['top', 'bottom']);

        // drag row 0 ('top') onto row 1 ('bottom')
        rows(panel)[0].dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true}), {dataTransfer: dt()}));
        rows(panel)[1].dispatchEvent(Object.assign(new Event('drop', {bubbles: true}), {dataTransfer: dt()}));
        await until(() => labels(panel)[0] === 'bottom');
        expect(labels(panel)).toEqual(['bottom', 'top']);
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('dropping a row on itself changes nothing', async () => {
        addElement('feezal-element-basic-number', {label: 'a'});
        addElement('feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel();
        rows(panel)[0].dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true}), {dataTransfer: dt()}));
        rows(panel)[0].dispatchEvent(Object.assign(new Event('drop', {bubbles: true}), {dataTransfer: dt()}));
        await panel.updateComplete;
        expect(labels(panel)).toEqual(['b', 'a']);
        expect(feezal.app.change).not.toHaveBeenCalled();
    });
});
