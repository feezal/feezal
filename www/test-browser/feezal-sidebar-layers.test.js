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
    // The panel persists its open views — clear it so each test starts from
    // the documented default (only the current view expanded).
    localStorage.removeItem('feezal-layers-open-views');
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

describe('panel chrome', () => {
    it('carries a tab bar like the inspector, with the Elements tab', async () => {
        addView('main');
        const panel = await mountPanel('main');
        const group = panel.shadowRoot.querySelector('sl-tab-group');
        expect(group).not.toBeNull();
        const tabs = [...panel.shadowRoot.querySelectorAll('sl-tab')];
        expect(tabs.map(t => t.textContent.trim())).toEqual(['Elements']);
        expect(tabs[0].getAttribute('panel')).toBe('elements');
        expect(panel.shadowRoot.querySelector('sl-tab-panel[name="elements"]')).not.toBeNull();
    });

    it('the tree and filter live inside the tab panel', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        const tabPanel = panel.shadowRoot.querySelector('sl-tab-panel[name="elements"]');
        expect(tabPanel.querySelector('.search input')).not.toBeNull();
        expect(tabPanel.querySelector('.tree')).not.toBeNull();
        expect(tabPanel.querySelectorAll('li')).toHaveLength(1);
    });
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

    it('lists a view element in DOM order, the order the canvas reads in', async () => {
        // Deliberately NOT the usual layers-panel "top-most first": flow and
        // grid views lay their children out in DOM order, so reversing ran the
        // tree backwards against what the user is looking at.
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'first'});
        addElement(main, 'feezal-element-basic-icon', {label: 'second'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['first', 'second']);
    });

    it('marks the current view and ignores non-canvas children', async () => {
        const main = addView('main');
        main.append(document.createElement('style'));
        addElement(main, 'feezal-element-basic-number', {label: 'only'});
        const panel = await mountPanel('main');
        expect(viewRows(panel)[0].classList.contains('current')).toBe(true);
        expect(labels(panel)).toEqual(['only']);
    });

    it('lists elements of a view the editor has not initialised yet', async () => {
        // `feezal-editable` is stamped when the editor initialises a view, so
        // a view not visited in this session has none — its elements must
        // still appear (after a reload that is EVERY view but the current one).
        const main = addView('main');
        const el = document.createElement('feezal-element-basic-number');
        el.setAttribute('label', 'never visited');      // deliberately no class
        main.append(el);
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['never visited']);
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

    it('clearing the filter leaves the expansion state alone', async () => {
        // Filtering force-expands matching views transiently; clearing it
        // returns to whatever was open — it must not COLLAPSE anything the
        // user (or a selection) had opened.
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['Kitchen temperature', 'Lamp']);   // main only
        await type(panel, 'temp');
        await type(panel, '');
        expect(labels(panel)).toEqual(['Kitchen temperature', 'Lamp']);
    });
});

