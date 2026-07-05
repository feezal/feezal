import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import {FeezalElement, feezalBaseStyles, html, css} from '../packages/@feezal/feezal-element/feezal-element.js';

// ── Test subclasses covering the base-class variation points ────────────────

// No baseAttribute — only the reserved control topics get subscribed.
class TestPlain extends FeezalElement {}
customElements.define('test-fe-plain', TestPlain);

// String-typed baseAttribute — payloads land as attribute values.
class TestString extends FeezalElement {
    static get feezal() {
        return {attributes: [], styles: [], baseAttribute: 'value'};
    }

    static properties = {
        value: {type: String, reflect: true}
    };
}
customElements.define('test-fe-string', TestString);

// Boolean-typed baseAttribute — falsy payloads remove the attribute.
class TestBool extends FeezalElement {
    static get feezal() {
        return {attributes: [], styles: [], baseAttribute: 'active'};
    }

    static properties = {
        active: {type: Boolean, reflect: true}
    };
}
customElements.define('test-fe-bool', TestBool);

// baseAttribute without a matching static properties entry — type lookup
// yields undefined and the payload passes through uncast.
class TestUntyped extends FeezalElement {
    static get feezal() {
        return {baseAttribute: 'value'};
    }
}
customElements.define('test-fe-untyped', TestUntyped);

// ── Mock connection matching feezal-connection's sub/unsubscribe contract ───

function mockConnection() {
    const handlers = [];
    return {
        handlers,
        sub: vi.fn((topic, callback) => {
            const subscription = {topic, callback};
            handlers.push(subscription);
            return subscription;
        }),
        unsubscribe: vi.fn(subscription => {
            const i = handlers.indexOf(subscription);
            if (i !== -1) {
                handlers.splice(i, 1);
            }
        }),
        emit(topic, message) {
            [...handlers].filter(h => h.topic === topic).forEach(h => h.callback(message));
        },
        topics() {
            return handlers.map(h => h.topic);
        }
    };
}

let conn;

beforeEach(() => {
    conn = mockConnection();
    feezal.isEditor = false;
    feezal.connection = conn;
});

