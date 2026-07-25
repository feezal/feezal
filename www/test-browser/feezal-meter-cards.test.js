/**
 * E147 — the meter cards (glass / metro / circle) as views over the shared
 * AiedgeController: an AI-on-the-edge `…/json` message drives value + rate +
 * error + status into the rendered card.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {setupFeezal, mount} from './helpers.js';
import '../packages/@feezal/feezal-element-glass-meter/feezal-element-glass-meter.js';
import '../packages/@feezal/feezal-element-circle-meter/feezal-element-circle-meter.js';
import '../packages/@feezal/feezal-element-metro-meter/feezal-element-metro-meter.js';

const TAGS = ['feezal-element-glass-meter', 'feezal-element-circle-meter', 'feezal-element-metro-meter'];

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const text = el => el.renderRoot.textContent;

describe('E147 — meter cards render the AI-on-the-edge json fields', () => {
    for (const tag of TAGS) {
        it(`${tag} shows value + unit + rate from one json topic`, async () => {
            const el = await mount(tag, {'subscribe-json': 'wm/json', unit: 'm³', 'rate-unit': 'm³/min', decimals: '2'});
            feezal.connection.deliver('wm/json', {
                value: '371.7657', raw: '00371.7657', error: 'no error', rate: '0.0203',
                timestamp: '2026-07-24T10:00:00Z',
            });
            await el.updateComplete;
            // B69: glass-meter keeps value+unit on the card but moves the rate into
            // the ⋯ details popup — open it so the readout is in the DOM.
            if (tag === 'feezal-element-glass-meter') { el._details = true; await el.updateComplete; }
            const t = text(el);
            expect(t).toContain('371.77');        // rounded to decimals
            expect(t).toContain('m³');             // unit
            expect(t).toContain('0.02');           // rate rounded
        });

        it(`${tag} surfaces a device error as a fault badge`, async () => {
            const el = await mount(tag, {'subscribe-json': 'wm/json'});
            feezal.connection.deliver('wm/json', {value: '5', error: 'no error'});
            await el.updateComplete;
            expect(el.renderRoot.querySelector('.err')).toBeNull();
            feezal.connection.deliver('wm/json', {value: '5', error: 'E90 no match'});
            await el.updateComplete;
            expect(el.renderRoot.querySelector('.err')).toBeTruthy();
            expect(text(el)).toContain('E90 no match');
        });

        it(`${tag} shows the action/status line from a separate topic`, async () => {
            const el = await mount(tag, {'subscribe-json': 'wm/json', 'subscribe-status': 'wm/status'});
            feezal.connection.deliver('wm/status', 'digitizing');
            await el.updateComplete;
            if (tag === 'feezal-element-glass-meter') { el._details = true; await el.updateComplete; }   // B69: status is in the popup
            expect(text(el)).toContain('digitizing');
        });
    }
});
