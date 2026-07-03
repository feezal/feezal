'use strict';

/**
 * AI provider adapters (U9): OpenAI-compatible, Ollama, and Anthropic.
 *
 * feezal's usage is minimal — list models and stream a chat completion — so
 * each provider gets a thin adapter over the global fetch (Node 18+). The
 * OpenAI SSE, Ollama NDJSON, and Anthropic SSE streams are all normalised to a
 * simple `onToken(text)` callback.
 */

const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MAX_TOKENS = 8192;

/**
 * Ollama request options. Exposes num_ctx so agent mode (which accumulates tool
 * results) isn't silently truncated by Ollama's small default context window.
 * Returns undefined when unset — JSON.stringify then omits the key.
 */
function ollamaOptions(cfg) {
    const n = Number(cfg && cfg.numCtx);
    return Number.isFinite(n) && n > 0 ? {num_ctx: n} : undefined;
}

function endpointFor(cfg) {
    if (cfg.provider === 'ollama') {
        return (cfg.endpoint || 'http://localhost:11434').replace(/\/+$/, '');
    }
    if (cfg.provider === 'anthropic') {
        return (cfg.endpoint || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    }
    // openai-compatible (OpenAI, LM Studio, llama.cpp, vLLM, …)
    return (cfg.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function authHeaders(cfg) {
    if (cfg.provider === 'anthropic') {
        return cfg.apiKey
            ? {'x-api-key': cfg.apiKey, 'anthropic-version': ANTHROPIC_VERSION}
            : {'anthropic-version': ANTHROPIC_VERSION};
    }
    return cfg.apiKey ? {Authorization: 'Bearer ' + cfg.apiKey} : {};
}

/** Consume a WHATWG ReadableStream line-by-line. */
async function eachLine(body, onLine) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buf += decoder.decode(value, {stream: true});
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
            onLine(buf.slice(0, idx));
            buf = buf.slice(idx + 1);
        }
    }
    if (buf) onLine(buf);
}

async function listModels(cfg) {
    const base = endpointFor(cfg);
    if (cfg.provider === 'ollama') {
        const res = await fetch(base + '/api/tags');
        if (!res.ok) throw new Error('Ollama responded ' + res.status);
        const data = await res.json();
        return (data.models || []).map(m => m.name).filter(Boolean);
    }
    // OpenAI and Anthropic both expose GET /models returning {data:[{id}]}.
    const res = await fetch(base + '/models', {headers: authHeaders(cfg)});
    if (!res.ok) throw new Error('Provider responded ' + res.status);
    const data = await res.json();
    return (data.data || []).map(m => m.id).filter(Boolean);
}

/**
 * Stream a chat completion. Calls onToken(text) for each content delta.
 * @param {object}        cfg
 * @param {Array}         messages   [{role, content}, …]
 * @param {string}        model
 * @param {(t:string)=>void} onToken
 * @param {AbortSignal}   [signal]
 */
