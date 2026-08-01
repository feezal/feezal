/**
 * B80 — switching a view between `absolute` and `flow`.
 *
 * Two coupled defects: the switch only re-styled (children kept the previous
 * mode's interact.js wiring AND their inline offsets, so tiles scattered until
 * a reload), and `initFlow` *deleted* top/left, so switching back piled every
 * element at 0,0 — irrecoverably, once a flow layout had been deployed.
 *
 * The fix parks the offsets on `data-abs-*` instead of deleting them. That
 * attribute is editor state: it must survive save/deploy (so the round trip is
 * lossless) but never reach a viewer. Both halves are pinned here.
 */
import {describe, it, expect, beforeEach} from 'vitest';

import {stashAbsoluteGeometry, restoreAbsoluteGeometry} from '../src/feezal-canvas-geometry.js';

function makeEl({top = '', left = '', absTop = null, absLeft = null, rect = null} = {}) {
    const el = document.createElement('div');
    if (top) el.style.top = top;
    if (left) el.style.left = left;
    if (absTop !== null) el.setAttribute('data-abs-top', absTop);
    if (absLeft !== null) el.setAttribute('data-abs-left', absLeft);
    if (rect) {
        el.getBoundingClientRect = () => ({
            top: rect.top, left: rect.left, width: rect.w ?? 100, height: rect.h ?? 50,
            right: rect.left + (rect.w ?? 100), bottom: rect.top + (rect.h ?? 50),
        });
    }
    return el;
}

function inView(el, viewRect = {top: 0, left: 0}) {
    const view = document.createElement('feezal-view');
    view.getBoundingClientRect = () => ({
        top: viewRect.top, left: viewRect.left, width: 800, height: 600,
        right: viewRect.left + 800, bottom: viewRect.top + 600,
    });
    view.append(el);
    return el;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('absolute → flow: the offsets are parked, not destroyed', () => {
    it('stashes inline top/left onto data-abs-*', () => {
        const el = makeEl({top: '120px', left: '240px'});
        stashAbsoluteGeometry(el);
        expect(el.getAttribute('data-abs-top')).toBe('120px');
        expect(el.getAttribute('data-abs-left')).toBe('240px');
    });

    it('stashes nothing for an element born in flow', () => {
        const el = makeEl();
        stashAbsoluteGeometry(el);
        expect(el.hasAttribute('data-abs-top')).toBe(false);
        expect(el.hasAttribute('data-abs-left')).toBe(false);
    });

    it('does not overwrite an existing stash with empty offsets', () => {
        // This is the reload path: a flow view's elements have a stash and no
        // inline offsets, and re-running initFlow must not wipe it.
        const el = makeEl({absTop: '120px', absLeft: '240px'});
        stashAbsoluteGeometry(el);
        expect(el.getAttribute('data-abs-top')).toBe('120px');
        expect(el.getAttribute('data-abs-left')).toBe('240px');
    });

    it('keeps a partial offset (only one axis set)', () => {
        const el = makeEl({top: '10px'});
        stashAbsoluteGeometry(el);
        expect(el.getAttribute('data-abs-top')).toBe('10px');
        expect(el.hasAttribute('data-abs-left')).toBe(false);
    });
});

describe('flow → absolute: the offsets come back', () => {
    it('restores from the stash and clears it', () => {
        const el = inView(makeEl({absTop: '120px', absLeft: '240px'}));
        restoreAbsoluteGeometry(el);
        expect(el.style.top).toBe('120px');
        expect(el.style.left).toBe('240px');
        expect(el.hasAttribute('data-abs-top')).toBe(false);
        expect(el.hasAttribute('data-abs-left')).toBe(false);
    });

    it('leaves an element that already has inline offsets alone', () => {
        const el = inView(makeEl({top: '5px', left: '6px', absTop: '99px', absLeft: '99px'}));
        restoreAbsoluteGeometry(el);
        expect(el.style.top).toBe('5px');
        expect(el.style.left).toBe('6px');
    });

    it('falls back to where the element is RENDERED when there is no stash', () => {
        // Born in flow, or legacy HTML from before the stash existed. Without
        // this the whole view collapses into the top-left corner.
        const el = inView(makeEl({rect: {top: 330, left: 210}}), {top: 30, left: 10});
        restoreAbsoluteGeometry(el);
        expect(el.style.top).toBe('300px');    // 330 − 30
        expect(el.style.left).toBe('200px');   // 210 − 10
    });

    it('does not invent a position for an element that is not laid out', () => {
        const el = inView(makeEl({rect: {top: 0, left: 0, w: 0, h: 0}}));
        restoreAbsoluteGeometry(el);
        expect(el.style.top).toBe('');
        expect(el.style.left).toBe('');
    });
});

describe('the full round trip is lossless', () => {
    it('absolute → flow → absolute returns the original position', () => {
        const el = inView(makeEl({top: '120px', left: '240px', rect: {top: 999, left: 999}}));

        stashAbsoluteGeometry(el);                 // switch to flow…
        el.style.removeProperty('top');
        el.style.removeProperty('left');
        expect(el.style.top).toBe('');             // flow lays it out itself

        restoreAbsoluteGeometry(el);               // …and back
        expect(el.style.top).toBe('120px');
        expect(el.style.left).toBe('240px');       // not the rendered fallback
    });

    it('survives a save/deploy in between — the stash is a plain attribute', () => {
        const el = inView(makeEl({top: '15px', left: '25px'}));
        stashAbsoluteGeometry(el);
        el.style.removeProperty('top');
        el.style.removeProperty('left');

        // Serialize and re-parse, the way views.html round-trips.
        const host = document.createElement('div');
        host.innerHTML = el.outerHTML;
        const revived = inView(host.firstElementChild);
        expect(revived.getAttribute('data-abs-top')).toBe('15px');

        restoreAbsoluteGeometry(revived);
        expect(revived.style.top).toBe('15px');
        expect(revived.style.left).toBe('25px');
    });
});

describe('the stash never reaches a viewer', () => {
    // Mirrors the regex used by the viewer route and the static export.
    const strip = html => String(html || '').replace(/\s+data-abs-(?:top|left)="[^"]*"/g, '');

    it('removes both attributes wherever they appear', () => {
        const html = '<feezal-element-basic-number data-abs-top="10px" data-abs-left="20px" ' +
            'style="width:100px"></feezal-element-basic-number>';
        const out = strip(html);
        expect(out).not.toContain('data-abs-');
        expect(out).toContain('style="width:100px"');
    });

    it('leaves every other data attribute alone', () => {
        const html = '<div data-group="g1" data-abs-top="10px" data-absolute="keep"></div>';
        const out = strip(html);
        expect(out).toContain('data-group="g1"');
        expect(out).toContain('data-absolute="keep"');   // not a prefix match
        expect(out).not.toContain('data-abs-top');
    });

    it('is a no-op on markup that has no stash', () => {
        const html = '<div style="top:1px"></div>';
        expect(strip(html)).toBe(html);
    });
});
