/**
 * E105 glass family wide-tile row layout — cards much wider than tall
 * (container aspect ratio >= 2/1) switch from the stacked column layout
 * (flex) to a horizontal grid: icon left, state/label right of it.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-glass-switch';
import '@feezal/feezal-element-glass-light';
import '@feezal/feezal-element-glass-sensor';
import {setupFeezal, mount, until} from './helpers.js';

beforeEach(() => {
    setupFeezal();
});

/** Mount a card at the given size and wait until the container query has
 * settled on the expected .card display value (container queries need real
 * layout — poll across frames instead of asserting immediately). */
async function displayAt(tag, width, height, expected) {
    const el = await mount(tag, {});
    el.style.cssText = `display:block;position:fixed;left:0;top:0;width:${width}px;height:${height}px;`;
    await el.updateComplete;
    const card = el.shadowRoot.querySelector('.card');
    await until(() => getComputedStyle(card).display === expected);
    return getComputedStyle(card).display;
}

describe('glass wide-tile row layout (E105)', () => {
    it('glass-switch: grid at 320x100 (wide), flex at 150x150 (square)', async () => {
        expect(await displayAt('feezal-element-glass-switch', 320, 100, 'grid')).toBe('grid');
        expect(await displayAt('feezal-element-glass-switch', 150, 150, 'flex')).toBe('flex');
    });

    it('glass-light: grid at 320x100, flex at 150x150', async () => {
        expect(await displayAt('feezal-element-glass-light', 320, 100, 'grid')).toBe('grid');
        expect(await displayAt('feezal-element-glass-light', 150, 150, 'flex')).toBe('flex');
    });

    it('glass-sensor: grid at 320x100, flex at 150x150', async () => {
        expect(await displayAt('feezal-element-glass-sensor', 320, 100, 'grid')).toBe('grid');
        expect(await displayAt('feezal-element-glass-sensor', 150, 150, 'flex')).toBe('flex');
    });
});
