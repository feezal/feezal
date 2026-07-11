import {LitElement, html, css} from 'lit';
import {loadMonaco, syncMonacoStyles} from './feezal-monaco-loader.js';

/**
 * feezal-template-editor
 *
 * A Lit element that wraps a Monaco editor instance for use in the attribute
 * inspector. Rendered when an attribute descriptor has `editor: true`.
 *
 * Props:
 *   - value {string}      Current template string.
 *   - label {string}      Label shown above the editor.
 *   - variables {Array}   Variable names in scope (e.g. ['msg', 'seconds']).
 *   - darkMode {boolean}  Sync Monaco theme to editor dark mode.
 *   - language {string}   Monaco language id (default 'html'). E49 script
 *                         editing passes 'javascript'.
 *   - typedefs {string}   Optional .d.ts source registered as an extra lib
 *                         for the JS language service (completions/hover for
 *                         e.g. the fzl API). Only used with language
 *                         'javascript'/'typescript'.
 *
 * Events:
 *   - feezal-change  Fired (debounced 300 ms) when content changes.
 *                    detail: { value: string }
 */

// addExtraLib must happen once per unique typedef source, not per editor
// instance — the language service is global.
const _registeredTypedefs = new Set();

class FeezalTemplateEditor extends LitElement {
    static properties = {
        value:     {type: String},
        label:     {type: String},
        variables: {type: Array},
        darkMode:  {type: Boolean},
        language:  {type: String},
        typedefs:  {type: String},
        _loading:  {state: true},
        _expanded: {state: true}
    };

    static styles = css`
        :host { display: block; }

        .label-row {
            display: flex; align-items: center; gap: 4px;
            font-size: 12px; color: var(--sl-input-label-color, #666);
            margin-bottom: 4px;
        }
        .label-row span { flex: 1; }
        .icon-btn {
            background: none; border: none; cursor: pointer; padding: 2px 4px;
            border-radius: 3px; color: var(--feezal-color, #555); font-size: 14px;
            line-height: 1; display: flex; align-items: center;
        }
        .icon-btn:hover { background: rgba(0,0,0,0.08); }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .icon-btn .material-icons { font-size: 16px; }

        .editor-wrap {
            position: relative;
            border: 1px solid var(--sl-input-border-color, #ccc);
            border-radius: 4px;
            overflow: hidden;
            height: 180px;
            min-height: 80px;
        }
        .editor-wrap.loading { display: flex; align-items: center; justify-content: center; }
        .spinner {
            width: 18px; height: 18px;
            border: 2px solid rgba(128,128,128,0.3);
            border-top-color: var(--sl-color-primary-600, #0284c7);
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Expanded full-screen editor ──────────────────── */
        .overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: var(--feezal-bg, #fff);
            display: flex; flex-direction: column;
        }
        .overlay-header {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px;
            border-bottom: 1px solid var(--feezal-border, #ddd);
            flex-shrink: 0; font-size: 13px; font-weight: 500;
            color: var(--feezal-color, #333);
            background: var(--feezal-bg, #f8f8f8);
        }
        .overlay-header span { flex: 1; }
        .overlay-editor { flex: 1; min-height: 0; }
    `;

    constructor() {
        super();
        this.value     = '';
        this.label     = 'template';
        this.variables = ['msg'];
        this.darkMode  = false;
        this.language  = 'html';
        this.typedefs  = '';
        this._loading  = true;
        this._expanded = false;
        this._editor   = null;         // inline Monaco instance
        this._overlayEditor = null;    // overlay Monaco instance
        this._debounceTimer = null;
        this._resizeObserver = null;
        this._providerDispose = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._editor?.dispose();
        this._overlayEditor?.dispose();
        this._providerDispose?.dispose();
        this._resizeObserver?.disconnect();
        clearTimeout(this._debounceTimer);
    }

    updated(changed) {
        // Sync value from outside into the editor (avoid cursor jump if same content)
        if (changed.has('value') && this._editor) {
            const current = this._editor.getValue();
            if (current !== this.value) {
                this._editor.setValue(this.value ?? '');
            }
        }
        if (changed.has('value') && this._overlayEditor) {
            const current = this._overlayEditor.getValue();
            if (current !== this.value) {
                this._overlayEditor.setValue(this.value ?? '');
            }
        }
        if (changed.has('darkMode')) {
            const theme = this.darkMode ? 'vs-dark' : 'vs';
            this._editor?.updateOptions({theme});
            this._overlayEditor?.updateOptions({theme});
            syncMonacoStyles(this.shadowRoot);
        }
    }

    render() {
        return html`
            <div class="label-row">
                <span>${this.label}</span>
                <button class="icon-btn" title="Expand editor" @click="${this._toggleExpand}">
                    <span class="material-icons">open_in_full</span>
                </button>
            </div>
            <div class="editor-wrap ${this._loading ? 'loading' : ''}"
                 id="editor-wrap">
                ${this._loading ? html`<div class="spinner"></div>` : ''}
            </div>

            ${this._expanded ? html`
                <div class="overlay" @keydown="${this._onOverlayKeydown}">
                    <div class="overlay-header">
                        <button class="icon-btn" title="Return to embedded editor" @click="${this._toggleExpand}">
                            <span class="material-icons">close_fullscreen</span>
                        </button>
                        <span>${this.label}</span>
                    </div>
                    <div class="overlay-editor" id="overlay-wrap"></div>
                </div>
            ` : ''}
        `;
    }

