import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-ticker/feezal-element-basic-ticker.js';

beforeEach(() => {
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

// Detach while the mock connection is still in place (the shared setup's
// body reset runs after feezal has been replaced).
afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}, {editor = true} = {}) {
    feezal.isEditor = editor;
    const el = document.createElement('feezal-element-basic-ticker');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

const runs = el => [...el.shadowRoot.querySelectorAll('.run')].map(s => s.textContent);

describe('descriptor', () => {
    it('declares baseAttribute text so payloads replace the content', () => {
        const cls = customElements.get('feezal-element-basic-ticker');
        expect(cls.feezal.baseAttribute).toBe('text');
        expect(cls.feezal.palette).toMatchObject({category: 'Basic', name: 'Ticker'});
    });
});

describe('content', () => {
    it('renders the static text twice (seamless wrap), separator-terminated', async () => {
        const el = await mount({text: 'Hello world'});
        expect(runs(el)).toEqual(['Hello world • ', 'Hello world • ']);
    });

    it('a payload-style attribute update replaces the content', async () => {
        const el = await mount({text: 'before'});
        el.setAttribute('text', 'after'); // what _subscribe does with a payload
        await el.updateComplete;
        expect(runs(el)[0]).toBe('after • ');
    });

    it('JSON-array payloads render per-item through the template', async () => {
        const el = await mount({
            text: '[{"level":"warn","msg":"pump"},{"level":"info","msg":"ok"}]',
            template: '{json:level}: {json:msg}',
            separator: ' | '
        });
        expect(runs(el)[0]).toBe('warn: pump | info: ok | ');
    });

    it('string array entries support {payload}, {topic} resolves the subscription', async () => {
        const el = await mount({
            subscribe: 'home/news',
            text: '["a","b"]',
            template: '{topic}={payload}'
        }, {editor: false});
        expect(runs(el)[0]).toBe('home/news=a • home/news=b • ');
    });

    it('missing {json:path} values render empty, non-JSON text stays verbatim', async () => {
        const el = await mount({text: '["x"]', template: '<{json:nope}>'});
        expect(runs(el)[0]).toBe('<> • ');
        el.setAttribute('text', '[not json');
        await el.updateComplete;
        expect(runs(el)[0]).toBe('[not json • ');
    });
});

describe('behaviour flags', () => {
    it('direction right reverses the animation', async () => {
        const el = await mount({text: 'x', direction: 'right'});
        expect(el.shadowRoot.querySelector('.track').classList.contains('reverse')).toBe(true);
    });

    it('pause-on-hover defaults on and can be disabled', async () => {
        const el = await mount({text: 'x'});
        expect(el.shadowRoot.querySelector('.viewport').classList.contains('hoverpause')).toBe(true);
        const off = await mount({text: 'x', 'pause-on-hover': 'false'});
        expect(off.shadowRoot.querySelector('.viewport').classList.contains('hoverpause')).toBe(false);
    });

    it('speed drives the animation duration (length-based fallback estimate)', async () => {
        const el = await mount({text: 'abcdefghij', speed: '10'}); // run ≈ 13 chars * 8px
        const track = el.shadowRoot.querySelector('.track');
        const slow = Number(track.style.getPropertyValue('--feezal-ticker-duration').replace('s', ''));
        el.setAttribute('speed', '100');
        await el.updateComplete;
        const fast = Number(track.style.getPropertyValue('--feezal-ticker-duration').replace('s', ''));
        expect(slow).toBeGreaterThan(fast);
        expect(fast).toBeGreaterThanOrEqual(1);
    });
});

describe('editor vs viewer', () => {
    it('renders a static (non-animated) track in the editor', async () => {
        const el = await mount({text: 'x'});
        expect(el.shadowRoot.querySelector('.track').classList.contains('static')).toBe(true);
    });

    it('animates in the viewer', async () => {
        const el = await mount({text: 'x'}, {editor: false});
        expect(el.shadowRoot.querySelector('.track').classList.contains('static')).toBe(false);
    });

    it('empty content: placeholder in the editor, nothing in the viewer', async () => {
        const ed = await mount();
        expect(ed.shadowRoot.querySelector('.editor-ph')).toBeTruthy();
        const vw = await mount({}, {editor: false});
        expect(vw.shadowRoot.querySelector('.track')).toBeNull();
        expect(vw.shadowRoot.querySelector('.editor-ph')).toBeNull();
    });

    it('suspends the animation while the document is hidden (viewer)', async () => {
        const el = await mount({text: 'x'}, {editor: false});
        Object.defineProperty(document, 'hidden', {value: true, configurable: true});
        document.dispatchEvent(new Event('visibilitychange'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.track').classList.contains('suspended')).toBe(true);
        Object.defineProperty(document, 'hidden', {value: false, configurable: true});
        document.dispatchEvent(new Event('visibilitychange'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.track').classList.contains('suspended')).toBe(false);
    });
});
