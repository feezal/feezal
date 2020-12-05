const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const blacklist = new Set([
    '@interactjs',
    '@polymer',
    '@webcomponents',
    'dragselect',
    'interactjs',
    'web-animations-js'
]);

let elements;

function findElements(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }

    const list = fs.readdirSync(dir);
    list.filter(p => !blacklist.has(p)).filter(p => p.startsWith('@')).forEach(p => {
        findElements(path.join(dir, p));
    });

    const elems = list.filter(p => !blacklist.has(p)).filter(p => {
        return p.startsWith('feezal-element-') || p.startsWith('feezal-theme-');
    }).map(p => {
        const absolute = path.join(dir, p);
        const relative = '.' + path.sep + path.relative(__dirname, absolute);
        const pkg = require(relative + path.sep + 'package.json');
        let type;
        if (p.startsWith('feezal-element-')) {
            type = 'element';
        } else if (p.startsWith('feezal-theme-')) {
            type = 'theme';
        }

        const main = pkg.main || 'index.js';
        const resolved = relative + path.sep + main;
        const bare = path.join(dir.split(path.sep).pop(), p);
        return {
            absolute,
            relative,
            resolved,
            bare,
            type
        };
    });

    elements.push(...elems);
}

function materialIcons() {
    fetch('https://raw.githubusercontent.com/google/material-design-icons/master/iconfont/codepoints')
        .then(res => res.text())
        .then(body => {
            fs.writeFileSync(path.join(__dirname, '..', 'www', 'src', 'material-design-icons.js'), 'export default ' + JSON.stringify(body.split('\n').map(line => line.split(' ')[0])));
        });
}

module.exports = logger => {
    materialIcons();
    elements = [];
    findElements(path.join(__dirname, '..', 'www', 'node_modules'));
    elements.map(element => element.bare).forEach(name => logger.info('found element ' + name));
    return fsPromises.writeFile(
        path.join(__dirname, '..', 'www', 'editor', 'feezal-elements.js'),
        elements.map(element => `import '${element.bare}';`).join('\n') + '\n\n' +
        'window.feezal.elements = ' + JSON.stringify(elements.filter(element => element.type === 'element').map(element => element.bare.replace(/^@[^/]+\//, '')), null, '  ') + ';\n\n' +
        'window.feezal.themes = ' + JSON.stringify(elements.filter(element => element.type === 'theme').map(element => element.bare.replace(/^@[^/]+\//, '')), null, '  ') + ';\n'

    );
};
