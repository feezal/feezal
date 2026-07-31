/* global feezal */
/**
 * @feezal/feezal-elements-fancy — shared family machinery (E139).
 *
 * The Fancy family's defining trait is ANIMATION: rich flat-duotone vector
 * motion as the card chrome, played by lottie-web. This module is the one
 * copy of everything the six cards share (the E106 lesson):
 *
 *  - `fancyCardStyles` — the family frame: the animation is the hero (most of
 *    the tile), beneath it a slim label + state line; badge anchors.
 *  - `recolorAnimation()` — the two-tone contract: the generated Lottie JSONs
 *    use two palette SLOT colours which are substituted with the RESOLVED
 *    canonical theme vars before instantiating (lottie-web needs concrete
 *    colours). Re-resolved on theme change, incl. per-view themes — the
 *    tones are read from the ELEMENT's computed style, so whatever theme
 *    class is in scope wins.
 *  - `FancyPlayer` — lazy lottie-web lifecycle (the shared E89 chunk, fetched
 *    only when a fancy card is actually in a viewer) + the segment model:
 *    state poses, loop segments, DIRECTIONAL transitions (open→closed plays
 *    the closing clip — reverse clips are derived by playing [b, a]; a pair
 *    with no clip jump-cuts), and seek segments scrubbed by a 0..1 fraction
 *    (cover position, light brightness).
 *  - `FancyBase` — the family element base class: chrome render, the static
 *    SVG pose layer (the editor NEVER loads lottie-web — E89 discipline; and
 *    `prefers-reduced-motion` keeps the poses in the viewer too), the
 *    animation-override attributes, and the theme-retint watcher.
 */
import {FeezalElement, feezalBaseStyles, html, css, availabilityBadge,
    feezalAvailabilityStyles, batteryLowBadge, feezalBatteryStyles} from '@feezal/feezal-element';
import {loadLottie} from '@feezal/feezal-lottie';
import {FANCY_ANIMATIONS, FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT, FANCY_SURFACE_SLOT} from './animations.js';

export {FANCY_ANIMATIONS, FANCY_BASE_SLOT, FANCY_ACTIVE_SLOT, FANCY_SURFACE_SLOT};

// ── colours ──────────────────────────────────────────────────────────────────

/** '#rgb' / '#rrggbb' / 'rgb(a)(…)' → [r, g, b] in 0..1, or null. */
export function parseCssColor(raw) {
    const v = String(raw || '').trim();
    let m = v.match(/^#([0-9a-f]{3})$/i);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16) / 255);
    m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (m) return [0, 1, 2].map(i => parseInt(m[1].slice(i * 2, i * 2 + 2), 16) / 255);
    m = v.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        if (p.length >= 3 && p.every(n => Number.isFinite(n))) return p.slice(0, 3).map(n => n / 255);
    }
    return null;
}

/** Resolve a CSS var against the element (theme/per-view-theme aware). */
export function resolveTone(el, varName, fallback) {
    const raw = getComputedStyle(el).getPropertyValue(varName).trim();
    return parseCssColor(raw) || fallback;
}

const slotMatches = (k, slot) => Array.isArray(k) && k.length >= 3 &&
    slot.slice(0, 3).every((c, i) => Math.abs(k[i] - c) < 0.002);

/**
 * Deep-copy `data` with every fill in a palette slot replaced by the given
 * tone ([r,g,b] 0..1). Non-slot colours (user-supplied art) pass through.
 */
export function recolorAnimation(data, baseTone, activeTone, surfaceTone = [1, 1, 1]) {
    const clone = JSON.parse(JSON.stringify(data));
    const walk = node => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        if ((node.ty === 'fl' || node.ty === 'st') && node.c && Array.isArray(node.c.k)) {
            if (slotMatches(node.c.k, FANCY_BASE_SLOT)) node.c.k = [...baseTone, 1];
            else if (slotMatches(node.c.k, FANCY_ACTIVE_SLOT)) node.c.k = [...activeTone, 1];
            else if (slotMatches(node.c.k, FANCY_SURFACE_SLOT)) node.c.k = [...surfaceTone, 1];
        }
        for (const v of Object.values(node)) walk(v);
    };
    walk(clone);
    return clone;
}

