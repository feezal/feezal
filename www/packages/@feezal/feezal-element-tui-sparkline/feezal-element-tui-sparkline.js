/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

// Block characters, 8 fill levels: ▁▂▃▄▅▆▇█
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * feezal-element-tui-sparkline (E59)
 *
 * Block-character graph of recent values (`▁▂▃▅▇`) — a chart with zero
 * chart library. Keeps the last `points` numeric payloads in a ring
 * buffer; the scale is min/max (auto from the buffered data when empty).
 */
class FeezalElementTuiSparkline extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Sparkline', category: 'TUI', color: '#1e6b2f', icon: 'show_chart'},
            description: 'Block-character sparkline (▁▂▃▅▇) of the last N numeric payloads. Scale fixed via min/max or auto from the data.',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'label',  type: 'string', help: 'Label shown before the graph.'},
                {name: 'points', type: 'number', default: 30, min: 2, max: 200, help: 'Number of buffered values (one block character each).'},
                {name: 'min', type: 'number', default: '', help: 'Scale minimum. Empty = auto from the buffered data.'},
                {name: 'max', type: 'number', default: '', help: 'Scale maximum. Empty = auto from the buffered data.'},
                {name: 'show-value', type: 'boolean', default: false, help: 'Append the latest value after the graph.'},
                {name: 'unit', type: 'string', help: 'Unit appended to the latest value (with show-value).'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 16},
            defaultStyle: {width: '280px', height: '24px'},
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:         'subscribe',
                    name:                'label',
                    unit_of_measurement: 'unit',
                    value_template:      {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        label:     {type: String,  reflect: true},
        points:    {type: Number,  reflect: true},
        min:       {type: Number,  reflect: true},
        max:       {type: Number,  reflect: true},
        showValue: {type: Boolean, reflect: true, attribute: 'show-value'},
        unit:      {type: String,  reflect: true},
        _values:   {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; align-items: center; box-sizing: border-box; overflow: hidden;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
            font-size: 14px; line-height: 1.2; padding: 0 0.5ch;
        }
        .row { display: flex; align-items: baseline; gap: 1ch; width: 100%; min-width: 0; white-space: nowrap; }
        .label { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
        .graph { flex: 1 1 auto; overflow: hidden; letter-spacing: 0; }
        .value { flex: 0 0 auto; }
    `];

    constructor() {
        super();
        this.label = '';
        this.points = 30;
        this.min = null;
        this.max = null;
        this.showValue = false;
        this.unit = '';
        this._values = [];
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = Number(this.getProperty(msg, this.messageProperty));
                if (isNaN(v)) return;
                const n = Math.max(2, Math.min(200, Number(this.points) || 30));
                this._values = [...this._values, v].slice(-n);
            });
        }
    }

    _blocks() {
        // Unconfigured hint on the editor canvas: a little demo wave.
        const values = this._values.length > 0 ? this._values
            : (feezal.isEditor && !this.subscribe
                ? Array.from({length: Number(this.points) || 30}, (_, i) => Math.sin(i / 3) + 1) : []);
        if (values.length === 0) return '';
        const lo = (this.min ?? '') !== '' && this.min !== null ? Number(this.min) : Math.min(...values);
        const hi = (this.max ?? '') !== '' && this.max !== null ? Number(this.max) : Math.max(...values);
        const span = hi - lo || 1;
        return values.map(v => {
            const t = Math.min(1, Math.max(0, (v - lo) / span));
            return BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(t * BLOCKS.length))];
        }).join('');
    }

    render() {
        const latest = this._values.at(-1);
        return html`
            <div class="row">
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}
                <span class="graph">${this._blocks()}</span>
                ${this.showValue && latest !== undefined
                    ? html`<span class="value">${latest}${this.unit ? ' ' + this.unit : ''}</span>` : ''}
            </div>`;
    }
}

customElements.define('feezal-element-tui-sparkline', FeezalElementTuiSparkline);
export {FeezalElementTuiSparkline};
