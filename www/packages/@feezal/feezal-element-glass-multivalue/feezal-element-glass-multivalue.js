/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {glassCardStyles, glassBadgeTray} from '@feezal/feezal-glass';
import {MultivalueController, multivalueAttributes, multivalueDiscoveryMap}
    from '@feezal/feezal-controller-multivalue';

/**
 * feezal-element-glass-multivalue (E165)
 *
 * Frosted-glass multi-value card — a view over MultivalueController (E137).
 * stack: smaller secondary readouts above the big primary value; grid: a
 * row/col pivot table. Display-only.
 */

class FeezalElementGlassMultivalue extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Multivalue', category: 'Glass', color: '#7aa5c9', icon: 'data_table'},
            description: 'Frosted-glass multi-value card — several values from one device: primary + smaller ' +
                'secondaries (stack) or a rows × columns table (grid). Display-only.',
            discovery: {component: 'sensor', map: multivalueDiscoveryMap, multivalueDeviceFill: true},
            attributes: [
                {name: 'label', type: 'string', help: 'Card label shown under the values.'},
                ...multivalueAttributes,
                {name: 'degrade', type: 'boolean', default: false,
                    help: 'Replace the live backdrop blur with a semi-opaque solid card — no per-frame GPU cost (weak wall-tablet hardware).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-glass-accent', type: 'color', default: '#ff9f0a', help: 'Primary value / row header accent colour.'},
                {property: '--feezal-glass-tint', type: 'color', help: 'Frost tint (defaults from the theme).'},
                {property: '--feezal-glass-font-size-value', default: '26px', help: 'Primary value font size (stack).'},
                {property: '--feezal-glass-font-size-secondary', default: '12px', help: 'Secondary readout font size (stack).'},
                {property: '--feezal-glass-font-size-grid', default: '12px', help: 'Grid cell font size.'},
                {property: '--feezal-glass-font-size-label', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '172px', height: '128px'},
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
        degrade:     {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, glassCardStyles, css`
        .card { gap: 3px; }
        .secondaries {
            display: flex; flex-wrap: wrap; justify-content: center;
            column-gap: 10px; row-gap: 1px;
            font-size: var(--feezal-glass-font-size-secondary, 12px);
        }
        .sec { white-space: nowrap; }
        .sec .sec-label { font-weight: 600; color: var(--feezal-glass-muted, rgba(29,29,31,0.55)); margin-right: 4px; }
        .sec .sec-value { font-weight: 700; font-variant-numeric: tabular-nums; }
        .sec .sec-unit { font-weight: 500; opacity: 0.6; margin-left: 1px; }
        .value {
            font-size: var(--feezal-glass-font-size-value, 26px); font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .value .unit { font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 500; opacity: 0.6; margin-left: 2px; }
        .label {
            font-size: var(--feezal-glass-font-size-label, 12px); font-weight: 600; line-height: 1.2;
            color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        table.grid {
            border-collapse: collapse;
            font-size: var(--feezal-glass-font-size-grid, 12px);
            max-width: 100%;
        }
        table.grid th, table.grid td { padding: 1px 7px; text-align: right; }
        table.grid thead th {
            font-weight: 600; color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
            text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.03em;
        }
        table.grid tbody th {
            text-align: left; font-weight: 600;
            color: var(--feezal-glass-accent, #ff9f0a);
        }
        table.grid tbody th .row-unit { font-weight: 500; opacity: 0.6; margin-left: 3px; color: var(--feezal-glass-muted, rgba(29,29,31,0.55)); }
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
        this.degrade = false;
        this.multivalue = new MultivalueController(this);
    }

    updated(changed) {
        super.updated(changed);
        this.multivalue.rewireIfChanged();
    }

    _renderStack() {
        const {primary, secondaries} = this.multivalue.stack();
        return html`
            ${secondaries.length ? html`
                <div class="secondaries">
                    ${secondaries.map(v => html`<span class="sec">
                        ${v.label ? html`<span class="sec-label">${v.label}</span>` : ''}<span class="sec-value">${v.display}${v.unit ? html`<span class="sec-unit">${v.unit}</span>` : ''}</span>
                    </span>`)}
                </div>` : ''}
            ${primary ? html`<span class="value">${primary.display}${primary.unit ? html`<span class="unit">${primary.unit}</span>` : ''}</span>` : ''}
        `;
    }

    _renderGrid() {
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
            </table>
        `;
    }

    render() {
        return html`
            <div class="card">
                ${glassBadgeTray({unavailable: this.subscribeAvailability && !this._available})}
                ${this.multivalue.layout === 'grid' ? this._renderGrid() : this._renderStack()}
                <span class="label">${this.label || (feezal.isEditor ? 'Multivalue' : '')}</span>
            </div>
        `;
    }
}

customElements.define('feezal-element-glass-multivalue', FeezalElementGlassMultivalue);
export {FeezalElementGlassMultivalue};
