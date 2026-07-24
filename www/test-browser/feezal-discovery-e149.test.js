/**
 * E149 — the real button + input element discovery maps. A HA `button` entity,
 * a `scene` entity, and a `text` entity must each wire onto the shipped element
 * via stampDiscovery (the exact path the discovery picker / Generate wizard use).
 */
import {describe, it, expect, beforeEach} from 'vitest';

import '../packages/@feezal/feezal-element-material-button/feezal-element-material-button.js';
import '../packages/@feezal/feezal-element-material-input/feezal-element-material-input.js';
import '../packages/@feezal/feezal-element-basic-image/feezal-element-basic-image.js';
import {stampDiscovery, resolveElementTag} from '../src/feezal-discovery-stamp.js';
import {setupFeezal} from './helpers.js';

beforeEach(() => setupFeezal());

const stamp = (tag, config) => {
    const el = document.createElement(tag);
    stampDiscovery(el, {component: config._component || 'x', config});
    return el;
};

describe('E149 — button element map (button + scene)', () => {
    it('wires a HA button: command_topic → publish, payload_press → payload', () => {
        const el = stamp('feezal-element-material-button', {
            _component: 'button', name: 'Reboot',
            command_topic: 'dev/reboot/set', payload_press: 'PRESS',
        });
        expect(el.getAttribute('publish')).toBe('dev/reboot/set');
        expect(el.getAttribute('payload')).toBe('PRESS');
        expect(el.getAttribute('label')).toBe('Reboot');
    });

    it('wires a HA scene onto the same button element via payload_on → payload', () => {
        const el = stamp('feezal-element-material-button', {
            _component: 'scene', name: 'Movie',
            command_topic: 'scene/movie/set', payload_on: 'ON',
        });
        expect(el.getAttribute('publish')).toBe('scene/movie/set');
        expect(el.getAttribute('payload')).toBe('ON');
        // payload_press absent → that line was skipped, no clobber
    });
});

describe('E149 — text element map', () => {
    it('wires a HA text field: state_topic → subscribe, command_topic → publish', () => {
        const el = stamp('feezal-element-material-input', {
            _component: 'text', name: 'Note',
            command_topic: 't/note/set', state_topic: 't/note',
            value_template: '{{ value_json.text }}',
        });
        expect(el.getAttribute('subscribe')).toBe('t/note');
        expect(el.getAttribute('publish')).toBe('t/note/set');
        expect(el.getAttribute('message-property')).toBe('payload.text');
        expect(el.getAttribute('label')).toBe('Note');
    });
});

describe('E149 — image element map', () => {
    it('wires a HA image: url_topic → subscribe, name → alt', () => {
        const el = stamp('feezal-element-basic-image', {
            _component: 'image', name: 'Door Cam', url_topic: 'img/door/url',
        });
        expect(el.getAttribute('subscribe')).toBe('img/door/url');
        expect(el.getAttribute('alt')).toBe('Door Cam');
    });
});

describe('E149 — resolveElementTag routing', () => {
    const reg = new Set([
        'feezal-element-material-button', 'feezal-element-material-input',
        'feezal-element-circle-alarm', 'feezal-element-circle-camera',
        'feezal-element-panel-knob', 'feezal-element-basic-image',
    ]);
    const isReg = t => reg.has(t);
    it('routes button + scene to the button element', () => {
        expect(resolveElementTag('button', 'material', undefined, isReg)).toBe('feezal-element-material-button');
        expect(resolveElementTag('scene', 'material', undefined, isReg)).toBe('feezal-element-material-button');
    });
    it('routes text to the input element', () => {
        expect(resolveElementTag('text', 'material', undefined, isReg)).toBe('feezal-element-material-input');
    });
    it('routes alarm_control_panel / camera / number to their elements', () => {
        expect(resolveElementTag('alarm_control_panel', 'circle', undefined, isReg)).toBe('feezal-element-circle-alarm');
        expect(resolveElementTag('camera', 'circle', undefined, isReg)).toBe('feezal-element-circle-camera');
        expect(resolveElementTag('number', 'panel', undefined, isReg)).toBe('feezal-element-panel-knob');
        expect(resolveElementTag('image', 'basic', undefined, isReg)).toBe('feezal-element-basic-image');
    });
    it('returns null for a family with no matching element (parity gap)', () => {
        expect(resolveElementTag('button', 'glass', undefined, isReg)).toBe(null);
    });
});
