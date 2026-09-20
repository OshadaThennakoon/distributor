import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';

const router = express.Router();

// GET /api/distributors
router.get('/distributors', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT d.*,
      (SELECT COUNT(*) FROM distribution_centers WHERE distributor_id = d.id) as dc_count,
      (SELECT COUNT(*) FROM territories WHERE distributor_id = d.id) as territory_count,
      (SELECT COUNT(*) FROM routes WHERE distributor_id = d.id) as route_count,
      (SELECT COUNT(*) FROM shops WHERE distributor_id = d.id) as shop_count,
      (SELECT COUNT(*) FROM vehicles WHERE distributor_id = d.id) as vehicle_count,
      (SELECT COUNT(*) FROM drivers WHERE distributor_id = d.id) as driver_count
    FROM distributors d
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND d.id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY d.id ASC`;

  const distributors = db.prepare(sql).all(params);
  res.json(distributors);
});

// POST /api/distributors (ADMIN only)
router.post('/distributors', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { code, name, reg_number, contact_person, phone, email, address, currency_code, currency_symbol } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });

  const result = db.prepare(`
    INSERT INTO distributors (code, name, reg_number, contact_person, phone, email, address, currency_code, currency_symbol, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    code, name, reg_number || null, contact_person || null, phone || null,
    email || null, address || null, currency_code || 'LKR', currency_symbol || 'Rs.'
  );

  logAudit(req.user.id, 'CREATE_DISTRIBUTOR', 'distributors', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Distributor created successfully' });
});

// PUT /api/distributors/:id
router.put('/distributors/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const id = Number(req.params.id);
  const { name, reg_number, contact_person, phone, email, address, currency_code, currency_symbol, status } = req.body;

  db.prepare(`
    UPDATE distributors
    SET name = COALESCE(?, name),
        reg_number = COALESCE(?, reg_number),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        currency_code = COALESCE(?, currency_code),
        currency_symbol = COALESCE(?, currency_symbol),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, reg_number, contact_person, phone, email, address, currency_code, currency_symbol, status, id);

  logAudit(req.user.id, 'UPDATE_DISTRIBUTOR', 'distributors', id, null, req.body, req.ip);
  res.json({ message: 'Distributor updated successfully' });
});

// GET /api/distribution-centers
router.get('/distribution-centers', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT dc.*, d.name as distributor_name,
      (SELECT COUNT(*) FROM routes WHERE distribution_center_id = dc.id) as routes_count
    FROM distribution_centers dc
    JOIN distributors d ON dc.distributor_id = d.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND dc.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY dc.id ASC`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/distribution-centers (ADMIN only)
router.post('/distribution-centers', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { distributor_id, name, code, address, town, district, province, latitude, longitude, contact_number, manager, opening_date, notes } = req.body;
  if (!distributor_id || !name || !code) {
    return res.status(400).json({ error: 'Distributor, name, and code are required' });
  }

  const result = db.prepare(`
    INSERT INTO distribution_centers (
      distributor_id, name, code, address, town, district, province, latitude, longitude, contact_number, manager, opening_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(distributor_id, name, code, address || null, town || null, district || null, province || null, latitude || 0, longitude || 0, contact_number || null, manager || null, opening_date || null, notes || null);

  logAudit(req.user.id, 'CREATE_DC', 'distribution_centers', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Distribution Center created successfully' });
});

// GET /api/territories
router.get('/territories', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT t.*, d.name as distributor_name, dc.name as dc_name,
      (SELECT COUNT(*) FROM shops WHERE territory_id = t.id) as shop_count
    FROM territories t
    JOIN distributors d ON t.distributor_id = d.id
    LEFT JOIN distribution_centers dc ON t.distribution_center_id = dc.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND t.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY t.id ASC`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/territories (ADMIN only)
router.post('/territories', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { distributor_id, distribution_center_id, name, code, district, province } = req.body;
  if (!distributor_id || !name || !code) {
    return res.status(400).json({ error: 'Distributor, name, and code are required' });
  }

  const result = db.prepare(`
    INSERT INTO territories (distributor_id, distribution_center_id, name, code, district, province, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(distributor_id, distribution_center_id || null, name, code, district || null, province || null);

  logAudit(req.user.id, 'CREATE_TERRITORY', 'territories', result.lastInsertRowid, null, req.body, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Territory created successfully' });
});

export default router;
