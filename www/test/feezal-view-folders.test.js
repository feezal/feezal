/**
 * A37 — the U8 folder tree model.
 *
 * `reconcileFolders` and `applyFolderDrop` were already covered through the
 * component (see feezal-app-editor.test.js, now re-pointed here). These are the
 * helpers that were only reachable by driving the tab bar, so they had no
 * direct tests at all — extracting them is what made this possible.
 */
import {describe, it, expect} from 'vitest';
import {
    folderViewCount, folderContainsView, locateNode, detachNode, findFolder,
    collectFolders, maxFolderDepth, folderNameExists, findViewParent,
    renameViewInTree, tabItems, cloneTree, MAX_FOLDER_DEPTH,
} from '../src/feezal-view-folders.js';

/** rooms[ upstairs[ bath ], kitchen ], home */
const TREE = () => ([
    {
        id: 'f1', name: 'Rooms', children: [
            {id: 'f2', name: 'Upstairs', children: [{view: 'bath'}]},
            {view: 'kitchen'},
        ],
    },
    {view: 'home'},
]);

describe('tree queries', () => {
    it('counts views recursively, not just direct children', () => {
        const [rooms] = TREE();
        expect(folderViewCount(rooms)).toBe(2);          // kitchen + bath
        expect(folderViewCount(rooms.children[0])).toBe(1);
    });

    it('finds a view nested at any depth', () => {
        const [rooms] = TREE();
        expect(folderContainsView(rooms, 'bath')).toBe(true);     // two levels down
        expect(folderContainsView(rooms, 'kitchen')).toBe(true);
        expect(folderContainsView(rooms, 'home')).toBe(false);    // sibling, not inside
        expect(folderContainsView(rooms, undefined)).toBe(false);
    });

    it('locates a node with its array and index, so callers can splice', () => {
        const tree = TREE();
        const loc = locateNode(tree, n => n.view === 'bath');
        expect(loc.idx).toBe(0);
        expect(loc.arr).toBe(tree[0].children[0].children);
        expect(locateNode(tree, n => n.view === 'nope')).toBeNull();
    });

    it('detaches a nested node and removes it from the tree', () => {
        const tree = TREE();
        expect(detachNode(tree, n => n.view === 'bath')).toEqual({view: 'bath'});
        expect(folderContainsView(tree[0], 'bath')).toBe(false);
        expect(detachNode(tree, n => n.view === 'bath')).toBeNull();   // already gone
    });

    it('finds folders by id, never mistaking a view node for one', () => {
        const tree = TREE();
        expect(findFolder(tree, 'f2').name).toBe('Upstairs');
        expect(findFolder(tree, 'nope')).toBeNull();
    });

    it('collects folders flat, with depth, in document order', () => {
        expect(collectFolders(TREE())).toEqual([
            {id: 'f1', name: 'Rooms', depth: 0},
            {id: 'f2', name: 'Upstairs', depth: 1},
        ]);
    });

    it('reports the deepest folder nesting, ignoring view depth', () => {
        expect(maxFolderDepth(TREE())).toBe(2);
        expect(maxFolderDepth([{view: 'a'}, {view: 'b'}])).toBe(0);
        expect(MAX_FOLDER_DEPTH).toBe(3);
    });

    it('detects duplicate folder names, excluding the folder being renamed', () => {
        const tree = TREE();
        expect(folderNameExists(tree, 'Upstairs')).toBe(true);
        expect(folderNameExists(tree, 'Upstairs', 'f2')).toBe(false);   // renaming itself
        expect(folderNameExists(tree, 'Garden')).toBe(false);
    });

    it('reports the folder directly holding a view (null at top level)', () => {
        const tree = TREE();
        expect(findViewParent(tree, 'bath')).toBe('f2');
        expect(findViewParent(tree, 'kitchen')).toBe('f1');
        expect(findViewParent(tree, 'home')).toBeNull();     // top level
        expect(findViewParent(tree, 'nope')).toBeNull();
    });
});

describe('renameViewInTree', () => {
    it('renames in place, keeping the view nested where it was', () => {
        const tree = TREE();
        const next = renameViewInTree(tree, 'bath', 'bathroom');
        expect(findViewParent(next, 'bathroom')).toBe('f2');
        expect(findViewParent(next, 'bath')).toBeNull();
        // the input is not mutated — callers swap the returned tree in
        expect(findViewParent(tree, 'bath')).toBe('f2');
    });

    it('returns null when the view is not in the tree', () => {
        expect(renameViewInTree(TREE(), 'nope', 'x')).toBeNull();
    });
});

describe('tabItems', () => {
    it('maps the top level only, marking the folder holding the active view', () => {
        expect(tabItems(TREE(), 'bath')).toEqual([
            {type: 'folder', id: 'f1', name: 'Rooms', count: 2, containsActive: true},
            {type: 'view', name: 'home', depth: 0},
        ]);
    });

    it('marks no folder active when the active view sits at the top level', () => {
        const items = tabItems(TREE(), 'home');
        expect(items[0].containsActive).toBe(false);
    });
});

describe('cloneTree', () => {
    it('deep-copies, so mutating the copy cannot reach the original', () => {
        const tree = TREE();
        const copy = cloneTree(tree);
        copy[0].children[0].children.push({view: 'x'});
        expect(folderViewCount(tree[0])).toBe(2);
        expect(folderViewCount(copy[0])).toBe(3);
    });
});
