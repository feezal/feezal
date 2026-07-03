'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Server-side AI conversation store (U9 Phase 2). One JSON file per conversation
 * under <dataDir>/ai/conversations/<id>.json. IDs are client-generated (UUIDs).
 */

const ID_RE = /^[\w-]{1,64}$/;

function dir(storage) {
    return storage && storage.dataDir
        ? path.join(storage.dataDir, 'ai', 'conversations')
        : null;
}

async function listConversations(storage) {
    const d = dir(storage);
    if (!d) return [];
    let files;
    try { files = await fs.readdir(d); } catch { return []; }
    const out = [];
    for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
            const c = JSON.parse(await fs.readFile(path.join(d, f), 'utf8'));
            out.push({id: c.id, title: c.title || '', updatedAt: c.updatedAt || 0});
        } catch { /* skip corrupt */ }
    }
    out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return out;
}

async function getConversation(storage, id) {
    const d = dir(storage);
    if (!d || !ID_RE.test(id)) return null;
    try {
        return JSON.parse(await fs.readFile(path.join(d, id + '.json'), 'utf8'));
    } catch {
        return null;
    }
}

async function saveConversation(storage, {id, title, messages}) {
    const d = dir(storage);
    if (!d) throw new Error('No dataDir configured');
    if (!ID_RE.test(id || '')) throw new Error('invalid id');
    await fs.mkdir(d, {recursive: true});
    const conv = {
        id,
        title:     String(title || '').slice(0, 200),
        messages:  Array.isArray(messages) ? messages : [],
        updatedAt: Date.now(),
    };
    await fs.writeFile(path.join(d, id + '.json'), JSON.stringify(conv), 'utf8');
    return conv;
}

async function deleteConversation(storage, id) {
    const d = dir(storage);
    if (!d || !ID_RE.test(id)) return;
    try { await fs.unlink(path.join(d, id + '.json')); } catch { /* already gone */ }
}

module.exports = {listConversations, getConversation, saveConversation, deleteConversation};
