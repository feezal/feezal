import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-table/feezal-element-basic-table.js';

beforeEach(() => {
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

// Detach while the mock connection is still in place (the shared setup's
// body reset runs after feezal has been replaced).
afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}, {editor = false} = {}) {
    feezal.isEditor = editor;
    const el = document.createElement('feezal-element-basic-table');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

/** Deliver a payload through the captured subscription callback. */
async function push(el, topic, payload) {
    const call = feezal.connection.sub.mock.calls.find(c => c[0] === topic);
    expect(call, `no subscription for ${topic}`).toBeTruthy();
    call[1]({payload});
    await el.updateComplete;
}

const headers = el => [...el.shadowRoot.querySelectorAll('th')].map(th => th.textContent.trim());
const bodyRows = el => [...el.shadowRoot.querySelectorAll('tbody tr')];
const cellTexts = el => bodyRows(el).map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));

describe('descriptor', () => {
    it('registers as a Basic palette element with the E75 attribute set', () => {
        const cls = customElements.get('feezal-element-basic-table');
        expect(cls.feezal.palette).toMatchObject({category: 'Basic', name: 'Table'});
        const names = cls.feezal.attributes.map(a => a.name);
        for (const name of ['subscribe', 'message-property', 'columns', 'sortable', 'filter',
            'max-rows', 'row-class-map', 'editable', 'publish', 'empty-text']) {
            expect(names).toContain(name);
        }
    });
});

describe('data ingestion & columns', () => {
    it('renders an array-of-objects payload with columns auto-derived from the first row', async () => {
        const el = await mount({subscribe: 'hub/list'});
        await push(el, 'hub/list', [{name: 'pump', state: 'on'}, {name: 'fan', state: 'off'}]);
        expect(headers(el)).toEqual(['name', 'state']);
        expect(cellTexts(el)).toEqual([['pump', 'on'], ['fan', 'off']]);
    });

    it('parses a JSON string payload and wraps a single object into one row', async () => {
        const el = await mount({subscribe: 't'});
        await push(el, 't', '[{"a":1},{"a":2}]');
        expect(cellTexts(el)).toEqual([['1'], ['2']]);
        await push(el, 't', {a: 3});
        expect(cellTexts(el)).toEqual([['3']]);
    });

    it('ignores unparseable and non-object payloads, keeping the previous table', async () => {
        const el = await mount({subscribe: 't'});
        await push(el, 't', [{a: 1}]);
        await push(el, 't', 'not json');
        await push(el, 't', 42);
        expect(cellTexts(el)).toEqual([['1']]);
    });

    it('configured columns control selection, order, labels and alignment', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([
                {key: 'value', label: 'Value', align: 'right', width: '80px'},
                {key: 'name', label: 'Name'}
            ])
        });
        await push(el, 't', [{name: 'x', value: 1, hidden: 'nope'}]);
        expect(headers(el)).toEqual(['Value', 'Name']);
        expect(cellTexts(el)).toEqual([['1', 'x']]);
        const th = el.shadowRoot.querySelector('th');
        expect(th.getAttribute('style')).toContain('width:80px');
        expect(th.getAttribute('style')).toContain('text-align:right');
    });

    it('shows empty-text for an empty array (viewer)', async () => {
        const el = await mount({subscribe: 't', 'empty-text': 'nothing here'});
        await push(el, 't', []);
        expect(el.shadowRoot.textContent).toContain('nothing here');
    });
});

