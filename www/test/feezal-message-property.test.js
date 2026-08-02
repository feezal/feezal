/**
 * U95 (step 1) — message-property access as standalone functions.
 *
 * `split()` / `getProperty()` were instance methods, so anything that is not a
 * `FeezalElement` could not read a payload path. `FeezalConditions` asks its
 * host for `getProperty()` and quietly falls back to plain `msg.payload`
 * otherwise — so wiring conditions to `feezal-view` (a LitElement) would have
 * silently ignored the configured property and never matched on a nested JSON
 * payload.
 *
 * This is a behaviour-preserving extraction, so the assertion that matters is
 * that the class and the function still agree — not merely that the function
 * works.
 */
import {describe, it, expect} from 'vitest';
import {FeezalElement, splitPropertyPath, getMessageProperty}
    from '../packages/@feezal/feezal-element/feezal-element.js';

/** Call the class's methods without constructing an element. */
const asMethod = Object.create(FeezalElement.prototype);
const splitVia = str => FeezalElement.prototype.split.call(asMethod, str);
const getVia = (obj, prop) => FeezalElement.prototype.getProperty.call(asMethod, obj, prop);

describe('splitPropertyPath', () => {
    it('splits on plain dots', () => {
        expect(splitPropertyPath('a.b.c')).toEqual(['a', 'b', 'c']);
        expect(splitPropertyPath('payload')).toEqual(['payload']);
    });

    it('treats an escaped dot as part of the segment', () => {
        expect(splitPropertyPath('a\\.b')).toEqual(['a.b']);
        expect(splitPropertyPath('a\\.b.c')).toEqual(['a.b', 'c']);
    });

    it('unescapes a literal backslash', () => {
        expect(splitPropertyPath('a\\\\b')).toEqual(['a\\b']);
    });

    it('coerces non-strings rather than throwing', () => {
        expect(splitPropertyPath(42)).toEqual(['42']);
    });
});

describe('getMessageProperty', () => {
    const msg = {payload: {val: 7, deep: {n: 1}}, topic: 't'};

    it('reads a nested path', () => {
        expect(getMessageProperty(msg, 'payload.val')).toBe(7);
        expect(getMessageProperty(msg, 'payload.deep.n')).toBe(1);
    });

    it('returns undefined for a missing path instead of throwing', () => {
        expect(getMessageProperty(msg, 'payload.nope.deeper')).toBeUndefined();
    });

    it('passes a non-object payload straight through', () => {
        // MQTT payloads are often bare values; asking for a path into one must
        // not invent a result.
        expect(getMessageProperty('ON', undefined)).toBe('ON');
        expect(getMessageProperty('ON', 'val')).toBeUndefined();
    });

    it('honours an injected splitter, which is how a subclass override survives', () => {
        const shouty = path => path.toUpperCase().split('.');
        expect(getMessageProperty({A: {B: 3}}, 'a.b', shouty)).toBe(3);
    });
});

describe('the class and the functions agree (the extraction contract)', () => {
    const cases = [
        [{payload: 1}, 'payload'],
        [{payload: {val: 2}}, 'payload.val'],
        [{'a.b': {c: 3}}, 'a\\.b.c'],
        [{payload: {}}, 'payload.missing'],
        ['bare', 'val'],
        ['bare', undefined],
        [{payload: 0}, 'payload'],
    ];

    it('getProperty() and getMessageProperty() return the same thing', () => {
        for (const [obj, prop] of cases) {
            expect(getVia(obj, prop), JSON.stringify({obj, prop}))
                .toEqual(getMessageProperty(obj, prop));
        }
    });

    it('split() and splitPropertyPath() return the same thing', () => {
        for (const path of ['a', 'a.b', 'a\\.b', 'a\\\\b', 'a\\.b.c.d']) {
            expect(splitVia(path), path).toEqual(splitPropertyPath(path));
        }
    });

    it('a subclass overriding split() still steers getProperty()', () => {
        // The method delegates through this.split, not straight to the module
        // function — otherwise an override would be silently bypassed.
        class Odd extends FeezalElement {
            split() { return ['payload', 'val']; }
        }
        const host = Object.create(Odd.prototype);
        expect(Odd.prototype.getProperty.call(host, {payload: {val: 9}}, 'ignored')).toBe(9);
    });
});
