import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {FeezalElementSystemScript, FZL_DTS} from '../packages/@feezal/feezal-element-system-script/feezal-element-system-script.js';

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

describe('typedefs export', () => {
    it('FZL_DTS declares the full fzl API for Monaco completions', () => {
        for (const member of ['sub(', 'pub(', 'mqtt', 'onViewChange(', 'log(']) {
            expect(FZL_DTS).toContain(member);
        }
    });
});
