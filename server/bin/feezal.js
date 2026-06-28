#!/usr/bin/env node
'use strict';

const path = require('path');
const os = require('os');

const {program} = require('commander');

const createApp = require('../src/app.js');
const FilesystemStorage = require('../src/storage/filesystem.js');

program
    .name('feezal')
    .description('Feezal — Web Components dashboard editor and server')
    .option('-p, --port <port>', 'port to listen on', process.env.FEEZAL_PORT || '3000')
    .option('-d, --data <path>', 'data directory for site storage', process.env.FEEZAL_DATA || path.join(os.homedir(), '.feezal'))
    .option('--www-dir <path>', 'path to built Vite output; defaults to dist/ inside the package')
    .option('--editor-password <password>', 'password to protect the editor (plain text, hashed at startup)', process.env.FEEZAL_EDITOR_PASSWORD)
    .option('--trust-proxy-auth [header]', 'trust proxy authentication header (default: x-auth-user)', process.env.FEEZAL_TRUST_PROXY_AUTH)
    .option('--private-viewer', 'require authentication for the viewer as well', false)
    .parse(process.argv);

const opts = program.opts();

const port = parseInt(opts.port, 10);
const dataDir = path.resolve(opts.data);
// Default wwwDir: dist/ next to bin/ — correct after `npm install -g feezal`.
// In the monorepo, pass --www-dir ./www (dev server) or --www-dir ./www/dist (after build).
const wwwDir = opts.wwwDir
    ? path.resolve(opts.wwwDir)
    : path.resolve(path.join(__dirname, '..', 'dist'));

// Normalise --trust-proxy-auth:
//   --trust-proxy-auth           → true  (use default header 'x-auth-user')
//   --trust-proxy-auth X-My-Hdr  → 'X-My-Hdr'
//   (not supplied)               → false
let trustProxyAuth = false;
if (opts.trustProxyAuth !== undefined) {
    trustProxyAuth = opts.trustProxyAuth === true ? true : opts.trustProxyAuth;
}

const logger = {
    debug: msg => console.debug('[feezal]', msg),
    info: msg => console.info('[feezal]', msg),
    warn: msg => console.warn('[feezal]', msg),
    error: msg => console.error('[feezal]', msg)
};

async function main() {
    const storage = new FilesystemStorage(dataDir);

    const {server} = await createApp({
        wwwDir,
        storage,
        editorPassword: opts.editorPassword || null,
        trustProxyAuth,
        publicViewer: !opts.privateViewer,
        logger
    });

    server.listen(port, () => {
        logger.info(`listening on http://localhost:${port}`);
        logger.info(`editor:  http://localhost:${port}/feezal/editor/`);
        logger.info(`data:    ${dataDir}`);
    });

    server.on('error', err => {
        logger.error('server error: ' + err.message);
        process.exit(1);
    });
}

main().catch(err => {
    console.error('fatal:', err.message);
    process.exit(1);
});
