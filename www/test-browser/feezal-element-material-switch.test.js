/**
 * Component tests for feezal-element-material-switch — MQTT state binding
 * into a real md-switch and toggle-to-publish with configurable payloads.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-switch';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

async function mdSwitch(el) {
    await el.updateComplete;
    const sw = el.shadowRoot.querySelector('md-switch');
    await sw.updateComplete;
    return sw;
}

describe('state from MQTT', () => {
    it('selects the switch when the payload matches payload-on', async () => {
        const el = await mount('feezal-element-material-switch', {
            'subscribe': 'stat/light', 'payload-on': 'ON', 'payload-off': 'OFF'
        });
        expect((await mdSwitch(el)).selected).toBe(false);

        feezal.connection.deliver('stat/light', 'ON');
        expect((await mdSwitch(el)).selected).toBe(true);

        feezal.connection.deliver('stat/light', 'OFF');
        expect((await mdSwitch(el)).selected).toBe(false);
    });

    it('accepts boolean-ish payloads (true, 1, "1")', async () => {
        const el = await mount('feezal-element-material-switch', {subscribe: 'stat/x'});
        for (const on of [true, 1, '1']) {
            feezal.connection.deliver('stat/x', 'OFF');
            feezal.connection.deliver('stat/x', on);
            expect((await mdSwitch(el)).selected).toBe(true);
        }
    });

    it('navigates JSON payloads via message-property', async () => {
        const el = await mount('feezal-element-material-switch', {
            'subscribe': 'zigbee/lamp',
            'message-property': 'payload.state'
        });
        feezal.connection.deliver('zigbee/lamp', {state: 'ON'});
        expect((await mdSwitch(el)).selected).toBe(true);
    });

    it('renders the label next to the switch', async () => {
        const el = await mount('feezal-element-material-switch', {label: 'Ceiling'});
        expect(el.shadowRoot.querySelector('.label').textContent).toBe('Ceiling');
    });
});

describe('toggle publishes', () => {
    it('publishes payload-on / payload-off on change', async () => {
        const el = await mount('feezal-element-material-switch', {
            'publish': 'cmnd/light',
            'payload-on': 'go-on',
            'payload-off': 'go-off'
        });
        const sw = await mdSwitch(el);

        sw.selected = true;
        sw.dispatchEvent(new Event('change'));
        sw.selected = false;
        sw.dispatchEvent(new Event('change'));

        expect(feezal.connection.published).toEqual([
            {topic: 'cmnd/light', payload: 'go-on'},
            {topic: 'cmnd/light', payload: 'go-off'}
        ]);
    });

    it('does not publish without a publish topic', async () => {
        const el = await mount('feezal-element-material-switch', {});
        const sw = await mdSwitch(el);
        sw.selected = true;
        sw.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toEqual([]);
    });
});
