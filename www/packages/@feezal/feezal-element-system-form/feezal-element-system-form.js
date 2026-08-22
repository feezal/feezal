/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalIdElements, dialogPlaceholderLabel, html, css} from '@feezal/feezal-element';
import {encodeOptionValue, decodeOptionValue} from '@feezal/feezal-element/feezal-option-value.js';   // B128
import '@feezal/feezal-element/feezal-topic-input.js';
import {FZL_DTS, createFzl, FeezalElementSystemScript} from '@feezal/feezal-element-system-script';
import {LitElement} from 'lit';

/**
 * feezal-element-system-form (E178)
 *
 * Embeds a SUBVIEW (the layout-view clone machinery) and turns it into a web
 * form: every member element carrying a `feezal-id` and the U113 `.value`
 * contract automatically becomes a field — the payload is
 * `{<feezal-id>: <value>, …}`. Elements without a `feezal-id` are not part
 * of the payload (explicit opt-in).
 *
 * Decisions (roadmap E178, August 2026):
 * - Field keys = `feezal-id` (one identity across scripting, forms, layers).
 * - Submit = BOTH: a member button whose `feezal-id` equals `submit-id`
 *   (default `submit`) triggers via its composed `feezal-press`; when NO
 *   member matches, the form renders its own plain submit button under the
 *   embedded view (`submit-label`).
 * - Always a script, Monaco-edited like system-script, prefilled with a
 *   small transparent default that collects all values and publishes ONE
 *   JSON to the configured topic. Validation = edit the script (don't
 *   publish); webhook = replace the publish with fetch (A28 connect-src).
 * - Member publishing untouched: the form only READS values; members with
 *   their own `publish` topics keep publishing per change.
 * - The script runs on EVERY submit (unlike system-script's once-per-load),
 *   in the viewer only — never on the editor canvas.
 */

/** The prefill — teaches the general fzl API; `form.publish()` is the shortcut. */
export const DEFAULT_FORM_SCRIPT = `// Runs on every submit. \`form.values()\` is {feezalId: value} over the
// embedded view; \`form.topic\` is this form's publish attribute.
fzl.mqtt.pub(form.topic, form.values());
`;

/** `form` API typedefs — appended to the fzl typedefs for Monaco completions. */
export const FORM_DTS = `
/** The form this script belongs to. */
declare const form: {
    /** {feezalId: value} over every member of the embedded view that has a feezal-id and a .value. */
    values(): Record<string, any>;
    /** The form's publish attribute — the topic the default script publishes to. */
    readonly topic: string;
    /** Any attribute of the form element, e.g. form.attr('view'). */
    attr(name: string): string | null;
    /** One-liner: publish \`obj\` (default: form.values()) as JSON to form.topic. */
    publish(obj?: any, options?: {retain?: boolean}): void;
    /** Restore every member to the value it had when the form was shown. */
    reset(): void;
    /** A member element by feezal-id, scoped to THIS form (not the page). */
    el(feezalId: string): HTMLElement | null;
    /** Read (one arg) / set (two args) a member's value by feezal-id, scoped to this form. */
    val(feezalId: string, value?: any): any;
};
`;

