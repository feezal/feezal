import {describe, it, expect} from 'vitest';

import {NUMERIC_SENSOR_ICONS} from '../packages/@feezal/feezal-element/feezal-numeric-sensor-icons.js';
import {stampDiscovery} from '../src/feezal-discovery-stamp.js';

// E160 — device_class → icon on numeric value cards.

// A minimal value-card fixture: the sensor map every *-value card uses, with
// the E160 device_class → icon mapping added.
class ValueFixture extends HTMLElement {
    static feezal = {
        discovery: {
            component: 'sensor',
            map: {
                state_topic: {attr: 'subscribe'},
                unit_of_measurement: {attr: 'unit'},
                value_template: {attr: 'message-property', transform: 'valueTemplateToPath'},
                device_class: {attr: 'icon', valueMap: NUMERIC_SENSOR_ICONS},
                name: 'label',
            },
        },
        attributes: [
            {name: 'subscribe'}, {name: 'unit'}, {name: 'message-property'},
            {name: 'icon'}, {name: 'label'},
        ],
    };
}
customElements.define('feezal-test-value-fixture', ValueFixture);

const stamp = cfg => {
    const el = document.createElement('feezal-test-value-fixture');
    stampDiscovery(el, {config: cfg, component: 'sensor', discovery_id: 'dev-1'});
    return el;
};

describe('NUMERIC_SENSOR_ICONS table', () => {
    it('maps the common device_classes to distinct icons', () => {
        expect(NUMERIC_SENSOR_ICONS.temperature).toBe('thermostat');
        expect(NUMERIC_SENSOR_ICONS.humidity).toBe('water_drop');
        expect(NUMERIC_SENSOR_ICONS.atmospheric_pressure).toBe('compress');
        expect(NUMERIC_SENSOR_ICONS.carbon_dioxide).toBe('co2');
        expect(NUMERIC_SENSOR_ICONS.pm25).toBe('blur_on');
        expect(NUMERIC_SENSOR_ICONS.volatile_organic_compounds_parts).toBe('air');
    });

    it('has a neutral _default', () => {
        expect(NUMERIC_SENSOR_ICONS._default).toBe('sensors');
    });
});

describe('E160 — stamping a value card', () => {
    it('stamps the humidity icon for a humidity sensor (not a thermometer)', () => {
        const el = stamp({state_topic: 'z/h', device_class: 'humidity', unit_of_measurement: '%'});
        expect(el.getAttribute('icon')).toBe('water_drop');
        expect(el.getAttribute('unit')).toBe('%');
    });

    it('stamps pressure / CO2 / PM2.5 / VOC each with their own icon', () => {
        expect(stamp({device_class: 'atmospheric_pressure'}).getAttribute('icon')).toBe('compress');
        expect(stamp({device_class: 'carbon_dioxide'}).getAttribute('icon')).toBe('co2');
        expect(stamp({device_class: 'pm25'}).getAttribute('icon')).toBe('blur_on');
        expect(stamp({device_class: 'volatile_organic_compounds_parts'}).getAttribute('icon')).toBe('air');
    });

    it('falls back to the neutral sensors icon for an unknown device_class', () => {
        expect(stamp({device_class: 'iaq'}).getAttribute('icon')).toBe('sensors');
    });

    it('leaves the icon untouched when the entity has no device_class', () => {
        const el = stamp({state_topic: 'x/y', unit_of_measurement: 'lux'});
        expect(el.hasAttribute('icon')).toBe(false);
    });
});
