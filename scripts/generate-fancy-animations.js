#!/usr/bin/env node
/**
 * E139 — generator for the Fancy family's built-in Lottie animations.
 *
 * The default animation set is SELF-AUTHORED, programmatically: Lottie is
 * plain JSON (shape layers + keyframed transforms), and the family's chosen
 * style tier — filled flat duotone — is authorable in code. MIT-clean by
 * construction, no third-party asset licensing, reproducible and tweakable:
 * edit this script, re-run it, commit the regenerated module.
 *
 *     node scripts/generate-fancy-animations.js
 *
 * writes `www/packages/@feezal/feezal-elements-fancy/animations.js` — a JS
 * module exporting FANCY_ANIMATIONS: per card one Lottie JSON plus its
 * segment map (state poses, directional transitions, seek/loop segments).
 *
 * ## The two-tone palette contract
 *
 * Every fill uses exactly one of two SLOT colours (recognizable sentinel
 * values, not real design colours). At runtime `recolorAnimation()` in
 * fancy-shared.js deep-replaces them with the RESOLVED canonical theme vars
 * (lottie-web needs concrete colours):
 *   BASE   → --secondary-text-color   (chrome, outlines, bodies)
 *   ACTIVE → --primary-color / --error-color (state-dependent accents)
 * The generator enforces the contract by construction: `fill()` only accepts
 * the two slot names.
 *
 * ## The segment model
 *
 * `states`      — name → [frame, frame]: a pose (single frame, held) or a
 *                 loop segment (played on repeat while in that state).
 * `transitions` — 'from>to' → [a, b]: a directional clip. The player derives
 *                 the reverse ('to>from') by playing [b, a]; a pair with no
 *                 clip (directly or reversed) falls back to a jump-cut.
 * `seek`        — one segment scrubbed by a 0..1 fraction (cover position,
 *                 light brightness) instead of played.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── the two palette slots (sentinels — see contract above) ───────────────────
const BASE = [0.437, 0.451, 0.471, 1];    // replaced with --secondary-text-color
const ACTIVE = [0.129, 0.588, 0.953, 1];  // replaced with --primary-color / --error-color

const FR = 60;   // frames/second — segment maths below is in frames

// ── tiny Lottie builders (the minimal, well-supported schema subset) ─────────

const st = v => ({a: 0, k: v});                                   // static value
const kf = frames => ({a: 1, k: frames.map(([t, s], i, arr) => ({
    t,
    s: Array.isArray(s) ? s : [s],
    ...(i < arr.length - 1 ? {i: {x: [0.42], y: [1]}, o: {x: [0.58], y: [0]}} : {}),
}))});                                                             // eased keyframes

const fill = slot => ({ty: 'fl', c: st(slot === 'active' ? ACTIVE : BASE), o: st(100), r: 1, nm: 'fill-' + slot});
const rect = (x, y, w, h, r = 0) => ({ty: 'rc', p: st([x, y]), s: st([w, h]), r: st(r), nm: 'rect'});
const ellipse = (x, y, w, h) => ({ty: 'el', p: st([x, y]), s: st([w, h]), nm: 'ellipse'});

/** Closed path from [x,y] vertices (straight edges). */
const poly = points => ({ty: 'sh', ks: st({
    c: true,
    v: points,
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
}), nm: 'poly'});

/** Group transform — anchor/position let a group rotate around a hinge. */
const tr = ({p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100} = {}) =>
    ({ty: 'tr', p: typeof p.a === 'number' ? p : st(p), a: st(a),
        s: typeof s.a === 'number' ? s : st(s),
        r: typeof r === 'object' ? r : st(r),
        o: typeof o === 'object' ? o : st(o), nm: 'tr'});

const group = (name, items, transform = tr()) => ({ty: 'gr', it: [...items, transform], nm: name});

/** One shape layer holding the given groups. */
function layer(name, shapes, {ind = 1, op = 300, ks = {}} = {}) {
    return {
        ddd: 0, ind, ty: 4, nm: name, sr: 1,
        ks: {o: st(100), r: st(0), p: st([50, 50, 0]), a: st([50, 50, 0]), s: st([100, 100, 100]), ...ks},
        ao: 0, shapes, ip: 0, op, st: 0, bm: 0,
    };
}

/** A complete animation document (100×100 comp). */
function anim(name, layers, op) {
    return {v: '5.7.4', fr: FR, ip: 0, op, w: 100, h: 100, nm: 'fancy-' + name, ddd: 0, assets: [], layers};
}

// ─────────────────────────────────────────────────────────────────────────────
// The cards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * light — bulb (base) + glow (active).
 * 0–30 off→on (glow grows in), 30–90 breathing loop, 90–120 on→off,
 * 130–190 brightness seek segment (glow ∝ brightness, scrubbed not played).
 */
