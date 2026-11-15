/**
 * E191 — native untis2mqtt recognizer. One `untis` entity per child, keyed by
 * the child's topic segment under `<prefix>/status/`; `all` and `school` are
 * not children; the prefix is fingerprinted on items only untis2mqtt
 * publishes. Children and prefixes here are invented.
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const nat = require('../src/mqtt/native-discovery.js');

const buf = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
const wrapped = val => ({val, ts: 1, lc: 1});
const untis = () => nat.getNativeEntities().filter(e => e.source === 'untis');
const byId = id => nat.getNativeEntities().find(e => e.discovery_id === id) || null;

beforeEach(() => {
    nat.clearNativeEntities();
});

describe('E191 — untis2mqtt children', () => {
    it('promotes one entity per child with its topic prefix and the {"val"} path', () => {
        nat.handleNativeMessage('untis/status/mia/today/timetable', buf(wrapped([])));
        nat.handleNativeMessage('untis/status/mia/next/start_planned', buf(wrapped('2030-03-04T08:00:00+01:00')));
        nat.handleNativeMessage('untis/status/student_4711/next_lesson', buf(wrapped(null)));

        expect(untis()).toHaveLength(2);
        const e = byId('untis:untis:mia');
        expect(e.component).toBe('untis');
        expect(e.sourceLabel).toBe('Untis');
        expect(e.name).toBe('mia');
        expect(e.config.base_topic).toBe('untis/status/mia');
        expect(e.config.value_template).toBe('{{ value_json.val }}');
        expect(e.config.availability_normalized).toEqual({
            entries: [{topic: 'untis/connected'}], mode: 'all', payloadAvailable: '2', payloadUnavailable: '0',
        });
        expect(byId('untis:untis:student_4711').config.base_topic).toBe('untis/status/student_4711');
    });

    it('learns a custom prefix and leaves bare payloads at `payload`', () => {
        nat.handleNativeMessage('schule/status/ben/week/next', buf('{"monday":"2030-03-04","days":[]}'));
        const e = byId('untis:schule:ben');
        expect(e.config.base_topic).toBe('schule/status/ben');
        expect(e.config.value_template).toBeUndefined();
        expect(e.config.availability_normalized.entries[0].topic).toBe('schule/connected');
    });

    it('never offers `all` or `school` as a child', () => {
        nat.handleNativeMessage('untis/status/all/next/start_planned', buf(wrapped('2030-03-04T08:00:00+01:00')));
        nat.handleNativeMessage('untis/status/school/time_grid', buf(wrapped([])));
        expect(untis()).toHaveLength(0);
    });

    it('ignores foreign trees that merely share generic item names', () => {
        nat.handleNativeMessage('house/status/kitchen/today/date', buf(wrapped('2030-03-04')));
        nat.handleNativeMessage('house/status/kitchen/now', buf(wrapped(1)));
        nat.handleNativeMessage('wiim/status/volume', buf(wrapped(20)));
        expect(untis()).toHaveLength(0);
    });

    it('counts a child once however many of its items arrive', () => {
        for (const item of ['today/timetable', 'tomorrow/timetable', 'next/end_planned', 'in_school',
            'homework/open', 'exams/next', 'absences/unexcused', 'messages/unread']) {
            nat.handleNativeMessage(`untis/status/mia/${item}`, buf(wrapped(0)));
        }
        expect(untis()).toHaveLength(1);
    });
});
