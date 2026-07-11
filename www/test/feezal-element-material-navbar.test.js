import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-material-navbar/feezal-element-material-navbar.js';

beforeEach(() => {
    feezal.isEditor = false;
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
    feezal.site = document.createElement('div');
    document.body.append(feezal.site);
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-material-navbar');
    el.setAttribute('items', JSON.stringify(['Home', 'Settings', 'About']));
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

const itemStyles = el => [...el.shadowRoot.querySelectorAll('.item')].map(b => b.getAttribute('style') || '');

// E81: item-width — empty = auto (unchanged), CSS length = fixed flex-basis,
// 'equal' = items share the bar evenly.
describe('navbar item-width (E81)', () => {
    it('empty keeps auto sizing (no inline flex on the items)', async () => {
        const el = await mount();
        expect(el.shadowRoot.querySelectorAll('.item')).toHaveLength(3);
        for (const s of itemStyles(el)) expect(s).toBe('');
    });

    it('a CSS length pins every item to a fixed flex-basis', async () => {
        const el = await mount({'item-width': '72px'});
        for (const s of itemStyles(el)) expect(s).toContain('flex:0 0 72px;');
    });

    it('"equal" makes all items share the bar evenly', async () => {
        const el = await mount({'item-width': 'equal'});
        for (const s of itemStyles(el)) expect(s).toContain('flex:1 1 0;');
    });

    it('changing the attribute at runtime re-renders the items', async () => {
        const el = await mount();
        el.setAttribute('item-width', '64px');
        await el.updateComplete;
        for (const s of itemStyles(el)) expect(s).toContain('flex:0 0 64px;');
        el.removeAttribute('item-width');
        await el.updateComplete;
        for (const s of itemStyles(el)) expect(s).toBe('');
    });
});
