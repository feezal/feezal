/* global feezal */
import {FeezalElement, css} from '@feezal/feezal-element';

/**
 * @feezal/feezal-eink (E57)
 *
 * Shared code for the E-ink card family. Intentionally NOT named
 * `feezal-element-*` — pure code-sharing package (same precedent as
 * `@feezal/feezal-glass`).
 *
 * The family's constraint set (the spec):
 *   - 1-bit contrast discipline: black on white (theme-invertible), no greys
 *     as information carriers, ≥2px rules, oversized numerals.
 *   - No animation, no transitions, no hover — state changes swap content.
 *   - REDRAW DISCIPLINE: e-paper partial refresh is expensive and ghosts on
 *     repeated updates — the DOM must change only when the rendered
 *     text/state actually differs. That discipline lives HERE, once
 *     (see EinkBase.shouldUpdate / renderSignature).
 */

/**
 * EinkBase — base class for every eink card.
 *
 * Redraw dedup: a subclass implements `renderSignature()` returning a string
 * of everything that affects its visible output (values ROUNDED to the shown
 * precision, state words, badge booleans — not raw floats). Controller pokes
 * and MQTT-driven `requestUpdate()` calls (empty changedProperties) are then
 * dropped whenever the signature is unchanged — a per-second republish of the
 * same temperature never touches the panel. Reactive property/attribute
 * changes (inspector edits, discovery stamping) always render and reset the
 * signature, so config changes are never swallowed.
 */
export class EinkBase extends FeezalElement {
    /** Override: string of everything visible. `null` disables dedup. */
    renderSignature() {
        return null;
    }

    shouldUpdate(changed) {
        if (changed.size > 0) {
            // Real property/attribute change → always render, restart dedup.
            this.__einkSig = undefined;
            return true;
        }
        const sig = this.renderSignature();
        if (sig === null || sig === undefined) return true;
        if (sig === this.__einkSig) return false;   // nothing visible changed
        this.__einkSig = sig;
        return true;
    }
}

/**
 * Shared 1-bit card chrome. Composed FIRST in each element's `static styles`.
 * Colors come from two theme vars only — everything renders in fg-on-bg:
 *   --feezal-eink-fg (default #000) / --feezal-eink-bg (default #fff)
 * An inverted block (active states) swaps them per element via the .inv rule.
 */
export const einkCardStyles = css`
    :host {
        display: block; box-sizing: border-box; container-type: size;
        overflow: hidden;
        /* 1-bit palette — theme may flip both for an inverted panel. */
        --_fg: var(--feezal-eink-fg, #000);
        --_bg: var(--feezal-eink-bg, #fff);
    }
    .card {
        position: absolute; inset: var(--feezal-eink-margin, 2px);
        box-sizing: border-box; padding: 8px 10px;
        display: flex; flex-direction: column; justify-content: space-between;
        background: var(--_bg); color: var(--_fg);
        border: var(--feezal-eink-rule, 3px) solid var(--_fg);
        border-radius: var(--feezal-eink-radius, 0px);
        font-family: var(--feezal-eink-font, ui-monospace, 'Cascadia Mono', 'Roboto Mono', 'Courier New', monospace);
        font-weight: 700;
        user-select: none;
        /* E57: no animation, ever — content swaps instantly. */
        transition: none !important;
    }
    .card *, .card *::before, .card *::after { transition: none !important; animation: none !important; }
    /* Inverted block — the active-state treatment (also the theme's dark flip). */
    .card.inv { background: var(--_fg); color: var(--_bg); }
    .value {
        font-size: var(--feezal-eink-font-size-value, 34px); line-height: 1.0;
        font-variant-numeric: tabular-nums;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .value .unit { font-size: var(--feezal-eink-font-size-unit, 14px); margin-left: 3px; }
    .label {
        font-size: var(--feezal-eink-font-size-label, 13px); font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rule { border-top: var(--feezal-eink-rule, 3px) solid currentColor; }
    /* Corner badges — text/glyph only, always currentColor. */
    .badge-tr { position: absolute; top: 4px; right: 7px; font-size: 15px; line-height: 1; }
    .badge-tl { position: absolute; top: 4px; left: 7px; font-size: 15px; line-height: 1; }
    /* E124: the shared low-battery badge inherits the e-ink ink colour (stays monochrome). */
    .feezal-batt-badge { color: currentColor; }
    feezal-icon { color: currentColor; }
`;

/** The shared eink attribute rows every card appends (display basics). */
export const einkCommonAttributes = [
    {name: 'label', type: 'string', help: 'Label line (rendered oversized-uppercase).'},
];

/** Payload comparison — re-export of the family-agnostic helper. */
export {payloadMatch} from '@feezal/feezal-element';
