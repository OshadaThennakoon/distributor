import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';
import DateFrequencyEngine from '../services/dateFrequencyEngine.js';

const router = express.Router();

// GET /api/shops
router.get('/shops', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      s.*,
      d.name as distributor_name,
      t.name as territory_name,
      r.route_name,
      r.route_code,
      r.frequency_days,
      (SELECT MAX(actual_visit_date) FROM shop_visits WHERE shop_id = s.id AND status = 'completed') as last_visit_date,
      (SELECT COUNT(*) FROM sales WHERE shop_id = s.id) as total_orders,
      (SELECT COALESCE(SUM(net_sales), 0) FROM sales WHERE shop_id = s.id) as total_spend,
      (SELECT COALESCE(SUM(CASE WHEN collection_status != 'paid' THEN net_sales ELSE 0 END), 0) FROM sales WHERE shop_id = s.id) as outstanding_balance
    FROM shops s
    JOIN distributors d ON s.distributor_id = d.id
    LEFT JOIN territories t ON s.territory_id = t.id
    LEFT JOIN routes r ON s.route_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND s.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  if (req.query.routeId && req.query.routeId !== 'all') {
    sql += ` AND s.route_id = ?`;
    params.push(Number(req.query.routeId));
  }
  if (req.query.customerType && req.query.customerType !== 'all') {
    sql += ` AND s.customer_type = ?`;
    params.push(req.query.customerType);
  }
  if (req.query.search) {
    sql += ` AND (s.shop_name LIKE ? OR s.shop_code LIKE ? OR s.owner_name LIKE ? OR s.town LIKE ?)`;
    const sTerm = `%${req.query.search}%`;
    params.push(sTerm, sTerm, sTerm, sTerm);
  }

  sql += ` ORDER BY s.id ASC`;
  const shops = db.prepare(sql).all(params);

  // Compute next visit schedule for each shop
  const enriched = shops.map(sh => {
    const schedule = DateFrequencyEngine.getShopScheduleProfile(sh.last_visit_date, sh.frequency_days || 21);
    return {
      ...sh,
      next_visit_date: schedule.nextVisitDate,
      visit_status: schedule.status
    };
  });

  res.json(enriched);
});

// GET /api/shops/:id
router.get('/shops/:id', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const shop = db.prepare(`
    SELECT s.*, d.name as distributor_name, t.name as territory_name, r.route_name, r.frequency_days
    FROM shops s
    JOIN distributors d ON s.distributor_id = d.id
    LEFT JOIN territories t ON s.territory_id = t.id
    LEFT JOIN routes r ON s.route_id = r.id
    WHERE s.id = ?
  `).get(id);

  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  // Get visits
  const visits = db.prepare(`
    SELECT sv.*, dr.full_name as driver_name, v.vehicle_number
    FROM shop_visits sv
    LEFT JOIN drivers dr ON sv.driver_id = dr.id
    LEFT JOIN vehicles v ON sv.vehicle_id = v.id
    WHERE sv.shop_id = ?
    ORDER BY sv.planned_date DESC
    LIMIT 20
  `).all(id);

  // Get sales invoices
  const sales = db.prepare(`
    SELECT id, invoice_number, date, total_gross, discount, net_sales, gross_profit, collection_status
    FROM sales WHERE shop_id = ?
    ORDER BY date DESC
    LIMIT 20
  `).all(id);

  const lastVisit = visits.find(v => v.status === 'completed')?.actual_visit_date || null;
  const schedule = DateFrequencyEngine.getShopScheduleProfile(lastVisit, shop.frequency_days || 21);

  res.json({ shop, visits, sales, schedule });
});

