/**
 * E2E: the canvas snap guides under two conditions the unit tests cannot reach —
 * a real interact.js drag, and a real scrolled page.
 *
 * B112 — a drag position where BOTH axes propose an equal gap must annotate
 *        both. They used to share one pair of markers, so the axes fought and
 *        the indicators flickered by whichever won that frame.
 * B113 — every gap arrow ends on a full-canvas helper line at 90°, so the span
 *        visibly runs BETWEEN two edges instead of floating in the gap.
 * B114 — interact.js works in PAGE coordinates while every measurement in the
 *        snap path is CLIENT space. Identical until the window itself scrolls,
 *        which an undersized editor window does — and then snapping and the
 *        drag restriction were both off by exactly the scroll amount.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'snapguides';
const at = (label, left, top, w = 100, h = 50) =>
    `<feezal-element-basic-number label="${label}" ` +
    `style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;"></feezal-element-basic-number>`;

/**
 * Two independent rhythms of 50px that meet at (300, 200):
 *   x — A[0..100] gap50 B[150..250]  → the next equal gap starts at 300
 *   y — E[0..50]  gap50 F[100..150]  → the next equal gap starts at 200
 * A/B share D's row only; E/F share D's column only, so neither rhythm can
 * accidentally satisfy the other axis.
 */
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    at('a', 0, 200) + at('b', 150, 200) +
    at('e', 300, 0) + at('f', 300, 100) +
    at('d', 600, 400) +
    '</feezal-view></feezal-site>';

let stack, page;

// UNDERSIZED on purpose, and set BEFORE the editor loads: at this width the
// editor shell overflows horizontally, which is what gives the page a scrollbar
// of its own — the B114 premise. Resizing after load is not the same thing.
//
// Not smaller than this, though: every position below has to stay inside the
// VISIBLE canvas. Parking an element past its right edge makes feezal-site grow
// a scrollbar, and the drag that brings it back removes the scrollbar mid-drag —
// interact captured the start rect before that layout shift, so the element ends
// up ~12px off its snap. A test artifact, but an expensive one to re-diagnose.
const VIEWPORT = {width: 1200, height: 800};

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.setViewportSize(VIEWPORT);
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 90_000);

afterAll(async () => { await stopStack(stack); });

const box = label => page.evaluate(l => {
    const e = window.feezal.view.querySelector(`[label="${l}"]`);
    const r = e.getBoundingClientRect();
    return {left: e.offsetLeft, top: e.offsetTop, clientX: r.x, clientY: r.y, w: r.width, h: r.height};
}, label);

/** Park `d` well away from every rhythm — and inside the visible canvas, which
 *  is what the pointer can actually reach at this deliberately small viewport. */
const resetD = (left = 450, top = 430) => page.evaluate(({l, t}) => {
    const d = window.feezal.view.querySelector('[label="d"]');
    d.style.left = l + 'px'; d.style.top = t + 'px';
}, {l: left, t: top});

/** What the gap-guide markers currently show. */
const guides = () => page.evaluate(() => {
    const shown = sel => [...window.feezal.container.querySelectorAll(sel)]
        .filter(el => el.style.display === 'block');
    const arrows = shown('.gap-arrow');
    return {
        arrows: arrows.length,
        horizontalArrows: arrows.filter(el => !el.classList.contains('vertical')).length,
        verticalArrows: arrows.filter(el => el.classList.contains('vertical')).length,
        labels: [...new Set(arrows.map(el => el.textContent))].sort(),
        vlines: shown('.gap-vline').length,
        hlines: shown('.gap-hline').length,
        // B113: the line's cross-axis extent — a helper line spans the canvas.
        vlineHeights: shown('.gap-vline').map(el => Math.round(el.getBoundingClientRect().height)),
        hlineWidths: shown('.gap-hline').map(el => Math.round(el.getBoundingClientRect().width)),
    };
});

/**
 * U99 — what each visible guide line reads out. The label is a ::after fed by
 * `data-pos`, so the computed style is the only place the rendered text exists.
 */
const readouts = () => page.evaluate(() => {
    const shown = sel => [...window.feezal.container.querySelectorAll(sel)]
        .filter(el => getComputedStyle(el).display !== 'none');
    const read = el => ({
        pos: el.dataset.pos,
        // Chromium resolves attr() here, so this is the text actually painted.
        rendered: getComputedStyle(el, '::after').content,
        transform: getComputedStyle(el, '::after').transform,
        pointerEvents: getComputedStyle(el, '::after').pointerEvents,
    });
    return {
        vsnap: shown('#vsnap1, #vsnap2').map(read),
        hsnap: shown('#hsnap1, #hsnap2').map(read),
        gapV: shown('.gap-vline').map(read),
        gapH: shown('.gap-hline').map(read),
    };
});

