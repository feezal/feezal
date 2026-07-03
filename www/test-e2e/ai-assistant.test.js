/**
 * E2E: AI assistant against a scripted fake provider (A17 candidate).
 *
 * A local OpenAI-compatible stub (node http) serves /models and a streaming
 * /chat/completions whose reply carries a ```html proposal. The real editor
 * is configured against it via PUT /api/ai/config, the panel is driven for
 * real: prompt → streamed answer → confirmation card → Accept applies the
 * proposal to the canvas. No API key, no network.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import http from 'node:http';
import {startStack, stopStack, deploySite} from './harness.js';

const SITE = 'ai';
const SITE_HTML =
    '<feezal-site><feezal-view name="main" style="width:100%;height:100%;"></feezal-view></feezal-site>';

const PROPOSAL_HTML =
    '<feezal-element-material-badge subscribe="stat/mail" style="position:absolute;top:20px;left:20px;"></feezal-element-material-badge>';

const REPLY =
    'Sure — adding a badge for you.\n' +
    '```html\n' + PROPOSAL_HTML + '\n```\n';

let stack;
let page;
let stubServer;
let stubRequests;

/** Minimal OpenAI-compatible provider: /models + streaming /chat/completions. */
function startProviderStub() {
    stubRequests = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
            stubRequests.push({method: req.method, url: req.url, body: body ? JSON.parse(body) : null});

            if (req.method === 'GET' && req.url.startsWith('/models')) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({data: [{id: 'stub-model'}]}));
                return;
            }
            if (req.method === 'POST' && req.url.startsWith('/chat/completions')) {
                res.setHeader('Content-Type', 'text/event-stream');
                // stream the reply in a few token chunks, SSE-style
                for (let i = 0; i < REPLY.length; i += 40) {
                    const chunk = {choices: [{delta: {content: REPLY.slice(i, i + 40)}}]};
                    res.write('data: ' + JSON.stringify(chunk) + '\n\n');
                }
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }
            res.statusCode = 404;
            res.end('{}');
        });
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

beforeAll(async () => {
    stack = await startStack();
    page = stack.page;
    stubServer = await startProviderStub();
    const stubUrl = `http://127.0.0.1:${stubServer.address().port}`;

    // Configure the real server against the stub provider.
    const res = await fetch(stack.baseUrl + '/api/ai/config', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            provider: 'openai-compatible',
            endpoint: stubUrl,
            apiKey: 'test-key',
            model: 'stub-model'
        })
    });
    expect(res.status).toBeLessThan(300);

    await deploySite(stack.baseUrl, {name: SITE, html: SITE_HTML});
    // simple non-agent chat (the tool loop needs tool-call support in the stub)
    await stack.context.addInitScript(() => {
        localStorage.setItem('feezal:ai:agentMode', '0');
    });
    await page.goto(`${stack.baseUrl}/editor/?/${SITE}/`);
    await page.waitForSelector('feezal-palette .element', {timeout: 60_000});
}, 60_000);

afterAll(async () => {
    await stopStack(stack);
    await new Promise(r => stubServer.close(r));
});

describe('AI assistant with a stubbed provider', () => {
    it('the toolbar button appears because a provider is configured', async () => {
        const aiButton = page.locator('button[title="AI assistant"]');
        await aiButton.waitFor({timeout: 20_000});
        await aiButton.click();
        await page.locator('feezal-ai-chat').waitFor({timeout: 10_000});
    });

    it('lists the stub model', async () => {
        const options = page.locator('feezal-ai-chat select.model option');
        await expect.poll(() => options.allTextContents(), {timeout: 15_000})
            .toContain('stub-model');
    });

    it('streams the reply and shows the proposal card', async () => {
        const input = page.locator('feezal-ai-chat .composer textarea');
        await input.fill('add a mail badge');
        await input.press('Enter');

        // streamed text renders in the conversation
        await page.locator('feezal-ai-chat .msg.assistant', {hasText: 'adding a badge'})
            .waitFor({timeout: 30_000});
        // the ```html fence became a confirmation card
        await page.locator('feezal-ai-chat .card').waitFor({timeout: 10_000});

        // the stub really got an OpenAI-style streaming request
        const chat = stubRequests.find(r => r.url.startsWith('/chat/completions'));
        expect(chat.body.model).toBe('stub-model');
        expect(chat.body.stream).toBe(true);
        expect(chat.body.messages.some(m => m.role === 'user' && m.content.includes('mail badge')))
            .toBe(true);
    });

    it('Accept applies the proposal to the canvas', async () => {
        await page.locator('feezal-ai-chat .card .btn.primary').click();

        await page.locator('feezal-site > feezal-view feezal-element-material-badge')
            .waitFor({timeout: 15_000});
        const subscribe = await page
            .locator('feezal-site > feezal-view feezal-element-material-badge')
            .getAttribute('subscribe');
        expect(subscribe).toBe('stat/mail');
    });
});
