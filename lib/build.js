const fs = require('fs').promises;
const path = require('path');

const rimraf = require('rimraf');
const prettyHtml = require('@starptech/prettyhtml');

const rollup = require('rollup');
const {createDefaultConfig} = require('@open-wc/building-rollup');
const {injectManifest /* generateSW */} = require('rollup-plugin-workbox');
const cpy = require('rollup-plugin-cpy');

const wwwPath = path.join(__dirname, '..', 'www');

function createRollupConfig(outputDir) {
    const rollupConfig = createDefaultConfig({
        input: path.join(wwwPath, 'viewer-src', 'index.html'),
        plugins: {
            workbox: false
        }
    });

    rollupConfig.plugins = rollupConfig.plugins.filter(plugin => !['entrypoint-hashmanifest'].includes(plugin.name));

    rollupConfig.plugins.push(cpy([
        {
            files: 'www/node_modules/web-animations-js/web-animations-next-lite.min.js',
            dest: path.join(outputDir, 'node_modules/web-animations-js')
        },
        {
            files: 'www/node_modules/socket.io-client/dist/socket.io.slim.js',
            dest: path.join(outputDir, 'node_modules/socket.io-client/dist')
        }
    ]));

    return rollupConfig;
}

function bundle(data) {
    const outputDir = path.join(wwwPath, 'viewer', data.site.name);
    const rollupConfig = createRollupConfig(outputDir);
    rollupConfig.output.dir = outputDir;
    console.log('rollup', outputDir);
    return rollup.rollup(rollupConfig).then(bundle => {
        console.log('generate bundle');
        return bundle.generate(rollupConfig.output).then(output => {
            console.log('rm viewer');
            rimraf(outputDir, () => {});
            console.log('write bundle');
            return bundle.write(rollupConfig.output).then(() => {
                console.log('rollup done');
            });
        });
    });
}

function filterElements(usedElements) {
    return fs.readFile(path.join(wwwPath, 'editor', 'feezal-elements.js')).then(elementImports => {
        const availableElements = elementImports.toString().split('\n');
        return fs.writeFile(path.join(wwwPath, 'viewer-src', 'feezal-elements.js'), availableElements.filter(line => {
            return line.startsWith('import') && usedElements.some(el => line.toLowerCase().includes(el.toLowerCase()));
        }).join('\n'));
    });
}

function compose(data) {
    console.log('compose connection', data.connection);
    return fs.readFile(path.join(wwwPath, 'viewer-src', 'viewer.html')).then(src => {
        return fs.writeFile(path.join(wwwPath, 'viewer-src', 'index.html'),
            src.toString() +
            `<feezal-connection backend="${data.connection.backend}" config='${JSON.stringify(data.connection)}'></feezal-connection>` +
            prettyHtml(
                `<feezal-app-viewer>${data.html}</feezal-app-viewer>`, {
                tabWidth: 4,
                prettier: {
                    jsxBracketSameLine: true
                }
            })
        );
    });
}

module.exports = data => {
    return filterElements(data.elements).then(() => {
        return compose(data);
    }).then(() => {
        return bundle(data);
    });
};
