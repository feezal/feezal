/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css, resolveFeezalId} from '@feezal/feezal-element';
import {LitElement} from 'lit';

/**
 * feezal-element-system-script (E49)
 *
 * Client-side scripting glue — subscribe to topics, compute, publish the
 * result page-locally (or to the broker), and any display element shows it.
 * Deliberately minimal presentation-side logic, NOT an automation engine:
 * anything that must run reliably 24/7 belongs in she / Node-RED.
 *
 * Decisions (all settled in the roadmap, July 2026):
 * - Scripts run in the VIEWER ONLY, on the main thread, with full DOM
 *   access — no sandbox. Dashboard authors hold the editor password, so
 *   scripts are trusted code; the flip side (a busy loop freezes the page)
 *   is documented, not engineered away. They NEVER run in the editor: the
 *   editor serializes the light DOM on save, so script-made DOM mutations
 *   would be persisted into the dashboard.
 * - Source is stored in a `<script type="text/feezal">` child — browsers
 *   parse typed scripts as raw text (code containing `<` survives HTML
 *   parsing) and never execute unknown types.
 * - Each script runs once per page load in its own function scope
 *   (top-level const/let don't collide between script elements); edits
 *   apply on the next viewer page load (`<site>/reload` pushes one).
 * - Local publishes use ordinary topic names with the {local: true} flag —
 *   no reserved namespace, no retain/replay (a late subscriber has no value
 *   until the script's next publish, same mental model as any non-retained
 *   broker topic).
 * - Payloads: the connection already delivers `{`/`[` JSON payloads parsed;
 *   fzl mirrors that (objects/arrays in both directions, everything else
 *   stays a string — no `"1.5"` vs `1.5` ambiguity).
 *
 * Caveats (documented, deliberate):
 * - `fzl.mqtt.pub` in a timer fires once per connected viewer.
 * - `new Function` needs `script-src 'unsafe-eval'` under a strict CSP.
 * - DOM changes made by scripts are per-client and ephemeral.
 */

/** fzl API typedefs — Monaco completions in the script inspector. */
export const FZL_DTS = `
/** feezal script API — available as \`fzl\` in every script element. */
declare const fzl: {
    /**
     * Subscribe to a topic (MQTT wildcards + and # allowed). Origin-agnostic:
     * receives broker messages AND page-local fzl.pub() messages alike.
     * JSON object/array payloads arrive parsed; everything else is a string.
     * @returns an unsubscribe function
     */
    sub(topic: string, callback: (payload: any, topic: string) => void): () => void;
    /**
     * Publish page-locally: only elements/scripts on THIS page receive it,
     * nothing reaches the broker and nothing is retained/replayed.
     * Objects/arrays are JSON.stringified, other values become strings.
     */
    pub(topic: string, value: any): void;
    mqtt: {
        /**
         * Publish to the MQTT broker. Runs in EVERY open viewer — a
         * setInterval publishing here fires once per connected client.
         */
        pub(topic: string, value: any, options?: {retain?: boolean}): void;
    };
    /**
     * Active-view hook: fires with the current view name immediately on
     * registration and again on every view switch (any source).
     */
    onViewChange(callback: (viewName: string) => void): void;
    /** console.log prefixed with this script element's name. */
    log(...args: any[]): void;
    /**
     * The element carrying this feezal-id (set in the inspector). Resolution:
     * the VISIBLE occurrence first, then document order — embedded/cloned
     * views may hold copies. null when none exists.
     */
    el(feezalId: string): HTMLElement | null;
    /**
     * Read (one argument) or set (two arguments) the public .value of the
     * element with this feezal-id — inputs, selects, sliders, checkboxes,
     * radios, switches. undefined when the element is missing.
     */
    val(feezalId: string, value?: any): any;
    /**
     * Listen to an element's public events by feezal-id. Short names map to
     * the contract events: 'change' → feezal-change, 'press' → feezal-press,
     * 'blur' / 'keyup' / 'keydown' → feezal-blur / -keyup / -keydown. The
     * callback gets (detail, event); detail.value is the current value,
     * detail.key the key for keyboard events. Works for copies stamped later.
     * @returns a function that removes the listener
     */
    on(feezalId: string, event: 'change' | 'press' | 'blur' | 'keyup' | 'keydown' | string,
       callback: (detail: any, event: CustomEvent) => void): () => void;
    /** Read the active view name (no argument) or switch to a view (name). */
    view(name?: string): string;
};
`;

/** fzl.on short names → the composed contract events (prefixed names pass through). */
export const FZL_EVENT_NAMES = {
    change: 'feezal-change', press: 'feezal-press',
    blur: 'feezal-blur', keyup: 'feezal-keyup', keydown: 'feezal-keydown',
};

/**
 * The `fzl` API object, shared by every script host (system-script, E178
 * system-form). `prefix` names the host in console output; `onViewChange`
 * is the host's view-change hook (a form host may omit it).
 */
