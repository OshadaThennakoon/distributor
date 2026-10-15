import express from 'express';
import { db } from '../config/database.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
import { scopeDistributor } from '../middleware/tenant.js';

const router = express.Router();

// GET /api/accounts/summary
// Comprehensive treasury summary: Cash in Hand, Bank Accounts, Cheques in Hand, and Outstanding Credits
router.get('/summary', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;

  try {
    // 1. CASH BALANCE
    const cashInRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE distributor_id = ? AND payment_method = 'cash'
    `).get(distId);

    const cashOutRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE distributor_id = ? AND (payment_method = 'cash' OR payment_method IS NULL)
    `).get(distId);

    const cashAdjustmentsRow = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'cash_in' THEN amount ELSE 0 END), 0) as cash_in,
        COALESCE(SUM(CASE WHEN transaction_type = 'cash_out' THEN amount ELSE 0 END), 0) as cash_out
      FROM cash_drawer_logs
      WHERE distributor_id = ?
    `).get(distId);

    const totalCashIn = Number(cashInRow.total) + Number(cashAdjustmentsRow.cash_in);
    const totalCashOut = Number(cashOutRow.total) + Number(cashAdjustmentsRow.cash_out);
    const netCashBalance = totalCashIn - totalCashOut;

    // 2. BANK ACCOUNTS BALANCE
    const bankAccounts = db.prepare(`
      SELECT * FROM bank_accounts 
      WHERE distributor_id = ? AND is_active = 1 
      ORDER BY id ASC
    `).all(distId);

    const totalBankBalance = bankAccounts.reduce((acc, b) => acc + Number(b.current_balance || 0), 0);

    const bankTransferInRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM payments 
      WHERE distributor_id = ? AND payment_method = 'bank_transfer'
    `).get(distId);

    const bankTransferOutRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE distributor_id = ? AND payment_method = 'bank_transfer'
    `).get(distId);

    // 3. CHEQUES
    const pendingCheques = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
      FROM payments 
      WHERE distributor_id = ? AND payment_method = 'cheque' AND (cheque_status = 'pending' OR cheque_status IS NULL)
    `).get(distId);

    const clearedCheques = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
      FROM payments 
      WHERE distributor_id = ? AND payment_method = 'cheque' AND cheque_status = 'cleared'
    `).get(distId);

    const bouncedCheques = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
      FROM payments 
      WHERE distributor_id = ? AND payment_method = 'cheque' AND cheque_status = 'bounced'
    `).get(distId);

    // 4. CREDITS (TRADE RECEIVABLES)
    const creditStats = db.prepare(`
      SELECT 
        COUNT(s.id) as unpaid_invoices_count,
        COUNT(DISTINCT s.shop_id) as debtor_shops_count,
        COALESCE(SUM(s.net_sales - COALESCE(p.paid_sum, 0)), 0) as total_outstanding,
        COALESCE(SUM(CASE 
          WHEN s.date < DATE_SUB(CURDATE(), INTERVAL 21 DAY) 
          THEN (s.net_sales - COALESCE(p.paid_sum, 0)) 
          ELSE 0 
        END), 0) as overdue_outstanding
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(amount) as paid_sum 
        FROM payments 
        GROUP BY sale_id
      ) p ON s.id = p.sale_id
      WHERE s.distributor_id = ? AND s.collection_status != 'paid'
    `).get(distId);

    // 5. RECENT TRANSACTIONS STREAM (Cash In, Out, Cheques, Transfers)
    const recentPayments = db.prepare(`
      SELECT 
        p.id,
        p.payment_date as date,
        p.amount,
        p.payment_method,
        p.cheque_number,
        p.bank_name,
        p.cheque_status,
        p.receipt_number,
        'INFLOW' as flow_type,
        CONCAT('Collection: ', sh.shop_name, ' (', s.invoice_number, ')') as description,
        s.invoice_number
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      JOIN shops sh ON s.shop_id = sh.id
      WHERE p.distributor_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT 15
    `).all(distId);

    const recentExpenses = db.prepare(`
      SELECT 
        e.id,
        e.date,
        e.amount,
        e.payment_method,
        null as cheque_number,
        null as bank_name,
        null as cheque_status,
        e.receipt_number,
        'OUTFLOW' as flow_type,
        CONCAT('Expense: ', ec.name, ' - ', COALESCE(e.description, '')) as description,
        null as invoice_number
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.distributor_id = ?
      ORDER BY e.date DESC, e.id DESC
      LIMIT 15
    `).all(distId);

    const combinedRecent = [...recentPayments, ...recentExpenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);

    res.json({
      cash: {
        balance: netCashBalance,
        totalIn: totalCashIn,
        totalOut: totalCashOut,
        salesCashIn: Number(cashInRow.total),
        expensesCashOut: Number(cashOutRow.total),
        drawerAdjustments: {
          in: Number(cashAdjustmentsRow.cash_in),
          out: Number(cashAdjustmentsRow.cash_out)
        }
      },
      bankAccounts: {
        totalBalance: totalBankBalance,
        accounts: bankAccounts,
        transfersIn: Number(bankTransferInRow.total),
        transfersOut: Number(bankTransferOutRow.total)
      },
      cheques: {
        inHandBalance: Number(pendingCheques.total),
        pendingCount: Number(pendingCheques.count),
        clearedBalance: Number(clearedCheques.total),
        clearedCount: Number(clearedCheques.count),
        bouncedBalance: Number(bouncedCheques.total),
        bouncedCount: Number(bouncedCheques.count)
      },
      credits: {
        totalOutstanding: Number(creditStats.total_outstanding),
        overdueOutstanding: Number(creditStats.overdue_outstanding),
        unpaidInvoicesCount: Number(creditStats.unpaid_invoices_count),
        debtorShopsCount: Number(creditStats.debtor_shops_count)
      },
      recentTransactions: combinedRecent
    });
  } catch (err) {
    console.error('Accounts summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accounts/cheques
// Filterable list of all cheques received
router.get('/cheques', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const { status } = req.query; // 'pending', 'cleared', 'bounced', 'all'

  let sql = `
    SELECT 
      p.id as payment_id,
      p.sale_id,
      p.payment_date,
      p.amount,
      p.cheque_number,
      p.cheque_date,
      p.bank_name,
      COALESCE(p.cheque_status, 'pending') as cheque_status,
      p.cleared_date,
      p.receipt_number,
      p.notes,
      s.invoice_number,
      s.date as invoice_date,
      sh.shop_name,
      sh.shop_code,
      sh.owner_name,
      sh.telephone,
      sh.town,
      r.route_name
    FROM payments p
    JOIN sales s ON p.sale_id = s.id
    JOIN shops sh ON s.shop_id = sh.id
    LEFT JOIN routes r ON s.route_id = r.id
    WHERE p.distributor_id = ? AND p.payment_method = 'cheque'
  `;
  const params = [distId];

  if (status && status !== 'all') {
    sql += ` AND p.cheque_status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY p.cheque_date ASC, p.id DESC`;
  const cheques = db.prepare(sql).all(params);
  res.json(cheques);
});

// PUT /api/accounts/cheques/:id/status
// Realize, deposit, or bounce a cheque
router.put('/cheques/:id/status', authenticate, (req, res) => {
  const paymentId = Number(req.params.id);
  const { status, bank_account_id, cleared_date } = req.body;

  if (!['pending', 'cleared', 'bounced'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'pending', 'cleared', or 'bounced'" });
  }

  const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!payment) return res.status(404).json({ error: 'Cheque record not found' });

  const date = cleared_date || new Date().toISOString().split('T')[0];

  db.transaction(() => {
    // If transitioning to cleared, deposit amount into target bank account
    if (status === 'cleared' && payment.cheque_status !== 'cleared') {
      const bAccId = bank_account_id || 1;
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`).run(payment.amount, bAccId);
      db.prepare(`
        UPDATE payments 
        SET cheque_status = 'cleared', 
            cleared_date = ?, 
            bank_account_id = ? 
        WHERE id = ?
      `).run(date, bAccId, paymentId);
    } else if (status === 'bounced' && payment.cheque_status === 'cleared') {
      // Revert bank deposit if previously cleared
      if (payment.bank_account_id) {
        db.prepare(`UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?`).run(payment.amount, payment.bank_account_id);
      }
      db.prepare(`UPDATE payments SET cheque_status = 'bounced', cleared_date = NULL WHERE id = ?`).run(paymentId);
      // Reopen sale collection status
      db.prepare(`UPDATE sales SET collection_status = 'unpaid' WHERE id = ?`).run(payment.sale_id);
    } else {
      db.prepare(`UPDATE payments SET cheque_status = ? WHERE id = ?`).run(status, paymentId);
    }
  })();

  logAudit(req.user.id, 'CHEQUE_STATUS_UPDATE', 'payments', paymentId, { oldStatus: payment.cheque_status }, { newStatus: status, bank_account_id }, req.ip);

  res.json({ message: `Cheque marked as ${status} successfully`, paymentId, status });
});

// GET /api/accounts/credits
// Customer debtors & credit invoices breakdown
router.get('/credits', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;

  // 1. Grouped by Shop / Retailer
  const debtorShops = db.prepare(`
    SELECT 
      sh.id as shop_id,
      sh.shop_name,
      sh.shop_code,
      sh.owner_name,
      sh.telephone,
      sh.town,
      sh.customer_type,
      sh.credit_limit,
      sh.payment_terms_days,
      r.route_name,
      COUNT(s.id) as unpaid_invoices_count,
      MIN(s.date) as oldest_invoice_date,
      MAX(s.date) as latest_invoice_date,
      DATEDIFF(CURDATE(), MIN(s.date)) as max_days_outstanding,
      SUM(s.net_sales - COALESCE(p.paid_sum, 0)) as total_outstanding_balance
    FROM shops sh
    JOIN sales s ON sh.id = s.shop_id
    LEFT JOIN (
      SELECT sale_id, SUM(amount) as paid_sum 
      FROM payments 
      GROUP BY sale_id
    ) p ON s.id = p.sale_id
    LEFT JOIN routes r ON sh.route_id = r.id
    WHERE s.distributor_id = ? AND s.collection_status != 'paid'
    GROUP BY sh.id
    HAVING total_outstanding_balance > 0
    ORDER BY total_outstanding_balance DESC
  `).all(distId);

  // 2. Individual Unpaid Invoices
  const unpaidInvoices = db.prepare(`
    SELECT 
      s.id as sale_id,
      s.invoice_number,
      s.date as invoice_date,
      s.route_id,
      s.shop_id,
      s.total_gross,
      s.discount,
      s.net_sales,
      COALESCE(p.paid_sum, 0) as paid_amount,
      (s.net_sales - COALESCE(p.paid_sum, 0)) as balance_due,
      s.payment_type,
      s.collection_status,
      sh.shop_name,
      sh.town,
      sh.telephone,
      r.route_name,
      DATEDIFF(CURDATE(), s.date) as days_elapsed,
      CASE 
        WHEN DATEDIFF(CURDATE(), s.date) > 21 THEN 'OVERDUE'
        ELSE 'CURRENT'
      END as age_bracket
    FROM sales s
    JOIN shops sh ON s.shop_id = sh.id
    LEFT JOIN routes r ON s.route_id = r.id
    LEFT JOIN (
      SELECT sale_id, SUM(amount) as paid_sum 
      FROM payments 
      GROUP BY sale_id
    ) p ON s.id = p.sale_id
    WHERE s.distributor_id = ? AND s.collection_status != 'paid'
    ORDER BY s.date ASC, balance_due DESC
  `).all(distId);

  res.json({
    debtorShops,
    unpaidInvoices
  });
});

// POST /api/accounts/settle-credit
// Collect and settle an outstanding credit invoice
router.post('/settle-credit', authenticate, (req, res) => {
  const { 
    sale_id, distributor_id, amount, payment_method, 
    cheque_number, cheque_date, bank_name, bank_account_id, notes 
  } = req.body;

  const saleId = Number(sale_id);
  const payAmt = Number(amount);

  if (!saleId || !payAmt || payAmt <= 0) {
    return res.status(400).json({ error: 'Valid sale ID and amount are required' });
  }

  const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId);
  if (!sale) return res.status(404).json({ error: 'Sale invoice not found' });

  const distId = distributor_id || sale.distributor_id || 1;
  const dateStr = new Date().toISOString().split('T')[0];

  const paymentId = db.transaction(() => {
    // 1. Insert Payment
    const rcp = `RCP-${Date.now().toString().slice(-6)}`;
    const payResult = db.prepare(`
      INSERT INTO payments (
        sale_id, distributor_id, payment_date, amount, payment_method,
        cheque_number, cheque_date, bank_name, cheque_status, bank_account_id, receipt_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saleId, distId, dateStr, payAmt, payment_method || 'cash',
      cheque_number || null, cheque_date || null, bank_name || null,
      payment_method === 'cheque' ? 'pending' : (payment_method === 'bank_transfer' ? 'cleared' : null),
      bank_account_id || null, rcp, notes || null
    );

    const pId = payResult.lastInsertRowid;

    // 2. If bank transfer, immediately credit bank account
    if (payment_method === 'bank_transfer' && bank_account_id) {
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`).run(payAmt, bank_account_id);
    }

    // 3. Check total paid for this invoice and update status
    const paidRow = db.prepare(`SELECT SUM(amount) as s FROM payments WHERE sale_id = ?`).get(saleId);
    const totalPaid = Number(paidRow.s || 0);

    if (totalPaid >= sale.net_sales) {
      db.prepare(`UPDATE sales SET collection_status = 'paid' WHERE id = ?`).run(saleId);
    } else {
      db.prepare(`UPDATE sales SET collection_status = 'partial' WHERE id = ?`).run(saleId);
    }

    return pId;
  })();

  logAudit(req.user.id, 'SETTLE_CREDIT_PAYMENT', 'payments', paymentId, null, { saleId, amount: payAmt, payment_method }, req.ip);

  res.status(201).json({
    message: 'Payment recorded and invoice settled successfully',
    paymentId,
    amount: payAmt
  });
});

// POST /api/accounts/cash-log
// Manual cash drawer adjustment (petty cash, owner draw, opening float)
router.post('/cash-log', authenticate, (req, res) => {
  const { distributor_id, transaction_type, amount, reason, date } = req.body;
  const distId = distributor_id || 1;
  const amt = Number(amount);

  if (!['cash_in', 'cash_out'].includes(transaction_type) || !amt || amt <= 0) {
    return res.status(400).json({ error: 'Valid transaction type (cash_in/cash_out) and positive amount required' });
  }

  const result = db.prepare(`
    INSERT INTO cash_drawer_logs (distributor_id, transaction_type, amount, reason, performed_by, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    distId, transaction_type, amt, reason || 'Cash Drawer Float Adjustment',
    req.user.fullName || req.user.username, date || new Date().toISOString().split('T')[0]
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Cash drawer adjustment recorded successfully' });
});

// GET /api/accounts/cash-logs
router.get('/cash-logs', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const logs = db.prepare(`
    SELECT * FROM cash_drawer_logs 
    WHERE distributor_id = ? 
    ORDER BY date DESC, id DESC 
    LIMIT 50
  `).all(distId);
  res.json(logs);
});

// GET /api/accounts/bank-accounts
router.get('/bank-accounts', authenticate, scopeDistributor, (req, res) => {
  const distId = req.activeDistributorId || 1;
  const accounts = db.prepare(`SELECT * FROM bank_accounts WHERE distributor_id = ? AND is_active = 1`).all(distId);
  res.json(accounts);
});

// POST /api/accounts/bank-accounts
router.post('/bank-accounts', authenticate, requireRole(['ADMIN', 'FINANCE_USER']), (req, res) => {
  const { distributor_id, account_name, account_number, bank_name, branch, initial_balance } = req.body;
  const distId = distributor_id || 1;
  const initBal = Number(initial_balance) || 0;

  if (!account_name || !account_number || !bank_name) {
    return res.status(400).json({ error: 'Account name, number, and bank name are required' });
  }

  const result = db.prepare(`
    INSERT INTO bank_accounts (distributor_id, account_name, account_number, bank_name, branch, initial_balance, current_balance, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(distId, account_name, account_number, bank_name, branch || null, initBal, initBal);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Bank account registered successfully' });
});

// POST /api/accounts/transfer
// Fund transfer between Cash and Bank, or Bank to Bank
router.post('/transfer', authenticate, (req, res) => {
  const { from_type, to_type, from_bank_id, to_bank_id, amount, notes, date } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Valid positive amount required' });

  const dateStr = date || new Date().toISOString().split('T')[0];

  db.transaction(() => {
    // 1. If Cash to Bank (Cash Deposit)
    if (from_type === 'cash' && to_type === 'bank') {
      if (!to_bank_id) throw new Error('Target bank account required');
      // Record cash out from drawer
      db.prepare(`
        INSERT INTO cash_drawer_logs (distributor_id, transaction_type, amount, reason, performed_by, date)
        VALUES (1, 'cash_out', ?, ?, ?, ?)
      `).run(amt, `Bank Deposit to Account #${to_bank_id}: ${notes || ''}`, req.user.username, dateStr);

      // Increase bank balance
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`).run(amt, to_bank_id);
    }
    // 2. If Bank to Cash (Withdrawal / Petty cash replenishment)
    else if (from_type === 'bank' && to_type === 'cash') {
      if (!from_bank_id) throw new Error('Source bank account required');
      // Decrease bank balance
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?`).run(amt, from_bank_id);

      // Record cash in to drawer
      db.prepare(`
        INSERT INTO cash_drawer_logs (distributor_id, transaction_type, amount, reason, performed_by, date)
        VALUES (1, 'cash_in', ?, ?, ?, ?)
      `).run(amt, `Bank Cash Withdrawal from Account #${from_bank_id}: ${notes || ''}`, req.user.username, dateStr);
    }
    // 3. If Bank to Bank
    else if (from_type === 'bank' && to_type === 'bank') {
      if (!from_bank_id || !to_bank_id) throw new Error('Both source and target bank accounts required');
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?`).run(amt, from_bank_id);
      db.prepare(`UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?`).run(amt, to_bank_id);
    } else {
      throw new Error('Unsupported transfer combination');
    }
  })();

  res.json({ message: 'Fund transfer processed successfully', amount: amt });
});

export default router;
