'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * AI assistant config (U9). Global per server — stored as a single JSON file at
 * <dataDir>/ai/config.json (A14) so the API key never lives in any site's
 * site.html and is never committed to a site git repo. Never sent to the browser.
 */

function configPath(storage) {
    return storage && storage.dataDir ? path.join(storage.dataDir, 'ai', 'config.json') : null;
}

async function loadAiConfig(storage) {
    const p = configPath(storage);
    if (!p) return {};
    try {
        const raw = await fs.readFile(p, 'utf8');
        const cfg = JSON.parse(raw);
        return cfg && typeof cfg === 'object' ? cfg : {};
    } catch {
        return {};
    }
}

async function saveAiConfig(storage, cfg) {
    const p = configPath(storage);
    if (!p) throw new Error('No dataDir configured');
    await fs.mkdir(path.dirname(p), {recursive: true});
    await fs.writeFile(p, JSON.stringify(cfg, null, 2), 'utf8');
}

/**
 * Browser-safe projection of the config — NEVER includes the API key, only a
 * boolean flag that one is present. `configured` gates the toolbar button.
 */
function publicAiConfig(cfg) {
    const provider = cfg.provider || '';
    const configured = Boolean(
        provider && (provider === 'ollama' || cfg.apiKey || cfg.endpoint)
    );
    return {
        configured,
        provider,
        model:    cfg.model || '',
        endpoint: cfg.endpoint || '',
        hasKey:   Boolean(cfg.apiKey),
        // Agent tool-round cap (U26) — null means "use the built-in default".
        maxToolRounds: Number.isInteger(cfg.maxToolRounds) ? cfg.maxToolRounds : null,
        // Ollama context window (num_ctx) — null means "use the model default".
        numCtx: Number.isInteger(cfg.numCtx) ? cfg.numCtx : null,
    };
}

module.exports = {loadAiConfig, saveAiConfig, publicAiConfig};
