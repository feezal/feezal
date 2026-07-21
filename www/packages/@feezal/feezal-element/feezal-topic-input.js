/**
 * feezal-topic-input — shared MQTT-topic input with server-backed
 * autocompletion (B28).
 *
 * Drop-in replacement for the plain `sl-input` topic fields in custom (N6)
 * inspectors: wraps an sl-input and adds the same completion dropdown as the
 * generic attribute inspector (debounced fetch of /api/topics/completions,
 * arrow-key navigation, Enter to pick, descend on `topic/` intermediate
 * completions, Escape/Tab to dismiss).
 *
 * The inner sl-input's `sl-input`/`sl-change` events bubble composed out of
 * the shadow root retargeted to this element, and `value` is kept in sync —
 * existing inspector handlers keep working unchanged with
 * `@sl-change="${e => ...e.target.value...}"`. Picking a completion fires a
 * synthetic `sl-change`; descending an intermediate `…/` completion fires
 * `sl-input` only.
 *
 * Only usable inside the editor (needs the Shoelace bundle and the feezal
 * server API); dashboards never render it.
 */
import {LitElement, html, css} from 'lit';

class FeezalTopicInput extends LitElement {
    static properties = {
        label:       {type: String},
        value:       {type: String},
        placeholder: {type: String},
        size:        {type: String},
        _completions: {state: true},
        _cursor:      {state: true},
    };

    static styles = css`
        :host { display: block; }
        .topic-wrap { position: relative; }
        sl-input { width: 100%; }
        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base) {
            background: var(--feezal-bg, #fff);
            border-color: var(--feezal-border, #ccc);
            color: var(--feezal-color, #333);
        }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .completions {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 500;
            list-style: none; margin: 2px 0 0; padding: 4px 0;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            max-height: 180px; overflow-y: auto; font-size: 12px;
        }
        .completions li {
            padding: 4px 10px; cursor: pointer;
            color: var(--feezal-color, #333);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .completions li:hover, .completions li.active { background: var(--feezal-bg-sub, #f0f0f0); }
    `;

    constructor() {
        super();
        this.label = '';
        this.value = '';
        this.placeholder = 'mqtt/topic';
        this.size = 'small';
        this._completions = [];
        this._cursor = -1;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._fetchTimer);
        clearTimeout(this._closeTimer);
    }

    _emit(name) {
        this.dispatchEvent(new CustomEvent(name, {bubbles: true, composed: true}));
    }

    _debounceFetch(prefix) {
        clearTimeout(this._fetchTimer);
        this._fetchTimer = setTimeout(() => this._fetchCompletions(prefix), 150);
    }

    async _fetchCompletions(prefix) {
        try {
            const r = await fetch(`/api/topics/completions?prefix=${encodeURIComponent(prefix)}`);
            if (!r.ok) { this._completions = []; return; }
            const {completions} = await r.json();
            this._cursor = -1;
            this._completions = completions || [];
        } catch {
            this._completions = [];
        }
    }

    _close() {
        this._completions = [];
        this._cursor = -1;
    }

    _onInput(e) {
        this.value = e.target.value;
        this._debounceFetch(this.value);
    }

    _onKeydown(e) {
        if (!this._completions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._cursor = Math.min(this._cursor + 1, this._completions.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._cursor = Math.max(this._cursor - 1, -1);
        } else if (e.key === 'Enter' && this._cursor >= 0) {
            e.preventDefault();
            e.stopPropagation();
            this._select(this._completions[this._cursor]);
        } else if (e.key === 'Escape' || e.key === 'Tab') {
            this._close();
        }
    }

    _select(val) {
        this.value = val;
        if (val.endsWith('/')) {
            // Intermediate level — descend and keep the dropdown open.
            this._emit('sl-input');
            this._fetchCompletions(val);
        } else {
            this._emit('sl-input');
            this._emit('sl-change');
            this._close();
        }
    }

    _scheduleClose() {
        clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => this._close(), 200);
    }

    render() {
        return html`
            <div class="topic-wrap">
                <sl-input size="${this.size}" autocomplete="off" clearable
                    label="${this.label || ''}"
                    placeholder="${this.placeholder}"
                    .value="${this.value ?? ''}"
                    @sl-focus="${() => this._debounceFetch(this.value ?? '')}"
                    @sl-input="${this._onInput}"
                    @sl-change="${e => { this.value = e.target.value; }}"
                    @sl-blur="${this._scheduleClose}"
                    @keydown="${this._onKeydown}"></sl-input>
                ${this._completions.length ? html`
                    <ul class="completions">
                        ${this._completions.map((c, ci) => html`
                            <li class="${ci === this._cursor ? 'active' : ''}"
                                @mousedown="${e => { e.preventDefault(); this._select(c); }}">
                                ${c}
                            </li>
                        `)}
                    </ul>
                ` : ''}
            </div>
        `;
    }
}

// Multiple element bundles may carry a copy (static exports) — guard the define.
if (!customElements.get('feezal-topic-input')) {
    customElements.define('feezal-topic-input', FeezalTopicInput);
}

export {FeezalTopicInput};
