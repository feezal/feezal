// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
import {LitElement, html, css} from 'lit';

/**
 * feezal-welcome-tour (U37) — first-run onboarding tour.
 *
 * Spotlight overlay: the editor is dimmed by a translucent backdrop with a
 * cutout highlighting the current step's UI region (a positioned div whose
 * huge box-shadow paints the dim everywhere else), plus a card with the
 * step explanation and Next / Back / Skip controls.
 *
 * Hand-rolled on purpose — editor-only, so no tour library ever reaches the
 * viewer/export bundle, and the cutout tracks targets inside the editor's
 * shadow DOM, which selector-based tour libraries can't reach.
 *
 * Interaction: non-interactive steps place a transparent click-catcher over
 * the whole screen so a stray click can't derail the tour. Interactive steps
 * (broker setup, the hands-on exercise) make the overlay purely visual
 * (pointer-events: none) — the user must drag/type across regions the
 * spotlight doesn't cover.
 *
 * The hands-on steps advance themselves via MutationObservers (element
 * dropped → topic set → template content set) instead of a "Next" click;
 * Next still works as a manual override.
 *
 * Trigger/persistence live in feezal-app-editor (auto-start only on an empty
 * site without the localStorage seen-flag; re-launchable from Editor
 * Settings).
 */

/** U41 — resolve a target inside another component's shadow root, falling
 * back to the host (or an alternative) when the inner node isn't there. */
function inShadow(root, hostSelector, innerSelector) {
    const host = root.querySelector(hostSelector);
    return host?.shadowRoot?.querySelector(innerSelector) ?? host;
}

const STEPS = [
    {
        id: 'palette',
        title: 'Element palette',
        body: 'These are the building blocks of your dashboard — buttons, gauges, lights, charts and more, grouped by family. Drag any of them onto the canvas. The search box filters the list.',
        target: ed => ed.shadowRoot.querySelector('#palette'),
        prepare: ed => { ed.paletteVisible = true; },
    },
    {
        id: 'canvas',
        title: 'Canvas',
        body: 'Your dashboard view. Elements are positioned free-form: drag them anywhere, resize via the corner handles, and use snapping and the grid for alignment. Tabs above switch between views.',
        target: ed => ed.shadowRoot.querySelector('#container-view'),
    },
    {
        id: 'inspector',
        title: 'Inspector',
        body: 'Select an element on the canvas and configure it here: its attributes (MQTT topics, payloads, labels) on the Attributes tab and its appearance on the Styles tab.',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('inspector'); },
    },
    {
        id: 'deploy',
        title: 'Deploy & view',
        body: 'The editor is your workshop — Deploy saves the dashboard to the server, and the ▾ menu opens the live viewer, exports a static bundle or builds a mobile app. Edit mode and the viewer are separate: nothing is live until you deploy.',
        target: ed => ed.shadowRoot.querySelector('#btn-deploy-wrap'),
    },
    {
        id: 'theme',
        title: 'Pick a look',
        body: 'Themes restyle the whole dashboard at once — every element follows the theme\'s colours and surfaces. Try one from the list now if you like; you can change it anytime later.',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('themes'); },
        interactive: true,
    },
    {
        id: 'broker',
        title: 'Connect your MQTT broker',
        body: 'Enter your broker\'s hostname or IP here (e.g. 192.168.1.10) — protocol and port have their own fields, and credentials go below. You can do it now — the tour waits.',
        target: ed => inShadow(ed.shadowRoot, 'feezal-sidebar-viewer', '#conn-host')
            ?? ed.shadowRoot.querySelector('#sidebar-panels'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('viewer'); },
        interactive: true,
    },
    {
        id: 'broker-status',
        title: 'Watch the connection status',
        body: 'This indicator shows whether the feezal server reaches your broker — it turns green once the connection works (the settings apply on deploy). If it stays red, re-check host, port and credentials.',
        target: ed => inShadow(ed.shadowRoot, 'feezal-sidebar-viewer', '.bridge-status')
            ?? ed.shadowRoot.querySelector('#sidebar-panels'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('viewer'); },
        interactive: true,
    },
    {
        id: 'drop-template',
        title: 'Try it: your first live element',
        body: 'This is the Template element. Drag it onto the canvas — the tour continues as soon as it lands.',
        target: ed => ed.shadowRoot.querySelector('#palette')?.shadowRoot
            ?.querySelector('.element[data-el="feezal-element-basic-template"]')
            ?? ed.shadowRoot.querySelector('#palette'),
        prepare: ed => {
            ed.paletteVisible = true;
            const palette = ed.shadowRoot.querySelector('#palette');
            // Expand the Basic category and bring the entry into view so the
            // spotlight can sit on the actual Template tile.
            if (palette?._collapsed?.has('Basic')) palette._toggleCategory('Basic');
            requestAnimationFrame(() => palette?.shadowRoot
                ?.querySelector('.element[data-el="feezal-element-basic-template"]')
                ?.scrollIntoView({block: 'center'}));
        },
        interactive: true,
        advance: 'drop',
    },
    {
        id: 'wire-topic',
        title: 'Point it at a topic',
        body: 'With the new element selected, set its subscribe attribute in the inspector to a topic that exists on your broker — the autocompletion suggests topics as you type. Then set the template content, e.g. ${msg.payload} °C.',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('inspector'); },
        interactive: true,
        advance: 'subscribe',
    },
    {
        id: 'finish',
        title: 'Deploy and watch it live',
        body: 'Hit Deploy, then ▾ → View to open the viewer: your first live MQTT value on a dashboard. That’s the whole loop — build, wire, deploy. You can replay this tour anytime from Editor Settings.',
        target: ed => ed.shadowRoot.querySelector('#btn-deploy-wrap'),
        interactive: true,
    },
];

