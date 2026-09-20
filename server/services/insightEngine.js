/**
 * Management Insight Engine
 * Analyzes operational data and produces natural-language business intelligence recommendations.
 */

export const InsightEngine = {
  generateInsights({
    sales = 0,
    cogs = 0,
    expenses = 0,
    fuelCost = 0,
    totalDistanceKm = 0,
    routeStats = [],
    vehicleStats = [],
    overdueVisits = 0,
    serviceAlerts = 0,
    prevMonthSales = null
  }) {
    const insights = [];

    // 1. Fuel cost share analysis
    if (expenses > 0 && fuelCost > 0) {
      const fuelPct = ((fuelCost / expenses) * 100).toFixed(1);
      insights.push({
        type: 'FINANCIAL',
        severity: fuelPct > 35 ? 'warning' : 'info',
        title: 'Fuel Expenditure Share',
        text: `Fuel represents ${fuelPct}% of total operating expenditures (Rs. ${fuelCost.toLocaleString()} out of Rs. ${expenses.toLocaleString()}).`,
        metric: `${fuelPct}%`
      });
    }

    // 2. Sales growth / trend
    if (prevMonthSales !== null && prevMonthSales > 0 && sales > 0) {
      const growthPct = (((sales - prevMonthSales) / prevMonthSales) * 100).toFixed(1);
      const isPositive = growthPct >= 0;
      insights.push({
        type: 'PERFORMANCE',
        severity: isPositive ? 'success' : 'warning',
        title: 'Sales Growth Momentum',
        text: `Total monthly sales have ${isPositive ? 'increased' : 'decreased'} by ${Math.abs(growthPct)}% compared with the prior operating cycle.`,
        metric: `${growthPct}%`
      });
    }

    // 3. Vehicle efficiency anomaly detection
    vehicleStats.forEach(v => {
      if (v.expected_kml > 0 && v.actual_kml > 0) {
        const diffPct = (((v.actual_kml - v.expected_kml) / v.expected_kml) * 100).toFixed(1);
        if (diffPct < -12) {
          insights.push({
            type: 'FLEET_ANOMALY',
            severity: 'danger',
            title: `Abnormal Consumption: ${v.vehicle_number}`,
            text: `Vehicle ${v.vehicle_number} (${v.model}) is operating at ${v.actual_kml} km/L vs manufacturer expected ${v.expected_kml} km/L (${Math.abs(diffPct)}% efficiency deficit). Inspect fuel logs or engine diagnostics.`,
            metric: `${v.actual_kml} km/L`
          });
        }
      }
    });

    // 4. Route profitability highlights
    if (routeStats.length > 0) {
      // Find top profitable route
      const sortedByMargin = [...routeStats].sort((a, b) => (b.netMarginPct || 0) - (a.netMarginPct || 0));
      const topRoute = sortedByMargin[0];
      if (topRoute && topRoute.netMarginPct > 0) {
        insights.push({
          type: 'OPPORTUNITY',
          severity: 'success',
          title: `Highest Margin Route: ${topRoute.routeName}`,
          text: `${topRoute.routeName} delivers the strongest net operating margin at ${topRoute.netMarginPct}% with Rs. ${Number(topRoute.salesRevenue || 0).toLocaleString()} net sales.`,
          metric: `${topRoute.netMarginPct}% Margin`
        });
      }

      // Check for unprofitable routes
      const losingRoutes = routeStats.filter(r => (r.netProfit || 0) < 0);
      if (losingRoutes.length > 0) {
        insights.push({
          type: 'ALERT',
          severity: 'danger',
          title: 'Negative Profitability Routes Detected',
          text: `${losingRoutes.length} route(s) currently operate at a net loss (including ${losingRoutes[0].routeName}). Consider optimizing stop sequencing, raising minimum order sizes, or reviewing visit frequency.`,
          metric: `${losingRoutes.length} Route(s)`
        });
      }
    }

    // 5. Shop visit compliance & schedule alert
    if (overdueVisits > 0) {
      insights.push({
        type: 'OPERATIONAL',
        severity: overdueVisits > 5 ? 'warning' : 'info',
        title: 'Overdue Shop Visits',
        text: `${overdueVisits} customer outlet(s) have passed their scheduled visit date without an executed delivery run.`,
        metric: `${overdueVisits} overdue`
      });
    }

    // 6. Fleet maintenance status
    if (serviceAlerts > 0) {
      insights.push({
        type: 'MAINTENANCE',
        severity: 'danger',
        title: 'Vehicle Maintenance Alerts',
        text: `${serviceAlerts} vehicle(s) require scheduled periodic servicing or have impending license/insurance expirations.`,
        metric: `${serviceAlerts} alerts`
      });
    }

    return insights;
  }
};

export default InsightEngine;
