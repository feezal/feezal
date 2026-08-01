/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {MultivalueController, multivalueAttributes, multivalueDiscoveryMap}
    from '@feezal/feezal-controller-multivalue';

/**
 * feezal-element-circle-multivalue (E165)
 *
 * Circle-family multi-value card — a view over MultivalueController (E137).
 * The Circle disc holds either the stack (small secondaries above the big
 * primary numeral) or the rows × columns grid (E165 decided: the grid
 * renders inside the disc too — full layout parity, cqi-scaled to fit).
 * Label below the disc. Display-only.
 */
class FeezalElementCircleMultivalue extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Multivalue', category: 'Circle', color: '#1565c0', icon: 'data_table'},
            description: 'Multi-value card — a Circle-family disc showing several values from one device: primary + ' +
                'smaller secondaries (stack) or a rows × columns table (grid). Display-only.',
            discovery: {component: 'sensor', map: multivalueDiscoveryMap, multivalueDeviceFill: true},
            attributes: [
                {name: 'label', type: 'string', help: 'Label shown under the disc.'},
                ...multivalueAttributes,
            ],
            styles: [
                'top', 'left', 'width', 'height', 'background', 'border-radius',
                {property: '--feezal-value-text-color',  type: 'color', default: 'var(--primary-text-color)', help: 'Primary value / grid cell colour. Drive it by a named colour range to tint the reading by its value.'},
                {property: '--feezal-value-secondary-color', type: 'color', default: 'var(--primary-text-color)', help: 'Secondary readout colour (stack; defaults to the primary colour). Takes its own colour range, independent of the primary.'},
                {property: '--feezal-value-label-color', type: 'color', default: 'var(--secondary-text-color)', help: 'Label / secondary readout colour.'},
                {property: '--feezal-value-accent-color', type: 'color', default: 'var(--accent-color)', help: 'Grid row-header colour.'},
                {property: '--feezal-value-font-size',  default: '16cqi', help: 'Primary value font size (cqi scales with card width).'},
                {property: '--feezal-value-unit-size',  default: '9cqi', help: 'Unit font size.'},
                {property: '--feezal-value-secondary-size', default: '7cqi', help: 'Secondary readout font size (stack).'},
                {property: '--feezal-value-grid-size',  default: '7cqi', help: 'Grid cell font size.'},
                {property: '--feezal-value-label-size', default: '12px', help: 'Label font size.'},
            ],
            defaultStyle: {width: '120px', height: '150px'},
            restrict: {minWidth: 70, minHeight: 80},
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

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column;
            align-items: center; justify-content: flex-start;
            gap: 4px; padding: 6px; box-sizing: border-box;
            position: relative;
            overflow: visible; text-align: center;
            container-type: inline-size;
            --feezal-value-text-color:  var(--primary-text-color);
            --feezal-value-label-color: var(--secondary-text-color);
            --feezal-value-accent-color: var(--accent-color);
            --feezal-value-secondary-color: var(--feezal-value-text-color);
            /* E139: currentColor drives the disc ring — anchor it to the text
               colour so the ring matches the other Circle cards. */
            color: var(--feezal-value-text-color);
        }
        .disc-wrap {
            width: 100%; aspect-ratio: 1; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .disc {
            position: relative;
            width: 90%; aspect-ratio: 1;
            box-sizing: border-box; border-radius: 50%;
            border: 0.9cqi solid color-mix(in srgb, currentColor 25%, transparent);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 1cqi;
            overflow: hidden;
        }
        .secondaries {
            display: flex; flex-wrap: wrap; justify-content: center; column-gap: 3cqi;
            font-size: var(--feezal-value-secondary-size, 7cqi);
            color: var(--feezal-value-label-color);
        }
        .sec { white-space: nowrap; }
        .sec .sec-label { font-weight: 600; margin-right: 2px; }
        .sec .sec-value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--feezal-value-secondary-color); }
        .value {
            font-size: var(--feezal-value-font-size, 16cqi);
            font-weight: 700; line-height: 1.05;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }
        .value .unit {
            font-size: var(--feezal-value-unit-size, 9cqi);
            font-weight: 500; opacity: 0.6; margin-left: 2px;
        }
        table.grid {
            border-collapse: collapse;
            font-size: var(--feezal-value-grid-size, 7cqi);
        }
        table.grid th, table.grid td { padding: 0 1.6cqi; text-align: right; }
        table.grid thead th {
            font-weight: 600; color: var(--feezal-value-label-color);
            text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.03em;
        }
        table.grid tbody th { text-align: left; font-weight: 600; color: var(--feezal-value-accent-color); }
        table.grid tbody th .row-unit { font-weight: 500; opacity: 0.7; margin-left: 2px; color: var(--feezal-value-label-color); }
        table.grid td { font-weight: 700; font-variant-numeric: tabular-nums; }
        .label {
            font-size: var(--feezal-value-label-size, 12px);
            font-weight: 600; line-height: 1.2;
            color: var(--feezal-value-label-color);
            white-space: nowrap;
        }
        /* B67: availability badge — top-right corner. */
        .unavail {
            position: absolute; top: 6px; right: 6px;
            width: 16px; height: 16px;
            color: var(--error-color);
            opacity: 0.85; pointer-events: none; z-index: 2;
        }
        .unavail svg { width: 100%; height: 100%; display: block; }
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

    _renderInner() {
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
            ${primary ? html`<span class="value">${primary.display}${primary.unit ? html`<span class="unit">${primary.unit}</span>` : ''}</span>` : ''}`;
    }

    render() {
        return html`
            ${this.subscribeAvailability && !this._available ? html`
                <span class="unavail" title="unavailable">
                    <svg viewBox="0 0 24 24"><path fill="currentColor"
                        d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
                </span>` : ''}
            <div class="disc-wrap"><div class="disc">${this._renderInner()}</div></div>
            <span class="label">${this.label || (feezal.isEditor ? 'Multivalue' : '')}</span>
        `;
    }
}

customElements.define('feezal-element-circle-multivalue', FeezalElementCircleMultivalue);
export {FeezalElementCircleMultivalue};
