import {describe, it, expect, vi} from 'vitest';

import '../src/feezal-sidebar-viewer.js';

function makeSidebar(connection = {}) {
    const el = document.createElement('feezal-sidebar-viewer');
    el.connection = connection;
    return el;
}

describe('_parseUri() — broker URI to structured fields', () => {
    it('parses protocol, host, port and credentials', () => {
        const el = makeSidebar();
        el._parseUri('mqtts://alice:secret@broker.example:8883');
        expect(el.connection).toMatchObject({
            uri: 'mqtts://alice:secret@broker.example:8883',
            _protocol: 'mqtts',
            _host: 'broker.example',
            _port: '8883',
            _username: 'alice',
            _password: 'secret'
        });
    });

    it('leaves optional parts empty', () => {
        const el = makeSidebar();
        el._parseUri('ws://broker.example');
        expect(el.connection).toMatchObject({
            _protocol: 'ws', _host: 'broker.example', _port: '', _username: '', _password: ''
        });
    });

    it('keeps the raw uri and clears structured fields for invalid input', () => {
        const el = makeSidebar();
        el._parseUri('not a uri');
        expect(el.connection).toMatchObject({
            uri: 'not a uri', _host: '', _port: '', _protocol: 'mqtt', _username: '', _password: ''
        });
    });

    it('does nothing for an empty uri', () => {
        const el = makeSidebar({uri: 'keep'});
        el._parseUri('');
        expect(el.connection).toEqual({uri: 'keep'});
    });
});

describe('_buildUri() — structured fields to broker URI', () => {
    it('assembles a full uri with encoded credentials', () => {
        const el = makeSidebar({
            _protocol: 'wss', _host: 'broker.example', _port: '8884',
            _username: 'user@corp', _password: 'p:ss'
        });
        el._buildUri();
        expect(el.connection.uri).toBe('wss://user%40corp:p%3Ass@broker.example:8884');
    });

    it('defaults protocol and host and omits empty parts', () => {
        const el = makeSidebar({});
        el._buildUri();
        expect(el.connection.uri).toBe('mqtt://localhost');
    });

    it('omits the password separator when only a username is set', () => {
        const el = makeSidebar({_protocol: 'mqtt', _host: 'h', _username: 'u'});
        el._buildUri();
        expect(el.connection.uri).toBe('mqtt://u@h');
    });

    it('round-trips through _parseUri', () => {
        const el = makeSidebar({
            _protocol: 'mqtts', _host: 'broker', _port: '8883',
            _username: 'alice', _password: 'secret'
        });
        el._buildUri();
        el._parseUri(el.connection.uri);
        expect(el.connection).toMatchObject({
            _protocol: 'mqtts', _host: 'broker', _port: '8883',
            _username: 'alice', _password: 'secret'
        });
    });
});

describe('_setSite() / _applySite() — site attribute round-trip', () => {
    function makeWithSite(siteObj = {}) {
        feezal.site = document.createElement('div');
        feezal.app = {change: vi.fn()};
        const el = makeSidebar();
        el.site = {name: 'default', ...siteObj};
        return el;
    }

    it('writes string values as kebab-case attributes on feezal.site', () => {
        const el = makeWithSite();
        el._setSite('pageTitle', 'My Dashboard');
        el._setSite('playlist', 'home:30, kitchen');
        expect(feezal.site.getAttribute('page-title')).toBe('My Dashboard');
        expect(feezal.site.getAttribute('playlist')).toBe('home:30, kitchen');
        expect(feezal.app.change).toHaveBeenCalledWith(true);
    });

    it('boolean true sets a presence attribute, false removes it (playlist-enabled)', () => {
        const el = makeWithSite();
        el._setSite('playlistEnabled', true);
        expect(feezal.site.hasAttribute('playlist-enabled')).toBe(true);
        el._setSite('playlistEnabled', false);
        expect(feezal.site.hasAttribute('playlist-enabled')).toBe(false);
    });

    it('clearing a field removes the stale attribute from the site', () => {
        const el = makeWithSite();
        el._setSite('playlist', 'home,kitchen');
        expect(feezal.site.hasAttribute('playlist')).toBe(true);
        el._setSite('playlist', '');
        expect(feezal.site.hasAttribute('playlist')).toBe(false);
    });

    it('numeric playlist settings land as attributes', () => {
        const el = makeWithSite();
        el._setSite('playlistDwell', '15');
        el._setSite('playlistResume', '120');
        expect(feezal.site.getAttribute('playlist-dwell')).toBe('15');
        expect(feezal.site.getAttribute('playlist-resume')).toBe('120');
    });
});

// ── U43: "Apply connection settings" dirty detection ────────────────────────

describe('apply-connection-settings dirty detection (U43)', () => {
    it('is never dirty before the deployed baseline exists', () => {
        const el = makeSidebar({uri: 'mqtt://a'});
        expect(el._connDirty).toBe(false);
    });

    it('editing the connection after the baseline arms the button', () => {
        const el = makeSidebar({uri: 'mqtt://a', protocolVersion: 4});
        el.markConnectionDeployed();
        expect(el._connDirty).toBe(false);

        el.connection = {...el.connection, uri: 'mqtt://b'};
        expect(el._connDirty).toBe(true);
    });

    it('a successful deploy re-baselines and quiets the button', () => {
        const el = makeSidebar({uri: 'mqtt://a'});
        el.markConnectionDeployed();
        el.connection = {...el.connection, uri: 'mqtt://b'};
        expect(el._connDirty).toBe(true);

        el.markConnectionDeployed();   // deploy callback
        expect(el._connDirty).toBe(false);
    });

    it('protocolVersion changes count as dirty; unrelated fields do not', () => {
        const el = makeSidebar({uri: 'mqtt://a', protocolVersion: 4});
        el.markConnectionDeployed();
        el.connection = {...el.connection, protocolVersion: 5};
        expect(el._connDirty).toBe(true);

        el.connection = {...el.connection, protocolVersion: 4, _host: 'display-only'};
        expect(el._connDirty).toBe(false);   // structured fields feed uri via _buildUri, not the snapshot
    });

    it('_applyConnSettings deploys only while dirty', () => {
        feezal.app = {_deploy: vi.fn(), change() {}};
        const el = makeSidebar({uri: 'mqtt://a'});
        el.markConnectionDeployed();

        el._applyConnSettings();
        expect(feezal.app._deploy).not.toHaveBeenCalled();

        el.connection = {...el.connection, uri: 'mqtt://b'};
        el._applyConnSettings();
        expect(feezal.app._deploy).toHaveBeenCalledTimes(1);
    });
});
