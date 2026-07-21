import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {pctToRaw} from '../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js';

beforeEach(() => {
    feezal.connection = {sub: vi.fn(() => ({})), unsubscribe: vi.fn(), pub: vi.fn()};
});

afterEach(() => {
    document.body.innerHTML = '';
});

// Brightness ring % → raw MQTT value. The rounding granularity must follow the
// configured range: integer ranges keep whole numbers, sub-integer ranges
// (Homematic LEVEL 0–1) must not collapse to {0, 1}.
describe('pctToRaw', () => {
    it('publishes whole numbers for the default 0–100 range', () => {
        expect(pctToRaw(49, 0, 100)).toBe(49);
        expect(pctToRaw(0, 0, 100)).toBe(0);
        expect(pctToRaw(100, 0, 100)).toBe(100);
    });

    it('publishes whole numbers for a zigbee2mqtt 0–254 range', () => {
        expect(pctToRaw(50, 0, 254)).toBe(127);
        expect(pctToRaw(100, 0, 254)).toBe(254);
    });

    it('publishes fractional values for a Homematic 0–1 range', () => {
        expect(pctToRaw(49, 0, 1)).toBe(0.49);
        expect(pctToRaw(50, 0, 1)).toBe(0.5);
        expect(pctToRaw(1, 0, 1)).toBe(0.01);
        expect(pctToRaw(0, 0, 1)).toBe(0);
        expect(pctToRaw(100, 0, 1)).toBe(1);
    });

    it('respects a non-zero minimum', () => {
        expect(pctToRaw(50, 10, 90)).toBe(50);
        expect(pctToRaw(50, 0.2, 1)).toBe(0.6);
    });

    it('produces clean decimals without float noise', () => {
        // 49 % of 0–1 is 0.49000000000000005 without rounding
        expect(String(pctToRaw(49, 0, 1))).toBe('0.49');
        expect(String(pctToRaw(33, 0, 1))).toBe('0.33');
    });

    it('degenerate range (min === max) returns min', () => {
        expect(pctToRaw(50, 5, 5)).toBe(5);
    });
});

describe('subscribe-brightness scaling (regression)', () => {
    it('maps an incoming 0.5 on a 0–1 range to 50 % on the ring', async () => {
        await import('../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js');
        feezal.isEditor = false;

        const callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => {
            callbacks[topic] = cb;
            return {};
        });

        const el = document.createElement('feezal-element-material-light');
        el.setAttribute('subscribe-brightness', 'hm/dimmer/level');
        el.setAttribute('brightness-min', '0');
        el.setAttribute('brightness-max', '1');
        document.body.append(el);
        await el.updateComplete;

        callbacks['hm/dimmer/level']({payload: '0.5'});
        expect(el._brt).toBe(50);
    });
});

// ── E77: on-off-source=brightness (Homematic dimmer mode) ───────────────────

