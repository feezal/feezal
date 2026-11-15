'use strict';

/**
 * zigbee2mqtt native recognizer (E193) — the bridge's OWN device list.
 *
 * zigbee2mqtt publishes what it knows about its network, retained, whatever
 * else is configured:
 *
 *   <base>/bridge/devices   every device with its definition: `exposes`, the
 *                           list of what the device can do (docs: "Exposes")
 *   <base>/bridge/groups    the groups with their members and scenes
 *   <base>/bridge/info      version and configuration (is availability on?)
 *   <base>/bridge/state     {"state":"online"} — the bridge's availability
 *   <base>/<friendly name>  ONE JSON state object per device, a property per
 *                           expose; <base>/<friendly name>/set[/<property>]
 *                           takes the commands
 *
 * Home Assistant discovery: zigbee2mqtt ALSO announces its devices under
 * `homeassistant/` — but only when `homeassistant.enabled` is set, which is off
 * by default outside the Home Assistant add-on. Without this recognizer such an
 * installation offers no Zigbee device at all. With both, every function is
 * offered once (E192, discovery-merge.js): because one state topic carries all
 * the properties of a device, every entity promoted here states its `claims`
 * itself — by topic + property for a function that is one property of the
 * state object, by topic + component for a function that reads the whole
 * object (light, cover, climate, fan). The room a discovery copy suggests is
 * taken over as for every native entity.
 *
 * The exposes say more than the discovery does (no templates to interpret, the
 * ranges and values of read-only properties, a cover's `moving`, a thermostat's
 * valve), and nothing here depends on a version of zigbee2mqtt's templates.
 *
 * THE BASE TOPIC is not a setting. It is configurable in zigbee2mqtt
 * (`mqtt.base_topic`, may contain slashes) and several instances may share a
 * broker, so every `<anything>/bridge/devices` whose payload has the shape of
 * the device list (an array of objects with `ieee_address` and
 * `friendly_name`) is taken as an instance, with <anything> as its base.
 *
 * WHAT IS PROMOTED. Entities in the shape the discovery path produces — the
 * component and a config with Home Assistant's key names — so the elements'
 * discovery maps wire them as they wire the discovery copy:
 *
 *   light / switch / cover / climate / fan / lock    one entity per expose
 *   binary  → binary_sensor, or switch when it can be set
 *   numeric → sensor, or number when it can be set
 *   enum    → sensor, or select when it can be set   (`action` is left out)
 *   text    → sensor, or text when it can be set
 *   a group → light / switch / cover / lock over its members' abilities
 *   scenes  → scene (of a device endpoint or a group)
 *
 * An expose of category `config` or `diagnostic` keeps that as
 * `entity_category`, so the Generate wizard leaves it out and the picker still
 * offers it, exactly as for the discovery copy. Composite and list exposes,
 * the coordinator, unsupported, disabled and not yet interviewed devices are
 * not promoted.
 *
 * See native-discovery.js for the recognizer contract.
 */

const ACCESS_STATE = 1;
const ACCESS_SET = 2;

// expose name → Home Assistant device class (what routes a binary sensor to
// the contact / motion card and gives a value card its icon)
const BINARY_CLASS = {
    battery_low: 'battery', carbon_monoxide: 'carbon_monoxide', contact: 'door', gas: 'gas',
    moving: 'moving', occupancy: 'occupancy', presence: 'occupancy', smoke: 'smoke', tamper: 'tamper',
    vibration: 'vibration', water_leak: 'moisture', window_open: 'window',
};
const SENSOR_CLASS = {
    battery: 'battery', co2: 'carbon_dioxide', current: 'current', device_temperature: 'temperature',
    energy: 'energy', humidity: 'humidity', local_temperature: 'temperature', pm25: 'pm25', power: 'power',
    pressure: 'atmospheric_pressure', soil_moisture: 'moisture', temperature: 'temperature', voltage: 'voltage',
};
// housekeeping values zigbee2mqtt's discovery announces disabled
const DISABLED_BY_DEFAULT = new Set(['linkquality', 'power_outage_count', 'trigger_count', 'last_seen', 'effect']);

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const tpl = property => `{{ value_json.${property} }}`;
const path = property => `payload.${property}`;
const label = s => String(s).replace(/_/g, ' ');

