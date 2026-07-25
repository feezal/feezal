/**
 * B69 — glass-meter declutter: the card keeps value + unit (+ fault badge); the
 * secondary readouts (rate / status / reading-age / raw) move into a ⋯ details
 * popup (shared FeezalGlassCard / glassPopupStyles, like glass-light/-lock).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-glass-meter/feezal-element-glass-meter.js';
import '../src/feezal-icon.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const deliver = (el, extra = {}) => {
    feezal.connection.deliver('wm/json', {value: '371.77', unit: 'm³', rate: '0.02', raw: '00371.77',
        error: 'no error', timestamp: '2026-07-24T10:00:00Z', ...extra});
    return el.updateComplete;
};

describe('glass-meter — primary on the card, secondary in the popup', () => {
    it('keeps value + unit on the card and offers a ⋯ button', async () => {
        const el = await mount('feezal-element-glass-meter', {'subscribe-json': 'wm/json', unit: 'm³', 'rate-unit': 'm³/min', decimals: '2'});
        await deliver(el);
        const cardText = el.renderRoot.querySelector('.card').textContent;
        expect(cardText).toContain('371.77');
        expect(cardText).toContain('m³');
        expect(el.renderRoot.querySelector('.flip-btn')).toBeTruthy();
        // secondary readouts are NOT on the card
        expect(el.renderRoot.querySelector('.card .readouts')).toBeNull();
        expect(el.renderRoot.querySelector('.details')).toBeNull();   // popup closed
    });

    it('the ⋯ popup lists rate / status / reading-age', async () => {
        const el = await mount('feezal-element-glass-meter', {
            'subscribe-json': 'wm/json', 'subscribe-status': 'wm/status', 'rate-unit': 'm³/min', decimals: '2',
        });
        feezal.connection.deliver('wm/status', 'digitizing');
        await deliver(el);
        el.renderRoot.querySelector('.flip-btn').click();
        await el.updateComplete;
        const popup = el.renderRoot.querySelector('.details');
        expect(popup).toBeTruthy();
        const t = popup.textContent;
        expect(t).toContain('Rate');
        expect(t).toContain('0.02');
        expect(t).toContain('Status');
        expect(t).toContain('digitizing');
        expect(t).toContain('Updated');
    });

    it('a device fault stays visible on the card (not hidden in the popup)', async () => {
        const el = await mount('feezal-element-glass-meter', {'subscribe-json': 'wm/json'});
        await deliver(el, {error: 'E90 no match'});
        expect(el.renderRoot.querySelector('.card .err')).toBeTruthy();
        expect(el.renderRoot.querySelector('.card').textContent).toContain('E90 no match');
    });
});
