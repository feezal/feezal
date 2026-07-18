/**
 * E100 glass-fan behaviour tests — material-fan MQTT contract in glass
 * chrome: on/off binding + tap toggle + editor guard, speed-range scaling
 * in/out via the popup pill, preset chips, N31 base-class availability badge.
 */
import {describe, it, expect, beforeEach} from 'vitest';
// Relative import — the package is not yet registered in www/package.json.
import '../packages/@feezal/feezal-element-glass-fan/feezal-element-glass-fan.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('glass-fan on/off', () => {
    it('follows the state topic (plain and z2m JSON {state}), spins while on', async () => {
        const el = await mount('feezal-element-glass-fan', {
            subscribe: 'stat/fan', publish: 'cmnd/fan',
        });
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('Off');

        feezal.connection.deliver('stat/fan', 'ON');
        await el.updateComplete;
        expect(el._on).toBe(true);
        expect(el.shadowRoot.querySelector('.card').classList.contains('on')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('On');

        feezal.connection.deliver('stat/fan', {state: 'OFF'});   // z2m JSON shape
        await el.updateComplete;
        expect(el._on).toBe(false);
        expect(el.shadowRoot.querySelector('.card').classList.contains('on')).toBe(false);
    });

    it('tap toggles and publishes payload-on / payload-off', async () => {
        const el = await mount('feezal-element-glass-fan', {
            subscribe: 'stat/fan', publish: 'cmnd/fan',
        });
        const card = el.shadowRoot.querySelector('.card');
        card.dispatchEvent(new PointerEvent('pointerdown'));
        card.dispatchEvent(new PointerEvent('pointerup'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/fan', payload: 'ON'});
        card.dispatchEvent(new PointerEvent('pointerdown'));
        card.dispatchEvent(new PointerEvent('pointerup'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/fan', payload: 'OFF'});
    });

    it('custom payloads', async () => {
        const el = await mount('feezal-element-glass-fan', {
            publish: 'cmnd/fan', 'payload-on': 'true', 'payload-off': 'false',
        });
        el.toggle();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/fan', payload: 'true'});
    });

    it('never publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-fan', {
            publish: 'cmnd/fan', 'publish-speed': 'cmnd/speed', 'publish-preset': 'cmnd/preset',
        });
        const card = el.shadowRoot.querySelector('.card');
        card.dispatchEvent(new PointerEvent('pointerdown'));
        card.dispatchEvent(new PointerEvent('pointerup'));
        el.toggle();
        el._setSpeed(50);
        el._setPreset('high');
        expect(feezal.connection.published).toHaveLength(0);
        expect(el._details).toBe(false);
    });
});

describe('glass-fan speed scaling', () => {
    it('incoming raw speed is scaled from speed-range-min/max to 0–100 % (state line)', async () => {
        const el = await mount('feezal-element-glass-fan', {
            subscribe: 'stat/fan', 'subscribe-speed': 'stat/speed',
            'speed-range-min': '1', 'speed-range-max': '9',   // IKEA STARKVIND
        });
        feezal.connection.deliver('stat/fan', 'ON');
        feezal.connection.deliver('stat/speed', '5');
        await el.updateComplete;
        expect(el._speed).toBe(50);   // (5-1)/(9-1) = 50 %
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('On • 50 %');

        feezal.connection.deliver('stat/speed', '9');
        await el.updateComplete;
        expect(el._speed).toBe(100);
    });

    it('pill release publishes the percentage de-normalised back into the device range', async () => {
        const el = await mount('feezal-element-glass-fan', {
            'subscribe-speed': 'stat/speed', 'publish-speed': 'cmnd/speed',
            'speed-range-min': '1', 'speed-range-max': '9',
        });
        el._details = true;
        await el.updateComplete;
        const pill = el.shadowRoot.querySelector('.details .vslider');
        expect(pill).not.toBeNull();
        pill.getBoundingClientRect = () => ({top: 0, height: 170, left: 0, width: 72});
        pill.setPointerCapture = () => {};
        // Pointer at 25 % from the top = 75 % speed → raw 1 + 0.75*8 = 7.
        pill.dispatchEvent(new PointerEvent('pointerdown', {clientY: 42.5}));
        pill.dispatchEvent(new PointerEvent('pointerup', {clientY: 42.5}));
        expect(el._speed).toBe(75);
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/speed', payload: '7'});
    });

    it('default range 1–100 publishes the percentage nearly as-is', async () => {
        const el = await mount('feezal-element-glass-fan', {'publish-speed': 'cmnd/speed'});
        el._setSpeed(60);
        // 1 + 0.6*99 = 60.4 → 60
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/speed', payload: '60'});
    });
});

describe('glass-fan presets', () => {
    it('chips render from preset-modes, publish publish-preset, follow subscribe-preset', async () => {
        const el = await mount('feezal-element-glass-fan', {
            'preset-modes': '["low","medium","high"]',
            'subscribe-preset': 'stat/preset', 'publish-preset': 'cmnd/preset',
        });
        // Presets alone are enough for the tune button / popup.
        expect(el.shadowRoot.querySelector('.flip-btn')).not.toBeNull();
        el._details = true;
        await el.updateComplete;
        const chips = el.shadowRoot.querySelectorAll('.details .presets button');
        expect(chips).toHaveLength(3);
        expect(chips[1].textContent.trim()).toBe('medium');

        chips[1].click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/preset', payload: 'medium'});
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('.details .presets button')[1].classList.contains('active')).toBe(true);

        feezal.connection.deliver('stat/preset', 'high');
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('.details .presets button')[2].classList.contains('active')).toBe(true);
    });

    it('no speed topics and no presets → no tune button', async () => {
        const el = await mount('feezal-element-glass-fan', {subscribe: 'stat/fan'});
        expect(el.shadowRoot.querySelector('.flip-btn')).toBeNull();
    });
});

describe('glass-fan availability (N31 base class)', () => {
    it('shared badge appears on offline and clears on online — set after mount (live rewire)', async () => {
        const el = await mount('feezal-element-glass-fan', {});
        expect(el.shadowRoot.querySelector('.feezal-unavail-badge')).toBeNull();

        el.setAttribute('subscribe-availability', 'tele/fan/LWT');
        await el.updateComplete;
        feezal.connection.deliver('tele/fan/LWT', 'offline');
        await el.updateComplete;
        expect(el._available).toBe(false);
        expect(el.shadowRoot.querySelector('.feezal-unavail-badge')).not.toBeNull();

        feezal.connection.deliver('tele/fan/LWT', 'online');
        await el.updateComplete;
        expect(el._available).toBe(true);
        expect(el.shadowRoot.querySelector('.feezal-unavail-badge')).toBeNull();
    });
});

describe('glass-fan live-canvas rewire', () => {
    it('topics set after mount start flowing; old topic dies on change', async () => {
        const el = await mount('feezal-element-glass-fan', {});
        el.setAttribute('subscribe', 'stat/late');
        await el.updateComplete;
        feezal.connection.deliver('stat/late', 'ON');
        await el.updateComplete;
        expect(el._on).toBe(true);

        el.setAttribute('subscribe', 'stat/other');
        await el.updateComplete;
        feezal.connection.deliver('stat/late', 'OFF');   // old topic must be dead
        await el.updateComplete;
        expect(el._on).toBe(true);
        feezal.connection.deliver('stat/other', 'OFF');
        await el.updateComplete;
        expect(el._on).toBe(false);
    });
});
