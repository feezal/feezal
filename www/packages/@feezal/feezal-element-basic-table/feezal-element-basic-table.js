/* global feezal */
import {FeezalElement, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-basic-table — data table for JSON array payloads (E75).
 *
 * The subscribe topic carries a JSON array of objects; each object is a row.
 * Columns come from the `columns` config (key, label, width, align, format,
 * editable, class-map) or, when unset, from the keys of the first row.
 *
 * Read-only features: click-to-sort headers (numeric-aware, asc → desc →
 * original), text filter box, `max-rows` cap, sticky header, per-column
 * value formatting (`number[:decimals[:suffix]]`, `date`, `time`,
 * `datetime`) and conditional row/cell classes via the map convention
 * (exact value or `>` `>=` `<` `<=` numeric thresholds → class name; the
 * semantic names ok/success/good, warn/warning, error/alert/critical and
 * info are pre-styled from the theme state colours).
 *
 * Write-back (`editable`): columns flagged editable render as inputs; every
 * commit publishes the WHOLE updated array (retained by default) to
 * `publish` (falls back to the subscribe topic), plus optional row
 * add/delete. Last-writer-wins on the whole-array payload — fine for team
 * boards / shift plans / pick lists; anything transactional belongs in a
 * real backend.
 */

// Matchers: exact string equality or a numeric threshold ('>90', '<=5').
// Later matching entries win (same rule as E50 condition rows).
function matchClass(map, value) {
    let cls = '';
    for (const [matcher, name] of Object.entries(map)) {
        const threshold = matcher.trim().match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
        if (threshold) {
            const n = Number(value);
            if (Number.isNaN(n)) {
                continue;
            }
            const limit = Number(threshold[2]);
            const hit = {'>': n > limit, '>=': n >= limit, '<': n < limit, '<=': n <= limit}[threshold[1]];
            if (hit) {
                cls = name;
            }
        } else if (String(value) === matcher) {
            cls = name;
        }
    }
    return cls;
}

class FeezalElementBasicTable extends FeezalElement {
    static get feezal() {
        return {
            palette: {
                category: 'Basic',
                name: 'Table',
                color: '#4a6080',
                icon: 'table_chart'
            },
            description: 'Renders a JSON array of objects as a table — sortable, filterable, with per-column formatting and conditional row/cell classes. With editable enabled, edits publish the whole updated array (retained), making a retained topic a simple shared read/write list.',
            attributes: [
                {name: 'subscribe', type: 'mqttTopic', help: 'Topic carrying a JSON array of row objects.'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the array within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.rows" to navigate into a JSON payload.'},
                {name: 'columns', type: 'objectList', itemFields: [
                    {key: 'key', placeholder: 'row key'},
                    {key: 'label', placeholder: 'header'},
                    {key: 'width', placeholder: '80px'},
                    {key: 'align', type: 'select', options: ['', 'left', 'center', 'right']},
                    {key: 'format', placeholder: 'number:1:°C'},
                    {key: 'editable', type: 'select', options: ['', 'true']}
                ], help: 'Column config — empty derives columns from the first row\'s keys. format: number[:decimals[:suffix]], date, time or datetime (numeric timestamps: seconds or milliseconds since epoch). A per-column "class-map" object ({"value or >threshold": "class"}) colours single cells; add it via source editing — the list editor preserves it.'},
                {name: 'sortable', type: 'select', options: ['true', 'false'], default: 'true', help: 'Click-to-sort headers: first click ascending, second descending, third restores payload order.'},
                {name: 'filter', type: 'boolean', help: 'Show a text-filter box above the table (case-insensitive substring match across all columns).'},
                {name: 'max-rows', type: 'number', min: 0, step: 1, default: '0', help: 'Cap the number of rendered rows after filtering/sorting. 0 = unlimited.'},
                {name: 'row-class-map', type: 'string', default: '{}',
                    help: 'Conditional row classes: {"columnKey": {"value or >threshold": "class"}} — e.g. {"state":{"error":"error"},"load":{">90":"warn"}}. The class is applied to the whole row; ok/warn/error/info style names are pre-styled from the theme state colours.'},
                {name: 'empty-text', type: 'string', default: 'No data', help: 'Placeholder text shown when the array is empty.'},
                {name: 'editable', type: 'boolean', help: 'Enable write-back: columns flagged editable render as inputs, plus row add/delete. Every commit publishes the WHOLE updated array — last writer wins.'},
                {name: 'publish', type: 'mqttTopic', help: 'Write-back topic for edits. Empty = publish back to the subscribe topic.'},
                {name: 'retain', type: 'select', options: ['true', 'false'], default: 'true', help: 'Publish edits with the MQTT retain flag so every (re)connecting viewer sees the current table.'}
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-table-text-color', type: 'color',
                    default: 'var(--primary-text-color, var(--feezal-color, #333))',
                    help: 'Cell text colour.'},
                {property: '--feezal-table-header-color', type: 'color',
                    default: 'var(--secondary-text-color, #757575)',
                    help: 'Header text colour.'},
                {property: '--feezal-table-surface-color', type: 'color',
                    default: 'var(--feezal-bg, #fff)',
                    help: 'Table background (also behind the sticky header).'},
                {property: '--feezal-table-border-color', type: 'color',
                    default: 'var(--feezal-border, #e0e0e0)',
                    help: 'Row separator and border colour.'}
            ],
            restrict: {minWidth: 120, minHeight: 60},
            defaultStyle: {width: '400px', height: '300px'}
        };
    }

    static properties = {
        columns:     {type: String, reflect: true},
        // String-typed so sortable="false" disables it (a bare Boolean
        // attribute cannot express a default-on option).
        sortable:    {type: String, reflect: true},
        filter:      {type: Boolean, reflect: true},
        maxRows:     {type: Number, reflect: true, attribute: 'max-rows'},
        rowClassMap: {type: String, reflect: true, attribute: 'row-class-map'},
        emptyText:   {type: String, reflect: true, attribute: 'empty-text'},
        editable:    {type: Boolean, reflect: true},
        publish:     {type: String, reflect: true},
        retain:      {type: String, reflect: true},
        _data:       {state: true},
        _sortKey:    {state: true},
        _sortDir:    {state: true},
        _filterText: {state: true}
    };

    static styles = [FeezalElement.styles, css`
        :host {
            width: 400px;
            height: 300px;
            font-size: 13px;
            --feezal-table-text-color: var(--primary-text-color, var(--feezal-color, #333));
            --feezal-table-header-color: var(--secondary-text-color, #757575);
            --feezal-table-surface-color: var(--feezal-bg, #fff);
            --feezal-table-border-color: var(--feezal-border, #e0e0e0);
            color: var(--feezal-table-text-color);
            background: var(--feezal-table-surface-color);
        }
        .wrap {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .scroll {
            flex: 1;
            overflow: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font: inherit;
        }
        th, td {
            padding: 4px 8px;
            text-align: left;
            border-bottom: 1px solid var(--feezal-table-border-color);
        }
        th {
            position: sticky;
            top: 0;
            background: var(--feezal-table-surface-color);
            color: var(--feezal-table-header-color);
            font-weight: 600;
            white-space: nowrap;
            user-select: none;
        }
        th.sortable { cursor: pointer; }
        th .dir { font-size: 0.8em; }
        tbody tr:nth-child(even) {
            background: color-mix(in srgb, var(--feezal-table-text-color) 4%, transparent);
        }
        /* Semantic conditional-formatting classes — theme state colours.
           Declared after the stripe rule so they win at equal specificity. */
        tbody tr.ok, tbody tr.success, tbody tr.good {
            background: color-mix(in srgb, var(--success-color, #4caf50) 15%, transparent);
        }
        tbody tr.warn, tbody tr.warning {
            background: color-mix(in srgb, var(--warning-color, #ff9800) 15%, transparent);
        }
        tbody tr.error, tbody tr.alert, tbody tr.critical {
            background: color-mix(in srgb, var(--error-color, #d32f2f) 15%, transparent);
        }
        tbody tr.info {
            background: color-mix(in srgb, var(--info-color, #2196f3) 15%, transparent);
        }
        td.ok, td.success, td.good { color: var(--success-color, #4caf50); }
        td.warn, td.warning { color: var(--warning-color, #ff9800); }
        td.error, td.alert, td.critical { color: var(--error-color, #d32f2f); }
        td.info { color: var(--info-color, #2196f3); }
        input {
            box-sizing: border-box;
            width: 100%;
            font: inherit;
            color: inherit;
            background: transparent;
            border: 1px solid var(--feezal-table-border-color);
            border-radius: 3px;
            padding: 2px 4px;
        }
        .filter-box {
            flex: none;
            padding: 4px;
        }
        td.remove {
            width: 1%;
            text-align: center;
            cursor: pointer;
            color: var(--feezal-table-header-color);
        }
        td.remove:hover { color: var(--error-color, #d32f2f); }
        .add-row {
            flex: none;
            padding: 4px 8px;
            cursor: pointer;
            color: var(--feezal-table-header-color);
            border-top: 1px solid var(--feezal-table-border-color);
        }
        .add-row:hover { color: var(--feezal-table-text-color); }
        .empty {
            padding: 12px 8px;
            opacity: 0.6;
            font-style: italic;
        }
    `];

    constructor() {
        super();
        this.columns = '';
        this.sortable = 'true';
        this.filter = false;
        this.maxRows = 0;
        this.rowClassMap = '';
        this.emptyText = 'No data';
        this.editable = false;
        this.publish = '';
        this.retain = 'true';
        this._data = null;
        this._sortKey = null;
        this._sortDir = 1;
        this._filterText = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                let value = this.getProperty(msg, this.messageProperty);
                if (typeof value === 'string') {
                    try {
                        value = JSON.parse(value);
                    } catch {
                        return;
                    }
                }
                if (Array.isArray(value)) {
                    this._data = value;
                } else if (value && typeof value === 'object') {
                    this._data = [value];
                }
            });
        }
    }

    _parseJson(str, fallback) {
        try {
            const parsed = JSON.parse(str);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch {
            return fallback;
        }
    }

    _configuredColumns() {
        const cols = this._parseJson(this.columns || '[]', []);
        return Array.isArray(cols) ? cols.filter(c => c && typeof c === 'object' && c.key) : [];
    }

    /** Unconfigured-state hint: sample rows on the editor canvas until real data arrives. */
    _sampleRows(configured) {
        if (configured.length) {
            return [1, 2, 3].map(i => Object.fromEntries(configured.map(c =>
                [c.key, String(c.format || '').startsWith('number') ? i * 10 + 0.5 : `${c.label || c.key} ${i}`]
            )));
        }
        return [
            {item: 'Alpha', value: 12.5, state: 'ok'},
            {item: 'Beta', value: 47, state: 'warn'},
            {item: 'Gamma', value: 3.2, state: 'error'}
        ];
    }

    _sourceRows(configured) {
        if (this._data) {
            return this._data;
        }
        return feezal.isEditor ? this._sampleRows(configured) : [];
    }

    _visibleRows(rows, cols) {
        if (this.filter && this._filterText) {
            const needle = this._filterText.toLowerCase();
            rows = rows.filter(row => cols.some(col =>
                String(row[col.key] ?? '').toLowerCase().includes(needle)));
        }
        if (this._sortKey) {
            const key = this._sortKey;
            const dir = this._sortDir;
            rows = [...rows].sort((a, b) => {
                const av = a[key];
                const bv = b[key];
                const an = Number(av);
                const bn = Number(bv);
                const cmp = (!Number.isNaN(an) && !Number.isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '')
                    ? an - bn
                    : String(av ?? '').localeCompare(String(bv ?? ''));
                return cmp * dir;
            });
        }
        if (this.maxRows > 0) {
            rows = rows.slice(0, this.maxRows);
        }
        return rows;
    }

    _format(value, format) {
        if (value === null || value === undefined) {
            return '';
        }
        if (!format) {
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        const [kind, ...rest] = String(format).split(':');
        if (kind === 'number') {
            const n = Number(value);
            if (Number.isNaN(n)) {
                return String(value);
            }
            const decimals = rest[0] !== undefined && rest[0] !== '' ? Number(rest[0]) : null;
            const suffix = rest.slice(1).join(':');
            return (decimals === null ? String(n) : n.toFixed(decimals)) + suffix;
        }
        if (kind === 'date' || kind === 'time' || kind === 'datetime') {
            let source = value;
            const n = Number(value);
            if (!Number.isNaN(n) && String(value).trim() !== '') {
                // Numeric timestamps: heuristic — below 1e12 is seconds since epoch.
                source = n < 1e12 ? n * 1000 : n;
            }
            const date = new Date(source);
            if (Number.isNaN(date.getTime())) {
                return String(value);
            }
            return kind === 'date' ? date.toLocaleDateString()
                : (kind === 'time' ? date.toLocaleTimeString() : date.toLocaleString());
        }
        return String(value);
    }

    _rowClass(row) {
        const map = this._parseJson(this.rowClassMap || '{}', {});
        const classes = [];
        for (const [key, colMap] of Object.entries(map)) {
            if (colMap && typeof colMap === 'object') {
                const cls = matchClass(colMap, row[key]);
                if (cls) {
                    classes.push(cls);
                }
            }
        }
        return classes.join(' ');
    }

    _cellClass(col, value) {
        const map = col['class-map'];
        return map && typeof map === 'object' ? matchClass(map, value) : '';
    }

    _onSort(key) {
        if (this.sortable === 'false') {
            return;
        }
        if (this._sortKey !== key) {
            this._sortKey = key;
            this._sortDir = 1;
        } else if (this._sortDir === 1) {
            this._sortDir = -1;
        } else {
            this._sortKey = null;
            this._sortDir = 1;
        }
    }

    _colEditable(col) {
        return this.editable && (col.editable === true || col.editable === 'true');
    }

    _publishData() {
        const topic = this.publish || this.subscribe;
        if (topic) {
            feezal.connection.pub(topic, JSON.stringify(this._data), {retain: this.retain !== 'false'});
        }
        this.requestUpdate();
    }

    _commit(row, col, input) {
        if (feezal.isEditor) {
            return;
        }
        let value = input.value;
        const old = row[col.key];
        if (typeof old === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))) {
            value = Number(value);
        }
        if (value === old) {
            return;
        }
        row[col.key] = value;
        this._publishData();
    }

    _addRow(cols) {
        if (feezal.isEditor) {
            return;
        }
        this._data = [...(this._data || []), Object.fromEntries(cols.map(col => [col.key, '']))];
        this._publishData();
    }

    _removeRow(row) {
        if (feezal.isEditor) {
            return;
        }
        this._data = this._data.filter(r => r !== row);
        this._publishData();
    }

    render() {
        const configured = this._configuredColumns();
        const source = this._sourceRows(configured);
        const firstRow = source.find(row => row && typeof row === 'object');
        const cols = configured.length ? configured : (firstRow ? Object.keys(firstRow).map(key => ({key})) : []);
        const rows = this._visibleRows(source, cols);
        const sortable = this.sortable !== 'false';

        const filterBox = this.filter ? html`
            <div class="filter-box">
                <input type="search" placeholder="Filter…" .value="${this._filterText}"
                    @input="${e => { this._filterText = e.target.value; }}">
            </div>` : '';

        if (!cols.length) {
            return html`<div class="wrap">${filterBox}<div class="empty">${this.emptyText}</div></div>`;
        }

        return html`
            <div class="wrap">
                ${filterBox}
                <div class="scroll">
                    <table>
                        <thead>
                            <tr>
                                ${cols.map(col => html`
                                    <th class="${sortable ? 'sortable' : ''}"
                                        style="${col.width ? `width:${col.width};` : ''}${col.align ? `text-align:${col.align};` : ''}"
                                        @click="${() => this._onSort(col.key)}">
                                        ${col.label || col.key}
                                        ${this._sortKey === col.key ? html`<span class="dir">${this._sortDir === 1 ? '▲' : '▼'}</span>` : ''}
                                    </th>`)}
                                ${this.editable ? html`<th></th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => html`
                                <tr class="${this._rowClass(row)}">
                                    ${cols.map(col => html`
                                        <td class="${this._cellClass(col, row[col.key])}"
                                            style="${col.align ? `text-align:${col.align};` : ''}">
                                            ${this._colEditable(col)
                                                ? html`<input .value="${row[col.key] ?? ''}"
                                                    @change="${e => this._commit(row, col, e.target)}">`
                                                : this._format(row[col.key], col.format)}
                                        </td>`)}
                                    ${this.editable ? html`<td class="remove" title="Delete row"
                                        @click="${() => this._removeRow(row)}">✕</td>` : ''}
                                </tr>`)}
                        </tbody>
                    </table>
                    ${rows.length ? '' : html`<div class="empty">${this.emptyText}</div>`}
                </div>
                ${this.editable ? html`<div class="add-row" @click="${() => this._addRow(cols)}">＋ Add row</div>` : ''}
            </div>
        `;
    }
}

window.customElements.define('feezal-element-basic-table', FeezalElementBasicTable);

export {FeezalElementBasicTable};
