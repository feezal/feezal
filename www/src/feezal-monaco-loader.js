// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal viewer runtime
/**
 * feezal-monaco-loader.js
 *
 * Shared lazy-loader for Monaco Editor. All Monaco consumers in the editor
 * (feezal-template-editor, feezal-app-editor source view, feezal-sidebar-history
 * diff overlay) import and call loadMonaco() from here.
 *
 * Monaco is bundled by vite-plugin-monaco-editor as a set of separate async
 * chunks — the main editor bundle stays small and Monaco is fetched + cached
 * only on first use. The viewer bundle never imports this module.
 *
 * Imports ./monaco-slim.js (html/css/javascript only) instead of the stock
 * 'monaco-editor' entry, which would bundle tokenizers for ~80 languages.
 */

let _promise = null;

/**
 * Load monaco lazily (once). Returns the monaco namespace.
 * @returns {Promise<import('monaco-editor')>}
 */
export function loadMonaco() {
    if (_promise) return _promise;
    _promise = import('./monaco-slim.js');
    return _promise;
}

/**
 * Copy Monaco's document.head styles into a shadow root.
 *
 * Monaco injects CSS into document.head using class selectors (.monaco-editor,
 * .mtk*, codicon, etc.).  These selectors do NOT penetrate shadow DOM, causing:
 *   - The .inputarea textarea to lose position:absolute → appears as a visible
 *     block-level input above the editor
 *   - Background colour and line-number colours to be missing
 *
 * Call this after monaco.editor.create() / createDiffEditor() and again after
 * any theme change (updateOptions({theme}) or setTheme()).  Each call removes
 * previous copies from the shadow root and re-clones the current state.
 *
 * @param {ShadowRoot} shadowRoot
 */
// Marks the constructed CSSStyleSheet we inject, so we can find/replace it later.
const MONACO_SHEET = Symbol('feezalMonacoSheet');

/**
 * Collect all of Monaco's CSS rules from the main document into a single string.
 *
 * Monaco's CSS lives in two places and BOTH must be captured:
 *   1. An external .css file (Vite extracts it from the editor chunk) loaded via
 *      <link rel="stylesheet"> — this contains .inputarea { position:absolute },
 *      .mtk* token colours, codicon @font-face, etc.
 *   2. <style> elements Monaco injects at runtime via sheet.insertRule() for the
 *      active theme (background, line numbers, selection colours).
 *
 * document.styleSheets covers both <link> and <style> sheets.
 */
function collectMonacoCss() {
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
            rules = Array.from(sheet.cssRules || []);
        } catch {
            continue; // SecurityError on cross-origin sheets
        }
        const text = rules.map(r => r.cssText).join('\n');
        if (text.includes('.monaco-editor') || text.includes('.mtk') || text.includes('codicon')) {
            css += text + '\n';
        }
    }
    return css;
}

/**
 * Make Monaco's CSS apply inside a shadow root.
 *
 * Monaco styles document.head with class selectors (.monaco-editor, .mtk*,
 * codicon, …) which do NOT penetrate shadow DOM, causing:
 *   - the .inputarea textarea to lose position:absolute → a visible block-level
 *     input appears above the editor
 *   - background / line-number / token colours to be missing
 *
 * NOTE: you cannot adopt a <link>/<style> sheet directly — adoptedStyleSheets
 * only accepts *constructed* sheets (otherwise it throws "Can't adopt
 * non-constructed stylesheets").  So we copy Monaco's rules into a freshly
 * constructed CSSStyleSheet and adopt that.
 *
 * Call after monaco.editor.create()/createDiffEditor() and again after any
 * theme change (updateOptions({theme}) / setTheme()) so the latest theme rules
 * are re-copied.
 *
 * @param {ShadowRoot} shadowRoot
 */
export function syncMonacoStyles(shadowRoot) {
    if (!shadowRoot) return;

    const css = collectMonacoCss();
    if (!css) return;

    const supportsConstructed =
        typeof shadowRoot.adoptedStyleSheets !== 'undefined' &&
        typeof CSSStyleSheet !== 'undefined' &&
        // feature-detect replaceSync (constructed stylesheets)
        (() => { try { new CSSStyleSheet(); return true; } catch { return false; } })();

    if (supportsConstructed) {
        // Reuse our previously-adopted sheet if present, else create a new one.
        let sheet = shadowRoot.adoptedStyleSheets.find(s => s[MONACO_SHEET]);
        if (!sheet) {
            sheet = new CSSStyleSheet();
            sheet[MONACO_SHEET] = true;
            shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
        }
        try {
            sheet.replaceSync(css);
        } catch { /* malformed rule — ignore */ }
        return;
    }

    // Fallback for browsers without constructed stylesheets: inject a <style>.
    shadowRoot.querySelectorAll('style[data-feezal-monaco]').forEach(s => s.remove());
    const el = document.createElement('style');
    el.textContent = css;
    el.setAttribute('data-feezal-monaco', '');
    shadowRoot.appendChild(el);
}