describe('formatting', () => {
    it('number format applies decimals and unit suffix', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'temp', format: 'number:1:°C'}])
        });
        await push(el, 't', [{temp: 21.456}]);
        expect(cellTexts(el)).toEqual([['21.5°C']]);
    });

    it('non-numeric values and unknown formats fall back to the raw string', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'a', format: 'number:2'}, {key: 'b', format: 'bogus'}])
        });
        await push(el, 't', [{a: 'n/a', b: 'raw'}]);
        expect(cellTexts(el)).toEqual([['n/a', 'raw']]);
    });

    it('date format renders epoch seconds and ISO strings via the locale', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'ts', format: 'date'}])
        });
        const epoch = Math.floor(new Date('2026-07-11T12:00:00Z').getTime() / 1000);
        await push(el, 't', [{ts: epoch}, {ts: '2026-07-11T12:00:00Z'}]);
        const [[fromEpoch], [fromIso]] = cellTexts(el);
        expect(fromEpoch).toBe(fromIso);
        expect(fromEpoch).toContain('2026');
    });

    it('object cell values render as JSON', async () => {
        const el = await mount({subscribe: 't'});
        await push(el, 't', [{cfg: {a: 1}}]);
        expect(cellTexts(el)).toEqual([['{"a":1}']]);
    });
});

describe('sorting', () => {
    const data = [{n: 'b', v: 2}, {n: 'a', v: 10}, {n: 'c', v: 1}];

    it('cycles asc → desc → original payload order, numeric-aware', async () => {
        const el = await mount({subscribe: 't'});
        await push(el, 't', data);
        const thV = el.shadowRoot.querySelectorAll('th')[1];
        thV.click();
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[1])).toEqual(['1', '2', '10']); // numeric, not lexicographic
        thV.click();
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[1])).toEqual(['10', '2', '1']);
        thV.click();
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[1])).toEqual(['2', '10', '1']);
    });

    it('sorts strings lexicographically', async () => {
        const el = await mount({subscribe: 't'});
        await push(el, 't', data);
        el.shadowRoot.querySelector('th').click();
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[0])).toEqual(['a', 'b', 'c']);
    });

    it('sortable=false disables header sorting', async () => {
        const el = await mount({subscribe: 't', sortable: 'false'});
        await push(el, 't', data);
        el.shadowRoot.querySelector('th').click();
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[0])).toEqual(['b', 'a', 'c']);
    });
});

describe('filter & max-rows', () => {
    it('the filter box narrows rows by case-insensitive substring across all columns', async () => {
        const el = await mount({subscribe: 't', filter: ''});
        await push(el, 't', [{n: 'Pump', s: 'on'}, {n: 'Fan', s: 'off'}, {n: 'Valve', s: 'ON'}]);
        const box = el.shadowRoot.querySelector('.filter-box input');
        box.value = 'on';
        box.dispatchEvent(new Event('input'));
        await el.updateComplete;
        expect(cellTexts(el).map(r => r[0])).toEqual(['Pump', 'Valve']);
    });

    it('max-rows caps rendered rows', async () => {
        const el = await mount({subscribe: 't', 'max-rows': '2'});
        await push(el, 't', [{a: 1}, {a: 2}, {a: 3}]);
        expect(bodyRows(el).length).toBe(2);
    });
});

describe('conditional classes', () => {
    it('row-class-map applies row classes by exact value and numeric threshold', async () => {
        const el = await mount({
            subscribe: 't',
            'row-class-map': JSON.stringify({state: {error: 'error'}, load: {'>90': 'warn'}})
        });
        await push(el, 't', [
            {state: 'ok', load: 10},
            {state: 'error', load: 20},
            {state: 'ok', load: 95}
        ]);
        const classes = bodyRows(el).map(tr => tr.className);
        expect(classes[0]).toBe('');
        expect(classes[1]).toBe('error');
        expect(classes[2]).toBe('warn');
    });

    it('per-column class-map colours single cells', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'v', 'class-map': {'>=10': 'error', '<0': 'info'}}])
        });
        await push(el, 't', [{v: 5}, {v: 10}, {v: -1}]);
        const tds = bodyRows(el).map(tr => tr.querySelector('td').className);
        expect(tds).toEqual(['', 'error', 'info']);
    });

    it('later matching map entries win', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'v', 'class-map': {'>50': 'warn', '>90': 'error'}}])
        });
        await push(el, 't', [{v: 95}]);
        expect(bodyRows(el)[0].querySelector('td').className).toBe('error');
    });
});

