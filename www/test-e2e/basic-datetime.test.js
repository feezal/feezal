/**
 * E2E: basic-datetime element — a live clock in the real viewer:
 *   - renders the configured date-fns format and ticks
 *   - locale drives the language of formatted names
 *   - timezone shifts the displayed time
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'basicdatetime';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;">' +
    '<feezal-element-basic-datetime id="clock" format="yyyy-MM-dd HH:mm:ss" locale="enUS" timezone="UTC" style="position:absolute;top:20px;left:20px;width:220px;height:24px;"></feezal-element-basic-datetime>' +
    '<feezal-element-basic-datetime id="weekday" format="cccc" locale="de" timezone="UTC" style="position:absolute;top:60px;left:20px;width:220px;height:24px;"></feezal-element-basic-datetime>' +
    '<feezal-element-basic-datetime id="kiritimati" format="HH" locale="enUS" timezone="Pacific/Kiritimati" style="position:absolute;top:100px;left:20px;width:80px;height:24px;"></feezal-element-basic-datetime>' +
    '<feezal-element-basic-datetime id="utc" format="HH" locale="enUS" timezone="UTC" style="position:absolute;top:140px;left:20px;width:80px;height:24px;"></feezal-element-basic-datetime>' +
    '</feezal-view></feezal-site>';

let stack;
let viewer;

const text = id => viewer.locator(`#${id} span`).textContent();

beforeAll(async () => {
    stack = await startStack();
    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    viewer = await stack.context.newPage();
    await viewer.goto(`${stack.baseUrl}/viewer/${SITE}`);
    await viewer.waitForSelector('feezal-element-basic-datetime', {timeout: 30_000});
}, 120_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await viewer.close();
    await stopStack(stack);
});

describe('basic-datetime', () => {
    it('renders the configured format', async () => {
        await expect.poll(() => text('clock'), {timeout: 10_000})
            .toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('ticks with the clock', async () => {
        const before = await text('clock');
        await expect.poll(() => text('clock'), {timeout: 5_000}).not.toBe(before);
    });

    it('formats names in the configured locale', async () => {
        await expect.poll(() => text('weekday'), {timeout: 10_000})
            .toMatch(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/);
    });

    it('respects the configured timezone', async () => {
        // Kiritimati is UTC+14 — its hour never equals the UTC hour.
        await expect.poll(() => text('utc'), {timeout: 10_000}).toMatch(/^\d{2}$/);
        expect(await text('kiritimati')).not.toBe(await text('utc'));
    });
});
