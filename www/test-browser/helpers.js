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
