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
        expect(el.shadowRoot.querySelector('svg text').textContent).toContain('50%');

        feezal.connection.deliver('wled/device/c', '#FF0000');
        await el.updateComplete;
        expect(el._color).toBe('#ff0000');

        feezal.connection.deliver('wled/device/g', '0');
        await el.updateComplete;
        expect(el._on).toBe(false);
        expect(el.shadowRoot.querySelector('svg text').textContent).toContain('off');
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
    it('toggle (ring centre tap) publishes {"on":true}', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const svgEl = el.shadowRoot.querySelector('svg');
        svgEl.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100});
        svgEl.dispatchEvent(new PointerEvent('pointerdown', {clientX: 50, clientY: 50}));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"on":true}'});
    });

    it('colour input publishes {"seg":[{"col":[[r,g,b]]}]}', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const col = el.shadowRoot.querySelector('input.col');
        col.value = '#ff8800';
        col.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"col":[[255,136,0]]}]}'});
    });

    it('colour input publishes immediately on `input` (debounced ~100 ms)', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const col = el.shadowRoot.querySelector('input.col');
        col.value = '#00ff88';
        col.dispatchEvent(new Event('input'));
        // Not yet — debounced.
        expect(feezal.connection.published).toHaveLength(0);
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"col":[[0,255,136]]}]}'});
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

    it('speed and intensity sliders publish sx/ix scaled 0-100% → 0-255', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const speed = el.shadowRoot.querySelector('input.speed');
        expect(speed.value).toBe('50');   // default 128/255 ≈ 50 % when unset
        speed.value = '50';
        speed.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"sx":128}]}'});

        const intensity = el.shadowRoot.querySelector('input.intensity');
        intensity.value = '100';
        intensity.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"seg":[{"ix":255}]}'});
    });

    it('transition attribute (seconds) is appended as WLED 0.1 s units', async () => {
        const el = await mount('feezal-element-material-wled',
            {topic: 'wled/device', transition: '0.7'});
        const svgEl = el.shadowRoot.querySelector('svg');
        svgEl.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100});
        svgEl.dispatchEvent(new PointerEvent('pointerdown', {clientX: 50, clientY: 50}));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"on":true,"transition":7}'});
    });

    it('never publishes in the editor', async () => {
        feezal = setupFeezal({isEditor: true});
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const svgEl = el.shadowRoot.querySelector('svg');
        svgEl.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100});
        svgEl.dispatchEvent(new PointerEvent('pointerdown', {clientX: 50, clientY: 50}));
        el.setBrightnessPct(50);
        el.setEffect(9);
        el.setColor('#ff0000');
        el.setSpeedPct(50);
        el.setIntensityPct(50);
        el.setPreset(1);
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('material-wled circular brightness ring (B29/B37 parity)', () => {
    it('exposes --feezal-wled-track-width / --feezal-wled-knob-size as style vars, wired into the ring', async () => {
        const styleProps = customElements.get('feezal-element-material-wled').feezal.styles
            .filter(s => typeof s === 'object').map(s => s.property);
        expect(styleProps).toContain('--feezal-wled-track-width');
        expect(styleProps).toContain('--feezal-wled-knob-size');

        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        feezal.connection.deliver('wled/device/g', '128');
        await el.updateComplete;
        const paths = el.shadowRoot.querySelectorAll('svg path');
        expect(paths.length).toBeGreaterThan(0);
        [...paths].forEach(p => expect(p.getAttribute('style')).toContain('--feezal-wled-track-width'));
        const knob = el.shadowRoot.querySelector('svg circle[style*="knob-size"]');
        expect(knob).not.toBeNull();
        expect(knob.getAttribute('style')).toContain('--feezal-wled-knob-size');
    });

    it('dragging the ring publishes {"bri":raw} (drag to ~83 % → 212)', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const svgEl = el.shadowRoot.querySelector('svg');
        svgEl.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 100});
        // Right side of the ring (distance 40 from centre — inside the
        // draggable track, outside the CENTER_R tap-to-toggle zone).
        svgEl.dispatchEvent(new PointerEvent('pointerdown', {clientX: 90, clientY: 50, bubbles: true, composed: true}));
        document.dispatchEvent(new PointerEvent('pointerup', {clientX: 90, clientY: 50, bubbles: true, composed: true}));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"bri":212}'});
    });
});

describe('material-wled show-effect / show-palette', () => {
    it('show-effect=false hides the effect picker AND the speed/intensity sliders', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.showEffect = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.fx')).toBeNull();
        expect(el.shadowRoot.querySelector('input.speed')).toBeNull();
        expect(el.shadowRoot.querySelector('input.intensity')).toBeNull();
        expect(el.shadowRoot.querySelector('select.pal')).not.toBeNull();
    });

    it('show-palette=false hides the palette picker only', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.showPalette = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.pal')).toBeNull();
        expect(el.shadowRoot.querySelector('select.fx')).not.toBeNull();
        expect(el.shadowRoot.querySelector('input.speed')).not.toBeNull();
    });
});

