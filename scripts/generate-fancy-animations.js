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
const SURFACE = [0.993, 0.994, 0.995, 1]; // replaced with --primary-background-color (knobs, keyholes)

const FR = 60;   // frames/second — segment maths below is in frames

// ── tiny Lottie builders (the minimal, well-supported schema subset) ─────────

const st = v => ({a: 0, k: v});                                   // static value
const kf = frames => ({a: 1, k: frames.map(([t, s], i, arr) => ({
    t,
    s: Array.isArray(s) ? s : [s],
    ...(i < arr.length - 1 ? {i: {x: [0.42], y: [1]}, o: {x: [0.58], y: [0]}} : {}),
}))});                                                             // eased keyframes

const fill = (slot, o = 100) => ({ty: 'fl', c: st(slot === 'active' ? ACTIVE : slot === 'surface' ? SURFACE : BASE), o: st(o), r: 1, nm: 'fill-' + slot});
const rect = (x, y, w, h, r = 0) => ({ty: 'rc', p: st([x, y]), s: st([w, h]), r: st(r), nm: 'rect'});
const ellipse = (x, y, w, h) => ({ty: 'el', p: st([x, y]), s: st([w, h]), nm: 'ellipse'});

/** Closed path from [x,y] vertices (straight edges). */
const poly = points => ({ty: 'sh', ks: st({
    c: true,
    v: points,
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
}), nm: 'poly'});

/** Group transform — anchor/position let a group rotate around a hinge; the
 * anchor itself may be keyframed (kept identical to p, so switching it between
 * clips — swing hinge vs tilt hinge — never shifts the artwork); sk/sa add the
 * shear that fakes perspective on a swinging sash. */
const tr = ({p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100, sk = 0, sa = 0} = {}) =>
    ({ty: 'tr', p: typeof p.a === 'number' ? p : st(p),
        a: typeof a.a === 'number' ? a : st(a),
        s: typeof s.a === 'number' ? s : st(s),
        r: typeof r === 'object' ? r : st(r),
        o: typeof o === 'object' ? o : st(o),
        sk: typeof sk === 'object' ? sk : st(sk), sa: st(sa), nm: 'tr'});

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
        data: anim('light', [layer('light', [bulb, socket, glow], {op: 191})], 191),
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
    if (variant === 'window') return windowContact();
    // stroke frame (fill would be a plate ON TOP of the sash - AE z-order)
    const frame = group('frame', [rect(50, 50, 76, 76, 4), stroke('base', 7)]);
    let moving;
    let op = 25;
    const transitions = {'closed>open': [0, 24]};
    const states = {closed: [0, 1], open: [24, 25]};
    if (variant === 'garagedoor') {
        // panel slides up: y 50 → 18
        moving = group('panel', [rect(0, 0, 58, 58, 2), fill('active')],
            tr({p: kf([[0, [50, 50]], [24, [50, 18]]]), a: [0, 0]}));
    } else {
        // door: sash rotates around its LEFT edge (anchor at x=-29 of the box)
        moving = group('sash', [rect(29, 0, 58, 58, 2), fill('active')],
            tr({p: [21, 50], a: [0, 0], r: kf([[0, 0], [24, -55]])}));
    }
    return {
        data: anim('contact-' + variant, [layer('contact', [frame, moving], {op})], op),
        states, transitions,
    };
}

/**
 * window — a German Dreh-Kipp window in mock perspective (viewed from the
 * hinge side, the free edge farther away). Fensterrahmen = outer stroke quad;
 * Flügel = inner stroke quad (the gap between the two strokes is the divider);
 * glass = half-transparent active-tone pane. The handle sits on the free edge
 * and turns BEFORE the sash moves — closed = down, open = left (90°),
 * tilted = up (180°) — and because the player derives reverse clips by playing
 * [b, a], closing runs sash-first-handle-last, exactly like the real thing.
 *   0–12  handle down→left    12–36 sash swings open (rotation around the
 *                                   hinge + foreshorten + y-shear = perspective)
 *   48–62 handle down→up      62–85 sash tilts (Kipp: bottom-anchored squash,
 *                                   slightly widened top edge toward the viewer)
 * The sash transform's anchor/position pair is keyframed IDENTICALLY (swing
 * hinge at the left edge, tilt hinge at the bottom) so the anchor hand-over
 * between the two clips never shifts the artwork.
 */
