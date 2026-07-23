// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
/**
 * feezal-presence (N24) — viewer presence + per-client control topics.
 *
 * Every viewer gets a stable client ID (persisted per browser in
 * localStorage). Topics follow the direction of the site attributes: status
 * is state the viewer PUBLISHES (site publish topic), commands are what it
 * SUBSCRIBES (site subscribe topic):
 *
 *   <publish>/clients/<id>/status      retained status JSON, cleared on
 *                                      disconnect (broker LWT for direct-MQTT
 *                                      viewers; the server clears it for
 *                                      bridge-backend viewers)
 *   <subscribe>/clients/<id>/view      per-client commands mirroring the
 *   <subscribe>/clients/<id>/reload    site-wide control-topic set …
 *   <subscribe>/clients/<id>/theme
 *   <subscribe>/clients/<id>/playlist
 *   <subscribe>/clients/<id>/addclass
 *   <subscribe>/clients/<id>/removeclass
 *   <subscribe>/clients/<id>/rename    … plus rename (viewer adopts the new ID)
 *
 * Presence requires the site PUBLISH topic; without a subscribe topic the
 * viewer still announces itself but obeys no per-client commands
 * (monitoring-only).
 *
 * Status payload: {view, connectedSince, lastChange, connection, userAgent}.
 * The site-wide control topics keep controlling ALL instances — the
 * per-client subtree is additive.
 *
 * On by default; disable with presence="off" on <feezal-site> (Site
 * Settings → Viewer presence). Privacy: the status JSON (current view,
 * timestamps, user agent) sits retained on the broker while the viewer is
 * connected. See docs/presence.md.
 */

const ID_KEY = 'feezal-client-id';
const COMMANDS = ['view', 'reload', 'theme', 'playlist', 'addclass', 'removeclass'];
// Topic-safe client IDs — no MQTT separators/wildcards, no whitespace.
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

let _subs = [];
let _connectedSince = null;
let _collisionWarned = false;
let _started = false;
let _viewObserver = null;

function site() {
    return document.querySelector('feezal-site');
}

/** Presence is on by default; needs a site PUBLISH topic (status is
 * viewer-published state); viewer only. */
export function presenceEnabled() {
    const s = site();
    return Boolean(!window.feezal?.isEditor && s &&
        s.getAttribute('publish') && s.getAttribute('presence') !== 'off');
}

/** U48: the transient connection/rename toasts are on by default; a site may
 *  silence them with presence-toasts="off" (e.g. a wall panel). The sticky
 *  ID-collision warning is never gated — it flags a real misconfiguration.
 *  Presence itself keeps working regardless. */
export function presenceToastsEnabled() {
    const s = site();
    return !(s && s.getAttribute('presence-toasts') === 'off');
}

/** Stable per-browser client ID (viewer-x7k2 style), generated on first run. */
export function clientId() {
    try {
        let id = window.localStorage.getItem(ID_KEY);
        if (!id || !ID_RE.test(id)) {
            id = 'viewer-' + Math.random().toString(36).slice(2, 6);
            window.localStorage.setItem(ID_KEY, id);
        }

        return id;
    } catch {
        // Storage unavailable (private mode) — session-stable fallback.
        if (!window._feezalClientId) window._feezalClientId = 'viewer-' + Math.random().toString(36).slice(2, 6);
        return window._feezalClientId;
    }
}

/** Command subtree base (incoming) — null without a site subscribe topic. */
function commandBase(id = clientId()) {
    const sub = site().getAttribute('subscribe');
    return sub ? sub + '/clients/' + id : null;
}

/** Status topic (outgoing, retained) — under the site publish topic. */
export function statusTopic(id = clientId()) {
    return site().getAttribute('publish') + '/clients/' + id + '/status';
}

function statusPayload() {
    return JSON.stringify({
        view: site()?.getAttribute('view') || '',
        connectedSince: _connectedSince,
        lastChange: new Date().toISOString(),
        connection: window.feezal?.connection?.backend === 'mqtt' ? 'direct' : 'bridge',
        userAgent: navigator.userAgent,
    });
}

function publishStatus() {
    window.feezal.connection.pub(statusTopic(), statusPayload(), {retain: true});
}

// ── Toasts (plain DOM — the viewer bundle carries no UI library) ────────────

