/* global feezal */
import { FeezalElement, feezalBaseStyles, html, css } from '@feezal/feezal-element';

class FeezalElementLayoutRepeater extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                name: 'Repeater',
                category: 'Layout',
                color: '#4a7080',
                icon: 'view_list'
            },
            description: 'Dynamically creates one child element per item in an MQTT JSON-array payload. ' +
                'Configure the child element type and map payload fields to child element attributes.',
            attributes: [
                {
                    name: 'subscribe',
                    type: 'mqttTopic',
                    help: 'MQTT topic that publishes a JSON array. Each item in the array becomes one child element.'
                },
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the array within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.items" to navigate into a JSON payload.'},
                {
                    name: 'child-element',
                    type: 'string',
                    help: 'Tag name of the child element to create, e.g. feezal-element-material-switch.'
                },
                {
                    name: 'attribute-map',
                    type: 'string',
                    textarea: true,
                    help: 'JSON object mapping payload field names to child element attribute names. ' +
                        'E.g. {"subscribe":"subscribe","publish":"publish","label":"label"}'
                },
                {
                    name: 'key-field',
                    type: 'string',
                    help: 'Payload field used to key items for diffing. ' +
                        'Prevents destroy/recreate on unchanged items when the array is updated. ' +
                        'E.g. "id" or "subscribe".'
                },
                {
                    name: 'direction',
                    type: 'select',
                    options: ['column', 'row', 'row-wrap'],
                    default: 'column',
                    help: 'Flex direction for arranging child elements. "row-wrap" enables wrapping.'
                },
                {
                    name: 'gap',
                    type: 'string',
                    default: '4px',
                    help: 'CSS gap between child elements, e.g. "8px" or "4px 8px".'
                },
                {
                    name: 'preview-count',
                    type: 'number',
                    default: 3,
                    help: 'Number of placeholder children shown in the editor canvas.'
                }
            ],
            styles: ['top', 'left', 'width', 'height', 'padding', 'overflow'],
            defaultStyle: { width: '200px', height: '160px' }
        };
    }

    static properties = {
        childElement: { type: String,  reflect: true, attribute: 'child-element' },
        attributeMap: { type: String,  reflect: true, attribute: 'attribute-map' },
        keyField:     { type: String,  reflect: true, attribute: 'key-field' },
        direction:    { type: String,  reflect: true },
        gap:          { type: String,  reflect: true },
        previewCount: { type: Number,  reflect: true, attribute: 'preview-count' }
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            overflow: auto;
            box-sizing: border-box;
        }
        #container {
            display: flex;
            box-sizing: border-box;
            width: 100%;
            min-height: 0;
        }
        /* ── Editor placeholder ─────────────────────────────────────────── */
        .editor-outer {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
            border: 1px dashed #4a7080;
            border-radius: 3px;
        }
        .editor-header {
            display: flex;
            align-items: center;
            gap: 5px;
            background: #4a7080;
            color: #fff;
            font-size: 11px;
            padding: 3px 7px;
            flex-shrink: 0;
            min-width: 0;
        }
        .editor-header .icon {
            font-family: 'Material Icons';
            font-size: 14px;
            flex-shrink: 0;
        }
        .editor-header .tag {
            flex: 1;
            opacity: 0.85;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .editor-header .count { opacity: 0.65; flex-shrink: 0; }
        .editor-items {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 5px;
            background: rgba(74,112,128,0.07);
            overflow: hidden;
        }
        .editor-item {
            background: rgba(74,112,128,0.13);
            border: 1px dashed rgba(74,112,128,0.6);
            border-radius: 3px;
            flex: 1;
            min-height: 16px;
            display: flex;
            align-items: center;
            padding: 1px 6px;
            font-size: 10px;
            color: #4a7080;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .editor-item .icon {
            font-family: 'Material Icons';
            font-size: 11px;
            margin-right: 3px;
            flex-shrink: 0;
        }
    `];

    constructor() {
        super();
        this.childElement = '';
        this.attributeMap = '{}';
        this.keyField     = '';
        this.direction    = 'column';
        this.gap          = '4px';
        this.previewCount = 3;
        this._childKeys   = new Map(); // keyField value → child element node
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            // Wait for first render so #container exists before we start receiving messages
            this.updateComplete.then(() => {
                this.addSubscription(this.subscribe, msg => this._onMessage(msg));
            });
        }
    }

    // ── MQTT ─────────────────────────────────────────────────────────────────

    _onMessage(msg) {
        let arr = this.getProperty(msg, this.messageProperty);
        if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch { return; }
        }
        if (!Array.isArray(arr)) return;
        this._updateChildren(arr);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _parseMap() {
        try {
            const m = JSON.parse(this.attributeMap || '{}');
            return m !== null && typeof m === 'object' && !Array.isArray(m) ? m : {};
        } catch {
            return {};
        }
    }

    _getKey(item) {
        if (this.keyField && item !== null && typeof item === 'object') {
            const k = item[this.keyField];
            return k != null ? String(k) : null;
        }
        return null;
    }

    _applyMap(el, item, attrMap) {
        for (const [payloadKey, attrName] of Object.entries(attrMap)) {
            if (Object.prototype.hasOwnProperty.call(item, payloadKey)) {
                const val = item[payloadKey];
                if (val == null) {
                    el.removeAttribute(String(attrName));
                } else {
                    el.setAttribute(String(attrName), String(val));
                }
            }
        }
    }

    _updateChildren(items) {
        const container = this.renderRoot?.querySelector('#container');
        if (!container) return;

        const tagName = (this.childElement || '').trim().toLowerCase();
        if (!tagName) {
            container.replaceChildren();
            this._childKeys.clear();
            return;
        }

        const attrMap = this._parseMap();

        if (this.keyField) {
            this._updateKeyedChildren(container, items, tagName, attrMap);
        } else {
            this._updateUnkeyedChildren(container, items, tagName, attrMap);
        }
    }

    _updateKeyedChildren(container, items, tagName, attrMap) {
        // Build set of incoming keys
        const incomingKeys = new Set();
        items.forEach(item => {
            const k = this._getKey(item);
            if (k != null) incomingKeys.add(k);
        });

        // Remove children whose key is no longer present
        for (const [k, el] of this._childKeys) {
            if (!incomingKeys.has(k)) {
                el.remove();
                this._childKeys.delete(k);
            }
        }

        // Insert / update in correct order
        items.forEach((item, idx) => {
            const k = this._getKey(item);
            let el;

            if (k != null && this._childKeys.has(k)) {
                el = this._childKeys.get(k);
            } else {
                el = document.createElement(tagName);
                if (k != null) this._childKeys.set(k, el);
            }

            this._applyMap(el, item, attrMap);

            // Move to correct position if needed
            const sibling = container.children[idx];
            if (sibling !== el) {
                container.insertBefore(el, sibling || null);
            }
        });

        // Trim any excess untracked children
        while (container.children.length > items.length) {
            container.lastElementChild.remove();
        }
    }

    _updateUnkeyedChildren(container, items, tagName, attrMap) {
        this._childKeys.clear();
        const els = items.map(item => {
            const el = document.createElement(tagName);
            this._applyMap(el, item, attrMap);
            return el;
        });
        container.replaceChildren(...els);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    render() {
        const [flexDir, flexWrap] = this.direction === 'row-wrap'
            ? ['row', 'wrap']
            : [this.direction || 'column', 'nowrap'];

        return html`
            <div id="container"
                style="flex-direction:${flexDir};flex-wrap:${flexWrap};gap:${this.gap || '4px'}">
            </div>
        `;
    }
}

customElements.define('feezal-element-layout-repeater', FeezalElementLayoutRepeater);
export { FeezalElementLayoutRepeater };