function windowContact() {
    const paK = kf([[0, [21, 50]], [47, [21, 50]], [48, [49.5, 76.5]], [85, [49.5, 76.5]]]);
    const frame = group('frame', [
        poly([[14, 14], [84, 20], [84, 80], [14, 86]]), stroke('base', 4.5),
    ]);
    // handle: rounded lever rotating around its pivot on the free edge
    const lever = group('lever', [rect(0, 5.5, 2.8, 10, 1.4), fill('base')],
        tr({p: [71.5, 50.5], r: kf([[0, 0], [12, 90], [47, 90], [48, 0], [62, 180], [85, 180]])}));
    const plate = group('plate', [ellipse(71.5, 50.5, 5, 5), fill('base')]);
    const sashFrame = group('sash-frame', [
        poly([[21.5, 21.5], [77.5, 26.5], [77.5, 74.5], [21.5, 78.5]]), stroke('base', 3),
    ]);
    const glass = group('glass', [
        poly([[24.5, 24.5], [74.5, 29.5], [74.5, 71.5], [24.5, 75.5]]), fill('active', 38),
    ]);
    const sash = group('sash', [lever, plate, sashFrame, glass], tr({
        p: paK, a: paK, sa: 90,
        r:  kf([[0, 0], [12, 0], [36, -24], [47, -24], [48, 0], [85, 0]]),
        sk: kf([[0, 0], [12, 0], [36, -10], [47, -10], [48, 0], [85, 0]]),
        s:  kf([[0, [100, 100]], [12, [100, 100]], [36, [70, 106]], [47, [70, 106]],
            [48, [100, 100]], [62, [100, 100]], [85, [104, 78]]]),
    }));
    return {
        data: anim('contact-window', [layer('contact', [sash, frame], {op: 87})], 87),
        states: {closed: [0, 1], open: [36, 37], tilted: [85, 86]},
        transitions: {'closed>open': [0, 36], 'closed>tilted': [48, 85]},
    };
}

/**
 * cover — frame (base) + blind (active) travelling top→down.
 * One seek segment: 0 = fully open (blind up), 100 frames = fully closed.
 */