async function streamChat(cfg, messages, model, onToken, signal) {
    const base = endpointFor(cfg);

    if (cfg.provider === 'ollama') {
        const res = await fetch(base + '/api/chat', {
            method:  'POST',
            headers: {'Content-Type': 'application/json'},
            body:    JSON.stringify({model, messages, stream: true, options: ollamaOptions(cfg)}),
            signal,
        });
        if (!res.ok || !res.body) throw new Error('Ollama responded ' + res.status);
        await eachLine(res.body, line => {
            const t = line.trim();
            if (!t) return;
            let obj;
            try { obj = JSON.parse(t); } catch { return; }
            if (obj.message && obj.message.content) onToken(obj.message.content);
        });
        return;
    }

    if (cfg.provider === 'anthropic') {
        // Anthropic separates the system prompt from the message list.
        const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const turns  = messages.filter(m => m.role !== 'system')
            .map(m => ({role: m.role, content: m.content}));
        const res = await fetch(base + '/messages', {
            method:  'POST',
            headers: {'Content-Type': 'application/json', ...authHeaders(cfg)},
            body:    JSON.stringify({
                model,
                max_tokens: ANTHROPIC_MAX_TOKENS,
                system: system || undefined,
                messages: turns,
                stream: true,
            }),
            signal,
        });
        if (!res.ok || !res.body) {
            let detail = '';
            try { detail = (await res.text()).slice(0, 500); } catch { /* ignore */ }
            throw new Error('Anthropic responded ' + res.status + (detail ? ': ' + detail : ''));
        }
        await eachLine(res.body, line => {
            const t = line.trim();
            if (!t.startsWith('data:')) return;
            const data = t.slice(5).trim();
            let obj;
            try { obj = JSON.parse(data); } catch { return; }
            if (obj.type === 'content_block_delta' && obj.delta && obj.delta.type === 'text_delta') {
                onToken(obj.delta.text);
            }
        });
        return;
    }

    // openai-compatible — SSE
    const res = await fetch(base + '/chat/completions', {
        method:  'POST',
        headers: {'Content-Type': 'application/json', ...authHeaders(cfg)},
        body:    JSON.stringify({model, messages, stream: true}),
        signal,
    });
    if (!res.ok || !res.body) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 500); } catch { /* ignore */ }
        throw new Error('Provider responded ' + res.status + (detail ? ': ' + detail : ''));
    }
    await eachLine(res.body, line => {
        const t = line.trim();
        if (!t.startsWith('data:')) return;
        const data = t.slice(5).trim();
        if (data === '[DONE]') return;
        let obj;
        try { obj = JSON.parse(data); } catch { return; }
        const delta = obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
        if (delta) onToken(delta);
    });
}

// ── Tool-calling agent loop (U26) ───────────────────────────────────────────
// Non-streaming: each round asks the model (with tools) for its next step; if it
// returns tool calls we execute them, append the results in the provider's
// native format, and loop; when it returns plain text that is the final answer.
// Streaming the intermediate tool-decision turns is provider-specific and
// fragile, so we keep the loop request/response and let the route emit the
// final text as one token event.

// Max model round-trips per message in agent mode. A round may batch several
// tool calls, but models that call tools one-at-a-time need one round each — a
// multi-device task ("wire all the keller lights") can easily need 10+. Kept
// bounded so a stuck model can't loop forever; overridable via ai config.
const AGENT_MAX_ROUNDS = 20;

const _openaiToolSpec = t => ({type: 'function', function: {name: t.name, description: t.description, parameters: t.parameters}});
const _resultStr = r => (typeof r === 'string' ? r : JSON.stringify(r));
const _safeJson = s => { try { return typeof s === 'string' ? JSON.parse(s || '{}') : (s || {}); } catch { return {}; } };
async function _errDetail(res) { try { return ': ' + (await res.text()).slice(0, 500); } catch { return ''; } }

/** One non-streaming completion, optionally with tools. Returns {content, toolCalls, assistantMsg}. */
async function _completeWithTools(cfg, messages, model, tools, signal) {
    const base = endpointFor(cfg);
    const withTools = tools && tools.length;

    if (cfg.provider === 'anthropic') {
        const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
        const turns  = messages.filter(m => m.role !== 'system');
        const body = {model, max_tokens: ANTHROPIC_MAX_TOKENS, system: system || undefined, messages: turns};
        if (withTools) body.tools = tools.map(t => ({name: t.name, description: t.description, input_schema: t.parameters}));
        const res = await fetch(base + '/messages', {
            method: 'POST', headers: {'Content-Type': 'application/json', ...authHeaders(cfg)},
            body: JSON.stringify(body), signal,
        });
        if (!res.ok) throw new Error('Anthropic responded ' + res.status + await _errDetail(res));
        const data = await res.json();
        const blocks = Array.isArray(data.content) ? data.content : [];
        return {
            content:   blocks.filter(b => b.type === 'text').map(b => b.text).join(''),
            toolCalls: blocks.filter(b => b.type === 'tool_use').map(b => ({id: b.id, name: b.name, args: b.input || {}})),
            assistantMsg: {role: 'assistant', content: blocks},
        };
    }

    if (cfg.provider === 'ollama') {
        const body = {model, messages, stream: false, options: ollamaOptions(cfg)};
        if (withTools) body.tools = tools.map(_openaiToolSpec);
        const res = await fetch(base + '/api/chat', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body), signal,
        });
        if (!res.ok) throw new Error('Ollama responded ' + res.status + await _errDetail(res));
        const data = await res.json();
        const msg = data.message || {};
        return {
            content:   msg.content || '',
            toolCalls: (msg.tool_calls || []).map((tc, i) => ({id: String(i), name: tc.function && tc.function.name, args: (tc.function && tc.function.arguments) || {}})),
            assistantMsg: msg,
        };
    }

    // openai-compatible
    const body = {model, messages, stream: false};
    if (withTools) { body.tools = tools.map(_openaiToolSpec); body.tool_choice = 'auto'; }
    const res = await fetch(base + '/chat/completions', {
        method: 'POST', headers: {'Content-Type': 'application/json', ...authHeaders(cfg)},
        body: JSON.stringify(body), signal,
    });
    if (!res.ok) throw new Error('Provider responded ' + res.status + await _errDetail(res));
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return {
        content:   msg.content || '',
        toolCalls: (msg.tool_calls || []).map(tc => ({id: tc.id, name: tc.function && tc.function.name, args: _safeJson(tc.function && tc.function.arguments)})),
        assistantMsg: msg,
    };
}

