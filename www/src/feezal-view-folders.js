// SPDX-License-Identifier: MIT
// Copyright (c) 2019-2026 Sebastian Raff — feezal editor
/**
 * A37 — the U8 view-folder tree model.
 *
 * Pure functions over the tree that `feezal-app-editor` renders as the view tab
 * bar and persists in `viewer.json`. The tree is an ordered array of nodes:
 *
 *   {view: 'kitchen'}                        a view reference
 *   {id: 'f1', name: 'Rooms', children: []}  a folder (nesting capped at 3)
 *
 * Extracted from the component because none of it needs the component: it is
 * array-in / array-out, which also makes it directly unit-testable instead of
 * only reachable by driving the tab bar.
 */

/** Folder nesting limit. Deeper folders are flattened into their parent. */
export const MAX_FOLDER_DEPTH = 3;

export const cloneTree = tree => JSON.parse(JSON.stringify(tree));

/**
 * Reconcile a stored tree against the views that actually exist:
 *  - drop dangling view refs (view no longer exists) and duplicates,
 *  - drop malformed nodes,
 *  - cap folder nesting (deeper folders are lifted into the parent),
 *  - append any unreferenced views at the top level, in document order.
 *
 * @param {Array}    tree      the stored (untrusted) tree
 * @param {string[]} viewNames names of the views that currently exist, in order
 */
export function reconcileFolders(tree, viewNames = []) {
    const seen = new Set();
    const usedIds = new Set();
    let folderSeq = 0;

    const walk = (nodes, depth) => {
        const out = [];
        if (!Array.isArray(nodes)) return out;
        for (const node of nodes) {
            if (node && typeof node === 'object' && typeof node.view === 'string') {
                if (viewNames.includes(node.view) && !seen.has(node.view)) {
                    seen.add(node.view);
                    out.push({view: node.view});
                }
            } else if (node && typeof node === 'object' && Array.isArray(node.children)) {
                if (depth > MAX_FOLDER_DEPTH) {
                    // Too deeply nested — lift this folder's contents into the parent.
                    out.push(...walk(node.children, depth));
                    continue;
                }
                let id = (typeof node.id === 'string' && node.id) ? node.id : 'f' + (++folderSeq);
                while (usedIds.has(id)) id = 'f' + (++folderSeq);
                usedIds.add(id);
                const name = (typeof node.name === 'string' && node.name.trim()) ? node.name : 'Folder';
                out.push({id, name, children: walk(node.children, depth + 1)});
            }
            // anything else: ignored (malformed)
        }
        return out;
    };

    const result = walk(tree, 1);
    for (const name of viewNames) {
        if (name && !seen.has(name)) {
            seen.add(name);
            result.push({view: name});
        }
    }
    return result;
}

/** How many views live anywhere inside this folder. */
export function folderViewCount(node) {
    let c = 0;
    for (const ch of node.children) {
        if (ch.view !== undefined) c++;
        else c += folderViewCount(ch);
    }
    return c;
}

/** True when the named view lives anywhere inside this folder (recursively). */
export function folderContainsView(node, name) {
    if (!name) return false;
    for (const ch of node.children) {
        if (ch.view === name) return true;
        if (ch.children && folderContainsView(ch, name)) return true;
    }
    return false;
}

/** Recursively locate the array + index of the first node matching pred. */
export function locateNode(nodes, pred) {
    for (let i = 0; i < nodes.length; i++) {
        if (pred(nodes[i])) return {arr: nodes, idx: i};
        if (nodes[i].children) {
            const r = locateNode(nodes[i].children, pred);
            if (r) return r;
        }
    }
    return null;
}

/** Remove and return the first node matching pred (mutates nodes). */
export function detachNode(nodes, pred) {
    for (let i = 0; i < nodes.length; i++) {
        if (pred(nodes[i])) return nodes.splice(i, 1)[0];
        if (nodes[i].children) {
            const r = detachNode(nodes[i].children, pred);
            if (r) return r;
        }
    }
    return null;
}