const PAD = 6; // cutout padding around the target rect

class FeezalWelcomeTour extends LitElement {
    static properties = {
        editor: {attribute: false},
        _active: {state: true},
        _step: {state: true},
        _rect: {state: true},
    };

    static styles = css`
        :host {
            position: fixed;
            inset: 0;
            z-index: 100000;
            pointer-events: none;
            display: block;
        }
        :host(:not([data-active])) { display: none; }

        /* Cutout: the box-shadow paints the dim backdrop everywhere else. */
        .spotlight {
            position: fixed;
            border-radius: 8px;
            box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.55);
            transition: left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease;
            pointer-events: none;
        }
        /* No target (hidden region) → dim everything, card centred. */
        .backdrop-full {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            pointer-events: none;
        }
        /* Non-interactive steps: swallow stray clicks so they can't derail the tour. */
        .click-catcher {
            position: fixed;
            inset: 0;
            pointer-events: auto;
        }
        .card {
            position: fixed;
            width: 320px;
            max-width: calc(100vw - 24px);
            box-sizing: border-box;
            padding: 16px;
            border-radius: 10px;
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333);
            border: 1px solid var(--feezal-border, #ddd);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
            font-size: 13px;
            line-height: 1.5;
            pointer-events: auto;
        }
        .card h3 { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
        .card p { margin: 0 0 12px; white-space: pre-line; }
        .waiting {
            font-size: 12px;
            opacity: 0.65;
            font-style: italic;
            margin: 0 0 12px;
        }
        .controls { display: flex; align-items: center; gap: 8px; }
        .dots { display: flex; gap: 4px; flex: 1; }
        .dot {
            width: 7px; height: 7px; border-radius: 50%;
            background: var(--feezal-border, #ccc);
        }
        .dot.on { background: var(--sl-color-primary-600, #0284c7); }
        button {
            font: inherit; font-size: 12px;
            padding: 5px 12px; border-radius: 6px; cursor: pointer;
            border: 1px solid var(--feezal-border, #ccc);
            background: var(--feezal-bg, #fff);
            color: var(--feezal-color, #333);
        }
        button.primary {
            background: var(--sl-color-primary-600, #0284c7);
            border-color: var(--sl-color-primary-600, #0284c7);
            color: #fff;
        }
        button.link {
            border: none; background: none; padding: 5px 2px;
            opacity: 0.6; text-decoration: underline;
        }
        button.link:hover { opacity: 1; }
    `;

    constructor() {
        super();
        this.editor = null;
        this._active = false;
        this._step = 0;
        this._rect = null;
        this._onResize = () => this._measure();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._teardown();
    }

    get running() { return this._active; }

    start() {
        if (this._active) return;
        this._active = true;
        this.setAttribute('data-active', '');
        this._goto(0);
        window.addEventListener('resize', this._onResize);
        // Sidebar/palette animations and tab switches move targets after the
        // step's own measure — re-measure on a coarse interval while open.
        this._trackTimer = setInterval(() => this._measure(), 400);
    }

    /** End the tour. Always marks it seen — skipping counts. */
    stop() {
        this._teardown();
        this._active = false;
        this.removeAttribute('data-active');
        try { localStorage.setItem('feezalTourSeen', '1'); } catch { /* quota */ }
        this.dispatchEvent(new CustomEvent('tour-finished', {bubbles: true, composed: true}));
    }

    _teardown() {
        window.removeEventListener('resize', this._onResize);
        clearInterval(this._trackTimer);
        this._watcher?.disconnect();
        this._watcher = null;
    }

