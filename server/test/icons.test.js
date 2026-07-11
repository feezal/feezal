/**
 * Unit tests for build/icons.js — N23 per-site icon tree-shaking.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const icons = require('../src/build/icons.js');

let wwwDir;
let userDir;

beforeAll(async () => {
    wwwDir = await mkdtemp(join(tmpdir(), 'feezal-icons-www-'));
    userDir = await mkdtemp(join(tmpdir(), 'feezal-icons-user-'));

    // Bundled set with a declared data module.
    const bundled = join(wwwDir, 'packages', '@feezal', 'feezal-icons-testset');
    await mkdir(bundled, {recursive: true});
    await writeFile(join(bundled, 'package.json'), JSON.stringify({
        name: '@feezal/feezal-icons-testset', main: 'index.js',
        feezal: {type: 'icons', set: 'testset', icons: 'icons.js'}
    }));
    await writeFile(join(bundled, 'icons.js'),
        '// comment\nexport default ' + JSON.stringify({
            alpha: '<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>',
            beta: '<svg viewBox="0 0 10 10"><path d="M1 1"/></svg>',
            evil: '<svg viewBox="0 0 10 10"><text></script></text></svg>'
        }) + ';\n');
    await writeFile(join(bundled, 'index.js'), '// full module');

    // User-installed set: single-file bundle, no separable data module.
    const user = join(userDir, '@acme', 'feezal-icons-userset');
    await mkdir(user, {recursive: true});
    await writeFile(join(user, 'package.json'), JSON.stringify({
        name: '@acme/feezal-icons-userset', main: 'index.js',
        feezal: {type: 'icons', set: 'userset'}
    }));
    await writeFile(join(user, 'index.js'), '// bundled set');

    // N28: multi-set package (Font Awesome pattern) — plural feezal.sets,
    // one data module per set.
    const multi = join(wwwDir, 'packages', '@feezal', 'feezal-icons-multi');
    await mkdir(multi, {recursive: true});
    await writeFile(join(multi, 'package.json'), JSON.stringify({
        name: '@feezal/feezal-icons-multi', main: 'index.js',
        feezal: {type: 'icons', sets: [
            {set: 'multi-solid', icons: 'icons-solid.js'},
            {set: 'multi-brands', icons: 'icons-brands.js'}
        ]}
    }));
    await writeFile(join(multi, 'icons-solid.js'),
        'export default ' + JSON.stringify({house: '<svg viewBox="0 0 10 10"><path d="M2 2"/></svg>'}) + ';\n');
    await writeFile(join(multi, 'icons-brands.js'),
        'export default ' + JSON.stringify({github: '<svg viewBox="0 0 10 10"><path d="M3 3"/></svg>'}) + ';\n');
    await writeFile(join(multi, 'index.js'), '// full module');
});

afterAll(async () => {
    await rm(wwwDir, {recursive: true, force: true});
    await rm(userDir, {recursive: true, force: true});
});

describe('discoverIconPackages()', () => {
    it('finds bundled (with data module) and user (without) sets', () => {
        const found = icons.discoverIconPackages(wwwDir, userDir);
        const bundled = found.find(p => p.set === 'testset');
        const user = found.find(p => p.set === 'userset');
        expect(bundled).toMatchObject({kind: 'bundled', name: '@feezal/feezal-icons-testset'});
        expect(bundled.iconsFile).toBeTruthy();
        expect(user).toMatchObject({kind: 'user', main: 'index.js'});
        expect(user.iconsFile).toBeNull();
    });

    it('N28: a plural feezal.sets package yields one entry per set', () => {
        const found = icons.discoverIconPackages(wwwDir, userDir);
        const solid = found.find(p => p.set === 'multi-solid');
        const brands = found.find(p => p.set === 'multi-brands');
        expect(solid).toMatchObject({kind: 'bundled', name: '@feezal/feezal-icons-multi'});
        expect(brands).toMatchObject({kind: 'bundled', name: '@feezal/feezal-icons-multi'});
        expect(solid.iconsFile).toContain('icons-solid.js');
        expect(brands.iconsFile).toContain('icons-brands.js');
    });
});

describe('siteIconArtifacts() — multi-set package (N28)', () => {
    it('shakes each set from its own data module', () => {
        const {inlineJs} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="multi-solid:house"></x><y icon="multi-brands:github"></y>'
        });
        expect(inlineJs).toContain('registerIcons("multi-solid"');
        expect(inlineJs).toContain('"house"');
        expect(inlineJs).toContain('registerIcons("multi-brands"');
        expect(inlineJs).toContain('"github"');
        expect(inlineJs).not.toContain('M2 2"/></svg>",');   // no cross-set bleed sanity
    });
});

describe('extractUsedIcons()', () => {
    it('matches only known set prefixes, deduped and sorted', () => {
        const html = '<a icon="testset:beta"></a><b icon="testset:alpha" x="testset:beta"></b>' +
            '<img src="https://example.com/x"> mqtt://host:1883 unknown:name';
        const used = icons.extractUsedIcons(html, ['testset']);
        expect([...used.keys()]).toEqual(['testset']);
        expect(used.get('testset')).toEqual(['alpha', 'beta']);
    });

    it('escapes regex metacharacters in set names (knx-uf)', () => {
        const used = icons.extractUsedIcons('icon="knx-uf:fts_sunblind"', ['knx-uf']);
        expect(used.get('knx-uf')).toEqual(['fts_sunblind']);
    });
});

describe('siteIconArtifacts()', () => {
    it('inlines only the used icons of a bundled set', () => {
        const {inlineJs, userModuleUrls} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="testset:alpha"></x>'
        });
        expect(inlineJs).toContain('feezal.registerIcons("testset"');
        expect(inlineJs).toContain('alpha');
        expect(inlineJs).not.toContain('"beta"');
        expect(userModuleUrls).toEqual([]);
    });

    it('unknown icon names are skipped without breaking the registration', () => {
        const {inlineJs} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="testset:alpha" y="testset:doesnotexist"></x>'
        });
        expect(inlineJs).toContain('"alpha"');
        expect(inlineJs).not.toContain('doesnotexist');
    });

    it('escapes </script> sequences for safe HTML inlining', () => {
        const {inlineJs} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="testset:evil"></x>'
        });
        expect(inlineJs).not.toContain('</script>');
        expect(inlineJs).toContain('<\\/script>');
    });

    it('user-installed sets in use yield their full-module URL', () => {
        const {inlineJs, userModuleUrls} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="userset:dot"></x>'
        });
        expect(inlineJs).toBe('');
        expect(userModuleUrls).toEqual(['/user-elements/@acme/feezal-icons-userset/index.js']);
    });

    it('no used icons → empty artifacts', () => {
        const out = icons.siteIconArtifacts({wwwDir, userElementsDir: userDir, siteHtml: '<x/>'});
        expect(out).toEqual({inlineJs: '', userModuleUrls: []});
    });
});

describe('registrationJs()', () => {
    it('produces a working self-contained statement', () => {
        const js = icons.registrationJs('s', {a: '<svg/>'});
        const calls = [];
        const feezal = {registerIcons: (set, def) => calls.push({set, def})};
        // eslint-disable-next-line no-new-func
        new Function('feezal', js)(feezal);
        expect(calls[0].set).toBe('s');
        expect(calls[0].def.names).toEqual(['a']);
        expect(calls[0].def.render('a')).toBe('<svg/>');
        expect(calls[0].def.render('x')).toBe('');
    });
});

describe('siteIconArtifacts() — variant-family expansion', () => {
    it('a used base name pulls in all its numeric-suffix variants', async () => {
        // Extend the fixture set with a variant family.
        const bundled = join(wwwDir, 'packages', '@feezal', 'feezal-icons-testset');
        await writeFile(join(bundled, 'icons.js'),
            'export default ' + JSON.stringify({
                alpha: '<svg/>', fam_00: '<svg data-s="00"/>', fam_10: '<svg data-s="10"/>',
                fam_100: '<svg data-s="100"/>', famous: '<svg/>'
            }) + ';\n');
        const {inlineJs} = icons.siteIconArtifacts({
            wwwDir, userElementsDir: userDir,
            siteHtml: '<x icon="testset:fam"></x>'
        });
        expect(inlineJs).toContain('fam_00');
        expect(inlineJs).toContain('fam_10');
        expect(inlineJs).toContain('fam_100');
        expect(inlineJs).not.toContain('famous');   // prefix alone is not a variant
        expect(inlineJs).not.toContain('alpha');
    });
});
