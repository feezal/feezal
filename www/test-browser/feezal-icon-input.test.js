/**
 * feezal-icon-input — the standalone icon field (same UX as the generic
 * `type:'icon'` inspector control) used by custom inspectors (layout-app):
 * focus opens the tile popup, typing filters, click/Enter picks, and the
 * layout-app inspector persists the pick into the items/actions JSON.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-icon-input.js';
import '@feezal/feezal-element-layout-app';
import {setupFeezal} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
    feezal.app = {views: [], requestUpdate() {}, _setView() {}, change() {}};
    document.body.innerHTML = '';
});

async function mount(value = '') {
    const el = document.createElement('feezal-icon-input');
    el.value = value;
    document.body.append(el);
    await el.updateComplete;
    return el;
}

const input = el => el.shadowRoot.querySelector('sl-input');
const tiles = el => [...el.shadowRoot.querySelectorAll('.icon-tile')];

describe('feezal-icon-input', () => {
    it('opens the tile popup on focus and filters by the typed query', async () => {
        const el = await mount();
        input(el).dispatchEvent(new CustomEvent('sl-focus'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.icon-pop')).not.toBeNull();
        expect(tiles(el).length).toBeGreaterThan(0);

        input(el).value = 'lightbulb';
        input(el).dispatchEvent(new CustomEvent('sl-input'));
        await el.updateComplete;
        const names = tiles(el).map(t => t.title);
        expect(names).toContain('lightbulb');
        expect(names.every(n => n.includes('lightbulb'))).toBe(true);
    });

    it('clicking a tile emits feezal-change and closes the popup', async () => {
        const el = await mount();
        const seen = [];
        el.addEventListener('feezal-change', e => seen.push(e.detail.value));

        input(el).dispatchEvent(new CustomEvent('sl-focus'));
        input(el).value = 'lightbulb';
        input(el).dispatchEvent(new CustomEvent('sl-input'));
        await el.updateComplete;
        tiles(el).find(t => t.title === 'lightbulb').click();
        await el.updateComplete;

        expect(seen).toEqual(['lightbulb']);
        expect(el.value).toBe('lightbulb');
        expect(el.shadowRoot.querySelector('.icon-pop')).toBeNull();
        // Preview prefix shows the picked icon.
        expect(el.shadowRoot.querySelector('feezal-icon[slot=prefix]')?.getAttribute('name')).toBe('lightbulb');
    });

    it('right-anchors the popup when the field sits near the right viewport edge', async () => {
        const el = await mount();
        el.style.cssText = 'position:fixed;top:10px;right:10px;width:120px;';
        input(el).dispatchEvent(new CustomEvent('sl-focus'));
        await el.updateComplete;
        const pop = el.shadowRoot.querySelector('.icon-pop');
        expect(pop.classList.contains('align-right')).toBe(true);
        expect(pop.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
        el.remove();

        // …and stays left-anchored with room to the right.
        const el2 = await mount();
        el2.style.cssText = 'position:fixed;top:10px;left:10px;width:120px;';
        input(el2).dispatchEvent(new CustomEvent('sl-focus'));
        await el2.updateComplete;
        expect(el2.shadowRoot.querySelector('.icon-pop').classList.contains('align-right')).toBe(false);
        el2.remove();
    });

    it('Enter picks the keyboard-cursor tile', async () => {
        const el = await mount();
        const seen = [];
        el.addEventListener('feezal-change', e => seen.push(e.detail.value));

        input(el).dispatchEvent(new CustomEvent('sl-focus'));
        input(el).value = 'lightbulb';
        input(el).dispatchEvent(new CustomEvent('sl-input'));
        await el.updateComplete;
        input(el).dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, composed: true}));
        await el.updateComplete;
        input(el).dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, composed: true}));
        await el.updateComplete;

        expect(seen.length).toBe(1);
        expect(seen[0]).toContain('lightbulb');
    });
});

describe('layout-app inspector icon fields', () => {
    it('uses feezal-icon-input and persists a picked entry icon into items', async () => {
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'page1');
        site.append(view);
        document.body.append(site);
        feezal.site = site;

        const shell = document.createElement('feezal-element-layout-app');
        shell.setAttribute('items', JSON.stringify([{view: 'page1', label: 'Page'}]));
        const inspector = document.createElement('feezal-element-layout-app-inspector');
        inspector.element = shell;
        inspector.addEventListener('feezal-attribute-changed', e => {
            const {name, value} = e.detail;
            shell.setAttribute(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
            inspector.requestUpdate();
        });
        document.body.append(inspector);
        await inspector.updateComplete;

        const iconField = inspector.shadowRoot.querySelector('.item feezal-icon-input');
        expect(iconField).not.toBeNull();

        iconField.dispatchEvent(new CustomEvent('feezal-change', {bubbles: true, composed: true, detail: {value: 'home'}}));
        await inspector.updateComplete;

        expect(JSON.parse(shell.getAttribute('items'))).toEqual([{view: 'page1', label: 'Page', icon: 'home'}]);
    });
});
