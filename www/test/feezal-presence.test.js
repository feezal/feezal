import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-site.js';
import '../src/feezal-view.js';
import {clientId, statusTopic, presenceEnabled, presenceWill, rename, toast, _reset} from '../src/feezal-presence.js';

let subs;       // topic → [callbacks]
let published;  // [{topic, payload, options}]

function fakeConnection() {
    return {
        backend: 'mqtt',
        sub: vi.fn((topic, cb) => {
            (subs[topic] ||= []).push(cb);
            return {topic, cb};
        }),
        unsubscribe: vi.fn(sub => {
            const list = subs[sub.topic] || [];
            const i = list.indexOf(sub.cb);
            if (i >= 0) list.splice(i, 1);
        }),
        pub: vi.fn((topic, payload, options = {}) => {
            published.push({topic, payload, options});
        }),
        presence: vi.fn(),
    };
}

// Distinct cmnd/stat-style bases: commands live under the site SUBSCRIBE
// topic, the retained status under the site PUBLISH topic.
function makeSite({subscribe = 'home/cmnd', publish = 'home/stat', presence} = {}) {
    const site = document.createElement('feezal-site');
    if (subscribe) site.setAttribute('subscribe', subscribe);
    if (publish) site.setAttribute('publish', publish);
    if (presence) site.setAttribute('presence', presence);
    const view = document.createElement('feezal-view');
    view.setAttribute('name', 'Home');
    site.append(view);
    return site;
}

const deliver = (topic, payload) => (subs[topic] || []).forEach(cb => cb({topic, payload}));
const lastStatus = () => published.filter(p => p.topic.endsWith('/status') && p.payload !== '').at(-1);

beforeEach(() => {
    subs = {};
    published = [];
    localStorage.clear();
    location.hash = '';
    feezal.isEditor = false;
    feezal.views = [];
    feezal.connection = fakeConnection();
    _reset();
});

afterEach(() => {
    document.body.innerHTML = '';
});

/** Attach a site and fire the connection's `connected` (bubbles to document). */
async function boot(siteOpts) {
    const site = makeSite(siteOpts);
    feezal.views = [...site.querySelectorAll('feezal-view')];
    document.body.append(site);
    await site.updateComplete;
    document.dispatchEvent(new Event('connected'));
    return site;
}

/** Let the view-attribute MutationObserver deliver its records. */
const flushObservers = () => new Promise(resolve => setTimeout(resolve, 0));

describe('client identity (N24)', () => {
    it('generates a viewer-xxxx id once and persists it in localStorage', () => {
        const id = clientId();
        expect(id).toMatch(/^viewer-[a-z0-9]{1,6}$/);
        expect(clientId()).toBe(id);                              // stable
        expect(localStorage.getItem('feezal-client-id')).toBe(id);
    });

    it('presence is on by default, off with presence="off" or without a publish topic', async () => {
        await boot();
        expect(presenceEnabled()).toBe(true);
        document.body.innerHTML = '';

        await boot({presence: 'off'});
        expect(presenceEnabled()).toBe(false);
        document.body.innerHTML = '';

        // Status is viewer-published state — the publish topic is the hard
        // requirement; a subscribe topic alone enables nothing.
        await boot({publish: ''});
        expect(presenceEnabled()).toBe(false);
        document.body.innerHTML = '';

        // Publish-only site: presence still on (announce-only).
        await boot({subscribe: ''});
        expect(presenceEnabled()).toBe(true);
    });

    it('presenceWill returns the retained-empty clear of the status topic', async () => {
        await boot();
        expect(presenceWill()).toEqual({topic: statusTopic(), payload: '', retain: true});
    });
});

describe('status publishing (N24)', () => {
    it('publishes retained status JSON with view/timestamps/connection/UA on connect', async () => {
        const site = await boot();
        site.view = 'Home';
        await site.updateComplete;

        const s = lastStatus();
        expect(s).toBeTruthy();
        expect(s.topic).toBe(`home/stat/clients/${clientId()}/status`);
        expect(s.options.retain).toBe(true);
        const p = JSON.parse(s.payload);
        expect(p).toMatchObject({connection: 'direct'});
        expect(p.connectedSince).toBeTruthy();
        expect(p.lastChange).toBeTruthy();
        expect(p.userAgent).toBe(navigator.userAgent);
    });

    it('republishes status on view changes (any source)', async () => {
        const site = await boot();
        site.view = 'Home';
        await site.updateComplete;
        const before = published.length;

        site.setAttribute('view', 'Energy');
        await flushObservers();
        const s = lastStatus();
        expect(published.length).toBeGreaterThan(before);
        expect(JSON.parse(s.payload).view).toBe('Energy');
    });
});

