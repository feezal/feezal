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
 *
 * G sits far along A/B's row, leaving a 250px hole between B[..250] and
 * G[500..] — wide enough for D (100) with 75px either side, which is the
 * CENTRING case. Its own rhythms (gap 250) land far outside snap range, so it
 * cannot disturb the two above.
 *
 * The exact coordinates matter more than they look. E/F sit at x=330 and the
 * row at y=210 so that NEITHER rhythm's proposal (300 / 200) lands on an
 * element edge — otherwise B117 would dedupe the gap line away and most of
 * these cases would be testing the wrong thing. The one case that WANTS the
 * collision builds it itself, by moving E onto the proposal for that test.
 */
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    at('a', 0, 210) + at('b', 150, 210) + at('g', 500, 210) +
    at('e', 330, 0) + at('f', 330, 100) +
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
    const read = el => {
        const label = getComputedStyle(el, '::after');
        const own = getComputedStyle(el);
        return {
            pos: el.dataset.pos,
            // Chromium resolves attr() here, so this is the text actually painted.
            rendered: label.content,
            transform: label.transform,
            writingMode: label.writingMode,
            pointerEvents: label.pointerEvents,
            // U101: the line's own ink, and the label's — the label inherits it.
            lineColor: own.borderRightColor === 'rgba(0, 0, 0, 0)' || !own.borderRightWidth.startsWith('1')
                ? own.borderBottomColor : own.borderRightColor,
            labelColor: label.color,
        };
    };
    return {
        vsnap: shown('#vsnap1, #vsnap2').map(read),
        hsnap: shown('#hsnap1, #hsnap2').map(read),
        gapV: shown('.gap-vline').map(read),
        gapH: shown('.gap-hline').map(read),
        // U101: the gap arrows and their px labels are part of the same overlay.
        arrows: shown('.gap-arrow').map(el => {
            const own = getComputedStyle(el);
            return {
                color: own.color,
                border: el.classList.contains('vertical') ? own.borderLeftColor : own.borderTopColor,
                tick: getComputedStyle(el, '::before').backgroundColor,
            };
        }),
    };
});

/** U101 — set a guide colour through the real editor-settings panel. */
const setSnapColor = value => page.evaluate(v => {
    const app = window.feezal.app;
    app.snapColor = v;
    localStorage.setItem('snapColor', v);
}, value);

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
        expect(g.vlines).toBe(1);   // B116: one per ACTIVE axis
    });

    it('clears every marker when the drag ends', async () => {
        await resetD();
        await dragHold('d', 296, 196);
        await release();
        const g = await guides();
        expect(g).toMatchObject({arrows: 0, vlines: 0, hlines: 0});
    });
});

