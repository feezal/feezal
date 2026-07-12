/**
 * Component tests for feezal-element-carbon-switch — MQTT state binding into
 * a real cds-toggle and toggle-to-publish with configurable payloads.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-carbon-switch';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

async function cdsToggle(el) {
    await el.updateComplete;
    const t = el.shadowRoot.querySelector('cds-toggle');
    await t.updateComplete;
    return t;
}

/** Simulate the user flipping the Carbon toggle. */
function flip(toggle, on) {
    toggle.dispatchEvent(new CustomEvent('cds-toggle-changed', {
        bubbles: true, composed: true, detail: {checked: on, toggled: on}
    }));
}

describe('state from MQTT', () => {
    it('toggles on when the payload matches payload-on', async () => {
        const el = await mount('feezal-element-carbon-switch', {
            'subscribe': 'stat/light', 'payload-on': 'ON', 'payload-off': 'OFF'
        });
        expect((await cdsToggle(el)).toggled).toBe(false);

        feezal.connection.deliver('stat/light', 'ON');
        expect((await cdsToggle(el)).toggled).toBe(true);

        feezal.connection.deliver('stat/light', 'OFF');
        expect((await cdsToggle(el)).toggled).toBe(false);
    });

    it('accepts boolean-ish payloads (true, 1, "1")', async () => {
        const el = await mount('feezal-element-carbon-switch', {subscribe: 'stat/x'});
        for (const on of [true, 1, '1']) {
            feezal.connection.deliver('stat/x', 'OFF');
            feezal.connection.deliver('stat/x', on);
            expect((await cdsToggle(el)).toggled).toBe(true);
        }
    });

    it('navigates JSON payloads via message-property', async () => {
        const el = await mount('feezal-element-carbon-switch', {
            'subscribe': 'zigbee/lamp',
            'message-property': 'payload.state'
        });
        feezal.connection.deliver('zigbee/lamp', {state: 'ON'});
        expect((await cdsToggle(el)).toggled).toBe(true);
    });

    it('passes the label through to the toggle', async () => {
        const el = await mount('feezal-element-carbon-switch', {label: 'Ceiling'});
        expect((await cdsToggle(el)).getAttribute('label-text')).toBe('Ceiling');
    });
});

describe('toggle publishes', () => {
    it('publishes payload-on / payload-off on change', async () => {
        const el = await mount('feezal-element-carbon-switch', {
            'publish': 'cmnd/light',
            'payload-on': 'go-on',
            'payload-off': 'go-off'
        });
        const t = await cdsToggle(el);

        flip(t, true);
        flip(t, false);

        expect(feezal.connection.published).toEqual([
            {topic: 'cmnd/light', payload: 'go-on'},
            {topic: 'cmnd/light', payload: 'go-off'}
        ]);
    });

    it('does not publish without a publish topic', async () => {
        const el = await mount('feezal-element-carbon-switch', {});
        flip(await cdsToggle(el), true);
        expect(feezal.connection.published).toEqual([]);
    });
});
