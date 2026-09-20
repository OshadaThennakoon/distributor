import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import api from '../utils/api.js';

// Fix leaflet default marker icons in React Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored markers
const dcIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const shopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -28],
  shadowSize: [32, 32]
});

export function MapView({ routeId = null }) {
  const [dcs, setDcs] = useState([]);
  const [shops, setShops] = useState([]);
  const [routeStops, setRouteStops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMapData() {
      try {
        const [dcData, shopData] = await Promise.all([
          api.get('/distribution-centers'),
          api.get('/shops')
        ]);
        setDcs(dcData);
        setShops(shopData);

        if (routeId) {
          const rDetail = await api.get(`/routes/${routeId}`);
          setRouteStops(rDetail.stops || []);
        }
      } catch (err) {
        console.error('Error loading map data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMapData();
  }, [routeId]);

  // Center around Kekirawa / Dambulla (lat: 8.0, lng: 80.6)
  const defaultCenter = [8.0433, 80.5922];

  // If a specific route is selected, build route path coordinates
  const polylineCoords = routeStops
    .filter(s => s.latitude && s.longitude)
    .map(s => [s.latitude, s.longitude]);

  return (
    <div className="table-card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem' }}>Interactive Territory & Route Geospatial Map</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing distribution centers, customer shop density, and route loops using OpenStreetMap (Zero external API costs).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
            <span>Distribution Centers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#2563eb' }}></span>
            <span>Customer Outlets</span>
          </div>
        </div>
      </div>

      <div className="map-view-container">
        <MapContainer center={defaultCenter} zoom={9} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Distribution Centers */}
          {dcs.map(dc => (
            dc.latitude && dc.longitude ? (
              <Marker key={`dc-${dc.id}`} position={[dc.latitude, dc.longitude]} icon={dcIcon}>
                <Popup>
                  <div style={{ color: '#0f172a' }}>
                    <strong>🏢 {dc.name}</strong><br />
                    Code: {dc.code}<br />
                    District: {dc.district}<br />
                    Manager: {dc.manager || '-'}<br />
                    Phone: {dc.contact_number || '-'}
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}

          {/* Shops */}
          {shops.map(sh => (
            sh.latitude && sh.longitude ? (
              <Marker key={`shop-${sh.id}`} position={[sh.latitude, sh.longitude]} icon={shopIcon}>
                <Popup>
                  <div style={{ color: '#0f172a' }}>
                    <strong>🏪 {sh.shop_name}</strong><br />
                    Code: {sh.shop_code}<br />
                    Owner: {sh.owner_name || '-'}<br />
                    Type: {sh.customer_type}<br />
                    Route: {sh.route_name || 'Unassigned'}<br />
                    Next Visit: {sh.next_visit_date || '-'}
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}

          {/* Polyline for Route */}
          {polylineCoords.length > 1 && (
            <Polyline positions={polylineCoords} color="#6366f1" weight={4} opacity={0.8} dashArray="6, 6" />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default MapView;