/** Does the payload look like `bridge/devices`? */
function isDeviceList(value) {
    return Array.isArray(value) && value.length > 0
        && value.every(d => isObject(d) && typeof d.ieee_address === 'string' && typeof d.friendly_name === 'string');
}

function isGroupList(value) {
    return Array.isArray(value)
        && value.every(g => isObject(g) && g.id !== undefined && typeof g.friendly_name === 'string' && Array.isArray(g.members));
}

function sensorClass(expose) {
    if (expose.name === 'illuminance') return expose.unit === 'lx' ? 'illuminance' : undefined;
    if (expose.name === 'voc') {
        return /g\/m/.test(expose.unit || '') ? 'volatile_organic_compounds' : 'volatile_organic_compounds_parts';
    }
    return SENSOR_CLASS[expose.name];
}

/** The entities of one zigbee2mqtt instance. */
function buildEntities(inst) {
    const {base} = inst;
    const info = isObject(inst.info) ? inst.info : {};
    const settings = isObject(info.config) ? info.config : {};
    // zigbee2mqtt 1.x could still publish plain online/offline
    const plainAvailability = settings.advanced?.legacy_availability_payload === true;
    const availabilityOn = settings.availability?.enabled === true || (isObject(settings.availability)
        && settings.availability.enabled === undefined && Object.keys(settings.availability).length > 0);

    const out = [];

    /** availability_normalized of the entity of a device or group named `name` */
    const availability = (name, id) => {
        const entry = topic => (plainAvailability ? {topic} : {topic, property: 'payload.state'});
        const entries = [entry(`${base}/bridge/state`)];
        const own = settings.devices?.[id]?.availability ?? settings.groups?.[id]?.availability;
        if (own !== false && (availabilityOn || (own !== undefined && own !== null))) {
            entries.push(entry(`${base}/${name}/availability`));
        }
        return {entries, mode: 'all'};
    };

    const push = ({owner, key, component, name, config, claims}) => {
        out.push({
            discovery_id: `z2m:${base}:${owner.key}:${key}`,
            component,
            source: 'zigbee2mqtt',
            sourceLabel: 'Zigbee2MQTT',
            name,
            config: {
                ...config,
                device: owner.device,
                availability_normalized: availability(owner.name, owner.id),
            },
            claims,
        });
    };

    // ── devices ──────────────────────────────────────────────────────────────
    /** ieee → {exposes by endpoint id} for the groups below */
    const byIeee = new Map();

    for (const d of inst.devices || []) {
        const def = d.definition;
        if (d.type === 'Coordinator' || !isObject(def) || !Array.isArray(def.exposes)) continue;
        if (d.supported === false || d.disabled === true || d.interview_completed === false) continue;

        const name = d.friendly_name;
        const stateTopic = `${base}/${name}`;
        const owner = {
            key: d.ieee_address,
            id: d.ieee_address,
            name,
            device: {
                identifiers: [`zigbee2mqtt_${d.ieee_address}`],
                name,
                ...(def.vendor ? {manufacturer: def.vendor} : {}),
                ...(def.description ? {model: def.description} : {}),
                ...(def.model ? {model_id: def.model} : {}),
            },
        };
        byIeee.set(d.ieee_address, d);

        const top = def.exposes.filter(isObject);
        const find = n => top.find(e => e.name === n && typeof e.property === 'string');

        // E124: the low-battery record the contact / sensor / climate cards read —
        // the boolean when the device has one, else the percentage.
        const batteryLow = find('battery_low');
        const battery = find('battery');
        const batteryRecord = batteryLow
            ? {topic: stateTopic, property: path(batteryLow.property), payloadLow: batteryLow.value_on ?? true}
            : battery ? {topic: stateTopic, property: path(battery.property)} : null;

        for (const expose of top) {
            const ep = typeof expose.endpoint === 'string' && expose.endpoint ? expose.endpoint : null;
            const suffix = ep ? `_${ep}` : '';
            const epName = ep ? `${name} ${ep}` : name;
            const setTopic = ep ? `${stateTopic}/${ep}/set` : `${stateTopic}/set`;
            const features = Array.isArray(expose.features) ? expose.features.filter(isObject) : [];
            const feature = n => features.find(f => f.name === n && typeof f.property === 'string');

            switch (expose.type) {
                case 'switch': {
                    const state = feature('state');
                    if (!state) break;
                    push({owner, key: `switch${suffix}`, component: 'switch', name: epName,
                        config: {
                            name: epName,
                            state_topic: stateTopic,
                            command_topic: setTopic,
                            value_template: tpl(state.property),
                            payload_on: state.value_on ?? 'ON',
                            payload_off: state.value_off ?? 'OFF',
                        },
                        claims: [{topic: stateTopic, property: path(state.property)}]});
                    break;
                }
                case 'light': {
                    // The light state object lives on its own topic when the
                    // light is one of several endpoints.
                    const lightTopic = ep ? `${stateTopic}/${ep}` : stateTopic;
                    const config = lightConfig(features, top);
                    if (!config) break;
                    push({owner, key: `light${suffix}`, component: 'light', name: epName,
                        config: {name: epName, ...config, state_topic: lightTopic, command_topic: setTopic},
                        claims: [{topic: lightTopic, component: 'light'}, {topic: setTopic, component: 'light'}]});
                    break;
                }
                case 'cover': {
                    const config = coverConfig(features, top, stateTopic, setTopic);
                    if (!config) break;
                    push({owner, key: `cover${suffix}`, component: 'cover', name: epName,
                        config: {name: epName, ...config},
                        claims: [{topic: stateTopic, component: 'cover'}, {topic: setTopic, component: 'cover'}]});
                    break;
                }
                case 'lock': {
                    const state = feature('state');
                    if (!state) break;
                    push({owner, key: `lock${suffix}`, component: 'lock', name: epName,
                        config: {
                            name: epName,
                            state_topic: stateTopic,
                            command_topic: setTopic,
                            value_template: tpl(state.property),
                            state_locked: state.value_on ?? 'LOCK',
                            state_unlocked: state.value_off ?? 'UNLOCK',
                            // zigbee2mqtt takes the plain words on …/set as the state
                            payload_lock: state.value_on ?? 'LOCK',
                            payload_unlock: state.value_off ?? 'UNLOCK',
                            ...(batteryRecord ? {battery_low_normalized: batteryRecord} : {}),
                        },
                        claims: [{topic: stateTopic, property: path(state.property)}, {topic: stateTopic, component: 'lock'}]});
                    break;
                }
                case 'climate': {
                    const config = climateConfig(features, stateTopic, ep);
                    if (!config) break;
                    if (batteryRecord) config.battery_low_normalized = batteryRecord;
                    push({owner, key: `climate${suffix}`, component: 'climate', name: epName,
                        config: {name: epName, ...config},
                        // the thermostat itself, and the values it shows that
                        // zigbee2mqtt also announces on their own
                        claims: [{topic: stateTopic, component: 'climate'},
                            ...['message_property_setpoint', 'message_property_actual', 'message_property_mode']
                                .filter(k => config[k]).map(k => ({topic: stateTopic, property: config[k]}))]});
                    // a setting of the thermostat that is not part of the card
                    for (const f of features.filter(x => x.name === 'local_temperature_calibration')) {
                        const generic = genericEntity(f, stateTopic);
                        if (generic) {
                            push({owner, key: f.property, component: generic.component, name: `${name} ${label(f.name)}`,
                                config: {name: `${name} ${label(f.name)}`, ...generic.config}, claims: generic.claims});
                        }
                    }
                    break;
                }
                case 'fan': {
                    const state = feature('state');
                    const mode = feature('mode');
                    if (!state) break;
                    const values = mode && Array.isArray(mode.values) ? mode.values.map(String) : [];
                    const presets = values.filter(v => !/^(off|on|low|medium|high|\d+)$/.test(v));
                    // numbered speeds ("1" … "9"): the raw range the fan card scales
                    const levels = values.filter(v => /^\d+$/.test(v)).map(Number).filter(n => n > 0);
                    push({owner, key: `fan${suffix}`, component: 'fan', name: epName,
                        config: {
                            name: epName,
                            state_topic: stateTopic,
                            state_value_template: tpl(state.property),
                            command_topic: `${stateTopic}/set/${state.property}`,
                            ...(mode ? {
                                preset_mode_state_topic: stateTopic,
                                preset_mode_value_template: tpl(mode.property),
                                preset_mode_command_topic: `${stateTopic}/set/${mode.property}`,
                                ...(presets.length ? {preset_modes: presets} : {}),
                                ...(levels.length ? {
                                    percentage_state_topic: stateTopic,
                                    percentage_value_template: tpl(mode.property),
                                    percentage_command_topic: `${stateTopic}/set/${mode.property}`,
                                    speed_range_min: Math.min(...levels),
                                    speed_range_max: Math.max(...levels),
                                } : {}),
                            } : {}),
                        },
                        claims: [{topic: stateTopic, component: 'fan'}]});
                    break;
                }
                case 'binary':
                case 'numeric':
                case 'enum':
                case 'text': {
                    // two exposes may name the same property (illuminance and
                    // illuminance_lux): one value, offered once — the classed one
                    const twin = top.find(e => e !== expose && e.property === expose.property && e.type === expose.type);
                    if (twin && (top.indexOf(twin) < top.indexOf(expose)
                        ? Boolean(sensorClass(twin)) || !sensorClass(expose)
                        : Boolean(sensorClass(twin)) && !sensorClass(expose))) break;
                    const generic = genericEntity(expose, stateTopic);
                    if (!generic) break;
                    const full = `${name} ${label(expose.name)}`;
                    if (generic.component === 'binary_sensor' && batteryRecord && expose.name !== 'battery_low') {
                        generic.config.battery_low_normalized = batteryRecord;
                    }
                    push({owner, key: expose.property, component: generic.component, name: full,
                        config: {name: full, ...generic.config},
                        claims: generic.claims});
                    break;
                }
                default:
                    break;      // composite, list, …: no single function to offer
            }
        }

        // scenes stored on the device's endpoints
        for (const [epId, epInfo] of Object.entries(isObject(d.endpoints) ? d.endpoints : {})) {
            for (const scene of Array.isArray(epInfo?.scenes) ? epInfo.scenes : []) {
                pushScene(push, owner, `${stateTopic}/set`, scene, `scene_${epId}_${scene.id}`);
            }
        }
    }

    // ── groups ───────────────────────────────────────────────────────────────
    for (const g of inst.groups || []) {
        const name = g.friendly_name;
        const stateTopic = `${base}/${name}`;
        const setTopic = `${stateTopic}/set`;
        const owner = {
            key: `group:${g.id}`,
            id: g.id,
            name,
            device: {
                // as zigbee2mqtt builds it: the base topic's character codes
                identifiers: [`zigbee2mqtt_${[...base].map(c => c.charCodeAt(0)).join('')}_${g.id}`],
                name,
                manufacturer: 'Zigbee2MQTT',
                model: 'Group',
            },
        };

        // what the members can do, per kind (a group is what its members share)
        const members = {light: [], switch: [], cover: [], lock: []};
        for (const m of g.members) {
            const d = byIeee.get(m.ieee_address);
            if (!d) continue;
            const exposes = d.definition.exposes.filter(isObject);
            for (const kind of Object.keys(members)) {
                const hit = exposes.find(e => e.type === kind && Array.isArray(e.features));
                if (hit) members[kind].push({features: hit.features.filter(isObject), top: exposes});
            }
        }

        if (members.light.length) {
            const config = groupLightConfig(members.light);
            push({owner, key: 'light', component: 'light', name,
                config: {name, ...config, state_topic: stateTopic, command_topic: setTopic},
                claims: [{topic: stateTopic, component: 'light'}, {topic: setTopic, component: 'light'}]});
        }
        if (members.switch.length) {
            push({owner, key: 'switch', component: 'switch', name,
                config: {name, state_topic: stateTopic, command_topic: setTopic, value_template: tpl('state'),
                    payload_on: 'ON', payload_off: 'OFF'},
                claims: [{topic: stateTopic, property: 'payload.state'}]});
        }
        if (members.cover.length) {
            const m = members.cover[0];
            const config = coverConfig(stripEndpoint(m.features), [], stateTopic, setTopic);
            if (config) {
                push({owner, key: 'cover', component: 'cover', name,
                    config: {name, ...config},
                    claims: [{topic: stateTopic, component: 'cover'}, {topic: setTopic, component: 'cover'}]});
            }
        }
        if (members.lock.length) {
            const state = members.lock[0].features.find(f => f.name === 'state');
            if (state && typeof state.property === 'string') {
                push({owner, key: 'lock', component: 'lock', name,
                    config: {name, state_topic: stateTopic, command_topic: setTopic, value_template: tpl(state.property),
                        state_locked: state.value_on ?? 'LOCK', state_unlocked: state.value_off ?? 'UNLOCK'},
                    claims: [{topic: stateTopic, property: path(state.property)}, {topic: stateTopic, component: 'lock'}]});
            }
        }
        for (const scene of Array.isArray(g.scenes) ? g.scenes : []) {
            pushScene(push, owner, setTopic, scene, `scene_${scene.id}`);
        }
    }

    return out;
}

