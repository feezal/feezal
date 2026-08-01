/**
 * U88 — the per-element MQTT debug panel: the topics the element actually
 * wired, last payload + count per topic, the outgoing tail (publishes never
 * come back through the subscription path), the publish-test field and the
 * single-selection gate.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-sidebar-debug.js';
import {previewPayload, publishTopics} from '../src/feezal-sidebar-debug.js';
import {setupFeezal, until} from './helpers.js';

let feezal;

/** A stand-in element carrying the base class's subscription registry. */
function fakeElement(tag = 'feezal-element-basic-number', attrs = {}, topics = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el._subscriptions = topics.map(topic => ({topic}));
    document.body.append(el);
    return el;
}

async function mountPanel(selected) {
    const panel = document.createElement('feezal-sidebar-debug');
    panel.selectedElems = selected;
    document.body.append(panel);
    await panel.updateComplete;
    return panel;
}

const sectionCounts = panel =>
    [...panel.shadowRoot.querySelectorAll('h4')].map(h => h.textContent.trim());
const topicRows = panel =>
    [...panel.shadowRoot.querySelectorAll('.topic')].map(t => t.textContent.trim());
const values = panel =>
    [...panel.shadowRoot.querySelectorAll('.value')].map(v => v.textContent.trim());

beforeEach(() => {
    feezal = setupFeezal();
    feezal.app = {toast: vi.fn()};
    document.body.innerHTML = '';
});

describe('pure helpers', () => {
    it('previewPayload stringifies, truncates and collapses data URLs', () => {
        expect(previewPayload('on')).toBe('on');
        expect(previewPayload({a: 1})).toBe('{"a":1}');
        expect(previewPayload(null)).toBe('null');
        expect(previewPayload('x'.repeat(400))).toHaveLength(221);         // 220 + ellipsis
        expect(previewPayload('data:image/png;base64,AAAA')).toBe('data:image/png;base64,…(binary)');
    });

    it('publishTopics reads publish + publish-* attributes only', () => {
        const el = fakeElement('feezal-element-basic-number', {
            'publish': 'a/set', 'publish-open': 'a/open', 'subscribe': 'a/state', 'label': 'x',
        });
        expect(publishTopics(el)).toEqual([
            {attr: 'publish', topic: 'a/set'},
            {attr: 'publish-open', topic: 'a/open'},
        ]);
        expect(publishTopics(null)).toEqual([]);
    });
});

describe('subscriptions', () => {
    it('lists the topics the element ACTUALLY wired, de-duplicated', async () => {
        const el = fakeElement('feezal-element-basic-number', {subscribe: 'attr/only'},
            ['live/a', 'live/b', 'live/a']);
        const panel = await mountPanel([el]);
        expect(sectionCounts(panel)[0]).toBe('Subscribes (2)');
        expect(topicRows(panel)).toEqual(['live/a', 'live/b']);
        // the attribute value is NOT what is listed — the registry is
        expect(topicRows(panel)).not.toContain('attr/only');
    });

    it('shows a waiting state, then the last payload with a message count', async () => {
        const el = fakeElement('feezal-element-basic-number', {}, ['home/temp']);
        const panel = await mountPanel([el]);
        expect(values(panel)[0]).toContain('waiting');

        feezal.connection.deliver('home/temp', '21.5');
        await until(() => values(panel)[0] === '21.5');
        feezal.connection.deliver('home/temp', '22.0');
        await until(() => values(panel)[0] === '22.0');
        expect(panel.shadowRoot.querySelector('.count').textContent).toBe('2×');
    });

    it('subscribes itself, so it sees traffic even when the element does not', async () => {
        const el = fakeElement('feezal-element-basic-number', {}, ['own/sub']);
        await mountPanel([el]);
        // the panel opened its own subscription on the shared connection
        expect(feezal.connection.subCount()).toBeGreaterThan(0);
    });

    it('says so when the element subscribes to nothing', async () => {
        const panel = await mountPanel([fakeElement()]);
        expect(sectionCounts(panel)[0]).toBe('Subscribes (0)');
        expect(panel.shadowRoot.textContent).toContain('subscribes to nothing');
    });
});

