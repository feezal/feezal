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


/**
 * B105 — block formatting.
 *
 * Custom elements have no known CSS display, so prettier treats them as inline;
 * under its default whitespace sensitivity it refuses to introduce whitespace
 * around their tags, which produced a line break INSIDE a closing tag with the
 * `>` hugging the next opening tag.
 */
const light = (label, top) =>
    `<feezal-element-glass-light label="${label}" subscribe="home/${label}" ` +
    `publish="home/${label}/set" subscribe-availability="home/${label}/avail" ` +
    `style="position:absolute;left:20px;top:${top}px;width:172px;height:128px;">` +
    '</feezal-element-glass-light>';

/** The reported shape: views containing only custom elements, no text. */
const REPORTED = '<feezal-site>' +
    `<feezal-view name="view1" style="width:100%;height:100%;">${light('a', 20)}${light('b', 160)}</feezal-view>` +
    `<feezal-view name="view2" style="width:100%;height:100%;">${light('c', 20)}</feezal-view>` +
    '</feezal-site>';

const fmt = async html => (await formatHtml(html)).html;

describe('formatHtml — block formatting (B105)', () => {
    it('never breaks a line inside a closing tag', async () => {
        const out = await fmt(REPORTED);
        expect(out).not.toMatch(/<\/[a-zA-Z][\w-]*\s*\n/);
    });

    it('never hugs a bracket against the next opening tag', async () => {
        const out = await fmt(REPORTED);
        expect(out).not.toMatch(/\n\s*><[a-zA-Z]/);
    });

    it('puts each closing tag on its own line', async () => {
        const out = await fmt(REPORTED);
        const lines = out.split('\n').map(l => l.trim());
        for (const tag of ['</feezal-view>', '</feezal-site>']) {
            expect(lines.includes(tag), `${tag} sits alone on a line`).toBe(true);
        }
        expect(out).not.toMatch(/<\/[a-zA-Z][\w-]*><\/[a-zA-Z]/);   // no glued run
    });

    it('keeps one attribute per line for elements past the print width', async () => {
        // The fix must not cost the attribute formatting.
        const out = await fmt(REPORTED);
        expect(out).toMatch(/\n\s+subscribe-availability="home\/a\/avail"/);
    });

    it('is a fixed point — formatting twice changes nothing', async () => {
        const once = await fmt(REPORTED);
        expect(await fmt(once)).toBe(once);
    });

    it('indents nested elements under their view', async () => {
        const lines = (await fmt(REPORTED)).split('\n');
        const view = lines.findIndex(l => l.includes('<feezal-view name="view1"'));
        const child = lines.findIndex(l => l.includes('<feezal-element-glass-light'));
        expect(child).toBeGreaterThan(view);
        const indent = l => l.match(/^\s*/)[0].length;
        expect(indent(lines[child])).toBeGreaterThan(indent(lines[view]));
    });
});

describe('formatHtml — template bodies are user content, not formatting', () => {
    const tight = '<feezal-site><feezal-view name="v" style="width:100%;height:100%;">' +
        '<feezal-element-basic-template><template><b>bold</b>glued<i>italic</i></template>' +
        '</feezal-element-basic-template></feezal-view></feezal-site>';

    it('leaves inline markup with no whitespace between its parts untouched', async () => {
        // Reflowing this inserts whitespace the browser collapses to a space —
        // "boldglueditalic" would start rendering as "bold glued italic". That
        // is a rendering change, not a formatting change.
        expect(await fmt(tight)).toContain('<b>bold</b>glued<i>italic</i>');
    });

    it('preserves a template body byte-for-byte, including its own indentation', async () => {
        const body = '\n  <div class="row">\n      <span>a</span><span>b</span>\n  </div>\n';
        const html = '<feezal-site><feezal-view name="v"><feezal-element-basic-template>' +
            `<template>${body}</template></feezal-element-basic-template></feezal-view></feezal-site>`;
        expect(await fmt(html)).toContain(`<template>${body}</template>`);
    });

    it('handles several templates without crossing their bodies over', async () => {
        const html = '<feezal-site><feezal-view name="v">' +
            '<feezal-element-basic-template><template><i>one</i>ONE</template></feezal-element-basic-template>' +
            '<feezal-element-basic-template><template><i>two</i>TWO</template></feezal-element-basic-template>' +
            '</feezal-view></feezal-site>';
        const out = await fmt(html);
        expect(out).toContain('<template><i>one</i>ONE</template>');
        expect(out).toContain('<template><i>two</i>TWO</template>');
    });

    it('leaves no placeholder token behind', async () => {
        expect(await fmt(tight)).not.toMatch(/__FEEZAL_TEMPLATE_BODY_/);
    });

    it('does not interpret $-sequences in template markup as replacement patterns', async () => {
        // `$&` / `$1` inside user content would be expanded by a string
        // replacement — the restore uses a function to avoid exactly that.
        const html = '<feezal-site><feezal-view name="v"><feezal-element-basic-template>' +
            '<template>cost: $&amp; and $1 and $$</template>' +
            '</feezal-element-basic-template></feezal-view></feezal-site>';
        expect(await fmt(html)).toContain('<template>cost: $&amp; and $1 and $$</template>');
    });

    it('is still a fixed point with templates present', async () => {
        const once = await fmt(tight);
        expect(await fmt(once)).toBe(once);
    });
});
