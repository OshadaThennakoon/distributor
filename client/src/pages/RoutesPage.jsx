import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber } from '../utils/formatters.js';
import { Route, Plus, Eye, Navigation, Calendar, Clock, DollarSign, Truck, User } from 'lucide-react';

export function RoutesPage({ onSelectRouteForMap }) {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [routes, setRoutes] = useState([]);
  const [selectedRouteDetail, setSelectedRouteDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Route Form
  const [routeForm, setRouteForm] = useState({
    distributor_id: 1,
    route_name: '',
    route_code: '',
    starting_location: 'Kekirawa Distribution Center',
    ending_location: 'Kekirawa Distribution Center',
    route_distance_km: 120,
    estimated_travel_time_mins: 240,
    visit_frequency: 'Every 3 weeks',
    frequency_days: 21,
    route_type: 'Regular',
    notes: ''
  });

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const data = await api.get('/routes');
      setRoutes(data);
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [activeDistributorId]);

  const handleViewDetail = async (routeId) => {
    try {
      const detail = await api.get(`/routes/${routeId}`);
      setSelectedRouteDetail(detail);
    } catch (err) {
      alert('Failed to load route detail: ' + err.message);
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    try {
      await api.post('/routes', routeForm);
      setShowAddModal(false);
      setRouteForm({
        distributor_id: 1,
        route_name: '',
        route_code: '',
        starting_location: 'Kekirawa Distribution Center',
        ending_location: 'Kekirawa Distribution Center',
        route_distance_km: 120,
        estimated_travel_time_mins: 240,
        visit_frequency: 'Every 3 weeks',
        frequency_days: 21,
        route_type: 'Regular',
        notes: ''
      });
      loadRoutes();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Route Management & Cycle Operations</h1>
          <p>Configure distribution loops, customer stop sequences, visit frequencies, and automated monthly distance calculations.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            <span>Create New Route</span>
          </button>
        </div>
      </div>

      {/* Routes Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>Active Routes ({routes.length})</span>
            <span className="badge badge-info">Standard Cycle: 21 Days (1.43 Monthly Cycles)</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Route Name</th>
                <th>Distance (KM)</th>
                <th>Frequency</th>
                <th>Monthly Estimated KM</th>
                <th>Shops</th>
                <th>Assigned Vehicle</th>
                <th>Assigned Driver</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td><strong style={{ color: 'var(--primary)' }}>{r.route_code}</strong></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{r.route_name}</td>
                  <td>{r.route_distance_km} km</td>
                  <td>
                    <span className="badge badge-purple">{r.visit_frequency} ({r.frequency_days}d)</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {formatNumber(r.monthlyDistanceKm, 1)} km
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({r.route_distance_km} × 30/21)
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">{r.current_shops_count || r.number_of_shops} Shops</span>
                  </td>
                  <td>{r.vehicle_number || 'Unassigned'}</td>
                  <td>{r.driver_name || 'Unassigned'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetail(r.id)}
                        title="View route economics and stops"
                      >
                        <Eye size={13} />
                        <span>Detail & Cost</span>
                      </button>
                      {onSelectRouteForMap && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onSelectRouteForMap(r.id)}
                          title="View on GPS Map"
                        >
                          <Navigation size={13} />
                          <span>Map</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Route Detail & Economics Drawer */}
      {selectedRouteDetail && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <span className="badge badge-purple">{selectedRouteDetail.route.route_code}</span>
                <h3 style={{ fontSize: '1.2rem', marginTop: '4px' }}>{selectedRouteDetail.route.route_name}</h3>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedRouteDetail(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Economics Highlight Cards (Section 16, 17, 18) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Route Cost / Trip</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--danger)', marginTop: '4px' }}>
                    {formatCurrency(selectedRouteDetail.economics.totalRouteCost, currencySymbol)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>All fuel, driver, maint</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost Per Kilometre</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--warning)', marginTop: '4px' }}>
                    {formatCurrency(selectedRouteDetail.economics.costPerKm, currencySymbol)}/km
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Operating cost ÷ km</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost Per Shop Visit</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>
                    {formatCurrency(selectedRouteDetail.economics.costPerShop, currencySymbol)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cost ÷ {selectedRouteDetail.route.number_of_shops} shops</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Est. Distance</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--success)', marginTop: '4px' }}>
                    {formatNumber(selectedRouteDetail.cycle.monthlyDistanceKm, 1)} km
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>1.43 cycles/month</div>
                </div>
              </div>

              {/* Transparent Cost Formula Explanation */}
              <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '14px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.82rem', lineHeight: '1.6' }}>
                <strong style={{ color: 'var(--primary)' }}>Cost Breakdown & Formula Engine:</strong>
                <div>• Fuel: {selectedRouteDetail.route.route_distance_km} km ÷ {selectedRouteDetail.route.expected_kml} km/L × Rs. 382 = <strong>Rs. {selectedRouteDetail.economics.fuelCost}</strong> ({selectedRouteDetail.economics.breakdown.fuelPct}%)</div>
                <div>• Driver Allocation: (Rs. {selectedRouteDetail.route.driver_salary}/26) + Rs. {selectedRouteDetail.route.driver_allowance} allowance = <strong>Rs. {selectedRouteDetail.economics.driverCost}</strong> ({selectedRouteDetail.economics.breakdown.driverPct}%)</div>
                <div>• Vehicle Maintenance: {selectedRouteDetail.route.route_distance_km} km × Rs. 8/km = <strong>Rs. {selectedRouteDetail.economics.maintenanceCost}</strong></div>
              </div>

              {/* Ordered Stops Sequence (Section 7) */}
              <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Route Stops Sequence ({selectedRouteDetail.stops.length})</h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Stop #</th>
                      <th>Stop / Location Name</th>
                      <th>Type</th>
                      <th>Distance from Prev</th>
                      <th>Shop Owner / Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRouteDetail.stops.map(s => (
                      <tr key={s.id}>
                        <td><strong>#{s.stop_order}</strong></td>
                        <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{s.stop_name}</td>
                        <td>
                          <span className={`badge ${s.stop_type === 'dc' ? 'badge-danger' : s.stop_type === 'town' ? 'badge-warning' : 'badge-info'}`}>
                            {s.stop_type.toUpperCase()}
                          </span>
                        </td>
                        <td>{s.distance_from_prev_km} km</td>
                        <td>{s.owner_name ? `${s.owner_name} (${s.telephone})` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRouteDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Route */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Distribution Route</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRoute}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Route Code *</label>
                    <input className="form-control" required placeholder="e.g. R-016" value={routeForm.route_code} onChange={e => setRouteForm({...routeForm, route_code: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Route Name *</label>
                    <input className="form-control" required placeholder="e.g. Kekirawa to Polonnaruwa Line" value={routeForm.route_name} onChange={e => setRouteForm({...routeForm, route_name: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Route Distance (KM) *</label>
                    <input className="form-control" type="number" required value={routeForm.route_distance_km} onChange={e => setRouteForm({...routeForm, route_distance_km: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Visit Frequency *</label>
                    <select className="form-control" value={routeForm.visit_frequency} onChange={e => {
                      const freq = e.target.value;
                      const days = freq === 'Daily' ? 1 : freq === 'Weekly' ? 7 : freq === 'Biweekly' ? 14 : freq === 'Every 3 weeks' ? 21 : 30;
                      setRouteForm({...routeForm, visit_frequency: freq, frequency_days: days});
                    }}>
                      <option value="Daily">Daily (1 day)</option>
                      <option value="Weekly">Weekly (7 days)</option>
                      <option value="Biweekly">Every 2 weeks (14 days)</option>
                      <option value="Every 3 weeks">Every 3 weeks (21 days)</option>
                      <option value="Monthly">Monthly (30 days)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Starting Location</label>
                    <input className="form-control" value={routeForm.starting_location} onChange={e => setRouteForm({...routeForm, starting_location: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Ending Location</label>
                    <input className="form-control" value={routeForm.ending_location} onChange={e => setRouteForm({...routeForm, ending_location: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes / Operating Instructions</label>
                  <input className="form-control" placeholder="Special road conditions, delivery time windows, etc." value={routeForm.notes} onChange={e => setRouteForm({...routeForm, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Route</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoutesPage;
