/**
 * U113 — the public element contract, pinned parity-style.
 *
 * Scripts (`fzl.val` / `fzl.on`) and the system-form element read an
 * element's `.value` and listen for composed `feezal-change` / `feezal-press`
 * events INSTEAD of reaching into shadow roots. Every element on the curated
 * list below must therefore:
 *
 *   - expose `.value` (getter, plus a setter for the input-like ones),
 *   - fire a composed, bubbling `feezal-change` carrying `detail.value` when
 *     the USER edits it — and track the new value even WITHOUT a publish
 *     topic (a form field usually has none; two elements used to return
 *     early before updating their state),
 *   - (buttons) fire a composed, bubbling `feezal-press` with
 *     `detail.payload`, with or without a publish topic.
 *
 * Driving the inner widgets is per-family (MD3 fires DOM `change`/`input`
 * with the value on the target; Carbon fires `cds-*` events with a detail),
 * so each case says how a user edit is simulated.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {setupFeezal, mount} from './helpers.js';

import '@feezal/feezal-element-material-input';
import '@feezal/feezal-element-material-select';
import '@feezal/feezal-element-material-slider';
import '@feezal/feezal-element-material-checkbox';
import '@feezal/feezal-element-material-radio';
import '@feezal/feezal-element-material-switch';
import '@feezal/feezal-element-material-button';
import '@feezal/feezal-element-material-icon-button';
import '@feezal/feezal-element-material-fab';
import '@feezal/feezal-element-carbon-input';
import '@feezal/feezal-element-carbon-select';
import '@feezal/feezal-element-carbon-slider';
import '@feezal/feezal-element-carbon-checkbox';
import '@feezal/feezal-element-carbon-switch';
import '@feezal/feezal-element-carbon-button';

beforeEach(() => setupFeezal());

const OPTIONS = JSON.stringify([{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]);

/** Fire `type` on the inner widget after applying `patch` to it. */
const fire = (inner, type, patch = {}, detail) => {
    Object.assign(inner, patch);
    inner.dispatchEvent(detail === undefined
        ? new Event(type, {bubbles: true, composed: true})
        : new CustomEvent(type, {bubbles: true, composed: true, detail}));
};

/**
 * tag → {attrs, set: a value the setter must round-trip, edit(el): simulate a
 * user edit and return the value it should produce}
 */
const INPUTS = [
    {tag: 'feezal-element-material-input', set: 'hello',
        edit: el => { fire(el.shadowRoot.querySelector('md-outlined-text-field'), 'input', {value: 'typed'}); return 'typed'; }},
    {tag: 'feezal-element-carbon-input', set: 'hello',
        edit: el => { fire(el.shadowRoot.querySelector('cds-text-input'), 'input', {value: 'typed'}); return 'typed'; }},
    {tag: 'feezal-element-material-select', attrs: {options: OPTIONS}, set: 'b',
        edit: el => { fire(el.shadowRoot.querySelector('md-outlined-select'), 'change', {value: 'a'}); return 'a'; }},
    {tag: 'feezal-element-carbon-select', attrs: {options: OPTIONS}, set: 'b',
        edit: el => { fire(el.shadowRoot.querySelector('cds-select'), 'cds-select-selected', {}, {value: 'a'}); return 'a'; }},
    {tag: 'feezal-element-material-slider', set: 42,
        edit: el => { fire(el.shadowRoot.querySelector('md-slider'), 'change', {value: 77}); return 77; }},
    {tag: 'feezal-element-carbon-slider', set: 42,
        edit: el => { fire(el.shadowRoot.querySelector('cds-slider'), 'cds-slider-changed', {}, {value: 77}); return 77; }},
    {tag: 'feezal-element-material-checkbox', set: true,
        edit: el => { fire(el.shadowRoot.querySelector('md-checkbox'), 'change', {checked: true}); return true; }},
    {tag: 'feezal-element-carbon-checkbox', set: true,
        edit: el => { fire(el.shadowRoot.querySelector('cds-checkbox'), 'cds-checkbox-changed', {checked: true}); return true; }},
    {tag: 'feezal-element-material-switch', set: true,
        edit: el => { fire(el.shadowRoot.querySelector('md-switch'), 'change', {selected: true}); return true; }},
    {tag: 'feezal-element-carbon-switch', set: true,
        edit: el => { fire(el.shadowRoot.querySelector('cds-toggle'), 'cds-toggle-changed', {}, {toggled: true}); return true; }},
    {tag: 'feezal-element-material-radio', attrs: {options: OPTIONS}, set: 'b',
        edit: el => { fire(el.shadowRoot.querySelector('md-radio[value="a"]'), 'change', {checked: true}); return 'a'; }},
    {tag: 'feezal-element-material-icon-button', attrs: {toggle: 'true'}, set: false,   // a tap TOGGLES: start off → on
        edit: el => { el.shadowRoot.querySelector('md-icon-button').click(); return true; }},
];

