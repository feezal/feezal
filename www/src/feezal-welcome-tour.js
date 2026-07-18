// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
import {LitElement, html, css} from 'lit';
import {keyed} from 'lit/directives/keyed.js';

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
        id: 'welcome',
        title: 'Welcome to Feezal!',
        body: 'Feezal is a dashboard builder for your smart home: you design views by dragging elements onto a canvas, wire them to your MQTT broker, and open the result on any browser — wall tablets, phones, desktops.\n\nThis short tour shows you around. It takes about a minute, and you can leave it anytime with "Skip tour" and replay it later from Editor Settings.',
        // No target — the whole editor dims and the card sits centred.
    },
    {
        id: 'terminology',
        title: 'Three words you\'ll meet everywhere',
        body: 'Everything in Feezal is built from just three things:',
        terms: [
            {term: 'Element', def: 'A single widget — a button, a gauge, a light card, a chart. Elements are wired to MQTT topics and are what you drag onto the canvas.'},
            {term: 'View', def: 'One dashboard page full of elements. A site can have many views — switch between them via the tabs above the canvas, navigation elements, or MQTT.'},
            {term: 'Site', def: 'The whole project: all views plus the broker connection, theme and settings. The site is what you deploy and open in the viewer.'},
        ],
        // No target — centred card like the welcome page.
    },
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
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('inspector'); },
    },
    {
        id: 'theme',
        title: 'Pick a look',
        body: 'Themes restyle the whole dashboard at once — every element follows the theme\'s colours and surfaces. Try one from the list now if you like; you can change it anytime later.',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('themes'); },
        interactive: true,
    },
    {
        id: 'broker',
        title: 'Connect your MQTT broker',
        body: 'Pick the protocol, enter your broker\'s hostname or IP and port (e.g. 192.168.1.10 : 1883), and add credentials below if your broker needs them. You can do it now — the tour waits.',
        // Whole Connection form: protocol select, host/port, credentials, TLS.
        target: ed => inShadow(ed.shadowRoot, 'feezal-sidebar-viewer', 'sl-tab-panel[name="connection"]')
            ?? ed.shadowRoot.querySelector('#sidebar-panels'),
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => {
            ed.sidebarVisible = true;
            ed._setSidebar('viewer');
            inShadow(ed.shadowRoot, 'feezal-sidebar-viewer', 'sl-tab-group')?.show?.('connection');
        },
        interactive: true,
    },
    {
        id: 'broker-status',
        title: 'Watch the connection status',
        body: 'This indicator shows whether the feezal server reaches your broker. It updates after you deploy — the next step. If it stays red afterwards, re-check protocol, host, port and credentials.',
        target: ed => inShadow(ed.shadowRoot, 'feezal-sidebar-viewer', '.bridge-status')
            ?? ed.shadowRoot.querySelector('#sidebar-panels'),
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('viewer'); },
        interactive: true,
    },
    {
        id: 'deploy',
        title: 'Deploy to apply the connection',
        body: 'The editor is your workshop — nothing reaches the server until you Deploy. Hit Deploy now: it saves the dashboard AND applies the broker connection you just entered (the status indicator should turn green). The ▾ menu next to it opens the live viewer.',
        target: ed => ed.shadowRoot.querySelector('#btn-deploy-wrap'),
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
        body: 'With the new element selected, set its subscribe attribute in the inspector. Best pick: a topic on your broker that carries a temperature reading in its payload (something like home/livingroom/temperature) — the autocompletion suggests your broker\'s topics while you type. The tour continues once the topic is set.',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('inspector'); },
        interactive: true,
        advance: 'subscribe',
    },
    {
        id: 'template-content',
        title: 'Show the value',
        body: 'Now give it content: open the template attribute in the inspector and paste the snippet below — ${msg.payload} is replaced by whatever arrives on your topic, so a temperature reading renders as e.g. "21.5°C". The tour continues once the template has content.',
        snippet: '${msg.payload}°C',
        target: ed => ed.shadowRoot.querySelector('#sidebar-panels'),
        extend: ed => ed.shadowRoot.querySelector('#menu-right'),
        prepare: ed => { ed.sidebarVisible = true; ed._setSidebar('inspector'); },
        interactive: true,
        advance: 'template',
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

        /* Cutout: the box-shadow paints the dim backdrop everywhere else.
           Strong dim (0.78) — the spotlighted region must clearly pop. */
        .spotlight {
            position: fixed;
            border-radius: 8px;
            box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.78);
            transition: left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease;
            pointer-events: none;
        }
        /* Glow ring inside the cutout — a keyed child, re-created on every
           step so the arrival animation replays while the cutout itself
           still slides between targets. Arrive: bright flare that settles;
           then a gentle infinite breathing to keep the eye anchored. */
        .glow {
            position: absolute;
            inset: -2px;
            border-radius: 10px;
            border: 2px solid var(--feezal-tour-glow, rgba(56, 189, 248, 0.95));
            box-shadow:
                0 0 18px 4px rgba(56, 189, 248, 0.55),
                inset 0 0 20px rgba(56, 189, 248, 0.30);
            animation:
                feezal-tour-arrive 0.9s cubic-bezier(0.22, 1, 0.36, 1),
                feezal-tour-breathe 2.6s ease-in-out 0.9s infinite alternate;
        }
        @keyframes feezal-tour-arrive {
            0% {
                opacity: 0;
                transform: scale(1.08);
                box-shadow:
                    0 0 64px 26px rgba(56, 189, 248, 0.95),
                    inset 0 0 46px rgba(56, 189, 248, 0.7);
            }
            40% { opacity: 1; }
            100% {
                transform: scale(1);
                box-shadow:
                    0 0 18px 4px rgba(56, 189, 248, 0.55),
                    inset 0 0 20px rgba(56, 189, 248, 0.30);
            }
        }
        @keyframes feezal-tour-breathe {
            from {
                box-shadow:
                    0 0 14px 3px rgba(56, 189, 248, 0.45),
                    inset 0 0 16px rgba(56, 189, 248, 0.22);
            }
            to {
                box-shadow:
                    0 0 28px 8px rgba(56, 189, 248, 0.75),
                    inset 0 0 28px rgba(56, 189, 248, 0.42);
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .glow { animation: none; }
        }
        /* No target (welcome page / hidden region) → dim everything, card centred. */
        .backdrop-full {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.78);
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
        /* Terminology definition list (welcome flow) */
        .terms { margin: 0 0 12px; }
        .terms dt {
            font-weight: 700;
            color: var(--sl-color-primary-600, #0284c7);
            margin-top: 8px;
        }
        .terms dt:first-child { margin-top: 0; }
        .terms dd {
            margin: 2px 0 0;
            line-height: 1.45;
        }
        /* Copyable snippet chip (e.g. the template example) */
        .snippet {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
            margin: 0 0 12px;
            padding: 8px 10px;
            border: 1px dashed var(--sl-color-primary-400, #38bdf8);
            border-radius: 6px;
            background: color-mix(in srgb, var(--sl-color-primary-500, #0ea5e9) 10%, transparent);
            cursor: copy;
            text-align: left;
        }
        .snippet:hover { background: color-mix(in srgb, var(--sl-color-primary-500, #0ea5e9) 18%, transparent); }
        .snippet code {
            font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
            font-size: 13px;
            font-weight: 600;
            color: var(--feezal-color, #333);
            user-select: all;
        }
        .snippet .copy-hint {
            flex-shrink: 0;
            font-size: 11px;
            font-weight: 600;
            color: var(--sl-color-primary-600, #0284c7);
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
        if (step.advance === 'template') this._watchTemplate();
        this._copied = false;
    }

    _next() { STEPS[this._step + 1] ? this._goto(this._step + 1) : this.stop(); }
    _back() { this._goto(this._step - 1); }

    _measure() {
        if (!this._active || !this.editor) return;
        const step = STEPS[this._step];
        const target = step.target?.(this.editor);
        const r = target?.getBoundingClientRect();
        this._rect = (r && r.width > 0 && r.height > 0)
            ? {left: r.left - PAD, top: r.top - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD}
            : null;

        // `extend`: union a second element's rect into ONE bounding cutout
        // (single rect — no holes). Sidebar steps use it to also spotlight the
        // right-sidebar tab switcher (#menu-right), which lives in the top menu
        // bar outside #sidebar-panels, so the user sees which tab is active and
        // can switch. The inspector's own Attributes/Styles tab bar is already
        // inside #sidebar-panels and thus already covered.
        const ext = this._rect ? step.extend?.(this.editor)?.getBoundingClientRect() : null;
        if (ext && ext.width > 0 && ext.height > 0) {
            const left = Math.min(this._rect.left, ext.left - PAD);
            const top = Math.min(this._rect.top, ext.top - PAD);
            const right = Math.max(this._rect.left + this._rect.width, ext.right + PAD);
            const bottom = Math.max(this._rect.top + this._rect.height, ext.bottom + PAD);
            this._rect = {left, top, width: right - left, height: bottom - top};
        }
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

    /** Advance when the dropped element got its subscribe topic. */
    _watchSubscribe() {
        const el = this._exerciseEl;
        if (!el) return;
        const ready = () => (el.getAttribute('subscribe') || '') !== '';
        if (ready()) { this._next(); return; }
        this._watcher = new MutationObserver(() => {
            if (ready()) this._next();
        });
        this._watcher.observe(el, {attributes: true, attributeFilter: ['subscribe']});
    }

    /** Advance when the element's template got content. */
    _watchTemplate() {
        const el = this._exerciseEl;
        if (!el) return;
        const ready = () => (el.querySelector('template')?.innerHTML || '').trim() !== '';
        if (ready()) { this._next(); return; }
        this._watcher = new MutationObserver(() => {
            if (ready()) this._next();
        });
        this._watcher.observe(el, {childList: true, subtree: true, characterData: true});
    }

    /** Copy the step snippet to the clipboard with a brief "Copied!" confirmation. */
    async _copySnippet(snippet) {
        try {
            await navigator.clipboard.writeText(snippet);
        } catch {
            // Clipboard API unavailable (permissions / insecure origin) —
            // fall back to a transient textarea + execCommand.
            const ta = document.createElement('textarea');
            ta.value = snippet;
            document.body.append(ta);
            ta.select();
            try { document.execCommand('copy'); } catch { /* give up silently */ }
            ta.remove();
        }
        this._copied = true;
        this.requestUpdate();
        clearTimeout(this._copiedTimer);
        this._copiedTimer = setTimeout(() => { this._copied = false; this.requestUpdate(); }, 1600);
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
                ? html`<div class="spotlight" style="left:${r.left}px; top:${r.top}px; width:${r.width}px; height:${r.height}px;">${keyed(this._step, html`<div class="glow"></div>`)}</div>`
                : html`<div class="backdrop-full"></div>`}
            ${step.interactive ? '' : html`<div class="click-catcher"></div>`}
            <div class="card" style="${this._cardStyle()}">
                <h3>${step.title}</h3>
                <p>${step.body}</p>
                ${step.terms ? html`
                    <dl class="terms">
                        ${step.terms.map(t => html`<dt>${t.term}</dt><dd>${t.def}</dd>`)}
                    </dl>` : ''}
                ${step.snippet ? html`
                    <button class="snippet" title="Click to copy"
                        @click="${() => this._copySnippet(step.snippet)}">
                        <code>${step.snippet}</code>
                        <span class="copy-hint">${this._copied ? 'Copied!' : 'Copy'}</span>
                    </button>` : ''}
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