function pushScene(push, owner, setTopic, scene, key) {
    if (!isObject(scene) || scene.id === undefined) return;
    const name = `${owner.name} ${scene.name || `Scene ${scene.id}`}`;
    push({owner, key, component: 'scene', name,
        config: {name, command_topic: setTopic, payload_on: `{ "scene_recall": ${scene.id} }`},
        claims: [{topic: setTopic, component: 'scene'}]});
}

/** group members report without the endpoint suffix: `state_l1` → `state` */
function stripEndpoint(features) {
    return features.map(f => ({...f, property: f.name}));
}

// ── the specific exposes ─────────────────────────────────────────────────────

/** A light's abilities as the JSON-schema light the elements know. */
function lightConfig(features, top) {
    const has = n => features.some(f => f.name === n);
    if (!has('state')) return null;
    const brightness = features.find(f => f.name === 'brightness');
    const colorTemp = features.find(f => f.name === 'color_temp');
    const modes = [];
    if (has('color_xy')) modes.push('xy');
    if (has('color_hs') && !has('color_xy')) modes.push('hs');
    if (colorTemp) modes.push('color_temp');
    if (!modes.length) modes.push(brightness ? 'brightness' : 'onoff');
    const effect = top.find(e => e.type === 'enum' && e.name === 'effect' && Array.isArray(e.values));
    return {
        schema: 'json',
        ...(brightness ? {brightness: true, brightness_scale: brightness.value_max ?? 254} : {}),
        supported_color_modes: modes,
        ...(colorTemp && colorTemp.value_min !== undefined ? {min_mireds: colorTemp.value_min} : {}),
        ...(colorTemp && colorTemp.value_max !== undefined ? {max_mireds: colorTemp.value_max} : {}),
        ...(effect ? {effect: true, effect_list: effect.values} : {}),
    };
}