/** Press, move to (targetLeft, targetTop) in view coordinates, and HOLD. */
async function dragHold(label, targetLeft, targetTop) {
    // Select first, so the inspector re-render that selection triggers happens
    // BEFORE the gesture rather than inside interact's dragstart. Not what
    // caused the ~12px drift chased during B114 (that was the canvas scrollbar,
    // see VIEWPORT above) — just one less thing moving during a drag.
    await page.evaluate(l => {
        const el = window.feezal.view.querySelector(`[label="${l}"]`);
        window.feezal.app.shadowRoot.querySelector('feezal-sidebar-inspector').selectElement(el);
    }, label);
    const b = await box(label);
    const sx = Math.round(b.clientX + b.w / 2);
    const sy = Math.round(b.clientY + b.h / 2);
    const dx = targetLeft - b.left;
    const dy = targetTop - b.top;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // Fine steps, then one repeat of the final position: interact modifies the
    // position per pointer event, and a coarse last jump can leave the element
    // a few px off the snap it just computed.
    await page.mouse.move(sx + dx, sy + dy, {steps: 24});
    await page.mouse.move(sx + dx, sy + dy);
    return {x: sx + dx, y: sy + dy};
}

/** Release, then let the post-drag work settle — `onend` marks the site dirty,
 *  and that re-render should finish before the next gesture starts. */
const release = async () => {
    await page.mouse.up();
    await page.waitForTimeout(150);
};

describe('B112 — both axes annotate at once', () => {
    it('shows a horizontal AND a vertical span when both rhythms are in range', async () => {
        await resetD();
        // 4px short of (300, 200) on both axes: inside the gap range, and not
        // exactly on it, so this is the proposal state and not a coincidence.
        await dragHold('d', 296, 196);
        const g = await guides();
        await release();

        expect(g.horizontalArrows).toBe(2);   // the measured x gap and the proposed one
        expect(g.verticalArrows).toBe(2);     // …and the same on y, simultaneously
        expect(g.arrows).toBe(4);
        expect(g.labels).toEqual(['50']);     // both rhythms are 50px
    });

    it('shows one axis only when only one rhythm is in range', async () => {
        await resetD();
        // Still inside a/b's row (the x rhythm needs that overlap to exist at
        // all), but 30px off the y rhythm's 200 — outside the 24px range.
        await dragHold('d', 296, 230);
        const g = await guides();
        await release();

        expect(g.horizontalArrows).toBe(2);
        expect(g.verticalArrows).toBe(0);
        expect(g.hlines).toBe(0);
        expect(g.vlines).toBe(4);
    });

    it('clears every marker when the drag ends', async () => {
        await resetD();
        await dragHold('d', 296, 196);
        await release();
        const g = await guides();
        expect(g).toMatchObject({arrows: 0, vlines: 0, hlines: 0});
    });
});

describe('B113 — helper lines across the canvas', () => {
    it('draws a full-canvas line at every span end, perpendicular to the arrow', async () => {
        await resetD();
        await dragHold('d', 296, 196);
        const g = await guides();
        const canvas = await page.evaluate(() => {
            const cv = window.feezal.app.shadowRoot.querySelector('#container-view');
            const r = cv.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height)};
        });
        await release();

        // x spans end at a.right(100) b.left(150) b.right(250) and 300 → four
        // verticals; y spans at 50/100/150/200 → four horizontals.
        expect(g.vlines).toBe(4);
        expect(g.hlines).toBe(4);
        // "Across the whole canvas": each line spans its axis, so an arrow can
        // only ever terminate ON one of them.
        for (const width of g.hlineWidths) expect(width).toBe(canvas.w);
        for (const height of g.vlineHeights) expect(height).toBeGreaterThan(canvas.h * 0.8);
    });

    it('draws no helper lines when no gap is proposed', async () => {
        await resetD();
        await dragHold('d', 450, 430);        // no rhythm anywhere near
        const g = await guides();
        await release();
        expect(g).toMatchObject({arrows: 0, vlines: 0, hlines: 0});
    });
});

