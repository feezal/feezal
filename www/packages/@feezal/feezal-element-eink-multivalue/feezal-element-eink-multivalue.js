/* global feezal */
import {feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {EinkBase, einkCardStyles} from '@feezal/feezal-eink';
import {MultivalueController, multivalueAttributes, multivalueDiscoveryMap}
    from '@feezal/feezal-controller-multivalue';

/**
 * feezal-element-eink-multivalue (E165)
 *
 * E-ink multi-value card — a view over MultivalueController (E137). stack:
 * small secondary readouts above the oversized primary numeral; grid: a
 * 1-bit rows × columns table with thick rules. Display-only.
 *
 * Redraw discipline: renderSignature() is the joined display-string list —
 * republished unchanged values never touch the panel (E57).
 */
class FeezalElementEinkMultivalue extends EinkBase {
    static get feezal() {
        return {
            palette: {name: 'Multivalue', category: 'Eink', color: '#222222', icon: 'data_table'},
            description: 'E-ink multi-value card — several values from one device: primary + smaller secondaries ' +
                '(stack) or a rows × columns table (grid). 1-bit, redraw-deduped, display-only.',
            discovery: {component: 'sensor', map: multivalueDiscoveryMap},
            attributes: [
                {name: 'label', type: 'string', help: 'Label under the values (rendered uppercase).'},
                ...multivalueAttributes,
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-eink-font-size-value', default: '34px', help: 'Primary value font size (stack).'},
                {property: '--feezal-eink-font-size-unit', default: '14px', help: 'Unit font size.'},
                {property: '--feezal-eink-font-size-label', default: '13px', help: 'Label font size.'},
                {property: '--feezal-eink-font-size-grid', default: '14px', help: 'Grid cell font size.'},
                {property: '--feezal-eink-rule', default: '3px', help: 'Rule/border thickness (≥2px).'},
            ],
            defaultStyle: {width: '200px', height: '130px'},
            restrict: {minWidth: 90, minHeight: 70},
        };
    }

    static properties = {
        label:       {type: String, reflect: true},
        // Config properties observe their attributes (edits trigger updated())
        // but deliberately do NOT reflect — reflection would write the
        // constructor defaults (values="", layout="stack") into saved markup.
        layout:      {type: String},
        values:      {type: String},
        gridRows:    {type: String, attribute: 'grid-rows'},
        gridCols:    {type: String, attribute: 'grid-cols'},
        gridPattern: {type: String, attribute: 'grid-pattern'},
    };

    static styles = [feezalBaseStyles, einkCardStyles, css`
        .card { gap: 2px; }
        .secondaries {
            display: flex; flex-wrap: wrap; justify-content: center; column-gap: 10px;
            font-size: var(--feezal-eink-font-size-label, 13px);
        }
        .sec { white-space: nowrap; }
        .sec .sec-label { text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
        .sec .sec-value { font-weight: 700; font-variant-numeric: tabular-nums; }
        table.grid {
            border-collapse: collapse; max-width: 100%;
            font-size: var(--feezal-eink-font-size-grid, 14px);
        }
        table.grid th, table.grid td {
            padding: 1px 7px; text-align: right;
            border: calc(var(--feezal-eink-rule, 3px) / 2) solid currentColor;
        }
        table.grid thead th { text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8em; }
        table.grid tbody th { text-align: left; text-transform: uppercase; letter-spacing: 0.04em; }
        table.grid tbody th .row-unit { text-transform: none; letter-spacing: 0; margin-left: 3px; }
        table.grid td { font-weight: 700; font-variant-numeric: tabular-nums; }
    `];

    constructor() {
        super();
        this.label = '';
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

    /** E57 redraw dedup: only the rendered display strings count as a change. */
    renderSignature() {
        return this.multivalue.layout + '|' + this.multivalue.values().map(v => v.display).join('|');
    }

    render() {
        const grid = this.multivalue.layout === 'grid';
        const g = grid ? this.multivalue.grid() : null;
        const s = grid ? null : this.multivalue.stack();
        return html`
            <div class="card">
                ${grid ? html`
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
                    </table>` : html`
                    ${s.secondaries.length ? html`
                        <div class="secondaries">
                            ${s.secondaries.map(v => html`<span class="sec">
                                ${v.label ? html`<span class="sec-label">${v.label}</span>` : ''}<span class="sec-value">${v.display}${v.unit || ''}</span>
                            </span>`)}
                        </div>` : ''}
                    ${s.primary ? html`<span class="value">${s.primary.display}${s.primary.unit ? html`<span class="unit">${s.primary.unit}</span>` : ''}</span>` : ''}`}
                <span class="label">${this.label || (feezal.isEditor ? 'Multivalue' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-eink-multivalue', FeezalElementEinkMultivalue);
export {FeezalElementEinkMultivalue};
