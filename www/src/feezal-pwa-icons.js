/**
 * A9 — PWA icon pipeline (editor-side).
 *
 * All image work happens here in the browser via the Canvas API — the server
 * never converts images (it may be a Pi/NAS without image libraries). One
 * source image (PNG/JPEG/WebP/SVG) + a square crop yield the full icon set:
 *
 *   purpose "any":      icon-192.png · icon-512.png · apple-touch-icon.png (180)
 *   purpose "maskable": maskable-192.png · maskable-512.png — the crop scaled
 *                       into the 80% safe zone on a full-bleed background.
 */

export const SAFE_ZONE = 0.8;

/** Load a source image (File/Blob or URL) ready for canvas drawing. */
export function loadIconSource(source) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = (source instanceof Blob) ? URL.createObjectURL(source) : source;
        img.onload = () => {
            if (source instanceof Blob) URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            if (source instanceof Blob) URL.revokeObjectURL(url);
            reject(new Error('could not load image'));
        };
        img.src = url;
    });
}

function toBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
    });
}

function renderIcon(img, crop, size, backgroundColor = null) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (backgroundColor) {
        // maskable: full-bleed background, content inside the safe zone
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, size, size);
        const pad = size * (1 - SAFE_ZONE) / 2;
        ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size,
            pad, pad, size * SAFE_ZONE, size * SAFE_ZONE);
    } else {
        ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
    }
    return canvas;
}

/**
 * Generate the complete icon set from a loaded image.
 * @param {HTMLImageElement} img
 * @param {{x: number, y: number, size: number}} crop  in natural image pixels
 * @param {string} backgroundColor  full-bleed fill for the maskable variants
 * @returns {Promise<Object<string, Blob>>}  file name → PNG blob
 */
export async function generatePwaIcons(img, crop, backgroundColor) {
    return {
        'icon-192.png': await toBlob(renderIcon(img, crop, 192)),
        'icon-512.png': await toBlob(renderIcon(img, crop, 512)),
        'apple-touch-icon.png': await toBlob(renderIcon(img, crop, 180)),
        'maskable-192.png': await toBlob(renderIcon(img, crop, 192, backgroundColor)),
        'maskable-512.png': await toBlob(renderIcon(img, crop, 512, backgroundColor)),
    };
}

export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Store a generated set on the server.
 * @param {string} siteName
 * @param {Object<string, Blob>} blobs        generated icons
 * @param {File|Blob|null} sourceFile         original upload (for regeneration)
 * @param {{crop: object, backgroundColor: string}} meta
 */
export async function uploadPwaIcons(siteName, blobs, sourceFile, meta) {
    const icons = {};
    for (const [name, blob] of Object.entries(blobs)) {
        icons[name] = await blobToBase64(blob);
    }
    const body = {icons, meta};
    if (sourceFile) {
        body.source = {
            name: sourceFile.name || 'source.png',
            data: await blobToBase64(sourceFile),
        };
    }
    const res = await fetch(`/api/sites/${encodeURIComponent(siteName)}/pwa-icons`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `upload failed (${res.status})`);
    }
}

/** The theme's primary background — default for the maskable fill. */
export function themeBackgroundColor() {
    const probe = document.createElement('div');
    probe.style.color = 'var(--primary-background-color, #1b1b1b)';
    (window.feezal && feezal.site ? feezal.site : document.body).append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#1b1b1b';
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}
