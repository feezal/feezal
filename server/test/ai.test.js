import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const {publicAiConfig} = require('../src/ai/config.js');
const {buildSystemPrompt} = require('../src/ai/prompt.js');
const convos = require('../src/ai/conversations.js');
const fs = require('fs');
const os = require('os');
const pathMod = require('path');

describe('publicAiConfig', () => {
    it('reports not configured for an empty config', () => {
        const out = publicAiConfig({});
        expect(out.configured).toBe(false);
        expect(out.hasKey).toBe(false);
    });

    it('treats Ollama as configured without a key', () => {
        expect(publicAiConfig({provider: 'ollama'}).configured).toBe(true);
    });

    it('requires a key or endpoint for openai-compatible', () => {
        expect(publicAiConfig({provider: 'openai-compatible'}).configured).toBe(false);
        expect(publicAiConfig({provider: 'openai-compatible', apiKey: 'x'}).configured).toBe(true);
        expect(publicAiConfig({provider: 'openai-compatible', endpoint: 'http://x'}).configured).toBe(true);
    });

    it('treats anthropic with a key as configured', () => {
        expect(publicAiConfig({provider: 'anthropic', apiKey: 'x'}).configured).toBe(true);
    });

    it('never exposes the API key', () => {
        const out = publicAiConfig({provider: 'anthropic', apiKey: 'secret'});
        expect(out.apiKey).toBeUndefined();
        expect(out.hasKey).toBe(true);
        expect(JSON.stringify(out)).not.toContain('secret');
    });
});

describe('buildSystemPrompt', () => {
    it('embeds the output contract and the injected context', () => {
        const p = buildSystemPrompt({
            viewName: 'home',
            viewHtml: '<feezal-element-basic-gauge></feezal-element-basic-gauge>',
            elements: [{tag: 'feezal-element-basic-gauge', name: 'Gauge', attributes: ['subscribe']}],
            topics: ['home/temp', 'home/hum'],
        });
        // contract
        expect(p).toMatch(/COMPLETE/);
        expect(p).toMatch(/one\b.*fenced/i);
        expect(p).toMatch(/```html/);
        // context injection
        expect(p).toContain('feezal-element-basic-gauge');
        expect(p).toContain('home/temp');
        expect(p).toContain('home'); // view name
    });

    it('handles an empty context without throwing', () => {
        const p = buildSystemPrompt({});
        expect(typeof p).toBe('string');
        expect(p).toMatch(/feezal/i);
    });
});

describe('conversations store', () => {
    const dataDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'feezal-ai-'));
    const storage = {dataDir};

    it('saves, lists, gets and deletes a conversation', async () => {
        await convos.saveConversation(storage,
            {id: 'abc-1', title: 'add a gauge', messages: [{role: 'user', content: 'hi'}]});
        const list = await convos.listConversations(storage);
        expect(list.length).toBe(1);
        expect(list[0].id).toBe('abc-1');
        expect(list[0].title).toBe('add a gauge');

        const got = await convos.getConversation(storage, 'abc-1');
        expect(got.messages[0].content).toBe('hi');
        expect(got.updatedAt).toBeGreaterThan(0);

        await convos.deleteConversation(storage, 'abc-1');
        expect(await convos.getConversation(storage, 'abc-1')).toBe(null);
    });

    it('rejects path-traversal / invalid ids', async () => {
        await expect(convos.saveConversation(storage, {id: '../evil', messages: []})).rejects.toThrow();
        expect(await convos.getConversation(storage, '../../etc/passwd')).toBe(null);
    });
});