export function createFzl({prefix = '[feezal-script]', onViewChange = null} = {}) {
    const deliver = FeezalElementSystemScript.deliverPayload;
    const serialize = FeezalElementSystemScript.serializePayload;

    return {
        sub: (topic, callback) => {
            // Registers directly with the connection — not gated by
            // dynamic-subscriptions; scripts run independent of views.
            const sub = feezal.connection.sub(topic, msg => {
                try {
                    callback(deliver(msg.payload), msg.topic);
                } catch (err) {
                    console.error(prefix, 'uncaught error in sub callback:', err);
                }
            });
            return () => feezal.connection.unsubscribe(sub);
        },

        pub: (topic, value) => {
            // Page-local, no retain — nothing replays it (decided).
            feezal.connection.pub(topic, serialize(value), {local: true});
        },

        mqtt: {
            pub: (topic, value, options = {}) => {
                feezal.connection.pub(topic, serialize(value), {retain: options.retain === true});
            },
        },

        onViewChange: callback => onViewChange?.(callback),

        log: (...args) => console.log(prefix, ...args),

        // ── U113: scoped lookup by feezal-id ──
        el: feezalId => resolveFeezalId(feezalId),

        val: (feezalId, ...rest) => {
            const el = resolveFeezalId(feezalId);
            if (!el) return undefined;
            if (rest.length) {
                el.value = rest[0];
                return rest[0];
            }
            return el.value;
        },

        on: (feezalId, event, callback) => {
            const type = FZL_EVENT_NAMES[event] || event;
            // Listen at the document: the contract events are composed and
            // bubble, and a document-level listener also covers copies of
            // the element stamped AFTER the script ran (N40 clones, U32
            // component instances) — the filter is the id, not the node.
            const handler = e => {
                const host = e.composedPath?.().find(n => n?.getAttribute?.('feezal-id') === feezalId)
                    ?? (e.target?.getAttribute?.('feezal-id') === feezalId ? e.target : null);
                if (!host) return;
                try {
                    callback(e.detail ?? {}, e);
                } catch (err) {
                    console.error(prefix, 'uncaught error in on() callback:', err);
                }
            };
            document.addEventListener(type, handler);
            return () => document.removeEventListener(type, handler);
        },

        view: (...rest) => {
            const site = feezal.site || document.querySelector('feezal-site');
            if (rest.length && site) site.view = rest[0];
            return site?.view ?? site?.getAttribute?.('view') ?? '';
        },
    };
}

class FeezalElementSystemScript extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Script', category: 'System', color: '#455a64', icon: 'code'},
            description: 'Client-side script (viewer only): subscribe, compute, publish page-locally or ' +
                'to the broker. Pseudo-element — position/size don\'t matter. Edits apply on the next ' +
                'viewer page load. Scripts are trusted code with full DOM access; logic that must run ' +
                'reliably 24/7 belongs in she/Node-RED, not here.',
            attributes: [
                {name: 'name', type: 'string', help: 'Script name — shown on the editor chip and used as the console log prefix.'},
            ],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '160px', height: '40px'},
            inspector: 'feezal-element-system-script-inspector',
        };
    }

    static properties = {
        name: {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; }

        /* Editor chip */
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; font-size: 11px; text-align: center; overflow: hidden;
            color: var(--secondary-text-color);
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
        }
        .ph .material-icons { font-family: 'Material Icons'; font-size: 16px; }
    `];

    constructor() {
        super();
        this.name = '';
        this._ran = false;
        this._viewCallbacks = null;
        this._viewObserver = null;
        this._onConnected = null;
    }

    // No element-level MQTT — scripts manage their own subscriptions via fzl.
    _subscribe() { /* managed by the script */ }

    connectedCallback() {
        super.connectedCallback();
        // Hard rule: scripts never run in editor mode (the editor would
        // serialize script-made DOM mutations into the saved dashboard).
        if (feezal.isEditor || this._ran) {
            return;
        }
        if (feezal.connection?.connected) {
            this.runScript();
        } else {
            this._onConnected = () => this.runScript();
            document.addEventListener('connected', this._onConnected, {once: true});
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._onConnected) {
            document.removeEventListener('connected', this._onConnected);
            this._onConnected = null;
        }
        this._viewObserver?.disconnect();
        this._viewObserver = null;
        // Deliberately NOT torn down: fzl subscriptions, timers, DOM changes —
        // scripts run once per page load; there is no hot restart.
    }

    /** Read the source from the `<script type="text/feezal">` child. */
    get scriptSource() {
        return this.querySelector('script[type="text/feezal"]')?.textContent ?? '';
    }

    get logPrefix() {
        return `[${this.name || 'feezal-script'}]`;
    }

    /** Execute the script once, in its own (async) function scope. */
    runScript() {
        if (this._ran) {
            return;
        }
        this._ran = true;

        const source = this.scriptSource;
        if (!source.trim()) {
            return;
        }

        const fzl = this.makeFzl();
        try {
            // Async wrapper: top-level await works; per-script function scope
            // keeps const/let from colliding between script elements.
            const fn = new Function('fzl', `'use strict';\nreturn (async () => {\n${source}\n})();`);
            Promise.resolve(fn.call(undefined, fzl))
                .catch(err => console.error(this.logPrefix, 'uncaught error:', err));
        } catch (err) {
            console.error(this.logPrefix, 'uncaught error:', err);
        }
    }

    /** Deliver payloads per the E49 convention: objects/arrays parsed, everything else a string. */
    static deliverPayload(payload) {
        if (payload !== null && typeof payload === 'object') {
            return payload;   // the connection already parses {/[ payloads
        }
        const s = String(payload ?? '');
        const t = s.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
            try {
                return JSON.parse(t);
            } catch { /* raw string on parse failure */ }
        }
        return s;
    }

    /** Serialize per the E49 convention: objects/arrays stringified, everything else String(). */
    static serializePayload(value) {
        return (value !== null && typeof value === 'object') ? JSON.stringify(value) : String(value);
    }

    /** Build the per-script fzl API object. */
    makeFzl() {
        return createFzl({prefix: this.logPrefix, onViewChange: cb => this._onViewChange(cb)});
    }

    _onViewChange(callback) {
        const site = document.querySelector('feezal-site');
        if (!site) {
            return;
        }
        if (!this._viewCallbacks) {
            this._viewCallbacks = [];
            this._viewObserver = new MutationObserver(() => {
                const view = site.getAttribute('view') || '';
                for (const cb of this._viewCallbacks) {
                    try {
                        cb(view);
                    } catch (err) {
                        console.error(this.logPrefix, 'uncaught error in onViewChange callback:', err);
                    }
                }
            });
            this._viewObserver.observe(site, {attributes: true, attributeFilter: ['view']});
        }
        this._viewCallbacks.push(callback);
        // Fires with the current view on registration (decided).
        try {
            callback(site.getAttribute('view') || '');
        } catch (err) {
            console.error(this.logPrefix, 'uncaught error in onViewChange callback:', err);
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="ph"><span class="material-icons">code</span> ${this.name || 'Script'}</div>`;
        }
        // Viewer: invisible — the script does the work.
        return html``;
    }
}

