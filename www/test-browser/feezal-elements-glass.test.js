/**
 * E58 glass family behaviour tests — colour/CT on the light, the new switch,
 * and the live-canvas rewire (topics set via the inspector after mount must
 * start flowing without a remount — the reported editor-state bug).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-glass-light';
import '@feezal/feezal-element-glass-switch';
import '@feezal/feezal-element-glass-contact';
import '@feezal/feezal-element-glass-value';
import '@feezal/feezal-element-glass-button';
import '@feezal/feezal-element-glass-cover';
import '@feezal/feezal-element-glass-climate';
import '@feezal/feezal-element-glass-motion';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('glass-light colour/CT', () => {
    it('json mode: state object drives brightness, kelvin CT and hs colour', async () => {
        const el = await mount('feezal-element-glass-light', {
            'payload-mode': 'json', subscribe: 'z2m/lamp', publish: 'z2m/lamp/set',
            'brightness-max': '254', mode: 'brightness_ct',
            'color-temp-unit': 'mired', 'color-temp-min': '2203', 'color-temp-max': '6536',
        });
        feezal.connection.deliver('z2m/lamp', {
            state: 'ON', brightness: 127, color_temp: 271,
            color: {h: 38, hue: 38, s: 58, saturation: 58, x: 0.3951, y: 0.3854},
        });
        await el.updateComplete;
        expect(el.light.on).toBe(true);
        expect(el.light.brt).toBe(50);
        expect(el.light.colorTemp).toBe(3690);   // 271 mired → 3690 K
        expect(el.light.hs).toEqual([38, 58]);

        // Details popup: brightness pill + CT slider present (json = dimmable,
        // mode declares ct); CT release publishes a merged JSON object in mireds.
        el._details = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.details .vslider')).not.toBeNull();
        const ct = el.shadowRoot.querySelector('.details input.ct');
        expect(ct).not.toBeNull();
        ct.value = '4000';
        ct.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/lamp/set', payload: '{"color_temp":250}'});
    });

    it('separate mode: sections follow the topics; the wheel publishes [r,g,b] on release', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-color-temp': 'stat/ct', 'publish-color-temp': 'cmnd/ct',
            'color-temp-unit': 'kelvin',
        });
        feezal.connection.deliver('stat/ct', '4000');
        await el.updateComplete;
        expect(el.light.colorTemp).toBe(4000);
        // no brightness topics → no brightness pill, but the CT slider exists
        el._details = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.details .vslider')).toBeNull();
        expect(el.shadowRoot.querySelector('.details input.ct')).not.toBeNull();

        const rgbLight = await mount('feezal-element-glass-light', {
            mode: 'rgb', 'publish-rgb': 'cmnd/rgb',
        });
        rgbLight._details = true;
        await rgbLight.updateComplete;
        const wheel = rgbLight.shadowRoot.querySelector('.details .wheel');
        expect(wheel).not.toBeNull();
        // Pointer at the right edge centre = hue 90° (green side), full sat.
        wheel.getBoundingClientRect = () => ({left: 0, top: 0, width: 130, height: 130});
        wheel.setPointerCapture = () => {};
        wheel.dispatchEvent(new PointerEvent('pointerdown', {clientX: 130, clientY: 65}));
        wheel.dispatchEvent(new PointerEvent('pointerup', {clientX: 130, clientY: 65}));
        const published = feezal.connection.published.find(p => p.topic === 'cmnd/rgb');
        expect(published).toBeDefined();
        const [r, g, b] = JSON.parse(published.payload);
        expect(g).toBe(255);   // hue 90° = green-yellow region, green dominant
        expect(b).toBe(0);
    });

    it('brightness pill drags to a % and publishes on release', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-brightness': 'stat/bri', 'publish-brightness': 'cmnd/bri',
            'brightness-min': '0', 'brightness-max': '100',
        });
        el._details = true;
        await el.updateComplete;
        const pill = el.shadowRoot.querySelector('.details .vslider');
        expect(pill).not.toBeNull();
        pill.getBoundingClientRect = () => ({top: 0, height: 170, left: 0, width: 72});
        pill.setPointerCapture = () => {};
        // Pointer at 25 % from the top = 75 % brightness.
        pill.dispatchEvent(new PointerEvent('pointerdown', {clientY: 42.5}));
        pill.dispatchEvent(new PointerEvent('pointerup', {clientY: 42.5}));
        expect(el.light.brt).toBe(75);
        // E137: the controller publishes the raw value as a string.
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/bri', payload: '75'});
    });
});

describe('glass-switch', () => {
    it('follows the state topic, toggles on tap, per-state icons', async () => {
        const el = await mount('feezal-element-glass-switch', {
            subscribe: 'stat/plug', publish: 'cmnd/plug',
            icon: 'power_settings_new', 'icon-on': 'power',
        });
        feezal.connection.deliver('stat/plug', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('on')).toBe(true);
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('power');

        el.shadowRoot.querySelector('.card').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/plug', payload: 'OFF'});
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('power_settings_new');
    });

    it('never publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-switch', {publish: 'cmnd/x'});
        el.shadowRoot.querySelector('.card').click();
        expect(feezal.connection.published).toHaveLength(0);
    });

    it('text-on/text-off are configurable', async () => {
        const el = await mount('feezal-element-glass-switch', {
            subscribe: 'stat/p', 'text-on': 'Läuft', 'text-off': 'Aus',
        });
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Aus');
        feezal.connection.deliver('stat/p', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Läuft');
    });
});

describe('glass-light state labels (E99)', () => {
    it('label-on/label-off are configurable, brightness suffix keeps appending', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-state': 'stat/l', 'payload-mode': 'separate',
            'label-on': 'Ein', 'label-off': 'Aus',
        });
        feezal.connection.deliver('stat/l', 'OFF');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('Aus');

        feezal.connection.deliver('stat/l', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('Ein');
    });

    it('defaults stay On/Off', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-state': 'stat/l2', 'payload-mode': 'separate',
        });
        feezal.connection.deliver('stat/l2', 'OFF');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent.trim()).toBe('Off');
    });
});

describe('glass-contact texts', () => {
    it('text-open/text-closed/text-tilted are configurable', async () => {
        const el = await mount('feezal-element-glass-contact', {
            subscribe: 'stat/win', 'payload-tilted': '2',
            'text-open': 'Offen', 'text-closed': 'Zu', 'text-tilted': 'Gekippt',
        });
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Zu');
        feezal.connection.deliver('stat/win', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Offen');
        feezal.connection.deliver('stat/win', '2');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Gekippt');
    });
});

describe('glass-motion', () => {
    it('material-motion contract: plain, JSON {state} and boolean payloads; type icon; texts', async () => {
        const el = await mount('feezal-element-glass-motion', {
            subscribe: 'stat/pir', type: 'radar',
            'text-active': 'Bewegung', 'text-clear': 'Ruhe',
        });
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('radar');
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Ruhe');

        feezal.connection.deliver('stat/pir', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Bewegung');

        feezal.connection.deliver('stat/pir', {state: 'OFF'});   // z2m JSON shape
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(false);
        feezal.connection.deliver('stat/pir', true);             // boolean coercion
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
    });

    it('availability badge + live-canvas rewire', async () => {
        const el = await mount('feezal-element-glass-motion', {});
        el.setAttribute('subscribe', 'stat/late');
        el.setAttribute('subscribe-availability', 'tele/LWT');
        await el.updateComplete;
        feezal.connection.deliver('stat/late', 'ON');
        feezal.connection.deliver('tele/LWT', 'offline');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
        expect(el.shadowRoot.querySelector('.unavail')).not.toBeNull();
    });
});

describe('glass popup anchoring', () => {
    it('opens above the card, clamped to the viewport near borders', async () => {
        // Card in the middle-bottom area → popup fits above.
        const el = await mount('feezal-element-glass-light', {
            'subscribe-brightness': 'stat/b', 'publish-brightness': 'cmnd/b',
        });
        el.style.cssText = 'display:block;position:fixed;left:300px;top:400px;width:150px;height:110px;';
        el.openDetails?.() ?? (el._details = true);
        el._details = true;
        await el.updateComplete;
        el._positionDetails();
        const popup = el.shadowRoot.querySelector('.details');
        const top = parseFloat(popup.style.top);
        const left = parseFloat(popup.style.left);
        expect(top).toBeLessThan(400);                       // above the card
        expect(top).toBeGreaterThanOrEqual(8);
        expect(left).toBeGreaterThanOrEqual(8);
        expect(left + popup.offsetWidth).toBeLessThanOrEqual(window.innerWidth - 8 + 1);
        el._closeDetails?.();

        // Card at the very top-left → no room above → popup goes below, x clamped.
        const corner = await mount('feezal-element-glass-light', {
            'subscribe-brightness': 'stat/b2', 'publish-brightness': 'cmnd/b2',
        });
        corner.style.cssText = 'display:block;position:fixed;left:0;top:0;width:150px;height:110px;';
        corner._details = true;
        await corner.updateComplete;
        corner._positionDetails();
        const popup2 = corner.shadowRoot.querySelector('.details');
        expect(parseFloat(popup2.style.top)).toBeGreaterThanOrEqual(110);   // below the card
        expect(parseFloat(popup2.style.left)).toBeGreaterThanOrEqual(8);    // clamped off the edge
    });
});

describe('glass-button (renamed from glass-scene)', () => {
    it('is registered under the new tag, publishes on tap, highlights when active', async () => {
        expect(customElements.get('feezal-element-glass-button')).toBeDefined();
        expect(customElements.get('feezal-element-glass-scene')).toBeUndefined();
        const el = await mount('feezal-element-glass-button', {
            publish: 'cmnd/scene', payload: 'movie', subscribe: 'stat/scene', 'payload-active': 'movie',
        });
        el.shadowRoot.querySelector('.card').click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/scene', payload: 'movie'});
        feezal.connection.deliver('stat/scene', 'movie');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('active')).toBe(true);
    });
});

describe('glass-cover details popup', () => {
    it('plain card (no shade/buttons); tap opens the popup with pill + up/stop/down', async () => {
        const el = await mount('feezal-element-glass-cover', {
            subscribe: 'z2m/cover', publish: 'z2m/cover/set',
        });
        feezal.connection.deliver('z2m/cover', {position: 40});
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.shade')).toBeNull();
        expect(el.shadowRoot.querySelector('.card .buttons')).toBeNull();
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('Open • 40 %');

        el.shadowRoot.querySelector('.card').click();
        await el.updateComplete;
        const popup = el.shadowRoot.querySelector('.details');
        expect(popup).not.toBeNull();
        expect(popup.querySelector('.vslider .fill').style.height).toBe('40%');

        // Up button publishes the merged JSON command.
        popup.querySelector('.buttons button').click();
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/cover/set', payload: '{"state":"OPEN"}'});

        // Pill release publishes the position (75 % from the top quarter).
        const pill = popup.querySelector('.vslider');
        pill.getBoundingClientRect = () => ({top: 0, height: 170, left: 0, width: 72});
        pill.setPointerCapture = () => {};
        pill.dispatchEvent(new PointerEvent('pointerdown', {clientY: 42.5}));
        pill.dispatchEvent(new PointerEvent('pointerup', {clientY: 42.5}));
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/cover/set', payload: '{"position":75}'});
    });
});

describe('glass-climate', () => {
    it('json mode (z2m TRV): actual/setpoint/mode in; pill + mode buttons publish', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'payload-mode': 'json', subscribe: 'z2m/trv', publish: 'z2m/trv/set',
            min: '5', max: '30', step: '0.5', modes: '["off","heat","auto"]',
        });
        feezal.connection.deliver('z2m/trv', {
            local_temperature: 21.5, current_heating_setpoint: 22, system_mode: 'heat',
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.actual').textContent).toBe('21.5°C');
        expect(el.shadowRoot.querySelector('.state').textContent).toContain('22°C');
        // E137: string mode entries render capitalized labels in every family
        // (the controller unifies on material-climate's coercion).
        expect(el.shadowRoot.querySelector('.state').textContent).toContain('Heat');

        el.shadowRoot.querySelector('.card').click();
        await el.updateComplete;
        const popup = el.shadowRoot.querySelector('.details');
        expect(popup).not.toBeNull();
        // fill = (22-5)/25 = 68%
        expect(popup.querySelector('.vslider .fill').style.height).toBe('68%');

        // Pill drag: top quarter → 75 % of range → 5 + 18.75 = 23.75 → snapped 24.
        const pill = popup.querySelector('.vslider');
        pill.getBoundingClientRect = () => ({top: 0, height: 170, left: 0, width: 72});
        pill.setPointerCapture = () => {};
        pill.dispatchEvent(new PointerEvent('pointerdown', {clientY: 42.5}));
        pill.dispatchEvent(new PointerEvent('pointerup', {clientY: 42.5}));
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/trv/set', payload: '{"current_heating_setpoint":24}'});

        // Mode buttons: off/heat/auto; clicking "off" publishes system_mode.
        const buttons = popup.querySelectorAll('.modes button');
        expect(buttons).toHaveLength(3);
        buttons[0].click();
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/trv/set', payload: '{"system_mode":"off"}'});
        expect(buttons[0].classList.contains('active')).toBe(false);   // re-renders after click
        await el.updateComplete;
        expect(popup.querySelectorAll('.modes button')[0].classList.contains('active')).toBe(true);
    });

    it('separate mode: setpoint/actual/mode topics; pill publishes to publish-setpoint', async () => {
        const el = await mount('feezal-element-glass-climate', {
            'subscribe-setpoint': 'stat/sp', 'publish-setpoint': 'cmnd/sp',
            'subscribe-actual': 'stat/temp', 'subscribe-mode': 'stat/mode', 'publish-mode': 'cmnd/mode',
            min: '5', max: '30', step: '0.5', modes: '["off","heat"]',
        });
        feezal.connection.deliver('stat/sp', '19');
        feezal.connection.deliver('stat/temp', '20.3');
        feezal.connection.deliver('stat/mode', 'off');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.actual').textContent).toBe('20.3°C');

        el.openDetails();
        await el.updateComplete;
        const pill = el.shadowRoot.querySelector('.details .vslider');
        pill.getBoundingClientRect = () => ({top: 0, height: 170, left: 0, width: 72});
        pill.setPointerCapture = () => {};
        pill.dispatchEvent(new PointerEvent('pointerdown', {clientY: 85}));   // middle → 17.5
        pill.dispatchEvent(new PointerEvent('pointerup', {clientY: 85}));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/sp', payload: '17.5'});

        el.shadowRoot.querySelectorAll('.details .modes button')[1].click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/mode', payload: 'heat'});
    });

    it('is inert in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-climate', {publish: 'z2m/x/set', 'payload-mode': 'json'});
        el.shadowRoot.querySelector('.card').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.details')).toBeNull();
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('glass live-canvas rewire (editor-state bug)', () => {
    it('glass-light: topics set after mount start flowing without a remount', async () => {
        const el = await mount('feezal-element-glass-light', {});
        expect(feezal.connection.subCount()).toBe(0);
        el.setAttribute('subscribe-state', 'stat/late');
        await el.updateComplete;
        feezal.connection.deliver('stat/late', 'on');
        await el.updateComplete;
        expect(el.light.on).toBe(true);
    });

    it('glass-contact: topic set after mount starts flowing; old topic dies on change', async () => {
        const el = await mount('feezal-element-glass-contact', {});
        el.setAttribute('subscribe', 'stat/door');
        await el.updateComplete;
        feezal.connection.deliver('stat/door', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('open')).toBe(true);

        el.setAttribute('subscribe', 'stat/other');
        await el.updateComplete;
        feezal.connection.deliver('stat/door', 'OFF');   // old topic must be dead
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('open')).toBe(true);
        feezal.connection.deliver('stat/other', 'OFF');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.card').classList.contains('open')).toBe(false);
    });

    it('glass-value: topic set after mount starts flowing', async () => {
        const el = await mount('feezal-element-glass-value', {});
        el.setAttribute('subscribe', 'stat/temp');
        await el.updateComplete;
        feezal.connection.deliver('stat/temp', '21.5');
        await el.updateComplete;
        expect(el._value).toBe('21.5');
    });
});
