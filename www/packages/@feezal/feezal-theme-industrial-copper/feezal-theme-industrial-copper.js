// E179 - Industrial Copper (warm metallic dark). Original re-implementation inspired by the
// simon42 community "industrial_copper" thread (see package README). State colours are tuned
// WARM so they sit inside the metal palette. Includes warm glass-family tokens.
const styleElement = document.createElement('style');
styleElement.innerHTML = `.feezal-theme-industrial-copper {
    --primary-background-color: #262018;
    --secondary-background-color: #32291d;
    --card-background-color: #2e261b;
    --primary-text-color: #edd8a8;
    --secondary-text-color: #c9b284;
    --disabled-text-color: #8a7a5c;
    --divider-color: #4a3d2a;
    --primary-color: #d4924a;
    --accent-color: #e8b86a;
    --error-color: #c75b4a;
    --warning-color: #e3a93c;
    --success-color: #9c9f4b;
    --info-color: #c0a470;
    --feezal-glass-tint: rgba(64, 50, 34, 0.45);
    --feezal-glass-color: #edd8a8;
    --feezal-glass-muted: rgba(237, 216, 168, 0.6);
    --feezal-glass-border: rgba(210, 155, 65, 0.5);
    --feezal-glass-accent: #e8b86a;
    --feezal-glass-solid: rgba(46, 38, 27, 0.88);
    --paper-listbox-background-color: var(--secondary-background-color);
    --paper-input-container-color: var(--secondary-text-color);
    --paper-input-container-focus-color: var(--primary-color);
    --paper-input-container-input-color: var(--primary-text-color);
    --paper-slider-active-color: var(--primary-color);
    --paper-slider-secondary-color: var(--primary-color);
    --paper-toggle-button-checked-bar-color: var(--primary-color);
    --paper-toggle-button-checked-button-color: var(--primary-color);
    --paper-toggle-button-checked-ink-color: var(--primary-color);
    --paper-checkbox-checked-color: var(--primary-color);
    --paper-checkbox-checked-ink-color: var(--primary-color);
    --paper-tabs-selection-bar-color: var(--primary-color);
    --paper-tab-ink: var(--primary-color);
}`;
document.head.appendChild(styleElement);