export function findFolder(nodes, id) {
    for (const n of nodes) {
        if (n.children) {
            if (n.id === id) return n;
            const r = findFolder(n.children, id);
            if (r) return r;
        }
    }
    return null;
}

/** Flat list of {id, name, depth} folders for the move menu / depth checks. */
export function collectFolders(nodes, depth = 0, acc = []) {
    for (const n of nodes) {
        if (n.children) {
            acc.push({id: n.id, name: n.name, depth});
            collectFolders(n.children, depth + 1, acc);
        }
    }
    return acc;
}

export function maxFolderDepth(nodes, depth = 1) {
    let max = 0;
    for (const n of nodes) {
        if (n.children) {
            max = Math.max(max, depth, maxFolderDepth(n.children, depth + 1));
        }
    }
    return max;
}

export function folderNameExists(nodes, name, exceptId) {
    return collectFolders(nodes).some(f => f.name === name && f.id !== exceptId);
}

/** Id of the folder directly containing the named view, or null for top level. */
export function findViewParent(nodes, name) {
    let parentId = null;
    const search = (list, parent) => {
        for (const n of list) {
            if (n.view === name) { parentId = parent; return true; }
            if (n.children && search(n.children, n.id)) return true;
        }
        return false;
    };
    search(nodes, null);
    return parentId;
}

/**
 * Rename a view inside the tree, keeping its placement.
 * @returns {Array|null} a NEW tree, or null when the view is not in the tree.
 */
export function renameViewInTree(tree, oldName, newName) {
    const next = cloneTree(tree);
    const node = locateNode(next, n => n.view === oldName);
    if (!node) return null;
    node.arr[node.idx] = {view: newName};
    return next;
}

/** Top-level tab-bar items (folders open a popup menu; no inline fold-out). */
export function tabItems(folders, activeView) {
    return folders.map(node => node.view !== undefined
        ? {type: 'view', name: node.view, depth: 0}
        : {
            type: 'folder', id: node.id, name: node.name,
            count: folderViewCount(node),
            containsActive: folderContainsView(node, activeView),
        });
}

/**
 * Move a dragged node onto a drop target.
 *
 * @param {Array}  tree     current tree (not mutated)
 * @param {object} drag     {kind:'view', name} | {kind:'folder', id}
 * @param {object} target   {kind:'view', name} | {kind:'folder', id} | {kind:'bar'}
 * @param {string} position 'before' | 'after' | 'into'
 * @returns {Array|null} a NEW tree, or null when the move is a no-op or invalid.
 *
 * Returns null (rather than a best-effort placement) for every unresolved case.
 * U55: the old `push(dragged)` fallback turned a lookup miss into a silent
 * "move to end", which is how a micro-drag onto an item's own tab reordered the
 * whole bar.
 */
export function applyFolderDrop(tree, drag, target, position) {
    if (!drag || !target) return null;

    // Dropping an item onto ITSELF is order-preserving by definition — bail
    // BEFORE detaching, or the detach-then-locate sequence cannot find the
    // just-detached target.
    const isSelf = drag.kind === target.kind
        && (drag.kind === 'view' ? target.name === drag.name : target.id === drag.id);
    if (isSelf) return null;

    const next = cloneTree(tree);
    const dragged = drag.kind === 'view'
        ? detachNode(next, n => n.view === drag.name)
        : detachNode(next, n => n.id === drag.id);
    if (!dragged) return null;

    if (target.kind === 'bar') {
        next.push(dragged);
    } else if (target.kind === 'folder' && position === 'into') {
        const folder = findFolder(next, target.id);
        // null when the folder was inside the dragged subtree — abort silently.
        if (!folder) return null;
        folder.children.push(dragged);
    } else {
        const pred = target.kind === 'folder'
            ? n => n.id === target.id
            : n => n.view === target.name;
        const loc = locateNode(next, pred);
        if (!loc) return null;
        loc.arr.splice(loc.idx + (position === 'after' ? 1 : 0), 0, dragged);
    }

    // Reject moves that would exceed the nesting limit.
    if (maxFolderDepth(next) > MAX_FOLDER_DEPTH) return null;
    return next;
}
