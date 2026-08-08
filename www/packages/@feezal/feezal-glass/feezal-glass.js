/* global feezal */
import {FeezalElement, css, html, batteryLowBadge} from '@feezal/feezal-element';
import {faultBadge, sabotageBadge} from '@feezal/feezal-element/feezal-hm-fault.js';

/**
 * @feezal/feezal-glass (E106)
 *
 * Shared code for the Glass card family. Intentionally NOT named
 * `feezal-element-*` — the server's package scan treats every
 * `feezal-element-*` directory as a dashboard element and would try to
 * palette/bundle it (see server/src/build/elements.js `_scan()`). This is a
 * pure code-sharing package, same precedent as `@feezal/feezal-element`.
 *
 * First dedup increment (E106): only logic provably identical across all
 * ten glass card elements today (GLASS_SIZES/applySizePreset/payloadMatch).
 *
 * Later increments (E106): the shared style fragments `glassCardStyles`
 * (frost `.card` chrome, all 10 cards) and `glassPopupStyles` (details-popover
 * chrome, the 5 popup cards), plus `FeezalGlassCard` — the base class that
 * owns the popover-open lifecycle for the 5 popup cards. See each export's
 * doc comment and the E106 roadmap entry.
 */

/** Size preset → [width, height] px, shared by every glass card's `size`
 * attribute (Auto / 2×2 / 2×1). */
export const GLASS_SIZES = {'2x2': [172, 128], '2x1': [172, 64]};

/** The size grid writes the element's inline geometry (editor keeps full
 * manual control afterwards). Call from `updated()` when `changed.has('size')`. */
export function applySizePreset(el, map = GLASS_SIZES) {
    const p = map[el.size];
    if (p) {
        el.style.width = p[0] + 'px';
        el.style.height = p[1] + 'px';
    }
}

/** Payload comparison: string coercion (case-insensitive) plus boolean
 * true/false matching the HA/z2m ON/OFF conventions. Consolidated from the
 * identical copies in glass-switch and glass-light (glass-contact's copy is
 * case-sensitive and was left local — see E106 roadmap entry). */
export function payloadMatch(value, configured) {
    if (String(value).toLowerCase() === String(configured).toLowerCase()) return true;
    if (value === true && /^(on|true|1|yes)$/i.test(String(configured))) return true;
    if (value === false && /^(off|false|0|no)$/i.test(String(configured))) return true;
    return false;
}

/**
 * Shared frost-card chrome for the 5 "simple" glass cards (button, switch,
 * contact, occupancy, sensor). Diffed byte-for-byte across all five before
 * extraction — contains ONLY the `:host`/`.card`/`@supports`/`degrade`
 * declarations that were identical in every one of them. Composed FIRST in
 * each element's `static styles` array (before the element's own css
 * block), so declarations not listed here (cursor, transition, gap,
 * touch-action, `--_state-color`, and every `.card.<state>` override) stay
 * local to each element because they differ by at least one card — moving
 * those would change what that card renders.
 */
