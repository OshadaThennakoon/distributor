import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters.js';
import ExportButtons from '../components/ExportButtons.jsx';
import { FileSpreadsheet, Filter, RefreshCw, Calendar } from 'lucide-react';

export function ReportsHubPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [selectedReport, setSelectedReport] = useState('daily-sales');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reportsList = [
    { id: 'daily-sales', label: '1. Daily Sales Report' },
    { id: 'weekly-sales', label: '2. Weekly Sales Report' },
    { id: 'monthly-sales', label: '3. Monthly Sales Progression Report' },
    { id: 'profit-loss', label: '4. Monthly Profit & Loss Statement (P&L)' },
    { id: 'expense', label: '5. Operating Expense Categorization Report' },
    { id: 'fuel', label: '6. Fuel Expense & Consumption Log Report' },
    { id: 'vehicle-cost', label: '7. Vehicle Running Cost & Fleet Report' },
    { id: 'route-cost', label: '8. Route Operating Cost Analysis Report' },
    { id: 'route-profitability', label: '9. Route Profitability & Unit Economics Report' },
    { id: 'distributor-profitability', label: '10. Multi-Distributor Corporate Comparison' },
    { id: 'territory-profitability', label: '11. Territory Sales & Distribution Density Report' },
    { id: 'customer-sales', label: '12. Customer / Shop Purchasing & Balance Report' },
    { id: 'product-sales', label: '13. Product Sales, Movement & Margin Report' },
    { id: 'driver-expense', label: '14. Driver Expense & Trips Performance Report' },
    { id: 'maintenance', label: '15. Vehicle Maintenance & Periodic Service Report' },
    { id: 'receivables', label: '16. Accounts Receivables Aging & Credit Report' },
    { id: 'cost-per-km', label: '17. Cost-per-Kilometre Efficiency Analysis' },
    { id: 'cost-per-shop', label: '18. Cost-per-Shop Visit Economic Benchmark' },
    { id: 'monthly-km', label: '19. Monthly Odometer & Kilometre Run Report' },
    { id: 'fuel-efficiency', label: '20. Fuel Efficiency Variance & Anomaly Audit' }
  ];

  const loadReport = async () => {
    setLoading(true);
    try {
      let url = `/reports/${selectedReport}?`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;
      const data = await api.get(url);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedReport, activeDistributorId]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Financial & Management Reports Hub</h1>
          <p>Complete suite of 20 statutory and managerial distribution reports with Excel (.xlsx), CSV, and Print export capabilities.</p>
        </div>
        <div className="page-actions">
          <ExportButtons reportType={selectedReport} />
        </div>
      </div>

      {/* Report Selection & Filter Toolbar */}
      <div className="table-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '280px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              SELECT FINANCIAL REPORT (1 - 20)
            </label>
            <select
              className="form-control"
              value={selectedReport}
              onChange={e => setSelectedReport(e.target.value)}
              style={{ fontWeight: '600' }}
            >
              {reportsList.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              START DATE
            </label>
            <input className="form-control" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              END DATE
            </label>
            <input className="form-control" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={loadReport}>
              <Filter size={14} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Report Content Rendering */}
      <div className="table-card">
        <div className="table-toolbar">
          <span style={{ fontWeight: '600' }}>
            {reportsList.find(r => r.id === selectedReport)?.label}
          </span>
          <span className="badge badge-info">Active Scoping Applied</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin" size={24} color="var(--primary)" />
            <p style={{ marginTop: '10px' }}>Generating report records...</p>
          </div>
        ) : !reportData ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No data available.</div>
        ) : selectedReport === 'profit-loss' ? (
          /* Render P&L Statement Formatted (Section 21) */
          <div style={{ padding: '24px' }}>
            <div style={{ maxWidth: '750px', margin: '0 auto', background: 'var(--bg-surface)', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
                Profit & Loss Statement - {reportData.month}
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>Gross Sales</span>
                <strong>{formatCurrency(reportData.revenue.grossSales, currencySymbol)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                <span>Less: Commercial Discounts</span>
                <span>({formatCurrency(reportData.revenue.discounts, currencySymbol)})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', fontWeight: '700', fontSize: '1.05rem' }}>
                <span>Net Sales (Revenue)</span>
                <span style={{ color: 'var(--primary)' }}>{formatCurrency(reportData.revenue.netSales, currencySymbol)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', color: 'var(--warning)', marginTop: '8px' }}>
                <span>Less: Cost of Goods Sold (COGS)</span>
                <strong>({formatCurrency(reportData.cogs, currencySymbol)})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '2px solid var(--border-subtle)', fontWeight: '800', fontSize: '1.15rem', color: 'var(--success)' }}>
                <span>Gross Operating Profit (Margin: {reportData.grossMarginPct}%)</span>
                <span>{formatCurrency(reportData.grossProfit, currencySymbol)}</span>
              </div>

              <div style={{ marginTop: '20px', marginBottom: '8px', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                OPERATING EXPENSES (OPEX):
              </div>
              {reportData.operatingExpenses.map((exp, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>• {exp.category_name}</span>
                  <span>{formatCurrency(exp.total_amount, currencySymbol)}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', fontWeight: '700', color: 'var(--danger)', marginTop: '10px' }}>
                <span>Total Operating Expenses</span>
                <span>({formatCurrency(reportData.totalOperatingExpenses, currencySymbol)})</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 14px', marginTop: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontWeight: '800', fontSize: '1.25rem', color: reportData.netOperatingProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                <span>NET OPERATING PROFIT</span>
                <span>{formatCurrency(reportData.netOperatingProfit, currencySymbol)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Generic Data Table for All Other 19 Reports */
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(Array.isArray(reportData) ? (reportData[0] || {}) : (reportData.rows?.[0] || {})).map((col, idx) => (
                    <th key={idx}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(reportData) ? reportData : (reportData.rows || [])).map((row, rIdx) => (
                  <tr key={rIdx}>
                    {Object.entries(row).map(([k, val], cIdx) => (
                      <td key={cIdx}>
                        {typeof val === 'number' && (k.includes('cost') || k.includes('sales') || k.includes('profit') || k.includes('amount') || k.includes('total'))
                          ? formatCurrency(val, currencySymbol)
                          : typeof val === 'number' && k.includes('km')
                          ? `${formatNumber(val)} km`
                          : typeof val === 'object' && val !== null
                          ? JSON.stringify(val)
                          : String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsHubPage;
