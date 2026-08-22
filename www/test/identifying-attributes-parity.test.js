/**
 * U96 — the two identifying-attribute tables must not drift.
 *
 * The order is decided at SERIALIZATION (`feezal-app-editor.js`) and the join
 * onto the opening-tag line at FORMATTING (`server/src/format-html.js`). Both
 * need the same table, and they live on opposite sides of the wire, so nothing
 * but a test can hold them together.
 *
 * A drift is silent and asymmetric, which is why it earns a guard: an element
 * in only the serializer table gets its attributes reordered but never joined
 * (the fold still shows a bare tag); an element in only the formatter table
 * gets joined only when the author happened to write the attributes first.
 */
import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';
import {IDENTIFYING_ATTRS, IDENTIFYING_DEFAULT, IDENTIFYING_FIRST} from '../src/feezal-app-editor.js';

const require = createRequire(import.meta.url);
const server = require('../../server/src/format-html.js');

describe('identifying attributes: client ↔ server parity (U96)', () => {
    it('both sides know the same tags', () => {
        expect(Object.keys(IDENTIFYING_ATTRS).sort())
            .toEqual(Object.keys(server.IDENTIFYING).sort());
    });

    it('every tag maps to the same attribute order', () => {
        for (const [tag, attrs] of Object.entries(IDENTIFYING_ATTRS)) {
            expect(server.IDENTIFYING[tag], tag).toEqual(attrs);
        }
    });

    it('the fallback matches too', () => {
        expect(IDENTIFYING_DEFAULT).toEqual(server.IDENTIFYING_DEFAULT);
    });

    it('the table is not empty and covers the reported case', () => {
        // A parity test comparing two empty objects passes and proves nothing.
        expect(Object.keys(IDENTIFYING_ATTRS).length).toBeGreaterThan(5);
        expect(IDENTIFYING_ATTRS['feezal-element-basic-icon']).toEqual(['icon', 'subscribe']);
        expect(IDENTIFYING_ATTRS['feezal-view']).toEqual(['name']);
    });

    it('U113: feezal-id leads EVERY element on both sides', () => {
        expect(IDENTIFYING_FIRST).toEqual(['feezal-id']);
        expect(server.IDENTIFYING_FIRST).toEqual(IDENTIFYING_FIRST);
    });

    it('no entry leads with `label` — that is what the default is for', () => {
        // An override exists because the element has NO label; one that starts
        // with `label` is a copy-paste slip, not an override.
        for (const [tag, attrs] of Object.entries(IDENTIFYING_ATTRS)) {
            expect(attrs[0], tag).not.toBe('label');
        }
    });
});
