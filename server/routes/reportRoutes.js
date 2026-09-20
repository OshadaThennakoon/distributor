import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import ReportService from '../services/reportService.js';
import ExportService from '../services/exportService.js';
import { db } from '../config/database.js';

const router = express.Router();

// Helper to fetch report data by type
function fetchReportData(reportType, filters = {}) {
  switch (reportType) {
    case 'daily-sales':
      return ReportService.getDailySalesReport(filters);
    case 'weekly-sales':
      return ReportService.getWeeklySalesReport(filters);
    case 'monthly-sales':
      return ReportService.getMonthlySalesReport(filters);
    case 'profit-loss':
      return ReportService.getProfitAndLoss(filters);
    case 'expense':
      return ReportService.getExpenseReport(filters);
    case 'fuel':
      return ReportService.getFuelReport(filters);
    case 'vehicle-cost':
      return ReportService.getVehicleCostReport(filters);
    case 'route-cost':
      return ReportService.getRouteCostReport(filters);
    case 'route-profitability':
      return ReportService.getRouteProfitabilityReport(filters);
    case 'distributor-profitability':
      return ReportService.getDistributorProfitabilityReport();
    case 'territory-profitability':
      return ReportService.getTerritoryProfitabilityReport(filters);
    case 'customer-sales':
      return ReportService.getCustomerSalesReport(filters);
    case 'product-sales':
      return ReportService.getProductSalesReport(filters);
    case 'driver-expense':
      return ReportService.getDriverExpenseReport(filters);
    case 'maintenance':
      return ReportService.getMaintenanceReport(filters);
    case 'receivables':
      return ReportService.getReceivablesReport(filters);
    case 'cost-per-km':
      return ReportService.getCostPerKmReport(filters);
    case 'cost-per-shop':
      return ReportService.getCostPerShopReport(filters);
    case 'monthly-km':
      return ReportService.getMonthlyKmReport(filters);
    case 'fuel-efficiency':
      return ReportService.getFuelEfficiencyReport(filters);
    case 'monthly-management':
      return ReportService.getMonthlyManagementReport(filters.month, filters.distributorId);
    default:
      return null;
  }
}

// GET /api/reports/:reportType
router.get('/reports/:reportType', authenticate, scopeDistributor, (req, res) => {
  const { reportType } = req.params;
  const filters = {
    ...req.query,
    distributorId: req.activeDistributorId || req.query.distributorId
  };

  const data = fetchReportData(reportType, filters);
  if (!data) {
    return res.status(404).json({ error: `Unknown report type: ${reportType}` });
  }

  res.json(data);
});

// GET /api/reports/:reportType/export?format=xlsx|csv
router.get('/reports/:reportType/export', authenticate, scopeDistributor, (req, res) => {
  const { reportType } = req.params;
  const format = req.query.format || 'xlsx';
  const filters = {
    ...req.query,
    distributorId: req.activeDistributorId || req.query.distributorId
  };

  const data = fetchReportData(reportType, filters);
  if (!data) {
    return res.status(404).json({ error: `Unknown report type: ${reportType}` });
  }

  // Flatten or extract rows
  let rows = Array.isArray(data) ? data : (data.rows || []);
  if (reportType === 'route-profitability') {
    rows = data.map(r => ({
      'Route Name': r.routeName,
      'Shops Count': r.shopsCount,
      'Total Distance (KM)': r.distanceKm,
      'Sales Revenue (Rs.)': r.salesRevenue,
      'COGS (Rs.)': r.cogs,
      'Gross Profit (Rs.)': r.grossProfit,
      'Route Operating Cost (Rs.)': r.routeCost,
      'Net Profit (Rs.)': r.netProfit,
      'Net Margin %': r.netMarginPct,
      'Revenue / KM': r.unitEconomics?.revenuePerKm,
      'Cost / KM': r.unitEconomics?.costPerKm,
      'Profit / KM': r.unitEconomics?.profitPerKm,
      'Cost / Shop': r.unitEconomics?.costPerShop
    }));
  }

  if (rows.length === 0) {
    rows = [{ message: 'No records found for the selected criteria' }];
  }

  if (format === 'csv') {
    const csv = ExportService.generateCsvString(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.csv"`);
    return res.send(csv);
  }

  const buffer = ExportService.generateExcelBuffer(rows, reportType.substring(0, 31));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.xlsx"`);
  res.send(buffer);
});

// POST /api/import/:entityType (CSV / JSON Import)
router.post('/import/:entityType', authenticate, (req, res) => {
  const { entityType } = req.params;
  const { records = [] } = req.body;

  if (!records || records.length === 0) {
    return res.status(400).json({ error: 'No records provided for import' });
  }

  let imported = 0;
  db.transaction(() => {
    if (entityType === 'shops') {
      const stmt = db.prepare(`
        INSERT INTO shops (distributor_id, territory_id, route_id, shop_name, shop_code, owner_name, telephone, town, customer_type, credit_limit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `);
      for (const r of records) {
        stmt.run(r.distributor_id || 1, r.territory_id || null, r.route_id || null, r.shop_name, r.shop_code, r.owner_name || null, r.telephone || null, r.town || null, r.customer_type || 'Retail shop', r.credit_limit || 0);
        imported++;
      }
    } else if (entityType === 'products') {
      const stmt = db.prepare(`
        INSERT INTO products (distributor_id, category_id, product_name, sku, brand, unit, cost_price, selling_price, stock_quantity, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const r of records) {
        stmt.run(r.distributor_id || 1, r.category_id || null, r.product_name, r.sku, r.brand || '', r.unit || 'piece', r.cost_price || 0, r.selling_price || 0, r.stock_quantity || 0);
        imported++;
      }
    }
  })();

  res.json({ message: `Successfully imported ${imported} ${entityType}` });
});

export default router;
