import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import '../src/feezal-site.js';
import '../src/feezal-view.js';

// N26 — view playlist / signage rotation.

function makeViews(...names) {
    return names.map(name => {
        const view = document.createElement('feezal-view');
        view.setAttribute('name', name);
        return view;
    });
}

function subscribedHandler(sub, topic) {
    const call = sub.mock.calls.find(c => c[0] === topic);
    return call && call[1];
}

/** Mount a viewer-mode site with playlist attributes. */
function makeSite(attributes = {}, views = ['home', 'kitchen', 'bath']) {
    feezal.isEditor = false;
    feezal.connection = {sub: vi.fn(), pub: vi.fn()};
    feezal.views = makeViews(...views);
    const site = document.createElement('feezal-site');
    Object.entries(attributes).forEach(([k, v]) => site.setAttribute(k, v));
    document.body.append(site);
    return site;
}

beforeEach(() => {
    location.hash = '';
    vi.useFakeTimers();
});

afterEach(() => {
    // Detach while timers are still fake so pending rotation timers die with them.
    document.body.innerHTML = '';
    vi.useRealTimers();
});

describe('_playlistEntries()', () => {
    it('parses names with optional per-entry dwell and filters unknown views', () => {
        const site = makeSite({playlist: ' home:30 , kitchen, ghost:5 , bath '});
        expect(site._playlistEntries()).toEqual([
            {name: 'home', dwell: 30},
            {name: 'kitchen', dwell: null},
            {name: 'bath', dwell: null}
        ]);
    });

    it('returns an empty list for an empty attribute', () => {
        const site = makeSite();
        expect(site._playlistEntries()).toEqual([]);
    });
});

describe('rotation', () => {
    it('rotates through the playlist with the default dwell and wraps', () => {
        const site = makeSite({'playlist-enabled': '', playlist: 'home,kitchen,bath', 'playlist-dwell': '2'});
        expect(site.view).toBe('home');
        vi.advanceTimersByTime(2000);
        expect(site.view).toBe('kitchen');
        vi.advanceTimersByTime(2000);
        expect(site.view).toBe('bath');
        vi.advanceTimersByTime(2000);
        expect(site.view).toBe('home'); // wrapped
    });

    it('honours per-entry dwell overrides', () => {
        const site = makeSite({'playlist-enabled': '', playlist: 'home:5,kitchen', 'playlist-dwell': '1'});
        vi.advanceTimersByTime(4999);
        expect(site.view).toBe('home');
        vi.advanceTimersByTime(1);
        expect(site.view).toBe('kitchen');
        vi.advanceTimersByTime(1000); // kitchen has no override → default dwell
        expect(site.view).toBe('home');
    });

    it('does not rotate when not enabled', () => {
        const site = makeSite({playlist: 'home,kitchen', 'playlist-dwell': '1'});
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
    });

    it('does not rotate with fewer than two existing playlist views', () => {
        const site = makeSite({'playlist-enabled': '', playlist: 'home,ghost', 'playlist-dwell': '1'});
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
    });

    it('starts from the current entry when the initial view is mid-playlist', () => {
        location.hash = '#/kitchen';
        const site = makeSite({'playlist-enabled': '', playlist: 'home,kitchen,bath', 'playlist-dwell': '1'});
        expect(site.view).toBe('kitchen');
        vi.advanceTimersByTime(1000);
        expect(site.view).toBe('bath');
    });

    it('adds the feezal-viewer class in the viewer (fade transition hook)', () => {
        const site = makeSite();
        expect(site.classList.contains('feezal-viewer')).toBe(true);
    });
});

