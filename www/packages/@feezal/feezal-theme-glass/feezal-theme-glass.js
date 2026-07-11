/**
 * feezal-theme-glass (E58)
 *
 * Frosted-glass companion theme for the feezal-element-glass-* family:
 * a colorful gradient wallpaper (inline SVG — no binary assets) that shines
 * through the cards' backdrop blur, plus the frost variables the elements
 * consume. Light frost by default; dark frost follows the OS via
 * prefers-color-scheme.
 *
 * The wallpaper paints the site canvas AND document.body (viewer mirrors the
 * theme class to body, so dialog/toast portals inherit it). Views should use
 * a transparent background — or set their own wallpaper image, which then
 * replaces this one behind the frost.
 */

const wallpaper = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
<radialGradient id="a" cx="20%" cy="15%" r="70%"><stop offset="0%" stop-color="#7dd3fc"/><stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/></radialGradient>
<radialGradient id="b" cx="85%" cy="25%" r="75%"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/></radialGradient>
<radialGradient id="c" cx="30%" cy="90%" r="80%"><stop offset="0%" stop-color="#f0abfc"/><stop offset="100%" stop-color="#f0abfc" stop-opacity="0"/></radialGradient>
<radialGradient id="d" cx="75%" cy="80%" r="70%"><stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#5eead4" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="1000" fill="#dbeafe"/>
<rect width="1600" height="1000" fill="url(#a)"/>
<rect width="1600" height="1000" fill="url(#b)"/>
<rect width="1600" height="1000" fill="url(#c)"/>
<rect width="1600" height="1000" fill="url(#d)"/>
</svg>`);

const styleElement = document.createElement('style');

styleElement.innerHTML = `.feezal-theme-glass {
    /* ── frost variables consumed by feezal-element-glass-* ── */
    --feezal-glass-blur: 20px;
    --feezal-glass-tint: rgba(255, 255, 255, 0.55);
    --feezal-glass-on-tint: rgba(255, 255, 255, 0.82);
    --feezal-glass-solid: rgba(245, 245, 247, 0.94);
    --feezal-glass-border: rgba(255, 255, 255, 0.55);
    --feezal-glass-color: #1d1d1f;
    --feezal-glass-muted: rgba(29, 29, 31, 0.55);
    --feezal-glass-accent: #ff9f0a;
    --feezal-glass-radius: 24px;

    /* wallpaper */
    --feezal-glass-wallpaper: url("data:image/svg+xml,${wallpaper}");
    --feezal-canvas-bg: #dbeafe;
    background: var(--feezal-glass-wallpaper) center / cover no-repeat fixed;

    /* generic feezal/HA vars so non-glass elements stay legible */
    --primary-background-color: transparent;
    --secondary-background-color: rgba(255, 255, 255, 0.6);
    --card-background-color: rgba(255, 255, 255, 0.6);
    --primary-text-color: #1d1d1f;
    --secondary-text-color: rgba(29, 29, 31, 0.6);
    --primary-color: #0a84ff;
    --accent-color: #ff9f0a;
    --divider-color: rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
    .feezal-theme-glass {
        --feezal-glass-tint: rgba(30, 30, 32, 0.5);
        --feezal-glass-on-tint: rgba(58, 58, 62, 0.72);
        --feezal-glass-solid: rgba(38, 38, 42, 0.94);
        --feezal-glass-border: rgba(255, 255, 255, 0.16);
        --feezal-glass-color: #f5f5f7;
        --feezal-glass-muted: rgba(245, 245, 247, 0.55);
        --secondary-background-color: rgba(40, 40, 44, 0.6);
        --card-background-color: rgba(40, 40, 44, 0.6);
        --primary-text-color: #f5f5f7;
        --secondary-text-color: rgba(245, 245, 247, 0.6);
        --divider-color: rgba(255, 255, 255, 0.12);
    }
}`;

document.head.appendChild(styleElement);
