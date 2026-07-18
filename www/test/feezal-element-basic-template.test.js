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

// ── N35: object/array payloads render as compact JSON, not [object Object] ──

describe('object/array coercion in templates (N35)', () => {
    async function mountWithTemplate(templateHtml) {
        const callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => { callbacks[topic] = cb; return {}; });

        const el = document.createElement('feezal-element-basic-template');
        el.setAttribute('subscribe', 't/x');
        const tpl = document.createElement('template');
        tpl.innerHTML = templateHtml;
        el.append(tpl);
        document.body.append(el);
        await el.updateComplete;

        return {el, emit: async msg => { callbacks['t/x'](msg); await el.updateComplete; }};
    }

    it('bare ${msg.payload} with an object payload renders compact JSON', async () => {
        const {el, emit} = await mountWithTemplate('${msg.payload}');
        const payload = {temperature: 21.5, hum: 40};
        await emit({topic: 't/x', payload});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('{"temperature":21.5,"hum":40}');
    });

    it('nested ${msg.payload.sensors[0]} renders compact JSON', async () => {
        const {el, emit} = await mountWithTemplate('${msg.payload.sensors[0]}');
        const payload = {sensors: [{value: 1}, {value: 2}]};
        await emit({topic: 't/x', payload});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('{"value":1}');
    });

    it('array payload renders as compact JSON, not "[object Object],[object Object]"', async () => {
        const {el, emit} = await mountWithTemplate('${msg.payload}');
        const payload = [{a: 1}, {a: 2}];
        await emit({topic: 't/x', payload});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('[{"a":1},{"a":2}]');
    });

    it('primitive payloads (string/number/boolean) render unchanged', async () => {
        const {el, emit} = await mountWithTemplate('${msg.payload}');

        await emit({topic: 't/x', payload: 'hello'});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('hello');

        await emit({topic: 't/x', payload: 42});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('42');

        await emit({topic: 't/x', payload: true});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('true');
    });

    it('property access into nested objects is unaffected', async () => {
        const {el, emit} = await mountWithTemplate('${msg.payload.a.b}');
        await emit({topic: 't/x', payload: {a: {b: 'deep'}}});
        expect(el.renderRoot.querySelector('#content').innerHTML).toBe('deep');
    });

    it('does not mutate the original message object shared with other subscribers', async () => {
        const {emit} = await mountWithTemplate('${msg.payload}');
        const payload = {temperature: 21.5};
        const msg = {topic: 't/x', payload};
        await emit(msg);
        expect(Object.prototype.hasOwnProperty.call(payload, 'toString')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(msg, 'toString')).toBe(false);
        expect(payload.toString).toBe(Object.prototype.toString);
    });
});
