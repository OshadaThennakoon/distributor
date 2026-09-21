import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import { 
  Target, Calendar, ChevronLeft, ChevronRight, 
  TrendingUp, DollarSign, Navigation, Plus, 
  CheckCircle2, AlertTriangle, Route, Truck, User 
} from 'lucide-react';

export function DailyPerformancePage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  
  // Default to a date with rich sample data, e.g. '2026-09-02' or today
  const [selectedDate, setSelectedDate] = useState('2026-09-02');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Modals
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showKmModal, setShowKmModal] = useState(false);

  // Forms
  const [targetForm, setTargetForm] = useState({
    distributor_id: 1,
    target_type: 'sales',
    period_type: 'daily',
    target_period: '2026-09-02',
    target_value: 150000,
    route_id: '',
    notes: 'Operational target'
  });

  const [saleForm, setSaleForm] = useState({
    distributor_id: 1,
    date: '2026-09-02',
    route_id: '',
    shop_id: '',
    amount: 25000,
    payment_type: 'cash'
  });

  const [costForm, setCostForm] = useState({
    distributor_id: 1,
    date: '2026-09-02',
    category_id: 4, // Driver Route Allowances
    amount: 2500,
    route_id: '',
    vehicle_id: '',
    description: 'Daily expressway tolls and meals'
  });

  const [kmForm, setKmForm] = useState({
    distributor_id: 1,
    date: '2026-09-02',
    vehicle_id: '',
    driver_id: '',
    route_id: '',
    opening_odometer: 50000,
    closing_odometer: 50135,
    distance_km: 135
  });

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [sumData, shopList, routeList, vList, dList] = await Promise.all([
        api.get(`/daily-operations/summary?date=${selectedDate}`),
        api.get('/shops'),
        api.get('/routes'),
        api.get('/vehicles'),
        api.get('/drivers')
      ]);
      setSummary(sumData);
      setShops(shopList);
      setRoutes(routeList);
      setVehicles(vList);
      setDrivers(dList);

      if (shopList.length > 0 && !saleForm.shop_id) {
        setSaleForm(prev => ({ ...prev, shop_id: shopList[0].id }));
      }
      if (vList.length > 0 && !costForm.vehicle_id) {
        setCostForm(prev => ({ ...prev, vehicle_id: vList[0].id }));
        setKmForm(prev => ({ ...prev, vehicle_id: vList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load daily operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    setTargetForm(prev => ({ ...prev, target_period: selectedDate }));
    setSaleForm(prev => ({ ...prev, date: selectedDate }));
    setCostForm(prev => ({ ...prev, date: selectedDate }));
    setKmForm(prev => ({ ...prev, date: selectedDate }));
  }, [selectedDate, activeDistributorId]);

  const changeDay = (daysOffset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + daysOffset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Submit Handlers
  const handleSaveTarget = async (e) => {
    e.preventDefault();
    try {
      await api.post('/targets', {
        ...targetForm,
        distributor_id: activeDistributorId && activeDistributorId !== 'all' ? Number(activeDistributorId) : 1,
        route_id: targetForm.route_id ? Number(targetForm.route_id) : null,
        target_value: Number(targetForm.target_value)
      });
      setShowTargetModal(false);
      loadSummary();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleQuickSale = async (e) => {
    e.preventDefault();
    try {
      await api.post('/daily-operations/quick-sale', {
        ...saleForm,
        distributor_id: activeDistributorId && activeDistributorId !== 'all' ? Number(activeDistributorId) : 1,
        route_id: saleForm.route_id ? Number(saleForm.route_id) : null,
        shop_id: Number(saleForm.shop_id),
        amount: Number(saleForm.amount)
      });
      setShowSaleModal(false);
      loadSummary();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleQuickCost = async (e) => {
    e.preventDefault();
    try {
      await api.post('/daily-operations/quick-cost', {
        ...costForm,
        distributor_id: activeDistributorId && activeDistributorId !== 'all' ? Number(activeDistributorId) : 1,
        route_id: costForm.route_id ? Number(costForm.route_id) : null,
        vehicle_id: costForm.vehicle_id ? Number(costForm.vehicle_id) : null,
        amount: Number(costForm.amount)
      });
      setShowCostModal(false);
      loadSummary();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleQuickKm = async (e) => {
    e.preventDefault();
    try {
      await api.post('/daily-operations/quick-km', {
        ...kmForm,
        distributor_id: activeDistributorId && activeDistributorId !== 'all' ? Number(activeDistributorId) : 1,
        vehicle_id: Number(kmForm.vehicle_id),
        driver_id: kmForm.driver_id ? Number(kmForm.driver_id) : null,
        route_id: kmForm.route_id ? Number(kmForm.route_id) : null,
        opening_odometer: Number(kmForm.opening_odometer),
        closing_odometer: Number(kmForm.closing_odometer),
        distance_km: Number(kmForm.distance_km)
      });
      setShowKmModal(false);
      loadSummary();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading || !summary) {
    return <div className="page-container">Loading daily operations and target metrics...</div>;
  }

  const { metrics, routeBreakdown } = summary;

  return (
    <div className="page-container">
      {/* Header with Date Navigator */}
      <div className="page-header">
        <div className="page-title">
          <h1>Daily Operations: Target, Sales, Cost & KM</h1>
          <p>Day-by-day execution tracking: monitor actual daily sales against revenue targets, daily operating costs vs budget, and daily fleet kilometres.</p>
        </div>
        
        {/* Date Navigator & Action Controls */}
        <div className="page-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '4px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changeDay(-1)} title="Previous Day">
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '4px 10px', fontSize: '0.88rem', fontWeight: '600', outline: 'none' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => changeDay(1)} title="Next Day">
              <ChevronRight size={16} />
            </button>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
            Today
          </button>
        </div>
      </div>

      {/* Quick Action Logging Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowTargetModal(true)}>
          <Target size={14} />
          <span>Set Daily / Monthly Target</span>
        </button>
        <button className="btn btn-success btn-sm" onClick={() => setShowSaleModal(true)}>
          <Plus size={14} />
          <span>Record Daily Sale</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowCostModal(true)}>
          <DollarSign size={14} />
          <span>Record Daily Cost</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowKmModal(true)}>
          <Navigation size={14} />
          <span>Log Daily KM</span>
        </button>
      </div>

      {/* 4 Core Target vs Actual Performance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* 1. Daily Sales vs Target */}
        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DAILY SALES vs TARGET</span>
            <Target size={16} color="var(--primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {formatCurrency(metrics.dailySales.actual, currencySymbol)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              / {formatCurrency(metrics.dailySales.target, currencySymbol)}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '7px', background: 'var(--bg-surface)', borderRadius: '4px', margin: '12px 0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(metrics.dailySales.achievedPct, 100)}%`, height: '100%', background: metrics.dailySales.achievedPct >= 100 ? 'var(--success)' : 'var(--primary)', borderRadius: '4px' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: metrics.dailySales.achievedPct >= 100 ? 'var(--success)' : 'var(--warning)', fontWeight: '600' }}>
              {formatPercent(metrics.dailySales.achievedPct)} Target Achieved
            </span>
            <span style={{ color: metrics.dailySales.variance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {metrics.dailySales.variance >= 0 ? `+${formatCurrency(metrics.dailySales.variance, currencySymbol)}` : formatCurrency(metrics.dailySales.variance, currencySymbol)}
            </span>
          </div>
        </div>

        {/* 2. Daily Cost vs Budget Target */}
        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DAILY COST vs BUDGET CAP</span>
            <DollarSign size={16} color="var(--warning)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--warning)' }}>
              {formatCurrency(metrics.dailyCost.actual, currencySymbol)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              / {formatCurrency(metrics.dailyCost.target, currencySymbol)} Budget
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '7px', background: 'var(--bg-surface)', borderRadius: '4px', margin: '12px 0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(metrics.dailyCost.budgetUsedPct, 100)}%`, height: '100%', background: metrics.dailyCost.actual > metrics.dailyCost.target ? 'var(--danger)' : 'var(--warning)', borderRadius: '4px' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: metrics.dailyCost.actual <= metrics.dailyCost.target ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
              {formatPercent(metrics.dailyCost.budgetUsedPct)} Budget Consumed
            </span>
            <span style={{ color: metrics.dailyCost.variance <= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {metrics.dailyCost.variance <= 0 ? `${formatCurrency(Math.abs(metrics.dailyCost.variance), currencySymbol)} Under Budget` : `${formatCurrency(metrics.dailyCost.variance, currencySymbol)} Over Budget`}
            </span>
          </div>
        </div>

        {/* 3. Daily Kilometres (KM) vs Target */}
        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DAILY KM vs TARGET DISTANCE</span>
            <Navigation size={16} color="var(--info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--info)' }}>
              {formatNumber(metrics.dailyKm.actual)} km
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              / {formatNumber(metrics.dailyKm.target)} km Target
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '7px', background: 'var(--bg-surface)', borderRadius: '4px', margin: '12px 0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(metrics.dailyKm.achievedPct, 100)}%`, height: '100%', background: 'var(--info)', borderRadius: '4px' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--info)', fontWeight: '600' }}>
              {formatPercent(metrics.dailyKm.achievedPct)} Route KM Traveled
            </span>
            <span>{metrics.dailyKm.tripsCount} Fleet Trips Logged</span>
          </div>
        </div>

        {/* 4. Daily Net Operating Profit */}
        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>DAILY NET OPERATING PROFIT</span>
            <TrendingUp size={16} color="var(--success)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: metrics.dailyProfit.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatCurrency(metrics.dailyProfit.netProfit, currencySymbol)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ({formatPercent(metrics.dailyProfit.marginPct)} Margin)
            </span>
          </div>

          <div style={{ marginTop: '14px', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            <div>• Day Sales: {formatCurrency(metrics.dailySales.actual, currencySymbol)}</div>
            <div>• Less COGS & Daily Costs: ({formatCurrency(metrics.dailyProfit.cogs + metrics.dailyCost.actual, currencySymbol)})</div>
          </div>
        </div>
      </div>

      {/* Route-Wise Breakdown on this Date */}
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Route-Wise Daily Breakdown ({selectedDate})</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detailed day performance by route loop: sales generated, operational cost incurred, and daily distance.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Code</th>
                <th>Route Name</th>
                <th>Assigned Vehicle</th>
                <th>Driver</th>
                <th>Daily Sales</th>
                <th>Daily Gross Profit</th>
                <th>Daily Cost</th>
                <th>Daily KM</th>
                <th>Cost / KM</th>
                <th>Day Net Profit</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {routeBreakdown.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No route activities recorded on {selectedDate}. Use the Quick Action buttons above to log sales, costs, or KM.
                  </td>
                </tr>
              ) : (
                routeBreakdown.map(r => (
                  <tr key={r.route_id}>
                    <td><strong style={{ color: 'var(--primary)' }}>{r.route_code}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{r.route_name}</td>
                    <td>{r.vehicle_number || '-'}</td>
                    <td>{r.driver_name || '-'}</td>
                    <td style={{ fontWeight: '700', color: r.day_sales > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {formatCurrency(r.day_sales, currencySymbol)}
                    </td>
                    <td style={{ color: 'var(--success)' }}>
                      {formatCurrency(r.day_gross_profit, currencySymbol)}
                    </td>
                    <td style={{ color: 'var(--danger)', fontWeight: '600' }}>
                      {formatCurrency(r.day_total_cost, currencySymbol)}
                    </td>
                    <td>{r.day_km > 0 ? `${formatNumber(r.day_km)} km` : '-'}</td>
                    <td>{r.cost_per_km > 0 ? `${formatCurrency(r.cost_per_km, currencySymbol)}/km` : '-'}</td>
                    <td style={{ fontWeight: '700', color: r.day_net_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(r.day_net_profit, currencySymbol)}
                    </td>
                    <td>
                      <span className={`badge ${r.day_margin_pct >= 0 ? 'badge-success' : 'badge-danger'}`}>
                        {formatPercent(r.day_margin_pct)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Set / Edit Target */}
      {showTargetModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Configure Operational Target (Section 32 & Enhancement)</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowTargetModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTarget}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Target Type *</label>
                    <select className="form-control" value={targetForm.target_type} onChange={e => setTargetForm({...targetForm, target_type: e.target.value})}>
                      <option value="sales">Sales Target (Rs.)</option>
                      <option value="cost">Operating Cost Budget Cap (Rs.)</option>
                      <option value="km">Distance Target (KM)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Period Type *</label>
                    <select className="form-control" value={targetForm.period_type} onChange={e => {
                      const pt = e.target.value;
                      setTargetForm({
                        ...targetForm,
                        period_type: pt,
                        target_period: pt === 'monthly' ? selectedDate.substring(0, 7) : selectedDate
                      });
                    }}>
                      <option value="daily">Daily Target</option>
                      <option value="monthly">Monthly Target</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Target Period *</label>
                    <input className="form-control" required value={targetForm.target_period} onChange={e => setTargetForm({...targetForm, target_period: e.target.value})} placeholder={targetForm.period_type === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD'} />
                  </div>
                  <div className="form-group">
                    <label>Target Value * ({targetForm.target_type === 'km' ? 'KM' : 'Rs.'})</label>
                    <input className="form-control" type="number" step="100" required value={targetForm.target_value} onChange={e => setTargetForm({...targetForm, target_value: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Assign to Specific Route (Optional - leave blank for Distributor wide)</label>
                  <select className="form-control" value={targetForm.route_id} onChange={e => setTargetForm({...targetForm, route_id: e.target.value})}>
                    <option value="">Distributor-wide Overall Target</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.route_code} - {r.route_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes / Context</label>
                  <input className="form-control" value={targetForm.notes} onChange={e => setTargetForm({...targetForm, notes: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTargetModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Target</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Daily Sale */}
      {showSaleModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Daily Sale Transaction</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowSaleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickSale}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Sale Date *</label>
                    <input className="form-control" type="date" required value={saleForm.date} onChange={e => setSaleForm({...saleForm, date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Customer Outlet / Shop *</label>
                    <select className="form-control" required value={saleForm.shop_id} onChange={e => setSaleForm({...saleForm, shop_id: e.target.value})}>
                      {shops.map(sh => (
                        <option key={sh.id} value={sh.id}>{sh.shop_code} - {sh.shop_name} ({sh.town})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Route</label>
                    <select className="form-control" value={saleForm.route_id} onChange={e => setSaleForm({...saleForm, route_id: e.target.value})}>
                      <option value="">Select Route</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.route_code} - {r.route_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Net Sale Amount (Rs.) *</label>
                    <input className="form-control" type="number" required value={saleForm.amount} onChange={e => setSaleForm({...saleForm, amount: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Daily Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Daily Cost */}
      {showCostModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Daily Operating Cost</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowCostModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickCost}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input className="form-control" type="date" required value={costForm.date} onChange={e => setCostForm({...costForm, date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Cost Category *</label>
                    <select className="form-control" value={costForm.category_id} onChange={e => setCostForm({...costForm, category_id: Number(e.target.value)})}>
                      <option value="4">Driver Route Allowances</option>
                      <option value="7">Expressway Tolls & Parking</option>
                      <option value="8">Loading & Unloading Fees</option>
                      <option value="1">Fuel & Oil Purchase</option>
                      <option value="2">Immediate Vehicle Repair</option>
                      <option value="10">General Administration</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Amount (Rs.) *</label>
                    <input className="form-control" type="number" required value={costForm.amount} onChange={e => setCostForm({...costForm, amount: Number(e.target.value)})} />
                  </div>
                  <div className="form-group">
                    <label>Route (Optional)</label>
                    <select className="form-control" value={costForm.route_id} onChange={e => setCostForm({...costForm, route_id: e.target.value})}>
                      <option value="">Select Route</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.route_code} - {r.route_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input className="form-control" value={costForm.description} onChange={e => setCostForm({...costForm, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCostModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Daily Cost</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Daily KM */}
      {showKmModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log Daily Vehicle Kilometres</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowKmModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickKm}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input className="form-control" type="date" required value={kmForm.date} onChange={e => setKmForm({...kmForm, date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Vehicle *</label>
                    <select className="form-control" required value={kmForm.vehicle_id} onChange={e => setKmForm({...kmForm, vehicle_id: e.target.value})}>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicle_number} ({v.brand} {v.model})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Opening Odometer (km)</label>
                    <input className="form-control" type="number" value={kmForm.opening_odometer} onChange={e => {
                      const open = Number(e.target.value);
                      const close = kmForm.closing_odometer;
                      setKmForm({...kmForm, opening_odometer: open, distance_km: Math.max(close - open, 0)});
                    }} />
                  </div>
                  <div className="form-group">
                    <label>Closing Odometer (km)</label>
                    <input className="form-control" type="number" value={kmForm.closing_odometer} onChange={e => {
                      const close = Number(e.target.value);
                      const open = kmForm.opening_odometer;
                      setKmForm({...kmForm, closing_odometer: close, distance_km: Math.max(close - open, 0)});
                    }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Total Distance Run (KM) *</label>
                  <input className="form-control" type="number" required value={kmForm.distance_km} onChange={e => setKmForm({...kmForm, distance_km: Number(e.target.value)})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKmModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Daily KM</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyPerformancePage;