/** A light group: what all members can do, the mired range they share. */
function groupLightConfig(members) {
    const configs = members.map(m => lightConfig(m.features, m.top)).filter(Boolean);
    const modes = [...new Set(configs.flatMap(c => c.supported_color_modes))];
    // a colour mode next to plain brightness / onoff: the richer one names the group
    const colour = modes.filter(m => m !== 'brightness' && m !== 'onoff');
    const anyBrightness = configs.some(c => c.brightness);
    const mins = configs.map(c => c.min_mireds).filter(v => v !== undefined);
    const maxs = configs.map(c => c.max_mireds).filter(v => v !== undefined);
    const effects = [...new Set(configs.flatMap(c => c.effect_list || []))];
    return {
        schema: 'json',
        ...(anyBrightness ? {brightness: true, brightness_scale: Math.max(...configs.map(c => c.brightness_scale || 0))} : {}),
        supported_color_modes: colour.length ? colour : [anyBrightness ? 'brightness' : 'onoff'],
        ...(mins.length ? {min_mireds: Math.max(...mins)} : {}),
        ...(maxs.length ? {max_mireds: Math.min(...maxs)} : {}),
        ...(effects.length ? {effect: true, effect_list: effects} : {}),
    };
}

function coverConfig(features, top, stateTopic, setTopic) {
    const state = features.find(f => f.name === 'state');
    const position = features.find(f => f.name === 'position');
    const tilt = features.find(f => f.name === 'tilt');
    if (!state && !position) return null;
    // `moving` says UP / DOWN / STOP in the words the cover card's direction
    // indicator reads by default — what the discovery folds into a template.
    const moving = top.find(e => e.type === 'enum' && e.name === 'moving' && (e.access & ACCESS_STATE)
        && Array.isArray(e.values) && e.values.includes('UP') && e.values.includes('DOWN'));
    return {
        state_topic: stateTopic,
        command_topic: setTopic,
        state_open: 'OPEN',
        state_closed: 'CLOSE',
        state_stopped: 'STOP',
        ...(position ? {
            position_topic: stateTopic,
            position_template: tpl(position.property),
            set_position_topic: setTopic,
            set_position_template: `{ "${position.property}": {{ position }} }`,
        } : {}),
        ...(tilt ? {
            tilt_status_topic: stateTopic,
            tilt_status_template: tpl(tilt.property),
            tilt_command_topic: `${setTopic}/tilt`,
        } : {}),
        ...(moving ? {direction_topic: stateTopic, message_property_direction: path(moving.property)} : {}),
    };
}

