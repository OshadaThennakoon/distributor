import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../config/database.js';
import ReportService from '../services/reportService.js';

describe('Multi-Distributor Tenant Scoping & Financial Reporting (Section 4 & 30)', () => {
  initDatabase();

  it('should guarantee distributor isolation when filtering by distributorId', () => {
    // Distributor 1 (Kekirawa)
    const kekirawaShops = db.prepare(`SELECT COUNT(*) as c FROM shops WHERE distributor_id = 1`).get();
    assert.equal(kekirawaShops.c, 100);

    // Distributor 2 (Colombo) should have 0 shops in current demo set
    const colomboShops = db.prepare(`SELECT COUNT(*) as c FROM shops WHERE distributor_id = 2`).get();
    assert.equal(colomboShops.c, 0);

    // Routes for Kekirawa
    const kekirawaRoutes = db.prepare(`SELECT COUNT(*) as c FROM routes WHERE distributor_id = 1`).get();
    assert.equal(kekirawaRoutes.c, 15);
  });

  it('should generate accurate Profit & Loss statement with transparent COGS and OPEX', () => {
    const pAndL = ReportService.getProfitAndLoss({ month: '2026-08', distributorId: 1 });
    assert.ok(pAndL.revenue.netSales > 0);
    assert.ok(pAndL.cogs > 0);
    assert.ok(pAndL.grossProfit > 0);
    assert.ok(pAndL.totalOperatingExpenses > 0);
    assert.ok(pAndL.grossMarginPct > 15);
    assert.equal(pAndL.netOperatingProfit, Number((pAndL.grossProfit - pAndL.totalOperatingExpenses).toFixed(2)));
  });

  it('should generate Route Profitability with unit economics for all 15 routes', () => {
    const routeProfitability = ReportService.getRouteProfitabilityReport({ distributorId: 1 });
    assert.equal(routeProfitability.length, 15);
    const first = routeProfitability[0];
    assert.ok(first.routeName);
    assert.ok(first.salesRevenue > 0);
    assert.ok(first.routeCost > 0);
    assert.ok(first.unitEconomics.revenuePerKm > 0);
    assert.ok(first.unitEconomics.costPerKm > 0);
  });

  it('should generate Executive Monthly Management Report (Section 31)', () => {
    const report = ReportService.getMonthlyManagementReport('2026-08', 1);
    assert.ok(report.financialSummary.totalSales > 0);
    assert.ok(report.operationalSummary.totalKilometres > 0);
    assert.ok(report.operationalSummary.fuelCost > 0);
    assert.ok(report.operationalSummary.averageKml > 0);
    assert.ok(report.operationalSummary.averageCostPerKm > 0);
    assert.ok(report.operationalSummary.shopVisits > 0);
  });
});
