'use strict';

const fs = require('fs').promises;
const path = require('path');

const rimraf = require('rimraf');
const rollup = require('rollup');
const {createSpaConfig} = require('@open-wc/building-rollup');
const cpy = require('rollup-plugin-cpy');

/**
 * Creates the viewer build pipeline bound to a specific wwwDir.
 *
 * NOTE: This build pipeline is a carry-over from Phase 1 and will be replaced
 * with a Vite-based solution in Phase 3. It is only triggered for static
 * exports, not for every deploy.
 *
 * @param {string} wwwDir  Absolute path to the www/ directory.
 * @returns {Function}     build(data) → Promise
 */
function createBuild(wwwDir) {
    function createRollupConfig(outputDir) {
        const rollupConfig = createSpaConfig({
            plugins: {workbox: false}
        });

        rollupConfig.input = path.join(wwwDir, 'viewer-src', 'index.html');

        // Remove the entrypoint-hashmanifest plugin — it breaks the output
        rollupConfig.plugins = rollupConfig.plugins.filter(
            plugin => plugin.name !== 'entrypoint-hashmanifest'
        );

        rollupConfig.plugins.push(cpy([
            {
                files: path.join(wwwDir, 'node_modules/web-animations-js/web-animations-next-lite.min.js'),
                dest: path.join(outputDir, 'node_modules/web-animations-js/')
            }
        ]));

        return rollupConfig;
    }

    async function bundle(data) {
        const outputDir = path.join(wwwDir, 'viewer', data.site.name);
        const rollupConfig = createRollupConfig(outputDir);
        rollupConfig.output.dir = outputDir;

        const b = await rollup.rollup(rollupConfig);
        await b.generate(rollupConfig.output);

        await new Promise((resolve, reject) => {
            rimraf(outputDir, err => (err ? reject(err) : resolve()));
        });

        await b.write(rollupConfig.output);
    }

    async function filterElements(usedElements) {
        const elementImports = await fs.readFile(
            path.join(wwwDir, 'editor', 'feezal-elements.js'),
            'utf8'
        );

        const filtered = elementImports
            .split('\n')
            .filter(line =>
                line.startsWith('import') &&
                (
                    usedElements.some(el => line.toLowerCase().includes(el.toLowerCase())) ||
                    line.toLowerCase().includes('feezal-theme-')
                )
            )
            .join('\n');

        await fs.writeFile(
            path.join(wwwDir, 'viewer-src', 'feezal-elements.js'),
            filtered,
            'utf8'
        );
    }

    async function compose(data) {
        const src = await fs.readFile(path.join(wwwDir, 'viewer-src', 'viewer.html'), 'utf8');
        const connectionTag = `<feezal-connection backend="${data.connection.backend}" config='${JSON.stringify(data.connection)}'></feezal-connection>\n`;
        const appTag = `<feezal-app-viewer>\n${data.html}\n</feezal-app-viewer>`;

        await fs.writeFile(
            path.join(wwwDir, 'viewer-src', 'index.html'),
            src + connectionTag + appTag,
            'utf8'
        );
    }

    async function build(data) {
        await filterElements(data.elements);
        await compose(data);
        await bundle(data);
    }

    return build;
}

module.exports = createBuild;
