/**
 * E2E smoke test for the slim Monaco entry (src/monaco-slim.js):
 *   - feezal-template-editor renders a working Monaco instance (html + js)
 *   - only the languages feezal uses are registered (no lua/pascal/…)
 *   - the typescript worker actually spawns (worker chunks served correctly)
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {startStack, stopStack} from './harness.js';

let stack;

beforeAll(async () => {
    stack = await startStack();
}, 60_000);

afterAll(async () => {
    if (stack.pageErrors.length) console.error('PAGE ERRORS:', stack.pageErrors);
    await stopStack(stack);
});

describe('monaco slim bundle', () => {
    it('loads, tokenizes html and javascript, registers only needed languages', async () => {
        const page = stack.page;
        await page.goto(`${stack.baseUrl}/editor/`);
        await page.waitForSelector('feezal-palette .element', {timeout: 60_000});

        // Expose the monaco namespace as window.monaco (initialize.js honours
        // MonacoEnvironment.globalAPI) — monaco has not been lazy-loaded yet.
        await page.evaluate(() => {
            window.MonacoEnvironment = {...window.MonacoEnvironment, globalAPI: true};
            // position:fixed on-screen — Monaco virtualizes line rendering and
            // paints nothing for editors outside the viewport.
            const html = document.createElement('feezal-template-editor');
            html.id = 'smoke-html';
            html.style.cssText = 'position:fixed;top:0;left:0;width:500px;z-index:99999;background:#fff';
            html.value = '<b style="color:red">${msg.payload}</b>';
            document.body.append(html);

            const js = document.createElement('feezal-template-editor');
            js.id = 'smoke-js';
            js.style.cssText = 'position:fixed;top:260px;left:0;width:500px;z-index:99999;background:#fff';
            js.language = 'javascript';
            js.typedefs = 'declare const fzl: { pub(topic: string, value: any): void };';
            js.value = 'const x = 1;\nfzl.pub("a/b", x);';
            document.body.append(js);
        });

        // Both editors render Monaco with real syntax-highlight tokens (.mtk*).
        for (const id of ['smoke-html', 'smoke-js']) {
            try {
                await page.waitForFunction(sel => {
                    const el = document.querySelector(sel);
                    const lines = el?.shadowRoot?.querySelector('.monaco-editor .view-lines');
                    return lines && lines.querySelector('[class*="mtk"]') && lines.textContent.length > 5;
                }, `#${id}`, {timeout: 30_000});
            } catch (error) {
                const debug = await page.evaluate(sel => {
                    const el = document.querySelector(sel);
                    return {
                        defined: Boolean(customElements.get('feezal-template-editor')),
                        exists: Boolean(el),
                        loading: el?._loading,
                        shadow: el?.shadowRoot?.innerHTML.slice(0, 800)
                    };
                }, `#${id}`);
                console.error('DEBUG', id, JSON.stringify(debug, null, 2));
                console.error('PAGE ERRORS SO FAR:', stack.pageErrors);
                throw error;
            }
        }

        // Language registry: what we need is there, the ~80 unused ones are not.
        const languages = await page.evaluate(() => window.monaco.languages.getLanguages().map(l => l.id));
        for (const need of ['html', 'css', 'javascript', 'typescript']) {
            expect(languages).toContain(need);
        }
        for (const gone of ['lua', 'pascal', 'powershell', 'python', 'solidity', 'sql', 'json']) {
            expect(languages).not.toContain(gone);
        }

        // The language service APIs editor.main.js normally exposes are wired up
        // (feezal-template-editor relies on typescript.javascriptDefaults).
        expect(await page.evaluate(() =>
            Boolean(window.monaco.languages.typescript?.javascriptDefaults) &&
            Boolean(window.monaco.languages.html) &&
            Boolean(window.monaco.languages.css))).toBe(true);

        // The typescript worker really spawns (worker chunk resolves + boots).
        expect(await page.evaluate(async () => {
            const getWorker = await window.monaco.languages.typescript.getJavaScriptWorker();
            const worker = await getWorker();
            return typeof worker.getSemanticDiagnostics === 'function';
        })).toBe(true);

        expect(stack.pageErrors).toEqual([]);
    }, 120_000);
});
