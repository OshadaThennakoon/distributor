import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../config/database.js';
import DailyOperationsService from '../services/dailyOperationsService.js';

describe('Daily Operations & Target Tracking Engine', () => {
  initDatabase();

  it('should retrieve seeded targets for distributor and specific periods', () => {
    const targets = DailyOperationsService.getTargets({ distributorId: 1 });
    assert.ok(targets.length > 0);
    const monthlySales = targets.find(t => t.target_type === 'sales' && t.period_type === 'monthly' && t.target_period === '2026-09');
    assert.ok(monthlySales);
    assert.equal(monthlySales.target_value, 2500000);
  });

  it('should save and update targets with upsert logic', () => {
    db.prepare(`DELETE FROM targets WHERE distributor_id = 1 AND target_type = 'sales' AND target_period = '2026-09-25' AND route_id IS NULL`).run();
    const saved = DailyOperationsService.saveTarget({
      distributor_id: 1,
      target_type: 'sales',
      period_type: 'daily',
      target_period: '2026-09-25',
      target_value: 175000,
      notes: 'Test Daily Target'
    });
    assert.ok(saved.id);
    assert.equal(saved.action, 'created');

    // Update the same target
    const updated = DailyOperationsService.saveTarget({
      distributor_id: 1,
      target_type: 'sales',
      period_type: 'daily',
      target_period: '2026-09-25',
      target_value: 190000,
      notes: 'Updated Test Daily Target'
    });
    assert.equal(updated.id, saved.id);
    assert.equal(updated.action, 'updated');

    const check = db.prepare(`SELECT target_value FROM targets WHERE id = ?`).get(saved.id);
    assert.equal(check.target_value, 190000);
  });

  it('should accurately aggregate daily sales, daily costs, and daily km against targets', () => {
    // September 2 has seeded route transactions
    const summary = DailyOperationsService.getDailySummary('2026-09-02', 1);

    assert.equal(summary.date, '2026-09-02');
    assert.ok(summary.metrics.dailySales.actual > 0, 'Daily sales should be greater than 0');
    assert.ok(summary.metrics.dailySales.target > 0, 'Daily sales target should be present');
    assert.ok(summary.metrics.dailySales.achievedPct > 0);

    assert.ok(summary.metrics.dailyCost.actual > 0, 'Daily cost should be greater than 0');
    assert.ok(summary.metrics.dailyCost.target > 0, 'Daily cost budget should be present');

    assert.ok(summary.metrics.dailyKm.actual > 0, 'Daily km should be greater than 0');
    assert.ok(summary.metrics.dailyKm.target > 0, 'Daily km target should be present');

    assert.ok(summary.routeBreakdown.length > 0, 'Route breakdown should list routes');
    const firstRoute = summary.routeBreakdown[0];
    assert.ok(firstRoute.route_name);
  });
});
