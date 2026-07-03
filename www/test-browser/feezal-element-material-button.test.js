/**
 * Component tests for feezal-element-material-button — variant rendering into
 * real @material/web components and click-to-publish.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-button';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('rendering', () => {
    it('renders a filled button with the label by default', async () => {
        const el = await mount('feezal-element-material-button', {label: 'Toggle'});
        const btn = el.shadowRoot.querySelector('md-filled-button');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toContain('Toggle');
    });

    it.each([
        ['outlined', 'md-outlined-button'],
        ['text', 'md-text-button'],
        ['elevated', 'md-elevated-button'],
        ['tonal', 'md-filled-tonal-button']
    ])('variant "%s" renders <%s>', async (variant, tag) => {
        const el = await mount('feezal-element-material-button', {label: 'B', variant});
        expect(el.shadowRoot.querySelector(tag)).not.toBeNull();
    });

    it('renders the icon slot only when an icon is set', async () => {
        const plain = await mount('feezal-element-material-button', {label: 'B'});
        expect(plain.shadowRoot.querySelector('[slot="icon"]')).toBeNull();

        const iconed = await mount('feezal-element-material-button', {label: 'B', icon: 'power'});
        const icon = iconed.shadowRoot.querySelector('[slot="icon"]');
        // N23: icons render through <feezal-icon> (set-prefixed names resolve
        // via the registry; bare names stay Material ligatures).
        expect(icon.localName).toBe('feezal-icon');
        expect(icon.getAttribute('name')).toBe('power');
    });
});

describe('publishing', () => {
    it('publishes the payload to the configured topic on click', async () => {
        const el = await mount('feezal-element-material-button', {
            label: 'Go', publish: 'cmnd/light', payload: 'TOGGLE'
        });
        el.shadowRoot.querySelector('md-filled-button').click();
        expect(feezal.connection.published).toEqual([{topic: 'cmnd/light', payload: 'TOGGLE'}]);
    });

    it('does not publish without a topic', async () => {
        const el = await mount('feezal-element-material-button', {label: 'Go'});
        el.shadowRoot.querySelector('md-filled-button').click();
        expect(feezal.connection.published).toEqual([]);
    });
});
