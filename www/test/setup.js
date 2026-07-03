import {beforeEach} from 'vitest';

// The www modules reference a bare `feezal` identifier that resolves to a
// window property at runtime. Give every test a fresh, minimal one so state
// can't leak between tests. Individual tests extend it as needed.
beforeEach(() => {
    globalThis.feezal = {
        isEditor: true,
        views: []
    };
    document.body.innerHTML = '';
    localStorage.clear();
});
