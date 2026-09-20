import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';
import { Sliders, Calculator, ArrowRight, TrendingUp, AlertCircle, RefreshCw, Check } from 'lucide-react';

export function SimulatorPage() {
  const { currencySymbol } = useTenant();

  // Baseline Simulation Inputs (Section 32)
  const [params, setParams] = useState({
    numRoutes: 15,
    avgRouteDistanceKm: 130,
    visitFrequencyDays: 21,
    vehicleEfficiencyKml: 18.0,
    fuelPricePerLitre: 382,
    driverMonthlyCost: 75000,
    maintenancePerKm: 8.0,
    fixedOverheadsMonthly: 150000,
    avgShopsPerRoute: 12,
    avgSalesPerShop: 28000,
    cogsRatio: 0.70
  });

  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pre-configured Scenario Comparator (Section 33)
  const [scenarios, setScenarios] = useState([]);

  const runSimulation = async (inputParams) => {
    setLoading(true);
    try {
      const res = await api.post('/finance/simulate', inputParams);
      setSimResult(res);
      return res;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation(params);
  }, [params]);

  // Generate Comparison Matrix (Section 33)
  useEffect(() => {
    async function loadScenarios() {
      try {
        const [base, scA, scB, scC, scD] = await Promise.all([
          api.post('/finance/simulate', params),
          // Scenario A: Reduce routes from 15 to 12
          api.post('/finance/simulate', { ...params, numRoutes: 12 }),
          // Scenario B: Increase visit frequency to 14 days (biweekly)
          api.post('/finance/simulate', { ...params, visitFrequencyDays: 14 }),
          // Scenario C: Diesel price hike to Rs. 440 (+Rs. 58/L)
          api.post('/finance/simulate', { ...params, fuelPricePerLitre: 440 }),
          // Scenario D: High efficiency vehicle (22 km/L)
          api.post('/finance/simulate', { ...params, vehicleEfficiencyKml: 22.0 })
        ]);

        setScenarios([
          { name: 'Current Baseline', tag: 'Active Model', data: base },
          { name: 'Scenario A: Reduce to 12 Routes', tag: 'Fleet Consolidation', data: scA },
          { name: 'Scenario B: Biweekly Frequency (14 Days)', tag: 'Higher Service Frequency', data: scB },
          { name: 'Scenario C: Fuel Price Spike (Rs. 440/L)', tag: 'Cost Shock Stress Test', data: scC },
          { name: 'Scenario D: Upgrade to 22 km/L Fleet', tag: 'Green / Efficiency Fleet', data: scD }
        ]);
      } catch (e) {
        console.error(e);
      }
    }
    loadScenarios();
  }, [params.fuelPricePerLitre, params.vehicleEfficiencyKml, params.numRoutes, params.visitFrequencyDays]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Route Planning & "What If?" Scenario Simulator</h1>
          <p>Instantly model operational adjustments: route consolidation, fuel price changes, fleet mileage upgrades, and visit frequencies.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Sliders Input Panel */}
        <div className="simulator-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Sliders size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem' }}>Operating Assumptions & Controls</h3>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Number of Active Routes</span>
              <span>{params.numRoutes} routes</span>
            </div>
            <input
              type="range" min="1" max="50" value={params.numRoutes}
              onChange={e => setParams({ ...params, numRoutes: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Average Route Distance</span>
              <span>{params.avgRouteDistanceKm} km</span>
            </div>
            <input
              type="range" min="30" max="300" step="5" value={params.avgRouteDistanceKm}
              onChange={e => setParams({ ...params, avgRouteDistanceKm: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Visit Cycle Frequency</span>
              <span>Every {params.visitFrequencyDays} days ({Number((30 / params.visitFrequencyDays).toFixed(2))} cycles/mo)</span>
            </div>
            <input
              type="range" min="7" max="30" step="1" value={params.visitFrequencyDays}
              onChange={e => setParams({ ...params, visitFrequencyDays: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Vehicle Fuel Efficiency</span>
              <span>{params.vehicleEfficiencyKml} km/L</span>
            </div>
            <input
              type="range" min="8" max="25" step="0.5" value={params.vehicleEfficiencyKml}
              onChange={e => setParams({ ...params, vehicleEfficiencyKml: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Diesel Price Per Litre</span>
              <span>Rs. {params.fuelPricePerLitre} / L</span>
            </div>
            <input
              type="range" min="300" max="550" step="1" value={params.fuelPricePerLitre}
              onChange={e => setParams({ ...params, fuelPricePerLitre: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Maintenance Provision Per KM</span>
              <span>Rs. {params.maintenancePerKm} / km</span>
            </div>
            <input
              type="range" min="3" max="20" step="0.5" value={params.maintenancePerKm}
              onChange={e => setParams({ ...params, maintenancePerKm: Number(e.target.value) })}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Avg Basket Sales Per Shop</span>
              <span>Rs. {formatNumber(params.avgSalesPerShop)}</span>
            </div>
            <input
              type="range" min="10000" max="80000" step="1000" value={params.avgSalesPerShop}
              onChange={e => setParams({ ...params, avgSalesPerShop: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Real-time Dynamic Outputs & Break-Even Analysis */}
        {simResult && (
          <div className="table-card" style={{ padding: '24px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Calculator size={18} color="var(--success)" />
              <h3 style={{ fontSize: '1.1rem' }}>Instant Simulated Outputs & Unit Economics</h3>
            </div>

            {/* Operational Output Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESTIMATED MONTHLY DISTANCE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatNumber(simResult.operational.monthlyDistanceKm)} km
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {params.numRoutes} × {params.avgRouteDistanceKm}km × (30/{params.visitFrequencyDays})
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MONTHLY FUEL LITRES & COST</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--warning)', marginTop: '2px' }}>
                  {formatCurrency(simResult.financial.monthlyFuelCost, currencySymbol)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {formatNumber(simResult.operational.monthlyFuelLitres, 1)} Litres @ Rs. {params.fuelPricePerLitre}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COST PER KILOMETRE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>
                  {formatCurrency(simResult.unitEconomics.costPerKm, currencySymbol)} / km
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>All route & fixed operating costs</div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COST PER SHOP VISIT</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--info)', marginTop: '2px' }}>
                  {formatCurrency(simResult.unitEconomics.costPerShopVisit, currencySymbol)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Across {simResult.operational.totalShopVisitsMonthly} visits/month
                </div>
              </div>
            </div>

            {/* Financial Performance */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monthly Sales:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(simResult.financial.monthlySales, currencySymbol)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gross Profit (30% Margin):</span>
                <strong style={{ color: 'var(--success)' }}>{formatCurrency(simResult.financial.monthlyGrossProfit, currencySymbol)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Operating Expenses:</span>
                <strong style={{ color: 'var(--danger)' }}>({formatCurrency(simResult.financial.totalMonthlyCost, currencySymbol)})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', fontSize: '1.1rem' }}>
                <span style={{ fontWeight: '700' }}>Projected Net Profit:</span>
                <strong style={{ color: simResult.financial.monthlyNetProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(simResult.financial.monthlyNetProfit, currencySymbol)} ({formatPercent(simResult.financial.netProfitMarginPct)})
                </strong>
              </div>
            </div>

            {/* Break-Even Intelligence Box (Section 34) */}
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', padding: '14px', fontSize: '0.85rem' }}>
              <strong style={{ color: 'var(--primary)' }}>Break-Even Target (Section 34):</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span>Break-Even Sales Revenue:</span>
                <strong>{formatCurrency(simResult.breakEven.breakEvenSales, currencySymbol)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Required Deliveries / Visits:</span>
                <strong>{formatNumber(simResult.breakEven.breakEvenVisits)} shop visits</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Break-Even Customer Outlets:</span>
                <strong>{formatNumber(simResult.breakEven.breakEvenShops)} shops</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scenario Comparison Matrix (Section 33) */}
      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Scenario Comparison Matrix (Section 33)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Evaluate strategic distribution trade-offs: frequency vs fuel cost vs fleet fuel economy.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scenario Description</th>
                <th>Monthly Distance</th>
                <th>Fuel Litres</th>
                <th>Monthly Fuel Cost</th>
                <th>Cost / KM</th>
                <th>Cost / Visit</th>
                <th>Net Monthly Profit</th>
                <th>Net Margin %</th>
                <th>Break-Even Revenue</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc, idx) => (
                <tr key={idx} style={{ background: idx === 0 ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                  <td>
                    <div style={{ fontWeight: '600', color: idx === 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {sc.name}
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                      {sc.tag}
                    </span>
                  </td>
                  <td>{formatNumber(sc.data.operational.monthlyDistanceKm)} km</td>
                  <td>{formatNumber(sc.data.operational.monthlyFuelLitres, 1)} L</td>
                  <td style={{ color: 'var(--warning)', fontWeight: '600' }}>
                    {formatCurrency(sc.data.financial.monthlyFuelCost, currencySymbol)}
                  </td>
                  <td>{formatCurrency(sc.data.unitEconomics.costPerKm, currencySymbol)}</td>
                  <td>{formatCurrency(sc.data.unitEconomics.costPerShopVisit, currencySymbol)}</td>
                  <td style={{ fontWeight: '700', color: sc.data.financial.monthlyNetProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(sc.data.financial.monthlyNetProfit, currencySymbol)}
                  </td>
                  <td>
                    <span className={`badge ${sc.data.financial.netProfitMarginPct >= 0 ? 'badge-success' : 'badge-danger'}`}>
                      {formatPercent(sc.data.financial.netProfitMarginPct)}
                    </span>
                  </td>
                  <td style={{ fontWeight: '600' }}>
                    {formatCurrency(sc.data.breakEven.breakEvenSales, currencySymbol)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SimulatorPage;
