import {describe, it, expect, beforeEach} from 'vitest';

import '../src/feezal-ai-chat.js';

const CATALOGUE_PKGS = [
    '@feezal/feezal-element-material-switch',
    '@feezal/feezal-element-paper-switch',
    '@feezal/feezal-element-basic-image',
    '@feezal/feezal-element-material-button'
];

function makeChat() {
    const chat = document.createElement('feezal-ai-chat');
    // _catalogue() normally introspects registered custom elements; pre-fill
    // its cache so tag correction can be tested without loading element packages.
    chat._catalogueCache = CATALOGUE_PKGS.map(p => ({tag: p.replace(/^@[^/]+\//, '')}));
    return chat;
}

beforeEach(() => {
    feezal.elements = CATALOGUE_PKGS;
});

describe('_parseFrame() — SSE frame parsing', () => {
    const chat = document.createElement('feezal-ai-chat');

    it('parses event and JSON data lines', () => {
        expect(chat._parseFrame('event: token\ndata: {"token": "Hi"}')).toEqual({
            event: 'token', obj: {token: 'Hi'}
        });
    });

    it('defaults the event to "message"', () => {
        expect(chat._parseFrame('data: {"x":1}')).toEqual({event: 'message', obj: {x: 1}});
    });

    it('concatenates multiple data lines', () => {
        expect(chat._parseFrame('data: {"a":\ndata: 1}')).toEqual({event: 'message', obj: {a: 1}});
    });

    it('returns obj null for empty or malformed data', () => {
        expect(chat._parseFrame('event: done')).toEqual({event: 'done', obj: null});
        expect(chat._parseFrame('data: {oops')).toEqual({event: 'message', obj: null});
    });
});

describe('_extractHtml() — fenced code extraction', () => {
    const chat = document.createElement('feezal-ai-chat');

    it('extracts an ```html fence', () => {
        const text = 'Here you go:\n```html\n<div>x</div>\n```\ndone';
        expect(chat._extractHtml(text)).toBe('<div>x</div>');
    });

    it('extracts a generic fence only if it contains feezal elements', () => {
        expect(chat._extractHtml('```\n<feezal-element-material-switch></feezal-element-material-switch>\n```'))
            .toContain('feezal-element-material-switch');
        expect(chat._extractHtml('```\nconsole.log(1)\n```')).toBeNull();
    });

    it('returns null when there is no fence at all', () => {
        expect(chat._extractHtml('just an answer')).toBeNull();
    });
});

describe('_validate() — model output safety', () => {
    const chat = makeChat();

    it('accepts catalogue elements with plain attributes', () => {
        expect(chat._validate('<feezal-element-material-switch label="x"></feezal-element-material-switch>'))
            .toEqual({ok: true});
        expect(chat._validate('<div><p>hello</p></div>')).toEqual({ok: true});
    });

    it('rejects script and other blocked tags', () => {
        expect(chat._validate('<script>x</script>').ok).toBe(false);
        expect(chat._validate('<iframe src="x"></iframe>').ok).toBe(false);
        expect(chat._validate('<meta charset="utf-8">').ok).toBe(false);
    });

    it('rejects non-feezal custom elements', () => {
        expect(chat._validate('<my-widget></my-widget>').ok).toBe(false);
    });

    it('rejects feezal elements missing from the catalogue', () => {
        expect(chat._validate('<feezal-element-material-unicorn></feezal-element-material-unicorn>').ok).toBe(false);
    });

    it('rejects event-handler attributes and javascript: URLs', () => {
        expect(chat._validate('<div onclick="x()"></div>').ok).toBe(false);
        expect(chat._validate('<a href="javascript:alert(1)">x</a>').ok).toBe(false);
    });
});

describe('_correctTags() — hallucinated tag correction', () => {
    it('rewrites a category-less tag to the material variant', () => {
        const chat = makeChat();
        const {html, fixes} = chat._correctTags(
            '<feezal-element-switch topic="a"></feezal-element-switch>'
        );
        expect(html).toBe('<feezal-element-material-switch topic="a"></feezal-element-material-switch>');
        expect(fixes).toEqual([['feezal-element-switch', 'feezal-element-material-switch']]);
    });

    it('leaves known tags and unmatchable tags alone', () => {
        const chat = makeChat();
        const input = '<feezal-element-material-button></feezal-element-material-button>' +
                      '<feezal-element-frobnicator></feezal-element-frobnicator>';
        const {html, fixes} = chat._correctTags(input);
        expect(html).toBe(input);
        expect(fixes).toEqual([]);
    });

    it('reports each distinct fix once', () => {
        const chat = makeChat();
        const {fixes} = chat._correctTags(
            '<feezal-element-image></feezal-element-image><feezal-element-image></feezal-element-image>'
        );
        expect(fixes).toEqual([['feezal-element-image', 'feezal-element-basic-image']]);
    });

    it('does nothing when the catalogue is empty', () => {
        feezal.elements = [];
        const chat = makeChat();
        const input = '<feezal-element-switch></feezal-element-switch>';
        expect(chat._correctTags(input)).toEqual({html: input, fixes: []});
    });
});

describe('_bestTagMatch() — category preference', () => {
    const chat = document.createElement('feezal-ai-chat');
    const elements = CATALOGUE_PKGS.map(p => ({tag: p.replace(/^@[^/]+\//, '')}));

    it('prefers material over paper for the same element name', () => {
        expect(chat._bestTagMatch('feezal-element-switch', elements))
            .toBe('feezal-element-material-switch');
    });

    it('requires the element name (last segment) to match', () => {
        expect(chat._bestTagMatch('feezal-element-toggle', elements)).toBeNull();
    });
});
