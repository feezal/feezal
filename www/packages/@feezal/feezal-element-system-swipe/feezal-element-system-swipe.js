/* global feezal */
import {FeezalElement, feezalBaseStyles, feezalBoolean, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-system-swipe (E7)
 *
 * A pseudo-element (invisible in the viewer; a small placeholder in the editor)
 * that enables swipe-to-navigate between feezal views on touch devices. Pairs
 * with the viewer's mobile/kiosk use. Listens for touch/pointer gestures on the
 * viewer root and, on a directional swipe past `threshold`, navigates to the
 * next / previous view in the cycle (`feezal.site.view = …`, the same path the
 * navbar / basic-navigation use).
 *
 * Only reacts to TOUCH pointers so a mouse drag never navigates, and only when
 * the gesture is clearly along the configured axis (dominant delta ≥ 1.3× the
 * other and ≥ threshold) so it does not fight scrollable content.
 */
class FeezalElementSystemSwipe extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Swipe', category: 'System', color: '#455a64', icon: 'swipe'},
            description: 'Swipe-to-navigate between views on touch devices. Invisible in the viewer; a placeholder on the canvas.',
            attributes: [
                {name: 'views', type: 'string', help: 'Comma-separated view names in swipe order. Empty = all views in document order.'},
                {name: 'direction', type: 'select', options: ['horizontal', 'vertical'], default: 'horizontal', help: 'Swipe axis.'},
                {name: 'threshold', type: 'number', min: 10, default: 50, help: 'Minimum swipe distance (px) to trigger navigation.'},
                {name: 'animate', type: 'boolean', default: true, help: 'Slide the incoming view in on navigation (off under prefers-reduced-motion).'},
                {name: 'wrap', type: 'boolean', default: true, help: 'Swiping past the last view wraps to the first (and vice-versa).'},
            ],
            styles: ['top', 'left'],
            defaultStyle: {width: '160px', height: '40px'},
        };
    }

    static properties = {
        views:     {type: String,  reflect: true},
        direction: {type: String,  reflect: true},
        threshold: {type: Number,  reflect: true},
        animate:   {type: Boolean, reflect: true, converter: feezalBoolean},
        wrap:      {type: Boolean, reflect: true, converter: feezalBoolean},
    };

    static styles = [feezalBaseStyles, css`
        :host { display: block; }
        /* B70: theme-aware placeholder chrome, matching the other System elements
           (no hardcoded #eceff1/#455a64, no opaque background). */
        .ph {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            width: 100%; height: 100%; box-sizing: border-box;
            border: 2px dashed var(--feezal-border, #bbb); border-radius: 6px;
            font-size: 12px; color: var(--secondary-text-color); user-select: none;
        }
        .ph feezal-icon { font-size: 16px; }
    `];

    constructor() {
        super();
        this.views = '';
        this.direction = 'horizontal';
        this.threshold = 50;
        this.animate = true;
        this.wrap = true;
        this._start = null;
        this._onDown = e => this._down(e);
        this._onUp = e => this._up(e);
    }

    connectedCallback() {
        super.connectedCallback();
        if (feezal.isEditor) return;   // pseudo-element: no gestures in the editor
        window.addEventListener('pointerdown', this._onDown, {passive: true});
        window.addEventListener('pointerup', this._onUp, {passive: true});
    }

    disconnectedCallback() {
        window.removeEventListener('pointerdown', this._onDown);
        window.removeEventListener('pointerup', this._onUp);
        super.disconnectedCallback();
    }

    _down(e) {
        // Touch only — a mouse drag must never navigate.
        if (e.pointerType && e.pointerType !== 'touch') { this._start = null; return; }
        this._start = {x: e.clientX, y: e.clientY};
    }

    _up(e) {
        if (!this._start) return;
        const dx = e.clientX - this._start.x;
        const dy = e.clientY - this._start.y;
        this._start = null;
        this._handleSwipe(dx, dy);
    }

    /** Pure gesture → navigation decision (unit-testable). */
    _handleSwipe(dx, dy) {
        const horiz = this.direction !== 'vertical';
        const primary = horiz ? dx : dy;
        const other = horiz ? dy : dx;
        const th = Math.max(10, Number(this.threshold) || 50);
        // Must clear the threshold AND be clearly along the axis (not a scroll).
        if (Math.abs(primary) < th || Math.abs(primary) < Math.abs(other) * 1.3) return;
        this._go(primary < 0 ? 1 : -1);   // swipe left/up → next; right/down → prev
    }

    _viewList() {
        if (this.views && this.views.trim()) return this.views.split(',').map(v => v.trim()).filter(Boolean);
        if (feezal.site) {
            return Array.from(feezal.site.querySelectorAll('feezal-view')).map(v => v.getAttribute('name')).filter(Boolean);
        }
        return [];
    }

    _go(step) {
        if (!feezal.site) return;
        const list = this._viewList();
        if (list.length < 2) return;
        const cur = (feezal.site.getAttribute('view') || feezal.site.view) || list[0];
        let i = list.indexOf(cur);
        if (i < 0) i = 0;
        let next = i + step;
        if (next < 0 || next >= list.length) {
            if (!this.wrap) return;
            next = (next + list.length) % list.length;
        }
        const target = list[next];
        if (target === cur) return;
        feezal.site.view = target;
        if (this.animate !== false) this._slideIn(step);
    }

    /** One-shot slide/fade of the incoming view (Web Animations API — self-contained). */
    _slideIn(step) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // The site swaps the active view after the property set; run on the next frame.
        requestAnimationFrame(() => {
            const view = feezal.site && (feezal.site.querySelector('feezal-view:not([hidden])') ||
                feezal.site.querySelector(`feezal-view[name="${feezal.site.getAttribute('view') || feezal.site.view}"]`));
            if (!view || !view.animate) return;
            const horiz = this.direction !== 'vertical';
            const from = (step > 0 ? 1 : -1) * (horiz ? 24 : 16);
            const axis = horiz ? 'translateX' : 'translateY';
            try {
                view.animate([{transform: `${axis}(${from}px)`, opacity: 0.4}, {transform: 'none', opacity: 1}],
                    {duration: 180, easing: 'ease-out'});
            } catch { /* animation is best-effort */ }
        });
    }

    render() {
        if (!feezal.isEditor) return html``;   // invisible in the viewer
        return html`<div class="ph"><feezal-icon name="swipe"></feezal-icon> Swipe</div>`;
    }
}

customElements.define('feezal-element-system-swipe', FeezalElementSystemSwipe);
export {FeezalElementSystemSwipe};
