/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-panel (E59)
 *
 * Box-drawing-framed container: `┌─ TITLE ─────┐` drawn with real
 * box-drawing characters (measured against the monospace metrics via
 * ResizeObserver, so the frame always closes cleanly), wrapping an
 * embedded named view — the same composition mechanism as layout-view,
 * which it reuses internally.
 *
 * Frame styles: single (─│┌┐└┘) or double (═║╔╗╚╝) line characters.
 */

const CHARS = {
    single: {h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘'},
    double: {h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝'},
};

class FeezalElementTuiPanel extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Panel', category: 'TUI', color: '#1e6b2f', icon: 'crop_din'},
            description: 'Box-drawing-framed container (┌─ TITLE ─┐) wrapping an embedded view. Frame drawn with real box-drawing characters that track the element size.',
            attributes: [
                {name: 'title', type: 'string', help: 'Title embedded in the top frame line.'},
                {name: 'view',  dropdown: 'views', help: 'Name of the feezal-view embedded inside the frame.'},
                {name: 'frame', type: 'select', options: ['single', 'double'], default: 'single', help: 'Frame line style.'},
            ],
            styles: [
                'top', 'left', 'width', 'height', 'font-size',
                {property: '--feezal-tui-color', type: 'color', default: '#33ff66', help: 'Phosphor colour (shared across tui-* elements).'},
                {property: '--feezal-tui-bg', type: 'color', default: 'transparent', help: 'Background (shared across tui-* elements).'},
                {property: '--feezal-tui-glow', default: '5px', help: 'Phosphor glow radius; 0 disables (shared across tui-* elements).'},
            ],
            restrict: {minWidth: 80, minHeight: 60},
            defaultStyle: {width: '320px', height: '220px'},
        };
    }

    static properties = {
        title: {type: String, reflect: true},
        view:  {type: String, reflect: true},
        frame: {type: String, reflect: true},
        _cols: {state: true},
        _rows: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block; box-sizing: border-box; overflow: hidden; position: relative;
            font-family: var(--feezal-tui-font, ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace);
            color: var(--feezal-tui-color, #33ff66);
            background: var(--feezal-tui-bg, transparent);
            font-size: 14px; line-height: 1.2;
        }
        pre {
            margin: 0; position: absolute; pointer-events: none;
            font: inherit; line-height: inherit;
            text-shadow: 0 0 var(--feezal-tui-glow, 5px) color-mix(in srgb, var(--feezal-tui-color, #33ff66) 60%, transparent);
        }
        .top { top: 0; left: 0; right: 0; white-space: pre; overflow: hidden; }
        .bottom { bottom: 0; left: 0; right: 0; white-space: pre; overflow: hidden; }
        .left { left: 0; top: 0; bottom: 0; white-space: pre; overflow: hidden; }
        .right { right: 0; top: 0; bottom: 0; white-space: pre; overflow: hidden; }
        .left pre, .right pre { position: static; }
        /* content inset by one character cell on every side */
        .content { position: absolute; inset: 1.2em 1ch; overflow: hidden; }
        .content feezal-element-layout-view { position: absolute; inset: 0; width: auto; height: auto; }
        .ph {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            opacity: 0.5; font-size: 12px; pointer-events: none;
        }
        /* invisible probe for the character-cell metrics */
        .probe { position: absolute; visibility: hidden; white-space: pre; }
    `];

    constructor() {
        super();
        this.title = '';
        this.view = '';
        this.frame = 'single';
        this._cols = 0;
        this._rows = 0;
    }

    // Pure container — no MQTT of its own.
    _subscribe() { /* none */ }

    connectedCallback() {
        super.connectedCallback();
        this._ro = new ResizeObserver(() => this._measure());
        this._ro.observe(this);
    }

    disconnectedCallback() {
        this._ro?.disconnect();
        super.disconnectedCallback();
    }

    firstUpdated() {
        this._measure();
    }

    /** Character-grid size from the live monospace metrics. */
    _measure() {
        const probe = this.renderRoot?.querySelector('.probe');
        if (!probe || this.clientWidth === 0) return;
        const rect = probe.getBoundingClientRect();
        const chW = rect.width / 10;      // probe holds 10 characters
        const lineH = rect.height;
        if (chW <= 0 || lineH <= 0) return;
        this._cols = Math.max(4, Math.floor(this.clientWidth / chW));
        this._rows = Math.max(3, Math.floor(this.clientHeight / lineH));
    }

    _frameParts() {
        const c = CHARS[this.frame] || CHARS.single;
        const inner = this._cols - 2;
        let top;
        const title = (this.title || '').slice(0, Math.max(0, inner - 4));
        if (title) {
            const fill = Math.max(0, inner - title.length - 3);
            top = `${c.tl}${c.h} ${title} ${c.h.repeat(fill)}${c.tr}`;
        } else {
            top = `${c.tl}${c.h.repeat(inner)}${c.tr}`;
        }
        const bottom = `${c.bl}${c.h.repeat(inner)}${c.br}`;
        const side = Array.from({length: Math.max(0, this._rows - 2)}, () => c.v).join('\n');
        return {top, bottom, side};
    }

    render() {
        const {top, bottom, side} = this._cols ? this._frameParts() : {top: '', bottom: '', side: ''};
        return html`
            <span class="probe">──────────</span>
            <pre class="top">${top}</pre>
            <div class="left" style="padding-top:1.2em"><pre>${side}</pre></div>
            <div class="right" style="padding-top:1.2em"><pre>${side}</pre></div>
            <pre class="bottom">${bottom}</pre>
            <div class="content">
                ${this.view
                    ? html`<feezal-element-layout-view view="${this.view}"></feezal-element-layout-view>`
                    : html`<div class="ph">${feezal.isEditor ? 'pick a view in the inspector' : ''}</div>`}
            </div>`;
    }
}

customElements.define('feezal-element-tui-panel', FeezalElementTuiPanel);
export {FeezalElementTuiPanel};
