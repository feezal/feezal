import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {parseConditions, evalCondition} from '../packages/@feezal/feezal-element/feezal-conditions.js';
import {FeezalElement, html} from '../packages/@feezal/feezal-element/feezal-element.js';

// Minimal concrete element for integration tests.
class TestCondElement extends FeezalElement {
    render() { return html``; }
}
customElements.define('feezal-element-test-cond', TestCondElement);

let subs;   // topic → [callbacks]

beforeEach(() => {
    subs = {};
    feezal.isEditor = false;
    feezal.connection = {
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(sub => {
            const list = subs[sub.topic] || [];
            const i = list.indexOf(sub.cb);
            if (i >= 0) list.splice(i, 1);
        }),
        pub: vi.fn(),
    };
});

afterEach(() => {
    document.body.innerHTML = '';
});

const publish = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));

async function mount(conditions, attrs = {}) {
    const el = document.createElement('feezal-element-test-cond');
    if (conditions !== undefined) {
        el.setAttribute('conditions', typeof conditions === 'string' ? conditions : JSON.stringify(conditions));
    }

    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('parseConditions', () => {
    it('parses a valid row list', () => {
        const rows = parseConditions('[{"subscribe":"a/b","operator":"=","value":"1","action":"hide"}]');
        expect(rows).toHaveLength(1);
        expect(rows[0].subscribe).toBe('a/b');
    });

    it('returns [] for garbage, non-arrays and empty input', () => {
        expect(parseConditions(undefined)).toEqual([]);
        expect(parseConditions('')).toEqual([]);
        expect(parseConditions('{oops')).toEqual([]);
        expect(parseConditions('{"a":1}')).toEqual([]);
    });

    it('drops rows without topic, with unknown action or operator', () => {
        const rows = parseConditions(JSON.stringify([
            {subscribe: '', action: 'hide'},
            {subscribe: 'a', action: 'explode'},
            {subscribe: 'a', action: 'hide', operator: '~'},
            {subscribe: 'ok', action: 'show'},
        ]));
        expect(rows).toHaveLength(1);
        expect(rows[0].subscribe).toBe('ok');
    });
});

describe('evalCondition', () => {
    it('= and != compare as strings', () => {
        expect(evalCondition('=', 'on', 'on')).toBe(true);
        expect(evalCondition('=', '1', 1)).toBe(true);
        expect(evalCondition('=', 'on', 'off')).toBe(false);
        expect(evalCondition('!=', 'on', 'off')).toBe(true);
    });

    it('defaults to = when the operator is missing', () => {
        expect(evalCondition(undefined, '5', '5')).toBe(true);
    });

    it('numeric comparators', () => {
        expect(evalCondition('>', '20', '21.5')).toBe(true);
        expect(evalCondition('<', '20', '19')).toBe(true);
        expect(evalCondition('>=', '20', '20')).toBe(true);
        expect(evalCondition('<=', '20', '20')).toBe(true);
        expect(evalCondition('>', '20', 'abc')).toBe(false);   // non-numeric never matches
    });

    it('matches applies a regex; invalid regex never matches', () => {
        expect(evalCondition('matches', '^err', 'error 42')).toBe(true);
        expect(evalCondition('matches', '^err', 'ok')).toBe(false);
        expect(evalCondition('matches', '(', 'anything')).toBe(false);
    });
});

// ── Engine integration via FeezalElement ─────────────────────────────────────

describe('conditions engine (E50)', () => {
    it('hide row: hides while matched, restores pristine display when unmatched', async () => {
        const el = document.createElement('feezal-element-test-cond');
        el.setAttribute('conditions', JSON.stringify([{subscribe: 'home/x', operator: '=', value: 'off', action: 'hide'}]));
        el.style.display = 'flex';    // pristine inline value, set before mount
        document.body.append(el);
        await el.updateComplete;

        publish('home/x', 'off');
        expect(el.style.display).toBe('none');
        publish('home/x', 'on');
        expect(el.style.display).toBe('flex');
    });

    it('keep-layout uses visibility:hidden instead of display:none', async () => {
        const el = await mount([{subscribe: 'home/x', value: 'off', action: 'hide', 'keep-layout': true}]);
        publish('home/x', 'off');
        expect(el.style.visibility).toBe('hidden');
        expect(el.style.display).not.toBe('none');
        publish('home/x', 'on');
        expect(el.style.visibility).toBe('');
    });

    it('show rows AND-combine with hide rows', async () => {
        const el = await mount([
            {subscribe: 'a', value: '1', action: 'show'},
            {subscribe: 'b', value: 'alarm', action: 'hide'},
        ]);
        publish('a', '1');                       // show matched, hide unmatched → visible
        expect(el.style.display).not.toBe('none');
        publish('b', 'alarm');                   // hide matched → hidden despite show
        expect(el.style.display).toBe('none');
        publish('b', 'ok');
        expect(el.style.display).not.toBe('none');
        publish('a', '0');                       // show unmatched → hidden
        expect(el.style.display).toBe('none');
    });

    it('class row adds while matched and removes when unmatched', async () => {
        const el = await mount([{subscribe: 't', value: 'warn', action: 'class', class: 'alert'}]);
        publish('t', 'warn');
        expect(el.classList.contains('alert')).toBe(true);
        publish('t', 'ok');
        expect(el.classList.contains('alert')).toBe(false);
    });

    it('style row applies and reverts to the pristine inline value', async () => {
        const el = await mount(undefined);
        el.style.setProperty('background', 'blue');
        el.setAttribute('conditions', JSON.stringify([
            {subscribe: 't', value: 'hot', action: 'style', style: {background: 'red', opacity: '0.5'}},
        ]));
        await el.updateComplete;

        publish('t', 'hot');
        expect(el.style.getPropertyValue('background')).toBe('red');
        expect(el.style.getPropertyValue('opacity')).toBe('0.5');
        publish('t', 'cold');
        expect(el.style.getPropertyValue('background')).toBe('blue');   // pristine restored
        expect(el.style.getPropertyValue('opacity')).toBe('');          // removed
    });

    it('attribute row sets while matched and restores the original (or removes it)', async () => {
        const el = await mount([
            {subscribe: 't', value: 'armed', action: 'attribute', attribute: 'disabled', 'attribute-value': ''},
            {subscribe: 't', value: 'armed', action: 'attribute', attribute: 'label', 'attribute-value': 'LOCKED'},
        ], {label: 'Open'});

        publish('t', 'armed');
        expect(el.hasAttribute('disabled')).toBe(true);
        expect(el.getAttribute('label')).toBe('LOCKED');
        publish('t', 'off');
        expect(el.hasAttribute('disabled')).toBe(false);      // wasn't set → removed
        expect(el.getAttribute('label')).toBe('Open');        // original restored
    });

    it('later matching row wins on the same style property', async () => {
        const el = await mount([
            {subscribe: 'a', value: '1', action: 'style', style: {color: 'green'}},
            {subscribe: 'b', value: '1', action: 'style', style: {color: 'red'}},
        ]);
        publish('a', '1');
        expect(el.style.color).toBe('green');
        publish('b', '1');                       // both matched → later row wins
        expect(el.style.color).toBe('red');
        publish('b', '0');                       // later unmatched → earlier applies again
        expect(el.style.color).toBe('green');
        publish('a', '0');
        expect(el.style.color).toBe('');
    });

    it('does nothing before the first message arrives (no replay for local topics)', async () => {
        const el = await mount([{subscribe: 't', value: 'x', action: 'hide'}]);
        expect(el.style.display).not.toBe('none');
        expect(el.classList.contains('feezal-element')).toBe(true);
    });

    it('never subscribes or applies in the editor', async () => {
        feezal.isEditor = true;
        const el = await mount([{subscribe: 'edit/t', value: 'x', action: 'hide'}]);
        expect(subs['edit/t']).toBeUndefined();
        expect(el.style.display).not.toBe('none');
    });

    it('invalid conditions JSON subscribes nothing', async () => {
        await mount('{not json');
        expect(Object.keys(subs)).toHaveLength(0);
    });

    it('editing conditions at runtime resubscribes and reverts old effects', async () => {
        const el = await mount([{subscribe: 'old/t', value: 'x', action: 'class', class: 'a'}]);
        publish('old/t', 'x');
        expect(el.classList.contains('a')).toBe(true);

        el.setAttribute('conditions', JSON.stringify([{subscribe: 'new/t', value: 'y', action: 'class', class: 'b'}]));
        await el.updateComplete;
        expect(el.classList.contains('a')).toBe(false);       // old effect reverted
        expect(subs['old/t']).toHaveLength(0);                // old sub gone
        publish('new/t', 'y');
        expect(el.classList.contains('b')).toBe(true);
    });

    it('removing the conditions attribute stops the engine and reverts', async () => {
        const el = await mount([{subscribe: 't', value: 'x', action: 'hide'}]);
        publish('t', 'x');
        expect(el.style.display).toBe('none');

        el.removeAttribute('conditions');
        await el.updateComplete;
        expect(el.style.display).not.toBe('none');
        expect(subs.t).toHaveLength(0);
    });

    it('disconnecting the element unsubscribes and reverts', async () => {
        const el = await mount([{subscribe: 't', value: 'x', action: 'hide'}]);
        publish('t', 'x');
        expect(el.style.display).toBe('none');
        el.remove();
        expect(subs.t).toHaveLength(0);
        expect(el.style.display).not.toBe('none');
    });

    it('row property drills into JSON payloads', async () => {
        const el = await mount([{subscribe: 't', property: 'payload.state', value: 'on', action: 'class', class: 'lit'}]);
        (subs.t || []).forEach(cb => cb({topic: 't', payload: {state: 'on'}}));
        expect(el.classList.contains('lit')).toBe(true);
    });
});
