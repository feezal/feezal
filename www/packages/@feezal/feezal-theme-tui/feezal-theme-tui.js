/**
 * feezal-theme-tui (E59) — green-phosphor terminal theme for the tui-*
 * element family (and everything else: HA-style theme vars are mapped to
 * the phosphor palette). Amber/white phosphor variants: override
 * --feezal-tui-color (and --primary-color) with e.g. #ffb000 or #d8d8d8
 * in custom CSS or per-element styles.
 */
const styleElement = document.createElement('style');

styleElement.innerHTML = `.feezal-theme-tui {
    --accent-color: #ffb000;
    --card-background-color: #0a120c;
    --disabled-text-color: #1e6b2f;
    --divider-color: rgba(51, 255, 102, 0.25);
    --error-color: #ff5533;
    --info-color: #33ccff;
    --primary-background-color: #050806;
    --primary-color: #33ff66;
    --primary-text-color: #33ff66;
    --secondary-background-color: #0a120c;
    --secondary-text-color: #1e9e46;
    --success-color: #33ff66;
    --warning-color: #ffb000;

    --feezal-tui-color: #33ff66;
    --feezal-tui-bg: transparent;

    font-family: ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace;
}`;

document.head.appendChild(styleElement);
