/**
 * B128 — view names with spaces broke every sl-select view picker: Shoelace
 * option values are SPACE-DELIMITED, so an option whose value contains a
 * space can never match or round-trip. The fix is one shared helper pair
 * (encodeOptionValue / decodeOptionValue in @feezal/feezal-element) applied
 * to every view-name-fed picker. These tests pin the helpers and drive the
 * REPORTED picker (layout-flex region) plus a dialog-view and the layout-app
 * entry dropdown with a spaced view name end to end.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {encodeOptionValue, decodeOptionValue} from '../packages/@feezal/feezal-element/feezal-option-value.js';
import '../packages/@feezal/feezal-element-layout-flex/feezal-element-layout-flex.js';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../packages/@feezal/feezal-element-glass-dialog-view/feezal-element-glass-dialog-view.js';
import '../src/feezal-view.js';
import {setupFeezal, until} from './helpers.js';

const SPACED = 'Living room';

let feezal;

function siteWith(...names) {
    const site = document.createElement('div');
    for (const n of names) {
        const v = document.createElement('feezal-view');
        v.setAttribute('name', n);
        site.append(v);
    }
    document.body.append(site);
    feezal.site = site;
    feezal.views = site.querySelectorAll('feezal-view');
    return site;
}

beforeEach(() => {
    feezal = setupFeezal();
});

describe('B128 — option-value helpers', () => {
    it('round-trips spaces, umlauts and slashes; sentinels pass unchanged', () => {
        for (const s of [SPACED, 'Büro / Süd', 'a b c', '__feezal-create-new-view__', '']) {
            expect(decodeOptionValue(encodeOptionValue(s))).toBe(s);
        }
        expect(encodeOptionValue(SPACED)).not.toContain(' ');
        // a value we never encoded (raw %) must not throw — passes through
        expect(decodeOptionValue('50%')).toBe('50%');
    });
});

describe('B128 — the pickers round-trip a spaced view name', () => {
    it('layout-flex region picker (the reported case)', async () => {
        siteWith('main', SPACED);
        feezal.app = {views: [], requestUpdate() {}, change() {}, _setView() {}};
        const flex = document.createElement('feezal-element-layout-flex');
        const region = document.createElement('feezal-element-layout-view');
        region.setAttribute('view', 'main');
        flex.append(region);
        document.body.append(flex);

        const inspector = document.createElement('feezal-element-layout-flex-inspector');
        inspector.element = flex;
        document.body.append(inspector);
        await inspector.updateComplete;

        const select = [...inspector.shadowRoot.querySelectorAll('.region-head sl-select')][0];
        const opt = [...select.querySelectorAll('sl-option')].find(o => o.textContent.trim() === SPACED);
        expect(opt, 'spaced view offered').toBeTruthy();
        expect(opt.value).not.toContain(' ');

        // pick it — the region must store the RAW name
        select.value = opt.value;
        select.dispatchEvent(new Event('sl-change'));
        expect(region.getAttribute('view')).toBe(SPACED);
    });

    it('glass-dialog-view picker', async () => {
        siteWith('main', SPACED);
        const el = document.createElement('feezal-element-glass-dialog-view');
        document.body.append(el);
        const inspector = document.createElement('feezal-element-glass-dialog-view-inspector');
        inspector.element = el;
        inspector.addEventListener('feezal-attribute-changed',
            e => el.setAttribute(e.detail.name, e.detail.value));
        document.body.append(inspector);
        await inspector.updateComplete;

        const select = [...inspector.shadowRoot.querySelectorAll('sl-select')]
            .find(s => s.getAttribute('label') === 'view');
        const opt = [...select.querySelectorAll('sl-option')].find(o => o.textContent.trim() === SPACED);
        expect(opt).toBeTruthy();
        expect(opt.value).not.toContain(' ');
        select.value = opt.value;
        select.dispatchEvent(new Event('sl-change'));
        expect(el.getAttribute('view')).toBe(SPACED);
    });

    it('layout-app entry dropdown (create-view sentinel still recognized)', async () => {
        siteWith('main', SPACED);
        feezal.isEditor = true;
        feezal.app = {views: [], requestUpdate() {}, change() {}, _setView() {}};

        const app = document.createElement('feezal-element-layout-app');
        app.setAttribute('items', JSON.stringify([{view: 'main'}]));
        const inspector = document.createElement('feezal-element-layout-app-inspector');
        inspector.element = app;
        inspector.addEventListener('feezal-attribute-changed', e => {
            app.setAttribute(e.detail.name, typeof e.detail.value === 'string'
                ? e.detail.value : JSON.stringify(e.detail.value));
        });
        document.body.append(inspector);
        await inspector.updateComplete;

        const select = inspector.shadowRoot.querySelector('.item-head sl-select, .item sl-select');
        expect(select).toBeTruthy();
        const opt = [...select.querySelectorAll('sl-option')].find(o => o.textContent.trim() === SPACED);
        expect(opt, 'spaced view offered in the entry dropdown').toBeTruthy();
        expect(opt.value).not.toContain(' ');
        select.value = opt.value;
        select.dispatchEvent(new Event('sl-change'));
        await until(() => JSON.parse(app.getAttribute('items'))[0].view === SPACED);

        // the ＋ Create new view… sentinel still opens the dialog (space-free
        // values pass through encoding unchanged, so the comparison holds)
        const sentinel = [...select.querySelectorAll('sl-option')].find(o => o.textContent.includes('Create new view'));
        select.value = sentinel.value;
        select.dispatchEvent(new Event('sl-change'));
        await inspector.updateComplete;
        expect(inspector._createDlg).toBeTruthy();
    });
});
