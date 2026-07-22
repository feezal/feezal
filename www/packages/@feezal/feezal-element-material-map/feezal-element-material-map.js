/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';
// A25: Leaflet's default marker images, bundled by Vite (small PNGs inline as
// data URIs, so live viewer AND static exports are self-contained) — never
// fetched from a CDN.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Cached, shareable Leaflet stylesheet. Leaflet's CSS MUST live inside each
// map's shadow root — document.head styles do not cross the shadow boundary, so
// without this the tiles render unpositioned (scattered) instead of as a grid.
// A constructable stylesheet can be adopted into many shadow roots at once.
let _leafletSheet = null; // CSSStyleSheet | false (inline import failed) | null (not loaded)

async function getLeaflet() {
    const L = (await import('leaflet')).default ?? (await import('leaflet'));
    if (_leafletSheet === null) {
        try {
            const cssText = (await import('leaflet/dist/leaflet.css?inline')).default;
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            _leafletSheet = sheet;
        } catch {
            // Inline import unavailable — signal the fallback (<link> in shadow root).
            _leafletSheet = false;
        }
    }
    // Fix default icon URLs (bundler strips the image URLs from Leaflet's
    // defaults) — A25: point them at the BUNDLED images, not a CDN.
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x,
        iconUrl:       markerIcon,
        shadowUrl:     markerShadow,
    });
    return L;
}

function circleIcon(L, color, label) {
    return L.divIcon({
        html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${color};border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:700;color:#fff;
            box-sizing:border-box;
        ">${label || ''}</div>`,
        className: '',
        iconSize:   [32, 32],
        iconAnchor: [16, 16],
        popupAnchor:[0, -20],
    });
}

class FeezalElementMaterialMap extends FeezalElement {
    static get feezal() {
        return {
            palette: {name: 'Map', category: 'Material', color: '#4a6080', icon: 'map'},
            description: 'Interactive Leaflet map — OwnTracks live-location mode or generic single-marker mode.',
            attributes: [
                {name: 'owntracks-mode',   type: 'boolean',   help: 'Subscribe to OwnTracks wildcard and show all persons as labelled pins.'},
                {name: 'owntracks-prefix', type: 'string',    help: 'OwnTracks MQTT prefix. Default: owntracks'},
                {name: 'subscribe-lat',    type: 'mqttTopic', help: 'Topic for latitude (generic single-marker mode).'},
                {name: 'subscribe-lon',    type: 'mqttTopic', help: 'Topic for longitude (generic single-marker mode).'},
                {name: 'subscribe-pos',    type: 'mqttTopic', help: 'Topic for combined position JSON {lat, lon} or "lat,lon" string.'},
                {name: 'marker-color',     type: 'color',     help: 'Pin colour in generic mode. Default: #0284c7'},
                {name: 'marker-label',     type: 'string',    help: 'Short label on the pin (≤ 2 chars).'},
                {name: 'zoom',             type: 'number',    help: 'Initial zoom level. Default: 13'},
                {name: 'home-lat',         type: 'number',    help: 'Home/default map centre latitude.'},
                {name: 'home-lon',         type: 'number',    help: 'Home/default map centre longitude.'},
                {name: 'tile-url',         type: 'string',    help: 'Tile server URL template. Default: OpenStreetMap — NOTE: the default contacts tile.openstreetmap.org (the only network request this element makes besides your MQTT broker); point it at your own tile server for a fully offline dashboard.'},
                {name: 'follow',           type: 'boolean',   help: 'Pan the map to follow the most recently updated position. Takes precedence over auto-fit.'},
                {name: 'auto-fit',         type: 'boolean',   help: 'Zoom/pan so all pins are visible at once — on load and every time the view becomes active. Ignored when follow is on. Default: on'},
                {name: 'stale-minutes',    type: 'number',    help: 'Mark a person as stale (greyed) after this many minutes. Default: 60'},
            ],
            styles: ['top', 'left', 'width', 'height'],
            defaultStyle: {width: '320px', height: '240px'},
        };
    }

