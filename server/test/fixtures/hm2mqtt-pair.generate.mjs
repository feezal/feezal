// Generates hm2mqtt-pair.json, the recorded pair of feezal's "every device once" test, from
// hm2mqtt's own code: the Home Assistant device configs hm2mqtt 3 announces, and the status
// messages (JSON payloads with the `hm` block) of the same devices. Not run by the tests; run it
// by hand against a checkout of hm2mqtt (with its dependencies installed) when hm2mqtt's
// discovery changes:
//   node hm2mqtt-pair.generate.mjs <hm2mqtt checkout> hm2mqtt-pair.json
// The devices are hm2mqtt's fixture CCU, one per type picked below; addresses, names and rooms
// are synthetic.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [, , hmDir, outFile] = process.argv;
const imp = (p) => import(pathToFileURL(path.join(hmDir, p)).href);
const {discoveryModel} = await imp('lib/hadiscovery.js');
const {Metadata} = await imp('lib/metadata.js');
const {ValueStore} = await imp('lib/values.js');
const core = await imp('node_modules/mqtt-interfaces-core/index.js');
const pkg = JSON.parse(fs.readFileSync(path.join(hmDir, 'package.json'), 'utf8'));

// device type → [synthetic address, name, room]
const PICK = {
    'BidCos-RF': {
        'HM-LC-Dim1TPBU-FM': ['TEQ0000001', 'Living Room Dimmer', 'Living Room'],
        'HM-LC-Bl1-FM': ['TEQ0000002', 'Living Room Blind', 'Living Room'],
        'HM-CC-RT-DN': ['TEQ0000003', 'Bedroom Radiator', 'Bedroom'],
        'HM-TC-IT-WM-W-EU': ['TEQ0000004', 'Bedroom Wall Thermostat', 'Bedroom'],
        'HM-Sec-SC-2': ['TEQ0000005', 'Kitchen Window', 'Kitchen'],
        'HM-LC-Sw1-Pl-2': ['TEQ0000006', 'Kitchen Plug', 'Kitchen'],
        'HM-ES-PMSw1-Pl': ['TEQ0000007', 'Office Metering Plug', 'Office'],
        'HM-Sec-Key': ['TEQ0000008', 'Front Door Lock', 'Hallway'],
        'HM-Sec-SD-2': ['TEQ0000009', 'Hallway Smoke Detector', 'Hallway'],
        'HM-WDS100-C6-O': ['TEQ0000010', 'Weather Station', 'Garden'],
        'HM-Sec-MDIR': ['TEQ0000011', 'Hallway Motion', 'Hallway'],
        'HM-RC-4-2': ['TEQ0000012', 'Remote', null],
    },
    'HmIP-RF': {
        'HmIP-SRH': ['0000AAAA000001', 'Bathroom Window Handle', 'Bathroom'],
        'HmIP-WTH-2': ['0000AAAA000002', 'Office Wall Thermostat', 'Office'],
        'HMIP-SWDO': ['0000AAAA000003', 'Office Window', 'Office'],
        'HmIP-BDT': ['0000AAAA000004', 'Dining Dimmer', 'Dining Room'],
        'HmIP-BSM': ['0000AAAA000005', 'Dining Switch', 'Dining Room'],
        'HmIP-eTRV-2': ['0000AAAA000006', 'Office Radiator', 'Office'],
        'HmIP-FBL': ['0000AAAA000007', 'Dining Blind', 'Dining Room'],
        'HMIP-PSM': ['0000AAAA000008', 'Bathroom Plug', 'Bathroom'],
    },
    VirtualDevices: {
        'HmIP-HEATING': ['INT0000001', 'Office Heating Group', 'Office'],
    },
};

const all = JSON.parse(fs.readFileSync(path.join(hmDir, 'test/fixtures/devices.json'), 'utf8'));
const names = {};
const rooms = {};
const devices = {};
for (const [iface, picks] of Object.entries(PICK)) {
    devices[iface] = {};
    for (const dev of Object.values(all[iface])) {
        if (dev.PARENT || !picks[dev.TYPE]) continue;
        const [addr, name, room] = picks[dev.TYPE];
        const re = (s) => String(s).split(dev.ADDRESS).join(addr);
        const keep = (d) => {
            // only what the discovery model and the value store read; nothing of the real CCU
            const o = {ADDRESS: re(d.ADDRESS), TYPE: d.TYPE};
            if (d.PARENT) { o.PARENT = re(d.PARENT); o.PARENT_TYPE = d.PARENT_TYPE; }
            if (d.CHILDREN) o.CHILDREN = d.CHILDREN.map(re);
            // the description key is derived from these
            for (const k of ['FIRMWARE', 'VERSION', 'PARAMSETS', 'DIRECTION', 'INDEX']) if (d[k] !== undefined) o[k] = d[k];
            return o;
        };
        devices[iface][addr] = keep(dev);
        names[addr] = name;
        if (room) rooms[addr] = [room];
        for (const child of dev.CHILDREN || []) {
            const ch = all[iface][child];
            if (!ch) continue;
            const k = keep(ch);
            devices[iface][k.ADDRESS] = k;
            names[k.ADDRESS] = `${name}:${k.ADDRESS.split(':')[1]}`;
            if (room) rooms[k.ADDRESS] = [room];
        }
    }
}

