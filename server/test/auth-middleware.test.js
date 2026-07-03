/**
 * Integration tests for auth/middleware.js: no-auth passthrough, password mode
 * (login page, wrong/right password, session-guarded routes) and reverse-proxy
 * header trust. Uses supertest with a real express-session in memory.
 */
import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';
import request from 'supertest';

const require = createRequire(import.meta.url);
const createAuthMiddleware = require('../src/auth/middleware.js');
const express = require('express');
const session = require('express-session');

async function buildApp(opts) {
    const {editorAuth, loginRouter, sessionSecret} = await createAuthMiddleware(opts);
    const app = express();
    app.use(session({secret: sessionSecret, resave: false, saveUninitialized: false}));
    app.use('/login', loginRouter);
    app.get('/guard', editorAuth, (_req, res) => res.send('secret area'));
    return app;
}

describe('no protection configured', () => {
    it('lets every request through', async () => {
        const app = await buildApp({editorPassword: null, trustProxyAuth: null});
        const res = await request(app).get('/guard');
        expect(res.status).toBe(200);
        expect(res.text).toBe('secret area');
    });
});

describe('password mode', () => {
    it('serves a login page', async () => {
        const app = await buildApp({editorPassword: 'hunter2'});
        const res = await request(app).get('/login');
        expect(res.status).toBe(200);
        expect(res.text).toContain('Feezal Editor');
        expect(res.text).toContain('type="password"');
    });

    it('rejects a wrong password with 401', async () => {
        const app = await buildApp({editorPassword: 'hunter2'});
        const res = await request(app).post('/login').type('form').send({password: 'nope'});
        expect(res.status).toBe(401);
        expect(res.text).toContain('Invalid password.');
    });

    it('accepts the right password and then permits the guarded route', async () => {
        const app = await buildApp({editorPassword: 'hunter2'});
        const agent = request.agent(app);

        const login = await agent.post('/login').type('form').send({password: 'hunter2'});
        expect(login.status).toBe(302);
        expect(login.headers.location).toBe('/editor/');

        const guarded = await agent.get('/guard');
        expect(guarded.status).toBe(200);
        expect(guarded.text).toBe('secret area');
    });

    it('unauthenticated API callers get 401 JSON', async () => {
        const app = await buildApp({editorPassword: 'hunter2'});
        const res = await request(app).get('/guard').set('Accept', 'application/json');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('unauthenticated browsers are redirected to the login page', async () => {
        const app = await buildApp({editorPassword: 'hunter2'});
        const res = await request(app).get('/guard').set('Accept', 'text/html');
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(/^\/login\?next=/);
    });
});

describe('reverse-proxy header mode', () => {
    it('trusts the default x-auth-user header when present', async () => {
        const app = await buildApp({trustProxyAuth: true});
        const ok = await request(app).get('/guard').set('x-auth-user', 'alice');
        expect(ok.status).toBe(200);

        const denied = await request(app).get('/guard').set('Accept', 'application/json');
        expect(denied.status).toBe(401);
    });

    it('trusts a custom header name', async () => {
        const app = await buildApp({trustProxyAuth: 'x-forwarded-user'});
        const ok = await request(app).get('/guard').set('x-forwarded-user', 'bob');
        expect(ok.status).toBe(200);
    });
});
