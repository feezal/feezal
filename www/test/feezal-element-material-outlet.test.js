import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';

// E121 — Circle switch / smart-plug card: a large round power button.
// B92: a standalone plain switch (subscribe / publish, like glass/metro-switch)
// — no longer a circle-light subclass — with the light card's power-button look.

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
        subscribe: 'plug/state',
        publish: 'plug/set',
        ...attrs,
    })) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('feezal-element-circle-switch (E121)', () => {
    it('B92: is a plain FeezalElement, NOT a circle-light subclass', async () => {
        const el = await mountOutlet();
        const light = customElements.get('feezal-element-circle-light');
        // circle-light need not even be registered here; if it is, we are not it.
        if (light) expect(el instanceof light).toBe(false);
        expect(el.light).toBeUndefined();   // no LightController
    });

    it('renders the power button without any ring track', async () => {
        const el = await mountOutlet();
        el._on = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('svg path')).toBeNull();
        expect([...el.shadowRoot.querySelectorAll('svg text')].some(t => t.textContent.includes('⏻'))).toBe(true);
    });

    it('tap toggles and publishes to the publish topic', async () => {
        const el = await mountOutlet({'payload-on': 'ON', 'payload-off': 'OFF'});
        el._on = false;
        el.toggle();
        expect(el._on).toBe(true);
        expect(feezal.connection.pub).toHaveBeenCalledWith('plug/set', 'ON');
    });

    it('B92: legacy instances carrying subscribe-state / publish-state still publish', async () => {
        const el = document.createElement('feezal-element-circle-switch');
        el.setAttribute('subscribe-state', 'old/state');
        el.setAttribute('publish-state', 'old/set');
        el.setAttribute('payload-on', 'ON');
        document.body.append(el);
        await el.updateComplete;
        el._on = false;
        el.toggle();
        expect(feezal.connection.pub).toHaveBeenCalledWith('old/set', 'ON');
    });

    it('does not publish in the editor', async () => {
        const el = await mountOutlet();
        feezal.isEditor = true;
        el.toggle();
        expect(feezal.connection.pub).not.toHaveBeenCalled();
    });

    it('declares its own palette identity and no mode/brightness attributes', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        expect(cls.feezal.palette).toMatchObject({name: 'Switch', category: 'Circle'});
        const names = cls.feezal.attributes.map(a => a.name);
        expect(names).not.toContain('mode');
        expect(names).not.toContain('subscribe-brightness');
        expect(names).toContain('subscribe');
        expect(names).toContain('publish');
        // generic attribute panel — no custom inspector
        expect(cls.feezal.inspector).toBeUndefined();
    });

    it('B92: carries the family switch discovery contract (glass/metro parity)', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        expect(cls.feezal.discovery.component).toBe('switch');
        expect(cls.feezal.discovery.map).toMatchObject({
            state_topic:   'subscribe',
            command_topic: 'publish',
            payload_on:    'payload-on',
            payload_off:   'payload-off',
            name:          'label',
        });
        expect(cls.feezal.discovery.map.value_template)
            .toEqual({attr: 'message-property', transform: 'valueTemplateToPath'});
        // E156: a lamp offered as a plain on/off switch is accepted.
        expect(cls.feezal.discovery.accepts).toBeTruthy();
    });

    it('shares the light theme tokens for styling', () => {
        const cls = customElements.get('feezal-element-circle-switch');
        const props = cls.feezal.styles.filter(s => typeof s === 'object').map(s => s.property);
        expect(props).toContain('--feezal-light-on-color');
        expect(props).toContain('--feezal-light-surface-color');
    });
});
