import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-image/feezal-element-basic-image.js';

beforeEach(() => {
    feezal.isEditor = false;
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-image');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

// click-through — the E82 basic-template pattern (boolean, default off).
describe('click-through (image, E82 pattern)', () => {
    const cls = customElements.get('feezal-element-basic-image');
    const cssText = cls.elementStyles.map(s => s.cssText ?? String(s)).join('\n');

    it('declares the attribute in the descriptor (boolean, default off)', () => {
        const attr = cls.feezal.attributes.find(a => a?.name === 'click-through');
        expect(attr).toBeTruthy();
        expect(attr.type).toBe('boolean');
        expect(attr.default).toBe(false);
    });

    it('passthrough rule is gated on the ABSENCE of the editor class', () => {
        expect(cssText).toMatch(/:host\(\[click-through]:not\(\.feezal-editable\)\)\s*{\s*pointer-events:\s*none/);
    });

    it('attribute and property reflect both ways; off by default', async () => {
        const el = await mount();
        expect(el.clickThrough).toBe(false);
        expect(el.hasAttribute('click-through')).toBe(false);

        el.clickThrough = true;
        await el.updateComplete;
        expect(el.hasAttribute('click-through')).toBe(true);

        el.removeAttribute('click-through');
        await el.updateComplete;
        expect(el.clickThrough).toBe(false);
    });
});

// Baseline: src / subscribe behaviour still works.
describe('image rendering (regression)', () => {
    it('renders the img from src and swaps it on a subscribe payload', async () => {
        const callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => { callbacks[topic] = cb; return {}; });

        const el = await mount({src: '/a.png', subscribe: 'cam/latest'});
        expect(el.renderRoot.querySelector('img').getAttribute('src')).toBe('/a.png');

        callbacks['cam/latest']({topic: 'cam/latest', payload: '/b.png'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('img').getAttribute('src')).toBe('/b.png');
    });
});
