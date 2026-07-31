/**
 * U68 — reusable range + drag selection for a checkbox list.
 *
 * Wraps the anchor / shift-range / drag bookkeeping so any list (the Generate
 * wizard's device list AND its App review list) gets identical behaviour from
 * one implementation:
 *
 *  - a plain press toggles the pressed row and makes it the anchor;
 *  - Shift+press applies the pressed row's toggle RESULT to the whole range
 *    between the anchor and it — fills when the result is "on", clears when
 *    "off"; the anchor is kept so a second Shift+press moves the endpoint;
 *  - Shift+press with NO anchor yet extends from the pressed row UPWARD until
 *    the first row already in that state (a select-up-to-the-boundary fill);
 *  - pressing and dragging over rows paints the pressed row's result onto each.
 *
 * The host owns the selection as a reactive Set. The helper reads it via
 * `selection()` and writes a NEW Set via `commit()` so Lit re-renders. The
 * ordered key list is passed per press because it differs by list/stage.
 */
export class RangeSelect {
    constructor({selection, commit}) {
        this._selection = selection;   // () => Set<string>
        this._commit = commit;         // (Set<string>) => void
        this.anchor = null;
        this._dragOn = null;           // the state a drag paints; null ⇒ not dragging
    }

    get dragging() { return this._dragOn !== null; }

    /**
     * A pointer press on `key`. `order` is the visible key sequence (used only
     * for a Shift+press range). Commits the change and arms a drag whose action
     * matches this press.
     */
    press(ev, key, order = []) {
        const cur = this._selection();
        const on = !cur.has(key);            // the plain-toggle result = the action
        const next = new Set(cur);
        if (ev.shiftKey && this.anchor && this.anchor !== key && order.includes(this.anchor)) {
            this._fillRange(next, order, this.anchor, key, on);   // keep the anchor
        } else if (ev.shiftKey && !this.anchor) {
            this._fillToBoundary(next, order, key, on);
            this.anchor = key;
        } else {
            on ? next.add(key) : next.delete(key);
            this.anchor = key;
        }
        this._commit(next);
        this._dragOn = on;
    }

    /** The drag has moved onto `key` — paint the drag's action onto it. */
    paint(key) {
        if (this._dragOn === null) return;
        const cur = this._selection();
        this.anchor = key;
        if (cur.has(key) === this._dragOn) return;   // already in the target state
        const next = new Set(cur);
        this._dragOn ? next.add(key) : next.delete(key);
        this._commit(next);
    }

    /** End the current drag (pointerup). */
    end() { this._dragOn = null; }

    /** Forget the anchor + any drag (list/stage change). */
    reset() { this.anchor = null; this._dragOn = null; }

    _fillRange(set, order, aKey, bKey, on) {
        const a = order.indexOf(aKey);
        const b = order.indexOf(bKey);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) on ? set.add(order[i]) : set.delete(order[i]);
    }

    _fillToBoundary(set, order, key, on) {
        const idx = order.indexOf(key);
        if (idx === -1) { on ? set.add(key) : set.delete(key); return; }
        for (let i = idx; i >= 0; i--) {
            // stop at the first row (other than the pressed one) already in the
            // target state — that is the boundary of this run.
            if (i !== idx && set.has(order[i]) === on) break;
            on ? set.add(order[i]) : set.delete(order[i]);
        }
    }
}
