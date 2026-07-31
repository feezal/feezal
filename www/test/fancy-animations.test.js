/**
 * E139 — the generated Lottie set and the shared fancy machinery, unit level:
 * the generator's output is structurally valid Lottie, the two-tone palette
 * contract holds, segments stay inside the composition, and the recolour /
 * player logic behaves (with a fake lottie instance — the real library never
 * loads in unit tests).
 */
import {describe, it, expect} from 'vitest';
import {FANCY_ANIMATIONS, FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT}
    from '../packages/@feezal/feezal-elements-fancy/animations.js';
import {recolorAnimation, parseCssColor, FancyPlayer}
    from '../packages/@feezal/feezal-elements-fancy/fancy-shared.js';
import {__setLottieFactoryForTests} from '@feezal/feezal-lottie';

const EXPECTED = ['light', 'switch', 'contact-window', 'contact-door', 'contact-generic',
    'contact-garagedoor', 'cover', 'climate', 'sensor', 'lock'];

// the same shape check basic-lottie guards uploads with
const looksLikeLottie = o => !!o && Array.isArray(o.layers) && 'fr' in o && 'ip' in o && 'op' in o;

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

describe('the generated animation set', () => {
    it('covers every card/variant and is structurally valid Lottie', () => {
        expect(Object.keys(FANCY_ANIMATIONS).sort()).toEqual([...EXPECTED].sort());
        for (const [name, entry] of Object.entries(FANCY_ANIMATIONS)) {
            expect(looksLikeLottie(entry.data), name).toBe(true);
            expect(entry.data.w, name).toBe(100);
            expect(entry.data.h, name).toBe(100);
        }
    });

    it('every segment lies inside the composition', () => {
        for (const [name, entry] of Object.entries(FANCY_ANIMATIONS)) {
            const {op} = entry.data;
            const segs = [
                ...Object.values(entry.states || {}),
                ...Object.values(entry.transitions || {}),
                ...Object.values(entry.seek || {}),
            ];
            for (const [a, b] of segs) {
                expect(a, `${name} start`).toBeGreaterThanOrEqual(0);
                expect(b, `${name} end ≤ op`).toBeLessThanOrEqual(op);
                expect(b, `${name} ordered`).toBeGreaterThanOrEqual(a);
            }
        }
    });

    it('loops and transitions reference declared states', () => {
        for (const [name, entry] of Object.entries(FANCY_ANIMATIONS)) {
            for (const l of entry.loops || []) {
                expect(entry.states, `${name} loop ${l}`).toHaveProperty(l);
            }
            for (const key of Object.keys(entry.transitions || {})) {
                const [from, to] = key.split('>');
                expect(entry.states, `${name} ${key} from`).toHaveProperty(from);
                expect(entry.states, `${name} ${key} to`).toHaveProperty(to);
            }
        }
    });

    it('every fill is a palette slot, a hole, or a DECLARED flourish colour', () => {
        // E162: flourish particles (confetti) keep their own colours — each
        // animation DECLARES them in entry.palette so deliberate colour is
        // distinguishable from drift. Undeclared non-slot fills still fail.
        for (const [name, entry] of Object.entries(FANCY_ANIMATIONS)) {
            const declared = entry.palette || [];
            for (const k of collectFills(entry.data)) {
                const isSlot = [FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT].some(slot =>
                    slot.slice(0, 3).every((c, i) => Math.abs(k[i] - c) < 0.002));
                const isHole = k[0] === 1 && k[1] === 1 && k[2] === 1;   // knob / punch-outs
                const isDeclared = declared.some(fx =>
                    fx.slice(0, 3).every((c, i) => Math.abs(k[i] - c) < 0.002));
                expect(isSlot || isHole || isDeclared, `${name}: fill ${JSON.stringify(k)}`).toBe(true);
            }
        }
    });

    it('the marquee cards carry the segment semantics the elements rely on', () => {
        expect(FANCY_ANIMATIONS['contact-window'].states).toHaveProperty('tilted');
        expect(FANCY_ANIMATIONS['contact-window'].transitions).toHaveProperty('closed>open');
        expect(FANCY_ANIMATIONS['contact-window'].transitions).toHaveProperty('closed>tilted');
        expect(FANCY_ANIMATIONS.cover.seek).toHaveProperty('travel');
        expect(FANCY_ANIMATIONS.light.seek).toHaveProperty('brightness');
        expect(FANCY_ANIMATIONS.light.loops).toContain('on');
        expect(FANCY_ANIMATIONS.lock.transitions).toHaveProperty('locked>unlocked');
        // E162 proof piece: BOTH directions are explicit clips (on is the
        // confetti celebration, off is the shrink-down — never a reversed on)
        expect(FANCY_ANIMATIONS.switch.transitions).toHaveProperty('off>on');
        expect(FANCY_ANIMATIONS.switch.transitions).toHaveProperty('on>off');
        expect(FANCY_ANIMATIONS.climate.loops).toContain('heating');
        expect(FANCY_ANIMATIONS.sensor.loops).toContain('active');
    });
});

