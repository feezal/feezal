/**
 * E2E: material-camera click actions — real viewer + editor:
 *   - click-action: publish → tap publishes the configured payload
 *   - click-action: popup   → tap opens the near-fullscreen popup, ✕ / tap / Esc close it
 *   - click-through         → a camera over a button does not block it
 *   - editor: no click action fires; the element stays selectable
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite, startBroker} from './harness.js';

const SITE = 'cameraclick';
// image type with a 1×1 gif data URL — no real camera needed.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    `<feezal-element-material-camera id="cam-pub" type="image" src="${PIXEL}" click-action="publish" publish="cam/cmd" payload="snap" style="position:absolute;top:20px;left:20px;width:160px;height:100px;"></feezal-element-material-camera>` +
    `<feezal-element-material-camera id="cam-pop" type="image" src="${PIXEL}" click-action="popup" label="garden" style="position:absolute;top:20px;left:220px;width:160px;height:100px;"></feezal-element-material-camera>` +
    '<feezal-element-material-button label="press" publish="cam/under" payload="go" style="position:absolute;top:160px;left:20px;width:160px;height:60px;"></feezal-element-material-button>' +
    `<feezal-element-material-camera id="cam-thru" type="image" src="${PIXEL}" click-through style="position:absolute;top:160px;left:20px;width:160px;height:60px;"></feezal-element-material-camera>` +
    `<feezal-element-material-camera id="cam-anim" type="image" src="${PIXEL}" click-action="popup" popup-animation style="position:absolute;top:160px;left:220px;width:160px;height:100px;"></feezal-element-material-camera>` +
    '</feezal-view></feezal-site>';

let stack;
let broker;

beforeAll(async () => {
    stack = await startStack();
    broker = await startBroker();
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML, connection: {backend: 'mqtt', uri: broker.uri}});
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await broker.close();
    await stopStack(stack);
});

describe('viewer', () => {
    it('publishes, opens/closes the popup, and is click-through', async () => {
        const received = [];
        const mqtt = (await import('mqtt')).default ?? (await import('mqtt'));
        const sub = mqtt.connect(broker.uri);
        await new Promise(resolve => sub.once('connect', resolve));
        await new Promise(resolve => sub.subscribe('cam/#', resolve));
        sub.on('message', (topic, payload) => received.push([topic, payload.toString()]));

        const viewer = await stack.context.newPage();
        // Spy on popup animations (popup-animation attribute).
        await viewer.addInitScript(() => {
            const orig = Element.prototype.animate;
            Element.prototype.animate = function (...args) {
                if (this.classList?.contains('popup')) window.__popupAnimations = (window.__popupAnimations || 0) + 1;
                return orig.apply(this, args);
            };
        });
        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
            await viewer.waitForSelector('#cam-pub', {timeout: 30_000});

            // click-action: publish
            await viewer.locator('#cam-pub').click();
            await expect.poll(() => received).toContainEqual(['cam/cmd', 'snap']);

            // click-action: popup — opens in the top layer with feed + label + ✕
            const popup = () => viewer.evaluate(() => {
                const p = document.querySelector('#cam-pop').shadowRoot.querySelector('.popup');
                return p ? {
                    open: p.matches(':popover-open'),
                    feed: Boolean(p.querySelector('.feed')),
                    label: p.querySelector('.overlay-label')?.textContent
                } : null;
            });
            await viewer.locator('#cam-pop').click();
            await expect.poll(popup).toEqual({open: true, feed: true, label: 'garden'});

            // ✕ closes
            await viewer.evaluate(() => document.querySelector('#cam-pop').shadowRoot.querySelector('.popup .close').click());
            await expect.poll(popup).toBe(null);

            // reopen → tap anywhere on the popup closes
            await viewer.locator('#cam-pop').click();
            await expect.poll(async () => (await popup())?.open).toBe(true);
            await viewer.evaluate(() => document.querySelector('#cam-pop').shadowRoot.querySelector('.popup').click());
            await expect.poll(popup).toBe(null);

            // reopen → Esc closes
            await viewer.locator('#cam-pop').click();
            await expect.poll(async () => (await popup())?.open).toBe(true);
            await viewer.keyboard.press('Escape');
            await expect.poll(popup).toBe(null);

            // popup-animation: none of the plain popup cycles above animated…
            expect(await viewer.evaluate(() => window.__popupAnimations || 0)).toBe(0);
            // …but the animated camera grows on open and shrinks on close.
            const animPopup = () => viewer.evaluate(() =>
                Boolean(document.querySelector('#cam-anim').shadowRoot.querySelector('.popup')));
            await viewer.locator('#cam-anim').click();
            await expect.poll(animPopup).toBe(true);
            expect(await viewer.evaluate(() => window.__popupAnimations)).toBe(1);
            await viewer.keyboard.press('Escape');
            await expect.poll(animPopup).toBe(false);
            expect(await viewer.evaluate(() => window.__popupAnimations)).toBe(2);

            // click-through: click the camera's centre — the button beneath fires.
            const box = await viewer.locator('#cam-thru').boundingBox();
            await viewer.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await expect.poll(() => received).toContainEqual(['cam/under', 'go']);
        } finally {
            await new Promise(resolve => sub.end(true, resolve));
            await viewer.close();
        }
    });
});

describe('webrtc (WHEP loopback)', () => {
    const RTC_SITE = 'camerartc';
    const RTC_HTML =
        '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
        '<feezal-element-material-camera id="cam-rtc" type="webrtc" src="/fake-whep/cam" click-action="popup" style="position:absolute;top:20px;left:20px;width:320px;height:180px;"></feezal-element-material-camera>' +
        '</feezal-view></feezal-site>';

    it('negotiates a WHEP session and plays live frames; the popup reuses the stream', async () => {
        await deploySite(stack.baseUrl, {name: RTC_SITE, html: RTC_HTML, connection: {backend: 'mqtt', uri: broker.uri}});

        const viewer = await stack.context.newPage();
        // In-page fake WHEP endpoint: answer the element's SDP offer with a
        // loopback RTCPeerConnection sending a live canvas captureStream —
        // exercises the element's real offer/POST/answer/ontrack path.
        await viewer.addInitScript(() => {
            const origFetch = window.fetch.bind(window);
            window.fetch = async (url, opts) => {
                if (!String(url).includes('/fake-whep')) return origFetch(url, opts);
                const pc = new RTCPeerConnection();
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 48;
                const ctx = canvas.getContext('2d');
                let hue = 0;
                setInterval(() => {
                    ctx.fillStyle = `hsl(${hue = (hue + 17) % 360}, 90%, 50%)`;
                    ctx.fillRect(0, 0, 64, 48);
                }, 100);
                const stream = canvas.captureStream(10);
                for (const track of stream.getTracks()) pc.addTrack(track, stream);
                await pc.setRemoteDescription({type: 'offer', sdp: opts.body});
                await pc.setLocalDescription(await pc.createAnswer());
                await new Promise(resolve => {
                    if (pc.iceGatheringState === 'complete') return resolve();
                    pc.addEventListener('icegatheringstatechange', () => {
                        if (pc.iceGatheringState === 'complete') resolve();
                    });
                    setTimeout(resolve, 2000);
                });
                window.__whepServerPc = pc;
                return new Response(pc.localDescription.sdp, {status: 201, headers: {'Content-Type': 'application/sdp'}});
            };
        });

        try {
            await viewer.goto(`${stack.baseUrl}/viewer/${RTC_SITE}`);
            await viewer.waitForSelector('#cam-rtc', {timeout: 30_000});

            // Live frames arrive in the inline <video>.
            await viewer.waitForFunction(() => {
                const v = document.querySelector('#cam-rtc')?.shadowRoot?.querySelector('video.feed');
                return v && v.srcObject && v.videoWidth > 0 && v.readyState >= 2;
            }, {timeout: 30_000});

            await expect.poll(() => viewer.evaluate(() =>
                document.querySelector('#cam-rtc').__pc.connectionState)).toBe('connected');
            expect(await viewer.evaluate(() =>
                document.querySelector('#cam-rtc').shadowRoot.querySelector('video.feed').muted)).toBe(true);

            // Popup shares the SAME MediaStream — no second WHEP session.
            await viewer.locator('#cam-rtc').click();
            await expect.poll(() => viewer.evaluate(() => {
                const root = document.querySelector('#cam-rtc').shadowRoot;
                const popupVideo = root.querySelector('.popup video.feed');
                return popupVideo ? popupVideo.srcObject === root.querySelector('video.feed').srcObject : false;
            })).toBe(true);
        } finally {
            await viewer.close();
        }
    });
});

describe('editor', () => {
    it('click actions are inert on the canvas; the element stays selectable', async () => {
        const page = stack.page;
        await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});

        await page.locator('#cam-pop').click();
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('#cam-pop').classList.contains('feezal-selected'))).toBe(true);
        // No popup on the canvas.
        expect(await page.evaluate(() =>
            Boolean(document.querySelector('#cam-pop').shadowRoot.querySelector('.popup')))).toBe(false);

        // click-through element is still selectable in the editor.
        await page.locator('#cam-thru').click();
        await expect.poll(() => page.evaluate(() =>
            document.querySelector('#cam-thru').classList.contains('feezal-selected'))).toBe(true);
    });
});
