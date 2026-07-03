/**
 * Shared setup for browser-mode component tests.
 *
 * Elements talk to `feezal.connection` (a feezal-connection element at
 * runtime).  This stand-in implements the same sub/unsubscribe/pub surface as
 * an exact-topic in-page message bus and records publishes for assertions.
 */
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
        /** Simulate an incoming broker message. */
        deliver(topic, payload) {
            [...(subs.get(topic) || [])].forEach(cb => cb({topic, payload}));
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
