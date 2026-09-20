import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import { Calculator, Target, TrendingUp, ShieldAlert, CheckCircle } from 'lucide-react';

export function BreakEvenPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBreakEven() {
      setLoading(true);
      try {
        const res = await api.get('/finance/break-even');
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadBreakEven();
  }, [activeDistributorId]);

  if (loading || !data) {
    return <div className="page-container">Calculating break-even metrics...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Break-Even Financial Intelligence (Section 34)</h1>
          <p>Determine fixed vs variable operational thresholds, required commercial revenue, and outlet contribution margins.</p>
        </div>
      </div>

      {/* Top 4 Break-even Target KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BREAK-EVEN SALES REVENUE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>
            {formatCurrency(data.breakEvenRevenue, currencySymbol)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fixed Costs ÷ Contribution Ratio</div>
        </div>

        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BREAK-EVEN CUSTOMER SHOPS</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--warning)', marginTop: '4px' }}>
            {formatNumber(data.breakEvenShops)} Shops
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minimum active retail outlets required</div>
        </div>

        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--info)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BREAK-EVEN SALES PER ROUTE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--info)', marginTop: '4px' }}>
            {formatCurrency(data.breakEvenRevenuePerRoute, currencySymbol)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Per route loop monthly sales target</div>
        </div>

        <div className="table-card" style={{ padding: '20px', borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SAFETY MARGIN REVENUE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--success)', marginTop: '4px' }}>
            {formatCurrency(data.safetyMarginRevenue, currencySymbol)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{data.safetyMarginPct}% buffer over break-even</div>
        </div>
      </div>

      {/* Detailed Mathematical Decomposition */}
      <div className="table-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Cost Structure & Contribution Margin Decomposition</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '18px', borderRadius: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>FIXED OVERHEAD BASE</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)', marginBottom: '8px' }}>
              {formatCurrency(data.fixedCosts, currencySymbol)}
            </div>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: '1.6' }}>
              <li>Driver fixed salaries</li>
              <li>Warehouse & DC branch rent</li>
              <li>Fleet insurance & annual licenses</li>
              <li>Administrative overheads & utilities</li>
            </ul>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '18px', borderRadius: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>VARIABLE ROUTE COSTS</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--warning)', marginBottom: '8px' }}>
              {formatCurrency(data.variableCosts, currencySymbol)}
            </div>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: '1.6' }}>
              <li>Vehicle diesel / petrol pump cost</li>
              <li>Odometer wear & periodic maintenance</li>
              <li>Highway expressway tolls & parking fees</li>
              <li>Driver route daily meal allowances</li>
            </ul>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '18px', borderRadius: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>CONTRIBUTION MARGIN</h4>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)', marginBottom: '8px' }}>
              {formatPercent(data.contributionMarginRatio * 100)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Every Rs. 100 of net revenue contributes <strong>Rs. {(data.contributionMarginRatio * 100).toFixed(1)}</strong> towards covering fixed operating base.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BreakEvenPage;
