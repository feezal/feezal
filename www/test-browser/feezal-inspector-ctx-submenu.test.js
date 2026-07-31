/**
 * The context-menu "Copy/Move to view" (and "Switch family") submenu holds an
 * unbounded list of views, so it must be placed against the viewport rather
 * than blindly to the item's right / at its top — otherwise it renders
 * off-screen with many views. _positionCtxSub flips it left when it would
 * overflow the right edge, shifts it up when it would overflow the bottom, and
 * caps its height to the viewport with an internal scroll.
 *
 * _positionCtxSub only reads `this.renderRoot`, so it is exercised directly on
 * the prototype with a fake host — mounting the whole inspector would drag in
 * unrelated editor-time deps (feezal.app.shadowRoot, grid, keyboard, …).
 */
import {describe, it, expect, afterEach} from 'vitest';
import '../src/feezal-sidebar-inspector.js';

const positionCtxSub = customElements.get('feezal-sidebar-inspector').prototype._positionCtxSub;

const hosts = [];
afterEach(() => { hosts.forEach(h => h.remove()); hosts.length = 0; });

/** A fake open submenu: a fixed-positioned .ctx-item carrying a tall .ctx-sub,
 *  then run the positioner against a host standing in for `renderRoot`. */
function openFakeSub({left, top, items, width = 260, rowH = 22}) {
    const host = document.createElement('div');
    document.body.append(host);
    hosts.push(host);
    const item = document.createElement('div');
    item.style.cssText = `position:fixed; left:${left}px; top:${top}px; width:30px; height:20px;`;
    const sub = document.createElement('div');
    sub.className = 'ctx-sub';
    sub.style.cssText = `box-sizing:border-box; width:${width}px;`;
    for (let i = 0; i < items; i++) {
        const row = document.createElement('div');
        row.style.height = `${rowH}px`;
        row.textContent = 'view-' + i;
        sub.append(row);
    }
    item.append(sub);
    host.append(item);
    positionCtxSub.call({renderRoot: host});
    return sub;
}

describe('context-menu submenu positioning (Copy/Move to view)', () => {
    it('caps a long list to the viewport height and scrolls', () => {
        const sub = openFakeSub({left: 100, top: 100, items: 300});   // ~6600px of rows
        const maxH = parseFloat(sub.style.maxHeight);
        expect(sub.style.position).toBe('fixed');
        expect(maxH).toBeLessThanOrEqual(window.innerHeight);         // never taller than the viewport
        expect(sub.style.overflowY).toBe('auto');                     // the overflow scrolls
        const top = parseFloat(sub.style.top);
        expect(top).toBeGreaterThanOrEqual(8);
        expect(top + maxH).toBeLessThanOrEqual(window.innerHeight - 8 + 1);   // stays on-screen
    });

    it('flips to the left of the item when it would overflow the right edge', () => {
        const nearRight = window.innerWidth - 20;
        const sub = openFakeSub({left: nearRight, top: 100, items: 5, width: 260});
        const left = parseFloat(sub.style.left);
        expect(left).toBeLessThan(nearRight);                         // opened LEFT, not off the right edge
        expect(left).toBeGreaterThanOrEqual(8);
        expect(left + 260).toBeLessThanOrEqual(window.innerWidth - 8 + 1);
    });

    it('shifts up when the item sits near the bottom edge', () => {
        const nearBottom = window.innerHeight - 30;
        const sub = openFakeSub({left: 100, top: nearBottom, items: 40});   // ~880px, taller than the space below
        const top = parseFloat(sub.style.top);
        const maxH = parseFloat(sub.style.maxHeight);
        expect(top + maxH).toBeLessThanOrEqual(window.innerHeight - 8 + 1); // bottom stays on-screen
        expect(top).toBeGreaterThanOrEqual(8);
    });

    it('keeps the natural size (no scroll) for a short list that fits', () => {
        const sub = openFakeSub({left: 100, top: 100, items: 3});
        expect(sub.style.overflowY).toBe('');                         // no scroll needed
    });
});
