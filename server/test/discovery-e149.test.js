/**
 * E149 — extend HA MQTT discovery to more component types. Each new component
 * (button, scene, number, text, alarm_control_panel, camera) must register as a
 * supported entity with its config abbreviations expanded, so the client-side
 * discovery map can wire it onto the matching feezal element.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const disc = require('../src/mqtt/discovery.js');

const buf = obj => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));

beforeEach(() => disc.clearEntities());

describe('E149 — button component', () => {
    it('registers a button and expands pl_prs → payload_press', () => {
        disc.handleMessage('homeassistant/button/reboot/config',
            buf({name: 'Reboot', cmd_t: 'dev/reboot/set', pl_prs: 'PRESS'}));
        const e = disc.getDiscoveredEntity('button/reboot');
        expect(e).toBeTruthy();
        expect(e.component).toBe('button');
        expect(e.config.command_topic).toBe('dev/reboot/set');
        expect(e.config.payload_press).toBe('PRESS');
    });
});

describe('E149 — scene component', () => {
    it('registers a scene and expands pl_on → payload_on', () => {
        disc.handleMessage('homeassistant/scene/movie/config',
            buf({name: 'Movie', cmd_t: 'scene/movie/set', pl_on: 'ON'}));
        const e = disc.getDiscoveredEntity('scene/movie');
        expect(e).toBeTruthy();
        expect(e.component).toBe('scene');
        expect(e.config.command_topic).toBe('scene/movie/set');
        expect(e.config.payload_on).toBe('ON');
    });
});

describe('E149 — number component', () => {
    it('registers a number with min/max/step + value_template', () => {
        disc.handleMessage('homeassistant/number/setp/config', buf({
            name: 'Setpoint', cmd_t: 'n/setp/set', stat_t: 'n/setp',
            min: 5, max: 30, step: 0.5, unit_of_meas: '°C', val_tpl: '{{ value_json.val }}',
        }));
        const e = disc.getDiscoveredEntity('number/setp');
        expect(e).toBeTruthy();
        expect(e.component).toBe('number');
        expect(e.config.min).toBe(5);
        expect(e.config.max).toBe(30);
        expect(e.config.step).toBe(0.5);
        expect(e.config.unit_of_measurement).toBe('°C');
        expect(e.config.value_template).toBe('{{ value_json.val }}');
    });
});

describe('E149 — text component', () => {
    it('registers a text field with state + command topics', () => {
        disc.handleMessage('homeassistant/text/note/config',
            buf({name: 'Note', cmd_t: 't/note/set', stat_t: 't/note'}));
        const e = disc.getDiscoveredEntity('text/note');
        expect(e).toBeTruthy();
        expect(e.component).toBe('text');
        expect(e.config.command_topic).toBe('t/note/set');
        expect(e.config.state_topic).toBe('t/note');
    });
});

describe('E149 — alarm_control_panel component', () => {
    it('registers an alarm panel with state + command topics and code flag', () => {
        disc.handleMessage('homeassistant/alarm_control_panel/house/config', buf({
            name: 'House Alarm', stat_t: 'alarm/state', cmd_t: 'alarm/set',
            code_arm_required: false,
        }));
        const e = disc.getDiscoveredEntity('alarm_control_panel/house');
        expect(e).toBeTruthy();
        expect(e.component).toBe('alarm_control_panel');
        expect(e.config.state_topic).toBe('alarm/state');
        expect(e.config.command_topic).toBe('alarm/set');
        expect(e.config.code_arm_required).toBe(false);
    });
});

describe('E149 — camera component', () => {
    it('registers a camera and expands the t → topic abbreviation', () => {
        disc.handleMessage('homeassistant/camera/porch/config',
            buf({name: 'Porch', t: 'cam/porch'}));
        const e = disc.getDiscoveredEntity('camera/porch');
        expect(e).toBeTruthy();
        expect(e.component).toBe('camera');
        expect(e.config.topic).toBe('cam/porch');
    });
});

describe('E149 — image component', () => {
    it('registers an image and expands url_t → url_topic', () => {
        disc.handleMessage('homeassistant/image/door/config',
            buf({name: 'Door Cam', url_t: 'img/door/url'}));
        const e = disc.getDiscoveredEntity('image/door');
        expect(e).toBeTruthy();
        expect(e.component).toBe('image');
        expect(e.config.url_topic).toBe('img/door/url');
    });
});

describe('E149 — components arrive via the device (cmps) bundle too', () => {
    it('registers a button declared inside a device discovery payload', () => {
        disc.handleMessage('homeassistant/device/dev9/config', buf({
            dev: {ids: ['dev9'], name: 'Gadget'},
            '~': 'dev9',
            cmps: {
                btn: {p: 'button', name: 'Ping', cmd_t: '~/ping', pl_prs: 'GO'},
            },
        }));
        const e = disc.getDiscoveredEntity('button/dev9/btn');
        expect(e).toBeTruthy();
        expect(e.component).toBe('button');
        expect(e.config.command_topic).toBe('dev9/ping');
        expect(e.config.payload_press).toBe('GO');
    });
});
