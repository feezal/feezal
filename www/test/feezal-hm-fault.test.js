/**
 * E135 — Homematic fault / sabotage decoding: family-keyed classic enums,
 * HmIP named flags, and the two sabotage encodings.
 */
import {describe, it, expect} from 'vitest';
import {
    decodeHmFault, isHmSabotageValue, hmipFlagText, isSabotageActive, HM_HEALTH_DATAPOINTS,
} from '../packages/@feezal/feezal-element/feezal-hm-fault.js';

describe('decodeHmFault — classic enums (family-keyed)', () => {
    it('decodes the TRV FAULT_REPORTING enum', () => {
        expect(decodeHmFault('HM-CC-RT-DN', 4)).toBe('Communication error');
        expect(decodeHmFault('HM-CC-RT-DN', 7)).toBe('Valve mounting error');
        expect(decodeHmFault('HM-CC-RT-DN', 0)).toBe('');
        expect(decodeHmFault('HM-CC-RT-DN', '2')).toBe('Adjusting range too large');
    });
    it('decodes the Keymatic ERROR enum', () => {
        expect(decodeHmFault('HM-Sec-Key', 1)).toBe('Clutch failure');
        expect(decodeHmFault('HM-Sec-Key', 2)).toBe('Motor aborted');
    });
    it('the SAME number means different things per family (7)', () => {
        expect(decodeHmFault('HM-CC-RT-DN', 7)).toBe('Valve mounting error');
        expect(decodeHmFault('HM-Sec-SC', 7)).toBe('Sabotage');
    });
    it('falls back to a raw code for an unknown family', () => {
        expect(decodeHmFault('SOME-UNKNOWN', 3)).toBe('Fault 3');
        expect(decodeHmFault('SOME-UNKNOWN', 0)).toBe('');
        expect(decodeHmFault(undefined, '')).toBe('');
    });
    it('decodes a bare HmIP flag name', () => {
        expect(decodeHmFault('anything', 'ERROR_JAMMED')).toBe('Jammed');
    });
});

describe('sabotage encodings', () => {
    it('isHmSabotageValue: 7 is sabotage on a contact, not on a TRV', () => {
        expect(isHmSabotageValue('HM-Sec-SC', 7)).toBe(true);
        expect(isHmSabotageValue('HM-CC-RT-DN', 7)).toBe(false);
    });
    it('isSabotageActive: HmIP bool vs classic error7', () => {
        expect(isSabotageActive(true, 'bool')).toBe(true);
        expect(isSabotageActive('false', 'bool')).toBe(false);
        expect(isSabotageActive(7, 'error7')).toBe(true);
        expect(isSabotageActive(1, 'error7')).toBe(false);
        expect(isSabotageActive(7, undefined, 'HM-Sec-SC')).toBe(true);
    });
});

describe('hmipFlagText + health datapoints', () => {
    it('maps known flags and humanizes unknown ones', () => {
        expect(hmipFlagText('ERROR_JAMMED')).toBe('Jammed');
        expect(hmipFlagText('ERROR_LOAD_TOO_LOW')).toBe('Load too low');
        expect(hmipFlagText('ERROR_SOMETHING_NEW')).toBe('something new');
    });
    it('the board wildcard set covers classic + HmIP + N31/E124', () => {
        expect(HM_HEALTH_DATAPOINTS.fault).toContain('FAULT_REPORTING');
        expect(HM_HEALTH_DATAPOINTS.fault).toContain('ERROR');
        expect(HM_HEALTH_DATAPOINTS.sabotage).toContain('SABOTAGE');
        expect(HM_HEALTH_DATAPOINTS.battery).toEqual(['LOWBAT', 'LOW_BAT']);
        expect(HM_HEALTH_DATAPOINTS.unreach).toEqual(['UNREACH']);
        expect(HM_HEALTH_DATAPOINTS.hmipFlags).toContain('ERROR_JAMMED');
    });
});
