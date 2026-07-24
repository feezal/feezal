/**
 * E135 — sabotage / fault badges on the device cards. Sabotage is alarm-grade
 * (error colour); a classic contact encodes it as ERROR == 7.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-circle-contact/feezal-element-circle-contact.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

describe('E135 — contact sabotage badge (circle-contact)', () => {
    it('shows the alarm badge on ERROR == 7 (classic encoding), clears on 0', async () => {
        const el = await mount('feezal-element-circle-contact', {
            subscribe: 'hm/status/Fenster:1/STATE',
            'subscribe-sabotage': 'hm/status/Fenster:1/ERROR', 'sabotage-encoding': 'error7',
        });
        expect(el.renderRoot.querySelector('.feezal-sabotage-badge')).toBeNull();
        feezal.connection.deliver('hm/status/Fenster:1/ERROR', 7);
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.feezal-sabotage-badge')).toBeTruthy();   // case opened
        feezal.connection.deliver('hm/status/Fenster:1/ERROR', 0);
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.feezal-sabotage-badge')).toBeNull();
    });

    it('shows a fault badge with decoded text when subscribe-error is wired', async () => {
        const el = await mount('feezal-element-circle-contact', {
            subscribe: 'hm/status/x/STATE',
            'subscribe-error': 'hm/status/x/ERROR', 'error-device-type': 'HM-Sec-Key',
        });
        feezal.connection.deliver('hm/status/x/ERROR', 1);   // Keymatic: clutch failure
        await el.updateComplete;
        const badge = el.renderRoot.querySelector('.feezal-fault-badge');
        expect(badge).toBeTruthy();
        expect(badge.getAttribute('title')).toBe('Clutch failure');
    });
});

describe('E135 — TRV stuck-valve fault badge (circle-climate)', () => {
    it('decodes FAULT_REPORTING via the HM-CC-RT-DN table; setpoint stays operable', async () => {
        const el = await mount('feezal-element-circle-climate', {
            'payload-mode': 'separate', 'subscribe-setpoint': 'hm/status/t:4/SET_TEMPERATURE',
            'subscribe-error': 'hm/status/t:4/FAULT_REPORTING', 'error-device-type': 'HM-CC-RT-DN',
            'message-property-error': 'payload.val',
        });
        expect(el.renderRoot.querySelector('.feezal-fault-badge')).toBeNull();
        feezal.connection.deliver('hm/status/t:4/FAULT_REPORTING', {val: 4});   // communication error
        await el.updateComplete;
        const badge = el.renderRoot.querySelector('.feezal-fault-badge');
        expect(badge).toBeTruthy();
        expect(badge.getAttribute('title')).toBe('Communication error');
        feezal.connection.deliver('hm/status/t:4/FAULT_REPORTING', {val: 0});   // OK
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.feezal-fault-badge')).toBeNull();
    });
});
