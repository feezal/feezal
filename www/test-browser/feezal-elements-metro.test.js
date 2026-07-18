/**
 * E55 metro tile family behaviour tests — the WP7/Win8 live-tile elements,
 * driven for real: the shared flip machinery + size grid, per-tile MQTT
 * binding, publish contracts (incl. editor guards) and capability gating.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-metro-tile';
import '@feezal/feezal-element-metro-switch';
import '@feezal/feezal-element-metro-contact';
import '@feezal/feezal-element-metro-light';
import '@feezal/feezal-element-metro-climate';
import '@feezal/feezal-element-metro-sensor';
import '@feezal/feezal-element-metro-media';
import '@feezal/feezal-element-metro-occupancy';
// The metro-light inspector uses editor-global components — register them
// here like the editor bundle does.
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

describe('metro-tile (base + generic tile)', () => {
    it('the size grid writes the mosaic geometry', async () => {
        const el = await mount('feezal-element-metro-tile', {size: '2x2'});
        expect(el.style.width).toBe('150px');
        expect(el.style.height).toBe('150px');
        el.setAttribute('size', '4x2');
        await el.updateComplete;
        expect(el.style.width).toBe('310px');
        expect(el.style.height).toBe('150px');
    });

    it('tap publishes and/or navigates; badge follows the topic', async () => {
        feezal.site = {view: 'main'};
        const el = await mount('feezal-element-metro-tile', {
            publish: 'cmnd/go', payload: 'x', view: 'page2', subscribe: 'stat/count',
        });
        feezal.connection.deliver('stat/count', '7');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge').textContent).toBe('7');

        el.shadowRoot.querySelector('.front').click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/go', payload: 'x'});
        expect(feezal.site.view).toBe('page2');
    });

    it('front-only tiles have no flip affordance', async () => {
        const el = await mount('feezal-element-metro-tile', {});
        expect(el.shadowRoot.querySelector('.flip-btn')).toBeNull();
        expect(el.shadowRoot.querySelector('.face.back')).toBeNull();
    });

    it('never acts in the editor', async () => {
        feezal.isEditor = true;
        feezal.site = {view: 'main'};
        const el = await mount('feezal-element-metro-tile', {publish: 'cmnd/go', view: 'page2'});
        el.shadowRoot.querySelector('.front').click();
        expect(feezal.connection.published).toHaveLength(0);
        expect(feezal.site.view).toBe('main');
    });
});

describe('metro-switch', () => {
    it('tap toggles + publishes; ⋯ flips to the back; back buttons publish', async () => {
        const el = await mount('feezal-element-metro-switch', {
            subscribe: 'stat/sw', publish: 'cmnd/sw',
        });
        feezal.connection.deliver('stat/sw', 'ON');
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);

        el.shadowRoot.querySelector('.front').click();
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(false);
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/sw', payload: 'OFF'});

        // flip: ⋯ opens the back, its ON button publishes
        el.shadowRoot.querySelector('.front .flip-btn').click();
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.tile').classList.contains('flipped')).toBe(true);
        el.shadowRoot.querySelector('.back .mbtn').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/sw', payload: 'ON'});
    });

    it('flip state is per-client UI state — nothing published on flip', async () => {
        const el = await mount('feezal-element-metro-switch', {publish: 'cmnd/sw'});
        el.shadowRoot.querySelector('.front .flip-btn').click();
        await el.updateComplete;
        expect(feezal.connection.published).toHaveLength(0);
    });

    it('icon-on/icon-off switch with the state (base icon as fallback)', async () => {
        const el = await mount('feezal-element-metro-switch', {
            subscribe: 'stat/sw', icon: 'power', 'icon-on': 'flash_on',
        });
        // OFF with no icon-off → base icon
        expect(el.shadowRoot.querySelector('.front feezal-icon').getAttribute('name')).toBe('power');
        feezal.connection.deliver('stat/sw', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.front feezal-icon').getAttribute('name')).toBe('flash_on');
    });
});

describe('metro-contact', () => {
    it('open/closed/tilted states drive the tile (front-only, material-contact payload coercion)', async () => {
        const el = await mount('feezal-element-metro-contact', {
            subscribe: 'stat/win', 'payload-tilted': '2',
        });
        expect(el.shadowRoot.querySelector('.flip-btn')).toBeNull();
        expect(el.shadowRoot.querySelector('svg.contact')).not.toBeNull();   // window SVG default

        feezal.connection.deliver('stat/win', true);   // boolean coerces to payload-open ON
        await el.updateComplete;
        expect(el.getAttribute('data-state')).toBe('open');
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('open');

        feezal.connection.deliver('stat/win', '2');
        await el.updateComplete;
        expect(el.getAttribute('data-state')).toBe('tilted');

        feezal.connection.deliver('stat/win', 'OFF');
        await el.updateComplete;
        expect(el.getAttribute('data-state')).toBe('closed');
    });

    it('icon-open/icon-closed override the type visual per state', async () => {
        const el = await mount('feezal-element-metro-contact', {
            subscribe: 'stat/door', type: 'door',
            'icon-open': 'door_open', 'icon-closed': 'door_front',
        });
        expect(el.shadowRoot.querySelector('svg.contact')).toBeNull();
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('door_front');
        feezal.connection.deliver('stat/door', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('door_open');
    });

    it('availability topic drives the ! badge', async () => {
        const el = await mount('feezal-element-metro-contact', {
            subscribe: 'stat/c', 'subscribe-availability': 'tele/c/LWT',
        });
        expect(el.shadowRoot.querySelector('.badge')).toBeNull();
        feezal.connection.deliver('tele/c/LWT', 'offline');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge').textContent).toBe('!');
        feezal.connection.deliver('tele/c/LWT', 'online');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge')).toBeNull();
    });
});

describe('metro-light', () => {
    it('always flips; separate mode state + % brightness slider (material-light contract)', async () => {
        const plain = await mount('feezal-element-metro-light', {'subscribe-state': 'stat/l', 'publish-state': 'cmnd/l'});
        expect(plain.shadowRoot.querySelector('.flip-btn')).not.toBeNull();
        expect(plain.shadowRoot.querySelectorAll('.onoff .mbtn')).toHaveLength(2);
        plain.shadowRoot.querySelector('.onoff .mbtn').click();   // ON
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/l', payload: 'on'});

        const dimmable = await mount('feezal-element-metro-light', {
            'subscribe-state': 'stat/l2', 'publish-state': 'cmnd/l2',
            'subscribe-brightness': 'stat/l2/bri', 'publish-brightness': 'cmnd/l2/bri',
            'brightness-max': '255',
        });
        feezal.connection.deliver('stat/l2', 'ON');
        feezal.connection.deliver('stat/l2/bri', '128');
        await dimmable.updateComplete;
        expect(dimmable.shadowRoot.querySelector('.state').textContent).toBe('on 50%');

        // The slider is % — publishing converts to the raw scale (100 % → 255).
        const slider = dimmable.shadowRoot.querySelector('input[type=range]');
        slider.value = '100';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/l2/bri', payload: '255'});
    });

    it('json payload mode: single topic in, merged JSON object out (zigbee2mqtt shape)', async () => {
        const el = await mount('feezal-element-metro-light', {
            'payload-mode': 'json', subscribe: 'z2m/lamp', publish: 'z2m/lamp/set',
            'brightness-max': '254', mode: 'brightness_ct',
            'color-temp-unit': 'mired', 'color-temp-min': '2000', 'color-temp-max': '6536',
        });
        feezal.connection.deliver('z2m/lamp', {state: 'ON', brightness: 127, color_temp: 250});
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('on 50%');
        expect(el._colorTemp).toBe(4000);   // 250 mired → 4000 K

        el.shadowRoot.querySelector('.onoff .mbtn:last-child').click();   // OFF
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/lamp/set', payload: '{"state":"off"}'});

        const brt = el.shadowRoot.querySelector('input[type=range]');
        brt.value = '50';
        brt.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'z2m/lamp/set', payload: '{"brightness":127}'});
    });

    it('on-off-source=brightness (HmIP/Homematic): level is the state, OLD_LEVEL restores', async () => {
        const el = await mount('feezal-element-metro-light', {
            'on-off-source': 'brightness',
            'subscribe-brightness': 'hm/dimmer/level', 'publish-brightness': 'hm/dimmer/level/set',
            'brightness-min': '0', 'brightness-max': '1',
            'payload-on': '1.005', 'payload-off': '0',
        });
        // level 0.5 → on 50 %, derived without any state topic
        feezal.connection.deliver('hm/dimmer/level', '0.5');
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('on 50%');
        // level = payload-off → off
        feezal.connection.deliver('hm/dimmer/level', '0');
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(false);

        // toggle ON publishes numeric payload-on verbatim (OLD_LEVEL command)
        el.shadowRoot.querySelector('.onoff .mbtn').click();
        expect(feezal.connection.published).toContainEqual({topic: 'hm/dimmer/level/set', payload: '1.005'});
        // toggle OFF publishes payload-off to the brightness topic
        el.shadowRoot.querySelector('.onoff .mbtn:last-child').click();
        expect(feezal.connection.published).toContainEqual({topic: 'hm/dimmer/level/set', payload: '0'});
    });

    it('icon-on/icon-off switch with the state', async () => {
        const el = await mount('feezal-element-metro-light', {
            'subscribe-state': 'stat/li', 'icon-off': 'lightbulb_outline', 'icon-on': 'lightbulb',
        });
        expect(el.shadowRoot.querySelector('.front feezal-icon').getAttribute('name')).toBe('lightbulb_outline');
        feezal.connection.deliver('stat/li', 'on');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.front feezal-icon').getAttribute('name')).toBe('lightbulb');
    });

    it('tolerates a JSON object on a separate-mode state topic (stale pre-json wiring)', async () => {
        // A z2m base topic wired without payload-mode=json (old discovery
        // shape) — the state/brightness keys must still be read.
        const el = await mount('feezal-element-metro-light', {
            subscribe: 'z2m/stale', 'brightness-max': '254',
        });
        feezal.connection.deliver('z2m/stale', {state: 'ON', brightness: 127});
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('on 50%');
    });

    it('json mode with a leaf message-property (payload.state) still reads the state object', async () => {
        // Real-life zigbee2mqtt Hue payload; message-property misconfigured
        // to a leaf — the element must fall back to the payload object.
        const el = await mount('feezal-element-metro-light', {
            'payload-mode': 'json', subscribe: 'z2m/hue', publish: 'z2m/hue/set',
            'message-property': 'payload.state',
            'brightness-max': '254', mode: 'brightness_ct',
            'color-temp-unit': 'mired', 'color-temp-min': '2203', 'color-temp-max': '6536',
        });
        feezal.connection.deliver('z2m/hue', {
            brightness: 254,
            color: {h: 38, hue: 38, s: 58, saturation: 58, x: 0.3951, y: 0.3854},
            color_mode: 'color_temp', color_temp: 271, color_temp_startup: 280,
            last_seen: 1783708015101, linkquality: 39, power_on_behavior: 'on',
            state: 'ON',
            update: {installed_version: 16782348, latest_version: 16786690, state: 'available'},
        });
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('on 100%');
        expect(el._colorTemp).toBe(3690);          // 271 mired → 3690 K
        expect(el._hs).toEqual([38, 58]);          // from the color object
    });

    it('autodiscovery: a z2m json-schema light maps payload-mode/scales/kelvin range/mode', async () => {
        await import('../src/feezal-sidebar-inspector-attributes.js');
        feezal.app = {change() {}};
        feezal.editor = {selectedElems: []};

        const light = document.createElement('feezal-element-metro-light');
        document.body.append(light);
        const host = document.createElement('feezal-sidebar-inspector-attributes');
        host.selectedElems = [light];
        document.body.append(host);
        await host.updateComplete;

        host._applyDiscovery({
            component: 'light',
            discovery_id: 'z2m-lamp',
            config: {
                schema: 'json',
                state_topic: 'zigbee2mqtt/Lamp',
                command_topic: 'zigbee2mqtt/Lamp/set',
                brightness: true, brightness_scale: 254,
                supported_color_modes: ['color_temp', 'xy'],
                min_mireds: 153, max_mireds: 454,
                name: 'Lamp',
            },
        });

        expect(light.getAttribute('payload-mode')).toBe('json');
        expect(light.getAttribute('subscribe')).toBe('zigbee2mqtt/Lamp');
        expect(light.getAttribute('publish')).toBe('zigbee2mqtt/Lamp/set');
        expect(light.getAttribute('brightness-max')).toBe('254');
        expect(light.getAttribute('color-temp-unit')).toBe('mired');
        expect(light.getAttribute('color-temp-max')).toBe('6536');   // 153 mired
        expect(light.getAttribute('color-temp-min')).toBe('2203');   // 454 mired
        expect(light.getAttribute('mode')).toBe('brightness_ct');    // CT lamp = dimmable
        expect(light.getAttribute('label')).toBe('Lamp');
        // json mode: message-property must remain the default (whole payload),
        // never a leaf like payload.state.
        expect(light.getAttribute('message-property') ?? 'payload').toBe('payload');
    });

    it('rewires subscriptions when topic attributes change on a live element', async () => {
        // The inspector-on-canvas flow: element mounts unconfigured, topics
        // arrive later via setAttribute — state must start flowing without a
        // remount.
        const el = await mount('feezal-element-metro-light', {});
        expect(feezal.connection.subCount()).toBe(0);

        el.setAttribute('subscribe-state', 'stat/late');
        await el.updateComplete;
        feezal.connection.deliver('stat/late', 'on');
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(true);

        // Switching to json mode drops the separate-mode subscription and
        // wires the base topic instead.
        el.setAttribute('payload-mode', 'json');
        el.setAttribute('subscribe', 'z2m/late');
        await el.updateComplete;
        feezal.connection.deliver('z2m/late', {state: 'OFF'});
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(false);
        feezal.connection.deliver('stat/late', 'on');   // old topic must be dead
        await el.updateComplete;
        expect(el.hasAttribute('data-on')).toBe(false);
    });

    it('rgb mode: hue/sat sliders publish an [r,g,b] JSON array', async () => {
        const el = await mount('feezal-element-metro-light', {
            mode: 'rgb', 'publish-rgb': 'cmnd/rgb',
        });
        const sliders = el.shadowRoot.querySelectorAll('input[type=range]');
        expect(sliders).toHaveLength(2);   // hue + saturation
        sliders[0].value = '120';          // green, sat defaults 100
        sliders[0].dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/rgb', payload: '[0,255,0]'});
    });
});

describe('metro-climate', () => {
    it('always has a back: the stepper is there even before topics are configured', async () => {
        const el = await mount('feezal-element-metro-climate', {subscribe: 'stat/temp'});
        expect(el.shadowRoot.querySelector('.flip-btn')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.stepper')).not.toBeNull();
    });

    it('front shows current temp; back stepper publishes clamped setpoints; mode chips publish', async () => {
        const el = await mount('feezal-element-metro-climate', {
            subscribe: 'stat/temp', 'subscribe-setpoint': 'stat/set', 'publish-setpoint': 'cmnd/set',
            step: '0.5', min: '5', max: '30',
            'publish-mode': 'cmnd/mode', modes: '["off","heat"]',
        });
        feezal.connection.deliver('stat/temp', '21.5');
        feezal.connection.deliver('stat/set', '22');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.current').textContent).toBe('21.5°C');

        const buttons = el.shadowRoot.querySelectorAll('.stepper .mbtn');
        buttons[1].click();   // +
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/set', payload: '22.5'});

        el.shadowRoot.querySelectorAll('.chips .mbtn')[1].click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/mode', payload: 'heat'});
    });
});

describe('metro-sensor', () => {
    it('front shows the formatted value; back renders the trend polyline + min/max', async () => {
        const el = await mount('feezal-element-metro-sensor', {
            subscribe: 'stat/p', digits: '1', unit: 'W', points: '5',
        });
        for (const v of [1, 5, 3]) feezal.connection.deliver('stat/p', String(v));
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.value').textContent).toBe('3.0');
        expect(el.shadowRoot.querySelector('polyline')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.minmax').textContent).toContain('min 1.0');
        expect(el.shadowRoot.querySelector('.minmax').textContent).toContain('max 5.0');
    });
});

describe('metro-light inspector (N6)', () => {
    async function mountInspector(light) {
        const inspector = document.createElement('feezal-element-metro-light-inspector');
        inspector.element = light;
        inspector.addEventListener('feezal-attribute-changed', e => {
            const {name, value} = e.detail;
            if (value === '' || value === null) light.removeAttribute(name);
            else light.setAttribute(name, String(value));
            inspector.requestUpdate();
        });
        document.body.append(inspector);
        await inspector.updateComplete;
        return inspector;
    }

    it('is declared on the element and registered', () => {
        const cls = customElements.get('feezal-element-metro-light');
        expect(cls.feezal.inspector).toBe('feezal-element-metro-light-inspector');
        expect(customElements.get('feezal-element-metro-light-inspector')).toBeDefined();
    });

    it('capability sections gate on topics and clear them when switched off', async () => {
        const light = document.createElement('feezal-element-metro-light');
        light.setAttribute('subscribe-brightness', 'stat/bri');
        const inspector = await mountInspector(light);

        // Brightness section enabled (topic present), color temp + color collapsed.
        const sections = inspector.shadowRoot.querySelectorAll('sl-tab-panel[name=topics] .section');
        expect(sections).toHaveLength(4);   // State + Brightness + Color Temperature + Color RGB/HS
        const switches = inspector.shadowRoot.querySelectorAll('sl-switch');
        expect(switches[0].checked).toBe(true);    // brightness
        expect(switches[1].checked).toBe(false);   // color temp

        // Switching brightness off clears its topics on the element.
        switches[0].checked = false;
        switches[0].dispatchEvent(new CustomEvent('sl-change'));
        await inspector.updateComplete;
        expect(light.hasAttribute('subscribe-brightness')).toBe(false);
    });

    it('topic edits write through the attribute protocol', async () => {
        const light = document.createElement('feezal-element-metro-light');
        const inspector = await mountInspector(light);
        const stateInput = inspector.shadowRoot.querySelector('sl-tab-panel[name=topics] feezal-topic-input');
        stateInput.value = 'stat/lamp';
        stateInput.dispatchEvent(new CustomEvent('sl-change'));
        expect(light.getAttribute('subscribe-state')).toBe('stat/lamp');
    });

    it('json mode collapses Topics to State & Control; brightness source hides state topics', async () => {
        const jsonLight = document.createElement('feezal-element-metro-light');
        jsonLight.setAttribute('payload-mode', 'json');
        const jsonInspector = await mountInspector(jsonLight);
        expect(jsonInspector.shadowRoot.querySelectorAll('sl-tab-panel[name=topics] .section')).toHaveLength(1);

        const hmip = document.createElement('feezal-element-metro-light');
        hmip.setAttribute('on-off-source', 'brightness');
        const hmipInspector = await mountInspector(hmip);
        const stateBody = hmipInspector.shadowRoot.querySelector('sl-tab-panel[name=topics] .sec-body');
        expect(stateBody.textContent).toContain('state topics are unused');
        expect(stateBody.querySelector('sl-input')).toBeNull();
    });
});

describe('metro-occupancy', () => {
    it('material-motion contract: state coercion, type icon, per-state icons, texts, badge', async () => {
        const el = await mount('feezal-element-metro-occupancy', {
            subscribe: 'stat/pir', type: 'presence',
            'text-active': 'belegt', 'text-clear': 'frei',
            'subscribe-availability': 'tele/LWT',
        });
        expect(el.shadowRoot.querySelector('.flip-btn')).toBeNull();   // front-only
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('person');
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('frei');

        feezal.connection.deliver('stat/pir', {state: 'ON'});   // z2m JSON shape
        await el.updateComplete;
        expect(el.hasAttribute('data-active')).toBe(true);
        expect(el.shadowRoot.querySelector('.state').textContent).toBe('belegt');

        // per-state icon override while active
        el.setAttribute('icon-active', 'directions_run');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('feezal-icon').getAttribute('name')).toBe('directions_run');

        feezal.connection.deliver('tele/LWT', 'offline');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.badge').textContent).toBe('!');
    });
});

describe('metro-media', () => {
    it('front tap publishes play/pause; back transport + volume publish', async () => {
        const el = await mount('feezal-element-metro-media', {
            subscribe: 'stat/track', publish: 'cmnd/mp',
            'subscribe-state': 'stat/state', 'publish-volume': 'cmnd/vol',
        });
        feezal.connection.deliver('stat/track', 'Song A');
        feezal.connection.deliver('stat/state', 'playing');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.track').textContent).toBe('Song A');

        el.shadowRoot.querySelector('.front').click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/mp', payload: 'play_pause'});

        const transport = el.shadowRoot.querySelectorAll('.transport .mbtn');
        transport[2].click();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/mp', payload: 'next'});

        const slider = el.shadowRoot.querySelector('input[type=range]');
        slider.value = '30';
        slider.dispatchEvent(new Event('change'));
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/vol', payload: '30'});
    });
});