function cover() {
    const frame = group('frame', [rect(50, 50, 76, 76, 4), stroke('base', 7)]);
    const blindH = kf([[0, [64, 6]], [100, [64, 64]]]);
    // rc scales from its centre — animate position downward in step with size
    const blindY = kf([[0, [50, 21]], [100, [50, 50]]]);
    const blind = group('blind', [
        {ty: 'rc', p: {a: 1, k: blindY.k}, s: {a: 1, k: blindH.k}, r: st(2), nm: 'rect'},
        fill('active'),
    ]);
    return {
        data: anim('cover', [layer('cover', [frame, blind], {op: 101})], 101),
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
        data: anim('sensor', [layer('sensor', [bang, tri, ring], {op: 71})], 71),
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
    const keyhole = group('keyhole', [ellipse(50, 62, 10, 10), rect(50, 72, 4, 10, 2), fill('surface')]);
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
    const lay = layer('lock', [keyhole, body, shackle], {op: 79, ks: {r: shake}});
    return {
        data: anim('lock', [lay], 79),
        states: {locked: [0, 1], unlocked: [24, 25], jammed: [48, 78]},
        loops: ['jammed'],
        transitions: {'locked>unlocked': [0, 24]},
    };
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Reference-grade motion vocabulary (E162)
//
// Derived from a user-supplied LottieFiles success animation ("exactly what i
// mean when i say fancy") — four techniques, no artwork: trim-path draw-ons,
// a staggered particle burst with CURVED flight paths, aggressive
// launch-and-drift easing, and a real multi-colour palette. The parameters
// below are scaled from that reference (launch ≈ 37 % of comp, ~40-frame
// flights, 1-frame pop-in, 10-frame fade-out, ease x:0 y:1) rather than
// invented — copying the numbers of good motion beats inventing them blind.
// Technique/parameters only; the shapes and code are our own.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) — re-running the generator is a stable diff. */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The reference's launch-and-drift ease: violent start, long deceleration.
const POP = {i: {x: [0], y: [1]}, o: {x: [0.167], y: [0.167]}};

/** Keyframes with per-frame options ({e: easeOverride, to, ti} — spatial tangents). */
const kfx = frames => ({a: 1, k: frames.map(([t, s, opts], i, arr) => ({
    t,
    s: Array.isArray(s) ? s : [s],
    ...(i < arr.length - 1 ? (opts && opts.e ? opts.e : {i: {x: [0.42], y: [1]}, o: {x: [0.58], y: [0]}}) : {}),
    ...(opts && opts.to ? {to: opts.to, ti: opts.ti} : {}),
}))});

const stroke = (slotOrRgba, w, o = 100) => ({ty: 'st',
    c: st(Array.isArray(slotOrRgba) ? slotOrRgba : (slotOrRgba === 'active' ? ACTIVE : BASE)),
    o: typeof o === 'object' ? o : st(o), w: st(w), lc: 2, lj: 2, bm: 0, nm: 'stroke'});

/** Trim-path animator — the draw-on technique (ring wipes, tick draw). */
const trim = (eFrames, sFrames = null) => ({ty: 'tm',
    s: sFrames ? kfx(sFrames) : st(0),
    e: kfx(eFrames), o: st(0), m: 1, nm: 'trim'});

// The reference confetti palette (rgba 0..1) — deliberately NOT theme slots:
// flourish particles keep their own colours (E162: looking great beats
// auto-retinting); recolorAnimation passes non-slot fills through untouched.
const FX = [
    [0, 0.631, 1, 1],        // cyan
    [0, 1, 0.784, 1],        // teal
    [0.961, 0.706, 0.004, 1],// amber
    [0.024, 0.737, 0.361, 1],// green
    [1, 0.294, 0.239, 1],    // red
    [1, 0, 0.365, 1],        // pink
];

/** A 4-spike sparkle star (the reference's plus-star, as an 8-vertex polygon). */
function sparklePath(r) {
    const points = [];
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.38;
        points.push([+(Math.cos(a) * rad).toFixed(2), +(Math.sin(a) * rad).toFixed(2)]);
    }
    return poly(points);
}

/**
 * A confetti burst, reference-parameterised: `count` particles from `origin`,
 * launched at frame `t0`, flying `dur` frames along CURVED paths (spatial
 * bezier tangents), spinning, popping in over 1 frame and fading over the
 * last 10. Mixed shapes (spinning rects, dots, sparkle stars, arcs) in the
 * FX palette. Deterministic via `seed`.
 */
function confettiBurst({origin: [ox, oy], count, t0, dur = 40, dist = 34, seed, scale = 1}) {
    const rand = rng(seed);
    const groups = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand() * 0.6;
        const d = dist * (0.7 + rand() * 0.6) * scale;
        const tx = ox + Math.cos(angle) * d;
        const ty = oy + Math.sin(angle) * d;
        // curved flight: the out-tangent leans ~30° off the straight line
        const bend = (rand() - 0.5) * 0.9;
        const to = [+(Math.cos(angle + bend) * d * 0.55).toFixed(2), +(Math.sin(angle + bend) * d * 0.55).toFixed(2)];
        const ti = [+(-Math.cos(angle) * d * 0.3).toFixed(2), +(-Math.sin(angle) * d * 0.3).toFixed(2)];
        const color = FX[i % FX.length];
        const size = (2.2 + rand() * 2.6) * scale;
        const kind = i % 4;
        let items;
        if (kind === 0) {          // spinning square
            items = [rect(0, 0, size * 1.6, size * 1.6, 0.5), {ty: 'fl', c: st(color), o: st(100), r: 1, nm: 'fill-fx'}];
        } else if (kind === 1) {   // dot
            items = [ellipse(0, 0, size * 1.5, size * 1.5), {ty: 'fl', c: st(color), o: st(100), r: 1, nm: 'fill-fx'}];
        } else if (kind === 2) {   // sparkle star
            items = [sparklePath(size * 1.4), {ty: 'fl', c: st(color), o: st(100), r: 1, nm: 'fill-fx'}];
        } else {                   // open arc (stroked u)
            items = [{ty: 'sh', ks: st({c: false,
                v: [[size, -size / 2], [0, size / 2], [-size, -size / 2]],
                i: [[0, -size / 2], [size / 2, 0], [0, 0]],
                o: [[0, 0], [-size / 2, 0], [0, -size / 2]]}), nm: 'arc'},
            stroke(color, Math.max(1, size * 0.45))];
        }
        const t1 = t0 + Math.round(dur * (0.92 + rand() * 0.16));
        const spin = Math.round((rand() - 0.5) * 900);
        groups.push(group(`fx-${i}`, items, {ty: 'tr',
            p: kfx([[t0, [ox, oy], {e: POP, to, ti}], [t1, [tx, ty]]]),
            a: st([0, 0]), s: st([100, 100]),
            r: kfx([[t0, 0, {e: POP}], [t1, spin]]),
            o: kfx([[t0 - 1, 0], [t0, 100], [t1 - 10, 100, {}], [t1, 0]]),
            nm: 'tr'}));
    }
    return groups;
}

