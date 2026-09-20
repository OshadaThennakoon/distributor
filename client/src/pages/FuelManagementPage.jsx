import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters.js';
import { Fuel, Plus, DollarSign, Calendar, TrendingUp, Filter } from 'lucide-react';

export function FuelManagementPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [fuelTxs, setFuelTxs] = useState([]);
  const [prices, setPrices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  const [fuelForm, setFuelForm] = useState({
    distributor_id: 1,
    vehicle_id: '',
    route_id: '',
    fuel_type: 'Diesel',
    litres: 25,
    price_per_litre: 382,
    odometer_reading: 58500,
    fuel_station: 'Ceypetco Kekirawa',
    receipt_number: '',
    payment_method: 'Fleet Card'
  });

  const [priceForm, setPriceForm] = useState({
    fuel_type: 'Diesel',
    price_per_litre: 382,
    effective_date: new Date().toISOString().split('T')[0],
    notes: 'Price adjustment'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [txData, priceData, vData, rData] = await Promise.all([
        api.get('/fuel-transactions'),
        api.get('/fuel-prices'),
        api.get('/vehicles'),
        api.get('/routes')
      ]);
      setFuelTxs(txData);
      setPrices(priceData);
      setVehicles(vData);
      setRoutes(rData);
      if (vData.length > 0 && !fuelForm.vehicle_id) {
        setFuelForm(prev => ({ ...prev, vehicle_id: vData[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  const handleLogFuel = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fuel-transactions', fuelForm);
      setShowLogModal(false);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fuel-prices', priceForm);
      setShowPriceModal(false);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Active prices summary
  const latestDiesel = prices.find(p => p.fuel_type === 'Diesel');
  const latestPetrol = prices.find(p => p.fuel_type === 'Petrol');

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Fuel Telemetry & Price Management</h1>
          <p>Track fuel expenditures, consumption liters, odometer readings, and historical fuel price benchmarks.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowPriceModal(true)}>
            <DollarSign size={14} />
            <span>Update Fuel Price</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
            <Plus size={14} />
            <span>Log Fuel Purchase</span>
          </button>
        </div>
      </div>

      {/* Active Fuel Prices Callout Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="table-card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT DIESEL PRICE (AUTO-APPLIED)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
            {latestDiesel ? formatCurrency(latestDiesel.price_per_litre, currencySymbol) : 'Rs. 382.00'} / L
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Effective: {latestDiesel ? formatDate(latestDiesel.effective_date) : 'Active'}
          </div>
        </div>

        <div className="table-card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT PETROL PRICE</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
            {latestPetrol ? formatCurrency(latestPetrol.price_per_litre, currencySymbol) : 'Rs. 390.00'} / L
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Effective: {latestPetrol ? formatDate(latestPetrol.effective_date) : 'Active'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Fuel Purchases Log ({fuelTxs.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
          onClick={() => setActiveTab('prices')}
        >
          Historical Fuel Price Schedule ({prices.length})
        </button>
      </div>

      {/* Fuel Transactions Table */}
      {activeTab === 'transactions' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle Number</th>
                  <th>Fuel Type</th>
                  <th>Litres</th>
                  <th>Price / L</th>
                  <th>Total Amount</th>
                  <th>Odometer Reading</th>
                  <th>Route Loop</th>
                  <th>Fuel Station</th>
                  <th>Receipt #</th>
                </tr>
              </thead>
              <tbody>
                {fuelTxs.map(tx => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{tx.vehicle_number}</td>
                    <td><span className="badge badge-info">{tx.fuel_type}</span></td>
                    <td><strong>{formatNumber(tx.litres, 1)} L</strong></td>
                    <td>{formatCurrency(tx.price_per_litre, currencySymbol)}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: '700' }}>
                      {formatCurrency(tx.total_amount, currencySymbol)}
                    </td>
                    <td>{tx.odometer_reading ? `${formatNumber(tx.odometer_reading)} km` : '-'}</td>
                    <td>{tx.route_name ? tx.route_name.split(' - ')[1] || tx.route_name : '-'}</td>
                    <td>{tx.fuel_station || '-'}</td>
                    <td>{tx.receipt_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Fuel Prices Table */}
      {activeTab === 'prices' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Effective Date</th>
                  <th>Fuel Type</th>
                  <th>Price Per Litre</th>
                  <th>Notes & Regulation Details</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id}>
                    <td><strong>{formatDate(p.effective_date)}</strong></td>
                    <td><span className="badge badge-purple">{p.fuel_type}</span></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.95rem' }}>
                      {formatCurrency(p.price_per_litre, currencySymbol)}
                    </td>
                    <td>{p.notes || '-'}</td>
                    <td>{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Log Fuel */}
      {showLogModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log Vehicle Fuel Refill</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowLogModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogFuel}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Vehicle *</label>
                    <select className="form-control" value={fuelForm.vehicle_id} onChange={e => setFuelForm({...fuelForm, vehicle_id: Number(e.target.value)})}>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicle_number} ({v.brand} {v.model})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assigned Route</label>
                    <select className="form-control" value={fuelForm.route_id} onChange={e => setFuelForm({...fuelForm, route_id: Number(e.target.value)})}>
                      <option value="">Select Route</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.route_code} - {r.route_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Litres Purchased *</label>
                    <input className="form-control" type="number" step="0.1" required value={fuelForm.litres} onChange={e => setFuelForm({...fuelForm, litres: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Price Per Litre (Rs.) *</label>
                    <input className="form-control" type="number" step="0.1" required value={fuelForm.price_per_litre} onChange={e => setFuelForm({...fuelForm, price_per_litre: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Odometer Reading (km)</label>
                    <input className="form-control" type="number" value={fuelForm.odometer_reading} onChange={e => setFuelForm({...fuelForm, odometer_reading: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Fuel Station</label>
                    <input className="form-control" value={fuelForm.fuel_station} onChange={e => setFuelForm({...fuelForm, fuel_station: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Receipt Number</label>
                  <input className="form-control" placeholder="RCP-XXXX" value={fuelForm.receipt_number} onChange={e => setFuelForm({...fuelForm, receipt_number: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Fuel Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Fuel Price */}
      {showPriceModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configure Fuel Price</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowPriceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePrice}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Fuel Type *</label>
                    <select className="form-control" value={priceForm.fuel_type} onChange={e => setPriceForm({...priceForm, fuel_type: e.target.value})}>
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price Per Litre (Rs.) *</label>
                    <input className="form-control" type="number" step="0.5" required value={priceForm.price_per_litre} onChange={e => setPriceForm({...priceForm, price_per_litre: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Effective Date *</label>
                  <input className="form-control" type="date" required value={priceForm.effective_date} onChange={e => setPriceForm({...priceForm, effective_date: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Price Revision Notes</label>
                  <input className="form-control" placeholder="e.g. Fuel price adjustment order" value={priceForm.notes} onChange={e => setPriceForm({...priceForm, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Price</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FuelManagementPage;
