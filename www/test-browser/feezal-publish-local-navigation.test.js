/**
 * E117 (navigation/tab-bar tranche) — the shared `publish-local` descriptor on
 * every element that publishes as a navigation/selection act: material-navbar,
 * tui-menu, metro-tile, material-chip. Each threads {local: this.publishLocal}
 * into pub() (paper-tabs, Polymer, already did — its descriptor was converged
 * on the shared wording).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-navbar';
import '@feezal/feezal-element-tui-menu';
import '@feezal/feezal-element-metro-tile';
import '@feezal/feezal-element-material-chip';
import {setupFeezal, mount} from './helpers.js';

let feezal;
beforeEach(() => { feezal = setupFeezal(); });

const CASES = [
    {
        tag: 'feezal-element-material-navbar',
        attrs: {publish: 'ui/view', items: JSON.stringify([{label: 'One', view: 'page1'}])},
        act: el => el._navigate('page1'),
        expected: {topic: 'ui/view', payload: 'page1'},
    },
    {
        tag: 'feezal-element-tui-menu',
        attrs: {items: JSON.stringify([{label: 'Lights', publish: 'ui/menu', payload: 'go'}])},
        act: el => el._activate(0),
        expected: {topic: 'ui/menu', payload: 'go'},
    },
    {
        tag: 'feezal-element-metro-tile',
        attrs: {publish: 'ui/tile', payload: 'tap'},
        act: el => el.baseAction(),
        expected: {topic: 'ui/tile', payload: 'tap'},
    },
    {
        tag: 'feezal-element-material-chip',
        attrs: {publish: 'ui/chip', 'payload-on': 'ON', 'payload-off': 'OFF'},
        act: el => el._onChange({target: {selected: true}}),
        expected: {topic: 'ui/chip', payload: 'ON'},
    },
];

describe('E117 — publish-local on navigation/selection elements', () => {
    for (const c of CASES) {
        it(`${c.tag}: threads {local: true} when set, {local: false} otherwise`, async () => {
            const calls = [];
            feezal.connection.pub = (topic, payload, options) => calls.push({topic, payload, options});

            const local = await mount(c.tag, {...c.attrs, 'publish-local': ''});
            c.act(local);
            expect(calls).toContainEqual({...c.expected, options: {local: true}});

            calls.length = 0;
            const remote = await mount(c.tag, c.attrs);
            c.act(remote);
            expect(calls).toContainEqual({...c.expected, options: {local: false}});
        });

        it(`${c.tag}: declares the shared publish-local descriptor`, () => {
            const spec = customElements.get(c.tag).feezal.attributes.find(a => a?.name === 'publish-local');
            expect(spec).toMatchObject({type: 'boolean', default: false});
        });
    }
});
