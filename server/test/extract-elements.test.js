/**
 * Unit tests for build/extract-elements.js — the parser that decides which
 * @feezal/* packages a static export must bundle. Pure string/FS logic, so a
 * temp dir is enough to exercise partitionPackages.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const {extractUsedElements, tagsToPackages, buildTagToPackageMap, partitionPackages} = require('../src/build/extract-elements.js');

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
        const html = `<feezal-element-layout-repeater child-element="feezal-element-material-light"></feezal-element-layout-repeater>`;
        expect(extractUsedElements(html)).toEqual([
            'feezal-element-layout-repeater',
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

    it('resolves family tags through the map and dedupes the package (N29 Phase B)', () => {
        const tagMap = {
            'feezal-element-metro-tile':   '@feezal/feezal-elements-metro',
            'feezal-element-metro-appbar': '@feezal/feezal-elements-metro',
        };
        expect(tagsToPackages(
            ['feezal-element-metro-tile', 'feezal-element-metro-appbar', 'feezal-element-basic-gauge'],
            tagMap
        )).toEqual(['@feezal/feezal-elements-metro', '@feezal/feezal-element-basic-gauge']);
    });
});

describe('buildTagToPackageMap (N29 Phase B)', () => {
    let nm;
    beforeEach(async () => { nm = await mkdtemp(join(tmpdir(), 'feezal-nm-')); });
    afterEach(async () => { await rm(nm, {recursive: true, force: true}); });

    async function pkg(rel, json) {
        const dir = join(nm, ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(json));
    }

    it('maps declared tags of scoped and unscoped family packages', async () => {
        await pkg('@feezal/feezal-elements-metro', {
            name: '@feezal/feezal-elements-metro',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']},
        });
        await pkg('feezal-elements-hmi', {
            name: 'feezal-elements-hmi',
            feezal: {type: 'elements', elements: ['feezal-element-hmi-valve']},
        });
        expect(buildTagToPackageMap(nm)).toEqual({
            'feezal-element-metro-tile':   '@feezal/feezal-elements-metro',
            'feezal-element-metro-appbar': '@feezal/feezal-elements-metro',
            'feezal-element-hmi-valve':    'feezal-elements-hmi',
        });
    });

    it('skips Phase A set markers and single-element packages', async () => {
        await pkg('@feezal/feezal-elements-eink', {
            name: '@feezal/feezal-elements-eink',
            feezal: {type: 'bundle', elements: ['@feezal/feezal-element-eink-value']},
        });
        await pkg('@feezal/feezal-element-basic-gauge', {name: '@feezal/feezal-element-basic-gauge'});
        expect(buildTagToPackageMap(nm)).toEqual({});
    });

    it('returns an empty map for a missing node_modules dir', () => {
        expect(buildTagToPackageMap(join(nm, 'nope'))).toEqual({});
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
