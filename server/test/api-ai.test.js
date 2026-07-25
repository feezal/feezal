/**
 * Integration tests for the AI REST surface (/api/ai/*).
 *
 * Two things are exercised for real against a temp data dir: the **config**
 * round-trip (including the secret handling — the API must never hand the key
 * back out — and the numeric clamps), and the **conversations** CRUD, which is
 * plain storage work with no external calls.
 *
 * The provider-facing routes (`/ai/models`, `/ai/chat`) are covered up to the
 * point where they would talk to an LLM: every guard before that is a real
 * failure mode a user hits (no provider configured, no model selected, a
 * malformed body), and those are the responses the editor branches on.
 * Deliberately NOT mocked further — a test that stubs the provider and asserts
 * the stub was called would pin the mock, not the route.
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

let dataDir;
let app;

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'feezal-api-ai-test-'));
    const storage = new FilesystemStorage(dataDir);
    app = express();
    app.use(express.json());
    const logger = {debug() {}, info() {}, warn() {}, error() {}};
    app.use('/api', createApiRouter(storage, '/dev/null', logger));
});

afterEach(async () => {
    await rm(dataDir, {recursive: true, force: true});
});

const putConfig = body => request(app).put('/api/ai/config').send(body);

describe('GET /api/ai/config', () => {
    it('reports "not configured" on a fresh data dir', async () => {
        const res = await request(app).get('/api/ai/config');
        expect(res.status).toBe(200);
        expect(res.body.provider || '').toBe('');
    });

    it('never returns the API key itself, only whether one is stored', async () => {
        await putConfig({provider: 'anthropic', apiKey: 'sk-secret', model: 'claude'});
        const res = await request(app).get('/api/ai/config');
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain('sk-secret');
        expect(res.body.hasKey).toBe(true);
    });
});

describe('PUT /api/ai/config', () => {
    it('rejects an unknown provider and names the valid ones', async () => {
        const res = await putConfig({provider: 'skynet'});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('openai-compatible');
        expect(res.body.error).toContain('anthropic');
        expect(res.body.error).toContain('ollama');
    });

    it('rejects a missing body', async () => {
        expect((await putConfig({})).status).toBe(400);
    });

    it('stores provider/model/endpoint and echoes the public view', async () => {
        const res = await putConfig({
            provider: 'ollama', model: 'llama3', endpoint: 'http://localhost:11434',
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({provider: 'ollama', model: 'llama3', endpoint: 'http://localhost:11434'});
    });

    it('keeps the stored key when apiKey is omitted, and clears it when blank', async () => {
        await putConfig({provider: 'anthropic', apiKey: 'sk-keep', model: 'a'});
        await putConfig({provider: 'anthropic', model: 'b'});                 // omitted
        expect((await request(app).get('/api/ai/config')).body.hasKey).toBe(true);

        await putConfig({provider: 'anthropic', apiKey: '', model: 'b'});     // explicit clear
        expect((await request(app).get('/api/ai/config')).body.hasKey).toBe(false);
    });

    it('clamps maxToolRounds into 1..100', async () => {
        expect((await putConfig({provider: 'ollama', maxToolRounds: 500})).body.maxToolRounds).toBe(100);
        expect((await putConfig({provider: 'ollama', maxToolRounds: 0})).body.maxToolRounds).toBe(1);
        expect((await putConfig({provider: 'ollama', maxToolRounds: 7})).body.maxToolRounds).toBe(7);
    });

    it('keeps maxToolRounds when absent and clears it when blank', async () => {
        await putConfig({provider: 'ollama', maxToolRounds: 9});
        expect((await putConfig({provider: 'ollama'})).body.maxToolRounds).toBe(9);      // absent = keep
        // null is the documented "use the built-in default" sentinel — the
        // field is always present so the editor can render it as a placeholder.
        expect((await putConfig({provider: 'ollama', maxToolRounds: ''})).body.maxToolRounds).toBeNull();
    });

    it('clamps numCtx into 512..1048576', async () => {
        expect((await putConfig({provider: 'ollama', numCtx: 10})).body.numCtx).toBe(512);
        expect((await putConfig({provider: 'ollama', numCtx: 99_999_999})).body.numCtx).toBe(1_048_576);
        expect((await putConfig({provider: 'ollama', numCtx: 8192})).body.numCtx).toBe(8192);
    });

    it('ignores a non-numeric clamp value rather than storing NaN', async () => {
        const res = await putConfig({provider: 'ollama', maxToolRounds: 'lots', numCtx: 'big'});
        expect(res.status).toBe(200);
        expect(res.body.maxToolRounds).toBeNull();      // falls back to the default
        expect(res.body.numCtx).toBeNull();
    });
});

describe('GET /api/ai/models', () => {
    it('is 400 while no provider is configured', async () => {
        const res = await request(app).get('/api/ai/models');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not configured/i);
    });
});

describe('POST /api/ai/chat — the guards before any provider call', () => {
    it('requires a messages array', async () => {
        for (const body of [{}, {messages: 'hi'}, {messages: null}]) {
            const res = await request(app).post('/api/ai/chat').send(body);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/messages/);
        }
    });

    it('is 400 while no provider is configured', async () => {
        const res = await request(app).post('/api/ai/chat').send({messages: []});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not configured/i);
    });

    it('is 400 when a provider is set but no model is selected anywhere', async () => {
        await putConfig({provider: 'ollama', model: ''});
        const res = await request(app).post('/api/ai/chat').send({messages: []});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/model/i);
    });
});

describe('/api/ai/conversations', () => {
    const save = (id, body) => request(app).put(`/api/ai/conversations/${id}`).send(body);

    it('starts empty', async () => {
        const res = await request(app).get('/api/ai/conversations');
        expect(res.status).toBe(200);
        expect(res.body.conversations).toEqual([]);
    });

    it('saves and reads a conversation back', async () => {
        const messages = [{role: 'user', content: 'hi'}, {role: 'assistant', content: 'hello'}];
        const put = await save('c1', {title: 'First chat', messages});
        expect(put.status).toBe(200);

        const res = await request(app).get('/api/ai/conversations/c1');
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('First chat');
        expect(res.body.messages).toEqual(messages);
    });

    it('lists saved conversations', async () => {
        await save('c1', {title: 'One', messages: []});
        await save('c2', {title: 'Two', messages: []});
        const res = await request(app).get('/api/ai/conversations');
        expect(res.body.conversations.map(c => c.id).sort()).toEqual(['c1', 'c2']);
    });

    it('overwrites an existing conversation in place', async () => {
        await save('c1', {title: 'Draft', messages: [{role: 'user', content: 'a'}]});
        await save('c1', {title: 'Final', messages: [{role: 'user', content: 'b'}]});
        const res = await request(app).get('/api/ai/conversations/c1');
        expect(res.body.title).toBe('Final');
        expect(res.body.messages).toHaveLength(1);
        expect((await request(app).get('/api/ai/conversations')).body.conversations).toHaveLength(1);
    });

    it('is 404 for an unknown id', async () => {
        const res = await request(app).get('/api/ai/conversations/nope');
        expect(res.status).toBe(404);
    });

    it('deletes, and deleting again is not an error', async () => {
        await save('c1', {title: 'One', messages: []});
        expect((await request(app).delete('/api/ai/conversations/c1')).status).toBe(204);
        expect((await request(app).get('/api/ai/conversations/c1')).status).toBe(404);
        expect((await request(app).delete('/api/ai/conversations/c1')).status).toBe(204);
    });

    it('refuses an id that would escape the conversations directory', async () => {
        // A traversal id must not read or write outside the data dir.
        const res = await request(app).get('/api/ai/conversations/..%2F..%2Fconfig');
        expect([400, 404]).toContain(res.status);
    });
});
