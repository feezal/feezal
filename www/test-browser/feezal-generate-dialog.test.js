import {describe, it, expect, beforeEach} from 'vitest';

// Real circle elements so resolveElementTag/_availableFamilies see a genuine
// registered family (each declares a discovery descriptor).
import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';
import '../packages/@feezal/feezal-element-circle-light/feezal-element-circle-light.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';

import '../src/feezal-generate-dialog.js';
import {fakeConnection} from './helpers.js';

const CIRCLE_PKGS = [
    '@feezal/feezal-element-circle-switch',
    '@feezal/feezal-element-circle-light',
    '@feezal/feezal-element-circle-climate',
];

function setupFeezal(view) {
    window.feezal = {
        elements: CIRCLE_PKGS,
        view,
        connection: fakeConnection(),   // stamped live elements may try to subscribe
        editor: {initElem() {}},
        app: {
            change() { window.feezal.__changes = (window.feezal.__changes || 0) + 1; },
            _setView(name) { window.feezal.__selectedView = name; },
        },
        __changes: 0,
    };
}

async function makeDialog() {
    const dlg = document.createElement('feezal-generate-dialog');
    document.body.append(dlg);
    await dlg.updateComplete;
    return dlg;
}

describe('feezal-generate-dialog (U58 Devices)', () => {
    let view;
    beforeEach(() => {
        document.body.innerHTML = '';
        view = document.createElement('div');
        view.setAttribute('name', 'Living Room');
        Object.defineProperty(view, 'clientWidth', {value: 600, configurable: true});
        document.body.append(view);
        setupFeezal(view);
    });

    it('lists circle as an available family', async () => {
        const dlg = await makeDialog();
        expect(dlg._availableFamilies()).toContain('circle');
    });

    it('generates one wired element per selected device in an auto-grid', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg.__devices = [
            {component: 'switch', discovery_id: 'd-sw', config: {command_topic: 'a/set', state_topic: 'a/state'}, __key: 'd-sw'},
            {component: 'light', discovery_id: 'd-li', config: {command_topic: 'b/set'}, __key: 'd-li'},
        ];
        dlg._checked = new Set(['d-sw', 'd-li']);
        dlg._generate();

        const created = [...view.children];
        expect(created).toHaveLength(2);
        expect(created.map(c => c.localName).sort()).toEqual(
            ['feezal-element-circle-light', 'feezal-element-circle-switch']
        );
        // wired: the switch carries its discovery-id + a command topic
        const sw = view.querySelector('feezal-element-circle-switch');
        expect(sw.getAttribute('discovery-id')).toBe('d-sw');
        // positioned in a grid (absolute view)
        expect(created.every(c => c.style.left && c.style.top)).toBe(true);
        expect(dlg._result.added).toBe(2);
        expect(dlg._result.view).toBe('Living Room');
    });

    it('skips a device already on the view (dupe guard) — append-only', async () => {
        const existing = document.createElement('feezal-element-circle-switch');
        existing.setAttribute('discovery-id', 'd-sw');
        view.append(existing);

        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg.__devices = [{component: 'switch', discovery_id: 'd-sw', config: {command_topic: 'a/set'}, __key: 'd-sw'}];
        dlg._checked = new Set(['d-sw']);
        dlg._generate();

        expect(view.querySelectorAll('feezal-element-circle-switch')).toHaveLength(1); // no duplicate
        expect(dlg._result.added).toBe(0);
        expect(dlg._result.skippedDupe).toHaveLength(1);
    });

    it('skips-and-reports a family parity gap', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        // circle has no "media" element → parity gap
        dlg.__devices = [
            {component: 'switch', discovery_id: 'd-sw', config: {command_topic: 'a/set'}, __key: 'd-sw'},
            {component: 'vacuum', discovery_id: 'd-vac', config: {}, __key: 'd-vac'},
        ];
        // circle-vacuum isn't imported here, so it resolves to null
        dlg._checked = new Set(['d-sw', 'd-vac']);
        // vacuum is not selectable → count reflects only the switch
        expect(dlg._selectableCount()).toBe(1);
        dlg._generate();
        expect(dlg._result.added).toBe(1);
        expect(dlg._result.skippedNoElem.map(e => e.component)).toContain('vacuum');
    });

    it('U67: filters out HA diagnostic entities (z2m linkquality / last_seen / disabled)', async () => {
        const orig = window.fetch;
        window.fetch = async () => ({ok: true, json: async () => ({devices: [
            {component: 'switch', discovery_id: 'd-sw', config: {command_topic: 'a/set'}},
            {component: 'sensor', discovery_id: 'd-lq', config: {state_topic: 'a/lq', entity_category: 'diagnostic'}},
            {component: 'sensor', discovery_id: 'd-seen', config: {state_topic: 'a/seen', entity_category: 'config'}},
            {component: 'sensor', discovery_id: 'd-off', config: {state_topic: 'a/off', enabled_by_default: false}},
            {component: 'sensor', discovery_id: 'd-temp', config: {state_topic: 'a/temp'}},
        ]})});
        try {
            const dlg = await makeDialog();
            await dlg._loadInto('devices');
            const ids = dlg.__devices.map(e => e.discovery_id).sort();
            expect(ids).toEqual(['d-sw', 'd-temp']);   // the functional entities only
        } finally {
            window.fetch = orig;
        }
    });
});


