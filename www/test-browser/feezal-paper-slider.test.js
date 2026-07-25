/**
 * B76 — paper-slider must ship visible, theme-aware track + knob defaults.
 * The track (container) and knob were unset, so the track resolved to ~the page
 * background (invisible) and the knob was unthemed. They now default to the
 * canonical theme vars (--divider-color / --primary-text-color).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-paper-slider/feezal-element-paper-slider.js';
import {setupFeezal, mount} from './helpers.js';

beforeEach(() => setupFeezal());

describe('paper-slider — track + knob colour defaults', () => {
    it('exposes the track + knob defaults as canonical theme vars (never the background)', () => {
        const styles = window.customElements.get('feezal-element-paper-slider').feezal.styles;
        const byProp = Object.fromEntries(styles.filter(s => s && s.property).map(s => [s.property, s]));
        expect(byProp['--paper-slider-container-color'].default).toBe('var(--divider-color)');
        expect(byProp['--paper-slider-knob-color'].default).toBe('var(--primary-text-color)');
        expect(byProp['--paper-slider-knob-start-color'].default).toBe('var(--primary-text-color)');
        // the track default must not be the (invisible) page background
        expect(byProp['--paper-slider-container-color'].default).not.toContain('primary-background');
    });

    it('resolves the knob colour from --primary-text-color at runtime', async () => {
        const el = await mount('feezal-element-paper-slider', {});
        el.style.setProperty('--primary-text-color', 'rgb(1, 2, 3)');
        await el.updateComplete;
        const knob = getComputedStyle(el).getPropertyValue('--paper-slider-knob-color').trim();
        expect(knob).toBe('rgb(1, 2, 3)');
    });
});
