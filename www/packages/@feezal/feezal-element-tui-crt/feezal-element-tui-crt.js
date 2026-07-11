/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-tui-crt (E59)
 *
 * Opt-in CRT overlay: scanlines + vignette (+ optional subtle flicker) over
 * whatever it is stretched across — put it on top of a view for the full
 * retro-terminal look. Purely decorative: pointer events pass through in
 * the viewer (the element stays selectable in the editor), and the flicker
 * honours prefers-reduced-motion. Everything is OFF-able because it is an
 * accessibility hazard (flicker) and battery cost — flicker defaults off.
 */
class FeezalElementTuiCrt extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'CRT', category: 'TUI', color: '#1e6b2f', icon: 'blur_on'},
            description: 'Decorative CRT overlay: scanlines, vignette and optional subtle flicker (off by default, honours prefers-reduced-motion). Click-through in the viewer.',
            attributes: [
                {name: 'scanlines', type: 'number', default: 0.18, min: 0, max: 1, step: 0.02,
                    help: 'Scanline darkness 0–1 (0 = none).'},
                {name: 'vignette', type: 'boolean', default: true, help: 'Darkened corners.'},
                {name: 'flicker', type: 'boolean', default: false,
                    help: 'Subtle brightness flicker. Off by default — accessibility hazard and battery cost; suppressed by prefers-reduced-motion either way.'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '320px', height: '220px'},
        };
    }

    static properties = {
        scanlines: {type: Number,  reflect: true},
        vignette:  {type: Boolean, reflect: true},
        flicker:   {type: Boolean, reflect: true},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; box-sizing: border-box; overflow: hidden; }
        /* Decorative overlay: click-through in the viewer, selectable on the canvas. */
        :host(:not(.feezal-editable)) { pointer-events: none; }
        .fx { position: absolute; inset: 0; }
        .scan {
            background: repeating-linear-gradient(
                to bottom,
                transparent 0 2px,
                rgba(0, 0, 0, var(--_scan, 0.18)) 2px 3px
            );
        }
        .vig { background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45) 100%); }
        @media (prefers-reduced-motion: no-preference) {
            .flick { animation: feezal-crt-flicker 4s steps(60) infinite; background: rgba(255, 255, 255, 0.02); }
        }
        @keyframes feezal-crt-flicker {
            0%, 100% { opacity: 0.35; }
            10% { opacity: 0.9; } 20% { opacity: 0.2; } 33% { opacity: 0.7; }
            47% { opacity: 0.3; } 60% { opacity: 1; } 78% { opacity: 0.45; } 90% { opacity: 0.8; }
        }
        .badge {
            position: absolute; top: 4px; left: 6px; opacity: 0.5; font-size: 10px;
            font-family: var(--feezal-tui-font, ui-monospace, monospace);
            color: var(--feezal-tui-color, #33ff66);
        }
    `];

    constructor() {
        super();
        this.scanlines = 0.18;
        this.vignette = true;
        this.flicker = false;
    }

    // Decorative — no MQTT.
    _subscribe() { /* none */ }

    render() {
        const scan = Math.max(0, Math.min(1, Number(this.scanlines) || 0));
        return html`
            ${scan > 0 ? html`<div class="fx scan" style="--_scan:${scan}"></div>` : ''}
            ${this.vignette ? html`<div class="fx vig"></div>` : ''}
            ${this.flicker ? html`<div class="fx flick"></div>` : ''}
            ${feezal.isEditor ? html`<div class="badge">CRT</div>` : ''}`;
    }
}

customElements.define('feezal-element-tui-crt', FeezalElementTuiCrt);
export {FeezalElementTuiCrt};
