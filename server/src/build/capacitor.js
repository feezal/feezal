'use strict';

const path = require('path');
const fs = require('fs');
const {Writable} = require('stream');
const {ZipArchive} = require('archiver');

const {buildExportBundle} = require('./export.js');

/**
 * A9 Tier 2a — Capacitor project export.
 *
 * Exports a platform-agnostic Capacitor project scaffold with the site's
 * A16 web bundle under www/. The user builds on their own machine (three
 * commands); the server never runs Capacitor CLI, Gradle or Xcode.
 */

const CAPACITOR_VERSION = '^7.0.0';
const ASSETS_VERSION = '^3.0.5';

/**
 * Derive a valid Android applicationId / iOS bundle id from the site name:
 * io.feezal.<slug>. Segments must start with a letter and contain only
 * [a-z0-9_] — umlauts are transliterated, everything else is dropped.
 */
function deriveAppId(siteName) {
    let slug = String(siteName).toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '');
    if (!slug) slug = 'app';
    if (/^[0-9]/.test(slug)) slug = 'app' + slug;
    return 'io.feezal.' + slug;
}

/** Safe folder name for the project root inside the ZIP. */
function projectDirName(appName) {
    const dir = String(appName).toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '');
    return dir || 'feezal-app';
}

/** True when a broker URI points at the exporting machine itself. */
function isLocalhostUri(uri) {
    return /^[a-z+]+:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(String(uri || ''));
}

function buildPackageJson({appName}) {
    return JSON.stringify({
        name: projectDirName(appName),
        private: true,
        description: `${appName} — feezal dashboard as a mobile app`,
        scripts: {
            // first run adds the platform, later runs just sync + open
            android: 'node scripts/platform.mjs android',
            ios: 'node scripts/platform.mjs ios',
            assets: 'capacitor-assets generate',
            sync: 'cap sync',
        },
        dependencies: {
            '@capacitor/core': CAPACITOR_VERSION,
        },
        devDependencies: {
            '@capacitor/cli': CAPACITOR_VERSION,
            '@capacitor/android': CAPACITOR_VERSION,
            '@capacitor/ios': CAPACITOR_VERSION,
            '@capacitor/assets': ASSETS_VERSION,
        },
    }, null, 2) + '\n';
}

function buildCapacitorConfig({appId, appName}) {
    return JSON.stringify({
        appId,
        appName,
        webDir: 'www',
        // ws:// brokers are cleartext — without this Android blocks them
        server: {cleartext: true},
    }, null, 2) + '\n';
}

/** Tiny helper so `npm run android` works on the first and every later run. */
function buildPlatformScript() {
    return `// adds the platform on first use, then syncs and opens the IDE
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) {
    console.error('usage: node scripts/platform.mjs <android|ios>');
    process.exit(1);
}
const run = cmd => execSync(cmd, {stdio: 'inherit'});
if (!existsSync(platform)) run('npx cap add ' + platform);
run('npx cap sync ' + platform);
run('npx cap open ' + platform);
`;
}

function buildReadme({appName, appId, connectionUri, hasIcon}) {
    const localhost = isLocalhostUri(connectionUri);
    return `# ${appName} — as an Android / iOS app

This folder is a ready-to-build [Capacitor](https://capacitorjs.com/) project
with your feezal dashboard embedded (\`www/\`). You build the app on your own
computer — nothing is submitted to an app store.

App id: \`${appId}\` · Capacitor ${CAPACITOR_VERSION} (pinned in package.json —
update it independently of feezal whenever you like).

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- **Android:** [Android Studio](https://developer.android.com/studio) (brings the SDK + JDK)
- **iOS:** a Mac with [Xcode](https://developer.apple.com/xcode/) 15 or newer

## Build & install — Android

1. \`npm install\`
2. ${hasIcon ? '`npm run assets` — generates all native icons and splash screens from `resources/icon.png`'
        : '*(optional)* put a 1024×1024 `resources/icon.png` here and run `npm run assets` for native icons/splash screens'}
3. \`npm run android\` — adds the platform on first run and opens Android Studio
4. On your phone: enable **Developer options** (tap *Build number* 7×) and **USB debugging**
5. Connect the phone via USB and press **Run ▶** in Android Studio — the app installs directly.
   (Alternative without the IDE: \`cd android && ./gradlew assembleDebug\`, then
   \`adb install app/build/outputs/apk/debug/app-debug.apk\`.)

The install is permanent. No Google account, no Play Store, no fees.

## Build & install — iOS

1. \`npm install\`${hasIcon ? '\n2. `npm run assets`' : ''}
${hasIcon ? '3' : '2'}. \`npm run ios\` — adds the platform on first run and opens Xcode
${hasIcon ? '4' : '3'}. In Xcode: *Signing & Capabilities* → sign in with your (free) Apple ID and pick your personal team
${hasIcon ? '5' : '4'}. Connect your iPhone, select it as the target and press **Run ▶**; on the phone, trust the developer under *Settings → General → VPN & Device Management*

> **Honest note on the free Apple ID:** apps signed with a free account stop
> launching after **7 days** — reconnect and press Run again to re-sign. A paid
> Apple Developer Program membership ($99/year) extends this to a year and
> allows distribution to other devices.

## MQTT connection

The app talks to your broker over the network${connectionUri ? ` — currently configured as:

    ${connectionUri}
` : '.'}
${localhost ? `
> ⚠️ **This points at \`localhost\` — from your phone that is the phone itself,
> not your broker.** Change the broker address in feezal's Site Settings to a
> host reachable from your phone (e.g. the LAN IP of your broker) and
> re-export before building.
` : ''}
## Troubleshooting

