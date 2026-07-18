/**
 * E103 WLED element family tests.
 *
 * The three WLED elements (material / glass / metro) share one MQTT
 * contract: subscribe <topic>/g (brightness 0–255, 0 = off) and <topic>/c
 * ("#RRGGBB"); commands go to <topic>/api as /json/state JSON; availability
 * auto-derives <topic>/status unless the user overrides it.
 *
 * Coverage: material in depth, glass + metro as mount smoke (the command /
 * wiring code is deliberately identical across the three).
 *
 * NOTE: relative imports — the packages are not yet registered in
 * www/package.json, so there are no node_modules symlinks for them.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-material-wled/feezal-element-material-wled.js';
import '../packages/@feezal/feezal-element-glass-wled/feezal-element-glass-wled.js';
import '../packages/@feezal/feezal-element-metro-wled/feezal-element-metro-wled.js';
import {WLED_EFFECTS, WLED_PALETTES, effectName, paletteName}
    from '../packages/@feezal/feezal-element-material-wled/wled-lists.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('wled-lists', () => {
    it('ships the canonical names; ids beyond the lists fall back to numeric', () => {
        expect(WLED_EFFECTS[0]).toBe('Solid');
        expect(WLED_EFFECTS[9]).toBe('Rainbow');
        expect(WLED_PALETTES[0]).toBe('Default');
        expect(WLED_PALETTES[6]).toBe('Party');
        expect(effectName(2)).toBe('Breathe');
        expect(effectName(999)).toBe('999');
        expect(paletteName(11)).toBe('Rainbow');
        expect(paletteName(999)).toBe('999');
    });
});

describe('material-wled state binding', () => {
    it('binds /g (brightness, 0 = off) and /c (colour)', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        feezal.connection.deliver('wled/device/g', '128');
        await el.updateComplete;
        expect(el._on).toBe(true);
        expect(el._bri).toBe(128);
        expect(el.shadowRoot.querySelector('button.power').textContent).toContain('50%');

        feezal.connection.deliver('wled/device/c', '#FF0000');
        await el.updateComplete;
        expect(el._color).toBe('#ff0000');

        feezal.connection.deliver('wled/device/g', '0');
        await el.updateComplete;
        expect(el._on).toBe(false);
        expect(el.shadowRoot.querySelector('button.power').textContent).toContain('off');
    });

    it('rewires live when the topic changes', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/one'});
        el.setAttribute('topic', 'wled/two');
        await until(() => el.subscribeAvailability === 'wled/two/status');
        feezal.connection.deliver('wled/one/g', '255');
        await el.updateComplete;
        expect(el._on).toBe(false);            // old topic no longer wired
        feezal.connection.deliver('wled/two/g', '255');
        await el.updateComplete;
        expect(el._on).toBe(true);
    });
});

describe('material-wled commands → <topic>/api', () => {
    it('toggle publishes {"on":true}', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.shadowRoot.querySelector('button.power').click();
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"on":true}'});
    });

    it('brightness slider publishes {"bri":raw} (50 % → 128)', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const slider = el.shadowRoot.querySelector('input.bri');
        slider.value = '50';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"bri":128}'});
    });

    it('colour input publishes {"seg":[{"col":[[r,g,b]]}]}', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const col = el.shadowRoot.querySelector('input.col');
        col.value = '#ff8800';
        col.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"col":[[255,136,0]]}]}'});
    });

    it('effect and palette selects publish fx / pal ids', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const fx = el.shadowRoot.querySelector('select.fx');
        fx.value = '9';
        fx.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"fx":9}]}'});

        const pal = el.shadowRoot.querySelector('select.pal');
        pal.value = '6';
        pal.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"pal":6}]}'});
    });

    it('transition attribute (seconds) is appended as WLED 0.1 s units', async () => {
        const el = await mount('feezal-element-material-wled',
            {topic: 'wled/device', transition: '0.7'});
        el.shadowRoot.querySelector('button.power').click();
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"on":true,"transition":7}'});
    });

    it('never publishes in the editor', async () => {
        feezal = setupFeezal({isEditor: true});
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.shadowRoot.querySelector('button.power').click();
        el.setBrightnessPct(50);
        el.setEffect(9);
        el.setColor('#ff0000');
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('material-wled availability', () => {
    it('auto-derives <topic>/status and shows the badge on offline', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        expect(el.subscribeAvailability).toBe('wled/device/status');
        feezal.connection.deliver('wled/device/status', 'offline');
        await el.updateComplete;
        expect(el._available).toBe(false);
        expect(el.shadowRoot.querySelector('.feezal-unavail-badge')).not.toBeNull();
        feezal.connection.deliver('wled/device/status', 'online');
        await el.updateComplete;
        expect(el._available).toBe(true);
        expect(el.shadowRoot.querySelector('.feezal-unavail-badge')).toBeNull();
    });

    it('an explicit subscribe-availability wins over the derived topic', async () => {
        const el = await mount('feezal-element-material-wled',
            {topic: 'wled/device', 'subscribe-availability': 'my/avail'});
        expect(el.subscribeAvailability).toBe('my/avail');
        feezal.connection.deliver('wled/device/status', 'offline');
        await el.updateComplete;
        expect(el._available).toBe(true);      // derived topic not subscribed
        feezal.connection.deliver('my/avail', 'offline');
        await el.updateComplete;
        expect(el._available).toBe(false);
    });
});

describe('material-wled effect ids beyond the bundled list', () => {
    it('shows the numeric id in the select', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el._fx = 250;                           // beyond WLED_EFFECTS (newer firmware)
        await el.updateComplete;
        const opt = el.shadowRoot.querySelector(`select.fx option[value="250"]`);
        expect(opt).not.toBeNull();
        expect(opt.textContent.trim()).toBe('250');
        expect(el.shadowRoot.querySelector('select.fx').value).toBe('250');
    });
});

describe('glass-wled smoke', () => {
    it('mounts, binds state, toggles and derives availability', async () => {
        const el = await mount('feezal-element-glass-wled', {topic: 'wled/glass'});
        expect(el.subscribeAvailability).toBe('wled/glass/status');
        feezal.connection.deliver('wled/glass/g', '255');
        feezal.connection.deliver('wled/glass/c', '00ff00');
        await el.updateComplete;
        expect(el._on).toBe(true);
        expect(el._color).toBe('#00ff00');
        expect(el.shadowRoot.querySelector('.state').textContent).toContain('100 %');
        el.toggle();
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/glass/api', payload: '{"on":false}'});
    });
});

describe('metro-wled smoke', () => {
    it('mounts, binds state, toggles and derives availability', async () => {
        const el = await mount('feezal-element-metro-wled', {topic: 'wled/metro', icon: 'wb_iridescent'});
        expect(el.subscribeAvailability).toBe('wled/metro/status');
        feezal.connection.deliver('wled/metro/g', '64');
        await el.updateComplete;
        expect(el._on).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toContain('on 25%');
        el.baseAction();
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/metro/api', payload: '{"on":false}'});
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(false);
    });
});