export function toast(text, {sticky = false} = {}) {
    // U48: transient (non-sticky) presence toasts can be silenced per site; the
    // sticky collision warning always shows.
    if (!sticky && !presenceToastsEnabled()) return;
    let stack = document.querySelector('#feezal-presence-toasts');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'feezal-presence-toasts';
        stack.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99990;display:flex;'
            + 'flex-direction:column;gap:8px;align-items:flex-end;font-family:Roboto,sans-serif;';
        document.body.append(stack);
    }

    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;'
        + 'background:rgba(30,30,30,0.92);color:#fff;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.35);'
        + 'max-width:80vw;';
    const span = document.createElement('span');
    span.textContent = text;
    const close = document.createElement('button');
    close.textContent = '✕';
    close.title = 'Dismiss';
    close.style.cssText = 'border:none;background:none;color:#fff;opacity:0.7;cursor:pointer;font-size:13px;padding:0;';
    close.addEventListener('click', () => el.remove());
    el.append(span, close);
    stack.append(el);
    if (!sticky) setTimeout(() => el.remove(), 8000);
    return el;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function subscribeClientTopics() {
    const s = site();

    // Collision detection: our own retained status replays here too — any
    // status whose connectedSince is NOT ours means another instance is (or
    // was, last-writer-wins) online under the same ID. Warn, but proceed.
    _subs.push(window.feezal.connection.sub(statusTopic(), msg => {
        const p = msg.payload;
        // Self-heal: an empty payload while we are online is a stale clear —
        // typically the broker firing the PREVIOUS connection's LWT after a
        // reconnect (session takeover / keepalive timeout), wiping the status
        // we just republished. Restore it. (Our own deliberate clears — rename,
        // teardown — unsubscribe this handler before their clear arrives.)
        if (p === '' || p === null || p === undefined) {
            publishStatus();
            return;
        }

        if (p && typeof p === 'object' && p.connectedSince && p.connectedSince !== _connectedSince && !_collisionWarned) {
            _collisionWarned = true;
            toast(`"${clientId()}" is already online in another browser — commands reach both`, {sticky: true});
        }
    }));

    // Command subtree lives under the site SUBSCRIBE topic — without one the
    // viewer is announce-only.
    const base = commandBase();
    if (!base) return;

    for (const cmd of COMMANDS) {
        _subs.push(window.feezal.connection.sub(base + '/' + cmd, msg => {
            s.applyControlCommand(cmd, msg.payload);
            // A view switch republishes the status via the attribute observer
            // (which sees the reflected value — reading it here would race).
        }));
    }

    _subs.push(window.feezal.connection.sub(base + '/rename', msg => {
        rename(String(msg.payload ?? '').trim());
    }));
}

function unsubscribeClientTopics() {
    for (const sub of _subs.splice(0)) {
        window.feezal.connection.unsubscribe(sub);
    }
}

/** Adopt a new client ID (editor-initiated rename): clear the old retained
 * status, persist, re-subscribe the command subtree, republish. */
export function rename(newId) {
    if (!newId || !ID_RE.test(newId) || newId === clientId()) return;

    // Clear the old retained status and drop the old subscriptions.
    window.feezal.connection.pub(statusTopic(), '', {retain: true});
    unsubscribeClientTopics();

    try {
        window.localStorage.setItem(ID_KEY, newId);
    } catch {
        window._feezalClientId = newId;
    }

    _collisionWarned = false;
    subscribeClientTopics();
    publishStatus();
    // Bridge viewers: move the server-side disconnect-clear to the new topic.
    window.feezal.connection.presence?.(statusTopic());
    toast(`This viewer is now "${newId}"`);
    // Note: a direct-MQTT viewer's broker LWT still points at the OLD status
    // topic for this session — firing it clears an already-empty topic, which
    // is harmless; the next page load registers the will under the new ID.
}

function start() {
    if (_started || !presenceEnabled()) return;
    _started = true;
    _connectedSince = new Date().toISOString();

    subscribeClientTopics();
    publishStatus();
    window.feezal.connection.presence?.(statusTopic());
    toast(`Connected as "${clientId()}"`);

    // Republish retained status on every view change (N24: status carries the
    // current view). The site reflects `view`, so an attribute observer
    // catches switches from ANY source (nav elements, swipe, hash, MQTT).
    _viewObserver = new MutationObserver(() => publishStatus());
    _viewObserver.observe(site(), {attributes: true, attributeFilter: ['view']});
}

/** The direct-MQTT connection asks for a will BEFORE connecting — the
 * retained-empty clear of our status topic (an explicitly configured LWT
 * wins, see feezal-connection-mqtt.js). */
export function presenceWill() {
    return presenceEnabled() ? {topic: statusTopic(), payload: '', retain: true} : null;
}

/** Test hook — tear down all module state so a fresh start() can run. */
export function _reset() {
    unsubscribeClientTopics();
    _viewObserver?.disconnect();
    _viewObserver = null;
    _started = false;
    _connectedSince = null;
    _collisionWarned = false;
}

if (typeof window !== 'undefined') {
    window.feezal = window.feezal || {};
    window.feezal.presenceWill = presenceWill;

    // Start once the connection is up (the wrapper re-dispatches a composed
    // `connected` that bubbles to the document). Re-connects republish the
    // status; the wrapper re-subscribes our topics automatically.
    document.addEventListener('connected', () => {
        if (!presenceEnabled()) return;
        if (_started) {
            publishStatus();
            window.feezal.connection.presence?.(statusTopic());
        } else {
            start();
        }
    });
}