    firstUpdated() {
        this._initInlineEditor();
    }

    async _initInlineEditor() {
        const monaco = await loadMonaco();
        this._loading = false;
        await this.updateComplete;

        const wrap = this.shadowRoot.getElementById('editor-wrap');
        if (!wrap) return;

        this._registerCompletions(monaco);
        this._registerTypedefs(monaco);

        const theme = this.darkMode ? 'vs-dark' : 'vs';
        this._editor = monaco.editor.create(wrap, {
            value:            this.value ?? '',
            language:         this.language || 'html',
            theme,
            minimap:          {enabled: false},
            lineNumbers:      'on',
            automaticLayout:  true,
            scrollBeyondLastLine: false,
            fontSize:         12,
            fontFamily:       'Consolas, "Courier New", monospace',
            wordWrap:         'on',
            tabSize:          2
        });

        this._editor.onDidChangeModelContent(() => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this.dispatchEvent(new CustomEvent('feezal-change', {
                    detail: {value: this._editor.getValue()},
                    bubbles: true, composed: true
                }));
            }, 300);
        });

        syncMonacoStyles(this.shadowRoot);
    }

    async _toggleExpand() {
        this._expanded = !this._expanded;
        if (!this._expanded) {
            // Sync back from overlay to inline before destroying
            if (this._overlayEditor) {
                const v = this._overlayEditor.getValue();
                this._editor?.setValue(v);
                this.dispatchEvent(new CustomEvent('feezal-change', {
                    detail: {value: v},
                    bubbles: true, composed: true
                }));
                this._overlayEditor.dispose();
                this._overlayEditor = null;
            }
            return;
        }

        await this.updateComplete;

        const monaco = await loadMonaco();
        const wrap = this.shadowRoot.getElementById('overlay-wrap');
        if (!wrap) return;

        const theme = this.darkMode ? 'vs-dark' : 'vs';
        this._overlayEditor = monaco.editor.create(wrap, {
            value:            this._editor?.getValue() ?? this.value ?? '',
            language:         this.language || 'html',
            theme,
            minimap:          {enabled: false},
            lineNumbers:      'on',
            automaticLayout:  true,
            scrollBeyondLastLine: false,
            fontSize:         13,
            fontFamily:       'Consolas, "Courier New", monospace',
            wordWrap:         'on',
            tabSize:          2
        });

        this._overlayEditor.onDidChangeModelContent(() => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                const v = this._overlayEditor.getValue();
                this._editor?.setValue(v);
                this.dispatchEvent(new CustomEvent('feezal-change', {
                    detail: {value: v},
                    bubbles: true, composed: true
                }));
            }, 300);
        });

        syncMonacoStyles(this.shadowRoot);
    }

    _onOverlayKeydown(e) {
        if (e.key === 'Escape') this._toggleExpand();
    }

    /**
     * E49: feed the JS language service the caller's typedefs (fzl API) so
     * script editing gets completions + hover docs. Global + once per source.
     */
    _registerTypedefs(monaco) {
        if (!this.typedefs || !/^(javascript|typescript)$/.test(this.language || '')) return;
        if (_registeredTypedefs.has(this.typedefs)) return;
        const defaults = monaco.languages.typescript?.javascriptDefaults;
        if (!defaults) return;
        _registeredTypedefs.add(this.typedefs);
        defaults.addExtraLib(this.typedefs, `ts:feezal-${_registeredTypedefs.size}.d.ts`);
    }

    /**
     * Register a completion provider for `${…}` expressions in HTML.
     * Phase 1: static suggestions from the `variables` descriptor field.
     */
    _registerCompletions(monaco) {
        if (this._providerDispose) return; // register once per component lifetime
        if ((this.language || 'html') !== 'html') return; // ${…} helper is HTML-template-only

        const getVars = () => this.variables || ['msg'];

        this._providerDispose = monaco.languages.registerCompletionItemProvider('html', {
            triggerCharacters: ['{', '.'],
            provideCompletionItems: (model, position) => {
                const line = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                // Only trigger inside ${…}
                const lastOpen = line.lastIndexOf('${');
                if (lastOpen === -1) return {suggestions: []};
                const fragment = line.slice(lastOpen + 2);

                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const vars = getVars();
                const suggestions = [];

                // msg.* completions
                if (vars.includes('msg') && (fragment === '' || fragment.startsWith('msg'))) {
                    const msgItems = [
                        ['msg.payload',                          'Full MQTT payload (string or parsed object)'],
                        ['msg.topic',                            'MQTT topic string'],
                        ['JSON.stringify(msg.payload, null, 2)', 'Pretty-printed payload']
                    ];
                    for (const [label, detail] of msgItems) {
                        suggestions.push({
                            label,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            detail,
                            insertText: label,
                            range
                        });
                    }
                }

                // Extra variables (e.g. seconds for countdown-dialog)
                for (const v of vars) {
                    if (v === 'msg') continue;
                    suggestions.push({
                        label: v,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        detail: `Available variable: ${v}`,
                        insertText: v,
                        range
                    });
                }

                return {suggestions};
            }
        });
    }
}

customElements.define('feezal-template-editor', FeezalTemplateEditor);
export {FeezalTemplateEditor};
