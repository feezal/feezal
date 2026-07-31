/**
 * B91 — every glass card renders its low-battery, availability and warning
 * badges plus the details button into ONE shared upper-right tray, always in
 * the fixed order battery / availability / warnings (fault, then sabotage) /
 * details. Before this they scattered across four corners per card.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-glass-contact';
import '@feezal/feezal-element-glass-climate';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

// Map a tray child element to the indicator it is, by class.
const kindOf = c =>
    c.classList.contains('feezal-batt-badge') ? 'battery'
        : c.classList.contains('glass-unavail') ? 'availability'
            : c.classList.contains('feezal-fault-badge') ? 'fault'
                : c.classList.contains('feezal-sabotage-badge') ? 'sabotage'
                    : c.classList.contains('flip-btn') ? 'details' : '?';

describe('B91 — glass indicator tray', () => {
    it('glass-contact: battery, availability, fault, sabotage all render INTO the tray, in order', async () => {
        const el = await mount('feezal-element-glass-contact', {
            subscribe: 'hm/status/Fenster:1/STATE',
            'subscribe-battery-low': 'hm/batt',
            'subscribe-availability': 'hm/avail',
            'subscribe-error': 'hm/status/x/ERROR', 'error-device-type': 'HM-Sec-Key',
            'subscribe-sabotage': 'hm/status/Fenster:1/ERROR', 'sabotage-encoding': 'error7',
        });
        feezal.connection.deliver('hm/batt', 'true');
        feezal.connection.deliver('hm/avail', 'offline');
        feezal.connection.deliver('hm/status/x/ERROR', 1);              // fault (clutch failure)
        feezal.connection.deliver('hm/status/Fenster:1/ERROR', 7);      // sabotage (ERROR == 7)
        await el.updateComplete;

        const tray = el.renderRoot.querySelector('.glass-badge-tray');
        expect(tray, 'the shared tray exists').toBeTruthy();
        // nothing scattered into its own corner of the card
        expect(el.renderRoot.querySelector('.card > .feezal-batt-badge')).toBeNull();
        expect(el.renderRoot.querySelector('.card > .glass-unavail')).toBeNull();
        expect(el.renderRoot.querySelector('.card > .feezal-fault-badge')).toBeNull();

        const CANON = ['battery', 'availability', 'fault', 'sabotage', 'details'];
        const order = [...tray.children].map(kindOf).filter(k => k !== '?');
        // the active indicators are all in the tray, and appear in the fixed
        // canonical order (no reordering, no scattering).
        expect(order).toEqual(CANON.filter(k => order.includes(k)));
        expect(order).toContain('battery');
        expect(order).toContain('availability');
        expect(order).toContain('fault');
    });

    it('glass-climate (popup card): the details button is LAST in the tray, after the badges', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'separate', 'subscribe-setpoint': 'hm/t:4/SET_TEMPERATURE',
            'subscribe-battery-low': 'hm/batt',
            'subscribe-availability': 'hm/avail',
        });
        feezal.connection.deliver('hm/batt', 'true');
        feezal.connection.deliver('hm/avail', 'offline');
        await el.updateComplete;

        const tray = el.renderRoot.querySelector('.glass-badge-tray');
        const order = [...tray.children].map(kindOf);
        expect(order).toEqual(['battery', 'availability', 'details']);
        expect(order[order.length - 1]).toBe('details');   // details always at the corner
    });
});
