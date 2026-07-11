/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

/**
 * feezal-element-metro-tile (E55)
 *
 * Two things in one package:
 *
 * 1. `MetroTileBase` — the shared base class of the Metro live-tile family:
 *    flat solid-colour tile, sharp corners, white type, the `size` grid
 *    (1x1 / 2x2 / 4x2 / 4x4), and the signature 3D Y-flip between the front
 *    (primary state + one base action) and the back (detail controls).
 *    Subclasses implement `renderFront()`, optionally `renderBack()` (null =
 *    front-only, no ⋯ affordance) and `baseAction()` (front tap). Flip state
 *    is per-client UI state — never published.
 *
 * 2. `feezal-element-metro-tile` — the generic action tile built on it:
 *    icon + label, tap publishes a payload and/or navigates to a view
 *    (start-screen-as-navigation), optional live badge from a topic.
 *
 * Tile grid: n spans = n·unit + (n−1)·gutter with unit 70px / gutter 10px
 * (override via --feezal-metro-unit/-gutter before drop) → 70/150/310 px.
 * The `size` attribute rewrites the element's inline width/height so mixed
 * tiles align into the mosaic; manual resize still works afterwards.
 */

const GRID_UNIT = 70;
const GRID_GUTTER = 10;
const SIZES = {
    '1x1': [1, 1],
    '2x2': [2, 2],
    '4x2': [4, 2],
    '4x4': [4, 4],
};

const span = n => n * GRID_UNIT + (n - 1) * GRID_GUTTER;

export class MetroTileBase extends FeezalElement {
    /** Shared attribute descriptors — spread into subclass descriptors. */
    static get tileAttributes() {
        return [
            {name: 'size', type: 'select', options: ['', '1x1', '2x2', '4x2', '4x4'], default: '2x2',
                help: 'Metro tile size on the shared grid (1x1=70px … 4x4=310px). Setting it resizes the element; manual resize stays possible.'},
            {name: 'label', type: 'string', help: 'Tile label (bottom left, Metro style).'},
            {name: 'icon',  type: 'icon',   help: 'Centre icon (Material name or set:name).'},
        ];
    }

    static get tileStyles() {
        return [
            'top', 'left', 'width', 'height',
            {property: '--feezal-metro-accent', type: 'color',
                default: 'var(--primary-color, var(--sl-color-primary-600, #1ba1e2))',
                help: 'Tile colour (theme accent by default — WP7 cyan with feezal-theme-metro).'},
            {property: '--feezal-metro-text', type: 'color', default: '#ffffff', help: 'Tile text/icon colour.'},
        ];
    }

