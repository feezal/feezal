/**
 * N36 layout-app improvements — the drawer-mode reactivity fix (burger bug),
 * themable chrome style vars, embedded-view background, slim/autohide rail
 * attributes and keyboard/D-pad drawer navigation.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../packages/@feezal/feezal-element-layout-app/feezal-element-layout-app.js';
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
