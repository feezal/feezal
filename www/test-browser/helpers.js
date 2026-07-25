/**
 * Shared setup for browser-mode component tests.
 *
 * Elements talk to `feezal.connection` (a feezal-connection element at
 * runtime).  This stand-in implements the same sub/unsubscribe/pub surface as
 * an in-page message bus (exact topics + MQTT `+`/`#` wildcards, matching the
 * real connection's topicMatch) and records publishes for assertions.
 */

/** Minimal MQTT wildcard match: does subscription `sub` cover `topic`? */
function topicMatches(sub, topic) {
    if (sub === topic) return true;
    if (!/[+#]/.test(sub)) return false;
    const subParts = sub.split('/');
    const topicParts = topic.split('/');
    for (let i = 0; i < subParts.length; i++) {
        if (subParts[i] === '#') return true;
        if (i >= topicParts.length) return false;
        if (subParts[i] === '+') continue;
        if (subParts[i] !== topicParts[i]) return false;
    }
    return subParts.length === topicParts.length;
}

export function fakeConnection() {
    const subs = new Map();          // topic → Set<callback>
    const published = [];

    return {
        published,
        connected: true,
        sub(topic, options, callback) {
            if (typeof options === 'function') callback = options;
            if (!topic) return;
            if (!subs.has(topic)) subs.set(topic, new Set());
            subs.get(topic).add(callback);
            return {topic, callback};
        },
        unsubscribe(subscription) {
            if (!subscription) return;
            subs.get(subscription.topic)?.delete(subscription.callback);
        },
        pub(topic, payload) {
            published.push({topic, payload});
            this.deliver(topic, payload);
        },
        /** Simulate an incoming broker message (wildcards honoured). */
        deliver(topic, payload) {
            subs.forEach((callbacks, sub) => {
                if (topicMatches(sub, topic)) {
                    [...callbacks].forEach(cb => cb({topic, payload}));
                }
            });
        },
        /** Number of currently active subscriptions. */
        subCount() {
            let n = 0;
            subs.forEach(set => { n += set.size; });
            return n;
        }
    };
}

/** Fresh `feezal` global (viewer mode) + empty document body. */
export function setupFeezal(overrides = {}) {
    window.feezal = {
        isEditor: false,
        views: [],
        connection: fakeConnection(),
        ...overrides
    };
    document.body.innerHTML = '';
    return window.feezal;
}

/** Poll until fn() is truthy and return its value. For effects with
 * engine-dependent timing (ResizeObserver ticks, rAF animation frames) —
 * fixed setTimeout waits are flaky on slow CI runners, webkit especially. */
export async function until(fn, {timeout = 5000, interval = 10} = {}) {
    const start = performance.now();
    for (;;) {
        const value = fn();
        if (value) return value;
        if (performance.now() - start > timeout) {
            throw new Error(`until(): condition not met within ${timeout} ms`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
}

/** Create, configure and attach an element, then await its first render. */
export async function mount(tag, attributes = {}) {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        el.setAttribute(name, value);
    }
    document.body.append(el);
    await el.updateComplete;
    return el;
}

// ─── Circle-family pointer drags ────────────────────────────────────────────
// The circle cards (light brightness ring, cover position ring, climate
// setpoint arc, cover fill/blind panel) are driven entirely by pointer
// gestures on an SVG with a 0..100 viewBox centred at (50,50). That code is
// unreachable from happy-dom, and it is where each card keeps its real
// interaction logic — so these helpers exist to drive it for real in the
// browser suite.
//
// Three quirks the helpers absorb, all of which otherwise make such a test
// silently useless or throw:
//   1. setPointerCapture() rejects a synthetic pointerId. Two of the three
//      cards call it UNGUARDED, so it is stubbed on the target first.
//   2. The cards attach their move/up listeners either to `document` or to
//      the SVG itself. Dispatching on the SVG with bubbles:true reaches both.
//   3. Angles are measured 0° = top, clockwise — not the atan2 convention.

/** Give an element a deterministic on-screen box so client↔viewBox maths is exact. */
export function sizeAt(el, {left = 100, top = 100, size = 200} = {}) {
    el.style.cssText =
        `display:block;position:fixed;left:${left}px;top:${top}px;width:${size}px;height:${size}px;`;
    return el;
}

/** Client coords of a point on the 0..100 viewBox, by angle (0° = top, clockwise). */
export function pointAtAngle(svg, deg, r = 40) {
    const rect = svg.getBoundingClientRect();
    const rad = (deg - 90) * Math.PI / 180;
    const vx = 50 + r * Math.cos(rad);
    const vy = 50 + r * Math.sin(rad);
    return {
        clientX: rect.left + (vx / 100) * rect.width,
        clientY: rect.top + (vy / 100) * rect.height,
    };
}

/** Client coords of a viewBox point given directly as (x, y) in 0..100. */
export function pointAt(svg, vx, vy) {
    const rect = svg.getBoundingClientRect();
    return {
        clientX: rect.left + (vx / 100) * rect.width,
        clientY: rect.top + (vy / 100) * rect.height,
    };
}

/**
 * Neutralise pointer capture for the duration of a synthetic gesture.
 *
 * A dispatched PointerEvent carries a pointerId the browser never issued, so
 * setPointerCapture() rejects it with NotFoundError — and two of the circle
 * cards call it UNGUARDED, which aborts their handler before it publishes.
 *
 * Stubbed on Element.prototype rather than on the node under test: the cards
 * call it on `e.currentTarget`, i.e. whichever node carries the listener, and
 * that is not always the node the gesture is dispatched to. Stubbing only the
 * dispatch target happened to work in chromium and threw in firefox — exactly
 * the kind of engine difference the browser matrix exists to catch.
 */
function withoutPointerCapture(run) {
    const proto = Element.prototype;
    const saved = {
        set: proto.setPointerCapture,
        release: proto.releasePointerCapture,
        has: proto.hasPointerCapture,
    };
    proto.setPointerCapture = () => {};
    proto.releasePointerCapture = () => {};
    proto.hasPointerCapture = () => false;
    return (async () => {
        try {
            return await run();
        } finally {
            proto.setPointerCapture = saved.set;
            proto.releasePointerCapture = saved.release;
            proto.hasPointerCapture = saved.has;
        }
    })();
}

const pointerEvent = (type, {clientX, clientY}) => new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true,
    pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1,
    clientX, clientY,
});

/**
 * Run a pointer gesture on `target`: down at the first point, a move per
 * subsequent point, then up. Returns after the element has re-rendered.
 */
export async function pointerDrag(el, target, points) {
    await withoutPointerCapture(async () => {
        target.dispatchEvent(pointerEvent("pointerdown", points[0]));
        await el.updateComplete;
        for (const p of points.slice(1)) {
            target.dispatchEvent(pointerEvent("pointermove", p));
            await el.updateComplete;
        }
        target.dispatchEvent(pointerEvent("pointerup", points.at(-1)));
        await el.updateComplete;
    });
    return el;
}

/** Drag around a ring/arc from one angle to another (0° = top, clockwise). */
export async function dragAngle(el, target, fromDeg, toDeg, {r = 40, steps = 3} = {}) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
        points.push(pointAtAngle(target, fromDeg + ((toDeg - fromDeg) * i) / steps, r));
    }
    return pointerDrag(el, target, points);
}

/** A single tap at a viewBox coordinate. */
export async function tapAt(el, target, vx, vy) {
    return pointerDrag(el, target, [pointAt(target, vx, vy)]);
}
