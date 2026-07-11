import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector-conditions.js';

beforeEach(() => {
    feezal.isEditor = true;
    feezal.app = {change: vi.fn()};
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

function makeTarget(conditions) {
    const el = document.createElement('div');   // any element with attributes works
    if (conditions) el.setAttribute('conditions', JSON.stringify(conditions));
    document.body.append(el);
    return el;
}

async function mountPanel(target) {
    const panel = document.createElement('feezal-sidebar-inspector-conditions');
    panel.selectedElems = [target];
    document.body.append(panel);
    await panel.updateComplete;
    return panel;
}

describe('conditions inspector panel (E50)', () => {
    it('renders one card per row plus the add button', async () => {
        const target = makeTarget([
            {subscribe: 'a', value: '1', action: 'hide'},
            {subscribe: 'b', value: '2', action: 'class', class: 'x'},
        ]);
        const panel = await mountPanel(target);
        expect(panel.shadowRoot.querySelectorAll('.row-card')).toHaveLength(2);
        expect(panel.shadowRoot.querySelector('.btn').textContent).toContain('Add condition');
    });

    it('add button appends a default row to the attribute and signals change', async () => {
        const target = makeTarget();
        const panel = await mountPanel(target);
        const changed = vi.fn();
        panel.addEventListener('conditions-changed', changed);

        panel.shadowRoot.querySelector('.btn').click();
        await panel.updateComplete;

        const rows = JSON.parse(target.getAttribute('conditions'));
        expect(rows).toHaveLength(1);
        expect(rows[0].action).toBe('hide');
        expect(feezal.app.change).toHaveBeenCalled();
        expect(changed).toHaveBeenCalled();
    });

    it('removing the last row removes the attribute entirely', async () => {
        const target = makeTarget([{subscribe: 'a', value: '1', action: 'hide'}]);
        const panel = await mountPanel(target);

        panel.shadowRoot.querySelector('.ib.danger').click();
        await panel.updateComplete;
        expect(target.hasAttribute('conditions')).toBe(false);
    });

    it('reorder buttons swap rows', async () => {
        const target = makeTarget([
            {subscribe: 'first', value: '1', action: 'hide'},
            {subscribe: 'second', value: '2', action: 'hide'},
        ]);
        const panel = await mountPanel(target);

        // Second card's "move up" button.
        const cards = panel.shadowRoot.querySelectorAll('.row-card');
        cards[1].querySelector('.ib[title="Move up"]').click();
        await panel.updateComplete;

        const rows = JSON.parse(target.getAttribute('conditions'));
        expect(rows.map(r => r.subscribe)).toEqual(['second', 'first']);
    });

    it('patching a field updates the persisted row (empty removes the key)', async () => {
        const target = makeTarget([{subscribe: 'a', operator: '=', value: '1', action: 'class', class: 'x'}]);
        const panel = await mountPanel(target);

        panel._patch(0, 'class', 'warn');
        expect(JSON.parse(target.getAttribute('conditions'))[0].class).toBe('warn');
        panel._patch(0, 'class', '');
        expect(JSON.parse(target.getAttribute('conditions'))[0].class).toBeUndefined();
    });

    // Regression: "+ style property" appended an empty-key entry that
    // _patchStyle immediately filtered out of the persisted object — the new
    // row vanished on re-render and the button appeared to do nothing.
    it('"+ style property" shows a draft row without touching the attribute', async () => {
        const target = makeTarget([{subscribe: 'a', value: '1', action: 'style', style: {color: 'red'}}]);
        const panel = await mountPanel(target);
        const before = target.getAttribute('conditions');

        panel._addStyleDraft(0);
        await panel.updateComplete;

        expect(panel.shadowRoot.querySelectorAll('.style-row')).toHaveLength(2);   // persisted + draft
        expect(target.getAttribute('conditions')).toBe(before);                    // draft not persisted
        expect(feezal.app.change).not.toHaveBeenCalled();
    });

    it('typing a key into the draft persists it; keyless drafts survive edits', async () => {
        const target = makeTarget([{subscribe: 'a', value: '1', action: 'style', style: {}}]);
        const panel = await mountPanel(target);

        panel._addStyleDraft(0);
        // Value typed first (still keyless) → stays a draft, attribute untouched.
        panel._commitStyleEntries(0, [['', 'red']]);
        expect(JSON.parse(target.getAttribute('conditions'))[0].style).toEqual({});
        expect(panel._styleDrafts[0]).toEqual([['', 'red']]);

        // Key typed → persisted, draft consumed.
        panel._commitStyleEntries(0, [['color', 'red']]);
        expect(JSON.parse(target.getAttribute('conditions'))[0].style).toEqual({color: 'red'});
        expect(panel._styleDrafts[0]).toEqual([]);
        await panel.updateComplete;
        expect(panel.shadowRoot.querySelectorAll('.style-row')).toHaveLength(1);
    });

    it('deleting a draft row removes it without touching persisted styles', async () => {
        const target = makeTarget([{subscribe: 'a', value: '1', action: 'style', style: {color: 'red'}}]);
        const panel = await mountPanel(target);
        panel._addStyleDraft(0);
        // Display list: [persisted color, draft] — remove the draft (index 1).
        panel._commitStyleEntries(0, [['color', 'red']]);
        expect(JSON.parse(target.getAttribute('conditions'))[0].style).toEqual({color: 'red'});
        expect(panel._styleDrafts[0]).toEqual([]);
    });

    it('renders nothing without a single-element selection', async () => {
        const panel = document.createElement('feezal-sidebar-inspector-conditions');
        panel.selectedElems = [];
        document.body.append(panel);
        await panel.updateComplete;
        expect(panel.shadowRoot.querySelector('.row-card')).toBeNull();
        expect(panel.shadowRoot.querySelector('.btn')).toBeNull();
    });
});
