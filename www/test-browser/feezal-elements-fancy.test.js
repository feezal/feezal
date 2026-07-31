/**
 * E139 — the Fancy family in a real browser: editor static poses without the
 * lib, viewer animation lifecycle against a fake lottie factory (recoloured
 * data, directional transitions, cover position-seek, light brightness-seek,
 * contact tilt tristate), theme retint, and MQTT behaviour through the shared
 * E137 controllers.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
// Element files imported directly — index.js only registers the RELEASED
// cards (switch, contact; E164), but the disabled ones stay tested.
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-light.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-switch.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-contact.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-cover.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-climate.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-sensor.js';
import '../packages/@feezal/feezal-elements-fancy/feezal-element-fancy-lock.js';
import {FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT}
    from '../packages/@feezal/feezal-elements-fancy/animations.js';
import {__setLottieFactoryForTests} from '@feezal/feezal-lottie';
import {setupFeezal, mount, until} from './helpers.js';

function fakeLottie() {
    const factory = {
        instances: [],
        loadAnimation(opts) {
            const inst = {
                opts, loop: false, destroyed: false, _listeners: {}, calls: [],
                addEventListener(ev, cb) { (this._listeners[ev] ??= []).push(cb); },
                playSegments(seg) { this.calls.push(['playSegments', seg]); },
                goToAndStop(f) { this.calls.push(['goToAndStop', f]); },
                resetSegments() {},
                destroy() { this.destroyed = true; },
                fireComplete() { (this._listeners.complete || []).forEach(cb => cb()); },
            };
            factory.instances.push(inst);
            return inst;
        },
        get last() { return this.instances[this.instances.length - 1]; },
    };
    return factory;
}

let factory;
beforeEach(() => {
    setupFeezal();
    factory = fakeLottie();
    __setLottieFactoryForTests(factory);
});
afterEach(() => __setLottieFactoryForTests(null));

const collectFills = data => {
    const fills = [];
    const walk = n => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== 'object') return;
        if (n.ty === 'fl' && n.c) fills.push(n.c.k);
        Object.values(n).forEach(walk);
    };
    walk(data);
    return fills;
};

const TAGS = ['light', 'switch', 'contact', 'cover', 'climate', 'sensor', 'lock']
    .map(n => `feezal-element-fancy-${n}`);

describe('editor: static pose, the animation library is NEVER loaded (E89 discipline)', () => {
    it.each(TAGS)('%s renders its duotone pose and skips lottie', async tag => {
        feezal.isEditor = true;
        const el = await mount(tag);
        await new Promise(r => setTimeout(r, 30));
        expect(el.shadowRoot.querySelector('.pose svg')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.pose').hidden).toBe(false);
        expect(factory.instances.length).toBe(0);
    });
});

describe('editor chrome (reported bugs)', () => {
    it.each(TAGS)('%s shows the dashed editable outline', async tag => {
        // feezalBaseStyles was missing from the family styles - fancy cards
        // had NO outline on the canvas until selected (reported).
        feezal.isEditor = true;
        const el = await mount(tag);
        el.classList.add('feezal-editable');
        await el.updateComplete;
        const cs = getComputedStyle(el);
        expect(cs.outlineStyle, tag).toBe('dashed');
    });
});

describe('viewer: the lottie lifecycle', () => {
    it('mounts the recoloured animation — no palette slot survives', async () => {
        const el = await mount('feezal-element-fancy-light', {subscribe: 'stat/l'});
        await until(() => factory.instances.length === 1);
        await el.updateComplete;   // _animLive re-render
        const {animationData} = factory.last.opts;
        for (const k of collectFills(animationData)) {
            for (const slot of [FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT]) {
                expect(slot.slice(0, 3).every((c, i) => Math.abs(k[i] - c) < 0.002),
                    JSON.stringify(k)).toBe(false);
            }
        }
        // the pose layer hides once the animation is live
        expect(el.shadowRoot.querySelector('.anim').hidden).toBe(false);
        expect(el.shadowRoot.querySelector('.pose').hidden).toBe(true);
    });

    it('light: OFF→ON plays the transition clip, completion enters the breathing loop', async () => {
        const el = await mount('feezal-element-fancy-light',
            {subscribe: 'stat/l', 'payload-on': 'ON', 'payload-off': 'OFF'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/l', 'ON');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [0, 30]]);
        inst.fireComplete();
        expect(inst.loop).toBe(true);
        expect(inst.calls[1]).toEqual(['playSegments', [30, 90]]);
        // …and ON→OFF plays the closing clip (never a jump-cut)
        inst.calls.length = 0;
        feezal.connection.deliver('stat/l', 'OFF');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [90, 120]]);
    });

    it('light: a known brightness scrubs the glow segment instead of looping', async () => {
        const el = await mount('feezal-element-fancy-light',
            {subscribe: 'stat/l', mode: 'brightness', 'payload-on': 'ON'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        // payload parsing is the light controller's own test surface - drive
        // the state it exposes and assert the ELEMENT's seek wiring
        el.light.on = true;
        el.light.brt = 50;
        el.requestUpdate();
        await el.updateComplete;
        const seeks = inst.calls.filter(([c]) => c === 'goToAndStop');
        expect(seeks.length).toBeGreaterThan(0);
        // 50 % → halfway into the [130,190] brightness segment
        expect(seeks[seeks.length - 1][1]).toBeCloseTo(160, 0);
    });

    it('contact window: tilt tristate — closed→tilted plays the tilt clip', async () => {
        const el = await mount('feezal-element-fancy-contact',
            {subscribe: 'stat/c', type: 'window', 'payload-open': 'open',
                'payload-closed': 'closed', 'payload-tilted': 'tilted'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/c', 'tilted');
        await el.updateComplete;
        // the clip includes the handle pre-roll (down→up) before the Kipp
        expect(inst.calls[0]).toEqual(['playSegments', [78, 115]]);
        expect(el.shadowRoot.textContent).toContain('Tilted');
        // opening instead: handle down→left, perspective swing, breeze tail
        inst.calls.length = 0;
        feezal.connection.deliver('stat/c', 'closed');
        await el.updateComplete;
        inst.fireComplete();
        inst.calls.length = 0;
        feezal.connection.deliver('stat/c', 'open');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [0, 66]]);
    });

    it('cover: SEEKS by reported position — the blind stands where the device says', async () => {
        const el = await mount('feezal-element-fancy-cover', {subscribe: 'stat/cov'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/cov', {position: 30});   // 30 % open → 70 % closed
        await el.updateComplete;
        const seeks = inst.calls.filter(([c]) => c === 'goToAndStop');
        expect(seeks[seeks.length - 1][1]).toBeCloseTo(70, 0);
        expect(inst.calls.some(([c]) => c === 'playSegments')).toBe(false);   // never plays
        expect(el.shadowRoot.textContent).toContain('30');
    });

    it('lock: unlock plays the shackle clip; jammed enters the shake loop', async () => {
        const el = await mount('feezal-element-fancy-lock',
            {subscribe: 'stat/lock', publish: 'cmd/lock'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        feezal.connection.deliver('stat/lock', 'LOCKED');
        await el.updateComplete;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/lock', 'UNLOCKED');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [0, 24]]);
        feezal.connection.deliver('stat/lock', 'JAMMED');
        await el.updateComplete;
        inst.fireComplete?.();
        expect(inst.loop).toBe(true);   // the jam shake loops
        expect(el.shadowRoot.textContent).toContain('Jammed');
    });

    it('sensor (alarm slice): per-type CSS pose, NO lottie, triggers on alarm with the E138 error tone', async () => {
        const el = await mount('feezal-element-fancy-sensor',
            {subscribe: 'stat/leak', type: 'water-leak'});
        expect(el.activeToneVar()).toBe('--error-color');
        // The sensor animates via per-type CSS poses, not lottie — no instance
        // is ever created (its animationKey() is null).
        await new Promise(r => setTimeout(r, 30));
        expect(factory.instances.length).toBe(0);
        // the pose is the hero and stays visible (no anim layer to swap in)
        expect(el.shadowRoot.querySelector('.pose').hidden).toBe(false);
        // per-type pose, clear at rest
        expect(el.shadowRoot.querySelector('.pose .sp.t-water-leak')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.sp.on')).toBeNull();

        feezal.connection.deliver('stat/leak', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.sp.on')).toBeTruthy();          // triggered
        expect(el.shadowRoot.querySelector('.sp .wave')).toBeTruthy();       // the leak ripples
        expect(el.shadowRoot.textContent).toContain('Leak!');
    });

    it('sensor: each alarm type renders its OWN pose class', async () => {
        for (const [type, cls] of [['smoke', 't-smoke'], ['gas', 't-gas'], ['co', 't-co'],
            ['vibration', 't-vibration'], ['tamper', 't-tamper'], ['generic', 't-generic']]) {
            const el = await mount('feezal-element-fancy-sensor', {subscribe: 'stat/s', type});
            expect(el.shadowRoot.querySelector(`.pose .sp.${cls}`), type).toBeTruthy();
            el.remove();
        }
    });

    it('climate: heating when the setpoint is above actual — the waves loop', async () => {
        const el = await mount('feezal-element-fancy-climate',
            {subscribe: 'stat/clim', 'payload-mode': 'json'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/clim', {current_heating_setpoint: 23, local_temperature: 19});
        await el.updateComplete;
        expect(inst.loop).toBe(true);
        expect(inst.calls[0]).toEqual(['playSegments', [10, 74]]);
        expect(el.shadowRoot.textContent).toContain('→');
    });

    it('switch (E162 proof piece): ON plays the confetti celebration, OFF the explicit shrink-down', async () => {
        const el = await mount('feezal-element-fancy-switch',
            {subscribe: 'stat/sw', publish: 'cmd/sw'});
        await until(() => factory.instances.length === 1);
        const inst = factory.last;
        inst.calls.length = 0;
        feezal.connection.deliver('stat/sw', 'ON');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [10, 100]]);   // wipe + confetti
        inst.fireComplete();
        // holds the ON pose, no loop
        expect(inst.loop).toBe(false);
        expect(inst.calls.some(([c]) => c === 'goToAndStop')).toBe(true);
        // OFF plays the EXPLICIT shrink-down clip — never the reversed ON
        inst.calls.length = 0;
        feezal.connection.deliver('stat/sw', 'OFF');
        await el.updateComplete;
        expect(inst.calls[0]).toEqual(['playSegments', [110, 150]]);
        expect(el.shadowRoot.textContent).toContain('Off');
        // the confetti keeps its own palette through the recolour
        const fills = [];
        const walk = n => {
            if (Array.isArray(n)) return n.forEach(walk);
            if (!n || typeof n !== 'object') return;
            if (n.ty === 'fl' && n.c) fills.push(n.c.k);
            Object.values(n).forEach(walk);
        };
        walk(inst.opts.animationData);
        expect(fills.some(k => k[0] === 0 && Math.abs(k[1] - 0.631) < 0.01)).toBe(true);   // cyan survives
    });

    it('switch: a tap publishes payload-on/off to publish (glass-switch contract)', async () => {
        // Regression guard: the element once wired taps through a controller
        // that published to a topic the element never exposed — taps went
        // nowhere. Now it IS the simple glass/material contract.
        const el = await mount('feezal-element-fancy-switch',
            {subscribe: 'stat/sw', publish: 'cmd/sw'});
        await until(() => factory.instances.length === 1);
        el.shadowRoot.querySelector('div').click();
        await el.updateComplete;
        expect(feezal.connection.published).toEqual([{topic: 'cmd/sw', payload: 'ON'}]);
        el.shadowRoot.querySelector('div').click();
        await el.updateComplete;
        expect(feezal.connection.published[1]).toEqual({topic: 'cmd/sw', payload: 'OFF'});
        // incoming state still reflects (payloadMatch, not the tap path)
        feezal.connection.deliver('stat/sw', 'ON');
        await el.updateComplete;
        expect(el.shadowRoot.textContent).toContain('On');
    });

    it('theme retint rebuilds the instance with fresh tones', async () => {
        const site = document.createElement('feezal-site-stub');
        document.body.append(site);
        feezal.site = site;
        await mount('feezal-element-fancy-light', {subscribe: 'stat/l'});
        await until(() => factory.instances.length === 1);
        document.dispatchEvent(new CustomEvent('feezal-fancy-retint'));
        await until(() => factory.instances.length === 2);
        expect(factory.instances[0].destroyed).toBe(true);
        site.remove();
    });

    it('a broken animation-src leaves the static pose in charge (never throws)', async () => {
        const el = await mount('feezal-element-fancy-light',
            {subscribe: 'stat/l', 'animation-src': '/definitely/not/there.json'});
        await new Promise(r => setTimeout(r, 60));
        expect(factory.instances.length).toBe(0);
        expect(el.shadowRoot.querySelector('.pose').hidden).toBe(false);
    });
});
