/**
 * E38 element scaling — internals must scale with the element size.
 * Covers both mechanisms with real layout in a real browser:
 *   - CSS container queries (cq units on :host, e.g. material-checkbox)
 *   - ResizeObserver-driven JS scaling (e.g. material-select font scale)
 * Deterministic computed-style/rect assertions instead of pixel screenshots.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {vi} from 'vitest';
import '@feezal/feezal-element-material-checkbox';
import '@feezal/feezal-element-material-slider';
import '@feezal/feezal-element-material-select';
import {setupFeezal, mount} from './helpers.js';

beforeEach(() => {
    setupFeezal();
});

async function sized(tag, width, height, attributes = {}) {
    const el = await mount(tag, attributes);
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    await el.updateComplete;
    return el;
}

describe('container-query scaling (checkbox)', () => {
    it('the checkbox box grows with the element (55cqmin)', async () => {
        const small = await sized('feezal-element-material-checkbox', 40, 40);
        const large = await sized('feezal-element-material-checkbox', 160, 160);

        await vi.waitFor(() => {
            const smallBox = small.shadowRoot.querySelector('md-checkbox').getBoundingClientRect();
            const largeBox = large.shadowRoot.querySelector('md-checkbox').getBoundingClientRect();
            expect(smallBox.width).toBeGreaterThan(0);
            // 55cqmin: 40px element → 22px box, 160px element → 88px box
            expect(largeBox.width).toBeGreaterThan(smallBox.width * 2.5);
        });
    });

    it('the label font scales with the element (32cqmin)', async () => {
        const small = await sized('feezal-element-material-checkbox', 60, 30, {label: 'L'});
        const large = await sized('feezal-element-material-checkbox', 240, 120, {label: 'L'});

        await vi.waitFor(() => {
            const smallPx = Number.parseFloat(getComputedStyle(small.shadowRoot.querySelector('label')).fontSize);
            const largePx = Number.parseFloat(getComputedStyle(large.shadowRoot.querySelector('label')).fontSize);
            expect(smallPx).toBeGreaterThan(0);
            expect(largePx).toBeGreaterThan(smallPx * 2.5);
        });
    });
});

describe('container-query scaling (slider)', () => {
    it('the track height follows the element height (8cqh)', async () => {
        const flat = await sized('feezal-element-material-slider', 200, 30);
        const tall = await sized('feezal-element-material-slider', 200, 120);

        await vi.waitFor(() => {
            const resolve = el => {
                const probe = document.createElement('div');
                probe.style.height = 'var(--feezal-slider-track-width)';
                el.shadowRoot.append(probe);
                const px = Number.parseFloat(getComputedStyle(probe).height);
                probe.remove();
                return px;
            };
            const flatPx = resolve(flat);
            const tallPx = resolve(tall);
            expect(flatPx).toBeGreaterThan(0);
            // 8cqh: 30px → 2.4px, 120px → 9.6px
            expect(tallPx).toBeGreaterThan(flatPx * 3);
        });
    });
});

describe('ResizeObserver scaling (select)', () => {
    it('the field font scale follows the element height', async () => {
        const el = await sized('feezal-element-material-select', 200, 40, {
            options: '[{"value":"a","label":"A"}]'
        });
        await vi.waitFor(() => expect(el._fontScale).toBeGreaterThan(0));
        const smallScale = el._fontScale;

        el.style.height = '120px';
        await vi.waitFor(() => {
            expect(el._fontScale).toBeGreaterThan(smallScale * 1.5);
        });

        // and the scale is applied to the rendered md-outlined-select
        const styleAttr = el.shadowRoot.querySelector('md-outlined-select').getAttribute('style');
        expect(styleAttr).toContain(`--md-sys-typescale-body-large-size:${el._fontScale}px`);
    });
});
