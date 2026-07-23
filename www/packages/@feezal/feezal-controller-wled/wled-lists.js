/**
 * WLED effect & palette name tables — static, bundled.
 *
 * WLED does not expose its effect/palette name lists over MQTT (only over
 * the HTTP /json API), so the canonical WLED 0.14/0.15 names are bundled
 * here. Array index = fx / pal id as used by the /json/state API
 * ({"seg":[{"fx":<id>}]} / {"seg":[{"pal":<id>}]}).
 *
 * KEEP IN SYNC: this file is duplicated verbatim in
 * feezal-element-circle-wled, feezal-element-glass-wled and
 * feezal-element-metro-wled — element packages cannot import non-main
 * files across package boundaries.
 *
 * Ids beyond these arrays (newer firmware, usermod effects, custom
 * palettes) are still valid on the device — the UI falls back to showing
 * the numeric id via effectName() / paletteName().
 */

// Canonical WLED 0.14 effect ids 0–117 ("RSVD" = reserved/removed slots).
export const WLED_EFFECTS = [
    'Solid', 'Blink', 'Breathe', 'Wipe', 'Wipe Random', 'Random Colors',
    'Sweep', 'Dynamic', 'Colorloop', 'Rainbow', 'Scan', 'Scan Dual', 'Fade',
    'Theater', 'Theater Rainbow', 'Running', 'Saw', 'Twinkle', 'Dissolve',
    'Dissolve Rnd', 'Sparkle', 'Sparkle Dark', 'Sparkle+', 'Strobe',
    'Strobe Rainbow', 'Strobe Mega', 'Blink Rainbow', 'Android', 'Chase',
    'Chase Random', 'Chase Rainbow', 'Chase Flash', 'Chase Flash Rnd',
    'Rainbow Runner', 'Colorful', 'Traffic Light', 'Sweep Random', 'Chase 2',
    'Aurora', 'Stream', 'Scanner', 'Lighthouse', 'Fireworks', 'Rain',
    'Tetrix', 'Fire Flicker', 'Gradient', 'Loading', 'Rolling Balls',
    'Fairy', 'Two Dots', 'Fairytwinkle', 'Running Dual', 'RSVD', 'Chase 3',
    'Tri Wipe', 'Tri Fade', 'Lightning', 'ICU', 'Multi Comet',
    'Scanner Dual', 'Stream 2', 'Oscillate', 'Pride 2015', 'Juggle',
    'Palette', 'Fire 2012', 'Colorwaves', 'Bpm', 'Fill Noise', 'Noise 1',
    'Noise 2', 'Noise 3', 'Noise 4', 'Colortwinkles', 'Lake', 'Meteor',
    'Meteor Smooth', 'Railway', 'Ripple', 'Twinklefox', 'Twinklecat',
    'Halloween Eyes', 'Solid Pattern', 'Solid Pattern Tri', 'Spots',
    'Spots Fade', 'Glitter', 'Candle', 'Fireworks Starburst', 'Fireworks 1D',
    'Bouncing Balls', 'Sinelon', 'Sinelon Dual', 'Sinelon Rainbow',
    'Popcorn', 'Drip', 'Plasma', 'Percent', 'Ripple Rainbow', 'Heartbeat',
    'Pacifica', 'Candle Multi', 'Solid Glitter', 'Sunrise', 'Phased',
    'Twinkleup', 'Noise Pal', 'Sine', 'Phased Noise', 'Flow', 'Chunchun',
    'Dancing Shadows', 'Washing Machine', 'RSVD', 'Blends', 'TV Simulator',
    'Dynamic Smooth',
    // Ids >= 118 (2D / audio-reactive effects of 0.14+, usermods) are not
    // listed — the UI shows the numeric id for those.
];

// Canonical WLED 0.14 palette ids 0–70.
export const WLED_PALETTES = [
    'Default', '* Random Cycle', '* Color 1', '* Colors 1&2',
    '* Color Gradient', '* Colors Only', 'Party', 'Cloud', 'Lava', 'Ocean',
    'Forest', 'Rainbow', 'Rainbow Bands', 'Sunset', 'Rivendell', 'Breeze',
    'Red & Blue', 'Yellowout', 'Analogous', 'Splash', 'Pastel', 'Sunset 2',
    'Beach', 'Vintage', 'Departure', 'Landscape', 'Beech', 'Sherbet',
    'Hult', 'Hult 64', 'Drywet', 'Jul', 'Grintage', 'Rewhi', 'Tertiary',
    'Fire', 'Icefire', 'Cyane', 'Light Pink', 'Autumn', 'Magenta', 'Magred',
    'Yelmag', 'Yelblu', 'Orange & Teal', 'Tiamat', 'April Night',
    'Orangery', 'C9', 'Sakura', 'Aurora', 'Atlantica', 'C9 2', 'C9 New',
    'Temperature', 'Aurora 2', 'Retro Clown', 'Candy', 'Toxy Reaf',
    'Fairy Reaf', 'Semi Blue', 'Pink Candy', 'Red Reaf', 'Aqua Flash',
    'Yelblu Hot', 'Lite Light', 'Red Flash', 'Blink Red', 'Red Shift',
    'Red Tide', 'Candy2',
    // Ids >= 71 (newer firmware / custom palettes) show as numeric ids.
];

/** Effect display name; ids beyond the bundled list show numerically. */
export function effectName(id) {
    return WLED_EFFECTS[Number(id)] ?? String(id);
}

/** Palette display name; ids beyond the bundled list show numerically. */
export function paletteName(id) {
    return WLED_PALETTES[Number(id)] ?? String(id);
}

/** '#rrggbb' / 'rrggbb' → [r, g, b], or null when unparseable. */
export function hexToRgb(hex) {
    const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const n = Number.parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
