import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const pm = require('../src/build/install.js');

describe('install — pure helpers', () => {
    it('derives type from the name prefix (icons enabled with N23)', () => {
        expect(pm.derivePkgType('feezal-element-gauge')).toBe('element');
        expect(pm.derivePkgType('@acme/feezal-theme-neon')).toBe('theme');
        expect(pm.derivePkgType('feezal-icons-lucide')).toBe('icons');
        expect(pm.derivePkgType('react')).toBe(null);
    });

    it('derives bundle type from the plural feezal-elements- prefix (N29)', () => {
        expect(pm.derivePkgType('@feezal/feezal-elements-eink')).toBe('bundle');
        expect(pm.derivePkgType('feezal-elements-hmi')).toBe('bundle');
        // the plural prefix must not swallow regular element names (and vice versa)
        expect(pm.derivePkgType('@feezal/feezal-element-eink-value')).toBe('element');
    });

    it('allows only valid feezal add-on names', () => {
        expect(pm.isAllowedPackage('feezal-element-x')).toBe(true);
        expect(pm.isAllowedPackage('@scope/feezal-theme-y')).toBe(true);
        expect(pm.isAllowedPackage('feezal-icons-x')).toBe(true);   // N23
        expect(pm.isAllowedPackage('@feezal/feezal-elements-eink')).toBe(true); // N29
        expect(pm.isAllowedPackage('react')).toBe(false);
        expect(pm.isAllowedPackage('../evil')).toBe(false);
        expect(pm.isAllowedPackage('')).toBe(false);
    });

    it('maps type → registry keyword', () => {
        expect(pm.typeKeyword('element')).toBe('feezal-element');
        expect(pm.typeKeyword('theme')).toBe('feezal-theme');
        expect(pm.typeKeyword('icons')).toBe('feezal-icons');
        expect(pm.typeKeyword('bundle')).toBe('feezal-elements');   // N29
    });

    it('resolves install dirs, preserving @scope/', () => {
        expect(pm.pkgDir('/data', 'feezal-element-x').split(/[\\/]/).join('/')).toBe('/data/elements/feezal-element-x');
        expect(pm.pkgDir('/data', '@a/feezal-theme-y').split(/[\\/]/).join('/')).toBe('/data/elements/@a/feezal-theme-y');
    });
});

