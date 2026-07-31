/**
 * @feezal/feezal-elements-fancy (E139) — the animated "Fancy" device-card
 * family: Lottie-driven flat-duotone motion as the card chrome. One N29
 * Phase B bundle: six cards sharing the animation set, the recolour helper
 * and the family frame (see fancy-shared.js and package.json's
 * feezal.elements manifest).
 */
// E164: switch, contact and sensor are enabled — the other four cards (light,
// cover, climate, lock) are DISABLED for now: not imported (→ never registered
// → invisible to palette, discovery and Generate) and dropped from the
// feezal.elements manifest above. Their files and tests stay; re-enable by
// restoring the imports + manifest entries.
import './feezal-element-fancy-switch.js';
import './feezal-element-fancy-contact.js';
import './feezal-element-fancy-sensor.js';
