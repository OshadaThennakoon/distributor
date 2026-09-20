import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { Receipt, Eye, Plus, CheckCircle, Package, DollarSign, Filter, Search } from 'lucide-react';

export function SalesPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, prodData] = await Promise.all([
        api.get(`/sales?collectionStatus=${filterStatus}`),
        api.get('/products')
      ]);
      setSales(salesData);
      setProducts(prodData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId, filterStatus]);

  const handleViewInvoice = async (id) => {
    try {
      const data = await api.get(`/sales/${id}`);
      setSelectedInvoice(data);
    } catch (err) {
      alert('Failed to load invoice: ' + err.message);
    }
  };

  const handleCollectPayment = async (saleId, amount) => {
    try {
      await api.post('/payments', {
        sale_id: saleId,
        distributor_id: 1,
        amount,
        payment_method: 'cash'
      });
      alert('Payment collection recorded!');
      if (selectedInvoice) {
        handleViewInvoice(saleId);
      }
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Sales Transactions & Inventory</h1>
          <p>Manage customer orders, trade invoice line items, cost of goods sold (COGS), gross margins, and receivables collections.</p>
        </div>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          Sales Invoices ({sales.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Product Catalog & Stock ({products.length})
        </button>
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Filter Collection:</span>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '6px 12px' }}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">All Invoices</option>
                <option value="paid">Paid Only</option>
                <option value="unpaid">Unpaid / Outstanding Only</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Customer Shop</th>
                  <th>Town</th>
                  <th>Route</th>
                  <th>Gross Sales</th>
                  <th>Discount</th>
                  <th>Net Sales</th>
                  <th>Gross Profit</th>
                  <th>Payment Type</th>
                  <th>Collection</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{s.invoice_number}</strong></td>
                    <td>{formatDate(s.date)}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{s.shop_name}</td>
                    <td>{s.town}</td>
                    <td>{s.route_name ? s.route_name.split(' - ')[1] || s.route_name : '-'}</td>
                    <td>{formatCurrency(s.total_gross, currencySymbol)}</td>
                    <td>{s.discount > 0 ? formatCurrency(s.discount, currencySymbol) : '-'}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
                      {formatCurrency(s.net_sales, currencySymbol)}
                    </td>
                    <td style={{ color: 'var(--success)', fontWeight: '600' }}>
                      {formatCurrency(s.gross_profit, currencySymbol)}
                    </td>
                    <td><span className="badge badge-info">{s.payment_type}</span></td>
                    <td>
                      <span className={`badge ${s.collection_status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                        {s.collection_status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewInvoice(s.id)}
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Unit</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Gross Margin</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const margin = p.selling_price > 0 ? (((p.selling_price - p.cost_price) / p.selling_price) * 100).toFixed(1) : 0;
                  const isLow = p.stock_quantity <= p.min_stock_level;
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.sku}</strong></td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{p.product_name}</td>
                      <td>{p.category_name}</td>
                      <td>{p.brand}</td>
                      <td>{p.unit}</td>
                      <td>{formatCurrency(p.cost_price, currencySymbol)}</td>
                      <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </td>
                      <td><span className="badge badge-success">{margin}%</span></td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-info'}`}>
                          {p.stock_quantity} {p.unit}s
                        </span>
                      </td>
                      <td><span className="badge badge-success">Active</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: View Invoice Details */}
      {selectedInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span className="badge badge-purple">{selectedInvoice.sale.invoice_number}</span>
                <h3 style={{ fontSize: '1.2rem', marginTop: '4px' }}>{selectedInvoice.sale.shop_name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {formatDate(selectedInvoice.sale.date)} | Route: {selectedInvoice.sale.route_name}</p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedInvoice(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Financial summary banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NET INVOICE VALUE</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {formatCurrency(selectedInvoice.sale.net_sales, currencySymbol)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TOTAL COGS</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--warning)' }}>
                    {formatCurrency(selectedInvoice.sale.total_cogs, currencySymbol)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>GROSS PROFIT</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--success)' }}>
                    {formatCurrency(selectedInvoice.sale.gross_profit, currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Invoice Line Items ({selectedInvoice.items.length})</h4>
              <div className="table-responsive" style={{ marginBottom: '20px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Unit Cost</th>
                      <th>Net Total</th>
                      <th>Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map(item => (
                      <tr key={item.id}>
                        <td style={{ color: 'var(--text-primary)' }}>{item.product_name}</td>
                        <td><strong>{item.quantity}</strong></td>
                        <td>{formatCurrency(item.unit_price, currencySymbol)}</td>
                        <td>{formatCurrency(item.unit_cost, currencySymbol)}</td>
                        <td style={{ fontWeight: '600' }}>{formatCurrency(item.net_amount, currencySymbol)}</td>
                        <td style={{ color: 'var(--success)' }}>{formatCurrency(item.gross_profit, currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment status and action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Collection Status: </span>
                  <span className={`badge ${selectedInvoice.sale.collection_status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                    {selectedInvoice.sale.collection_status}
                  </span>
                </div>
                {selectedInvoice.sale.collection_status !== 'paid' && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleCollectPayment(selectedInvoice.sale.id, selectedInvoice.sale.net_sales)}
                  >
                    <CheckCircle size={14} />
                    <span>Record Full Payment Collection</span>
                  </button>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesPage;
