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


/**
 * B107 — the closing tag of a multi-line EMPTY element gets its own line.
 * bracketSameLine parks the `>` on the last attribute line, and with nothing
 * between the tags the closer glued straight onto it.
 */
describe('formatHtml — closing tag of a multi-line empty element (B107)', () => {
    const nav = '<feezal-site><feezal-view name="v" style="width:100%;height:100%;">' +
        '<feezal-element-basic-navigation style="width:200px;height:40px;top:0px;left:6px;" ' +
        'visible="" subscribe="home/nav" label="Nav"></feezal-element-basic-navigation>' +
        '</feezal-view></feezal-site>';

    it('breaks before the closing tag instead of gluing it to the last attribute', async () => {
        const out = await fmt(nav);
        expect(out).not.toMatch(/"><\/feezal-element-basic-navigation>/);
        expect(out.split('\n').some(l => l.trim() === '</feezal-element-basic-navigation>')).toBe(true);
    });

    it('indents the closing tag level with its opening tag', async () => {
        const lines = (await fmt(nav)).split('\n');
        const indent = l => l.match(/^\s*/)[0].length;
        const open = lines.findIndex(l => l.includes('<feezal-element-basic-navigation'));
        const close = lines.findIndex(l => l.trim() === '</feezal-element-basic-navigation>');
        expect(close).toBeGreaterThan(open);
        expect(indent(lines[close])).toBe(indent(lines[open]));
    });

    it('leaves a COMPACT one-line element alone', async () => {
        // `<tag a="1"></tag>` fits on one line — splitting it would be churn.
        const out = await fmt('<feezal-site><feezal-view name="v"><feezal-element-basic-number label="a">' +
            '</feezal-element-basic-number></feezal-view></feezal-site>');
        expect(out).toContain('<feezal-element-basic-number label="a"></feezal-element-basic-number>');
    });

    it('is a fixed point', async () => {
        const once = await fmt(nav);
        expect(await fmt(once)).toBe(once);
    });
});

/**
 * U92 — identifying attributes on the opening-tag line, so a folded element in
 * the Monaco source view still says which element it is.
 */
describe('formatHtml — identifying attributes lead the tag line (U92)', () => {
    const wrap = inner => `<feezal-site><feezal-view name="v" style="width:100%;height:100%;">${inner}</feezal-view></feezal-site>`;
    const bulk = 'class="feezal-element" style="position:absolute;left:20px;top:20px;width:344px;height:256px;"';
    /** The line carrying the element's opening tag. */
    const tagLine = (out, tag) => out.split('\n').find(l => l.includes(`<${tag}`));

    it('joins label AND subscribe when both lead', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-camera label="Hof" subscribe="frigate/hof" ${bulk}></feezal-element-basic-camera>`));
        expect(tagLine(out, 'feezal-element-basic-camera'))
            .toContain('<feezal-element-basic-camera label="Hof" subscribe="frigate/hof"');
    });

    it('joins label alone', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-camera label="Hof" ${bulk}></feezal-element-basic-camera>`));
        expect(tagLine(out, 'feezal-element-basic-camera')).toContain('label="Hof"');
    });

    it('joins subscribe alone', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-camera subscribe="frigate/hof" ${bulk}></feezal-element-basic-camera>`));
        expect(tagLine(out, 'feezal-element-basic-camera')).toContain('subscribe="frigate/hof"');
    });

    it('joins name for a view, not label', async () => {
        const out = await fmt('<feezal-site><feezal-view name="kitchen" label="ignored" ' +
            'style="width:100%;height:100%;background-image:linear-gradient(160deg,#0ea5e9,#0369a1);">' +
            '<feezal-element-basic-number label="a"></feezal-element-basic-number></feezal-view></feezal-site>');
        const line = tagLine(out, 'feezal-view');
        expect(line).toContain('name="kitchen"');
        expect(line).not.toContain('label="ignored"');   // not an identifying attr for a view
    });

    it('leaves an element with no identifying attribute untouched', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-number ${bulk} publish="x/y"></feezal-element-basic-number>`));
        expect(tagLine(out, 'feezal-element-basic-number').trim()).toBe('<feezal-element-basic-number');
    });

    it('does NOT reorder: an identifying attribute that is not first stays put', async () => {
        // The pass only joins what already leads — serialization decides order,
        // so hand-written source keeps the shape its author gave it.
        const out = await fmt(wrap(`<feezal-element-basic-camera ${bulk} label="Hof"></feezal-element-basic-camera>`));
        expect(tagLine(out, 'feezal-element-basic-camera').trim()).toBe('<feezal-element-basic-camera');
    });

    it('joins at most two attributes', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-camera label="Hof" subscribe="a/b" publish="c/d" ${bulk}></feezal-element-basic-camera>`));
        const line = tagLine(out, 'feezal-element-basic-camera');
        expect(line).toContain('label="Hof"');
        expect(line).toContain('subscribe="a/b"');
        expect(line).not.toContain('publish="c/d"');
    });

    it('U113: joins feezal-id, label AND subscribe — three, when the id leads', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-camera feezal-id="cam" label="Hof" subscribe="a/b" publish="c/d" ${bulk}></feezal-element-basic-camera>`));
        const line = tagLine(out, 'feezal-element-basic-camera');
        expect(line).toContain('feezal-id="cam"');
        expect(line).toContain('label="Hof"');
        expect(line).toContain('subscribe="a/b"');
        expect(line).not.toContain('publish="c/d"');
    });

    it('is a fixed point — a joined line is recognised as already done', async () => {
        const once = await fmt(wrap(`<feezal-element-basic-camera label="Hof" subscribe="frigate/hof" ${bulk}></feezal-element-basic-camera>`));
        expect(await fmt(once)).toBe(once);
    });
});

