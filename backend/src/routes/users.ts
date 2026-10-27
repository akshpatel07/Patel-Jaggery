/**
 * users.ts (routes)
 * User management and audit log review.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// GET /api/users
router.get('/', requireRole('owner'), (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const users = db
      .prepare('SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC')
      .all();
    res.json({ users });
  } catch (err) {
    console.error('[users GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/users
router.post('/', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { name, email, password, role = 'staff' } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    const validRoles = ['owner', 'accountant', 'production_manager', 'staff'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Allowed: ${validRoles.join(', ')}` });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const id = uuidv4();
    const now = nowIso();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, name.trim(), email.toLowerCase().trim(), passwordHash, role, now, now);

    auditLog(req.user?.id, req.user?.name, 'CREATE', 'USER', id, { name, email, role });

    res.status(201).json({ message: 'User created successfully.', id });
  } catch (err) {
    console.error('[users POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, role, password, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = nowIso();

    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, id);
    }

    db.prepare(`
      UPDATE users
      SET name = ?,
          role = ?,
          is_active = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      role ?? existing.role,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      now,
      id,
    );

    auditLog(req.user?.id, req.user?.name, 'UPDATE', 'USER', id, { name, role, is_active });

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    console.error('[users PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/audit-log
router.get('/audit-log', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { limit = 100 } = req.query as { limit?: string };

    const logs = db
      .prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?')
      .all(Number(limit) || 100);

    res.json({ logs });
  } catch (err) {
    console.error('[users GET /audit-log]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

