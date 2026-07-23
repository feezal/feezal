import {html, css} from 'lit';

/**
 * U46 — the opt-in paperclip assistant: an original, self-drawn homage (no
 * Microsoft asset, nothing from a CDN), off by default and enabled from Editor
 * Settings → Help. It appears BELOW the shortcut table in **both** keyboard-
 * shortcut popups — the canvas-mode one (feezal-sidebar-inspector) and the
 * source-mode one (feezal-app-editor) — so this markup/style lives in one place
 * and can never drift between the two.
 *
 * Dark mode is driven by `--feezal-clippy-*` custom properties (light literal
 * fallbacks): the app host sets them for its own shadow tree and pipes them
 * onto the nested inspector, matching how the rest of that panel themes (its
 * `:host(.dark)` never matches — `dark` is a class on the app host, not the
 * nested component).
 */

export const clippyEnabled = () => localStorage.getItem('feezal-clippy') === 'true';

export const clippyStyles = css`
    .clippy {
        display: flex; align-items: flex-end; justify-content: flex-end; gap: 8px;
        margin-top: 18px; pointer-events: none; user-select: none;
    }
    .clippy-bubble {
        max-width: 190px;
        background: var(--feezal-clippy-bg, #fffbe6);
        color: var(--feezal-clippy-fg, #333);
        border: 1px solid var(--feezal-clippy-border, #e3d9a0);
        border-radius: 10px; padding: 8px 10px;
        font-size: 12px; line-height: 1.35; box-shadow: 0 3px 10px rgba(0,0,0,0.18);
        position: relative;
    }
    .clippy-bubble em { opacity: 0.6; font-style: italic; }
    .clippy-bubble::after {
        content: ''; position: absolute; right: -7px; bottom: 14px;
        border: 7px solid transparent; border-left-color: var(--feezal-clippy-bg, #fffbe6);
    }
    .clippy-figure {
        width: 42px; height: 64px; color: #9aa4b0; flex: none;
        transform-origin: 50% 90%;
        animation: clippyBob 3.2s ease-in-out infinite;
    }
    @keyframes clippyBob {
        0%, 100% { transform: translateY(0) rotate(-2deg); }
        50%      { transform: translateY(-5px) rotate(2deg); }
    }
    @media (prefers-reduced-motion: reduce) { .clippy-figure { animation: none; } }
`;

export function clippyMarkup() {
    return html`
        <div class="clippy" aria-hidden="true">
            <div class="clippy-bubble">It looks like you're building a dashboard. Want a hand?
                <em>(I can't actually help — turn me off in Editor Settings.)</em></div>
            <svg class="clippy-figure" viewBox="0 0 44 66" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 24 V50 a7 7 0 0 0 14 0 V15 a11 11 0 0 0 -22 0 V50 a3.5 3.5 0 0 0 7 0 V26"
                      stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="17" cy="13" r="4" fill="#fff" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="27" cy="13" r="4" fill="#fff" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="18" cy="13.6" r="1.7" fill="#222"/>
                <circle cx="28" cy="13.6" r="1.7" fill="#222"/>
            </svg>
        </div>
    `;
}