// POST /api/shops
router.post('/shops', authenticate, requireRole(['ADMIN']), (req, res) => {
  const {
    distributor_id, territory_id, route_id, shop_name, shop_code, owner_name,
    telephone, address, town, district, latitude, longitude, customer_type, credit_limit, payment_terms_days, notes
  } = req.body;

  if (!distributor_id || !shop_name || !shop_code) {
    return res.status(400).json({ error: 'Distributor, shop name, and shop code are required' });
  }

  const result = db.prepare(`
    INSERT INTO shops (
      distributor_id, territory_id, route_id, shop_name, shop_code, owner_name,
      telephone, address, town, district, latitude, longitude, customer_type,
      credit_limit, payment_terms_days, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    distributor_id, territory_id || null, route_id || null, shop_name, shop_code, owner_name || null,
    telephone || null, address || null, town || null, district || null, latitude || 0, longitude || 0,
    customer_type || 'Retail shop', credit_limit || 0, payment_terms_days || 14, notes || null
  );

  // Also update number_of_shops in route if assigned
  if (route_id) {
    db.prepare(`UPDATE routes SET number_of_shops = (SELECT COUNT(*) FROM shops WHERE route_id = ?) WHERE id = ?`).run(route_id, route_id);
  }

  logAudit(req.user.id, 'CREATE_SHOP', 'shops', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Shop registered successfully' });
});

// PUT /api/shops/:id
router.put('/shops/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  const {
    territory_id, route_id, shop_name, shop_code, owner_name, telephone, address,
    town, district, latitude, longitude, customer_type, credit_limit, payment_terms_days, status, notes
  } = req.body;

  db.prepare(`
    UPDATE shops
    SET territory_id = COALESCE(?, territory_id),
        route_id = COALESCE(?, route_id),
        shop_name = COALESCE(?, shop_name),
        shop_code = COALESCE(?, shop_code),
        owner_name = COALESCE(?, owner_name),
        telephone = COALESCE(?, telephone),
        address = COALESCE(?, address),
        town = COALESCE(?, town),
        district = COALESCE(?, district),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        customer_type = COALESCE(?, customer_type),
        credit_limit = COALESCE(?, credit_limit),
        payment_terms_days = COALESCE(?, payment_terms_days),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    territory_id, route_id, shop_name, shop_code, owner_name, telephone, address,
    town, district, latitude, longitude, customer_type, credit_limit, payment_terms_days, status, notes, id
  );

  logAudit(req.user.id, 'UPDATE_SHOP', 'shops', id, null, req.body, req.ip);
  res.json({ message: 'Shop updated successfully' });
});

// DELETE /api/shops/:id
router.delete('/shops/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM shops WHERE id = ?`).run(id);
  logAudit(req.user.id, 'DELETE_SHOP', 'shops', id, null, null, req.ip);
  res.json({ message: 'Shop deleted successfully' });
});

// GET /api/shop-visits/schedules
// Matrix of due today, due this week, overdue, upcoming, completed
router.get('/shop-visits/schedules', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      s.id as shop_id,
      s.shop_name,
      s.shop_code,
      s.owner_name,
      s.telephone,
      s.town,
      r.id as route_id,
      r.route_name,
      r.frequency_days,
      (SELECT MAX(actual_visit_date) FROM shop_visits WHERE shop_id = s.id AND status = 'completed') as last_visit_date
    FROM shops s
    LEFT JOIN routes r ON s.route_id = r.id
    WHERE s.status = 'active'
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND s.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  if (req.query.routeId && req.query.routeId !== 'all') {
    sql += ` AND s.route_id = ?`;
    params.push(Number(req.query.routeId));
  }

  const shops = db.prepare(sql).all(params);
  const categorized = {
    dueToday: [],
    dueThisWeek: [],
    overdue: [],
    upcoming: []
  };

  shops.forEach(sh => {
    const profile = DateFrequencyEngine.getShopScheduleProfile(sh.last_visit_date, sh.frequency_days || 21);
    const item = {
      shopId: sh.shop_id,
      shopName: sh.shop_name,
      shopCode: sh.shop_code,
      town: sh.town,
      routeId: sh.route_id,
      routeName: sh.route_name,
      lastVisitDate: sh.last_visit_date,
      nextVisitDate: profile.nextVisitDate,
      futureVisits: profile.futureVisits,
      status: profile.status
    };

    if (profile.status === 'due_today') categorized.dueToday.push(item);
    else if (profile.status === 'due_this_week') categorized.dueThisWeek.push(item);
    else if (profile.status === 'overdue') categorized.overdue.push(item);
    else categorized.upcoming.push(item);
  });

  res.json({
    summary: {
      dueTodayCount: categorized.dueToday.length,
      dueThisWeekCount: categorized.dueThisWeek.length,
      overdueCount: categorized.overdue.length,
      upcomingCount: categorized.upcoming.length
    },
    ...categorized
  });
});

// POST /api/shop-visits
router.post('/shop-visits', authenticate, (req, res) => {
  const { distributor_id, route_id, shop_id, driver_id, vehicle_id, planned_date, actual_visit_date, status, order_amount, notes } = req.body;
  if (!shop_id || !planned_date) {
    return res.status(400).json({ error: 'Shop and planned date are required' });
  }

  const result = db.prepare(`
    INSERT INTO shop_visits (distributor_id, route_id, shop_id, driver_id, vehicle_id, planned_date, actual_visit_date, status, order_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    distributor_id || 1, route_id || null, shop_id, driver_id || null, vehicle_id || null,
    planned_date, actual_visit_date || null, status || 'completed', order_amount || 0, notes || null
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Visit logged successfully' });
});

export default router;