describe('editor vs viewer', () => {
    it('shows sample rows on the unconfigured editor canvas, none in the viewer', async () => {
        const ed = await mount({}, {editor: true});
        expect(bodyRows(ed).length).toBe(3);
        const vw = await mount({});
        expect(bodyRows(vw).length).toBe(0);
        expect(vw.shadowRoot.textContent).toContain('No data');
    });

    it('editor sample rows follow the configured columns until data arrives', async () => {
        const el = await mount({
            subscribe: 't',
            columns: JSON.stringify([{key: 'temp', label: 'Temp', format: 'number:1'}])
        }, {editor: true});
        expect(headers(el)).toEqual(['Temp']);
        expect(bodyRows(el).length).toBe(3);
        await push(el, 't', [{temp: 1}]);
        expect(bodyRows(el).length).toBe(1);
    });
});

describe('write-back (phase 2)', () => {
    const cols = JSON.stringify([{key: 'name'}, {key: 'qty', editable: 'true'}]);
    const data = [{name: 'bolts', qty: 5}, {name: 'nuts', qty: 3}];

    async function mountEditable(extra = {}, opts) {
        const el = await mount({subscribe: 'hub/list', columns: cols, editable: '', ...extra}, opts);
        await push(el, 'hub/list', JSON.parse(JSON.stringify(data)));
        return el;
    }

    function commitCell(el, rowIdx, value) {
        const input = bodyRows(el)[rowIdx].querySelector('td input');
        input.value = value;
        input.dispatchEvent(new Event('change'));
        return el.updateComplete;
    }

    it('editable columns render inputs, read-only columns stay text', async () => {
        const el = await mountEditable();
        const tds = bodyRows(el)[0].querySelectorAll('td');
        expect(tds[0].querySelector('input')).toBeNull();
        expect(tds[1].querySelector('input')).toBeTruthy();
    });

    it('a commit publishes the WHOLE updated array (non-retained by default), preserving number types', async () => {
        const el = await mountEditable();
        await commitCell(el, 0, '7');
        expect(feezal.connection.pub).toHaveBeenCalledTimes(1);
        const [topic, payload, options] = feezal.connection.pub.mock.calls[0];
        expect(topic).toBe('hub/list'); // publish defaults to the subscribe topic
        expect(JSON.parse(payload)).toEqual([{name: 'bolts', qty: 7}, {name: 'nuts', qty: 3}]);
        expect(options).toEqual({retain: false});
    });

    it('publish topic and the retain flag are honoured; unchanged values do not publish', async () => {
        const el = await mountEditable({publish: 'hub/list/set', retain: ''});
        await commitCell(el, 0, '5'); // unchanged
        expect(feezal.connection.pub).not.toHaveBeenCalled();
        await commitCell(el, 0, '9');
        const [topic, , options] = feezal.connection.pub.mock.calls[0];
        expect(topic).toBe('hub/list/set');
        expect(options).toEqual({retain: true});
    });

    it('add row appends an empty row, delete removes it — each publishing the array', async () => {
        const el = await mountEditable();
        el.shadowRoot.querySelector('.add-row').click();
        await el.updateComplete;
        expect(JSON.parse(feezal.connection.pub.mock.calls[0][1])).toEqual([...data, {name: '', qty: ''}]);
        expect(bodyRows(el).length).toBe(3);
        bodyRows(el)[2].querySelector('td.remove').click();
        await el.updateComplete;
        expect(JSON.parse(feezal.connection.pub.mock.calls[1][1])).toEqual(data);
        expect(bodyRows(el).length).toBe(2);
    });

    it('never publishes from the editor canvas', async () => {
        const el = await mountEditable({}, {editor: true});
        await commitCell(el, 0, '99');
        el.shadowRoot.querySelector('.add-row').click();
        await el.updateComplete;
        expect(feezal.connection.pub).not.toHaveBeenCalled();
    });
});
