/**
 * E115 — Switch element family (context menu). Drives the inspector's switch
 * logic on a bare-prototype receiver (like feezal-editor-drag-restrict), with
 * the interact/selection side-effects stubbed, so the transform itself — tag
 * swap, shared-attribute intersection, discovery-id + geometry carry, orphan
 * drop, family-target discovery — is asserted directly.
 */
import {describe, it, expect, beforeEach} from 'vitest';

import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';
import '../packages/@feezal/feezal-element-metro-switch/feezal-element-metro-switch.js';
import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';
import '../packages/@feezal/feezal-element-glass-value/feezal-element-glass-value.js';
import '../packages/@feezal/feezal-element-eink-number/feezal-element-eink-number.js';

import '../src/feezal-sidebar-inspector.js';
import {setupFeezal} from './helpers.js';

const FeezalSidebarInspector = customElements.get('feezal-sidebar-inspector');

const PKGS = [
    '@feezal/feezal-element-glass-switch',
    '@feezal/feezal-element-metro-switch',
    '@feezal/feezal-element-circle-switch',
    '@feezal/feezal-element-glass-value',
    '@feezal/feezal-element-eink-number',
];

let feezal, view, changes;

function receiver(selectedElems) {
    const ctx = Object.create(FeezalSidebarInspector.prototype);
    Object.defineProperties(ctx, {
        selectedElems: {value: selectedElems, writable: true},
        // stub the DOM-editing side-effects — we assert the transform, not interact.js
        initElem: {value: () => {}},
        selectElement: {value(sel) { this._selected = sel; }, writable: true},
        _closeCtxMenu: {value: () => {}},
        _showSwitchReport: {value(text, warn) { this._report = {text, warn}; }},
    });
    return ctx;
}

beforeEach(() => {
    changes = 0;
    feezal = setupFeezal({elements: PKGS, app: {change() { changes++; }}});
    view = document.createElement('div');
    document.body.append(view);
});

describe('E115 — Switch family targets', () => {
    it('offers the other installed families with a twin, not the element own family', () => {
        const el = document.createElement('feezal-element-glass-switch');
        view.append(el);
        const fams = receiver([el])._switchFamilyTargets().map(t => t.family);
        expect(fams).toContain('metro');
        expect(fams).toContain('circle');
        expect(fams).not.toContain('glass');   // own family excluded
    });

    it('pairs the numeric readout across the number↔value tag divergence (E138)', () => {
        const el = document.createElement('feezal-element-glass-value');
        view.append(el);
        // glass-value ↔ eink-number are the same function despite the tag suffix
        expect(receiver([el])._switchFamilyTargets().map(t => t.family)).toContain('eink');
    });

    it('counts how many selected elements would switch to each family', () => {
        const a = document.createElement('feezal-element-glass-switch');
        const b = document.createElement('feezal-element-circle-switch');
        view.append(a); view.append(b);
        const metro = receiver([a, b])._switchFamilyTargets().find(t => t.family === 'metro');
        expect(metro.count).toBe(2);
    });
});

describe('E115 — Switch family transform', () => {
    it('swaps the tag, carries shared attrs + discovery-id + geometry, drops orphans + chrome', () => {
        const el = document.createElement('feezal-element-glass-switch');
        el.setAttribute('subscribe', 'stat/lamp');       // shared → kept
        el.setAttribute('publish', 'set/lamp');          // shared → kept
        el.setAttribute('discovery-id', 'dev-9');         // always → kept
        el.setAttribute('glass-only-orphan', 'x');        // orphan → dropped
        el.style.cssText = 'position:absolute;left:10px;top:20px;width:120px;height:64px;--feezal-glass-accent:red;';
        view.append(el);

        const ctx = receiver([el]);
        ctx._ctxSwitchFamily('metro');

        const swapped = view.querySelector('feezal-element-metro-switch');
        expect(swapped).not.toBeNull();
        expect(view.querySelector('feezal-element-glass-switch')).toBeNull();   // replaced in place
        expect(swapped.getAttribute('subscribe')).toBe('stat/lamp');
        expect(swapped.getAttribute('publish')).toBe('set/lamp');
        expect(swapped.getAttribute('discovery-id')).toBe('dev-9');
        expect(swapped.hasAttribute('glass-only-orphan')).toBe(false);
        // geometry preserved, family chrome var dropped
        expect(swapped.style.left).toBe('10px');
        expect(swapped.style.width).toBe('120px');
        expect(swapped.style.getPropertyValue('--feezal-glass-accent')).toBe('');
        // one undo entry, reselected, and the drop was reported (not silent)
        expect(changes).toBe(1);
        expect(ctx._selected).toEqual([swapped]);
        expect(ctx._report.warn).toBe(true);
        expect(ctx._report.text).toContain('glass-only-orphan');
    });

    it('skips elements with no twin in the target family and reports the count', () => {
        const sw = document.createElement('feezal-element-glass-switch');
        const val = document.createElement('feezal-element-glass-value');   // no metro? metro-value exists
        view.append(sw); view.append(val);
        const ctx = receiver([sw, val]);
        // switch to eink: eink-switch exists, but glass-switch→eink-switch ok;
        // glass-value→eink-number ok too — pick a family missing a twin instead:
        ctx._ctxSwitchFamily('circle');   // circle-switch exists, circle has no "value" twin here
        // sw switched, val skipped (no circle twin imported)
        expect(view.querySelector('feezal-element-circle-switch')).not.toBeNull();
        expect(ctx._report.text).toContain('skipped');
    });
});
