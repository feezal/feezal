import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';

/**
 * feezal-editable-list — a sortable list of key/value rows for attribute editing.
 */
class FeezalEditableList extends LitElement {
    static properties = {
        value: {type: Array},
        columns: {type: Array},
        label: {type: String}
    };

    static styles = css`
        :host { display: block; }
        .list-label { font-size: 11px; color: var(--feezal-color, #666); display: inline-block; }
        button.add { background: none; border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; cursor: pointer; padding: 2px 6px; margin-left: 6px; color: var(--feezal-color, inherit); }
        ul { list-style: none; margin: 4px 0; padding: 0; border-bottom: 1px solid var(--feezal-border, #ddd); }
        li { display: flex; align-items: center; gap: 4px; padding: 4px 0; }
        li input { flex: 1; padding: 4px; background: var(--feezal-bg, white); color: var(--feezal-color, inherit); border: 1px solid var(--feezal-border, #ccc); border-radius: 3px; font-size: 12px; }
        .del { background: none; border: none; cursor: pointer; color: #c62828; font-size: 16px; padding: 0 4px; }
        .drag { cursor: move; color: var(--feezal-color, #999); opacity: 0.6; padding: 0 2px; }
    `;

    constructor() {
        super();
        this.value = [];
        this.columns = [];
        this.label = 'items';
    }

    render() {
        return html`
            <span class="list-label">${this.label}</span>
            <button class="add" @click="${this._add}">+</button>
            <ul>
                ${(this.value || []).map((item, rowIdx) => html`
                    <li>
                        <span class="drag">⠿</span>
                        ${this.columns.map(col => html`
                            <input .value="${item[col] || ''}"
                                placeholder="${col}"
                                autocomplete="off"
                                @change="${e => this._propChanged(rowIdx, col, e.target.value)}">
                        `)}
                        <button class="del" @click="${() => this._remove(rowIdx)}">✕</button>
                    </li>
                `)}
            </ul>
        `;
    }

    _add() {
        const newRow = Object.fromEntries(this.columns.map(k => [k, '']));
        this.value = [...(this.value || []), newRow];
        this.dispatchEvent(new CustomEvent('value-changed', {detail: {value: this.value}}));
    }

    _remove(idx) {
        this.value = this.value.filter((_, i) => i !== idx);
        this.dispatchEvent(new CustomEvent('value-changed', {detail: {value: this.value}}));
    }

    _propChanged(rowIdx, col, value) {
        this.value = this.value.map((row, i) => i === rowIdx ? {...row, [col]: value} : row);
        this.dispatchEvent(new CustomEvent('value-changed', {detail: {value: this.value}}));
    }
}

window.customElements.define('feezal-editable-list', FeezalEditableList);

// ---------------------------------------------------------------------------

/**
 * feezal-sidebar-inspector-attributes — attribute editor for selected elements.
 */
class FeezalSidebarInspectorAttributes extends LitElement {
    static properties = {
        selectedElems:      {type: Array},
        items:              {type: Array},
        _completionIdx:     {state: true},  // item index with open completions (-1 = none)
        _completions:       {state: true},  // string[] — current completions
        _completionCursor:  {state: true},  // keyboard-navigation cursor in list
        _helpTip:           {state: true},  // custom tooltip: { text, x, y } | null
        _discoveryMatch:    {state: true},  // discovered entity matching a topic field | null
        _discoveryFilter:   {state: true}   // search text for the discovery picker
    };

