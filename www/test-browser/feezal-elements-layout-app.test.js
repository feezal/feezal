/**
 * N36 layout-app improvements — the drawer-mode reactivity fix (burger bug),
 * themable chrome style vars, embedded-view background, slim/autohide rail
 * attributes and keyboard/D-pad drawer navigation.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
import {moveEntry, filterNav} from '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
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

    const visibleClone = el => [...el.shadowRoot.querySelectorAll('#content feezal-view')].find(v => v.style.display !== 'none');

    it('no churn on redundant re-embed; keeps visited sub-view clones warm (mounted) when pause is off', async () => {
        const site = document.createElement('div');   // no pause-hidden-subscriptions → keep-alive
        for (const name of ['page1', 'page2']) {
            const v = document.createElement('feezal-view');
            v.setAttribute('name', name);
            site.append(v);
        }
        document.body.append(site);
        feezal.site = site;

        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el._active = 'page1';
        el._embed(true);
        const p1 = visibleClone(el);
        expect(p1.getAttribute('name')).toBe('page1');

        el._embed(true);   // SAME view, forced → must NOT tear down + rebuild the live clone
        expect(visibleClone(el)).toBe(p1);

        el._active = 'page2';   // switch → page1 stays MOUNTED (warm, hidden), page2 shown
        el._embed(true);
        const clones = [...el.shadowRoot.querySelectorAll('#content feezal-view')];
        expect(clones).toHaveLength(2);              // page1 clone kept alive
        expect(clones).toContain(p1);
        expect(p1.style.display).toBe('none');       // …but hidden
        expect(visibleClone(el).getAttribute('name')).toBe('page2');

        el._active = 'page1';   // back → reuses the SAME page1 clone (no new one, no re-subscribe)
        el._embed(true);
        expect([...el.shadowRoot.querySelectorAll('#content feezal-view')]).toHaveLength(2);
        expect(visibleClone(el)).toBe(p1);
    });

    it('with pause-hidden on, tears down the old clone only AFTER the grace period (not immediately)', async () => {
        vi.useFakeTimers();
        try {
            const site = document.createElement('div');
            site.setAttribute('pause-hidden-subscriptions', '');
            site.setAttribute('pause-grace-seconds', '30');
            for (const name of ['page1', 'page2']) {
                const v = document.createElement('feezal-view');
                v.setAttribute('name', name);
                site.append(v);
            }
            document.body.append(site);
            feezal.site = site;

            const el = await mount('feezal-element-layout-app', {items: ITEMS});
            el._active = 'page1'; el._embed(true);
            el._active = 'page2'; el._embed(true);

            // page1 is hidden but STILL MOUNTED (grace running — no immediate unsubscribe)
            let byName = () => Object.fromEntries([...el.shadowRoot.querySelectorAll('#content feezal-view')].map(v => [v.getAttribute('name'), v]));
            expect(byName().page1).toBeDefined();
            expect(byName().page1.style.display).toBe('none');

            // switching back within the grace keeps the SAME clone (no re-subscribe)
            const page1Clone = byName().page1;
            el._active = 'page1'; el._embed(true);
            expect(byName().page1).toBe(page1Clone);
            vi.advanceTimersByTime(30000);                 // grace elapsed, but page1 is shown now
            expect(byName().page1).toBe(page1Clone);        // survived (it's the active one)

            // leave it hidden past the grace → torn down (unsubscribe)
            el._active = 'page2'; el._embed(true);
            vi.advanceTimersByTime(30000);
            const clones = [...el.shadowRoot.querySelectorAll('#content feezal-view')];
            expect(clones).toHaveLength(1);
            expect(clones[0].getAttribute('name')).toBe('page2');
        } finally {
            vi.useRealTimers();
        }
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

/**
 * U50 — the content-area inset.
 *
 * The reason this is a browser test rather than a unit test: the whole risk in
 * the item is a LAYOUT one. The content area is "flex: 1" (flex-basis 0%), so
 * under content-box sizing the grown size is the CONTENT box and the padding
 * is added on top — the item overflows its container by exactly the padding
 * and "overflow: auto" becomes permanent scrollbars. Only real layout catches
 * that, which is why the assertions measure scrollWidth against clientWidth
 * rather than just reading the computed style back.
 */
