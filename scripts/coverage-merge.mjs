#!/usr/bin/env node
/**
 * A31 — merge the suites' lcov reports into ONE overall number.
 *
 * feezal's coverage is produced by three independent vitest runs with three
 * different denominators:
 *
 *   server/coverage/lcov.info          server/src/**            (node)
 *   www/coverage/lcov.info             www/src + shared logic   (happy-dom)
 *   www/coverage-browser/lcov.info     www/src + all elements   (chromium)
 *
 * Read separately none of them answers "how much of feezal is tested" — and a
 * file exercised by two suites must be counted ONCE, at the union of the lines
 * they hit (that is exactly the case for www/src, which both www suites drive).
 * This script merges them by summing per-line hit counts, writes a combined
 * lcov, and prints the overall figure.
 *
 * Usage (repo root):
 *   node scripts/coverage-merge.mjs [--min <pct>] [--quiet]
 *
 * `--min` is the don't-sink-again floor: exit code 1 when the merged line
 * coverage falls below it. Without it the script only reports.
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Each source lcov + the repo-relative base its SF: paths resolve against. */
const SOURCES = [
    {label: 'server',      file: 'server/coverage/lcov.info',         base: 'server'},
    {label: 'www unit',    file: 'www/coverage/lcov.info',            base: 'www'},
    {label: 'www browser', file: 'www/coverage-browser/lcov.info',    base: 'www'},
];

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const minIndex = args.indexOf('--min');
const min = minIndex >= 0 ? Number(args[minIndex + 1]) : null;
if (minIndex >= 0 && !Number.isFinite(min)) {
    console.error('--min needs a number, e.g. --min 50');
    process.exit(2);
}

/**
 * Parse an lcov file into `Map<repoRelativePath, {lines: Map<no, hits>,
 * branches: Map<key, hits>, fns: Map<name, hits>}>`.
 *
 * Only the record types the merge needs are kept (DA / BRDA / FNDA); LF/LH/BRF
 * and friends are recomputed on write, because summing THEM across suites is
 * exactly the double-count this script exists to avoid.
 */
function parseLcov(text, base) {
    const files = new Map();
    let current = null;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.startsWith('SF:')) {
            // lcov paths may be absolute or relative to the suite's root;
            // normalise both to a repo-relative POSIX path so the same file
            // seen by two suites lands on one key.
            const raw = line.slice(3);
            const abs = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)
                ? raw
                : resolve(repoRoot, base, raw);
            const key = relative(repoRoot, abs).split('\\').join('/');
            if (!files.has(key)) files.set(key, {lines: new Map(), branches: new Map(), fns: new Map()});
            current = files.get(key);
        } else if (!current) {
            continue;
        } else if (line.startsWith('DA:')) {
            const [no, hits] = line.slice(3).split(',').map(Number);
            current.lines.set(no, (current.lines.get(no) || 0) + (hits || 0));
        } else if (line.startsWith('BRDA:')) {
            // BRDA:<line>,<block>,<branch>,<taken|->
            const parts = line.slice(5).split(',');
            const taken = parts[3] === '-' ? 0 : Number(parts[3]) || 0;
            const key = parts.slice(0, 3).join(',');
            current.branches.set(key, (current.branches.get(key) || 0) + taken);
        } else if (line.startsWith('FNDA:')) {
            const comma = line.indexOf(',');
            const hits = Number(line.slice(5, comma)) || 0;
            const name = line.slice(comma + 1);
            current.fns.set(name, (current.fns.get(name) || 0) + hits);
        } else if (line === 'end_of_record') {
            current = null;
        }
    }
    return files;
}

/** Merge `src` into `into`, summing hit counts per line/branch/function. */
function mergeInto(into, src) {
    for (const [file, rec] of src) {
        if (!into.has(file)) {
            into.set(file, {lines: new Map(rec.lines), branches: new Map(rec.branches), fns: new Map(rec.fns)});
            continue;
        }
        const target = into.get(file);
        for (const [k, v] of rec.lines) target.lines.set(k, (target.lines.get(k) || 0) + v);
        for (const [k, v] of rec.branches) target.branches.set(k, (target.branches.get(k) || 0) + v);
        for (const [k, v] of rec.fns) target.fns.set(k, (target.fns.get(k) || 0) + v);
    }
}

