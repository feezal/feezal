/**
 * N36 layout-app improvements — the drawer-mode reactivity fix (burger bug),
 * themable chrome style vars, embedded-view background, slim/autohide rail
 * attributes and keyboard/D-pad drawer navigation.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import '../src/feezal-view.js';
import {setupFeezal, mount, until} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

const ITEMS = JSON.stringify([
    {label: 'One', icon: 'home', view: 'page1'},
    {label: 'Two', icon: 'settings', view: 'page2'},
]);

describe('drawer-mode reactivity (N36 burger fix)', () => {
    it('toggling drawer-persistent recomputes overlay mode and shows the hamburger — no resize needed', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el.style.width = '1000px';           // wide → persistent, no burger
        await until(() => el._narrow === false || el.clientWidth > 0);
        el.drawerPersistent = false;         // want overlay everywhere
        // _recomputeNarrow runs in updated() and flips the reactive _narrow,
        // scheduling a second render — wait for the burger to actually appear.
        await until(() => el.shadowRoot.querySelector('.bar .iconbtn'));
        expect(el._narrow).toBe(true);
        expect(el.classList.contains('narrow')).toBe(true);

        el.drawerPersistent = true;          // back to persistent
        await until(() => !el.shadowRoot.querySelector('.bar .iconbtn'));
        expect(el._narrow).toBe(false);
    });

    it('a hidden-header overlay shows the floating fab hamburger', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, 'hide-header': '', 'drawer-persistent': ''});
        el.drawerPersistent = false;
        await el.updateComplete;
        el._narrow = true; await el.updateComplete;   // force overlay for the assertion
        expect(el.shadowRoot.querySelector('.fab-menu')).toBeTruthy();
    });
});

describe('themable chrome (N36)', () => {
    const cls = () => customElements.get('feezal-element-layout-app');
    const styleObjs = () => cls().feezal.styles.filter(s => typeof s === 'object');

    it('exposes the --feezal-app-* chrome vars (incl. drawer icon/label + overlay bg) as color styles', () => {
        const props = styleObjs().map(s => s.property);
        for (const v of ['--feezal-app-bar-bg', '--feezal-app-bar-color', '--feezal-app-drawer-bg',
            '--feezal-app-drawer-overlay-bg', '--feezal-app-drawer-overlay-opacity', '--feezal-app-drawer-color',
            '--feezal-app-drawer-icon-color', '--feezal-app-drawer-label-color', '--feezal-app-active-indicator',
            '--feezal-app-active-color']) {
            expect(props).toContain(v);
        }
    });

    it('overlay transparency is a plain 0–100 opacity knob (default 100 = opaque)', () => {
        const op = styleObjs().find(s => s.property === '--feezal-app-drawer-overlay-opacity');
        expect(op).toBeTruthy();
        expect(op.default).toBe('100');
        expect(op.type).not.toBe('color');   // a number, not a colour picker
    });

    it('defaults use only the canonical theme vars (no --md-sys-color-*), per requested mapping', () => {
        const byProp = Object.fromEntries(styleObjs().map(s => [s.property, s.default]));
        // No MD3 tokens anywhere in the defaults.
        for (const s of styleObjs()) expect(String(s.default)).not.toContain('--md-sys-color');
        // The two explicitly requested mappings.
        expect(byProp['--feezal-app-drawer-bg']).toContain('--divider-color');
        expect(byProp['--feezal-app-drawer-label-color']).toContain('--primary-text-color');
    });
});

describe('slim / autohide rail (N36)', () => {
    it('reflects slim and autohide as host attributes', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el.slim = true; el.autohide = true;
        await el.updateComplete;
        expect(el.hasAttribute('slim')).toBe(true);
        expect(el.hasAttribute('autohide')).toBe(true);
    });
});

describe('keyboard / D-pad drawer navigation (N36)', () => {
    it('Arrow keys move focus between entries and wrap; Escape closes an overlay', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, 'drawer-persistent': ''});
        el.drawerPersistent = false;
        el._drawerOpen = true;
        await el.updateComplete;
        const buttons = [...el.shadowRoot.querySelectorAll('.entry')];
        expect(buttons.length).toBe(2);

        buttons[0].focus();
        el._onDrawerKeydown({key: 'ArrowDown', preventDefault() {}});
        expect(el.shadowRoot.activeElement).toBe(buttons[1]);
        el._onDrawerKeydown({key: 'ArrowDown', preventDefault() {}});   // wraps
        expect(el.shadowRoot.activeElement).toBe(buttons[0]);
        el._onDrawerKeydown({key: 'End', preventDefault() {}});
        expect(el.shadowRoot.activeElement).toBe(buttons[1]);

        el._onDrawerKeydown({key: 'Escape', preventDefault() {}});
        expect(el._drawerOpen).toBe(false);
    });
});

// U47: "+ add" no longer auto-creates a pageN view; view creation moved into
// the entry dropdown ("＋ Create new view…" sentinel → dialog).
describe('drawer-entry management (U47)', () => {
    async function mountInspector(items = []) {
        // Fake enough editor surface for _createView / _saveEntries.
        const site = document.createElement('div');
        document.body.append(site);
        feezal.isEditor = true;
        feezal.site = site;
        feezal.app = {views: [], requestUpdate() {}, change() {}, _setView() {}};

        const target = document.createElement('feezal-element-layout-app');
        target.setAttribute('items', JSON.stringify(items));

        const inspector = document.createElement('feezal-element-layout-app-inspector');
        inspector.element = target;
        // The editor's attribute panel applies emitted changes — mirror that.
        inspector.addEventListener('feezal-attribute-changed', e => {
            target.setAttribute(e.detail.name, typeof e.detail.value === 'string'
                ? e.detail.value : JSON.stringify(e.detail.value));
        });
        document.body.append(inspector);
        await inspector.updateComplete;
        return {inspector, target, site};
    }

    it('"+ add" appends an unbound entry and creates NO view', async () => {
        const {inspector, target, site} = await mountInspector();
        inspector._addEntry();
        await inspector.updateComplete;

        const items = JSON.parse(target.getAttribute('items'));
        expect(items).toEqual([{view: ''}]);
        expect(site.querySelectorAll('feezal-view')).toHaveLength(0);
        // Unbound entries render nothing in the drawer (runtime filters them).
        expect(target._entries()).toHaveLength(0);
    });

    it('the entry dropdown offers the create-new sentinel after the real views', async () => {
        const {inspector, site} = await mountInspector([{view: ''}]);
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'existing');
        site.append(view);
        inspector._tick++;
        await inspector.updateComplete;

        const options = [...inspector.shadowRoot.querySelectorAll('.item-head sl-select sl-option')];
        expect(options.map(o => o.textContent.trim()).at(-1)).toContain('Create new view');
        expect(options.at(-1).value).not.toBe('existing');
    });

    it('picking the sentinel opens the dialog instead of persisting it', async () => {
        const {inspector, target} = await mountInspector([{view: ''}]);
        inspector._onEntryViewChange(0, {target: {value: '__feezal-create-new-view__'}});
        await inspector.updateComplete;

        expect(inspector._createDlg).toBeTruthy();
        expect(inspector._createDlg.name).toBe('page1');   // suggested default
        expect(JSON.parse(target.getAttribute('items'))[0].view).toBe('');
    });

    it('submit creates the view, binds the entry and defaults the label', async () => {
        const {inspector, target, site} = await mountInspector([{view: ''}]);
        inspector._onEntryViewChange(0, {target: {value: '__feezal-create-new-view__'}});
        inspector._createDlg = {...inspector._createDlg, name: 'heating'};
        inspector._createDlgSubmit();
        await inspector.updateComplete;

        expect(site.querySelector('feezal-view[name="heating"]')).toBeTruthy();
        const item = JSON.parse(target.getAttribute('items'))[0];
        expect(item.view).toBe('heating');
        expect(item.label).toBe('heating');
        expect(inspector._createDlg).toBeNull();
    });

    it('cancel keeps items untouched and restores the previous select value', async () => {
        const {inspector, target, site} = await mountInspector([{view: 'old'}]);
        const fakeSelect = {value: '__feezal-create-new-view__'};
        inspector._onEntryViewChange(0, {target: fakeSelect});
        inspector._createDlgCancel();
        await inspector.updateComplete;

        expect(JSON.parse(target.getAttribute('items'))[0].view).toBe('old');
        expect(fakeSelect.value).toBe('old');
        expect(site.querySelectorAll('feezal-view')).toHaveLength(0);
    });

    it('refuses a duplicate view name', async () => {
        const {inspector, site} = await mountInspector([{view: ''}]);
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'taken');
        site.append(view);

        inspector._onEntryViewChange(0, {target: {value: '__feezal-create-new-view__'}});
        inspector._createDlg = {...inspector._createDlg, name: 'taken'};
        inspector._createDlgSubmit();
        expect(inspector._createDlg).toBeTruthy();               // stays open
        expect(site.querySelectorAll('feezal-view')).toHaveLength(1);
    });
});

describe('embedded view background (N36)', () => {
    it('copies the embedded view’s background onto the shell content area', async () => {
        // Fake site with a background-styled view.
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'page1');
        view.style.backgroundColor = 'rgb(10, 20, 30)';
        site.append(view);
        document.body.append(site);
        feezal.site = site;

        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el._active = 'page1';
        el._embed(true);
        const box = el.shadowRoot.querySelector('.content');
        expect(box.style.backgroundColor).toBe('rgb(10, 20, 30)');
        // and the clone is a block so it lays out with its own size/background
        expect(el.shadowRoot.querySelector('#content feezal-view').style.display).toBe('block');
    });
});

describe('embedded per-view theme (B50)', () => {
    const withThemedView = theme => {
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', 'page1');
        if (theme) view.setAttribute('theme', theme);
        site.append(view);
        document.body.append(site);
        feezal.site = site;
        return view;
    };

    it('mirrors the view theme CSS into the shadow root so the embedded clone renders themed', async () => {
        // Document-level theme CSS, exactly as a theme package injects it —
        // it can never match the clone inside layout-app's shadow root.
        const style = document.createElement('style');
        style.textContent = '.feezal-theme-b50test { --primary-background-color: rgb(1, 2, 3); }';
        document.head.append(style);
        try {
            withThemedView('b50test');
            const el = await mount('feezal-element-layout-app', {items: ITEMS});
            const clone = await until(() => el.shadowRoot.querySelector('#content feezal-view'));
            expect(clone.classList.contains('feezal-theme-b50test')).toBe(true);
            const mirrored = el.shadowRoot.querySelector('#embedded-theme-css');
            expect(mirrored?.textContent).toContain('.feezal-theme-b50test');
            await until(() => getComputedStyle(clone).getPropertyValue('--primary-background-color').trim() === 'rgb(1, 2, 3)');
        } finally {
            style.remove();
        }
    });

    it('a view without a theme mirrors nothing into the shadow root', async () => {
        withThemedView(null);
        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        const clone = await until(() => el.shadowRoot.querySelector('#content feezal-view'));
        expect([...clone.classList].some(c => c.startsWith('feezal-theme-'))).toBe(false);
        const mirrored = el.shadowRoot.querySelector('#embedded-theme-css');
        expect(mirrored?.textContent || '').toBe('');
    });
});