    static properties = {
        size:  {type: String, reflect: true},
        label: {type: String, reflect: true},
        icon:  {type: String, reflect: true},
        _flipped: {state: true},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block; box-sizing: border-box; overflow: visible;
            container-type: size;
            --feezal-metro-accent: var(--primary-color, var(--sl-color-primary-600, #1ba1e2));
            --feezal-metro-text: #fff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            perspective: 600px;
            user-select: none; -webkit-tap-highlight-color: transparent;
        }
        .tile {
            position: absolute; inset: 0;
            transform-style: preserve-3d;
        }
        @media (prefers-reduced-motion: no-preference) {
            .tile { transition: transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1); }
        }
        .tile.flipped { transform: rotateY(180deg); }
        .face {
            position: absolute; inset: 0; overflow: hidden;
            backface-visibility: hidden; -webkit-backface-visibility: hidden;
            background: var(--feezal-metro-accent);
            color: var(--feezal-metro-text);
        }
        .face.back { transform: rotateY(180deg); }
        .front { cursor: pointer; }
        .center {
            position: absolute; inset: 0 0 18px 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        }
        .center feezal-icon { font-size: min(42px, 40cqh); color: var(--feezal-metro-text); }
        .tlabel {
            position: absolute; left: 8px; right: 24px; bottom: 4px;
            font-size: 12px; font-weight: 400;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .badge {
            position: absolute; top: 6px; right: 8px; font-size: 13px; font-weight: 600;
        }
        .flip-btn {
            position: absolute; right: 2px; bottom: 0; z-index: 2;
            border: none; background: none; color: var(--feezal-metro-text);
            font-size: 16px; font-weight: 700; letter-spacing: 1px;
            cursor: pointer; padding: 2px 6px; line-height: 1; opacity: 0.75;
        }
        .flip-btn:hover { opacity: 1; }
        .back-content {
            position: absolute; inset: 6px 8px 6px 8px;
            display: flex; flex-direction: column; gap: 6px; justify-content: center;
            font-size: 13px;
        }
        /* shared flat controls for tile backs */
        .mbtn {
            border: 2px solid var(--feezal-metro-text); background: none;
            color: var(--feezal-metro-text); font: inherit; font-weight: 600;
            padding: 4px 10px; cursor: pointer;
        }
        .mbtn:hover, .mbtn.active { background: var(--feezal-metro-text); color: var(--feezal-metro-accent); }
        input[type='range'] {
            -webkit-appearance: none; appearance: none; width: 100%; height: 4px;
            background: color-mix(in srgb, var(--feezal-metro-text) 40%, transparent);
            outline: none;
        }
        input[type='range']::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 14px; height: 22px; background: var(--feezal-metro-text); cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
            width: 14px; height: 22px; border: none; border-radius: 0;
            background: var(--feezal-metro-text); cursor: pointer;
        }
        .rowline { display: flex; align-items: center; gap: 8px; }
        .rowline feezal-icon { font-size: 18px; flex: 0 0 auto; }
    `];

    constructor() {
        super();
        this.size = '';
        this.label = '';
        this.icon = '';
        this._flipped = false;
        this.__outside = e => {
            if (!e.composedPath().includes(this)) this._flip(false);
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('pointerdown', this.__outside);
    }

    updated(changed) {
        super.updated(changed);
        // The size grid writes the element's inline geometry (editor keeps
        // full manual control afterwards).
        if (changed.has('size') && SIZES[this.size]) {
            const [w, h] = SIZES[this.size];
            this.style.width = `${span(w)}px`;
            this.style.height = `${span(h)}px`;
        }
    }

    // ── Subclass API ──────────────────────────────────────────────────────────

    /** Front face content (rendered into the centre area). */
    renderFront() {
        return html``;
    }

    /** Back face content, or null for a front-only tile (no ⋯). */
    renderBack() {
        return null;
    }

    /** Primary action on front tap (already editor-guarded by the caller). */
    baseAction() { /* subclass */ }

    /** Optional live badge (top right), or ''. */
    renderBadge() {
        return '';
    }

    // ── Flip machinery ────────────────────────────────────────────────────────

    _flip(to) {
        this._flipped = to;
        document.removeEventListener('pointerdown', this.__outside);
        if (to) {
            // Deferred: don't catch the very tap that opened the back.
            setTimeout(() => {
                if (this._flipped) document.addEventListener('pointerdown', this.__outside);
            });
        }
    }

    _frontClick() {
        if (feezal.isEditor) return;
        this.baseAction();
    }

    render() {
        const back = this.renderBack();
        const badge = this.renderBadge();
        return html`
            <div class="tile ${this._flipped ? 'flipped' : ''}">
                <div class="face front" @click="${this._frontClick}">
                    <div class="center">${this.renderFront()}</div>
                    ${badge ? html`<div class="badge">${badge}</div>` : ''}
                    ${this.label ? html`<div class="tlabel">${this.label}</div>` : ''}
                    ${back ? html`
                        <button class="flip-btn" title="Details"
                            @click="${e => { e.stopPropagation(); if (!feezal.isEditor) this._flip(true); }}">⋯</button>` : ''}
                </div>
                ${back ? html`
                    <div class="face back">
                        <div class="back-content">${back}</div>
                        ${this.label ? html`<div class="tlabel">${this.label}</div>` : ''}
                        <button class="flip-btn" title="Back"
                            @click="${() => this._flip(false)}">⋯</button>
                    </div>` : ''}
            </div>`;
    }
}

// ── The generic action tile ──────────────────────────────────────────────────

class FeezalElementMetroTile extends MetroTileBase {
    static get feezal() {
        return {
            palette: {name: 'Tile', category: 'Metro', color: '#1ba1e2', icon: 'grid_view'},
            description: 'Generic Metro start-screen tile: icon + label, tap publishes a payload and/or navigates to a view; optional live badge from a topic.',
            attributes: [
                ...MetroTileBase.tileAttributes,
                {name: 'publish', type: 'mqttTopic', help: 'Topic published on tap (empty = none).'},
                {name: 'payload', type: 'string', default: '1', help: 'Payload published on tap.'},
                {name: 'view', dropdown: 'views', help: 'View to navigate to on tap (empty = none).'},
                {name: 'subscribe', type: 'mqttTopic', help: 'Optional badge topic — the payload shows top-right (live-tile count).'},
                {name: 'message-property', type: 'string', default: 'payload',
                    help: 'Dot-notation path to the badge value within the MQTT message. Default: payload'},
            ],
            styles: MetroTileBase.tileStyles,
            restrict: {minWidth: 40, minHeight: 40},
            defaultStyle: {width: '150px', height: '150px'},
        };
    }

    static properties = {
        publish: {type: String, reflect: true},
        payload: {type: String, reflect: true},
        view:    {type: String, reflect: true},
        _badge:  {state: true},
    };

    constructor() {
        super();
        this.publish = '';
        this.payload = '1';
        this.view = '';
        this._badge = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.subscribe) {
            this.addSubscription(this.subscribe, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                this._badge = v === null || v === undefined ? '' : String(v);
            });
        }
    }

    renderFront() {
        return this.icon ? html`<feezal-icon name="${this.icon}"></feezal-icon>` : '';
    }

    renderBadge() {
        return this._badge;
    }

    baseAction() {
        if (this.publish) feezal.connection.pub(this.publish, this.payload);
        if (this.view && feezal.site) feezal.site.view = this.view;
    }
}

customElements.define('feezal-element-metro-tile', FeezalElementMetroTile);
export {FeezalElementMetroTile};
