/**
 * First-run MQTT connect dialog (feezal-connect-dialog): the broker setup shown
 * before the welcome tour when no host is configured. It mirrors the Connection
 * sidebar but larger, defaults to DIRECT mode, forces bridge for mqtt(s)://, and
 * on save writes the connection onto the sidebar and deploys it.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import '../src/feezal-connect-dialog.js';

let deployCalls;
let sidebar;

function fakeApp() {
    // A host with an (open) shadow root standing in for feezal.app, carrying a
    // stand-in Connection sidebar the dialog reads/writes.
    const app = document.createElement('div');
    const sr = app.attachShadow({mode: 'open'});
    sidebar = document.createElement('feezal-sidebar-viewer');   // unknown element = plain host
    sidebar.connection = {backend: 'mqtt'};
    sr.append(sidebar);
    app._deploy = cb => { deployCalls++; cb && cb(); };           // synchronous deploy
    document.body.append(app);
    return app;
}

beforeEach(() => {
    document.body.innerHTML = '';
    deployCalls = 0;
    window.feezal = {app: fakeApp(), siteName: 'default'};
});
afterEach(() => { delete window.feezal; });

async function dialog() {
    const el = document.createElement('feezal-connect-dialog');
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('feezal-connect-dialog', () => {
    it('defaults to ws:// and DIRECT viewer mode', async () => {
        const el = await dialog();
        expect(el._protocol).toBe('ws');
        expect(el._viaServer).toBe(false);
        expect(el._bridge).toBe(false);
    });

    it('open() pre-fills from the existing connection (parses the uri)', async () => {
        sidebar.connection = {uri: 'wss://user:pw@broker.local:8084', viaServer: true};
        const el = await dialog();
        el.open();
        await el.updateComplete;
        expect(el._protocol).toBe('wss');
        expect(el._host).toBe('broker.local');
        expect(el._port).toBe('8084');
        expect(el._username).toBe('user');
        expect(el._password).toBe('pw');
        expect(el._viaServer).toBe(true);
    });

    it('_buildConnection builds the uri + structured fields (with auth)', async () => {
        const el = await dialog();
        el._protocol = 'wss'; el._host = 'broker'; el._port = '8084';
        el._username = 'u'; el._password = 'p'; el._viaServer = false;
        const c = el._buildConnection();
        expect(c.uri).toBe('wss://u:p@broker:8084');
        expect(c._host).toBe('broker');
        expect(c.viaServer).toBe(false);
        expect(c.backend).toBe('mqtt');
    });

    it('mqtt:// forces bridge mode and disables the switch', async () => {
        const el = await dialog();
        el._protocol = 'mqtt'; el._viaServer = false;
        await el.updateComplete;
        expect(el._isTcp).toBe(true);
        expect(el._bridge).toBe(true);                                   // forced on
        expect(el._buildConnection().viaServer).toBe(true);
        const sw = el.renderRoot.querySelector('sl-switch');
        expect(sw.disabled).toBe(true);
    });

    it('wss:// direct warns each viewer must trust the cert; bridge points at the server CA', async () => {
        const el = await dialog();
        el._protocol = 'wss'; el._viaServer = false;
        await el.updateComplete;
        expect(el.renderRoot.textContent).toMatch(/trust the broker's TLS certificate/i);

        el._viaServer = true;
        await el.updateComplete;
        expect(el.renderRoot.textContent).toMatch(/feezal server.*must trust/i);
    });

    it('Save writes the connection to the sidebar, deploys, and closes with reason "saved"', async () => {
        const el = await dialog();
        let closed = null;
        el.addEventListener('feezal-connect-closed', e => { closed = e.detail.reason; });
        el._protocol = 'ws'; el._host = 'broker.local'; el._port = '9001';
        el._save();
        expect(sidebar.connection.uri).toBe('ws://broker.local:9001');    // written to the sidebar
        expect(deployCalls).toBe(1);                                      // deployed
        expect(closed).toBe('saved');                                     // closed as saved
    });

    it('Save is a no-op without a host', async () => {
        const el = await dialog();
        el._host = '   ';
        el._save();
        expect(deployCalls).toBe(0);
    });

    it('Skip closes with reason "skipped" and never deploys', async () => {
        const el = await dialog();
        let closed = null;
        el.addEventListener('feezal-connect-closed', e => { closed = e.detail.reason; });
        el._close('skipped');
        expect(closed).toBe('skipped');
        expect(deployCalls).toBe(0);
    });
});
