import { db } from '../config/database.js';

export const DailyOperationsService = {
  /**
   * Fetch daily aggregated performance metrics vs targets
   */
  getDailySummary(dateStr, distributorId = null) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const monthStr = targetDate.substring(0, 7);

    let distFilterSales = ' WHERE date = ?';
    let distFilterExp = ' WHERE date = ?';
    let distFilterFuel = ' WHERE transaction_date = ?';
    let distFilterOdo = ' WHERE reading_date = ?';
    let distFilterRoutes = ' WHERE r.is_active = 1';
    let distFilterTargets = ' WHERE (target_period = ? OR target_period = ?)';

    const pDate = [targetDate];
    const pDateDist = [targetDate];
    const pTargets = [targetDate, monthStr];

    if (distributorId && distributorId !== 'all') {
      const dId = Number(distributorId);
      distFilterSales += ' AND distributor_id = ?';
      distFilterExp += ' AND distributor_id = ?';
      distFilterFuel += ' AND distributor_id = ?';
      distFilterOdo += ' AND distributor_id = ?';
      distFilterRoutes += ' AND r.distributor_id = ?';
      distFilterTargets += ' AND distributor_id = ?';

      pDateDist.push(dId);
      pTargets.push(dId);
    }

    // 1. Actual Sales on Date
    const salesAgg = db.prepare(`
      SELECT 
        COALESCE(SUM(net_sales), 0) as actual_sales,
        COALESCE(SUM(total_cogs), 0) as total_cogs,
        COALESCE(SUM(gross_profit), 0) as gross_profit,
        COUNT(id) as invoices_count,
        COUNT(DISTINCT shop_id) as shops_visited
      FROM sales ${distFilterSales}
    `).get(pDateDist);

    // 2. Actual Costs on Date (Expenses + Direct Fuel Purchases)
    const expAgg = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses ${distFilterExp}
    `).get(pDateDist);

    const fuelAgg = db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_fuel_cost,
        COALESCE(SUM(litres), 0) as total_litres
      FROM fuel_transactions ${distFilterFuel}
    `).get(pDateDist);

    const actualCost = expAgg.total_expenses + fuelAgg.total_fuel_cost;

    // 3. Actual Distance (KM) on Date
    const kmAgg = db.prepare(`
      SELECT 
        COALESCE(SUM(distance_km), 0) as total_km,
        COUNT(id) as trips_count
      FROM odometer_readings ${distFilterOdo}
    `).get(pDateDist);

    // 4. Retrieve Targets for this Date or Month
    const targetsList = db.prepare(`
      SELECT target_type, period_type, target_period, target_value, route_id
      FROM targets ${distFilterTargets}
    `).all(pTargets);

    // Resolve Daily Target Values (Direct daily target takes precedence over monthly/26)
    let targetSales = 0;
    let targetCost = 0;
    let targetKm = 0;

    // Check specific daily targets first
    const dailySalesTarget = targetsList.find(t => t.target_type === 'sales' && t.period_type === 'daily' && t.target_period === targetDate && !t.route_id);
    const dailyCostTarget = targetsList.find(t => t.target_type === 'cost' && t.period_type === 'daily' && t.target_period === targetDate && !t.route_id);
    const dailyKmTarget = targetsList.find(t => t.target_type === 'km' && t.period_type === 'daily' && t.target_period === targetDate && !t.route_id);

    // Monthly fallbacks prorated by 26 working days
    const monthlySalesTarget = targetsList.find(t => t.target_type === 'sales' && t.period_type === 'monthly' && t.target_period === monthStr && !t.route_id);
    const monthlyCostTarget = targetsList.find(t => t.target_type === 'cost' && t.period_type === 'monthly' && t.target_period === monthStr && !t.route_id);
    const monthlyKmTarget = targetsList.find(t => t.target_type === 'km' && t.period_type === 'monthly' && t.target_period === monthStr && !t.route_id);

    targetSales = dailySalesTarget ? dailySalesTarget.target_value : (monthlySalesTarget ? Math.round(monthlySalesTarget.target_value / 26) : 250000);
    targetCost = dailyCostTarget ? dailyCostTarget.target_value : (monthlyCostTarget ? Math.round(monthlyCostTarget.target_value / 26) : 60000);
    targetKm = dailyKmTarget ? dailyKmTarget.target_value : (monthlyKmTarget ? Math.round(monthlyKmTarget.target_value / 26) : 280);

    // Variances & Percentages
    const salesAchievedPct = targetSales > 0 ? Number(((salesAgg.actual_sales / targetSales) * 100).toFixed(1)) : 0;
    const salesVariance = salesAgg.actual_sales - targetSales;

    const costVariance = actualCost - targetCost; // positive means over budget, negative means saved
    const costBudgetUsedPct = targetCost > 0 ? Number(((actualCost / targetCost) * 100).toFixed(1)) : 0;

    const kmVariance = kmAgg.total_km - targetKm;
    const kmAchievedPct = targetKm > 0 ? Number(((kmAgg.total_km / targetKm) * 100).toFixed(1)) : 0;

    const dailyNetProfit = salesAgg.actual_sales - salesAgg.total_cogs - actualCost;
    const dailyNetMarginPct = salesAgg.actual_sales > 0 ? Number(((dailyNetProfit / salesAgg.actual_sales) * 100).toFixed(1)) : 0;

    // 5. Route-level breakdown for this day
    const routeParams = distributorId && distributorId !== 'all' ? [targetDate, targetDate, targetDate, targetDate, Number(distributorId)] : [targetDate, targetDate, targetDate, targetDate];
    const routeBreakdownSql = `
      SELECT 
        r.id as route_id,
        r.route_name,
        r.route_code,
        r.route_distance_km,
        v.vehicle_number,
        dr.full_name as driver_name,
        COALESCE(sales.day_sales, 0) as day_sales,
        COALESCE(sales.day_cogs, 0) as day_cogs,
        COALESCE(sales.day_gross_profit, 0) as day_gross_profit,
        COALESCE(sales.invoices_count, 0) as day_invoices,
        COALESCE(odo.day_km, 0) as day_km,
        COALESCE(fuel.day_fuel, 0) as day_fuel,
        COALESCE(exp.day_exp, 0) as day_exp,
        (COALESCE(fuel.day_fuel, 0) + COALESCE(exp.day_exp, 0)) as day_total_cost
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN drivers dr ON r.driver_id = dr.id
      LEFT JOIN (
        SELECT route_id, SUM(net_sales) as day_sales, SUM(total_cogs) as day_cogs, SUM(gross_profit) as day_gross_profit, COUNT(id) as invoices_count
        FROM sales WHERE date = ? GROUP BY route_id
      ) sales ON sales.route_id = r.id
      LEFT JOIN (
        SELECT route_id, SUM(distance_km) as day_km
        FROM odometer_readings WHERE reading_date = ? GROUP BY route_id
      ) odo ON odo.route_id = r.id
      LEFT JOIN (
        SELECT route_id, SUM(total_amount) as day_fuel
        FROM fuel_transactions WHERE transaction_date = ? GROUP BY route_id
      ) fuel ON fuel.route_id = r.id
      LEFT JOIN (
        SELECT route_id, SUM(amount) as day_exp
        FROM expenses WHERE date = ? GROUP BY route_id
      ) exp ON exp.route_id = r.id
      ${distFilterRoutes}
      ORDER BY day_sales DESC, r.id ASC
    `;

    const routeRows = db.prepare(routeBreakdownSql).all(routeParams);

    const enrichedRoutes = routeRows.map(r => {
      const netProfit = r.day_gross_profit - r.day_total_cost;
      const marginPct = r.day_sales > 0 ? Number(((netProfit / r.day_sales) * 100).toFixed(1)) : 0;
      const costPerKm = r.day_km > 0 ? Number((r.day_total_cost / r.day_km).toFixed(2)) : 0;
      return {
        ...r,
        day_net_profit: Number(netProfit.toFixed(2)),
        day_margin_pct: marginPct,
        cost_per_km: costPerKm
      };
    });

    return {
      date: targetDate,
      month: monthStr,
      metrics: {
        dailySales: {
          actual: salesAgg.actual_sales,
          target: targetSales,
          achievedPct: salesAchievedPct,
          variance: salesVariance,
          invoicesCount: salesAgg.invoices_count,
          shopsVisited: salesAgg.shops_visited
        },
        dailyCost: {
          actual: Number(actualCost.toFixed(2)),
          target: targetCost,
          budgetUsedPct: costBudgetUsedPct,
          variance: Number(costVariance.toFixed(2)),
          fuelCost: fuelAgg.total_fuel_cost,
          fuelLitres: fuelAgg.total_litres,
          otherExpenses: expAgg.total_expenses
        },
        dailyKm: {
          actual: kmAgg.total_km,
          target: targetKm,
          achievedPct: kmAchievedPct,
          variance: kmVariance,
          tripsCount: kmAgg.trips_count
        },
        dailyProfit: {
          grossProfit: salesAgg.gross_profit,
          cogs: salesAgg.total_cogs,
          netProfit: Number(dailyNetProfit.toFixed(2)),
          marginPct: dailyNetMarginPct
        }
      },
      routeBreakdown: enrichedRoutes
    };
  },

  /**
   * List targets
   */
  getTargets(filters = {}) {
    let sql = `
      SELECT 
        t.*,
        d.name as distributor_name,
        r.route_name
      FROM targets t
      JOIN distributors d ON t.distributor_id = d.id
      LEFT JOIN routes r ON t.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND t.distributor_id = ?`;
      params.push(Number(filters.distributorId));
    }
    if (filters.targetType) {
      sql += ` AND t.target_type = ?`;
      params.push(filters.targetType);
    }
    if (filters.periodType) {
      sql += ` AND t.period_type = ?`;
      params.push(filters.periodType);
    }
    sql += ` ORDER BY t.target_period DESC, t.id DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * Save (create or update) target
   */
  saveTarget(data) {
    const {
      distributor_id,
      target_type,
      period_type,
      target_period,
      route_id,
      vehicle_id,
      driver_id,
      target_value,
      notes
    } = data;

    if (!distributor_id || !target_type || !period_type || !target_period || target_value === undefined) {
      throw new Error('Missing required target fields');
    }

    // Upsert logic for identical scoping
    const existing = db.prepare(`
      SELECT id FROM targets 
      WHERE distributor_id = ? AND target_type = ? AND period_type = ? AND target_period = ?
      AND COALESCE(route_id, 0) = COALESCE(?, 0)
    `).get(distributor_id, target_type, period_type, target_period, route_id || null);

    if (existing) {
      db.prepare(`
        UPDATE targets
        SET target_value = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(target_value, notes || null, existing.id);
      return { id: existing.id, action: 'updated' };
    }

    const result = db.prepare(`
      INSERT INTO targets (
        distributor_id, target_type, period_type, target_period,
        route_id, vehicle_id, driver_id, target_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      distributor_id, target_type, period_type, target_period,
      route_id || null, vehicle_id || null, driver_id || null, target_value, notes || null
    );

    return { id: result.lastInsertRowid, action: 'created' };
  },

  /**
   * Delete target
   */
  deleteTarget(id) {
    return db.prepare(`DELETE FROM targets WHERE id = ?`).run(id);
  }
};

export default DailyOperationsService;
