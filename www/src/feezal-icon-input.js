import {LitElement, html, css} from 'lit';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import MATERIAL_ICONS from './material-design-icons.js';
import {iconSets} from './feezal-icon.js';
import {iconPickerGroups} from './feezal-sidebar-inspector-attributes.js';

/**
 * feezal-icon-input — standalone icon field with the same UX as the generic
 * attribute inspector's `type: 'icon'` control (N19/N23): an input with a
 * live icon preview prefix, typing filters an icon-tile popup grid across all
 * registered sets (set-chooser chips, `set:` prefix scoping, keyboard cursor
 * + Enter/Escape). For custom (N6) inspectors that manage icons inside JSON
 * attributes (layout-app drawer entries / actions, …) where the generic
 * control isn't available.
 *
 * Props:  value {string}   current icon name ('' | 'home' | 'mdi:sofa')
 *         label {string}   optional field label
 *         placeholder {string}
 * Event:  feezal-change    detail: {value} — on pick, typed change or clear
 *
 * Editor-only (defined by the editor bundle) — custom inspectors use the tag
 * without importing it, like <feezal-template-editor>.
 */
class FeezalIconInput extends LitElement {
    static properties = {
        value:       {type: String},
        label:       {type: String},
        placeholder: {type: String},
        _open:       {state: true},
        _query:      {state: true},
        _set:        {state: true},
        _cursor:     {state: true},
        _alignRight: {state: true},
    };

    static styles = css`
        :host { display: block; }
        .material-icons {
            font-family: 'Material Icons';
            font-weight: normal; font-style: normal;
            font-size: inherit; line-height: 1; letter-spacing: normal; text-transform: none;
            display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr;
            -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .icon-wrap { position: relative; }
        .icon-wrap sl-input feezal-icon[slot=prefix] { font-size: 18px; opacity: 0.85; }
        /* Same dark theming as the attribute inspector applies to its own
           sl-inputs — ::part rules don't cross shadow roots, so repeat them
           here (otherwise the field goes white on focus in dark mode). */
        sl-input::part(form-control-label) { color: var(--sl-input-label-color, inherit); font-size: 12px; }
        sl-input::part(base) { background: var(--feezal-bg, #fff); border-color: var(--feezal-border, #ccc); color: var(--feezal-color, #333); }
        sl-input::part(input) { background: var(--feezal-bg, #fff); color: var(--sl-input-color, #333); }
        .icon-pop {
            position: absolute; top: 100%; left: 0; z-index: 9999;
            /* The host field can be narrow (inspector grid column) — give the
               tile grid room regardless, without shrinking below field width. */
            width: max(100%, 280px);
            margin-top: 2px;
            background: var(--feezal-bg, #fff); border: 1px solid var(--feezal-border, #ccc);
            border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
            max-height: 260px; display: flex; flex-direction: column;
        }
        /* Field close to the right viewport edge: anchor the popup's RIGHT
           edge to the field instead so it grows leftwards, not off-screen. */
        .icon-pop.align-right { left: auto; right: 0; }
        .icon-sets {
            display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 6px 4px;
            border-bottom: 1px solid var(--feezal-border, #eee);
        }
        .icon-set-chip {
            border: 1px solid var(--feezal-border, #ccc); background: none;
            color: var(--feezal-color, #333); border-radius: 10px;
            font-size: 11px; padding: 2px 8px; cursor: pointer; line-height: 1.4;
        }
        .icon-set-chip:hover { border-color: var(--sl-color-primary-500, #0ea5e9); }
        .icon-set-chip.active {
            background: var(--sl-color-primary-600, #0284c7); border-color: var(--sl-color-primary-600, #0284c7);
            color: #fff;
        }
        .icon-grid {
            padding: 6px; overflow-y: auto;
            display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 2px;
        }
        .icon-set-header {
            grid-column: 1 / -1; font-size: 10px; text-transform: uppercase;
            letter-spacing: 0.06em; opacity: 0.55; padding: 4px 2px 1px;
            color: var(--feezal-color, #333);
        }
        .icon-empty {
            padding: 10px 8px; font-size: 12px; opacity: 0.55; font-style: italic;
            color: var(--feezal-color, #333);
        }
        .icon-tile {
            display: flex; align-items: center; justify-content: center;
            width: 100%; height: 34px; border: none; background: none; cursor: pointer;
            border-radius: 4px; color: var(--feezal-color, #333);
        }
        .icon-tile:hover { background: var(--sl-color-primary-600, #0284c7); color: #fff; }
        .icon-tile.active { background: rgba(2,132,199,0.18); }
        .icon-tile.cursor { outline: 2px solid var(--sl-color-primary-500, #0ea5e9); outline-offset: -2px; }
        .icon-tile .material-icons, .icon-tile feezal-icon { font-size: 20px; }
    `;

