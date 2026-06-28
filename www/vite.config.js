import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Plugin: inject /editor/feezal-elements.js as a runtime script (not bundled).
// The editor loads element packages at runtime from the Express dynamic route.
// viewer-main.js still imports feezal-elements.js directly for the self-contained viewer bundle.
const feezalElementsRuntimePlugin = {
    name: 'feezal-elements-runtime',
    transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
            const isEditor = (ctx.path || '').includes('/editor/') ||
                             (ctx.filename || '').includes(`${path.sep}editor${path.sep}`);
            if (!isEditor) {
                return html;
            }

            // Inject the runtime element loader before </head>.
            // enforce:'post' ensures this runs after Vite's bundling — the tag is written
            // verbatim to the final HTML and is NOT processed by Rollup.
            return html.replace(
                '</head>',
                '    <script type="module" src="/editor/feezal-elements.js"></script>\n</head>'
            );
        }
    }
};

// Plugin: write dist/feezal-builtin-elements.json after the build.
// The server reads this in production to know which elements are already bundled
// in the editor chunk (so their names appear in window.feezal.elements).
const feezalBuiltinManifestPlugin = {
    name: 'feezal-builtin-manifest',
    closeBundle() {
        const srcDir = path.resolve('src');
        const distDir = path.resolve('dist');
        if (!fs.existsSync(srcDir) || !fs.existsSync(distDir)) {
            return;
        }

        const builtins = fs.readdirSync(srcDir)
            .filter(f => f.startsWith('feezal-element-') && f.endsWith('.js'))
            .map(f => f.replace(/\.js$/, ''));
        fs.writeFileSync(
            path.join(distDir, 'feezal-builtin-elements.json'),
            JSON.stringify(builtins)
        );
    }
};

export default defineConfig({
    // www/ is the Vite root
    base: '/',

    plugins: [feezalElementsRuntimePlugin, feezalBuiltinManifestPlugin],

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                editor: 'editor/index.html',
                // Viewer bundle: contains viewer app + mqtt.js + all element packages
                // (feezal-elements.js is imported by viewer-main.js)
                'viewer-bundle': 'src/viewer-main.js'
            },
            output: {
                // viewer-bundle goes to a predictable path
                entryFileNames: chunk => {
                    if (chunk.name === 'viewer-bundle') return 'viewer-bundle.js';
                    return 'assets/[name]-[hash].js';
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]'
            }
        }
    },

    // Dev server: proxy API and socket requests to the feezal server
    server: {
        port: 5173,
        proxy: {
            '/api': {target: 'http://localhost:3000', changeOrigin: true},
            '/socket.io': {target: 'ws://localhost:3000', ws: true, changeOrigin: true},
            // feezal-elements.js is served by the feezal server (generated at startup)
            '/editor/feezal-elements.js': {target: 'http://localhost:3000', changeOrigin: true}
        }
    },

    // Prevent Vite from pre-bundling Polymer/feezal element packages
    // (they're ESM and have complex module graphs; let Rollup handle them at build time)
    optimizeDeps: {
        exclude: [
            '@feezal/feezal-element-basic-chart',
            '@feezal/feezal-element-basic-datetime',
            '@feezal/feezal-element-basic-iframe',
            '@feezal/feezal-element-basic-image',
            '@feezal/feezal-element-basic-navigation',
            '@feezal/feezal-element-basic-number',
            '@feezal/feezal-element-basic-template',
            '@feezal/feezal-element-basic-view',
            '@feezal/feezal-element-material-button',
            '@feezal/feezal-element-material-gauge',
            '@feezal/feezal-element-material-light',
            '@feezal/feezal-element-material-slider',
            '@feezal/feezal-element-material-switch',
            '@feezal/feezal-element-material-value',
            '@feezal/feezal-element-paper-app-layout',
            '@feezal/feezal-element-paper-badge',
            '@feezal/feezal-element-paper-button',
            '@feezal/feezal-element-paper-card-template',
            '@feezal/feezal-element-paper-checkbox',
            '@feezal/feezal-element-paper-dialog',
            '@feezal/feezal-element-paper-dropdown',
            '@feezal/feezal-element-paper-listbox',
            '@feezal/feezal-element-paper-slider',
            '@feezal/feezal-element-paper-switch',
            '@feezal/feezal-element-paper-tabs',
            '@feezal/feezal-theme-blue-night',
            '@feezal/feezal-theme-dark-mint',
            '@feezal/feezal-theme-dark-orange',
            '@feezal/feezal-theme-gruvbox-dark',
            '@feezal/feezal-theme-gruvbox-light',
            '@feezal/feezal-theme-light-orange',
            '@feezal/feezal-theme-midnight-blue',
            '@feezal/feezal-theme-solarized-dark',
            '@feezal/feezal-theme-solarized-light'
        ]
    }
});
