import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import CalculationEngine from '../services/calculationEngine.js';

const router = express.Router();

// GET /api/routes
router.get('/routes', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      r.*,
      d.name as distributor_name,
      d.currency_symbol,
      dc.name as dc_name,
      t.name as territory_name,
      v.vehicle_number,
      v.brand as vehicle_brand,
      v.model as vehicle_model,
      COALESCE(v.expected_kml, 18) as expected_kml,
      dr.full_name as driver_name,
      (SELECT COUNT(*) FROM shops WHERE route_id = r.id) as current_shops_count
    FROM routes r
    JOIN distributors d ON r.distributor_id = d.id
    LEFT JOIN distribution_centers dc ON r.distribution_center_id = dc.id
    LEFT JOIN territories t ON r.territory_id = t.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    LEFT JOIN drivers dr ON r.driver_id = dr.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND r.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY r.id ASC`;

  const routes = db.prepare(sql).all(params);

  // Augment each route with CalculationEngine cycle calculations
  const augmented = routes.map(r => {
    const cycle = CalculationEngine.calculateRouteCycle(r.route_distance_km, r.frequency_days);
    return {
      ...r,
      monthlyCycles: cycle.monthlyCycles,
      monthlyDistanceKm: cycle.monthlyDistanceKm
    };
  });

  res.json(augmented);
});

// GET /api/routes/:id
router.get('/routes/:id', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const route = db.prepare(`
    SELECT 
      r.*,
      d.name as distributor_name,
      d.currency_symbol,
      dc.name as dc_name,
      t.name as territory_name,
      v.vehicle_number,
      v.fuel_type,
      COALESCE(v.expected_kml, 18) as expected_kml,
      dr.full_name as driver_name,
      COALESCE(dr.monthly_salary, 65000) as driver_salary,
      COALESCE(dr.daily_allowance, 1500) as driver_allowance
    FROM routes r
    JOIN distributors d ON r.distributor_id = d.id
    LEFT JOIN distribution_centers dc ON r.distribution_center_id = dc.id
    LEFT JOIN territories t ON r.territory_id = t.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    LEFT JOIN drivers dr ON r.driver_id = dr.id
    WHERE r.id = ?
  `).get(id);

  if (!route) return res.status(404).json({ error: 'Route not found' });

  // Get stops
  const stops = db.prepare(`
    SELECT rs.*, sh.shop_name, sh.owner_name, sh.telephone, sh.customer_type
    FROM route_stops rs
    LEFT JOIN shops sh ON rs.shop_id = sh.id
    WHERE rs.route_id = ?
    ORDER BY rs.stop_order ASC
  `).all(id);

  // Get shops directly assigned to this route
  const assignedShops = db.prepare(`
    SELECT id, shop_name, shop_code, owner_name, telephone, town, customer_type, credit_limit, latitude, longitude
    FROM shops WHERE route_id = ?
  `).all(id);

  // Compute live route economics using calculation engine
  const economics = CalculationEngine.calculateTotalRouteCost({
    distanceKm: route.route_distance_km,
    kmPerLitre: route.expected_kml,
    fuelPricePerLitre: 382,
    driverMonthlySalary: route.driver_salary,
    driverDailyAllowance: route.driver_allowance,
    numberOfShops: assignedShops.length || route.number_of_shops
  });

  const cycle = CalculationEngine.calculateRouteCycle(route.route_distance_km, route.frequency_days);

  res.json({
    route,
    stops,
    shops: assignedShops,
    economics,
    cycle
  });
});

// POST /api/routes
router.post('/routes', authenticate, requireRole(['ADMIN']), (req, res) => {
  const {
    distributor_id, distribution_center_id, territory_id, route_name, route_code,
    starting_location, ending_location, route_distance_km, estimated_travel_time_mins,
    visit_frequency, frequency_days, route_type, vehicle_id, driver_id, notes
  } = req.body;

  if (!distributor_id || !route_name || !route_code) {
    return res.status(400).json({ error: 'Distributor, route name, and route code are required' });
  }

  const result = db.prepare(`
    INSERT INTO routes (
      distributor_id, distribution_center_id, territory_id, route_name, route_code,
      starting_location, ending_location, route_distance_km, estimated_travel_time_mins,
      number_of_shops, visit_frequency, frequency_days, route_type, vehicle_id, driver_id, is_active, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    distributor_id, distribution_center_id || null, territory_id || null, route_name, route_code,
    starting_location || 'Distribution Center', ending_location || 'Distribution Center',
    route_distance_km || 0, estimated_travel_time_mins || 0,
    visit_frequency || 'Every 3 weeks', frequency_days || 21, route_type || 'Regular',
    vehicle_id || null, driver_id || null, notes || null
  );

  logAudit(req.user.id, 'CREATE_ROUTE', 'routes', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Route created successfully' });
});

