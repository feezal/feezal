/**
 * Turn the raw Chromium V8 coverage dumps written by the E2E harness
 * (coverage-e2e-raw/*.json, one per test stack — see test-e2e/harness.js and
 * FEEZAL_COVERAGE) into lcov reports for Codecov:
 *
 *   coverage-e2e/lcov.info           www/src            (Codecov flag "e2e")
 *   coverage-e2e/lcov-elements.info  www/packages/@feezal (flag "elements")
 *
 * Requires the dist/ bundles to have been built with FEEZAL_COVERAGE=1 so the
 * captured script sources carry inline sourcemaps — coverage is then mapped
 * back to the original source files.
 *
 * Usage: node scripts/e2e-coverage-report.mjs   (cwd: www/)
 */
import {readdir, readFile, writeFile} from 'fs/promises';
import {readdirSync} from 'fs';
import {join} from 'path';
import {CoverageReport} from 'monocart-coverage-reports';

const rawDir = 'coverage-e2e-raw';

// Allowlist of our real source files: dependencies bundled into the chunks
// also carry sourcemap paths ending in src/<file>.js (e.g. shadycss), which
// must not be mistaken for www/src files.
const srcFiles = new Set(readdirSync('src').filter(f => f.endsWith('.js')));
const isOwnSource = sourcePath =>
    !sourcePath.includes('node_modules') &&
    /(^|\/)src\/[^/]+\.js$/.test(sourcePath) &&
    srcFiles.has(sourcePath.split('/').pop());

// Bundled element/theme/SDK packages from www/packages/@feezal. Vite resolves
// the npm links to their real path, so sourcemap sources contain
// packages/@feezal/…; accept node_modules/@feezal/… too in case a bundler
// version preserves the symlinked path.
const elementSubPath = sourcePath => {
    const m = sourcePath.match(/(?:^|\/)(?:packages|node_modules)\/(@feezal\/[^/]+\/.+\.js)$/);
    return m ? m[1] : null;
};

let files = [];
try {
    files = (await readdir(rawDir)).filter(f => f.endsWith('.json'));
} catch { /* no dumps — fall through to the empty-check below */ }

if (files.length === 0) {
    console.error(`no coverage dumps in ${rawDir} — run the E2E suite with FEEZAL_COVERAGE=1 first`);
    process.exit(1);
}

const coverageReport = new CoverageReport({
    name: 'feezal E2E coverage',
    outputDir: 'coverage-e2e',
    reports: [
        ['lcovonly', {file: 'lcov.info'}],
        'console-summary',
    ],
    // Only our own bundles — not the server-generated element loader.
    entryFilter: entry =>
        entry.url.includes('/assets/') || entry.url.endsWith('/viewer-bundle.js'),
    // Our sources only: www/src and the bundled @feezal packages; everything
    // else in the chunks (lit, shoelace, monaco, …) is not measured.
    sourceFilter: sourcePath => isOwnSource(sourcePath) || elementSubPath(sourcePath) !== null,
    // lcov paths must be repo-relative for Codecov (upload runs at repo root).
    sourcePath: filePath => {
        if (isOwnSource(filePath)) return 'www/src/' + filePath.split('/').pop();
        const sub = elementSubPath(filePath);
        return sub ? 'www/packages/' + sub : filePath;
    },
});

for (const file of files) {
    const entries = JSON.parse(await readFile(join(rawDir, file), 'utf8'));
    await coverageReport.add(entries);
}

await coverageReport.generate();

// Split the lcov by area for separate Codecov flags. This also drops chunks
// whose sourcemap has no original sources (e.g. rollup's _commonjsHelpers):
// they bypass sourceFilter and appear as the bundle file itself.
const lcovFile = 'coverage-e2e/lcov.info';
const records = (await readFile(lcovFile, 'utf8')).split(/\nend_of_record\n?/);
const format = list => list.map(r => r.trimStart() + '\nend_of_record\n').join('');
const srcRecords = records.filter(r => r.includes('SF:www/src/'));
const elementRecords = records.filter(r => r.includes('SF:www/packages/@feezal/'));
await writeFile(lcovFile, format(srcRecords));
await writeFile('coverage-e2e/lcov-elements.info', format(elementRecords));
console.log(`lcov: ${srcRecords.length} www/src records in lcov.info, ` +
    `${elementRecords.length} package records in lcov-elements.info ` +
    `(dropped ${records.filter(r => r.trim()).length - srcRecords.length - elementRecords.length})`);