const BUTTONS = [
    {tag: 'feezal-element-material-button', press: el => el.shadowRoot.querySelector('md-filled-button').click()},
    {tag: 'feezal-element-carbon-button',   press: el => el.shadowRoot.querySelector('cds-button').click()},
    {tag: 'feezal-element-material-fab',    press: el => el.shadowRoot.querySelector('md-fab').click()},
    {tag: 'feezal-element-material-icon-button', press: el => el.shadowRoot.querySelector('md-icon-button').click()},
];

/** Collect composed events of `type` that reach the DOCUMENT (i.e. escaped the shadow root). */
function collect(type) {
    const seen = [];
    const handler = e => seen.push(e);
    document.addEventListener(type, handler);
    return {seen, stop: () => document.removeEventListener(type, handler)};
}

describe('U113 value contract — input-like elements', () => {
    for (const {tag, attrs = {}, set, edit} of INPUTS) {
        it(`${tag}: .value round-trips and a user edit fires composed feezal-change (no publish topic)`, async () => {
            const el = await mount(tag, attrs);
            // no publish topic — state must still follow the user
            expect(el.publish || '').toBe('');

            el.value = set;
            await el.updateComplete;
            expect(el.value).toEqual(set);

            const {seen, stop} = collect('feezal-change');
            const expected = edit(el);
            await el.updateComplete;
            stop();

            expect(seen.length, 'exactly one feezal-change').toBe(1);
            expect(seen[0].composed).toBe(true);
            expect(seen[0].bubbles).toBe(true);
            expect(seen[0].target).toBe(el);             // retargeted to the host
            expect(seen[0].detail.value).toEqual(expected);
            expect(el.value).toEqual(expected);
            expect(feezal.connection.published.length, 'nothing published without a topic').toBe(0);
        });
    }

    it('text inputs also re-dispatch keydown / keyup / blur as composed feezal-* events with the key', async () => {
        for (const tag of ['feezal-element-material-input', 'feezal-element-carbon-input']) {
            const el = await mount(tag);
            const inner = el.shadowRoot.querySelector('md-outlined-text-field, cds-text-input');
            const down = collect('feezal-keydown'), up = collect('feezal-keyup'), blur = collect('feezal-blur');
            inner.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, composed: true}));
            inner.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', bubbles: true, composed: true}));
            inner.dispatchEvent(new Event(tag.includes('carbon') ? 'focusout' : 'blur', {bubbles: true, composed: true}));
            down.stop(); up.stop(); blur.stop();
            expect(down.seen.map(e => e.detail.key), tag).toEqual(['Enter']);
            expect(up.seen.map(e => e.detail.key), tag).toEqual(['Enter']);
            expect(blur.seen.length, tag).toBe(1);
            el.remove();
        }
    });
});

describe('U113 value contract — buttons', () => {
    for (const {tag, press} of BUTTONS) {
        it(`${tag}: a press fires composed feezal-press with the payload, with or without a topic`, async () => {
            const el = await mount(tag, {payload: 'go'});
            const {seen, stop} = collect('feezal-press');
            press(el);
            stop();
            expect(seen.length).toBe(1);
            expect(seen[0].target).toBe(el);
            expect(seen[0].detail.payload).toBe('go');
            expect(feezal.connection.published.length).toBe(0);

            el.setAttribute('publish', 'cmd/x');
            await el.updateComplete;
            const again = collect('feezal-press');
            press(el);
            again.stop();
            expect(again.seen.length).toBe(1);
            expect(feezal.connection.published.at(-1)).toMatchObject({topic: 'cmd/x', payload: 'go'});
        });
    }

    it('a disabled button fires neither feezal-press nor a publish', async () => {
        for (const {tag, press} of BUTTONS) {
            const el = await mount(tag, {payload: 'go', publish: 'cmd/x', disabled: 'true'});
            const {seen, stop} = collect('feezal-press');
            press(el);
            stop();
            expect(seen.length, tag).toBe(0);
            expect(feezal.connection.published.length, tag).toBe(0);
            el.remove();
        }
    });
});
