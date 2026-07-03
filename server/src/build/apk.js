'use strict';

const crypto = require('crypto');
const {EventEmitter} = require('events');
const {Writable, PassThrough} = require('stream');
const {TarArchive} = require('archiver');
const tarStream = require('tar-stream');

const docker = require('../docker.js');
const {buildProjectFiles, projectDirName} = require('./capacitor.js');

/**
 * A9 Tier 2b — server-side debug-APK build in a Docker container.
 *
 * Job model (a 15-minute HTTP request dies at every proxy): startBuild()
 * returns a job whose log streams over SSE; the APK is fetched separately
 * when the job succeeds. One build at a time.
 *
 * No bind mounts: the Capacitor project goes INTO the container via
 * putArchive and the APK comes OUT via getArchive, so the same code works
 * whether feezal runs bare-metal or as a container starting siblings
 * through a mounted socket. Only the Gradle/npm caches are named volumes
 * (sibling-safe: referenced by name, not path).
 */

// 1.29.0 is the first tag with JDK 21 (default) — Capacitor 7 requires it
const BUILD_IMAGE = () => process.env.FEEZAL_ANDROID_BUILD_IMAGE || 'mingc/android-build-box:1.29.0';
const GRADLE_VOLUME = 'feezal-gradle-cache';
const NPM_VOLUME = 'feezal-npm-cache';
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const APK_PATH = '/project/android/app/build/outputs/apk/debug/app-debug.apk';

const BUILD_SCRIPT = [
    'set -e',
    'cd /project',
    'echo "── npm install ──"',
    // --include=dev: the build image sets NODE_ENV=production, which would
    // silently skip devDependencies — and @capacitor/cli lives there
    'npm install --no-audit --no-fund --include=dev',
    'echo "── capacitor ──"',
    'npx cap add android',
    'npx cap sync android',
    // best-effort: bake the site icon into the APK; default icon otherwise
    '(npx capacitor-assets generate --android || echo "icon generation failed — using default icon")',
    'echo "── gradle ──"',
    'cd android',
    './gradlew assembleDebug --no-daemon',
    'echo "── build finished ──"',
].join(' && ');

let currentJob = null;

function getJob(id) {
    return (currentJob && currentJob.id === id) ? currentJob : null;
}

function isBusy() {
    return Boolean(currentJob && currentJob.status === 'running');
}

/** Tar the project entries under project/ for putArchive. */
function projectTar(entries) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const sink = new Writable({
            write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
        });
        const archive = new TarArchive();
        archive.on('error', reject);
        sink.on('finish', () => resolve(Buffer.concat(chunks)));
        archive.pipe(sink);
        for (const entry of entries) {
            if (entry.abs) archive.file(entry.abs, {name: 'project/' + entry.name});
            else archive.append(entry.content, {name: 'project/' + entry.name});
        }
        archive.finalize();
    });
}

/** Extract a single file from a getArchive tar stream. */
function extractFile(stream, wanted) {
    return new Promise((resolve, reject) => {
        const extract = tarStream.extract();
        let found = null;
        extract.on('entry', (header, content, next) => {
            const chunks = [];
            content.on('data', c => chunks.push(c));
            content.on('end', () => {
                if (header.type === 'file' && header.name.endsWith(wanted)) {
                    found = Buffer.concat(chunks);
                }
                next();
            });
            content.on('error', reject);
        });
        extract.on('finish', () => found ? resolve(found) : reject(new Error(wanted + ' not found in archive')));
        extract.on('error', reject);
        stream.pipe(extract);
    });
}

/**
 * Start a build job. Returns the job object (id, status, emitter).
 * @param {object} o {wwwDir, siteName, site, options: {appName, appId}, logger, storage}
 */
async function startBuild({wwwDir, siteName, site, options = {}, logger = console, storage = null}) {
    if (isBusy()) throw Object.assign(new Error('a build is already running'), {code: 'BUSY'});

    const job = {
        id: crypto.randomUUID(),
        site: siteName,
        status: 'running',
        log: [],
        apk: null,
        fileName: null,
        error: null,
        container: null,
        emitter: new EventEmitter(),
    };
    job.emitter.setMaxListeners(50);
    currentJob = job;

    const emit = line => {
        job.log.push(line);
        job.emitter.emit('log', line);
    };
    const finish = (status, error = null) => {
        if (job.status !== 'running') return;
        job.status = status;
        job.error = error;
        job.emitter.emit('done', {status, error});
    };

    // async build pipeline — errors land in the job, not the caller
    (async () => {
        const client = docker.getClient();
        emit(`build image: ${BUILD_IMAGE()}`);

        const {appName, entries} = await buildProjectFiles(wwwDir, siteName, site, options, logger, storage);
        job.fileName = projectDirName(appName) + '-debug.apk';
        emit(`project "${appName}" assembled (${entries.length} files)`);

        await docker.ensureVolume(GRADLE_VOLUME);
        await docker.ensureVolume(NPM_VOLUME);
        emit('pulling build image (first run downloads several GB)…');
        await docker.pullImage(BUILD_IMAGE(), emit);

        const container = await client.createContainer({
            Image: BUILD_IMAGE(),
            Cmd: ['bash', '-lc', BUILD_SCRIPT],
            WorkingDir: '/project',
            HostConfig: {
                Binds: [
                    `${GRADLE_VOLUME}:/root/.gradle`,
                    `${NPM_VOLUME}:/root/.npm`,
                ],
            },
        });
        job.container = container;

        const tar = await projectTar(entries);
        await container.putArchive(tar, {path: '/'});
        emit('project uploaded — starting build');

        const logs = await container.attach({stream: true, stdout: true, stderr: true});
        const lines = new PassThrough();
        container.modem.demuxStream(logs, lines, lines);
        let partial = '';
        lines.on('data', chunk => {
            partial += chunk.toString();
            const parts = partial.split('\n');
            partial = parts.pop();
            for (const line of parts) if (line.trim()) emit(line);
        });

        await container.start();
        const timeout = setTimeout(() => {
            emit(`build timed out after ${BUILD_TIMEOUT_MS / 60000} minutes — killing container`);
            container.kill().catch(() => {});
        }, BUILD_TIMEOUT_MS);

        const result = await container.wait();
        clearTimeout(timeout);

        if (job.status === 'cancelled') {
            await container.remove({force: true}).catch(() => {});
            return;
        }
        if (result.StatusCode !== 0) {
            await container.remove({force: true}).catch(() => {});
            finish('error', `build failed (exit code ${result.StatusCode}) — see log`);
            return;
        }

        emit('extracting APK…');
        const archive = await container.getArchive({path: APK_PATH});
        job.apk = await extractFile(archive, 'app-debug.apk');
        await container.remove({force: true}).catch(() => {});
        emit(`done — ${Math.round(job.apk.length / 1024 / 1024 * 10) / 10} MB`);
        finish('success');
    })().catch(async err => {
        if (job.container) await job.container.remove({force: true}).catch(() => {});
        finish('error', err.message);
    });

    return job;
}

/** Cancel the running job (kills the container). */
async function cancel(id) {
    const job = getJob(id);
    if (!job || job.status !== 'running') return false;
    job.status = 'cancelled';
    job.emitter.emit('done', {status: 'cancelled', error: null});
    if (job.container) await job.container.kill().catch(() => {});
    return true;
}

/** Test hook. */
function _reset() {
    currentJob = null;
}

module.exports = {startBuild, getJob, isBusy, cancel, BUILD_IMAGE, GRADLE_VOLUME, NPM_VOLUME, _reset};
