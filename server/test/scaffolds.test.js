import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {createRequire} from 'module';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {mkdtemp, rm, mkdir, cp, readFile} from 'fs/promises';
import {existsSync} from 'fs';
import {tmpdir} from 'os';
import {join, resolve} from 'path';

const require = createRequire(import.meta.url);
const pm = require('../src/build/install.js');
const {discoverIconPackages, readIconData, extractUsedIcons} = require('../src/build/icons.js');

const run = promisify(execFile);
const SCAFFOLDS = resolve(__dirname, '../../packages');

// The create-feezal-* scaffolds (N23) must emit packages that the Package
// Manager pipeline accepts end to end: allowlisted name, correct registry
// keyword, feezal manifest field, parseable modules, and (icons, svg mode)
// a tree-shakeable data module.

let out;

beforeAll(async () => {
    out = await mkdtemp(join(tmpdir(), 'feezal-scaffold-'));
    const opts = {timeout: 30_000};
    await run(process.execPath, [join(SCAFFOLDS, 'create-feezal-theme/index.js'),
        'nordic', '--base', 'dark', '--scope', 'acme', '--output', out, '--yes'], opts);
    await run(process.execPath, [join(SCAFFOLDS, 'create-feezal-icons/index.js'),
        'myset', '--mode', 'svg', '--scope', 'acme', '--output', out, '--yes'], opts);
    await run(process.execPath, [join(SCAFFOLDS, 'create-feezal-icons/index.js'),
        'ligs', '--mode', 'font', '--scope', 'acme', '--output', out, '--yes'], opts);
    await run(process.execPath, [join(SCAFFOLDS, 'create-feezal-element/index.js'),
        'widget', '--category', 'custom', '--scope', 'acme', '--output', out, '--yes'], opts);
}, 60_000);

afterAll(async () => {
    await rm(out, {recursive: true, force: true});
});

async function manifest(dir) {
    return JSON.parse(await readFile(join(out, dir, 'package.json'), 'utf8'));
}

async function checkSyntax(...rel) {
    // node --check resolves the module goal from the sibling package.json.
    await run(process.execPath, ['--check', join(out, ...rel)], {timeout: 15_000});
}

describe('create-feezal-theme', () => {
    it('emits an allowlisted name, the registry keyword and the feezal field', async () => {
        const pj = await manifest('feezal-theme-nordic');
        expect(pj.name).toBe('@acme/feezal-theme-nordic');
        expect(pj.keywords).toContain('feezal-theme');
        expect(pj.feezal).toEqual({type: 'theme'});
        expect(pj.main).toBe('feezal-theme-nordic.js');
        expect(pm.isAllowedPackage(pj.name)).toBe(true);
        expect(pm.derivePkgType(pj.name)).toBe('theme');
    });

    it('module parses and is scoped under the theme class', async () => {
        await checkSyntax('feezal-theme-nordic', 'feezal-theme-nordic.js');
        const src = await readFile(join(out, 'feezal-theme-nordic/feezal-theme-nordic.js'), 'utf8');
        expect(src).toContain('.feezal-theme-nordic {');
        expect(src).toContain('--primary-background-color');
        expect(src).toContain('--feezal-bg');
    });

    it('is picked up by listInstalled after a manual drop', async () => {
        const dataDir = await mkdtemp(join(tmpdir(), 'feezal-drop-'));
        try {
            await mkdir(join(dataDir, 'elements', '@acme'), {recursive: true});
            await cp(join(out, 'feezal-theme-nordic'), join(dataDir, 'elements', '@acme', 'feezal-theme-nordic'), {recursive: true});
            const list = await pm.listInstalled(dataDir);
            expect(list).toMatchObject([{name: '@acme/feezal-theme-nordic', type: 'theme', version: '0.1.0'}]);
        } finally {
            await rm(dataDir, {recursive: true, force: true});
        }
    });
});

describe('create-feezal-icons (svg mode)', () => {
    it('emits the manifest with set + tree-shaking data module declared', async () => {
        const pj = await manifest('feezal-icons-myset');
        expect(pj.name).toBe('@acme/feezal-icons-myset');
        expect(pj.keywords).toContain('feezal-icons');
        expect(pj.feezal).toEqual({type: 'icons', set: 'myset', icons: 'icons.js'});
        expect(pj.type).toBe('module');
        expect(pm.derivePkgType(pj.name)).toBe('icons');
    });

    it('modules parse; entry registers the set from the data module', async () => {
        await checkSyntax('feezal-icons-myset', 'index.js');
        await checkSyntax('feezal-icons-myset', 'icons.js');
        const src = await readFile(join(out, 'feezal-icons-myset/index.js'), 'utf8');
        expect(src).toContain(`feezal.registerIcons('myset'`);
        expect(src).toContain(`import ICONS from './icons.js'`);
    });

    it('the data module survives the real tree-shaker parse + extraction', async () => {
        const pkgs = discoverIconPackages(out /* no packages/ or node_modules/ inside */, out);
        const mine = pkgs.find(p => p.set === 'myset');
        expect(mine).toBeTruthy();
        expect(mine.iconsFile).toBeTruthy();

        const icons = readIconData(mine.iconsFile);
        expect(Object.keys(icons)).toEqual(['circle', 'square']);
        expect(icons.circle).toContain('currentColor');

        const used = extractUsedIcons('<feezal-element-basic-icon icon="myset:circle">', ['myset']);
        expect(used.get('myset')).toEqual(['circle']);
    });
});

describe('create-feezal-icons (font mode)', () => {
    it('emits font registration without a data-module claim', async () => {
        const pj = await manifest('feezal-icons-ligs');
        expect(pj.feezal).toEqual({type: 'icons', set: 'ligs'});
        await checkSyntax('feezal-icons-ligs', 'index.js');
        const src = await readFile(join(out, 'feezal-icons-ligs/index.js'), 'utf8');
        expect(src).toContain(`font: {family: 'ligs'}`);
        expect(src).toContain('@font-face');
        expect(existsSync(join(out, 'feezal-icons-ligs/assets'))).toBe(true);
    });
});

describe('create-feezal-element', () => {
    it('emits the registry keyword the search actually filters on', async () => {
        const pj = await manifest('feezal-element-custom-widget');
        expect(pj.keywords).toContain('feezal-element');
        expect(pm.derivePkgType(pj.name)).toBe('element');
        expect(pj.keywords).toContain(pm.typeKeyword('element'));
    });
});
