import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import CalculationEngine from '../services/calculationEngine.js';

const router = express.Router();

// GET /api/vehicles
router.get('/vehicles', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      v.*,
      d.name as distributor_name,
      dr.full_name as assigned_driver_name,
      r.route_name as assigned_route_name,
      (SELECT SUM(total_amount) FROM fuel_transactions WHERE vehicle_id = v.id) as total_fuel_cost,
      (SELECT SUM(litres) FROM fuel_transactions WHERE vehicle_id = v.id) as total_litres,
      (SELECT SUM(total_cost) FROM maintenance WHERE vehicle_id = v.id) as total_maint_cost,
      (SELECT MAX(service_date) FROM maintenance WHERE vehicle_id = v.id) as last_service_date,
      (SELECT MAX(next_service_odometer) FROM maintenance WHERE vehicle_id = v.id) as next_service_odometer
    FROM vehicles v
    JOIN distributors d ON v.distributor_id = d.id
    LEFT JOIN drivers dr ON v.assigned_driver_id = dr.id
    LEFT JOIN routes r ON v.assigned_route_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND v.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY v.id ASC`;

  const vehicles = db.prepare(sql).all(params);

  // Check maintenance and license alerts
  const today = new Date();
  const enriched = vehicles.map(v => {
    const alerts = [];
    if (v.insurance_expiry && new Date(v.insurance_expiry) < today) {
      alerts.push('INSURANCE_EXPIRED');
    }
    if (v.revenue_license_expiry && new Date(v.revenue_license_expiry) < today) {
      alerts.push('LICENSE_EXPIRED');
    }
    if (v.next_service_odometer && v.current_odometer >= v.next_service_odometer) {
      alerts.push('SERVICE_DUE');
    }

    const variance = CalculationEngine.calculateFuelEfficiencyVariance(v.actual_kml, v.expected_kml);

    return {
      ...v,
      alerts,
      efficiencyVariancePct: variance.variancePct,
      efficiencyStatus: variance.status
    };
  });

  res.json(enriched);
});

// POST /api/vehicles
router.post('/vehicles', authenticate, requireRole(['ADMIN']), (req, res) => {
  const {
    distributor_id, vehicle_number, vehicle_type, brand, model, year, fuel_type,
    fuel_tank_capacity_l, expected_kml, purchase_date, current_odometer,
    assigned_route_id, assigned_driver_id, insurance_expiry, revenue_license_expiry, service_interval_km, notes
  } = req.body;

  if (!distributor_id || !vehicle_number || !vehicle_type || !expected_kml) {
    return res.status(400).json({ error: 'Distributor, vehicle number, type, and expected km/L are required' });
  }

  const result = db.prepare(`
    INSERT INTO vehicles (
      distributor_id, vehicle_number, vehicle_type, brand, model, year, fuel_type,
      fuel_tank_capacity_l, expected_kml, actual_kml, purchase_date, current_odometer,
      assigned_route_id, assigned_driver_id, insurance_expiry, revenue_license_expiry, service_interval_km, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    distributor_id, vehicle_number, vehicle_type, brand || '', model || '', year || null,
    fuel_type || 'Diesel', fuel_tank_capacity_l || 40, expected_kml, expected_kml,
    purchase_date || null, current_odometer || 0, assigned_route_id || null, assigned_driver_id || null,
    insurance_expiry || null, revenue_license_expiry || null, service_interval_km || 5000, notes || null
  );

  logAudit(req.user.id, 'CREATE_VEHICLE', 'vehicles', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Vehicle added successfully' });
});