    static properties = {
        owntracksMode:   {type: Boolean, reflect: true, attribute: 'owntracks-mode'},
        owntracksPrefix: {type: String,  reflect: true, attribute: 'owntracks-prefix'},
        subscribeLat:    {type: String,  reflect: true, attribute: 'subscribe-lat'},
        subscribeLon:    {type: String,  reflect: true, attribute: 'subscribe-lon'},
        subscribePos:    {type: String,  reflect: true, attribute: 'subscribe-pos'},
        markerColor:     {type: String,  reflect: true, attribute: 'marker-color'},
        markerLabel:     {type: String,  reflect: true, attribute: 'marker-label'},
        zoom:            {type: Number,  reflect: true},
        homeLat:         {type: Number,  reflect: true, attribute: 'home-lat'},
        homeLon:         {type: Number,  reflect: true, attribute: 'home-lon'},
        tileUrl:         {type: String,  reflect: true, attribute: 'tile-url'},
        follow:          {type: Boolean, reflect: true},
        autoFit:         {type: Boolean, reflect: true, attribute: 'auto-fit'},
        staleMinutes:    {type: Number,  reflect: true, attribute: 'stale-minutes'},
    };

    static styles = [feezalBaseStyles, css`
        :host {
            display: block;
            box-sizing: border-box;
            overflow: hidden;
        }
        #map {
            width: 100%;
            height: 100%;
        }
        .editor-ph {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #e8f5e9;
            gap: 6px;
        }
        .editor-ph svg {
            width: 48px;
            height: 48px;
            opacity: 0.5;
        }
        .editor-ph span {
            font-size: 12px;
            color: var(--secondary-text-color, #666);
        }
    `];

    constructor() {
        super();
        this.owntracksMode   = false;
        this.owntracksPrefix = 'owntracks';
        this.subscribeLat    = '';
        this.subscribeLon    = '';
        this.subscribePos    = '';
        this.markerColor     = '#0284c7';
        this.markerLabel     = '';
        this.zoom            = 13;
        this.homeLat         = 51.505;
        this.homeLon         = -0.09;
        this.tileUrl         = '';
        this.follow          = false;
        this.autoFit         = true;
        this.staleMinutes    = 60;
        this._map            = null;
        this._L              = null;
        this._resizeObserver = null;
        this._markers        = new Map(); // key → {marker, ts}
        this._lat            = null;
        this._lon            = null;
    }

