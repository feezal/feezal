/**
 * E2E: B121 — a glass details popup frosts exactly like its card.
 *
 * The report was "the popup renders solid"; the styling was demonstrably
 * present (popover-promoted, `backdrop-filter: blur(20px)`, not degraded). What
 * differed was the FALLBACK behind the shared variable: `.card` fell back to
 * `rgba(255,255,255,0.35)` and `.details` to `0.7`. A theme that sets
 * `--feezal-glass-tint` made them agree, so the drift only showed with no theme
 * — twice the opacity, and the frost had almost nothing left to transmit.
 *
 * Needs a real browser twice over: `backdrop-filter` has no computed-style
 * answer for "did it blur anything", and the tint only matters as the fraction
 * of the page it lets through.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {startStack, stopStack, deploySite} from './harness.js';

const require = createRequire(import.meta.url);
const {PNG} = require('pngjs');

const SITE = 'glassfrost';
// Hard stripes: a working frost transmits them as a smooth gradient (variance
// survives the blur); an opaque panel flattens them to nothing.
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;' +
    'background-image:repeating-linear-gradient(45deg,#ff0000 0 20px,#0000ff 20px 40px);">' +
    '<feezal-element-glass-light label="Lamp" subscribe="h/l" publish="h/l/set" ' +
    'style="position:absolute;left:40px;top:40px;width:172px;height:128px;"></feezal-element-glass-light>' +
    '</feezal-view></feezal-site>';

let stack, page;

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    await page.goto(`${stack.baseUrl}/viewer/${SITE}/`);
    await page.waitForSelector('feezal-element-glass-light', {timeout: 60_000});
}, 90_000);

afterAll(async () => { await stopStack(stack); });

/** Standard deviation of the RGB samples in a screenshot — "how much of the
 *  page behind is still visible through this". */
function spread(buffer) {
    const png = PNG.sync.read(buffer);
    let n = 0, sum = 0, sumSq = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const v = png.data[i + c];
            n++; sum += v; sumSq += v * v;
        }
    }
    const mean = sum / n;
    return Math.sqrt(sumSq / n - mean * mean);
}

const openDetails = () => page.evaluate(() =>
    document.querySelector('feezal-element-glass-light').openDetails());
const closeDetails = () => page.evaluate(() =>
    document.querySelector('feezal-element-glass-light')._closeDetails());

describe('B121 — popup frost equals card frost', () => {
    it('resolves the SAME tint for the popup as for the card', async () => {
        // The assertion that would have caught the drift, and the one that
        // keeps holding when a theme supplies the variable.
        await openDetails();
        await page.waitForTimeout(200);
        const colours = await page.evaluate(() => {
            const card = document.querySelector('feezal-element-glass-light');
            const root = card.shadowRoot;
            return {
                card: getComputedStyle(root.querySelector('.card')).backgroundColor,
                popup: getComputedStyle(root.querySelector('.details')).backgroundColor,
                cardBlur: getComputedStyle(root.querySelector('.card')).backdropFilter,
                popupBlur: getComputedStyle(root.querySelector('.details')).backdropFilter,
            };
        });
        await closeDetails();
        expect(colours.popup).toBe(colours.card);
        expect(colours.popupBlur).toBe(colours.cardBlur);
    });

    it('actually transmits the page behind it, as much as the card does', async () => {
        // The popup's own ::backdrop dim is deliberate (modal treatment) and
        // darkens what there is to transmit, so the comparison is made without
        // it — otherwise this measures the dim, not the frost.
        await page.evaluate(() => {
            const card = document.querySelector('feezal-element-glass-light');
            const s = document.createElement('style');
            s.id = 'b121-no-dim';
            s.textContent = '.details::backdrop { background: transparent !important; }';
            card.shadowRoot.append(s);
        });

        await closeDetails();
        await page.waitForTimeout(250);
        const cardClip = await page.evaluate(() => {
            const r = document.querySelector('feezal-element-glass-light').getBoundingClientRect();
            return {x: Math.round(r.x + 8), y: Math.round(r.y + r.height - 24),
                width: Math.round(r.width - 16), height: 16};
        });
        const cardSpread = spread(await page.screenshot({clip: cardClip}));

        await openDetails();
        await page.waitForTimeout(300);
        const popupClip = await page.evaluate(() => {
            const d = document.querySelector('feezal-element-glass-light').shadowRoot.querySelector('.details');
            const r = d.getBoundingClientRect();
            return {x: Math.round(r.x + 20), y: Math.round(r.y + r.height - 30),
                width: Math.round(r.width - 40), height: 20};
        });
        const popupSpread = spread(await page.screenshot({clip: popupClip}));
        await closeDetails();
        await page.evaluate(() => document.querySelector('feezal-element-glass-light')
            .shadowRoot.querySelector('#b121-no-dim')?.remove());

        // The stripes must survive the blur at all…
        expect(cardSpread).toBeGreaterThan(15);
        // …and the popup must transmit as much of them as the card. At the old
        // 0.7 tint this ratio was ~0.5; a tolerance well below 1 still fails it.
        expect(popupSpread / cardSpread).toBeGreaterThan(0.8);
    });

    it('is promoted to the top layer, so its blur samples the page', async () => {
        // Not the cause here, but the thing that would silently break the frost
        // again: inside the card's shadow tree the card's own backdrop-filter
        // would become the popup's backdrop root.
        await openDetails();
        await page.waitForTimeout(200);
        const open = await page.evaluate(() => document
            .querySelector('feezal-element-glass-light').shadowRoot
            .querySelector('.details').matches(':popover-open'));
        await closeDetails();
        expect(open).toBe(true);
    });
});
