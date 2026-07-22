import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-glass-button/feezal-element-glass-button.js';
import '../packages/@feezal/feezal-element-glass-sensor/feezal-element-glass-sensor.js';
import {payloadMatch as contactMatch} from '../packages/@feezal/feezal-element-glass-contact/feezal-element-glass-contact.js';
import {pctToRaw} from '../packages/@feezal/feezal-element-glass-light/feezal-element-glass-light.js';
import '../packages/@feezal/feezal-element-glass-cover/feezal-element-glass-cover.js';

let subs;
let published;

beforeEach(() => {
    subs = {};
    published = [];
    feezal.isEditor = false;
    feezal.connection = {
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(),
        pub: vi.fn((topic, payload) => published.push({topic, payload})),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
});

const deliver = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));

async function mount(tag, attrs = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

// ── glass-button ──────────────────────────────────────────────────────────────

describe('glass-button', () => {
    it('publishes the payload on tap, never in the editor', async () => {
        const el = await mount('feezal-element-glass-button', {publish: 'scene/movie', payload: 'go'});
        el.renderRoot.querySelector('.card').click();
        expect(published).toEqual([{topic: 'scene/movie', payload: 'go'}]);

        feezal.isEditor = true;
        el.renderRoot.querySelector('.card').click();
        expect(published).toHaveLength(1);
    });

    it('highlights while the subscribed state equals payload-active', async () => {
        const el = await mount('feezal-element-glass-button', {subscribe: 'scene/state', 'payload-active': 'movie'});
        deliver('scene/state', 'movie');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.card').classList.contains('active')).toBe(true);
        deliver('scene/state', 'off');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.card').classList.contains('active')).toBe(false);
    });
});

// ── glass-sensor ──────────────────────────────────────────────────────────────

describe('glass-sensor', () => {
    it('shows the subscribed value with unit; decimals round numerics', async () => {
        const el = await mount('feezal-element-glass-sensor', {subscribe: 'home/temp', unit: '°C', decimals: '1'});
        deliver('home/temp', '21.456');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.value').textContent).toContain('21.5');
        expect(el.renderRoot.querySelector('.value').textContent).toContain('°C');
    });

    it('honours message-property and non-numeric payloads pass through', async () => {
        const el = await mount('feezal-element-glass-sensor', {subscribe: 'home/env', 'message-property': 'payload.state'});
        deliver('home/env', {state: 'raining'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.value').textContent).toContain('raining');
    });
});

// ── glass-contact ─────────────────────────────────────────────────────────────

describe('glass-contact', () => {
    it('payloadMatch mirrors the material-contact semantics', () => {
        expect(contactMatch('ON', 'ON')).toBe(true);
        expect(contactMatch(1, '1')).toBe(true);
        expect(contactMatch(true, 'ON')).toBe(true);
        expect(contactMatch(false, 'OFF')).toBe(true);
        expect(contactMatch('open', 'ON')).toBe(false);
    });

    it('maps open/closed/tilted like the material sibling', async () => {
        const el = await mount('feezal-element-glass-contact', {subscribe: 'door/state', 'payload-tilted': '2'});
        deliver('door/state', 'ON');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toBe('Open');
        deliver('door/state', '2');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toBe('Tilted');
        deliver('door/state', 'OFF');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toBe('Closed');
    });

    it('availability badge follows the availability topic (JSON payloads too)', async () => {
        const el = await mount('feezal-element-glass-contact', {
            subscribe: 'door/state', 'subscribe-availability': 'door/availability',
        });
        deliver('door/availability', {state: 'offline'});
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.unavail')).not.toBeNull();
        deliver('door/availability', 'online');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.unavail')).toBeNull();
    });
});

// ── glass-light ───────────────────────────────────────────────────────────────

describe('glass-light', () => {
    it('pctToRaw / rawToPct keep material-light range semantics (incl. sub-integer)', async () => {
        expect(pctToRaw(49, 0, 100)).toBe(49);
        expect(pctToRaw(50, 0, 254)).toBe(127);
        expect(pctToRaw(49, 0, 1)).toBe(0.49);
        // E137: raw→% lives on the controller now (reads brightness-min/max).
        const el = await mount('feezal-element-glass-light', {'brightness-min': '0', 'brightness-max': '254'});
        expect(el.light.rawToPct(127)).toBe(50);
        el.setAttribute('brightness-max', '1');
        expect(el.light.rawToPct(0.5)).toBe(50);
    });

    it('separate mode: state + brightness topics drive the tile; toggle publishes payload-on/off', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-state': 'lamp/state', 'publish-state': 'lamp/state/set',
            'subscribe-brightness': 'lamp/bri', 'publish-brightness': 'lamp/bri/set',
            'brightness-max': '254', 'payload-on': 'ON', 'payload-off': 'OFF',
        });
        deliver('lamp/state', 'ON');
        deliver('lamp/bri', 127);
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toBe('On • 50 %');

        el.light.toggle();
        expect(published).toEqual([{topic: 'lamp/state/set', payload: 'OFF'}]);
        el.light.setBrightnessPct(75);
        expect(published.at(-1)).toEqual({topic: 'lamp/bri/set', payload: '191'});
    });

    it('json mode: parses {state, brightness}; toggle/brightness publish partial JSON to …/set', async () => {
        const el = await mount('feezal-element-glass-light', {
            'payload-mode': 'json', subscribe: 'z2m/lamp', publish: 'z2m/lamp/set',
            'brightness-max': '254', 'payload-on': 'ON', 'payload-off': 'OFF',
        });
        deliver('z2m/lamp', {state: 'ON', brightness: 254});
        await el.updateComplete;
        expect(el.light.on).toBe(true);
        expect(el.light.brt).toBe(100);

        el.light.toggle();
        expect(JSON.parse(published.at(-1).payload)).toEqual({state: 'OFF'});
        el.light.setBrightnessPct(50);
        expect(JSON.parse(published.at(-1).payload)).toEqual({brightness: 127});
        expect(published.every(p => p.topic === 'z2m/lamp/set')).toBe(true);
    });

    it('on-off-source=brightness derives on/off and toggles over the brightness topic (E77 semantics)', async () => {
        const el = await mount('feezal-element-glass-light', {
            'on-off-source': 'brightness',
            'subscribe-brightness': 'dimmer/level', 'publish-brightness': 'dimmer/level/set',
            'brightness-min': '0', 'brightness-max': '1',
            'payload-on': '1.005', 'payload-off': '0',
        });
        deliver('dimmer/level', 0.5);
        await el.updateComplete;
        expect(el.light.on).toBe(true);
        expect(el.light.brt).toBe(50);

        deliver('dimmer/level', 0);
        await el.updateComplete;
        expect(el.light.on).toBe(false);

        el.light.toggle();   // on → publishes payload-on (OLD_LEVEL restore)
        expect(published.at(-1)).toEqual({topic: 'dimmer/level/set', payload: '1.005'});
        el.light.toggle();   // off → publishes payload-off
        expect(published.at(-1)).toEqual({topic: 'dimmer/level/set', payload: '0'});
    });

    it('the tune button opens the details popup with the brightness pill; setBrightness publishes scaled raw', async () => {
        const el = await mount('feezal-element-glass-light', {
            'subscribe-brightness': 'lamp/bri', 'publish-brightness': 'lamp/bri/set', 'brightness-max': '254',
        });
        el.renderRoot.querySelector('.flip-btn').click();
        await el.updateComplete;
        // Brightness-only capability → popup shows the vertical pill, no CT/colour controls.
        expect(el.renderRoot.querySelector('.details .vslider')).toBeTruthy();
        expect(el.renderRoot.querySelector('.details .ct')).toBeNull();
        expect(el.renderRoot.querySelector('.details .wheel')).toBeNull();
        el.light.setBrightnessPct(25);   // pill release calls this with the dragged %
        expect(published.at(-1)).toEqual({topic: 'lamp/bri/set', payload: '64'});
    });

    it('never publishes in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-light', {'publish-state': 'lamp/set'});
        el.light.toggle();
        el.light.setBrightnessPct(10);
        expect(published).toEqual([]);
    });
});

