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


/**
 * B108 — a retained status that stops being refreshed is a ghost.
 *
 * The last-will covers the common ungraceful disconnect, but it cannot cover
 * everything: MQTT allows ONE will per connection (a site with its own
 * configured LWT has none left for presence), a renamed viewer's will still
 * points at its old topic, and changing the site's publish topic strands the
 * old retained status for good. The viewer heartbeat makes that absence
 * observable; this panel acts on it.
 */
describe('inactive viewers (B108)', () => {
    const Panel = customElements.get('feezal-sidebar-clients');

    /** Mount a panel with two clients and control how long ago each was seen. */
    async function panelWith(seenAgo) {
        const site = document.createElement('feezal-site');
        site.setAttribute('publish', 'site');
        site.setAttribute('subscribe', 'site/set');
        app.append(site);
        const panel = document.createElement('feezal-sidebar-clients');
        document.body.append(panel);
        await panel.updateComplete;
        await tick();

        panel._clients = Object.fromEntries(Object.keys(seenAgo).map(id => [id, {...STATUS}]));
        panel._seenAt = Object.fromEntries(
            Object.entries(seenAgo).map(([id, ago]) => [id, Date.now() - ago]));
        panel._now = Date.now();
        await panel.updateComplete;
        return panel;
    }

    const shownIds = panel => [...panel.shadowRoot.querySelectorAll('.client .head span:nth-child(2)')]
        .map(el => el.textContent.trim());

    it('hides a client whose heartbeat stopped, keeping the live one', async () => {
        const panel = await panelWith({live: 5_000, ghost: 10 * 60_000});
        expect(shownIds(panel)).toEqual(['live']);
        panel.remove();
    });

    it('says how many are hidden rather than losing them silently', async () => {
        const panel = await panelWith({live: 5_000, ghost: 10 * 60_000});
        const note = panel.shadowRoot.querySelector('.stale-note');
        expect(note).toBeTruthy();
        expect(note.textContent).toContain('1 inactive viewer');
        panel.remove();
    });

    it('can reveal them, greyed out', async () => {
        const panel = await panelWith({live: 5_000, ghost: 10 * 60_000});
        panel._showStale = true;
        await panel.updateComplete;
        expect(shownIds(panel).sort()).toEqual(['ghost', 'live']);
        const stale = panel.shadowRoot.querySelector('.client.stale');
        expect(stale).toBeTruthy();
        panel.remove();
    });

    it('tolerates a single missed beat', async () => {
        // One dropped publish, or a viewer briefly offline, must not make it
        // vanish — the threshold is several beats, not one.
        const panel = await panelWith({blip: 90_000});
        expect(shownIds(panel)).toEqual(['blip']);
        expect(panel.shadowRoot.querySelector('.stale-note')).toBeNull();
        panel.remove();
    });

    it('forgetting a ghost clears its retained status on the broker', async () => {
        const panel = await panelWith({ghost: 10 * 60_000});
        const sent = [];
        feezal.connection.pub = (topic, payload, opts) => sent.push({topic, payload, opts});
        panel.shadowRoot.querySelector('.stale-note a:last-of-type').click();
        expect(sent).toEqual([{topic: 'site/clients/ghost/status', payload: '', opts: {retain: true}}]);
        panel.remove();
    });

    it('drops a client from the seen-map when its status is cleared', async () => {
        const panel = await panelWith({gone: 5_000});
        expect(panel._seenAt.gone).toBeDefined();
        // an empty retained payload = the viewer went offline cleanly
        panel._clients = {};
        panel._seenAt = {};
        await panel.updateComplete;
        expect(shownIds(panel)).toEqual([]);
        panel.remove();
    });
});
