'use strict';

const fs = require('fs');
const os = require('os');
const Docker = require('dockerode');

/**
 * Shared Docker Engine access — A9 Tier 2b (server-side APK builds) and
 * A13 (self restart/update). Talks to the engine API via dockerode; never
 * uses bind mounts for data (see the roadmap: putArchive/getArchive keep
 * the design working when feezal itself runs in a container and starts
 * siblings through a mounted socket).
 *
 * Both features are opt-in (the socket is root-equivalent on the host):
 *   FEEZAL_DOCKER_BUILDS=1      server-side APK builds
 *   FEEZAL_DOCKER_SELFUPDATE=1  restart/update the feezal container
 *   FEEZAL_ALLOW_RESTART=1      bare-metal restart via process.exit(0)
 */

let _client = null;

/** Test hook — inject a mock engine client. */
function _setClient(client) {
    _client = client;
}

function getClient() {
    if (!_client) _client = new Docker();   // DOCKER_HOST / default socket
    return _client;
}

function socketCandidate() {
    if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
    const sock = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
    return fs.existsSync(sock) ? sock : null;
}

const flag = name => ['1', 'true', 'yes'].includes(String(process.env[name] || '').toLowerCase());

/** Is feezal itself running inside a container? */
function inContainer() {
    return fs.existsSync('/.dockerenv');
}

/**
 * Engine detection: reachable + architecture. Cached for a minute — the
 * capabilities endpoint is polled by the editor.
 */
let _detectCache = null;
async function detect() {
    if (_detectCache && Date.now() - _detectCache.ts < 60_000) return _detectCache.value;
    let value = {available: false, arch: null, serverVersion: null};
    if (socketCandidate()) {
        try {
            const info = await getClient().info();
            value = {available: true, arch: info.Architecture, serverVersion: info.ServerVersion};
        } catch { /* engine not reachable */ }
    }
    _detectCache = {ts: Date.now(), value};
    return value;
}

function _clearDetectCache() {
    _detectCache = null;
}

/** The capability set exposed to the editor. */
async function capabilities() {
    const engine = await detect();
    const x64 = engine.available && /^(x86_64|amd64)$/.test(String(engine.arch));
    return {
        dockerBuilds: Boolean(flag('FEEZAL_DOCKER_BUILDS') && x64),
        selfUpdate: Boolean(flag('FEEZAL_DOCKER_SELFUPDATE') && engine.available && inContainer()),
        restart: Boolean(
            (flag('FEEZAL_DOCKER_SELFUPDATE') && engine.available && inContainer()) ||
            flag('FEEZAL_ALLOW_RESTART')
        ),
        engine: engine.available ? {arch: engine.arch, version: engine.serverVersion} : null,
    };
}

/** Ensure a named volume exists (sibling-safe cache storage). */
async function ensureVolume(name) {
    try {
        await getClient().createVolume({Name: name});
    } catch (err) {
        if (err.statusCode !== 409) throw err;   // 409 = already exists
    }
}

/** Pull an image, reporting progress lines via onLine(text). */
function pullImage(image, onLine = () => {}) {
    return new Promise((resolve, reject) => {
        getClient().pull(image, (err, stream) => {
            if (err) return reject(err);
            const seen = new Set();
            getClient().modem.followProgress(stream,
                pullErr => pullErr ? reject(pullErr) : resolve(),
                event => {
                    const line = [event.status, event.id].filter(Boolean).join(' ');
                    // dedupe the very chatty layer progress
                    if (line && !seen.has(line)) { seen.add(line); onLine(line); }
                });
        });
    });
}

/**
 * The feezal container itself (A13). Default id source: hostname (docker
 * sets it to the container id prefix); override via FEEZAL_CONTAINER_NAME
 * for setups with custom hostnames.
 */
function selfContainerRef() {
    return process.env.FEEZAL_CONTAINER_NAME || os.hostname();
}

/** Restart feezal's own container via the engine. */
async function restartSelf() {
    await getClient().getContainer(selfContainerRef()).restart({t: 5});
}

const WATCHTOWER_IMAGE = 'containrrr/watchtower:1.7.1';

/**
 * A13 update: one-shot watchtower sibling — pulls feezal's new image,
 * recreates the container with identical config, then exits. A container
 * cannot replace itself; the sibling can.
 */
async function updateSelf(onLine = () => {}) {
    const target = selfContainerRef();
    // resolve to the container NAME — watchtower matches names, and the
    // hostname is only the id prefix
    const inspect = await getClient().getContainer(target).inspect();
    const name = inspect.Name.replace(/^\//, '');

    await pullImage(WATCHTOWER_IMAGE, onLine);
    const container = await getClient().createContainer({
        Image: WATCHTOWER_IMAGE,
        Cmd: ['--run-once', '--cleanup', name],
        HostConfig: {
            AutoRemove: true,
            // the socket path is resolved by the HOST daemon — valid even
            // when feezal itself runs in a container
            Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
        },
    });
    await container.start();
    onLine(`watchtower started (updating container "${name}") — feezal will restart shortly`);
    return name;
}

module.exports = {
    getClient,
    detect,
    capabilities,
    inContainer,
    ensureVolume,
    pullImage,
    selfContainerRef,
    restartSelf,
    updateSelf,
    WATCHTOWER_IMAGE,
    _setClient,
    _clearDetectCache,
};