- **Blank screen / no live values:** the phone cannot reach the broker —
  check the address above and your firewall. \`ws://\` (unencrypted) traffic is
  already allowed by this project's configuration.
- **Dashboard changed in feezal?** Re-export this project (or replace just the
  \`www/\` folder) and run \`npm run sync\`.
`;
}

/**
 * Assemble the Capacitor project as a flat entry list (no root prefix) —
 * shared by the ZIP export (Tier 2a) and the server-side APK build's tar
 * upload (Tier 2b).
 *
 * @returns {Promise<{appName: string, appId: string,
 *          entries: Array<{name: string, content?: string, abs?: string}>}>}
 */
async function buildProjectFiles(wwwDir, siteName, site, options = {}, logger = console, storage = null) {
    const stored = (site.config && site.config.viewer && site.config.viewer.app) || {};
    const appName = options.appName || stored.name || siteName;
    const appId = options.appId || stored.id || deriveAppId(siteName);
    const connectionUri = site.config && site.config.connection && site.config.connection.uri;

    // The WebView app needs no service worker / manifest — build the web
    // bundle with the PWA flag stripped.
    const config = {
        ...site.config,
        viewer: {...((site.config && site.config.viewer) || {}), pwa: false},
    };
    const bundle = await buildExportBundle(wwwDir, siteName, {html: site.html, config}, logger, storage);

    // App icon source for @capacitor/assets: the site's generated PWA icon,
    // falling back to the default feezal 512px icon.
    let iconFile = null;
    const candidates = [];
    if (storage && storage.dataDir) {
        candidates.push(path.join(storage.dataDir, 'sites', siteName, 'pwa', 'icon-512.png'));
    }
    candidates.push(path.join(wwwDir, 'favicon', 'web-app-manifest-512x512.png'));
    candidates.push(path.join(wwwDir, 'dist', 'favicon', 'web-app-manifest-512x512.png'));
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) { iconFile = candidate; break; }
    }

    const entries = [
        {name: 'package.json', content: buildPackageJson({appName})},
        {name: 'capacitor.config.json', content: buildCapacitorConfig({appId, appName})},
        {name: 'scripts/platform.mjs', content: buildPlatformScript()},
        {name: 'README.md', content: buildReadme({appName, appId, connectionUri, hasIcon: Boolean(iconFile)})},
    ];
    if (iconFile) entries.push({name: 'resources/icon.png', abs: iconFile});
    entries.push({name: 'www/index.html', content: bundle.indexHtml});
    for (const entry of bundle.entries) {
        entries.push({name: 'www/' + entry.zip, content: entry.content, abs: entry.abs});
    }
    return {appName, appId, entries};
}

/**
 * Assemble the Capacitor project ZIP for a site (Tier 2a download).
 * @returns {Promise<Buffer>}
 */
async function createCapacitorExport(wwwDir, siteName, site, options = {}, logger = console, storage = null) {
    const {appName, entries} = await buildProjectFiles(wwwDir, siteName, site, options, logger, storage);
    const root = projectDirName(appName) + '/';
    return new Promise((resolve, reject) => {
        const chunks = [];
        const sink = new Writable({
            write(chunk, _enc, cb) { chunks.push(chunk); cb(); }
        });
        const archive = new ZipArchive({zlib: {level: 6}});
        archive.on('error', reject);
        sink.on('finish', () => resolve(Buffer.concat(chunks)));
        archive.pipe(sink);

        for (const entry of entries) {
            if (entry.abs) archive.file(entry.abs, {name: root + entry.name});
            else archive.append(entry.content, {name: root + entry.name});
        }
        archive.finalize();
    });
}

module.exports = {
    createCapacitorExport,
    buildProjectFiles,
    deriveAppId,
    projectDirName,
    isLocalhostUri,
    buildPackageJson,
    buildCapacitorConfig,
    buildReadme,
};
