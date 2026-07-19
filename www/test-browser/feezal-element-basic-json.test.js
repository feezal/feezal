/**
 * Component tests for feezal-element-basic-json (E88) — the recursive JSON
 * tree renderer in a real browser: tree rendering from a payload, expand
 * state surviving a live message update, raw-string fallback for non-JSON,
 * and the max-nodes render guard.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-basic-json';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

function rows(el) {
    return [...el.shadowRoot.querySelectorAll('.row')];
}

describe('tree rendering', () => {
    it('renders keys and per-type values from a JSON payload', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '5'});
        feezal.connection.deliver('dev/json', JSON.stringify({name: 'kitchen', temp: 21.5, on: true, extra: null}));
        await el.updateComplete;

        const text = el.shadowRoot.textContent;
        expect(text).toContain('name');
        expect(text).toContain('"kitchen"');
        expect(text).toContain('21.5');
        expect(text).toContain('true');
        expect(text).toContain('null');

        expect(el.shadowRoot.querySelector('.value.string').textContent).toBe('"kitchen"');
        expect(el.shadowRoot.querySelector('.value.number').textContent).toBe('21.5');
    });

    it('renders a collapsed container with a preview and expands on click', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '1'});
        feezal.connection.deliver('dev/json', JSON.stringify({nested: {a: 1, b: 2, c: 3}}));
        await el.updateComplete;

        // Root open (depth 0 < 1), the nested object collapsed (depth 1).
        const preview = el.shadowRoot.querySelector('.preview');
        expect(preview.textContent).toContain('3 keys');
        expect(el.shadowRoot.textContent).not.toContain('"a"'); // children not rendered

        // Clicking the container row toggles it open.
        [...el.shadowRoot.querySelectorAll('.row.container')]
            .find(r => r.textContent.includes('nested')).click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.preview')).toBeNull();
        expect(el.shadowRoot.textContent).toContain('1');
    });

    it('accepts an already-parsed object payload (no JSON string)', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '5'});
        feezal.connection.deliver('dev/json', {state: 'ON', value: 7});
        await el.updateComplete;
        expect(el.shadowRoot.textContent).toContain('state');
        expect(el.shadowRoot.textContent).toContain('"ON"');
    });
});

describe('expand state survives message updates', () => {
    it('keeps a user-collapsed path collapsed after a new payload', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '5'});
        feezal.connection.deliver('dev/json', JSON.stringify({group: {x: 1}}));
        await el.updateComplete;
        // Auto-expanded (depth 5) — the child value is visible.
        expect(el.shadowRoot.querySelector('.value')).not.toBeNull();

        // User collapses the nested group.
        [...el.shadowRoot.querySelectorAll('.row.container')]
            .find(r => r.textContent.includes('group')).click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.preview')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.value')).toBeNull();

        // A live update with the same structure must NOT snap it back open.
        feezal.connection.deliver('dev/json', JSON.stringify({group: {x: 2}}));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.preview')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.value')).toBeNull();
    });

    it('keeps a user-expanded path open after a new payload', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '1'});
        feezal.connection.deliver('dev/json', JSON.stringify({group: {x: 1}}));
        await el.updateComplete;
        // Collapsed at depth 1.
        [...el.shadowRoot.querySelectorAll('.row.container')]
            .find(r => r.textContent.includes('group')).click();
        await el.updateComplete;
        expect(el.shadowRoot.textContent).toContain('1');

        feezal.connection.deliver('dev/json', JSON.stringify({group: {x: 9}}));
        await el.updateComplete;
        // Still open, showing the new value.
        expect(el.shadowRoot.querySelector('.preview')).toBeNull();
        expect(el.shadowRoot.textContent).toContain('9');
    });
});

describe('raw-string fallback', () => {
    it('renders a non-JSON payload as the raw string, not an error', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json'});
        feezal.connection.deliver('dev/json', 'ON');
        await el.updateComplete;
        const raw = el.shadowRoot.querySelector('.raw');
        expect(raw).not.toBeNull();
        expect(raw.textContent).toBe('ON');
        expect(el.shadowRoot.querySelector('.value')).toBeNull(); // no tree
    });

    it('switches back to a tree when a valid JSON payload follows', async () => {
        const el = await mount('feezal-element-basic-json', {subscribe: 'dev/json', 'expand-depth': '5'});
        feezal.connection.deliver('dev/json', 'garbage{');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.raw')).not.toBeNull();

        feezal.connection.deliver('dev/json', JSON.stringify({ok: true}));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.raw')).toBeNull();
        expect(el.shadowRoot.textContent).toContain('ok');
    });
});

describe('max-nodes render guard', () => {
    it('stops rendering siblings past the limit and shows a +N more hint', async () => {
        const el = await mount('feezal-element-basic-json',
            {subscribe: 'dev/json', 'expand-depth': '5', 'max-nodes': '10'});
        const big = {};
        for (let i = 0; i < 50; i++) {
            big[`k${i}`] = i;
        }
        feezal.connection.deliver('dev/json', JSON.stringify(big));
        await el.updateComplete;

        const more = el.shadowRoot.querySelector('.row.more');
        expect(more).not.toBeNull();
        expect(more.textContent).toContain('more');

        // Fewer than 50 value rows were materialised (capped near max-nodes).
        const valueRows = el.shadowRoot.querySelectorAll('.value');
        expect(valueRows.length).toBeLessThan(50);
        expect(valueRows.length).toBeGreaterThan(0);
    });
});
