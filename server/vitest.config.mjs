import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.js'],
        coverage: {
            provider: 'v8',
            // lcov for the Codecov upload, text/html for humans
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.js'],
            exclude: ['src/build/elements.js'] // fetches network resources at startup
            // No coverage thresholds — CI never fails on coverage; the
            // reporters above still publish the numbers to Codecov / html.
        }
    }
});