// ── theme-retint broadcast (one observer for the whole family) ───────────────

let observing = false;
function ensureThemeWatcher() {
    if (observing || typeof MutationObserver === 'undefined') return;
    const site = (typeof feezal !== 'undefined' && feezal.site) || document.querySelector('feezal-site');
    if (!site) return;
    observing = true;
    let timer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() =>
            document.dispatchEvent(new CustomEvent('feezal-fancy-retint')), 50);
    });
    // theme switches land as class changes on the site (and per-view themes as
    // classes on views); style covers the colour-override inline vars.
    observer.observe(site, {attributes: true, attributeFilter: ['class', 'style'], subtree: true});
}

// ── the player ───────────────────────────────────────────────────────────────

export const REDUCED_MOTION = () =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lazy lottie lifecycle + segment model for ONE element. The host provides
 * the mount node and the (already recoloured) animation; the player owns the
 * instance, the current state, and the transition queue.
 */
export class FancyPlayer {
    constructor() {
        this.instance = null;
        this.spec = null;        // {data, states, transitions, loops, seek}
        this.state = null;       // current state key
        this._pendingState = null;
    }

    get live() { return Boolean(this.instance); }

    /** (Re)create the lottie instance from a recoloured spec. */
    async mount(container, spec) {
        const lottie = await loadLottie();
        this.destroy();
        this.spec = spec;
        this.instance = lottie.loadAnimation({
            container,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: spec.data,
        });
        this.instance.addEventListener('complete', () => this._onComplete());
        // re-apply whatever state the host last asked for
        if (this.state) {
            const s = this.state;
            this.state = null;
            this.goTo(s, {jump: true});
        }
    }

    destroy() {
        this.instance?.destroy();
        this.instance = null;
    }

    _isLoop(state) { return (this.spec?.loops || []).includes(state); }

    _pose(state) {
        const seg = this.spec?.states?.[state];
        return seg ? seg[this._isLoop(state) ? 0 : 1] ?? seg[0] : null;
    }

    _hold(state) {
        const {instance} = this;
        if (this._isLoop(state)) {
            instance.loop = true;
            instance.playSegments(this.spec.states[state], true);
        } else {
            const pose = this._pose(state);
            instance.resetSegments(true);
            if (pose !== null) instance.goToAndStop(pose, true);
        }
    }

    /**
     * Move to `state`. Plays the directional transition clip when one exists
     * ('from>to' forward, or 'to>from' reversed) — never a jump-cut between
     * clipped pairs; falls back to the pose/loop otherwise.
     */
    goTo(state, {jump = false} = {}) {
        if (!this.instance || !this.spec || state === this.state) return;
        const from = this.state;
        this.state = state;
        const t = this.spec.transitions || {};
        const forward = from !== null && t[`${from}>${state}`];
        const reverse = from !== null && t[`${state}>${from}`];
        if (!jump && (forward || reverse)) {
            this.instance.loop = false;
            this._pendingState = state;
            this.instance.playSegments(forward || [reverse[1], reverse[0]], true);
        } else {
            this._pendingState = null;
            this._hold(state);
        }
    }

    _onComplete() {
        if (this._pendingState === null || !this.instance) return;
        const state = this._pendingState;
        this._pendingState = null;
        this._hold(state);
    }

    /** Scrub a seek segment to fraction `t` (0..1) — cover position etc. */
    seek(name, t) {
        const seg = this.spec?.seek?.[name];
        if (!this.instance || !seg) return;
        this.state = `seek:${name}`;
        this._pendingState = null;
        const frame = seg[0] + Math.max(0, Math.min(1, t)) * (seg[1] - seg[0]);
        this.instance.resetSegments(true);
        this.instance.goToAndStop(frame, true);
    }
}

// ── the family frame ─────────────────────────────────────────────────────────

