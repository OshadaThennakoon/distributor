import React, { useEffect, useState } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  TrendingUp, DollarSign, Fuel, Navigation, 
  Store, Truck, AlertTriangle, Lightbulb, Compass, 
  CheckCircle2, Clock, RefreshCw 
} from 'lucide-react';
import KPICard from '../components/KPICard.jsx';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

export function DashboardPage({ setCurrentView }) {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [activeDistributorId]);

  if (loading || !data) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Compiling corporate intelligence metrics...</p>
      </div>
    );
  }

  const { kpis, charts, insights } = data;

  // Chart 1: Revenue & Profit Trend
  const trendLabels = charts.monthlyTrend.map(m => m.month);
  const revenueTrendData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Net Sales Revenue',
        data: charts.monthlyTrend.map(m => m.sales),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5
      },
      {
        label: 'Gross Profit',
        data: charts.monthlyTrend.map(m => m.grossProfit),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.35
      },
      {
        label: 'Operating Expenses',
        data: charts.monthlyTrend.map(m => m.expenses),
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.35
      }
    ]
  };

  // Chart 2: Expense Breakdown Doughnut
  const expenseDoughnutData = {
    labels: charts.expenseBreakdown.map(e => e.name),
    datasets: [
      {
        data: charts.expenseBreakdown.map(e => e.amount),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'],
        borderWidth: 0
      }
    ]
  };

  // Chart 3: Top Routes Profitability Comparison Bar Chart
  const routeLabels = charts.routeComparison.map(r => r.routeName);
  const routeBarData = {
    labels: routeLabels,
    datasets: [
      {
        label: 'Sales Revenue',
        data: charts.routeComparison.map(r => r.salesRevenue),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        label: 'Net Operating Profit',
        data: charts.routeComparison.map(r => r.netProfit),
        backgroundColor: '#10b981',
        borderRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid: { color: 'rgba(255, 255, 255, 0.04)' }
      },
      y: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid: { color: 'rgba(255, 255, 255, 0.04)' }
      }
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Corporate Distribution & Financial Intelligence</h1>
          <p>Real-time operational unit economics, route margins, fleet telemetry, and automated financial insights.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadDashboard}>
            <RefreshCw size={14} />
            <span>Refresh Telemetry</span>
          </button>
          <button className="btn btn-primary" onClick={() => setCurrentView('simulator')}>
            <Compass size={14} />
            <span>What-If Simulator</span>
          </button>
        </div>
      </div>

      {/* 11 Top KPI Cards (Section 25) */}
      <div className="kpi-grid">
        <KPICard
          title="Total Net Sales"
          value={formatCurrency(kpis.totalSales, currencySymbol)}
          subtext={`Gross Margin: ${formatPercent(kpis.grossMarginPct)}`}
          icon={TrendingUp}
          color="99, 102, 241"
          isPositive={true}
        />
        <KPICard
          title="Gross Profit"
          value={formatCurrency(kpis.grossProfit, currencySymbol)}
          subtext="Revenue minus COGS"
          icon={DollarSign}
          color="16, 185, 129"
          isPositive={true}
        />
        <KPICard
          title="Net Operating Profit"
          value={formatCurrency(kpis.netProfit, currencySymbol)}
          subtext={`Net Margin: ${formatPercent(kpis.netProfitMarginPct)}`}
          icon={DollarSign}
          color={kpis.netProfit >= 0 ? "16, 185, 129" : "239, 68, 68"}
          isPositive={kpis.netProfit >= 0}
        />
        <KPICard
          title="Operating Expenses"
          value={formatCurrency(kpis.totalExpenses, currencySymbol)}
          subtext="Salaries, fleet & overheads"
          icon={DollarSign}
          color="239, 68, 68"
          isPositive={false}
        />
        <KPICard
          title="Fuel Cost"
          value={formatCurrency(kpis.fuelCost, currencySymbol)}
          subtext={`Diesel & Petrol logged`}
          icon={Fuel}
          color="245, 158, 11"
        />
        <KPICard
          title="Total Kilometres"
          value={`${formatNumber(kpis.totalKm)} km`}
          subtext="Total fleet distance logged"
          icon={Navigation}
          color="6, 182, 212"
        />
        <KPICard
          title="Cost Per KM"
          value={formatCurrency(kpis.costPerKm, currencySymbol)}
          subtext="OPEX ÷ Total KM"
          icon={Compass}
          color="168, 85, 247"
        />
        <KPICard
          title="Cost Per Shop Visit"
          value={formatCurrency(kpis.costPerShopVisit, currencySymbol)}
          subtext="Route cost ÷ completed visits"
          icon={Store}
          color="99, 102, 241"
        />
        <KPICard
          title="Active Routes"
          value={kpis.routeCount}
          subtext="Cyclic replenishment loops"
          icon={Navigation}
          color="16, 185, 129"
        />
        <KPICard
          title="Customer Outlets"
          value={kpis.shopCount}
          subtext="Registered retail shops"
          icon={Store}
          color="6, 182, 212"
        />
        <KPICard
          title="Outstanding Receivables"
          value={formatCurrency(kpis.receivables, currencySymbol)}
          subtext="Uncollected credit sales"
          icon={AlertTriangle}
          color="245, 158, 11"
          isPositive={false}
        />
      </div>

      {/* Dynamic Management Insights Panel (Section 48) */}
      <div className="insights-panel">
        <div className="insights-header">
          <Lightbulb size={20} color="var(--primary)" />
          <h3>Automated Business Intelligence & Operational Insights</h3>
        </div>
        <div className="insights-grid">
          {insights.map((ins, idx) => (
            <div key={idx} className={`insight-card ${ins.severity}`}>
              <div className="insight-card-top">
                <span className="insight-card-title">{ins.title}</span>
                <span className="insight-metric-tag">{ins.metric}</span>
              </div>
              <p className="insight-card-text">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid (Section 26) */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Monthly Financial Progression (Sales vs Margin vs OPEX)</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>6-Month Rolling Window</span>
          </div>
          <div className="chart-container">
            <Line data={revenueTrendData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Operating Expenses Distribution</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>By Expense Category</span>
          </div>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <Doughnut data={expenseDoughnutData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Route Profitability Bar Comparison */}
      <div className="chart-card" style={{ marginBottom: '24px' }}>
        <div className="chart-card-header">
          <h3>Top Routes Performance & Net Profitability (Section 27)</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView('profitability')}>
            View Full Report
          </button>
        </div>
        <div className="chart-container" style={{ height: '320px' }}>
          <Bar data={routeBarData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
