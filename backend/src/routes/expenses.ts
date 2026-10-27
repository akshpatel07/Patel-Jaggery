/**
 * expenses.ts (routes)
 * Other expenses management with categories, classification, and batch association.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

export const EXPENSE_CATEGORIES = [
  'Transportation',
  'Fuel',
  'Repairs and Maintenance',
  'Packaging',
  'Salaries',
  'Rent',
  'Electricity',
  'Administrative Expenses',
  'Bank Charges',
  'Taxes and Statutory Charges',
  'Miscellaneous',
];

export const EXPENSE_CLASSIFICATIONS = [
  'direct',
  'overhead',
  'selling',
  'admin',
  'other',
];

// GET /api/expenses/categories
router.get('/categories', (_req: Request, res: Response): void => {
  res.json({
    categories: EXPENSE_CATEGORIES,
    classifications: EXPENSE_CLASSIFICATIONS,
  });
});

// GET /api/expenses
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { category, classification, payment_status, from, to } = req.query as {
      category?: string;
      classification?: string;
      payment_status?: string;
      from?: string;
      to?: string;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category) {
      conditions.push('e.category = ?');
      params.push(category);
    }
    if (classification) {
      conditions.push('e.classification = ?');
      params.push(classification);
    }
    if (payment_status) {
      conditions.push('e.payment_status = ?');
      params.push(payment_status);
    }
    if (from) {
      conditions.push('e.expense_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('e.expense_date <= ?');
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const expenses = db
      .prepare(
        `SELECT e.*, b.batch_number
         FROM other_expenses e
         LEFT JOIN production_batches b ON e.batch_id = b.id
         ${where}
         ORDER BY e.expense_date DESC, e.created_at DESC`,
      )
      .all(...params);

    const summary = db
      .prepare(
        `SELECT
           COALESCE(SUM(amount), 0) AS total_amount,
           COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS total_paid,
           COALESCE(SUM(CASE WHEN payment_status != 'paid' THEN amount ELSE 0 END), 0) AS total_unpaid
         FROM other_expenses e
         ${where}`,
      )
      .get(...params);

    res.json({ expenses, summary });
  } catch (err) {
    console.error('[expenses GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/expenses/:id
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const expense = db
      .prepare(
        `SELECT e.*, b.batch_number
         FROM other_expenses e
         LEFT JOIN production_batches b ON e.batch_id = b.id
         WHERE e.id = ?`,
      )
      .get(req.params.id);

    if (!expense) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    res.json({ expense });
  } catch (err) {
    console.error('[expenses GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/expenses
router.post('/', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const {
      expense_date,
      category,
      description,
      amount,
      vendor,
      payment_method,
      payment_status = 'paid',
      classification = 'other',
      batch_id,
      notes,
    } = req.body;

    if (!expense_date || !category || !description || amount === undefined || amount <= 0) {
      res.status(400).json({ error: 'Date, category, description, and positive amount are required.' });
      return;
    }

    const id = uuidv4();
    const now = nowIso();
    const amt = round2(Number(amount));

    db.prepare(`
      INSERT INTO other_expenses (
        id, expense_date, category, description, amount,
        vendor, payment_method, payment_status, classification,
        batch_id, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      expense_date,
      category,
      description.trim(),
      amt,
      vendor ? vendor.trim() : null,
      payment_method ?? null,
      payment_status,
      classification,
      batch_id ?? null,
      notes ? notes.trim() : null,
      req.user?.name ?? 'system',
      now,
    );

    auditLog(req.user?.id, req.user?.name, 'CREATE', 'EXPENSE', id, {
      category,
      amount: amt,
      description,
    });

    res.status(201).json({ message: 'Expense recorded successfully.', id });
  } catch (err) {
    console.error('[expenses POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    const {
      expense_date,
      category,
      description,
      amount,
      vendor,
      payment_method,
      payment_status,
      classification,
      batch_id,
      notes,
    } = req.body;

    const amt = amount !== undefined ? round2(Number(amount)) : (existing.amount as number);

    db.prepare(`
      UPDATE other_expenses
      SET expense_date = ?,
          category = ?,
          description = ?,
          amount = ?,
          vendor = ?,
          payment_method = ?,
          payment_status = ?,
          classification = ?,
          batch_id = ?,
          notes = ?
      WHERE id = ?
    `).run(
      expense_date ?? existing.expense_date,
      category ?? existing.category,
      description ? description.trim() : existing.description,
      amt,
      vendor !== undefined ? (vendor ? vendor.trim() : null) : existing.vendor,
      payment_method ?? existing.payment_method,
      payment_status ?? existing.payment_status,
      classification ?? existing.classification,
      batch_id !== undefined ? (batch_id || null) : existing.batch_id,
      notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
      id,
    );

    auditLog(req.user?.id, req.user?.name, 'UPDATE', 'EXPENSE', id, { amount: amt });

    res.json({ message: 'Expense updated successfully.' });
  } catch (err) {
    console.error('[expenses PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM other_expenses WHERE id = ?').get(id);

    if (!existing) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }

    db.prepare('DELETE FROM other_expenses WHERE id = ?').run(id);

    auditLog(req.user?.id, req.user?.name, 'DELETE', 'EXPENSE', id, existing as Record<string, unknown>);

    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('[expenses DELETE /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

