/**
 * E101 glass dialog family — feezal-element-glass-dialog / -dialog-view /
 * -countdown-dialog. Attribute-contract mirrors of their material siblings:
 * MQTT open/close, OK/Cancel publishes, B25 header behaviour, dialog-view
 * clone injection, countdown auto-confirm, editor placeholder + guards.
 *
 * Relative imports — the packages are intentionally not in www/package.json yet.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import '../packages/@feezal/feezal-element-glass-dialog/feezal-element-glass-dialog.js';
import '../packages/@feezal/feezal-element-glass-dialog-view/feezal-element-glass-dialog-view.js';
import '../packages/@feezal/feezal-element-glass-countdown-dialog/feezal-element-glass-countdown-dialog.js';
import {setupFeezal, mount} from './helpers.js';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

afterEach(() => {
    vi.useRealTimers();
});

const portal = () => document.querySelector('[feezal-glass-dialog-portal]');
const viewPortal = () => document.querySelector('[feezal-glass-dialog-view-portal]');

describe('glass-dialog', () => {
    it('opens on payload-open into a body portal and closes on payload-close', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/dialog', title: 'Hello',
        });
        expect(portal()).toBeNull();

        feezal.connection.deliver('cmd/dialog', 'open');
        await el.updateComplete;
        expect(portal()).not.toBeNull();
        expect(portal().querySelector('.dialog-panel')).not.toBeNull();
        expect(portal().querySelector('.dialog-header').textContent).toContain('Hello');

        feezal.connection.deliver('cmd/dialog', 'close');
        await el.updateComplete;
        expect(portal()).toBeNull();
    });

    it('evaluates the ${msg.*} body template and honours custom open/close payloads', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/d2', template: 'Alert: ${msg.payload}',
            'payload-open': 'SHOW', 'payload-close': 'HIDE',
        });
        feezal.connection.deliver('cmd/d2', 'open');   // not the configured payload
        await el.updateComplete;
        expect(portal()).toBeNull();

        feezal.connection.deliver('cmd/d2', 'SHOW');
        await el.updateComplete;
        expect(portal().querySelector('.dialog-message').textContent).toBe('Alert: SHOW');

        feezal.connection.deliver('cmd/d2', 'HIDE');
        await el.updateComplete;
        expect(portal()).toBeNull();
    });

    it('OK publishes ok-payload to ok-publish and closes', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/d3', 'ok-label': 'Yes', 'ok-publish': 'cmnd/answer', 'ok-payload': 'YES',
        });
        feezal.connection.deliver('cmd/d3', 'open');
        await el.updateComplete;
        portal().querySelector('.dialog-btn-ok').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/answer', payload: 'YES'});
        expect(portal()).toBeNull();
    });

    it('Cancel publishes cancel-payload to cancel-publish and closes', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/d4', 'cancel-label': 'No', 'cancel-publish': 'cmnd/answer', 'cancel-payload': 'NO',
        });
        feezal.connection.deliver('cmd/d4', 'open');
        await el.updateComplete;
        portal().querySelector('.dialog-btn-cancel').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/answer', payload: 'NO'});
        expect(portal()).toBeNull();
    });

    it('B25 header: ✕ by default, show-close=false keeps only the title, hide-header removes the bar', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/d5', title: 'T',
        });
        feezal.connection.deliver('cmd/d5', 'open');
        await el.updateComplete;
        expect(portal().querySelector('.dialog-close')).not.toBeNull();

        // ✕ closes the dialog
        portal().querySelector('.dialog-close').click();
        await el.updateComplete;
        expect(portal()).toBeNull();

        feezal.connection.deliver('cmd/d5', 'open');
        await el.updateComplete;
        el.showClose = false;                     // live B25 sync on the open portal
        await el.updateComplete;
        expect(portal().querySelector('.dialog-header')).not.toBeNull();
        expect(portal().querySelector('.dialog-close')).toBeNull();

        el.hideHeader = true;
        await el.updateComplete;
        expect(portal().querySelector('.dialog-header')).toBeNull();
    });

    it('B24 sizing attributes land on the panel', async () => {
        const el = await mount('feezal-element-glass-dialog', {
            subscribe: 'cmd/d6', width: '333px', height: '222px', 'min-height': '111px', 'max-height': '70vh',
        });
        feezal.connection.deliver('cmd/d6', 'open');
        await el.updateComplete;
        const style = portal().querySelector('.dialog-panel').getAttribute('style');
        expect(style).toContain('width:333px');
        expect(style).toContain('height:222px');
        expect(style).toContain('min-height:111px');
        expect(style).toContain('max-height:70vh');
    });

    it('editor: renders a placeholder, preview buttons never publish', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-dialog', {
            'ok-label': 'Yes', 'ok-publish': 'cmnd/x', 'ok-payload': 'YES',
        });
        const ph = el.shadowRoot.querySelector('.editor-placeholder');
        expect(ph).not.toBeNull();
        expect(ph.textContent).toContain('Dialog');
        expect(portal()).toBeNull();

        el._open = true;                          // inspector "Preview Dialog"
        await el.updateComplete;
        expect(portal()).toBeNull();              // preview stays in the shadow, no portal
        el.shadowRoot.querySelector('.dialog-btn-ok').click();
        await el.updateComplete;
        expect(feezal.connection.published).toHaveLength(0);   // editor guard
        expect(el._open).toBe(false);             // but it still closes
    });
});

describe('glass-dialog-view', () => {
    function siteWithView(name) {
        const site = document.createElement('div');
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        view.style.display = 'none';              // inactive view
        const inner = document.createElement('span');
        inner.className = 'inner';
        inner.textContent = 'embedded content';
        view.append(inner);
        site.append(view);
        return site;
    }

    it('clones the configured view into the portal body on open', async () => {
        feezal.site = siteWithView('popup');
        const el = await mount('feezal-element-glass-dialog-view', {
            subscribe: 'cmd/dv', view: 'popup', title: 'V',
        });
        feezal.connection.deliver('cmd/dv', 'open');
        await el.updateComplete;
        const clone = viewPortal().querySelector('.dialog-body feezal-view[name="popup"]');
        expect(clone).not.toBeNull();
        expect(clone.style.display).toBe('');                    // display:none cleared
        expect(clone.style.position).toBe('relative');           // containing block
        expect(clone.querySelector('.inner').textContent).toBe('embedded content');
        // the original in feezal.site is untouched
        expect(feezal.site.querySelector('feezal-view').style.display).toBe('none');

        feezal.connection.deliver('cmd/dv', 'close');
        await el.updateComplete;
        expect(viewPortal()).toBeNull();
    });

    it('shows an error note for a missing / unselected view', async () => {
        feezal.site = siteWithView('popup');
        const el = await mount('feezal-element-glass-dialog-view', {
            subscribe: 'cmd/dv2', view: 'nope',
        });
        feezal.connection.deliver('cmd/dv2', 'open');
        await el.updateComplete;
        expect(viewPortal().querySelector('.preview-note').textContent).toContain('"nope" not found');
    });

    it('OK/Cancel publish and close; sizing attributes map to the portal tokens', async () => {
        feezal.site = siteWithView('popup');
        const el = await mount('feezal-element-glass-dialog-view', {
            subscribe: 'cmd/dv3', view: 'popup', width: '400px', 'max-height': '77vh',
            'ok-label': 'Go', 'ok-publish': 'cmnd/go', 'ok-payload': 'GO',
            'cancel-label': 'Stop', 'cancel-publish': 'cmnd/stop', 'cancel-payload': 'STOP',
        });
        feezal.connection.deliver('cmd/dv3', 'open');
        await el.updateComplete;
        expect(viewPortal().style.getPropertyValue('--feezal-glass-dialog-view-width')).toBe('400px');
        expect(viewPortal().style.getPropertyValue('--feezal-glass-dialog-view-max-height')).toBe('77vh');

        viewPortal().querySelector('.dialog-btn-ok').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/go', payload: 'GO'});
        expect(viewPortal()).toBeNull();

        feezal.connection.deliver('cmd/dv3', 'open');
        await el.updateComplete;
        viewPortal().querySelector('.dialog-btn-cancel').click();
        await el.updateComplete;
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/stop', payload: 'STOP'});
        expect(viewPortal()).toBeNull();
    });

    it('hide-header removes the header bar from the portal', async () => {
        feezal.site = siteWithView('popup');
        const el = await mount('feezal-element-glass-dialog-view', {
            subscribe: 'cmd/dv4', view: 'popup', title: 'T', 'hide-header': '',
        });
        feezal.connection.deliver('cmd/dv4', 'open');
        await el.updateComplete;
        expect(viewPortal().querySelector('.dialog-header')).toBeNull();
    });

    it('editor: placeholder + static preview (no live clone, no portal)', async () => {
        feezal.isEditor = true;
        feezal.site = siteWithView('popup');
        const el = await mount('feezal-element-glass-dialog-view', {view: 'popup'});
        expect(el.shadowRoot.querySelector('.editor-placeholder').textContent).toContain('Dialog View');

        el._open = true;                          // inspector "Preview Dialog"
        await el.updateComplete;
        expect(viewPortal()).toBeNull();
        const preview = el.shadowRoot.querySelector('.dialog-panel .preview-note');
        expect(preview.textContent).toContain('popup');
        expect(el.shadowRoot.querySelector('feezal-view')).toBeNull();   // static, no clone
    });
});

describe('glass-countdown-dialog', () => {
    it('opens on payload-open, counts down, auto-publishes confirm at zero and closes', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-glass-countdown-dialog', {
            subscribe: 'cmd/cd', duration: '3',
            'publish-confirm': 'cmnd/exec', 'payload-confirm': 'DO-IT',
            template: 'Executing in ${seconds}s (${msg.payload})',
        });
        feezal.connection.deliver('cmd/cd', 'open');
        await el.updateComplete;
        expect(el._open).toBe(true);
        expect(el._remaining).toBe(3);
        expect(el.shadowRoot.querySelector('.backdrop')).not.toBeNull();
        expect(el.shadowRoot.querySelector('.ring-number').textContent).toBe('3');
        // ${seconds} and ${msg.*} template variables
        expect(el.shadowRoot.querySelector('.dialog-message').textContent).toBe('Executing in 3s (open)');

        vi.advanceTimersByTime(2000);
        await el.updateComplete;
        expect(el._remaining).toBe(1);
        expect(el._open).toBe(true);
        expect(el.shadowRoot.querySelector('.dialog-message').textContent).toBe('Executing in 1s (open)');

        vi.advanceTimersByTime(1000);
        await el.updateComplete;
        expect(el._open).toBe(false);
        expect(el.shadowRoot.querySelector('.dialog-panel')).toBeNull();
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/exec', payload: 'DO-IT'});
    });

    it('Cancel stops the timer, publishes cancel and never confirms', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-glass-countdown-dialog', {
            subscribe: 'cmd/cd2', duration: '5', 'cancel-label': 'Abbrechen',
            'publish-confirm': 'cmnd/exec', 'publish-cancel': 'cmnd/abort', 'payload-cancel': 'NOPE',
        });
        feezal.connection.deliver('cmd/cd2', 'open');
        await el.updateComplete;
        const btn = el.shadowRoot.querySelector('.dialog-btn');
        expect(btn.textContent.trim()).toBe('Abbrechen');
        btn.click();
        await el.updateComplete;
        expect(el._open).toBe(false);
        expect(feezal.connection.published).toContainEqual({topic: 'cmnd/abort', payload: 'NOPE'});

        vi.advanceTimersByTime(10_000);           // timer must be dead
        expect(feezal.connection.published.find(p => p.topic === 'cmnd/exec')).toBeUndefined();
    });

    it('ring turns warn/danger inside warn-seconds', async () => {
        vi.useFakeTimers();
        const el = await mount('feezal-element-glass-countdown-dialog', {
            subscribe: 'cmd/cd3', duration: '5', 'warn-seconds': '2',
        });
        feezal.connection.deliver('cmd/cd3', 'open');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-progress').classList.contains('ok')).toBe(true);

        vi.advanceTimersByTime(3000);             // remaining 2 → warn
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-progress').classList.contains('warn')).toBe(true);

        vi.advanceTimersByTime(1000);             // remaining 1 → danger (≤ floor(2/2))
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.ring-progress').classList.contains('danger')).toBe(true);
    });

    it('editor: placeholder only, no subscription, never opens or publishes', async () => {
        feezal.isEditor = true;
        const el = await mount('feezal-element-glass-countdown-dialog', {
            subscribe: 'cmd/cd4', 'publish-confirm': 'cmnd/exec',
        });
        expect(el.shadowRoot.querySelector('.editor-placeholder').textContent).toContain('Countdown');
        expect(feezal.connection.subCount()).toBe(0);
        feezal.connection.deliver('cmd/cd4', 'open');
        await el.updateComplete;
        expect(el._open).toBe(false);
        expect(feezal.connection.published).toHaveLength(0);
    });
});
