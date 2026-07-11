import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-basic-template/feezal-element-basic-template.js';

beforeEach(() => {
    feezal.isEditor = false;
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-template');
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

// ── E82: click-through (pointer-events passthrough) ──────────────────────────

describe('click-through (E82)', () => {
    const cls = customElements.get('feezal-element-basic-template');
    const cssText = cls.elementStyles.map(s => s.cssText ?? String(s)).join('\n');

    it('declares the attribute in the descriptor (boolean, default off)', () => {
        const attr = cls.feezal.attributes.find(a => a?.name === 'click-through');
        expect(attr).toBeTruthy();
        expect(attr.type).toBe('boolean');
        expect(attr.default).toBe(false);
    });

    it('passthrough rule is gated on the ABSENCE of the editor class', () => {
        // Viewer: pointer-events none. Editor: elements carry .feezal-editable,
        // so the rule never matches and the element stays selectable/draggable.
        expect(cssText).toContain(':host([click-through]:not(.feezal-editable))');
        expect(cssText).toMatch(/:host\(\[click-through]:not\(\.feezal-editable\)\)\s*{\s*pointer-events:\s*none/);
    });

    it('attribute and property reflect both ways', async () => {
        const el = await mount({'click-through': ''});
        expect(el.clickThrough).toBe(true);

        el.clickThrough = false;
        await el.updateComplete;
        expect(el.hasAttribute('click-through')).toBe(false);

        el.clickThrough = true;
        await el.updateComplete;
        expect(el.hasAttribute('click-through')).toBe(true);
    });

    it('is off by default — no attribute serialized', async () => {
        const el = await mount();
        expect(el.clickThrough).toBe(false);
        expect(el.hasAttribute('click-through')).toBe(false);
    });
});

// ── Baseline: templating still works ─────────────────────────────────────────

describe('template rendering (regression)', () => {
    it('renders ${msg.payload} from an incoming message', async () => {
        const callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => { callbacks[topic] = cb; return {}; });

        const el = document.createElement('feezal-element-basic-template');
        el.setAttribute('subscribe', 't/x');
        const tpl = document.createElement('template');
        tpl.innerHTML = 'Value: ${msg.payload}';
        el.append(tpl);
        document.body.append(el);
        await el.updateComplete;

        callbacks['t/x']({topic: 't/x', payload: '42'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('Value: 42');
    });
});