describe('on-off-source=brightness (E77)', () => {
    let callbacks;

    beforeEach(async () => {
        await import('../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js');
        feezal.isEditor = false;
        callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => {
            callbacks[topic] = cb;
            return {};
        });
    });

    async function mountLight(attrs = {}) {
        const el = document.createElement('feezal-element-material-light');
        for (const [k, v] of Object.entries({
            'on-off-source': 'brightness',
            'subscribe-brightness': 'hm/level',
            'publish-brightness': 'hm/level/set',
            'brightness-min': '0',
            'brightness-max': '1',
            ...attrs,
        })) {
            el.setAttribute(k, v);
        }

        document.body.append(el);
        await el.updateComplete;
        return el;
    }

    it('derives on/off from the brightness value and remembers the last non-off %', async () => {
        const el = await mountLight();
        callbacks['hm/level']({payload: '0.5'});
        expect(el._on).toBe(true);
        expect(el._brt).toBe(50);
        callbacks['hm/level']({payload: '0'});
        expect(el._on).toBe(false);
        expect(el._lastBrt).toBe(50);          // remembered for toggle-on restore
    });

    it('a numeric payload-off defines the raw "off" value', async () => {
        const el = await mountLight({'payload-off': '10', 'brightness-min': '10', 'brightness-max': '90'});
        callbacks['hm/level']({payload: '10'});
        expect(el._on).toBe(false);
        callbacks['hm/level']({payload: '50'});
        expect(el._on).toBe(true);
    });

    it('toggle OFF publishes the raw minimum to the brightness topic (default payloads)', async () => {
        const el = await mountLight();
        callbacks['hm/level']({payload: '0.5'});   // on at 50 %
        el._toggle();
        expect(el._on).toBe(false);
        expect(el._brt).toBe(0);
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '0');
    });

    it('toggle ON with non-numeric payload-on restores the remembered brightness via pctToRaw', async () => {
        const el = await mountLight();
        callbacks['hm/level']({payload: '0.49'});  // on at 49 %
        callbacks['hm/level']({payload: '0'});     // off, _lastBrt = 49
        el._toggle();
        expect(el._on).toBe(true);
        expect(el._brt).toBe(49);
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '0.49');
    });

    it('toggle ON without any remembered brightness falls back to 100 %', async () => {
        const el = await mountLight();
        el._toggle();
        expect(el._on).toBe(true);
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '1');
    });

    it('out-of-range numeric payload-on (Homematic OLD_LEVEL 1.005) publishes verbatim without predicting _brt', async () => {
        const el = await mountLight({'payload-on': '1.005'});
        callbacks['hm/level']({payload: '0.3'});
        callbacks['hm/level']({payload: '0'});     // off; _brt = 0
        const brtBefore = el._brt;
        el._toggle();
        expect(el._on).toBe(true);                 // optimistic
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '1.005');
        expect(el._brt).toBe(brtBefore);           // level unknown until the device echoes
        callbacks['hm/level']({payload: '0.3'});   // device echo restores the real level
        expect(el._brt).toBeCloseTo(30, 5);
    });

    it('in-range numeric payload-on predicts the local brightness', async () => {
        const el = await mountLight({'payload-on': '1'});
        el._toggle();
        expect(el._on).toBe(true);
        expect(el._brt).toBe(100);
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '1');
    });

    it('ring drag is allowed while off and the release derives on/off', async () => {
        const el = await mountLight();
        expect(el._dragFromOffAllowed()).toBe(true);
        el._startBrtDrag({clientX: 0, clientY: 0}, 50, 0);   // fake pointer at ring top
        el._dragBrt = 30;                                    // as onMove would set it
        document.dispatchEvent(new Event('pointerup'));
        expect(el._on).toBe(true);
        expect(el._brt).toBe(30);
        expect(el._lastBrt).toBe(30);
        expect(feezal.connection.pub).toHaveBeenCalledWith('hm/level/set', '0.3');

        el._startBrtDrag({clientX: 0, clientY: 0}, 50, 0);
        el._dragBrt = 0;                                     // drag down to zero
        document.dispatchEvent(new Event('pointerup'));
        expect(el._on).toBe(false);
    });

    it('topic mode (default) is untouched: brightness never writes _on, drag stays gated', async () => {
        const el = await mountLight({'on-off-source': 'topic', 'publish-state': 'lamp/set'});
        callbacks['hm/level']({payload: '0.5'});
        expect(el._on).toBe(false);                // only the state topic sets _on
        expect(el._dragFromOffAllowed()).toBe(false);
        el._toggle();
        expect(feezal.connection.pub).toHaveBeenCalledWith('lamp/set', 'on');
    });
});

// ── E77 folded-in fix: subscribe-state / message-property-state ─────────────

describe('subscribe-state runtime support (E77 fix)', () => {
    let callbacks;

    beforeEach(async () => {
        await import('../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js');
        feezal.isEditor = false;
        callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => {
            callbacks[topic] = cb;
            return {};
        });
    });

    it('subscribe-state (written by the inspector) drives on/off', async () => {
        const el = document.createElement('feezal-element-material-light');
        el.setAttribute('subscribe-state', 'lamp/state');
        el.setAttribute('message-property-state', 'payload.value');
        document.body.append(el);
        await el.updateComplete;

        callbacks['lamp/state']({payload: {value: 'on'}});
        expect(el._on).toBe(true);
        callbacks['lamp/state']({payload: {value: 'off'}});
        expect(el._on).toBe(false);
    });

    it('falls back to subscribe for saved views (back-compat)', async () => {
        const el = document.createElement('feezal-element-material-light');
        el.setAttribute('subscribe', 'lamp/state');
        document.body.append(el);
        await el.updateComplete;

        callbacks['lamp/state']({payload: 'on'});
        expect(el._on).toBe(true);
    });
});

