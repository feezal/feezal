/**
 * Tests for the agent-mode branch of ai/prompt.js: in agent mode the element
 * catalogue and full topic dump are replaced by tool pointers (saves tokens,
 * forces grounded tool use), while non-agent mode inlines them.
 */
import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const {buildSystemPrompt} = require('../src/ai/prompt.js');

const ctx = {
    viewName: 'home',
    viewHtml: '<feezal-element-basic-gauge></feezal-element-basic-gauge>',
    elements: [{tag: 'feezal-element-basic-gauge', name: 'Gauge', attributes: ['subscribe']}],
    topics: ['home/temp', 'home/hum'],
};

describe('non-agent mode', () => {
    it('inlines the element catalogue and the known-topics list', () => {
        const p = buildSystemPrompt({...ctx, agent: false});
        expect(p).toContain('# Element catalogue (JSON)');
        expect(p).toContain('feezal-element-basic-gauge');
        expect(p).toContain('home/temp');
        // The agent-mode tools block is absent (the Element rules still mention
        // search_elements once, so key on the block header instead).
        expect(p).not.toContain('# Tools (agent mode');
    });
});

describe('agent mode', () => {
    it('replaces the catalogue and topic dump with tool pointers', () => {
        const p = buildSystemPrompt({...ctx, agent: true});
        // Tools section present
        expect(p).toContain('search_elements');
        expect(p).toContain('search_discovery');
        expect(p).toContain('get_topic_payload');
        // Catalogue NOT inlined
        expect(p).toContain('The element catalogue is NOT inlined');
        expect(p).not.toContain('# Element catalogue (JSON)');
        // Full topic list NOT dumped
        expect(p).not.toContain('home/temp');
    });

    it('still carries the load-bearing output contract and the current view HTML', () => {
        const p = buildSystemPrompt({...ctx, agent: true});
        expect(p).toMatch(/COMPLETE/);
        expect(p).toContain('```html');
        expect(p).toContain('<feezal-element-basic-gauge>');
    });
});