function climateConfig(features, stateTopic, ep) {
    const feature = n => features.find(f => f.name === n && typeof f.property === 'string');
    const setpoint = feature('occupied_heating_setpoint') || feature('current_heating_setpoint')
        || feature('occupied_cooling_setpoint');
    if (!setpoint) return null;
    const set = property => (ep ? `${stateTopic}/${ep}/set/${property}` : `${stateTopic}/set/${property}`);
    const actual = feature('local_temperature');
    const mode = feature('system_mode');
    // the valve opening in percent, where the thermostat reports one
    const valve = feature('pi_heating_demand') || feature('position') || feature('valve_position');
    const config = {
        temperature_state_topic: stateTopic,
        temperature_state_template: tpl(setpoint.property),
        message_property_setpoint: path(setpoint.property),
        temperature_command_topic: set(setpoint.property),
        temperature_unit: 'C',
        ...(setpoint.value_min !== undefined ? {min_temp: String(setpoint.value_min)} : {}),
        ...(setpoint.value_max !== undefined ? {max_temp: String(setpoint.value_max)} : {}),
        ...(setpoint.value_step !== undefined ? {temp_step: setpoint.value_step} : {}),
    };
    if (actual) {
        config.current_temperature_topic = stateTopic;
        config.current_temperature_template = tpl(actual.property);
        config.message_property_actual = path(actual.property);
    }
    if (mode) {
        config.mode_state_topic = stateTopic;
        config.mode_state_template = tpl(mode.property);
        config.message_property_mode = path(mode.property);
        if (mode.access & ACCESS_SET) config.mode_command_topic = set(mode.property);
        if (Array.isArray(mode.values)) config.modes = mode.values.filter(v => v !== 'sleep');
    }
    if (valve && valve.unit === '%') {
        config.action_topic = stateTopic;
        config.message_property_valve = path(valve.property);
        config.valve_min = valve.value_min ?? 0;
        config.valve_max = valve.value_max ?? 100;
    }
    return config;
}

