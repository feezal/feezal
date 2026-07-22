/**
 * A28 — per-site CSP: header builder (modes, invariants, broker
 * auto-include, origin validation), the violation ring buffer and the two
 * HTTP endpoints (public report POST, protected violations GET).
 */
import {describe, it, expect, beforeEach} from 'vitest';
import {createRequire} from 'module';
import request from 'supertest';

const require = createRequire(import.meta.url);
const csp = require('../src/csp.js');
const express = require('express');

beforeEach(() => csp.clearViolations());

const dir = (header, name) => header.split('; ').find(d => d.startsWith(name + ' '));

describe('buildCsp()', () => {
    it('absent config → the A25 baseline (+ report-uri)', () => {
        const h = csp.buildCsp(null, {siteName: 'default'});
        expect(dir(h, 'script-src')).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
        expect(dir(h, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
        expect(dir(h, 'font-src')).toBe("font-src 'self' data:");
        expect(dir(h, 'img-src')).toBe('img-src * data: blob:');
        expect(dir(h, 'media-src')).toBe('media-src * data: blob:');
        expect(dir(h, 'connect-src')).toBe('connect-src * data:');   // B51 data: survives
        expect(dir(h, 'frame-src')).toBe('frame-src *');
        expect(dir(h, 'object-src')).toBe("object-src 'none'");
        expect(h).toContain('report-uri /api/csp-report/default');
    });

    it('tightening: images to hosts covers img AND media; frames to self', () => {
        const h = csp.buildCsp({
            images: {mode: 'hosts', hosts: ['cam.local:8080', '*.tile.example.com']},
            frames: {mode: 'self'},
        }, {siteName: 's'});
        expect(dir(h, 'img-src')).toBe("img-src 'self' data: blob: cam.local:8080 *.tile.example.com");
        expect(dir(h, 'media-src')).toBe("media-src 'self' data: blob: cam.local:8080 *.tile.example.com");
        expect(dir(h, 'frame-src')).toBe("frame-src 'self'");
    });

    it("connect-src invariants: 'self' + data: + the broker origin are never removable", () => {
        const h = csp.buildCsp({connect: {mode: 'hosts', hosts: ['api.example.com']}},
            {siteName: 's', brokerOrigin: 'ws://broker.lan:9001'});
        expect(dir(h, 'connect-src')).toBe("connect-src 'self' data: ws://broker.lan:9001 api.example.com");
        // 'self' mode still carries the broker.
        const h2 = csp.buildCsp({connect: {mode: 'self'}}, {siteName: 's', brokerOrigin: 'wss://b.example'});
        expect(dir(h2, 'connect-src')).toBe("connect-src 'self' data: wss://b.example");
    });

    it("loosening scripts keeps the baseline tokens ('unsafe-inline'/'unsafe-eval' never stripped)", () => {
        const all = csp.buildCsp({scripts: {mode: 'all'}}, {siteName: 's'});
        expect(dir(all, 'script-src')).toBe("script-src * 'unsafe-inline' 'unsafe-eval'");
        const hosts = csp.buildCsp({scripts: {mode: 'hosts', hosts: ['cdn.corp.example']}}, {siteName: 's'});
        expect(dir(hosts, 'script-src')).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.corp.example");
    });

    it('invalid origins are dropped by validation, junk modes fall back to baseline', () => {
        const h = csp.buildCsp({
            images: {mode: 'hosts', hosts: ['ok.example.com', 'https://evil.com/path', 'bad host', "'unsafe-inline'"]},
            frames: {mode: 'wide-open'},
        }, {siteName: 's'});
        expect(dir(h, 'img-src')).toBe("img-src 'self' data: blob: ok.example.com");
        expect(dir(h, 'frame-src')).toBe('frame-src *');   // invalid mode → baseline (open)
    });

    it('validateOrigin + brokerOriginFromUri', () => {
        expect(csp.validateOrigin('cam.local:8080')).toBe(true);
        expect(csp.validateOrigin('*.example.com')).toBe(true);
        expect(csp.validateOrigin('https://grafana.lan')).toBe(true);
        expect(csp.validateOrigin('http://x/path')).toBe(false);
        expect(csp.validateOrigin('java script:alert(1)')).toBe(false);
        expect(csp.brokerOriginFromUri('ws://broker.lan:9001/mqtt')).toBe('ws://broker.lan:9001');
        expect(csp.brokerOriginFromUri('wss://b.example')).toBe('wss://b.example');
        expect(csp.brokerOriginFromUri('mqtt://broker.lan')).toBeNull();   // bridged → 'self'
    });
});

describe('violation store + endpoints', () => {
    const report = (host, directive) => ({'csp-report': {
        'blocked-uri': `https://${host}/x.png`, 'effective-directive': directive,
    }});

    it('aggregates by host+directive, caps per site, isolates sites', () => {
        csp.recordViolation('a', report('x.com', 'img-src'));
        csp.recordViolation('a', report('x.com', 'img-src'));
        csp.recordViolation('a', report('y.com', 'frame-src'));
        csp.recordViolation('b', report('z.com', 'img-src'));

        const a = csp.getViolations('a');
        expect(a).toHaveLength(2);
        expect(a.find(v => v.host === 'x.com').count).toBe(2);
        expect(csp.getViolations('b')).toHaveLength(1);

        for (let i = 0; i < csp.MAX_ENTRIES_PER_SITE + 10; i++) {
            csp.recordViolation('cap', report(`h${i}.com`, 'img-src'));
        }
        expect(csp.getViolations('cap').length).toBe(csp.MAX_ENTRIES_PER_SITE);
    });

    it('the public report endpoint records and returns 204; the GET endpoint lists', async () => {
        const app = express();
        app.post('/api/csp-report/:site',
            express.json({type: ['application/csp-report', 'application/json'], limit: '10kb'}),
            (req, res) => { csp.recordViolation(req.params.site, req.body); res.status(204).end(); });
        app.get('/api/sites/:name/csp-violations', (req, res) => res.json(csp.getViolations(req.params.name)));

        const res = await request(app)
            .post('/api/csp-report/mysite')
            .set('Content-Type', 'application/csp-report')
            .send(JSON.stringify(report('blocked.example', 'img-src')));
        expect(res.status).toBe(204);

        const list = await request(app).get('/api/sites/mysite/csp-violations');
        expect(list.body).toEqual([expect.objectContaining({host: 'blocked.example', directive: 'img-src', count: 1})]);
    });
});
