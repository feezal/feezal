/**
 * N37/N40 pause support on the Polymer base (feezal-polymer-element) — the
 * paper-* elements use this base. Before this, the base had no pause methods, so
 * the visibility controller's `el.pauseSubscriptions?.()` was a no-op and paper
 * elements stayed subscribed on hidden/lazy views. Exercised on the prototype to
 * avoid the Polymer mount/property harness.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {FeezalPolymerElement} from '../packages/@feezal/feezal-element/feezal-polymer-element.js';

const proto = FeezalPolymerElement.prototype;
let subCalls;
const origFeezal = globalThis.feezal;

beforeEach(() => {
    subCalls = [];
    globalThis.feezal = {isEditor: false, connection: {sub: (t, cb) => { subCalls.push(t); return {topic: t, cb}; }, unsubscribe() {}}};
});
afterEach(() => { globalThis.feezal = origFeezal; });

describe('feezal-polymer-element pause support (N37/N40)', () => {
    it('_subscribe is a no-op while paused', () => {
        proto._subscribe.call({__n37Paused: true, subscribe: 'home/x', _subscriptions: []});
        expect(subCalls).toEqual([]);
    });

    it('addSubscription is dropped while paused', () => {
        const self = {__n37Paused: true, _subscriptions: []};
        proto.addSubscription.call(self, 'extra/topic', () => {});
        expect(subCalls).toEqual([]);
        expect(self._subscriptions).toHaveLength(0);
    });

    it('addSubscription works when not paused', () => {
        const self = {__n37Paused: false, _subscriptions: []};
        proto.addSubscription.call(self, 'extra/topic', () => {});
        expect(subCalls).toEqual(['extra/topic']);
        expect(self._subscriptions).toHaveLength(1);
    });

    it('pauseSubscriptions sets the flag, unsubscribes and disconnects conditions', () => {
        let unsubbed = false, condOff = false;
        const self = {__n37Paused: false, _unsubscribe() { unsubbed = true; }, _conditions: {disconnect() { condOff = true; }}};
        proto.pauseSubscriptions.call(self);
        expect(self.__n37Paused).toBe(true);
        expect(unsubbed).toBe(true);
        expect(condOff).toBe(true);
        // idempotent
        unsubbed = false;
        proto.pauseSubscriptions.call(self);
        expect(unsubbed).toBe(false);
    });

    it('resumeSubscriptions clears the flag and re-attaches via a reconnect cycle', () => {
        const parent = {removed: null, inserted: null};
        const self = {
            __n37Paused: true,
            parentNode: parent,
            nextSibling: 'next',
            remove() { parent.removed = this; },
            // parentNode.insertBefore(this, next)
        };
        parent.insertBefore = (node, ref) => { parent.inserted = [node, ref]; };
        proto.resumeSubscriptions.call(self);
        expect(self.__n37Paused).toBe(false);
        expect(parent.removed).toBe(self);
        expect(parent.inserted).toEqual([self, 'next']);
    });
});
