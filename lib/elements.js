const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const blacklist = [
    '@interactjs',
    '@polymer',
    '@webcomponents',
    'dragselect',
    'interactjs',
    'web-animations-js'
];

let elements;

function findElements(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }

    console.log('findElements', dir);
    const list = fs.readdirSync(dir);
    list.filter(p => !blacklist.includes(p)).filter(p => p.startsWith('@')).forEach(p => {
        findElements(path.join(dir, p));
    });

    const elems = list.filter(p => !blacklist.includes(p)).filter(p => p.startsWith('feezal-element-')).map(p => {
        const absolute = path.join(dir, p);
        const relative = '.' + path.sep + path.relative(__dirname, absolute);
        const main = require(relative + path.sep + 'package.json').main || 'index.js';
        const resolved = relative + path.sep + main;
        const bare = path.join(dir.split(path.sep).pop(), p);
        return {
            absolute,
            relative,
            resolved,
            bare
        };
    });

    console.log(elems);
    elements.push(...elems);
}

function materialIcons() {
    fetch('https://raw.githubusercontent.com/google/material-design-icons/master/iconfont/codepoints')
        .then(res => res.text())
        .then(body => {
            fs.writeFileSync(path.join(__dirname, '..', 'www', 'src', 'material-design-icons.js'), 'export default ' + JSON.stringify(body.split('\n').map(line => line.split(' ')[0])));
        });
}

module.exports = () => {
    materialIcons();
    elements = [];
    findElements(path.join(__dirname, '..', 'www', 'node_modules'));
    console.log(elements);
    return fsPromises.writeFile(
        path.join(__dirname, '..', 'www', 'editor', 'feezal-elements.js'),
        elements.map(el => `import '${el.bare}';`).join('\n') + '\n\n' +
        'window.feezal.elements = ' + JSON.stringify(elements.map(el => el.bare.replace(/^@[^/]+\//, '')), null, '  ') + ';\n'
    );
};
