/**
 * glass-lock (reworked): the card tap toggles locked ↔ unlocked; the explicit
 * Lock / Unlock / Open actions live in a glass-light-style details popup opened
 * via the ⋯ button (or long-press). No inline action buttons on the card.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-lock/feezal-element-glass-lock.js';
import '../src/feezal-icon.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal({isEditor: false}); });

const tap = el => {
    const card = el.shadowRoot.querySelector('.card');
    card.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    card.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
};

describe('glass-lock — tap toggles, actions live in the popup', () => {
    it('has no inline action buttons on the card; the ⋯ button is present, popup closed', async () => {
        const el = await mount('feezal-element-glass-lock', {subscribe: 'lock/state', publish: 'lock/set'});
        expect(el.shadowRoot.querySelector('.card .lock-actions')).toBeNull();
        expect(el.shadowRoot.querySelector('.flip-btn')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.details')).toBeNull();
    });

    it('tapping the card toggles locked ↔ unlocked', async () => {
        const el = await mount('feezal-element-glass-lock', {subscribe: 'lock/state', publish: 'lock/set'});
        feezal.connection.deliver('lock/state', 'LOCKED');
        await el.updateComplete;
        tap(el);
        expect(feezal.connection.published).toContainEqual({topic: 'lock/set', payload: 'UNLOCK'});
        feezal.connection.deliver('lock/state', 'UNLOCKED');
        await el.updateComplete;
        tap(el);
        expect(feezal.connection.published).toContainEqual({topic: 'lock/set', payload: 'LOCK'});
    });

    it('the popup exposes Lock / Unlock / Open; a button publishes and closes it', async () => {
        const el = await mount('feezal-element-glass-lock', {
            subscribe: 'lock/state', publish: 'lock/set', 'publish-open': 'lock/open',
        });
        el._details = true;
        await el.updateComplete;
        const btns = [...el.shadowRoot.querySelectorAll('.details .lock-actions button')];
        expect(btns.map(b => b.textContent.trim())).toEqual(['Lock', 'Unlock', 'Open']);
        btns[2].click();   // Open
        expect(feezal.connection.published).toContainEqual({topic: 'lock/open', payload: 'OPEN'});
        expect(el._details).toBe(false);
    });

    it('omits the Open action when the lock cannot open', async () => {
        const el = await mount('feezal-element-glass-lock', {subscribe: 'lock/state', publish: 'lock/set'});
        el._details = true;
        await el.updateComplete;
        const labels = [...el.shadowRoot.querySelectorAll('.details .lock-actions button')].map(b => b.textContent.trim());
        expect(labels).toEqual(['Lock', 'Unlock']);
    });

    it('is inert in the editor (tap does not publish, no ⋯ button when no command topic)', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-lock', {subscribe: 'lock/state', publish: 'lock/set'});
        feezal.connection.deliver('lock/state', 'LOCKED');
        await el.updateComplete;
        tap(el);
        expect(feezal.connection.published).toHaveLength(0);
        feezal.isEditor = false;

        const readonly = await mount('feezal-element-glass-lock', {subscribe: 'lock/state'});
        expect(readonly.shadowRoot.querySelector('.flip-btn')).toBeNull();
    });
});