describe('install — list / remove', () => {
    let dataDir;
    beforeEach(async () => { dataDir = await mkdtemp(join(tmpdir(), 'feezal-pm-')); });
    afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

    async function fakePkg(rel, pkg) {
        const dir = join(dataDir, 'elements', ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
        await writeFile(join(dir, 'index.js'), '/* bundle */');
    }

    it('lists installed packages of all types, scoped included', async () => {
        await fakePkg('feezal-element-gauge', {name: 'feezal-element-gauge', version: '1.2.0', feezal: {type: 'element'}});
        await fakePkg('@acme/feezal-theme-neon', {name: '@acme/feezal-theme-neon', version: '0.3.1', feezal: {type: 'theme'}});
        const list = await pm.listInstalled(dataDir);
        expect(list.map(p => p.name).sort()).toEqual(['@acme/feezal-theme-neon', 'feezal-element-gauge']);
        expect(list.find(p => p.name === 'feezal-element-gauge')).toMatchObject({version: '1.2.0', type: 'element'});
        expect(list.find(p => p.name === '@acme/feezal-theme-neon')).toMatchObject({version: '0.3.1', type: 'theme'});
    });

    it('removes a package (and prunes its empty @scope dir)', async () => {
        await fakePkg('@acme/feezal-theme-neon', {name: '@acme/feezal-theme-neon', version: '0.1.0'});
        await pm.removePackage(dataDir, '@acme/feezal-theme-neon');
        expect(await pm.listInstalled(dataDir)).toEqual([]);
    });

    it('rejects removing a non-feezal / traversal name', async () => {
        await expect(pm.removePackage(dataDir, '../../etc')).rejects.toThrow();
        await expect(pm.removePackage(dataDir, 'react')).rejects.toThrow();
    });
});

describe('install — element sets (N29 Phase A)', () => {
    let dataDir;
    beforeEach(async () => { dataDir = await mkdtemp(join(tmpdir(), 'feezal-pm-')); });
    afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

    async function fakePkg(rel, pkg, withCode = true) {
        const dir = join(dataDir, 'elements', ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
        if (withCode) await writeFile(join(dir, 'index.js'), '/* bundle */');
    }

    const SET = '@feezal/feezal-elements-eink';

    async function installedSet() {
        // What _installBundleMembers writes: code-less marker + members recording the set.
        await fakePkg(SET, {name: SET, version: '3.0.1',
            feezal: {type: 'bundle', elements: ['@feezal/feezal-element-eink-value', '@feezal/feezal-element-eink-clock']}}, false);
        await fakePkg('@feezal/feezal-element-eink-value',
            {name: '@feezal/feezal-element-eink-value', version: '3.0.1', main: 'index.js', feezal: {type: 'element', set: SET}});
        await fakePkg('@feezal/feezal-element-eink-clock',
            {name: '@feezal/feezal-element-eink-clock', version: '3.0.1', main: 'index.js', feezal: {type: 'element', set: SET}});
    }

    it('lists the set marker with type bundle and members with their set', async () => {
        await installedSet();
        const list = await pm.listInstalled(dataDir);
        expect(list.find(p => p.name === SET)).toMatchObject({type: 'bundle', version: '3.0.1'});
        expect(list.find(p => p.name === '@feezal/feezal-element-eink-value')).toMatchObject({type: 'element', set: SET});
        expect(list.filter(p => p.set === SET)).toHaveLength(2);
    });

    it('removing the set removes its members and the marker', async () => {
        await installedSet();
        await pm.removePackage(dataDir, SET);
        expect(await pm.listInstalled(dataDir)).toEqual([]);
    });

    it('removing the set spares members owned by another set or installed individually', async () => {
        await installedSet();
        // individually installed (no set) — listed in the manifest but not owned by it
        await fakePkg('@feezal/feezal-element-eink-state',
            {name: '@feezal/feezal-element-eink-state', version: '3.0.1', main: 'index.js', feezal: {type: 'element'}});
        await fakePkg(SET, {name: SET, version: '3.0.1',
            feezal: {type: 'bundle', elements: [
                '@feezal/feezal-element-eink-value', '@feezal/feezal-element-eink-clock', '@feezal/feezal-element-eink-state']}}, false);
        await pm.removePackage(dataDir, SET);
        const names = (await pm.listInstalled(dataDir)).map(p => p.name);
        expect(names).toEqual(['@feezal/feezal-element-eink-state']);
    });

    it('removing a single member leaves the set marker and its siblings alone', async () => {
        await installedSet();
        await pm.removePackage(dataDir, '@feezal/feezal-element-eink-clock');
        const names = (await pm.listInstalled(dataDir)).map(p => p.name).sort();
        expect(names).toEqual(['@feezal/feezal-element-eink-value', SET].sort());
    });

    it('a malicious bundle manifest cannot delete outside the elements dir', async () => {
        await fakePkg(SET, {name: SET, version: '1.0.0',
            feezal: {type: 'bundle', elements: ['../../secrets', 'react', 'feezal-elements-nested']}}, false);
        await writeFile(join(dataDir, 'canary.txt'), 'still here');
        await pm.removePackage(dataDir, SET); // must not throw, must not touch non-feezal names
        const {readFile: rf} = await import('fs/promises');
        expect(await rf(join(dataDir, 'canary.txt'), 'utf8')).toBe('still here');
        expect(await pm.listInstalled(dataDir)).toEqual([]);
    });
});

describe('install — sidecar asset copy (N23 icon sets)', () => {
    let srcDir, destDir;
    beforeEach(async () => {
        srcDir  = await mkdtemp(join(tmpdir(), 'feezal-assets-src-'));
        destDir = await mkdtemp(join(tmpdir(), 'feezal-assets-dst-'));
    });
    afterEach(async () => {
        await rm(srcDir, {recursive: true, force: true});
        await rm(destDir, {recursive: true, force: true});
    });

    async function file(rel, content = 'x') {
        const abs = join(srcDir, ...rel.split('/'));
        await mkdir(join(abs, '..'), {recursive: true});
        await writeFile(abs, content);
    }

    it('copies fonts/SVGs/LICENSE, skips JS/maps/markdown/package.json/node_modules', async () => {
        await file('index.js');
        await file('index.js.map');
        await file('README.md');
        await file('package.json', '{}');
        await file('LICENSE', 'CC BY-SA 3.0');
        await file('assets/set.woff2', 'font');
        await file('assets/icons/light.svg', '<svg/>');
        await file('node_modules/dep/inner.woff2', 'nope');

        const copied = await pm.copyAssets(srcDir, destDir);
        expect(copied).toBe(3);

        const {readFile: rf} = await import('fs/promises');
        expect(await rf(join(destDir, 'LICENSE'), 'utf8')).toBe('CC BY-SA 3.0');
        expect(await rf(join(destDir, 'assets', 'set.woff2'), 'utf8')).toBe('font');
        expect(await rf(join(destDir, 'assets', 'icons', 'light.svg'), 'utf8')).toBe('<svg/>');
        await expect(rf(join(destDir, 'index.js'), 'utf8')).rejects.toThrow();
        await expect(rf(join(destDir, 'node_modules', 'dep', 'inner.woff2'), 'utf8')).rejects.toThrow();
    });
});

describe('install — multi-element family packages (N29 Phase B)', () => {
    let dataDir;
    beforeEach(async () => { dataDir = await mkdtemp(join(tmpdir(), 'feezal-pm-')); });
    afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

    async function fakePkg(rel, pkg) {
        const dir = join(dataDir, 'elements', ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
        await writeFile(join(dir, 'index.js'), '/* bundle */');
    }

    const FAMILY = '@feezal/feezal-elements-metro';

    it('lists an installed family with type "elements" (one row, no member dirs)', async () => {
        await fakePkg(FAMILY, {name: FAMILY, version: '3.2.1', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']}});
        const list = await pm.listInstalled(dataDir);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({name: FAMILY, version: '3.2.1', type: 'elements'});
    });

    it('removes a family as a single unit', async () => {
        await fakePkg(FAMILY, {name: FAMILY, version: '3.2.1', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile']}});
        await pm.removePackage(dataDir, FAMILY);
        expect(await pm.listInstalled(dataDir)).toEqual([]);
    });
});

describe('discovery — feezal-icons-* packages (N23)', () => {
    it('discoverElements tags icons packages with type "icons"', async () => {
        const {discoverElements} = require('../src/build/elements.js');
        const wwwDir = await mkdtemp(join(tmpdir(), 'feezal-www-'));
        try {
            const pkgDir = join(wwwDir, 'node_modules', '@acme', 'feezal-icons-lucide');
            await mkdir(pkgDir, {recursive: true});
            await writeFile(join(pkgDir, 'package.json'), JSON.stringify({name: '@acme/feezal-icons-lucide', main: 'index.js'}));
            const found = discoverElements(wwwDir, null, {info() {}, debug() {}});
            const icons = found.find(el => el.type === 'icons');
            expect(icons).toMatchObject({bare: '@acme/feezal-icons-lucide', main: 'index.js', kind: 'bundled'});
        } finally {
            await rm(wwwDir, {recursive: true, force: true});
        }
    });
});

describe('discovery — multi-element family packages (N29 Phase B)', () => {
    const {discoverElements, generateElementsModule, elementTags} = require('../src/build/elements.js');
    let wwwDir;
    beforeEach(async () => { wwwDir = await mkdtemp(join(tmpdir(), 'feezal-www-')); });
    afterEach(async () => { await rm(wwwDir, {recursive: true, force: true}); });

    async function pkg(rel, json) {
        const dir = join(wwwDir, 'node_modules', ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(json));
    }

    it('registers a family as one element entry carrying its declared tags', async () => {
        await pkg('@feezal/feezal-elements-metro', {name: '@feezal/feezal-elements-metro', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']}});
        const found = discoverElements(wwwDir, null, {info() {}, debug() {}});
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({
            bare: '@feezal/feezal-elements-metro', type: 'element', main: 'index.js',
            tags: ['feezal-element-metro-tile', 'feezal-element-metro-appbar'],
        });
    });

    it('skips Phase A set markers (feezal.type "bundle")', async () => {
        await pkg('@feezal/feezal-elements-eink', {name: '@feezal/feezal-elements-eink',
            feezal: {type: 'bundle', elements: ['@feezal/feezal-element-eink-value']}});
        expect(discoverElements(wwwDir, null, {info() {}, debug() {}})).toEqual([]);
    });

    it('window.feezal.elements gets tag names: family tags expanded, scope stripped from singles', async () => {
        await pkg('@feezal/feezal-element-basic-gauge', {name: '@feezal/feezal-element-basic-gauge', main: 'index.js'});
        await pkg('@feezal/feezal-elements-metro', {name: '@feezal/feezal-elements-metro', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile']}});
        const found = discoverElements(wwwDir, null, {info() {}, debug() {}});
        expect(elementTags(found).sort()).toEqual(['feezal-element-basic-gauge', 'feezal-element-metro-tile']);
        const module_ = generateElementsModule(found);
        expect(module_).toContain('"feezal-element-metro-tile"');
        expect(module_).toContain('"feezal-element-basic-gauge"');
        expect(module_).not.toContain('@feezal/feezal-element-basic-gauge');
    });

    it('a user-installed family gets one import for its single bundle', async () => {
        const userDir = join(wwwDir, 'user-elements');
        const dir = join(userDir, '@feezal', 'feezal-elements-metro');
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify({name: '@feezal/feezal-elements-metro', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']}}));
        const found = discoverElements(wwwDir, userDir, {info() {}, debug() {}});
        const module_ = generateElementsModule(found);
        expect(module_).toContain("import '/user-elements/@feezal/feezal-elements-metro/index.js';");
        expect(module_.match(/import '\/user-elements/g)).toHaveLength(1);
    });
});

describe('usedUserPackages — installed packages a site uses (N27)', () => {
    const {usedUserPackages} = require('../src/build/elements.js');
    let wwwDir, userDir;

    beforeEach(async () => {
        wwwDir = await mkdtemp(join(tmpdir(), 'feezal-www-'));
        userDir = join(wwwDir, 'user-elements');
        const pkg = async (rel, json) => {
            const dir = join(userDir, ...rel.split('/'));
            await mkdir(dir, {recursive: true});
            await writeFile(join(dir, 'package.json'), JSON.stringify(json));
            await writeFile(join(dir, 'index.js'), `/* ${rel} */`);
        };
        await pkg('@feezal/feezal-element-acme-widget', {name: '@feezal/feezal-element-acme-widget', main: 'index.js', feezal: {type: 'element'}});
        await pkg('@feezal/feezal-element-acme-unused', {name: '@feezal/feezal-element-acme-unused', main: 'index.js', feezal: {type: 'element'}});
        await pkg('@feezal/feezal-elements-metro', {name: '@feezal/feezal-elements-metro', main: 'index.js',
            feezal: {type: 'elements', elements: ['feezal-element-metro-tile', 'feezal-element-metro-appbar']}});
        await pkg('@feezal/feezal-theme-lcars', {name: '@feezal/feezal-theme-lcars', main: 'index.js', feezal: {type: 'theme'}});
        await pkg('@acme/feezal-icons-lucide', {name: '@acme/feezal-icons-lucide', main: 'index.js', feezal: {type: 'icons'}});
    });
    afterEach(async () => { await rm(wwwDir, {recursive: true, force: true}); });

    const names = arr => arr.map(el => el.bare).sort();

    it('selects element packages whose tag appears in the site html', () => {
        const used = usedUserPackages({wwwDir, userElementsDir: userDir,
            siteHtml: '<feezal-site><feezal-view><feezal-element-acme-widget></feezal-element-acme-widget></feezal-view></feezal-site>'});
        expect(names(used)).toEqual(['@feezal/feezal-element-acme-widget']);
    });

    it('matches Phase B family packages via any manifest tag', () => {
        const used = usedUserPackages({wwwDir, userElementsDir: userDir,
            siteHtml: '<feezal-element-metro-appbar></feezal-element-metro-appbar>'});
        expect(names(used)).toEqual(['@feezal/feezal-elements-metro']);
    });

    it('includes the active theme package; icons are never included', () => {
        const used = usedUserPackages({wwwDir, userElementsDir: userDir,
            siteHtml: '<feezal-element-acme-widget/>', theme: 'feezal-theme-lcars'});
        expect(names(used)).toEqual(['@feezal/feezal-element-acme-widget', '@feezal/feezal-theme-lcars']);
    });

    it("picks up a repeater's child-element attribute", () => {
        const used = usedUserPackages({wwwDir, userElementsDir: userDir,
            siteHtml: '<feezal-element-layout-repeater child-element="feezal-element-acme-widget"></feezal-element-layout-repeater>'});
        expect(names(used)).toEqual(['@feezal/feezal-element-acme-widget']);
    });

    it('returns [] without a user elements dir or when nothing is used', () => {
        expect(usedUserPackages({wwwDir, userElementsDir: null, siteHtml: '<feezal-element-acme-widget/>'})).toEqual([]);
        expect(usedUserPackages({wwwDir, userElementsDir: userDir, siteHtml: '<div></div>'})).toEqual([]);
    });
});