// Composes feezalBaseStyles (Lit flattens nested style arrays) - it carries
// the editor outline (:host(.feezal-editable)) every element must show; the
// family originally forgot it, which left fancy cards outline-less on the
// canvas until selected.
export const fancyCardStyles = [feezalBaseStyles, css`
    :host {
        display: block; box-sizing: border-box; position: relative;
        background: var(--feezal-fancy-bg, transparent);
        border-radius: var(--feezal-fancy-radius, 10px);
        overflow: hidden;
    }
    .card {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: stretch; padding: 8px; box-sizing: border-box; gap: 2px;
    }
    /* the animation is the hero — most of the tile */
    .stage {
        flex: 1; min-height: 0; position: relative;
        display: flex; align-items: center; justify-content: center;
    }
    .stage .anim, .stage .anim svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .stage .anim[hidden] { display: none; }
    .stage .pose { width: 100%; height: 100%; display: block; }
    .stage .pose[hidden] { display: none; }
    /* the duotone the static poses share with the recoloured animation */
    .pose .tone-base   { fill: var(--feezal-fancy-base-color, var(--secondary-text-color)); }
    .pose .tone-active { fill: var(--feezal-fancy-active-color, var(--primary-color)); }
    /* slim chrome under the hero */
    .label {
        flex: none; font-size: var(--feezal-fancy-font-size-label, 12px);
        color: var(--secondary-text-color);
        text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .state {
        flex: none; font-size: var(--feezal-fancy-font-size-state, 14px); font-weight: 600;
        color: var(--primary-text-color);
        text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    :host([unavailable]) .stage { opacity: 0.4; }
`];

// ── the family base class ────────────────────────────────────────────────────

/**
 * FancyBase — subclasses provide:
 *   `animationKey()` — key into FANCY_ANIMATIONS (state-independent);
 *   `stateKey()`     — the current segment-model state (or null before data);
 *   `seekFraction()` — {name, t} to scrub instead of a state, or null;
 *   `activeToneVar()`— the active palette slot's CSS var (default --primary-color);
 *   `renderPose()`   — the static duotone SVG pose for the CURRENT state
 *                      (editor, reduced motion, and the pre-load placeholder);
 *   `stateText()`    — the slim state line;
 *   `renderBadges()` — optional badge row (battery/sabotage/fault).
 */
export class FancyBase extends FeezalElement {
    static properties = {
        label:        {type: String, reflect: true},
        animationSrc: {type: String, reflect: true, attribute: 'animation-src'},
        animationMap: {type: String, attribute: 'animation-map'},
        discoveryId:  {type: String, reflect: true, attribute: 'discovery-id'},
        _animLive:    {state: true},
    };

    constructor() {
        super();
        this.label = '';
        this.animationSrc = '';
        this.animationMap = '';
        this.discoveryId = '';
        this._animLive = false;
        this.player = new FancyPlayer();
    }

    // ── subclass hooks (defaults) ──
    animationKey() { return null; }
    stateKey() { return null; }
    seekFraction() { return null; }
    activeToneVar() { return '--primary-color'; }
    stateText() { return ''; }
    renderPose() { return ''; }
    renderBadges() { return ''; }

    /** Animation plays only in a real viewer without reduced-motion. */
    get animated() {
        return !feezal.isEditor && !REDUCED_MOTION();
    }

    connectedCallback() {
        super.connectedCallback();
        ensureThemeWatcher();
        this._onRetint = () => this._rebuild();
        document.addEventListener('feezal-fancy-retint', this._onRetint);
        if (this.animated) this.updateComplete.then(() => this._rebuild());
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('feezal-fancy-retint', this._onRetint);
        this.player.destroy();
        this._animLive = false;
    }

    /** The spec (built-in by key, or the user override) — before recolour. */
    async _spec() {
        if (this.animationSrc) {
            try {
                const res = await fetch(this.animationSrc);
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();
                let map = {};
                try { map = JSON.parse(this.animationMap || '{}'); } catch { /* bad map → poses only */ }
                return {data, states: map.states || {}, transitions: map.transitions || {},
                    loops: map.loops || [], seek: map.seek || {}};
            } catch {
                return null;   // broken override → static poses keep the card usable
            }
        }
        const entry = FANCY_ANIMATIONS[this.animationKey()];
        return entry ? {loops: [], transitions: {}, states: {}, seek: {}, ...entry} : null;
    }

