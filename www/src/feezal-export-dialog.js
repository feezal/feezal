/* global feezal */
import {LitElement, html, css} from 'lit';

import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';

/**
 * U34 — static-export dialog with a bundle size breakdown.
 *
 * Opening it fetches /api/sites/<site>/bundle-report — a per-contributor
 * byte attribution (element packages, theme, icon sets, vendor deps, feezal
 * core) computed by the same filtered Vite build the export runs, shared
 * cache and all. Rendered as a sorted bar list with minified / ~gzip bytes
 * and % of total; the top three contributors are highlighted. The download
 * itself is the primary button — available even when no report could be
 * computed (full-bundle fallback).
 */

/** 12345 → "12.1" / 1234567 → "1206" (kB, one decimal under 100 kB). */
export function formatKb(bytes) {
    const kb = bytes / 1024;
    return kb < 100 ? kb.toFixed(1) : String(Math.round(kb));
}

class FeezalExportDialog extends LitElement {
    static properties = {
        _report:  {state: true},   // null | report object
        _error:   {state: true},   // null | message
        _loading: {state: true},
    };

    static styles = css`
        sl-dialog { --width: 520px; --sl-z-index-dialog: 20002; }
        sl-button[variant='default']::part(base):hover {
            background-color: var(--feezal-btn-hover, var(--sl-color-primary-50, #f0f9ff));
            border-color: var(--feezal-btn-hover-border, var(--sl-color-primary-300, #7dd3fc));
            color: var(--feezal-btn-hover-color, var(--sl-color-primary-700, #0369a1));
        }
        .loading {
            display: flex; align-items: center; gap: 12px;
            font-size: 13px; color: var(--feezal-color, #555);
        }
        .totals {
            display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
            font-size: 13px; margin-bottom: 4px;
        }
        .totals b { font-size: 16px; }
        .totals .est { font-size: 11px; opacity: 0.6; }
        .rows { margin-top: 10px; display: flex; flex-direction: column; gap: 7px; }
        .row { font-size: 12px; }
        .row .line {
            display: flex; justify-content: space-between; gap: 10px;
            margin-bottom: 2px;
        }
        .row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row .bytes { flex: 0 0 auto; opacity: 0.75; font-variant-numeric: tabular-nums; }
        .bar {
            height: 6px; border-radius: 3px;
            background: var(--feezal-bg-sub, #eee);
            overflow: hidden;
        }
        .bar > div {
            height: 100%; border-radius: 3px;
            background: var(--feezal-border, #bbb);
        }
        .row.top .bar > div { background: var(--sl-color-primary-600, #0284c7); }
        .row.top .name { font-weight: 600; }
        .warn {
            padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5;
            background: rgba(180, 83, 9, 0.12); border: 1px solid rgba(180, 83, 9, 0.4);
            color: var(--sl-color-warning-700, #b45309);
        }
        .note { margin-top: 12px; font-size: 11px; color: var(--feezal-color, #888); line-height: 1.5; }
    `;

    constructor() {
        super();
        this._report = null;
        this._error = null;
        this._loading = false;
    }

    async open() {
        this._error = null;
        this._loading = true;
        this.renderRoot.querySelector('sl-dialog').show();
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(feezal.siteName)}/bundle-report`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'report unavailable');
            this._report = data;
        } catch (err) {
            this._report = null;
            this._error = err.message;
        } finally {
            this._loading = false;
        }
    }

    _download() {
        const a = document.createElement('a');
        a.href = `/api/sites/${encodeURIComponent(feezal.siteName)}/export`;
        a.download = `${feezal.siteName}.zip`;
        document.body.append(a);
        a.click();
        a.remove();
        this.renderRoot.querySelector('sl-dialog').hide();
    }

    _renderReport() {
        const r = this._report;
        return html`
            <div class="totals">
                <b>${formatKb(r.totalMinified)} kB</b> minified
                <span>· ~${formatKb(r.totalGzip)} kB gzipped</span>
                <span class="est">per-package numbers are estimates</span>
            </div>
            <div class="rows">
                ${r.buckets.map((b, i) => {
                    const share = r.totalMinified ? b.minified / r.totalMinified : 0;
                    return html`
                        <div class="row ${i < 3 ? 'top' : ''}">
                            <div class="line">
                                <span class="name" title="${b.name}">${b.name}</span>
                                <span class="bytes">${formatKb(b.minified)} kB · ~${formatKb(b.gzip)} gz · ${(share * 100).toFixed(1)}%</span>
                            </div>
                            <div class="bar"><div style="width:${Math.max(1, share * 100)}%"></div></div>
                        </div>`;
                })}
            </div>
            <div class="note">
                JS inlined into the exported index.html, attributed per package.
                Fonts, PWA icons and bundled assets come on top of this.
            </div>
        `;
    }

    render() {
        return html`
            <sl-dialog label="Export site — bundle size">
                ${this._loading ? html`
                    <div class="loading">
                        <sl-spinner></sl-spinner>
                        Analyzing the export bundle… the first run builds it and can take a while.
                    </div>` : ''}
                ${this._error ? html`
                    <div class="warn">
                        No size breakdown available (${this._error}). The export itself still works.
                    </div>` : ''}
                ${this._report && !this._loading ? this._renderReport() : ''}
                <sl-button slot="footer" @click="${() => this.renderRoot.querySelector('sl-dialog').hide()}">Cancel</sl-button>
                <sl-button slot="footer" variant="primary" @click="${this._download}">Download ZIP</sl-button>
            </sl-dialog>
        `;
    }
}

window.customElements.define('feezal-export-dialog', FeezalExportDialog);
export {FeezalExportDialog};
