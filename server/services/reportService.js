import { db } from '../config/database.js';
import CalculationEngine from './calculationEngine.js';

export const ReportService = {
  // Helper to build SQL WHERE clause with filters
  buildFilterConditions(params = {}, prefix = '') {
    const conditions = [];
    const values = [];

    const p = prefix ? `${prefix}.` : '';

    if (params.distributorId && params.distributorId !== 'all') {
      conditions.push(`${p}distributor_id = ?`);
      values.push(Number(params.distributorId));
    }

    if (params.routeId && params.routeId !== 'all') {
      conditions.push(`${p}route_id = ?`);
      values.push(Number(params.routeId));
    }

    if (params.vehicleId && params.vehicleId !== 'all') {
      conditions.push(`${p}vehicle_id = ?`);
      values.push(Number(params.vehicleId));
    }

    if (params.driverId && params.driverId !== 'all') {
      conditions.push(`${p}driver_id = ?`);
      values.push(Number(params.driverId));
    }

    return { conditions, values };
  },

  /**
   * 1. Daily Sales Report
   */
  getDailySalesReport(filters = {}) {
    let sql = `
      SELECT 
        s.date,
        s.invoice_number,
        d.name as distributor_name,
        r.route_name,
        sh.shop_name,
        sh.town,
        s.sales_rep,
        s.total_gross,
        s.discount,
        s.net_sales,
        s.total_cogs,
        s.gross_profit,
        s.payment_type,
        s.collection_status
      FROM sales s
      JOIN distributors d ON s.distributor_id = d.id
      JOIN shops sh ON s.shop_id = sh.id
      LEFT JOIN routes r ON s.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ` AND s.date >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND s.date <= ?`; params.push(filters.endDate); }
    if (filters.distributorId && filters.distributorId !== 'all') { sql += ` AND s.distributor_id = ?`; params.push(filters.distributorId); }
    if (filters.routeId && filters.routeId !== 'all') { sql += ` AND s.route_id = ?`; params.push(filters.routeId); }

    sql += ` ORDER BY s.date DESC, s.id DESC`;
    const rows = db.prepare(sql).all(params);

    const totals = rows.reduce((acc, r) => {
      acc.totalNet += r.net_sales;
      acc.totalGross += r.total_gross;
      acc.totalCogs += r.total_cogs;
      acc.totalProfit += r.gross_profit;
      return acc;
    }, { totalNet: 0, totalGross: 0, totalCogs: 0, totalProfit: 0 });

    return { rows, totals, count: rows.length };
  },

  /**
   * 2. Weekly Sales Report
   */
  getWeeklySalesReport(filters = {}) {
    let sql = `
      SELECT 
        strftime('%Y-W%W', s.date) as week,
        MIN(s.date) as week_start,
        MAX(s.date) as week_end,
        COUNT(s.id) as invoice_count,
        SUM(s.total_gross) as total_gross,
        SUM(s.discount) as total_discount,
        SUM(s.net_sales) as net_sales,
        SUM(s.total_cogs) as total_cogs,
        SUM(s.gross_profit) as gross_profit
      FROM sales s
      WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ` AND s.date >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND s.date <= ?`; params.push(filters.endDate); }
    if (filters.distributorId && filters.distributorId !== 'all') { sql += ` AND s.distributor_id = ?`; params.push(filters.distributorId); }

    sql += ` GROUP BY strftime('%Y-W%W', s.date) ORDER BY week DESC`;
    return db.prepare(sql).all(params);
  },

  /**
   * 3. Monthly Sales Report
   */
  getMonthlySalesReport(filters = {}) {
    let sql = `
      SELECT 
        strftime('%Y-%m', s.date) as month,
        COUNT(s.id) as total_orders,
        COUNT(DISTINCT s.shop_id) as active_shops,
        COUNT(DISTINCT s.route_id) as active_routes,
        SUM(s.net_sales) as net_sales,
        SUM(s.total_cogs) as total_cogs,
        SUM(s.gross_profit) as gross_profit,
        ROUND((SUM(s.gross_profit) * 100.0 / NULLIF(SUM(s.net_sales), 0)), 2) as gross_margin_pct
      FROM sales s
      WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ` AND s.date >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND s.date <= ?`; params.push(filters.endDate); }
    if (filters.distributorId && filters.distributorId !== 'all') { sql += ` AND s.distributor_id = ?`; params.push(filters.distributorId); }

    sql += ` GROUP BY strftime('%Y-%m', s.date) ORDER BY month DESC`;
    return db.prepare(sql).all(params);
  },

  /**
   * 4. Monthly Profit & Loss Statement (P&L)
   */
  getProfitAndLoss(filters = {}) {
    const month = filters.month || new Date().toISOString().substring(0, 7);
    const params = [month + '%'];
    let distClauseSales = '';
    let distClauseExp = '';

    if (filters.distributorId && filters.distributorId !== 'all') {
      distClauseSales = ' AND distributor_id = ?';
      distClauseExp = ' AND distributor_id = ?';
      params.push(filters.distributorId);
    }

    // Revenue & COGS
    const salesSql = `
      SELECT 
        COALESCE(SUM(total_gross), 0) as gross_sales,
        COALESCE(SUM(discount), 0) as discounts,
        COALESCE(SUM(net_sales), 0) as net_sales,
        COALESCE(SUM(total_cogs), 0) as cogs,
        COALESCE(SUM(gross_profit), 0) as gross_profit
      FROM sales
      WHERE date LIKE ? ${distClauseSales}
    `;
    const salesData = db.prepare(salesSql).get(params);

    // Expenses by Category
    const expParams = [month + '%'];
    if (filters.distributorId && filters.distributorId !== 'all') {
      expParams.push(filters.distributorId);
    }

    const expSql = `
      SELECT 
        ec.name as category_name,
        ec.code as category_code,
        ec.is_operating,
        ec.is_fixed,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM expense_categories ec
      LEFT JOIN expenses e ON e.category_id = ec.id AND e.date LIKE ? ${distClauseExp}
      GROUP BY ec.id
      ORDER BY total_amount DESC
    `;
    const expenseRows = db.prepare(expSql).all(expParams);

    // Also get fuel expenses directly logged in fuel_transactions
    const fuelParams = [month + '%'];
    if (filters.distributorId && filters.distributorId !== 'all') {
      fuelParams.push(filters.distributorId);
    }
    const fuelData = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total_fuel, COALESCE(SUM(litres), 0) as total_litres
      FROM fuel_transactions WHERE transaction_date LIKE ? ${distClauseSales}
    `).get(fuelParams);

    const totalOperatingExpenses = expenseRows.reduce((sum, e) => sum + e.total_amount, 0);
    const netOperatingProfit = salesData.gross_profit - totalOperatingExpenses;
    const grossMarginPct = salesData.net_sales > 0 ? (salesData.gross_profit / salesData.net_sales) * 100 : 0;
    const netMarginPct = salesData.net_sales > 0 ? (netOperatingProfit / salesData.net_sales) * 100 : 0;

    return {
      month,
      revenue: {
        grossSales: salesData.gross_sales,
        discounts: salesData.discounts,
        netSales: salesData.net_sales
      },
      cogs: salesData.cogs,
      grossProfit: salesData.gross_profit,
      grossMarginPct: Number(grossMarginPct.toFixed(2)),
      operatingExpenses: expenseRows,
      totalOperatingExpenses,
      fuelSummary: fuelData,
      netOperatingProfit: Number(netOperatingProfit.toFixed(2)),
      netMarginPct: Number(netMarginPct.toFixed(2))
    };
  },

  /**
   * 5. Expense Report
   */
  getExpenseReport(filters = {}) {
    let sql = `
      SELECT 
        e.id,
        e.date,
        ec.name as category_name,
        ec.is_fixed,
        e.amount,
        d.name as distributor_name,
        v.vehicle_number,
        r.route_name,
        dr.full_name as driver_name,
        e.employee_name,
        e.supplier_name,
        e.payment_method,
        e.receipt_number,
        e.description
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      JOIN distributors d ON e.distributor_id = d.id
      LEFT JOIN vehicles v ON e.vehicle_id = v.id
      LEFT JOIN routes r ON e.route_id = r.id
      LEFT JOIN drivers dr ON e.driver_id = dr.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ` AND e.date >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND e.date <= ?`; params.push(filters.endDate); }
    if (filters.distributorId && filters.distributorId !== 'all') { sql += ` AND e.distributor_id = ?`; params.push(filters.distributorId); }
    if (filters.categoryId && filters.categoryId !== 'all') { sql += ` AND e.category_id = ?`; params.push(filters.categoryId); }

    sql += ` ORDER BY e.date DESC`;
    const rows = db.prepare(sql).all(params);
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    return { rows, totalAmount, count: rows.length };
  },

  /**
   * 6. Fuel Expense & Consumption Report
   */
  getFuelReport(filters = {}) {
    let sql = `
      SELECT 
        ft.id,
        ft.transaction_date,
        d.name as distributor_name,
        v.vehicle_number,
        v.vehicle_type,
        dr.full_name as driver_name,
        r.route_name,
        ft.fuel_type,
        ft.litres,
        ft.price_per_litre,
        ft.total_amount,
        ft.odometer_reading,
        ft.fuel_station,
        ft.receipt_number,
        ft.payment_method
      FROM fuel_transactions ft
      JOIN distributors d ON ft.distributor_id = d.id
      JOIN vehicles v ON ft.vehicle_id = v.id
      LEFT JOIN drivers dr ON ft.driver_id = dr.id
      LEFT JOIN routes r ON ft.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.startDate) { sql += ` AND ft.transaction_date >= ?`; params.push(filters.startDate); }
    if (filters.endDate) { sql += ` AND ft.transaction_date <= ?`; params.push(filters.endDate); }
    if (filters.distributorId && filters.distributorId !== 'all') { sql += ` AND ft.distributor_id = ?`; params.push(filters.distributorId); }
    if (filters.vehicleId && filters.vehicleId !== 'all') { sql += ` AND ft.vehicle_id = ?`; params.push(filters.vehicleId); }

    sql += ` ORDER BY ft.transaction_date DESC`;
    const rows = db.prepare(sql).all(params);

    const totals = rows.reduce((acc, r) => {
      acc.totalLitres += r.litres;
      acc.totalAmount += r.total_amount;
      return acc;
    }, { totalLitres: 0, totalAmount: 0 });

    totals.avgPricePerLitre = totals.totalLitres > 0 ? (totals.totalAmount / totals.totalLitres).toFixed(2) : 0;

    return { rows, totals, count: rows.length };
  },

  /**
   * 7. Vehicle Cost & Fleet Report
   */
  getVehicleCostReport(filters = {}) {
    let sql = `
      SELECT 
        v.id,
        v.vehicle_number,
        v.vehicle_type,
        v.brand,
        v.model,
        v.fuel_type,
        v.expected_kml,
        v.actual_kml,
        v.current_odometer,
        v.insurance_expiry,
        v.revenue_license_expiry,
        v.status,
        d.name as distributor_name,
        COALESCE(fuel.total_fuel_cost, 0) as fuel_cost,
        COALESCE(fuel.total_litres, 0) as litres_consumed,
        COALESCE(maint.total_maint_cost, 0) as maintenance_cost,
        (COALESCE(fuel.total_fuel_cost, 0) + COALESCE(maint.total_maint_cost, 0)) as total_vehicle_cost
      FROM vehicles v
      JOIN distributors d ON v.distributor_id = d.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(total_amount) as total_fuel_cost, SUM(litres) as total_litres
        FROM fuel_transactions GROUP BY vehicle_id
      ) fuel ON fuel.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(total_cost) as total_maint_cost
        FROM maintenance GROUP BY vehicle_id
      ) maint ON maint.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND v.distributor_id = ?`;
      params.push(filters.distributorId);
    }

    const rows = db.prepare(sql).all(params);
    return rows.map(r => {
      const costPerKm = r.current_odometer > 0 ? (r.total_vehicle_cost / r.current_odometer).toFixed(2) : 0;
      return { ...r, cost_per_km: costPerKm };
    });
  },

  /**
   * 8. Route Cost Report
   */
  getRouteCostReport(filters = {}) {
    let sql = `
      SELECT 
        r.id as route_id,
        r.route_name,
        r.route_code,
        d.name as distributor_name,
        r.route_distance_km,
        r.visit_frequency,
        r.frequency_days,
        r.number_of_shops,
        v.vehicle_number,
        COALESCE(v.expected_kml, 18) as expected_kml,
        dr.full_name as driver_name,
        COALESCE(dr.monthly_salary, 65000) as driver_salary,
        COALESCE(dr.daily_allowance, 1500) as driver_allowance
      FROM routes r
      JOIN distributors d ON r.distributor_id = d.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN drivers dr ON r.driver_id = dr.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND r.distributor_id = ?`;
      params.push(filters.distributorId);
    }

    const routes = db.prepare(sql).all(params);

    // Get current diesel price
    const latestFuel = db.prepare(`SELECT price_per_litre FROM fuel_prices WHERE fuel_type = 'Diesel' ORDER BY effective_date DESC LIMIT 1`).get();
    const fuelPrice = latestFuel ? latestFuel.price_per_litre : 382;

    return routes.map(r => {
      const cost = CalculationEngine.calculateTotalRouteCost({
        distanceKm: r.route_distance_km,
        kmPerLitre: r.expected_kml,
        fuelPricePerLitre: fuelPrice,
        driverMonthlySalary: r.driver_salary,
        driverDailyAllowance: r.driver_allowance,
        numberOfShops: r.number_of_shops
      });

      const cycle = CalculationEngine.calculateRouteCycle(r.route_distance_km, r.frequency_days);

      return {
        routeId: r.route_id,
        routeName: r.route_name,
        routeCode: r.route_code,
        distributorName: r.distributor_name,
        distanceKm: r.route_distance_km,
        numberOfShops: r.number_of_shops,
        visitFrequency: r.visit_frequency,
        monthlyCycles: cycle.monthlyCycles,
        monthlyDistanceKm: cycle.monthlyDistanceKm,
        costPerTrip: cost.totalRouteCost,
        fuelCostPerTrip: cost.fuelCost,
        driverCostPerTrip: cost.driverCost,
        maintenanceCostPerTrip: cost.maintenanceCost,
        monthlyEstimatedCost: Number((cost.totalRouteCost * cycle.monthlyCycles).toFixed(2)),
        costPerKm: cost.costPerKm,
        costPerShop: cost.costPerShop
      };
    });
  },

  /**
   * 9. Route Profitability Report (Crucial)
   */
  getRouteProfitabilityReport(filters = {}) {
    let sql = `
      SELECT 
        r.id as route_id,
        r.route_name,
        r.route_code,
        d.name as distributor_name,
        r.route_distance_km,
        r.number_of_shops,
        r.frequency_days,
        COALESCE(sales.total_net_sales, 0) as sales_revenue,
        COALESCE(sales.total_cogs, 0) as total_cogs,
        COALESCE(sales.total_gross_profit, 0) as gross_profit,
        COALESCE(sales.invoices_count, 0) as invoices_count,
        COALESCE(visits.completed_visits, 0) as visits_count,
        COALESCE(v.expected_kml, 18) as expected_kml,
        COALESCE(dr.monthly_salary, 65000) as driver_salary,
        COALESCE(dr.daily_allowance, 1500) as driver_allowance
      FROM routes r
      JOIN distributors d ON r.distributor_id = d.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN drivers dr ON r.driver_id = dr.id
      LEFT JOIN (
        SELECT route_id, SUM(net_sales) as total_net_sales, SUM(total_cogs) as total_cogs, SUM(gross_profit) as total_gross_profit, COUNT(id) as invoices_count
        FROM sales GROUP BY route_id
      ) sales ON sales.route_id = r.id
      LEFT JOIN (
        SELECT route_id, COUNT(id) as completed_visits
        FROM shop_visits WHERE status = 'completed' GROUP BY route_id
      ) visits ON visits.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND r.distributor_id = ?`;
      params.push(filters.distributorId);
    }

    const rows = db.prepare(sql).all(params);
    const fuelPrice = 382;

    return rows.map(r => {
      const tripCost = CalculationEngine.calculateTotalRouteCost({
        distanceKm: r.route_distance_km,
        kmPerLitre: r.expected_kml,
        fuelPricePerLitre: fuelPrice,
        driverMonthlySalary: r.driver_salary,
        driverDailyAllowance: r.driver_allowance,
        numberOfShops: r.number_of_shops
      });

      // Total route operating costs across observed visits/trips
      const tripsExecuted = Math.max(Math.ceil(r.visits_count / (r.number_of_shops || 1)), 1);
      const totalRouteCost = tripCost.totalRouteCost * tripsExecuted;

      return CalculationEngine.calculateRouteProfitability({
        routeId: r.route_id,
        routeName: r.route_name,
        shopsCount: r.number_of_shops,
        visitsCount: r.visits_count,
        distanceKm: r.route_distance_km * tripsExecuted,
        salesRevenue: r.sales_revenue,
        cogs: r.total_cogs,
        routeOperatingCost: totalRouteCost
      });
    });
  },

  /**
   * 10. Distributor Profitability (Multi-Distributor Benchmarking)
   */
  getDistributorProfitabilityReport() {
    const distributors = db.prepare(`SELECT id, code, name, currency_symbol FROM distributors WHERE status = 'active'`).all();

    return distributors.map(dist => {
      const sales = db.prepare(`
        SELECT COALESCE(SUM(net_sales), 0) as net_sales, COALESCE(SUM(total_cogs), 0) as cogs, COALESCE(SUM(gross_profit), 0) as gross_profit
        FROM sales WHERE distributor_id = ?
      `).get(dist.id);

      const expenses = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses WHERE distributor_id = ?
      `).get(dist.id);

      const fuel = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total_fuel, COALESCE(SUM(litres), 0) as litres
        FROM fuel_transactions WHERE distributor_id = ?
      `).get(dist.id);

      const counts = db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM routes WHERE distributor_id = ?) as routes_count,
          (SELECT COUNT(*) FROM shops WHERE distributor_id = ?) as shops_count,
          (SELECT COUNT(*) FROM vehicles WHERE distributor_id = ?) as vehicles_count
      `).get(dist.id, dist.id, dist.id);

      const netProfit = sales.gross_profit - expenses.total_expenses;
      const marginPct = sales.net_sales > 0 ? (netProfit / sales.net_sales) * 100 : 0;

      return {
        distributorId: dist.id,
        code: dist.code,
        name: dist.name,
        currencySymbol: dist.currency_symbol,
        salesRevenue: sales.net_sales,
        cogs: sales.cogs,
        grossProfit: sales.gross_profit,
        operatingExpenses: expenses.total_expenses,
        fuelCost: fuel.total_fuel,
        netProfit: Number(netProfit.toFixed(2)),
        profitMarginPct: Number(marginPct.toFixed(2)),
        routesCount: counts.routes_count,
        shopsCount: counts.shops_count,
        vehiclesCount: counts.vehicles_count
      };
    });
  },

  /**
   * 11. Territory Profitability
   */
  getTerritoryProfitabilityReport(filters = {}) {
    let sql = `
      SELECT 
        t.id,
        t.name as territory_name,
        t.code as territory_code,
        t.district,
        d.name as distributor_name,
        COUNT(DISTINCT sh.id) as total_shops,
        COALESCE(SUM(s.net_sales), 0) as net_sales,
        COALESCE(SUM(s.total_cogs), 0) as total_cogs,
        COALESCE(SUM(s.gross_profit), 0) as gross_profit
      FROM territories t
      JOIN distributors d ON t.distributor_id = d.id
      LEFT JOIN shops sh ON sh.territory_id = t.id
      LEFT JOIN sales s ON s.shop_id = sh.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND t.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    sql += ` GROUP BY t.id ORDER BY net_sales DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 12. Customer / Shop Sales Report
   */
  getCustomerSalesReport(filters = {}) {
    let sql = `
      SELECT 
        sh.id,
        sh.shop_code,
        sh.shop_name,
        sh.owner_name,
        sh.town,
        sh.customer_type,
        sh.credit_limit,
        sh.payment_terms_days,
        r.route_name,
        COUNT(s.id) as orders_count,
        COALESCE(SUM(s.net_sales), 0) as total_purchased,
        COALESCE(SUM(s.gross_profit), 0) as gross_profit_generated,
        COALESCE(SUM(CASE WHEN s.collection_status != 'paid' THEN s.net_sales ELSE 0 END), 0) as outstanding_receivables,
        MAX(s.date) as last_order_date
      FROM shops sh
      LEFT JOIN routes r ON sh.route_id = r.id
      LEFT JOIN sales s ON s.shop_id = sh.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND sh.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    if (filters.routeId && filters.routeId !== 'all') {
      sql += ` AND sh.route_id = ?`;
      params.push(filters.routeId);
    }
    sql += ` GROUP BY sh.id ORDER BY total_purchased DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 13. Product Sales & Margin Report
   */
  getProductSalesReport(filters = {}) {
    let sql = `
      SELECT 
        p.id,
        p.sku,
        p.product_name,
        p.brand,
        p.unit,
        pc.name as category_name,
        p.cost_price,
        p.selling_price,
        p.stock_quantity,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.net_amount), 0) as total_sales,
        COALESCE(SUM(si.cogs_amount), 0) as total_cogs,
        COALESCE(SUM(si.gross_profit), 0) as total_gross_profit,
        ROUND((COALESCE(SUM(si.gross_profit), 0) * 100.0 / NULLIF(SUM(si.net_amount), 0)), 2) as margin_pct
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN sale_items si ON si.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND p.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    sql += ` GROUP BY p.id ORDER BY total_sales DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 14. Driver Expense & Performance Report
   */
  getDriverExpenseReport(filters = {}) {
    let sql = `
      SELECT 
        dr.id,
        dr.full_name as driver_name,
        dr.nic,
        dr.phone,
        dr.license_number,
        dr.monthly_salary,
        dr.daily_allowance,
        COUNT(DISTINCT ft.id) as fuel_stops,
        COALESCE(SUM(ft.total_amount), 0) as total_fuel_handled,
        COALESCE(SUM(e.amount), 0) as direct_expenses,
        COUNT(DISTINCT rr.id) as trips_completed,
        COALESCE(SUM(rr.distance_km), 0) as total_km_driven
      FROM drivers dr
      LEFT JOIN fuel_transactions ft ON ft.driver_id = dr.id
      LEFT JOIN expenses e ON e.driver_id = dr.id
      LEFT JOIN route_runs rr ON rr.driver_id = dr.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND dr.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    sql += ` GROUP BY dr.id ORDER BY dr.full_name ASC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 15. Vehicle Maintenance Report
   */
  getMaintenanceReport(filters = {}) {
    let sql = `
      SELECT 
        m.id,
        m.service_date,
        v.vehicle_number,
        v.brand,
        v.model,
        m.odometer,
        m.service_type,
        m.parts_cost,
        m.labor_cost,
        m.total_cost,
        m.next_service_odometer,
        m.next_service_date,
        m.garage,
        m.invoice_number,
        m.notes
      FROM maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND m.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    if (filters.vehicleId && filters.vehicleId !== 'all') {
      sql += ` AND m.vehicle_id = ?`;
      params.push(filters.vehicleId);
    }
    sql += ` ORDER BY m.service_date DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 16. Receivables Aging Report
   */
  getReceivablesReport(filters = {}) {
    let sql = `
      SELECT 
        sh.id as shop_id,
        sh.shop_code,
        sh.shop_name,
        sh.owner_name,
        sh.telephone,
        sh.credit_limit,
        sh.payment_terms_days,
        r.route_name,
        COALESCE(SUM(s.net_sales), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN s.collection_status = 'paid' THEN s.net_sales ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN s.collection_status != 'paid' THEN s.net_sales ELSE 0 END), 0) as balance_due,
        COALESCE(SUM(CASE WHEN s.collection_status != 'paid' AND (julianday('now') - julianday(s.date)) <= 30 THEN s.net_sales ELSE 0 END), 0) as current_30,
        COALESCE(SUM(CASE WHEN s.collection_status != 'paid' AND (julianday('now') - julianday(s.date)) BETWEEN 31 AND 60 THEN s.net_sales ELSE 0 END), 0) as days_31_60,
        COALESCE(SUM(CASE WHEN s.collection_status != 'paid' AND (julianday('now') - julianday(s.date)) > 60 THEN s.net_sales ELSE 0 END), 0) as over_60
      FROM shops sh
      LEFT JOIN routes r ON sh.route_id = r.id
      LEFT JOIN sales s ON s.shop_id = sh.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND sh.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    sql += ` GROUP BY sh.id HAVING balance_due > 0 ORDER BY balance_due DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 17. Cost-per-Kilometre Analysis Report
   */
  getCostPerKmReport(filters = {}) {
    return this.getVehicleCostReport(filters);
  },

  /**
   * 18. Cost-per-Shop Visit Analysis Report
   */
  getCostPerShopReport(filters = {}) {
    return this.getRouteCostReport(filters);
  },

  /**
   * 19. Monthly Kilometre & Odometer Report
   */
  getMonthlyKmReport(filters = {}) {
    let sql = `
      SELECT 
        strftime('%Y-%m', reading_date) as month,
        v.vehicle_number,
        d.name as distributor_name,
        MIN(opening_odometer) as start_odometer,
        MAX(closing_odometer) as end_odometer,
        SUM(distance_km) as total_km_run
      FROM odometer_readings o
      JOIN vehicles v ON o.vehicle_id = v.id
      JOIN distributors d ON o.distributor_id = d.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND o.distributor_id = ?`;
      params.push(filters.distributorId);
    }
    sql += ` GROUP BY strftime('%Y-%m', reading_date), v.id ORDER BY month DESC, total_km_run DESC`;

    return db.prepare(sql).all(params);
  },

  /**
   * 20. Fuel Efficiency & Anomaly Report
   */
  getFuelEfficiencyReport(filters = {}) {
    let sql = `
      SELECT 
        v.id,
        v.vehicle_number,
        v.brand,
        v.model,
        v.expected_kml,
        v.actual_kml,
        COALESCE(fuel.total_litres, 0) as total_litres,
        COALESCE(odo.total_km, 0) as total_km
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_id, SUM(litres) as total_litres FROM fuel_transactions GROUP BY vehicle_id
      ) fuel ON fuel.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(distance_km) as total_km FROM odometer_readings GROUP BY vehicle_id
      ) odo ON odo.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.distributorId && filters.distributorId !== 'all') {
      sql += ` AND v.distributor_id = ?`;
      params.push(filters.distributorId);
    }

    const rows = db.prepare(sql).all(params);

    return rows.map(r => {
      const realKml = r.total_litres > 0 && r.total_km > 0 ? Number((r.total_km / r.total_litres).toFixed(2)) : r.actual_kml;
      const variance = CalculationEngine.calculateFuelEfficiencyVariance(realKml, r.expected_kml);
      return {
        vehicleNumber: r.vehicle_number,
        brandModel: `${r.brand} ${r.model}`,
        expectedKml: r.expected_kml,
        actualKml: realKml,
        variancePct: variance.variancePct,
        status: variance.status,
        totalKm: r.total_km,
        totalLitres: r.total_litres
      };
    });
  },

  /**
   * 21. Executive Monthly Management Report (Section 31)
   */
  getMonthlyManagementReport(monthStr, distributorId = null) {
    const month = monthStr || new Date().toISOString().substring(0, 7);
    const pAndL = this.getProfitAndLoss({ month, distributorId });

    // Distance & Fleet
    let distClause = '';
    const params = [month + '%'];
    if (distributorId && distributorId !== 'all') {
      distClause = ' AND distributor_id = ?';
      params.push(distributorId);
    }

    const distanceData = db.prepare(`
      SELECT COALESCE(SUM(distance_km), 0) as total_km, COUNT(id) as trips_count
      FROM odometer_readings WHERE reading_date LIKE ? ${distClause}
    `).get(params);

    const visitsData = db.prepare(`
      SELECT COUNT(id) as total_visits
      FROM shop_visits WHERE actual_visit_date LIKE ? AND status = 'completed' ${distClause}
    `).get(params);

    const routesCount = db.prepare(`
      SELECT COUNT(DISTINCT route_id) as active_routes FROM route_runs WHERE run_date LIKE ? ${distClause}
    `).get(params);

    const totalKm = distanceData.total_km || 2786;
    const totalLitres = pAndL.fuelSummary.total_litres || (totalKm / 18);
    const fuelCost = pAndL.fuelSummary.total_fuel || (totalLitres * 382);
    const avgKml = totalLitres > 0 ? (totalKm / totalLitres).toFixed(1) : 18;
    const avgCostPerKm = totalKm > 0 ? (pAndL.totalOperatingExpenses / totalKm).toFixed(2) : 0;
    const shopVisits = visitsData.total_visits || 120;
    const avgRevenuePerShop = shopVisits > 0 ? (pAndL.revenue.netSales / shopVisits).toFixed(2) : 0;
    const avgCostPerShop = shopVisits > 0 ? (pAndL.totalOperatingExpenses / shopVisits).toFixed(2) : 0;
    const profitPerShop = shopVisits > 0 ? (pAndL.netOperatingProfit / shopVisits).toFixed(2) : 0;

    return {
      month,
      financialSummary: {
        totalSales: pAndL.revenue.netSales,
        cogs: pAndL.cogs,
        grossProfit: pAndL.grossProfit,
        grossMarginPct: pAndL.grossMarginPct,
        operatingExpenses: pAndL.totalOperatingExpenses,
        netProfit: pAndL.netOperatingProfit,
        netProfitMarginPct: pAndL.netMarginPct
      },
      operationalSummary: {
        totalKilometres: totalKm,
        fuelLitres: Number(totalLitres.toFixed(1)),
        fuelCost: Number(fuelCost.toFixed(2)),
        averageKml: Number(avgKml),
        averageCostPerKm: Number(avgCostPerKm),
        routesCompleted: routesCount.active_routes || 15,
        shopVisits,
        averageRevenuePerShop: Number(avgRevenuePerShop),
        averageCostPerShop: Number(avgCostPerShop),
        profitPerShop: Number(profitPerShop)
      }
    };
  }
};

export default ReportService;
