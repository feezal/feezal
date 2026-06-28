#!/usr/bin/env node
'use strict';

/**
 * create-feezal-element
 *
 * Scaffolds a new feezal element package.
 *
 * Usage:
 *   pnpm create feezal-element [name]
 *   npx create-feezal-element [name]
 *
 * Options:
 *   --category <cat>   Element category (default: prompted)
 *   --scope <scope>    npm scope without @ (default: prompted)
 *   --output <dir>     Output parent directory (default: cwd)
 *   --yes              Skip prompts; use defaults / CLI values only
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

// First positional arg = element short name (without category prefix)
let argName     = argv.find(a => !a.startsWith('--'));
let argCategory = flag('category');
let argScope    = flag('scope');

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

function toPascalCase(str) {
    return str.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// ── Templates ────────────────────────────────────────────────────────────────

function elementJs(scope, category, name, className, tag) {
    return `/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

class ${className} extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: '${toPascalCase(name)}',
                category: '${toPascalCase(category)}',
                color: '#4a6080'
            },
            description: '',
            attributes: [
                'subscribe',
                {name: 'publish', type: 'mqttTopic', help: 'Topic to publish to on interaction.'}
            ],
            styles: ['top', 'left', 'width', 'height', 'font-size', 'color', 'background'],
            defaultStyle: {width: '120px', height: '40px'}
        };
    }

    static properties = {
        publish: {type: String, reflect: true}
    };

    static styles = [feezalBaseStyles, css\`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
        }
    \`];

    constructor() {
        super();
        this.publish = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (!feezal.isEditor && this.subscribe) {
            this.addSubscription(this.subscribe, msg => this._onMessage(msg));
        }
    }

    _onMessage(msg) {
        // TODO: update local state from msg.payload / this.getProperty(msg, this.messageProperty)
    }

    render() {
        if (feezal.isEditor) {
            return html\`<div style="opacity:0.5;font-size:12px">${toPascalCase(name)}</div>\`;
        }
        return html\`<div>TODO</div>\`;
    }
}

customElements.define('${tag}', ${className});
export {${className}};
`;
}

function packageJson(scope, tag) {
    return JSON.stringify({
        name: `@${scope}/${tag}`,
        version: '0.1.0',
        description: '',
        main: `${tag}.js`,
        keywords: ['feezal', 'element'],
        license: 'MIT'
    }, null, 2) + '\n';
}

function readme(scope, tag, category, name) {
    return `# @${scope}/${tag}

> feezal element — ${toPascalCase(category)} / ${toPascalCase(name)}

A [feezal](https://github.com/feezal/feezal) dashboard element.

## Installation

\`\`\`sh
npm install @${scope}/${tag}
# or
pnpm add @${scope}/${tag}
\`\`\`

Then copy the installed package into your feezal installation's
\`www/node_modules/@${scope}/\` directory, or publish to npm and install
it directly into the feezal www workspace.

## Attributes

| Attribute | Type | Description |
|---|---|---|
| \`subscribe\` | mqttTopic | Topic to subscribe to |
| \`publish\` | mqttTopic | Topic to publish to on interaction |

## Development

Edit \`${tag}.js\`, then run \`cd www && npm run build\` inside your
feezal installation to rebuild the editor bundle.

Refer to [element-spec.md](https://github.com/feezal/feezal/blob/master/docs/element-spec.md)
for the full authoring guide.
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n  create-feezal-element — feezal element scaffolding\n');

    const name     = slugify(argName     || await ask('Element name (e.g. my-button)'));
    const category = slugify(argCategory || await ask('Category', 'custom'));
    const scope    = slugify(argScope    || await ask('npm scope (without @)', 'feezal'));

    rl.close();

    if (!name) {
        console.error('  Error: element name is required.');
        process.exit(1);
    }

    const tag       = `feezal-element-${category}-${name}`;
    const className = `FeezalElement${toPascalCase(category)}${toPascalCase(name)}`;
    const pkgDir    = path.join(outputDir, tag);

    if (fs.existsSync(pkgDir)) {
        console.error(`  Error: directory already exists: ${pkgDir}`);
        process.exit(1);
    }

    fs.mkdirSync(pkgDir, {recursive: true});
    fs.writeFileSync(path.join(pkgDir, 'package.json'),   packageJson(scope, tag));
    fs.writeFileSync(path.join(pkgDir, `${tag}.js`),      elementJs(scope, category, name, className, tag));
    fs.writeFileSync(path.join(pkgDir, 'README.md'),      readme(scope, tag, category, name));

    console.log(`\n  Created: ${pkgDir}`);
    console.log(`\n  Files:`);
    console.log(`    package.json`);
    console.log(`    ${tag}.js`);
    console.log(`    README.md`);
    console.log(`\n  Next steps:`);
    console.log(`    1. Edit ${tag}.js — implement render(), _onMessage(), feezal attributes`);
    console.log(`    2. Copy the package to www/node_modules/@${scope}/${tag}/`);
    console.log(`    3. Run: cd www && npm run build`);
    console.log(`\n  See element-spec.md for the full authoring guide.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
