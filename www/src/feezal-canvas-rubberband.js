// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
/**
 * A38 — rubber-band (marquee) selection for absolute canvas views.
 *
 * Replaces the DragSelect dependency. feezal only ever used four things from
 * it — the rectangle overlay, a selectables registry, rect-vs-element hit
 * testing, and an end-of-gesture callback — while overriding or disabling the
 * rest (its click selection, its keyboard drag, even its selected class).
 *
 * Three archived lifecycle bugs were pure fights with that library, and all
 * three dissolve here rather than being re-worked-around:
 *
 * - **B2** (a zero-size selector area silently swallowed every click): the old
 *   implementation measured its area when the gesture machinery STARTED, which
 *   raced a view that was still `display:none`. Nothing is measured at start
 *   here — rects are read when the gesture actually happens, by which time the
 *   view is laid out by definition.
 * - **B35** (stop() was not idempotent and wiped the selectables set on every
 *   view switch): there is no selectables registry at all. The elements are
 *   queried live at gesture end, so there is nothing to re-seed and stopping
 *   twice is a no-op.
 * - **B48** (an instance stayed bound to a detached view node): one instance
 *   retargets via bind(), so the node it listens on is always the live one.
 *
 * The overlay is created on gesture start and removed on gesture end, so it
 * never exists at serialization time — unlike the old `.dragselect-rectangle`,
 * which had to be scrubbed out of saved markup in three separate places.
 */

/** Press distance (px) before a press becomes a rubber band rather than a click. */
const DRAG_THRESHOLD = 4;
/** Pointer distance from the scroll container's edge that starts auto-scrolling. */
const AUTOSCROLL_MARGIN = 24;
/** Auto-scroll step per frame, in px. */
const AUTOSCROLL_SPEED = 12;

