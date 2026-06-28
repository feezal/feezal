#!/usr/bin/env node
/**
 * Generates www/editor/feezal-elements.js by scanning www/node_modules/@feezal/.
 *
 * Run this script BEFORE `cd www && npm run build` because viewer-main.js imports
 * feezal-elements.js at Vite build time to bundle all elements into viewer-bundle.js.
 *
 * Usage (from repo root):
 *   node scripts/generate-elements.js
 */
'use strict';

const path = require('path');
const {writeElementsFile} = require('../server/src/build/elements.js');

const wwwDir = path.resolve(__dirname, '..', 'www');

writeElementsFile(wwwDir, console).then(() => {
    console.info('[generate-elements] wrote www/editor/feezal-elements.js');
}).catch(err => {
    console.error('[generate-elements] failed:', err);
    process.exit(1);
});
