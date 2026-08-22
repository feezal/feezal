import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {FeezalElementSystemScript, FZL_DTS, FZL_EVENT_NAMES} from '../packages/@feezal/feezal-element-system-script/feezal-element-system-script.js';
import {feezalEmit, resolveFeezalId} from '../packages/@feezal/feezal-element/feezal-element.js';

const {deliverPayload, serializePayload} = FeezalElementSystemScript;

let subs;       // topic → [callbacks]
let published;  // [{topic, payload, options}]

beforeEach(() => {
    subs = {};
    published = [];
    feezal.isEditor = false;
    feezal.connection = {
        connected: true,
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(sub => {
            const list = subs[sub.topic] || [];
            const i = list.indexOf(sub.cb);
            if (i >= 0) list.splice(i, 1);
        }),
        pub: vi.fn((topic, payload, options = {}) => {
            published.push({topic, payload, options});
        }),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
});

const deliver = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));

/** Mount a script element whose <script type="text/feezal"> child holds `src`. */
async function mount(src, {name = 'test-script'} = {}) {
    const el = document.createElement('feezal-element-system-script');
    if (name) el.setAttribute('name', name);
    const script = document.createElement('script');
    script.setAttribute('type', 'text/feezal');
    script.textContent = src;
    el.append(script);
    document.body.append(el);
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));   // async wrapper microtasks
    return el;
}

describe('payload convention (E49 — objects/arrays only)', () => {
    it('delivers parsed objects/arrays, leaves numbers/booleans/strings as strings', () => {
        expect(deliverPayload({a: 1})).toEqual({a: 1});          // already parsed by the connection
        expect(deliverPayload('{"a":1}')).toEqual({a: 1});
        expect(deliverPayload('[1,2]')).toEqual([1, 2]);
        expect(deliverPayload('{oops')).toBe('{oops');           // raw string on parse failure
        expect(deliverPayload('1.5')).toBe('1.5');               // deliberately NOT 1.5
        expect(deliverPayload('true')).toBe('true');
        expect(deliverPayload('hello')).toBe('hello');
        expect(deliverPayload(null)).toBe('');
    });

    it('serializes objects/arrays to JSON, everything else via String()', () => {
        expect(serializePayload({a: 1})).toBe('{"a":1}');
        expect(serializePayload([1, 2])).toBe('[1,2]');
        expect(serializePayload(1.5)).toBe('1.5');
        expect(serializePayload(true)).toBe('true');
        expect(serializePayload('x')).toBe('x');
    });
});

describe('execution model', () => {
    it('runs the script once with the fzl API in scope', async () => {
        await mount(`fzl.pub('ran', 1)`);
        expect(published).toEqual([{topic: 'ran', payload: '1', options: {local: true}}]);
    });

    it('waits for the connected event when the connection is not up yet', async () => {
        feezal.connection.connected = false;
        await mount(`fzl.pub('late', 'x')`);
        expect(published).toEqual([]);
        document.dispatchEvent(new Event('connected'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(published).toEqual([{topic: 'late', payload: 'x', options: {local: true}}]);
    });

    it('never runs in editor mode and renders the chip instead', async () => {
        feezal.isEditor = true;
        const el = await mount(`fzl.pub('nope', 1)`);
        expect(published).toEqual([]);
        expect(el.renderRoot.querySelector('.ph').textContent).toContain('test-script');
    });

    it('renders nothing in the viewer', async () => {
        const el = await mount('');
        expect(el.renderRoot.querySelector('.ph')).toBeNull();
    });

    it('top-level const in two script elements does not collide (function scope)', async () => {
        await mount(`const x = 1; fzl.pub('a', x)`, {name: 's1'});
        await mount(`const x = 2; fzl.pub('b', x)`, {name: 's2'});
        expect(published.map(p => [p.topic, p.payload])).toEqual([['a', '1'], ['b', '2']]);
    });

    it('supports top-level await', async () => {
        await mount(`await Promise.resolve(); fzl.pub('after-await', 'ok')`);
        expect(published.map(p => p.topic)).toContain('after-await');
    });

    it('logs uncaught errors with the element-name prefix instead of throwing', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await mount(`throw new Error('boom')`, {name: 'broken'});
        expect(spy).toHaveBeenCalledWith('[broken]', 'uncaught error:', expect.any(Error));
        spy.mockRestore();
    });
});

describe('fzl API', () => {
    it('fzl.sub delivers per the payload convention and returns an unsubscribe function', async () => {
        await mount(`
            const off = fzl.sub('home/temp', (payload, topic) => fzl.pub('seen', {payload, topic}));
            fzl.sub('stop', () => off());
        `);
        deliver('home/temp', '21.5');
        expect(JSON.parse(published.at(-1).payload)).toEqual({payload: '21.5', topic: 'home/temp'});

        deliver('home/temp', {state: 'on'});
        expect(JSON.parse(published.at(-1).payload)).toEqual({payload: {state: 'on'}, topic: 'home/temp'});

        deliver('stop', '1');
        const before = published.length;
        deliver('home/temp', 'x');                     // unsubscribed → no publish
        expect(published.length).toBe(before);
    });

    it('a throwing sub callback is caught and logged, not fatal', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await mount(`fzl.sub('t', () => { throw new Error('cb boom'); })`, {name: 'cb'});
        deliver('t', '1');
        expect(spy).toHaveBeenCalledWith('[cb]', 'uncaught error in sub callback:', expect.any(Error));
        spy.mockRestore();
    });

    it('fzl.pub is page-local and never retained; fzl.mqtt.pub reaches the broker with retain', async () => {
        await mount(`
            fzl.pub('local-topic', {v: 1});
            fzl.mqtt.pub('broker/topic', 'on');
            fzl.mqtt.pub('broker/retained', 42, {retain: true});
        `);
        expect(published).toEqual([
            {topic: 'local-topic', payload: '{"v":1}', options: {local: true}},
            {topic: 'broker/topic', payload: 'on', options: {retain: false}},
            {topic: 'broker/retained', payload: '42', options: {retain: true}},
        ]);
    });

    it('fzl.onViewChange fires immediately and on every view switch', async () => {
        const site = document.createElement('feezal-site');
        site.setAttribute('subscribe', '');
        site.setAttribute('view', 'Home');
        document.body.append(site);

        await mount(`fzl.onViewChange(v => fzl.pub('view-seen', v))`);
        expect(published.at(-1)).toMatchObject({topic: 'view-seen', payload: 'Home'});

        site.setAttribute('view', 'Energy');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(published.at(-1)).toMatchObject({topic: 'view-seen', payload: 'Energy'});
    });

    it('fzl.log prefixes with the element name', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await mount(`fzl.log('hello', 42)`, {name: 'logger'});
        expect(spy).toHaveBeenCalledWith('[logger]', 'hello', 42);
        spy.mockRestore();
    });
});

