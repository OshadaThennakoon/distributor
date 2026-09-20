import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import { signToken, authenticate, requireRole, logAudit } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE username = ? AND is_active = 1`).get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken(user);
  logAudit(user.id, 'LOGIN', 'user', user.id, null, { username: user.username }, req.ip);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      distributorId: user.distributor_id
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`SELECT id, username, email, full_name, role, distributor_id FROM users WHERE id = ?`).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// GET /api/auth/users (ADMIN only)
router.get('/users', authenticate, requireRole(['ADMIN']), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.distributor_id, u.is_active, u.created_at, d.name as distributor_name
    FROM users u
    LEFT JOIN distributors d ON u.distributor_id = d.id
    ORDER BY u.id ASC
  `).all();
  res.json(users);
});

// POST /api/auth/users (ADMIN only)
router.post('/users', authenticate, requireRole(['ADMIN']), (req, res) => {
  const { username, email, password, fullName, role, distributorId } = req.body;
  if (!username || !email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }

  const hash = bcrypt.hashSync(password, 8);
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, distributor_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(username, email, hash, fullName, role, distributorId || null);

  logAudit(req.user.id, 'CREATE_USER', 'user', result.lastInsertRowid, null, { username, role, email }, req.ip);
  res.status(201).json({ id: result.lastInsertRowid, message: 'User created successfully' });
});

// DELETE /api/auth/users/:id (ADMIN only)
router.delete('/users/:id', authenticate, requireRole(['ADMIN']), (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const target = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Prevent deleting default master administrator
  if (target.username === 'admin') {
    return res.status(403).json({ error: 'System root administrator account cannot be deleted' });
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(targetId);
  logAudit(req.user.id, 'DELETE_USER', 'user', targetId, { username: target.username }, null, req.ip);
  res.json({ message: 'User deleted successfully' });
});

// GET /api/auth/audit-logs
router.get('/audit-logs', authenticate, (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.username, u.full_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();
  res.json(logs);
});

// GET /api/auth/settings
router.get('/settings', authenticate, (req, res) => {
  const settings = db.prepare(`SELECT * FROM system_settings`).all();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

// POST /api/auth/settings (ADMIN only)
router.post('/settings', authenticate, requireRole(['ADMIN']), (req, res) => {
  const updates = req.body;
  const updateStmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      updateStmt.run(k, String(v));
    }
  })();

  logAudit(req.user.id, 'UPDATE_SETTINGS', 'system_settings', null, null, updates, req.ip);
  res.json({ message: 'Settings saved successfully' });
});

export default router;
