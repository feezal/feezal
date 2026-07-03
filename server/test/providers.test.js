/**
 * Unit tests for ai/providers.js with the global fetch mocked. These lock in
 * the per-provider request shaping (endpoints, auth headers, Anthropic's
 * system/messages split, Ollama num_ctx) and the stream/tool-loop normalisation
 * — no network, fully deterministic.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const {listModels, streamChat, chatWithTools} = require('../src/ai/providers.js');

// ── fetch mock plumbing ─────────────────────────────────────────────────────
let calls;      // [{url, opts}]
let queue;      // responses consumed in order

function mockFetch(url, opts) {
    calls.push({url, opts, body: opts && opts.body ? JSON.parse(opts.body) : undefined});
    const next = queue.shift();
    return Promise.resolve(next);
}
const jsonRes = (obj, ok = true, status = 200) => ({
    ok, status, json: async () => obj, text: async () => JSON.stringify(obj),
});
function streamRes(chunks) {
    const stream = new ReadableStream({
        start(controller) {
            const enc = new TextEncoder();
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
        },
    });
    return {ok: true, status: 200, body: stream};
}

beforeEach(() => { calls = []; queue = []; vi.stubGlobal('fetch', mockFetch); });
afterEach(() => vi.unstubAllGlobals());

describe('listModels', () => {
    it('Ollama → GET /api/tags, maps model names', async () => {
        queue = [jsonRes({models: [{name: 'llama3'}, {name: 'qwen'}]})];
        const models = await listModels({provider: 'ollama'});
        expect(models).toEqual(['llama3', 'qwen']);
        expect(calls[0].url).toBe('http://localhost:11434/api/tags');
    });

    it('openai-compatible → GET /models with Bearer auth', async () => {
        queue = [jsonRes({data: [{id: 'gpt-4o'}]})];
        const models = await listModels({provider: 'openai-compatible', apiKey: 'sk-x'});
        expect(models).toEqual(['gpt-4o']);
        expect(calls[0].url).toBe('https://api.openai.com/v1/models');
        expect(calls[0].opts.headers.Authorization).toBe('Bearer sk-x');
    });

    it('anthropic → GET /models with x-api-key + version header', async () => {
        queue = [jsonRes({data: [{id: 'claude-3'}]})];
        const models = await listModels({provider: 'anthropic', apiKey: 'k'});
        expect(models).toEqual(['claude-3']);
        expect(calls[0].url).toBe('https://api.anthropic.com/v1/models');
        expect(calls[0].opts.headers['x-api-key']).toBe('k');
        expect(calls[0].opts.headers['anthropic-version']).toBeTruthy();
    });

    it('throws on a non-ok response', async () => {
        queue = [jsonRes({}, false, 500)];
        await expect(listModels({provider: 'ollama'})).rejects.toThrow(/500/);
    });

    it('honours a custom endpoint with trailing slashes trimmed', async () => {
        queue = [jsonRes({data: []})];
        await listModels({provider: 'openai-compatible', endpoint: 'http://lan:1234/v1//'});
        expect(calls[0].url).toBe('http://lan:1234/v1/models');
    });
});

describe('streamChat', () => {
    it('openai SSE → onToken per content delta, [DONE] ignored', async () => {
        queue = [streamRes([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
            'data: [DONE]\n',
        ])];
        const out = [];
        await streamChat({provider: 'openai-compatible'}, [{role: 'user', content: 'hi'}], 'm', t => out.push(t));
        expect(out.join('')).toBe('Hello');
        expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
        expect(calls[0].body).toMatchObject({model: 'm', stream: true});
    });

    it('ollama NDJSON → onToken per message.content and sends num_ctx when set', async () => {
        queue = [streamRes([
            '{"message":{"content":"A"}}\n',
            '{"message":{"content":"B"}}\n',
        ])];
        const out = [];
        await streamChat({provider: 'ollama', numCtx: 2048}, [{role: 'user', content: 'hi'}], 'm', t => out.push(t));
        expect(out.join('')).toBe('AB');
        expect(calls[0].url).toBe('http://localhost:11434/api/chat');
        expect(calls[0].body.options).toEqual({num_ctx: 2048});
    });

    it('ollama omits the options key entirely when num_ctx is unset', async () => {
        queue = [streamRes(['{"message":{"content":"x"}}\n'])];
        await streamChat({provider: 'ollama'}, [{role: 'user', content: 'hi'}], 'm', () => {});
        expect('options' in calls[0].body).toBe(false);
    });

    it('anthropic SSE → onToken per text_delta, splits system from messages', async () => {
        queue = [streamRes([
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"He"}}\n',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"y"}}\n',
        ])];
        const out = [];
        await streamChat({provider: 'anthropic', apiKey: 'k'},
            [{role: 'system', content: 'SYS'}, {role: 'user', content: 'hi'}], 'm', t => out.push(t));
        expect(out.join('')).toBe('Hey');
        expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
        expect(calls[0].body.system).toBe('SYS');
        expect(calls[0].body.messages).toEqual([{role: 'user', content: 'hi'}]);
        expect(calls[0].opts.headers['x-api-key']).toBe('k');
    });

    it('throws with the status when the provider rejects', async () => {
        queue = [{ok: false, status: 429, body: null, text: async () => 'rate limited'}];
        await expect(
            streamChat({provider: 'openai-compatible'}, [{role: 'user', content: 'hi'}], 'm', () => {})
        ).rejects.toThrow(/429/);
    });
});

describe('chatWithTools (agent loop)', () => {
    const TOOLS = [{name: 'search_topics', description: 'find topics', parameters: {type: 'object'}}];

    it('executes a tool call, emits a tool event, then returns the final text', async () => {
        queue = [
            jsonRes({choices: [{message: {content: '', tool_calls: [
                {id: 't1', function: {name: 'search_topics', arguments: '{"q":"lamp"}'}},
            ]}}]}),
            jsonRes({choices: [{message: {content: 'All done.'}}]}),
        ];
        const execTool = vi.fn(async () => 'a/lamp');
        const events = [];
        const out = await chatWithTools({provider: 'openai-compatible'}, [{role: 'user', content: 'x'}],
            'm', TOOLS, execTool, ev => events.push(ev));

        expect(out).toBe('All done.');
        expect(execTool).toHaveBeenCalledWith('search_topics', {q: 'lamp'});
        expect(events).toContainEqual({type: 'tool', name: 'search_topics', args: {q: 'lamp'}});
        // First round offers tools; forced final round has run.
        expect(calls[0].body.tools).toBeTruthy();
        expect(calls[0].body.tool_choice).toBe('auto');
        expect(calls).toHaveLength(2);
    });

    it('nudges once when the model returns an empty completion, then answers', async () => {
        queue = [
            jsonRes({choices: [{message: {content: ''}}]}),        // empty, no tool calls
            jsonRes({choices: [{message: {content: 'FORCED'}}]}),  // forced answer
        ];
        const out = await chatWithTools({provider: 'openai-compatible'}, [{role: 'user', content: 'x'}],
            'm', TOOLS, async () => '', () => {});
        expect(out).toBe('FORCED');
        expect(calls).toHaveLength(2);
        expect('tools' in calls[1].body).toBe(false);   // forced round drops tools
    });

    it('returns immediately when the first turn already has the answer', async () => {
        queue = [jsonRes({choices: [{message: {content: 'Instant.'}}]})];
        const execTool = vi.fn();
        const out = await chatWithTools({provider: 'openai-compatible'}, [{role: 'user', content: 'x'}],
            'm', TOOLS, execTool, () => {});
        expect(out).toBe('Instant.');
        expect(execTool).not.toHaveBeenCalled();
        expect(calls).toHaveLength(1);
    });

    it('respects a lowered maxToolRounds cap', async () => {
        // maxRounds=1 → the only round runs with tools dropped; model must answer.
        queue = [jsonRes({choices: [{message: {content: 'capped'}}]})];
        const out = await chatWithTools({provider: 'openai-compatible', maxToolRounds: 1},
            [{role: 'user', content: 'x'}], 'm', TOOLS, async () => 'r', () => {});
        expect(out).toBe('capped');
        expect('tools' in calls[0].body).toBe(false);
    });
});