describe('publishes and the live tail', () => {
    it('lists publish targets and offers a test field', async () => {
        const el = fakeElement('feezal-element-basic-number', {publish: 'lamp/set'});
        const panel = await mountPanel([el]);
        expect(sectionCounts(panel)[1]).toBe('Publishes (1)');
        expect(topicRows(panel)).toContain('lamp/set');
        expect(panel.shadowRoot.querySelector('.test input')).not.toBeNull();
    });

    it('the test field publishes the typed payload to that topic', async () => {
        const el = fakeElement('feezal-element-basic-number', {publish: 'lamp/set'});
        const panel = await mountPanel([el]);
        const input = panel.shadowRoot.querySelector('.test input');
        input.value = 'ON';
        input.dispatchEvent(new Event('input'));
        await panel.updateComplete;
        panel.shadowRoot.querySelector('.test button').click();
        expect(feezal.connection.published).toContainEqual({topic: 'lamp/set', payload: 'ON'});
    });

    it('records the element OWN publishes in the tail (they never come back as messages)', async () => {
        const el = fakeElement('feezal-element-basic-number', {publish: 'lamp/set'});
        const panel = await mountPanel([el]);
        // simulate the element publishing — the connection announces it
        feezal.connection.dispatchEvent(new CustomEvent('feezal-publish',
            {detail: {topic: 'lamp/set', payload: 'OFF'}}));
        await until(() => panel.shadowRoot.querySelectorAll('.tail .row').length === 1);
        expect(panel.shadowRoot.querySelector('.tail .dir').textContent.trim()).toBe('↑');
        expect(panel.shadowRoot.querySelector('.tail').textContent).toContain('lamp/set');
    });

    it('ignores publishes to topics this element does not target', async () => {
        const el = fakeElement('feezal-element-basic-number', {publish: 'mine/set'});
        const panel = await mountPanel([el]);
        feezal.connection.dispatchEvent(new CustomEvent('feezal-publish',
            {detail: {topic: 'someone/else', payload: '1'}}));
        await panel.updateComplete;
        expect(panel.shadowRoot.querySelectorAll('.tail .row')).toHaveLength(0);
    });

    it('incoming messages land in the tail marked as received', async () => {
        const el = fakeElement('feezal-element-basic-number', {}, ['in/topic']);
        const panel = await mountPanel([el]);
        feezal.connection.deliver('in/topic', 'hello');
        await until(() => panel.shadowRoot.querySelectorAll('.tail .row').length === 1);
        expect(panel.shadowRoot.querySelector('.tail .dir').textContent.trim()).toBe('↓');
    });
});

describe('selection gate', () => {
    it('asks for a single element when nothing or several are selected', async () => {
        const none = await mountPanel([]);
        expect(none.shadowRoot.querySelector('.empty').textContent).toContain('single element');

        const many = await mountPanel([fakeElement(), fakeElement()]);
        expect(many.shadowRoot.querySelector('.empty')).not.toBeNull();
    });

    it('re-wires when the selection changes and drops the previous tail', async () => {
        const a = fakeElement('feezal-element-basic-number', {}, ['a/topic']);
        const b = fakeElement('feezal-element-basic-icon', {}, ['b/topic']);
        const panel = await mountPanel([a]);
        feezal.connection.deliver('a/topic', '1');
        await until(() => panel.shadowRoot.querySelectorAll('.tail .row').length === 1);

        panel.selectedElems = [b];
        await panel.updateComplete;
        expect(panel.shadowRoot.querySelectorAll('.tail .row')).toHaveLength(0);
        expect(topicRows(panel)).toEqual(['b/topic']);

        // and a message for the OLD element no longer shows
        feezal.connection.deliver('a/topic', '2');
        await panel.updateComplete;
        expect(panel.shadowRoot.querySelectorAll('.tail .row')).toHaveLength(0);
    });
});