export const glassCardStyles = css`
    :host { display: block; box-sizing: border-box; container-type: size; overflow: visible; }
    .card {
        position: absolute; inset: var(--feezal-glass-margin, 6px); box-sizing: border-box;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 12px;
        border-radius: var(--feezal-glass-radius, 24px);
        background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
        -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        color: var(--feezal-glass-color, #1d1d1f);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
    }
    @supports (corner-shape: squircle) { .card { corner-shape: squircle; } }
    :host([degrade]) .card {
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
    }

    /* B91 — one shared upper-right tray for EVERY glass indicator, always in
       the order battery / availability / warnings (fault, then sabotage) /
       details. Replaces the per-card corners that had drifted (battery
       bottom-right or bottom-left, fault bottom-left, .unavail top- OR
       bottom-right, the flip button top-right — four corners, clashes). The
       tray owns the corner; nothing inside picks its own. Rendered by
       glassBadgeTray(); it sits over the card's own content, so keep top-right
       card content clear (the value cards' unit stays lower). */
    .glass-badge-tray {
        position: absolute; top: 4px; right: 8px; z-index: 4;
        display: flex; align-items: center; gap: 4px;
        pointer-events: none;
    }
    .glass-badge-tray > * { pointer-events: auto; }
    /* the badges carry their own absolute-corner positioning for non-glass
       families; inside the tray they are static flex children in order. */
    .glass-badge-tray > .feezal-batt-badge,
    .glass-badge-tray > .feezal-fault-badge,
    .glass-badge-tray > .feezal-sabotage-badge,
    .glass-badge-tray > .glass-unavail,
    .glass-badge-tray > .flip-btn {
        position: static; inset: auto;
    }
    /* Uniform 16px boxes so the indicators read as one set: the shared battery
       badge is 20px by default (its short bar then floats inside an oversized
       box and looks low next to the taller icons). */
    .glass-badge-tray > .feezal-batt-badge,
    .glass-badge-tray > .feezal-fault-badge,
    .glass-badge-tray > .feezal-sabotage-badge {
        width: 16px; height: 16px;
    }
    .glass-unavail {
        color: var(--error-color);
        display: inline-flex; align-items: center; justify-content: center;
        /* the "signal off" glyph fills its whole 24-viewBox edge to edge, so it
           reads heavier than the other icons — size it smaller to match; the
           -2px nudge lifts it level with the details/tune icon, whose optical
           centre sits higher than this glyph's. */
        width: 10px; height: 10px;
        transform: translateY(-1px);
    }
    .glass-unavail svg { width: 100%; height: 100%; display: block; }
`;

/**
 * B91 — the shared indicator tray every glass card renders into its `.card`.
 * Order is fixed: battery, availability, warnings (fault then sabotage),
 * details button. Absent indicators render nothing and leave no gap; the order
 * never changes with which are shown. `details` is the card's own flip button
 * template (or '' for the simple cards) — it stays per-card because its click
 * handler and visibility differ, but it always lands last, at the corner.
 */
export function glassBadgeTray({battery = false, unavailable = false, fault = '', sabotage = false, details = ''} = {}) {
    return html`<div class="glass-badge-tray">
        ${batteryLowBadge(battery)}
        ${unavailable ? html`<span class="glass-unavail" title="Device unavailable"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-1.69 0-3.32.25-4.86.71l2.5 2.5c.77-.14 1.55-.21 2.36-.21 3.42 0 6.7 1.21 9.32 3.42L24 8.98zM2.81 2.81L1.39 4.22l2.05 2.05C2.2 6.92 1.05 7.86 0 8.98l1.68 1.43c.93-.78 1.94-1.45 3.01-2L6.4 9.83c-1.2.55-2.31 1.3-3.28 2.21L4.81 13.46C5.96 12.38 7.4 11.62 9 11.27l2.16 2.16c-1.3.18-2.5.74-3.46 1.59L12 19.51l1.94-1.94 5.84 5.84 1.41-1.41L2.81 2.81zM12 16.5l-1.41-1.41L12 13.68c.5 0 .96.06 1.42.13l1.71 1.71c-.99-.65-2.18-1.02-3.13-1.02z"/>
        </svg></span>` : ''}
        ${faultBadge(fault)}
        ${sabotageBadge(sabotage)}
        ${details}
    </div>`;
}

/**
 * Shared details-POPOVER chrome for the 5 "popup" glass cards (light,
 * climate, cover, fan, wled). Diffed byte-for-byte across all five before
 * extraction — contains ONLY the popover container (`.details`, its degrade
 * variant, `::backdrop`, `.title`) and the `.flip-btn` that opens it. Popover
 * CONTENTS (`.vslider`, `.wheel`, `input.ct`, `.mode*`, sliders, and every
 * other card-specific control) stay local — those differ by at least one
 * card. Composed after `glassCardStyles` and the card's own frost `.card`
 * block in each element's `static styles` array.
 *
 * `gap: 16px` here matches light/climate/cover/fan; glass-wled uses 14px and
 * keeps a local `.details { gap: 14px; }` override after this fragment.
 */
