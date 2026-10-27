/**
 * settings.ts (routes)
 * Application settings and fixed expense configuration.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// GET /api/settings — get all settings as key-value
router.get('/', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value, updated_at, updated_by FROM settings').all() as {
      key: string;
      value: string;
      updated_at: string;
      updated_by: string;
    }[];

    const settingsObj: Record<string, string> = {};
    for (const r of rows) {
      settingsObj[r.key] = r.value;
    }

    res.json({ settings: settingsObj });
  } catch (err) {
    console.error('[settings GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/settings — update key-value settings
router.put('/', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { settings } = req.body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'settings object required.' });
      return;
    }

    const now = nowIso();
    const upsertStmt = db.prepare(`
      INSERT INTO settings (id, key, value, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `);

    const updateAll = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        upsertStmt.run(uuidv4(), key, String(value), now, req.user?.name ?? 'owner');
      }
    });

    updateAll();

    auditLog(req.user?.id, req.user?.name, 'UPDATE', 'SETTINGS', 'global', settings);

    res.json({ message: 'Settings updated successfully.' });
  } catch (err) {
    console.error('[settings PUT /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FIXED EXPENSES (e.g. ₹30,000 monthly)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/settings/fixed-expenses
router.get('/fixed-expenses', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const expenses = db
      .prepare('SELECT * FROM fixed_expenses ORDER BY start_date DESC')
      .all();
    res.json({ fixed_expenses: expenses });
  } catch (err) {
    console.error('[settings GET /fixed-expenses]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/settings/fixed-expenses
router.post('/fixed-expenses', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { name, amount, category = 'overhead', start_date, end_date, notes } = req.body;

    if (!name || amount === undefined || amount <= 0 || !start_date) {
      res.status(400).json({ error: 'Name, positive amount, and start_date are required.' });
      return;
    }

    const id = uuidv4();
    const now = nowIso();
    const amt = round2(Number(amount));

    db.prepare(`
      INSERT INTO fixed_expenses (
        id, name, amount, category, start_date, end_date, notes, is_active, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      name.trim(),
      amt,
      category,
      start_date,
      end_date || null,
      notes ? notes.trim() : null,
      req.user?.name ?? 'system',
      now,
    );

    auditLog(req.user?.id, req.user?.name, 'CREATE', 'FIXED_EXPENSE', id, { name, amount: amt, start_date });

    res.status(201).json({ message: 'Fixed expense added successfully.', id });
  } catch (err) {
    console.error('[settings POST /fixed-expenses]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/settings/fixed-expenses/:id
router.put('/fixed-expenses/:id', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, amount, category, start_date, end_date, notes, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Fixed expense not found.' });
      return;
    }

    db.prepare(`
      UPDATE fixed_expenses
      SET name = ?,
          amount = ?,
          category = ?,
          start_date = ?,
          end_date = ?,
          notes = ?,
          is_active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : existing.name,
      amount !== undefined ? round2(Number(amount)) : existing.amount,
      category ?? existing.category,
      start_date ?? existing.start_date,
      end_date !== undefined ? (end_date || null) : existing.end_date,
      notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id,
    );

    auditLog(req.user?.id, req.user?.name, 'UPDATE', 'FIXED_EXPENSE', id, req.body);

    res.json({ message: 'Fixed expense updated successfully.' });
  } catch (err) {
    console.error('[settings PUT /fixed-expenses/:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/settings/fixed-expenses/:id
router.delete('/fixed-expenses/:id', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    db.prepare('UPDATE fixed_expenses SET is_active = 0 WHERE id = ?').run(id);

    auditLog(req.user?.id, req.user?.name, 'DEACTIVATE', 'FIXED_EXPENSE', id, {});

    res.json({ message: 'Fixed expense deactivated successfully.' });
  } catch (err) {
    console.error('[settings DELETE /fixed-expenses/:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

