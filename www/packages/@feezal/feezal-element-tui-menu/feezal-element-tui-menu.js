/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-menu (E59)
 *
 * Numbered hotkey menu: `[1] Lights   [2] Heating …`. Click an entry — or
 * press its digit while the menu is focused — to publish that entry's
 * payload to its topic.
 */
class FeezalElementTuiMenu extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Menu', category: 'TUI', color: '#1e6b2f', icon: 'format_list_numbered'},
            description: 'Numbered hotkey menu ([1] Lights …). Click or press the digit (menu focused) to publish the entry’s payload.',
            attributes: [
                {name: 'items', type: 'objectList',
                    itemFields: [
                        {key: 'label', placeholder: 'Lights'},
                        {key: 'publish', placeholder: 'mqtt/topic'},
                        {key: 'payload', placeholder: '1'},
                    ],
                    help: 'Menu entries — hotkeys are assigned 1…9 in order. Each click/keypress publishes the entry’s payload to its topic.'},
                {name: 'orientation', type: 'select', options: ['vertical', 'horizontal'], default: 'vertical',
                    help: 'Stack entries vertically (default) or lay them out in a row.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 20},
            defaultStyle: {width: '200px', height: '110px'},
        };
    }

    static properties = {
        items:       {type: String, reflect: true},
        orientation: {type: String, reflect: true},
        _flash:      {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block; box-sizing: border-box; overflow: hidden;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
            font-size: 14px; line-height: 1.5; padding: 2px 0.5ch;
        }
        :host(:focus-visible) { outline: 1px solid var(--feezal-tui-color, #33ff66); outline-offset: 1px; }
        .menu { display: flex; flex-direction: column; }
        :host([orientation='horizontal']) .menu { flex-direction: row; flex-wrap: wrap; gap: 0 3ch; }
        .entry {
            display: flex; gap: 1ch; align-items: baseline; white-space: nowrap;
            cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
        }
        .entry:hover, .entry.flash { background: color-mix(in srgb, var(--feezal-tui-color, #33ff66) 22%, transparent); }
        .key { opacity: 0.85; }
        .hint { opacity: 0.5; font-size: 0.85em; padding-top: 2px; }
    `];

    constructor() {
        super();
        this.items = '[]';
        this.orientation = 'vertical';
        this._flash = -1;
        this.__flashTimer = null;
        this.__onKey = e => {
            const n = Number(e.key);
            if (!Number.isInteger(n) || n < 1) return;
            const entry = this._entries()[n - 1];
            if (entry) {
                e.preventDefault();
                this._activate(n - 1);
            }
        };
    }

    // Menu entries publish; no subscription of its own.
    _subscribe() { /* none */ }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
        this.addEventListener('keydown', this.__onKey);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this.__onKey);
        clearTimeout(this.__flashTimer);
    }

    _entries() {
        try {
            const r = JSON.parse(this.items || '[]');
            return (Array.isArray(r) ? r : []).filter(it => it && (it.label || it.publish)).slice(0, 9);
        } catch {
            return [];
        }
    }

    _activate(index) {
        if (feezal.isEditor) return;
        const entry = this._entries()[index];
        if (!entry) return;
        this._flash = index;
        clearTimeout(this.__flashTimer);
        this.__flashTimer = setTimeout(() => { this._flash = -1; }, 250);
        if (entry.publish) {
            feezal.connection.pub(entry.publish, entry.payload ?? '');
        }
    }

    render() {
        const entries = this._entries();
        return html`
            <div class="menu">
                ${entries.length === 0 ? html`
                    <div class="hint">${feezal.isEditor ? 'add menu items in the inspector' : ''}</div>` : ''}
                ${entries.map((entry, i) => html`
                    <div class="entry ${this._flash === i ? 'flash' : ''}" @click="${() => this._activate(i)}">
                        <span class="key">[${i + 1}]</span>
                        <span class="label">${entry.label || entry.publish}</span>
                    </div>`)}
            </div>`;
    }
}

customElements.define('feezal-element-tui-menu', FeezalElementTuiMenu);
export {FeezalElementTuiMenu};
