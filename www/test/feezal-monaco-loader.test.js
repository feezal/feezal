import {describe, it, expect, afterEach} from 'vitest';

import {syncMonacoStyles} from '../src/feezal-monaco-loader.js';

// Copies Monaco's document-level CSS into a shadow root (Monaco styles
// document.head with class selectors that do not penetrate shadow DOM).
function addHeadStyle(cssText) {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.append(style);
    return style;
}

function makeShadowRoot() {
    const host = document.createElement('div');
    document.body.append(host);
    return host.attachShadow({mode: 'open'});
}

const added = [];

afterEach(() => {
    added.splice(0).forEach(style => style.remove());
});

function withMonacoCss() {
    added.push(addHeadStyle('.monaco-editor { background: rgb(30, 30, 30); } .mtk1 { color: red; }'));
}

describe('syncMonacoStyles()', () => {
    it('does nothing without a shadow root or without Monaco CSS in the document', () => {
        expect(() => syncMonacoStyles(null)).not.toThrow();

        const shadow = makeShadowRoot();
        syncMonacoStyles(shadow);   // no Monaco CSS present
        expect(shadow.adoptedStyleSheets).toHaveLength(0);
        expect(shadow.querySelectorAll('style[data-feezal-monaco]')).toHaveLength(0);
    });

    it('copies Monaco rules into the shadow root', () => {
        withMonacoCss();
        const shadow = makeShadowRoot();
        syncMonacoStyles(shadow);

        const adoptedCss = shadow.adoptedStyleSheets
            .map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n'))
            .join('\n');
        const styleCss = [...shadow.querySelectorAll('style[data-feezal-monaco]')]
            .map(style => style.textContent).join('\n');

        expect(adoptedCss + styleCss).toContain('.monaco-editor');
    });

    it('reuses its sheet on repeated calls instead of stacking copies', () => {
        withMonacoCss();
        const shadow = makeShadowRoot();
        syncMonacoStyles(shadow);
        syncMonacoStyles(shadow);

        const total = shadow.adoptedStyleSheets.length +
            shadow.querySelectorAll('style[data-feezal-monaco]').length;
        expect(total).toBe(1);
    });

    it('ignores unrelated document styles', () => {
        added.push(addHeadStyle('.unrelated { color: blue; }'));
        withMonacoCss();
        const shadow = makeShadowRoot();
        syncMonacoStyles(shadow);

        const adoptedCss = shadow.adoptedStyleSheets
            .map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n'))
            .join('\n');
        const styleCss = [...shadow.querySelectorAll('style[data-feezal-monaco]')]
            .map(style => style.textContent).join('\n');

        expect(adoptedCss + styleCss).not.toContain('.unrelated');
    });
});