export const glassPopupStyles = css`
    .details {
        /* E155: centred in the viewport, modal-style, at a viewport-relative
           width — it used to be card-anchored at a fixed 200px, which read as
           tiny on a desktop and crowded the card on a phone. inset:0 plus
           margin:auto centres a fixed-position box without a transform, so
           it composites cleanly over the backdrop-filter behind it.

           clamp() rather than plain min(): 70vw is only ~262px on a 375px
           phone, narrower than the wheel/pill controls want, so 240px is the
           floor. 450px is the cap so it never sprawls on a wide monitor.
           This is what let _positionDetails() go away entirely. */
        position: fixed; inset: 0; margin: auto; z-index: 99999;
        width: clamp(240px, 70vw, 450px); height: fit-content; max-height: 90vh;
        box-sizing: border-box; padding: 16px;
        display: flex; flex-direction: column; align-items: center; gap: 16px;
        border: 1px solid var(--feezal-glass-border, rgba(255,255,255,0.55));
        border-radius: var(--feezal-glass-radius, 24px);
        /* B121 — the SAME fallback tint as .card (0.35), not 0.7.
           Both read --feezal-glass-tint, so a theme that sets it has always
           made card and popup agree — but with no theme the popup fell back to
           twice the card's opacity, which is the reported "solid" look.
           Measured over a striped background: the card transmits 65% of the
           blurred page (sd 42), the popup at 0.7 only 30% (sd 22), so the frost
           had almost nothing left to show. */
        background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
        -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        box-shadow: 0 16px 48px rgba(0,0,0,0.3);
        color: var(--feezal-glass-color, #1d1d1f);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: visible;
    }
    :host([degrade]) .details {
        /* Same drift, same fix: the card degrades to 0.94, so this did not
           match on the no-theme path either. */
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background: var(--feezal-glass-solid, rgba(245,245,247,0.94));
    }
    .details::backdrop { background: rgba(0, 0, 0, 0.35); }
    /* E171 ① — opt-in frosted page backdrop: while the popup is open the
       whole page behind it gets the family frost (blur + tint scrim), the
       view shimmers through. Off by default (B61: a full-page blur layer is
       exactly the surface the Chrome/macOS invalidation bug bites). Follows
       the same tint tokens as the cards (B121). */
    :host([popup-backdrop]) .details::backdrop {
        background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
        -webkit-backdrop-filter: blur(var(--feezal-glass-blur, 20px));
        backdrop-filter: blur(var(--feezal-glass-blur, 20px));
    }
    /* degrade contract: solid translucent scrim, no live blur. */
    :host([degrade][popup-backdrop]) .details::backdrop {
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background: var(--feezal-glass-tint, rgba(255,255,255,0.35));
    }
    /* E171 ② — opt-in open/close animation: scale from 0.96 + fade in, the
       reverse out (the machinery holds the popover through a closing state
       so the out-tween actually plays before removal). */
    :host([popup-animate]) .details {
        animation: feezal-glass-pop-in 0.18s cubic-bezier(0.2, 0.7, 0.3, 1);
    }
    :host([popup-animate]) .details.closing {
        animation: feezal-glass-pop-out 0.15s ease-in forwards;
    }
    @keyframes feezal-glass-pop-in {
        from { opacity: 0; transform: scale(0.96); }
    }
    @keyframes feezal-glass-pop-out {
        to { opacity: 0; transform: scale(0.96); }
    }
    @media (prefers-reduced-motion: reduce) {
        :host([popup-animate]) .details,
        :host([popup-animate]) .details.closing { animation: none; }
    }
    .details .title {
        font-size: 13px; font-weight: 700; align-self: stretch; text-align: center;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* B91: the flip button lives in the shared .glass-badge-tray (top-right),
       so it is a static tray child, not its own absolutely-positioned corner. */
    .flip-btn {
        border: none; background: none; cursor: pointer; padding: 2px;
        color: var(--feezal-glass-muted, rgba(29,29,31,0.55));
        font-family: 'Material Icons'; font-size: var(--feezal-glass-font-size-unit, 12px); line-height: 1;
    }
`;

