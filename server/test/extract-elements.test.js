/**
 * Unit tests for build/extract-elements.js — the parser that decides which
 * @feezal/* packages a static export must bundle. Pure string/FS logic, so a
 * temp dir is enough to exercise partitionPackages.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const {extractUsedElements, tagsToPackages, partitionPackages} = require('../src/build/extract-elements.js');

describe('extractUsedElements', () => {
    it('collects element and theme opening tags, sorted + deduped', () => {
        // The parser matches opening TAGS (<feezal-theme-…>), not class attributes.
        const html = `
            <feezal-site>
              <feezal-theme-dark-mint></feezal-theme-dark-mint>
              <feezal-view>
                <feezal-element-material-switch></feezal-element-material-switch>
                <feezal-element-material-switch></feezal-element-material-switch>
                <feezal-element-basic-gauge></feezal-element-basic-gauge>
              </feezal-view>
            </feezal-site>`;
        expect(extractUsedElements(html)).toEqual([
            'feezal-element-basic-gauge',
            'feezal-element-material-switch',
            'feezal-theme-dark-mint',
        ]);
    });

    it('picks up the repeater child-element attribute (no matching tag in markup)', () => {
        const html = `<feezal-element-basic-repeater child-element="feezal-element-material-light"></feezal-element-basic-repeater>`;
        expect(extractUsedElements(html)).toEqual([
            'feezal-element-basic-repeater',
            'feezal-element-material-light',
        ]);
    });

    it('returns [] for markup without feezal tags', () => {
        expect(extractUsedElements('<div><span>hi</span></div>')).toEqual([]);
    });

    it('does not match unrelated custom elements', () => {
        expect(extractUsedElements('<my-widget></my-widget>')).toEqual([]);
    });
});

describe('tagsToPackages', () => {
    it('maps every tag to its @feezal/ package name', () => {
        expect(tagsToPackages(['feezal-element-material-switch', 'feezal-theme-dark-mint']))
            .toEqual(['@feezal/feezal-element-material-switch', '@feezal/feezal-theme-dark-mint']);
    });
});

describe('partitionPackages', () => {
    let nm;
    beforeEach(async () => { nm = await mkdtemp(join(tmpdir(), 'feezal-nm-')); });
    afterEach(async () => { await rm(nm, {recursive: true, force: true}); });

    it('splits packages into those present on disk and those missing', async () => {
        await mkdir(join(nm, '@feezal', 'feezal-element-present'), {recursive: true});
        const {resolvable, missing} = partitionPackages(nm, [
            '@feezal/feezal-element-present',
            '@feezal/feezal-element-absent',
        ]);
        expect(resolvable).toEqual(['@feezal/feezal-element-present']);
        expect(missing).toEqual(['@feezal/feezal-element-absent']);
    });

    it('handles unscoped names too', async () => {
        await mkdir(join(nm, 'plain-pkg'), {recursive: true});
        const {resolvable, missing} = partitionPackages(nm, ['plain-pkg', 'nope']);
        expect(resolvable).toEqual(['plain-pkg']);
        expect(missing).toEqual(['nope']);
    });
});
