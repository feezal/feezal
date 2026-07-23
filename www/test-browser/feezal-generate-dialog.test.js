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
        app: {change() { window.feezal.__changes = (window.feezal.__changes || 0) + 1; }},
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
});