    async firstUpdated() {
        try {
            const L = await getLeaflet();
            this._L = L;
            const mapEl = this.shadowRoot.getElementById('map');
            if (!mapEl) return;

            // Leaflet's CSS must live inside this shadow root or tiles render
            // unpositioned. Adopt the shared stylesheet (preferred) or fall back
            // to a <link> appended into the shadow root (which also crosses the
            // boundary, unlike one in document.head).
            if (_leafletSheet) {
                this.shadowRoot.adoptedStyleSheets = [
                    ...this.shadowRoot.adoptedStyleSheets,
                    _leafletSheet,
                ];
            } else if (_leafletSheet === false) {
                // A25: no CDN fallback — the ?inline import is guaranteed in
                // every Vite-built context feezal ships; if it ever fails the
                // map renders unstyled rather than phoning unpkg.
                console.warn('[feezal-map] Leaflet CSS could not be bundled — map tiles may render unpositioned');
            }

            const lat  = this.homeLat ?? 51.505;
            const lon  = this.homeLon ?? -0.09;
            const zoom = this.zoom ?? 13;

            this._map = L.map(mapEl, {
                center: [lat, lon],
                zoom,
                zoomControl: true,
            });

            const tileUrl = this.tileUrl ||
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            L.tileLayer(tileUrl, {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(this._map);

            this._setupSubscriptions();

            // Leaflet computes tile coverage from the container size at init
            // time; if layout has not settled yet it only loads the tiles for
            // the area it thinks is visible and the rest stays blank (B12 —
            // half the map invisible). Recompute once layout is flushed and on
            // every subsequent resize (e.g. when resized in the editor).
            requestAnimationFrame(() => this._map && this._map.invalidateSize());
            this._resizeObserver = new ResizeObserver(() => {
                if (this._map) this._map.invalidateSize();
            });
            this._resizeObserver.observe(mapEl);
        } catch (err) {
            console.error('[feezal-map] Leaflet load failed:', err);
        }
    }

    _setupSubscriptions() {
        const L = this._L;
        if (!L) return;

        if (this.owntracksMode) {
            const prefix = this.owntracksPrefix || 'owntracks';
            // Subscribe with two-level wildcard: owntracks/+/+
            if (this.addSubscription) {
                this.addSubscription(`${prefix}/+/+`, msg => {
                    this._handleOwntracks(msg);
                });
            }
            return;
        }

        // Generic single-marker mode
        const update = () => {
            if (this._lat != null && this._lon != null) {
                this._updateMarker('_default', this._lat, this._lon,
                    this.markerColor || '#0284c7', this.markerLabel || '');
            }
        };

        if (this.subscribePos) {
            this.addSubscription(this.subscribePos, msg => {
                const v = this.getProperty(msg, this.messageProperty);
                if (typeof v === 'object' && v.lat != null) {
                    this._lat = parseFloat(v.lat);
                    this._lon = parseFloat(v.lon ?? v.lng);
                } else if (typeof v === 'string' && v.includes(',')) {
                    const [la, lo] = v.split(',').map(Number);
                    this._lat = la; this._lon = lo;
                }
                update();
            });
        }
        if (this.subscribeLat) {
            this.addSubscription(this.subscribeLat, msg => {
                this._lat = parseFloat(this.getProperty(msg, this.messageProperty));
                update();
            });
        }
        if (this.subscribeLon) {
            this.addSubscription(this.subscribeLon, msg => {
                this._lon = parseFloat(this.getProperty(msg, this.messageProperty));
                update();
            });
        }
    }

    _handleOwntracks(msg) {
        const L = this._L;
        if (!L || !msg) return;

        // Subscription callbacks deliver a wrapper {topic, payload}; the actual
        // OwnTracks object lives in payload (resolved via message-property).
        const topic   = msg.topic || '';
        const payload = this.getProperty(msg, this.messageProperty);
        if (!payload || typeof payload !== 'object') return;

        if (payload._type !== 'location' || payload.lat == null) return;

        // Derive person key from topic: owntracks/<user>/<device>
        const parts = topic.split('/');
        const key  = parts.slice(-2).join('/') || `person-${this._markers.size}`;
        const tid  = payload.tid || key.split('/').pop().substring(0, 2).toUpperCase();
        const staleMs = (this.staleMinutes || 60) * 60 * 1000;
        const isStale = payload.tst && (Date.now() - payload.tst * 1000) > staleMs;
        const color = isStale ? '#9e9e9e' : '#e91e63';

        this._updateMarker(key, payload.lat, payload.lon, color, tid, topic);
    }

    _updateMarker(key, lat, lon, color, label, popupText) {
        const L = this._L;
        const map = this._map;
        if (!L || !map) return;
        if (isNaN(lat) || isNaN(lon)) return;

        let added = false;
        if (this._markers.has(key)) {
            const {marker} = this._markers.get(key);
            marker.setLatLng([lat, lon]);
            marker.setIcon(circleIcon(L, color, label));
        } else {
            const marker = L.marker([lat, lon], {icon: circleIcon(L, color, label)})
                .addTo(map);
            if (popupText) {
                marker.bindPopup(`<b>${popupText}</b>`);
            }
            this._markers.set(key, {marker});
            added = true;
        }

        if (this.follow) {
            // Follow wins: keep the most recently updated position centred.
            map.setView([lat, lon], map.getZoom());
        } else if (this.autoFit && added) {
            // Re-frame only when a new pin appears, not on every position update,
            // so the map stays stable while pins move.
            this._fitToMarkers();
        }
    }

    /** Zoom/pan so every current pin is visible at once. */
    _fitToMarkers() {
        const L = this._L;
        const map = this._map;
        if (!L || !map || this._markers.size === 0) return;
        const markers = [...this._markers.values()].map(m => m.marker);
        if (markers.length === 1) {
            map.setView(markers[0].getLatLng(), this.zoom ?? 13);
        } else {
            map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
        }
    }

    updated(changed) {
        super.updated(changed);
        // When the containing view goes from hidden → visible the map container
        // has just regained a real size (it was display:none, i.e. 0×0). Recompute
        // the size and re-frame the pins once layout has flushed.
        if (changed.has('visible') && this.visible) {
            requestAnimationFrame(() => {
                if (!this._map) return;
                this._map.invalidateSize();
                if (this.autoFit && !this.follow) this._fitToMarkers();
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._map) {
            this._map.remove();
            this._map = null;
        }
    }

    render() {
        return html`<div id="map"></div>`;
    }
}

customElements.define('feezal-element-material-map', FeezalElementMaterialMap);
export {FeezalElementMaterialMap};
