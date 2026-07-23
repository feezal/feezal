/**
 * feezal-visibility (N37) — pause the subscriptions of hidden views.
 *
 * Viewer-only central controller: a view is "visible" when it is the site's
 * active view; a hidden view's elements unsubscribe after a grace period and
 * rewire instantly when the view returns (retained values repaint from the
 * B40 cache replay). View-level granularity (MVP) — element-level pausing
 * (IntersectionObserver) and tab-background pausing are later tiers.
 *
 * Config (serialized site attributes, like playlist/presence):
 *   <feezal-site pause-hidden-subscriptions pause-grace-seconds="30">
 *   <feezal-view pause-subscriptions="inherit|always|never">
 * `never` is the escape hatch for views with non-retained data: their
 * originals stay subscribed, keeping the connection cache warm so later
 * embedded clones start with the last-seen values (retained-origin topics
 * refresh in the cache on every live message; pure command topics are
 * deliberately never cached/replayed).
 *
 * The editor never instantiates this — inspectors/conditions on hidden views
 * stay live there.
 */
export class FeezalVisibility {
    constructor(site) {
        this.site = site;
        this._timers = new Map();   // view → grace timeout handle
        this._paused = new Set();   // views whose elements are unsubscribed
        // The controller needs a real site element (attribute reads, DOM queries
        // and a live MutationObserver). Some unit tests inject a plain-object
        // stand-in for feezal.site (they exercise navigation, not N37); skip
        // setup rather than throw inside the viewer's async init.
        if (typeof site?.querySelectorAll !== 'function') return;
        this._observer = new MutationObserver(() => this.update());
        try {
            this._observer.observe(site, {attributes: true, attributeFilter: ['view']});
        } catch {
            this._observer = null;   // observe unsupported (e.g. happy-dom) — degrade
        }
        this.update();
    }

    _siteDefault() { return this.site.hasAttribute('pause-hidden-subscriptions'); }

    _graceMs() {
        const s = Number(this.site.getAttribute('pause-grace-seconds'));
        return (Number.isFinite(s) && s >= 0 ? s : 30) * 1000;
    }

    /** Effective pause policy for a view: per-view tri-state over the site default. */
    _effective(view) {
        const mode = view.getAttribute('pause-subscriptions');
        if (mode === 'never') return false;
        if (mode === 'always') return true;
        return this._siteDefault();
    }

    _visible(view) {
        return view.getAttribute('name') === String(this.site.view ?? '');
    }

    /** Precondition for FeezalElement.connectedCallback — is this element's view paused? */
    isPaused(el) {
        const view = el.closest?.('feezal-view');
        return view ? this._paused.has(view) : false;
    }

    /** Re-evaluate every view (called on each active-view change). */
    update() {
        for (const view of this.site.querySelectorAll('feezal-view')) {
            if (this._visible(view) || !this._effective(view)) this._resume(view);
            else this._schedulePause(view);
        }
    }

    _schedulePause(view) {
        if (this._paused.has(view) || this._timers.has(view)) return;
        this._timers.set(view, setTimeout(() => {
            this._timers.delete(view);
            // Conditions may have changed during the grace period.
            if (this._visible(view) || !this._effective(view)) return;
            this._paused.add(view);
            // Pause EVERY feezal element in the view (incl. nested/component
            // children — teardown is per element).
            for (const el of view.querySelectorAll('.feezal-element')) {
                el.pauseSubscriptions?.();
            }
        }, this._graceMs()));
    }

    _resume(view) {
        const t = this._timers.get(view);
        if (t) { clearTimeout(t); this._timers.delete(view); }
        if (!this._paused.has(view)) return;
        // Unmark BEFORE the reconnect cycles so the connectedCallback
        // precondition sees the view as live again. Resume is always immediate.
        this._paused.delete(view);
        // Top-level elements only — the reconnect cycle re-runs the lifecycle
        // of nested feezal descendants (component instances) with them.
        const els = [...view.querySelectorAll('.feezal-element')]
            .filter(el => !el.parentElement?.closest?.('.feezal-element'));
        for (const el of els) el.resumeSubscriptions?.();
    }

    dispose() {
        this._observer?.disconnect();
        for (const t of this._timers.values()) clearTimeout(t);
        this._timers.clear();
    }
}
