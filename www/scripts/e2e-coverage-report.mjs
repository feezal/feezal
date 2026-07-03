/**
 * Turn the raw Chromium V8 coverage dumps written by the E2E harness
 * (coverage-e2e-raw/*.json, one per test stack — see test-e2e/harness.js and
 * FEEZAL_COVERAGE) into an lcov report for Codecov.
 *
 * Requires the dist/ bundles to have been built with FEEZAL_COVERAGE=1 so the
 * captured script sources carry inline sourcemaps — coverage is then mapped
 * back to the original src/ files.
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
    // Only sources under www/src (matches the unit-coverage scope); the
    // bundles also inline node_modules and www/packages, not measured here.
    sourceFilter: isOwnSource,
    // lcov paths must be repo-relative for Codecov (upload runs at repo root).
    sourcePath: filePath =>
        isOwnSource(filePath) ? 'www/src/' + filePath.split('/').pop() : filePath,
});

for (const file of files) {
    const entries = JSON.parse(await readFile(join(rawDir, file), 'utf8'));
    await coverageReport.add(entries);
}

await coverageReport.generate();

// Chunks whose sourcemap has no original sources (e.g. rollup's generated
// _commonjsHelpers) bypass sourceFilter and end up in the lcov as the bundle
// file itself — strip every record that isn't a www/src file.
const lcovFile = 'coverage-e2e/lcov.info';
const records = (await readFile(lcovFile, 'utf8')).split(/\nend_of_record\n?/);
const kept = records.filter(r => r.includes('SF:www/src/'));
await writeFile(lcovFile, kept.map(r => r.trimStart() + '\nend_of_record\n').join(''));
console.log(`lcov: kept ${kept.length} of ${records.filter(r => r.trim()).length} records in ${lcovFile}`);
