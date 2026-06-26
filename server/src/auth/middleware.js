'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');

const LOGIN_PATH = '/login';
const EDITOR_REDIRECT = '/editor/';

/**
 * Creates auth middleware and a login router.
 *
 * Supports two modes (can be combined):
 *  - Password mode: bcrypt-hashed password stored in config, session cookie.
 *  - Proxy header mode: trust a header set by an upstream reverse proxy
 *    (Authentik, nginx auth_request, Caddy forward_auth, etc.).
 *    When the header is present and non-empty, the request is considered
 *    authenticated regardless of the session cookie.
 *
 * If neither mode is configured, all requests are allowed through.
 *
 * @param {object} opts
 * @param {string|null}         opts.editorPassword   Plain-text password (hashed at startup).
 * @param {string|boolean|null} opts.trustProxyAuth   Header name to trust, or true for default 'x-auth-user'.
 * @returns {{ editorAuth: Function, loginRouter: express.Router, sessionSecret: string }}
 */
async function createAuthMiddleware({editorPassword, trustProxyAuth}) {
    const sessionSecret = crypto.randomBytes(32).toString('hex');

    // No protection configured — pass everything through
    if (!editorPassword && !trustProxyAuth) {
        return {
            editorAuth: (_req, _res, next) => next(),
            loginRouter: express.Router(),
            sessionSecret
        };
    }

    const proxyHeader = trustProxyAuth === true ? 'x-auth-user' : (trustProxyAuth || null);
    let hashedPassword = null;

    if (editorPassword) {
        hashedPassword = await bcrypt.hash(editorPassword, 10);
    }

    // --- Login router ---
    const loginRouter = express.Router();

    loginRouter.get('/', (_req, res) => {
        res.send(renderLoginPage());
    });

    loginRouter.post('/', express.urlencoded({extended: false}), async (req, res) => {
        if (!hashedPassword) {
            // Proxy-auth only mode, no password to check
            return res.redirect(EDITOR_REDIRECT);
        }

        const valid = await bcrypt.compare(req.body.password || '', hashedPassword);
        if (valid) {
            req.session.authenticated = true;
            return res.redirect(EDITOR_REDIRECT);
        }

        res.status(401).send(renderLoginPage('Invalid password.'));
    });

    loginRouter.get('/logout', (req, res) => {
        req.session.destroy(() => res.redirect(LOGIN_PATH));
    });

    // --- Editor auth guard ---
    function editorAuth(req, res, next) {
        // Proxy header takes precedence
        if (proxyHeader && req.headers[proxyHeader]) {
            return next();
        }

        // Session cookie
        if (req.session && req.session.authenticated) {
            return next();
        }

        // Not authenticated — API callers get 401, browsers get redirect
        if (req.accepts('html')) {
            return res.redirect(`${LOGIN_PATH}?next=${encodeURIComponent(req.originalUrl)}`);
        }

        res.status(401).json({error: 'Unauthorized'});
    }

    return {editorAuth, loginRouter, sessionSecret};
}

function renderLoginPage(errorMessage) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Feezal — Login</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    form { background: white; padding: 2rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.15); min-width: 280px; }
    h2 { margin: 0 0 1.5rem; font-size: 1.2rem; }
    input { width: 100%; box-sizing: border-box; padding: .5rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 3px; font-size: 1rem; }
    button { width: 100%; padding: .6rem; background: #1565c0; color: white; border: none; border-radius: 3px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #0d47a1; }
    .error { color: #c62828; margin-bottom: 1rem; font-size: .9rem; }
  </style>
</head>
<body>
  <form method="POST">
    <h2>Feezal Editor</h2>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}
    <input type="password" name="password" placeholder="Password" autofocus required>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

module.exports = createAuthMiddleware;
