/**
 * Component tests for feezal-element-system-pin (E44) — keypad flow plus the
 * regression for "sibling with a z-index paints above the lock": the overlay
 * lives in the browser top layer (popover API), so it must cover siblings
 * regardless of their z-index.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '@feezal/feezal-element-system-pin';
import {setupFeezal, mount} from './helpers.js';

beforeEach(() => {
    setupFeezal();
    sessionStorage.clear();
});

async function mountPin(attributes = {}) {
    const el = await mount('feezal-element-system-pin', {pin: '12', ...attributes});
    await new Promise(r => setTimeout(r, 10));   // popover promotion settles
    return el;
}

const overlay = el => el.shadowRoot.querySelector('.overlay');

function press(el, key) {
    [...el.shadowRoot.querySelectorAll('.key')]
        .find(k => k.textContent.trim() === key)
        .click();
}

describe('overlay stacking (the media-element regression)', () => {
    it('covers a sibling even when the sibling has the maximum z-index', async () => {
        const rival = document.createElement('div');
        rival.style.cssText =
            'position:absolute;top:50px;left:50px;width:200px;height:100px;z-index:2147483647;background:red;';
        document.body.append(rival);

        const el = await mountPin();
        expect(overlay(el).matches(':popover-open')).toBe(true);

        const r = rival.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        expect(top).toBe(el);   // the pin host (overlay is in its shadow), not the rival
    });

    it('unlocking removes the overlay and uncovers the sibling', async () => {
        const rival = document.createElement('div');
        rival.style.cssText =
            'position:absolute;top:50px;left:50px;width:200px;height:100px;z-index:2147483647;background:red;';
        document.body.append(rival);

        const el = await mountPin();
        press(el, '1');
        press(el, '2');
        await el.updateComplete;

        expect(overlay(el)).toBeNull();
        const r = rival.getBoundingClientRect();
        expect(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)).toBe(rival);
    });

    it('an inactive (display:none) view suppresses the overlay', async () => {
        const el = await mountPin();
        expect(overlay(el).getBoundingClientRect().width).toBeGreaterThan(0);

        el.parentElement.style.display = 'none';   // stand-in for the hidden view
        await vi.waitFor(() => {
            expect(overlay(el).getBoundingClientRect().width).toBe(0);
        });
    });
});

describe('keypad flow', () => {
    it('renders no overlay without a pin', async () => {
        const el = await mount('feezal-element-system-pin');
        expect(overlay(el)).toBeNull();
    });

    it('a wrong pin shows the error and stays locked', async () => {
        const el = await mountPin();
        press(el, '3');
        press(el, '4');
        await el.updateComplete;

        expect(overlay(el)).not.toBeNull();
        expect(el.shadowRoot.querySelector('.err').textContent).toBe('Wrong PIN');

        // and the correct pin still unlocks afterwards
        press(el, '1');
        press(el, '2');
        await el.updateComplete;
        expect(overlay(el)).toBeNull();
    });

    it('clear resets the entry', async () => {
        const el = await mountPin({pin: '123'});
        press(el, '1');
        press(el, 'clear');
        await el.updateComplete;
        expect(el._entry).toBe('');
    });

    it('remember persists the unlock for the session', async () => {
        const el = await mountPin({pin: '12', remember: ''});
        press(el, '1');
        press(el, '2');
        await el.updateComplete;
        expect(overlay(el)).toBeNull();

        // a fresh instance (reload stand-in) starts unlocked
        const again = await mountPin({pin: '12', remember: ''});
        expect(overlay(again)).toBeNull();
    });

    it('renders only the placeholder in the editor', async () => {
        window.feezal.isEditor = true;
        const el = await mountPin();
        expect(overlay(el)).toBeNull();
        expect(el.shadowRoot.querySelector('.ph')).not.toBeNull();
    });
});
