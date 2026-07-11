import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-material-dialog/feezal-element-material-dialog.js';
import '../packages/@feezal/feezal-element-material-dialog-view/feezal-element-material-dialog-view.js';

let subCallbacks;

beforeEach(() => {
    subCallbacks = {};
    feezal.connection = {
        sub: vi.fn((topic, cb) => { subCallbacks[topic] = cb; return {}; }),
        unsubscribe: vi.fn(),
        pub: vi.fn(),
    };
    feezal.isEditor = false;
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(tag, attrs = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }

    document.body.append(el);
    await el.updateComplete;
    return el;
}

// B24: both dialog elements only exposed width/max-height — a dialog with
// little content collapsed to ~50px with no way to raise the floor.
describe('material-dialog sizing (B24)', () => {
    it('applies height and min-height to the portal panel', async () => {
        const el = await mount('feezal-element-material-dialog', {
            subscribe: 'dlg/a', height: '500px', 'min-height': '300px',
        });
        subCallbacks['dlg/a']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-dialog-portal]');
        expect(portal).toBeTruthy();
        const panel = [...portal.querySelectorAll('div')].find(d => (d.getAttribute('style') || '').includes('min-height'));
        expect(panel.getAttribute('style')).toContain('height:500px');
        expect(panel.getAttribute('style')).toContain('min-height:300px');
    });

    it('empty height/min-height keep auto (back-compat)', async () => {
        const el = await mount('feezal-element-material-dialog', {subscribe: 'dlg/b'});
        subCallbacks['dlg/b']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-dialog-portal]');
        const panel = [...portal.querySelectorAll('div')].find(d => (d.getAttribute('style') || '').includes('min-height'));
        expect(panel.getAttribute('style')).toContain('height:auto');
        expect(panel.getAttribute('style')).toContain('min-height:auto');
    });
});

// B25: both dialogs share the same header contract — title + top-right ✕
// (show-close, default on), hide-header removes the bar entirely.
describe('unified dialog header (B25)', () => {
    const openDialog = async (tag, attrs, topic) => {
        const el = await mount(tag, {subscribe: topic, ...attrs});
        subCallbacks[topic]({payload: 'open'});
        await el.updateComplete;
        return el;
    };

    it('material-dialog shows a header with ✕ by default (parity with dialog-view)', async () => {
        await openDialog('feezal-element-material-dialog', {}, 'hdr/a');
        const portal = document.querySelector('[feezal-dialog-portal]');
        const close = [...portal.querySelectorAll('button')].find(b => b.textContent === 'close');
        expect(close).toBeTruthy();
    });

    it('material-dialog ✕ closes the dialog', async () => {
        const el = await openDialog('feezal-element-material-dialog', {}, 'hdr/b');
        const portal = document.querySelector('[feezal-dialog-portal]');
        [...portal.querySelectorAll('button')].find(b => b.textContent === 'close').click();
        await el.updateComplete;
        expect(document.querySelector('[feezal-dialog-portal]')).toBeNull();
    });

    it('material-dialog without title and show-close=false renders no header', async () => {
        await openDialog('feezal-element-material-dialog', {}, 'hdr/c');
        // show-close is a default-true boolean: simulate the inspector turning
        // it off (removeAttribute) via the property.
        const el = document.querySelector('feezal-element-material-dialog');
        el.showClose = false;
        await el.updateComplete;
        const portal = document.querySelector('[feezal-dialog-portal]');
        expect([...portal.querySelectorAll('button')].find(b => b.textContent === 'close')).toBeFalsy();
    });

    it('hide-header suppresses the bar on material-dialog even with a title', async () => {
        await openDialog('feezal-element-material-dialog', {title: 'Hello', 'hide-header': ''}, 'hdr/d');
        const portal = document.querySelector('[feezal-dialog-portal]');
        expect(portal.textContent).not.toContain('Hello');
        expect([...portal.querySelectorAll('button')].find(b => b.textContent === 'close')).toBeFalsy();
    });

    it('hide-header suppresses the bar on material-dialog-view too', async () => {
        await openDialog('feezal-element-material-dialog-view', {title: 'Hello', 'hide-header': ''}, 'hdr/e');
        const portal = document.querySelector('[feezal-dialog-view-portal]');
        expect(portal.querySelector('.dialog-header')).toBeNull();
    });

    it('material-dialog-view keeps its header by default', async () => {
        await openDialog('feezal-element-material-dialog-view', {title: 'Hi'}, 'hdr/f');
        const portal = document.querySelector('[feezal-dialog-view-portal]');
        expect(portal.querySelector('.dialog-header')).toBeTruthy();
        expect(portal.querySelector('.dialog-close')).toBeTruthy();
    });
});

describe('material-dialog-view sizing (B24)', () => {
    it('mirrors height/min-height convenience attributes onto the portal', async () => {
        const el = await mount('feezal-element-material-dialog-view', {
            subscribe: 'dlgv/a', height: '400px', 'min-height': '250px', 'max-height': '90vh',
        });
        subCallbacks['dlgv/a']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-dialog-view-portal]');
        expect(portal).toBeTruthy();
        expect(portal.style.getPropertyValue('--feezal-dialog-view-height')).toBe('400px');
        expect(portal.style.getPropertyValue('--feezal-dialog-view-min-height')).toBe('250px');
        expect(portal.style.getPropertyValue('--feezal-dialog-view-max-height')).toBe('90vh');
        // The portal panel consumes the min-height token.
        const styleText = portal.querySelector('style').textContent;
        expect(styleText).toContain('min-height: var(--feezal-dialog-view-min-height, auto)');
    });

    it('empty attributes keep the auto default (back-compat)', async () => {
        const el = await mount('feezal-element-material-dialog-view', {subscribe: 'dlgv/b'});
        subCallbacks['dlgv/b']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-dialog-view-portal]');
        // The host default (auto) is mirrored — no explicit floor.
        expect(portal.style.getPropertyValue('--feezal-dialog-view-min-height')).toBe('auto');
    });
});