const totals = (files) => {
    let found = 0, hit = 0, bFound = 0, bHit = 0;
    for (const rec of files.values()) {
        for (const h of rec.lines.values()) { found++; if (h > 0) hit++; }
        for (const h of rec.branches.values()) { bFound++; if (h > 0) bHit++; }
    }
    return {found, hit, bFound, bHit, pct: found ? (hit / found) * 100 : 0};
};

const pad = (s, n) => String(s).padEnd(n);
const pct = n => `${n.toFixed(2)}%`;

// ── read + merge ────────────────────────────────────────────────────────────
const merged = new Map();
const perSuite = [];
const missing = [];

for (const {label, file, base} of SOURCES) {
    const abs = join(repoRoot, file);
    if (!existsSync(abs)) { missing.push({label, file}); continue; }
    const parsed = parseLcov(await readFile(abs, 'utf8'), base);
    perSuite.push({label, file, ...totals(parsed), files: parsed.size});
    mergeInto(merged, parsed);
}

if (missing.length === SOURCES.length) {
    console.error('No lcov reports found. Generate them first:\n' +
        '  npm run test:coverage --prefix server\n' +
        '  npm run test:coverage --prefix www\n' +
        '  npm run test:browser:coverage --prefix www');
    process.exit(2);
}

// ── write the merged lcov ───────────────────────────────────────────────────
const out = [];
for (const [file, rec] of [...merged].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(`TN:`, `SF:${file}`);
    for (const [name, hits] of rec.fns) out.push(`FNDA:${hits},${name}`);
    out.push(`FNF:${rec.fns.size}`, `FNH:${[...rec.fns.values()].filter(h => h > 0).length}`);
    for (const [key, taken] of rec.branches) out.push(`BRDA:${key},${taken || '-'}`);
    out.push(`BRF:${rec.branches.size}`, `BRH:${[...rec.branches.values()].filter(h => h > 0).length}`);
    for (const [no, hits] of [...rec.lines].sort((a, b) => a[0] - b[0])) out.push(`DA:${no},${hits}`);
    out.push(`LF:${rec.lines.size}`, `LH:${[...rec.lines.values()].filter(h => h > 0).length}`, 'end_of_record');
}
await mkdir(join(repoRoot, 'coverage'), {recursive: true});
await writeFile(join(repoRoot, 'coverage', 'lcov.info'), out.join('\n') + '\n');

// ── report ──────────────────────────────────────────────────────────────────
const overall = totals(merged);
if (!quiet) {
    console.log('\nCoverage — merged across suites (A31)\n');
    console.log(`  ${pad('suite', 14)} ${pad('files', 7)} ${pad('lines', 17)} branches`);
    console.log('  ' + '-'.repeat(56));
    for (const s of perSuite) {
        console.log(`  ${pad(s.label, 14)} ${pad(s.files, 7)} ` +
            `${pad(`${pct(s.pct)} (${s.hit}/${s.found})`, 17)} ${s.bFound ? pct((s.bHit / s.bFound) * 100) : '—'}`);
    }
    for (const m of missing) console.log(`  ${pad(m.label, 14)} ${pad('—', 7)} not generated (${m.file})`);
    console.log('  ' + '-'.repeat(56));
    console.log(`  ${pad('OVERALL', 14)} ${pad(merged.size, 7)} ` +
        `${pad(`${pct(overall.pct)} (${overall.hit}/${overall.found})`, 17)} ` +
        `${overall.bFound ? pct((overall.bHit / overall.bFound) * 100) : '—'}`);
    console.log(`\n  merged lcov -> coverage/lcov.info`);
    if (missing.length) console.log('  NOTE: a suite is missing — the overall figure is incomplete.');
    console.log('');
}

if (min !== null) {
    if (missing.length) {
        console.error(`Refusing to gate on an incomplete merge (${missing.map(m => m.label).join(', ')} missing).`);
        process.exit(2);
    }
    if (overall.pct < min) {
        console.error(`Coverage floor: ${pct(overall.pct)} is below the required ${min}%.`);
        process.exit(1);
    }
    if (!quiet) console.log(`  floor ${min}% satisfied.\n`);
}
