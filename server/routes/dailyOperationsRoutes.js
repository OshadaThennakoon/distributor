import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import DailyOperationsService from '../services/dailyOperationsService.js';

const router = express.Router();

// GET /api/daily-operations/summary?date=YYYY-MM-DD
router.get('/daily-operations/summary', authenticate, scopeDistributor, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const distributorId = req.activeDistributorId || req.query.distributorId;
    const summary = DailyOperationsService.getDailySummary(date, distributorId);
    res.json(summary);
  } catch (err) {
    console.error('Error fetching daily summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/targets
router.get('/targets', authenticate, scopeDistributor, (req, res) => {
  try {
    const filters = {
      distributorId: req.activeDistributorId || req.query.distributorId,
      targetType: req.query.targetType,
      periodType: req.query.periodType
    };
    const targets = DailyOperationsService.getTargets(filters);
    res.json(targets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/targets
router.post('/targets', authenticate, requireRole(['ADMIN', 'FINANCE_USER']), (req, res) => {
  try {
    const result = DailyOperationsService.saveTarget(req.body);
    logAudit(req.user.id, 'SET_TARGET', 'targets', result.id, null, req.body, req.ip);
    res.status(201).json({ ...result, message: 'Target saved successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/targets/:id
router.delete('/targets/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  try {
    DailyOperationsService.deleteTarget(Number(req.params.id));
    res.json({ message: 'Target deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-operations/quick-sale
router.post('/daily-operations/quick-sale', authenticate, (req, res) => {
  try {
    const { distributor_id, date, route_id, shop_id, amount, payment_type } = req.body;
    if (!distributor_id || !shop_id || !amount) {
      return res.status(400).json({ error: 'Distributor, shop, and amount are required' });
    }

    const saleDate = date || new Date().toISOString().split('T')[0];
    const gross = Number(amount);
    const disc = 0;
    const net = gross - disc;
    const cogs = Math.round(net * 0.70); // standard 70% COGS
    const profit = net - cogs;
    const invNum = `INV-D-${Date.now()}`;

    const result = db.prepare(`
      INSERT INTO sales (
        distributor_id, invoice_number, date, route_id, shop_id,
        total_gross, discount, net_sales, total_cogs, gross_profit, payment_type, collection_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')
    `).run(distributor_id, invNum, saleDate, route_id || null, shop_id, gross, disc, net, cogs, profit, payment_type || 'cash');

    res.status(201).json({ id: result.lastInsertRowid, invoiceNumber: invNum, netSales: net, message: 'Daily sale recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-operations/quick-cost
router.post('/daily-operations/quick-cost', authenticate, (req, res) => {
  try {
    const { distributor_id, category_id, date, amount, route_id, vehicle_id, description } = req.body;
    if (!distributor_id || !amount) {
      return res.status(400).json({ error: 'Distributor and amount are required' });
    }

    const expDate = date || new Date().toISOString().split('T')[0];
    const catId = category_id || 4; // default driver route allowance or general

    const result = db.prepare(`
      INSERT INTO expenses (
        distributor_id, category_id, date, amount, vehicle_id, route_id, description, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'cash')
    `).run(distributor_id, catId, expDate, Number(amount), vehicle_id || null, route_id || null, description || 'Daily operational cost');

    res.status(201).json({ id: result.lastInsertRowid, message: 'Daily cost recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-operations/quick-km
router.post('/daily-operations/quick-km', authenticate, (req, res) => {
  try {
    const { distributor_id, vehicle_id, driver_id, route_id, date, opening_odometer, closing_odometer, distance_km } = req.body;
    if (!vehicle_id || (!distance_km && (!opening_odometer || !closing_odometer))) {
      return res.status(400).json({ error: 'Vehicle and distance (or odometer readings) are required' });
    }

    const readingDate = date || new Date().toISOString().split('T')[0];
    const openOdo = Number(opening_odometer) || 0;
    const closeOdo = Number(closing_odometer) || openOdo;
    const dist = Number(distance_km) || Math.max(closeOdo - openOdo, 0);

    const result = db.prepare(`
      INSERT INTO odometer_readings (
        distributor_id, vehicle_id, driver_id, route_id, reading_date, opening_odometer, closing_odometer, distance_km
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(distributor_id || 1, vehicle_id, driver_id || null, route_id || null, readingDate, openOdo, closeOdo, dist);

    // Update vehicle's current odometer
    db.prepare(`UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?`).run(closeOdo, vehicle_id);

    res.status(201).json({ id: result.lastInsertRowid, distanceKm: dist, message: 'Daily KM recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