/**
 * U96 — elements that have NO `label` need their own identifying attributes.
 * With only the U92 default they fold to a bare tag, which is exactly the
 * problem U92 set out to fix; the default just could not see them.
 */
describe('formatHtml — label-less elements lead with their own identity (U96)', () => {
    const wrap = inner => `<feezal-site><feezal-view name="v" style="width:100%;height:100%;">${inner}</feezal-view></feezal-site>`;
    const bulk = 'class="feezal-element" style="position:absolute;left:20px;top:20px;width:344px;height:256px;"';
    const tagLine = (out, tag) => out.split('\n').find(l => l.includes(`<${tag}`));

    it('basic-icon leads with icon, then subscribe', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-icon icon="lightbulb" subscribe="home/lamp" ${bulk}></feezal-element-basic-icon>`));
        expect(tagLine(out, 'feezal-element-basic-icon'))
            .toContain('<feezal-element-basic-icon icon="lightbulb" subscribe="home/lamp"');
    });

    it('basic-image leads with src', async () => {
        const out = await fmt(wrap(`<feezal-element-basic-image src="/assets/plan.png" ${bulk}></feezal-element-basic-image>`));
        expect(tagLine(out, 'feezal-element-basic-image')).toContain('src="/assets/plan.png"');
    });

    it('a dialog-view leads with the view it embeds', async () => {
        const out = await fmt(wrap(`<feezal-element-glass-dialog-view view="details" ${bulk}></feezal-element-glass-dialog-view>`));
        expect(tagLine(out, 'feezal-element-glass-dialog-view')).toContain('view="details"');
    });

    it('does not apply an override to an element that has a label', async () => {
        // The default still governs everything not in the table.
        const out = await fmt(wrap(`<feezal-element-basic-camera label="Hof" subscribe="frigate/hof" ${bulk}></feezal-element-basic-camera>`));
        expect(tagLine(out, 'feezal-element-basic-camera'))
            .toContain('label="Hof" subscribe="frigate/hof"');
    });

    it('is a fixed point', async () => {
        const once = await fmt(wrap(`<feezal-element-basic-icon icon="lightbulb" subscribe="home/lamp" ${bulk}></feezal-element-basic-icon>`));
        expect(await fmt(once)).toBe(once);
    });
});