// ── E77 (consistency): json mode derives on/off when the state key is absent ─

describe('json mode state fallback (E77)', () => {
    it('derives on/off from brightness when no state key is present', async () => {
        await import('../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js');
        feezal.isEditor = false;
        const callbacks = {};
        feezal.connection.sub = vi.fn((topic, cb) => { callbacks[topic] = cb; return {}; });

        const el = document.createElement('feezal-element-material-light');
        el.setAttribute('payload-mode', 'json');
        el.setAttribute('subscribe', 'lamp');
        el.setAttribute('brightness-max', '254');
        document.body.append(el);
        await el.updateComplete;

        callbacks.lamp({payload: {brightness: 127}});
        expect(el._on).toBe(true);
        callbacks.lamp({payload: {brightness: 0}});
        expect(el._on).toBe(false);
        // A state key still wins when present (zigbee2mqtt: off retains brightness).
        callbacks.lamp({payload: {state: 'OFF', brightness: 180}});
        expect(el._on).toBe(false);
    });
});

// ── E122: on_off mode — pure switch, no brightness ring ─────────────────────

describe('on_off mode (E122)', () => {
    beforeEach(async () => {
        await import('../packages/@feezal/feezal-element-material-light/feezal-element-material-light.js');
        feezal.isEditor = false;
    });

    async function mountOnOff(attrs = {}) {
        const el = document.createElement('feezal-element-material-light');
        for (const [k, v] of Object.entries({
            mode: 'on_off',
            'subscribe-state': 'plug/state',
            'publish-state': 'plug/set',
            'payload-on': 'on',
            'payload-off': 'off',
            ...attrs,
        })) el.setAttribute(k, v);
        document.body.append(el);
        await el.updateComplete;
        return el;
    }

    it('renders no ring track and no drag handle', async () => {
        const el = await mountOnOff();
        el._on = true;
        await el.updateComplete;
        // ring/handle are <path>/<circle r=5>; on_off draws only the disc circles + power glyph
        expect(el.shadowRoot.querySelector('svg path')).toBeNull();
        expect([...el.shadowRoot.querySelectorAll('svg text')].some(t => t.textContent.includes('⏻'))).toBe(true);
    });

    it('a tap anywhere on the disc toggles and publishes', async () => {
        const el = await mountOnOff();
        el._on = false;
        el._toSvgCoords = () => ({sx: 50, sy: 15});   // well outside CENTER_R, inside the big disc
        el._onSvgPointerDown({preventDefault() {}, currentTarget: null});
        expect(el._on).toBe(true);
        expect(feezal.connection.pub).toHaveBeenCalledWith('plug/set', 'on');
    });

    it('never starts a brightness drag', async () => {
        const el = await mountOnOff();
        el._on = true;
        const spy = vi.spyOn(el, '_startBrtDrag');
        el._toSvgCoords = () => ({sx: 50, sy: 10});   // ring zone in other modes
        el._onSvgPointerDown({preventDefault() {}, currentTarget: null});
        expect(spy).not.toHaveBeenCalled();
    });

    it('the mode select offers on_off', () => {
        const cls = customElements.get('feezal-element-material-light');
        const mode = cls.feezal.attributes.find(a => a.name === 'mode');
        expect(mode.options).toContain('on_off');
        expect(mode.default).toBe('brightness');      // back-compat: default unchanged
    });

    it('brightness/CT/colour attributes hide in on_off mode via visibleWhen', () => {
        const cls = customElements.get('feezal-element-material-light');
        for (const name of ['subscribe-brightness', 'publish-brightness', 'subscribe-color-temp', 'subscribe-rgb', 'subscribe-hs', 'subscribe-effect']) {
            const spec = cls.feezal.attributes.find(a => a.name === name);
            expect(spec.visibleWhen, name).toBeTruthy();
            const accepted = Array.isArray(spec.visibleWhen.equals) ? spec.visibleWhen.equals : [spec.visibleWhen.equals];
            expect(accepted, name).not.toContain('on_off');
        }
    });
});