    static styles = css`
        :host { display: block; margin: 12px; }
        .attr { display: inline-block; width: 100%; vertical-align: top; margin-bottom: 8px; }
        .attr.half { width: calc(50% - 4px); }
        sl-input, sl-textarea, sl-select { width: 100%; }
        /* Monospace for textarea (template content) */
        sl-textarea::part(textarea) { font-family: Consolas, monospace; font-size: 12px; }
        /* Invalid state */
        .attr.invalid sl-input::part(base),
        .attr.invalid sl-select::part(combobox),
        .attr.invalid sl-textarea::part(textarea) { border-color: #c62828; }
        /* Mixed state (multi-select, values differ across selection) */
        .attr.mixed sl-input::part(base),
        .attr.mixed sl-select::part(combobox),
        .attr.mixed sl-textarea::part(textarea) { opacity: 0.75; }
        /* Checkbox alignment */
        sl-checkbox { padding-top: 18px; }
        /* Dark mode: style Shoelace parts + checkbox via inherited CSS vars */
        sl-input::part(form-control-label), sl-textarea::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-checkbox { color: var(--feezal-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        sl-textarea::part(textarea) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }

        /* ── Attribute help icon ────────────────────────────────────── */
        .label-with-help { display: inline-flex; align-items: center; gap: 3px; }
        .help-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 13px; height: 13px;
            font-size: 10px; line-height: 1; font-style: italic;
            border-radius: 50%; border: 1px solid currentColor;
            color: var(--sl-color-primary-500, #0ea5e9);
            opacity: 0.75; cursor: default; user-select: none; flex-shrink: 0;
        }
        .help-icon:hover { opacity: 1; }
        .help-tip {
            position: fixed; z-index: 9999;
            background: #333; color: #fff;
            padding: 6px 10px; border-radius: 4px;
            font-size: 12px; max-width: 240px; line-height: 1.4;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transform: translate(-50%, calc(-100% - 8px));
        }

        /* ── MQTT topic autocomplete ───────────────────────────────── */
        .topic-wrap { position: relative; }
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
        /* ── Element help panel ────────────────────────────────────────────── */
        .help-section {
            margin-top: 16px; padding: 10px 12px;
            border: 1px solid var(--feezal-border, #ddd);
            border-radius: 6px; background: var(--feezal-bg-sub, #f8f8f8);
            font-size: 12px; color: var(--feezal-color, #555);
        }
        .help-section summary {
            cursor: pointer; font-weight: 600; font-size: 12px;
            color: var(--feezal-color, #333); list-style: none;
            display: flex; align-items: center; gap: 4px;
        }
        .help-section summary::before { content: '▶'; font-size: 9px; opacity: 0.6; }
        details[open] .help-section summary::before { content: '▼'; }
        .help-desc { margin-top: 8px; line-height: 1.5; }
        .help-links { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .help-links a { color: var(--sl-color-primary-600, #0284c7); text-decoration: none; }
        .help-links a:hover { text-decoration: underline; }
        /* ── Colour attribute ──────────────────────────────────────── */
        .color-wrap { display: flex; align-items: flex-end; gap: 4px; }
        .color-wrap sl-input { flex: 1; }
        .color-wrap input[type=color] {
            width: 36px; height: 32px; padding: 2px; flex-shrink: 0;
            border: 1px solid var(--feezal-border, #ccc); border-radius: 3px;
            cursor: pointer; background: var(--feezal-bg, #fff);
        }
        /* ── Auto-discovery banner (N12) ───────────────────────────────── */
        .discovery-banner {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 10px; margin: 0 0 8px;
            background: var(--sl-color-warning-100, #fef3c7);
            border: 1px solid var(--sl-color-warning-400, #fbbf24);
            border-radius: 6px; font-size: 12px; line-height: 1.4;
            color: var(--feezal-color, #333);
        }
        .discovery-banner .disc-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .discovery-banner .disc-name { font-weight: 600; }
        .disc-apply {
            flex-shrink: 0; background: var(--sl-color-warning-500, #f59e0b); color: #fff;
            border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;
        }
        .disc-apply:hover { background: var(--sl-color-warning-600, #d97706); }
        .disc-dismiss {
            flex-shrink: 0; background: none; border: none; cursor: pointer;
            color: var(--feezal-color, #888); font-size: 14px; line-height: 1; padding: 0 2px;
        }
        /* ── Auto-discovery device picker (custom inspectors) ───────────── */
        .discovery-picker {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 8px; margin: 0 0 10px;
            background: var(--feezal-bg-sub, #f5f5f5);
            border: 1px solid var(--feezal-border, #e0e0e0);
            border-radius: 6px;
        }
        .discovery-picker .dp-icon { color: var(--sl-color-warning-500, #f59e0b); font-size: 13px; flex-shrink: 0; }
        .discovery-picker .dp-select { flex: 1; min-width: 0; }
        .discovery-picker .dp-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        .discovery-picker .dp-clear {
            flex-shrink: 0; background: none; border: none; cursor: pointer;
            color: var(--feezal-color, #888); font-size: 13px; line-height: 1; padding: 0 2px;
        }
        .discovery-picker .dp-search-wrap {
            padding: 4px 6px; border-bottom: 1px solid var(--feezal-border, #e0e0e0);
            position: sticky; top: 0; background: var(--feezal-bg, #fff); z-index: 1;
        }
        .discovery-picker .dp-search {
            width: 100%; box-sizing: border-box; padding: 3px 7px; border-radius: 4px;
            border: 1px solid var(--feezal-border, #ccc); background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333); font-size: 12px; outline: none;
        }
        .discovery-picker .dp-search:focus { border-color: var(--sl-color-primary-500, #0ea5e9); }
    `;

    constructor() {
        super();
        this.selectedElems = [];
        this.items         = [];
        this._completionIdx    = -1;
        this._completions      = [];
        this._completionCursor = -1;
        this._completionTimer  = null;
        this._helpTip          = null;
        this._discoveryMatch   = null;
        this._discoveryFilter  = '';
        this.__discoveryEntities = []; // non-reactive cache
    }

    connectedCallback() {
        super.connectedCallback();
        this._fetchDiscoveryEntities();
    }

