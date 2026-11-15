# Home Assistant MQTT discovery corpus

`*.json` (except `ids-5.7.2.json`) are the discovery corpus of
[mqtt-ha-entities](https://github.com/hobbyquaker/mqtt-ha-entities) (`test/fixtures/ha/`, version 0.1.0,
MIT), copied unchanged: each file is a list of `{topic, payload}` messages as a broker holds them retained
under `homeassistant/#` — zigbee2mqtt, ESPHome, Tasmota, Shelly, Z-Wave JS UI, OpenMQTTGateway, a meter
digitizer, the device-based form of several adapters, and noise. Captured files are anonymised there;
its README says which are captured and which are written by hand.

`ids-5.7.2.json` is the list of `discovery_id`s feezal 5.7.2's own parser produced for each file and for
`../hm2mqtt-pair.json` (its `discovery` messages), recorded before the parser was replaced by
mqtt-ha-entities' `DiscoveryStore`. Saved dashboards hold these ids, so the test
(`../../discovery-a40.test.js`) requires the same ids from the registry — an id may only be added to or
removed from this file together with the reason.
