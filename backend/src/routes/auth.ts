/**
 * auth.ts (routes)
 * Authentication endpoints: login, me, logout, change-password.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, JWT_SECRET } from '../middleware/auth.js';
import { nowIso, auditLog } from '../utils/helpers.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .get(email.toLowerCase().trim()) as
      | { id: string; name: string; email: string; password_hash: string; role: string }
      | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    auditLog(user.id, user.name, 'login', 'user', user.id, { email: user.email });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', verifyToken, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/logout  (client-side; token invalidation not supported with
//                          stateless JWT — just acknowledge)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', verifyToken, (req: Request, res: Response): void => {
  auditLog(req.user?.id, req.user?.name, 'logout', 'user', req.user?.id ?? '', {});
  res.json({ message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', verifyToken, (req: Request, res: Response): void => {
  try {
    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'current_password and new_password are required.' });
      return;
    }
    if (new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .get(req.user!.id) as { id: string; password_hash: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      nowIso(),
      user.id,
    );

    auditLog(req.user!.id, req.user!.name, 'change_password', 'user', user.id, {});
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[auth/change-password]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