// ── the generic exposes ──────────────────────────────────────────────────────

function genericEntity(expose, stateTopic) {
    const {type, name, property} = expose;
    const access = Number(expose.access) || 0;
    if (typeof property !== 'string' || !property || name === 'action') return null;
    const readable = Boolean(access & ACCESS_STATE);
    const settable = Boolean(access & ACCESS_SET);
    // write-only: only a choice (an effect, "identify") is something to offer
    if (!readable && !(settable && type === 'enum')) return null;
    // an expose of an endpoint is set under that endpoint, as zigbee2mqtt announces it
    const ep = typeof expose.endpoint === 'string' && expose.endpoint ? `/${expose.endpoint}` : '';
    const setTopic = `${stateTopic}${ep}/set/${property}`;
    // A generic expose that can be SET is a setting of the device (a relock
    // time, a threshold, an indicator) — its functions are the specific
    // exposes. zigbee2mqtt's discovery marks the ones in its own table as
    // `config`; the exposes carry a category only sometimes.
    const category = expose.category === 'config' || expose.category === 'diagnostic'
        ? expose.category : (settable ? 'config' : null);
    const base = {
        ...(readable ? {state_topic: stateTopic, value_template: tpl(property)} : {}),
        ...(category ? {entity_category: category} : {}),
        ...(DISABLED_BY_DEFAULT.has(name) ? {enabled_by_default: false} : {}),
        ...(expose.description ? {description: expose.description} : {}),
    };
    const claims = readable ? [{topic: stateTopic, property: path(property)}] : [];
    if (settable) claims.push({topic: setTopic});

    if (type === 'binary') {
        const on = expose.value_on ?? true;
        const off = expose.value_off ?? false;
        if (settable) {
            // a boolean is written as the words true / false
            const word = v => (typeof v === 'boolean' ? String(v) : v);
            return {component: 'switch', claims,
                config: {...base, command_topic: setTopic, payload_on: word(on), payload_off: word(off)}};
        }
        const cls = BINARY_CLASS[name];
        return {component: 'binary_sensor', claims,
            config: {...base, payload_on: on, payload_off: off, ...(cls ? {device_class: cls} : {})}};
    }
    if (type === 'numeric') {
        const unit = expose.unit ? {unit_of_measurement: expose.unit} : {};
        const range = {
            ...(expose.value_min !== undefined ? {min: expose.value_min} : {}),
            ...(expose.value_max !== undefined ? {max: expose.value_max} : {}),
            ...(expose.value_step !== undefined ? {step: expose.value_step} : {}),
        };
        if (settable) return {component: 'number', claims, config: {...base, command_topic: setTopic, ...range, ...unit}};
        const cls = sensorClass(expose);
        return {component: 'sensor', claims, config: {...base, ...unit, ...range, ...(cls ? {device_class: cls} : {})}};
    }
    if (type === 'enum') {
        const options = Array.isArray(expose.values) ? {options: expose.values} : {};
        // one value that can only be sent is a button
        if (!readable && options.options?.length === 1) {
            return {component: 'button', claims,
                config: {...base, command_topic: setTopic, payload_press: options.options[0],
                    ...(name === 'identify' ? {device_class: 'identify'} : {})}};
        }
        if (settable) return {component: 'select', claims, config: {...base, command_topic: setTopic, ...options}};
        return {component: 'sensor', claims, config: {...base, ...options, ...(options.options ? {device_class: 'enum'} : {})}};
    }
    if (type === 'text') {
        if (settable) return {component: 'text', claims, config: {...base, command_topic: setTopic}};
        return {component: 'sensor', claims, config: base};
    }
    return null;
}

