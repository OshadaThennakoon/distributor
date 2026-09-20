import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import ExportButtons from '../components/ExportButtons.jsx';
import { TrendingUp, Building2, Navigation, DollarSign, RefreshCw } from 'lucide-react';

export function ProfitabilityPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [routeProfitability, setRouteProfitability] = useState([]);
  const [distributorProfitability, setDistributorProfitability] = useState([]);
  const [activeTab, setActiveTab] = useState('routes');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, dData] = await Promise.all([
        api.get('/reports/route-profitability'),
        api.get('/reports/distributor-profitability')
      ]);
      setRouteProfitability(rData);
      setDistributorProfitability(dData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Route & Distributor Profitability Analysis</h1>
          <p>Critical management intelligence detailing unit economics: revenue per km, cost per shop visit, net operating margins, and profit per km.</p>
        </div>
        <div className="page-actions">
          <ExportButtons reportType="route-profitability" />
        </div>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          Route Profitability Matrix ({routeProfitability.length} Routes)
        </button>
        <button
          className={`tab-btn ${activeTab === 'distributors' ? 'active' : ''}`}
          onClick={() => setActiveTab('distributors')}
        >
          Distributor Multi-Tenant Benchmarking ({distributorProfitability.length})
        </button>
      </div>

      {/* Route Profitability Table (Section 27) */}
      {activeTab === 'routes' && (
        <div className="table-card">
          <div className="table-toolbar">
            <span style={{ fontWeight: '600' }}>Route Level Unit Economics & Net Operating Margin</span>
            <span className="badge badge-purple">Transparent Cost & Margin Allocation</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route Name</th>
                  <th>Shops</th>
                  <th>Visits</th>
                  <th>Total KM</th>
                  <th>Net Sales</th>
                  <th>COGS</th>
                  <th>Gross Profit</th>
                  <th>Route Cost</th>
                  <th>Net Profit</th>
                  <th>Margin %</th>
                  <th>Rev / KM</th>
                  <th>Cost / KM</th>
                  <th>Profit / KM</th>
                  <th>Cost / Shop</th>
                </tr>
              </thead>
              <tbody>
                {routeProfitability.map(r => {
                  const isProfitable = r.netProfit >= 0;
                  return (
                    <tr key={r.routeId}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{r.routeName}</td>
                      <td>{r.shopsCount}</td>
                      <td>{r.visitsCount}</td>
                      <td>{formatNumber(r.distanceKm)} km</td>
                      <td style={{ fontWeight: '600' }}>{formatCurrency(r.salesRevenue, currencySymbol)}</td>
                      <td>{formatCurrency(r.cogs, currencySymbol)}</td>
                      <td style={{ color: 'var(--success)' }}>{formatCurrency(r.grossProfit, currencySymbol)}</td>
                      <td style={{ color: 'var(--danger)' }}>{formatCurrency(r.routeCost, currencySymbol)}</td>
                      <td style={{ fontWeight: '700', color: isProfitable ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(r.netProfit, currencySymbol)}
                      </td>
                      <td>
                        <span className={`badge ${isProfitable ? 'badge-success' : 'badge-danger'}`}>
                          {formatPercent(r.netMarginPct)}
                        </span>
                      </td>
                      <td>{formatCurrency(r.unitEconomics.revenuePerKm, currencySymbol)}</td>
                      <td>{formatCurrency(r.unitEconomics.costPerKm, currencySymbol)}</td>
                      <td style={{ fontWeight: '600', color: isProfitable ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(r.unitEconomics.profitPerKm, currencySymbol)}
                      </td>
                      <td>{formatCurrency(r.unitEconomics.costPerShop, currencySymbol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distributor Profitability Table (Section 28) */}
      {activeTab === 'distributors' && (
        <div className="table-card">
          <div className="table-toolbar">
            <span style={{ fontWeight: '600' }}>Distributor Organization Comparative P&L Performance</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Distributor</th>
                  <th>Sales Revenue</th>
                  <th>COGS</th>
                  <th>Gross Profit</th>
                  <th>Operating Costs</th>
                  <th>Fuel Expenditure</th>
                  <th>Net Profit</th>
                  <th>Margin %</th>
                  <th>Routes</th>
                  <th>Shops</th>
                  <th>Vehicles</th>
                </tr>
              </thead>
              <tbody>
                {distributorProfitability.map(d => (
                  <tr key={d.distributorId}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{d.name} ({d.code})</td>
                    <td style={{ fontWeight: '700' }}>{formatCurrency(d.salesRevenue, d.currencySymbol)}</td>
                    <td>{formatCurrency(d.cogs, d.currencySymbol)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(d.grossProfit, d.currencySymbol)}</td>
                    <td style={{ color: 'var(--danger)' }}>{formatCurrency(d.operatingExpenses, d.currencySymbol)}</td>
                    <td>{formatCurrency(d.fuelCost, d.currencySymbol)}</td>
                    <td style={{ fontWeight: '700', color: d.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(d.netProfit, d.currencySymbol)}
                    </td>
                    <td>
                      <span className={`badge ${d.profitMarginPct >= 0 ? 'badge-success' : 'badge-danger'}`}>
                        {formatPercent(d.profitMarginPct)}
                      </span>
                    </td>
                    <td><span className="badge badge-info">{d.routesCount}</span></td>
                    <td><span className="badge badge-purple">{d.shopsCount}</span></td>
                    <td><span className="badge badge-info">{d.vehiclesCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfitabilityPage;
