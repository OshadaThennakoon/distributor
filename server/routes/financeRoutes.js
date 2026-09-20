import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import CalculationEngine from '../services/calculationEngine.js';
import InsightEngine from '../services/insightEngine.js';

const router = express.Router();

// GET /api/finance/dashboard
// Returns 11 Top KPI Cards, Charts Data, and Dynamic BI Management Insights
router.get('/dashboard', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId;
  let distClauseSales = '';
  let distClauseExp = '';
  let distClauseFuel = '';
  let distClauseKm = '';
  let distClauseCounts = '';
  const params = [];

  if (distId) {
    distClauseSales = ' WHERE distributor_id = ?';
    distClauseExp = ' WHERE distributor_id = ?';
    distClauseFuel = ' WHERE distributor_id = ?';
    distClauseKm = ' WHERE distributor_id = ?';
    distClauseCounts = ' WHERE distributor_id = ?';
    params.push(distId);
  }

  // 1. Sales & Gross Profit
  const salesAgg = db.prepare(`
    SELECT 
      COALESCE(SUM(net_sales), 0) as total_sales,
      COALESCE(SUM(total_cogs), 0) as total_cogs,
      COALESCE(SUM(gross_profit), 0) as total_gross_profit,
      COALESCE(SUM(CASE WHEN collection_status != 'paid' THEN net_sales ELSE 0 END), 0) as receivables
    FROM sales ${distClauseSales}
  `).get(params);

  // 2. Total Expenses
  const expAgg = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses ${distClauseExp}
  `).get(params);

  // 3. Fuel Total
  const fuelAgg = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total_fuel, COALESCE(SUM(litres), 0) as total_litres
    FROM fuel_transactions ${distClauseFuel}
  `).get(params);

  // 4. Total KM
  const kmAgg = db.prepare(`
    SELECT COALESCE(SUM(distance_km), 0) as total_km FROM odometer_readings ${distClauseKm}
  `).get(params);

  // 5. Counts: Routes, Shops, Vehicles
  const counts = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM routes ${distClauseCounts}) as route_count,
      (SELECT COUNT(*) FROM shops ${distClauseCounts}) as shop_count,
      (SELECT COUNT(*) FROM vehicles ${distClauseCounts}) as vehicle_count
  `).get(distId ? [distId, distId, distId] : []);

  // 6. Net Profit
  const netProfit = salesAgg.total_gross_profit - expAgg.total_expenses;
  const costPerKm = kmAgg.total_km > 0 ? (expAgg.total_expenses / kmAgg.total_km).toFixed(2) : 0;
  const totalShopVisits = db.prepare(`SELECT COUNT(*) as c FROM shop_visits WHERE status = 'completed' ${distClauseSales}`).get(params).c || 1;
  const costPerShopVisit = totalShopVisits > 0 ? (expAgg.total_expenses / totalShopVisits).toFixed(2) : 0;

  // 7. Monthly Revenue & Profit Trend (Last 6 months)
  const monthlyTrend = db.prepare(`
    SELECT 
      strftime('%Y-%m', s.date) as month,
      SUM(s.net_sales) as sales,
      SUM(s.gross_profit) as gross_profit,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE strftime('%Y-%m', e.date) = strftime('%Y-%m', s.date) ${distId ? 'AND e.distributor_id = ' + distId : ''}) as expenses
    FROM sales s
    ${distClauseSales}
    GROUP BY strftime('%Y-%m', s.date)
    ORDER BY month ASC
  `).all(params);

  // 8. Expense Category Breakdown
  const expenseBreakdown = db.prepare(`
    SELECT ec.name, SUM(e.amount) as amount
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    ${distId ? 'WHERE e.distributor_id = ' + distId : ''}
    GROUP BY ec.id
    ORDER BY amount DESC
    LIMIT 6
  `).all();

  // 9. Route Profitability Samples for Chart
  let routeProfitabilityQuery = `
    SELECT 
      r.id, r.route_name, r.route_distance_km, r.number_of_shops,
      COALESCE(SUM(s.net_sales), 0) as sales,
      COALESCE(SUM(s.total_cogs), 0) as cogs,
      COALESCE(SUM(s.gross_profit), 0) as gross_profit
    FROM routes r
    LEFT JOIN sales s ON s.route_id = r.id
    ${distId ? 'WHERE r.distributor_id = ' + distId : ''}
    GROUP BY r.id
    ORDER BY sales DESC
    LIMIT 10
  `;
  const routeRows = db.prepare(routeProfitabilityQuery).all();
  const routeStats = routeRows.map(r => {
    const cost = CalculationEngine.calculateTotalRouteCost({
      distanceKm: r.route_distance_km,
      numberOfShops: r.number_of_shops
    });
    const net = r.gross_profit - (cost.totalRouteCost * 5); // approximate completed runs
    const netMargin = r.sales > 0 ? Number(((net / r.sales) * 100).toFixed(1)) : 0;
    return {
      routeId: r.id,
      routeName: r.route_name.split(' - ')[1] || r.route_name,
      salesRevenue: r.sales,
      grossProfit: r.gross_profit,
      netProfit: net,
      netMarginPct: netMargin,
      routeCost: cost.totalRouteCost * 5
    };
  });

  // 10. Vehicle Stats for Efficiency Variance
  const vehicleStats = db.prepare(`
    SELECT id, vehicle_number, model, expected_kml, actual_kml FROM vehicles ${distClauseCounts}
  `).all(params);

  // 11. Overdue visits count
  const overdueVisits = db.prepare(`
    SELECT COUNT(*) as c FROM shop_visits WHERE status = 'due' AND planned_date < DATE('now') ${distClauseSales}
  `).get(params).c || 0;

  // 12. Generate Management Insights
  const prevSales = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2]?.sales : null;
  const currentSales = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1]?.sales : salesAgg.total_sales;

  const insights = InsightEngine.generateInsights({
    sales: currentSales,
    cogs: salesAgg.total_cogs,
    expenses: expAgg.total_expenses,
    fuelCost: fuelAgg.total_fuel,
    totalDistanceKm: kmAgg.total_km,
    routeStats,
    vehicleStats,
    overdueVisits,
    serviceAlerts: 1,
    prevMonthSales: prevSales
  });

  res.json({
    kpis: {
      totalSales: salesAgg.total_sales,
      grossProfit: salesAgg.total_gross_profit,
      netProfit: Number(netProfit.toFixed(2)),
      grossMarginPct: salesAgg.total_sales > 0 ? Number(((salesAgg.total_gross_profit / salesAgg.total_sales) * 100).toFixed(1)) : 0,
      netProfitMarginPct: salesAgg.total_sales > 0 ? Number(((netProfit / salesAgg.total_sales) * 100).toFixed(1)) : 0,
      totalExpenses: expAgg.total_expenses,
      fuelCost: fuelAgg.total_fuel,
      totalKm: kmAgg.total_km,
      routeCount: counts.route_count,
      shopCount: counts.shop_count,
      vehicleCount: counts.vehicle_count,
      costPerKm: Number(costPerKm),
      costPerShopVisit: Number(costPerShopVisit),
      receivables: salesAgg.receivables
    },
    charts: {
      monthlyTrend: monthlyTrend.map(m => ({
        month: m.month,
        sales: m.sales,
        grossProfit: m.gross_profit,
        expenses: m.expenses,
        netProfit: m.gross_profit - m.expenses
      })),
      expenseBreakdown,
      routeComparison: routeStats
    },
    insights
  });
});

// GET /api/finance/expenses
router.get('/expenses', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      e.*,
      ec.name as category_name,
      d.name as distributor_name,
      v.vehicle_number,
      r.route_name
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    JOIN distributors d ON e.distributor_id = d.id
    LEFT JOIN vehicles v ON e.vehicle_id = v.id
    LEFT JOIN routes r ON e.route_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND e.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY e.date DESC LIMIT 150`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/finance/expenses
