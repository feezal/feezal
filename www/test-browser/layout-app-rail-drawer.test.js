/**
 * Bug: slim-rail persistent drawer — the expanded panel was see-through and the
 * icon jumped sideways on expand.
 *
 *  1. The drawer colour (default --divider-color) is usually SEMI-TRANSPARENT.
 *     As a flex sibling that is fine, but the slim rail expands as an OVERLAY
 *     over the content (U64), so the translucent colour showed the view through
 *     it. The fix composites the drawer colour over an opaque page-background
 *     backing, so every mode is opaque.
 *  2. The rest state centres the icon but the zero-width label's 12px flex gap
 *     was still counted, pulling the icon ~6px off the position the expanded
 *     state gives it — the icon jumped on every expand. The fix zeroes the gap
 *     in the collapsed state (and pins a 24px nav glyph so the centring math is
 *     exact).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {userEvent} from '@vitest/browser/context';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../src/feezal-view.js';
import {setupFeezal} from './helpers.js';

const ITEMS = JSON.stringify([
    {label: 'Overview', icon: 'home', view: 'page1'},
    {label: 'Settings', icon: 'settings', view: 'page3'},
]);

beforeEach(() => setupFeezal());

async function mountSlim() {
    const box = document.createElement('div');
    // a translucent drawer colour, the exact condition that exposed the bug
    box.style.cssText = 'width:1000px;height:600px;position:relative;' +
        '--primary-background-color:#2a2a2a;--feezal-app-drawer-bg:rgba(80,80,80,0.25);';
    document.body.append(box);
    const el = document.createElement('feezal-element-layout-app');
    el.setAttribute('items', ITEMS);
    el.setAttribute('rail', 'slim');
    el.setAttribute('drawer-persistent', 'true');
    el.style.cssText = 'width:100%;height:100%;';
    box.append(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 350));
    return {el, box};
}

describe('slim-rail drawer — opaque background + no icon shift', () => {
    it('composites the drawer background over an opaque backing (never see-through)', async () => {
        const {el, box} = await mountSlim();
        const drawer = el.shadowRoot.querySelector('.drawer');
        // The background is a gradient layer (the drawer colour) over an opaque
        // page-background — not the bare translucent colour it used to be.
        const bg = getComputedStyle(drawer).backgroundImage;
        expect(bg).toContain('linear-gradient');
        box.remove();
    });

    it('keeps the entry icon in the same place when the rail expands', async () => {
        const {el, box} = await mountSlim();
        const iconRect = () => el.shadowRoot.querySelector('.entry feezal-icon').getBoundingClientRect();

        const rest = iconRect();
        await userEvent.hover(el.shadowRoot.querySelector('.drawer'));
        await new Promise(r => setTimeout(r, 350));
        const expanded = iconRect();

        // Horizontal and vertical position must not move on expand (was ~6.5px
        // right before the gap fix). Allow sub-pixel rounding only.
        expect(Math.abs(expanded.left - rest.left)).toBeLessThan(1.5);
        expect(Math.abs(expanded.top - rest.top)).toBeLessThan(1.5);
        box.remove();
    });

    it('renders a 24px nav glyph (the size the rail centring assumes)', async () => {
        const {el, box} = await mountSlim();
        const icon = el.shadowRoot.querySelector('.entry feezal-icon');
        expect(Math.round(icon.getBoundingClientRect().width)).toBe(24);
        box.remove();
    });
});
