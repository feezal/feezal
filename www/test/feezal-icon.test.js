import {describe, it, expect} from 'vitest';

import {registerIcons, iconSets, resolveIcon} from '../src/feezal-icon.js';

// N23 — icon-set registry + <feezal-icon> resolver element.
// The registry is module-level and persists across tests; each test uses its
// own set name (re-registering a name replaces the set).

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('registerIcons() validation', () => {
    it('rejects invalid set names', () => {
        expect(() => registerIcons('MDI', {font: {family: 'x'}, names: []})).toThrow(/invalid set name/);
        expect(() => registerIcons('1x', {font: {family: 'x'}, names: []})).toThrow(/invalid set name/);
        expect(() => registerIcons('', {font: {family: 'x'}, names: []})).toThrow(/invalid set name/);
    });

    it('requires a names array and font or render', () => {
        expect(() => registerIcons('v-a', {font: {family: 'x'}})).toThrow(/names/);
        expect(() => registerIcons('v-b', {names: []})).toThrow(/font.*render|render/);
    });

    it('registers and exposes set names on window.feezal.iconSets', () => {
        registerIcons('v-ok', {font: {family: 'VOk'}, names: ['a', 'b']});
        expect(iconSets().get('v-ok').names).toEqual(['a', 'b']);
        expect(window.feezal.iconSets).toContain('v-ok');
    });

    it('fires feezal-iconsets-changed on registration', async () => {
        let seen = null;
        const listener = e => { seen = e.detail.set; };
        document.addEventListener('feezal-iconsets-changed', listener, {once: true});
        registerIcons('v-event', {font: {family: 'VE'}, names: []});
        expect(seen).toBe('v-event');
    });
});

describe('resolveIcon()', () => {
    it('splits set:name; bare names are Material (set null)', () => {
        expect(resolveIcon('mdi:lightbulb')).toEqual({set: 'mdi', name: 'lightbulb'});
        expect(resolveIcon('lightbulb')).toEqual({set: null, name: 'lightbulb'});
        expect(resolveIcon('')).toEqual({set: null, name: ''});
        expect(resolveIcon('a:b:c')).toEqual({set: 'a', name: 'b:c'});
    });
});

describe('<feezal-icon> rendering', () => {
    function mount(name) {
        const el = document.createElement('feezal-icon');
        el.setAttribute('name', name);
        document.body.append(el);
        return el;
    }

    it('renders bare names as Material ligature', () => {
        const el = mount('lightbulb');
        const glyph = el.shadowRoot.querySelector('.glyph');
        expect(glyph.textContent).toBe('lightbulb');
        expect(glyph.style.fontFamily).toContain('Material Icons');
    });

    it('renders font-mode sets with the registered family', () => {
        registerIcons('r-font', {font: {family: 'RFont'}, names: ['x']});
        const el = mount('r-font:x');
        const glyph = el.shadowRoot.querySelector('.glyph');
        expect(glyph.textContent).toBe('x');
        expect(glyph.style.fontFamily).toContain('RFont');
    });

    it('renders render-mode sets (string and Element outputs)', () => {
        registerIcons('r-svg', {
            names: ['dot'],
            render: name => `<svg data-icon="${name}"><circle/></svg>`
        });
        const el = mount('r-svg:dot');
        expect(el.shadowRoot.querySelector('svg[data-icon="dot"]')).not.toBeNull();

        registerIcons('r-el', {
            names: ['sq'],
            render() {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.dataset.el = 'sq';
                return svg;
            }
        });
        const el2 = mount('r-el:sq');
        expect(el2.shadowRoot.querySelector('svg[data-el="sq"]')).not.toBeNull();
    });

    it('renders a visible fallback for a set that is not installed', () => {
        const el = mount('nope:thing');
        const missing = el.shadowRoot.querySelector('.missing');
        expect(missing.textContent).toBe('nope:thing');
        expect(missing.title).toContain('not installed');
    });

    it('re-renders on name change', () => {
        registerIcons('r-chg', {font: {family: 'RChg'}, names: ['a', 'b']});
        const el = mount('r-chg:a');
        el.setAttribute('name', 'r-chg:b');
        expect(el.shadowRoot.querySelector('.glyph').textContent).toBe('b');
    });

    it('re-renders when its set registers after connection', async () => {
        const el = mount('late-set:x');
        expect(el.shadowRoot.querySelector('.missing')).not.toBeNull();
        registerIcons('late-set', {font: {family: 'Late'}, names: ['x']});
        await flush();
        expect(el.shadowRoot.querySelector('.missing')).toBeNull();
        expect(el.shadowRoot.querySelector('.glyph').textContent).toBe('x');
    });
});
