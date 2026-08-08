/**
 * E169 — basic-scrypted: Scrypted NVR view embed.
 *
 * The URL rewrite rules live in the exported pure composeScryptedUrl(), so
 * they are pinned without a DOM; the element tests cover the render contract
 * (iframe vs hint vs nothing), the editor/viewer split and the
 * pause-when-hidden teardown.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {setupFeezal} from './helpers.js';

import {composeScryptedUrl} from '../packages/@feezal/feezal-element-basic-scrypted/feezal-element-basic-scrypted.js';

const BASE = 'https://nvr.local/api/scrypted/TOKEN123/endpoint/@scrypted/nvr/public/';
const SINGLE = BASE + '#/iframe/62';

let feezal;

beforeEach(() => {
    feezal = setupFeezal();
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function mount(attrs = {}) {
    const el = document.createElement('feezal-element-basic-scrypted');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.body.append(el);
    await el.updateComplete;
    return el;
}

describe('composeScryptedUrl — view rewriting', () => {
    it('single view passes through, live autoplay on by default', () => {
        expect(composeScryptedUrl(SINGLE, {}))
            .toBe(BASE + '#/iframe/62?live=true');
    });

    it('live=false drops the autoplay param', () => {
        expect(composeScryptedUrl(SINGLE, {live: false}))
            .toBe(BASE + '#/iframe/62');
    });

    it('view=grid moves the path id into the ids param', () => {
        expect(composeScryptedUrl(SINGLE, {view: 'grid'}))
            .toBe(BASE + '#/iframegrid?ids=62&live=true');
    });

    it('view=events builds the event reel', () => {
        expect(composeScryptedUrl(SINGLE, {view: 'events', live: false}))
            .toBe(BASE + '#/iframeevents?ids=62');
    });

    it('camera-ids override the pasted id — commas stay literal', () => {
        expect(composeScryptedUrl(SINGLE, {view: 'grid', cameraIds: '7, 8,9', live: false}))
            .toBe(BASE + '#/iframegrid?ids=7,8,9');
    });

    it('view=live uses the FIRST of the camera-ids', () => {
        expect(composeScryptedUrl(SINGLE, {view: 'live', cameraIds: '7,8', live: false}))
            .toBe(BASE + '#/iframe/7');
    });

    it('a pasted grid URL keeps its ids and shape without a view override', () => {
        expect(composeScryptedUrl(BASE + '#/iframegrid?ids=1,2', {live: false}))
            .toBe(BASE + '#/iframegrid?ids=1,2');
    });

    it('a pasted grid URL can be rewritten to a single live view', () => {
        expect(composeScryptedUrl(BASE + '#/iframegrid?ids=4,5', {view: 'live', live: false}))
            .toBe(BASE + '#/iframe/4');
    });
});

describe('composeScryptedUrl — parameter management', () => {
    it('destination / speaker / microphone map to their params', () => {
        const url = composeScryptedUrl(SINGLE, {
            destination: 'low-resolution', speaker: true, microphone: true, live: false,
        });
        expect(url).toBe(BASE + '#/iframe/62?destination=low-resolution&speaker=on&microphone=on');
    });

    it('unmanaged pasted params survive, managed pasted params are owned by the element', () => {
        const url = composeScryptedUrl(BASE + '#/iframe/62?imageClick=app&destination=local', {live: false});
        // destination came only from the pasted URL, the attribute is empty →
        // stripped; imageClick is not the element's business → kept.
        expect(url).toBe(BASE + '#/iframe/62?imageClick=app');
    });

    it('a pasted live=true does not stick when the attribute is off', () => {
        expect(composeScryptedUrl(BASE + '#/iframe/62?live=true', {live: false}))
            .toBe(BASE + '#/iframe/62');
    });
});

describe('composeScryptedUrl — conservatism on foreign URLs', () => {
    it('empty src → empty', () => {
        expect(composeScryptedUrl('', {})).toBe('');
    });

    it('no fragment → unchanged', () => {
        const plain = 'https://example.org/some/page';
        expect(composeScryptedUrl(plain, {view: 'grid'})).toBe(plain);
    });

    it('unrecognized fragment → unchanged', () => {
        const other = BASE + '#/settings/general';
        expect(composeScryptedUrl(other, {view: 'grid', live: true})).toBe(other);
    });

    it('live view without any id → unchanged rather than a broken path', () => {
        const noId = BASE + '#/iframe';
        expect(composeScryptedUrl(noId, {view: 'live'})).toBe(noId);
    });
});

describe('basic-scrypted — render contract', () => {
    it('renders the composed iframe URL', async () => {
        const el = await mount({src: SINGLE});
        const iframe = el.shadowRoot.querySelector('iframe');
        expect(iframe).toBeTruthy();
        expect(iframe.getAttribute('src')).toBe(BASE + '#/iframe/62?live=true');
    });

    it('attribute edits recompose the URL', async () => {
        const el = await mount({src: SINGLE});
        el.setAttribute('view', 'events');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('iframe').getAttribute('src'))
            .toBe(BASE + '#/iframeevents?ids=62&live=true');
    });

    it('microphone opts into the iframe permission, default does not', async () => {
        const el = await mount({src: SINGLE});
        expect(el.shadowRoot.querySelector('iframe').getAttribute('allow'))
            .toBe('autoplay; fullscreen');
        el.setAttribute('microphone', '');
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('iframe').getAttribute('allow'))
            .toBe('autoplay; fullscreen; microphone');
    });

    it('unconfigured: hint in the editor, nothing in the viewer', async () => {
        feezal.isEditor = true;
        const inEditor = await mount({});
        expect(inEditor.shadowRoot.querySelector('.hint')).toBeTruthy();
        expect(inEditor.shadowRoot.querySelector('iframe')).toBeNull();
        inEditor.remove();

        feezal.isEditor = false;
        const inViewer = await mount({});
        expect(inViewer.shadowRoot.querySelector('.hint')).toBeNull();
        expect(inViewer.shadowRoot.querySelector('iframe')).toBeNull();
    });

    it('pause-when-hidden tears the iframe down and restores it', async () => {
        const el = await mount({'src': SINGLE, 'pause-when-hidden': ''});
        expect(el.shadowRoot.querySelector('iframe')).toBeTruthy();
        el._streamPaused = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('iframe')).toBeNull();
        el._streamPaused = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector('iframe')).toBeTruthy();
    });

    it('the editor never pauses — no observer is installed there', async () => {
        feezal.isEditor = true;
        const el = await mount({'src': SINGLE, 'pause-when-hidden': ''});
        expect(el.__io).toBeNull();
        expect(el.shadowRoot.querySelector('iframe')).toBeTruthy();
    });

    it('turning pause-when-hidden off un-pauses a torn-down feed', async () => {
        const el = await mount({'src': SINGLE, 'pause-when-hidden': ''});
        el._streamPaused = true;
        await el.updateComplete;
        el.removeAttribute('pause-when-hidden');
        // The un-pause happens in updated() and schedules a second render.
        await el.updateComplete;
        await el.updateComplete;
        expect(el._streamPaused).toBe(false);
        expect(el.shadowRoot.querySelector('iframe')).toBeTruthy();
    });
});
