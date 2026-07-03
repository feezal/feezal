/* global feezal */
import interact from 'interactjs';
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

import {generatePwaIcons, loadIconSource, uploadPwaIcons, themeBackgroundColor, SAFE_ZONE} from './feezal-pwa-icons.js';

/**
 * A9 — PWA icon crop dialog.
 *
 * One source image, an interact.js-driven square crop (movable + resizable),
 * an always-visible 80% safe-zone circle, a maskable background colour picker
 * (theme-derived default) and live previews of both icon purposes. Saving
 * generates the full set via canvas and PUTs it to the server.
 *
 * Usage: `dialog.open({site, source, meta})` — source is a File or a URL
 * string; meta optionally restores a stored crop + background colour.
 */
class FeezalPwaIconDialog extends LitElement {
    static properties = {
        _busy:    {state: true},
        _error:   {state: true},
        _warning: {state: true},
        _color:   {state: true},
    };

    static styles = css`
        sl-dialog { --width: 460px; --sl-z-index-dialog: 20002; }
        .stage-wrap { display: flex; justify-content: center; }
        .stage {
            position: relative; display: inline-block; user-select: none;
            background:
                repeating-conic-gradient(#d0d0d0 0% 25%, #f2f2f2 0% 50%) 0 0 / 16px 16px;
        }
        .stage img { display: block; max-width: 400px; max-height: 300px; pointer-events: none; }
        .crop {
            position: absolute; box-sizing: border-box;
            border: 2px solid var(--sl-color-primary-600, #0284c7);
            box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.45);
            cursor: move; touch-action: none;
        }
        /* the always-visible maskable safe zone (80% inscribed circle) */
        .safe {
            position: absolute; inset: 10%; border-radius: 50%;
            border: 1.5px dashed rgba(255, 255, 255, 0.85);
            pointer-events: none;
        }
        .controls { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
        .controls label { font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--feezal-color, #333); }
        input[type="color"] { width: 34px; height: 26px; padding: 0; border: 1px solid var(--feezal-border, #ccc); border-radius: 4px; background: none; cursor: pointer; }
        .previews { display: flex; gap: 16px; margin-left: auto; }
        .pv { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; color: var(--feezal-color, #777); }
        .pv canvas { width: 56px; height: 56px; border: 1px solid var(--feezal-border, #ddd); }
        .pv.masked canvas { border-radius: 50%; }
        .warning { color: var(--sl-color-warning-700, #b45309); font-size: 12px; margin-top: 8px; }
        .error { color: var(--sl-color-danger-600, #d32f2f); font-size: 12px; margin-top: 8px; }
    `;

    constructor() {
        super();
        this._busy = false;
        this._error = '';
        this._warning = '';
        this._color = '#1b1b1b';
        this._img = null;          // loaded source image
        this._sourceFile = null;   // File/Blob when uploaded (kept for regeneration)
        this._site = '';
        this._crop = null;         // {x, y, size} in DISPLAY pixels
        this._scale = 1;           // display px → natural px
    }

    /** Open for a source image. source: File | url string. */
    async open({site, source, meta = null}) {
        this._site = site;
        this._error = '';
        this._warning = '';
        this._busy = false;
        this._sourceFile = source instanceof Blob ? source : null;
        this._color = (meta && meta.backgroundColor) || themeBackgroundColor();
        // Own object URL for the stage <img> — loadIconSource revokes its own.
        if (this._stageUrl && this._stageUrl.startsWith('blob:')) URL.revokeObjectURL(this._stageUrl);
        this._stageUrl = source instanceof Blob ? URL.createObjectURL(source) : source;
        try {
            this._img = await loadIconSource(source);
        } catch (err) {
            this._img = null;
            this._error = err.message;
        }
        this.requestUpdate();
        await this.updateComplete;
        const dialog = this.renderRoot.querySelector('sl-dialog');
        const shown = new Promise(resolve => dialog.addEventListener('sl-after-show', resolve, {once: true}));
        dialog.show();
        await shown;
        if (this._img) {
            // the crop needs the laid-out stage image dimensions
            const imgEl = this.renderRoot.querySelector('.stage img');
            if (imgEl && !imgEl.complete) {
                await new Promise(resolve => { imgEl.onload = resolve; imgEl.onerror = resolve; });
            }
            this._initStage(meta && meta.crop);
        }
    }

