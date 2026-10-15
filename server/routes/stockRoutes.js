import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';

const router = express.Router();

// GET /api/stock/summary
// Comprehensive inventory overview: valuation, counts, alerts, category breakdown
router.get('/summary', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;

  try {
    // 1. Overall Valuation & Quantities
    const totalsRow = db.prepare(`
      SELECT 
        COUNT(*) as total_skus,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(stock_quantity * cost_price), 0) as total_cost_value,
        COALESCE(SUM(stock_quantity * selling_price), 0) as total_retail_value,
        COALESCE(SUM(CASE WHEN stock_quantity <= min_stock_level AND stock_quantity > 0 THEN 1 ELSE 0 END), 0) as low_stock_count,
        COALESCE(SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
        COALESCE(SUM(CASE 
          WHEN expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 
          ELSE 0 
        END), 0) as near_expiry_count
      FROM products 
      WHERE distributor_id = ? AND is_active = 1
    `).get(distId);

    const costVal = Number(totalsRow.total_cost_value || 0);
    const retailVal = Number(totalsRow.total_retail_value || 0);
    const potentialGrossProfit = retailVal - costVal;
    const potentialMarginPercent = retailVal > 0 ? (potentialGrossProfit / retailVal) * 100 : 0;

    // 2. Category-wise Breakdown
    const categoryBreakdown = db.prepare(`
      SELECT 
        pc.id as category_id,
        COALESCE(pc.name, 'Uncategorized') as category_name,
        COUNT(p.id) as sku_count,
        COALESCE(SUM(p.stock_quantity), 0) as total_units,
        COALESCE(SUM(p.stock_quantity * p.cost_price), 0) as cost_value,
        COALESCE(SUM(p.stock_quantity * p.selling_price), 0) as retail_value
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.distributor_id = ? AND p.is_active = 1
      GROUP BY pc.id, pc.name
      ORDER BY cost_value DESC
    `).all(distId);

    // 3. Low Stock Reorder List (Top 5 urgent)
    const lowStockAlerts = db.prepare(`
      SELECT 
        p.id,
        p.product_name,
        p.sku,
        p.brand,
        p.unit,
        p.stock_quantity,
        p.min_stock_level,
        (p.min_stock_level * 3) - p.stock_quantity as suggested_reorder,
        p.cost_price,
        p.selling_price,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.distributor_id = ? AND p.is_active = 1 AND p.stock_quantity <= p.min_stock_level
      ORDER BY p.stock_quantity ASC
      LIMIT 10
    `).all(distId);

    // 4. Near-Expiry Products (Expiring within 90 days or already expired)
    const nearExpiryProducts = db.prepare(`
      SELECT 
        p.id,
        p.product_name,
        p.sku,
        p.batch_number,
        p.expiry_date,
        DATEDIFF(p.expiry_date, CURDATE()) as days_until_expiry,
        p.stock_quantity,
        p.cost_price,
        (p.stock_quantity * p.cost_price) as at_risk_value,
        pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.distributor_id = ? AND p.is_active = 1 
        AND p.expiry_date IS NOT NULL 
        AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      ORDER BY p.expiry_date ASC
      LIMIT 10
    `).all(distId);

    // 5. Recent Stock Movements
    const recentMovements = db.prepare(`
      SELECT 
        sm.*,
        p.product_name,
        p.sku,
        p.unit
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE sm.distributor_id = ?
      ORDER BY sm.date DESC, sm.id DESC
      LIMIT 15
    `).all(distId);

    res.json({
      metrics: {
        totalSkus: Number(totalsRow.total_skus),
        totalUnits: Number(totalsRow.total_units),
        totalCostValue: costVal,
        totalRetailValue: retailVal,
        potentialGrossProfit,
        potentialMarginPercent: Number(potentialMarginPercent.toFixed(1)),
        lowStockCount: Number(totalsRow.low_stock_count),
        outOfStockCount: Number(totalsRow.out_of_stock_count),
        nearExpiryCount: Number(totalsRow.near_expiry_count)
      },
      categoryBreakdown,
      lowStockAlerts,
      nearExpiryProducts,
      recentMovements
    });
  } catch (err) {
    console.error('Stock summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock/products
// Complete product inventory catalog with health status and search/filter
router.get('/products', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const { categoryId, status, search } = req.query;

  let sql = `
    SELECT 
      p.*,
      pc.name as category_name,
      pc.code as category_code,
      ROUND(((p.selling_price - p.cost_price) / p.selling_price) * 100, 1) as gross_margin_percent,
      (p.stock_quantity * p.cost_price) as total_cost_value,
      (p.stock_quantity * p.selling_price) as total_retail_value,
      DATEDIFF(p.expiry_date, CURDATE()) as days_until_expiry,
      CASE 
        WHEN p.stock_quantity = 0 THEN 'OUT_OF_STOCK'
        WHEN p.stock_quantity <= p.min_stock_level THEN 'LOW_STOCK'
        WHEN p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 'NEAR_EXPIRY'
        ELSE 'IN_STOCK'
      END as health_status
    FROM products p
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE p.distributor_id = ? AND p.is_active = 1
  `;
  const params = [distId];

  if (categoryId && categoryId !== 'all') {
    sql += ` AND p.category_id = ?`;
    params.push(Number(categoryId));
  }

  if (status && status !== 'all') {
    if (status === 'low_stock') {
      sql += ` AND p.stock_quantity <= p.min_stock_level AND p.stock_quantity > 0`;
    } else if (status === 'out_of_stock') {
      sql += ` AND p.stock_quantity = 0`;
    } else if (status === 'near_expiry') {
      sql += ` AND p.expiry_date IS NOT NULL AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`;
    } else if (status === 'in_stock') {
      sql += ` AND p.stock_quantity > p.min_stock_level`;
    }
  }

  if (search) {
    sql += ` AND (p.product_name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ? OR p.batch_number LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY p.stock_quantity <= p.min_stock_level DESC, p.id ASC`;

  try {
    const products = db.prepare(sql).all(params);
    res.json(products);
  } catch (err) {
    console.error('Stock products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stock/inward
// Goods Received Note (GRN) - Receive fresh stock shipment from Jeewaka Factory
router.post('/inward', authenticate, (req, res) => {
  const { 
    distributor_id, product_id, quantity, unit_cost, 
    batch_number, expiry_date, reference_number, supplier_name, notes, date 
  } = req.body;

  const prodId = Number(product_id);
  const qty = Number(quantity);
  const distId = distributor_id || 1;

  if (!prodId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid product ID and positive quantity are required' });
  }

  const prod = db.prepare(`SELECT * FROM products WHERE id = ?`).get(prodId);
  if (!prod) return res.status(404).json({ error: 'Product not found' });

  const dateStr = date || new Date().toISOString().split('T')[0];
  const grnRef = reference_number || `GRN-${Date.now().toString().slice(-6)}`;
  const prevStock = prod.stock_quantity;
  const newStock = prevStock + qty;
  const cost = unit_cost ? Number(unit_cost) : prod.cost_price;

  db.transaction(() => {
    // 1. Update product stock quantity, cost, batch and expiry
    db.prepare(`
      UPDATE products 
      SET stock_quantity = ?,
          cost_price = ?,
          batch_number = COALESCE(?, batch_number),
          expiry_date = COALESCE(?, expiry_date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStock, cost, batch_number || null, expiry_date || null, prodId);

    // 2. Insert into stock_movements ledger
    db.prepare(`
      INSERT INTO stock_movements (
        distributor_id, product_id, movement_type, quantity,
        previous_stock, new_stock, unit_cost, batch_number, expiry_date,
        reference_number, performed_by, notes, date
      ) VALUES (?, ?, 'INWARD_GRN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      distId, prodId, qty, prevStock, newStock, cost,
      batch_number || prod.batch_number, expiry_date || prod.expiry_date,
      grnRef, req.user?.fullName || req.user?.username || 'Warehouse Manager',
      notes || `Stock Received from ${supplier_name || 'Jeewaka Herbals Factory'}`, dateStr
    );
  })();

  logAudit(req.user?.id || 1, 'STOCK_INWARD_GRN', 'products', prodId, { oldStock: prevStock }, { newStock, qty, grnRef }, req.ip);

  res.status(201).json({
    message: `Received ${qty} units of ${prod.product_name} into inventory`,
    grnRef,
    previous_stock: prevStock,
    current_stock: newStock
  });
});

// POST /api/stock/adjust
// Stock Adjustment: Damage, Expiry disposal, physical stock audit correction
router.post('/adjust', authenticate, (req, res) => {
  const { 
    distributor_id, product_id, adjustment_type, quantity, 
    reason, date, reference_number 
  } = req.body;

  const prodId = Number(product_id);
  const qty = Number(quantity);
  const distId = distributor_id || 1;

  if (!prodId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid product ID and positive adjustment quantity required' });
  }

  const validTypes = ['DAMAGE_DISPOSAL', 'EXPIRED_WRITE_OFF', 'AUDIT_CORRECTION', 'RETURN_INWARD', 'DISPATCH'];
  const moveType = validTypes.includes(adjustment_type) ? adjustment_type : 'DAMAGE_DISPOSAL';

  const prod = db.prepare(`SELECT * FROM products WHERE id = ?`).get(prodId);
  if (!prod) return res.status(404).json({ error: 'Product not found' });

  const dateStr = date || new Date().toISOString().split('T')[0];
  const ref = reference_number || `ADJ-${Date.now().toString().slice(-6)}`;
  const prevStock = prod.stock_quantity;

  let newStock;
  if (moveType === 'RETURN_INWARD') {
    newStock = prevStock + qty;
  } else {
    // Deductions (damages, expiry write-off, etc.)
    if (prevStock < qty) {
      return res.status(400).json({ error: `Cannot deduct ${qty} units. Current stock is only ${prevStock}` });
    }
    newStock = prevStock - qty;
  }

  db.transaction(() => {
    db.prepare(`UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newStock, prodId);

    db.prepare(`
      INSERT INTO stock_movements (
        distributor_id, product_id, movement_type, quantity,
        previous_stock, new_stock, unit_cost, batch_number, expiry_date,
        reference_number, performed_by, notes, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      distId, prodId, moveType, qty, prevStock, newStock, prod.cost_price,
      prod.batch_number, prod.expiry_date, ref,
      req.user?.fullName || req.user?.username || 'Stock Controller',
      reason || `Stock Adjustment (${moveType})`, dateStr
    );
  })();

  logAudit(req.user?.id || 1, `STOCK_${moveType}`, 'products', prodId, { oldStock: prevStock }, { newStock, qty, ref, reason }, req.ip);

  res.json({
    message: `Stock adjusted successfully (${moveType}: ${qty} units)`,
    reference: ref,
    previous_stock: prevStock,
    current_stock: newStock
  });
});

// GET /api/stock/movements
// Full filterable audit history ledger of inventory transactions
router.get('/movements', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const { productId, movementType, startDate, endDate } = req.query;

  let sql = `
    SELECT 
      sm.*,
      p.product_name,
      p.sku,
      p.unit,
      p.brand,
      pc.name as category_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE sm.distributor_id = ?
  `;
  const params = [distId];

  if (productId && productId !== 'all') {
    sql += ` AND sm.product_id = ?`;
    params.push(Number(productId));
  }

  if (movementType && movementType !== 'all') {
    sql += ` AND sm.movement_type = ?`;
    params.push(movementType);
  }

  if (startDate) {
    sql += ` AND sm.date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND sm.date <= ?`;
    params.push(endDate);
  }

  sql += ` ORDER BY sm.date DESC, sm.id DESC LIMIT 100`;

  try {
    const movements = db.prepare(sql).all(params);
    res.json(movements);
  } catch (err) {
    console.error('Stock movements error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stock/products/:id
// Update product parameters, pricing, and reorder levels
router.put('/products/:id', authenticate, requireRole(['ADMIN', 'FINANCE_USER']), (req, res) => {
  const prodId = Number(req.params.id);
  const { product_name, category_id, brand, unit, cost_price, selling_price, mrp, min_stock_level, batch_number, expiry_date } = req.body;

  const prod = db.prepare(`SELECT * FROM products WHERE id = ?`).get(prodId);
  if (!prod) return res.status(404).json({ error: 'Product not found' });

  db.prepare(`
    UPDATE products 
    SET product_name = COALESCE(?, product_name),
        category_id = COALESCE(?, category_id),
        brand = COALESCE(?, brand),
        unit = COALESCE(?, unit),
        cost_price = COALESCE(?, cost_price),
        selling_price = COALESCE(?, selling_price),
        mrp = COALESCE(?, mrp),
        min_stock_level = COALESCE(?, min_stock_level),
        batch_number = COALESCE(?, batch_number),
        expiry_date = COALESCE(?, expiry_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    product_name || null, category_id || null, brand || null, unit || null,
    cost_price ? Number(cost_price) : null, selling_price ? Number(selling_price) : null,
    mrp ? Number(mrp) : null, min_stock_level ? Number(min_stock_level) : null,
    batch_number || null, expiry_date || null, prodId
  );

  logAudit(req.user?.id || 1, 'PRODUCT_UPDATE', 'products', prodId, prod, req.body, req.ip);

  res.json({ message: 'Product updated successfully', id: prodId });
});

// POST /api/stock/products
// Add new SKU to product catalog
router.post('/products', authenticate, requireRole(['ADMIN', 'FINANCE_USER']), (req, res) => {
  const { 
    distributor_id, category_id, product_name, sku, brand, unit, 
    cost_price, selling_price, mrp, stock_quantity, min_stock_level, batch_number, expiry_date 
  } = req.body;

  const distId = distributor_id || 1;
  const cost = Number(cost_price);
  const selling = Number(selling_price);

  if (!product_name || !sku || !cost || !selling) {
    return res.status(400).json({ error: 'Product name, SKU, Cost Price, and Selling Price are required' });
  }

  const existing = db.prepare(`SELECT id FROM products WHERE sku = ? AND distributor_id = ?`).get(sku, distId);
  if (existing) {
    return res.status(400).json({ error: `Product with SKU ${sku} already exists` });
  }

  const initialStock = Number(stock_quantity) || 0;
  const minStock = Number(min_stock_level) || 10;
  const dateStr = new Date().toISOString().split('T')[0];

  const prodId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO products (
        distributor_id, category_id, product_name, sku, brand, unit,
        cost_price, selling_price, mrp, batch_number, expiry_date, stock_quantity, min_stock_level, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      distId, category_id || 1, product_name, sku, brand || 'Jeewaka Herbals', unit || 'bottle',
      cost, selling, mrp ? Number(mrp) : selling * 1.2, batch_number || 'BATCH-NEW', expiry_date || null,
      initialStock, minStock
    );

    const newId = result.lastInsertRowid;

    if (initialStock > 0) {
      db.prepare(`
        INSERT INTO stock_movements (
          distributor_id, product_id, movement_type, quantity,
          previous_stock, new_stock, unit_cost, batch_number, expiry_date,
          reference_number, performed_by, notes, date
        ) VALUES (?, ?, 'INWARD_GRN', ?, 0, ?, ?, ?, ?, 'INIT-STOCK', ?, 'Initial Inventory Setup', ?)
      `).run(distId, newId, initialStock, initialStock, cost, batch_number || 'BATCH-NEW', expiry_date || null, req.user?.username || 'Admin', dateStr);
    }

    return newId;
  })();

  logAudit(req.user?.id || 1, 'PRODUCT_CREATE', 'products', prodId, null, { sku, product_name, cost, selling, initialStock }, req.ip);

  res.status(201).json({ id: prodId, message: 'New product SKU added to inventory successfully' });
});

// GET /api/stock/categories
router.get('/categories', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const categories = db.prepare(`SELECT * FROM product_categories WHERE distributor_id = ? ORDER BY name ASC`).all(distId);
  res.json(categories);
});

export default router;
