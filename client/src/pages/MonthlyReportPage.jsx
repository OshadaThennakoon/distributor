import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import ExportButtons from '../components/ExportButtons.jsx';
import { BarChart3, Calendar, Download, Printer } from 'lucide-react';

export function MonthlyReportPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [month, setMonth] = useState('2026-08');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/monthly-management?month=${month}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load monthly report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [month, activeDistributorId]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Executive Monthly Management Report (Section 31)</h1>
          <p>Consolidated statutory executive statement linking operational mileage, fuel efficiencies, and unit economics to net profitability.</p>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={month}
              onChange={e => setMonth(e.target.value)}
            >
              <option value="2026-09">September 2026 (Current)</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
              <option value="2026-04">April 2026</option>
              <option value="2026-03">March 2026</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} />
            <span>Print Executive Brief</span>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="table-card" style={{ padding: '40px', textAlign: 'center' }}>Loading statement...</div>
      ) : (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Executive Brief Card */}
          <div className="table-card" style={{ padding: '36px', borderTop: '5px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <span className="badge badge-purple" style={{ marginBottom: '6px' }}>OFFICIAL MANAGEMENT BRIEFING</span>
                <h2 style={{ fontSize: '1.6rem', marginTop: '4px' }}>Monthly Financial & Operational Report</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Reporting Cycle: <strong>{data.month}</strong></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PREPARED FOR</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>Managing Director & CFO</div>
              </div>
            </div>

            {/* Financial Performance Section */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--primary)' }}>1. Financial Statement</h3>
            <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Total Net Sales:</span>
                  <strong>{formatCurrency(data.financialSummary.totalSales, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>COGS:</span>
                  <strong style={{ color: 'var(--warning)' }}>{formatCurrency(data.financialSummary.cogs, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Gross Profit:</span>
                  <strong style={{ color: 'var(--success)' }}>{formatCurrency(data.financialSummary.grossProfit, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Gross Margin %:</span>
                  <strong style={{ color: 'var(--success)' }}>{formatPercent(data.financialSummary.grossMarginPct)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Total Operating Expenses:</span>
                  <strong style={{ color: 'var(--danger)' }}>{formatCurrency(data.financialSummary.operatingExpenses, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Net Operating Profit:</span>
                  <strong style={{ color: data.financialSummary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.05rem' }}>
                    {formatCurrency(data.financialSummary.netProfit, currencySymbol)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Operational & Unit Economics Section */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', color: 'var(--info)' }}>2. Operational Fleet Telemetry & Unit Economics</h3>
            <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Total Kilometres:</span>
                  <strong>{formatNumber(data.operationalSummary.totalKilometres)} km</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Fuel Consumed:</span>
                  <strong>{formatNumber(data.operationalSummary.fuelLitres, 1)} litres</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Fuel Cost:</span>
                  <strong>{formatCurrency(data.operationalSummary.fuelCost, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Average Fleet km/L:</span>
                  <strong>{data.operationalSummary.averageKml} km/L</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Average Cost Per KM:</span>
                  <strong style={{ color: 'var(--primary)' }}>{formatCurrency(data.operationalSummary.averageCostPerKm, currencySymbol)} / km</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Completed Routes:</span>
                  <strong>{data.operationalSummary.routesCompleted} routes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Shop Deliveries / Visits:</span>
                  <strong>{data.operationalSummary.shopVisits} visits</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Average Revenue / Shop:</span>
                  <strong style={{ color: 'var(--success)' }}>{formatCurrency(data.operationalSummary.averageRevenuePerShop, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Average Cost / Shop Visit:</span>
                  <strong style={{ color: 'var(--danger)' }}>{formatCurrency(data.operationalSummary.averageCostPerShop, currencySymbol)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Profit Per Shop Visit:</span>
                  <strong style={{ color: data.operationalSummary.profitPerShop >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(data.operationalSummary.profitPerShop, currencySymbol)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyReportPage;
