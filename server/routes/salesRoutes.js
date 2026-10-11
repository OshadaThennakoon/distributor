import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';

const router = express.Router();

// GET /api/sales
router.get('/sales', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      s.*,
      d.name as distributor_name,
      sh.shop_name,
      sh.shop_code,
      sh.town,
      r.route_name,
      dr.full_name as driver_name
    FROM sales s
    JOIN distributors d ON s.distributor_id = d.id
    JOIN shops sh ON s.shop_id = sh.id
    LEFT JOIN routes r ON s.route_id = r.id
    LEFT JOIN drivers dr ON s.driver_id = dr.id
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
  if (req.query.shopId && req.query.shopId !== 'all') {
    sql += ` AND s.shop_id = ?`;
    params.push(Number(req.query.shopId));
  }
  if (req.query.collectionStatus && req.query.collectionStatus !== 'all') {
    sql += ` AND s.collection_status = ?`;
    params.push(req.query.collectionStatus);
  }
  if (req.query.startDate) {
    sql += ` AND s.date >= ?`;
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    sql += ` AND s.date <= ?`;
    params.push(req.query.endDate);
  }

  sql += ` ORDER BY s.date DESC, s.id DESC LIMIT 150`;
  res.json(db.prepare(sql).all(params));
});

// GET /api/sales/:id
router.get('/sales/:id', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const sale = db.prepare(`
    SELECT s.*, d.name as distributor_name, sh.shop_name, sh.shop_code, sh.telephone, sh.address, sh.town, r.route_name
    FROM sales s
    JOIN distributors d ON s.distributor_id = d.id
    JOIN shops sh ON s.shop_id = sh.id
    LEFT JOIN routes r ON s.route_id = r.id
    WHERE s.id = ?
  `).get(id);

  if (!sale) return res.status(404).json({ error: 'Invoice not found' });

  const items = db.prepare(`
    SELECT si.*, p.product_name, p.sku, p.unit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `).all(id);

  const payments = db.prepare(`SELECT * FROM payments WHERE sale_id = ?`).all(id);

  res.json({ sale, items, payments });
});

