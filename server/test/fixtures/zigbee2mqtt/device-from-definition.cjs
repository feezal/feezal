// Prints a bridge/devices entry for a door lock from zigbee-herdsman-converters' own definition.
const zhc = require('zigbee-herdsman-converters');
const mod = require(require('path').join(require('path').dirname(require.resolve('zigbee-herdsman-converters')), 'devices/yale.js'));
const list = mod.definitions ?? mod.default ?? mod;
const raw = list.find(d => d.model === process.argv[2]);
const def = zhc.prepareDefinition(raw);
const dummy = {isDummyDevice: true, endpoints: [], getEndpoint: () => undefined};
const exposes = typeof def.exposes === 'function' ? def.exposes(dummy, {}) : def.exposes;
const entry = {
    date_code: '', disabled: false, interview_completed: true, interviewing: false, supported: true,
    definition: {description: def.description, exposes: JSON.parse(JSON.stringify(exposes)), model: def.model, options: [], supports_ota: Boolean(def.ota), vendor: def.vendor},
    endpoints: {1: {bindings: [], clusters: {input: [], output: []}, configured_reportings: [], scenes: []}},
    friendly_name: process.argv[4], ieee_address: process.argv[3], manufacturer: 'Yale', model_id: raw.zigbeeModel?.[0] ?? def.model,
    network_address: 4711, power_source: 'Battery', software_build_id: undefined, type: 'EndDevice',
};
console.log(JSON.stringify(entry));