describe('B113 + B116 — one helper line per axis, across the canvas', () => {
    it('draws a single full-canvas line per axis, perpendicular to the arrow', async () => {
        await resetD();
        await dragHold('d', 296, 196);
        const g = await guides();
        const canvas = await page.evaluate(() => {
            const cv = window.feezal.app.shadowRoot.querySelector('#container-view');
            const r = cv.getBoundingClientRect();
            return {w: Math.round(r.width), h: Math.round(r.height)};
        });
        await release();

        // B116: not one per span end — one per axis, at the dragged element's
        // own edge (where the snap lands). Both axes propose here, so one each.
        expect(g.vlines).toBe(1);
        expect(g.hlines).toBe(1);
        // "Across the whole canvas": each line spans its axis, so the proposed
        // arrow can only ever terminate ON it.
        for (const width of g.hlineWidths) expect(width).toBe(canvas.w);
        for (const height of g.vlineHeights) expect(height).toBeGreaterThan(canvas.h * 0.8);
    });

    /**
     * Centring has a gap on EACH side, so both borders of the dragged element
     * are snapped-to — one line there would draw half the story the snap makes.
     */
    it('marks both borders of the element when centring it between two', async () => {
        await resetD();
        // The hole runs B[..250] → G[500..]; D (100 wide) centres at 325, so its
        // borders land on 325 and 425. Dropped 4px short of that, and at y=230,
        // which is inside A/B/G's row but 30px off the y rhythm — one axis only.
        await dragHold('d', 321, 230);
        const g = await guides();
        const r = await readouts();
        await release();

        expect(g.vlines).toBe(2);
        expect(g.hlines).toBe(0);          // the y axis proposes nothing here
        expect(r.gapV.map(l => l.pos)).toEqual(['325', '425']);
        // …and the arrows still measure the two equal 75px gaps either side.
        expect(g.horizontalArrows).toBe(2);
        expect(g.labels).toEqual(['75']);
    });

    /**
     * B117 — a gap-snapped position usually IS an aligned edge, and both passes
     * drew their own line there: two dotted lines on one coordinate paint as a
     * single fat smudge with the label written twice.
     */
    it('draws the line ONCE when a gap snap and an edge snap coincide', async () => {
        // Build the collision: put E's left edge exactly on the x rhythm's
        // proposal (300), so the N11 pass and the gap pass both want a vertical
        // line there. Restored afterwards — every other case needs E at 330.
        const moveE = left => page.evaluate(l => {
            window.feezal.view.querySelector('[label="e"]').style.left = l + 'px';
        }, left);
        await moveE(300);
        try {
            await resetD();
            await dragHold('d', 296, 196);
            const r = await readouts();
            await release();

            const at300 = [...r.vsnap, ...r.gapV].filter(l => l.pos === '300');
            expect(at300).toHaveLength(1);                          // one line, not two
            expect(r.gapV.map(l => l.pos)).not.toContain('300');    // the edge guide kept it
            expect(at300[0].rendered).toBe('"300"');                // …and one label
        } finally {
            await moveE(330);
        }
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
        // B117: the bare value — the label's orientation already says the axis.
        expect(r.vsnap.map(l => l.pos)).toContain(`${a.left}`);
        expect(r.hsnap.map(l => l.pos)).toContain(`${a.top}`);
        // …and every line paints exactly what it carries.
        for (const line of [...r.vsnap, ...r.hsnap]) {
            expect(line.rendered).toBe(`"${line.pos}"`);
        }
    });

    // (The vertical readout's orientation and placement moved in U102 — its own
    // describe below owns that assertion now, rather than two tests disagreeing
    // about which quarter turn is current.)

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

    it('labels the gap helper line too, with the same view-relative value', async () => {
        await resetD();
        await dragHold('d', 296, 196);          // both rhythms live
        const r = await readouts();
        await release();

        // B116 leaves one line per axis: where the dragged element's own edge
        // lands — x at 300, y at 200, which is exactly the proposed position.
        expect(r.gapV.map(l => l.pos)).toEqual(['300']);
        expect(r.gapH.map(l => l.pos)).toEqual(['200']);
        expect(r.gapV[0].rendered).toBe('"300"');
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

        expect(r.vsnap[0].pos).toBe(`${a.left}`);
        expect(r.hsnap[0].pos).toBe(`${a.top}`);
    });
});

