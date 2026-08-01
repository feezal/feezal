import {describe, it, expect, beforeEach, afterEach} from 'vitest';

// Real circle elements so resolveElementTag/_availableFamilies see a genuine
// registered family (each declares a discovery descriptor).
import '../packages/@feezal/feezal-element-circle-switch/feezal-element-circle-switch.js';
import '../packages/@feezal/feezal-element-circle-light/feezal-element-circle-light.js';
import '../packages/@feezal/feezal-element-circle-climate/feezal-element-circle-climate.js';
// U74: a real glass element so the glass family is available (family-theme test).
import '../packages/@feezal/feezal-element-glass-switch/feezal-element-glass-switch.js';
// The hidden "System" view's chrome elements.
import '../packages/@feezal/feezal-element-system-splash/feezal-element-system-splash.js';
import '../packages/@feezal/feezal-element-system-connection-status/feezal-element-system-connection-status.js';

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
        isEditor: true,                 // the Generate wizard runs in the editor
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

    it('the App family picker excludes basic/material (Devices tile still offers them)', async () => {
        const dlg = await makeDialog();
        dlg._availableFamilies = () => ['glass', 'circle', 'eink', 'basic', 'material'];

        dlg._stage = 'app'; dlg.__devices = []; dlg.requestUpdate(); await dlg.updateComplete;
        const appFams = [...dlg.renderRoot.querySelectorAll('.fam-gallery .fam-name')].map(n => n.textContent.trim());
        expect(appFams).toEqual(expect.arrayContaining(['Glass', 'Circle', 'E-ink']));
        expect(appFams).not.toContain('Basic');
        expect(appFams).not.toContain('Material');

        dlg._stage = 'devices'; dlg.requestUpdate(); await dlg.updateComplete;
        const devFams = [...dlg.renderRoot.querySelectorAll('.families button')].map(b => b.textContent.trim());
        expect(devFams).toEqual(expect.arrayContaining(['Basic', 'Material']));
    });

    it('_chooseApp drops a leftover basic/material selection to the first app family', async () => {
        window.fetch = async url => String(url).includes('/api/discovery/devices')
            ? {ok: true, json: async () => ({devices: []})}
            : {ok: true, json: async () => ({groups: []})};
        const dlg = await makeDialog();
        dlg._availableFamilies = () => ['glass', 'circle', 'basic', 'material'];
        dlg._autoFlow = false;
        dlg._family = 'material';
        await dlg._chooseApp();
        expect(dlg._family).toBe('glass');
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

            // pressing the checkbox unchecks WITHOUT selecting the row
            dlg.renderRoot.querySelector('.row[data-key="d-a"] .cb-hit')
                .dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
            dlg._endDrag();
            await dlg.updateComplete;
            expect(dlg._checked.has('d-a')).toBe(false);
            expect(dlg._selected.has('d-a')).toBe(false);

            // pressing the row body selects WITHOUT changing the checkbox
            dlg._rowPress({preventDefault() {}}, 'd-b');
            await dlg.updateComplete;
            expect(dlg._selected.has('d-b')).toBe(true);
            expect(dlg._checked.has('d-b')).toBe(true);   // unchanged
        });

        it('restores Shift/drag multi-check on the review CHECKBOXES (drives _checked, not _selected)', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen'), dev('d-c', 'Kitchen')]);
            dlg._checked = new Set();                                         // start all unchecked
            // Shift-range check via the checkbox layer
            dlg._checkboxPress({preventDefault() {}, stopPropagation() {}}, 'd-a');          // check a, anchor a
            dlg._checkboxPress({preventDefault() {}, stopPropagation() {}, shiftKey: true}, 'd-c'); // range a..c ON
            dlg._endDrag();
            expect(new Set(dlg._checked)).toEqual(new Set(['d-a', 'd-b', 'd-c']));
            expect(dlg._selected.size).toBe(0);                              // row selection untouched

            // drag-paint uncheck across the checkboxes
            dlg._checkboxPress({preventDefault() {}, stopPropagation() {}}, 'd-a');          // uncheck a, drag off
            dlg._sel.paint('d-b');
            dlg._endDrag();
            expect(dlg._checked.has('d-a')).toBe(false);
            expect(dlg._checked.has('d-b')).toBe(false);
            expect(dlg._selected.size).toBe(0);
        });

        it('row selection is Explorer/Finder-style: plain replaces, Shift ranges, Ctrl toggles', async () => {
            const dlg = await review([dev('d-a', 'Kitchen'), dev('d-b', 'Kitchen'), dev('d-c', 'Kitchen')]);

            dlg._rowPress({preventDefault() {}}, 'd-a');                      // plain → only a
            expect([...dlg._selected]).toEqual(['d-a']);
            dlg._rowPress({preventDefault() {}}, 'd-b');                      // plain again → REPLACES (only b)
            expect([...dlg._selected]).toEqual(['d-b']);

            dlg._rowPress({preventDefault() {}, shiftKey: true}, 'd-c');      // Shift from anchor b → b..c
            expect(new Set(dlg._selected)).toEqual(new Set(['d-b', 'd-c']));

            dlg._rowPress({preventDefault() {}, ctrlKey: true}, 'd-a');       // Ctrl adds a, keeps the rest
            expect(new Set(dlg._selected)).toEqual(new Set(['d-a', 'd-b', 'd-c']));
            dlg._rowPress({preventDefault() {}, metaKey: true}, 'd-b');       // Cmd removes b
            expect(new Set(dlg._selected)).toEqual(new Set(['d-a', 'd-c']));

            // the checkboxes were never touched by row selection
            expect(new Set(dlg._checked)).toEqual(new Set(['d-a', 'd-b', 'd-c']));
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

        it('badges a trusted-area room "area" (lexicon → "guessed", user-added → none)', async () => {
            const dlg = await rooms([dev('d-a', 'x', 'Hobbyraum'), dev('d-b', 'kueche_licht')]);
            const hobby = dlg._rooms.find(r => r.label === 'Hobbyraum');
            const kitchen = dlg._rooms.find(r => r.label === 'Kitchen');
            expect(hobby.area).toBe(true);
            expect(hobby.guessed).toBe(false);
            expect(kitchen.guessed).toBe(true);
            expect(kitchen.area).toBe(false);
            await dlg.updateComplete;
            const badges = [...dlg.renderRoot.querySelectorAll('.room-row .r-badge')].map(b => b.textContent.trim()).sort();
            expect(badges).toEqual(['area', 'guessed']);
            expect(dlg.renderRoot.querySelector('.r-badge.area')).not.toBeNull();

            // a user-added room carries NO badge
            dlg._newRoomName = 'Studio'; dlg._addRoom();
            await dlg.updateComplete;
            const after = [...dlg.renderRoot.querySelectorAll('.room-row .r-badge')].map(b => b.textContent.trim()).sort();
            expect(after).toEqual(['area', 'guessed']);
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
        // U90: generated views are grid, so a card larger than its neighbours
        // (a camera among sensor tiles) does not leave the space beside it dead.
        expect(kitchen.getAttribute('child-position')).toBe('grid');
        expect(kitchen.getAttribute('grid-justify')).toBe('center');
        expect(kitchen.getAttribute('grid-gap')).toBe('10');   // non-glass family
        expect(kitchen.querySelectorAll('[discovery-id]')).toHaveLength(2);
        expect(site.querySelector('feezal-view[name="living-room"]').querySelectorAll('[discovery-id]')).toHaveLength(1);
        expect(dlg._result.added).toBe(3);
        expect(window.feezal.__changes).toBe(1);   // one undo entry
        // U67: Menu is the default (first view) AND is selected after generation
        expect(site.querySelector('feezal-view').getAttribute('name')).toBe('Menu');
        expect(window.feezal.__selectedView).toBe('Menu');
    });

    it('U90: glass drops the grid gap, the flatter families keep one', async () => {
        // Glass cards carry their own outer spacing, so a gap on top of it
        // reads as a double gutter — the only per-family difference here.
        const gapFor = async (family) => {
            site.innerHTML = '';
            const dlg = await makeDialog();
            dlg._family = family;
            dlg._axis = 'room';
            dlg.__devices = DEVICES();
            dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
            dlg._toReview();
            dlg._generateApp();
            const views = [...site.querySelectorAll('feezal-view')];
            const chrome = views.filter(v => ['Menu', 'System'].includes(v.getAttribute('name')));
            const content = views.filter(v => !chrome.includes(v));
            expect(content.length).toBeGreaterThan(0);
            // The chrome views are explicitly NOT converted.
            expect(chrome.map(v => v.getAttribute('child-position')))
                .not.toContain('grid');
            return [...new Set(content.map(v => [v.getAttribute('child-position'),
                v.getAttribute('grid-gap'), v.getAttribute('grid-justify')].join('/')))];
        };
        expect(await gapFor('glass')).toEqual(['grid/0/center']);
        expect(await gapFor('circle')).toEqual(['grid/10/center']);
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
        // U74: written as background-image (the property the Background editor
        // reads) so it renders + reflects without a re-edit. The browser
        // normalises the gradient (drops the default 180deg, hex → rgb).
        const bg = kitchen.style.getPropertyValue('background-image');
        expect(bg).toContain('linear-gradient');
        expect(bg).toContain('2, 132, 199');   // #0284c7
        expect(bg).toContain('30, 41, 59');    // #1e293b
    });

    it('U74: applies the theme through the themes sidebar (so it persists) when reachable', async () => {
        const dlg = await makeDialog();
        let selected = null;
        const themesSidebar = {currentTheme: 'default', _selectTheme: c => { selected = c; }};
        window.feezal.app.shadowRoot = {querySelector: sel => sel === 'feezal-sidebar-themes' ? themesSidebar : null};
        dlg._family = 'glass';
        dlg._axis = 'room';
        dlg.__devices = [{component: 'switch', discovery_id: 'g', name: 'kueche_x', __area: 'Kitchen',
            config: {state_topic: 'z/g', command_topic: 'z/g/set'}, __key: 'g'}];
        dlg._checked = new Set(['g']);
        dlg._toReview();
        dlg._generateApp();
        expect(selected).toBe('feezal-theme-midnight-blue');   // via _selectTheme → persisted
    });

    it('U74: does NOT override a theme the user already picked', async () => {
        const dlg = await makeDialog();
        let selected = null;
        const themesSidebar = {currentTheme: 'feezal-theme-metro', _selectTheme: c => { selected = c; }};
        window.feezal.app.shadowRoot = {querySelector: () => themesSidebar};
        dlg._family = 'glass';
        dlg._axis = 'room';
        dlg.__devices = [{component: 'switch', discovery_id: 'g', name: 'kueche_x', __area: 'Kitchen',
            config: {state_topic: 'z/g', command_topic: 'z/g/set'}, __key: 'g'}];
        dlg._checked = new Set(['g']);
        dlg._toReview();
        dlg._generateApp();
        expect(selected).toBe(null);   // the user's metro theme is respected
    });

    it('adds a hidden "System" view with splash + connection-status, not in the drawer', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        dlg._generateApp();

        const sys = site.querySelector('feezal-view[name="System"]');
        expect(sys).not.toBeNull();
        expect(sys.querySelector('feezal-element-system-splash')).not.toBeNull();
        expect(sys.querySelector('feezal-element-system-connection-status')).not.toBeNull();

        // NOT wired into the drawer
        const shell = site.querySelector('feezal-element-layout-app');
        const items = JSON.parse(shell.getAttribute('items'));
        expect(items.map(i => i.view)).not.toContain('System');
        // …and it's not the active view either
        expect(shell.getAttribute('active-view')).not.toBe('System');
    });

    it('re-running does not duplicate the System view or its elements', async () => {
        const dlg = await makeDialog();
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = DEVICES();
        dlg._checked = new Set(['d-wz', 'd-ku', 'd-x']);
        dlg._toReview();
        dlg._generateApp();
        dlg._toReview();
        dlg._generateApp();   // second run

        expect(site.querySelectorAll('feezal-view[name="System"]')).toHaveLength(1);
        expect(site.querySelectorAll('feezal-element-system-splash')).toHaveLength(1);
        expect(site.querySelectorAll('feezal-element-system-connection-status')).toHaveLength(1);
    });
});