describe('selection mirroring', () => {
    it('a plain click selects that element via the inspector', async () => {
        const main = addView('main');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(main, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        rows(panel)[0].click();                       // 'a' is the first row
        await panel.updateComplete;
        expect(inspector.selectElement).toHaveBeenCalledWith([a], {});
    });

    it('selecting here does NOT swap the sidebar to the Inspector', async () => {
        // Selection never moves the sidebar (only ADDING an element does), so
        // the tree must not ask for a reveal either.
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        rows(panel)[0].click();
        await panel.updateComplete;
        const [, opts] = inspector.selectElement.mock.calls[0];
        expect(opts?.revealInspector).toBeFalsy();
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
        rows(panel)[1].dispatchEvent(new MouseEvent('click', {ctrlKey: true, bubbles: true}));
        await panel.updateComplete;
        expect(inspector.selectElement).toHaveBeenCalledWith([a, b], {});
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
        expect(inspector.selectElement).toHaveBeenCalledWith([b], {});
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

    const DT = () => ({effectAllowed: '', setData() {}, getData: () => ''});

    async function dragRow(panel, fromIdx, toIdx) {
        rows(panel)[fromIdx].dispatchEvent(
            Object.assign(new Event('dragstart', {bubbles: true}), {dataTransfer: DT()}));
        rows(panel)[toIdx].dispatchEvent(
            Object.assign(new Event('drop', {bubbles: true}), {dataTransfer: DT()}));
    }

    it('dragging a row DOWN drops it after the row it lands on', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'first'});
        addElement(main, 'feezal-element-basic-icon', {label: 'second'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['first', 'second']);

        await dragRow(panel, 0, 1);
        await until(() => labels(panel)[0] === 'second');
        expect(labels(panel)).toEqual(['second', 'first']);
        expect(feezal.app.change).toHaveBeenCalled();
    });

    it('dragging a row UP drops it before the row it lands on', async () => {
        // The mirror case: both insert branches flipped when the tree stopped
        // being reversed, so the upward direction needs its own guard.
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'first'});
        addElement(main, 'feezal-element-basic-icon', {label: 'second'});
        addElement(main, 'feezal-element-basic-icon', {label: 'third'});
        const panel = await mountPanel('main');

        await dragRow(panel, 2, 0);
        await until(() => labels(panel)[0] === 'third');
        expect(labels(panel)).toEqual(['third', 'first', 'second']);
    });

    it('never moves an element across views', async () => {
        const main = addView('main');
        const other = addView('other');
        const a = addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const b = addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        viewRows(panel)[1].click();
        await panel.updateComplete;

        await dragRow(panel, 0, 1);
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
        expect(labels(panel)).toEqual(['one', 'two']);

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
        addElement(main, 'feezal-element-glass-contact', {label: 'has icon'});
        const panel = await mountPanel('main');
        // The rows live inside an <sl-tab-panel>, which Shoelace keeps
        // display:none until it activates its first tab — so wait for layout
        // rather than measuring on the first frame.
        await until(() => panel.shadowRoot.querySelector('.ico')?.getBoundingClientRect().width > 0);

        const icons = [...panel.shadowRoot.querySelectorAll('.ico')];
        expect(icons.map(i => Math.round(i.getBoundingClientRect().width))).toEqual([18, 18]);
        // the point of the fixed column: labels line up whether or not the
        // element's package declares a palette icon
        const xs = [...panel.shadowRoot.querySelectorAll('.label')]
            .map(l => Math.round(l.getBoundingClientRect().left));
        expect(xs[0]).toBe(xs[1]);
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
        expect(inspector.selectElement).toHaveBeenCalledWith([a], {});
    });

    it('offers move/copy as hover submenus listing the OTHER views', async () => {
        const main = addView('main');
        addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        inspector._ctxCopyToView = vi.fn();

        rightClick(rows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        // the views are behind flyouts, not listed flat
        expect(items(panel)).toEqual(expect.arrayContaining(['Copy to view… ▶', 'Move to view… ▶']));
        expect(items(panel)).not.toContain('other');

        const moveItem = [...panel.shadowRoot.querySelectorAll('.ctx-item.has-sub')]
            .find(i => i.textContent.includes('Move to view'));
        moveItem.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
        await until(() => Boolean(panel.shadowRoot.querySelector('.ctx-sub')));

        const subItems = [...panel.shadowRoot.querySelectorAll('.ctx-sub .ctx-item')];
        expect(subItems.map(i => i.textContent.trim())).toEqual(['other']);   // never itself
        subItems[0].click();
        expect(inspector._ctxCopyToView).toHaveBeenCalledWith('other', true);   // move
    });

    it('the copy submenu copies instead of moving', async () => {
        const main = addView('main');
        addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        inspector._ctxCopyToView = vi.fn();

        rightClick(rows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        const copyItem = [...panel.shadowRoot.querySelectorAll('.ctx-item.has-sub')]
            .find(i => i.textContent.includes('Copy to view'));
        copyItem.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
        await until(() => Boolean(panel.shadowRoot.querySelector('.ctx-sub')));
        panel.shadowRoot.querySelector('.ctx-sub .ctx-item').click();
        expect(inspector._ctxCopyToView).toHaveBeenCalledWith('other', false);
    });

    it('clamps a menu opened near the bottom/right back into the viewport', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        // open it beyond the viewport's bottom-right corner
        rows(panel)[0].dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, clientX: window.innerWidth - 5, clientY: window.innerHeight - 5,
        }));
        await until(() => Boolean(ctx(panel)));
        await until(() => {
            const r = ctx(panel).getBoundingClientRect();
            return r.right <= window.innerWidth && r.bottom <= window.innerHeight;
        });
        const r = ctx(panel).getBoundingClientRect();
        expect(r.right).toBeLessThanOrEqual(window.innerWidth);
        expect(r.bottom).toBeLessThanOrEqual(window.innerHeight);
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.top).toBeGreaterThanOrEqual(0);
    });

    it('right-clicking a view header offers view operations', async () => {
        addView('main');
        const panel = await mountPanel('main');
        feezal.app._editView = vi.fn();
        feezal.app._duplicateView = vi.fn();
        feezal.app._confirmDeleteView = vi.fn();

        rightClick(viewRows(panel)[0]);
        await until(() => Boolean(ctx(panel)));
        // U109 added the whole-view clipboard entries.
        expect(items(panel)).toEqual(['Open view', 'Rename…', 'Duplicate',
            'Copy view', 'Cut view', 'Paste view', 'Delete view']);

        [...panel.shadowRoot.querySelectorAll('.ctx-item')]
            .find(i => i.textContent.trim() === 'Duplicate').click();
        expect(feezal.app._duplicateView).toHaveBeenCalledWith('main');
    });

    it('U109: the view clipboard entries delegate to the editor shell', async () => {
        addView('main');
        const panel = await mountPanel('main');
        feezal.app._copyView = vi.fn();
        feezal.app._cutView = vi.fn();
        feezal.app._pasteViewFromClipboard = vi.fn();

        for (const [label, spy, arg] of [
            ['Copy view', () => feezal.app._copyView, 'main'],
            ['Cut view', () => feezal.app._cutView, 'main'],
            ['Paste view', () => feezal.app._pasteViewFromClipboard, undefined],
        ]) {
            rightClick(viewRows(panel)[0]);
            await until(() => Boolean(ctx(panel)));
            [...panel.shadowRoot.querySelectorAll('.ctx-item')]
                .find(i => i.textContent.trim() === label).click();
            if (arg === undefined) expect(spy()).toHaveBeenCalled();
            else expect(spy()).toHaveBeenCalledWith(arg);
        }
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

describe('expansion model (never auto-collapse, persist)', () => {
    it('starts with only the current view open', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['a']);
    });

    it('switching the current view OPENS it and leaves the previous one open', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['a']);

        panel.view = 'other';                       // the editor switched view
        await panel.updateComplete;
        await panel.updateComplete;
        // 'main' must NOT have collapsed behind the user's back
        expect(labels(panel).sort()).toEqual(['a', 'b']);
    });

    it('selecting an element opens the view that holds it', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const b = addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['a']);

        b.classList.add('feezal-selected');          // selected on the canvas
        await until(() => labels(panel).includes('b'));
        expect(labels(panel).sort()).toEqual(['a', 'b']);
    });

    it('a header click still collapses deliberately', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        expect(labels(panel)).toEqual(['a']);
        viewRows(panel)[0].click();
        await panel.updateComplete;
        expect(labels(panel)).toEqual([]);
    });

    it('persists the open set across a remount', async () => {
        const main = addView('main');
        const other = addView('other');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        addElement(other, 'feezal-element-basic-icon', {label: 'b'});
        const panel = await mountPanel('main');
        viewRows(panel)[1].click();                  // open 'other' by hand
        await panel.updateComplete;
        expect(labels(panel).sort()).toEqual(['a', 'b']);
        panel.remove();

        const reopened = await mountPanel('main');   // e.g. after a reload
        await reopened.updateComplete;
        expect(labels(reopened).sort()).toEqual(['a', 'b']);
    });

    it('a collapsed view stays collapsed across a remount', async () => {
        const main = addView('main');
        addElement(main, 'feezal-element-basic-number', {label: 'a'});
        const panel = await mountPanel('main');
        viewRows(panel)[0].click();                  // collapse the current view
        await panel.updateComplete;
        panel.remove();

        const reopened = await mountPanel('main');
        await reopened.updateComplete;
        // the current view re-opens on mount (it is what you are working in)
        expect(labels(reopened)).toEqual(['a']);
    });
});
