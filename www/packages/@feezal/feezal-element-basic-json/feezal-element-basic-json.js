/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-json — JSON tree viewer (E88).
 *
 * Subscribes to a topic and renders the JSON payload as a collapsible tree:
 * objects/arrays are toggleable nodes (chevron + key + preview `{…} 3 keys`
 * / `[…] 5 items`), primitives are `key: value` rows coloured per type.
 *
 * The hand-rolled recursive Lit renderer keeps expand/collapse state per JSON
 * path in a `Set` (`_expanded`) so a live-updating payload never snaps the
 * tree shut — user-toggled paths and any auto-expanded paths persist across
 * message updates. New/unseen container paths follow `expand-depth`.
 *
 * Non-JSON payloads render as the raw string (never an error state). The
 * `max-nodes` guard caps how many rows are materialised on a monster payload:
 * beyond it, the remaining siblings collapse into a "+N more…" hint so the
 * tab never freezes.
 */

// Editor-canvas placeholder so a freshly dropped element shows structure
// before any real message arrives.
const SAMPLE = {
    sensor: {temperature: 21.5, humidity: 48, unit: '°C'},
    online: true,
    tags: ['kitchen', 'floor-1'],
    lastSeen: null
};

class FeezalElementBasicJson extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'JSON Tree',
                color: '#4a6080',
                icon: 'data_object'
            },
            description: 'Renders a JSON payload as a collapsible tree — the "what is this device actually publishing" inspector. Expand/collapse state is kept per path so a live-updating topic never snaps the tree shut. Non-JSON payloads show as the raw string; huge payloads are capped by max-nodes.',
            attributes: [
                {name: 'subscribe', type: 'mqttTopic',
                    help: 'Topic whose payload is rendered as a JSON tree.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.data" to navigate into the payload.'},
                {name: 'expand-depth', type: 'number', min: 0, step: 1, default: '1',
                    help: 'Auto-expand this many levels of newly-seen nodes (0 = everything collapsed, 1 = root open). Paths you toggle yourself always keep their state across message updates.'},
                {name: 'max-nodes', type: 'number', min: 1, step: 1, default: '500',
                    help: 'Render guard: the maximum number of tree rows materialised for one payload. Beyond it the remaining siblings collapse into a "+N more…" hint so a monster payload never freezes the tab.'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-json-key-color', type: 'color',
                    default: 'var(--primary-text-color, #333)',
                    help: 'Object/array key colour.'},
                {property: '--feezal-json-string-color', type: 'color',
                    default: 'var(--accent-color, #f44336)',
                    help: 'String value colour.'},
                {property: '--feezal-json-number-color', type: 'color',
                    default: 'var(--primary-color, #0284c7)',
                    help: 'Number and boolean value colour.'},
                {property: '--feezal-json-null-color', type: 'color',
                    default: 'var(--secondary-text-color, #757575)',
                    help: 'null/undefined value and punctuation colour.'},
                {property: '--feezal-json-guide-color', type: 'color',
                    default: 'var(--divider-color, #e0e0e0)',
                    help: 'Indent guide / border colour.'}
            ],
            restrict: {minWidth: 120, minHeight: 60},
            defaultStyle: {width: '320px', height: '300px'}
        };
    }

    static properties = {
        expandDepth: {type: Number, reflect: true, attribute: 'expand-depth'},
        maxNodes:    {type: Number, reflect: true, attribute: 'max-nodes'},
        _hasData:    {state: true},
        _raw:        {state: true},
        _rawText:    {state: true},
        _json:       {state: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            width: 320px;
            height: 300px;
            font-size: 13px;
            --feezal-json-key-color: var(--primary-text-color, #333);
            --feezal-json-string-color: var(--accent-color, #f44336);
            --feezal-json-number-color: var(--primary-color, #0284c7);
            --feezal-json-null-color: var(--secondary-text-color, #757575);
            --feezal-json-guide-color: var(--divider-color, #e0e0e0);
            background: var(--secondary-background-color, #fff);
            color: var(--feezal-json-key-color);
        }
        .tree {
            box-sizing: border-box;
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 4px 6px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            line-height: 1.5;
            white-space: nowrap;
        }
        .node { }
        .children {
            margin-left: 12px;
            padding-left: 6px;
            border-left: 1px solid var(--feezal-json-guide-color);
        }
        .row {
            display: flex;
            align-items: baseline;
            max-width: 100%;
        }
        .row.container { cursor: pointer; }
        .row.container:hover { background: color-mix(in srgb, var(--feezal-json-key-color) 6%, transparent); }
        .chevron {
            flex: none;
            width: 1em;
            color: var(--feezal-json-null-color);
            user-select: none;
        }
        .key { color: var(--feezal-json-key-color); }
        .punct { color: var(--feezal-json-null-color); padding: 0 0.25em; }
        .preview { color: var(--feezal-json-null-color); font-style: italic; }
        .value {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .value.string  { color: var(--feezal-json-string-color); }
        .value.number  { color: var(--feezal-json-number-color); }
        .value.boolean { color: var(--feezal-json-number-color); }
        .value.null    { color: var(--feezal-json-null-color); font-style: italic; }
        .row.more {
            color: var(--feezal-json-null-color);
            font-style: italic;
            cursor: default;
            padding-left: 1em;
        }
        .raw {
            margin: 0;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            white-space: pre-wrap;
            word-break: break-word;
            color: var(--feezal-json-key-color);
        }
        .empty {
            color: var(--feezal-json-null-color);
            font-style: italic;
        }
    `];

    constructor() {
        super();
        this.expandDepth = 1;
        this.maxNodes = 500;
        this._hasData = false;
        this._raw = false;
        this._rawText = '';
        this._json = undefined;
        // Non-reactive: mutated in place, persist across message updates so a
        // live payload never resets the user's expand/collapse choices.
        this._expanded = new Set();
        this._seen = new Set();
        this._nodeCount = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const value = this.getProperty(msg, this.messageProperty);
                if (value === undefined) {
                    return;
                }
                if (typeof value === 'string') {
                    try {
                        this._json = JSON.parse(value);
                        this._raw = false;
                    } catch {
                        this._rawText = value;
                        this._raw = true;
                    }
                } else {
                    this._json = value;
                    this._raw = false;
                }
                this._hasData = true;
            });
        }
    }

    _typeOf(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (Array.isArray(value)) {
            return 'array';
        }
        const t = typeof value;
        return t === 'object' ? 'object' : t;
    }

    // Seed a container path the first time it becomes visible: unseen paths
    // shallower than expand-depth start open; deeper ones start collapsed.
    // Once seen (auto-decided or user-toggled) a path is never re-seeded, so
    // subsequent messages keep its state.
    _isOpen(path, depth) {
        if (!this._seen.has(path)) {
            this._seen.add(path);
            if (depth < this.expandDepth) {
                this._expanded.add(path);
            }
        }
        return this._expanded.has(path);
    }

    _toggle(path) {
        if (this._expanded.has(path)) {
            this._expanded.delete(path);
        } else {
            this._expanded.add(path);
        }
        this._seen.add(path);
        this.requestUpdate();
    }

    _formatPrimitive(value, type) {
        if (type === 'null') {
            return value === undefined ? 'undefined' : 'null';
        }
        if (type === 'string') {
            return `"${value}"`;
        }
        return String(value);
    }

    _renderPrimitive(key, value, type) {
        this._nodeCount++;
        const text = this._formatPrimitive(value, type);
        return html`
            <div class="row primitive">
                ${key === null ? '' : html`<span class="key">${key}</span><span class="punct">:</span>`}
                <span class="value ${type}" title="${text}">${text}</span>
            </div>`;
    }

    _renderChildren(entries, parentPath, depth) {
        const out = [];
        for (let i = 0; i < entries.length; i++) {
            if (this._nodeCount >= this.maxNodes) {
                const remaining = entries.length - i;
                out.push(html`<div class="row more"
                    title="max-nodes (${this.maxNodes}) render limit reached">+${remaining} more…</div>`);
                break;
            }
            const [k, v] = entries[i];
            out.push(this._renderNode(k, v, `${parentPath}/${k}`, depth + 1));
        }
        return out;
    }

    _renderContainer(key, value, path, depth, type) {
        this._nodeCount++;
        const open = this._isOpen(path, depth);
        const entries = type === 'array'
            ? value.map((v, i) => [String(i), v])
            : Object.entries(value);
        const n = entries.length;
        const preview = type === 'array'
            ? `[…] ${n} item${n === 1 ? '' : 's'}`
            : `{…} ${n} key${n === 1 ? '' : 's'}`;
        const brackets = type === 'array' ? ['[', ']'] : ['{', '}'];
        return html`
            <div class="node">
                <div class="row container" @click="${() => this._toggle(path)}"
                    title="${key === null ? preview : `${key}: ${preview}`}">
                    <span class="chevron">${open ? '▾' : '▸'}</span>
                    ${key === null ? '' : html`<span class="key">${key}</span><span class="punct">:</span>`}
                    ${open
                        ? html`<span class="punct">${brackets[0]}</span>`
                        : html`<span class="preview">${preview}</span>`}
                </div>
                ${open ? html`
                    <div class="children">${this._renderChildren(entries, path, depth)}</div>
                    <div class="row closer"><span class="punct">${brackets[1]}</span></div>
                ` : ''}
            </div>`;
    }

    _renderNode(key, value, path, depth) {
        const type = this._typeOf(value);
        if (type === 'object' || type === 'array') {
            return this._renderContainer(key, value, path, depth, type);
        }
        return this._renderPrimitive(key, value, type);
    }

    render() {
        this._nodeCount = 0;
        if (this._hasData && this._raw) {
            return html`<div class="tree"><div class="raw" title="${this._rawText}">${this._rawText}</div></div>`;
        }
        let value;
        if (this._hasData) {
            value = this._json;
        } else if (feezal.isEditor) {
            value = SAMPLE;
        } else {
            return html`<div class="tree"><div class="empty">— no data —</div></div>`;
        }
        return html`<div class="tree">${this._renderNode(null, value, '$', 0)}</div>`;
    }
}

window.customElements.define('feezal-element-basic-json', FeezalElementBasicJson);

export {FeezalElementBasicJson};
