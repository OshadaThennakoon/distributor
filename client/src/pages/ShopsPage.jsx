import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency } from '../utils/formatters.js';
import { Store, Plus, Search, Filter, Phone, MapPin, AlertCircle } from 'lucide-react';

export function ShopsPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New shop form
  const [shopForm, setShopForm] = useState({
    distributor_id: 1,
    route_id: '',
    shop_name: '',
    shop_code: '',
    owner_name: '',
    telephone: '',
    address: '',
    town: 'Kekirawa',
    district: 'Anuradhapura',
    customer_type: 'Retail shop',
    credit_limit: 50000,
    payment_terms_days: 14
  });

  const loadShops = async () => {
    setLoading(true);
    try {
      const [shopData, routeData] = await Promise.all([
        api.get(`/shops?routeId=${selectedRoute}&customerType=${selectedType}&search=${searchTerm}`),
        api.get('/routes')
      ]);
      setShops(shopData);
      setRoutes(routeData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, [activeDistributorId, selectedRoute, selectedType]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadShops();
  };

  const handleCreateShop = async (e) => {
    e.preventDefault();
    try {
      await api.post('/shops', shopForm);
      setShowAddModal(false);
      setShopForm({
        distributor_id: 1,
        route_id: '',
        shop_name: '',
        shop_code: '',
        owner_name: '',
        telephone: '',
        address: '',
        town: 'Kekirawa',
        district: 'Anuradhapura',
        customer_type: 'Retail shop',
        credit_limit: 50000,
        payment_terms_days: 14
      });
      loadShops();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Shop & Customer Outlet Management</h1>
          <p>Maintain customer master data, commercial payment terms, assigned routes, and credit limits.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            <span>Register New Shop</span>
          </button>
        </div>
      </div>

      <div className="table-card">
        {/* Toolbar & Filter Bar */}
        <div className="table-toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div className="search-input-box">
              <Search size={16} color="var(--text-muted)" />
              <input
                placeholder="Search shop, code, owner, town..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          </form>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
            >
              <option value="all">All Routes (15)</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.route_code} - {r.route_name.split(' - ')[1] || r.route_name}</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="all">All Customer Types</option>
              <option value="Retail shop">Retail shop</option>
              <option value="Supermarket">Supermarket</option>
              <option value="Grocery">Grocery</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Hotel">Hotel</option>
            </select>
          </div>
        </div>

        {/* Shops Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Shop Name</th>
                <th>Owner & Contact</th>
                <th>Assigned Route</th>
                <th>Town</th>
                <th>Type</th>
                <th>Credit Limit</th>
                <th>Terms</th>
                <th>Outstanding</th>
                <th>Next Visit Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shops.map(sh => (
                <tr key={sh.id}>
                  <td><strong>{sh.shop_code}</strong></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{sh.shop_name}</td>
                  <td>
                    <div>{sh.owner_name || '-'}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{sh.telephone}</div>
                  </td>
                  <td>{sh.route_name ? sh.route_name.split(' - ')[1] || sh.route_name : 'Unassigned'}</td>
                  <td>{sh.town}</td>
                  <td><span className="badge badge-purple">{sh.customer_type}</span></td>
                  <td>{formatCurrency(sh.credit_limit, currencySymbol)}</td>
                  <td>{sh.payment_terms_days} days</td>
                  <td style={{ color: sh.outstanding_balance > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: '600' }}>
                    {sh.outstanding_balance > 0 ? formatCurrency(sh.outstanding_balance, currencySymbol) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${sh.visit_status === 'overdue' ? 'badge-danger' : sh.visit_status === 'due_today' ? 'badge-warning' : 'badge-info'}`}>
                      {sh.next_visit_date || '-'}
                    </span>
                  </td>
                  <td><span className="badge badge-success">{sh.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Shop */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Customer Outlet</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateShop}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Shop Code *</label>
                    <input className="form-control" required placeholder="e.g. SH-101" value={shopForm.shop_code} onChange={e => setShopForm({...shopForm, shop_code: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Shop Name *</label>
                    <input className="form-control" required placeholder="e.g. Ruhunu City Bakers" value={shopForm.shop_name} onChange={e => setShopForm({...shopForm, shop_name: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned Route *</label>
                    <select className="form-control" value={shopForm.route_id} onChange={e => setShopForm({...shopForm, route_id: Number(e.target.value)})}>
                      <option value="">Select Route</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.route_code} - {r.route_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Customer Type</label>
                    <select className="form-control" value={shopForm.customer_type} onChange={e => setShopForm({...shopForm, customer_type: e.target.value})}>
                      <option value="Retail shop">Retail shop</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Grocery">Grocery</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input className="form-control" placeholder="e.g. Nimal Jayawardena" value={shopForm.owner_name} onChange={e => setShopForm({...shopForm, owner_name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Telephone</label>
                    <input className="form-control" placeholder="+94 77 000 0000" value={shopForm.telephone} onChange={e => setShopForm({...shopForm, telephone: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Credit Limit (Rs.)</label>
                    <input className="form-control" type="number" value={shopForm.credit_limit} onChange={e => setShopForm({...shopForm, credit_limit: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Payment Terms (Days)</label>
                    <input className="form-control" type="number" value={shopForm.payment_terms_days} onChange={e => setShopForm({...shopForm, payment_terms_days: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Town</label>
                    <input className="form-control" value={shopForm.town} onChange={e => setShopForm({...shopForm, town: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <input className="form-control" value={shopForm.district} onChange={e => setShopForm({...shopForm, district: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Shop</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopsPage;