describe('per-client commands (N24)', () => {
    it('subscribes commands under <subscribe>/clients, the own status under <publish>/clients', async () => {
        await boot();
        const base = `home/cmnd/clients/${clientId()}`;
        for (const cmd of ['view', 'reload', 'theme', 'playlist', 'addclass', 'removeclass', 'rename']) {
            expect(subs[`${base}/${cmd}`], cmd).toBeTruthy();
        }

        expect(subs[`home/stat/clients/${clientId()}/status`]).toBeTruthy();
    });

    it('publish-only site: announces status but subscribes no commands (monitoring-only)', async () => {
        await boot({subscribe: ''});
        expect(lastStatus().topic).toBe(`home/stat/clients/${clientId()}/status`);
        // Only the own-status subscription (collision detection / self-heal).
        expect(Object.keys(subs)).toEqual([`home/stat/clients/${clientId()}/status`]);
    });

    it('a per-client view command switches only this instance and updates status', async () => {
        const site = await boot();
        deliver(`home/cmnd/clients/${clientId()}/view`, 'Energy');
        await site.updateComplete;
        await flushObservers();
        expect(site.view).toBe('Energy');
        expect(JSON.parse(lastStatus().payload).view).toBe('Energy');
    });

    it('addclass/removeclass reach the site element', async () => {
        const site = await boot();
        deliver(`home/cmnd/clients/${clientId()}/addclass`, 'night');
        expect(site.classList.contains('night')).toBe(true);
        deliver(`home/cmnd/clients/${clientId()}/removeclass`, 'night');
        expect(site.classList.contains('night')).toBe(false);
    });
});

describe('rename (N24)', () => {
    it('adopts the new id: clears old retained status, resubscribes, republishes', async () => {
        await boot();
        const oldId = clientId();
        const oldStatus = `home/stat/clients/${oldId}/status`;

        deliver(`home/cmnd/clients/${oldId}/rename`, 'hallway-panel');

        expect(clientId()).toBe('hallway-panel');
        // Old retained status cleared…
        expect(published.some(p => p.topic === oldStatus && p.payload === '' && p.options.retain)).toBe(true);
        // …new status retained under the new id…
        const s = lastStatus();
        expect(s.topic).toBe('home/stat/clients/hallway-panel/status');
        // …and the command subtree moved.
        expect(subs['home/cmnd/clients/hallway-panel/view']).toBeTruthy();
        expect((subs[`home/cmnd/clients/${oldId}/view`] || [])).toHaveLength(0);
        // The bridge handshake follows the new topic.
        expect(feezal.connection.presence).toHaveBeenCalledWith('home/stat/clients/hallway-panel/status');
    });

    it('rejects topic-unsafe ids', async () => {
        await boot();
        const before = clientId();
        rename('has/slash');
        rename('has space');
        rename('');
        expect(clientId()).toBe(before);
    });
});

describe('collision warning (N24)', () => {
    it('warns once when a foreign status appears under the own id', async () => {
        await boot();
        deliver(statusTopic(), {connectedSince: '1999-01-01T00:00:00Z', view: 'X'});
        deliver(statusTopic(), {connectedSince: '1999-01-01T00:00:00Z', view: 'X'});
        const toasts = document.querySelectorAll('#feezal-presence-toasts > div');
        const collision = [...toasts].filter(t => t.textContent.includes('already online'));
        expect(collision).toHaveLength(1);
    });
});

describe('stale-LWT self-heal (N24)', () => {
    it('republishes the retained status when an empty clear arrives while online', async () => {
        await boot();
        const before = published.length;

        deliver(statusTopic(), '');   // stale LWT from the previous connection

        const republished = published.slice(before);
        expect(republished).toHaveLength(1);
        expect(republished[0].topic).toBe(statusTopic());
        expect(republished[0].options.retain).toBe(true);
        expect(JSON.parse(republished[0].payload).connectedSince).toBeTruthy();
    });

    it('does not warn about a collision on an empty clear', async () => {
        await boot();
        deliver(statusTopic(), '');
        deliver(statusTopic(), null);
        const toasts = document.querySelectorAll('#feezal-presence-toasts > div');
        expect([...toasts].filter(t => t.textContent.includes('already online'))).toHaveLength(0);
    });
});

describe('toast()', () => {
    it('renders a dismissible toast', () => {
        const el = toast('hello');
        expect(el.textContent).toContain('hello');
        el.querySelector('button').click();
        expect(document.querySelector('#feezal-presence-toasts')?.contains(el)).toBe(false);
    });
});
