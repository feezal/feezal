/**
 * Generator for the feezal-icons-fa data modules (N28).
 *
 * Reads the per-icon SVGs shipped by @fortawesome/fontawesome-free
 * (svgs/{solid,regular,brands}/*.svg) and flattens each style into a
 * spec-§4a data module (`export default {name: "<svg …>", …};`) so the
 * server can tree-shake per site. The generated files are committed;
 * regenerate after bumping the upstream package:
 *
 *   cd www && npm install --no-save @fortawesome/fontawesome-free
 *   node packages/@feezal/feezal-icons-fa/generate.mjs
 *
 * Normalisation: the xmlns attribute and the per-file license comment are
 * stripped (attribution ships as LICENSE.txt + README in this package);
 * viewBox and the currentColor-filled paths are kept verbatim. FA viewBoxes
 * vary in width (0 0 320…640 512) — fine, render() returns unsized SVG and
 * <feezal-icon> sizes it to 1em.
 */
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const faPkg = require('@fortawesome/fontawesome-free/package.json');
const faDir = join(dirname(require.resolve('@fortawesome/fontawesome-free/package.json')), 'svgs');

const STYLES = ['solid', 'regular', 'brands'];

for (const style of STYLES) {
    const dir = join(faDir, style);
    const icons = {};
    for (const file of readdirSync(dir).sort()) {
        if (!file.endsWith('.svg')) continue;
        const name = file.slice(0, -4);
        const svg = readFileSync(join(dir, file), 'utf8')
            .replace(/<!--[\s\S]*?-->/g, '')          // license comment → LICENSE.txt
            .replace(/\s*xmlns="[^"]*"/, '')
            .replace(/\r?\n/g, '')
            .trim();
        icons[name] = svg;
    }

    const out = `// Generated from @fortawesome/fontawesome-free v${faPkg.version} (Font Awesome Free, icons CC BY 4.0 — see LICENSE.txt).\n` +
        `// Uniform data-module format: icon name -> complete inline-SVG markup string.\n` +
        `// Do not edit — regenerate with generate.mjs.\n` +
        `export default ${JSON.stringify(icons)};\n`;
    writeFileSync(join(here, `icons-${style}.js`), out);
    console.log(`icons-${style}.js: ${Object.keys(icons).length} icons, ${(out.length / 1024).toFixed(0)} kB`);
}