customElements.define('feezal-element-system-script', FeezalElementSystemScript);

// ── Custom inspector ─────────────────────────────────────────────────────────
// Editor-only. Uses <sl-*> and <feezal-template-editor> (both defined by the
// editor bundle) without importing them — same pattern as system-notification.

class FeezalElementSystemScriptInspector extends LitElement {
    static properties = {
        element: {attribute: false},
    };

    static styles = css`
        :host { display: block; padding: 12px; }
        .row { margin-bottom: 10px; }
        sl-input { width: 100%; }
        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .hint {
            font-size: 11px; line-height: 1.5; color: var(--feezal-color, #888);
            margin-top: 10px;
        }
        .hint code { font-size: 10px; }
    `;

    constructor() {
        super();
        this.element = null;
    }

    _setName(value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true,
            detail: {name: 'name', value},
        }));
    }

    /** Write the source into the `<script type="text/feezal">` child. */
    _setScript(value) {
        const el = this.element;
        if (!el) {
            return;
        }
        let script = el.querySelector('script[type="text/feezal"]');
        if (!script) {
            script = document.createElement('script');
            script.setAttribute('type', 'text/feezal');
            el.append(script);
        }
        script.textContent = value;
        feezal.app.change();
    }

    render() {
        if (!this.element) {
            return html``;
        }
        return html`
            <div class="row">
                <sl-input label="name" size="small" autocomplete="off"
                    .value=${this.element.name || ''}
                    @sl-change=${e => this._setName(e.target.value)}>
                </sl-input>
            </div>
            <feezal-template-editor
                .label=${'script (runs in the viewer)'}
                .language=${'javascript'}
                .typedefs=${FZL_DTS}
                .value=${this.element.scriptSource}
                .darkMode=${window.feezal?.app?._darkMode ?? false}
                @feezal-change=${e => this._setScript(e.detail.value)}>
            </feezal-template-editor>
            <div class="hint">
                Runs once per viewer page load — never in the editor. Deploy, then reload
                the viewer (or publish to <code>&lt;site&gt;/reload</code>) to apply edits.
                API: <code>fzl.sub(topic, cb)</code> · <code>fzl.pub(topic, value)</code> (page-local)
                · <code>fzl.mqtt.pub(topic, value, {retain})</code> · <code>fzl.onViewChange(cb)</code>
                · <code>fzl.log(…)</code> · <code>fzl.el(id)</code> / <code>fzl.val(id)</code> /
                <code>fzl.on(id, 'change' | 'press', cb)</code> — elements by their
                <code>feezal-id</code> (set in the inspector) · <code>fzl.view(name)</code>.
                Full DOM access; broker publishes fire once per connected viewer.
            </div>
        `;
    }
}

customElements.define('feezal-element-system-script-inspector', FeezalElementSystemScriptInspector);

export {FeezalElementSystemScript};
