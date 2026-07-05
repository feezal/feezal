import {describe, it, expect} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const topicMatch = require('../src/topic-match.js');

describe('topicMatch', () => {
    describe('exact matches', () => {
        it('returns [] when topic equals wildcard exactly', () => {
            expect(topicMatch('a/b/c', 'a/b/c')).toEqual([]);
        });
    });

    describe('# wildcard', () => {
        it('matches any topic when wildcard is #', () => {
            expect(topicMatch('a/b/c', '#')).toEqual(['a/b/c']);
        });

        it('matches trailing # with remaining segments', () => {
            expect(topicMatch('a/b/c/d', 'a/b/#')).toEqual(['c/d']);
        });

        it('matches # directly after separator with single segment', () => {
            expect(topicMatch('a/b', 'a/#')).toEqual(['b']);
        });

        it('matches # when topic equals the prefix (zero remaining segments)', () => {
            expect(topicMatch('a', 'a/#')).toEqual([]);
        });
    });

    describe('+ wildcard', () => {
        it('captures a single segment for +', () => {
            expect(topicMatch('a/foo/c', 'a/+/c')).toEqual(['foo']);
        });

        it('captures multiple + wildcards', () => {
            expect(topicMatch('a/foo/bar', 'a/+/+')).toEqual(['foo', 'bar']);
        });

        it('+ does not match across segments', () => {
            expect(topicMatch('a/b/c', 'a/+')).toBeNull();
        });
    });

    describe('no match', () => {
        it('returns null when topics diverge', () => {
            expect(topicMatch('a/b/c', 'a/x/c')).toBeNull();
        });

        it('returns null when wildcard is longer than topic', () => {
            expect(topicMatch('a/b', 'a/b/c')).toBeNull();
        });

        it('returns null when topic is longer than wildcard', () => {
            expect(topicMatch('a/b/c', 'a/b')).toBeNull();
        });
    });

    describe('mixed # and +', () => {
        it('captures + segment then remaining via #', () => {
            expect(topicMatch('x/foo/bar/baz', 'x/+/#')).toEqual(['foo', 'bar/baz']);
        });
    });
});