    _goto(index) {
        if (index < 0 || index >= STEPS.length) return;
        this._watcher?.disconnect();
        this._watcher = null;
        this._step = index;
        const step = STEPS[index];
        step.prepare?.(this.editor);
        // Measure after the prepare-triggered re-render settled.
        this.editor?.updateComplete?.then(() => requestAnimationFrame(() => this._measure()));
        this._measure();
        if (step.advance === 'drop') this._watchDrop();
        if (step.advance === 'subscribe') this._watchSubscribe();
    }

    _next() { STEPS[this._step + 1] ? this._goto(this._step + 1) : this.stop(); }
    _back() { this._goto(this._step - 1); }

    _measure() {
        if (!this._active || !this.editor) return;
        const target = STEPS[this._step].target?.(this.editor);
        const r = target?.getBoundingClientRect();
        this._rect = (r && r.width > 0 && r.height > 0)
            ? {left: r.left - PAD, top: r.top - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD}
            : null;
    }

    // ── Hands-on progression ──────────────────────────────────────────────────

    /** Advance when a basic-template lands on the current view. */
    _watchDrop() {
        const view = window.feezal?.view;
        if (!view) return;
        this._watcher = new MutationObserver(records => {
            for (const rec of records) {
                for (const node of rec.addedNodes) {
                    if (node.localName === 'feezal-element-basic-template') {
                        this._exerciseEl = node;
                        this._next();
                        return;
                    }
                }
            }
        });
        this._watcher.observe(view, {childList: true});
    }

    /** Advance when the dropped element got a subscribe topic AND template content. */
    _watchSubscribe() {
        const el = this._exerciseEl;
        if (!el) return;
        const ready = () =>
            (el.getAttribute('subscribe') || '') !== '' &&
            (el.querySelector('template')?.innerHTML || '').trim() !== '';
        if (ready()) { this._next(); return; }
        this._watcher = new MutationObserver(() => {
            if (ready()) this._next();
        });
        this._watcher.observe(el, {attributes: true, attributeFilter: ['subscribe'], childList: true, subtree: true, characterData: true});
    }

    // ── Card placement ────────────────────────────────────────────────────────

    /** Put the card beside the cutout on the side with the most room, clamped on-screen. */
    _cardStyle() {
        const w = 320, m = 12;
        const vw = window.innerWidth, vh = window.innerHeight;
        const r = this._rect;
        if (!r) return `left:${(vw - w) / 2}px; top:${vh / 3}px;`;
        const spaceRight = vw - (r.left + r.width);
        const spaceLeft = r.left;
        const spaceBelow = vh - (r.top + r.height);
        let left, top;
        if (spaceRight >= w + 2 * m || spaceRight >= spaceLeft) {
            left = Math.min(r.left + r.width + m, vw - w - m);
        } else {
            left = Math.max(m, r.left - w - m);
        }
        // If the cutout spans (nearly) the full width, fall back to above/below.
        if (left >= r.left && left + w <= r.left + r.width && r.width > vw * 0.7) {
            left = Math.max(m, Math.min(r.left, vw - w - m));
        }
        top = spaceBelow > 180 || r.top < 120
            ? Math.min(r.top + (spaceRight >= w + 2 * m || spaceLeft >= w + 2 * m ? 0 : r.height + m), vh - 220)
            : Math.max(m, r.top - 200);
        top = Math.max(m, Math.min(top, vh - 220));
        return `left:${left}px; top:${top}px;`;
    }

    render() {
        if (!this._active) return html``;
        const step = STEPS[this._step];
        const r = this._rect;
        const waiting = step.advance && this._watcher;
        return html`
            ${r
                ? html`<div class="spotlight" style="left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px;"></div>`
                : html`<div class="backdrop-full"></div>`}
            ${step.interactive ? '' : html`<div class="click-catcher"></div>`}
            <div class="card" style="${this._cardStyle()}">
                <h3>${step.title}</h3>
                <p>${step.body}</p>
                ${waiting ? html`<p class="waiting">Waiting — the tour continues automatically…</p>` : ''}
                <div class="controls">
                    <div class="dots">
                        ${STEPS.map((_, i) => html`<span class="dot ${i === this._step ? 'on' : ''}"></span>`)}
                    </div>
                    <button class="link" @click="${() => this.stop()}">Skip tour</button>
                    ${this._step > 0 ? html`<button @click="${this._back}">Back</button>` : ''}
                    <button class="primary" @click="${this._next}">
                        ${this._step === STEPS.length - 1 ? 'Done' : 'Next'}
                    </button>
                </div>
            </div>
        `;
    }
}

customElements.define('feezal-welcome-tour', FeezalWelcomeTour);
export {FeezalWelcomeTour, STEPS};
