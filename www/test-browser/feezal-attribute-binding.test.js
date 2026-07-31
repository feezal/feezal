/**
 * Regression — duplicate attribute bindings. A subclass property bound to an
 * attribute the FeezalElement base class ALREADY binds (message-property →
 * messageProperty) gives Lit two properties reflecting into one attribute;
 * on first update the base default ('payload') overwrote discovery-stamped
 * paths like payload.val, so mqtt-smarthome/Homematic state never parsed
 * and cards snapped back to off. Bitten by the fancy + eink families.
 *
 * These tests stamp the attribute the way discovery does (markup attribute
 * present before upgrade) and assert it survives the first reflection —
 * plus one end-to-end parse through the stamped path.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-elements-fancy/index.js';
import '../packages/@feezal/feezal-element-eink-contact/feezal-element-eink-contact.js';
import '../packages/@feezal/feezal-element-eink-motion/feezal-element-eink-motion.js';
import '../packages/@feezal/feezal-element-eink-sensor/feezal-element-eink-sensor.js';
import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';
import {setupFeezal, mount} from './helpers.js';

// every tag that carried the duplicate binding, plus glass-switch as the
// known-good control the bug report compared against
const TAGS = [
    'feezal-element-fancy-light', 'feezal-element-fancy-switch',
    'feezal-element-fancy-contact', 'feezal-element-fancy-cover',
    'feezal-element-fancy-climate', 'feezal-element-fancy-sensor',
    'feezal-element-fancy-lock',
    'feezal-element-eink-contact', 'feezal-element-eink-motion',
    'feezal-element-eink-sensor',
    'feezal-element-glass-switch',
];

let feezal;
beforeEach(() => {
    feezal = setupFeezal();
    // editor mode: static poses only — the animation chunk stays out of this suite
    feezal.isEditor = true;
});

describe('a stamped message-property survives the first reflection round-trip', () => {
    it.each(TAGS)('%s keeps payload.val', async tag => {
        const el = await mount(tag, {'message-property': 'payload.val'});
        await el.updateComplete;   // second round: reflection has settled
        expect(el.getAttribute('message-property')).toBe('payload.val');
        expect(el.messageProperty).toBe('payload.val');
    });
});

describe('and the stamped path is what actually parses state', () => {
    it('fancy-light follows mqtt-smarthome {val: …} through payload.val', async () => {
        const el = await mount('feezal-element-fancy-light',
            {subscribe: 'stat/l', 'message-property': 'payload.val'});
        feezal.connection.deliver('stat/l', {val: 'ON'});
        await el.updateComplete;
        expect(el.light.on).toBe(true);
        feezal.connection.deliver('stat/l', {val: 'OFF'});
        await el.updateComplete;
        expect(el.light.on).toBe(false);
    });

    it('fancy-switch follows mqtt-smarthome {val: …} through payload.val', async () => {
        const el = await mount('feezal-element-fancy-switch',
            {subscribe: 'stat/sw', 'message-property': 'payload.val'});
        feezal.connection.deliver('stat/sw', {val: 'ON'});
        await el.updateComplete;
        expect(el._on).toBe(true);
    });
});