// Detach mounted elements while the mock connection is still in place —
// the shared setup's body reset runs after feezal has been replaced, and
// disconnectedCallback needs feezal.connection for its unsubscribes.
afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(tag, attrs = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

const CONTROL_SUFFIXES = ['setattribute', 'removeattribute', 'setstyle', 'removestyle', 'addclass', 'removeclass'];

// ── Construction & statics ───────────────────────────────────────────────────

describe('construction and statics', () => {
    it('constructor defaults', () => {
        const el = document.createElement('test-fe-plain');
        expect(el.messageProperty).toBe('payload');
        expect(el.dynamicSubscriptions).toBe(false);
        expect(el.visible).toBe(false);
        expect(el._subscriptions).toEqual([]);
    });

    it('static feezal getter defaults to empty attribute/style descriptors', () => {
        expect(FeezalElement.feezal).toEqual({attributes: [], styles: []});
    });

    it('base styles carry the editor outline and pointer-events rules', () => {
        const text = feezalBaseStyles.cssText;
        expect(text).toContain(':host');
        expect(text).toMatch(/:host\(\.feezal-editable\)\s*{[^}]*outline/);
        expect(text).toMatch(/pointer-events:\s*none/);
        expect(FeezalElement.styles).toBe(feezalBaseStyles);
    });

    it('re-exports lit html and css for single-import element files', () => {
        expect(typeof html).toBe('function');
        expect(typeof css).toBe('function');
    });

    it('connectedCallback tags the element with the feezal-element class', async () => {
        const el = await mount('test-fe-plain');
        expect(el.classList.contains('feezal-element')).toBe(true);
    });

    it('kebab-case attributes map onto the camelCase properties', async () => {
        const el = await mount('test-fe-plain', {
            'message-property': 'val',
            'dynamic-subscriptions': '',
            subscribe: 'a/b'
        });
        expect(el.messageProperty).toBe('val');
        expect(el.dynamicSubscriptions).toBe(true);
        expect(el.subscribe).toBe('a/b');
    });

    it('visible reflects to its attribute', async () => {
        const el = await mount('test-fe-plain');
        el.visible = true;
        await el.updateComplete;
        expect(el.hasAttribute('visible')).toBe(true);
    });
});

// ── Subscription lifecycle ───────────────────────────────────────────────────

describe('subscription lifecycle', () => {
    it('does not subscribe without a subscribe attribute', async () => {
        await mount('test-fe-plain');
        expect(conn.sub).not.toHaveBeenCalled();
    });

    it('subscribes the six control topics (no baseAttribute)', async () => {
        await mount('test-fe-plain', {subscribe: 'home/x'});
        expect(conn.topics().sort()).toEqual(CONTROL_SUFFIXES.map(s => `home/x/${s}`).sort());
    });

    it('subscribes the base topic in addition when the class declares baseAttribute', async () => {
        await mount('test-fe-string', {subscribe: 'home/x'});
        expect(conn.topics()).toContain('home/x');
        expect(conn.topics()).toHaveLength(7);
    });

    it('disconnecting unsubscribes everything', async () => {
        const el = await mount('test-fe-string', {subscribe: 'home/x'});
        el.remove();
        expect(conn.unsubscribe).toHaveBeenCalledTimes(7);
        expect(conn.handlers).toHaveLength(0);
        expect(el._subscriptions).toHaveLength(0);
    });

    it('re-appending after removal subscribes again', async () => {
        const el = await mount('test-fe-plain', {subscribe: 'home/x'});
        el.remove();
        document.body.append(el);
        expect(conn.topics()).toHaveLength(6);
    });

    it('editor with MQTT manipulation prevented (default) does not subscribe', async () => {
        feezal.isEditor = true;
        await mount('test-fe-string', {subscribe: 'home/x'});
        expect(conn.sub).not.toHaveBeenCalled();
    });

    it('editor with preventEditorMqtt=false subscribes like the viewer', async () => {
        feezal.isEditor = true;
        feezal.preventEditorMqtt = false;
        await mount('test-fe-string', {subscribe: 'home/x'});
        expect(conn.topics()).toHaveLength(7);
    });

    it('addSubscription wires a secondary topic and cleans up on disconnect', async () => {
        const el = await mount('test-fe-plain');
        const cb = vi.fn();
        el.addSubscription('extra/topic', cb);
        conn.emit('extra/topic', {payload: 1});
        expect(cb).toHaveBeenCalledWith({payload: 1});
        el.remove();
        expect(conn.handlers).toHaveLength(0);
    });
});

describe('dynamic subscriptions', () => {
    it('does not subscribe while invisible', async () => {
        await mount('test-fe-plain', {subscribe: 'home/x', 'dynamic-subscriptions': ''});
        expect(conn.sub).not.toHaveBeenCalled();
    });

    it('subscribes on visible=true and unsubscribes on visible=false', async () => {
        const el = await mount('test-fe-plain', {subscribe: 'home/x', 'dynamic-subscriptions': ''});
        el.visible = true;
        await el.updateComplete;
        expect(conn.topics()).toHaveLength(6);
        el.visible = false;
        await el.updateComplete;
        expect(conn.handlers).toHaveLength(0);
    });

    it('visible toggles are ignored without dynamic-subscriptions', async () => {
        const el = await mount('test-fe-plain', {subscribe: 'home/x'});
        el.visible = true;
        await el.updateComplete;
        el.visible = false;
        await el.updateComplete;
        expect(conn.topics()).toHaveLength(6); // still the connect-time set, no dupes
    });

    it('mounting already-visible does not double-subscribe', async () => {
        // visible attribute present at connect time: connectedCallback subscribes
        // AND the first updated() sees visible in the changed set — must not dupe.
        await mount('test-fe-plain', {subscribe: 'home/x', 'dynamic-subscriptions': '', visible: ''});
        expect(conn.topics()).toHaveLength(6);
    });
});

// ── Base-attribute payload handling ──────────────────────────────────────────

describe('base attribute payloads', () => {
    it('writes the payload to the declared attribute', async () => {
        const el = await mount('test-fe-string', {subscribe: 'home/x'});
        conn.emit('home/x', {payload: 'hello'});
        expect(el.getAttribute('value')).toBe('hello');
    });

    it('extracts nested values via message-property', async () => {
        const el = await mount('test-fe-string', {subscribe: 'home/x', 'message-property': 'val.inner'});
        conn.emit('home/x', {val: {inner: 'deep'}, payload: 'wrong'});
        expect(el.getAttribute('value')).toBe('deep');
    });

    it('Boolean type: truthy payload strings set the attribute', async () => {
        const el = await mount('test-fe-bool', {subscribe: 'home/x'});
        for (const payload of ['true', '1', 'ON']) {
            conn.emit('home/x', {payload});
            expect(el.hasAttribute('active'), payload).toBe(true);
            el.removeAttribute('active');
        }
    });

    it('Boolean type: falsy payloads remove the attribute', async () => {
        const el = await mount('test-fe-bool', {subscribe: 'home/x'});
        for (const payload of ['false', 'FALSE', '0', 0, false]) {
            el.setAttribute('active', '');
            conn.emit('home/x', {payload});
            expect(el.hasAttribute('active'), String(payload)).toBe(false);
        }
    });

    it('Boolean type: non-string truthy payloads pass through uncast', async () => {
        const el = await mount('test-fe-bool', {subscribe: 'home/x'});
        conn.emit('home/x', {payload: true});
        expect(el.hasAttribute('active')).toBe(true);
    });

    it('baseAttribute without a properties entry passes the payload through', async () => {
        const el = await mount('test-fe-untyped', {subscribe: 'home/x'});
        conn.emit('home/x', {payload: 'raw'});
        expect(el.getAttribute('value')).toBe('raw');
    });
});

// ── Reserved control topics ──────────────────────────────────────────────────

describe('control topics', () => {
    let el;
    beforeEach(async () => {
        el = await mount('test-fe-plain', {subscribe: 'home/x'});
    });

    it('setattribute applies an object payload, stringified', () => {
        conn.emit('home/x/setattribute', {payload: {foo: 1, bar: 'baz'}});
        expect(el.getAttribute('foo')).toBe('1');
        expect(el.getAttribute('bar')).toBe('baz');
    });

    it('setattribute ignores non-object payloads', () => {
        conn.emit('home/x/setattribute', {payload: 'foo=1'});
        expect(el.hasAttribute('foo')).toBe(false);
    });

    it('removeattribute accepts comma/space separated names and arrays', () => {
        for (const name of ['a', 'b', 'c', 'd']) {
            el.setAttribute(name, '1');
        }

        conn.emit('home/x/removeattribute', {payload: 'a b,c'});
        expect(el.hasAttribute('a')).toBe(false);
        expect(el.hasAttribute('b')).toBe(false);
        expect(el.hasAttribute('c')).toBe(false);
        expect(el.hasAttribute('d')).toBe(true);
        conn.emit('home/x/removeattribute', {payload: ['d']});
        expect(el.hasAttribute('d')).toBe(false);
    });

    it('setstyle assigns object payloads onto style, ignores non-objects', () => {
        conn.emit('home/x/setstyle', {payload: {color: 'red', opacity: '0.5'}});
        expect(el.style.color).toBe('red');
        expect(el.style.opacity).toBe('0.5');
        conn.emit('home/x/setstyle', {payload: 'color: blue'});
        expect(el.style.color).toBe('red');
    });

    it('removestyle removes the listed properties', () => {
        conn.emit('home/x/setstyle', {payload: {color: 'red', opacity: '0.5'}});
        conn.emit('home/x/removestyle', {payload: 'color opacity'});
        expect(el.style.color).toBe('');
        expect(el.style.opacity).toBe('');
    });

    it('addclass / removeclass toggle classes', () => {
        conn.emit('home/x/addclass', {payload: 'alert'});
        expect(el.classList.contains('alert')).toBe(true);
        conn.emit('home/x/removeclass', {payload: 'alert'});
        expect(el.classList.contains('alert')).toBe(false);
    });

    it('control payloads honour message-property', async () => {
        const nested = await mount('test-fe-plain', {subscribe: 'home/y', 'message-property': 'val'});
        conn.emit('home/y/addclass', {val: 'nested-cls', payload: 'wrong'});
        expect(nested.classList.contains('nested-cls')).toBe(true);
    });
});

// ── Utilities ────────────────────────────────────────────────────────────────

describe('_payloadCast', () => {
    const el = document.createElement('test-fe-plain');

    it('casts strings for Boolean targets', () => {
        expect(el._payloadCast(Boolean, 'false')).toBe(false);
        expect(el._payloadCast(Boolean, 'FALSE')).toBe(false);
        expect(el._payloadCast(Boolean, '0')).toBe(false);
        expect(el._payloadCast(Boolean, '1')).toBe(true);
        expect(el._payloadCast(Boolean, 'true')).toBe(true);
        expect(el._payloadCast(Boolean, 'on')).toBe(true); // NaN !== 0 && not 'false'
    });

    it('passes everything else through', () => {
        expect(el._payloadCast(String, 'false')).toBe('false');
        expect(el._payloadCast(Boolean, 5)).toBe(5);
        expect(el._payloadCast(undefined, 'x')).toBe('x');
    });
});

describe('throttle', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('runs the first call immediately and collapses the burst to a trailing call', () => {
        const el = document.createElement('test-fe-plain');
        const fn = vi.fn();
        const throttled = el.throttle(fn, 100);

        throttled('a');
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenLastCalledWith('a');

        throttled('b');
        throttled('c');
        expect(fn).toHaveBeenCalledTimes(1); // burst deferred

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith('c'); // only the last of the burst
    });

    it('a call after the window fires after the remaining delay', () => {
        const el = document.createElement('test-fe-plain');
        const fn = vi.fn();
        const throttled = el.throttle(fn, 100);

        throttled(1);
        vi.advanceTimersByTime(150);
        throttled(2); // lastRan is stale → scheduled with negative remainder
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenLastCalledWith(2);
    });

    it('preserves this and arguments', () => {
        const el = document.createElement('test-fe-plain');
        let receivedThis;
        let receivedArgs;
        const obj = {
            fn: el.throttle(function (...args) {
                receivedThis = this;
                receivedArgs = args;
            }, 100)
        };
        obj.fn('x', 'y');
        expect(receivedThis).toBe(obj);
        expect(receivedArgs).toEqual(['x', 'y']);
    });
});

