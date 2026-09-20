import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'distributor-super-secret-jwt-key-2026';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      distributor_id: user.distributor_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If running in development/demo mode and no token, fall back to default Admin user
    const defaultAdmin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1`).get();
    if (defaultAdmin) {
      req.user = {
        id: defaultAdmin.id,
        username: defaultAdmin.username,
        email: defaultAdmin.email,
        role: defaultAdmin.role,
        distributor_id: defaultAdmin.distributor_id
      };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of: ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

export function logAudit(userId, action, entityType, entityId, oldValues = null, newValues = null, ip = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId || null,
      action,
      entityType,
      entityId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ip || '127.0.0.1'
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