// PUT /api/vehicles/:id
router.put('/vehicles/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  const {
    vehicle_type, brand, model, year, fuel_type, fuel_tank_capacity_l, expected_kml,
    actual_kml, current_odometer, assigned_route_id, assigned_driver_id,
    insurance_expiry, revenue_license_expiry, service_interval_km, status, notes
  } = req.body;

  db.prepare(`
    UPDATE vehicles
    SET vehicle_type = COALESCE(?, vehicle_type),
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        year = COALESCE(?, year),
        fuel_type = COALESCE(?, fuel_type),
        fuel_tank_capacity_l = COALESCE(?, fuel_tank_capacity_l),
        expected_kml = COALESCE(?, expected_kml),
        actual_kml = COALESCE(?, actual_kml),
        current_odometer = COALESCE(?, current_odometer),
        assigned_route_id = COALESCE(?, assigned_route_id),
        assigned_driver_id = COALESCE(?, assigned_driver_id),
        insurance_expiry = COALESCE(?, insurance_expiry),
        revenue_license_expiry = COALESCE(?, revenue_license_expiry),
        service_interval_km = COALESCE(?, service_interval_km),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    vehicle_type, brand, model, year, fuel_type, fuel_tank_capacity_l, expected_kml,
    actual_kml, current_odometer, assigned_route_id, assigned_driver_id,
    insurance_expiry, revenue_license_expiry, service_interval_km, status, notes, id
  );

  logAudit(req.user.id, 'UPDATE_VEHICLE', 'vehicles', id, null, req.body, req.ip);
  res.json({ message: 'Vehicle updated successfully' });
});

// GET /api/drivers
router.get('/drivers', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      dr.*,
      d.name as distributor_name,
      v.vehicle_number as assigned_vehicle_number,
      (SELECT COUNT(*) FROM route_runs WHERE driver_id = dr.id) as trips_count,
      (SELECT SUM(distance_km) FROM route_runs WHERE driver_id = dr.id) as total_km_driven
    FROM drivers dr
    JOIN distributors d ON dr.distributor_id = d.id
    LEFT JOIN vehicles v ON dr.assigned_vehicle_id = v.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND dr.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY dr.id ASC`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/drivers
router.post('/drivers', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { distributor_id, full_name, nic, phone, license_number, license_expiry, monthly_salary, daily_allowance, assigned_vehicle_id, notes } = req.body;
  if (!distributor_id || !full_name || !nic || !license_number || !license_expiry) {
    return res.status(400).json({ error: 'Missing required driver fields' });
  }

  const result = db.prepare(`
    INSERT INTO drivers (
      distributor_id, full_name, nic, phone, license_number, license_expiry,
      monthly_salary, daily_allowance, assigned_vehicle_id, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    distributor_id, full_name, nic, phone || '', license_number, license_expiry,
    monthly_salary || 0, daily_allowance || 0, assigned_vehicle_id || null, notes || null
  );

  logAudit(req.user.id, 'CREATE_DRIVER', 'drivers', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Driver registered successfully' });
});

// GET /api/fuel-transactions
router.get('/fuel-transactions', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      ft.*,
      d.name as distributor_name,
      v.vehicle_number,
      dr.full_name as driver_name,
      r.route_name
    FROM fuel_transactions ft
    JOIN distributors d ON ft.distributor_id = d.id
    JOIN vehicles v ON ft.vehicle_id = v.id
    LEFT JOIN drivers dr ON ft.driver_id = dr.id
    LEFT JOIN routes r ON ft.route_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND ft.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  if (req.query.vehicleId && req.query.vehicleId !== 'all') {
    sql += ` AND ft.vehicle_id = ?`;
    params.push(Number(req.query.vehicleId));
  }
  sql += ` ORDER BY ft.transaction_date DESC LIMIT 100`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/fuel-transactions
router.post('/fuel-transactions', authenticate, (req, res) => {
  const { distributor_id, vehicle_id, driver_id, route_id, transaction_date, fuel_type, litres, price_per_litre, odometer_reading, fuel_station, receipt_number, payment_method, notes } = req.body;
  if (!vehicle_id || !litres || !price_per_litre) {
    return res.status(400).json({ error: 'Vehicle, litres, and price per litre are required' });
  }

  const totalAmount = Number((litres * price_per_litre).toFixed(2));
  const date = transaction_date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO fuel_transactions (
      distributor_id, vehicle_id, driver_id, route_id, transaction_date, fuel_type,
      litres, price_per_litre, total_amount, odometer_reading, fuel_station, receipt_number, payment_method, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    distributor_id || 1, vehicle_id, driver_id || null, route_id || null, date, fuel_type || 'Diesel',
    litres, price_per_litre, totalAmount, odometer_reading || null, fuel_station || null, receipt_number || null,
    payment_method || 'Cash', notes || null
  );

  // Update vehicle current odometer if provided and greater
  if (odometer_reading) {
    db.prepare(`UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?`).run(odometer_reading, vehicle_id);
  }

  res.status(201).json({ id: result.lastInsertRowid, totalAmount, message: 'Fuel entry recorded successfully' });
});

// GET /api/fuel-prices
router.get('/fuel-prices', authenticate, (req, res) => {
  const prices = db.prepare(`SELECT * FROM fuel_prices ORDER BY effective_date DESC`).all();
  res.json(prices);
});

// POST /api/fuel-prices (ADMIN only)
router.post('/fuel-prices', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { fuel_type, price_per_litre, effective_date, notes } = req.body;
  if (!fuel_type || !price_per_litre || !effective_date) {
    return res.status(400).json({ error: 'Fuel type, price per litre, and effective date are required' });
  }

  const result = db.prepare(`
    INSERT INTO fuel_prices (fuel_type, price_per_litre, effective_date, notes)
    VALUES (?, ?, ?, ?)
  `).run(fuel_type, price_per_litre, effective_date, notes || null);

  logAudit(req.user.id, 'ADD_FUEL_PRICE', 'fuel_prices', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Fuel price updated successfully' });
});

// GET /api/maintenance
router.get('/maintenance', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      m.*,
      d.name as distributor_name,
      v.vehicle_number,
      v.brand,
      v.model
    FROM maintenance m
    JOIN distributors d ON m.distributor_id = d.id
    JOIN vehicles v ON m.vehicle_id = v.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND m.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY m.service_date DESC`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/maintenance
router.post('/maintenance', authenticate, (req, res) => {
  const { distributor_id, vehicle_id, service_date, odometer, service_type, parts_cost, labor_cost, next_service_odometer, next_service_date, garage, invoice_number, notes } = req.body;
  if (!vehicle_id || !service_date) {
    return res.status(400).json({ error: 'Vehicle and service date are required' });
  }

  const parts = Number(parts_cost) || 0;
  const labor = Number(labor_cost) || 0;
  const total = parts + labor;

  const result = db.prepare(`
    INSERT INTO maintenance (
      distributor_id, vehicle_id, service_date, odometer, service_type,
      parts_cost, labor_cost, total_cost, next_service_odometer, next_service_date, garage, invoice_number, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    distributor_id || 1, vehicle_id, service_date, odometer || 0, service_type || 'routine',
    parts, labor, total, next_service_odometer || null, next_service_date || null,
    garage || null, invoice_number || null, notes || null
  );

  // Also log into expenses table under category Maintenance (id: 2)
  db.prepare(`
    INSERT INTO expenses (distributor_id, category_id, date, amount, vehicle_id, supplier_name, receipt_number, description)
    VALUES (?, 2, ?, ?, ?, ?, ?, ?)
  `).run(distributor_id || 1, service_date, total, vehicle_id, garage || 'Service Center', invoice_number || null, `Vehicle Maintenance: ${service_type}`);

  res.status(201).json({ id: result.lastInsertRowid, totalCost: total, message: 'Maintenance record saved' });
});

export default router;
