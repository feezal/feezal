import {describe, it, expect} from 'vitest';

import {parseTime, formatTime} from '../packages/@feezal/feezal-element-material-time-picker/feezal-element-material-time-picker.js';

// E25 payload contract: subscribe accepts "HH:MM", "HH:MM:SS" or numeric
// seconds since midnight; publish emits the configured format.

describe('parseTime', () => {
    it('parses HH:MM and HH:MM:SS strings', () => {
        expect(parseTime('06:30')).toEqual({h: 6, m: 30, s: 0});
        expect(parseTime('23:59:58')).toEqual({h: 23, m: 59, s: 58});
        expect(parseTime('7:05')).toEqual({h: 7, m: 5, s: 0});
        expect(parseTime(' 08:00 ')).toEqual({h: 8, m: 0, s: 0});
    });

    it('parses seconds since midnight (number or numeric string), wrapping at 24h', () => {
        expect(parseTime(0)).toEqual({h: 0, m: 0, s: 0});
        expect(parseTime(23400)).toEqual({h: 6, m: 30, s: 0});
        expect(parseTime('86399')).toEqual({h: 23, m: 59, s: 59});
        expect(parseTime(86400 + 60)).toEqual({h: 0, m: 1, s: 0});   // wraps
    });

    it('rejects out-of-range and garbage values', () => {
        expect(parseTime('24:00')).toBeNull();
        expect(parseTime('12:60')).toBeNull();
        expect(parseTime('12:00:60')).toBeNull();
        expect(parseTime('noon')).toBeNull();
        expect(parseTime('')).toBeNull();
        expect(parseTime(null)).toBeNull();
        expect(parseTime(undefined)).toBeNull();
    });
});

describe('formatTime', () => {
    const t = {h: 6, m: 5, s: 9};

    it('formats HH:MM (default), zero-padded', () => {
        expect(formatTime(t, 'HH:MM')).toBe('06:05');
        expect(formatTime(t, undefined)).toBe('06:05');
    });

    it('formats HH:MM:SS', () => {
        expect(formatTime(t, 'HH:MM:SS')).toBe('06:05:09');
    });

    it('formats seconds since midnight as a number', () => {
        expect(formatTime(t, 'seconds')).toBe(6 * 3600 + 5 * 60 + 9);
        expect(formatTime({h: 0, m: 0, s: 0}, 'seconds')).toBe(0);
    });

    it('round-trips through parseTime', () => {
        for (const fmt of ['HH:MM:SS', 'seconds']) {
            expect(parseTime(formatTime(t, fmt))).toEqual(t);
        }
        expect(parseTime(formatTime(t, 'HH:MM'))).toEqual({h: 6, m: 5, s: 0});
    });
});