// PUT /api/routes/:id
router.put('/routes/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  const {
    route_name, route_code, territory_id, distribution_center_id, starting_location, ending_location,
    route_distance_km, estimated_travel_time_mins, visit_frequency, frequency_days,
    route_type, vehicle_id, driver_id, is_active, notes
  } = req.body;

  db.prepare(`
    UPDATE routes
    SET route_name = COALESCE(?, route_name),
        route_code = COALESCE(?, route_code),
        territory_id = COALESCE(?, territory_id),
        distribution_center_id = COALESCE(?, distribution_center_id),
        starting_location = COALESCE(?, starting_location),
        ending_location = COALESCE(?, ending_location),
        route_distance_km = COALESCE(?, route_distance_km),
        estimated_travel_time_mins = COALESCE(?, estimated_travel_time_mins),
        visit_frequency = COALESCE(?, visit_frequency),
        frequency_days = COALESCE(?, frequency_days),
        route_type = COALESCE(?, route_type),
        vehicle_id = COALESCE(?, vehicle_id),
        driver_id = COALESCE(?, driver_id),
        is_active = COALESCE(?, is_active),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    route_name, route_code, territory_id, distribution_center_id, starting_location, ending_location,
    route_distance_km, estimated_travel_time_mins, visit_frequency, frequency_days,
    route_type, vehicle_id, driver_id, is_active, notes, id
  );

  logAudit(req.user.id, 'UPDATE_ROUTE', 'routes', id, null, req.body, req.ip);
  res.json({ message: 'Route updated successfully' });
});

// DELETE /api/routes/:id
router.delete('/routes/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM routes WHERE id = ?`).run(id);
  logAudit(req.user.id, 'DELETE_ROUTE', 'routes', id, null, null, req.ip);
  res.json({ message: 'Route deleted successfully' });
});

// POST /api/routes/:id/stops
router.post('/routes/:id/stops', authenticate, requireRole(['ADMIN']), (req, res) => {
  const routeId = Number(req.params.id);
  const { stop_name, stop_type, shop_id, distance_from_prev_km, latitude, longitude } = req.body;

  const maxOrder = db.prepare(`SELECT MAX(stop_order) as m FROM route_stops WHERE route_id = ?`).get(routeId);
  const nextOrder = (maxOrder?.m || 0) + 1;

  const result = db.prepare(`
    INSERT INTO route_stops (route_id, stop_order, stop_name, stop_type, shop_id, distance_from_prev_km, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(routeId, nextOrder, stop_name, stop_type || 'shop', shop_id || null, distance_from_prev_km || 0, latitude || null, longitude || null);

  // Recalculate route total distance
  const totalDist = db.prepare(`SELECT SUM(distance_from_prev_km) as td FROM route_stops WHERE route_id = ?`).get(routeId);
  if (totalDist && totalDist.td > 0) {
    db.prepare(`UPDATE routes SET route_distance_km = ? WHERE id = ?`).run(totalDist.td, routeId);
  }

  res.status(201).json({ id: result.lastInsertRowid, message: 'Stop added successfully' });
});

export default router;