describe('interaction pause + resume', () => {
    it('user activity pauses rotation; it resumes after the idle timeout', () => {
        const site = makeSite({
            'playlist-enabled': '', playlist: 'home,kitchen',
            'playlist-dwell': '2', 'playlist-resume': '10'
        });
        window.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(9999); // dwell long passed — still paused
        expect(site.view).toBe('home');
        vi.advanceTimersByTime(1); // resume timeout → advances immediately
        expect(site.view).toBe('kitchen');
    });

    it('repeated activity keeps postponing the resume', () => {
        const site = makeSite({
            'playlist-enabled': '', playlist: 'home,kitchen',
            'playlist-dwell': '1', 'playlist-resume': '10'
        });
        window.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(9000);
        window.dispatchEvent(new Event('keydown'));
        vi.advanceTimersByTime(9999);
        expect(site.view).toBe('home');
        vi.advanceTimersByTime(1);
        expect(site.view).toBe('kitchen');
    });

    it('a direct view control command pauses like user activity', async () => {
        const site = makeSite({
            subscribe: 'ctrl', 'playlist-enabled': '', playlist: 'home,kitchen,bath',
            'playlist-dwell': '2', 'playlist-resume': '30'
        });
        await site.updateComplete; // initial render flushed — as in reality before MQTT arrives
        subscribedHandler(feezal.connection.sub, 'ctrl/view')({payload: 'bath'});
        await site.updateComplete;
        vi.advanceTimersByTime(2000); // dwell — paused, no advance
        expect(site.view).toBe('bath');
        vi.advanceTimersByTime(28_000); // resume timeout reached → advances
        expect(site.view).toBe('home');
    });

    it('ignores activity when the playlist is not enabled', () => {
        const site = makeSite({playlist: 'home,kitchen', 'playlist-resume': '1'});
        window.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
    });
});

describe('<site>/playlist control topic', () => {
    function makeControlled() {
        return makeSite({
            subscribe: 'ctrl', 'playlist-enabled': '', playlist: 'home,kitchen,bath',
            'playlist-dwell': '2', 'playlist-resume': '10'
        });
    }

    it('subscribes the playlist control topic', () => {
        makeControlled();
        expect(feezal.connection.sub.mock.calls.map(c => c[0])).toContain('ctrl/playlist');
    });

    it('off stops rotation, on restarts it', () => {
        const site = makeControlled();
        const cmd = subscribedHandler(feezal.connection.sub, 'ctrl/playlist');
        cmd({payload: 'off'});
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
        cmd({payload: 'on'});
        vi.advanceTimersByTime(2000);
        expect(site.view).toBe('kitchen');
    });

    it('on also enables rotation for a site without playlist-enabled', () => {
        const site = makeSite({subscribe: 'ctrl', playlist: 'home,kitchen', 'playlist-dwell': '1'});
        subscribedHandler(feezal.connection.sub, 'ctrl/playlist')({payload: 'on'});
        vi.advanceTimersByTime(1000);
        expect(site.view).toBe('kitchen');
    });

    it('next and prev switch immediately, wrapping in both directions', () => {
        const site = makeControlled();
        const cmd = subscribedHandler(feezal.connection.sub, 'ctrl/playlist');
        cmd({payload: 'next'});
        expect(site.view).toBe('kitchen');
        cmd({payload: 'prev'});
        expect(site.view).toBe('home');
        cmd({payload: 'prev'});
        expect(site.view).toBe('bath'); // wrapped backwards
    });

    it('pause suspends rotation and auto-resumes after the idle timeout', () => {
        const site = makeControlled();
        const cmd = subscribedHandler(feezal.connection.sub, 'ctrl/playlist');
        cmd({payload: 'pause'});
        vi.advanceTimersByTime(9999);
        expect(site.view).toBe('home');
        vi.advanceTimersByTime(1);
        expect(site.view).toBe('kitchen');
    });

    it('ignores unknown payloads', () => {
        const site = makeControlled();
        subscribedHandler(feezal.connection.sub, 'ctrl/playlist')({payload: 'bogus'});
        vi.advanceTimersByTime(2000);
        expect(site.view).toBe('kitchen'); // normal rotation unaffected
    });
});

describe('editor', () => {
    it('never rotates and does not listen for activity in the editor', () => {
        feezal.isEditor = true;
        feezal.connection = {sub: vi.fn(), pub: vi.fn()};
        feezal.views = makeViews('home', 'kitchen');
        const site = document.createElement('feezal-site');
        site.setAttribute('subscribe', 'ctrl');
        site.setAttribute('playlist-enabled', '');
        site.setAttribute('playlist', 'home,kitchen');
        site.setAttribute('playlist-dwell', '1');
        document.body.append(site);
        expect(feezal.connection.sub).not.toHaveBeenCalled();
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
        expect(site.classList.contains('feezal-viewer')).toBe(false);
    });
});

describe('cleanup', () => {
    it('disconnecting clears timers and activity listeners', () => {
        const site = makeSite({'playlist-enabled': '', playlist: 'home,kitchen', 'playlist-dwell': '1'});
        site.remove();
        vi.advanceTimersByTime(60_000);
        expect(site.view).toBe('home');
        expect(site._playlistTimer).toBeNull();
        expect(site._playlistActivity).toBeNull();
    });
});
