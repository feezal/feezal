/**
 * U85 — the editor's toast/notification service: variants, the sticky rule
 * (warnings and errors wait for the user), auto-dismiss, the action button
 * and stacking order.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../src/feezal-toast.js';

let el;
beforeEach(async () => {
    document.body.innerHTML = '';
    el = document.createElement('feezal-toast');
    document.body.append(el);
    await el.updateComplete;
});
afterEach(() => vi.useRealTimers());

const toasts = () => [...el.shadowRoot.querySelectorAll('.toast')];

describe('showing and dismissing', () => {
    it('renders the message with its variant class', async () => {
        el.show('Deployed', {variant: 'success'});
        await el.updateComplete;
        expect(toasts()).toHaveLength(1);
        expect(toasts()[0].classList.contains('success')).toBe(true);
        expect(toasts()[0].querySelector('.msg').textContent).toBe('Deployed');
    });

    it('stacks several toasts in insertion order and dismisses by id', async () => {
        const a = el.show('first', {variant: 'info'});
        el.show('second', {variant: 'info'});
        await el.updateComplete;
        expect(toasts().map(t => t.querySelector('.msg').textContent)).toEqual(['first', 'second']);
        el.dismiss(a);
        await el.updateComplete;
        expect(toasts().map(t => t.querySelector('.msg').textContent)).toEqual(['second']);
    });

    it('the close button removes just that toast', async () => {
        el.show('one', {variant: 'info'});
        el.show('two', {variant: 'info'});
        await el.updateComplete;
        toasts()[0].querySelector('.close').click();
        await el.updateComplete;
        expect(toasts().map(t => t.querySelector('.msg').textContent)).toEqual(['two']);
    });
});

describe('auto-dismiss vs sticky', () => {
    it('success/info auto-dismiss; danger and warning stay until dismissed', async () => {
        vi.useFakeTimers();
        el.show('ok', {variant: 'success'});
        el.show('boom', {variant: 'danger'});
        el.show('careful', {variant: 'warning'});
        await el.updateComplete;
        expect(toasts()).toHaveLength(3);

        vi.advanceTimersByTime(10000);
        await el.updateComplete;
        // the transient one is gone, the two that need a decision remain
        expect(toasts().map(t => t.querySelector('.msg').textContent)).toEqual(['boom', 'careful']);
    });

    it('an explicit duration overrides the variant default', async () => {
        vi.useFakeTimers();
        el.show('sticky info', {variant: 'info', duration: 0});
        el.show('brief error', {variant: 'danger', duration: 1000});
        await el.updateComplete;
        vi.advanceTimersByTime(5000);
        await el.updateComplete;
        expect(toasts().map(t => t.querySelector('.msg').textContent)).toEqual(['sticky info']);
    });
});

describe('action button', () => {
    it('runs the callback and closes the toast', async () => {
        const run = vi.fn();
        el.show('Deploy failed: disk on fire', {variant: 'danger', action: {label: 'Retry', run}});
        await el.updateComplete;
        const button = [...toasts()[0].querySelectorAll('button')].find(b => b.textContent.trim() === 'Retry');
        expect(button).toBeTruthy();
        button.click();
        await el.updateComplete;
        expect(run).toHaveBeenCalledOnce();
        expect(toasts()).toHaveLength(0);
    });

    it('an error toast is announced as an alert, others as status', async () => {
        el.show('bad', {variant: 'danger'});
        el.show('fyi', {variant: 'info'});
        await el.updateComplete;
        expect(toasts()[0].getAttribute('role')).toBe('alert');
        expect(toasts()[1].getAttribute('role')).toBe('status');
    });
});
