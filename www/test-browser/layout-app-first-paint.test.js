/**
 * B84 — the slim rail must be right on first paint, without a resize.
 *
 * The existing suite always sized the host directly, which is the one case that
 * already worked. These mount it the way the viewer does: inside a container
 * that is hidden, or not yet sized, when the element first measures itself.
 *
 * ⚠️ Scope: the reporter's exact symptom (rail missing after a plain reload,
 * repaired by a narrow→wide cycle) was NOT reproduced here. What these pin is
 * the defect family that WAS measured — a transient sub-breakpoint width
 * latching the wrong mode, and a zero width being read as "wide".
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../src/feezal-view.js';
import {setupFeezal, until} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const ITEMS = JSON.stringify([{label: 'One', icon: 'home', view: 'page1'}]);
const SLIM_WIDTH = 64;

// .drawer animates width (0.18s), and on slow CI runners (webkit especially —
// see helpers.until) the ResizeObserver tick that STARTS the transition can
// itself arrive late, so a fixed sleep flakes. Poll until the width settles at
// the expected value (swallowing the poll timeout — the assert that follows
// reports the real value on failure).
const settleAt = (el, width) =>
    until(() => drawerWidth(el) === width).catch(() => {});

async function mountIn(container, attrs = {slim: ''}) {
    const el = document.createElement('feezal-element-layout-app');
    el.setAttribute('items', ITEMS);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.style.width = '100%';
    el.style.height = '100%';
    container.append(el);
    await el.updateComplete;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await el.updateComplete;
    return el;
}

const drawerWidth = el =>
    Math.round(el.shadowRoot.querySelector('.drawer').getBoundingClientRect().width);

describe('layout-app first paint (B84)', () => {
    it('a zero width is not mistaken for "wide"', async () => {
        // Inside a display:none container the element cannot be measured. It
        // must not conclude anything from that — in particular it must not
        // clear a narrow state or claim persistent mode from a non-measurement.
        const view = document.createElement('div');
        view.style.cssText = 'display:none;width:1000px;height:600px;';
        document.body.append(view);
        const el = await mountIn(view);

        expect(el.clientWidth, 'precondition: not measurable').toBe(0);
        // no measurement happened, so no class was written either way
        expect(el.classList.contains('narrow')).toBe(false);

        view.style.display = 'block';
        await until(() => el.clientWidth > 0);
        await el.updateComplete;
        await settleAt(el, SLIM_WIDTH);

        expect(el._narrow, 'wide once revealed').toBe(false);
        expect(el.classList.contains('narrow')).toBe(false);
        expect(drawerWidth(el), 'slim rail on first paint after reveal').toBe(SLIM_WIDTH);
        view.remove();
    });

    it('recovers when the container reaches its real width later', async () => {
        // The measured defect: the element first sees a sub-breakpoint width
        // (its container has not been sized yet), latches overlay mode, and
        // must correct itself once the real width arrives — with no user
        // interaction.
        const box = document.createElement('div');
        document.body.append(box);
        const el = await mountIn(box);

        box.style.cssText = 'width:1000px;height:600px;';
        await until(() => el.clientWidth >= 1000);
        await el.updateComplete;
        await settleAt(el, SLIM_WIDTH);

        expect(el._narrow).toBe(false);
        expect(el.classList.contains('narrow'), 'stale narrow class').toBe(false);
        expect(el.shadowRoot.querySelector('.bar .iconbtn'), 'hamburger should be gone').toBeFalsy();
        expect(drawerWidth(el)).toBe(SLIM_WIDTH);
        box.remove();
    });

    it('the narrow class always tracks the state, never drifts from it', async () => {
        // The class used to be written only inside an `if (changed)` guard, so
        // a computation that matched the initial value never established it.
        const box = document.createElement('div');
        box.style.cssText = 'width:1000px;height:600px;';
        document.body.append(box);
        const el = await mountIn(box);

        for (const w of ['400px', '1000px', '400px', '900px']) {
            box.style.width = w;
            await until(() => el.clientWidth === parseInt(w, 10));
            await el.updateComplete;
            expect(el.classList.contains('narrow'), `class out of sync at ${w}`)
                .toBe(el._narrow);
        }
        box.remove();
    });

    it('autohide shares the same gating and is correct on first paint', async () => {
        // autohide uses :host([autohide]:not(.narrow)) too, so a stale narrow
        // class would break it identically.
        const box = document.createElement('div');
        document.body.append(box);
        const el = await mountIn(box, {autohide: ''});
        box.style.cssText = 'width:1000px;height:600px;';
        await until(() => el.clientWidth >= 1000);
        await el.updateComplete;
        await settleAt(el, 8);

        expect(el.classList.contains('narrow')).toBe(false);
        expect(drawerWidth(el), 'autohide collapses to a thin edge when wide').toBe(8);
        box.remove();
    });
});
