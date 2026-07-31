/**
 * feezal-base-theme — the built-in "default" theme, as real CSS variables.
 *
 * Historically the default theme was the ABSENCE of a theme class: no
 * canonical variable was defined anywhere, and every element painted itself
 * from hardcoded fallbacks buried in var() chains — a canonical var, then a
 * Shoelace token, then a hex literal. That meant three copies of every
 * default colour, drift between them, and Shoelace tokens leaking into
 * dashboard styling.
 *
 * Now the rule is: **element colour defaults reference ONLY the canonical
 * theme variables, bare** — `var(--primary-color)`, no `--sl-*`, no literal
 * fallbacks (enforced by `www/test/theme-var-discipline.test.js`). This
 * module is what makes that safe: it defines the canonical set ONCE at
 * `:root`, with the palette the old fallbacks encoded. Theme classes
 * (`.feezal-theme-*` on `feezal-site`) override by inheritance proximity —
 * their values sit closer to the elements than `:root` — so switching themes
 * behaves exactly as before, and the default look is pixel-identical.
 *
 * Imported by `feezal-site.js`, so the editor, the viewer AND the static
 * export bundle all carry it. Element packages must NOT import it (they are
 * published standalone; providing the canonical variables is the embedding
 * app's job — any host page can define the same set).
 */

const BASE_THEME_CSS = `:root {
    /* the canonical set (CLAUDE.md / element-spec §5.1) */
    --primary-background-color:   #ffffff;
    --secondary-background-color: #f0f0f0;
    --primary-text-color:         #212121;
    --secondary-text-color:       #6b6b6b;
    --disabled-text-color:        #9e9e9e;
    --divider-color:              #e0e0e0;
    --primary-color:              #0284c7;
    --accent-color:               #ff9800;
    --error-color:                #d32f2f;
    /* semantic state colours — themes already ship these (see any
       feezal-theme-*), elements may reference them bare */
    --warning-color:              #ff9800;
    --success-color:              #4caf50;
    --info-color:                 #2196f3;
    --card-background-color:      #ffffff;
}`;

const styleElement = document.createElement('style');
styleElement.id = 'feezal-base-theme';
styleElement.textContent = BASE_THEME_CSS;
// Prepend, not append: theme packages inject their own <style> into <head> at
// import time, and if a theme ever targeted :root too, source order should
// favour the theme.
document.head.prepend(styleElement);
