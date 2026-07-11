/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
import {svg} from 'lit';

/**
 * feezal-element-panel-7seg (E56)
 *
 * Seven-segment numeric display — the classic red LED readout. Renders the
 * subscribed value right-aligned into a fixed number of digit cells with
 * ghost (unlit) segments, decimal points, minus sign and a small set of
 * letters (errors like "Err" render fine). Non-numeric payloads are shown
 * as-is (unsupported characters render blank).
 *
 * The primary topic sets `value` (baseAttribute), so the display also works
 * without MQTT by setting the attribute directly.
 */

// Segment bits: A=1 B=2 C=4 D=8 E=16 F=32 G=64 (standard layout, A top,
// clockwise B..F, G middle).
const GLYPHS = {
    0: 0x3F, 1: 0x06, 2: 0x5B, 3: 0x4F, 4: 0x66,
    5: 0x6D, 6: 0x7D, 7: 0x07, 8: 0x7F, 9: 0x6F,
    '-': 0x40, ' ': 0x00,
    a: 0x77, b: 0x7C, c: 0x39, d: 0x5E, e: 0x79, f: 0x71,
    h: 0x76, i: 0x06, j: 0x1E, l: 0x38, n: 0x54, o: 0x5C,
    p: 0x73, r: 0x50, s: 0x6D, t: 0x78, u: 0x3E, y: 0x6E,
};

// Segment polygons in a 10×18 cell space (slightly slanted look comes from
// the skew transform on the whole readout).
const SEGS = [
    /* A */ '1.5,0.5 8.5,0.5 7.3,1.9 2.7,1.9',
    /* B */ '9.5,1.3 9.5,8.4 8.1,7.5 8.1,2.6',
    /* C */ '9.5,9.6 9.5,16.7 8.1,15.4 8.1,10.5',
    /* D */ '1.5,17.5 8.5,17.5 7.3,16.1 2.7,16.1',
    /* E */ '0.5,9.6 0.5,16.7 1.9,15.4 1.9,10.5',
    /* F */ '0.5,1.3 0.5,8.4 1.9,7.5 1.9,2.6',
    /* G */ '1.7,9 2.9,8.2 7.1,8.2 8.3,9 7.1,9.8 2.9,9.8',
];

class FeezalElementPanel7seg extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: '7-Segment', category: 'Panel', color: '#455a64', icon: '123'},
            description: 'Seven-segment LED readout. Shows the subscribed value right-aligned in a fixed number of digit cells, with ghost segments, decimal point and minus sign.',
            baseAttribute: 'value',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload; use e.g. "payload.temperature" to navigate into a JSON payload.'},
                {name: 'value',    type: 'string', help: 'Displayed value (set by the subscribe topic; can be set manually without MQTT).'},
                {name: 'digits',   type: 'number', default: 4, min: 1, max: 12, help: 'Number of digit cells.'},
                {name: 'decimals', type: 'number', default: '', help: 'Fixed decimal places for numeric payloads. Empty = show the value as received.'},
                {name: 'label',    type: 'string', help: 'Engraved label under the display.'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-panel-7seg-color', type: 'color',
                    default: '#ff4136',
                    help: 'Lit segment colour (classic LED red; try #76ff03 for green or #ffb300 for amber).'},
                {property: '--feezal-panel-face', type: 'color', default: '#14100f', help: 'Display window background (shared --feezal-panel-face family var).'},
                {property: '--feezal-panel-text', type: 'color', default: '#aeb7bd', help: 'Engraved label colour (shared across panel-* elements).'},
            ],
            restrict: {minWidth: 40, minHeight: 30},
            defaultStyle: {width: '160px', height: '70px'},
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:    'subscribe',
                    name:           'label',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        value:    {type: String, reflect: true},
        digits:   {type: Number, reflect: true},
        decimals: {type: Number, reflect: true},
        label:    {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 4px; box-sizing: border-box; overflow: hidden;
            --feezal-panel-7seg-color: #ff4136;
        }
        .window {
            flex: 1; min-height: 0; width: 100%;
            background: var(--feezal-panel-face, #14100f); border-radius: 4px;
            box-shadow: inset 0 2px 6px rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            padding: 4px 6px; box-sizing: border-box;
        }
        svg { height: 100%; max-width: 100%; }
        .seg       { fill: var(--feezal-panel-7seg-color); filter: drop-shadow(0 0 1.5px var(--feezal-panel-7seg-color)); }
        .seg.ghost { fill: var(--feezal-panel-7seg-color); opacity: 0.07; filter: none; }
        .label {
            flex: 0 0 auto; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--feezal-panel-text, #aeb7bd);
            max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
    `];

    constructor() {
        super();
        this.value = '';
        this.digits = 4;
        this.decimals = null;
        this.label = '';
    }

    // The base class writes primary-topic messages to `value` via
    // baseAttribute — no own subscription needed.

    /** Split the display string into per-cell {char, dp}, right-aligned. */
    _cells() {
        let raw = this.value ?? '';
        // Unconfigured hint on the editor canvas.
        if (raw === '' && feezal.isEditor && !this.subscribe) raw = '88.8';
        const dec = this.decimals;
        if (raw !== '' && dec !== null && dec !== undefined && dec !== '' && !isNaN(Number(raw))) {
            raw = Number(raw).toFixed(Number(dec));
        }

        const cells = [];
        for (const ch of String(raw)) {
            if (ch === '.' || ch === ',') {
                if (cells.length === 0) cells.push({char: ' ', dp: true});
                else cells[cells.length - 1].dp = true;
            } else {
                cells.push({char: ch, dp: false});
            }
        }

        const n = Math.max(1, Math.min(12, Number(this.digits) || 4));
        const out = cells.slice(-n);
        while (out.length < n) out.unshift({char: ' ', dp: false});
        return out;
    }

    _glyph(ch) {
        if (GLYPHS[ch] !== undefined) return GLYPHS[ch];
        const lower = String(ch).toLowerCase();
        return GLYPHS[lower] ?? 0x00;
    }

    render() {
        const cells = this._cells();
        const cellW = 13;
        const width = cells.length * cellW;
        return html`
            <div class="window">
                <svg viewBox="0 0 ${width} 20" preserveAspectRatio="xMidYMid meet">
                    <!-- gentle italic slant, the classic LED look -->
                    <g transform="skewX(-4)">
                        ${cells.map((cell, i) => {
                            const bits = this._glyph(cell.char);
                            return svg`
                                <g transform="translate(${i * cellW + 2} 1)">
                                    ${SEGS.map((points, s) => svg`
                                        <polygon class="seg ${bits & (1 << s) ? '' : 'ghost'}" points="${points}"/>`)}
                                    <circle class="seg ${cell.dp ? '' : 'ghost'}" cx="10.8" cy="17" r="0.9"/>
                                </g>`;
                        })}
                    </g>
                </svg>
            </div>
            ${this.label ? html`<div class="label">${this.label}</div>` : ''}`;
    }
}

customElements.define('feezal-element-panel-7seg', FeezalElementPanel7seg);
export {FeezalElementPanel7seg};
