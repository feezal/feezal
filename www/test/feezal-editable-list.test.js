import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector-attributes.js';

beforeEach(() => {
    feezal.isEditor = true;
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mountList({value = '', fields, label = 'options'} = {}) {
    const el = document.createElement('feezal-editable-list');
    el.value = value;
    if (fields) el.fields = fields;
    el.label = label;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

const lastEmit = spy => spy.mock.calls.at(-1)[0].detail.value;

// U35: generic list editor for JSON-array attributes.
describe('feezal-editable-list (U35)', () => {
    it('renders one row per item with per-field inputs', async () => {
        const el = await mountList({
            value: '[{"value":"a","label":"Option A"},{"value":"b","label":"Option B"}]',
            fields: [{key: 'value'}, {key: 'label'}],
        });
        const rows = el.shadowRoot.querySelectorAll('li');
        expect(rows).toHaveLength(2);
        const inputs = rows[0].querySelectorAll('input');
        expect(inputs[0].value).toBe('a');
        expect(inputs[1].value).toBe('Option A');
    });

    it('add appends an empty item; delete removes its row (emits arrays)', async () => {
        const el = await mountList({value: '[{"value":"a","label":"A"}]', fields: [{key: 'value'}, {key: 'label'}]});
        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);

        el.shadowRoot.querySelector('button.add').click();
        expect(lastEmit(emitted)).toEqual([{value: 'a', label: 'A'}, {value: '', label: ''}]);

        el.shadowRoot.querySelector('button.del').click();   // first row's ✕
        expect(lastEmit(emitted)).toEqual([]);
    });

    it('editing a field patches only that key of that row', async () => {
        const el = await mountList({value: '[{"value":"a","label":"A"},{"value":"b","label":"B"}]', fields: [{key: 'value'}, {key: 'label'}]});
        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);

        const secondRowLabel = el.shadowRoot.querySelectorAll('li')[1].querySelectorAll('input')[1];
        secondRowLabel.value = 'Bee';
        secondRowLabel.dispatchEvent(new Event('change'));
        expect(lastEmit(emitted)).toEqual([{value: 'a', label: 'A'}, {value: 'b', label: 'Bee'}]);
    });

    it('drag & drop reorders items', async () => {
        const el = await mountList({value: '["one","two","three"]', fields: [{key: ''}]});
        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);

        // Simulate the HTML5 drag protocol directly on the handlers.
        const items = ['one', 'two', 'three'];
        el._onDragStart({dataTransfer: {setData: () => {}, effectAllowed: ''}}, 0);
        el._onDrop({preventDefault: () => {}}, 2, items);
        expect(lastEmit(emitted)).toEqual(['two', 'three', 'one']);
    });

    it('bare mode (single empty-key field) edits plain-string items', async () => {
        const el = await mountList({value: '["low","high"]', fields: [{key: '', placeholder: 'preset'}]});
        expect(el._bare).toBe(true);
        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);

        const input = el.shadowRoot.querySelectorAll('li')[0].querySelector('input');
        expect(input.value).toBe('low');
        input.value = 'eco';
        input.dispatchEvent(new Event('change'));
        expect(lastEmit(emitted)).toEqual(['eco', 'high']);
    });

    it('number fields emit numbers', async () => {
        const el = await mountList({value: '[{"label":"cpu","max":100}]', fields: [{key: 'label'}, {key: 'max', type: 'number'}]});
        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);

        const num = el.shadowRoot.querySelector('input[type=number]');
        num.value = '254';
        num.dispatchEvent(new Event('change'));
        expect(lastEmit(emitted)).toEqual([{label: 'cpu', max: 254}]);
    });

    it('unparseable values fall back to a raw input and are never destroyed', async () => {
        const el = await mountList({value: '{oops, not an array', fields: [{key: 'value'}, {key: 'label'}]});
        expect(el.shadowRoot.querySelector('li')).toBeNull();
        const raw = el.shadowRoot.querySelector('input.raw');
        expect(raw.value).toBe('{oops, not an array');

        const emitted = vi.fn();
        el.addEventListener('value-changed', emitted);
        raw.value = '[]';
        raw.dispatchEvent(new Event('change'));
        expect(lastEmit(emitted)).toBe('[]');   // raw string pass-through
    });

    it('an empty value renders an empty list (no fallback)', async () => {
        const el = await mountList({value: '', fields: [{key: 'value'}, {key: 'label'}]});
        expect(el.shadowRoot.querySelector('input.raw')).toBeNull();
        expect(el.shadowRoot.querySelectorAll('li')).toHaveLength(0);
        expect(el.shadowRoot.querySelector('button.add')).toBeTruthy();
    });

    // Regression: after a list edit the inspector re-rendered the control with
    // the items ARRAY instead of the attribute string — String(array) produced
    // "[object Object],…" and the fallback UI until the element was reselected.
    it('tolerates a ready-made array as value (post-edit re-render)', async () => {
        const el = await mountList({value: '', fields: [{key: 'value'}, {key: 'label'}]});
        el.value = [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}];
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('input.raw')).toBeNull();   // no fallback
        expect(el.shadowRoot.querySelectorAll('li')).toHaveLength(2);
        expect(el.shadowRoot.querySelectorAll('li')[1].querySelector('input').value).toBe('b');
    });
});

describe('inspector _change keeps item.value as the attribute string (U35 regression)', () => {
    it('object commits store JSON, not the array', () => {
        class ListTarget extends HTMLElement {
            static feezal = {attributes: [{name: 'options', type: 'objectList'}], styles: []};
        }
        customElements.define('feezal-element-list-target', ListTarget);
        const target = document.createElement('feezal-element-list-target');
        document.body.append(target);
        feezal.app = {change: vi.fn()};
        feezal.editor = {selectedElems: [target]};

        const panel = document.createElement('feezal-sidebar-inspector-attributes');
        panel.items = [{label: 'options', attrName: 'options', value: '[]', mixed: false, invalid: false, elem: {}}];
        panel._change([{value: 'a', label: 'A'}], 0, true);

        expect(target.getAttribute('options')).toBe('[{"value":"a","label":"A"}]');
        expect(panel.items[0].value).toBe('[{"value":"a","label":"A"}]');   // string, not array
        expect(typeof panel.items[0].value).toBe('string');
    });
});

describe('paper-element adoption (dropdown &quot; escaping, tabs slash legacy)', () => {
    it('parses Polymer-reflected JSON with HTML-escaped quotes (paper-dropdown items)', async () => {
        const el = await mountList({
            value: '[{&quot;name&quot;:&quot;One&quot;,&quot;value&quot;:&quot;1&quot;}]',
            fields: [{key: 'value'}, {key: 'name'}],
        });
        expect(el.shadowRoot.querySelector('input.raw')).toBeNull();   // no fallback
        const inputs = el.shadowRoot.querySelector('li').querySelectorAll('input');
        expect(inputs[0].value).toBe('1');
        expect(inputs[1].value).toBe('One');
    });

    it('a legacy slash-separated paper-tabs value falls back to the raw input (editable, not destroyed)', async () => {
        const el = await mountList({value: 'One/Two/Three', fields: [{key: '', placeholder: 'tab name'}]});
        const raw = el.shadowRoot.querySelector('input.raw');
        expect(raw).toBeTruthy();
        expect(raw.value).toBe('One/Two/Three');
    });
});
