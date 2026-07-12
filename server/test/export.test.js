/**
 * Unit tests for build/export.js — the static-export ZIP.
 *
 * Locks in the A15 layout contract: everything under a single top-level
 * <sitename>/ folder (index.html + global/ + assets/), theme class
 * re-application, override/class CSS inlining and the Vite→Rollup fallback.
 *
 * The heavy toolchain is faked inside a fixture wwwDir: a stub `vite` module
 * that records build calls and returns a marker chunk (throwing for sites
 * that use the "explode" element), and a stub `rollup` for the fallback path.
 * Everything else (entry generation, package partitioning, caching, HTML
 * composition, ZIP writing) is the real code.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm, mkdir, writeFile, readFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';

const require = createRequire(import.meta.url);
const createExport = require('../src/build/export.js');
const AdmZip = require('adm-zip');

const logger = {debug() {}, info() {}, warn() {}, error() {}};

let wwwDir;
let dataDir;
let assetBase;
let callsLog;

async function buildCallCount() {
    try { return (await readFile(callsLog, 'utf8')).length; } catch { return 0; }
}

beforeAll(async () => {
    wwwDir = await mkdtemp(join(tmpdir(), 'feezal-export-www-'));
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-export-data-'));
    assetBase = await mkdtemp(join(tmpdir(), 'feezal-export-assets-'));

    // src/ must exist — createExport writes its temporary entry file there.
    await mkdir(join(wwwDir, 'src'), {recursive: true});

    // Fake vite (ESM, loaded via dynamic import of this exact path).
    const viteDir = join(wwwDir, 'node_modules', 'vite', 'dist', 'node');
    await mkdir(viteDir, {recursive: true});
    await writeFile(join(wwwDir, 'node_modules', 'vite', 'package.json'),
        JSON.stringify({name: 'vite', version: '0.0.0-test', type: 'module'}));
    callsLog = join(viteDir, 'calls.log');
    await writeFile(join(viteDir, 'index.js'), `
import {readFileSync, appendFileSync} from 'node:fs';
export async function build(cfg) {
    const entryPath = cfg.build.rollupOptions.input['viewer-bundle'];
    const entry = readFileSync(entryPath, 'utf8');
    appendFileSync(new URL('./calls.log', import.meta.url), 'x');
    if (entry.includes('explode')) throw new Error('boom');
    // modules: static per-module attribution so the U34 report path is live
    return {output: [{type: 'chunk', isEntry: true,
        code: '//VITE_BUNDLE\\n//' + JSON.stringify(entry),
        modules: {
            '/www/node_modules/@feezal/feezal-element-material-switch/feezal-element-material-switch.js':
                {renderedLength: 600, code: 'S'.repeat(600)},
            '/www/node_modules/lit/index.js': {renderedLength: 300, code: 'L'.repeat(300)},
            '/www/src/feezal-app-viewer.js': {renderedLength: 100, code: 'V'.repeat(100)},
        }
    }]};
}
`);

    // Fake rollup (CJS require) for the fallback path.
    const rollupDir = join(wwwDir, 'node_modules', 'rollup', 'dist');
    await mkdir(rollupDir, {recursive: true});
    await writeFile(join(wwwDir, 'node_modules', 'rollup', 'package.json'),
        JSON.stringify({name: 'rollup', version: '0.0.0-test'}));
    await writeFile(join(rollupDir, 'rollup.js'), `
module.exports = {
    rollup: async () => ({
        generate: async () => ({output: [{code: '//FALLBACK_BUNDLE'}]}),
        close: async () => {}
    })
};
`);

    // Fake element packages so partitionPackages() resolves them.
    for (const pkg of ['feezal-element-material-switch', 'feezal-element-material-explode']) {
        const dir = join(wwwDir, 'node_modules', '@feezal', pkg);
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify({name: `@feezal/${pkg}`}));
    }

    // Real asset files for the ZIP.
    await mkdir(join(assetBase, 'global'), {recursive: true});
    await mkdir(join(assetBase, 'site', 'sub'), {recursive: true});
    await writeFile(join(assetBase, 'global', 'logo.png'), 'GLOBAL-LOGO');
    await writeFile(join(assetBase, 'site', 'photo.jpg'), 'SITE-PHOTO');
    await writeFile(join(assetBase, 'site', 'sub', 'pic.png'), 'NESTED-PIC');

    // User theme CSS.
    await mkdir(join(dataDir, 'themes'), {recursive: true});
    await writeFile(join(dataDir, 'themes', 'my-user-theme.css'), '.user-theme{color:gold}');

    // Default PWA icons (A9).
    await mkdir(join(wwwDir, 'favicon'), {recursive: true});
    for (const f of ['web-app-manifest-192x192.png', 'web-app-manifest-512x512.png', 'apple-touch-icon.png']) {
        await writeFile(join(wwwDir, 'favicon', f), 'FAVICON:' + f);
    }
});

afterAll(async () => {
    for (const dir of [wwwDir, dataDir, assetBase]) {
        await rm(dir, {recursive: true, force: true});
    }
});

const SITE_HTML = '<feezal-site><feezal-view name="home"></feezal-view></feezal-site>';

function unzip(buffer) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter(e => !e.isDirectory);
    return {
        names: entries.map(e => e.entryName).sort(),
        text: name => zip.readAsText(name)
    };
}

async function exportSite({name = 'mysite', html = SITE_HTML, config = {}, storage = null} = {}) {
    const buffer = await createExport(wwwDir, name, {html, config}, logger, storage);
    return unzip(buffer);
}

describe('ZIP layout (A15)', () => {
    it('wraps everything in a single <sitename>/ folder', async () => {
        const zip = await exportSite();
        expect(zip.names).toEqual(['mysite/index.html']);
    });

    it('survives a failing asset gather (index.html only)', async () => {
        const storage = {
            dataDir,
            getAssetFilesForExport: async () => { throw new Error('nope'); }
        };
        const zip = await exportSite({storage});
        expect(zip.names).toEqual(['mysite/index.html']);
    });

    it('sanitises the site name to a single safe path segment', async () => {
        expect((await exportSite({name: 'my/site'})).names).toEqual(['my_site/index.html']);
        expect((await exportSite({name: '..'})).names).toEqual(['site/index.html']);
    });
});

describe('asset bundling (A16 — referenced-only, single assets/ tree)', () => {
    const assetStorage = () => ({
        dataDir,
        getAssetFilesForExport: async () => ({
            global: {base: join(assetBase, 'global'), files: ['logo.png']},
            site: {base: join(assetBase, 'site'), files: ['photo.jpg', 'sub/pic.png']}
        })
    });

    it('bundles only referenced assets — nothing referenced, nothing bundled', async () => {
        const zip = await exportSite({storage: assetStorage()});
        expect(zip.names).toEqual(['mysite/index.html']);
    });

    it('flattens referenced site + global assets into a single assets/ tree', async () => {
        const zip = await exportSite({
            storage: assetStorage(),
            html: '<feezal-site><feezal-view name="a">' +
                '<feezal-element-basic-image src="/assets/mysite/photo.jpg"></feezal-element-basic-image>' +
                '<feezal-element-basic-image src="/assets/global/logo.png"></feezal-element-basic-image>' +
                '</feezal-view></feezal-site>'
        });
        expect(zip.names).toEqual([
            'mysite/assets/logo.png',
            'mysite/assets/photo.jpg',
            'mysite/index.html'
        ]);
        expect(zip.text('mysite/assets/logo.png')).toBe('GLOBAL-LOGO');
        // absolute references are rewritten to the relative, file://-safe form
        const html = zip.text('mysite/index.html');
        expect(html).toContain('src="assets/photo.jpg"');
        expect(html).toContain('src="assets/logo.png"');
        expect(html).not.toContain('/assets/mysite/');
        expect(html).not.toContain('/assets/global/');
    });

    it('supports the legacy relative reference forms', async () => {
        const zip = await exportSite({
            storage: assetStorage(),
            html: '<feezal-site><feezal-view name="a">' +
                '<feezal-element-basic-image src="assets/sub/pic.png"></feezal-element-basic-image>' +
                '<feezal-element-basic-image src="global/logo.png"></feezal-element-basic-image>' +
                '</feezal-view></feezal-site>'
        });
        expect(zip.names).toEqual([
            'mysite/assets/logo.png',
            'mysite/assets/sub/pic.png',
            'mysite/index.html'
        ]);
        const html = zip.text('mysite/index.html');
        expect(html).toContain('src="assets/logo.png"');
        expect(html).toContain('src="assets/sub/pic.png"');
        expect(html).not.toContain('"global/');
    });

    it('keeps the site asset authoritative on collision and suffixes the global one', async () => {
        const storage = {
            dataDir,
            getAssetFilesForExport: async () => ({
                global: {base: join(assetBase, 'global'), files: ['photo.jpg']},
                site: {base: join(assetBase, 'site'), files: ['photo.jpg']}
            })
        };
        await writeFile(join(assetBase, 'global', 'photo.jpg'), 'GLOBAL-PHOTO');
        const zip = await exportSite({
            storage,
            html: '<feezal-site><feezal-view name="a">' +
                '<feezal-element-basic-image src="/assets/mysite/photo.jpg"></feezal-element-basic-image>' +
                '<feezal-element-basic-image src="/assets/global/photo.jpg"></feezal-element-basic-image>' +
                '</feezal-view></feezal-site>'
        });
        expect(zip.names).toEqual([
            'mysite/assets/photo-1.jpg',
            'mysite/assets/photo.jpg',
            'mysite/index.html'
        ]);
        expect(zip.text('mysite/assets/photo.jpg')).toBe('SITE-PHOTO');
        expect(zip.text('mysite/assets/photo-1.jpg')).toBe('GLOBAL-PHOTO');
        const html = zip.text('mysite/index.html');
        expect(html).toContain('src="assets/photo.jpg"');
        expect(html).toContain('src="assets/photo-1.jpg"');
    });

    it('matches URL-encoded references and keeps their encoding', async () => {
        await writeFile(join(assetBase, 'site', 'my photo.jpg'), 'SPACED');
        const storage = {
            dataDir,
            getAssetFilesForExport: async () => ({
                global: {base: join(assetBase, 'global'), files: []},
                site: {base: join(assetBase, 'site'), files: ['my photo.jpg']}
            })
        };
        const zip = await exportSite({
            storage,
            html: '<feezal-site><feezal-view name="a">' +
                '<feezal-element-basic-image src="/assets/mysite/my%20photo.jpg"></feezal-element-basic-image>' +
                '</feezal-view></feezal-site>'
        });
        expect(zip.names).toContain('mysite/assets/my photo.jpg');
        expect(zip.text('mysite/index.html')).toContain('src="assets/my%20photo.jpg"');
    });

    it('rewrites asset references in user-theme CSS and class styles too', async () => {
        const zip = await exportSite({
            storage: assetStorage(),
            config: {viewer: {classes: {
                hero: {'background-image': 'url(/assets/mysite/photo.jpg)'}
            }}}
        });
        expect(zip.names).toContain('mysite/assets/photo.jpg');
        expect(zip.text('mysite/index.html'))
            .toContain('.feezal-class-hero{background-image:url(assets/photo.jpg)}');
    });
});

describe('index.html composition', () => {
    it('inlines the built bundle and the site markup', async () => {
        const zip = await exportSite();
        const html = zip.text('mysite/index.html');
        expect(html).toContain('//VITE_BUNDLE');
        expect(html).toContain('<feezal-view name="home">');
        expect(html).toContain('<feezal-connection backend="mqtt">');
        expect(html).toContain('window.feezal');
    });

    it('the export entry bundles the presence runtime (N24 — exported viewers announce themselves)', async () => {
        // The fake vite echoes the generated entry file into the bundle, so
        // the entry's import list is assertable here. Without this import an
        // exported site never publishes its retained status: no viewer-id
        // toast, invisible in the editor's Clients panel.
        const zip = await exportSite();
        expect(zip.text('mysite/index.html')).toContain('feezal-presence.js');
    });

    it('embeds the connection config with single quotes escaped', async () => {
        const zip = await exportSite({
            config: {connection: {uri: 'ws://broker:9001', clientId: "it's"}}
        });
        expect(zip.text('mysite/index.html'))
            .toContain(`config='{"uri":"ws://broker:9001","clientId":"it&#39;s"}'`);
    });

    it('re-applies the theme class to feezal-site', async () => {
        const withClass = await exportSite({
            html: '<feezal-site class="foo bar"><feezal-view name="a"></feezal-view></feezal-site>',
            config: {viewer: {theme: 'feezal-theme-dark-mint'}}
        });
        expect(withClass.text('mysite/index.html'))
            .toContain('<feezal-site class="feezal-theme-dark-mint foo bar">');

        const withoutClass = await exportSite({
            config: {viewer: {theme: 'feezal-theme-dark-mint'}}
        });
        expect(withoutClass.text('mysite/index.html'))
            .toContain('<feezal-site class="feezal-theme-dark-mint">');
    });

    it('inlines sanitised theme colour overrides', async () => {
        const zip = await exportSite({
            config: {viewer: {themeOverrides: {
                '--primary-color': "red;'",
                'not-a-custom-prop': 'blue'
            }}}
        });
        const html = zip.text('mysite/index.html');
        expect(html).toContain('<style>feezal-site{--primary-color:red}</style>');
        expect(html).not.toContain('not-a-custom-prop');
    });

    it('inlines U25 class CSS, dropping invalid names and properties', async () => {
        const zip = await exportSite({
            config: {viewer: {classes: {
                'card': {'color': 'red', 'bad prop': 'x'},
                '1nvalid': {'color': 'blue'}
            }}}
        });
        const html = zip.text('mysite/index.html');
        expect(html).toContain('.feezal-class-card{color:red}');
        expect(html).not.toContain('bad prop');
        expect(html).not.toContain('1nvalid');
    });

    it('inlines user-theme CSS from dataDir/themes/<theme>.css', async () => {
        const storage = {dataDir, getAssetFilesForExport: async () => null};
        const zip = await exportSite({
            config: {viewer: {theme: 'my-user-theme'}},
            storage
        });
        expect(zip.text('mysite/index.html')).toContain('.user-theme{color:gold}');
    });
});

describe('PWA bundle (A9)', () => {
    it('adds manifest, service worker and default icons when viewer.pwa is set', async () => {
        const zip = await exportSite({name: 'pwazip', config: {viewer: {pwa: true}}});
        expect(zip.names).toEqual([
            'pwazip/icons/apple-touch-icon.png',
            'pwazip/icons/icon-192.png',
            'pwazip/icons/icon-512.png',
            'pwazip/index.html',
            'pwazip/manifest.webmanifest',
            'pwazip/sw.js'
        ]);

        const manifest = JSON.parse(zip.text('pwazip/manifest.webmanifest'));
        expect(manifest).toMatchObject({name: 'pwazip', start_url: './', scope: './', display: 'standalone'});
        expect(manifest.icons.map(i => i.src)).toEqual(['icons/icon-192.png', 'icons/icon-512.png']);

        const html = zip.text('pwazip/index.html');
        expect(html).toContain('<link rel="manifest" href="manifest.webmanifest">');
        // file:// exports must not attempt to register the worker
        expect(html).toContain("location.protocol.startsWith('http') &&");
        expect(html).toContain("serviceWorker.register('sw.js')");

        expect(zip.text('pwazip/sw.js')).toContain('"icons/icon-192.png"');
    });

    it('prefers the site\'s custom icon set incl. maskable variants', async () => {
        const pwaDir = join(dataDir, 'sites', 'pwacustom', 'pwa');
        await mkdir(pwaDir, {recursive: true});
        for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'maskable-192.png', 'maskable-512.png']) {
            await writeFile(join(pwaDir, f), 'CUSTOM:' + f);
        }
        await writeFile(join(pwaDir, 'pwa.json'), JSON.stringify({backgroundColor: '#224466'}));

        const storage = {dataDir, getAssetFilesForExport: async () => null};
        const zip = await exportSite({name: 'pwacustom', config: {viewer: {pwa: true}}, storage});

        expect(zip.text('pwacustom/icons/icon-192.png')).toBe('CUSTOM:icon-192.png');
        const manifest = JSON.parse(zip.text('pwacustom/manifest.webmanifest'));
        expect(manifest.background_color).toBe('#224466');
        expect(manifest.icons.filter(i => i.purpose === 'maskable').map(i => i.src))
            .toEqual(['icons/maskable-192.png', 'icons/maskable-512.png']);
        expect(zip.text('pwacustom/index.html'))
            .toContain('<meta name="theme-color" content="#224466">');
    });

    it('changes nothing when the toggle is off', async () => {
        const zip = await exportSite({name: 'nopwa', config: {viewer: {pwa: false}}});
        expect(zip.names).toEqual(['nopwa/index.html']);
        const html = zip.text('nopwa/index.html');
        expect(html).not.toContain('manifest');
        expect(html).not.toContain('serviceWorker');
    });
});

describe('bundle build', () => {
    it('imports only the element packages used by the site', async () => {
        const zip = await exportSite({
            name: 'bundled',
            html: '<feezal-site><feezal-element-material-switch></feezal-element-material-switch>' +
                  '<feezal-element-material-missing></feezal-element-material-missing></feezal-site>'
        });
        // The fake vite embeds the generated entry file — assert on its imports.
        const html = zip.text('bundled/index.html');
        expect(html).toContain("import '@feezal/feezal-element-material-switch';");
        // unresolvable package is skipped, not imported
        expect(html).not.toContain("import '@feezal/feezal-element-material-missing';");
    });

    it('caches the bundle by resolved package list', async () => {
        const html = '<feezal-site><feezal-element-material-switch topic="a"></feezal-element-material-switch></feezal-site>';
        await exportSite({name: 'cache-a', html});
        const before = await buildCallCount();
        // Same element set (different attrs/name) → cache hit, no new build.
        await exportSite({name: 'cache-b', html: html.replace('topic="a"', 'topic="b"')});
        expect(await buildCallCount()).toBe(before);
    });

    it('falls back to the full Rollup bundle when the Vite build fails', async () => {
        const zip = await exportSite({
            name: 'fallen',
            html: '<feezal-site><feezal-element-material-explode></feezal-element-material-explode></feezal-site>'
        });
        expect(zip.text('fallen/index.html')).toContain('//FALLBACK_BUNDLE');
    });

    it('cleans up the temporary entry file', async () => {
        await exportSite();
        const {existsSync} = require('fs');
        expect(existsSync(join(wwwDir, 'src', '_export-entry.js'))).toBe(false);
    });
});

describe('bundle size report (U34)', () => {
    const {bucketForModuleId, buildBundleReport, exportBundleReport} = createExport;

    describe('bucketForModuleId', () => {
        it('buckets feezal packages by name (node_modules and workspace paths)', () => {
            expect(bucketForModuleId('/w/node_modules/@feezal/feezal-element-material-switch/index.js'))
                .toBe('@feezal/feezal-element-material-switch');
            expect(bucketForModuleId('/w/packages/@feezal/feezal-theme-dark-mint/theme.js'))
                .toBe('@feezal/feezal-theme-dark-mint');
            expect(bucketForModuleId('/w/node_modules/@feezal/feezal-icons-fa/index.js'))
                .toBe('@feezal/feezal-icons-fa');
        });

        it('separates the shared element runtime from the element packages', () => {
            expect(bucketForModuleId('/w/packages/@feezal/feezal-element/feezal-element.js'))
                .toBe('@feezal/feezal-element (runtime)');
        });

        it('buckets vendor deps by top-level package, scoped-aware', () => {
            expect(bucketForModuleId('/w/node_modules/lit/index.js')).toBe('lit');
            expect(bucketForModuleId('/w/node_modules/lit/node_modules/lit-html/x.js')).toBe('lit');
            expect(bucketForModuleId('/w/node_modules/@shoelace-style/shoelace/dist/x.js'))
                .toBe('@shoelace-style/shoelace');
        });

        it('viewer runtime and virtual helper modules land in "feezal core"', () => {
            expect(bucketForModuleId('/w/www/src/feezal-app-viewer.js')).toBe('feezal core');
            expect(bucketForModuleId('\0vite/modulepreload-polyfill.js')).toBe('feezal core');
        });

        it('normalises win32 backslash paths', () => {
            expect(bucketForModuleId('C:\\w\\node_modules\\lit\\index.js')).toBe('lit');
        });
    });

    describe('buildBundleReport', () => {
        const chunk = () => ({
            code: 'M'.repeat(500),   // "minified" whole-bundle output
            modules: {
                '/w/node_modules/@feezal/feezal-element-material-switch/a.js': {renderedLength: 600, code: 'a'.repeat(600)},
                '/w/node_modules/lit/index.js': {renderedLength: 300, code: 'b'.repeat(300)},
                '/w/www/src/feezal-app-viewer.js': {renderedLength: 100, code: 'c'.repeat(100)},
            }
        });

        it('scales rendered shares to the exact minified total, sorted desc', () => {
            const report = buildBundleReport(chunk());
            expect(report.totalMinified).toBe(500);
            expect(report.buckets.map(b => b.name)).toEqual([
                '@feezal/feezal-element-material-switch', 'lit', 'feezal core']);
            // pro-rata: 600/300/100 of 1000 rendered → 300/150/50 of 500 minified
            expect(report.buckets.map(b => b.minified)).toEqual([300, 150, 50]);
        });

        it('per-bucket gzip estimates add up to the exact whole-bundle gzip', () => {
            const report = buildBundleReport(chunk());
            const sum = report.buckets.reduce((s, b) => s + b.gzip, 0);
            expect(Math.abs(sum - report.totalGzip)).toBeLessThanOrEqual(report.buckets.length);
            expect(report.estimate).toBe(true);
        });

        it('returns null without usable module metadata (fallback bundle)', () => {
            expect(buildBundleReport(null)).toBeNull();
            expect(buildBundleReport({code: 'x'})).toBeNull();
            expect(buildBundleReport({code: 'x', modules: {}})).toBeNull();
        });
    });

    describe('exportBundleReport', () => {
        it('reports the filtered build per bucket and shares the export bundle cache', async () => {
            const html = '<feezal-site><feezal-element-material-switch></feezal-element-material-switch></feezal-site>';
            const report = await exportBundleReport(wwwDir, 'report-site', {html, config: {}}, logger, null);
            expect(report.buckets.map(b => b.name)).toContain('@feezal/feezal-element-material-switch');
            expect(report.elemCount).toBe(1);
            expect(report.totalMinified).toBeGreaterThan(0);
            expect(report.totalGzip).toBeGreaterThan(0);

            // Same cache key as the export itself → no second Vite build.
            const before = await buildCallCount();
            await exportSite({name: 'report-site', html});
            expect(await buildCallCount()).toBe(before);
        });

        it('throws when only the unattributable fallback bundle is available', async () => {
            const html = '<feezal-site><feezal-element-material-explode></feezal-element-material-explode></feezal-site>';
            await expect(exportBundleReport(wwwDir, 'boom', {html, config: {}}, logger, null))
                .rejects.toThrow();
        });
    });
});

describe('credential security (N10)', () => {
    function embeddedConfig(html) {
        const m = html.match(/config='([^']*)'/);
        return m ? JSON.parse(m[1].replace(/&#39;/g, "'")) : null;
    }

    it('strips URI credentials and sets the credentialPrompt flag', async () => {
        const {text} = await exportSite({
            config: {connection: {backend: 'mqtt', uri: 'wss://alice:s3cret@broker:8884'}}
        });
        const html = text('mysite/index.html');
        expect(html).not.toContain('s3cret');
        expect(html).not.toContain('alice');
        const cfg = embeddedConfig(html);
        expect(cfg.credentialPrompt).toBe(true);
        expect(cfg.uri).toBe('wss://broker:8884/');
    });

    it('strips username/password fields too', async () => {
        const {text} = await exportSite({
            config: {connection: {backend: 'mqtt', uri: 'wss://broker:8884', username: 'bob', password: 'hunter2'}}
        });
        const cfg = embeddedConfig(text('mysite/index.html'));
        expect(cfg.username).toBeUndefined();
        expect(cfg.password).toBeUndefined();
        expect(cfg.credentialPrompt).toBe(true);
        expect(text('mysite/index.html')).not.toContain('hunter2');
    });

    it('drops the viaServer flag (exports are always direct)', async () => {
        const {text} = await exportSite({
            config: {connection: {backend: 'mqtt', uri: 'wss://broker:8884', viaServer: true}}
        });
        const cfg = embeddedConfig(text('mysite/index.html'));
        expect(cfg.viaServer).toBeUndefined();
        expect(cfg.credentialPrompt).toBeUndefined();
    });

    it('credential-less configs are exported unchanged (no prompt flag)', async () => {
        const {text} = await exportSite({
            config: {connection: {backend: 'mqtt', uri: 'ws://broker:9001'}}
        });
        const cfg = embeddedConfig(text('mysite/index.html'));
        expect(cfg.uri).toBe('ws://broker:9001');
        expect(cfg.credentialPrompt).toBeUndefined();
    });
});

describe('TLS setup instructions (N8/N10)', () => {
    async function withCerts(siteName, files) {
        const certsDir = join(dataDir, 'sites', siteName, 'certs');
        await mkdir(certsDir, {recursive: true});
        for (const [file, content] of Object.entries(files)) {
            await writeFile(join(certsDir, file), content);
        }
    }

    it('ships TLS-SETUP.md for a CA-only site — CA section, no mTLS section, no cert content', async () => {
        await withCerts('tlssite', {'ca.pem': 'SECRET-CA-PEM'});
        const zip = await exportSite({name: 'tlssite', storage: {dataDir}});
        expect(zip.names).toContain('tlssite/TLS-SETUP.md');
        const md = zip.text('tlssite/TLS-SETUP.md');
        expect(md).toContain("Trust the broker's CA certificate");
        expect(md).not.toContain('Client certificate (mTLS)');
        expect(md).not.toContain('SECRET-CA-PEM');
        expect(zip.names.some(n => n.endsWith('.pem'))).toBe(false);
    });

    it('adds the mTLS section when a client certificate is present', async () => {
        await withCerts('mtlssite', {'ca.pem': 'CA', 'client.crt': 'CRT', 'client.key': 'TOP-SECRET-KEY'});
        const zip = await exportSite({name: 'mtlssite', storage: {dataDir}});
        const md = zip.text('mtlssite/TLS-SETUP.md');
        expect(md).toContain('Client certificate (mTLS)');
        expect(md).not.toContain('TOP-SECRET-KEY');
        expect(zip.names.some(n => n.includes('client.key'))).toBe(false);
    });

    it('no TLS-SETUP.md without TLS material', async () => {
        const zip = await exportSite({name: 'plainsite', storage: {dataDir}});
        expect(zip.names).not.toContain('plainsite/TLS-SETUP.md');
    });
});

describe('user-installed packages in the export (N27)', () => {
    async function installFakePkg(rel, json, code = '/* bundle */') {
        const dir = join(dataDir, 'elements', ...rel.split('/'));
        await mkdir(dir, {recursive: true});
        await writeFile(join(dir, 'package.json'), JSON.stringify(json));
        await writeFile(join(dir, 'index.js'), code);
    }

    it('inlines used installed bundles as module scripts (file:// safe), skipping unused ones', async () => {
        await installFakePkg('@feezal/feezal-element-acme-widget',
            {name: '@feezal/feezal-element-acme-widget', main: 'index.js', feezal: {type: 'element'}},
            'const ACME_WIDGET_CODE = 1; // contains </script> inside a string');
        await installFakePkg('@feezal/feezal-element-acme-unused',
            {name: '@feezal/feezal-element-acme-unused', main: 'index.js', feezal: {type: 'element'}},
            'const NEVER = 1;');
        await installFakePkg('@feezal/feezal-theme-lcars',
            {name: '@feezal/feezal-theme-lcars', main: 'index.js', feezal: {type: 'theme'}},
            'const LCARS_THEME_CODE = 1;');

        const zip = await exportSite({
            name: 'n27export',
            html: '<feezal-site><feezal-view name="a">'
                + '<feezal-element-acme-widget></feezal-element-acme-widget>'
                + '</feezal-view></feezal-site>',
            config: {viewer: {theme: 'feezal-theme-lcars'}},
            storage: {dataDir, getAssetFilesForExport: async () => null},
        });
        const html = zip.text('n27export/index.html');
        // used element + active theme inlined as module scripts…
        expect(html).toContain('/* @feezal/feezal-element-acme-widget (installed package) */');
        expect(html).toContain('ACME_WIDGET_CODE');
        expect(html).toContain('/* @feezal/feezal-theme-lcars (installed package) */');
        expect(html).toContain('LCARS_THEME_CODE');
        // …with the closing tag escaped so the inline script survives
        // ('<\/script>' — backslash built by concatenation to not confuse THIS file)…
        expect(html).toContain('<' + '\\' + '/script> inside a string');
        // …and no file references (exports must work from file://), no unused code.
        expect(html).not.toContain('src="/user-elements');
        expect(html).not.toContain('NEVER');
    });
});
