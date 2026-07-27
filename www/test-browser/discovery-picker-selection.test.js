/**
 * B86 — picking a device in the ⚡ discovery picker must stamp its attributes.
 *
 * This test exists because the previous suite could not fail for this bug. It
 * covered `stampDiscovery()` exhaustively and never exercised *selection*, so a
 * picker that silently stamped nothing passed everything.
 *
 * The defect lived in the one place unit tests cannot reach: the option value
 * was assembled in a Lit template with a NUL separator in its STATIC text, and
 * Lit prepares templates by parsing an HTML string — where a NUL in
 * attribute-value state becomes U+FFFD. `split()` then never matched, the id
 * never resolved, and `_onPickDiscovery` returned silently.
 *
 * So these assertions go through a REAL rendered template and a REAL
 * <sl-select>. Setting `option.value` as a property would bypass the parser and
 * pass even with the bug present — that mistake was made once already.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {html, render} from 'lit';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
// The REAL separator, not a copy of it. Binding to the production constant is
// the point: if it is ever changed back to something the HTML parser mangles
// (a NUL, as before), these tests go red. A local literal would keep passing.
import {DISCOVERY_ROW_SEP as SEP} from '../src/feezal-discovery-stamp.js';

// Ids chosen to exercise both dialects seen in the wild: an ESPHome id with
// slashes (node_id form) and a Homematic id with spaces and colons.
const IDS = [
    'sensor/vindriktning-hobbyraum/pm2_5',
    'hm-climate:Thermostat Hobbyraum:1',
];

let host;
beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
});

/** Render option values exactly the way the picker does — through Lit. */
function renderPicker(ids, selectValue = '') {
    render(html`
        <sl-select class="dp-select" size="small" value="${selectValue}">
            ${ids.map((id, i) => html`<sl-option
                value="${encodeURIComponent(id)}${SEP}${i}"
                >row ${i}</sl-option>`)}
        </sl-select>`, host);
    return host.querySelector('sl-select');
}

// The separator itself must satisfy three properties. These are what actually
// catch a regression: the tests below render it as an INTERPOLATED value, which
// Lit applies with setAttribute — no parsing, so a bad separator would survive
// there and the suite would pass while the picker was broken. (That mistake was
// made while writing this file.) Only an HTML-parse round-trip reproduces the
// original failure mode.
describe('DISCOVERY_ROW_SEP properties (B86)', () => {
    it('survives an HTML parse — the exact way B86 failed', () => {
        const t = document.createElement('template');
        t.innerHTML = `<i data-v="abc${SEP}7"></i>`;
        expect(t.content.querySelector('i').getAttribute('data-v'),
            'separator mangled by the HTML parser (NUL becomes U+FFFD)').toBe(`abc${SEP}7`);
    });

    it('cannot collide with the percent-encoded id half', () => {
        // encodeURIComponent leaves only alphanumerics and -_.!~*'() unescaped,
        // so an escaped separator can never appear inside an encoded id.
        expect(encodeURIComponent(SEP)).not.toBe(SEP);
        for (const id of IDS) expect(encodeURIComponent(id)).not.toContain(SEP);
    });

    it('is not a space — Shoelace treats that as a value delimiter', () => {
        expect(SEP).not.toMatch(/\s/);
        expect(SEP).toHaveLength(1);
    });
});

describe('discovery picker option values (B86)', () => {
    it('survive Lit template preparation and the HTML parser', async () => {
        const sel = renderPicker(IDS);
        await sel.updateComplete;
        const opts = [...sel.querySelectorAll('sl-option')];

        opts.forEach((o, i) => {
            const expected = encodeURIComponent(IDS[i]) + SEP + i;
            expect(o.value, `option ${i} value mangled by the parser`).toBe(expected);
            // the separator must still be there, and must not have become U+FFFD
            expect(o.value).toContain(SEP);
            expect(o.value).not.toContain('�');
        });
    });

    it('round-trip back to the original discovery id and row index', async () => {
        const sel = renderPicker(IDS);
        await sel.updateComplete;

        for (const [i, o] of [...sel.querySelectorAll('sl-option')].entries()) {
            const [encodedId, rowIndex] = String(o.value).split(SEP);
            expect(decodeURIComponent(encodedId), 'id did not round-trip').toBe(IDS[i]);
            expect(Number(rowIndex), 'row index did not round-trip').toBe(i);
        }
    });

    it('deliver an intact value through @sl-change when an option is chosen', async () => {
        const sel = renderPicker(IDS);
        await sel.updateComplete;
        const opts = [...sel.querySelectorAll('sl-option')];

        let delivered = null;
        sel.addEventListener('sl-change', e => { delivered = e.target.value; });
        // what Shoelace itself does on a click
        sel.value = opts[1].value;
        sel.dispatchEvent(new CustomEvent('sl-change'));
        await sel.updateComplete;

        const [encodedId, rowIndex] = String(delivered).split(SEP);
        expect(decodeURIComponent(encodedId)).toBe(IDS[1]);
        expect(Number(rowIndex)).toBe(1);
    });

    it('let the select preselect a linked row (the value must match an option)', async () => {
        // Regression for the second half of B86: the select used to bind the
        // bare encoded id with no row index, which matched no option, so
        // Shoelace cleared it and a linked device never showed as selected.
        const linked = encodeURIComponent(IDS[1]) + SEP + 1;
        const sel = renderPicker(IDS, linked);
        await sel.updateComplete;
        expect(sel.value, 'linked row not preselected').toBe(linked);
    });

    it('a bare id (no row index) would NOT resolve — the old bug, pinned', async () => {
        const sel = renderPicker(IDS, encodeURIComponent(IDS[1]));
        await sel.updateComplete;
        expect(sel.value).toBe('');
    });
});
