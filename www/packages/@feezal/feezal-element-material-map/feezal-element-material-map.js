/* global feezal */
import {FeezalElement, feezalBaseStyles, html, css} from '@feezal/feezal-element';

let _leafletCssInjected = false;

async function getLeaflet() {
    const L = (await import('leaflet')).default ?? (await import('leaflet'));
    if (!_leafletCssInjected) {
        try {
            const cssText = (await import('leaflet/dist/leaflet.css?inline')).default;
            const s = Object.assign(document.createElement('style'), {
                id: 'feezal-leaflet-css',
                textContent: cssText,
            });
            document.head.appendChild(s);
        } catch {
            // CSS inline import failed — fall back to a link element
            const link = Object.assign(document.createElement('link'), {
                id: 'feezal-leaflet-link',
                rel: 'stylesheet',
                href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            });
            document.head.appendChild(link);
        }
        _leafletCssInjected = true;
    }
    // Fix default icon URLs (bundler strips the image URLs from Leaflet's defaults)
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
                {name: 'tile-url',         type: 'string',    help: 'Tile server URL template. Default: OpenStreetMap'},
                {name: 'follow',           type: 'boolean',   help: 'Pan the map to follow the tracked position.'},
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
        this.staleMinutes    = 60;
        this._map            = null;
        this._L              = null;
        this._markers        = new Map(); // key → {marker, ts}
        this._lat            = null;
        this._lon            = null;
    }

    async firstUpdated() {
        if (feezal.isEditor) return;
        try {
            const L = await getLeaflet();
            this._L = L;
            const mapEl = this.shadowRoot.getElementById('map');
            if (!mapEl) return;

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
        let payload;
        try {
            payload = typeof msg === 'object' ? msg : JSON.parse(msg);
        } catch { return; }

        if (payload._type !== 'location' || payload.lat == null) return;

        // Derive person key from topic
        const topic = payload._topic || '';
        const parts = topic.split('/');
        const key  = parts.slice(-2).join('/') || `person-${Object.keys(this._markers).length}`;
        const tid  = payload.tid || key.split('/').pop().substring(0, 2).toUpperCase();
        const staleMs = (this.staleMinutes || 60) * 60 * 1000;
        const isStale = payload.tst && (Date.now() - payload.tst * 1000) > staleMs;
        const color = isStale ? '#9e9e9e' : '#e91e63';

        this._updateMarker(key, payload.lat, payload.lon, color, tid, payload);
    }

    _updateMarker(key, lat, lon, color, label, data) {
        const L = this._L;
        const map = this._map;
        if (!L || !map) return;
        if (isNaN(lat) || isNaN(lon)) return;

        if (this._markers.has(key)) {
            const {marker} = this._markers.get(key);
            marker.setLatLng([lat, lon]);
            marker.setIcon(circleIcon(L, color, label));
        } else {
            const marker = L.marker([lat, lon], {icon: circleIcon(L, color, label)})
                .addTo(map);
            if (data && data.topic) {
                marker.bindPopup(`<b>${data.topic}</b>`);
            }
            this._markers.set(key, {marker});
        }

        if (this.follow) {
            map.setView([lat, lon], map.getZoom());
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._map) {
            this._map.remove();
            this._map = null;
        }
    }

    render() {
        if (feezal.isEditor) {
            return html`
                <div class="editor-ph">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
                            fill="#4a6080"/>
                    </svg>
                    <span>Map${this.owntracksMode ? ' (OwnTracks)' : ''}</span>
                </div>`;
        }
        return html`<div id="map"></div>`;
    }
}

customElements.define('feezal-element-material-map', FeezalElementMaterialMap);
export {FeezalElementMaterialMap};
