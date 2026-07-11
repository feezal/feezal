import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../packages/@feezal/feezal-element-paper-dialog/feezal-element-paper-dialog.js';
import '../packages/@feezal/feezal-element-paper-dialog-view/feezal-element-paper-dialog-view.js';
// Imported for the attribute-parity assertions:
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

// E86: the paper dialogs are drop-in equivalents of the material dialogs —
// identical attribute contract (payloads, buttons, B24 sizing, B25 header),
// only the chrome differs.

describe('paper-dialog (E86)', () => {
    it('exposes the identical attribute set as material-dialog', () => {
        const names = cls => cls.feezal.attributes.map(a => (typeof a === 'string' ? a : a.name)).sort();
        expect(names(customElements.get('feezal-element-paper-dialog')))
            .toEqual(names(customElements.get('feezal-element-material-dialog')));
    });

    it('opens on payload-open and closes on payload-close (portal lifecycle)', async () => {
        const el = await mount('feezal-element-paper-dialog', {subscribe: 'dlg/t'});
        expect(document.querySelector('[feezal-paper-dialog-portal]')).toBeNull();

        subCallbacks['dlg/t']({payload: 'open'});
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-portal]')).toBeTruthy();

        subCallbacks['dlg/t']({payload: 'close'});
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-portal]')).toBeNull();
    });

    it('renders the ${msg.*} template body from the triggering message', async () => {
        const el = await mount('feezal-element-paper-dialog', {
            subscribe: 'dlg/t', 'payload-open': 'boom',
            template: 'Alert: ${msg.payload} on ${msg.topic}',
        });
        subCallbacks['dlg/t']({topic: 'dlg/t', payload: 'boom'});
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-portal]').textContent).toContain('Alert: boom on dlg/t');
    });

    it('OK and Cancel publish their payloads and close', async () => {
        const el = await mount('feezal-element-paper-dialog', {
            subscribe: 'dlg/t',
            'ok-label': 'Yes', 'ok-publish': 'answer', 'ok-payload': 'confirmed',
            'cancel-label': 'No', 'cancel-publish': 'answer', 'cancel-payload': 'denied',
        });
        subCallbacks['dlg/t']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-paper-dialog-portal]');
        [...portal.querySelectorAll('button')].find(b => b.textContent === 'Yes').click();
        expect(feezal.connection.pub).toHaveBeenCalledWith('answer', 'confirmed');
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-portal]')).toBeNull();

        subCallbacks['dlg/t']({payload: 'open'});
        await el.updateComplete;
        [...document.querySelectorAll('[feezal-paper-dialog-portal] button')].find(b => b.textContent === 'No').click();
        expect(feezal.connection.pub).toHaveBeenCalledWith('answer', 'denied');
    });

    it('B25 header contract: ✕ by default, hide-header removes the bar', async () => {
        const el = await mount('feezal-element-paper-dialog', {subscribe: 'dlg/t', title: 'Hi'});
        subCallbacks['dlg/t']({payload: 'open'});
        await el.updateComplete;
        let portal = document.querySelector('[feezal-paper-dialog-portal]');
        expect([...portal.querySelectorAll('button')].find(b => b.textContent === 'close')).toBeTruthy();

        el.setAttribute('hide-header', '');
        await el.updateComplete;
        portal = document.querySelector('[feezal-paper-dialog-portal]');
        expect(portal.textContent).not.toContain('Hi');
        expect([...portal.querySelectorAll('button')].find(b => b.textContent === 'close')).toBeFalsy();
    });

    it('B24 sizing: height/min-height reach the portal panel', async () => {
        const el = await mount('feezal-element-paper-dialog', {
            subscribe: 'dlg/t', height: '500px', 'min-height': '300px',
        });
        subCallbacks['dlg/t']({payload: 'open'});
        await el.updateComplete;
        const panel = [...document.querySelectorAll('[feezal-paper-dialog-portal] div')]
            .find(d => (d.getAttribute('style') || '').includes('min-height'));
        expect(panel.getAttribute('style')).toContain('height:500px');
        expect(panel.getAttribute('style')).toContain('min-height:300px');
    });
});

describe('paper-dialog-view (E86)', () => {
    function makeSiteWithView(name) {
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        view.innerHTML = '<span class="embedded-marker">embedded content</span>';
        site.append(view);
        document.body.append(site);
        feezal.site = site;
        return site;
    }

    it('exposes the identical attribute set as material-dialog-view', () => {
        const names = cls => cls.feezal.attributes.map(a => (typeof a === 'string' ? a : a.name)).sort();
        const paper = customElements.get('feezal-element-paper-dialog-view');
        expect(names(paper)).toEqual(names(customElements.get('feezal-element-material-dialog-view')));
        expect(paper.feezal.baseAttribute).toBe('view');
    });

    it('embeds a live clone of the selected view into the portal body', async () => {
        makeSiteWithView('detail');
        const el = await mount('feezal-element-paper-dialog-view', {subscribe: 'dv/t', view: 'detail'});
        subCallbacks['dv/t']({payload: 'open'});
        await el.updateComplete;

        const portal = document.querySelector('[feezal-paper-dialog-view-portal]');
        expect(portal).toBeTruthy();
        expect(portal.querySelector('.dialog-body .embedded-marker')?.textContent).toBe('embedded content');
    });

    it('shows an error note for a missing view and guards self-embedding', async () => {
        makeSiteWithView('other');
        const el = await mount('feezal-element-paper-dialog-view', {subscribe: 'dv/t', view: 'nope'});
        subCallbacks['dv/t']({payload: 'open'});
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-view-portal] .preview-note').textContent)
            .toContain('"nope" not found');
    });

    it('sizing convenience attributes mirror onto the portal tokens (B24)', async () => {
        makeSiteWithView('detail');
        const el = await mount('feezal-element-paper-dialog-view', {
            subscribe: 'dv/t', view: 'detail', 'min-height': '250px', height: '400px',
        });
        subCallbacks['dv/t']({payload: 'open'});
        await el.updateComplete;
        const portal = document.querySelector('[feezal-paper-dialog-view-portal]');
        expect(portal.style.getPropertyValue('--feezal-dialog-view-height')).toBe('400px');
        expect(portal.style.getPropertyValue('--feezal-dialog-view-min-height')).toBe('250px');
    });

    it('OK publishes and closes; hide-header removes the header (B25)', async () => {
        makeSiteWithView('detail');
        const el = await mount('feezal-element-paper-dialog-view', {
            subscribe: 'dv/t', view: 'detail', title: 'T',
            'ok-label': 'Go', 'ok-publish': 'ack', 'hide-header': '',
        });
        subCallbacks['dv/t']({payload: 'open'});
        await el.updateComplete;
        const portal = document.querySelector('[feezal-paper-dialog-view-portal]');
        expect(portal.querySelector('.dialog-header')).toBeNull();
        portal.querySelector('.dialog-btn-ok').click();
        expect(feezal.connection.pub).toHaveBeenCalledWith('ack', 'ok');
        await el.updateComplete;
        expect(document.querySelector('[feezal-paper-dialog-view-portal]')).toBeNull();
    });
});