class FeezalElementSystemForm extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Form', category: 'System', color: '#455a64', icon: 'list_alt'},
            description: 'Embeds a view as a web form: every member element with a feezal-id becomes a ' +
                'field, and a submit press runs the form script (default: publish all values as one ' +
                'JSON object to the publish topic). Give the embedded view\'s button the feezal-id ' +
                '"submit" (or set submit-id) — without one, the form shows its own submit button. ' +
                'Viewer only; a placeholder in the editor.',
            attributes: [
                {name: 'view',         dropdown: 'views',  help: 'The feezal view embedded as the form body. Its elements with a feezal-id become the fields.'},
                {name: 'publish',      type: 'mqttTopic',  help: 'Topic the default script publishes the JSON payload to (available as form.topic in the script).'},
                {name: 'submit-id',    type: 'string', default: 'submit',
                    help: 'feezal-id of the member button that submits the form. When no member carries it, the form renders its own submit button.'},
                {name: 'submit-label', type: 'string', default: 'Submit',
                    help: 'Label of the form\'s own submit button (only shown when no member carries the submit-id).'},
                {name: 'label',        type: 'string', default: '',
                    help: 'Editor-only label on the canvas placeholder, to tell several forms apart. Never shown in the viewer.'},
            ],
            baseAttribute: 'view',
            styles: ['top', 'left', 'width', 'height', 'background', 'border'],
            restrict: {minWidth: 24, minHeight: 24},
            defaultStyle: {width: '320px', height: '240px'},
            inspector: 'feezal-element-system-form-inspector',
        };
    }

    // Attribute → property sync only, NO reflection and NO constructor
    // defaults: Lit reflects constructor defaults on first update, which would
    // stamp submit-id="submit" submit-label="Submit" label="" onto every form
    // and serialize that junk into every saved dashboard (the B119 trigger
    // class). The defaults live in the readers (this.submitId || 'submit').
    static properties = {
        view:        {type: String, attribute: 'view'},
        publish:     {type: String, attribute: 'publish'},
        submitId:    {type: String, attribute: 'submit-id'},
        submitLabel: {type: String, attribute: 'submit-label'},
        label:       {type: String, attribute: 'label'},
        _ownSubmit:  {state: true},
        _error:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; }
        form {
            display: flex; flex-direction: column;
            width: 100%; height: 100%; margin: 0;
        }
        #content { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; }
        .own-submit {
            flex: 0 0 auto; align-self: flex-end;
            margin: 8px;
            padding: 8px 16px;
            border: 0; border-radius: 4px;
            font: inherit; font-weight: 600; cursor: pointer;
            background: var(--primary-color);
            color: var(--primary-background-color);
        }
        .own-submit:disabled { opacity: 0.5; cursor: default; }
        .note {
            margin: 8px; font-size: 12px;
            color: var(--error-color);
        }

        /* Editor placeholder */
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            gap: 6px; box-sizing: border-box; font-size: 12px; text-align: center; overflow: hidden;
            color: var(--secondary-text-color);
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
            background-image:
                linear-gradient(45deg, rgba(128,128,128,0.12) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.12) 75%),
                linear-gradient(45deg, rgba(128,128,128,0.12) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.12) 75%);
            background-size: 20px 20px; background-position: 0 0, 10px 10px;
        }
        .ph .material-icons { font-family: 'Material Icons'; font-size: 18px; }
    `];

    constructor() {
        super();
        this._ownSubmit = false;
        this._error = '';
        this._initial = new Map();
        this._onPress = e => this._onMemberPress(e);
    }

    // No element-level MQTT — the script publishes.
    _subscribe() { /* managed by the script */ }

    /** Read the source from the `<script type="text/feezal">` child, or the prefill. */
    get scriptSource() {
        const own = this.querySelector(':scope > script[type="text/feezal"]')?.textContent;
        return own ?? DEFAULT_FORM_SCRIPT;
    }

    get logPrefix() {
        return `[form${this.view ? ' ' + this.view : ''}]`;
    }

    // ── embedding (viewer) ──────────────────────────────────────────────────

    get _content() {
        return this.renderRoot?.querySelector('#content');
    }

    firstUpdated() {
        this._initialized = true;
        this._embed();
    }

    updated(changed) {
        super.updated(changed);
        if (this._initialized && changed.has('view')) this._embed();
        if (this._initialized && changed.has('submitId')) this._ownSubmit = !this._memberSubmit();
    }

    /** Build a live clone of the target view, or return an {error} sentinel. */
    _buildViewClone() {
        if (!this.view) return {error: 'No view selected.'};
        const hostViewName = this.closest('feezal-view')?.getAttribute('name');
        if (hostViewName && hostViewName === this.view) {
            return {error: `Form cannot embed its own view ("${this.view}").`};
        }
        const src = feezal.site?.querySelector(`feezal-view[name="${this.view}"]`);
        if (!src) return {error: `View "${this.view}" not found.`};

        const clone = src.cloneNode(true);
        // The source view may be inactive → carry a display:none from
        // feezal-site.updateVisibility(); clear it so the embedded copy shows.
        clone.style.display = '';
        if (!clone.style.position) clone.style.position = 'relative';
        // Make sure the embedded elements go live even if they use
        // dynamic-subscriptions (which gate on `visible`).
        clone.querySelectorAll('*').forEach(el => {
            if (el.tagName.startsWith('FEEZAL-ELEMENT-')) el.visible = true;
        });
        return {clone};
    }

    _embed() {
        const content = this._content;
        if (!content || feezal.isEditor) return;
        const {clone, error} = this._buildViewClone();
        this._error = error || '';
        content.replaceChildren();
        if (!clone) {
            this._ownSubmit = false;
            return;
        }
        content.append(clone);
        this._ownSubmit = !this._memberSubmit();
        // Initial values for form.reset() — captured once the members have
        // rendered (their .value is the constructor default / retained state).
        this._initial = new Map();
        queueMicrotask(() => {
            for (const el of this._fields()) this._initial.set(el, el.value);
        });
    }

    /** The member button (if any) that carries the submit-id. */
    _memberSubmit() {
        const id = this.submitId || 'submit';
        return feezalIdElements(this._content, id)[0] || null;
    }

    /**
     * Members with a feezal-id AND a public .value — the fields. feezal
     * elements (the U113 contract) plus native input/select/textarea; a
     * native <button> has a .value too but is a trigger, never a field.
     */
    _fields() {
        const id = this.submitId || 'submit';
        return feezalIdElements(this._content).filter(el =>
            'value' in el && el.getAttribute('feezal-id') !== id &&
            (el.localName.includes('-') || /^(input|select|textarea)$/.test(el.localName)));
    }

    connectedCallback() {
        super.connectedCallback();
        // Composed feezal-press from any member bubbles up through the clone.
        this.addEventListener('feezal-press', this._onPress);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('feezal-press', this._onPress);
    }

    _onMemberPress(e) {
        const id = this.submitId || 'submit';
        const trigger = e.composedPath().find(n => n?.getAttribute?.('feezal-id') === id);
        if (!trigger) return;
        e.stopPropagation();
        this.submit();
    }

    // ── the form API + script run ──────────────────────────────────────────

    /** Build the `form` object handed to the script. */
    makeForm() {
        const self = this;
        const serialize = FeezalElementSystemScript.serializePayload;
        const find = id => feezalIdElements(self._content, id)[0] || null;
        return {
            values: () => {
                const out = {};
                for (const el of self._fields()) out[el.getAttribute('feezal-id')] = el.value;
                return out;
            },
            get topic() { return self.publish || ''; },
            attr: name => self.getAttribute(name),
            publish: (obj, options = {}) => {
                const payload = obj === undefined ? self.makeForm().values() : obj;
                if (!self.publish) {
                    console.warn(self.logPrefix, 'form.publish(): no publish topic configured');
                    return;
                }
                feezal.connection.pub(self.publish, serialize(payload), {retain: options.retain === true});
            },
            reset: () => {
                for (const el of self._fields()) {
                    if (self._initial.has(el)) el.value = self._initial.get(el);
                }
            },
            el: find,
            val: (id, ...rest) => {
                const el = find(id);
                if (!el) return undefined;
                if (rest.length) { el.value = rest[0]; return rest[0]; }
                return el.value;
            },
        };
    }

    /** Run the form script once — on a submit press, or programmatically. */
    submit() {
        if (feezal.isEditor) return;
        const source = this.scriptSource;
        const fzl = createFzl({prefix: this.logPrefix});
        const form = this.makeForm();
        try {
            const fn = new Function('fzl', 'form', `'use strict';\nreturn (async () => {\n${source}\n})();`);
            return Promise.resolve(fn.call(undefined, fzl, form))
                .catch(err => console.error(this.logPrefix, 'uncaught error:', err));
        } catch (err) {
            console.error(this.logPrefix, 'uncaught error:', err);
            return Promise.resolve();
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`<div class="ph"><span class="material-icons">list_alt</span>
                ${dialogPlaceholderLabel('Form', this.label || this.view)}</div>`;
        }
        return html`
            <form @submit=${e => { e.preventDefault(); this.submit(); }}>
                <div id="content"></div>
                ${this._error ? html`<div class="note">${this._error}</div>` : ''}
                ${this._ownSubmit ? html`
                    <button type="submit" class="own-submit">${this.submitLabel || 'Submit'}</button>
                ` : ''}
            </form>`;
    }
}

customElements.define('feezal-element-system-form', FeezalElementSystemForm);

// ── Custom inspector ─────────────────────────────────────────────────────────
// Editor-only. Uses <sl-*> and <feezal-template-editor> (both defined by the
// editor bundle) without importing them — same pattern as system-script.

class FeezalElementSystemFormInspector extends LitElement {
    static properties = {
        element: {attribute: false},
    };

    static styles = css`
        :host { display: block; padding: 12px; }
        .row { margin-bottom: 10px; }
        .half-row { display: flex; gap: 8px; }
        .half-row > * { flex: 1; min-width: 0; }
        sl-input, sl-select, feezal-topic-input { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .hint { font-size: 11px; line-height: 1.5; color: var(--feezal-color, #888); margin-top: 10px; }
        .hint code { font-size: 10px; }
    `;

    constructor() {
        super();
        this.element = null;
    }

    _set(name, value) {
        this.dispatchEvent(new CustomEvent('feezal-attribute-changed', {
            bubbles: true, composed: true,
            detail: {name, value},
        }));
    }

    _viewNames() {
        try {
            return [...window.feezal.views].map(v => v.getAttribute('name')).filter(Boolean);
        } catch {
            return [];
        }
    }

    /** Write the source into the `<script type="text/feezal">` child. */
    _setScript(value) {
        const el = this.element;
        if (!el) return;
        let script = el.querySelector(':scope > script[type="text/feezal"]');
        if (!script) {
            script = document.createElement('script');
            script.setAttribute('type', 'text/feezal');
            el.append(script);
        }
        script.textContent = value;
        feezal.app.change();
    }

    render() {
        if (!this.element) return html``;
        const el = this.element;
        const views = this._viewNames();
        return html`
            <div class="row">
                <sl-select label="view" size="small" hoist
                    .value=${encodeOptionValue(el.view || '')}
                    @sl-change=${e => this._set('view', decodeOptionValue(e.target.value))}>
                    ${views.map(n => html`<sl-option value=${encodeOptionValue(n)}>${n}</sl-option>`)}
                </sl-select>
            </div>
            <div class="row">
                <feezal-topic-input label="publish" size="small"
                    .value=${el.publish || ''}
                    @sl-change=${e => this._set('publish', e.target.value)}>
                </feezal-topic-input>
            </div>
            <div class="row half-row">
                <sl-input label="submit-id" size="small" autocomplete="off" placeholder="submit"
                    .value=${el.getAttribute('submit-id') || ''}
                    @sl-change=${e => this._set('submit-id', e.target.value || null)}>
                </sl-input>
                <sl-input label="submit-label" size="small" autocomplete="off" placeholder="Submit"
                    .value=${el.getAttribute('submit-label') || ''}
                    @sl-change=${e => this._set('submit-label', e.target.value || null)}>
                </sl-input>
            </div>
            <div class="row">
                <sl-input label="label" size="small" autocomplete="off"
                    .value=${el.label || ''}
                    @sl-change=${e => this._set('label', e.target.value || null)}>
                </sl-input>
            </div>
            <feezal-template-editor
                .label=${'script (runs on every submit, in the viewer)'}
                .language=${'javascript'}
                .typedefs=${FZL_DTS + FORM_DTS}
                .value=${el.scriptSource}
                .darkMode=${window.feezal?.app?._darkMode ?? false}
                @feezal-change=${e => this._setScript(e.detail.value)}>
            </feezal-template-editor>
            <div class="hint">
                Fields = elements of the embedded view that carry a <code>feezal-id</code>
                (set it in their inspector). Submit = a member button with feezal-id
                <code>${el.submitId || 'submit'}</code>, else the form's own button.
                The script gets <code>fzl</code> plus <code>form</code>:
                <code>form.values()</code> · <code>form.topic</code> · <code>form.publish()</code>
                · <code>form.reset()</code> · <code>form.el(id)</code> / <code>form.val(id)</code>.
                Validate by not publishing; for a webhook replace the publish with
                <code>fetch(url, {method: 'POST', body: JSON.stringify(form.values())})</code>
                (allow the host in the site's <code>connect-src</code> CSP setting).
            </div>
        `;
    }
}

customElements.define('feezal-element-system-form-inspector', FeezalElementSystemFormInspector);

export {FeezalElementSystemForm};
