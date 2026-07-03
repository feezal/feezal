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
            exclude: ['src/build/elements.js'], // fetches network resources at startup
            // A17 ratchet: floors sit just below current coverage (69/59/68/72
            // at introduction). Raise them as coverage grows — never lower.
            thresholds: {
                statements: 65,
                branches: 55,
                functions: 63,
                lines: 68
            }
        }
    }
});