// ── U58 Phase ②: App mode ────────────────────────────────────────────────────

describe('feezal-generate-dialog (U58 App mode)', () => {
    let site;
    beforeEach(() => {
        document.body.innerHTML = '';
        site = document.createElement('div');   // stands in for feezal-site
        document.body.append(site);
        setupFeezal(null);
        window.feezal.site = site;
        window.feezal.app.views = [];
    });

    const DEVICES = () => ([
        {component: 'light', discovery_id: 'd-wz', name: 'wohnzimmer_lampe',
            config: {state_topic: 'z/wohnzimmer_lampe', command_topic: 'z/wohnzimmer_lampe/set'}, __key: 'd-wz'},
        {component: 'switch', discovery_id: 'd-ku', name: 'kueche_steckdose',
            config: {state_topic: 'z/kueche_steckdose', command_topic: 'z/kueche_steckdose/set'}, __key: 'd-ku'},
        {component: 'light', discovery_id: 'd-x', name: 'mystery_7',
            config: {state_topic: 'z/mystery_7', command_topic: 'z/m/set'}, __key: 'd-x'},
    ]);

    it('review buckets from the heuristic; rename = merge; generate scaffolds the app', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        expect(dlg._stage).toBe('review');
        expect(dlg._reviewBuckets().map(b => b.label)).toEqual(['Kitchen', 'Living room', 'Unassigned']);

        dlg._renameBucket('Unassigned', 'Kitchen');   // merge the unmatched one
        expect(dlg._reviewBuckets().map(b => b.label)).toEqual(['Kitchen', 'Living room']);
        dlg._generateApp();

        const shell = site.querySelector('feezal-element-layout-app');
        expect(shell).not.toBeNull();
        expect(shell.closest('feezal-view').getAttribute('name')).toBe('Menu');
        // U67: wider cap (was 520px → two glass columns) + shell fills its view
        expect(shell.style.getPropertyValue('--feezal-app-content-max-width')).toBe('960px');
        expect(shell.style.width).toBe('100%');
        expect(shell.style.height).toBe('100%');
        // U67: Menu is the first view (viewer tab bar entry point)
        expect(site.querySelector('feezal-view').getAttribute('name')).toBe('Menu');

        const items = JSON.parse(shell.getAttribute('items'));
        expect(items.map(i => i.view).sort()).toEqual(['kitchen', 'living-room']);
        expect(items.every(i => i.icon && i.label)).toBe(true);
        expect(shell.getAttribute('active-view')).toBe(items[0].view);

        const kitchen = site.querySelector('feezal-view[name="kitchen"]');
        expect(kitchen.getAttribute('child-position')).toBe('flow');
        expect(kitchen.getAttribute('flow-justify')).toBe('start');   // U67: left-aligned
        expect(kitchen.querySelectorAll('[discovery-id]')).toHaveLength(2);
        expect(site.querySelector('feezal-view[name="living-room"]').querySelectorAll('[discovery-id]')).toHaveLength(1);
        expect(dlg._result.added).toBe(3);
        expect(window.feezal.__changes).toBe(1);   // one undo entry
        // U67: Menu is the default (first view) AND is selected after generation
        expect(site.querySelector('feezal-view').getAttribute('name')).toBe('Menu');
        expect(window.feezal.__selectedView).toBe('Menu');
    });

    it('U67: Menu first, generated sub-views next, pre-existing views last', async () => {
        // a hand-made view already on the site, before generation
        const hand = document.createElement('feezal-view');
        hand.setAttribute('name', 'my-dashboard');
        site.append(hand);

        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        dlg._renameBucket('Unassigned', 'Kitchen');
        dlg._generateApp();

        const order = [...site.querySelectorAll('feezal-view')].map(v => v.getAttribute('name'));
        expect(order[0]).toBe('Menu');                    // entry point first (= default)
        expect(window.feezal.__selectedView).toBe('Menu'); // and selected after generation
        expect(order[order.length - 1]).toBe('my-dashboard'); // pre-existing last
        // the generated sub-views sit between, before the hand-made view
        expect(order.indexOf('kitchen')).toBeLessThan(order.indexOf('my-dashboard'));
        expect(order.indexOf('living-room')).toBeLessThan(order.indexOf('my-dashboard'));
    });

    it('re-running reuses the shell, merges same-named views and dupe-guards site-wide', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES().slice(0, 2);
        dlg._checked = new Set(['d-wz', 'd-ku']);
        dlg._toReview();
        dlg._generateApp();

        // second run: same two devices plus a new one that lands in Kitchen
        dlg.__devices = [...DEVICES(),
            {component: 'switch', discovery_id: 'd-ku2', name: 'kueche_ofen',
                config: {state_topic: 'z/kueche_ofen', command_topic: 'z/kueche_ofen/set'}, __key: 'd-ku2'}];
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-ku2']);
        dlg._toReview();
        dlg._generateApp();

        expect(site.querySelectorAll('feezal-element-layout-app')).toHaveLength(1);   // one shell
        expect(site.querySelectorAll('feezal-view[name="kitchen"]')).toHaveLength(1); // merged, not duplicated
        expect(site.querySelector('feezal-view[name="kitchen"]').querySelectorAll('[discovery-id]')).toHaveLength(2);
        expect(dlg._result.added).toBe(1);                    // only the new device
        expect(dlg._result.skippedDupe).toHaveLength(2);      // the re-picked ones
        const items = JSON.parse(site.querySelector('feezal-element-layout-app').getAttribute('items'));
        expect(items.map(i => i.view).sort()).toEqual(['kitchen', 'living-room']);   // append-only, no dupes
    });

    it('function axis groups by component; reassign moves a single device', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'function';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        expect(dlg._reviewBuckets().map(b => b.label)).toEqual(['Lights', 'Switches & sockets']);
        dlg._reassign('d-x', 'Switches & sockets');
        const buckets = dlg._reviewBuckets();
        expect(buckets.find(b => b.label === 'Switches & sockets').entities.map(e => e.__key)).toContain('d-x');
        expect(buckets.find(b => b.label === 'Lights').entities).toHaveLength(1);
    });

    it('a trusted area beats the lexicon and the review marks only guesses', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = [
            {component: 'light', discovery_id: 'd-a', name: 'wohnzimmer_lampe', __area: 'Studio',
                config: {state_topic: 'z/a', command_topic: 'z/a/set'}, __key: 'd-a'},
            {component: 'light', discovery_id: 'd-b', name: 'kueche_spot',
                config: {state_topic: 'z/b', command_topic: 'z/b/set'}, __key: 'd-b'},
        ];
        dlg._checked = new Set(['d-a', 'd-b']);
        dlg._toReview();
        const buckets = dlg._reviewBuckets();
        expect(buckets.map(b => b.label)).toEqual(['Kitchen', 'Studio']);
        expect(buckets.find(b => b.label === 'Studio').guessed).toBe(false);
        expect(buckets.find(b => b.label === 'Kitchen').guessed).toBe(true);
        // backing out of review has created nothing
        expect(site.querySelectorAll('feezal-view')).toHaveLength(0);
    });

    it('umlaut labels slugify stably for the view name (Büro → buero)', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = [
            {component: 'light', discovery_id: 'd-a', name: 'lampe', __area: 'Büro',
                config: {state_topic: 'z/a', command_topic: 'z/a/set'}, __key: 'd-a'},
        ];
        dlg._checked = new Set(['d-a']);
        dlg._toReview();
        dlg._generateApp();
        expect(site.querySelector('feezal-view[name="buero"]')).not.toBeNull();
        const items = JSON.parse(site.querySelector('feezal-element-layout-app').getAttribute('items'));
        expect(items[0]).toMatchObject({label: 'Büro', view: 'buero'});
        // shell defaults per the Phase-2 spec
        const shell = site.querySelector('feezal-element-layout-app');
        expect(shell.getAttribute('rail')).toBe('auto');
        expect(shell.style.getPropertyValue('--feezal-app-content-padding')).toBe('12px');
    });
});