    updated(changed) {
        if (changed.has('selectedElems')) {
            this._rebuildItems();
            this._fetchDiscoveryEntities(); // refresh device list for the picker/banner
            this._discoveryFilter = ''; // reset filter when selection changes
        }
        this._syncCustomInspector();
    }

    render() {
        // Resolve help text from the selected element's feezal descriptor.
        const el = this.selectedElems?.[0];
        const tagName = el?.name ? 'feezal-view' : el?.localName;
        const cls = tagName ? window.customElements.get(tagName) : null;
        const feezalInfo = cls?.feezal;
        const customInspector = feezalInfo?.inspector;

        // ── Custom inspector (N6) ──────────────────────────────────────────
        // When the selected element declares feezal().inspector, render a host
        // container. The actual custom element is injected imperatively in
        // _syncCustomInspector() after the DOM update.
        if (customInspector && this.selectedElems?.length === 1) {
            return html`
                ${this._renderDiscoveryPicker()}
                <div id="custom-inspector-host"
                    @feezal-attribute-changed="${this._onCustomAttrChanged}">
                </div>
                ${this._helpTip ? html`<div class="help-tip" style="left:${this._helpTip.x}px;top:${this._helpTip.y}px">${this._helpTip.text}</div>` : ''}
            `;
        }

        // ── Standard attribute form ────────────────────────────────────────
        const desc = feezalInfo?.description;
        const links = feezalInfo?.links;
        const hasHelp = desc || (links && links.length > 0);
        return html`
            ${this._renderDiscoveryPicker()}
            ${this._discoveryMatch ? html`
                <div class="discovery-banner">
                    <span class="disc-label">⚡ <span class="disc-name">${this._discoveryMatch.name}</span> detected</span>
                    <button class="disc-apply" @click="${this._onAutoConfig}">Auto-configure</button>
                    <button class="disc-dismiss" title="Dismiss" @click="${() => { this._discoveryMatch = null; }}">&#x2715;</button>
                </div>
            ` : ''}
            ${this.items.map((item, idx) => html`
                <div class="attr ${item.half ? 'half' : ''} ${item.invalid ? 'invalid' : ''} ${item.mixed ? 'mixed' : ''}">
                    ${this._renderInput(item, idx)}
                </div>
            `)}
            ${hasHelp ? html`
                <details class="help-section">
                    <summary>Help</summary>
                    ${desc ? html`<div class="help-desc">${desc}</div>` : ''}
                    ${links && links.length ? html`
                        <div class="help-links">
                            ${links.map(l => html`<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)}
                        </div>
                    ` : ''}
                </details>
            ` : ''}
        ${this._helpTip ? html`<div class="help-tip" style="left:${this._helpTip.x}px;top:${this._helpTip.y}px">${this._helpTip.text}</div>` : ''}
        `;
    }

    // ── Custom inspector sync (N6) ────────────────────────────────────────
    // Called after every render. Creates or updates the custom inspector
    // element inside #custom-inspector-host if one is required.
    _syncCustomInspector() {
        const host = this.shadowRoot?.querySelector('#custom-inspector-host');
        if (!host) return;

        const el = this.selectedElems?.[0];
        if (!el) { host.innerHTML = ''; return; }

        // If the same custom inspector is already attached to this element, do nothing.
        const existing = host.firstElementChild;
        if (existing && existing.element === el) return;

        const tagName = el.name ? 'feezal-view' : el.localName;
        const inspectorTag = window.customElements.get(tagName)?.feezal?.inspector;
        if (!inspectorTag) { host.innerHTML = ''; return; }

        host.innerHTML = '';
        const inspectorEl = document.createElement(inspectorTag);
        inspectorEl.element = el;
        host.appendChild(inspectorEl);
    }

    // Handles feezal-attribute-changed events dispatched by custom inspectors.
    _onCustomAttrChanged(e) {
        const {name, value} = e.detail || {};
        if (!name) return;
        this.selectedElems.forEach(element => {
            if (value === null || value === undefined) {
                element.removeAttribute(name);
            } else if (typeof value === 'boolean') {
                if (value) element.setAttribute(name, '');
                else element.removeAttribute(name);
            } else if (typeof value === 'object') {
                element.setAttribute(name, JSON.stringify(value));
            } else {
                element.setAttribute(name, String(value));
            }
        });
        feezal.app.change();
        e.stopPropagation();
    }

    // ── Help-icon label slot ──────────────────────────────────────────────────
    _labelTpl(label, help) {
        if (!help) return '';
        return html`<span slot="label" class="label-with-help">${label}<span class="help-icon" @mouseenter="${e => this._showHelp(e, help)}" @mouseleave="${() => this._hideHelp()}">i</span></span>`;
    }

    _showHelp(e, text) {
        const rect = e.currentTarget.getBoundingClientRect();
        this._helpTip = { text, x: rect.left + rect.width / 2, y: rect.top };
    }

    _hideHelp() {
        this._helpTip = null;
    }

    _renderInput(item, idx) {
        const {elem, label, value, mixed} = item;
        const labelSlot = this._labelTpl(label, elem.help);
        const labelAttr = elem.help ? '' : label;

        if (elem.list) {
            return html`
                <feezal-editable-list
                    label="${label}"
                    .value="${value || []}"
                    .columns="${elem.columns || []}"
                    @value-changed="${e => this._change(e.detail.value, idx, true)}">
                </feezal-editable-list>
            `;
        }

        if (elem.dropdown) {
            return html`
                <sl-select .label="${labelAttr}" size="small" .value="${mixed ? '' : (value || '')}"
                    @sl-change="${e => this._change(e.target.value, idx, true)}">
                    ${labelSlot}
                    ${(elem.options || []).map(opt => html`
                        <sl-option value="${opt}">${opt}</sl-option>
                    `)}
                </sl-select>
            `;
        }

        if (elem.textarea) {
            return html`
                <sl-textarea .label="${labelAttr}" size="small" rows="6"
                    autocomplete="off"
                    .value="${mixed ? '' : (value || '')}"
                    placeholder="${mixed ? '— varies —' : ''}"
                    @sl-change="${e => this._change(e.target.value, idx, true)}">
                    ${labelSlot}
                </sl-textarea>
            `;
        }

        if (elem.checkbox) {
            return html`
                <sl-checkbox size="small" .checked="${Boolean(value)}"
                    ?indeterminate="${mixed}"
                    @sl-change="${e => this._change(e.target.checked, idx, true)}">
                    ${label}${elem.help ? html` <span class="help-icon" @mouseenter="${e => this._showHelp(e, elem.help)}" @mouseleave="${() => this._hideHelp()}">i</span>` : ''}
                </sl-checkbox>
            `;
        }

        if (elem.color) {
            return html`
                <div class="color-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off"
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : ''}"
                        @sl-change="${e => this._change(e.target.value, idx, true)}">
                        ${labelSlot}
                    </sl-input>
                    <input type="color"
                        title="Pick colour"
                        .value="${this._toCssColorHex(mixed ? '' : value)}"
                        @input="${e => this._change(e.target.value, idx, true)}">
                </div>
            `;
        }

        if (elem.mqttTopic) {
            return html`
                <div class="topic-wrap">
                    <sl-input .label="${labelAttr}" size="small"
                        autocomplete="off"
                        .value="${mixed ? '' : (value ?? '')}"
                        placeholder="${mixed ? '— varies —' : ''}"
                        @sl-focus="${e => this._onTopicInput(e.target.value, idx)}"
                        @sl-input="${e => this._onTopicInput(e.target.value, idx)}"
                        @sl-blur="${() => this._scheduleCloseCompletions(idx)}"
                        @sl-change="${e => this._change(e.target.value, idx, false)}"
                        @keydown="${e => this._onTopicKeydown(e, idx)}">
                        ${labelSlot}
                    </sl-input>
                    ${this._completionIdx === idx && this._completions.length ? html`
                        <ul class="completions">
                            ${this._completions.map((c, ci) => html`
                                <li class="${ci === this._completionCursor ? 'active' : ''}"
                                    @mousedown="${e => { e.preventDefault(); this._selectCompletion(c, idx); }}">
                                    ${c}
                                </li>
                            `)}
                        </ul>
                    ` : ''}
                </div>
            `;
        }

        // Default: text / number input
        return html`
            <sl-input .label="${labelAttr}" size="small"
                type="${elem.inputType || 'text'}"
                autocomplete="off"
                title="${elem.tooltip || ''}"
                .value="${mixed ? '' : (value ?? '')}"
                placeholder="${mixed ? '— varies —' : ''}"
                min="${elem.min ?? ''}" max="${elem.max ?? ''}" step="${elem.step ?? ''}"
                @sl-change="${e => this._change(e.target.value, idx, false)}">
                ${labelSlot}
            </sl-input>
        `;
    }

    // Convert camelCase property names to kebab-case HTML attribute names.
    // Polymer observes 'subscribe', not 'subscribe'.
    // Lit uses the same convention unless overridden with the attribute: option.
    _toKebab(name) {
        return name.replace(/([A-Z])/g, c => '-' + c.toLowerCase());
    }

    // ── Color helper ──────────────────────────────────────────────────────────
    _toCssColorHex(value) {
        if (!value) return '#000000';
        if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
        if (/^#[0-9a-fA-F]{3}$/.test(value)) {
            const [, r, g, b] = value.match(/^#(.)(.)(.)$/);
            return `#${r}${r}${g}${g}${b}${b}`;
        }
        // Try rgb()/rgba()
        const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
        return '#000000';
    }

    // ── MQTT topic autocomplete ───────────────────────────────────────────────
    _onTopicInput(prefix, idx) {
        console.debug('[feezal:mqtt-ac] topic input idx=' + idx, JSON.stringify(prefix));
        if (this._completionTimer) clearTimeout(this._completionTimer);
        this._completionTimer = setTimeout(() => this._fetchCompletions(prefix, idx), 150);
    }

    async _fetchCompletions(prefix, idx) {
        try {
            const r = await fetch(`/api/topics/completions?prefix=${encodeURIComponent(prefix)}`);
            if (!r.ok) { this._completions = []; return; }
            const {completions} = await r.json();
            this._completionIdx    = idx;
            this._completionCursor = -1;
            this._completions      = completions || [];
        } catch {
            this._completions = [];
        }
    }

    _onTopicKeydown(e, idx) {
        if (this._completionIdx !== idx || !this._completions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._completionCursor = Math.min(this._completionCursor + 1, this._completions.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._completionCursor = Math.max(this._completionCursor - 1, -1);
        } else if (e.key === 'Enter' && this._completionCursor >= 0) {
            e.preventDefault();
            this._selectCompletion(this._completions[this._completionCursor], idx);
        } else if (e.key === 'Escape' || e.key === 'Tab') {
            this._completionIdx    = -1;
            this._completions      = [];
            this._completionCursor = -1;
        }
    }

    _selectCompletion(val, idx) {
        this._change(val, idx, false);
        if (val.endsWith('/')) {
            // Descend into next level and stay open
            this._fetchCompletions(val, idx);
        } else {
            this._completionIdx    = -1;
            this._completions      = [];
            this._completionCursor = -1;
        }
    }

    _scheduleCloseCompletions(idx) {
        setTimeout(() => {
            if (this._completionIdx === idx) {
                this._completionIdx    = -1;
                this._completions      = [];
                this._completionCursor = -1;
            }
        }, 200);
    }

    _change(newValue, idx, applyImmediately) {
        const item  = this.items[idx];
        const attr  = item.attrName || item.label;  // attrName for attribute ops, label as fallback
        let invalid = false;

        feezal.editor.selectedElems.forEach(element => {
            const elementClass = window.customElements.get(element.localName);
            if (!elementClass || !elementClass.feezal) {
                return;
            }

            const attrOptions = elementClass.feezal.attributes.find(a => (typeof a === 'string' ? a : a.name) === attr);
            if (attrOptions && attrOptions.validator && !attrOptions.validator(newValue)) {
                invalid = true;
                return;
            }

            if (typeof newValue === 'boolean') {
                const htmlAttr = this._toKebab(attr);
                if (newValue) {
                    element.setAttribute(htmlAttr, newValue);
                } else {
                    element.removeAttribute(htmlAttr);
                }
            } else if (typeof newValue === 'object') {
                element.setAttribute(this._toKebab(attr), JSON.stringify(newValue));
            } else {
                if (attrOptions && attrOptions.template) {
                    let template = element.querySelector('template');
                    if (!template) {
                        template = document.createElement('template');
                        element.append(template);
                    }

                    template.innerHTML = newValue;

                    // Force a preview render in the editor. The Polymer _msgChanged
                    // observer returns early when msg is empty ({}), so nothing shows
                    // unless we give it at least a non-empty object to work with.
                    if (feezal.isEditor && element._msgChanged) {
                        element._processTemplate = null; // force template fn rebuild
                        if (!element.msg || !Object.keys(element.msg).length) {
                            element.msg = {_feezalPreview: true};
                        } else {
                            element._msgChanged();
                        }
                    }
                } else {
                    element.setAttribute(this._toKebab(attr), newValue);
                }
            }
        });

        // Apply interact side effects when the locked attribute is toggled via the inspector
        if (attr === 'locked' && feezal.editor) {
            feezal.editor.selectedElems.forEach(el => feezal.editor.setLocked(el, newValue));
        }

        this.items = this.items.map((it, i) => i === idx ? {...it, value: newValue, invalid, mixed: false} : it);

        if (applyImmediately && !invalid) {
            feezal.app.change();
        }

        // Check for a discovery match when a MQTT topic field is committed
        if (item?.elem?.mqttTopic && typeof newValue === 'string' && newValue && !newValue.endsWith('/')) {
            this._checkDiscovery(newValue);
        }
    }

    _blur(e, idx) {
        const item = this.items[idx];
        if (item && item.hasChange) {
            feezal.app.change();
        }
    }

    _rebuildItems() {
        if (!this.selectedElems || this.selectedElems.length === 0) {
            this.items = [];
            return;
        }

        const el = this.selectedElems[0];
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        if (!cls || !cls.feezal || !cls.feezal.attributes) {
            this.items = [];
            return;
        }

        // If the element declares a custom inspector (N6), skip the standard
        // attribute form entirely — the inspector handles its own UI.
        if (cls.feezal.inspector && this.selectedElems.length === 1) {
            this.items = [];
            return;
        }

        // For multi-select: only show attributes present on ALL selected elements.
        // Use the first element's spec for control types, options, etc.
        const allAttrs = cls.feezal.attributes;
        const filteredAttrs = this.selectedElems.length === 1 ? allAttrs : allAttrs.filter(attr => {
            const name = typeof attr === 'string' ? attr : attr.name;
            return this.selectedElems.every(e => {
                const eName = e.name ? 'feezal-view' : e.localName;
                const eCls = window.customElements.get(eName);
                return eCls?.feezal?.attributes?.some(a => (typeof a === 'string' ? a : a.name) === name);
            });
        });

        const viewNames = feezal.views ? [...feezal.views].map(v => v.getAttribute('name')) : [];

        this.items = filteredAttrs.map(attr => {
            // Attributes may be plain strings ('subscribe') or objects
            // ({name: 'min', size: 'half', dropdown: [...], ...}).
            const attrName = typeof attr === 'string' ? attr : attr.name;
            const attrSpec = typeof attr === 'string' ? {} : attr;

            // Support both legacy {dropdown: [...]} and new {type:'select', options:[...]} formats.
            const options = attrSpec.dropdown === 'views'
                ? viewNames
                : (attrSpec.dropdown ||
                   (attrSpec.type === 'select' && attrSpec.options ? attrSpec.options : null));
            const half = ['top', 'left', 'width', 'height'].includes(attrName) || attrSpec.size === 'half';

            // ── Smart control auto-detection ──────────────────────────────
            // 1. Boolean: explicit in spec ({checkbox:true} or {type:'boolean'}) OR Lit property
            //    Lit elementProperties uses camelCase keys → also check via cls.properties
            const litProp = cls.elementProperties?.get(attrName) ?? cls.properties?.[attrName];
            const isBool = Boolean(attrSpec.checkbox) || attrSpec.type === 'boolean'
                || (litProp?.type === Boolean);
            // 2. Color: explicit {type:'color'} OR name contains "color"
            const isColor = !isBool && !options && !attrSpec.textarea && !attrSpec.list
                && (attrSpec.type === 'color' || attrName.toLowerCase().includes('color'));
            // 3. MQTT topic: explicit type, or name contains "topic", or the standard subscribe/publish attrs
            const isTopic = !isBool && !isColor && !options && !attrSpec.textarea && !attrSpec.list
                && (attrSpec.type === 'mqttTopic'
                    || attrName.toLowerCase().includes('topic')
                    || attrName === 'subscribe' || attrName === 'publish');
            console.debug('[feezal:attrs]', tagName, attrName, '→ isBool:', isBool, 'isColor:', isColor, 'isTopic:', isTopic, 'options:', options);

            // Read value from ALL selected elements and detect mixed state.
            const vals = this.selectedElems.map(e => {
                if (attrSpec.template) return e.querySelector('template')?.innerHTML ?? '';
                const rawAttr = e.getAttribute(this._toKebab(attrName)) ?? e.getAttribute(attrName) ?? null;
                return isBool ? (rawAttr !== null && rawAttr !== 'false') : (rawAttr ?? '');
            });
            const mixed = this.selectedElems.length > 1 && vals.some(v => v !== vals[0]);
            const value = mixed ? (isBool ? false : null) : vals[0];

            // Derive display type for plain text/number inputs (not used for special controls)
            const inputType = (!isBool && !isColor && !options && attrSpec.type !== 'select'
                               && attrSpec.type !== 'boolean' && attrSpec.type !== 'color')
                ? (attrSpec.type || 'text')
                : 'text';

            return {
                label:   attrName,   // always the real HTML attribute name
                attrName,            // always the HTML attribute name
                value,
                mixed,
                half,
                invalid: false,
                elem: {
                    input: !options && !attrSpec.textarea && !isBool && !attrSpec.list && !isColor && !isTopic,
                    inputType,
                    dropdown: Boolean(options),
                    options,
                    textarea: Boolean(attrSpec.textarea),
                    checkbox: isBool,
                    color: isColor,
                    mqttTopic: isTopic,
                    list: Boolean(attrSpec.list),
                    columns: attrSpec.columns,
                    tooltip: attrSpec.tooltip,
                    help: attrSpec.help || '',
                    template: Boolean(attrSpec.template),
                    validator: attrSpec.validator,
                    min: attrSpec.min,
                    max: attrSpec.max,
                    step: attrSpec.step
                }
            };
        });

        // Inject locked checkbox for all non-view elements
        if (tagName !== 'feezal-view') {
            const lockedVals = this.selectedElems.map(e => e.hasAttribute('locked'));
            const lockedMixed = this.selectedElems.length > 1 && lockedVals.some(v => v !== lockedVals[0]);
            this.items = [...this.items, {
                label: 'locked',
                attrName: 'locked',
                value: lockedMixed ? false : lockedVals[0],
                mixed: lockedMixed,
                half: false,
                invalid: false,
                elem: {
                    input: false, inputType: 'text', dropdown: false, options: null,
                    textarea: false, checkbox: true, color: false, mqttTopic: false, list: false,
                    columns: undefined, tooltip: undefined,
                    help: 'Prevent this element from being moved or resized in the editor',
                    template: false, validator: undefined, min: undefined, max: undefined, step: undefined
                }
            }];
        }
    }

    _makeTextItem(el, attrName) {
        return {
            label:    attrName,
            attrName,
            value: el.getAttribute(this._toKebab(attrName)) ?? el.getAttribute(attrName) ?? '',
            half: false,
            invalid: false,
            elem: {
                input: true, inputType: 'text', dropdown: false, options: null,
                textarea: false, checkbox: false, color: false, mqttTopic: false, list: false,
                columns: undefined, tooltip: undefined, template: false,
                validator: undefined, min: undefined, max: undefined, step: undefined
            }
        };
    }

    _makeTopicItem(el, attrName) {
        return {
            label:    attrName,
            attrName,
            value: el.getAttribute(this._toKebab(attrName)) ?? el.getAttribute(attrName) ?? '',
            half: false,
            invalid: false,
            elem: {
                input: false, inputType: 'text', dropdown: false, options: null,
                textarea: false, checkbox: false, color: false, mqttTopic: true, list: false,
                columns: undefined, tooltip: undefined, template: false,
                validator: undefined, min: undefined, max: undefined, step: undefined
            }
        };
    }

    // ── Auto-discovery (N12) ──────────────────────────────────────────────────

    async _fetchDiscoveryEntities() {
        try {
            const r = await fetch('/api/discovery/devices');
            if (r.ok) {
                const {devices} = await r.json();
                this.__discoveryEntities = devices || [];
                this.requestUpdate(); // refresh the device picker once entities arrive
            }
        } catch { /* offline or server not connected */ }
    }

    // Device picker shown above a custom inspector (N6). Lists every discovered
    // entity whose component matches the element's declared discovery component,
    // so the user can link/auto-configure without typing a topic first.
    _renderDiscoveryPicker() {
        const el = this.selectedElems?.[0];
        if (!el) return '';
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        const component = cls?.feezal?.discovery?.component;
        if (!component) return '';

        const allMatches = (this.__discoveryEntities || []).filter(e => e.component === component);
        if (!allMatches.length) return '';

        const q = (this._discoveryFilter || '').toLowerCase().trim();
        const matches = q
            ? allMatches.filter(m => {
                const label = this._discoveryOptionLabel(m).toLowerCase();
                const name  = (m.name || '').toLowerCase();
                const id    = (m.discovery_id || '').toLowerCase();
                return label.includes(q) || name.includes(q) || id.includes(q);
            })
            : allMatches;

        const linkedId = el.getAttribute('discovery-id') || '';
        const showSearch = allMatches.length > 5;
        return html`
            <div class="discovery-picker">
                <span class="dp-icon" title="Auto-discovered devices (${allMatches.length})">\u26A1</span>
                <sl-select class="dp-select" size="small" hoist
                    placeholder="Link a discovered device\u2026"
                    value="${linkedId}"
                    @sl-hide="${() => { this._discoveryFilter = ''; }}"
                    @sl-change="${e => this._onPickDiscovery(e.target.value)}">
                    ${showSearch ? html`
                        <div class="dp-search-wrap"
                            @click="${e => e.stopPropagation()}"
                            @mousedown="${e => e.stopPropagation()}">
                            <input class="dp-search" type="text"
                                placeholder="Filter ${allMatches.length} devices\u2026"
                                .value="${this._discoveryFilter || ''}"
                                @input="${e => { e.stopPropagation(); this._discoveryFilter = e.target.value; }}"
                                @keydown="${e => e.stopPropagation()}">
                        </div>` : ''}
                    ${matches.map(m => html`<sl-option value="${m.discovery_id}">${this._discoveryOptionLabel(m)}</sl-option>`)}
                    ${!matches.length ? html`<sl-option value="" disabled>No matches for \u201c${this._discoveryFilter}\u201d</sl-option>` : ''}
                </sl-select>
                ${linkedId ? html`<button class="dp-clear" title="Unlink device" @click="${this._onClearDiscovery}">&#x2715;</button>` : ''}
            </div>
        `;
    }

    // Build a meaningful option label from the discovery payload. The entity
    // `name` is often just the component type ("light"), so prefer the status
    // topic(s) found in the config, falling back to the name.
    _discoveryOptionLabel(entity) {
        const cfg = entity.config || {};
        const topic = cfg.state_topic || cfg.position_topic || cfg.percentage_state_topic ||
            cfg.current_temperature_topic || cfg.temperature_state_topic || cfg.command_topic || '';
        return topic || entity.name || entity.discovery_id;
    }

    _onPickDiscovery(id) {
        if (!id) return;
        const entity = (this.__discoveryEntities || []).find(e => e.discovery_id === id);
        if (entity) this._applyDiscovery(entity);
    }

    _onClearDiscovery() {
        const el = this.selectedElems?.[0];
        if (!el) return;
        el.removeAttribute('discovery-id');
        feezal.app.change();
        this.requestUpdate();
        this.shadowRoot?.querySelector('#custom-inspector-host')?.firstElementChild?.requestUpdate?.();
    }

    // Scan the entity cache for one whose config contains a topic field matching
    // the entered value. Only considers entities matching the element's declared
    // discovery component (if any), so the banner never fires for wrong element types.
    _checkDiscovery(topic) {
        if (!topic || !this.__discoveryEntities?.length) return;
        const el = this.selectedElems?.[0];
        if (!el) return;
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        const expectedComponent = cls?.feezal?.discovery?.component;

        const match = this.__discoveryEntities.find(entity => {
            if (expectedComponent && entity.component !== expectedComponent) return false;
            const cfg = entity.config || {};
            return Object.values(cfg).some(v => typeof v === 'string' && v === topic);
        });

        this._discoveryMatch = match || null;
    }

    _onAutoConfig() {
        const entity = this._discoveryMatch;
        if (!entity) return;
        this._applyDiscovery(entity);
        this._discoveryMatch = null;
    }

    // Apply a discovery entity's config to the selected element using the element's
    // feezal().discovery.map descriptor. Each entry maps a discovery config key to
    // a feezal attribute, with optional value transforms.
    _applyDiscovery(entity) {
        const el = this.selectedElems?.[0];
        if (!el) return;
        const tagName = el.name ? 'feezal-view' : el.localName;
        const cls = window.customElements.get(tagName);
        const discoveryMap = cls?.feezal?.discovery?.map;
        if (!discoveryMap) return;

        const cfg = entity.config || {};
        for (const [configKey, spec] of Object.entries(discoveryMap)) {
            const raw = cfg[configKey];
            if (raw === undefined || raw === null) continue;
            const attrName = typeof spec === 'string' ? spec : spec.attr;
            if (!attrName) continue;
            // onlyWhen guard — skip this mapping unless every guard key matches.
            if (typeof spec === 'object' && spec.onlyWhen &&
                !Object.entries(spec.onlyWhen).every(([k, v]) => cfg[k] === v)) {
                continue;
            }
            let value = raw;
            if (typeof spec === 'object') {
                if (spec.unit === 'mired\u2192kelvin') {
                    value = Math.round(1_000_000 / Number(raw));
                } else if (spec.valueMap) {
                    value = spec.valueMap[raw] ?? spec.valueMap['_default'] ?? raw;
                } else if (spec.transform === 'first') {
                    value = Array.isArray(raw) ? raw[0] : raw;
                } else if (spec.transform === 'join') {
                    value = Array.isArray(raw) ? raw.join(',') : raw;
                } else if (spec.transform === 'jsonStringify') {
                    value = JSON.stringify(raw);
                } else if (spec.transform === 'colorMode') {
                    // supported_color_modes array → a single feezal centre control
                    const modeMap = {
                        color_temp: 'color_temp', xy: 'hs', hs: 'hs',
                        rgb: 'rgb', rgbw: 'rgb', rgbww: 'rgb', white: 'brightness',
                        brightness: 'brightness', onoff: 'brightness',
                    };
                    const list = Array.isArray(raw) ? raw : [raw];
                    value = list.map(m => modeMap[m]).find(Boolean) || 'brightness';
                } else if (spec.transform === 'valueTemplateToPath') {
                    // Convert a HA value_template like "{{ value_json.state }}" to
                    // a feezal message-property path like "payload.state".
                    const m = /\{\{\s*value_json\.(\w+)\s*\}\}/.exec(String(raw));
                    if (!m) continue; // complex/unsupported template — leave attribute at default
                    value = 'payload.' + m[1];
                }
            }
            el.setAttribute(attrName, String(value));
        }

        // Store the discovery-id for future re-sync (N12 MVP)
        if (entity.discovery_id) el.setAttribute('discovery-id', entity.discovery_id);

        this._rebuildItems();
        feezal.app.change();
        // Refresh a custom inspector (N6) so its fields show the applied values.
        this.shadowRoot?.querySelector('#custom-inspector-host')?.firstElementChild?.requestUpdate?.();
    }
}

window.customElements.define('feezal-sidebar-inspector-attributes', FeezalSidebarInspectorAttributes);