/** Append the assistant tool-call turn + tool results in the provider's native message format. */
function _appendToolTurn(cfg, messages, assistantMsg, results) {
    const next = messages.slice();
    next.push(assistantMsg);
    if (cfg.provider === 'anthropic') {
        next.push({role: 'user', content: results.map(r => ({type: 'tool_result', tool_use_id: r.id, content: _resultStr(r.result)}))});
    } else {
        for (const r of results) {
            const m = {role: 'tool', content: _resultStr(r.result)};
            if (cfg.provider !== 'ollama') m.tool_call_id = r.id;   // openai matches by id
            next.push(m);
        }
    }
    return next;
}

/**
 * Run the tool-calling loop. Calls onEvent({type:'tool', name, args}) before each
 * tool executes so the UI can show activity. Returns the model's final text.
 *
 * @param {object}   cfg
 * @param {Array}    messages   full message list (incl. system)
 * @param {string}   model
 * @param {Array}    tools      TOOL_SPECS
 * @param {(name:string,args:object)=>Promise<any>} execTool
 * @param {(ev:object)=>void}  onEvent
 * @param {AbortSignal} [signal]
 */
async function chatWithTools(cfg, messages, model, tools, execTool, onEvent, signal) {
    const maxRounds = Math.max(1, Number(cfg && cfg.maxToolRounds) || AGENT_MAX_ROUNDS);
    let msgs = messages.slice();
    let nudged = false;
    for (let round = 0; round < maxRounds; round++) {
        // On the last allowed round, drop the tools so the model is forced to
        // answer instead of requesting yet another tool call it can't make.
        const roundTools = round < maxRounds - 1 ? tools : [];
        const {content, toolCalls, assistantMsg} = await _completeWithTools(cfg, msgs, model, roundTools, signal);
        if (!toolCalls.length) {
            if (content && content.trim()) return content;   // real answer
            // The model stopped without answering (empty completion). Nudge it
            // once — tools disabled so it must commit — before giving up.
            if (!nudged) {
                nudged = true;
                msgs = [...msgs,
                    {role: 'assistant', content: content || '…'},
                    {role: 'user', content: 'Now output the final view HTML in a single ```html code block (include every element in the view). If no change is needed, answer in prose instead.'}];
                const forced = await _completeWithTools(cfg, msgs, model, [], signal);
                return forced.content;
            }
            return content;
        }
        // Stream any narration the model wrote alongside its tool calls so the
        // user sees what it found while it keeps working. (Also means HTML the
        // model emitted early isn't lost — it reaches the client directly.)
        if (content && content.trim() && onEvent) onEvent({type: 'text', text: content});
        const results = [];
        for (const tc of toolCalls) {
            if (onEvent) onEvent({type: 'tool', name: tc.name, args: tc.args});
            results.push({id: tc.id, name: tc.name, result: await execTool(tc.name, tc.args)});
        }
        msgs = _appendToolTurn(cfg, msgs, assistantMsg, results);
    }
    // Budget exhausted even without tools on the final round — force one more
    // plain answer as a last resort.
    const {content} = await _completeWithTools(cfg, msgs, model, [], signal);
    return content;
}

module.exports = {listModels, streamChat, chatWithTools};
