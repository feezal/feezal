import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

class FeezalSidebarEditor extends LitElement {
    static properties = {
        themeMode:      {type: String, reflect: true},
        selectionColor: {type: String, reflect: true},
        gridColor:      {type: String, reflect: true},
        gridSize:       {type: Number, reflect: true},
        gridVisible:    {type: Boolean, reflect: true},
        snapping:       {type: String, reflect: true}
    };

    static styles = css`
        :host { display: block; height: 100%; background-color: var(--feezal-bg, white); box-sizing: border-box; }
        .form { margin: 12px; display: flex; flex-direction: column; gap: 12px; }
        .row { display: flex; gap: 12px; align-items: flex-end; }
        .row > * { flex: 1; }
        sl-select, sl-input { width: 100%; }
        sl-input::part(form-control-label), sl-select::part(form-control-label) { color: var(--sl-input-label-color, inherit); }
        sl-input::part(base), sl-select::part(combobox) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .color-label {
            display: flex; flex-direction: column; gap: 4px; flex: 1;
            font-size: var(--sl-input-label-font-size-small, 12px);
            color: var(--sl-input-label-color, inherit);
        }
        input[type="color"] {
            width: 100%; height: 28px; padding: 2px 3px;
            border: 1px solid var(--feezal-border, #ccc); border-radius: 4px;
            background: var(--feezal-bg, white); cursor: pointer;
            box-sizing: border-box;
        }
    `;

    constructor() {
        super();
        this.themeMode = 'os';
        this.selectionColor = '#0284c7';
        this.gridColor = '#cccccc';
        this.gridSize = 24;
        this.gridVisible = false;
        this.snapping = 'elements';
    }

    render() {
        return html`
            <div class="form">
                <sl-select label="Color theme" size="small"
                    .value="${this.themeMode}"
                    @sl-change="${e => { this.themeMode = e.target.value; this._notify('theme-mode'); }}">
                    <sl-option value="os">OS preference</sl-option>
                    <sl-option value="light">Light</sl-option>
                    <sl-option value="dark">Dark</sl-option>
                </sl-select>
                <div class="row">
                    <label class="color-label">
                        Selection color
                        <input type="color" .value="${this.selectionColor}"
                            @input="${e => { this.selectionColor = e.target.value; this._notify('selection-color'); }}">
                    </label>
                    <label class="color-label">
                        Grid color
                        <input type="color" .value="${this.gridColor}"
                            @input="${e => { this.gridColor = e.target.value; this._notify('grid-color'); }}">
                    </label>
                </div>
                <sl-select label="Snapping" size="small"
                    .value="${this.snapping}"
                    @sl-change="${e => { this.snapping = e.target.value; this._notify('snapping'); }}">
                    <sl-option value="off">off</sl-option>
                    <sl-option value="elements">elements</sl-option>
                    <sl-option value="grid">grid</sl-option>
                </sl-select>
                <div class="row">
                    <sl-input label="Grid size" size="small" type="number"
                        .value="${String(this.gridSize)}"
                        @sl-change="${e => { this.gridSize = Number(e.target.value); this._notify('grid-size'); }}">
                    </sl-input>
                    <sl-switch size="small"
                        .checked="${this.gridVisible}"
                        @sl-change="${e => { this.gridVisible = e.target.checked; this._notify('grid-visible'); }}">
                        Show Grid
                    </sl-switch>
                </div>
            </div>
        `;
    }

    _notify(attr) {
        this.dispatchEvent(new CustomEvent(attr + '-changed', {bubbles: true, composed: true, detail: {value: this[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]}}));
    }
}

window.customElements.define('feezal-sidebar-editor', FeezalSidebarEditor);

