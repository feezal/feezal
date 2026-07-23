import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';

// E121 — smart plug / outlet card: material-light locked to on_off mode
// (E122). One rendering/publishing code path, own palette identity.

beforeEach(() => {
    feezal.isEditor = false;
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mountOutlet(attrs = {}) {
    const el = document.createElement('feezal-element-circle-switch');
    for (const [k, v] of Object.entries({
        'subscribe-state': 'plug/state',
        'publish-state': 'plug/set',
        ...attrs,
    })) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('feezal-element-circle-switch (E121)', () => {
    it('is a material-light subclass locked to on_off mode', async () => {
        const el = await mountOutlet();
        expect(el instanceof customElements.get('feezal-element-circle-light')).toBe(true);
        expect(el.mode).toBe('on_off');
    });

    it('renders the power button without any ring track', async () => {
        const el = await mountOutlet();
        el.light.on = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('svg path')).toBeNull();
        expect([...el.shadowRoot.querySelectorAll('svg text')].some(t => t.textContent.includes('⏻'))).toBe(true);
    });

    it('tap toggles and publishes the state payload', async () => {
        const el = await mountOutlet({'payload-on': 'ON', 'payload-off': 'OFF'});
        el.light.on = false;
        el._toSvgCoords = () => ({sx: 50, sy: 20});
        el._onSvgPointerDown({preventDefault() {}, currentTarget: null});
        expect(el.light.on).toBe(true);
        expect(feezal.connection.pub).toHaveBeenCalledWith('plug/set', 'ON');
    });

    it('declares its own palette identity and no mode/brightness attributes', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        // E130: palette name aligned with glass-switch/metro-switch; the tag stays material-outlet.
        expect(cls.feezal.palette).toMatchObject({name: 'Switch', category: 'Circle'});   // E133
        const names = cls.feezal.attributes.map(a => a.name);
        expect(names).not.toContain('mode');
        expect(names).not.toContain('subscribe-brightness');
        expect(names).toContain('subscribe-state');
        // no custom inspector inherited — the reduced attribute list uses the generic panel
        expect(cls.feezal.inspector).toBeUndefined();
    });

    it('E130: carries the family switch discovery contract (glass/metro parity)', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        expect(cls.feezal.discovery.component).toBe('switch');
        expect(cls.feezal.discovery.map).toMatchObject({
            state_topic:   'subscribe-state',
            command_topic: 'publish-state',
            payload_on:    'payload-on',
            payload_off:   'payload-off',
            name:          'label',
        });
        expect(cls.feezal.discovery.map.value_template)
            .toEqual({attr: 'message-property', transform: 'valueTemplateToPath'});
    });

    it('shares the light theme tokens for styling', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        const props = cls.feezal.styles.filter(s => typeof s === 'object').map(s => s.property);
        expect(props).toContain('--feezal-light-on-color');
        expect(props).toContain('--feezal-light-surface-color');
    });
});