/**
 * FeezalGlassCard — base class for the 5 glass cards that own a details
 * popover (light/climate/cover/fan/wled). Extracts the popover-open lifecycle
 * that was byte-identical across all of them:
 *   - the `_details` reactive open-state,
 *   - `_suppressTap` (set by the outside-click handler so the dismissing tap
 *     doesn't also re-trigger the card),
 *   - `__outsideDown` outside-pointerdown dismiss,
 *   - `openDetails()` / `_closeDetails()` open/close (deferred listener so the
 *     opening tap isn't caught).
 * Card-specific behaviour (subscriptions, gestures, sliders, render) stays in
 * the subclass. A subclass that overrides `disconnectedCallback()` MUST call
 * `super.disconnectedCallback()` so the document listener is removed.
 *
 * E155 removed `_positionDetails()`: the popover is centred by CSS now (see
 * `glassPopupStyles`), so there is no above/below/clamp math left to run. The
 * method is gone rather than kept as a no-op — a card still calling it would
 * be a leftover worth surfacing as an error, not silently ignoring.
 */
/** E171 — the two shared popup knobs, spread into every glass card that owns
 * a details popover (and glass-popup). Both opt-in, both handled entirely by
 * the shared machinery: the attributes reflect, `glassPopupStyles` keys off
 * the host attributes, `_closeDetails` plays the out-tween. */
export const glassPopupKnobs = [
    {name: 'popup-backdrop', type: 'boolean', default: false, section: 'Popup',
        help: 'While the popup is open, frost the whole page behind it (family blur + tint scrim) — the view shimmers ' +
            'through, the popup floats on glass. With degrade on, a solid translucent scrim replaces the live blur.'},
    {name: 'popup-animate', type: 'boolean', default: false, section: 'Popup',
        help: 'Animate the popup: scale + fade in on open, the reverse on close. Disabled automatically when the ' +
            'system asks for reduced motion.'},
];

export class FeezalGlassCard extends FeezalElement {
    static properties = {
        _details: {state: true},   // details popover open
        // E171: the shared popup knobs — reflected so glassPopupStyles can
        // key off the host attributes.
        popupBackdrop: {type: Boolean, reflect: true, attribute: 'popup-backdrop'},
        popupAnimate:  {type: Boolean, reflect: true, attribute: 'popup-animate'},
    };

    constructor() {
        super();
        this._details = false;
        this._suppressTap = false;
        this.popupBackdrop = false;
        this.popupAnimate = false;
        this.__closing = false;    // E171 ②: out-tween in flight
        this.__outsideDown = e => {
            const path = e.composedPath();
            if (path.includes(this.renderRoot?.querySelector('.details'))) return;
            this._closeDetails();
            if (path.includes(this)) this._suppressTap = true;
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this.__outsideDown);
        this.__closing = false;
    }

    openDetails() {
        if (feezal.isEditor || this._details) return;
        this._details = true;
        // Deferred: don't catch the very tap that opened the popup.
        setTimeout(() => {
            if (this._details) document.addEventListener('pointerdown', this.__outsideDown);
        });
    }

    _closeDetails() {
        document.removeEventListener('pointerdown', this.__outsideDown);
        // E171 ②: with the animation knob on, play the out-tween BEFORE the
        // popover is torn down — removal on `_details = false` would cut it
        // off. Reduced motion (and the no-knob default) closes instantly.
        const popup = this.renderRoot?.querySelector('.details');
        const reduced = typeof matchMedia === 'function'
            && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (this.popupAnimate && popup && !reduced) {
            if (this.__closing) return;
            this.__closing = true;
            popup.classList.add('closing');
            const done = () => {
                if (!this.__closing) return;
                this.__closing = false;
                this._details = false;
            };
            popup.addEventListener('animationend', done, {once: true});
            setTimeout(done, 250);   // safety net if the animation never fires
            return;
        }
        this._details = false;
    }

}