describe('content inset (U50)', () => {
    const contentOf = el => el.shadowRoot.querySelector('.content');
    const innerOf = el => el.shadowRoot.querySelector('#content');

    async function sized(padding) {
        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el.style.width = '800px';
        el.style.height = '600px';
        if (padding !== undefined) el.style.setProperty('--feezal-app-content-padding', padding);
        await until(() => contentOf(el)?.clientWidth > 0);
        return el;
    }

    it('defaults to no inset', async () => {
        const el = await sized();
        const cs = getComputedStyle(contentOf(el));
        expect(cs.paddingTop).toBe('0px');
        expect(cs.paddingLeft).toBe('0px');
    });

    it('applies the inset to the content area', async () => {
        const el = await sized('16px');
        const cs = getComputedStyle(contentOf(el));
        expect([cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft])
            .toEqual(['16px', '16px', '16px', '16px']);
    });

    it('does NOT overflow — no permanent scrollbars', async () => {
        const el = await sized('24px');
        const content = contentOf(el);
        // scrollWidth/Height must not exceed the client box: that is exactly
        // the content-box regression the item warns about.
        expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
        expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1);
    });

    it('shrinks the embedded area by the inset instead of pushing it out', async () => {
        const bare = await sized();
        const bareWidth = innerOf(bare).getBoundingClientRect().width;
        const inset = await sized('20px');
        const insetWidth = innerOf(inset).getBoundingClientRect().width;
        expect(Math.round(bareWidth - insetWidth)).toBe(40);   // 20px each side
    });

    it('accepts a per-side shorthand', async () => {
        const el = await sized('4px 12px 20px 28px');
        const cs = getComputedStyle(contentOf(el));
        expect([cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft])
            .toEqual(['4px', '12px', '20px', '28px']);
    });

    it('is declared as a style knob with a 0 default', async () => {
        const cls = customElements.get('feezal-element-layout-app');
        const knob = cls.feezal.styles.find(s => s?.property === '--feezal-app-content-padding');
        expect(knob).toBeTruthy();
        expect(knob.default).toBe('0');
        expect(knob.type).toBe('string');   // a shorthand, not a number
    });
});

describe('header modes + active-page label (N39)', () => {
    it('header=small-only hides the bar when wide, shows it when narrow', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, header: 'small-only'});
        el._narrow = false; await el.updateComplete;
        expect(el.shadowRoot.querySelector('.bar')).toBeFalsy();   // wide → no bar
        el._narrow = true; await el.updateComplete;
        expect(el.shadowRoot.querySelector('.bar')).toBeTruthy();  // narrow → bar with hamburger
        expect(el.shadowRoot.querySelector('.bar .iconbtn')).toBeTruthy();
    });

    it('header=never never renders the bar; the floating hamburger appears when narrow', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, header: 'never', 'drawer-persistent': ''});
        el.drawerPersistent = false;
        el._narrow = true; await el.updateComplete;
        expect(el.shadowRoot.querySelector('.bar')).toBeFalsy();
        expect(el.shadowRoot.querySelector('.fab-menu')).toBeTruthy();
    });

    it('hide-header stays a deprecated alias for header=never', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, 'hide-header': ''});
        await el.updateComplete;
        expect(el._headerMode).toBe('never');
        expect(el.shadowRoot.querySelector('.bar')).toBeFalsy();
    });

    it('shows the active entry label in the bar, next to the title', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, title: 'My App'});
        el._active = 'page2'; await el.updateComplete;
        const label = el.shadowRoot.querySelector('.bar .active-label');
        expect(label).toBeTruthy();
        expect(label.textContent).toContain('Two');            // the page2 entry's label
        expect(el.shadowRoot.querySelector('.bar .app-title').textContent).toBe('My App');
    });

    it('falls back to the view name when the entry has no label', async () => {
        const items = JSON.stringify([{view: 'kitchen'}, {view: 'bath'}]);
        const el = await mount('feezal-element-layout-app', {items});
        el._active = 'bath'; await el.updateComplete;
        expect(el.shadowRoot.querySelector('.bar .active-label').textContent).toContain('bath');
    });

    it('show-active-label=false suppresses the label', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, 'show-active-label': 'false'});
        el._active = 'page1'; await el.updateComplete;
        expect(el.shadowRoot.querySelector('.bar .active-label')).toBeFalsy();
    });
});

