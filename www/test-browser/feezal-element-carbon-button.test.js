/**
 * Component tests for feezal-element-carbon-button — kind rendering into a
 * real cds-button, click-to-publish, and the E79 active-state feedback.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-carbon-button';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('rendering', () => {
    it('renders a primary cds-button with the label by default', async () => {
        const el = await mount('feezal-element-carbon-button', {label: 'Toggle'});
        const btn = el.shadowRoot.querySelector('cds-button');
        expect(btn).not.toBeNull();
        expect(btn.getAttribute('kind')).toBe('primary');
        expect(btn.textContent).toContain('Toggle');
    });

    it.each(['secondary', 'tertiary', 'ghost', 'danger'])(
        'variant "%s" renders the matching Carbon kind', async variant => {
            const el = await mount('feezal-element-carbon-button', {label: 'B', variant});
            expect(el.shadowRoot.querySelector('cds-button').getAttribute('kind')).toBe(variant);
        });
});

describe('publishing', () => {
    it('publishes the payload to the configured topic on click', async () => {
        const el = await mount('feezal-element-carbon-button', {
            label: 'Go', publish: 'cmnd/light', payload: 'TOGGLE'
        });
        el.shadowRoot.querySelector('cds-button').click();
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/light', payload: 'TOGGLE'}]);
    });

    it('does not publish without a topic or while disabled', async () => {
        const noTopic = await mount('feezal-element-carbon-button', {label: 'Go'});
        noTopic.shadowRoot.querySelector('cds-button').click();

        const disabled = await mount('feezal-element-carbon-button', {
            label: 'Go', publish: 'cmnd/x', disabled: ''
        });
        disabled.shadowRoot.querySelector('cds-button').click();

        expect(feezal.connection.published).toEqual([]);
    });
});

describe('E79 active-state feedback', () => {
    it('reflects [active] from the feedback topic', async () => {
        const el = await mount('feezal-element-carbon-button', {
            'label': 'Lamp', 'publish': 'cmnd/lamp',
            'subscribe': 'stat/lamp', 'payload-active': 'ON', 'payload-inactive': 'OFF'
        });
        expect(el.hasAttribute('active')).toBe(false);

        feezal.connection.deliver('stat/lamp', 'ON');
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(true);

        feezal.connection.deliver('stat/lamp', 'OFF');
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(false);
    });

    it('leaves the state unchanged on unrelated payloads', async () => {
        const el = await mount('feezal-element-carbon-button', {
            'subscribe': 'stat/lamp', 'payload-active': 'ON', 'payload-inactive': 'OFF'
        });
        feezal.connection.deliver('stat/lamp', 'ON');
        await el.updateComplete;
        feezal.connection.deliver('stat/lamp', 'whatever');
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(true);
    });
});
