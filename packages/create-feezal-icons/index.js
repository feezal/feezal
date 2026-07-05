#!/usr/bin/env node
'use strict';

/**
 * create-feezal-icons
 *
 * Scaffolds a new feezal icon-set package.
 *
 * Usage:
 *   pnpm create feezal-icons [set]
 *   npx create-feezal-icons [set]
 *
 * Options:
 *   --mode <svg|font>   Set type: inline-SVG render mode (recommended,
 *                       tree-shakeable) or ligature-webfont mode (default: prompted)
 *   --scope <scope>     npm scope without @ (default: prompted)
 *   --output <dir>      Output parent directory (default: cwd)
 *   --yes               Skip prompts; use defaults / CLI values only
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

// First positional arg = set name (without the feezal-icons- prefix)
let argName  = argv.find(a => !a.startsWith('--'));
let argMode  = flag('mode');
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

// ── Templates ────────────────────────────────────────────────────────────────

// SVG mode: separate data module (exactly `export default <JSON object>;`)
// so the server can tree-shake per site — see icons-spec.md §4a.
function iconsJs() {
    return `export default {"circle": "<svg viewBox=\\"0 0 24 24\\"><circle cx=\\"12\\" cy=\\"12\\" r=\\"9\\" fill=\\"currentColor\\"/></svg>", "square": "<svg viewBox=\\"0 0 24 24\\"><rect x=\\"4\\" y=\\"4\\" width=\\"16\\" height=\\"16\\" fill=\\"currentColor\\"/></svg>"};
`;
}

function indexJsSvg(set) {
    return `/* global feezal */
/**
 * feezal-icons-${set} — feezal icon set "${set}" (render mode, inline SVG).
 *
 * Icon values are \`${set}:<name>\`. Keep the icon data in icons.js — the
 * server parses that module and inlines only the icons a site actually uses
 * into viewer pages and static exports (per-site tree-shaking).
 *
 * See docs/icons-spec.md for the full authoring guide.
 */
import ICONS from './icons.js';

feezal.registerIcons('${set}', {
    names: Object.keys(ICONS),
    render(name) {
        return ICONS[name] || '';
    }
});
`;
}

// Font mode: ligature webfonts only — the glyph must render from the icon's
// NAME (like Material Icons). Class+codepoint fonts cannot reach shadow DOM.
function indexJsFont(set) {
    return `/* global feezal */
/**
 * feezal-icons-${set} — feezal icon set "${set}" (font mode, ligature webfont).
 *
 * Icon values are \`${set}:<name>\`. Font mode works ONLY for LIGATURE fonts
 * (the glyph renders from the icon's name). If your font is class+codepoint
 * based, use render mode instead (\`--mode svg\`) — document-level CSS classes
 * cannot reach shadow DOM.
 *
 * Font assets are copied next to the bundle by the Package Manager installer;
 * reference them relative to the module so paths survive bundling.
 *
 * See docs/icons-spec.md for the full authoring guide.
 */

// TODO: place your ligature webfont at ./assets/${set}.woff2
const fontUrl = new URL('./assets/${set}.woff2', import.meta.url);
const fontCss = \`@font-face {
    font-family: '${set}';
    src: url('\${fontUrl}') format('woff2');
    font-display: block;
}\`;
document.head.appendChild(Object.assign(document.createElement('style'), {textContent: fontCss}));

feezal.registerIcons('${set}', {
    font: {family: '${set}'},
    // TODO: advertise every ligature name to the editor's icon picker.
    names: ['circle', 'square']
});
`;
}

function packageJson(scope, pkgName, set, mode) {
    const manifest = {
        name: `@${scope}/${pkgName}`,
        version: '0.1.0',
        description: '',
        main: 'index.js',
        type: 'module',
        keywords: ['feezal', 'feezal-icons'],
        feezal: {type: 'icons', set},
        license: 'MIT'
    };
    if (mode === 'svg') {
        // Declares the tree-shakeable data module (icons-spec §4a).
        manifest.feezal.icons = 'icons.js';
    }
    return JSON.stringify(manifest, null, 2) + '\n';
}

