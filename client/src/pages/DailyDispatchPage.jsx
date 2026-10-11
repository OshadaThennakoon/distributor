import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { 
  Truck, Calendar, Printer, Package, CheckSquare, 
  MapPin, Phone, User, DollarSign, AlertCircle, FileText 
} from 'lucide-react';

export function DailyDispatchPage() {
  const { currencySymbol } = useTenant();
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('1');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispatchData, setDispatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await api.get('/routes');
      setRoutes(data);
      if (data.length > 0) setSelectedRouteId(data[0].id.toString());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedRouteId) {
      loadDispatchSheet();
    }
  }, [selectedRouteId, selectedDate]);

  const loadDispatchSheet = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dispatch/sheet?routeId=${selectedRouteId}&date=${selectedDate}`);
      setDispatchData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedRouteObj = routes.find(r => r.id === Number(selectedRouteId));

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>📦 Daily Delivery Dispatch & Rider Trip Sheet</h1>
          <p>Generate vehicle warehouse packing list and shop-by-shop dropoff sheet for delivery drivers and riders.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handlePrint} disabled={!dispatchData || dispatchData.orders.length === 0}>
            <Printer size={16} /> Print Dispatch Sheet
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="table-card" style={{ padding: '18px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ fontWeight: '700' }}>Select Delivery Route</label>
            <select
              className="form-control"
              style={{ width: '300px' }}
              value={selectedRouteId}
              onChange={e => setSelectedRouteId(e.target.value)}
            >
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  🚚 {r.route_name} ({r.route_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: '700' }}>Dispatch Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading daily dispatch data...
        </div>
      ) : !dispatchData || dispatchData.orders.length === 0 ? (
        <div className="table-card" style={{ padding: '40px', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--warning)" style={{ marginBottom: '12px' }} />
          <h3>No Orders Scheduled For This Route Today</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '8px auto 20px' }}>
            No sales or delivery invoices were found for {selectedRouteObj?.route_name || 'selected route'} on {selectedDate}.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div className="stat-card">
              <div className="stat-label">TOTAL SHOPS TO VISIT</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{dispatchData.total_orders}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">TOTAL PACKING UNITS</div>
              <div className="stat-value">
                {dispatchData.packing_list.reduce((acc, p) => acc + p.total_quantity, 0)} Units
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">TOTAL INVOICE VALUE</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {formatCurrency(dispatchData.total_invoice_value, currencySymbol)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">ASSIGNED VEHICLE & DRIVER</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', marginTop: '4px' }}>
                {dispatchData.orders[0]?.vehicle_number || 'WP-DA-4821'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Driver: {dispatchData.orders[0]?.driver_name || 'Sunimal Perera'}
              </div>
            </div>
          </div>

          {/* Section 1: Warehouse Loading / Packing Manifest */}
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                1. Vehicle Packing Manifest (Load on Delivery Mini-Truck)
              </h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jeewaka Herbals Product</th>
                    <th>SKU Code</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Total Quantity to Load</th>
                    <th style={{ textAlign: 'right' }}>Total Wholesale Value</th>
                    <th style={{ textAlign: 'center' }}>Loaded Check</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchData.packing_list.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {item.product_name}
                      </td>
                      <td><code>{item.sku}</code></td>
                      <td><span className="badge badge-purple">{item.batch_number || 'JH-2026-B101'}</span></td>
                      <td>{item.expiry_date || '2028-06-30'}</td>
                      <td style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {item.total_quantity} {item.unit}s
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        {formatCurrency(item.total_value, currencySymbol)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" style={{ transform: 'scale(1.2)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Driver Shop-by-Shop Dropoff Sheet */}
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} color="var(--success)" />
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                2. Driver Dropoff Sheet & Cash/Cheque Collection Log
              </h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stop</th>
                    <th>Invoice #</th>
                    <th>Customer Shop & Location</th>
                    <th>Contact Phone</th>
                    <th>Payment Mode</th>
                    <th style={{ textAlign: 'right' }}>Bill Amount (LKR)</th>
                    <th>Collection Status</th>
                    <th style={{ textAlign: 'center' }}>Customer Signature & Stamp</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchData.orders.map((ord, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '700' }}>#{idx + 1}</td>
                      <td><strong style={{ color: 'var(--primary)' }}>{ord.invoice_number}</strong></td>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{ord.shop_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ord.address}, {ord.town}</div>
                      </td>
                      <td>{ord.telephone}</td>
                      <td>
                        <span className={`badge ${ord.payment_type === 'cash' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase' }}>
                          {ord.payment_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800' }}>
                        {formatCurrency(ord.net_sales, currencySymbol)}
                      </td>
                      <td>
                        <span className={`badge ${ord.collection_status === 'paid' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                          {ord.collection_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', width: '180px' }}>
                        <div style={{ borderBottom: '1px dashed #9ca3af', height: '26px' }}></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default DailyDispatchPage;
