import {defineConfig} from 'vitest/config';

// System / E2E tests (A17 phase 4) — the whole stack, for real: the feezal
// server as a child process, an in-memory aedes MQTT broker, and headless
// Chromium (playwright-core) driving the actual editor and viewer pages.
// Run with `npm run test:e2e`.  Requires a built `dist/` (npm run build) and
// the Playwright chromium binary (`npx playwright install chromium`); on WSL
// also libnss3/libnspr4 — see vitest.browser.config.mjs.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['test-e2e/**/*.test.js'],
        fileParallelism: false,
        testTimeout: 120_000,
        hookTimeout: 180_000
    }
});
