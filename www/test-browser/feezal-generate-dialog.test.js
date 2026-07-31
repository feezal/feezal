import {describe, it, expect, beforeEach} from 'vitest';

// Real circle elements so resolveElementTag/_availableFamilies see a genuine
// registered family (each declares a discovery descriptor).
import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';
import '../packages/@feezal/feezal-element-circle-light/feezal-element-circle-light.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';
// U74: a real glass element so the glass family is available (family-theme test).
import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';

import '../src/feezal-generate-dialog.js';
import {fakeConnection} from './helpers.js';

const CIRCLE_PKGS = [
    '@feezal/feezal-element-circle-switch',
    '@feezal/feezal-element-circle-light',
    '@feezal/feezal-element-circle-climate',
    '@feezal/feezal-element-glass-switch',
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

    describe('U68 range + drag select', () => {
        const dev = (id, name) => ({component: 'switch', discovery_id: id,
            config: {command_topic: id + '/set', device: {name}}, __key: id});
        const sel = dlg => new Set(dlg._checked);
        // labels AAA..DDD sort to a stable visible order a,b,c,d
        async function dialogWith4() {
            const dlg = await makeDialog();
            dlg._family = 'circle';   // circle-switch is registered → all four eligible
            dlg.__devices = [dev('d-a', 'AAA'), dev('d-b', 'BBB'), dev('d-c', 'CCC'), dev('d-d', 'DDD')];
            return dlg;
        }
        const press = (dlg, key, shift = false) => dlg._sel.press({shiftKey: shift}, key, dlg._currentOrder());

        it('plain press then Shift+press fills the range with the TARGET action', async () => {
            const dlg = await dialogWith4();
            press(dlg, 'd-a');                                  // check a, anchor = a
            expect(sel(dlg)).toEqual(new Set(['d-a']));
            press(dlg, 'd-d', true);                            // d-d toggles ON → a..d checked
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c', 'd-d']));
        });

        it('works upward too (Shift+press a row above the anchor)', async () => {
            const dlg = await dialogWith4();
            press(dlg, 'd-d');
            press(dlg, 'd-a', true);
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c', 'd-d']));
        });

        it('Shift+press CLEARS a range when the target toggles off', async () => {
            const dlg = await dialogWith4();
            dlg._checked = new Set(['d-a', 'd-b', 'd-c', 'd-d']);
            press(dlg, 'd-b');                                  // uncheck b, anchor = b
            press(dlg, 'd-d', true);                            // d-d toggles OFF → b..d cleared
            expect(sel(dlg)).toEqual(new Set(['d-a']));
        });

        it('Shift+press with NO anchor extends up to the boundary', async () => {
            const dlg = await dialogWith4();
            press(dlg, 'd-c', true);      // no anchor: check c and everything above until a checked row
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c']));   // d-d (below) untouched
        });

        it('the upward boundary stops at the first already-selected row', async () => {
            const dlg = await dialogWith4();
            dlg._checked = new Set(['d-a']);   // a already checked
            press(dlg, 'd-d', true);           // check d, c, b — stop AT a (already on)
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c', 'd-d']));
        });

        it('press-and-drag paints the press action onto crossed rows', async () => {
            const dlg = await dialogWith4();
            press(dlg, 'd-a');            // check a, drag armed with on=true
            dlg._sel.paint('d-b');
            dlg._sel.paint('d-c');
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c']));
            dlg._sel.end();
            dlg._sel.paint('d-d');       // after release, painting is a no-op
            expect(sel(dlg)).toEqual(new Set(['d-a', 'd-b', 'd-c']));
        });
    });

    describe('U69 review is the selection', () => {
        const dev = (id, name, comp = 'switch') => ({component: comp, discovery_id: id,
            config: {command_topic: id + '/set', device: {name}}, __key: id});
        async function reviewDialog() {
            const dlg = await makeDialog();
            dlg._family = 'circle';
            dlg._axis = 'room';
            dlg.__devices = [dev('d-wz', 'wohnzimmer_lampe', 'light'), dev('d-ku', 'kueche_steckdose')];
            dlg._toReview();
            return dlg;
        }

        it('_toReview selects every eligible device by default', async () => {
            const dlg = await reviewDialog();
            expect(new Set(dlg._checked)).toEqual(new Set(['d-wz', 'd-ku']));
            expect(dlg._stage).toBe('review');
        });

        it('unchecking a device excludes it from generation', async () => {
            const dlg = await reviewDialog();
            window.feezal.site = document.createElement('div');
            window.feezal.app.views = [];
            dlg._checked = new Set(['d-wz']);   // drop kueche
            dlg._generateApp();
            const site = window.feezal.site;
            expect(site.querySelector('feezal-view[name="kitchen"]')).toBeNull();       // emptied bucket → no view
            expect(site.querySelector('feezal-view[name="living-room"]')).not.toBeNull();
            expect(dlg._result.added).toBe(1);
        });
    });

    describe('U70 create new room', () => {
        async function reviewDialog() {
            const dlg = await makeDialog();
            dlg._family = 'circle'; dlg._axis = 'room';
            dlg.__devices = [{component: 'switch', discovery_id: 'd-x', name: 'mystery',
                config: {command_topic: 'x/set', state_topic: 'x'}, __key: 'd-x'}];
            dlg._toReview();
            return dlg;
        }

        it('the create sentinel opens the new-room dialog without reassigning', async () => {
            const dlg = await reviewDialog();
            const before = dlg._assign.get('d-x').label;
            dlg._onReassignChange('d-x', '__feezal_new_room__');   // the NEW_ROOM sentinel value
            expect(dlg._newRoomFor).toEqual(['d-x']);   // U75: key(s) awaiting the name
            expect(dlg._assign.get('d-x').label).toBe(before);   // not moved yet
        });

        it('confirming a name moves the device into the new bucket', async () => {
            const dlg = await reviewDialog();
            dlg._onReassignChange('d-x', '__feezal_new_room__');
            dlg._newRoomName = '  Wintergarten  ';
            dlg._confirmNewRoom();
            expect(dlg._assign.get('d-x').label).toBe('Wintergarten');   // trimmed
            expect(dlg._newRoomFor).toBe(null);
            expect(dlg._reviewBuckets().some(b => b.label === 'Wintergarten')).toBe(true);
        });
    });

    describe('room-move dropdown DOM sync (keyed rows)', () => {
        const selectFor = (dlg, key) =>
            dlg.renderRoot.querySelector(`.row[data-key="${key}"] select.r-move`);

        // Two devices in one room + one in another. Moving the top device out via
        // its dropdown must NOT leave its (user-changed) <select> value on the
        // device that shifts up into its slot — the classic unkeyed-list DOM reuse
        // where Lit's .value dirty-check skips the equal-valued sibling.
        async function twoInKitchen() {
            const dlg = await makeDialog();
            dlg._family = 'circle';
            dlg._axis = 'room';
            dlg.__devices = [
                {component: 'switch', discovery_id: 'd-x', name: 'kueche_x', __area: 'Kitchen',
                    config: {state_topic: 'z/x', command_topic: 'z/x/set'}, __key: 'd-x'},
                {component: 'switch', discovery_id: 'd-y', name: 'kueche_y', __area: 'Kitchen',
                    config: {state_topic: 'z/y', command_topic: 'z/y/set'}, __key: 'd-y'},
                {component: 'light', discovery_id: 'd-l', name: 'wohnzimmer_l', __area: 'Living room',
                    config: {state_topic: 'z/l', command_topic: 'z/l/set'}, __key: 'd-l'},
            ];
            dlg._toReview();
            await dlg.updateComplete;
            return dlg;
        }

        it('moving the top device leaves the row beneath with the right value', async () => {
            const dlg = await twoInKitchen();
            const xSel = selectFor(dlg, 'd-x');
            xSel.value = 'Living room';                        // user picks a new room…
            xSel.dispatchEvent(new Event('change'));           // …→ _onReassignChange moves d-x
            await dlg.updateComplete;

            // d-y shifted up into d-x's old slot — its dropdown must still read Kitchen
            expect(selectFor(dlg, 'd-y').value).toBe('Kitchen');
            // and d-x now sits under Living room
            expect(selectFor(dlg, 'd-x').value).toBe('Living room');
            expect(dlg._assign.get('d-x').label).toBe('Living room');
            expect(dlg._assign.get('d-y').label).toBe('Kitchen');
        });
    });

    describe('U75 review selection + bulk move', () => {
        const dev = (id, area) => ({component: 'switch', discovery_id: id, name: id, __area: area,
            config: {state_topic: 'z/' + id, command_topic: 'z/' + id + '/set'}, __key: id});
        async function review(devices) {
            const dlg = await makeDialog();
            dlg._family = 'circle';
            dlg._axis = 'room';
            dlg.__devices = devices;
            dlg._toReview();
            await dlg.updateComplete;
            return dlg;
        }

        it('checkbox toggles inclusion only; a row click selects only', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen')]);
            expect(dlg._checked.has('d-a')).toBe(true);   // all checked by default
            expect(dlg._selected.size).toBe(0);           // nothing selected

            // clicking the checkbox unchecks WITHOUT selecting the row
            dlg.renderRoot.querySelector('.row[data-key="d-a"] .cb-hit').click();
            await dlg.updateComplete;
            expect(dlg._checked.has('d-a')).toBe(false);
            expect(dlg._selected.has('d-a')).toBe(false);

            // pressing the row body selects WITHOUT changing the checkbox
            dlg._selPress({preventDefault() {}, shiftKey: false}, 'd-b');
            dlg._endDrag();
            await dlg.updateComplete;
            expect(dlg._selected.has('d-b')).toBe(true);
            expect(dlg._checked.has('d-b')).toBe(true);   // unchanged
        });

        it('bulk-moves every selected row to a room, then clears the selection', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen'), dev('d-l', 'Living room')]);
            dlg._selected = new Set(['d-a', 'd-b']);
            dlg._bulkMove('Living room');
            expect(dlg._assign.get('d-a').label).toBe('Living room');
            expect(dlg._assign.get('d-b').label).toBe('Living room');
            expect(dlg._selected.size).toBe(0);
        });

        it('bulk check / uncheck acts on the selection', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen')]);
            dlg._selected = new Set(['d-a', 'd-b']);
            dlg._bulkCheck(false);
            expect(dlg._checked.has('d-a')).toBe(false);
            expect(dlg._checked.has('d-b')).toBe(false);
            dlg._bulkCheck(true);
            expect(dlg._checked.has('d-a')).toBe(true);
        });

        it('bulk "create new room" moves the whole selection into it', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen')]);
            dlg._selected = new Set(['d-a', 'd-b']);
            dlg._bulkMove('__feezal_new_room__');
            expect(dlg._newRoomFor).toEqual(['d-a', 'd-b']);
            dlg._newRoomName = 'Studio';
            dlg._confirmNewRoom();
            expect(dlg._assign.get('d-a').label).toBe('Studio');
            expect(dlg._assign.get('d-b').label).toBe('Studio');
            expect(dlg._selected.size).toBe(0);
        });

        it('the selection resets when re-entering review', async () => {
            const dlg = await review([dev('d-a', 'Kitchen')]);
            dlg._selected = new Set(['d-a']);
            dlg._toReview();
            expect(dlg._selected.size).toBe(0);
        });
    });

    describe('U78 room review (rooms-first step)', () => {
        const dev = (id, name, area) => ({component: 'switch', discovery_id: id, name, __area: area,
            config: {state_topic: 'z/' + id, command_topic: 'z/' + id + '/set'}, __key: id});
        async function rooms(devices) {
            const dlg = await makeDialog();
            dlg._family = 'circle';
            dlg._axis = 'room';
            dlg.__devices = devices;
            dlg._toRooms();
            await dlg.updateComplete;
            return dlg;
        }

        it('builds the room list from detection (Unassigned excluded)', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht'), dev('d-b', 'wohnzimmer_lampe'), dev('d-c', 'mystery')]);
            expect(dlg._stage).toBe('rooms');
            expect(dlg._rooms.map(r => r.label).sort()).toEqual(['Kitchen', 'Living room']);
        });

        it('removing a room re-scans its devices against the remaining rooms', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht'), dev('d-b', 'wohnzimmer_lampe')]);
            dlg._removeRoom(dlg._rooms.findIndex(r => r.label === 'Kitchen'));
            expect(dlg._rooms.map(r => r.label)).toEqual(['Living room']);
            dlg._toReview();
            expect(dlg._assign.get('d-a').label).toBe('Unassigned');   // no remaining room matches 'kueche'
            expect(dlg._assign.get('d-b').label).toBe('Living room');
        });

        it('a re-added matching room re-claims the orphaned device', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht')]);
            dlg._removeRoom(0);            // drop Kitchen
            dlg._newRoomName = 'Küche';    // add a room the device name includes
            dlg._addRoom();
            dlg._toReview();
            expect(dlg._assign.get('d-a').label).toBe('Küche');
        });

        it('up/down reorder sets the review (drawer) order', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht'), dev('d-b', 'wohnzimmer_lampe')]);
            dlg._moveRoom(dlg._rooms.findIndex(r => r.label === 'Living room'), -1);
            expect(dlg._rooms.map(r => r.label)).toEqual(['Living room', 'Kitchen']);
            dlg._toReview();
            expect(dlg._reviewBuckets().map(b => b.label)).toEqual(['Living room', 'Kitchen']);
        });

        it('drag-drop reorders the room list', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht'), dev('d-b', 'wohnzimmer_lampe')]);
            dlg._roomDragStart({dataTransfer: {}}, 0);        // grab the first room
            dlg._roomDrop({preventDefault() {}}, 1);          // drop after the second
            expect(dlg._rooms.map(r => r.label)).toEqual(['Living room', 'Kitchen']);
        });

        it('rename rejects a duplicate label', async () => {
            const dlg = await rooms([dev('d-a', 'kueche_licht'), dev('d-b', 'wohnzimmer_lampe')]);
            dlg._renameRoom(0, dlg._rooms[1].label);          // rename room0 to room1's label
            expect(new Set(dlg._rooms.map(r => r.label)).size).toBe(2);   // still unique
        });

        it('the function axis skips the room step', async () => {
            const dlg = await makeDialog();
            dlg._family = 'circle';
            dlg._axis = 'function';
            dlg.__devices = [dev('d-a', 'kueche_licht')];
            dlg._startReview();
            expect(dlg._stage).toBe('review');
        });
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
        dlg._toReview();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-ku2']);   // U69: uncheck the Unassigned mystery device
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

    it('U72: orders the cards within a room by function (lights → switches → climate)', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        // Same room, supplied OUT of function order — the sort must reorder them.
        dlg.__devices = [
            {component: 'climate', discovery_id: 'd-cl', name: 'studio_thermostat', __area: 'Studio',
                config: {state_topic: 'z/cl', command_topic: 'z/cl/set'}, __key: 'd-cl'},
            {component: 'switch', discovery_id: 'd-sw', name: 'studio_plug', __area: 'Studio',
                config: {state_topic: 'z/sw', command_topic: 'z/sw/set'}, __key: 'd-sw'},
            {component: 'light', discovery_id: 'd-li', name: 'studio_lamp', __area: 'Studio',
                config: {state_topic: 'z/li', command_topic: 'z/li/set'}, __key: 'd-li'},
        ];
        dlg._checked = new Set(['d-cl', 'd-sw', 'd-li']);
        dlg._toReview();
        dlg._generateApp();

        const studio = site.querySelector('feezal-view[name="studio"]');
        const order = [...studio.children].map(c => c.localName);
        expect(order).toEqual([
            'feezal-element-circle-light',    // Lights first
            'feezal-element-circle-switch',   // then Switches
            'feezal-element-circle-climate',  // then Climate
        ]);
    });

    it('U72: function axis orders cards alphabetically by label', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'function';
        dlg.__devices = [
            {component: 'switch', discovery_id: 'd-c', name: 'Charlie',
                config: {state_topic: 'z/c', command_topic: 'z/c/set'}, __key: 'd-c'},
            {component: 'switch', discovery_id: 'd-a', name: 'Alpha',
                config: {state_topic: 'z/a', command_topic: 'z/a/set'}, __key: 'd-a'},
            {component: 'switch', discovery_id: 'd-b', name: 'Bravo',
                config: {state_topic: 'z/b', command_topic: 'z/b/set'}, __key: 'd-b'},
        ];
        dlg._checked = new Set(['d-a', 'd-b', 'd-c']);
        dlg._toReview();
        dlg._generateApp();

        const view = site.querySelector('feezal-view[name="switches-sockets"]');
        const ids = [...view.children].map(c => c.getAttribute('discovery-id'));
        expect(ids).toEqual(['d-a', 'd-b', 'd-c']);   // Alpha, Bravo, Charlie
    });

    it('U74: circle family sets the gruvbox-light site theme', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        dlg._generateApp();
        expect(site.classList.contains('feezal-theme-gruvbox-light')).toBe(true);
    });

    it('U74: glass family sets midnight-blue + paints sub-views with the gradient', async () => {
        const dlg = await makeDialog();
        dlg._family = 'glass';
        dlg._axis = 'room';
        dlg.__devices = [
            {component: 'switch', discovery_id: 'g-sw', name: 'kueche_steckdose', __area: 'Kitchen',
                config: {state_topic: 'z/g', command_topic: 'z/g/set'}, __key: 'g-sw'},
        ];
        dlg._checked = new Set(['g-sw']);
        dlg._toReview();
        dlg._generateApp();

        expect(site.classList.contains('feezal-theme-midnight-blue')).toBe(true);
        const kitchen = site.querySelector('feezal-view[name="kitchen"]');
        expect(kitchen).not.toBeNull();
        expect(kitchen.style.background).toContain('radial-gradient');
    });
});

