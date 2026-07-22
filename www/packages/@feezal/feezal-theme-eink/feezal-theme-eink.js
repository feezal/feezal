/**
 * feezal-theme-eink (E57)
 *
 * Companion theme for the feezal-element-eink-* family and e-paper /
 * repurposed-tablet wall panels in general: plain white canvas, pure
 * black-on-white palette, monospace type stack, and a global
 * no-animation/no-transition rule (e-ink refresh does the "animation").
 *
 * The eink elements enforce their own 1-bit contrast so they survive any
 * theme; this theme extends the discipline to the whole page (non-eink
 * elements, dialogs, chrome). Inverted panels: flip --feezal-eink-fg/bg here.
 */

const styleElement = document.createElement('style');

styleElement.innerHTML = `.feezal-theme-eink {
    /* ── 1-bit palette consumed by feezal-element-eink-* ── */
    --feezal-eink-fg: #000;
    --feezal-eink-bg: #fff;
    --feezal-eink-rule: 3px;
    --feezal-eink-radius: 0px;
    --feezal-eink-font: ui-monospace, 'Cascadia Mono', 'Roboto Mono', 'Courier New', monospace;

    --feezal-canvas-bg: #fff;
    background: #fff;

    /* canonical feezal vars so non-eink elements stay 1-bit too */
    --primary-background-color: #fff;
    --secondary-background-color: #fff;
    --card-background-color: #fff;
    --primary-text-color: #000;
    --secondary-text-color: #000;
    --disabled-text-color: #000;
    --primary-color: #000;
    --accent-color: #000;
    --info-color: #000;
    --warning-color: #000;
    --error-color: #000;
    --divider-color: #000;

    color: #000;
    font-family: var(--feezal-eink-font);
}

/* E57: zero animation — e-paper ghosts on every transition frame. */
.feezal-theme-eink *, .feezal-theme-eink *::before, .feezal-theme-eink *::after {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
}

/* No hover affordances, no focus glow — tap targets only. */
.feezal-theme-eink * {
    box-shadow: none !important;
    text-shadow: none !important;
}`;

document.head.appendChild(styleElement);
