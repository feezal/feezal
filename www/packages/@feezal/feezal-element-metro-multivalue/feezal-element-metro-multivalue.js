/* global feezal */
import {html, css} from '@feezal/feezal-element';
import {MetroTileBase} from '@feezal/feezal-metro';
import {MultivalueController, multivalueAttributes, multivalueDiscoveryMap}
    from '@feezal/feezal-controller-multivalue';

/**
 * feezal-element-metro-multivalue (E165)
 *
 * Metro multi-value tile — a view over MultivalueController (E137). stack:
 * smaller secondary readouts above the big primary value; grid: a row/col
 * pivot table on the tile front. Display-only, no flip back.
 */
class FeezalElementMetroMultivalue extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Multivalue', category: 'Metro', color: '#1ba1e2', icon: 'data_table'},
            description: 'Metro multi-value tile — several values from one device: primary + smaller secondaries ' +
                '(stack) or a rows × columns table (grid). Display-only.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                ...multivalueAttributes,
            ],
            styles: [
                ...MetroTileBase.tileStyles,
                {property: '--feezal-metro-font-size-grid', default: '13px', help: 'Grid cell font size.'},
            ],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
            discovery: {component: 'sensor', map: multivalueDiscoveryMap},
        };
    }

    static properties = {
        // Config properties observe their attributes (edits trigger updated())
        // but deliberately do NOT reflect — reflection would write the
        // constructor defaults (values="", layout="stack") into saved markup.
        layout:      {type: String},
        values:      {type: String},
        gridRows:    {type: String, attribute: 'grid-rows'},
        gridCols:    {type: String, attribute: 'grid-cols'},
        gridPattern: {type: String, attribute: 'grid-pattern'},
    };

    static styles = [MetroTileBase.styles, css`
        .secondaries {
            display: flex; flex-wrap: wrap; justify-content: center;
            column-gap: 9px; font-size: var(--_metro-unit-size);
            opacity: 0.9;
        }
        .sec { white-space: nowrap; }
        .sec .sec-label { opacity: 0.8; margin-right: 3px; }
        .sec .sec-value { font-weight: 600; font-variant-numeric: tabular-nums; }
        .value { font-size: min(var(--_metro-value-size), 30cqh); font-weight: 300; line-height: 1; }
        .value .unit { font-size: var(--_metro-unit-size); opacity: 0.85; font-weight: 400; margin-left: 2px; }
        table.grid {
            border-collapse: collapse; max-width: 100%;
            font-size: var(--feezal-metro-font-size-grid, 13px);
        }
        table.grid th, table.grid td { padding: 0 6px; text-align: right; font-weight: 300; }
        table.grid thead th { font-weight: 600; opacity: 0.85; text-transform: uppercase; font-size: 0.8em; letter-spacing: 0.05em; }
        table.grid tbody th { text-align: left; font-weight: 600; }
        table.grid tbody th .row-unit { font-weight: 400; opacity: 0.7; margin-left: 3px; }
        table.grid td { font-variant-numeric: tabular-nums; }
    `];

    constructor() {
        super();
        this.layout = 'stack';
        this.values = '';
        this.gridRows = '';
        this.gridCols = '';
        this.gridPattern = '';
        this.multivalue = new MultivalueController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.multivalue.rewireIfChanged();
    }

    // B67: availability badge (top-right ! while unavailable).
    renderBadge() {
        return this._available ? '' : '!';
    }

    renderFront() {
        if (this.multivalue.layout === 'grid') {
            const g = this.multivalue.grid();
            return html`
                <table class="grid">
                    ${g.cols.some(Boolean) ? html`
                        <thead><tr><th></th>${g.cols.map(c => html`<th>${c}</th>`)}</tr></thead>` : ''}
                    <tbody>
                        ${g.rows.map(row => html`<tr>
                            <th>${row.key}${this.multivalue.rowUnit(row) ? html`<span class="row-unit">${this.multivalue.rowUnit(row)}</span>` : ''}</th>
                            ${row.cells.map(c => html`<td>${c ? c.display : ''}</td>`)}
                        </tr>`)}
                        ${g.extras.map(v => html`<tr><th>${v.label || ''}</th><td colspan="${Math.max(1, g.cols.length)}">${v.display}${v.unit || ''}</td></tr>`)}
                    </tbody>
                </table>`;
        }
        const {primary, secondaries} = this.multivalue.stack();
        return html`
            ${secondaries.length ? html`
                <div class="secondaries">
                    ${secondaries.map(v => html`<span class="sec">
                        ${v.label ? html`<span class="sec-label">${v.label}</span>` : ''}<span class="sec-value">${v.display}${v.unit || ''}</span>
                    </span>`)}
                </div>` : ''}
            ${primary ? html`<div class="value">${primary.display}${primary.unit ? html`<span class="unit">${primary.unit}</span>` : ''}</div>` : ''}`;
    }

    renderBack() {
        return null;
    }
}

customElements.define('feezal-element-metro-multivalue', FeezalElementMetroMultivalue);
export {FeezalElementMetroMultivalue};
