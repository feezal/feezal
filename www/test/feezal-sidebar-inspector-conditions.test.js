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

    // U49: the engine has supported a per-row message property (dot-path,
    // default "payload") since E50 — the inspector now exposes it.
    describe('message property (U49)', () => {
        it('renders a property input with a "payload" placeholder', async () => {
            const target = makeTarget([{subscribe: 'a', value: '1', action: 'hide'}]);
            const panel = await mountPanel(target);
            const input = [...panel.shadowRoot.querySelectorAll('sl-input')]
                .find(inp => inp.getAttribute('placeholder') === 'payload');
            expect(input).toBeTruthy();
        });

        it('persists a property and omits it again when cleared', async () => {
            const target = makeTarget([{subscribe: 'a', value: '1', action: 'hide'}]);
            const panel = await mountPanel(target);

            panel._patch(0, 'property', 'val');
            expect(JSON.parse(target.getAttribute('conditions'))[0].property).toBe('val');
            panel._patch(0, 'property', '');
            // Empty must OMIT the key — the engine defaults to "payload";
            // writing it out would bloat every saved row.
            expect('property' in JSON.parse(target.getAttribute('conditions'))[0]).toBe(false);
        });

        it('a hand-authored property survives an unrelated edit', async () => {
            const target = makeTarget([{subscribe: 'a', property: 'state.temp', value: '1', action: 'hide'}]);
            const panel = await mountPanel(target);
            panel._patch(0, 'value', '2');
            const row = JSON.parse(target.getAttribute('conditions'))[0];
            expect(row.property).toBe('state.temp');
            expect(row.value).toBe('2');
        });

        it('shows an existing property value in the input', async () => {
            const target = makeTarget([{subscribe: 'a', property: 'val', value: '1', action: 'hide'}]);
            const panel = await mountPanel(target);
            const input = [...panel.shadowRoot.querySelectorAll('sl-input')]
                .find(inp => inp.getAttribute('placeholder') === 'payload');
            expect(input.value).toBe('val');
        });
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

/**
 * U95 — the same panel now serves a selected VIEW, which accepts fewer actions.
 * Filtering here is not cosmetic: the engine DROPS a show/hide row on a view,
 * so offering one would produce a row that silently does nothing.
 */
describe('conditions inspector on a view (U95)', () => {
    const makeView = conditions => {
        const view = document.createElement('feezal-view');
        if (conditions) view.setAttribute('conditions', JSON.stringify(conditions));
        document.body.append(view);
        return view;
    };
    const actionOptions = panel => [...panel.shadowRoot.querySelectorAll('sl-select')]
        .flatMap(sel => [...sel.querySelectorAll('sl-option')].map(o => o.getAttribute('value')))
        .filter(v => ['show', 'hide', 'class', 'style', 'attribute'].includes(v));

    it('offers class/style/attribute only — no show, no hide', async () => {
        const panel = await mountPanel(makeView([{subscribe: 'a', value: '1', action: 'class', class: 'x'}]));
        const offered = actionOptions(panel);
        expect(offered).toContain('class');
        expect(offered).toContain('style');
        expect(offered).toContain('attribute');
        expect(offered).not.toContain('show');
        expect(offered).not.toContain('hide');
    });

    it('an element still gets all five', async () => {
        const panel = await mountPanel(makeTarget([{subscribe: 'a', value: '1', action: 'hide'}]));
        expect(actionOptions(panel)).toEqual(
            expect.arrayContaining(['show', 'hide', 'class', 'style', 'attribute']));
    });

    it('a new row on a view starts on an offered action, not on hide', async () => {
        const view = makeView();
        const panel = await mountPanel(view);
        panel.shadowRoot.querySelector('.btn').click();
        await panel.updateComplete;
        const row = JSON.parse(view.getAttribute('conditions'))[0];
        expect(row.action).toBe('class');
        expect(row.action).not.toBe('hide');
    });

    it('an element keeps `hide` as its default row', async () => {
        // The view filter must not change the element default by accident.
        const target = makeTarget();
        const panel = await mountPanel(target);
        panel.shadowRoot.querySelector('.btn').click();
        await panel.updateComplete;
        expect(JSON.parse(target.getAttribute('conditions'))[0].action).toBe('hide');
    });

    it('flags a hand-edited row whose action a view cannot run', async () => {
        // Source mode / an import can still write one; the select would render
        // blank, so say why instead of leaving it mysterious.
        const panel = await mountPanel(makeView([{subscribe: 'a', value: '1', action: 'hide'}]));
        expect(panel.shadowRoot.querySelector('.warn')?.textContent)
            .toContain('does nothing on a view');
    });

    it('says so in the intro, and does not promise show/hide there', async () => {
        const panel = await mountPanel(makeView());
        const intro = panel.shadowRoot.querySelector('.intro').textContent;
        expect(intro).toContain('cannot be shown or hidden');
        expect(intro).not.toContain('AND-combine');
    });
});
