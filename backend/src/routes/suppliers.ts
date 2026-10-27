/**
 * suppliers.ts (routes)
 * CRUD for suppliers with outstanding balance calculation.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/suppliers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { active } = req.query;

    const whereClause = active === 'false' ? '' : 'WHERE s.is_active = 1';

    const suppliers = db
      .prepare(
        `SELECT s.*,
          COALESCE(SUM(p.total_landed_cost), 0) - COALESCE(SUM(pp.amount), 0) + s.opening_balance AS outstanding_balance,
          COUNT(DISTINCT p.id) AS total_purchases
        FROM suppliers s
        LEFT JOIN sugarcane_purchases p
          ON p.supplier_id = s.id AND p.status = 'confirmed'
        LEFT JOIN purchase_payments pp ON pp.purchase_id = p.id
        ${whereClause}
        GROUP BY s.id
        ORDER BY s.name ASC`,
      )
      .all() as Record<string, unknown>[];

    res.json({ suppliers });
  } catch (err) {
    console.error('[suppliers GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/suppliers
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const { name, business_name, phone, address, gstin, opening_balance, notes } = req.body as {
      name?: string;
      business_name?: string;
      phone?: string;
      address?: string;
      gstin?: string;
      opening_balance?: number;
      notes?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }

    const db = getDb();
    const now = nowIso();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO suppliers (id, name, business_name, phone, address, gstin, opening_balance, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      name.trim(),
      business_name?.trim() ?? null,
      phone?.trim() ?? null,
      address?.trim() ?? null,
      gstin?.trim() ?? null,
      opening_balance ?? 0,
      notes?.trim() ?? null,
      now,
      now,
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'create', 'supplier', id, { name });
    res.status(201).json({ supplier });
  } catch (err) {
    console.error('[suppliers POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/suppliers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found.' });
      return;
    }

    const purchases = db
      .prepare(
        `SELECT p.*, COALESCE(SUM(pp.amount), 0) AS amount_paid_total
         FROM sugarcane_purchases p
         LEFT JOIN purchase_payments pp ON pp.purchase_id = p.id
         WHERE p.supplier_id = ?
         GROUP BY p.id
         ORDER BY p.purchase_date DESC`,
      )
      .all(id);

    const payments = db
      .prepare(
        `SELECT pp.* FROM purchase_payments pp
         JOIN sugarcane_purchases p ON pp.purchase_id = p.id
         WHERE p.supplier_id = ?
         ORDER BY pp.payment_date DESC`,
      )
      .all(id);

    res.json({ supplier, purchases, payments });
  } catch (err) {
    console.error('[suppliers GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/suppliers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found.' });
      return;
    }

    const { name, business_name, phone, address, gstin, opening_balance, notes } = req.body as {
      name?: string;
      business_name?: string;
      phone?: string;
      address?: string;
      gstin?: string;
      opening_balance?: number;
      notes?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }

    db.prepare(`
      UPDATE suppliers
      SET name = ?, business_name = ?, phone = ?, address = ?, gstin = ?,
          opening_balance = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(),
      business_name?.trim() ?? null,
      phone?.trim() ?? null,
      address?.trim() ?? null,
      gstin?.trim() ?? null,
      opening_balance ?? 0,
      notes?.trim() ?? null,
      nowIso(),
      id,
    );

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'update', 'supplier', id, { name });
    res.json({ supplier });
  } catch (err) {
    console.error('[suppliers PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/suppliers/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Supplier not found.' });
      return;
    }

    db.prepare('UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
    auditLog(req.user!.id, req.user!.name, 'deactivate', 'supplier', id, {});
    res.json({ message: 'Supplier deactivated.' });
  } catch (err) {
    console.error('[suppliers DELETE /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
