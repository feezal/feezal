/**
 * Integration tests for the remaining network-free API surface: auto-discovery
 * endpoints (wired via injected getters), AI config load/save with clamping,
 * the version/format helpers, and the export guard that rejects raw-MQTT
 * connections before the (expensive) bundle step.
 */
import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {createRequire} from 'module';
import {mkdtemp, rm} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const FilesystemStorage = require('../src/storage/filesystem.js');
const createApiRouter = require('../src/routes/api.js');
const express = require('express');

const silent = {debug() {}, info() {}, warn() {}, error() {}};

const DEVICES = [
    {discovery_id: 'light/kitchen', component: 'light', name: 'Kitchen Light', config: {}},
    {discovery_id: 'sensor/temp', component: 'sensor', name: 'Temp', config: {}},
];
const GROUPS = [{deviceId: 'dev1', deviceName: 'Planty', entities: DEVICES, elementHint: 'plant'}];

let dataDir, app, storage;
beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-misc-'));
    storage = new FilesystemStorage(dataDir);
    storage._logger = silent;
    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(storage, '/dev/null', silent, {
        getDiscoveredEntities: () => DEVICES,
        getDiscoveredEntity: id => DEVICES.find(d => d.discovery_id === id) || null,
        getDeviceGroups: () => GROUPS,
    }));
});
afterEach(async () => { await rm(dataDir, {recursive: true, force: true}); });

describe('auto-discovery endpoints', () => {
    it('lists all discovered devices', async () => {
        const res = await request(app).get('/api/discovery/devices');
        expect(res.status).toBe(200);
        expect(res.body.devices).toHaveLength(2);
    });

    it('lists device groups with their element hint', async () => {
        const res = await request(app).get('/api/discovery/device-groups');
        expect(res.body.groups[0].elementHint).toBe('plant');
    });

    it('resolves a single device by its slash-containing id', async () => {
        const res = await request(app).get('/api/discovery/devices/light/kitchen');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Kitchen Light');
    });

    it('404s for an unknown device id', async () => {
        expect((await request(app).get('/api/discovery/devices/light/nope')).status).toBe(404);
    });
});

describe('AI config', () => {
    it('reports "not configured" on a fresh data dir', async () => {
        const res = await request(app).get('/api/ai/config');
        expect(res.status).toBe(200);
        expect(res.body.configured).toBe(false);
        expect(res.body.hasKey).toBe(false);
    });

    it('saves a provider + key, never echoing the key, and persists it', async () => {
        const put = await request(app).put('/api/ai/config')
            .send({provider: 'anthropic', apiKey: 'secret-key', model: 'claude', maxToolRounds: 7, numCtx: 8192});
        expect(put.status).toBe(200);
        expect(put.body.configured).toBe(true);
        expect(put.body.hasKey).toBe(true);
        expect(put.body.maxToolRounds).toBe(7);
        expect(put.body.numCtx).toBe(8192);
        expect(JSON.stringify(put.body)).not.toContain('secret-key');

        const get = await request(app).get('/api/ai/config');
        expect(get.body.configured).toBe(true);
        expect(get.body.hasKey).toBe(true);
        expect(get.body.model).toBe('claude');
    });

    it('clamps maxToolRounds and numCtx into range', async () => {
        const put = await request(app).put('/api/ai/config')
            .send({provider: 'ollama', maxToolRounds: 9999, numCtx: 1});
        expect(put.body.maxToolRounds).toBe(100);   // clamped 1..100
        expect(put.body.numCtx).toBe(512);          // clamped 512..1048576
    });

    it('rejects an unknown provider', async () => {
        expect((await request(app).put('/api/ai/config').send({provider: 'skynet'})).status).toBe(400);
    });

    it('keeps the stored key when apiKey is omitted on a later save', async () => {
        await request(app).put('/api/ai/config').send({provider: 'anthropic', apiKey: 'keep-me'});
        const put = await request(app).put('/api/ai/config').send({provider: 'anthropic', model: 'claude-3'});
        expect(put.body.hasKey).toBe(true);
    });
});

describe('version + format helpers', () => {
    it('returns the server version', async () => {
        const res = await request(app).get('/api/version');
        expect(res.status).toBe(200);
        expect(typeof res.body.version).toBe('string');
        expect(res.body.version).toMatch(/\d+\.\d+/);
    });

    it('formats an HTML fragment', async () => {
        const res = await request(app).post('/api/format').send({html: '<div ><span>hi</span></div>'});
        expect(res.status).toBe(200);
        expect(typeof res.body.html).toBe('string');
        expect(res.body.html).toContain('<span>');
    });

    it('400s when format is called without html', async () => {
        expect((await request(app).post('/api/format').send({})).status).toBe(400);
    });
});

describe('export guard', () => {
    it('rejects export of a site connected over raw mqtt:// before bundling', async () => {
        await storage.saveSite('m', {html: '', config: {connection: {uri: 'mqtt://broker:1883'}}});
        const res = await request(app).get('/api/sites/m/export');
        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/ws:\/\/ or wss:\/\//);
    });
});