describe('split', () => {
    const el = document.createElement('test-fe-plain');

    it('splits on dots (fast path without backslashes)', () => {
        expect(el.split('a.b.c')).toEqual(['a', 'b', 'c']);
        expect(el.split('abc')).toEqual(['abc']);
    });

    it('coerces non-string input', () => {
        expect(el.split(5)).toEqual(['5']);
    });

    it('honours escaped dots', () => {
        expect(el.split('a\\.b.c')).toEqual(['a.b', 'c']);
    });

    it('unescapes double backslashes (escaped escape before a real dot)', () => {
        expect(el.split('a\\\\.b')).toEqual(['a\\', 'b']);
    });

    it('keeps the trailing empty chunk after a final dot', () => {
        expect(el.split('a\\.b.')).toEqual(['a.b', '']);
    });
});

describe('getProperty', () => {
    const el = document.createElement('test-fe-plain');

    it('returns primitives as-is when no property path is given', () => {
        expect(el.getProperty('plain')).toBe('plain');
        expect(el.getProperty(42)).toBe(42);
    });

    it('returns undefined for a property path on a primitive', () => {
        expect(el.getProperty('plain', 'x')).toBeUndefined();
    });

    it('walks nested object paths', () => {
        expect(el.getProperty({a: {b: {c: 7}}}, 'a.b.c')).toBe(7);
    });

    it('returns undefined for missing paths', () => {
        expect(el.getProperty({a: {}}, 'a.b.c')).toBeUndefined();
    });

    it('stops the walk at falsy intermediate values', () => {
        // Documented quirk: the falsy guard returns the falsy value itself.
        expect(el.getProperty({a: 0}, 'a.b')).toBe(0);
    });

    it('resolves keys containing escaped dots', () => {
        expect(el.getProperty({'a.b': 1}, 'a\\.b')).toBe(1);
    });

    it('works on functions carrying properties', () => {
        const f = () => {};
        f.x = 'fx';
        expect(el.getProperty(f, 'x')).toBe('fx');
    });
});
