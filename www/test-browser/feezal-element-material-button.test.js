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

    // E117: publish-local — the pub() options carry {local: true} so the
    // connection loops the payload back page-locally instead of sending it
    // to the broker.
    it('publish-local passes {local: true} to pub()', async () => {
        const calls = [];
        feezal.connection.pub = (topic, payload, options) => calls.push({topic, payload, options});
        const el = await mount('feezal-element-material-button', {
            label: 'Go', publish: 'ui/dialog', payload: 'open', 'publish-local': ''
        });
        el.shadowRoot.querySelector('md-filled-button').click();
        expect(calls).toEqual([{topic: 'ui/dialog', payload: 'open', options: {local: true}}]);
    });

    it('without publish-local the options say local: false', async () => {
        const calls = [];
        feezal.connection.pub = (topic, payload, options) => calls.push(options);
        const el = await mount('feezal-element-material-button', {
            label: 'Go', publish: 'cmnd/light', payload: 'TOGGLE'
        });
        el.shadowRoot.querySelector('md-filled-button').click();
        expect(calls).toEqual([{local: false}]);
    });

    it('declares the shared publish-local descriptor', () => {
        const cls = customElements.get('feezal-element-material-button');
        const spec = cls.feezal.attributes.find(a => a?.name === 'publish-local');
        expect(spec).toMatchObject({type: 'boolean', default: false});
    });
});

// E79: state feedback + disabled — same contract as feezal-element-paper-button.
describe('state feedback (E79)', () => {
    it('active/inactive payloads toggle the reflected [active] attribute; others leave it unchanged', async () => {
        const el = await mount('feezal-element-material-button', {
            label: 'Scene', publish: 'cmnd/scene', subscribe: 'stat/scene'
        });
        expect(el.hasAttribute('active')).toBe(false);

        feezal.connection.deliver('stat/scene', '1');       // default payload-active
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(true);

        feezal.connection.deliver('stat/scene', 'whatever');
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(true);       // unchanged on other payloads

        feezal.connection.deliver('stat/scene', '0');       // default payload-inactive
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(false);
    });

    it('honours custom payload-active/-inactive and message-property', async () => {
        const el = await mount('feezal-element-material-button', {
            subscribe: 'stat/json', 'message-property': 'payload.state',
            'payload-active': 'ON', 'payload-inactive': 'OFF'
        });
        feezal.connection.deliver('stat/json', {state: 'ON'});
        await el.updateComplete;
        expect(el.hasAttribute('active')).toBe(true);
    });

    it('disabled renders the md button disabled and blocks publishing', async () => {
        const el = await mount('feezal-element-material-button', {
            label: 'Go', publish: 'cmnd/x', disabled: ''
        });
        const btn = el.shadowRoot.querySelector('md-filled-button');
        expect(btn.disabled).toBe(true);
        el._click();                                        // even a direct call is guarded
        expect(feezal.connection.published).toEqual([]);
    });
});