describe('rail model — three zones + deprecated aliases (B84)', () => {
    const wide = async (attrs) => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, ...attrs});
        el.style.width = '1000px';
        await until(() => el._narrow === false && el.clientWidth > 768);
        await el.updateComplete;
        return el;
    };

    it('rail=slim → rail-state="slim" when wide', async () => {
        const el = await wide({rail: 'slim'});
        expect(el.getAttribute('rail-state')).toBe('slim');
    });

    it('rail=edge → rail-state="edge"', async () => {
        const el = await wide({rail: 'edge'});
        expect(el.getAttribute('rail-state')).toBe('edge');
    });

    it('rail=off (default) → no rail-state (full drawer)', async () => {
        const el = await wide({});
        expect(el.hasAttribute('rail-state')).toBe(false);
    });

    it('deprecated slim → rail-state="slim"; autohide → "edge"; explicit rail wins', async () => {
        expect((await wide({slim: ''})).getAttribute('rail-state')).toBe('slim');
        expect((await wide({autohide: ''})).getAttribute('rail-state')).toBe('edge');
        // explicit rail overrides a stale deprecated boolean
        expect((await wide({slim: '', rail: 'off'})).hasAttribute('rail-state')).toBe(false);
    });

    it('rail=auto → slim in the middle zone, full above rail-breakpoint', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, rail: 'auto', 'rail-breakpoint': '1024'});
        el.style.width = '900px';   // breakpoint(768) ≤ 900 < 1024 → slim
        await until(() => el.clientWidth === 900);
        el._recomputeNarrow();      // derive deterministically (RO is async)
        expect(el.getAttribute('rail-state')).toBe('slim');
        el.style.width = '1200px';  // ≥ 1024 → full drawer
        await until(() => el.clientWidth === 1200);
        el._recomputeNarrow();
        expect(el.hasAttribute('rail-state')).toBe(false);
    });

    it('narrow overlay clears the rail-state', async () => {
        const el = await wide({rail: 'slim'});
        el.style.width = '400px';   // < breakpoint → overlay
        await until(() => el._narrow === true);
        await el.updateComplete;
        expect(el.hasAttribute('rail-state')).toBe(false);
        expect(el.classList.contains('narrow')).toBe(true);
    });
});

describe('rail expansion overlays the content (U64)', () => {
    const wideRail = async (attrs) => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS, rail: 'slim', ...attrs});
        el.style.width = '1000px';
        await until(() => el.getAttribute('rail-state') === 'slim');
        await el.updateComplete;
        return el;
    };

    it('overlay (default): drawer is out of flow and the content reserves the rest width', async () => {
        const el = await wideRail({});
        const drawer = el.shadowRoot.querySelector('.drawer');
        const content = el.shadowRoot.querySelector('.content');
        expect(getComputedStyle(drawer).position).toBe('absolute');   // out of flow → expansion overlays
        expect(getComputedStyle(content).marginLeft).toBe('64px');     // content held at the rest rail width
    });

    it('push: drawer stays in flow (no absolute, no content margin)', async () => {
        const el = await wideRail({'rail-expand': 'push'});
        const drawer = el.shadowRoot.querySelector('.drawer');
        const content = el.shadowRoot.querySelector('.content');
        expect(getComputedStyle(drawer).position).not.toBe('absolute');
        expect(getComputedStyle(content).marginLeft).toBe('0px');
    });

    it('rail-menu-button opens the drawer as an overlay and select closes it', async () => {
        const el = await wideRail({'rail-menu-button': ''});
        const btn = el.shadowRoot.querySelector('.rail-menu');
        expect(btn).toBeTruthy();
        btn.click();
        await el.updateComplete;
        expect(el._drawerOpen).toBe(true);
        expect(el.shadowRoot.querySelector('.drawer.rail-open')).toBeTruthy();
        expect(el.shadowRoot.querySelector('.scrim')).toBeTruthy();
        el._select('page2');
        await el.updateComplete;
        expect(el._drawerOpen).toBe(false);
    });

    it('the rail-menu button survives header=never (no app bar to host it)', async () => {
        const el = await wideRail({'rail-menu-button': '', header: 'never'});
        expect(el.shadowRoot.querySelector('.bar')).toBeFalsy();
        expect(el.shadowRoot.querySelector('.rail-menu')).toBeTruthy();
    });
});

// ─── U103: two-level navigation ────────────────────────────────────────────

const NESTED = JSON.stringify([
    {label: 'Living', icon: 'weekend', items: [
        {label: 'Lights', icon: 'light', view: 'liv-lights'},
        {label: 'Climate', view: 'liv-climate'},
    ]},
    {label: 'Garden', items: [
        {label: 'Irrigation', view: 'garden-irr'},
    ]},
    {label: 'Info', icon: 'info', view: 'info'},
]);

async function wideNested(attrs = {}) {
    const el = await mount('feezal-element-layout-app', {items: NESTED, ...attrs});
    el.style.width = '1000px';
    await until(() => el._narrow === false);
    await el.updateComplete;
    return el;
}

