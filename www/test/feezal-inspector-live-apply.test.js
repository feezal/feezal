import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-sidebar-inspector-attributes.js';
import '../src/feezal-sidebar-inspector-styles.js';
import {LIVE_APPLY_DEBOUNCE_MS} from '../src/feezal-sidebar-inspector-attributes.js';

// Minimal element with a feezal descriptor for the attributes panel to target.
class LiveApplyTarget extends HTMLElement {
    static feezal = {attributes: [{name: 'label'}], styles: []};
}
customElements.define('feezal-element-live-apply-target', LiveApplyTarget);

let target;

beforeEach(() => {
    vi.useFakeTimers();
    target = document.createElement('feezal-element-live-apply-target');
    document.body.append(target);
    feezal.app = {change: vi.fn()};
    feezal.editor = {selectedElems: [target]};
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

function makeAttrPanel() {
    const panel = document.createElement('feezal-sidebar-inspector-attributes');
    panel.items = [{label: 'label', attrName: 'label', value: '', mixed: false, invalid: false, elem: {}}];
    return panel;
}

// U36: typing applies live (debounced, no history); blur/Enter flushes with a
// single history checkpoint; selection switches cancel pending commits.
describe('attributes panel — debounced live-apply (U36)', () => {
    it('a typing burst applies once after the debounce, without history', () => {
        const panel = makeAttrPanel();
        panel._liveChange('a', 0);
        panel._liveChange('ab', 0);
        panel._liveChange('abc', 0);

        vi.advanceTimersByTime(LIVE_APPLY_DEBOUNCE_MS - 1);
        expect(target.getAttribute('label')).toBeNull();     // not yet

        vi.advanceTimersByTime(1);
        expect(target.getAttribute('label')).toBe('abc');    // one live apply
        expect(feezal.app.change).not.toHaveBeenCalled();    // no history step
    });

    it('flush cancels the pending debounce and commits one history step', () => {
        const panel = makeAttrPanel();
        panel._liveChange('ab', 0);
        panel._flushChange('abc', 0);                        // blur/Enter

        expect(target.getAttribute('label')).toBe('abc');
        expect(feezal.app.change).toHaveBeenCalledTimes(1);  // exactly one undo step

        vi.runAllTimers();                                   // pending timer is gone
        expect(feezal.app.change).toHaveBeenCalledTimes(1);
    });

    it('a burst plus flush is exactly one history checkpoint', () => {
        const panel = makeAttrPanel();
        for (const v of ['h', 'he', 'hel', 'hell', 'hello']) {
            panel._liveChange(v, 0);
            vi.advanceTimersByTime(LIVE_APPLY_DEBOUNCE_MS);  // each burst applies live
        }

        expect(target.getAttribute('label')).toBe('hello');
        expect(feezal.app.change).not.toHaveBeenCalled();
        panel._flushChange('hello', 0);
        expect(feezal.app.change).toHaveBeenCalledTimes(1);
    });

    it('cancelling (selection switch) drops the pending commit entirely', () => {
        const panel = makeAttrPanel();
        panel._liveChange('stale', 0);
        panel._cancelLiveTimers();                           // updated(selectedElems) path
        vi.runAllTimers();
        expect(target.getAttribute('label')).toBeNull();
        expect(feezal.app.change).not.toHaveBeenCalled();
    });
});

describe('styles panel — debounced live-apply (U36)', () => {
    function makeStylePanel() {
        const panel = document.createElement('feezal-sidebar-inspector-styles');
        panel.selectedElems = [target];
        panel.items = [{property: 'color', value: '', mixed: false, invalid: false}];
        return panel;
    }

    const inputEvent = value => ({target: {value, getBoundingClientRect: () => ({bottom: 0, left: 0, width: 0})}});

    it('typing applies the style live after the debounce, without history', () => {
        const panel = makeStylePanel();
        panel._liveInput(inputEvent('re'), 0);
        panel._liveInput(inputEvent('red'), 0);

        vi.advanceTimersByTime(LIVE_APPLY_DEBOUNCE_MS);
        expect(target.style.color).toBe('red');
        expect(feezal.app.change).not.toHaveBeenCalled();
    });

    it('sl-change flush cancels the debounce and commits one history step', () => {
        const panel = makeStylePanel();
        panel._liveInput(inputEvent('blu'), 0);
        panel._change(inputEvent('blue'), 0);                // sl-change

        expect(target.style.color).toBe('blue');
        expect(feezal.app.change).toHaveBeenCalledTimes(1);

        vi.runAllTimers();
        expect(target.style.color).toBe('blue');             // stale 'blu' never fires
        expect(feezal.app.change).toHaveBeenCalledTimes(1);
    });

    it('cancelling (selection switch) drops the pending style commit', () => {
        const panel = makeStylePanel();
        panel._liveInput(inputEvent('green'), 0);
        panel._cancelLiveTimers();
        vi.runAllTimers();
        expect(target.style.color).toBe('');
        expect(feezal.app.change).not.toHaveBeenCalled();
    });
});
