/**
 * E109 — the evcc loadpoint cards (glass / metro / circle) over the shared
 * EvccLoadpointController: reads the loadpoint scalars into the render, drives
 * a mode-change command, and shows the reduced °C view for a heating loadpoint.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {setupFeezal, mount} from './helpers.js';
import '../packages/@feezal/feezal-element-glass-loadpoint/feezal-element-glass-loadpoint.js';
import '../packages/@feezal/feezal-element-circle-loadpoint/feezal-element-circle-loadpoint.js';
import '../packages/@feezal/feezal-element-metro-loadpoint/feezal-element-metro-loadpoint.js';

const TAGS = ['feezal-element-glass-loadpoint', 'feezal-element-circle-loadpoint', 'feezal-element-metro-loadpoint'];

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const text = el => el.renderRoot.textContent;
const buttonByText = (el, t) => [...el.renderRoot.querySelectorAll('button')].find(b => b.textContent.trim() === t);

describe('E109 — loadpoint cards render + control', () => {
    for (const tag of TAGS) {
        it(`${tag} renders charge power, status and the mode buttons`, async () => {
            const el = await mount(tag, {
                'subscribe-charge-power': 'lp/power', 'subscribe-mode': 'lp/mode',
                'subscribe-charging': 'lp/chg',
            });
            feezal.connection.deliver('lp/power', '3600');
            feezal.connection.deliver('lp/mode', 'pv');
            feezal.connection.deliver('lp/chg', 'true');
            await el.updateComplete;
            const t = text(el);
            expect(t).toContain('3.6 kW');
            expect(t).toContain('Charging');
            // all four mode buttons present
            for (const label of ['Off', 'Solar', 'Min+Solar', 'Fast']) expect(buttonByText(el, label)).toBeTruthy();
        });

        it(`${tag} publishes a mode change on tap`, async () => {
            const el = await mount(tag, {'subscribe-mode': 'lp/mode', 'publish-mode': 'lp/mode/set'});
            feezal.connection.deliver('lp/mode', 'off');
            await el.updateComplete;
            buttonByText(el, 'Fast').click();      // → mode 'now'
            expect(feezal.connection.published).toContainEqual({topic: 'lp/mode/set', payload: 'now'});
        });

        it(`${tag} shows the reduced °C view for a heating loadpoint`, async () => {
            const el = await mount(tag, {heating: 'true', 'subscribe-vehicle-soc': 'lp/temp', 'subscribe-limit-soc': 'lp/target'});
            feezal.connection.deliver('lp/temp', '52');
            feezal.connection.deliver('lp/target', '60');
            await el.updateComplete;
            expect(text(el)).toContain('52 °C');
            expect(text(el)).toContain('60 °C');
        });
    }
});

// E153: the metro tile's four charge-mode buttons moved off the cramped front
// row onto the backside as a touch-friendly 2×2 grid (the metro-lock pattern).
describe('E153 — metro-loadpoint: modes on the backside 2×2 grid', () => {
    const mountTile = () => mount('feezal-element-metro-loadpoint', {
        'subscribe-charge-power': 'lp/power', 'subscribe-vehicle-soc': 'lp/soc',
        'subscribe-limit-soc': 'lp/limit', 'subscribe-mode': 'lp/mode',
        'publish-mode': 'lp/mode/set',
    });

    it('the front carries the readout only — no mode buttons', async () => {
        const el = await mountTile();
        feezal.connection.deliver('lp/power', '3600');
        feezal.connection.deliver('lp/soc', '62');
        feezal.connection.deliver('lp/limit', '80');
        await el.updateComplete;

        const front = el.renderRoot.querySelector('.face.front');
        expect(front.textContent).toContain('3.6 kW');
        expect(front.textContent).toContain('62%');
        expect(front.textContent).toContain('80%');
        expect(front.querySelectorAll('.mbtn')).toHaveLength(0);
    });

    it('the backside holds the four modes in a two-column grid', async () => {
        const el = await mountTile();
        await el.updateComplete;

        const modes = el.renderRoot.querySelector('.face.back .modes');
        expect(modes).toBeTruthy();
        expect(getComputedStyle(modes).gridTemplateColumns.split(' ')).toHaveLength(2);
        const labels = [...modes.querySelectorAll('.mbtn')].map(b => b.textContent.trim());
        expect(labels).toEqual(['Off', 'Solar', 'Min+Solar', 'Fast']);
    });

    it('the backside buttons publish the mode and mark the active one', async () => {
        const el = await mountTile();
        feezal.connection.deliver('lp/mode', 'pv');
        await el.updateComplete;

        const buttons = [...el.renderRoot.querySelectorAll('.face.back .modes .mbtn')];
        expect(buttons.find(b => b.classList.contains('active')).textContent.trim()).toBe('Solar');

        buttons.at(-1).click();          // Fast → mode 'now'
        expect(feezal.connection.published).toContainEqual({topic: 'lp/mode/set', payload: 'now'});
    });

    it('the ⋯ flip affordance reaches the backside', async () => {
        const el = await mountTile();
        await el.updateComplete;
        el.renderRoot.querySelector('.front .flip-btn').click();
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.tile').classList.contains('flipped')).toBe(true);
    });
});