function light() {
    const bulb = group('bulb', [
        ellipse(50, 44, 34, 34), fill('base'),
    ]);
    const socket = group('socket', [
        rect(50, 68, 14, 10, 2), rect(50, 76, 10, 4, 2), fill('base'),
    ]);
    const glowScale = kf([[0, [0, 0]], [30, [100, 100]], [50, [108, 108]], [70, [100, 100]],
        [90, [100, 100]], [120, [0, 0]],
        [130, [30, 30]], [190, [120, 120]]]);
    const glowOpacity = kf([[0, 0], [30, 65], [90, 65], [120, 0], [130, 30], [190, 80]]);
    const glow = group('glow', [
        ellipse(0, 0, 56, 56), fill('active'),
    ], tr({p: [50, 44], s: glowScale, o: glowOpacity}));
    return {
        data: anim('light', [layer('light', [glow, bulb, socket], {op: 191})], 191),
        states: {off: [0, 1], on: [30, 90]},
        loops: ['on'],
        transitions: {'off>on': [0, 30], 'on>off': [90, 120]},
        seek: {brightness: [130, 190]},
    };
}

/**
 * contact — frame (base) + sash/panel (active while open).
 * Variants share the geometry helper; the sash rotates around its hinge.
 *  window: swing −40° (0–24) and tilt −14° around the bottom (48–72)
 *  door:   swing −55° (0–24)
 *  garagedoor: panel slides up (0–24)
 */
function contactVariant(variant) {
    const frame = group('frame', [rect(50, 50, 76, 76, 4), fill('base')]);
    const inner = group('inner', [rect(50, 50, 60, 60, 2),
        {ty: 'fl', c: st([1, 1, 1, 1]), o: st(0), r: 1, nm: 'fill-hole'}]);
    let moving;
    let op = 73;
    const transitions = {};
    const states = {closed: [0, 1], open: [24, 25]};
    if (variant === 'garagedoor') {
        // panel slides up: y 50 → 18
        moving = group('panel', [rect(0, 0, 58, 58, 2), fill('active')],
            tr({p: kf([[0, [50, 50]], [24, [50, 18]]]), a: [0, 0]}));
        transitions['closed>open'] = [0, 24];
        op = 25;
    } else {
        const swing = variant === 'door' ? -55 : -40;
        // sash rotates around its LEFT edge (anchor at x=-29 of the sash box)
        const rot = variant === 'window'
            ? kf([[0, 0], [24, swing], [48, 0], [72, 0]])
            : kf([[0, 0], [24, swing]]);
        const sashItems = [rect(29, 0, 58, 58, 2), fill('active')];
        moving = group('sash', sashItems, tr({p: [21, 50], a: [0, 0], r: rot}));
        transitions['closed>open'] = [0, 24];
        if (variant === 'window') {
            // tilt: the whole sash leans back — modelled as a vertical squash
            // toward the bottom edge (anchor at the bottom), 48–72
            const tilt = group('sash-tilt', [rect(0, -29, 58, 58, 2), fill('active')],
                tr({p: [50, 79], a: [0, 29], s: kf([[48, [100, 100]], [72, [100, 74]]]),
                    o: kf([[0, 0], [47, 0], [48, 100], [72, 100]])}));
            // hide the swing sash during the tilt clip
            moving.it[moving.it.length - 1].o = kf([[0, 100], [47, 100], [48, 0], [72, 0]]);
            states.tilted = [72, 73];
            transitions['closed>tilted'] = [48, 72];
            return {
                data: anim('contact-' + variant, [layer('contact', [frame, inner, tilt, moving], {op})], op),
                states, transitions,
            };
        }
        op = 25;
    }
    return {
        data: anim('contact-' + variant, [layer('contact', [frame, inner, moving], {op})], op),
        states, transitions,
    };
}

/**
 * cover — frame (base) + blind (active) travelling top→down.
 * One seek segment: 0 = fully open (blind up), 100 frames = fully closed.
 */
function cover() {
    const frame = group('frame', [rect(50, 50, 76, 76, 4), fill('base')]);
    const blindH = kf([[0, [64, 6]], [100, [64, 64]]]);
    // rc scales from its centre — animate position downward in step with size
    const blindY = kf([[0, [50, 21]], [100, [50, 50]]]);
    const blind = group('blind', [
        {ty: 'rc', p: {a: 1, k: blindY.k}, s: {a: 1, k: blindH.k}, r: st(2), nm: 'rect'},
        fill('active'),
    ]);
    return {
        data: anim('cover', [layer('cover', [blind, frame], {op: 101})], 101),
        states: {},
        transitions: {},
        seek: {travel: [0, 100]},
    };
}