describe('material-wled presets', () => {
    it('numeric fallback publishes {"ps":<n>} when no presets list is configured', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.showPresets = true;
        await el.updateComplete;
        const input = el.shadowRoot.querySelector('input.preset-num');
        expect(input).not.toBeNull();
        input.value = '5';
        input.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"ps":5}'});
    });

    it('preset picker publishes {"ps":<id>} when a presets list is configured', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        el.showPresets = true;
        el.presets = JSON.stringify([{id: 1, name: 'Relax'}, {id: 2, name: 'Party'}]);
        await el.updateComplete;
        const select = el.shadowRoot.querySelector('select.preset');
        expect(select).not.toBeNull();
        select.value = '2';
        select.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/device/api', payload: '{"ps":2}'});
    });

    it('hidden by default (show-presets defaults false)', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        expect(el.shadowRoot.querySelector('select.preset')).toBeNull();
        expect(el.shadowRoot.querySelector('input.preset-num')).toBeNull();
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

    it('details popup: speed/intensity publish sx/ix, show-effect hides them, immediate colour publish, presets', async () => {
        const el = await mount('feezal-element-glass-wled', {topic: 'wled/glass'});
        el.openDetails();
        await el.updateComplete;

        const speed = el.shadowRoot.querySelector('input.speed');
        expect(speed.value).toBe('50');
        speed.value = '50';
        speed.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/glass/api', payload: '{"seg":[{"sx":128}]}'});

        const intensity = el.shadowRoot.querySelector('input.intensity');
        intensity.value = '100';
        intensity.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/glass/api', payload: '{"seg":[{"ix":255}]}'});

        const col = el.shadowRoot.querySelector('input.col');
        col.value = '#112233';
        col.dispatchEvent(new Event('input'));
        expect(feezal.connection.published).not.toContainEqual(
            {topic: 'wled/glass/api', payload: '{"seg":[{"col":[[17,34,51]]}]}'});
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/glass/api', payload: '{"seg":[{"col":[[17,34,51]]}]}'});

        el.showEffect = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.fx')).toBeNull();
        expect(el.shadowRoot.querySelector('input.speed')).toBeNull();
        expect(el.shadowRoot.querySelector('input.intensity')).toBeNull();

        el.showPalette = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.pal')).toBeNull();

        el.showPresets = true;
        await el.updateComplete;
        const presetInput = el.shadowRoot.querySelector('input.preset-num');
        presetInput.value = '3';
        presetInput.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/glass/api', payload: '{"ps":3}'});
    });
});

describe('B38 — WLED select dropdowns pick up theme colours', () => {
    it('material-wled: select declares a colour-scheme and <option> uses the surface/text tokens', async () => {
        const el = await mount('feezal-element-material-wled', {topic: 'wled/device'});
        const select = el.shadowRoot.querySelector('select.fx');
        expect(getComputedStyle(select).colorScheme).not.toBe('normal');
        const option = select.querySelector('option');
        const bg = getComputedStyle(option).backgroundColor;
        expect(bg).not.toBe('');
        expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    });

    it('glass-wled: select declares a dark colour-scheme with a solid dark <option> background', async () => {
        const el = await mount('feezal-element-glass-wled', {topic: 'wled/glass'});
        el.openDetails();
        await el.updateComplete;
        const select = el.shadowRoot.querySelector('select.fx');
        expect(getComputedStyle(select).colorScheme).toBe('dark');
        const option = select.querySelector('option');
        expect(getComputedStyle(option).backgroundColor).toBe('rgb(29, 29, 31)'); // #1d1d1f
    });

    it('metro-wled: select declares a colour-scheme with a solid dark <option> background', async () => {
        const el = await mount('feezal-element-metro-wled', {topic: 'wled/metro'});
        const select = el.shadowRoot.querySelector('select.fx');
        expect(getComputedStyle(select).colorScheme).not.toBe('normal');
        const option = select.querySelector('option');
        expect(getComputedStyle(option).backgroundColor).toBe('rgb(51, 51, 51)'); // #333333
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

    it('back face: speed/intensity publish sx/ix, show-effect hides them, immediate colour publish, presets', async () => {
        const el = await mount('feezal-element-metro-wled', {topic: 'wled/metro'});

        const speed = el.shadowRoot.querySelector('input.speed');
        expect(speed.value).toBe('50');
        speed.value = '50';
        speed.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/metro/api', payload: '{"seg":[{"sx":128}]}'});

        const intensity = el.shadowRoot.querySelector('input.intensity');
        intensity.value = '100';
        intensity.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/metro/api', payload: '{"seg":[{"ix":255}]}'});

        const col = el.shadowRoot.querySelector('input.col');
        col.value = '#112233';
        col.dispatchEvent(new Event('input'));
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/metro/api', payload: '{"seg":[{"col":[[17,34,51]]}]}'});

        el.showEffect = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.fx')).toBeNull();
        expect(el.shadowRoot.querySelector('input.speed')).toBeNull();
        expect(el.shadowRoot.querySelector('input.intensity')).toBeNull();

        el.showPalette = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('select.pal')).toBeNull();

        el.showPresets = true;
        await el.updateComplete;
        const presetInput = el.shadowRoot.querySelector('input.preset-num');
        presetInput.value = '7';
        presetInput.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual(
            {topic: 'wled/metro/api', payload: '{"ps":7}'});
    });
});