const log = core.createLogger({format: 'journal', level: 'error', write: () => {}});
const metadata = new Metadata({stateDir: '/nonexistent', seedFile: path.join(hmDir, 'test/fixtures/paramsets.json'), log});
metadata.load();
for (const [iface, list] of Object.entries(devices)) metadata.addDevices(iface, Object.values(list));

const channelName = (address) => names[address];
const values = new ValueStore({
    host: 'ccu.example',
    log,
    context: {
        device: (iface, address) => metadata.devices[iface] && metadata.devices[iface][address],
        valueDescription: (iface, address, dp) => metadata.valueDescription(iface, address, dp),
        channelName,
        rooms: (address) => rooms[address],
        functions: () => [],
    },
});
const st = (iface, address, dp) => `hm/status/${names[address] || address}/${dp}`;
const cmd = (iface, address, dp) => `hm/set/${names[address] || address}/${dp}`;

const blocks = discoveryModel({
    adapterName: pkg.name,
    name: 'hm',
    jsonPayloads: true,
    generic: true,
    area: true,
    devices: metadata.devices,
    description: (iface, address) => metadata.description(iface, address, 'VALUES'),
    channelName,
    rooms: (address) => rooms[address],
    statusTopicFor: st,
    setTopicFor: cmd,
    interfaces: Object.keys(PICK),
});

const discovery = blocks.map((b) => {
    const {topic, payload} = core.devicePayload({
        pkg: {name: pkg.name, version: pkg.version, homepage: pkg.homepage},
        name: 'hm',
        id: b.id,
        device: b.device,
        components: b.components,
        availability: b.availability,
        availabilityMode: b.availabilityMode,
    });
    return {topic, payload};
});

const sample = (dp, d) => {
    if (d.TYPE === 'BOOL') return false;
    if (d.TYPE === 'ENUM') return typeof d.DEFAULT === 'number' ? d.DEFAULT : 0;
    if (d.TYPE === 'STRING') return '';
    if (/SET_(POINT_)?TEMPERATURE/.test(dp)) return 21;
    if (/TEMPERATURE/.test(dp)) return 20.5;
    if (/HUMIDITY/.test(dp)) return 48;
    if (typeof d.DEFAULT === 'number') return d.DEFAULT;
    if (typeof d.MIN === 'number') return d.MIN;
    return 0;
};

const status = [];
for (const [iface, list] of Object.entries(metadata.devices)) {
    for (const ch of Object.values(list)) {
        if (!ch.PARENT) continue;
        const desc = metadata.description(iface, ch.ADDRESS, 'VALUES') || {};
        for (const [dp, d] of Object.entries(desc)) {
            if (!d || typeof d !== 'object' || d.TYPE === 'ACTION') continue;
            const ops = typeof d.OPERATIONS === 'number' ? d.OPERATIONS : 5;
            if (!(ops & 1) && !(ops & 4)) continue;
            const f = values.fields(iface, ch.ADDRESS, dp);
            // the fields of the `hm` block a consumer groups and ranges by; the rest is left out for size
            const hm = {};
            for (const k of ['iface', 'device', 'deviceName', 'deviceType', 'channel', 'channelName', 'channelType',
                'channelIndex', 'datapoint', 'datapointType', 'datapointMin', 'datapointMax', 'datapointUnit', 'room']) {
                if (f[k] !== undefined) hm[k] = f[k];
            }
            status.push({topic: st(iface, ch.ADDRESS, dp), val: sample(dp, d), hm});
        }
    }
}

const out = {
    about: `Generated from hm2mqtt ${pkg.version} (lib/hadiscovery.js, lib/values.js and its fixture CCU) with ` +
        'synthetic addresses, names and rooms: the device configs hm2mqtt announces and the status messages of the same devices ' +
        '(sample values; of the hm block only the identifying and range fields).',
    discovery,
    status,
};
// one message per line, so a regenerated fixture gives a readable diff
const lines = (list) => '[\n' + list.map((m) => '    ' + JSON.stringify(m)).join(',\n') + '\n  ]';
fs.writeFileSync(
    outFile,
    `{\n  "about": ${JSON.stringify(out.about)},\n  "discovery": ${lines(discovery)},\n  "status": ${lines(status)}\n}\n`,
);
console.log('devices', discovery.length, 'components', discovery.reduce((n, d) => n + Object.keys(d.payload.cmps).length, 0),
    'status', status.length, 'bytes', fs.statSync(outFile).size);