// ── glass-cover ─────────────────────────────────────────────────────────────

describe('glass-cover', () => {
    it('json mode: position primary, state string inferred when position missing (material-cover parity)', async () => {
        const el = await mount('feezal-element-glass-cover', {subscribe: 'cover/state', publish: 'cover/set'});
        deliver('cover/state', {state: 'CLOSE'});
        await el.updateComplete;
        expect(el._position).toBe(0);
        deliver('cover/state', {position: 60});
        await el.updateComplete;
        expect(el._position).toBe(60);
        expect(el.renderRoot.querySelector('.state').textContent).toBe('Open • 60 %');
        // details popup: the position pill's fill shows the effective open %
        el.openDetails();
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.details .fill').style.height).toBe('60%');
    });

    it('up/stop/down publish JSON state commands in json mode', async () => {
        const el = await mount('feezal-element-glass-cover', {subscribe: 'cover/state', publish: 'cover/set'});
        el.cmdUp();
        el.cmdStop();
        el.cmdDown();
        expect(published.map(p => JSON.parse(p.payload))).toEqual([
            {state: 'OPEN'}, {state: 'STOP'}, {state: 'CLOSE'},
        ]);
        el.setPosition(30);
        expect(JSON.parse(published.at(-1).payload)).toEqual({position: 30});
    });

    it('separate mode: per-topic wiring with raw payloads', async () => {
        const el = await mount('feezal-element-glass-cover', {
            'payload-mode': 'separate',
            'subscribe-position': 'cover/pos', 'publish-position': 'cover/pos/set',
            'publish-command': 'cover/cmd', 'payload-up': 'UP', 'payload-down': 'DOWN',
        });
        deliver('cover/pos', '25');
        await el.updateComplete;
        expect(el._position).toBe(25);

        el.cmdUp();
        expect(published.at(-1)).toEqual({topic: 'cover/cmd', payload: 'UP'});
        el.setPosition(80);
        expect(published.at(-1)).toEqual({topic: 'cover/pos/set', payload: '80'});
    });

    it('invert flips the displayed scale; the popup tilt slider appears only when wired', async () => {
        const el = await mount('feezal-element-glass-cover', {
            'payload-mode': 'separate', 'subscribe-position': 'cover/pos', invert: '',
        });
        el.openDetails();
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.tilt')).toBeNull();
        deliver('cover/pos', 100);   // inverted: 100 = closed
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.state').textContent).toBe('Closed');

        el.setAttribute('slat-angle', 'cover/tilt');
        await el.updateComplete;
        expect(el.renderRoot.querySelector('.tilt')).not.toBeNull();
    });

    it('commands never publish in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-cover', {subscribe: 'cover/state', publish: 'cover/set'});
        el.cmdUp();
        el.setPosition(10);
        expect(published).toEqual([]);
    });
});

// ── inspectors (N6 registration) ─────────────────────────────────────────────

describe('glass device-card inspectors', () => {
    it('light + shutter declare and register their custom inspectors (device-card pattern)', () => {
        for (const tag of ['feezal-element-glass-light', 'feezal-element-glass-cover']) {
            const cls = customElements.get(tag);
            expect(cls.feezal.inspector).toBe(`${tag}-inspector`);
            expect(customElements.get(`${tag}-inspector`)).toBeDefined();
        }
    });

    it('contact/button/sensor use the flat attribute form (like material-contact)', () => {
        for (const tag of ['feezal-element-glass-contact', 'feezal-element-glass-button', 'feezal-element-glass-sensor']) {
            expect(customElements.get(tag).feezal.inspector).toBeUndefined();
        }
    });

    it('device cards carry HA discovery descriptors matching their material siblings', () => {
        expect(customElements.get('feezal-element-glass-light').feezal.discovery.component).toBe('light');
        expect(customElements.get('feezal-element-glass-contact').feezal.discovery.component).toBe('binary_sensor');
        expect(customElements.get('feezal-element-glass-cover').feezal.discovery.component).toBe('cover');
    });
});