describe('U103 nav model (nested items parsing)', () => {
    it('parses sections + childless leaves; leaves stay flat and ordered', async () => {
        const el = await mount('feezal-element-layout-app', {items: NESTED});
        const nav = el._nav();
        expect(nav.hasSections).toBe(true);
        expect(nav.tree.length).toBe(3);
        expect(nav.tree[0].slug).toBe('living');
        expect(nav.leaves.map(e => e.view)).toEqual(['liv-lights', 'liv-climate', 'garden-irr', 'info']);
        expect(nav.sectionOf.get('garden-irr').slug).toBe('garden');
        expect(nav.sectionOf.has('info')).toBe(false);
    });

    it('flattens deeper nesting into the section with one console warning', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const deep = JSON.stringify([{label: 'S', items: [
            {label: 'Sub', items: [{label: 'Deep', view: 'deep1'}]},
            {view: 'flat1'},
        ]}]);
        const el = await mount('feezal-element-layout-app', {items: deep});
        expect(el._nav().leaves.map(e => e.view)).toEqual(['deep1', 'flat1']);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('a FLAT items list renders the classic drawer whatever nav-style says', async () => {
        const el = await wideNested({items: ITEMS, 'nav-style': 'rail-panel'});
        expect(el._navStyleEffective).toBe('flat');
        expect(el.shadowRoot.querySelector('.rail')).toBeFalsy();
        expect(el.shadowRoot.querySelectorAll('.drawer .entry').length).toBe(2);
    });
});

describe('U103 groups (accordion)', () => {
    it('renders section heads; the active section starts expanded, others collapsed', async () => {
        const el = await wideNested();
        expect(el._active).toBe('liv-lights');
        const heads = [...el.shadowRoot.querySelectorAll('.ghead')];
        expect(heads.length).toBe(2);
        expect(heads[0].classList.contains('open')).toBe(true);
        expect(heads[1].classList.contains('open')).toBe(false);
        // children of the open section + the childless entry are visible
        expect(el.shadowRoot.querySelectorAll('.gkids .entry').length).toBe(2);
    });

    it('opening a section header navigates to its landing page; re-click just collapses (section-toggle: header)', async () => {
        const el = await wideNested({'section-toggle': 'header'});
        const garden = el.shadowRoot.querySelectorAll('.ghead')[1];
        garden.click();
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');
        expect(el._openSections.has('garden')).toBe(true);
        el.shadowRoot.querySelectorAll('.ghead')[1].click();   // collapse
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(false);
        expect(el._active).toBe('garden-irr');                 // no navigation change
    });
});

describe('U103 rail-panel', () => {
    it('wide: icon rail (sections + childless) + entry panel; section memory on re-activation', async () => {
        const el = await wideNested({'nav-style': 'rail-panel'});
        const rail = [...el.shadowRoot.querySelectorAll('.rail .rentry')];
        expect(rail.length).toBe(3);
        expect(el.shadowRoot.querySelectorAll('.panel .entry').length).toBe(2);
        // visit the second Living page, hop to Garden, come back → remembered
        [...el.shadowRoot.querySelectorAll('.panel .entry')][1].click();
        await el.updateComplete;
        expect(el._active).toBe('liv-climate');
        rail[1].click();
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');
        [...el.shadowRoot.querySelectorAll('.rail .rentry')][0].click();
        await el.updateComplete;
        expect(el._active).toBe('liv-climate');
    });

    it('ignores the rail knob family (mutually exclusive) — no rail-state derived', async () => {
        const el = await wideNested({'nav-style': 'rail-panel', rail: 'slim'});
        expect(el.hasAttribute('rail-state')).toBe(false);
        expect(el.shadowRoot.querySelector('.rail')).toBeTruthy();
    });

    it('narrow: merges into ONE accordion overlay drawer (no rail)', async () => {
        const el = await wideNested({'nav-style': 'rail-panel'});
        el.style.width = '400px';
        await until(() => el._narrow === true);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.rail')).toBeFalsy();
        expect(el.shadowRoot.querySelector('.drawer .ghead')).toBeTruthy();
    });
});

describe('U103 tabs', () => {
    it("drawer lists sections; the active section's pages form the tab row; tab click navigates", async () => {
        const el = await wideNested({'nav-style': 'tabs'});
        expect(el.shadowRoot.querySelector('.ghead')).toBeFalsy();
        const tabs = [...el.shadowRoot.querySelectorAll('.tabrow .tab')];
        expect(tabs.map(t => t.textContent.trim())).toEqual(['Lights', 'Climate']);
        tabs[1].click();
        await el.updateComplete;
        expect(el._active).toBe('liv-climate');
        expect(el.shadowRoot.querySelector('.tabrow .tab.active').textContent.trim()).toBe('Climate');
    });

    it('a childless active entry shows no tab row; a section entry navigates to its landing page', async () => {
        const el = await wideNested({'nav-style': 'tabs'});
        const entries = [...el.shadowRoot.querySelectorAll('.drawer .entry')];
        entries[2].click();   // Info (childless)
        await el.updateComplete;
        expect(el._active).toBe('info');
        expect(el.shadowRoot.querySelector('.tabrow')).toBeFalsy();
        [...el.shadowRoot.querySelectorAll('.drawer .entry')][1].click();   // Garden section
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');
        expect(el.shadowRoot.querySelector('.tabrow')).toBeTruthy();
    });
});


// ─── U107: two-level follow-ups ───────────────────────────────────────────

describe('U107 chevron-only collapse (the new default)', () => {
    it('a header click ALWAYS navigates and never collapses', async () => {
        const el = await wideNested();
        expect(el.sectionToggle).toBe('chevron');            // the flipped default
        const garden = el.shadowRoot.querySelectorAll('.ghead')[1];
        garden.click();                                       // closed → open + navigate
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');
        expect(el._openSections.has('garden')).toBe(true);

        el._select('info', false);                            // move elsewhere…
        await el.updateComplete;
        el.shadowRoot.querySelectorAll('.ghead')[1].click();  // …header again: open section
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(true);    // did NOT collapse
        expect(el._active).toBe('garden-irr');                // navigated back
    });

    it('only the chevron collapses — and collapsing does not navigate', async () => {
        const el = await wideNested();
        el.shadowRoot.querySelectorAll('.ghead')[1].click();  // open garden
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');

        const chev = el.shadowRoot.querySelectorAll('.ghead')[1].querySelector('.chev');
        chev.click();
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(false);   // collapsed
        expect(el._active).toBe('garden-irr');                // no navigation change

        chev.click();                                          // chevron re-opens too
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(true);
        expect(el._active).toBe('garden-irr');                // still no navigation
    });

    it('in header mode the chevron is inert on its own (bubbles to the header)', async () => {
        const el = await wideNested({'section-toggle': 'header'});
        const head = el.shadowRoot.querySelectorAll('.ghead')[1];
        head.querySelector('.chev').click();                  // behaves as a header click
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(true);
        expect(el._active).toBe('garden-irr');
    });

    it('keyboard Left/Right on a focused header works in both modes', async () => {
        for (const mode of ['chevron', 'header']) {
            const el = await wideNested({'section-toggle': mode});
            const head = el.shadowRoot.querySelectorAll('.ghead')[1];
            head.focus();
            head.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
            await el.updateComplete;
            expect(el._openSections.has('garden'), mode).toBe(true);
            head.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
            await el.updateComplete;
            expect(el._openSections.has('garden'), mode).toBe(false);
            el.remove();
        }
    });
});

describe('U107 two-row tab bar (tab-sections: row)', () => {
    it('default keeps one row — sections stay in the drawer', async () => {
        const el = await wideNested({'nav-style': 'tabs'});
        expect(el.shadowRoot.querySelector('.tabrow.sects')).toBeFalsy();
        expect(el.shadowRoot.querySelectorAll('.tabrow').length).toBe(1);
    });

    it('row mode renders sections as a first tab row, pages beneath', async () => {
        const el = await wideNested({'nav-style': 'tabs', 'tab-sections': 'row'});
        const rows = el.shadowRoot.querySelectorAll('.tabrow');
        expect(rows.length).toBe(2);
        expect(rows[0].classList.contains('sects')).toBe(true);
        // sections + the childless entry, in tree order
        const sectTabs = [...rows[0].querySelectorAll('.tab')].map(t => t.textContent.trim());
        expect(sectTabs).toEqual(['Living', 'Garden', 'Info']);
        // the pages row lists the active section's pages
        const pageTabs = [...rows[1].querySelectorAll('.tab')].map(t => t.textContent.trim());
        expect(pageTabs).toEqual(['Lights', 'Climate']);
    });

    it('a section tab switches the pages row; a childless tab navigates directly', async () => {
        const el = await wideNested({'nav-style': 'tabs', 'tab-sections': 'row'});
        const sectTab = (label) => [...el.shadowRoot.querySelectorAll('.tabrow.sects .tab')]
            .find(t => t.textContent.trim() === label);
        sectTab('Garden').click();
        await el.updateComplete;
        expect(el._active).toBe('garden-irr');
        const pageTabs = [...el.shadowRoot.querySelectorAll('.tabrow:not(.sects) .tab')]
            .map(t => t.textContent.trim());
        expect(pageTabs).toEqual(['Irrigation']);

        sectTab('Info').click();
        await el.updateComplete;
        expect(el._active).toBe('info');
        // a childless entry has no pages row
        expect(el.shadowRoot.querySelector('.tabrow:not(.sects)')).toBeFalsy();
    });

    it('arrow keys stay within one row — the rows are separate groups', async () => {
        const el = await wideNested({'nav-style': 'tabs', 'tab-sections': 'row'});
        const sectRow = el.shadowRoot.querySelector('.tabrow.sects');
        const first = sectRow.querySelector('.tab');
        first.focus();
        sectRow.dispatchEvent(Object.assign(
            new KeyboardEvent('keydown', {key: 'End', bubbles: true}), {}));
        await el.updateComplete;
        // End lands on the LAST tab of the sections row, not of the pages row.
        expect(el.shadowRoot.activeElement.textContent.trim()).toBe('Info');
    });
});

describe('U107 drag-handle move model (moveEntry)', () => {
    const tree = () => ([
        {label: 'Living', items: [
            {label: 'Lights', view: 'liv-lights'},
            {label: 'Climate', view: 'liv-climate'},
        ]},
        {label: 'Garden', items: [{label: 'Irrigation', view: 'garden-irr'}]},
        {label: 'Info', icon: 'info', view: 'info'},
    ]);
    const views = l => l.map(n => n.items ? `[${n.items.map(k => k.view).join(',')}]` : n.view).join(' ');

    it('reorders top-level rows (before / after)', () => {
        expect(views(moveEntry(tree(), [2], [0], 'before')))
            .toBe('info [liv-lights,liv-climate] [garden-irr]');
        expect(views(moveEntry(tree(), [0], [1], 'after')))
            .toBe('[garden-irr] [liv-lights,liv-climate] info');
    });

    it('reorders within a section', () => {
        expect(views(moveEntry(tree(), [0, 1], [0, 0], 'before')))
            .toBe('[liv-climate,liv-lights] [garden-irr] info');
    });

    it('re-homes a sub-entry into another section, and out to the top level', () => {
        expect(views(moveEntry(tree(), [0, 0], [1], 'into')))
            .toBe('[liv-climate] [garden-irr,liv-lights] info');
        expect(views(moveEntry(tree(), [1, 0], [2], 'after')))
            .toBe('[liv-lights,liv-climate] [] info garden-irr');
    });

    it('dropping onto a childless item converts it to a section (indent semantics)', () => {
        const next = moveEntry(tree(), [0, 0], [2], 'into');
        const info = next[2];
        expect(info.view).toBeUndefined();                     // no longer a leaf
        expect(info.items.map(k => k.view)).toEqual(['info', 'liv-lights']);
        expect(info.items[0].label).toBe('Info');              // its old self, as first child
        expect(info.icon).toBe('info');                        // section keeps the icon
    });

    it('sections only move at the top level — nesting stays one deep', () => {
        expect(moveEntry(tree(), [0], [1], 'into')).toBeNull();      // section into section
        expect(moveEntry(tree(), [0], [1, 0], 'before')).toBeNull(); // section beside a sub-row
        expect(views(moveEntry(tree(), [1], [0], 'before')))         // plain reorder still fine
            .toBe('[garden-irr] [liv-lights,liv-climate] info');
    });

    it('self-drops and re-homing into the own section are no-ops (null)', () => {
        expect(moveEntry(tree(), [2], [2], 'before')).toBeNull();
        expect(moveEntry(tree(), [0, 1], [0], 'into')).toBeNull();
    });
});

describe('U103 routing (N30 embedded paths)', () => {
    it('routableViews carries bare views AND section/view paths; activeEmbedded is the full path', async () => {
        const el = await wideNested();
        const r = el.routableViews();
        expect(r).toContain('liv-lights');
        expect(r).toContain('living/liv-lights');
        expect(r).toContain('info');
        expect(r).not.toContain('info/info');
        expect(el.activeEmbedded()).toBe('living/liv-lights');
    });

    it('routeToEmbedded resolves three-segment paths AND legacy bare views (section derived)', async () => {
        const el = await wideNested();
        el.routeToEmbedded('garden/garden-irr');
        expect(el._active).toBe('garden-irr');
        expect(el._openSections.has('garden')).toBe(true);
        el.routeToEmbedded('liv-climate');   // legacy two-segment deep link
        expect(el._active).toBe('liv-climate');
        expect(el._sectionMemory.get('living')).toBe('liv-climate');
        el.routeToEmbedded('nope/unknown');
        expect(el._active).toBe('liv-climate');
    });
});

describe('U103 breadcrumb', () => {
    it('renders Section / Page in the bar; the plain label is replaced', async () => {
        const el = await wideNested({breadcrumb: ''});
        expect(el.shadowRoot.querySelector('.crumb-sect').textContent.trim()).toBe('Living');
        expect(el.shadowRoot.querySelector('.crumb-page').textContent.trim()).toBe('Lights');
        expect(el.shadowRoot.querySelector('.active-label')).toBeFalsy();
    });

    it('a childless page renders a single segment', async () => {
        const el = await wideNested({breadcrumb: ''});
        el._select('info');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.crumb-sect')).toBeFalsy();
        expect(el.shadowRoot.querySelector('.crumb-page').textContent.trim()).toBe('Info');
    });
});

describe('U103 keyboard (tree pattern + tab row)', () => {
    it('Right opens a collapsed section head, Left closes it, Left on a child jumps to the head', async () => {
        const el = await wideNested();
        const garden = el.shadowRoot.querySelectorAll('.ghead')[1];
        garden.focus();
        el._onDrawerKeydown({key: 'ArrowRight', preventDefault() {}});
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(true);
        el.shadowRoot.querySelectorAll('.ghead')[1].focus();
        el._onDrawerKeydown({key: 'ArrowLeft', preventDefault() {}});
        await el.updateComplete;
        expect(el._openSections.has('garden')).toBe(false);
        const child = el.shadowRoot.querySelector('.gkids .entry');
        child.focus();
        el._onDrawerKeydown({key: 'ArrowLeft', preventDefault() {}});
        expect(el.shadowRoot.activeElement.classList.contains('ghead')).toBe(true);
    });

    it('rail: Up/Down cycle, Right crosses into the panel, Left returns to the rail', async () => {
        const el = await wideNested({'nav-style': 'rail-panel'});
        const rail = [...el.shadowRoot.querySelectorAll('.rail .rentry')];
        rail[0].focus();
        el._onRailKeydown({key: 'ArrowDown', preventDefault() {}});
        expect(el.shadowRoot.activeElement).toBe(rail[1]);
        el._onRailKeydown({key: 'ArrowRight', preventDefault() {}});
        expect(el.shadowRoot.activeElement.classList.contains('entry')).toBe(true);
        el._onPanelKeydown({key: 'ArrowLeft', preventDefault() {}});
        expect(el.shadowRoot.activeElement.classList.contains('rentry')).toBe(true);
    });

    it('tab row: Left/Right/End move along the tabs', async () => {
        const el = await wideNested({'nav-style': 'tabs'});
        const row = el.shadowRoot.querySelector('.tabrow');
        const tabs = [...row.querySelectorAll('.tab')];
        tabs[0].focus();
        // U107: the handler reads currentTarget — arrows are scoped to ONE row.
        el._onTabKeydown({key: 'ArrowRight', preventDefault() {}, currentTarget: row});
        expect(el.shadowRoot.activeElement).toBe(tabs[1]);
        el._onTabKeydown({key: 'End', preventDefault() {}, currentTarget: row});
        expect(el.shadowRoot.activeElement).toBe(tabs[tabs.length - 1]);
    });
});

describe('B129 narrow overlay drawer: surface behind the FULL scroll height', () => {
    const MANY = JSON.stringify(Array.from({length: 40}, (_, i) => ({label: 'Page ' + i, view: 'p' + i})));

    it('the background host (.drawer, carrying ::before) does not scroll - the inner nav does', async () => {
        const el = await mount('feezal-element-layout-app', {items: MANY});
        el.style.cssText = 'display:block;width:400px;height:300px;position:relative;';
        el._narrow = true;
        await el.updateComplete;
        el._drawerOpen = true;
        await el.updateComplete;

        const drawer = el.shadowRoot.querySelector('.drawer');
        const nav = el.shadowRoot.querySelector('.drawer-nav');
        expect(nav).toBeTruthy();
        // The entries genuinely overflow one drawer viewport.
        expect(nav.scrollHeight).toBeGreaterThan(nav.clientHeight + 50);
        // The element that carries the ::before background layer must NOT be
        // the scroller: an absolutely-positioned pseudo inside a scrolling box
        // sizes to ONE viewport and scrolls away with the content - that WAS
        // the bug (transparent drawer below the first screenful).
        expect(drawer.scrollHeight).toBeLessThanOrEqual(drawer.clientHeight + 1);
        expect(getComputedStyle(drawer).overflowY).not.toBe('auto');
        expect(getComputedStyle(nav).overflowY).toBe('auto');
    });

    it('B90 geometry: the entry inset moved to the scroller unchanged', async () => {
        const el = await mount('feezal-element-layout-app', {items: ITEMS});
        el.style.cssText = 'display:block;width:900px;height:400px;';
        await el.updateComplete;
        const nav = el.shadowRoot.querySelector('.drawer-nav');
        const entry = el.shadowRoot.querySelector('.drawer .entry');
        // Entry left = drawer left + the drawer padding (now on .drawer-nav).
        const drawerBox = el.shadowRoot.querySelector('.drawer').getBoundingClientRect();
        const navPad = parseFloat(getComputedStyle(nav).paddingLeft);
        expect(navPad).toBeGreaterThan(0);
        expect(Math.abs(entry.getBoundingClientRect().left - (drawerBox.left + navPad))).toBeLessThanOrEqual(1);
    });
});

describe('U108 drawer search', () => {
    it('filterNav: pages by label, sections narrowed to hits, section-label match keeps all pages', () => {
        const tree = JSON.parse(NESTED).map((e, i) => e.items ? {...e, slug: 's' + i} : e);
        const f = filterNav(tree, 'ligh');
        expect(f.tree).toHaveLength(1);
        expect(f.tree[0].items.map(k => k.view)).toEqual(['liv-lights']);
        expect(f.open.has('s0')).toBe(true);

        const bySection = filterNav(tree, 'living');
        expect(bySection.tree[0].items.map(k => k.view)).toEqual(['liv-lights', 'liv-climate']);

        const leaf = filterNav(tree, 'info');
        expect(leaf.tree.map(n => n.view)).toEqual(['info']);

        const none = filterNav(tree, 'zzz');
        expect(none.tree).toHaveLength(0);

        expect(filterNav(tree, '').tree).toBe(tree);
    });

    it('the field is opt-in and lives in the drawer SHELL, not the scroller', async () => {
        const off = await wideNested();
        expect(off.shadowRoot.querySelector('.drawer-search')).toBeNull();
        off.remove();

        const el = await wideNested({'drawer-search': ''});
        const field = el.shadowRoot.querySelector('.drawer-search');
        expect(field).toBeTruthy();
        expect(field.parentElement.classList.contains('drawer')).toBe(true);
        expect(field.closest('.drawer-nav')).toBeNull();
    });

    it('filtering narrows the rows, expands hit sections, and clearing restores the open set', async () => {
        const el = await wideNested({'drawer-search': ''});
        el._openSections = new Set();   // everything collapsed by the user
        await el.updateComplete;

        el._setFilter('irr');
        await el.updateComplete;
        const heads = [...el.shadowRoot.querySelectorAll('.ghead')];
        expect(heads).toHaveLength(1);
        expect(heads[0].textContent).toContain('Garden');
        // hit section shows expanded, and the hit is visible
        expect(el.shadowRoot.querySelector('.gkids .entry')).toBeTruthy();
        // the USER set is untouched by the filter expansion
        expect(el._openSections.size).toBe(0);

        el._setFilter('');
        await el.updateComplete;
        expect([...el.shadowRoot.querySelectorAll('.ghead')]).toHaveLength(2);
        expect(el._openSections.size).toBe(0);
        expect(el.shadowRoot.querySelector('.gkids')).toBeNull();
    });

    it('typing debounces into the filter', async () => {
        const el = await wideNested({'drawer-search': ''});
        const input = el.shadowRoot.querySelector('.drawer-search input');
        input.value = 'irr';
        input.dispatchEvent(new Event('input', {bubbles: true}));
        expect(el._drawerFilter).toBe('');   // not yet - debounced
        await new Promise(r => setTimeout(r, 250));
        expect(el._drawerFilter).toBe('irr');
    });

    it('ArrowDown moves focus from the field into the entry list', async () => {
        const el = await wideNested({'drawer-search': ''});
        const input = el.shadowRoot.querySelector('.drawer-search input');
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, composed: true}));
        expect(el.shadowRoot.activeElement.classList.contains('entry')).toBe(true);
    });

    it('Escape clears first; a second Escape closes the narrow overlay', async () => {
        const el = await mount('feezal-element-layout-app', {items: NESTED, 'drawer-search': ''});
        el.style.width = '400px';
        el._narrow = true;
        await el.updateComplete;
        el._drawerOpen = true;
        el._setFilter('irr');
        await el.updateComplete;

        const input = el.shadowRoot.querySelector('.drawer-search input');
        input.value = 'irr';
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true}));
        await el.updateComplete;
        expect(el._drawerFilter).toBe('');
        expect(el._drawerOpen).toBe(true);   // first Esc only clears

        input.value = '';
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true}));
        await el.updateComplete;
        expect(el._drawerOpen).toBe(false);  // second Esc closes the overlay
    });

    it('rail-panel: the entry panel carries the field and filters its items', async () => {
        const el = await wideNested({'nav-style': 'rail-panel', 'drawer-search': ''});
        const panel = el.shadowRoot.querySelector('.panel');
        expect(panel.querySelector('.drawer-search')).toBeTruthy();
        expect(panel.querySelectorAll('.entry').length).toBe(2);
        el._setFilter('clim');
        await el.updateComplete;
        const entries = [...el.shadowRoot.querySelectorAll('.panel .entry')];
        expect(entries).toHaveLength(1);
        expect(entries[0].textContent).toContain('Climate');
        // the icon RAIL itself is never filtered
        expect(el.shadowRoot.querySelectorAll('.rail .rentry').length).toBe(3);
    });
});
