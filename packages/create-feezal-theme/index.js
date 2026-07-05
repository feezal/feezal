#!/usr/bin/env node
'use strict';

/**
 * create-feezal-theme
 *
 * Scaffolds a new feezal theme package.
 *
 * Usage:
 *   pnpm create feezal-theme [slug]
 *   npx create-feezal-theme [slug]
 *
 * Options:
 *   --base <light|dark>   Starter variable block (default: prompted)
 *   --scope <scope>       npm scope without @ (default: prompted)
 *   --output <dir>        Output parent directory (default: cwd)
 *   --yes                 Skip prompts; use defaults / CLI values only
 */

const path = require('path');
const fs   = require('fs');
const readline = require('readline');

// ── Argument parsing ────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flag(name, fallback = null) {
    const idx = argv.indexOf(`--${name}`);
    if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) {
        return argv[idx + 1];
    }
    return fallback;
}

const yes       = argv.includes('--yes') || argv.includes('-y');
const outputDir = flag('output', process.cwd());

// First positional arg = theme slug (without the feezal-theme- prefix)
let argName  = argv.find(a => !a.startsWith('--'));
let argBase  = flag('base');
let argScope = flag('scope');

// ── Prompts ─────────────────────────────────────────────────────────────────

const rl = readline.createInterface({input: process.stdin, output: process.stdout});

function ask(question, defaultVal) {
    if (yes && defaultVal !== undefined) {
        process.stdout.write(`${question} (${defaultVal}): ${defaultVal}\n`);
        return Promise.resolve(defaultVal);
    }
    return new Promise(resolve => {
        const prompt = defaultVal !== undefined ? `${question} (${defaultVal}): ` : `${question}: `;
        rl.question(prompt, answer => {
            resolve(answer.trim() || defaultVal || '');
        });
    });
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ── Starter variable blocks ──────────────────────────────────────────────────
// The core theme variables per element-spec.md §5.1 / theme-spec.md §4, with
// neutral values a theme author replaces with their palette.

const BASES = {
    light: {
        '--primary-background-color':   '#fafafa',
        '--secondary-background-color': '#ffffff',
        '--primary-text-color':         '#212121',
        '--secondary-text-color':       '#616161',
        '--disabled-text-color':        '#9e9e9e',
        '--divider-color':              '#e0e0e0',
        '--primary-color':              '#0284c7',
        '--accent-color':               '#d97706',
        '--error-color':                '#d32f2f',
        '--warning-color':              '#ff9800',
        '--success-color':              '#2e7d32',
        '--info-color':                 '#0288d1',
        '--feezal-color':               'var(--primary-text-color)',
        '--feezal-bg':                  'var(--secondary-background-color)',
        '--feezal-border':              'var(--divider-color)'
    },
    dark: {
        '--primary-background-color':   '#1e1e1e',
        '--secondary-background-color': '#2a2a2a',
        '--primary-text-color':         '#e0e0e0',
        '--secondary-text-color':       '#9e9e9e',
        '--disabled-text-color':        '#616161',
        '--divider-color':              '#3a3a3a',
        '--primary-color':              '#38bdf8',
        '--accent-color':               '#fb923c',
        '--error-color':                '#ef5350',
        '--warning-color':              '#ffa726',
        '--success-color':              '#66bb6a',
        '--info-color':                 '#29b6f6',
        '--feezal-color':               'var(--primary-text-color)',
        '--feezal-bg':                  'var(--secondary-background-color)',
        '--feezal-border':              'var(--divider-color)'
    }
};

// ── Templates ────────────────────────────────────────────────────────────────

function themeJs(slug, base) {
    const vars = Object.entries(BASES[base])
        .map(([k, v]) => `    ${k}: ${v};`)
        .join('\n');
    return `// feezal theme "${slug}" — self-injecting, class-scoped stylesheet.
// Importing this module has exactly one side effect: appending the <style>
// below. Nothing changes until the feezal-theme-${slug} class is applied.
// See theme-spec.md for the authoring guide.
const styleElement = document.createElement('style');
styleElement.innerHTML = \`.feezal-theme-${slug} {
${vars}
}\`;
document.head.appendChild(styleElement);
`;
}

function packageJson(scope, pkgName) {
    return JSON.stringify({
        name: `@${scope}/${pkgName}`,
        version: '0.1.0',
        description: '',
        main: `${pkgName}.js`,
        keywords: ['feezal', 'feezal-theme'],
        feezal: {type: 'theme'},
        license: 'MIT'
    }, null, 2) + '\n';
}

function readme(scope, pkgName, slug, base) {
    return `# @${scope}/${pkgName}

> feezal theme — ${slug}

A [feezal](https://github.com/feezal/feezal) dashboard theme (${base} starter).

## Installation

Search for \`${pkgName}\` in the feezal Package Manager (sidebar → Packages),
or install manually:

\`\`\`sh
npm install @${scope}/${pkgName}
\`\`\`

## Development

Edit the variable block in \`${pkgName}.js\` — the core variables are listed in
[theme-spec.md](https://github.com/feezal/feezal/blob/master/docs/theme-spec.md).
To test without publishing, copy this directory into your feezal data
directory under \`elements/@${scope}/${pkgName}/\` and reload the editor.
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n  create-feezal-theme — feezal theme scaffolding\n');

    const name  = slugify(argName  || await ask('Theme slug (e.g. nordic)'));
    let   base  =        (argBase  || await ask('Base variables (light/dark)', 'dark')).toLowerCase();
    const scope = slugify(argScope || await ask('npm scope (without @)', 'feezal'));

    rl.close();

    if (!name) {
        console.error('  Error: theme slug is required.');
        process.exit(1);
    }
    if (!BASES[base]) {
        console.error(`  Error: unknown base "${base}" (expected light or dark).`);
        process.exit(1);
    }

    const pkgName = `feezal-theme-${name}`;
    const pkgDir  = path.join(outputDir, pkgName);

    if (fs.existsSync(pkgDir)) {
        console.error(`  Error: directory already exists: ${pkgDir}`);
        process.exit(1);
    }

    fs.mkdirSync(pkgDir, {recursive: true});
    fs.writeFileSync(path.join(pkgDir, 'package.json'),  packageJson(scope, pkgName));
    fs.writeFileSync(path.join(pkgDir, `${pkgName}.js`), themeJs(name, base));
    fs.writeFileSync(path.join(pkgDir, 'README.md'),     readme(scope, pkgName, name, base));

    console.log(`\n  Created: ${pkgDir}`);
    console.log(`\n  Files:`);
    console.log(`    package.json`);
    console.log(`    ${pkgName}.js`);
    console.log(`    README.md`);
    console.log(`\n  Next steps:`);
    console.log(`    1. Edit ${pkgName}.js — replace the ${base} starter values with your palette`);
    console.log(`    2. Test: copy the directory into <dataDir>/elements/@${scope}/${pkgName}/ and reload the editor`);
    console.log(`    3. Publish: npm publish --access public`);
    console.log(`\n  See theme-spec.md for the full authoring guide.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