function readme(scope, pkgName, set, mode) {
    return `# @${scope}/${pkgName}

> feezal icon set — \`${set}:<name>\` (${mode === 'svg' ? 'inline SVG render mode' : 'ligature webfont mode'})

A [feezal](https://github.com/feezal/feezal) icon-set package.

## Installation

Search for \`${pkgName}\` in the feezal Package Manager (sidebar → Packages),
or install manually:

\`\`\`sh
npm install @${scope}/${pkgName}
\`\`\`

## Development

${mode === 'svg'
        ? `Add icons to \`icons.js\` — one JSON object literal mapping name → complete
inline-SVG markup (use \`currentColor\` so icons follow the active theme). Keep
the file exactly \`export default <JSON object>;\` — the feezal server parses it
for per-site tree-shaking.`
        : `Place your ligature webfont at \`assets/${set}.woff2\` and list every icon
name in the \`names\` array in \`index.js\`. Ship the font's LICENSE file in the
package — the installer copies non-JS assets next to the bundle.`}

To test without publishing, copy this directory into your feezal data
directory under \`elements/@${scope}/${pkgName}/\` and reload the editor —
the set appears as a chip in the icon picker.

Refer to [icons-spec.md](https://github.com/feezal/feezal/blob/master/docs/icons-spec.md)
for the full authoring guide (naming, licensing/attribution, tree-shaking).
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n  create-feezal-icons — feezal icon-set scaffolding\n');

    const name  = slugify(argName  || await ask('Set name (e.g. lucide) — becomes the icon prefix'));
    const mode  =        (argMode  || await ask('Mode (svg/font)', 'svg')).toLowerCase();
    const scope = slugify(argScope || await ask('npm scope (without @)', 'feezal'));

    rl.close();

    if (!name) {
        console.error('  Error: set name is required.');
        process.exit(1);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        console.error(`  Error: set name must match [a-z][a-z0-9-]* (got "${name}").`);
        process.exit(1);
    }
    if (mode !== 'svg' && mode !== 'font') {
        console.error(`  Error: unknown mode "${mode}" (expected svg or font).`);
        process.exit(1);
    }

    const pkgName = `feezal-icons-${name}`;
    const pkgDir  = path.join(outputDir, pkgName);

    if (fs.existsSync(pkgDir)) {
        console.error(`  Error: directory already exists: ${pkgDir}`);
        process.exit(1);
    }

    fs.mkdirSync(pkgDir, {recursive: true});
    fs.writeFileSync(path.join(pkgDir, 'package.json'), packageJson(scope, pkgName, name, mode));
    fs.writeFileSync(path.join(pkgDir, 'README.md'),    readme(scope, pkgName, name, mode));
    if (mode === 'svg') {
        fs.writeFileSync(path.join(pkgDir, 'index.js'), indexJsSvg(name));
        fs.writeFileSync(path.join(pkgDir, 'icons.js'), iconsJs());
    } else {
        fs.writeFileSync(path.join(pkgDir, 'index.js'), indexJsFont(name));
        fs.mkdirSync(path.join(pkgDir, 'assets'));
        fs.writeFileSync(path.join(pkgDir, 'assets', 'PUT-FONT-HERE.md'),
            `Place your ligature webfont here as ${name}.woff2 (see index.js).\n`);
    }

    console.log(`\n  Created: ${pkgDir}`);
    console.log(`\n  Files:`);
    console.log(`    package.json`);
    console.log(`    index.js`);
    if (mode === 'svg') {
        console.log(`    icons.js`);
    } else {
        console.log(`    assets/`);
    }
    console.log(`    README.md`);
    console.log(`\n  Next steps:`);
    if (mode === 'svg') {
        console.log(`    1. Add your icons to icons.js (name → inline-SVG markup, currentColor)`);
    } else {
        console.log(`    1. Add your ligature font to assets/ and list its names in index.js`);
    }
    console.log(`    2. Include the icon artwork's LICENSE/attribution files in the package`);
    console.log(`    3. Test: copy the directory into <dataDir>/elements/@${scope}/${pkgName}/ and reload the editor`);
    console.log(`    4. Publish: npm publish --access public`);
    console.log(`\n  See icons-spec.md for the full authoring guide.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
