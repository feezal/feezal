/**
 * B82 — a placed `system-splash` must not make the document scroll.
 *
 * It is a pseudo-element that renders nothing once boot finishes, but it kept a
 * real box: `defaultStyle` gives it 160x40, the editor writes that as an inline
 * style, and B71 hoists it to `<body>`. So `<body>` ended up one viewport of app
 * PLUS a leftover 40px block — the document scrolled by exactly the splash's
 * height, and that strip showed the body background (an outer scrollbar and a
 * white bar, worse on iOS where the URL bar changes the viewport).
 *
 * Measured rather than inspected: two identical sites differing only by the
 * splash element, comparing `scrollHeight - clientHeight` on the document.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const CARDS = Array.from({length: 12}, (_, i) =>
    `<feezal-element-basic-number subscribe="d/${i}" label="N${i}" ` +
    'style="width:150px;height:110px;"></feezal-element-basic-number>').join('');

// exactly what the editor serializes for a placed splash
const SPLASH = '<feezal-element-system-splash ' +
    'style="top:10px;left:10px;width:160px;height:40px;"></feezal-element-system-splash>';

const site = extra =>
    '<feezal-site><feezal-view name="main" child-position="flow" ' +
    'style="width:100%;height:100%;background:rgb(11,37,69);">' +
    CARDS + extra + '</feezal-view></feezal-site>';

let stack;

beforeAll(async () => {
    stack = await startStack();
    await deploySite(stack.baseUrl, {name: 'nosplash', html: site('')});
    await deploySite(stack.baseUrl, {name: 'withsplash', html: site(SPLASH)});
}, 180_000);

afterAll(async () => {
    await stopStack(stack);
});

async function probe(name) {
    const page = await stack.context.newPage();
    await page.setViewportSize({width: 420, height: 720});
    await page.goto(stack.baseUrl + '/viewer/' + name, {waitUntil: 'networkidle'});
    // past the settle window + fade, so the splash has reached its done state
    await page.waitForTimeout(4000);
    const out = await page.evaluate(() => {
        const de = document.documentElement;
        const splash = document.querySelector('feezal-element-system-splash');
        return {
            documentScrollsBy: de.scrollHeight - de.clientHeight,
            bodyScrollHeight: document.body.scrollHeight,
            viewportH: window.innerHeight,
            splashPresent: !!splash,
            splashDisplay: splash ? getComputedStyle(splash).display : null,
            splashHeight: splash ? Math.round(splash.getBoundingClientRect().height) : null,
        };
    });
    await page.close();
    return out;
}

describe('B82 — a placed splash must not add document scroll', () => {
    it('baseline: no splash, document does not scroll', async () => {
        const r = await probe('nosplash');
        expect(r.documentScrollsBy).toBe(0);
        expect(r.bodyScrollHeight).toBe(r.viewportH);
    });

    it('with a splash placed, the document still does not scroll', async () => {
        const r = await probe('withsplash');
        expect(r.splashPresent, 'the splash should still be in the DOM').toBe(true);
        // the actual regression: this was 40, exactly the splash's height
        expect(r.documentScrollsBy, 'splash added document scroll').toBe(0);
        expect(r.bodyScrollHeight).toBe(r.viewportH);
    });

    it('the splash host occupies no layout space in the viewer', async () => {
        const r = await probe('withsplash');
        // display:contents rather than a zero-height block — the overlay is
        // position:fixed and never needed a host box.
        expect(r.splashDisplay).toBe('contents');
        expect(r.splashHeight).toBe(0);
    });
});
