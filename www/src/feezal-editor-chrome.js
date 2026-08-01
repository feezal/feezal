import {css} from 'lit';

/**
 * N43 — shared editor chrome: the Shoelace theming every editor dialog needs,
 * in one place.
 *
 * ## Why this exists
 *
 * Shoelace only themes the RESTING state of its controls. Every editor dialog
 * therefore had to hand-write the same hover/focus overrides, and every time
 * one was forgotten a new dialog shipped with buttons and inputs that flash
 * WHITE on hover in dark mode. That bug shipped repeatedly (it has its own
 * section in CLAUDE.md). The cause was structural: the rules lived as
 * copy-paste in each component's `static styles`, so a new component started
 * with none of them.
 *
 * Now a dialog composes ONE thing and is correct by default:
 *
 *   import {feezalDialogChrome} from './feezal-editor-chrome.js';
 *   static styles = [feezalDialogChrome, css`…component-specific…`];
 *
 * and gets its dark values by being listed in the `:host(.dark)` token block
 * in feezal-app-editor.js (which supplies --feezal-* / --sl-* values; the
 * component itself only needs to CONSUME them, which this sheet does).
 *
 * ## Two parts
 *
 * `feezalDialogChrome` — rules that must live inside the component's own
 * shadow root because they target Shoelace `::part()`s (unreachable from the
 * app shell): the default-button hover, input part backgrounds incl. the
 * hover/focus states Shoelace does not derive, and the label/placeholder
 * colours.
 *
 * `FEEZAL_Z` — the documented z-index ladder. Layers used to be ad-hoc
 * (--sl-z-index-dialog took five different values between 9999 and 20005,
 * plus raw z-indexes up to 2147483647), so "which thing covers which" was
 * decided by accident. Import the constant instead of inventing a number.
 */

/** Documented stacking order for editor chrome. Higher = closer to the user. */
export const FEEZAL_Z = {
    /** Canvas affordances: snap guides, selection handles. */
    canvasOverlay: 1000,
    /** Popup menus (context menu, palette flyouts, tab menus). */
    menu: 10000,
    /** Modal dialogs (Shoelace `--sl-z-index-dialog`). */
    dialog: 20002,
    /** Toasts — above dialogs, so a dialog's error is visible. */
    toast: 20050,
    /** Connection-loss overlay: blocks everything, including dialogs. */
    connectionOverlay: 20100,
    /** The welcome tour spotlight, which must sit over the whole editor. */
    tour: 20200,
};

/**
 * Shoelace control theming for editor dialogs/panels. Compose FIRST in
 * `static styles` so component-specific rules can still override.
 */
export const feezalDialogChrome = css`
    /* ── Buttons ──────────────────────────────────────────────────────────
       A non-primary sl-button hovers to a light Shoelace neutral, which reads
       as white in dark mode. The variant property reflects to an attribute,
       so buttons with no explicit variant match this selector too. */
    sl-button[variant='default']::part(base):hover {
        background-color: var(--feezal-btn-hover, var(--sl-color-primary-50, #f0f9ff));
        border-color: var(--feezal-btn-hover-border, var(--sl-color-primary-300, #7dd3fc));
        color: var(--feezal-btn-hover-color, var(--sl-color-primary-700, #0369a1));
    }

    /* ── Inputs ───────────────────────────────────────────────────────────
       Shoelace does NOT derive the hover/focus background from the resting
       one — without these an input goes white the moment it is hovered or
       focused in dark mode. Size via the --sl-input-height/font-size tokens,
       never by overriding ::part(input) height (that pushes text off-centre). */
    sl-input::part(base),
    sl-textarea::part(base) {
        background-color: var(--sl-input-background-color, var(--feezal-bg, #fff));
        border-color: var(--sl-input-border-color, var(--feezal-border, #d0d0d0));
        color: var(--sl-input-color, var(--feezal-color, #333));
    }
    sl-input::part(base):hover,
    sl-textarea::part(base):hover {
        background-color: var(--sl-input-background-color-hover,
            var(--sl-input-background-color, var(--feezal-bg, #fff)));
        border-color: var(--sl-input-border-color-hover, var(--feezal-border, #d0d0d0));
    }
    sl-input::part(base):focus-within,
    sl-textarea::part(base):focus-within {
        background-color: var(--sl-input-background-color-focus,
            var(--sl-input-background-color, var(--feezal-bg, #fff)));
        border-color: var(--sl-input-border-color-focus, var(--sl-color-primary-400, #38bdf8));
        box-shadow: none;
    }
    sl-input::part(input),
    sl-textarea::part(textarea) {
        background-color: transparent;
        color: var(--sl-input-color, var(--feezal-color, #333));
    }
    sl-input::part(form-control-label),
    sl-select::part(form-control-label),
    sl-textarea::part(form-control-label) {
        color: var(--sl-input-label-color, inherit);
    }
    sl-input::part(help-text),
    sl-select::part(help-text) {
        color: var(--sl-input-help-text-color, var(--feezal-color, #888));
    }

    /* ── Selects ──────────────────────────────────────────────────────────
       The combobox surface follows the input tokens; the dropdown panel
       follows --sl-panel-background-color (set the hoist attribute on the
       element so the menu is not clipped by the dialog body). */
    sl-select::part(combobox) {
        background-color: var(--sl-input-background-color, var(--feezal-bg, #fff));
        border-color: var(--sl-input-border-color, var(--feezal-border, #d0d0d0));
        color: var(--sl-input-color, var(--feezal-color, #333));
    }
    sl-select::part(combobox):hover {
        background-color: var(--sl-input-background-color-hover,
            var(--sl-input-background-color, var(--feezal-bg, #fff)));
    }
    sl-select::part(display-input) { color: var(--sl-input-color, var(--feezal-color, #333)); }

    /* ── Checkboxes / switches: keep the label readable on a dark panel. ── */
    sl-checkbox::part(label),
    sl-switch::part(label),
    sl-radio::part(label) {
        color: var(--feezal-color, inherit);
    }
`;