    /** (Re)build the lottie instance with freshly resolved tones. */
    async _rebuild() {
        if (!this.animated || !this.isConnected) return;
        const spec = await this._spec();
        const mountEl = this.renderRoot?.querySelector('.anim');
        if (!spec || !mountEl) return;
        const base = resolveTone(this, '--feezal-fancy-base-color',
            resolveTone(this, '--secondary-text-color', [0.42, 0.45, 0.47]));
        const active = resolveTone(this, '--feezal-fancy-active-color',
            resolveTone(this, this.activeToneVar(), [0.01, 0.52, 0.78]));
        const surface = resolveTone(this, '--primary-background-color', [1, 1, 1]);
        const data = recolorAnimation(spec.data, base, active, surface);
        await this.player.mount(mountEl, {...spec, data});
        this._animLive = true;
        this._syncAnimation({jump: true});
    }

    /** Drive the player from the current controller state. */
    _syncAnimation({jump = false} = {}) {
        if (!this.player.live) return;
        const seek = this.seekFraction();
        if (seek) {
            this.player.seek(seek.name, seek.t);
            return;
        }
        const state = this.stateKey();
        if (state) this.player.goTo(state, {jump});
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('animationSrc') || changed.has('animationMap')) {
            this._rebuild();
        } else {
            this._syncAnimation();
        }
    }

    render() {
        const showAnim = this._animLive && this.animated;
        return html`
            <div class="card">
                <div class="stage">
                    <div class="pose" ?hidden="${showAnim}">${this.renderPose()}</div>
                    <div class="anim" ?hidden="${!showAnim}"></div>
                </div>
                ${this.label ? html`<div class="label">${this.label}</div>` : ''}
                <div class="state">${this.stateText()}</div>
            </div>
            ${this.renderBadges()}
            ${availabilityBadge(this._available)}
        `;
    }
}

/** Shared style-descriptor entries every fancy card exposes. */
export const fancyStyleDescriptors = [
    'top', 'left', 'width', 'height', 'background', 'border',
    {property: '--feezal-fancy-base-color', type: 'color', default: 'var(--secondary-text-color)',
        help: 'Base tone — bodies, frames, chrome shapes of the animation and the static pose.'},
    {property: '--feezal-fancy-active-color', type: 'color', default: 'var(--primary-color)',
        help: 'Active tone — the accent shapes (glow, open sash, blind, pulse). Alarm sensors default to the error colour instead.'},
    {property: '--feezal-fancy-font-size-label', default: '12px', help: 'Label font size.'},
    {property: '--feezal-fancy-font-size-state', default: '14px', help: 'State line font size.'},
    {property: '--feezal-fancy-radius', default: '10px', help: 'Card corner radius.'},
];

/** Shared attribute descriptors: label + the animation override pair. */
export const fancyCommonAttributes = [
    {name: 'label', type: 'string', help: 'Slim label line under the animation.'},
    {name: 'animation-src', type: 'asset', accept: ['json'], section: 'Animation', advanced: true,
        help: 'Replace the built-in animation with your own Lottie JSON (e.g. LottieFiles art, uploaded via the Asset Manager). Pair it with animation-map to wire your clip segments to the card states.'},
    {name: 'animation-map', type: 'json', default: '{}', section: 'Animation', advanced: true,
        help: 'Segment map for animation-src: {"states":{"on":[30,90]},"loops":["on"],"transitions":{"off>on":[0,30]},"seek":{"travel":[0,100]}}. Frame numbers refer to your animation. Without it the override shows its first frame per state.'},
];

export const fancyBadgeStyles = [feezalAvailabilityStyles, feezalBatteryStyles];
export {availabilityBadge, batteryLowBadge};
