import {describe, it, expect, beforeEach} from 'vitest';

import {registerIcons} from '../src/feezal-icon.js';
import '../packages/@feezal/feezal-element-basic-icon/feezal-element-basic-icon.js';

// Re-register per test — the shared setup resets globalThis.feezal.
beforeEach(() => {
    registerIcons('bi', {names: ['dot'], render: name => `<svg data-n="${name}"></svg>`});
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-icon');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

const iconName = el => el.shadowRoot.querySelector('feezal-icon')?.getAttribute('name');

describe('rendering', () => {
    it('shows the configured icon (bare Material and set-prefixed)', async () => {
        expect(iconName(await mount({icon: 'lightbulb'}))).toBe('lightbulb');
        expect(iconName(await mount({icon: 'bi:dot'}))).toBe('bi:dot');
    });

    it('renders nothing without an icon', async () => {
        const el = await mount();
        expect(el.shadowRoot.querySelector('feezal-icon')).toBeNull();
    });

    it('a payload-style attribute update switches the icon (baseAttribute)', async () => {
        const el = await mount({icon: 'lightbulb'});
        el.setAttribute('icon', 'bi:dot');   // what _subscribe does with a payload
        await el.updateComplete;
        expect(iconName(el)).toBe('bi:dot');
    });

    it('declares baseAttribute icon so payloads drive the symbol', () => {
        const cls = customElements.get('feezal-element-basic-icon');
        expect(cls.feezal.baseAttribute).toBe('icon');
    });
});

describe('colour property', () => {
    it('exposes exactly one colour style with the themed default', () => {
        const cls = customElements.get('feezal-element-basic-icon');
        const colors = cls.feezal.styles.filter(s => typeof s === 'object' && s.type === 'color');
        expect(colors).toEqual([{
            property: '--feezal-icon-color', type: 'color',
            default: 'var(--primary-text-color)', help: 'Icon colour.'
        }]);
    });

    it('binds the glyph colour to the property', async () => {
        const el = await mount({icon: 'lightbulb'});
        const cssText = el.constructor.styles.map(s => s.cssText ?? '').join('\n');
        expect(cssText).toContain('color: var(--feezal-icon-color, var(--primary-text-color');
    });
});

describe('click-through', () => {
    it('host styles disable pointer events, re-enabled for the editor class', () => {
        const cls = customElements.get('feezal-element-basic-icon');
        const cssText = cls.styles.map(s => s.cssText ?? '').join('\n');
        // :host rule blocks events (viewer); .feezal-editable re-enables (editor).
        expect(cssText).toMatch(/:host\s*{[^}]*pointer-events:\s*none/);
        expect(cssText).toMatch(/:host\(\.feezal-editable\)\s*{[^}]*pointer-events:\s*auto/);
    });
});