// POST /api/sales
router.post('/sales', authenticate, (req, res) => {
  const {
    distributor_id, invoice_number, date, route_id, shop_id, driver_id, sales_rep,
    items = [], discount = 0, payment_type = 'credit', collection_status = 'unpaid', notes
  } = req.body;

  if (!distributor_id || !shop_id || items.length === 0) {
    return res.status(400).json({ error: 'Distributor, shop, and at least one item are required' });
  }

  const invNum = invoice_number || `INV-${Date.now()}`;
  const invDate = date || new Date().toISOString().split('T')[0];

  let totalGross = 0;
  let totalCogs = 0;

  const processedItems = items.map(item => {
    const prod = db.prepare(`SELECT cost_price, selling_price FROM products WHERE id = ?`).get(item.product_id);
    const unitPrice = item.unit_price || (prod ? prod.selling_price : 0);
    const unitCost = prod ? prod.cost_price : 0;
    const qty = Number(item.quantity) || 1;
    const netAmt = qty * unitPrice;
    const cogsAmt = qty * unitCost;
    const profit = netAmt - cogsAmt;

    totalGross += netAmt;
    totalCogs += cogsAmt;

    return {
      productId: item.product_id,
      quantity: qty,
      unitPrice,
      unitCost,
      discountPercent: item.discount_percent || 0,
      netAmount: netAmt,
      cogsAmount: cogsAmt,
      grossProfit: profit
    };
  });

  const disc = Number(discount) || 0;
  const netSales = totalGross - disc;
  const grossProfit = netSales - totalCogs;

  const saleId = db.transaction(() => {
    const saleResult = db.prepare(`
      INSERT INTO sales (
        distributor_id, invoice_number, date, route_id, shop_id, driver_id, sales_rep,
        total_gross, discount, net_sales, total_cogs, gross_profit, payment_type, collection_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      distributor_id, invNum, invDate, route_id || null, shop_id, driver_id || null, sales_rep || null,
      totalGross, disc, netSales, totalCogs, grossProfit, payment_type, collection_status, notes || null
    );

    const sId = saleResult.lastInsertRowid;
    const itemStmt = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, discount_percent, net_amount, cogs_amount, gross_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStockStmt = db.prepare(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`);

    for (const item of processedItems) {
      itemStmt.run(sId, item.productId, item.quantity, item.unitPrice, item.unitCost, item.discountPercent, item.netAmount, item.cogsAmount, item.grossProfit);
      updateStockStmt.run(item.quantity, item.productId);
    }

    // If paid, create payment record
    if (collection_status === 'paid') {
      db.prepare(`
        INSERT INTO payments (sale_id, distributor_id, payment_date, amount, payment_method, receipt_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sId, distributor_id, invDate, netSales, payment_type, `RCP-${sId}`);
    }

    return sId;
  })();

  res.status(201).json({ id: saleId, invoiceNumber: invNum, netSales, grossProfit, message: 'Invoice created successfully' });
});

// GET /api/products
router.get('/products', authenticate, scopeDistributor, (req, res) => {
  let sql = `
    SELECT 
      p.*,
      d.name as distributor_name,
      pc.name as category_name
    FROM products p
    JOIN distributors d ON p.distributor_id = d.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE 1=1
  `;
  const params = [];
  if (req.activeDistributorId) {
    sql += ` AND p.distributor_id = ?`;
    params.push(req.activeDistributorId);
  }
  sql += ` ORDER BY p.id ASC`;

  res.json(db.prepare(sql).all(params));
});

// POST /api/products
router.post('/products', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { distributor_id, category_id, product_name, sku, brand, unit, cost_price, selling_price, stock_quantity, min_stock_level } = req.body;
  if (!distributor_id || !product_name || !sku || !cost_price || !selling_price) {
    return res.status(400).json({ error: 'Missing required product fields' });
  }

  const result = db.prepare(`
    INSERT INTO products (
      distributor_id, category_id, product_name, sku, brand, unit,
      cost_price, selling_price, stock_quantity, min_stock_level, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    distributor_id, category_id || null, product_name, sku, brand || '', unit || 'piece',
    cost_price, selling_price, stock_quantity || 0, min_stock_level || 10
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Product created successfully' });
});

// POST /api/payments
router.post('/payments', authenticate, (req, res) => {
  const { sale_id, distributor_id, payment_date, amount, payment_method, receipt_number, notes } = req.body;
  if (!sale_id || !amount) {
    return res.status(400).json({ error: 'Sale ID and amount are required' });
  }

  const date = payment_date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO payments (sale_id, distributor_id, payment_date, amount, payment_method, receipt_number, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sale_id, distributor_id || 1, date, amount, payment_method || 'cash', receipt_number || null, notes || null);

  // Check if fully paid
  const sale = db.prepare(`SELECT net_sales FROM sales WHERE id = ?`).get(sale_id);
  const paidTotal = db.prepare(`SELECT SUM(amount) as s FROM payments WHERE sale_id = ?`).get(sale_id);

  if (paidTotal && sale && paidTotal.s >= sale.net_sales) {
    db.prepare(`UPDATE sales SET collection_status = 'paid' WHERE id = ?`).run(sale_id);
  } else {
    db.prepare(`UPDATE sales SET collection_status = 'partial' WHERE id = ?`).run(sale_id);
  }

  res.status(201).json({ id: result.lastInsertRowid, message: 'Payment recorded successfully' });
});

// POST /api/products/:id/stock (Stock In from Jeewaka main warehouse vs Stock Out)
router.post('/products/:id/stock', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const { type, quantity, batch_number, expiry_date, notes } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'Valid quantity is required' });

  const prod = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });

  let newQty = prod.stock_quantity;
  if (type === 'in') {
    newQty += qty;
  } else if (type === 'out') {
    if (prod.stock_quantity < qty) {
      return res.status(400).json({ error: `Insufficient stock! Current stock: ${prod.stock_quantity}` });
    }
    newQty -= qty;
  } else {
    return res.status(400).json({ error: "Invalid type. Must be 'in' or 'out'" });
  }

  db.prepare(`
    UPDATE products 
    SET stock_quantity = ?,
        batch_number = COALESCE(?, batch_number),
        expiry_date = COALESCE(?, expiry_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newQty, batch_number || null, expiry_date || null, id);

  logAudit(req.user.id, `STOCK_${type.toUpperCase()}`, 'products', id, { stock: prod.stock_quantity }, { newStock: newQty, qty, batch: batch_number, notes }, req.ip);

  res.json({
    id,
    product_name: prod.product_name,
    type,
    quantity: qty,
    old_stock: prod.stock_quantity,
    current_stock: newQty,
    batch_number: batch_number || prod.batch_number,
    message: `Stock ${type === 'in' ? 'Received (Stock In)' : 'Dispatched (Stock Out)'} successfully`
  });
});

// GET /api/dispatch/sheet (Daily Driver/Rider Dispatch & Packing Sheet)
router.get('/dispatch/sheet', authenticate, (req, res) => {
  const { routeId, date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  let sql = `
    SELECT 
      s.id as sale_id,
      s.invoice_number,
      s.date,
      s.net_sales,
      s.payment_type,
      s.collection_status,
      sh.shop_name,
      sh.shop_code,
      sh.telephone,
      sh.address,
      sh.town,
      r.route_name,
      r.route_code,
      v.vehicle_number,
      dr.full_name as driver_name
    FROM sales s
    JOIN shops sh ON s.shop_id = sh.id
    LEFT JOIN routes r ON s.route_id = r.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    LEFT JOIN drivers dr ON r.driver_id = dr.id
    WHERE 1=1
  `;
  const params = [];
  if (routeId && routeId !== 'all') {
    sql += ` AND s.route_id = ?`;
    params.push(Number(routeId));
  }
  if (targetDate) {
    sql += ` AND s.date = ?`;
    params.push(targetDate);
  }

  sql += ` ORDER BY s.id ASC`;
  const orders = db.prepare(sql).all(params);

  // Group all items across these orders to create aggregate Packing List
  const saleIds = orders.map(o => o.sale_id);
  let packingList = [];
  if (saleIds.length > 0) {
    const placeholders = saleIds.map(() => '?').join(',');
    const itemsSql = `
      SELECT 
        p.id as product_id,
        p.product_name,
        p.sku,
        p.unit,
        p.batch_number,
        p.expiry_date,
        SUM(si.quantity) as total_quantity,
        SUM(si.net_amount) as total_value
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id IN (${placeholders})
      GROUP BY p.id
      ORDER BY p.product_name ASC
    `;
    packingList = db.prepare(itemsSql).all(saleIds);
  }

  res.json({
    date: targetDate,
    routeId: routeId || 'all',
    total_orders: orders.length,
    total_invoice_value: orders.reduce((acc, o) => acc + (o.net_sales || 0), 0),
    packing_list: packingList,
    orders
  });
});

export default router;
