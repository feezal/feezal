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
            exclude: [
                'src/build/elements.js',   // fetches network resources at startup
                // Interface declaration, not behaviour: every method is an
                // `async x() { throw new Error('Not implemented') }` stub that
                // documents the contract for storage backends. The only test
                // it could carry is "the unimplemented methods throw", which
                // asserts the stub rather than anything real — so it is
                // excluded rather than padded with a meaningless suite.
                'src/storage/adapter.js'
            ]
            // No coverage thresholds — CI never fails on coverage; the
            // reporters above still publish the numbers to Codecov / html.
        }
    }
});