    _initStage(storedCrop) {
        const imgEl = this.renderRoot.querySelector('.stage img');
        const nw = this._img.naturalWidth || this._img.width;
        const nh = this._img.naturalHeight || this._img.height;
        this._warning = (Math.min(nw, nh) < 512)
            ? `Source is ${nw}×${nh} — smaller than 512×512, icons may look soft. Consider a larger image or an SVG.`
            : '';
        this._scale = nw / imgEl.clientWidth;

        // initial crop: stored (natural px → display px) or centred max square
        let crop;
        if (storedCrop && storedCrop.size) {
            crop = {
                x: storedCrop.x / this._scale,
                y: storedCrop.y / this._scale,
                size: storedCrop.size / this._scale,
            };
        } else {
            const size = Math.min(imgEl.clientWidth, imgEl.clientHeight);
            crop = {
                x: (imgEl.clientWidth - size) / 2,
                y: (imgEl.clientHeight - size) / 2,
                size,
            };
        }
        this._crop = crop;
        this._applyCrop();

        const cropEl = this.renderRoot.querySelector('.crop');
        interact(cropEl).unset();
        interact(cropEl)
            .draggable({
                modifiers: [interact.modifiers.restrictRect({restriction: 'parent'})],
                listeners: {
                    move: e => {
                        this._crop.x += e.dx;
                        this._crop.y += e.dy;
                        this._applyCrop();
                    },
                },
            })
            .resizable({
                edges: {left: true, right: true, top: true, bottom: true},
                modifiers: [
                    interact.modifiers.aspectRatio({ratio: 1}),
                    interact.modifiers.restrictEdges({outer: 'parent'}),
                    interact.modifiers.restrictSize({min: {width: 32, height: 32}}),
                ],
                listeners: {
                    move: e => {
                        this._crop.x += e.deltaRect.left;
                        this._crop.y += e.deltaRect.top;
                        this._crop.size = e.rect.width;
                        this._applyCrop();
                    },
                },
            });
    }

    _applyCrop() {
        const el = this.renderRoot.querySelector('.crop');
        if (!el || !this._crop) return;
        el.style.left = this._crop.x + 'px';
        el.style.top = this._crop.y + 'px';
        el.style.width = this._crop.size + 'px';
        el.style.height = this._crop.size + 'px';
        this._paintPreviews();
    }

    _naturalCrop() {
        return {
            x: Math.max(0, Math.round(this._crop.x * this._scale)),
            y: Math.max(0, Math.round(this._crop.y * this._scale)),
            size: Math.round(this._crop.size * this._scale),
        };
    }

    _paintPreviews() {
        if (!this._img || !this._crop) return;
        const nat = this._naturalCrop();
        const plain = this.renderRoot.querySelector('.pv.plain canvas');
        const masked = this.renderRoot.querySelector('.pv.masked canvas');
        if (!plain || !masked) return;
        for (const [canvas, maskable] of [[plain, false], [masked, true]]) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (maskable) {
                ctx.fillStyle = this._color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const pad = canvas.width * (1 - SAFE_ZONE) / 2;
                ctx.drawImage(this._img, nat.x, nat.y, nat.size, nat.size,
                    pad, pad, canvas.width * SAFE_ZONE, canvas.height * SAFE_ZONE);
            } else {
                ctx.drawImage(this._img, nat.x, nat.y, nat.size, nat.size, 0, 0, canvas.width, canvas.height);
            }
        }
    }

    async _save() {
        this._busy = true;
        this._error = '';
        try {
            const nat = this._naturalCrop();
            const blobs = await generatePwaIcons(this._img, nat, this._color);
            await uploadPwaIcons(this._site, blobs, this._sourceFile, {
                crop: nat,
                backgroundColor: this._color,
            });
            this.renderRoot.querySelector('sl-dialog').hide();
            this.dispatchEvent(new CustomEvent('pwa-icons-saved', {bubbles: true, composed: true}));
        } catch (err) {
            this._error = err.message;
        }
        this._busy = false;
    }

    render() {
        return html`
            <sl-dialog label="PWA app icon">
                ${this._img ? html`
                    <div class="stage-wrap">
                        <div class="stage">
                            <img src="${this._stageUrl}" draggable="false">
                            <div class="crop"><div class="safe"></div></div>
                        </div>
                    </div>
                    <div class="controls">
                        <label>Maskable background
                            <input type="color" .value="${this._color}"
                                @input="${e => { this._color = e.target.value; this._paintPreviews(); }}">
                        </label>
                        <div class="previews">
                            <div class="pv plain"><canvas width="96" height="96"></canvas>icon</div>
                            <div class="pv masked"><canvas width="96" height="96"></canvas>maskable</div>
                        </div>
                    </div>
                    ${this._warning ? html`<div class="warning">${this._warning}</div>` : ''}
                ` : ''}
                ${this._error ? html`<div class="error">${this._error}</div>` : ''}
                <sl-button slot="footer" @click="${() => this.renderRoot.querySelector('sl-dialog').hide()}">Cancel</sl-button>
                <sl-button slot="footer" variant="primary" ?disabled="${!this._img}" ?loading="${this._busy}"
                    @click="${this._save}">Save icon</sl-button>
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-pwa-icon-dialog', FeezalPwaIconDialog);
export {FeezalPwaIconDialog};