/** Do two client rects overlap? Touching edges do not count. */
export function rectsIntersect(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Normalised client rect between two points. */
export function boxBetween(ax, ay, bx, by) {
    return {
        left: Math.min(ax, bx), right: Math.max(ax, bx),
        top: Math.min(ay, by), bottom: Math.max(ay, by),
    };
}

export class RubberBand {
    /**
     * @param {object}   opts
     * @param {Function} opts.onSelection   called after a gesture changed the selection
     * @param {Function} [opts.scrollContainer] () => the element to auto-scroll
     * @param {Function} [opts.canStart]    (event) => whether a press may begin a band
     */
    constructor({onSelection, scrollContainer, canStart} = {}) {
        this.view = null;
        this.stopped = true;
        this._onSelection = onSelection || (() => {});
        this._scrollContainer = scrollContainer || (() => null);
        this._canStart = canStart || (() => true);

        this._overlay = null;
        this._origin = null;
        this._pointer = null;
        this._pointerId = null;
        this._additive = false;
        this._dragging = false;
        this._scrollFrame = 0;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
    }

    /**
     * Point this instance at a view element. Retargeting is the whole B48 fix:
     * the component-edit pseudo-view is destroyed and recreated under the same
     * name, and the old code kept listening to the detached node.
     */
    bind(view) {
        if (view === this.view) return;
        const wasRunning = !this.stopped;
        this._detach();
        this.view = view;
        if (wasRunning) this.start();
    }

    /** Listen for gestures on the bound view. Idempotent. */
    start() {
        if (!this.view) return;
        this._attach();
        this.stopped = false;
    }

    /** Stop listening and abandon any gesture in flight. Idempotent (B35). */
    stop() {
        this._cancelGesture();
        this._detach();
        this.stopped = true;
    }

    /** Stop and forget the view. */
    destroy() {
        this.stop();
        this.view = null;
    }

    _attach() {
        if (!this.view || this._attached) return;
        this.view.addEventListener('pointerdown', this._onPointerDown);
        this._attached = true;
    }

    _detach() {
        if (this.view && this._attached) {
            this.view.removeEventListener('pointerdown', this._onPointerDown);
        }
        this._attached = false;
    }

    _onPointerDown(event) {
        // Primary button only; a right-click opens the context menu instead.
        if (event.button !== 0) return;
        // A press that lands ON an element belongs to interact.js (drag/resize)
        // or to the click handler — a band only starts from empty canvas.
        if (event.target !== this.view) return;
        if (!this._canStart(event)) return;

        this._origin = {x: event.clientX, y: event.clientY};
        this._pointer = {x: event.clientX, y: event.clientY};
        this._pointerId = event.pointerId;
        this._additive = Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
        this._dragging = false;

        // Keep receiving moves even if the pointer leaves the view.
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('pointercancel', this._onPointerUp);
    }

    _onPointerMove(event) {
        if (!this._origin || (this._pointerId !== null && event.pointerId !== this._pointerId)) return;
        this._pointer = {x: event.clientX, y: event.clientY};

        if (!this._dragging) {
            const far = Math.abs(event.clientX - this._origin.x) > DRAG_THRESHOLD ||
                Math.abs(event.clientY - this._origin.y) > DRAG_THRESHOLD;
            if (!far) return;
            this._dragging = true;
            this._showOverlay();
            this._startAutoScroll();
        }
        // Suppress text selection / native drag once this IS a band.
        event.preventDefault();
        this._drawOverlay();
    }

    _onPointerUp(event) {
        if (this._pointerId !== null && event && event.pointerId !== this._pointerId) return;
        const wasDrag = this._dragging;
        // Snapshot the box BEFORE tearing the gesture down — _cancelGesture
        // drops the origin/pointer that currentBox() is derived from.
        const box = this.currentBox();
        const additive = this._additive;
        this._cancelGesture();
        if (wasDrag) this._applySelection(box, additive);
    }

    /** Tear down listeners/overlay without touching the selection. */
    _cancelGesture() {
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        window.removeEventListener('pointercancel', this._onPointerUp);
        this._stopAutoScroll();
        this._hideOverlay();
        this._origin = null;
        this._pointer = null;
        this._pointerId = null;
        this._dragging = false;
    }

    _showOverlay() {
        if (!this.view || this._overlay) return;
        const el = document.createElement('div');
        // Kept identifiable for the legacy scrub paths that still clean saved
        // markup from before this existed.
        el.className = 'dragselect-rectangle feezal-rubberband';
        // border-box so the drawn rectangle measures exactly the dragged box —
        // with the default content-box the 1px border inflates it by 2px.
        el.style.cssText = 'position:fixed;z-index:1000;pointer-events:none;box-sizing:border-box;' +
            'background:rgba(var(--feezal-selection-rgb, 2,132,199),0.12);' +
            'border:1px solid rgba(var(--feezal-selection-rgb, 2,132,199),0.8);';
        this.view.append(el);
        this._overlay = el;
    }

    _drawOverlay() {
        if (!this._overlay) return;
        const box = this.currentBox();
        Object.assign(this._overlay.style, {
            left: `${box.left}px`, top: `${box.top}px`,
            // max(0): clamping can invert the box if the gesture ends up wholly
            // outside the canvas, and a negative width throws off the layout.
            width: `${Math.max(0, box.right - box.left)}px`,
            height: `${Math.max(0, box.bottom - box.top)}px`,
        });
    }

    _hideOverlay() {
        this._overlay?.remove();
        this._overlay = null;
    }

    /**
     * The band's current client rect, CLAMPED to the canvas (B103).
     *
     * Without this the rectangle keeps growing with the pointer once it leaves
     * the view — drawn over the sidebar and the tab bar, and selecting against
     * a box the user cannot see. Clamping both the drawn rect and the hit test
     * from one place keeps "what you see" and "what you select" identical.
     */
    currentBox() {
        if (!this._origin || !this._pointer) return {left: 0, top: 0, right: 0, bottom: 0};
        const box = boxBetween(this._origin.x, this._origin.y, this._pointer.x, this._pointer.y);
        if (!this.view?.getBoundingClientRect) return box;
        const area = this.view.getBoundingClientRect();
        return {
            left: Math.max(box.left, area.left),
            top: Math.max(box.top, area.top),
            right: Math.min(box.right, area.right),
            bottom: Math.min(box.bottom, area.bottom),
        };
    }

    /**
     * Elements the band covers, queried LIVE — no registry to fall out of sync
     * with the DOM (which is what B18 and B35 were both about).
     */
    hits(box = this.currentBox()) {
        if (!this.view) return [];
        return [...this.view.querySelectorAll('.feezal-editable')]
            .filter(el => rectsIntersect(box, el.getBoundingClientRect()));
    }

    _applySelection(box, additive) {
        const hits = this.hits(box);
        if (!additive) {
            for (const el of this.view.querySelectorAll('.feezal-selected')) {
                el.classList.remove('feezal-selected');
            }
        }
        for (const el of hits) el.classList.add('feezal-selected');
        this._onSelection(hits);
    }

    _startAutoScroll() {
        const step = () => {
            this._scrollFrame = 0;
            const box = this._scrollContainer();
            if (!this._dragging || !box || !this._pointer) return;
            const r = box.getBoundingClientRect();
            let dx = 0;
            let dy = 0;
            if (this._pointer.y > r.bottom - AUTOSCROLL_MARGIN) dy = AUTOSCROLL_SPEED;
            else if (this._pointer.y < r.top + AUTOSCROLL_MARGIN) dy = -AUTOSCROLL_SPEED;
            if (this._pointer.x > r.right - AUTOSCROLL_MARGIN) dx = AUTOSCROLL_SPEED;
            else if (this._pointer.x < r.left + AUTOSCROLL_MARGIN) dx = -AUTOSCROLL_SPEED;
            if (dx || dy) {
                box.scrollBy(dx, dy);
                this._drawOverlay();
            }
            this._scrollFrame = requestAnimationFrame(step);
        };
        if (!this._scrollFrame) this._scrollFrame = requestAnimationFrame(step);
    }

    _stopAutoScroll() {
        if (this._scrollFrame) cancelAnimationFrame(this._scrollFrame);
        this._scrollFrame = 0;
    }
}
