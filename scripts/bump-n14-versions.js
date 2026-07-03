#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Fix input package.json
const inputPkg = path.join(__dirname, '..', 'www', 'packages', '@feezal', 'feezal-element-material-input', 'package.json');
if (fs.existsSync(inputPkg)) {
    const j = JSON.parse(fs.readFileSync(inputPkg, 'utf8'));
    j.name = '@feezal/feezal-element-material-input';
    j.version = '1.0.0';
    j.main = 'feezal-element-material-input.js';
    fs.writeFileSync(inputPkg, JSON.stringify(j, null, 2) + '\n');
    console.log('Updated input package.json');
}
