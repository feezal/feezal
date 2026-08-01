/**
 * U87 — the Layers sidebar panel: a tree of every view and its elements, only
 * the current view expanded; fuzzy filtering across all views; selection
 * mirroring (read from the canvas's own `feezal-selected` class); lock toggle;
 * drag-to-restack; live DOM tracking.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-sidebar-layers.js';
import {setupFeezal, until} from './helpers.js';

let feezal;
let site;
let inspector;

function addView(name) {
    const view = document.createElement('feezal-view');
    view.setAttribute('name', name);
    site.append(view);
    return view;
}

function addElement(view, tag, attrs = {}) {
    const el = document.createElement(tag);
    el.classList.add('feezal-editable');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    view.append(el);
    return el;
}

async function mountPanel(currentView = 'main') {
    const panel = document.createElement('feezal-sidebar-layers');
    panel.view = currentView;
    document.body.append(panel);
    await panel.updateComplete;
    return panel;
}

const viewRows = p => [...p.shadowRoot.querySelectorAll('.view-row')];
const viewNames = p => viewRows(p).map(r => r.querySelector('.view-name').textContent.trim());
const rows = p => [...p.shadowRoot.querySelectorAll('li')];
const labels = p => rows(p).map(li => li.querySelector('.label').textContent.trim());
const type = async (p, text) => {
    const input = p.shadowRoot.querySelector('.search input');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await p.updateComplete;
};

beforeEach(() => {
    feezal = setupFeezal();
    document.body.innerHTML = '';
    site = document.createElement('feezal-site');
    document.body.append(site);
    site.view = 'main';
    feezal.site = site;
    inspector = {selectElement: vi.fn(), setLocked: vi.fn()};
    feezal.app = {
        shadowRoot: {querySelector: sel => (sel === 'feezal-sidebar-inspector' ? inspector : null)},
        change: vi.fn(),
        _setView: vi.fn(name => { site.view = name; }),
    };
});

describe('tree structure', () => {
    it('lists every view, with only the current one expanded', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'in main'});
        addElement(other, 'feezal-element-basic-icon', {label: 'in other'});

        const panel = await mountPanel('main');
        expect(viewNames(panel)).toEqual(['main', 'other']);
        // only the current view's elements are rendered
        expect(labels(panel)).toEqual(['in main']);
        expect(viewRows(panel)[0].querySelector('.caret').textContent.trim()).toBe('▾');
        expect(viewRows(panel)[1].querySelector('.caret').textContent.trim()).toBe('▸');
    });

    it('shows the element count per view even while collapsed', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        addElement(other, 'feezal-element-basic-icon', {label: 'c'});
        const panel = await mountPanel('main');
        expect(viewRows(panel).map(r => r.querySelector('.badge').textContent.trim())).toEqual(['1', '2']);
    });

    it('clicking a view header expands it, and can collapse the current one', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');

        viewRows(panel)[1].click();                      // expand 'other'
        await panel.updateComplete;
        expect(labels(panel)).toEqual(['a', 'b']);

        viewRows(panel)[0].click();                      // collapse 'main'
        await panel.updateComplete;
        expect(labels(panel)).toEqual(['b']);
    });

    it('lists a view element TOP-MOST first (reverse paint order)', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'bottom'});
        addElement(main, 'feezal-element-basic-icon', {label: 'top'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['top', 'bottom']);
    });

    it('marks the current view and ignores non-canvas children', async () => {
        const main = addView('main');
        main.append(document.createElement('style'));
        addElement(main, 'feezal-element-basic-number', {label: 'only'});
        const panel = await mountPanel('main');
        expect(viewRows(panel)[0].classList.contains('current')).toBe(true);
        expect(labels(panel)).toEqual(['only']);
    });

    it('empty site → an explanatory empty state', async () => {
        const panel = await mountPanel('main');
        expect(panel.shadowRoot.querySelector('.empty').textContent).toContain('no elements');
    });
});

describe('fuzzy filter', () => {
    beforeEach(() => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'Kitchen temperature', subscribe: 'home/kt/temp'});
        addElement(main, 'feezal-element-basic-icon', {label: 'Lamp', publish: 'home/lamp/set'});
        addElement(other, 'feezal-element-basic-number', {label: 'Bath temp', subscribe: 'home/bath/temp'});
    });

    it('finds matches across ALL views, auto-expanding the ones that hit', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'temp');
        expect(labels(panel).sort()).toEqual(['Bath temp', 'Kitchen temperature']);
        // 'other' was collapsed but its hit is visible
        expect(viewNames(panel)).toEqual(['main', 'other']);
    });

    it('matches on the topic as well as the label', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'lamp/set');
        expect(labels(panel)).toEqual(['Lamp']);
    });

    it('matches on the element type', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'icon');
        expect(labels(panel)).toEqual(['Lamp']);
    });

    it('accepts a scattered subsequence', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'ktemp');
        expect(labels(panel)).toContain('Kitchen temperature');
    });

    it('hides views with no hit and reports a miss', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'lamp');
        expect(viewNames(panel)).toEqual(['main']);        // 'other' has no hit
        await type(panel, 'zzzz');
        expect(rows(panel)).toHaveLength(0);
        expect(panel.shadowRoot.querySelector('.empty').textContent).toContain('Nothing matches');
    });

    it('clearing the filter restores the default expansion', async () => {
        const panel = await mountPanel('main');
        await type(panel, 'temp');
        await type(panel, '');
        expect(labels(panel)).toEqual(['Lamp', 'Kitchen temperature']);   // main only
    });
});

describe('selection mirroring', () => {
    it('a plain click selects that element via the inspector', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(main, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        rows(panel)[1].click();                       // 'a' is the bottom row
        await panel.updateComplete;
        expect(inspector.selectElement).toHaveBeenCalledWith([a]);
    });

    it('reads the canvas selection from the feezal-selected class', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(main, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        a.classList.add('feezal-selected');
        await until(() => panel.shadowRoot.querySelectorAll('li.selected').length === 1);
        expect(panel.shadowRoot.querySelector('li.selected .label').textContent.trim()).toBe('a');
    });

    it('ctrl+click extends and removes', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const b = addElement(main, 'feezal-element-basic-icon', {label: 'b'});
        a.classList.add('feezal-selected');
        const panel = await mountPanel('main');
        rows(panel)[0].dispatchEvent(new MouseEvent('click', {ctrlKey: true, bubbles: true}));
        await panel.updateComplete;
        expect(inspector.selectElement).toHaveBeenCalledWith([a, b]);
    });

    it('clicking an element in ANOTHER view switches to that view first', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const b = addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        viewRows(panel)[1].click();                   // expand 'other'
        await panel.updateComplete;
        panel.shadowRoot.querySelectorAll('li')[1].click();
        await until(() => inspector.selectElement.mock.calls.length > 0);
        expect(feezal.app._setView).toHaveBeenCalledWith('other');
        expect(inspector.selectElement).toHaveBeenCalledWith([b]);
    });
});

describe('lock and restack', () => {
    it('the lock toggle locks without selecting the row', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        rows(panel)[0].querySelector('.lock').click();
        expect(a.hasAttribute('locked')).toBe(true);
        expect(inspector.setLocked).toHaveBeenCalledWith(a, true);
        expect(inspector.selectElement).not.toHaveBeenCalled();
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('dragging a top row onto a lower one sends it back in paint order', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'bottom'});
        addElement(main, 'feezal-element-basic-icon', {label: 'top'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['top', 'bottom']);

        const dt = () => ({effectAllowed: '', setData() {}, getData: () => ''});
        rows(panel)[0].dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true}), {dataTransfer: dt()}));
        rows(panel)[1].dispatchEvent(Object.assign(new Event('drop', {bubbles: true}), {dataTransfer: dt()}));
        await until(() => labels(panel)[0] === 'bottom');
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('never moves an element across views', async () => {
        const main = addView('main');
        const other = addView('other');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const b = addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        viewRows(panel)[1].click();
        await panel.updateComplete;

        const dt = () => ({effectAllowed: '', setData() {}, getData: () => ''});
        rows(panel)[0].dispatchEvent(Object.assign(new Event('dragstart', {bubbles: true}), {dataTransfer: dt()}));
        rows(panel)[1].dispatchEvent(Object.assign(new Event('drop', {bubbles: true}), {dataTransfer: dt()}));
        await panel.updateComplete;
        expect(a.parentElement).toBe(main);
        expect(b.parentElement).toBe(other);
    });
});

describe('live tracking', () => {
    it('picks up elements added and removed elsewhere', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'one'});
        const panel = await mountPanel('main');
        expect(rows(panel)).toHaveLength(1);

        addElement(main, 'feezal-element-basic-icon', {label: 'two'});
        await until(() => rows(panel).length === 2);
        expect(labels(panel)).toEqual(['two', 'one']);

        main.querySelector('[label="one"]').remove();
        await until(() => rows(panel).length === 1);
    });

    it('picks up a whole new view', async () => {
        addView('main');
        const panel = await mountPanel('main');
        const fresh = addView('fresh');
        addElement(fresh, 'feezal-element-basic-number', {label: 'x'});
        await until(() => viewNames(panel).length === 2);
        expect(viewNames(panel)).toEqual(['main', 'fresh']);
    });
});

describe('icon column and tooltips', () => {
    it('reserves the icon column even when an element has no palette icon', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'no icon'});
        const panel = await mountPanel('main');
        const ico = panel.shadowRoot.querySelector('.ico');
        expect(ico).not.toBeNull();
        // fixed width, so labels in rows with and without a glyph line up
        expect(Math.round(ico.getBoundingClientRect().width)).toBe(18);
    });

    it('shows the element TYPE as the icon and label tooltip', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-glass-contact', {label: 'Front door'});
        const panel = await mountPanel('main');
        expect(panel.shadowRoot.querySelector('.ico').getAttribute('title')).toBe('glass-contact');
        expect(panel.shadowRoot.querySelector('.label').getAttribute('title')).toBe('glass-contact');
    });
});

describe('late site load', () => {
    it('renders once the site appears, without needing a filter keystroke', async () => {
        // the editor mounts its sidebar panels BEFORE the site markup arrives
        feezal.site = null;
        const panel = await mountPanel('main');
        expect(panel.shadowRoot.querySelectorAll('.view-row')).toHaveLength(0);

        feezal.site = site;
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'late'});
        await until(() => panel.shadowRoot.querySelectorAll('li').length === 1, {timeout: 3000});
        expect(labels(panel)).toEqual(['late']);
    });
});

describe('context menu', () => {
    const ctx = p => p.shadowRoot.querySelector('.ctx');
    const items = p => [...p.shadowRoot.querySelectorAll('.ctx-item')].map(i => i.textContent.trim());
    const rightClick = node =>
        node.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 40, clientY: 60}));

    it('right-clicking an element offers the canvas actions and delegates them', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        inspector._ctxAction = vi.fn();

        rightClick(rows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        expect(items(panel)).toEqual(expect.arrayContaining(
            ['Cut', 'Copy', 'Duplicate', 'Bring to front', 'Send to back', 'Lock', 'Delete']));

        [...panel.shadowRoot.querySelectorAll('.ctx-item')]
            .find(i => i.textContent.trim() === 'Duplicate').click();
        expect(inspector._ctxAction).toHaveBeenCalledWith('duplicate');
        await panel.updateComplete;
        expect(ctx(panel)).toBeNull();          // closes after the action
        expect(a.isConnected).toBe(true);
    });

    it('selects the row first when right-clicking an unselected element', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        rightClick(rows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        expect(inspector.selectElement).toHaveBeenCalledWith([a]);
    });

    it('offers move/copy to the OTHER views only, delegating to the inspector', async () => {
        const main = addView('main');
        addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        inspector._ctxCopyToView = vi.fn();

        rightClick(rows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        expect(items(panel).filter(t => t === 'other')).toHaveLength(2);   // move + copy

        [...panel.shadowRoot.querySelectorAll('.ctx-item')]
            .filter(i => i.textContent.trim() === 'other')[0].click();
        expect(inspector._ctxCopyToView).toHaveBeenCalledWith('other', true);   // move
    });

    it('right-clicking a view header offers view operations', async () => {
        addView('main');
        const panel = await mountPanel('main');
        feezal.app._editView = vi.fn();
        feezal.app._duplicateView = vi.fn();
        feezal.app._confirmDeleteView = vi.fn();

        rightClick(viewRows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        expect(items(panel)).toEqual(['Open view', 'Rename…', 'Duplicate', 'Delete view']);

        [...panel.shadowRoot.querySelectorAll('.ctx-item')]
            .find(i => i.textContent.trim() === 'Duplicate').click();
        expect(feezal.app._duplicateView).toHaveBeenCalledWith('main');
    });
});

describe('drag onto a view header', () => {
    const dt = () => ({effectAllowed: '', dropEffect: '', setData() {}, getData: () => ''});
    const fire = (node, type, init = {}) =>
        node.dispatchEvent(Object.assign(new Event(type, {bubbles: true, cancelable: true}),
            {dataTransfer: dt(), ...init}));

    it('MOVES the element into the target view', async () => {
        const main = addView('main');
        const other = addView('other');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        feezal.app._clone = el => el.cloneNode(true);

        fire(rows(panel)[0], 'dragstart');
        fire(viewRows(panel)[1], 'dragover');
        fire(viewRows(panel)[1], 'drop');
        await panel.updateComplete;

        expect(a.isConnected).toBe(false);                       // original gone
        expect(other.querySelectorAll('[label="a"]')).toHaveLength(1);
        expect(main.querySelectorAll('[label="a"]')).toHaveLength(0);
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('COPIES when Ctrl is held, leaving the original in place', async () => {
        const main = addView('main');
        const other = addView('other');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        feezal.app._clone = el => el.cloneNode(true);

        fire(rows(panel)[0], 'dragstart', {ctrlKey: true});
        fire(viewRows(panel)[1], 'dragover', {ctrlKey: true});
        fire(viewRows(panel)[1], 'drop', {ctrlKey: true});
        await panel.updateComplete;

        expect(a.isConnected).toBe(true);                        // original kept
        expect(main.querySelectorAll('[label="a"]')).toHaveLength(1);
        expect(other.querySelectorAll('[label="a"]')).toHaveLength(1);
    });

    it('sets the drop effect so the cursor shows copy vs move', async () => {
        const main = addView('main');
        addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');

        fire(rows(panel)[0], 'dragstart');
        const move = dt();
        viewRows(panel)[1].dispatchEvent(Object.assign(
            new Event('dragover', {bubbles: true, cancelable: true}), {dataTransfer: move}));
        expect(move.dropEffect).toBe('move');

        const copy = dt();
        viewRows(panel)[1].dispatchEvent(Object.assign(
            new Event('dragover', {bubbles: true, cancelable: true}),
            {dataTransfer: copy, ctrlKey: true}));
        expect(copy.dropEffect).toBe('copy');
    });

    it('dropping on the element OWN view does nothing', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        fire(rows(panel)[0], 'dragstart');
        fire(viewRows(panel)[0], 'drop');
        await panel.updateComplete;
        expect(a.parentElement).toBe(main);
        expect(main.querySelectorAll('[label="a"]')).toHaveLength(1);
    });
});
