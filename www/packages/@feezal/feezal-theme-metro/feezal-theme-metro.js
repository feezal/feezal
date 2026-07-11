/**
 * feezal-theme-metro (E55) — the WP7/Windows-8 start-screen look for the
 * metro-* tile family (and everything else via the HA-style theme vars):
 * near-black background, white type, cyan accent. Classic accent palette
 * for per-tile overrides of --feezal-metro-accent: lime #a4c400,
 * green #60a917, teal #00aba9, cyan #1ba1e2, cobalt #0050ef,
 * violet #aa00ff, magenta #d80073, crimson #a20025, orange #fa6800,
 * amber #f0a30a.
 */
const styleElement = document.createElement('style');

styleElement.innerHTML = `.feezal-theme-metro {
    --accent-color: #d80073;
    --card-background-color: #171717;
    --disabled-text-color: #666666;
    --divider-color: rgba(255, 255, 255, 0.12);
    --error-color: #e51400;
    --info-color: #1ba1e2;
    --primary-background-color: #1d1d1d;
    --primary-color: #1ba1e2;
    --primary-text-color: #ffffff;
    --secondary-background-color: #171717;
    --secondary-text-color: #a0a0a0;
    --success-color: #60a917;
    --warning-color: #fa6800;

    --feezal-metro-accent: #1ba1e2;

    font-family: 'Segoe UI', system-ui, sans-serif;
}`;

document.head.appendChild(styleElement);
