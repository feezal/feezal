/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-ascii (E59)
 *
 * Big-type banner display: figlet-style block characters (3×5 cell font,
 * baked in) for clocks and sensor readouts. Digits, :.%-°+ and a small
 * letter set (enough for ON/OFF/ERR/AUTO/HEAT/COOL…); unsupported
 * characters render as blanks. The primary topic sets `value`
 * (baseAttribute), so it also works without MQTT.
 */

// 3×5 block font — each glyph is 5 rows, 'X' = lit cell. Narrow glyphs
// (:, ., °) have their own widths.
const FONT = {
    0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
    2: ['XXX', '..X', 'XXX', 'X..', 'XXX'],
    3: ['XXX', '..X', 'XXX', '..X', 'XXX'],
    4: ['X.X', 'X.X', 'XXX', '..X', '..X'],
    5: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    6: ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
    7: ['XXX', '..X', '..X', '..X', '..X'],
    8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
    9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
    ':': ['.', 'X', '.', 'X', '.'],
    '.': ['.', '.', '.', '.', 'X'],
    '-': ['...', '...', 'XXX', '...', '...'],
    '+': ['...', '.X.', 'XXX', '.X.', '...'],
    '%': ['X.X', '..X', '.X.', 'X..', 'X.X'],
    '°': ['XX', 'XX', '..', '..', '..'],
    ' ': ['..', '..', '..', '..', '..'],
    a: ['XXX', 'X.X', 'XXX', 'X.X', 'X.X'],
    c: ['XXX', 'X..', 'X..', 'X..', 'XXX'],
    e: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
    f: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
    h: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
    l: ['X..', 'X..', 'X..', 'X..', 'XXX'],
    n: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
    o: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    r: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
    s: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    t: ['XXX', '.X.', '.X.', '.X.', '.X.'],
    u: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
};

class FeezalElementTuiAscii extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'ASCII', category: 'TUI', color: '#1e6b2f', icon: 'title'},
            description: 'Figlet-style banner display (baked 3×5 block font): digits, :.%-°+ and a small letter set — big clocks and sensor readouts.',
            baseAttribute: 'value',
            attributes: [
                'subscribe',
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the value within the MQTT message. Default "payload" uses msg.payload.'},
                {name: 'value', type: 'string', help: 'Displayed text (set by the subscribe topic; can be set manually without MQTT).'},
            ],
            styles: [
                'top', 'left', 'width', 'height',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 60, minHeight: 30},
            defaultStyle: {width: '260px', height: '80px'},
            discovery: {
                component: 'sensor',
                map: {
                    state_topic:    'subscribe',
                    value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                },
            },
        };
    }

    static properties = {
        value: {type: String, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: flex; align-items: center; justify-content: center;
            box-sizing: border-box; overflow: hidden;
            container-type: size;
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
        }
        pre {
            margin: 0;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            /* 5 rows fill the host height */
            font-size: 20cqh; line-height: 1;
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
        }
    `];

    constructor() {
        super();
        this.value = '';
    }

    // The base class writes primary-topic messages to `value` via
    // baseAttribute — no own subscription needed.

    _banner() {
        let text = this.value ?? '';
        if (text === '' && feezal.isEditor && !this.subscribe) text = '13:37';
        const rows = ['', '', '', '', ''];
        for (const ch of String(text)) {
            const glyph = FONT[ch] ?? FONT[ch.toLowerCase()] ?? FONT[' '];
            for (let r = 0; r < 5; r++) {
                rows[r] += (rows[r] ? ' ' : '') + glyph[r].replaceAll('X', '█').replaceAll('.', ' ');
            }
        }
        return rows.join('\n');
    }

    render() {
        return html`<pre>${this._banner()}</pre>`;
    }
}

customElements.define('feezal-element-tui-ascii', FeezalElementTuiAscii);
export {FeezalElementTuiAscii};
