import {describe, it, expect} from 'vitest';

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