// ── U80: the App generator always creates a NEW site ─────────────────────────
describe('feezal-generate-dialog (U80 new-site App flow)', () => {
    let origFetch;
    beforeEach(() => {
        document.body.innerHTML = '';
        setupFeezal(null);
        window.feezal.siteName = 'kitchen';
        window.feezal.site = document.createElement('div');
        window.feezal.app.views = [];
        window.feezal.app._deploy = () => { window.feezal.__deployed = true; };
        window.feezal.__deployed = false;
        sessionStorage.removeItem('feezal:generateAppSite');
        sessionStorage.removeItem('feezal:generateAppState');
        origFetch = window.fetch;
    });
    afterEach(() => { window.fetch = origFetch; });

    it('_nextSiteName returns the first free siteN', async () => {
        window.fetch = async () => ({ok: true, json: async () => ({sites: ['default', 'site1', 'site3']})});
        const dlg = await makeDialog();
        expect(await dlg._nextSiteName()).toBe('site2');
    });

    it('the App tile asks for a new site name, prefilled with siteN', async () => {
        window.fetch = async () => ({ok: true, json: async () => ({sites: []})});
        const dlg = await makeDialog();
        await dlg._chooseAppOnNewSite();
        expect(dlg._stage).toBe('newsite');
        expect(dlg._newSiteName).toBe('site1');
    });

    it('the name step remembers the name and moves on WITHOUT creating the site', async () => {
        let postCalls = 0;
        window.fetch = async (url, opts) => {
            if (url === '/api/sites' && opts?.method === 'POST') { postCalls++; return {ok: true, json: async () => ({})}; }
            if (String(url).includes('/api/discovery/devices')) return {ok: true, json: async () => ({devices: [{discovery_id: 'x', component: 'switch', name: 'k', config: {}}]})};
            return {ok: true, json: async () => ({sites: []})};
        };
        const dlg = await makeDialog();
        dlg._newSiteName = 'site1';
        await dlg._nameStepNext();
        expect(postCalls).toBe(0);                       // no site created at the name step
        expect(dlg._pendingNewSite).toBe('site1');       // name remembered for the final Generate
        expect(dlg._autoFlow).toBe(true);
        expect(dlg._stage).toBe('app');                  // proceeds to the App setup on the current site
    });

    it('the name step rejects a name that already exists (before proceeding)', async () => {
        window.fetch = async () => ({ok: true, json: async () => ({sites: ['default', 'site1']})});
        const dlg = await makeDialog();
        dlg._stage = 'newsite';        // the name step
        dlg._newSiteName = 'site1';
        await dlg._nameStepNext();
        expect(dlg._error).toMatch(/already exists/i);
        expect(dlg._pendingNewSite).toBeNull();
        expect(dlg._stage).toBe('newsite');   // stays put, does not proceed to App setup
    });

    it('_commitApp creates the site at Generate: POSTs {name, fromSite}, stashes state, navigates', async () => {
        let posted = null;
        window.fetch = async (url, opts) => {
            if (url === '/api/sites' && opts?.method === 'POST') { posted = JSON.parse(opts.body); return {ok: true, json: async () => ({})}; }
            return {ok: true, json: async () => ({sites: []})};
        };
        const dlg = await makeDialog();
        let navUrl = null;
        dlg._navigateTo = u => { navUrl = u; };
        dlg._pendingNewSite = 'site1';
        dlg._family = 'circle'; dlg._axis = 'room';
        dlg._rooms = [{label: 'Kitchen', icon: 'countertops', order: 0}];
        dlg._checked = new Set(['d']);
        dlg._assign = new Map([['d', {label: 'Kitchen', icon: 'countertops'}]]);
        dlg._bucketMeta = new Map([['Kitchen', {order: 0, guessed: false, detected: false}]]);
        await dlg._commitApp();
        expect(posted).toEqual({name: 'site1', fromSite: 'kitchen'});
        expect(sessionStorage.getItem('feezal:generateAppSite')).toBe('site1');
        const state = JSON.parse(sessionStorage.getItem('feezal:generateAppState'));
        expect(state.family).toBe('circle');
        expect(state.checked).toEqual(['d']);
        expect(state.assign).toEqual([['d', {label: 'Kitchen', icon: 'countertops'}]]);
        expect(navUrl).toBe('/editor/?/site1/');
    });

    it('a duplicate name at Generate errors and returns to the name step (no navigation)', async () => {
        window.fetch = async (url, opts) => (url === '/api/sites' && opts?.method === 'POST')
            ? {ok: false, status: 409, json: async () => ({})}
            : {ok: true, json: async () => ({sites: []})};
        const dlg = await makeDialog();
        let navigated = false;
        dlg._navigateTo = () => { navigated = true; };
        dlg._pendingNewSite = 'site1';
        await dlg._createSiteAndGenerate();
        expect(dlg._error).toMatch(/already exists/i);
        expect(navigated).toBe(false);
        expect(dlg._stage).toBe('newsite');
        expect(sessionStorage.getItem('feezal:generateAppSite')).toBeNull();
    });

    it('resumeNewSiteApp restores the stashed selection and generates + deploys', async () => {
        window.fetch = async url => String(url).includes('/api/discovery/devices')
            ? {ok: true, json: async () => ({devices: [{discovery_id: 'd', component: 'switch', name: 'kueche_x',
                config: {state_topic: 'z/d', command_topic: 'z/d/set'}}]})}
            : {ok: true, json: async () => ({groups: []})};
        sessionStorage.setItem('feezal:generateAppState', JSON.stringify({
            family: 'circle', axis: 'room',
            rooms: [{label: 'Kitchen', icon: 'countertops', order: 0}],
            checked: ['d'],
            assign: [['d', {label: 'Kitchen', icon: 'countertops'}]],
            bucketMeta: [['Kitchen', {order: 0, guessed: false, detected: false}]],
        }));
        const dlg = await makeDialog();
        dlg.resumeNewSiteApp();
        // resume awaits discovery + generation; poll resolves on attempt 1 (devices present)
        await new Promise(r => setTimeout(r, 50));
        expect(dlg._family).toBe('circle');
        expect(dlg._checked.has('d')).toBe(true);
        expect(window.feezal.__deployed).toBe(true);                                     // auto-deployed
        expect(window.feezal.site.querySelector('feezal-element-circle-switch')).not.toBeNull();
        expect(sessionStorage.getItem('feezal:generateAppState')).toBeNull();            // consumed
    });

    it('the deferred result screen skips the family screen, shows progress, and unlocks the viewer link only after deploy', async () => {
        let deployDone = null;
        window.feezal.app._deploy = cb => { window.feezal.__deployed = true; deployDone = cb; };  // hold the callback
        window.fetch = async url => String(url).includes('/api/discovery/devices')
            ? {ok: true, json: async () => ({devices: [{discovery_id: 'd', component: 'switch', name: 'kueche_x',
                config: {state_topic: 'z/d', command_topic: 'z/d/set'}}]})}
            : {ok: true, json: async () => ({groups: []})};
        const dlg = await makeDialog();
        dlg._autoFlow = true;
        await dlg._resumeGenerate({
            family: 'circle', axis: 'room',
            rooms: [{label: 'Kitchen', icon: 'countertops', order: 0}],
            checked: ['d'],
            assign: [['d', {label: 'Kitchen', icon: 'countertops'}]],
            bucketMeta: [['Kitchen', {order: 0}]],
        });
        await dlg.updateComplete;

        // Never re-showed the family/setup screen — went straight to the result.
        expect(dlg._stage).toBe('result');
        // Deploy started but not finished → working state: progress + DISABLED link.
        expect(dlg._genPhase).toBe('deploying');
        expect(dlg.renderRoot.querySelector('.gen-progress')).not.toBeNull();
        expect(dlg.renderRoot.querySelector('.viewer-link.disabled')).not.toBeNull();
        expect(dlg.renderRoot.querySelector('a.viewer-link')).toBeNull();                 // no live link yet
        expect(dlg.renderRoot.querySelector('.footer sl-button[disabled]')).not.toBeNull();

        // Finish the deploy → done: the real (enabled) viewer link appears.
        deployDone();
        await dlg.updateComplete;
        expect(dlg._genPhase).toBe('done');
        expect(dlg.renderRoot.querySelector('.viewer-link.disabled')).toBeNull();
        const link = dlg.renderRoot.querySelector('a.viewer-link');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('/viewer/kitchen/');
    });

    it('resumeNewSiteApp opens at the App setup in auto-deploy mode', async () => {
        window.fetch = async url => String(url).includes('/api/discovery/devices')
            ? {ok: true, json: async () => ({devices: [{discovery_id: 'x', component: 'switch', name: 'k', config: {}}]})}
            : {ok: true, json: async () => ({groups: []})};
        const dlg = await makeDialog();
        dlg.resumeNewSiteApp();
        expect(dlg._autoFlow).toBe(true);
        expect(dlg._stage).toBe('app');   // _loadInto sets the stage synchronously
    });

    it('the App setup polls discovery on a fresh site until devices appear (auto-flow)', async () => {
        let calls = 0;
        window.fetch = async url => {
            if (String(url).includes('/api/discovery/devices')) {
                calls++;
                return {ok: true, json: async () => ({devices: calls >= 2
                    ? [{discovery_id: 'x', component: 'switch', name: 'kueche', config: {}}] : []})};
            }
            return {ok: true, json: async () => ({groups: []})};
        };
        const dlg = await makeDialog();
        dlg._autoFlow = true;
        await dlg._loadInto('app');          // attempt 1 empty → waits → attempt 2 has a device
        expect(calls).toBeGreaterThanOrEqual(2);
        expect(dlg.__devices).toHaveLength(1);
    }, 10000);

    it('the auto-flow deploys, drops the empty scaffold view, makes Menu first, and links the viewer', async () => {
        window.fetch = async () => ({ok: true, json: async () => ({devices: []})});
        const dlg = await makeDialog();
        // the new site ships with an empty scaffold view "view1"
        const view1 = document.createElement('feezal-view');
        view1.setAttribute('name', 'view1');
        window.feezal.site.append(view1);

        dlg._autoFlow = true;
        dlg._family = 'circle';
        dlg._axis = 'room';
        dlg.__devices = [{component: 'switch', discovery_id: 'd', name: 'kueche_x', __area: 'Kitchen',
            config: {state_topic: 'z/d', command_topic: 'z/d/set'}, __key: 'd'}];
        dlg._checked = new Set(['d']);
        dlg._toReview();
        dlg._generateApp();

        expect(window.feezal.__deployed).toBe(true);                                   // auto-deployed
        expect(window.feezal.site.querySelector('feezal-view[name="view1"]')).toBeNull(); // scaffold dropped
        expect(window.feezal.site.querySelector('feezal-view').getAttribute('name')).toBe('Menu'); // Menu first/default
        expect(dlg._stage).toBe('result');
        await dlg.updateComplete;
        const link = dlg.renderRoot.querySelector('.viewer-link');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('/viewer/kitchen/');
    });
});