/**
 * climate — radiator (base) + rising heat waves (active) looping while heating.
 */
function climate() {
    const fins = [];
    for (let i = 0; i < 4; i++) {
        fins.push(group('fin' + i, [rect(26 + i * 16, 62, 10, 34, 4), fill('base')]));
    }
    // three heat bars rising + fading, staggered — a simple, readable "heat" loop
    const waves = [0, 1, 2].map(i => {
        const x = 34 + i * 16;
        const d = i * 8;
        return group('wave' + i, [ellipse(0, 0, 7, 16), fill('active')],
            tr({p: kf([[10 + d, [x, 40]], [58 + d, [x, 16]]]),
                o: kf([[0, 0], [9 + d, 0], [10 + d, 90], [46 + d, 90], [58 + d, 0]])}));
    });
    return {
        data: anim('climate', [layer('climate', [...waves, ...fins], {op: 75})], 75),
        states: {idle: [0, 1], heating: [10, 74]},
        loops: ['heating'],
        transitions: {},
    };
}

/**
 * sensor (alarm slice) — alert triangle (base, bang in active) + pulse ring
 * (active) looping while triggered.
 */
function sensor() {
    const tri = group('triangle', [poly([[50, 26], [78, 74], [22, 74]]), fill('base')]);
    const bang = group('bang', [rect(50, 52, 6, 16, 3), rect(50, 66, 6, 6, 3), fill('active')]);
    const ring = group('ring', [ellipse(0, 0, 60, 60), fill('active')],
        tr({p: [50, 54],
            s: kf([[10, [60, 60]], [70, [130, 130]]]),
            o: kf([[0, 0], [9, 0], [10, 45], [70, 0]])}));
    return {
        data: anim('sensor', [layer('sensor', [ring, tri, bang], {op: 71})], 71),
        states: {clear: [0, 1], active: [10, 70]},
        loops: ['active'],
        transitions: {},
    };
}

/**
 * lock — body (base) + shackle (active when unlocked): the shackle lifts and
 * swings open 0–24; jammed = a shake loop.
 */
function lock() {
    const body = group('body', [rect(50, 64, 52, 40, 6), fill('base')]);
    const keyhole = group('keyhole', [ellipse(50, 62, 10, 10), rect(50, 72, 4, 10, 2),
        {ty: 'fl', c: st([1, 1, 1, 1]), o: st(0), r: 1, nm: 'fill-hole'}]);
    // Shackle: a ∩ of two rects (flat-duotone approximation) that lifts (y) and
    // swings (r around the right leg) when unlocking.
    const shackle = group('shackle', [
        rect(-14, -14, 8, 34, 4), rect(14, -14, 8, 34, 4), rect(0, -28, 36, 8, 4),
        fill('active'),
    ], tr({p: kf([[0, [50, 44]], [12, [50, 34]], [24, [50, 34]]]),
        a: [14, 0],
        r: kf([[0, 0], [12, 0], [24, 28]])}));
    // jam shake: the whole comp wiggles 48–78
    const shake = kf([[48, 0], [52, -4], [58, 4], [64, -4], [70, 4], [78, 0]]);
    const lay = layer('lock', [shackle, body, keyhole], {op: 79, ks: {r: shake}});
    return {
        data: anim('lock', [lay], 79),
        states: {locked: [0, 1], unlocked: [24, 25], jammed: [48, 78]},
        loops: ['jammed'],
        transitions: {'locked>unlocked': [0, 24]},
    };
}

// ─────────────────────────────────────────────────────────────────────────────

const ANIMATIONS = {
    'light': light(),
    'contact-window': contactVariant('window'),
    'contact-door': contactVariant('door'),
    'contact-generic': contactVariant('door'),
    'contact-garagedoor': contactVariant('garagedoor'),
    'cover': cover(),
    'climate': climate(),
    'sensor': sensor(),
    'lock': lock(),
};

const HEADER = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/generate-fancy-animations.js
 *
 * The Fancy family's built-in Lottie set (E139): self-authored flat-duotone
 * animations. Every fill is one of two palette SLOT colours; fancy-shared's
 * recolorAnimation() substitutes the resolved theme tones at runtime.
 */

/** The palette slots the generator writes (rgba, 0..1). */
export const FANCY_BASE_SLOT = ${JSON.stringify(BASE)};
export const FANCY_ACTIVE_SLOT = ${JSON.stringify(ACTIVE)};

export const FANCY_ANIMATIONS = `;

const out = path.join(__dirname, '..', 'www', 'packages', '@feezal', 'feezal-elements-fancy', 'animations.js');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, HEADER + JSON.stringify(ANIMATIONS, null, 0) + ';\n');

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`animations.js written (${Object.keys(ANIMATIONS).length} animations, ${kb} kB)`);
