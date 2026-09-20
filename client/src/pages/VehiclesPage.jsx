import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters.js';
import { Truck, UserCheck, Plus, AlertTriangle, CheckCircle2, Wrench, Shield, Calendar } from 'lucide-react';

export function VehiclesPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [activeTab, setActiveTab] = useState('vehicles');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);

  const [vehicleForm, setVehicleForm] = useState({
    distributor_id: 1,
    vehicle_number: '',
    vehicle_type: 'Mini Truck',
    brand: 'DIMO',
    model: 'Batta',
    year: 2022,
    fuel_type: 'Diesel',
    expected_kml: 18.0,
    current_odometer: 0,
    service_interval_km: 5000,
    insurance_expiry: '2027-06-30',
    revenue_license_expiry: '2027-06-30'
  });

  const [driverForm, setDriverForm] = useState({
    distributor_id: 1,
    full_name: '',
    nic: '',
    phone: '',
    license_number: '',
    license_expiry: '2028-12-31',
    monthly_salary: 65000,
    daily_allowance: 1500
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [vData, dData] = await Promise.all([
        api.get('/vehicles'),
        api.get('/drivers')
      ]);
      setVehicles(vData);
      setDrivers(dData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post('/vehicles', vehicleForm);
      setShowVehicleModal(false);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      await api.post('/drivers', driverForm);
      setShowDriverModal(false);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Fleet & Driver Resource Management</h1>
          <p>Monitor vehicle efficiencies, fuel economy variances, odometer logs, periodic service alerts, and driver allocations.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowDriverModal(true)}>
            <Plus size={14} />
            <span>Add Driver</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowVehicleModal(true)}>
            <Plus size={14} />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => setActiveTab('vehicles')}
        >
          Vehicles Fleet ({vehicles.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          Drivers & Compensation ({drivers.length})
        </button>
      </div>

      {/* Vehicles Table */}
      {activeTab === 'vehicles' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle Number</th>
                  <th>Make & Model</th>
                  <th>Fuel Type</th>
                  <th>Expected km/L</th>
                  <th>Actual km/L</th>
                  <th>Variance</th>
                  <th>Current Odometer</th>
                  <th>Assigned Driver</th>
                  <th>Next Service</th>
                  <th>Compliance Alerts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{v.vehicle_number}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{v.brand} {v.model} ({v.year || '-'})</td>
                    <td><span className="badge badge-info">{v.fuel_type}</span></td>
                    <td>{v.expected_kml} km/L</td>
                    <td><strong>{v.actual_kml} km/L</strong></td>
                    <td>
                      <span className={`badge ${v.efficiencyStatus === 'ABNORMAL_HIGH_CONSUMPTION' ? 'badge-danger' : 'badge-success'}`}>
                        {v.efficiencyVariancePct}%
                      </span>
                    </td>
                    <td>{formatNumber(v.current_odometer)} km</td>
                    <td>{v.assigned_driver_name || 'Unassigned'}</td>
                    <td>{v.next_service_odometer ? `${formatNumber(v.next_service_odometer)} km` : 'Regular'}</td>
                    <td>
                      {v.alerts && v.alerts.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {v.alerts.map((al, idx) => (
                            <span key={idx} className="badge badge-danger">
                              <AlertTriangle size={10} />
                              <span>{al.replace('_', ' ')}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="badge badge-success">
                          <CheckCircle2 size={10} />
                          <span>OK</span>
                        </span>
                      )}
                    </td>
                    <td><span className="badge badge-success">{v.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drivers Table */}
      {activeTab === 'drivers' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>NIC Number</th>
                  <th>Contact Phone</th>
                  <th>License Number</th>
                  <th>License Expiry</th>
                  <th>Monthly Salary</th>
                  <th>Daily Allowance</th>
                  <th>Assigned Vehicle</th>
                  <th>Trips Completed</th>
                  <th>Total KM Driven</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(dr => (
                  <tr key={dr.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{dr.full_name}</td>
                    <td>{dr.nic}</td>
                    <td>{dr.phone}</td>
                    <td><strong>{dr.license_number}</strong></td>
                    <td>{formatDate(dr.license_expiry)}</td>
                    <td>{formatCurrency(dr.monthly_salary, currencySymbol)}</td>
                    <td>{formatCurrency(dr.daily_allowance, currencySymbol)}/day</td>
                    <td>{dr.assigned_vehicle_number || 'Floating'}</td>
                    <td><span className="badge badge-info">{dr.trips_count || 0} trips</span></td>
                    <td>{formatNumber(dr.total_km_driven || 0)} km</td>
                    <td><span className="badge badge-success">{dr.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {showVehicleModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Fleet Vehicle</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowVehicleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateVehicle}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Registration Number *</label>
                    <input className="form-control" required placeholder="e.g. WP-CP-1920" value={vehicleForm.vehicle_number} onChange={e => setVehicleForm({...vehicleForm, vehicle_number: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Vehicle Type *</label>
                    <input className="form-control" required placeholder="e.g. Mini Truck" value={vehicleForm.vehicle_type} onChange={e => setVehicleForm({...vehicleForm, vehicle_type: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Brand</label>
                    <input className="form-control" value={vehicleForm.brand} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Model</label>
                    <input className="form-control" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fuel Type *</label>
                    <select className="form-control" value={vehicleForm.fuel_type} onChange={e => setVehicleForm({...vehicleForm, fuel_type: e.target.value})}>
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Mileage (km/L) *</label>
                    <input className="form-control" type="number" step="0.1" required value={vehicleForm.expected_kml} onChange={e => setVehicleForm({...vehicleForm, expected_kml: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Opening Odometer (km)</label>
                    <input className="form-control" type="number" value={vehicleForm.current_odometer} onChange={e => setVehicleForm({...vehicleForm, current_odometer: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Service Interval (km)</label>
                    <input className="form-control" type="number" value={vehicleForm.service_interval_km} onChange={e => setVehicleForm({...vehicleForm, service_interval_km: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVehicleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Driver */}
      {showDriverModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Driver</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowDriverModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDriver}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-control" required placeholder="e.g. Sunil Perera" value={driverForm.full_name} onChange={e => setDriverForm({...driverForm, full_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>NIC Number *</label>
                    <input className="form-control" required placeholder="e.g. 198512300456" value={driverForm.nic} onChange={e => setDriverForm({...driverForm, nic: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input className="form-control" required placeholder="+94 77 123 4567" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>License Number *</label>
                    <input className="form-control" required placeholder="e.g. B-129482" value={driverForm.license_number} onChange={e => setDriverForm({...driverForm, license_number: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Monthly Base Salary (Rs.)</label>
                    <input className="form-control" type="number" value={driverForm.monthly_salary} onChange={e => setDriverForm({...driverForm, monthly_salary: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Daily Route Allowance (Rs.)</label>
                    <input className="form-control" type="number" value={driverForm.daily_allowance} onChange={e => setDriverForm({...driverForm, daily_allowance: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDriverModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Driver</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VehiclesPage;
