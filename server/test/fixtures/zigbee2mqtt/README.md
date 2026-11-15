# zigbee2mqtt: the bridge's own device list, and the discovery it announces for it

A pair for the tests of the zigbee2mqtt recognizer (`../../native-discovery-zigbee2mqtt.test.js`,
`www/test/feezal-discovery-zigbee2mqtt.test.js`).

| File | What |
| --- | --- |
| `bridge-devices.json` | A `zigbee2mqtt/bridge/devices` payload: the coordinator and 36 devices with their `exposes`. 34 are the device list of [mqtt2matter](https://github.com/hobbyquaker/mqtt2matter)'s tests (`test/fixtures/z2m/bridge-devices.json`), the 35th its `starkvind.json` (an air purifier, for the fan) under the name "Air purifier", the 36th a door lock (Yale YRD426NRSC, "Front door lock") built by `device-from-definition.cjs` from the device definition zigbee2mqtt itself ships. Every IEEE address is replaced by a made-up one (`0x00124b00000001NN`); the friendly names are the generic ones of the source. |
| `bridge-groups.json` | The matching `zigbee2mqtt/bridge/groups` payload: ten groups, four with members (lights, switches, a cover, a thermostat with a scene). Same address replacement. |
| `discovery.json` | The Home Assistant discovery **zigbee2mqtt 2.14.3 itself** publishes for exactly these devices and groups with default settings: 286 retained configs as `{topic, payload}`. Generated, not captured — see below. |
| `device-from-definition.cjs` | Prints a `bridge/devices` entry for a model of zigbee-herdsman-converters' `devices/yale.js` (arguments: model, a made-up address, a name): the exposes are the definition's own, serialised as the bridge serialises them. Needs zigbee2mqtt installed next to it, as below. |
| `generate-discovery.cjs` | The generator: it loads zigbee2mqtt's own `dist/extension/homeassistant.js` and drives its `discover()` with stand-ins for the Zigbee and MQTT layers built from the two payloads. Nothing of zigbee2mqtt is copied into this repository; the script needs it installed next to it. |

To regenerate (in an empty directory, with a `data/configuration.yaml` that sets `homeassistant: {enabled: true}`,
`mqtt: {base_topic: zigbee2mqtt, server: mqtt://localhost}`, `serial: {port: /dev/null}`):

```sh
npm install zigbee2mqtt@2.14.3 --ignore-scripts
ZIGBEE2MQTT_DATA=$PWD/data node generate-discovery.cjs bridge-devices.json bridge-groups.json discovery.json
```