/**
 * switch — the E162 proof piece, reference-derived (user-supplied success
 * animation): a toggle whose ON is a celebration and whose OFF is a
 * satisfying power-down.
 *
 *  off pose [0,1]      knob left, base track
 *  off>on  [10,100]    knob slides right with OVERSHOOT (38→64.5→62), the
 *                      active track fades in, a radial trim-path WIPE flashes
 *                      from the knob, then a two-burst multi-colour CONFETTI
 *                      explosion (24 particles, curved flights, spins) — the
 *                      reference choreography, scaled to the 100×100 comp
 *  on pose [100,101]   knob right, active track
 *  on>off  [110,150]   an imploding ring SHRINKS into the knob while the
 *                      track drains, the knob slides home and lands with a
 *                      little squash — shrink-down, per the request
 */
function switchToggle() {
    // knob x across the whole timeline (both transitions live on one track)
    const knobX = kfx([
        [0, [38, 45]],
        [10, [38, 45], {e: POP}], [19, [64.5, 45], {}], [23, [62, 45]],
        [110, [62, 45], {e: POP}], [122, [36, 45], {}], [127, [38, 45]],
    ]);
    const knobSquash = kfx([
        [0, [100, 100]],
        [121, [100, 100], {e: POP}], [125, [118, 84]], [131, [100, 100]],
    ]);
    const knob = group('knob', [
        ellipse(0, 0, 16, 16), fill('surface'),
    ], {ty: 'tr', p: knobX, a: st([0, 0]), s: knobSquash, r: st(0), o: st(100), nm: 'tr'});

    const track = group('track', [rect(50, 45, 44, 20, 10), fill('base')]);
    const trackOn = group('track-on', [rect(50, 45, 44, 20, 10), fill('active')],
        {ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0),
            o: kfx([[0, 0], [10, 0, {}], [20, 100, {}], [111, 100, {e: POP}], [131, 0]]), nm: 'tr'});

    // the radial flash: a fat stroke swept angularly by a trim path (the
    // reference's disc-wipe technique — stroke width == diameter)
    const wipe = group('wipe', [
        ellipse(0, 0, 26, 26),
        stroke('active', 26, kfx([[0, 0], [19, 0, {}], [20, 35, {}], [46, 35, {}], [58, 0]])),
        trim([[20, 0, {e: POP}], [52, 100]]),
    ], {ty: 'tr', p: st([62, 45]), a: st([0, 0]), s: st([100, 100]), r: st(-90), o: st(100), nm: 'tr'});

    // shrink-down: a thin ring imploding into the knob on off-switching
    const shrink = group('shrink', [
        ellipse(0, 0, 30, 30),
        stroke('active', 2.5, kfx([[0, 0], [109, 0, {}], [110, 70, {}], [132, 70, {}], [140, 0]])),
    ], {ty: 'tr', p: st([50, 45]), a: st([0, 0]),
        s: kfx([[110, [150, 150], {e: POP}], [138, [8, 8]]]),
        r: st(0), o: st(100), nm: 'tr'});

    const confetti = [
        ...confettiBurst({origin: [62, 45], count: 14, t0: 24, dur: 42, dist: 32, seed: 20260728}),
        ...confettiBurst({origin: [62, 45], count: 9, t0: 30, dur: 38, dist: 26, seed: 4711, scale: 0.62}),
    ];

    return {
        data: anim('switch', [layer('switch', [...confetti, wipe, shrink, knob, trackOn, track], {op: 151})], 151),
        states: {off: [0, 1], on: [100, 101]},
        transitions: {'off>on': [10, 100], 'on>off': [110, 150]},
        // flourish particles carry their OWN palette (E162: looking great
        // beats auto-retinting) — declared so the palette-contract test can
        // tell deliberate colour from drift.
        palette: FX,
    };
}

const ANIMATIONS = {
    'light': light(),
    'switch': switchToggle(),
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
export const FANCY_SURFACE_SLOT = ${JSON.stringify(SURFACE)};

export const FANCY_ANIMATIONS = `;

const out = path.join(__dirname, '..', 'www', 'packages', '@feezal', 'feezal-elements-fancy', 'animations.js');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, HEADER + JSON.stringify(ANIMATIONS, null, 0) + ';\n');

const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`animations.js written (${Object.keys(ANIMATIONS).length} animations, ${kb} kB)`);