router.post('/expenses', authenticate, (req, res) => {
  const { distributor_id, category_id, date, amount, vehicle_id, route_id, driver_id, employee_name, supplier_name, payment_method, receipt_number, description } = req.body;
  if (!distributor_id || !category_id || !amount) {
    return res.status(400).json({ error: 'Distributor, category, and amount are required' });
  }

  const expDate = date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO expenses (
      distributor_id, category_id, date, amount, vehicle_id, route_id, driver_id,
      employee_name, supplier_name, payment_method, receipt_number, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    distributor_id, category_id, expDate, amount, vehicle_id || null, route_id || null, driver_id || null,
    employee_name || null, supplier_name || null, payment_method || 'cash', receipt_number || null, description || null
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Expense recorded successfully' });
});

// GET /api/finance/expense-categories
router.get('/expense-categories', authenticate, (req, res) => {
  const categories = db.prepare(`SELECT * FROM expense_categories ORDER BY id ASC`).all();
  res.json(categories);
});

// GET /api/finance/break-even
router.get('/break-even', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId;
  const whereClause = distId ? ' WHERE distributor_id = ' + distId : '';

  const salesData = db.prepare(`
    SELECT COALESCE(SUM(net_sales), 0) as sales, COALESCE(SUM(total_cogs), 0) as cogs
    FROM sales ${whereClause}
  `).get();

  const fixedCosts = db.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as fixed
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE ec.is_fixed = 1 ${distId ? 'AND e.distributor_id = ' + distId : ''}
  `).get().fixed || 250000;

  const variableCosts = db.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as variable
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE ec.is_fixed = 0 ${distId ? 'AND e.distributor_id = ' + distId : ''}
  `).get().variable || 150000;

  const shopCount = db.prepare(`SELECT COUNT(*) as c FROM shops ${whereClause}`).get().c || 100;
  const routeCount = db.prepare(`SELECT COUNT(*) as c FROM routes ${whereClause}`).get().c || 15;

  const analysis = CalculationEngine.calculateBreakEven({
    fixedCosts,
    salesRevenue: salesData.sales,
    cogs: salesData.cogs,
    variableCosts,
    totalShops: shopCount,
    totalRoutes: routeCount
  });

  res.json(analysis);
});

// POST /api/finance/simulate
// Interactive "What If?" Calculator
router.post('/simulate', authenticate, (req, res) => {
  const simulation = CalculationEngine.simulateScenario(req.body);
  res.json(simulation);
});

export default router;