describe('B114 — a scrolled page must not move the snap', () => {
    const PARK = {left: 450, top: 430};
    const HOME = () => resetD(PARK.left, PARK.top);

    /** Drag `d` 6px off a's left edge — inside the 24px range, so it must land on it. */
    const xTrial = async () => {
        await HOME();
        const a = await box('a');
        await dragHold('d', a.left + 6, PARK.top);
        await release();
        return (await box('d')).left - a.left;
    };

    it('page NOT scrolled (control)', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(await xTrial()).toBe(0);
    });

    it('page scrolled right', async () => {
        const sx = await page.evaluate(() => {
            window.scrollTo(300, 0);
            return window.scrollX;
        });
        expect(sx).toBeGreaterThan(0);        // the premise: the page really scrolled
        expect(await xTrial()).toBe(0);
    });

    // No vertical twin here on purpose: dragging toward the top of the window
    // makes the browser re-scroll the page mid-drag, so `window.scrollY` cannot
    // be held at a known value long enough to prove anything. The vertical term
    // is pinned in test/feezal-sidebar-inspector-logic.test.js, where the shims
    // are exercised directly on both axes.

    it('the drag restriction clamps at the same place, scrolled or not', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await HOME();
        await dragHold('d', -1200, PARK.top);
        await release();
        const unscrolled = (await box('d')).left;

        await HOME();
        await page.evaluate(() => window.scrollTo(300, 0));
        await dragHold('d', -1200, PARK.top);
        await release();
        const scrolled = (await box('d')).left;

        expect(unscrolled).toBe(0);           // the view's left edge
        expect(scrolled).toBe(unscrolled);    // …and the scroll does not move it
    });
});

describe('U99 — every guide line reads out its position', () => {
    it('an edge guide shows the view-relative left/top it sits on', async () => {
        await resetD();
        const a = await box('a');       // a is at (0, 200)
        // 6px off a's left edge and 6px off a's top edge: both axes snap, so
        // one vertical and one horizontal guide are up at once.
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        await release();

        // d and a are the same size, so BOTH dragged edges find a target on
        // each axis (N11 tracks four sides) — the leading edge is the one the
        // readout has to name.
        expect(r.vsnap.map(l => l.pos)).toContain(`left: ${a.left}`);
        expect(r.hsnap.map(l => l.pos)).toContain(`top: ${a.top}`);
        // …and every line paints exactly what it carries.
        for (const line of [...r.vsnap, ...r.hsnap]) {
            expect(line.rendered).toBe(`"${line.pos}"`);
        }
    });

    it('rotates the vertical readout a quarter turn and leaves the horizontal upright', async () => {
        await resetD();
        const a = await box('a');
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        await release();

        // rotate(-90deg) → matrix(0, -1, 1, 0, …)
        expect(r.vsnap[0].transform).toMatch(/^matrix\(0, -1, 1, 0/);
        expect(r.hsnap[0].transform).toBe('none');
    });

    it('never lets a readout intercept the pointer mid-drag', async () => {
        await resetD();
        const a = await box('a');
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        await release();
        for (const line of [...r.vsnap, ...r.hsnap]) {
            expect(line.pointerEvents).toBe('none');
        }
    });

    it('labels the gap helper lines too, with the same view-relative values', async () => {
        await resetD();
        await dragHold('d', 296, 196);          // both rhythms live
        const r = await readouts();
        await release();

        // The x spans end at a.right(100) b.left(150) b.right(250) and 300.
        expect(r.gapV.map(l => l.pos))
            .toEqual(['left: 100', 'left: 150', 'left: 250', 'left: 300']);
        // The y spans end at e.bottom(50) f.top(100) f.bottom(150) and 200.
        expect(r.gapH.map(l => l.pos))
            .toEqual(['top: 50', 'top: 100', 'top: 150', 'top: 200']);
        expect(r.gapV[0].rendered).toBe('"left: 100"');
    });

    it('keeps the readout view-relative when the canvas is scrolled', async () => {
        // The label must show the number the element's own `left` style uses,
        // not where the line lands inside the scrolled container (B114's audit
        // applied to the readout).
        await page.evaluate(() => { window.feezal.site.scrollLeft = 120; });
        await resetD();
        const a = await box('a');
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        await release();
        await page.evaluate(() => { window.feezal.site.scrollLeft = 0; });

        expect(r.vsnap[0].pos).toBe(`left: ${a.left}`);
        expect(r.hsnap[0].pos).toBe(`top: ${a.top}`);
    });
});
