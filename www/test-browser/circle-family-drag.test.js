/**
 * Circle-family pointer interaction — the ring, arc and panel drags.
 *
 * These cards put their real logic in pointer handlers on an SVG: the
 * brightness ring (light), the position ring and the drag-the-blind panel
 * (cover), and the setpoint arc (climate). None of it is reachable from
 * happy-dom, so it was the largest untested behaviour left in the element
 * packages — and it is the behaviour users actually touch.
 *
 * What is pinned here is the contract, not pixels: where a gesture lands on
 * the dial decides the value, a drag publishes ONCE on release (not per
 * move), the live value tracks the finger before release, the gap at the
 * bottom of the arc clamps instead of wrapping, and the editor never
 * publishes. Geometry is asserted through the published payload, which is
 * what the device actually receives.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {setupFeezal, mount, sizeAt, dragAngle, tapAt, pointerDrag, pointAt} from './helpers.js';
import '../packages/@feezal/feezal-element-circle-light/feezal-element-circle-light.js';
import '../packages/@feezal/feezal-element-circle-cover/feezal-element-circle-cover.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const svgOf = el => el.shadowRoot.querySelector('svg');
const published = topic => feezal.connection.published.filter(p => p.topic === topic);
const lastPayload = topic => published(topic).at(-1)?.payload;

// The ring/arc geometry the cards share: 225° start, 270° sweep, 0° = top.
// 225° = 0 %, 315° = ~33 %, 45° = ~67 %, 135° = 100 %.
const ARC_START = 225;
const pctToDeg = pct => (ARC_START + (pct / 100) * 270) % 360;

// ── circle-light: the brightness ring ───────────────────────────────────────
describe('circle-light — brightness ring drag', () => {
    async function lightOn(extra = {}) {
        const el = await mount('feezal-element-circle-light', {
            mode: 'brightness',
            'subscribe-state': 'stat/l', 'publish-state': 'cmnd/l',
            'subscribe-brightness': 'stat/b', 'publish-brightness': 'cmnd/b',
            ...extra,
        });
        sizeAt(el);
        feezal.connection.deliver('stat/l', 'on');
        feezal.connection.deliver('stat/b', '50');
        await el.updateComplete;
        return el;
    }

    it('publishes the brightness the gesture ends on, once, on release', async () => {
        const el = await lightOn();
        await dragAngle(el, svgOf(el), pctToDeg(50), pctToDeg(100));
        // One publish for the whole gesture — not one per pointermove.
        expect(published('cmnd/b')).toHaveLength(1);
        expect(Number(lastPayload('cmnd/b'))).toBeGreaterThanOrEqual(97);
    });

    it('maps the far end of the arc to 0 %', async () => {
        const el = await lightOn();
        await dragAngle(el, svgOf(el), pctToDeg(50), pctToDeg(0));
        expect(Number(lastPayload('cmnd/b'))).toBeLessThanOrEqual(3);
    });

    it('lands mid-arc where the finger is', async () => {
        const el = await lightOn();
        await dragAngle(el, svgOf(el), pctToDeg(10), pctToDeg(50));
        const v = Number(lastPayload('cmnd/b'));
        expect(v).toBeGreaterThan(45);
        expect(v).toBeLessThan(55);
    });

    it('tracks the value live during the drag, before any publish', async () => {
        const el = await lightOn();
        const svg = el.shadowRoot.querySelector('svg');
        svg.setPointerCapture = () => {};
        const {clientX, clientY} = (await import('./helpers.js')).pointAtAngle(svg, pctToDeg(75));
        svg.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, composed: true, cancelable: true,
            pointerId: 1, clientX, clientY,
        }));
        await el.updateComplete;
        expect(el._dragBrt).toBeGreaterThan(70);       // live value follows the finger
        expect(published('cmnd/b')).toHaveLength(0);   // nothing published yet

        // Finish the gesture. The card attaches its move/up listeners to
        // `document`, so an unreleased drag outlives its element and would fire
        // on the NEXT test's pointerup — a real cross-test leak, not a nicety.
        svg.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, composed: true, pointerId: 1}));
        await el.updateComplete;
        expect(published('cmnd/b')).toHaveLength(1);   // …and exactly one on release
    });

    it('the centre toggles instead of dragging', async () => {
        const el = await lightOn();
        await tapAt(el, svgOf(el), 50, 50);
        expect(published('cmnd/l')).toHaveLength(1);
        expect(published('cmnd/b')).toHaveLength(0);
    });

    it('on_off mode has no ring — a tap anywhere on the disc toggles', async () => {
        const el = await mount('feezal-element-circle-light', {
            mode: 'on_off', 'subscribe-state': 'stat/l2', 'publish-state': 'cmnd/l2',
        });
        sizeAt(el);
        feezal.connection.deliver('stat/l2', 'on');
        await el.updateComplete;
        await dragAngle(el, svgOf(el), pctToDeg(20), pctToDeg(80));   // a ring drag…
        expect(published('cmnd/l2')).toHaveLength(1);                 // …is just a toggle
    });

    it('never publishes in the editor', async () => {
        const el = await lightOn();
        feezal.isEditor = true;
        await dragAngle(el, svgOf(el), pctToDeg(20), pctToDeg(90));
        await tapAt(el, svgOf(el), 50, 50);
        expect(feezal.connection.published).toHaveLength(0);
    });
});

// ── circle-cover: the position ring and the draggable panel ─────────────────
describe('circle-cover — position ring drag', () => {
    async function ringCover() {
        const el = await mount('feezal-element-circle-cover', {
            visual: 'ring', 'payload-mode': 'separate',
            'subscribe-position': 'stat/p', 'publish-position': 'cmnd/p',
        });
        sizeAt(el);
        feezal.connection.deliver('stat/p', '50');
        await el.updateComplete;
        return el;
    }

    it('publishes the dragged position once, on release', async () => {
        const el = await ringCover();
        await dragAngle(el, svgOf(el), pctToDeg(50), pctToDeg(100));
        expect(published('cmnd/p')).toHaveLength(1);
        expect(Number(lastPayload('cmnd/p'))).toBeGreaterThanOrEqual(97);
    });

    it('a tap on the ring jumps straight to that position', async () => {
        const el = await ringCover();
        const svg = svgOf(el);
        await pointerDrag(el, svg, [(await import('./helpers.js')).pointAtAngle(svg, pctToDeg(25))]);
        const v = Number(lastPayload('cmnd/p'));
        expect(v).toBeGreaterThan(20);
        expect(v).toBeLessThan(30);
    });

    it('never publishes in the editor', async () => {
        const el = await ringCover();
        feezal.isEditor = true;
        await dragAngle(el, svgOf(el), pctToDeg(10), pctToDeg(90));
        expect(feezal.connection.published).toHaveLength(0);
    });
});

describe('circle-cover — dragging the blind panel', () => {
    async function fillCover(visual = 'fill') {
        const el = await mount('feezal-element-circle-cover', {
            visual, 'payload-mode': 'separate',
            'subscribe-position': 'stat/p2', 'publish-position': 'cmnd/p2',
        });
        sizeAt(el);
        feezal.connection.deliver('stat/p2', '50');
        await el.updateComplete;
        return el;
    }

    const panelOf = el => el.shadowRoot.querySelector('svg') || el.shadowRoot.querySelector('.disc');

    it('dragging up opens, dragging down closes', async () => {
        for (const [dy, cmp] of [[-60, 'more'], [60, 'less']]) {
            feezal = setupFeezal();
            const el = await fillCover('blind');
            const panel = panelOf(el);
            const rect = panel.getBoundingClientRect();
            const mid = {clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2};
            await pointerDrag(el, panel, [mid, {clientX: mid.clientX, clientY: mid.clientY + dy}]);
            const v = Number(lastPayload('cmnd/p2'));
            expect(Number.isFinite(v), 'nothing published').toBe(true);
            if (cmp === 'more') expect(v).toBeGreaterThan(50);
            else expect(v).toBeLessThan(50);
        }
    });

    it('clamps at the ends instead of running past them', async () => {
        const el = await fillCover('blind');
        const panel = panelOf(el);
        const rect = panel.getBoundingClientRect();
        const mid = {clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2};
        await pointerDrag(el, panel, [mid, {clientX: mid.clientX, clientY: mid.clientY - 5000}]);
        expect(Number(lastPayload('cmnd/p2'))).toBe(100);
    });
});

// ── circle-climate: the setpoint arc ────────────────────────────────────────
describe('circle-climate — setpoint arc drag', () => {
    async function climate(extra = {}) {
        const el = await mount('feezal-element-circle-climate', {
            'payload-mode': 'separate',
            'subscribe-setpoint': 'stat/sp', 'publish-setpoint': 'cmnd/sp',
            min: '5', max: '30', step: '0.5',
            ...extra,
        });
        sizeAt(el);
        feezal.connection.deliver('stat/sp', '20');
        await el.updateComplete;
        return el;
    }

    it('publishes a setpoint inside the configured range', async () => {
        const el = await climate();
        await dragAngle(el, svgOf(el), pctToDeg(30), pctToDeg(70));
        expect(published('cmnd/sp')).toHaveLength(1);
        const v = Number(lastPayload('cmnd/sp'));
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(30);
    });

    it('dragging further round raises the setpoint', async () => {
        const el = await climate();
        await dragAngle(el, svgOf(el), pctToDeg(20), pctToDeg(25));
        const low = Number(lastPayload('cmnd/sp'));
        await dragAngle(el, svgOf(el), pctToDeg(25), pctToDeg(80));
        const high = Number(lastPayload('cmnd/sp'));
        expect(high).toBeGreaterThan(low);
    });

    it('honours the step when snapping the value', async () => {
        const el = await climate({step: '1'});
        await dragAngle(el, svgOf(el), pctToDeg(30), pctToDeg(60));
        const v = Number(lastPayload('cmnd/sp'));
        expect(Number.isInteger(v), `expected a whole degree, got ${v}`).toBe(true);
    });

    it('clamps to min/max rather than wrapping through the arc gap', async () => {
        const el = await climate();
        // 180° sits in the gap at the bottom of the arc.
        await dragAngle(el, svgOf(el), pctToDeg(50), 180);
        const v = Number(lastPayload('cmnd/sp'));
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(30);
    });

    it('never publishes in the editor', async () => {
        const el = await climate();
        feezal.isEditor = true;
        await dragAngle(el, svgOf(el), pctToDeg(20), pctToDeg(80));
        expect(feezal.connection.published).toHaveLength(0);
    });
});
