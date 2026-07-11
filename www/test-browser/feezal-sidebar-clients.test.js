/**
 * Clients sidebar (N24) — late-site wiring.
 *
 * The editor restores the persisted sidebar tab on reload, so this panel can
 * attach BEFORE getSite has built the site DOM (feezal.site is a live getter
 * over feezal.app's light DOM). The panel must subscribe as soon as
 * <feezal-site> appears and rewire when its publish attribute (the base of
 * the status wildcard) changes — without requiring a tab switch.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import '../src/feezal-sidebar-clients.js';
import {setupFeezal} from './helpers.js';

// MutationObserver callbacks are microtasks — one macrotask flushes them.
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const STATUS = {connectedSince: '2026-07-11T00:00:00Z', view: 'Home', connection: 'direct'};

let app;

beforeEach(() => {
    setupFeezal({isEditor: true});
    app = document.createElement('div');
    document.body.append(app);
    window.feezal.app = app;
    // Mirror the editor bootstrap: feezal.site resolves live from feezal.app.
    Object.defineProperty(window.feezal, 'site', {
        configurable: true,
        get: () => app.querySelector('feezal-site'),
    });
});

async function mountPanel() {
    const el = document.createElement('feezal-sidebar-clients');
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('feezal-sidebar-clients late-site wiring (N24)', () => {
    it('subscribes once the site appears after the panel attached (editor reload with persisted Clients tab)', async () => {
        const panel = await mountPanel();
        expect(feezal.connection.subCount()).toBe(0);

        app.innerHTML = '<feezal-site subscribe="home/cmnd" publish="home/stat"></feezal-site>';
        await tick();

        expect(feezal.connection.subCount()).toBe(1);
        feezal.connection.deliver('home/stat/clients/viewer-ab12/status', STATUS);
        await panel.updateComplete;
        expect(panel.shadowRoot.textContent).toContain('viewer-ab12');
    });

    it('rewires when the site publish topic changes, dropping the old subscription', async () => {
        app.innerHTML = '<feezal-site subscribe="home/cmnd" publish="home/stat"></feezal-site>';
        const panel = await mountPanel();
        expect(feezal.connection.subCount()).toBe(1);

        app.querySelector('feezal-site').setAttribute('publish', 'other/site');
        await tick();

        expect(feezal.connection.subCount()).toBe(1);   // old topic unsubscribed
        feezal.connection.deliver('other/site/clients/panel-7/status', STATUS);
        await panel.updateComplete;
        expect(panel.shadowRoot.textContent).toContain('panel-7');
    });

    it('accepts a status payload delivered as a raw JSON string (hub cache replay)', async () => {
        // Bridge-mode viewers send their status as a JSON string; the broker
        // relay parses it, but a hub cache replay (and older servers) can hand
        // the string through — the panel must not drop the viewer over the
        // payload type.
        app.innerHTML = '<feezal-site subscribe="home/cmnd" publish="home/stat"></feezal-site>';
        const panel = await mountPanel();
        await tick();

        feezal.connection.deliver('home/stat/clients/viewer-str1/status', JSON.stringify(STATUS));
        await panel.updateComplete;
        expect(panel.shadowRoot.textContent).toContain('viewer-str1');
    });

    it('publishes per-client commands under the site SUBSCRIBE topic', async () => {
        app.innerHTML = '<feezal-site subscribe="home/cmnd" publish="home/stat"></feezal-site>';
        const panel = await mountPanel();
        await tick();

        panel._pub('viewer-ab12', 'view', 'Energy');
        expect(feezal.connection.published.at(-1)).toMatchObject({
            topic: 'home/cmnd/clients/viewer-ab12/view',
            payload: 'Energy',
        });
    });

    it('stays quiet without a site publish topic (subscribe alone enables nothing) and cleans up its observers on removal', async () => {
        const panel = await mountPanel();
        app.innerHTML = '<feezal-site subscribe="home/cmnd"></feezal-site>';
        await tick();
        expect(feezal.connection.subCount()).toBe(0);

        panel.remove();
        app.querySelector('feezal-site').setAttribute('publish', 'home/stat');
        await tick();
        expect(feezal.connection.subCount()).toBe(0);   // no zombie rewire
    });
});