    constructor() {
        super();
        this.value       = '';
        this.label       = '';
        this.placeholder = 'icon name';
        this._open       = false;
        this._query      = '';
        this._cursor     = -1;
        this._alignRight = false;
        // Same persisted set chip as the attribute inspector's picker.
        this._set        = localStorage.getItem('feezal-icon-set') || 'material';
        this._closeTimer = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this._closeTimer);
    }

    _emit(value) {
        this.value = value;
        this.dispatchEvent(new CustomEvent('feezal-change', {bubbles: true, composed: true, detail: {value}}));
    }

    _openPicker() {
        clearTimeout(this._closeTimer);
        this._query = this.value || '';
        // Decide the anchor edge up front from the field's position: the popup
        // is max(field width, 280px) wide and left-anchored by default — if
        // that would cross the right viewport edge, right-anchor it instead.
        const rect = this.getBoundingClientRect();
        this._alignRight = rect.left + Math.max(rect.width, 280) > window.innerWidth - 8;
        this._open = true;
    }

    _scheduleClose() {
        clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => { this._open = false; }, 150);
    }

    _select(name) {
        clearTimeout(this._closeTimer);
        this._open = false;
        this._query = '';
        this._cursor = -1;
        this._emit(name);
    }

    _selectSet(set) {
        this._set = set;
        this._cursor = -1;
        try {
            localStorage.setItem('feezal-icon-set', set);
        } catch { /* quota — non-fatal */ }
    }

    _keydown(e, flat) {
        if (!this._open || flat.length === 0) return;
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                this._cursor = Math.min(this._cursor + 1, flat.length - 1);
                e.preventDefault();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                this._cursor = Math.max(this._cursor - 1, -1);
                e.preventDefault();
                break;
            case 'Enter':
                if (this._cursor >= 0 && flat[this._cursor]) {
                    this._select(flat[this._cursor].value);
                    e.preventDefault();
                    e.stopPropagation();
                }
                break;
            case 'Escape':
                this._open = false;
                this._cursor = -1;
                e.stopPropagation();
                break;
        }
    }

    render() {
        const registered = [...iconSets().keys()];
        const multiSet = registered.length > 0;
        const wantedSet = multiSet ? this._set : 'material';

        const {activeSet, groups, flat} = this._open
            ? iconPickerGroups({
                materialNames: MATERIAL_ICONS,
                sets: iconSets(),
                activeSet: wantedSet,
                query: this._query,
            })
            : {activeSet: wantedSet, groups: [], flat: []};
        const chips = multiSet ? ['all', 'material', ...registered] : [];
        let tileIndex = -1;

        return html`
            <div class="icon-wrap">
                <sl-input .label="${this.label || ''}" size="small"
                    autocomplete="off"
                    .value="${this.value ?? ''}"
                    placeholder="${this.placeholder}"
                    @sl-focus="${this._openPicker}"
                    @sl-input="${e => { this._query = e.target.value; this._open = true; this._cursor = -1; }}"
                    @sl-blur="${this._scheduleClose}"
                    @sl-change="${e => this._emit(e.target.value)}"
                    @keydown="${e => this._keydown(e, flat)}">
                    ${this.value ? html`<feezal-icon slot="prefix" name="${this.value}"></feezal-icon>` : ''}
                </sl-input>
                ${this._open && (groups.length || chips.length) ? html`
                    <div class="icon-pop ${this._alignRight ? 'align-right' : ''}" @mousedown="${e => e.preventDefault()}">
                        ${chips.length ? html`
                            <div class="icon-sets">
                                ${chips.map(set => html`
                                    <button class="icon-set-chip ${set === activeSet ? 'active' : ''}"
                                        @click="${() => this._selectSet(set)}">${set === 'all' ? 'All' : set}</button>
                                `)}
                            </div>
                        ` : ''}
                        ${groups.length === 0 ? html`
                            <div class="icon-empty">no matching icons</div>
                        ` : ''}
                        <div class="icon-grid">
                            ${groups.map(group => html`
                                ${activeSet === 'all' && chips.length ? html`
                                    <div class="icon-set-header">${group.set}</div>
                                ` : ''}
                                ${group.names.map(() => {
                                    tileIndex++;
                                    const entry = flat[tileIndex];
                                    const isCursor = tileIndex === this._cursor;
                                    return html`
                                        <button class="icon-tile ${entry.value === this.value ? 'active' : ''} ${isCursor ? 'cursor' : ''}"
                                            title="${entry.value}"
                                            @click="${() => this._select(entry.value)}">
                                            ${group.set === 'material' && !entry.preview
                                                ? html`<span class="material-icons">${entry.name}</span>`
                                                : html`<feezal-icon name="${entry.preview ?? entry.value}"></feezal-icon>`}
                                        </button>
                                    `;
                                })}
                            `)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('feezal-icon-input', FeezalIconInput);
export {FeezalIconInput};
