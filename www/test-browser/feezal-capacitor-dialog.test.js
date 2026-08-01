/**
 * A9 Tier 2a — the Capacitor export dialog (only its e2e flow was covered,
 * which feeds a separate coverage report): the app-id derivation rules, the
 * localhost-broker warning, open() seeding from the site name, the
 * name→id auto-derive that stops once the id was hand-edited, and the
 * disabled-until-valid export button.
 */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import '../src/feezal-capacitor-dialog.js';
import {deriveAppId, isLocalhostUri} from '../src/feezal-capacitor-dialog.js';
import {setupFeezal} from './helpers.js';

let feezal;
beforeEach(() => {
    feezal = setupFeezal({siteName: 'My Site'});
    vi.stubGlobal('fetch', async () => ({json: async () => ({dockerBuilds: false})}));
    return () => vi.unstubAllGlobals();
});

describe('deriveAppId (mirror of the server rule)', () => {
    it('slugs umlauts, strips non-alphanumerics, prefixes digits, never empty', () => {
        expect(deriveAppId('Über Haus!')).toBe('io.feezal.ueberhaus');
        expect(deriveAppId('Größe & Spaß')).toBe('io.feezal.groessespass');
        expect(deriveAppId('42 Wallaby Way')).toBe('io.feezal.app42wallabyway');
        expect(deriveAppId('---')).toBe('io.feezal.app');
        expect(deriveAppId('')).toBe('io.feezal.app');
    });
});

describe('isLocalhostUri', () => {
    it('matches the loopback shapes and nothing else', () => {
        expect(isLocalhostUri('ws://localhost:9001')).toBe(true);
        expect(isLocalhostUri('mqtt://127.0.0.1')).toBe(true);
        expect(isLocalhostUri('wss://[::1]:8884/mqtt')).toBe(true);
        expect(isLocalhostUri('ws://localhost.example.com')).toBe(false);
        expect(isLocalhostUri('ws://192.168.1.5:9001')).toBe(false);
        expect(isLocalhostUri('')).toBe(false);
    });
});

async function openDialog() {
    const el = document.createElement('feezal-capacitor-dialog');
    document.body.append(el);
    await el.updateComplete;
    el.open();
    await el.updateComplete;
    return el;
}

describe('dialog behaviour', () => {
    it('open() seeds the name from the site and derives the id', async () => {
        const el = await openDialog();
        const [nameInput, idInput] = el.shadowRoot.querySelectorAll('sl-input');
        expect(nameInput.value).toBe('My Site');
        expect(idInput.value).toBe('io.feezal.mysite');
    });

    it('typing a name re-derives the id — until the id is hand-edited', async () => {
        const el = await openDialog();
        const [nameInput, idInput] = el.shadowRoot.querySelectorAll('sl-input');

        nameInput.value = 'Garden Panel';
        nameInput.dispatchEvent(new CustomEvent('sl-input'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('sl-input')[1].value).toBe('io.feezal.gardenpanel');

        idInput.value = 'io.example.custom';
        idInput.dispatchEvent(new CustomEvent('sl-input'));
        nameInput.value = 'Renamed';
        nameInput.dispatchEvent(new CustomEvent('sl-input'));
        await el.updateComplete;
        expect(el.shadowRoot.querySelectorAll('sl-input')[1].value).toBe('io.example.custom');
    });

    it('shows the localhost-broker warning exactly when the uri is loopback', async () => {
        const el = await openDialog();
        expect(el.shadowRoot.querySelector('.warn')).toBeNull();
        el._uri = 'mqtt://localhost:1883';
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.warn').textContent).toContain('localhost');
    });

    it('the export button disables while name or id is blank; no build button without the capability', async () => {
        const el = await openDialog();
        const exportBtn = [...el.shadowRoot.querySelectorAll('sl-button')].at(-1);
        expect(exportBtn.disabled).toBe(false);
        el._appName = '  ';
        await el.updateComplete;
        expect([...el.shadowRoot.querySelectorAll('sl-button')].at(-1).disabled).toBe(true);
        expect([...el.shadowRoot.querySelectorAll('sl-button')].map(b => b.textContent))
            .not.toContain('Build APK on server');
    });

    it('a finished build renders the log view with the download button', async () => {
        const el = await openDialog();
        el._build = {jobId: 'j1', status: 'success', log: ['step 1', 'done']};
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('.build-log').textContent).toContain('step 1');
        const download = [...el.shadowRoot.querySelectorAll('sl-button')].find(b => b.textContent.includes('Download APK'));
        expect(download.getAttribute('href')).toBe('/api/build-apk/j1/result');
    });
});
