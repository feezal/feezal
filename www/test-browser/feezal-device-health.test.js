/**
 * E135 — device-health board: aggregates Homematic maintenance signals from
 * wildcard subscriptions, sorted by severity (sabotage > fault > battery >
 * unreach), device name from the topic segment.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-basic-device-health/feezal-element-basic-device-health.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal({isEditor: false}); });

const je = val => ({val, ts: 1});
const rows = el => [...el.renderRoot.querySelectorAll('.row')];

describe('E135 — device-health board', () => {
    it('aggregates sabotage / fault / battery / unreach with the device name', async () => {
        const el = await mount('feezal-element-basic-device-health', {prefix: 'hm'});
        feezal.connection.deliver('hm/status/Haustür:0/SABOTAGE', je(true));
        feezal.connection.deliver('hm/status/Heizung Bad:4/FAULT_REPORTING', je(4));
        feezal.connection.deliver('hm/status/Fenster Küche:0/LOWBAT', je(true));
        feezal.connection.deliver('hm/status/Bewegung Flur:0/UNREACH', je(true));
        await el.updateComplete;
        const r = rows(el);
        expect(r.length).toBe(4);
        // severity order: sabotage first, unreach last
        expect(r[0].classList.contains('sabotage')).toBe(true);
        expect(r[0].textContent).toContain('Haustür');
        expect(el.renderRoot.textContent).toContain('Communication error');   // TRV enum decoded
        expect(el.renderRoot.textContent).toContain('Battery low');
        expect(el.renderRoot.textContent).toContain('Unreachable');
    });

    it('classic contact sabotage (ERROR == 7) is alarm-grade', async () => {
        const el = await mount('feezal-element-basic-device-health', {});
        feezal.connection.deliver('hm/status/Tür Garage:1/ERROR', je(7));
        await el.updateComplete;
        expect(rows(el)[0].classList.contains('sabotage')).toBe(true);
        expect(el.renderRoot.textContent).toContain('Sabotage');
    });

    it('clears an issue when the signal returns to OK', async () => {
        const el = await mount('feezal-element-basic-device-health', {});
        feezal.connection.deliver('hm/status/Fenster:0/LOWBAT', je(true));
        await el.updateComplete;
        expect(rows(el).length).toBe(1);
        feezal.connection.deliver('hm/status/Fenster:0/LOWBAT', je(false));
        await el.updateComplete;
        expect(rows(el).length).toBe(0);
        expect(el.renderRoot.textContent).toContain('All devices OK');
    });

    it('decodes an HmIP named fault flag', async () => {
        const el = await mount('feezal-element-basic-device-health', {});
        feezal.connection.deliver('hm/status/Schloss:0/ERROR_JAMMED', je(true));
        await el.updateComplete;
        expect(el.renderRoot.textContent).toContain('Schloss');
        expect(el.renderRoot.textContent).toContain('Jammed');
    });

    it('honours a custom prefix and the show-battery toggle', async () => {
        const el = await mount('feezal-element-basic-device-health', {prefix: 'homematic', 'show-battery': 'false'});
        feezal.connection.deliver('homematic/status/TRV:4/FAULT_REPORTING', je(1));
        feezal.connection.deliver('homematic/status/TRV:0/LOWBAT', je(true));   // suppressed
        await el.updateComplete;
        expect(rows(el).length).toBe(1);
        expect(el.renderRoot.textContent).toContain('Valve tight');
    });
});
