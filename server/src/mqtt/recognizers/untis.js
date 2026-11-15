'use strict';

/**
 * untis2mqtt native recognizer (E191).
 *
 * The bridge (github.com/hobbyquaker/untis2mqtt) publishes school timetables
 * from WebUntis in the mqtt-smarthome shape, topic prefix = `--name`
 * (default `untis`, configurable), one subtree per child:
 *
 *   <prefix>/status/<child>/<day>/{date,school,start,end,start_planned,
 *                                  end_planned,lessons,changes,timetable}
 *                                  <day> = today | tomorrow | next
 *   <prefix>/status/<child>/{in_school,now,next_lesson,last_update}
 *   <prefix>/status/<child>/week, …/week/next
 *   <prefix>/status/<child>/{homework,exams,absences,messages}(+ counters)
 *   <prefix>/status/all/<day>/…     household summary (several children)
 *   <prefix>/status/school/…        time grid, school year, holidays, news
 *   <prefix>/connected              0 | 1 | 2  (2 = WebUntis answers)
 *
 * Status payloads are `{"val":…,"ts":…,"lc":…}` by default; a
 * `--no-json-payloads` bridge sends bare values — detected from the message
 * shape, like the other mqtt-smarthome recognizers.
 *
 * Home Assistant discovery: untis2mqtt 0.3 announces NONE (its config sets
 * `publishesDiscovery: false`; discovery is planned for a later release), so
 * nothing is offered twice today. `untis` is a composite component HA
 * discovery cannot announce, so this entity claims no topics (no `claims`):
 * once the bridge announces its sensors (start, end, lessons…), those stay on
 * offer next to the untis child — the single values are useful on their own,
 * the same reasoning as for the media adapters.
 *
 * One `untis` entity per CHILD, named after the child's topic segment (a
 * nickname or `student_<id>` — untis2mqtt's own naming). The entity hands the
 * child's topic prefix to the untis elements (`subscribe`); the elements read
 * every item below it themselves. `all` and `school` are not children.
 *
 * Fingerprint: items only untis2mqtt publishes (`<day>/start_planned`,
 * `<day>/timetable`, `next_lesson`, `week/next`, the list counters) — a
 * foreign `x/status/y/today/date` tree is never picked up. Every `--publish`
 * group carries at least one of them.
 */

const NOT_CHILDREN = new Set(['all', 'school']);

const FINGERPRINT = /^(?:(?:today|tomorrow|next)\/(?:start_planned|end_planned|timetable)|next_lesson|in_school|week\/next|homework\/(?:open|due_tomorrow)|exams\/next|absences\/(?:count|unexcused)|messages\/unread)$/;

function untisAvail(prefix) {
    const topic = `${prefix}/connected`;
    return {entries: [{topic}], mode: 'all', payloadAvailable: '2', payloadUnavailable: '0'};
}

const untisRecognizer = {
    id: 'untis',
    // `<prefix>/<child>` → {prefix, child, json}
    state: {children: new Map()},

    match(topic) {
        const parts = topic.split('/');
        if (parts.length < 4 || parts[1] !== 'status') return null;
        const [prefix, , child] = parts;
        if (!prefix || !child || NOT_CHILDREN.has(child)) return null;
        const item = parts.slice(3).join('/');
        if (!FINGERPRINT.test(item)) return null;
        return {prefix, child};
    },

    accumulate(state, parsed, value, payload) {
        const key = `${parsed.prefix}/${parsed.child}`;
        const known = state.children.get(key) || {prefix: parsed.prefix, child: parsed.child, json: true};
        known.json = Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && 'val' in payload);
        state.children.set(key, known);
        return {key};
    },

    promote(channelState) {
        const c = this.state.children.get(channelState.key);
        return c ? this._entity(c) : null;
    },

    _entity({prefix, child, json}) {
        const config = {
            name: child,
            base_topic: `${prefix}/status/${child}`,
            availability_topic: `${prefix}/connected`,
            availability_normalized: untisAvail(prefix),
        };
        if (json) config.value_template = '{{ value_json.val }}';
        return {
            discovery_id: `untis:${prefix}:${child}`,
            component: 'untis',
            source: 'untis',
            sourceLabel: 'Untis',
            name: child,
            config,
        };
    },

    reset() { this.state.children.clear(); },
};

module.exports = {untisRecognizer};
