import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { 
  Receipt, Plus, Trash2, Printer, CheckCircle, AlertTriangle, 
  Store, Route, Package, Calendar, User, CreditCard, DollarSign, X
} from 'lucide-react';

export function QuickBillingPage() {
  const { activeDistributorId, currencySymbol } = useTenant();

  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [salesRep, setSalesRep] = useState('Nalinda (Distributor)');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState('credit');
  const [collectionStatus, setCollectionStatus] = useState('unpaid');
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Line Items
  const [items, setItems] = useState([
    { productId: '', quantity: 1, discountPercent: 0 }
  ]);

  // Invoice Print / Preview Modal
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBillingData();
  }, [activeDistributorId]);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const [routesData, shopsData, prodsData, driversData] = await Promise.all([
        api.get('/routes'),
        api.get('/shops'),
        api.get('/products'),
        api.get('/drivers')
      ]);
      setRoutes(routesData);
      setShops(shopsData);
      setProducts(prodsData);
      setDrivers(driversData);

      if (routesData.length > 0) setSelectedRouteId(routesData[0].id.toString());
      if (driversData.length > 0) setSelectedDriverId(driversData[0].id.toString());
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter shops by chosen route
  const filteredShops = selectedRouteId 
    ? shops.filter(s => s.route_id === Number(selectedRouteId)) 
    : shops;

  const currentShop = shops.find(s => s.id === Number(selectedShopId));

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, discountPercent: 0 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Financial Calculations
  const calculatedItems = items.map(item => {
    const prod = products.find(p => p.id === Number(item.productId));
    const unitPrice = prod ? prod.selling_price : 0;
    const unitCost = prod ? prod.cost_price : 0;
    const mrp = prod ? (prod.mrp || prod.selling_price * 1.2) : 0;
    const qty = Number(item.quantity) || 0;
    const discPercent = Number(item.discountPercent) || 0;
    const gross = qty * unitPrice;
    const discAmount = gross * (discPercent / 100);
    const net = gross - discAmount;
    const cogs = qty * unitCost;
    const profit = net - cogs;

    return {
      ...item,
      product: prod,
      unitPrice,
      unitCost,
      mrp,
      gross,
      discAmount,
      net,
      cogs,
      profit
    };
  });

  const totalGross = calculatedItems.reduce((acc, i) => acc + i.gross, 0);
  const totalItemDiscounts = calculatedItems.reduce((acc, i) => acc + i.discAmount, 0);
  const totalDiscount = totalItemDiscounts + Number(overallDiscount || 0);
  const netSales = Math.max(0, totalGross - totalDiscount);
  const totalCogs = calculatedItems.reduce((acc, i) => acc + i.cogs, 0);
  const grossProfit = netSales - totalCogs;
  const marginPercent = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShopId) {
      alert('Please select a customer shop.');
      return;
    }

    const validItems = calculatedItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      alert('Please add at least one product with valid quantity.');
      return;
    }

    // Check stock warning
    for (const item of validItems) {
      if (item.product && item.quantity > item.product.stock_quantity) {
        const proceed = confirm(`Warning: Order quantity (${item.quantity}) for "${item.product.product_name}" exceeds warehouse stock (${item.product.stock_quantity}). Do you still wish to proceed?`);
        if (!proceed) return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        distributor_id: Number(activeDistributorId) || 1,
        route_id: Number(selectedRouteId),
        shop_id: Number(selectedShopId),
        driver_id: Number(selectedDriverId) || null,
        date: invoiceDate,
        sales_rep: salesRep,
        discount: Number(totalDiscount),
        payment_type: paymentType,
        collection_status: paymentType === 'cash' ? 'paid' : collectionStatus,
        notes,
        items: validItems.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitPrice: i.unitPrice,
          unitCost: i.unitCost,
          discountPercent: Number(i.discountPercent) || 0
        }))
      };

      const res = await api.post('/sales', payload);
      
      // Load created invoice details for printable view
      const fullInvoice = await api.get(`/sales/${res.id}`);
      setCreatedInvoice(fullInvoice);

      // Reset form
      setItems([{ productId: '', quantity: 1, discountPercent: 0 }]);
      setOverallDiscount(0);
      setNotes('');
    } catch (err) {
      alert('Error creating invoice: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>🌿 Jeewaka Herbals Quick Invoice & Billing Point</h1>
          <p>Rapid wholesale invoice creation, wholesale vs MRP discounting, credit limit enforcement, and print-ready receipts.</p>
        </div>
        <div className="page-actions">
          <span className="badge badge-success" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            Hub: Dambulla / North Central
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
          
          {/* Left Column: Route, Shop & Line Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Step 1: Route & Customer Outlets */}
            <div className="table-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Route size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>1. Route & Customer Selection</h3>
              </div>
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Select Delivery Route *</label>
                  <select
                    className="form-control"
                    value={selectedRouteId}
                    onChange={e => {
                      setSelectedRouteId(e.target.value);
                      setSelectedShopId(''); // reset shop
                    }}
                    required
                  >
                    <option value="">-- Choose Route --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        📍 {r.route_name} ({r.route_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: '600' }}>Select Customer Shop / Pharmacy *</label>
                  <select
                    className="form-control"
                    value={selectedShopId}
                    onChange={e => setSelectedShopId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Shop ({filteredShops.length} on Route) --</option>
                    {filteredShops.map(s => (
                      <option key={s.id} value={s.id}>
                        🏪 {s.shop_name} - {s.town} ({s.customer_type})
                      </option>
                    ))}
                  </select>
                </div>

                {currentShop && (
                  <div style={{ gridColumn: 'span 2', background: 'var(--bg-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Owner:</span><br />
                        <strong>{currentShop.owner_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Contact:</span><br />
                        <strong>{currentShop.telephone}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Credit Limit:</span><br />
                        <strong style={{ color: 'var(--warning)' }}>{formatCurrency(currentShop.credit_limit, currencySymbol)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Terms:</span><br />
                        <strong>{currentShop.payment_terms_days} Days Credit</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Line Items */}
            <div className="table-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>2. Jeewaka Herbals Order Products</h3>
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddItem}>
                  <Plus size={14} /> Add Product Line
                </button>
              </div>

              <div className="table-responsive" style={{ padding: '0' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38%' }}>Jeewaka Product Item</th>
                      <th style={{ width: '12%' }}>Stock Available</th>
                      <th style={{ width: '12%' }}>Quantity</th>
                      <th style={{ width: '14%' }}>Wholesale (LKR)</th>
                      <th style={{ width: '10%' }}>Discount %</th>
                      <th style={{ width: '12%' }}>Net (LKR)</th>
                      <th style={{ width: '4%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="form-control"
                            value={item.productId}
                            onChange={e => handleItemChange(idx, 'productId', e.target.value)}
                            required
                          >
                            <option value="">-- Select Product --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.product_name} ({p.sku}) | Batch: {p.batch_number || 'N/A'}
                              </option>
                            ))}
                          </select>
                          {item.product && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              MRP: {formatCurrency(item.mrp, currencySymbol)} | Exp: {item.product.expiry_date || '2028-12-31'}
                            </div>
                          )}
                        </td>
                        <td>
                          {item.product ? (
                            <span className={`badge ${item.product.stock_quantity <= item.product.min_stock_level ? 'badge-danger' : 'badge-info'}`}>
                              {item.product.stock_quantity} {item.product.unit}s
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                            required
                          />
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {item.unitPrice > 0 ? formatCurrency(item.unitPrice, currencySymbol) : '-'}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="form-control"
                            value={item.discountPercent}
                            onChange={e => handleItemChange(idx, 'discountPercent', e.target.value)}
                          />
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          {formatCurrency(item.net, currencySymbol)}
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveItem(idx)}
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery & Logistics Assignment */}
            <div className="table-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} /> Delivery Schedule & Logistics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Assigned Delivery Driver</label>
                  <select
                    className="form-control"
                    value={selectedDriverId}
                    onChange={e => setSelectedDriverId(e.target.value)}
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.phone})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Sales Representative</label>
                  <input
                    type="text"
                    className="form-control"
                    value={salesRep}
                    onChange={e => setSalesRep(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginTop: '14px' }}>
                <label className="form-label">Delivery Notes / Special Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Leave with Pharmacy Manager, Collect cash or cheque on delivery"
                  className="form-control"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

          </div>

          {/* Right Column: Checkout & Financial Totals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                Invoice Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gross Wholesale Total:</span>
                  <strong>{formatCurrency(totalGross, currencySymbol)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Additional Discount (LKR):</span>
                  <input
                    type="number"
                    min="0"
                    style={{ width: '110px', textAlign: 'right', padding: '4px 8px' }}
                    className="form-control"
                    value={overallDiscount}
                    onChange={e => setOverallDiscount(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                  <span>Total Discounts:</span>
                  <strong>-{formatCurrency(totalDiscount, currencySymbol)}</strong>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>Final Amount Payable:</span>
                  <span style={{ fontSize: '1.45rem', fontWeight: '900', color: 'var(--primary)' }}>
                    {formatCurrency(netSales, currencySymbol)}
                  </span>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success)' }}>
                    <span>Estimated Distributor Margin:</span>
                    <strong>{formatCurrency(grossProfit, currencySymbol)} ({marginPercent}%)</strong>
                  </div>
                </div>
              </div>

              {/* Payment Settings */}
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Payment Mode & Settlement</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
                  {['cash', 'credit', 'cheque', 'bank_transfer'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`btn btn-sm ${paymentType === type ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'capitalize' }}
                      onClick={() => {
                        setPaymentType(type);
                        setCollectionStatus(type === 'cash' ? 'paid' : 'unpaid');
                      }}
                    >
                      {type === 'cash' && '💵 Cash (Paid)'}
                      {type === 'credit' && '📝 Credit Line'}
                      {type === 'cheque' && '🏦 Cheque'}
                      {type === 'bank_transfer' && '📱 Bank Transfer'}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Status: <strong>{paymentType === 'cash' ? 'Settled Instantly' : 'Outstanding Receivables (Due in 14-21 days)'}</strong>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '1rem', fontWeight: '700' }}
                disabled={submitting}
              >
                {submitting ? 'Generating Invoice...' : '✅ Save & Issue Invoice'}
              </button>
            </div>

          </div>

        </div>
      </form>

      {/* Invoice Receipt Preview Modal */}
      {createdInvoice && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div>
                <span className="badge badge-success">INVOICE ISSUED SUCCESSFULLY</span>
                <h2 style={{ fontSize: '1.3rem', margin: '4px 0' }}>{createdInvoice.sale.invoice_number}</h2>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setCreatedInvoice(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" id="printable-invoice" style={{ padding: '24px', background: '#ffffff', color: '#111827', borderRadius: '8px' }}>
              
              {/* Receipt Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #10b981', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ color: '#065f46', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>JEEWAKA HERBALS</h2>
                  <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#4b5563' }}>Authorized Wholesale Distributor Point</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Dambulla Regional Hub, Central Province | Tel: +94 66 228 4890</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827' }}>TAX / TRADE INVOICE</h3>
                  <p style={{ margin: '2px 0', fontWeight: '700', color: '#059669' }}>{createdInvoice.sale.invoice_number}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#4b5563' }}>Date: {formatDate(createdInvoice.sale.date)}</p>
                </div>
              </div>

              {/* Billed To */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px', background: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Billed Customer Outlet:</span>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#111827' }}>{createdInvoice.sale.shop_name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>{createdInvoice.sale.address}, {createdInvoice.sale.town}</div>
                  <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>Tel: {createdInvoice.sale.telephone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Route & Logistics:</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{createdInvoice.sale.route_name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>Payment Mode: <strong style={{ textTransform: 'uppercase' }}>{createdInvoice.sale.payment_type}</strong></div>
                  <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>Status: <strong>{createdInvoice.sale.collection_status.toUpperCase()}</strong></div>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Product Description</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Wholesale</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Disc %</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {createdInvoice.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px' }}>
                        <strong>{item.product_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>SKU: {item.sku} | Unit: {item.unit}</div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700' }}>{item.quantity}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unit_price, 'Rs.')}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{item.discount_percent}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.net_amount, 'Rs.')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                <div style={{ width: '260px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Gross Total:</span>
                    <span>{formatCurrency(createdInvoice.sale.total_gross, 'Rs.')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#dc2626' }}>
                    <span>Discount:</span>
                    <span>-{formatCurrency(createdInvoice.sale.discount, 'Rs.')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #111827', fontWeight: '800', fontSize: '1.15rem', color: '#065f46' }}>
                    <span>Net Total Payable:</span>
                    <span>{formatCurrency(createdInvoice.sale.net_sales, 'Rs.')}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center', fontSize: '0.8rem', marginTop: '40px', borderTop: '1px dashed #9ca3af', paddingTop: '15px' }}>
                <div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px' }}>Prepared By (Distributor)</div>
                </div>
                <div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px' }}>Delivery Driver / Rider</div>
                </div>
                <div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #4b5563', paddingTop: '4px' }}>Customer Shop Seal & Signature</div>
                </div>
              </div>

            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setCreatedInvoice(null)}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint}>
                <Printer size={16} /> Print Official Invoice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default QuickBillingPage;