describe('recolorAnimation — the two-tone substitution', () => {
    it('replaces both slots with the resolved tones, leaves holes alone', () => {
        const out = recolorAnimation(FANCY_ANIMATIONS.light.data, [0.1, 0.2, 0.3], [0.9, 0.8, 0.7]);
        const fills = collectFills(out);
        expect(fills.some(k => k[0] === 0.1 && k[1] === 0.2 && k[2] === 0.3)).toBe(true);
        expect(fills.some(k => k[0] === 0.9 && k[1] === 0.8 && k[2] === 0.7)).toBe(true);
        // no slot sentinel survives
        for (const k of fills) {
            for (const slot of [FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT]) {
                expect(slot.slice(0, 3).every((c, i) => Math.abs(k[i] - c) < 0.002)).toBe(false);
            }
        }
        // and the source data is untouched (deep copy)
        expect(collectFills(FANCY_ANIMATIONS.light.data)
            .some(k => Math.abs(k[0] - FANCY_BASE_SLOT[0]) < 0.002)).toBe(true);
    });
});

describe('parseCssColor', () => {
    it('parses hex and rgb() forms to 0..1 triples', () => {
        expect(parseCssColor('#ff0000')).toEqual([1, 0, 0]);
        expect(parseCssColor('#f00')).toEqual([1, 0, 0]);
        expect(parseCssColor('rgb(0, 128, 255)')).toEqual([0, 128 / 255, 1]);
        expect(parseCssColor('rgba(255, 255, 255, 0.5)')).toEqual([1, 1, 1]);
        expect(parseCssColor('var(--nope)')).toBe(null);
        expect(parseCssColor('')).toBe(null);
    });
});

// ── the player, against a scripted fake instance ─────────────────────────────

function fakeLottie() {
    const factory = {
        loadAnimation(opts) {
            const inst = {
                opts, loop: false, destroyed: false, _listeners: {},
                calls: [],
                addEventListener(ev, cb) { (this._listeners[ev] ??= []).push(cb); },
                playSegments(seg) { this.calls.push(['playSegments', seg]); },
                goToAndStop(f) { this.calls.push(['goToAndStop', f]); },
                resetSegments() { this.calls.push(['resetSegments']); },
                destroy() { this.destroyed = true; },
                fireComplete() { (this._listeners.complete || []).forEach(cb => cb()); },
            };
            factory.last = inst;
            return inst;
        },
    };
    return factory;
}

const SPEC = {
    data: {v: '5.7.4', fr: 60, ip: 0, op: 100, layers: []},
    states: {off: [0, 1], on: [30, 90]},
    loops: ['on'],
    transitions: {'off>on': [0, 30]},
    seek: {travel: [0, 100]},
};

describe('FancyPlayer — segment model', () => {
    async function player() {
        const factory = fakeLottie();
        __setLottieFactoryForTests(factory);
        const p = new FancyPlayer();
        await p.mount(document.createElement('div'), SPEC);
        __setLottieFactoryForTests(null);
        return {p, inst: factory.last};
    }

    it('a forward transition plays its clip, then holds/loops the target', async () => {
        const {p, inst} = await player();
        p.goTo('off', {jump: true});
        inst.calls.length = 0;
        p.goTo('on');
        expect(inst.calls).toEqual([['playSegments', [0, 30]]]);
        inst.fireComplete();
        // 'on' is a loop → plays its segment with loop enabled
        expect(inst.loop).toBe(true);
        expect(inst.calls[1]).toEqual(['playSegments', [30, 90]]);
    });

    it('the reverse direction derives the clip by playing [b, a]', async () => {
        const {p, inst} = await player();
        p.goTo('on', {jump: true});
        inst.calls.length = 0;
        p.goTo('off');
        expect(inst.calls).toEqual([['playSegments', [30, 0]]]);
        inst.fireComplete();
        // 'off' is a pose → hold at its frame
        expect(inst.calls.some(([c]) => c === 'goToAndStop')).toBe(true);
    });

    it('a pair with no clip jump-cuts to the pose', async () => {
        const {p, inst} = await player();
        const spec = {...SPEC, transitions: {}};
        p.spec = spec;
        p.goTo('off', {jump: true});
        inst.calls.length = 0;
        p.goTo('on');
        // no transition → straight to the loop, no clip playback of [0,30]
        expect(inst.calls[0]).toEqual(['playSegments', [30, 90]]);
    });

    it('seek scrubs a fraction into the segment and never plays', async () => {
        const {p, inst} = await player();
        inst.calls.length = 0;
        p.seek('travel', 0.3);
        expect(inst.calls).toEqual([['resetSegments'], ['goToAndStop', 30]]);
        p.seek('travel', 2);   // clamped
        expect(inst.calls[3]).toEqual(['goToAndStop', 100]);
    });

    it('re-asking for the current state is a no-op (no restart every message)', async () => {
        const {p, inst} = await player();
        p.goTo('on', {jump: true});
        inst.calls.length = 0;
        p.goTo('on');
        expect(inst.calls).toEqual([]);
    });

    it('destroy tears the instance down', async () => {
        const {p, inst} = await player();
        p.destroy();
        expect(inst.destroyed).toBe(true);
        expect(p.live).toBe(false);
    });
});