describe('source storage', () => {
    it('reads from the script[type="text/feezal"] child; code with < survives', async () => {
        const el = await mount(`const ok = 1 < 2; fzl.pub('cmp', ok)`);
        expect(el.scriptSource).toContain('1 < 2');
        expect(published.at(-1)).toMatchObject({topic: 'cmp', payload: 'true'});
    });

    it('an element without a script child does nothing', async () => {
        const el = document.createElement('feezal-element-system-script');
        document.body.append(el);
        await el.updateComplete;
        expect(published).toEqual([]);
    });
});

// U113 — scoped lookup by feezal-id, the public value/event contract.
describe('fzl.el / fzl.val / fzl.on / fzl.view (U113)', () => {
    /** A stand-in contract element: .value + composed feezal-change. */
    class FakeField extends HTMLElement {
        constructor() { super(); this._v = ''; }
        get value() { return this._v; }
        set value(v) { this._v = v; }
    }
    if (!customElements.get('x-fake-field')) customElements.define('x-fake-field', FakeField);

    const field = (id, value = '') => {
        const el = document.createElement('x-fake-field');
        el.setAttribute('feezal-id', id);
        el.value = value;
        document.body.append(el);
        return el;
    };

    it('fzl.el resolves by feezal-id, fzl.val reads and writes the public value', async () => {
        const name = field('name', 'Ada');
        await mount(`
            fzl.pub('found', fzl.el('name') === document.querySelector('[feezal-id="name"]'));
            fzl.pub('read', fzl.val('name'));
            fzl.val('name', 'Grace');
            fzl.pub('missing', String(fzl.el('nope')) + '/' + String(fzl.val('nope')));
        `);
        const by = topic => published.find(p => p.topic === topic)?.payload;
        expect(by('found')).toBe('true');
        expect(by('read')).toBe('Ada');
        expect(name.value).toBe('Grace');
        expect(by('missing')).toBe('null/undefined');
    });

    it('resolution prefers the VISIBLE occurrence, then document order', () => {
        const hidden = field('dup', 'hidden');
        hidden.style.display = 'none';
        const shown = field('dup', 'shown');
        expect(resolveFeezalId('dup')).toBe(shown);
        shown.style.display = 'none';
        expect(resolveFeezalId('dup')).toBe(hidden);   // none visible → first in document order
    });

    it('fzl.on maps short names onto the composed contract events and unsubscribes', async () => {
        const name = field('name', 'x');
        await mount(`
            const off = fzl.on('name', 'change', d => fzl.pub('changed', d.value));
            fzl.on('name', 'keydown', d => { if (d.key === 'Enter') fzl.pub('enter', d.value); });
            fzl.sub('stop', () => off());
        `);
        name.value = 'Linus';
        feezalEmit(name, 'change');
        expect(published.find(p => p.topic === 'changed')?.payload).toBe('Linus');
        feezalEmit(name, 'keydown', {key: 'Enter'});
        expect(published.find(p => p.topic === 'enter')?.payload).toBe('Linus');

        deliver('stop', '1');
        const before = published.length;
        feezalEmit(name, 'change');
        expect(published.length).toBe(before);
    });

    it('fzl.on also sees a copy of the element stamped AFTER the script ran', async () => {
        await mount(`fzl.on('late', 'press', d => fzl.pub('pressed', d.payload));`);
        const late = field('late');
        feezalEmit(late, 'press', {payload: 'go'});
        expect(published.find(p => p.topic === 'pressed')?.payload).toBe('go');
    });

    it('FZL_EVENT_NAMES covers the five contract events', () => {
        expect(FZL_EVENT_NAMES).toEqual({
            change: 'feezal-change', press: 'feezal-press',
            blur: 'feezal-blur', keyup: 'feezal-keyup', keydown: 'feezal-keydown',
        });
    });

    it('fzl.view reads and switches the active view through feezal.site', async () => {
        const site = {view: 'home'};
        feezal.site = site;
        await mount(`
            fzl.pub('before', fzl.view());
            fzl.view('kitchen');
            fzl.pub('after', fzl.view());
        `);
        expect(published.find(p => p.topic === 'before')?.payload).toBe('home');
        expect(site.view).toBe('kitchen');
        expect(published.find(p => p.topic === 'after')?.payload).toBe('kitchen');
        delete feezal.site;
    });
});

describe('typedefs export', () => {
    it('FZL_DTS declares the full fzl API for Monaco completions', () => {
        for (const member of ['sub(', 'pub(', 'mqtt', 'onViewChange(', 'log(', 'el(', 'val(', 'on(', 'view(']) {
            expect(FZL_DTS).toContain(member);
        }
    });
});
