/**
 * N6 custom inspector component tests — the per-element inspectors declared
 * via `static feezal.inspector`, driven for real: add / edit / reorder /
 * remove, the `feezal-attribute-changed` protocol, and the host wiring in
 * feezal-sidebar-inspector-attributes (#custom-inspector-host).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '@feezal/feezal-element-material-navbar';
import '@feezal/feezal-element-layout-app';
import '../src/feezal-sidebar-inspector-attributes.js';
import {setupFeezal} from './helpers.js';

let feezal;

function makeSite(...viewNames) {
    const site = document.createElement('div');
    for (const name of viewNames) {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        site.append(view);
    }
    document.body.append(site);
    return site;
}

/**
 * Mount a custom inspector wired the way the attributes sidebar does it:
 * `.element` property + a host listener applying feezal-attribute-changed.
 */
async function mountInspector(tag, element) {
    const inspector = document.createElement(tag);
    inspector.element = element;
    inspector.addEventListener('feezal-attribute-changed', e => {
        const {name, value} = e.detail;
        element.setAttribute(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
        inspector.requestUpdate();
    });
    document.body.append(inspector);
    await inspector.updateComplete;
    return inspector;
}

const items = el => JSON.parse(el.getAttribute('items') || '[]');

beforeEach(() => {
    feezal = setupFeezal();
    feezal.app = {views: [], requestUpdate() {}, _setView() {}, change() {}};
});

describe('material-navbar inspector', () => {
    it('is declared on the element and registered', () => {
        const cls = customElements.get('feezal-element-material-navbar');
        expect(cls.feezal.inspector).toBe('feezal-element-material-navbar-inspector');
        expect(customElements.get('feezal-element-material-navbar-inspector')).toBeDefined();
    });

    it('adds an item preselecting the first view', async () => {
        feezal.site = makeSite('home', 'kitchen');
        const navbar = document.createElement('feezal-element-material-navbar');
        const inspector = await mountInspector('feezal-element-material-navbar-inspector', navbar);

        inspector.shadowRoot.querySelector('.sec-head .btn').click();
        await inspector.updateComplete;

        expect(items(navbar)).toEqual([{view: 'home'}]);
    });

    it('edits label and icon through the item inputs', async () => {
        feezal.site = makeSite('home');
        const navbar = document.createElement('feezal-element-material-navbar');
        navbar.setAttribute('items', JSON.stringify([{view: 'home'}]));
        const inspector = await mountInspector('feezal-element-material-navbar-inspector', navbar);

        const [labelInput, iconInput] = inspector.shadowRoot.querySelectorAll('.item .grid input');
        labelInput.value = 'Start';
        labelInput.dispatchEvent(new Event('change'));
        await inspector.updateComplete;
        iconInput.value = 'home';
        iconInput.dispatchEvent(new Event('change'));

        expect(items(navbar)).toEqual([{view: 'home', label: 'Start', icon: 'home'}]);
    });

    it('reorders and removes items', async () => {
        feezal.site = makeSite('a', 'b');
        const navbar = document.createElement('feezal-element-material-navbar');
        navbar.setAttribute('items', JSON.stringify([{view: 'a'}, {view: 'b'}]));
        const inspector = await mountInspector('feezal-element-material-navbar-inspector', navbar);

        inspector.shadowRoot.querySelector('.item .ib[title="Move down"]').click();
        await inspector.updateComplete;
        expect(items(navbar).map(i => i.view)).toEqual(['b', 'a']);

        inspector.shadowRoot.querySelector('.item .ib.danger').click();
        await inspector.updateComplete;
        expect(items(navbar).map(i => i.view)).toEqual(['a']);
    });
});

describe('layout-app inspector', () => {
    // U47: "+ add" no longer auto-creates a pageN view — the entry starts
    // unbound; view creation lives in the entry dropdown's create dialog.
    it('"+ add" appends an unbound entry without creating a view', async () => {
        feezal.site = makeSite('main');
        feezal.site.view = 'main';
        const shell = document.createElement('feezal-element-layout-app');
        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);

        // first section is the top bar; the drawer-entries add button is the
        // first .sec-head .btn
        inspector.shadowRoot.querySelector('.sec-head .btn').click();
        await inspector.updateComplete;

        expect(items(shell)).toEqual([{view: ''}]);
        expect(feezal.site.querySelector('feezal-view[name="page1"]')).toBeNull();
    });

    it('the create-view dialog (U47) creates a hidden view and binds the entry', async () => {
        feezal.site = makeSite('main');
        feezal.site.view = 'main';
        feezal.app = {...feezal.app, views: [], requestUpdate() {}, change() {}};
        const shell = document.createElement('feezal-element-layout-app');
        shell.setAttribute('items', JSON.stringify([{view: ''}]));
        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);

        inspector._onEntryViewChange(0, {target: {value: '__feezal-create-new-view__'}});
        inspector._createDlgSubmit();                 // default suggested name: page1
        await inspector.updateComplete;

        expect(items(shell)).toEqual([{view: 'page1', label: 'page1'}]);
        const created = feezal.site.querySelector('feezal-view[name="page1"]');
        expect(created).not.toBeNull();
        expect(created.style.display).toBe('none');   // created hidden, not activated
    });

    it('sets the top bar title via the attribute protocol', async () => {
        feezal.site = makeSite('main');
        const shell = document.createElement('feezal-element-layout-app');
        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);

        const titleInput = inspector.shadowRoot.querySelector('.sec-body input');
        titleInput.value = 'My Home';
        titleInput.dispatchEvent(new Event('change'));

        expect(shell.getAttribute('title')).toBe('My Home');
    });

    it('exposes slim + autohide switches that emit boolean attribute changes (N36)', async () => {
        feezal.site = makeSite('main');
        const shell = document.createElement('feezal-element-layout-app');
        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);
        const emitted = [];
        inspector.addEventListener('feezal-attribute-changed', e => emitted.push({...e.detail}));

        // Locate the switches by their sibling label text.
        const labels = [...inspector.shadowRoot.querySelectorAll('label')];
        const slimSwitch = labels.find(l => /Slim rail/.test(l.textContent))?.querySelector('sl-switch');
        const autohideSwitch = labels.find(l => /Autohide/.test(l.textContent))?.querySelector('sl-switch');
        expect(slimSwitch).toBeTruthy();
        expect(autohideSwitch).toBeTruthy();

        // The real host handler maps a boolean value → set/remove attribute; here
        // we assert the inspector emits the correct boolean (the actual contract).
        slimSwitch.checked = true;
        slimSwitch.dispatchEvent(new CustomEvent('sl-change'));
        autohideSwitch.checked = true;
        autohideSwitch.dispatchEvent(new CustomEvent('sl-change'));
        slimSwitch.checked = false;
        slimSwitch.dispatchEvent(new CustomEvent('sl-change'));

        expect(emitted).toEqual([
            {name: 'slim', value: true},
            {name: 'autohide', value: true},
            {name: 'slim', value: false},
        ]);
    });

    it('removes a drawer entry without touching the view', async () => {
        feezal.site = makeSite('main', 'page1');
        const shell = document.createElement('feezal-element-layout-app');
        shell.setAttribute('items', JSON.stringify([{view: 'page1', label: 'page1'}]));
        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);

        inspector.shadowRoot.querySelector('.item .ib.danger').click();
        await inspector.updateComplete;

        expect(items(shell)).toEqual([]);
        expect(feezal.site.querySelector('feezal-view[name="page1"]')).not.toBeNull();
    });

    it('entry-style select switches pill ↔ list; list renders flat edge-to-edge rows', async () => {
        feezal.site = makeSite('main');
        const shell = document.createElement('feezal-element-layout-app');
        shell.setAttribute('items', JSON.stringify([{view: 'main', label: 'Main'}]));
        document.body.append(shell);
        await shell.updateComplete;

        // default: MD3 pill with inset drawer padding
        const entry = shell.shadowRoot.querySelector('.entry');
        const drawer = shell.shadowRoot.querySelector('.drawer');
        expect(getComputedStyle(entry).borderTopLeftRadius).toBe('24px');
        expect(getComputedStyle(drawer).paddingLeft).toBe('8px');

        const inspector = await mountInspector('feezal-element-layout-app-inspector', shell);
        const drawerSection = [...inspector.shadowRoot.querySelectorAll('.section')].at(-1);
        const styleSelect = drawerSection.querySelector('sl-select');
        styleSelect.value = 'list';
        styleSelect.dispatchEvent(new Event('sl-change'));

        expect(shell.getAttribute('entry-style')).toBe('list');
        await shell.updateComplete;
        // flat rows: no radius, hover/active rectangle spans the full drawer width
        expect(getComputedStyle(entry).borderTopLeftRadius).toBe('0px');
        expect(getComputedStyle(drawer).paddingLeft).toBe('0px');
        expect(entry.getBoundingClientRect().width).toBeCloseTo(drawer.clientWidth, 0);
    });
});

describe('inspector-attributes host wiring', () => {
    it('mounts the declared custom inspector and applies its events to the element', async () => {
        feezal.site = makeSite('home');
        const navbar = document.createElement('feezal-element-material-navbar');
        document.body.append(navbar);

        const host = document.createElement('feezal-sidebar-inspector-attributes');
        host.selectedElems = [navbar];
        document.body.append(host);
        await host.updateComplete;
        await new Promise(r => setTimeout(r, 30));   // _syncCustomInspector runs post-render

        const custom = host.shadowRoot
            .querySelector('#custom-inspector-host feezal-element-material-navbar-inspector');
        expect(custom).not.toBeNull();
        expect(custom.element).toBe(navbar);

        // Drive the real add button — the HOST must serialize + apply the change.
        custom.shadowRoot.querySelector('.sec-head .btn').click();
        await custom.updateComplete;
        expect(items(navbar)).toEqual([{view: 'home'}]);
    });
});
