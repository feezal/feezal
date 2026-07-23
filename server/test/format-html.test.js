import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const {formatHtml, FORMAT_OPTIONS} = require('../src/format-html.js');

describe('formatHtml (prettier)', () => {
    it('pretty-prints and returns {html, error:null}', async () => {
        const {html, error} = await formatHtml('<feezal-site><feezal-view name="a"><feezal-element-glass-switch topic="x"></feezal-element-glass-switch></feezal-view></feezal-site>');
        expect(error).toBeNull();
        expect(html).toContain('\n');                          // indented
        expect(html).toContain('<feezal-view name="a">');
        expect(html).toContain('topic="x"');
    });

    it('is idempotent (no churn on re-save)', async () => {
        const src = '<feezal-site><feezal-view name="a"><feezal-element-material-button label="Hi" publish="p"></feezal-element-material-button></feezal-view></feezal-site>';
        const {html: once} = await formatHtml(src);
        const {html: twice} = await formatHtml(once);
        expect(twice).toBe(once);
    });

    it('formats an element carrying both value and type (the old prettyhtml crash)', async () => {
        const {html, error} = await formatHtml('<feezal-element-glass-sensor value="" type="generic" subscribe="a/b"></feezal-element-glass-sensor>');
        expect(error).toBeNull();
        expect(html).toContain('type="generic"');
        expect(html).toContain('feezal-element-glass-sensor');
    });

    it('never throws — returns the raw input on any failure', async () => {
        // Whatever the input, the contract is: resolves with a string html and
        // never rejects (formatting is cosmetic and must never lose work).
        for (const input of ['', '<div', '<<>>', '<feezal-element-x a="', 'plain text']) {
            const {html} = await formatHtml(input);
            expect(typeof html).toBe('string');
        }
    });

    it('exposes shared options (parser html, 4-space indent)', () => {
        expect(FORMAT_OPTIONS.parser).toBe('html');
        expect(FORMAT_OPTIONS.tabWidth).toBe(4);
    });
});
