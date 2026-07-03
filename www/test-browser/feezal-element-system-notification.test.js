/**
 * Component tests for feezal-element-system-notification (E53) — the toast
 * lifecycle (severity, timeout, dedupe, max-visible) plus the two properties
 * that define the element: toasts escape hidden views via the document.body
 * host, and the editor canvas never shows live toasts.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '@feezal/feezal-element-system-notification';
import {setupFeezal, mount} from './helpers.js';

beforeEach(() => {
    setupFeezal();
});

const host = () => document.querySelector('feezal-notification-toasts');
const toasts = () => (host() ? [...host().shadowRoot.querySelectorAll('.toast')] : []);
const texts = () => toasts().map(t => t.querySelector('.text').textContent);

async function deliver(topic, payload) {
    window.feezal.connection.deliver(topic, payload);
    if (host()) {
        await host().updateComplete;
    }
}

describe('toast rendering', () => {
    it('shows a toast for a plain string payload', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert'});
        await deliver('home/alert', 'washing machine done');

        expect(texts()).toEqual(['washing machine done']);
        expect(toasts()[0].classList.contains('info')).toBe(true);
    });

    it('extracts the text via message-property from a JSON payload', async () => {
        await mount('feezal-element-system-notification', {
            subscribe: 'home/alert',
            'message-property': 'payload.text',
        });
        await deliver('home/alert', {text: 'from json', other: 'ignored'});

        expect(texts()).toEqual(['from json']);
    });

    it('ignores messages without a value at message-property', async () => {
        await mount('feezal-element-system-notification', {
            subscribe: 'home/alert',
            'message-property': 'payload.text',
        });
        await deliver('home/alert', {something: 'else'});

        expect(toasts()).toHaveLength(0);
    });

    it('uses the static title, overridden by title-property', async () => {
        await mount('feezal-element-system-notification', {
            subscribe: 'home/alert',
            title: 'Alarm',
            'title-property': 'payload.device',
            'message-property': 'payload.text',
        });

        await deliver('home/alert', {text: 'motion detected', device: 'Hallway'});
        expect(toasts()[0].querySelector('.title').textContent).toBe('Hallway');

        await deliver('home/alert', {text: 'no device field'});
        expect(toasts()[1].querySelector('.title').textContent).toBe('Alarm');
    });

    it('applies per-message severity via severity-property (with warn → warning)', async () => {
        await mount('feezal-element-system-notification', {
            subscribe: 'home/alert',
            'message-property': 'payload.text',
            'severity-property': 'payload.sev',
        });

        await deliver('home/alert', {text: 'boom', sev: 'error'});
        expect(toasts()[0].classList.contains('error')).toBe(true);

        await deliver('home/alert', {text: 'careful', sev: 'warn'});
        expect(toasts()[1].classList.contains('warning')).toBe(true);

        await deliver('home/alert', {text: 'nonsense severity', sev: 'purple'});
        expect(toasts()[2].classList.contains('info')).toBe(true);
    });
});

describe('toast lifecycle', () => {
    it('a sticky toast (timeout 0) stays until its close button is clicked', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0'});
        await deliver('home/alert', 'stay');
        expect(toasts()).toHaveLength(1);

        toasts()[0].querySelector('.close').click();
        await host().updateComplete;
        expect(toasts()).toHaveLength(0);
    });

    it('auto-dismisses after the timeout', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0.05'});
        await deliver('home/alert', 'brief');
        expect(toasts()).toHaveLength(1);

        await vi.waitFor(() => {
            expect(toasts()).toHaveLength(0);
        });
    });

    it('hide-close removes the dismiss button', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0', 'hide-close': ''});
        await deliver('home/alert', 'no button');

        expect(toasts()[0].querySelector('.close')).toBeNull();
    });

    it('max-visible drops the oldest toast', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0', 'max-visible': '2'});
        await deliver('home/alert', 'one');
        await deliver('home/alert', 'two');
        await deliver('home/alert', 'three');

        expect(texts()).toEqual(['two', 'three']);
    });

    it('dedupe suppresses a toast identical to the most recent one', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0', dedupe: ''});
        await deliver('home/alert', 'same');
        await deliver('home/alert', 'same');
        await deliver('home/alert', 'different');

        expect(texts()).toEqual(['same', 'different']);
    });
});

describe('site-level behaviour', () => {
    it('toasts appear even when the element sits in a hidden (display:none) view', async () => {
        const el = await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0'});
        const hiddenView = document.createElement('div');
        hiddenView.style.display = 'none';
        document.body.append(hiddenView);
        hiddenView.append(el);   // re-parents: unsubscribes + resubscribes once
        await el.updateComplete;

        await deliver('home/alert', 'still visible');

        expect(texts()).toEqual(['still visible']);
        expect(toasts()[0].getBoundingClientRect().width).toBeGreaterThan(0);
    });

    it('multiple elements share one body-level host', async () => {
        await mount('feezal-element-system-notification', {subscribe: 'home/a', timeout: '0'});
        await mount('feezal-element-system-notification', {subscribe: 'home/b', timeout: '0'});

        await deliver('home/a', 'from a');
        await deliver('home/b', 'from b');

        expect(document.querySelectorAll('feezal-notification-toasts')).toHaveLength(1);
        expect(texts()).toEqual(['from a', 'from b']);
    });

    it('mirrors the site theme class onto the host', async () => {
        const site = document.createElement('feezal-site');
        site.classList.add('feezal-theme-gruvbox-dark');
        document.body.append(site);

        await mount('feezal-element-system-notification', {subscribe: 'home/alert', timeout: '0'});
        await deliver('home/alert', 'themed');

        expect(host().classList.contains('feezal-theme-gruvbox-dark')).toBe(true);
    });
});

describe('editor behaviour', () => {
    it('renders the chip and suppresses live toasts', async () => {
        window.feezal.isEditor = true;
        const el = await mount('feezal-element-system-notification', {subscribe: 'home/alert'});

        expect(el.shadowRoot.querySelector('.ph')).not.toBeNull();

        await deliver('home/alert', 'should not toast');
        expect(toasts()).toHaveLength(0);
    });
});