describe('U101 — the whole overlay follows the configured guide colour', () => {
    const RED = 'rgb(220, 20, 60)';

    afterAll(() => setSnapColor('#cccccc'));

    /**
     * The refinement this item shipped with, verbatim: element-snap lines, gap
     * lines, gap arrows, helper-line labels AND gap-arrow labels — all of them.
     * Before U101 the lines borrowed the GRID colour and the arrows used the
     * editor accent, so neither followed a setting of their own.
     */
    it('paints every guide, arrow and label in the configured colour', async () => {
        await setSnapColor('#dc143c');
        await resetD();
        // (307, 196) lights up ALL FOUR families at once: both gap axes propose
        // (300 / 200) and both dragged edges are in range of an element edge
        // (E's left at 330, A's top at 210). A position missing one family
        // would let that family keep a hardcoded colour unnoticed.
        await dragHold('d', 307, 196);
        const r = await readouts();
        await release();

        expect(r.vsnap.length).toBeGreaterThan(0);        // element-snap, vertical
        expect(r.hsnap.length).toBeGreaterThan(0);        // element-snap, horizontal
        expect(r.gapV.length).toBeGreaterThan(0);         // gap helper, vertical
        expect(r.gapH.length).toBeGreaterThan(0);         // gap helper, horizontal

        const lines = [...r.vsnap, ...r.hsnap, ...r.gapV, ...r.gapH];
        for (const line of lines) {
            expect(line.lineColor).toBe(RED);             // the dotted rule
            expect(line.labelColor).toBe(RED);            // …and its readout
        }
        expect(r.arrows.length).toBe(4);
        for (const arrow of r.arrows) {
            expect(arrow.color).toBe(RED);                // the px label
            expect(arrow.border).toBe(RED);               // the span rule
            expect(arrow.tick).toBe(RED);                 // and its end ticks
        }
    });

    /**
     * Before U101 the guides took the GRID colour, as an inline borderColor
     * written whenever the grid was re-rendered — an inline style that would
     * beat the new setting. The coupling had to be removed, not redirected, and
     * it only bites once the grid has actually been re-rendered.
     */
    it('does not fall back to the grid colour when the grid re-renders mid-drag', async () => {
        await setSnapColor('#dc143c');
        await resetD();
        await dragHold('d', 307, 196);
        // MID-DRAG on purpose. The guides' own positioning writes cssText, which
        // wipes any inline style — so the old coupling could only ever show
        // through in the window between a grid re-render and the next pointer
        // move. Narrow, but it is the window the removal is about.
        await page.evaluate(() => {
            const app = window.feezal.app;
            app.gridColor = '#00ff00';
            app.shadowRoot.querySelector('feezal-sidebar-inspector').gridColor = '#00ff00';
            app.shadowRoot.querySelector('feezal-sidebar-inspector')._gridSizeChanged();
        });
        const r = await readouts();
        await release();

        for (const line of [...r.vsnap, ...r.hsnap]) {
            expect(line.lineColor).toBe(RED);            // not the green grid
        }
    });

    it('applies a new colour without a reload, mid-session', async () => {
        await setSnapColor('#008000');
        await resetD();
        await dragHold('d', 296, 196);
        const r = await readouts();
        await release();
        expect(r.gapV[0].lineColor).toBe('rgb(0, 128, 0)');
        expect(r.arrows[0].color).toBe('rgb(0, 128, 0)');
    });

    it('carries alpha through to the painted colour', async () => {
        // Half-transparent guides over a busy dashboard are the point of the
        // alpha channel; the value must survive as authored, not flatten.
        await setSnapColor('#dc143c80');
        await resetD();
        await dragHold('d', 296, 196);
        const r = await readouts();
        await release();
        expect(r.gapV[0].lineColor).toMatch(/^rgba\(220, 20, 60, 0\.5/);
        expect(r.arrows[0].color).toMatch(/^rgba\(220, 20, 60, 0\.5/);
    });
});

describe('U102 — the vertical readout reads top-down, right of the line', () => {
    it('is vertical writing near the TOP, not a bottom-up rotation', async () => {
        await resetD();
        const a = await box('a');
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        const geometry = await page.evaluate(() => {
            const line = [...window.feezal.container.querySelectorAll('#vsnap1, #vsnap2')]
                .find(el => getComputedStyle(el).display !== 'none');
            const lineBox = line.getBoundingClientRect();
            // The ::after box is not directly measurable; its offset comes from
            // the declared left/top, which is what decides the side and the end.
            const label = getComputedStyle(line, '::after');
            return {left: label.left, top: label.top, lineWidth: Math.round(lineBox.width)};
        });
        await release();

        // U99 shipped rotate(-90deg) reading bottom-up; U102 is 180° from that.
        expect(r.vsnap[0].writingMode).toBe('vertical-rl');
        expect(r.vsnap[0].transform).toBe('none');
        // …to the RIGHT of the line (positive offset past its 1px width)…
        expect(Number.parseFloat(geometry.left)).toBeGreaterThan(geometry.lineWidth);
        // …and anchored at the TOP, not the bottom.
        expect(Number.parseFloat(geometry.top)).toBeLessThan(20);
    });

    it('leaves the horizontal readout upright, as shipped', async () => {
        await resetD();
        const a = await box('a');
        await dragHold('d', a.left + 6, a.top + 6);
        const r = await readouts();
        await release();
        expect(r.hsnap[0].transform).toBe('none');
        expect(r.hsnap[0].writingMode).toBe('horizontal-tb');
    });
});
