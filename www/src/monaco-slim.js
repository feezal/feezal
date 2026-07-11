// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
/**
 * monaco-slim.js
 *
 * Slim Monaco entry point. The stock package entry
 * (monaco-editor/esm/vs/editor/editor.main.js) bundles the tokenizers for all
 * ~80 basic languages (lua, pascal, powershell, solidity, …) plus the json
 * language service. feezal only ever creates models with language 'html' or
 * 'javascript' (see feezal-template-editor, feezal-app-editor source view,
 * feezal-history-bar diff), so this module mirrors editor.main.js with just:
 *
 *   - edcore.main.js — the complete standalone editor (every editing feature,
 *     command palette, diff editor, codicon font) but zero languages
 *   - basic-language tokenizers for html, css, javascript, typescript
 *     (the html tokenizer delegates embedded <style>/<script> blocks to the
 *     css and javascript tokenizers, so all four are required)
 *   - the worker-backed language services for html, css and typescript
 *     (the typescript service also powers javascript — completions, hover,
 *     typedefs for the fzl API in system-script)
 *
 * The corresponding workers are configured in vite.config.js
 * (monacoEditorPlugin languageWorkers). If an element ever needs another
 * language, add its basic-languages contribution here — and, if it has a
 * worker-backed service, add that to both this file and vite.config.js.
 *
 * Keep in sync with editor.main.js when upgrading monaco-editor (currently
 * 0.55): this file replicates its structure minus the unused languages.
 */

// Worker-backed language services. Namespace imports are re-exposed on
// monaco.languages.* below, exactly like editor.main.js does — consumers rely
// on monaco.languages.typescript.javascriptDefaults (addExtraLib for the fzl
// API typedefs).
import * as cssLanguage from 'monaco-editor/esm/vs/language/css/monaco.contribution.js';
import * as htmlLanguage from 'monaco-editor/esm/vs/language/html/monaco.contribution.js';
import * as typescriptLanguage from 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';

// Basic-language tokenizers (syntax highlighting, brackets, folding markers).
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';

import {getGlobalMonaco} from 'monaco-editor/esm/vs/editor/internal/initialize.js';

const monacoApi = getGlobalMonaco();
monacoApi.languages.css = cssLanguage;
monacoApi.languages.html = htmlLanguage;
monacoApi.languages.typescript = typescriptLanguage;

export {
    CancellationTokenSource, Emitter, KeyCode, KeyMod, MarkerSeverity, MarkerTag,
    Position, Range, Selection, SelectionDirection, Token, Uri, editor, languages
} from 'monaco-editor/esm/vs/editor/edcore.main.js';