// ── the recognizer ───────────────────────────────────────────────────────────

const KINDS = {devices: isDeviceList, groups: isGroupList, info: isObject};

const zigbee2mqttRecognizer = {
    id: 'zigbee2mqtt',
    /** base topic → {base, devices, groups, info} */
    state: {instances: new Map()},

    match(topic) {
        const i = topic.lastIndexOf('/bridge/');
        if (i <= 0) return null;
        const kind = topic.slice(i + '/bridge/'.length);
        if (!Object.hasOwn(KINDS, kind)) return null;
        return {base: topic.slice(0, i), kind};
    },

    accumulate(state, parsed, value) {
        let inst = state.instances.get(parsed.base);
        if (!KINDS[parsed.kind](value)) {
            // An emptied retained topic of a known instance: forget that part.
            if (!inst || (value !== '' && !(Array.isArray(value) && value.length === 0))) return null;
            if (parsed.kind === 'devices') { state.instances.delete(parsed.base); return {base: parsed.base, gone: true, replacePrefix: `z2m:${parsed.base}:`}; }
            inst[parsed.kind] = parsed.kind === 'info' ? null : [];
            return inst;
        }
        // Only the device list makes an instance — `x/bridge/info` alone could be anything.
        if (!inst) {
            if (parsed.kind !== 'devices') {
                // keep it for when the device list arrives (the three are retained, in any order)
                // (bounded: `…/bridge/info` is not a rare topic name)
                const pending = state.pending || (state.pending = new Map());
                if (pending.size < 32 || pending.has(`${parsed.base}\n${parsed.kind}`)) {
                    pending.set(`${parsed.base}\n${parsed.kind}`, value);
                }
                return null;
            }
            inst = {base: parsed.base, devices: [], groups: [], info: null, replacePrefix: `z2m:${parsed.base}:`};
            for (const kind of ['groups', 'info']) {
                const kept = state.pending?.get(`${parsed.base}\n${kind}`);
                if (kept !== undefined) { inst[kind] = kept; state.pending.delete(`${parsed.base}\n${kind}`); }
            }
            state.instances.set(parsed.base, inst);
        }
        inst[parsed.kind] = value;
        return inst;
    },

    promote(inst) {
        return inst.gone ? [] : buildEntities(inst);
    },

    reset() { this.state.instances.clear(); this.state.pending?.clear(); },
};

module.exports = {zigbee2mqttRecognizer, buildEntities};
