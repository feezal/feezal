/**
 * E170 — the *-search element family + shared filter engine.
 *
 * Engine contract: match = case-insensitive substring over label + href;
 * elements with neither attribute stay visible; hiding = the dedicated
 * feezal-search-hidden attribute (never inline display); search elements
 * are never hidden; empty query clears. Element contract: debounced input,
 * Escape/× clear, viewer-only (the editor canvas never filters),
 * disconnect clears the filter.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-view.js';
import '../packages/@feezal/feezal-element-basic-search/feezal-element-basic-search.js';
import '../packages/@feezal/feezal-element-glass-search/feezal-element-glass-search.js';
import '../packages/@feezal/feezal-element-metro-search/feezal-element-metro-search.js';
import '../packages/@feezal/feezal-element-eink-search/feezal-element-eink-search.js';
import {applySearchFilter, SEARCH_HIDDEN_ATTR} from '../packages/@feezal/feezal-element/feezal-search-filter.js';
import {setupFeezal, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

/** A view with canvas-element children (unregistered tags are fine — the
 * engine only reads localName + attributes). */
function makeView(children) {
    const view = document.createElement('feezal-view');
    for (const c of children) {
        const el = document.createElement(c.tag || 'feezal-element-test-dummy');
        if (c.label !== undefined) el.setAttribute('label', c.label);
        if (c.href !== undefined) el.setAttribute('href', c.href);
        view.append(el);
    }
    document.body.append(view);
    return view;
}

const hidden = view => [...view.children].filter(el => el.hasAttribute(SEARCH_HIDDEN_ATTR));

describe('search filter engine (E170)', () => {
    it('hides non-matching labeled elements, case-insensitively; clears on empty query', () => {
        const view = makeView([
            {label: 'Living Lights'},
            {label: 'Kitchen'},
            {label: 'living climate'},
        ]);
        expect(applySearchFilter(view, 'LIVING')).toBe(1);
        expect(hidden(view).map(e => e.getAttribute('label'))).toEqual(['Kitchen']);
        applySearchFilter(view, '');
        expect(hidden(view)).toHaveLength(0);
    });

    it('matches href too (the link family), and elements with NEITHER label nor href stay visible', () => {
        const view = makeView([
            {href: 'https://grafana.example/dash'},
            {label: 'Other'},
            {},                                     // decorative — no label, no href
        ]);
        applySearchFilter(view, 'grafana');
        expect(hidden(view)).toHaveLength(1);
        expect(hidden(view)[0].getAttribute('label')).toBe('Other');
    });

    it('never hides search elements or non-canvas children, and skips `except`', () => {
        const view = makeView([{label: 'Kitchen'}]);
        const search = document.createElement('feezal-element-basic-search');
        const div = document.createElement('div');
        view.append(search, div);
        const except = document.createElement('feezal-element-test-dummy');
        except.setAttribute('label', 'Kitchen sink');
        view.append(except);
        applySearchFilter(view, 'zzz', {except});
        expect(search.hasAttribute(SEARCH_HIDDEN_ATTR)).toBe(false);
        expect(div.hasAttribute(SEARCH_HIDDEN_ATTR)).toBe(false);
        expect(except.hasAttribute(SEARCH_HIDDEN_ATTR)).toBe(false);
    });
});

describe.each([
    ['feezal-element-basic-search', false],
    ['feezal-element-glass-search', true],
    ['feezal-element-metro-search', true],
    ['feezal-element-eink-search', true],
])('%s (E170)', (tag, hasClearButton) => {
    async function mountSearch() {
        const view = makeView([{label: 'Living'}, {label: 'Kitchen'}, {}]);
        const el = document.createElement(tag);
        view.append(el);
        await el.updateComplete;
        return {view, el, input: el.shadowRoot.querySelector('input')};
    }

    it('typing filters the view after the debounce; clearing restores', async () => {
        const {view, el, input} = await mountSearch();
        input.value = 'living';
        input.dispatchEvent(new Event('input'));
        await until(() => hidden(view).length === 1);
        expect(hidden(view)[0].getAttribute('label')).toBe('Kitchen');
        input.value = '';
        input.dispatchEvent(new Event('input'));
        await until(() => hidden(view).length === 0);
        expect(el.hasAttribute(SEARCH_HIDDEN_ATTR)).toBe(false);   // never itself
    });

    it(hasClearButton ? 'the × button clears immediately' : 'basic has NO × button (deliberately minimal)', async () => {
        const {view, el, input} = await mountSearch();
        input.value = 'living';
        input.dispatchEvent(new Event('input'));
        await until(() => hidden(view).length === 1);
        await el.updateComplete;
        const x = el.shadowRoot.querySelector('.sx');
        if (!hasClearButton) {
            expect(x).toBeNull();
            return;
        }
        expect(x).not.toBeNull();
        x.click();
        await until(() => hidden(view).length === 0);
        expect(el._q).toBe('');
    });

    it('Escape clears the query and the filter', async () => {
        const {view, input} = await mountSearch();
        input.value = 'kit';
        input.dispatchEvent(new Event('input'));
        await until(() => hidden(view).length > 0);
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
        await until(() => hidden(view).length === 0);
    });

    it('disconnecting the search element clears a live filter', async () => {
        const {view, el, input} = await mountSearch();
        input.value = 'living';
        input.dispatchEvent(new Event('input'));
        await until(() => hidden(view).length === 1);
        el.remove();
        expect(hidden(view)).toHaveLength(0);
    });
});

describe('editor guard (E170)', () => {
    it('the editor canvas never filters — typing sets no hidden attributes', async () => {
        feezal.isEditor = true;
        const view = makeView([{label: 'Living'}, {label: 'Kitchen'}]);
        const el = document.createElement('feezal-element-basic-search');
        view.append(el);
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input');
        input.value = 'living';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 350));   // past the debounce
        expect(hidden(view)).toHaveLength(0);
    });
});
