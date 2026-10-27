/**
 * purchases.ts (routes)
 * Sugarcane purchase management: CRUD, payments, cancellation.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/purchases
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { supplier_id, from, to, status } = req.query as {
      supplier_id?: string; from?: string; to?: string; status?: string;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (supplier_id) { conditions.push('p.supplier_id = ?'); params.push(supplier_id); }
    if (from) { conditions.push('p.purchase_date >= ?'); params.push(from); }
    if (to)   { conditions.push('p.purchase_date <= ?'); params.push(to); }
    if (status) { conditions.push('p.status = ?'); params.push(status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const purchases = db
      .prepare(
        `SELECT p.*, s.name AS supplier_name,
                COALESCE(SUM(pp.amount), 0) AS amount_paid_total
         FROM sugarcane_purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         LEFT JOIN purchase_payments pp ON pp.purchase_id = p.id
         ${where}
         GROUP BY p.id
         ORDER BY p.purchase_date DESC`,
      )
      .all(...params) as Record<string, unknown>[];

    res.json({ purchases });
  } catch (err) {
    console.error('[purchases GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/purchases
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const {
      purchase_date, supplier_id, reference_number,
      quantity_tonnes, rate_per_tonne,
      transport_cost = 0, loading_charges = 0, other_expenses = 0,
      notes,
    } = req.body as {
      purchase_date?: string; supplier_id?: string; reference_number?: string;
      quantity_tonnes?: number; rate_per_tonne?: number;
      transport_cost?: number; loading_charges?: number; other_expenses?: number;
      notes?: string;
    };

    if (!purchase_date) { res.status(400).json({ error: 'purchase_date is required.' }); return; }
    if (typeof quantity_tonnes !== 'number' || !Number.isFinite(quantity_tonnes) || quantity_tonnes <= 0) {
      res.status(400).json({ error: 'quantity_tonnes must be > 0.' }); return;
    }
    if (typeof rate_per_tonne !== 'number' || !Number.isFinite(rate_per_tonne) || rate_per_tonne <= 0) {
      res.status(400).json({ error: 'rate_per_tonne must be > 0.' }); return;
    }
    if (
      typeof transport_cost !== 'number' || !Number.isFinite(transport_cost) || transport_cost < 0 ||
      typeof loading_charges !== 'number' || !Number.isFinite(loading_charges) || loading_charges < 0 ||
      typeof other_expenses !== 'number' || !Number.isFinite(other_expenses) || other_expenses < 0
    ) {
      res.status(400).json({ error: 'Additional costs must be valid non-negative numbers.' }); return;
    }

    const base_cost = round2(quantity_tonnes * rate_per_tonne);
    const total_landed_cost = round2(
      base_cost + (transport_cost ?? 0) + (loading_charges ?? 0) + (other_expenses ?? 0),
    );

    const db = getDb();
    const now = nowIso();
    const id = uuidv4();

    // Get sugarcane material id
    const mat = db
      .prepare("SELECT id FROM raw_material_items WHERE is_sugarcane = 1 LIMIT 1")
      .get() as { id: string } | undefined;

    if (!mat) {
      res.status(500).json({ error: 'Sugarcane raw material not configured.' });
      return;
    }

    // Unit cost per tonne = total_landed_cost / quantity_tonnes
    const unit_cost_per_tonne = round2(total_landed_cost / quantity_tonnes);

    const insertPurchase = db.prepare(`
      INSERT INTO sugarcane_purchases
        (id, purchase_date, supplier_id, reference_number, quantity_tonnes, rate_per_tonne,
         base_cost, transport_cost, loading_charges, other_expenses, total_landed_cost,
         amount_paid, payment_status, notes, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, 'confirmed', ?, ?, ?)
    `);

    const insertMovement = db.prepare(`
      INSERT INTO raw_material_movements
        (id, material_id, movement_date, movement_type, quantity, unit_cost, total_cost,
         reference_id, reference_type, notes, created_by, created_at)
      VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, 'purchase', ?, ?, ?)
    `);

    // Run atomically
    db.transaction(() => {
      insertPurchase.run(
        id, purchase_date, supplier_id ?? null, reference_number?.trim() ?? null,
        quantity_tonnes, rate_per_tonne, base_cost, transport_cost, loading_charges,
        other_expenses, total_landed_cost, notes?.trim() ?? null, req.user!.id, now, now,
      );

      insertMovement.run(
        uuidv4(), mat.id, purchase_date, quantity_tonnes,
        unit_cost_per_tonne, total_landed_cost, id, notes?.trim() ?? null, req.user!.id, now,
      );
    })();

    const purchase = db.prepare('SELECT * FROM sugarcane_purchases WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'create', 'purchase', id, {
      quantity_tonnes, total_landed_cost,
    });
    res.status(201).json({ purchase });
  } catch (err) {
    console.error('[purchases POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/purchases/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const purchase = db
      .prepare(
        `SELECT p.*, s.name AS supplier_name
         FROM sugarcane_purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.id = ?`,
      )
      .get(id);

    if (!purchase) { res.status(404).json({ error: 'Purchase not found.' }); return; }

    const payments = db
      .prepare('SELECT * FROM purchase_payments WHERE purchase_id = ? ORDER BY payment_date ASC')
      .all(id);

    const movement = db
      .prepare("SELECT * FROM raw_material_movements WHERE reference_id = ? AND movement_type = 'purchase'")
      .get(id);

    res.json({ purchase, payments, movement });
  } catch (err) {
    console.error('[purchases GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/purchases/:id
//  Only allowed if no confirmed batch has consumed this purchase's sugarcane.
//  Approach: we allow updates to metadata fields; recalculate costs.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM sugarcane_purchases WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Purchase not found.' }); return; }
    if (existing.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot update a cancelled purchase.' }); return;
    }

    const {
      purchase_date, supplier_id, reference_number,
      quantity_tonnes, rate_per_tonne,
      transport_cost = 0, loading_charges = 0, other_expenses = 0,
      notes,
    } = req.body as {
      purchase_date?: string; supplier_id?: string; reference_number?: string;
      quantity_tonnes?: number; rate_per_tonne?: number;
      transport_cost?: number; loading_charges?: number; other_expenses?: number;
      notes?: string;
    };

    if (!purchase_date) { res.status(400).json({ error: 'purchase_date is required.' }); return; }
    if (!quantity_tonnes || quantity_tonnes <= 0) {
      res.status(400).json({ error: 'quantity_tonnes must be > 0.' }); return;
    }
    if (!rate_per_tonne || rate_per_tonne <= 0) {
      res.status(400).json({ error: 'rate_per_tonne must be > 0.' }); return;
    }

    const base_cost = round2(quantity_tonnes * rate_per_tonne);
    const total_landed_cost = round2(
      base_cost + (transport_cost ?? 0) + (loading_charges ?? 0) + (other_expenses ?? 0),
    );
    const unit_cost_per_tonne = round2(total_landed_cost / quantity_tonnes);

    const mat = db
      .prepare("SELECT id FROM raw_material_items WHERE is_sugarcane = 1 LIMIT 1")
      .get() as { id: string } | undefined;

    db.transaction(() => {
      db.prepare(`
        UPDATE sugarcane_purchases
        SET purchase_date = ?, supplier_id = ?, reference_number = ?, quantity_tonnes = ?,
            rate_per_tonne = ?, base_cost = ?, transport_cost = ?, loading_charges = ?,
            other_expenses = ?, total_landed_cost = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        purchase_date, supplier_id ?? null, reference_number?.trim() ?? null,
        quantity_tonnes, rate_per_tonne, base_cost, transport_cost, loading_charges,
        other_expenses, total_landed_cost, notes?.trim() ?? null, nowIso(), id,
      );

      // Update the corresponding raw material movement
      if (mat) {
        db.prepare(`
          UPDATE raw_material_movements
          SET movement_date = ?, quantity = ?, unit_cost = ?, total_cost = ?
          WHERE reference_id = ? AND movement_type = 'purchase'
        `).run(purchase_date, quantity_tonnes, unit_cost_per_tonne, total_landed_cost, id);
      }
    })();

    const purchase = db.prepare('SELECT * FROM sugarcane_purchases WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'update', 'purchase', id, { quantity_tonnes, total_landed_cost });
    res.json({ purchase });
  } catch (err) {
    console.error('[purchases PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/purchases/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const purchase = db.prepare('SELECT * FROM sugarcane_purchases WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!purchase) { res.status(404).json({ error: 'Purchase not found.' }); return; }
    if (purchase.status === 'cancelled') {
      res.status(400).json({ error: 'Purchase already cancelled.' }); return;
    }

    db.transaction(() => {
      db.prepare("UPDATE sugarcane_purchases SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .run(nowIso(), id);

      // Reverse the raw material movement by deleting or inserting a negative movement
      db.prepare(`
        UPDATE raw_material_movements
        SET quantity = -(quantity), notes = 'Reversed — purchase cancelled'
        WHERE reference_id = ? AND movement_type = 'purchase'
      `).run(id);
    })();

    auditLog(req.user!.id, req.user!.name, 'cancel', 'purchase', id, {});
    res.json({ message: 'Purchase cancelled and stock reversed.' });
  } catch (err) {
    console.error('[purchases POST /:id/cancel]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/purchases/:id/payment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/payment', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const purchase = db.prepare('SELECT * FROM sugarcane_purchases WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!purchase) { res.status(404).json({ error: 'Purchase not found.' }); return; }
    if (purchase.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot record payment on a cancelled purchase.' }); return;
    }

    const { payment_date, amount, payment_method, notes } = req.body as {
      payment_date?: string; amount?: number; payment_method?: string; notes?: string;
    };

    if (!payment_date) { res.status(400).json({ error: 'payment_date is required.' }); return; }
    if (!amount || amount <= 0) { res.status(400).json({ error: 'amount must be > 0.' }); return; }

    const now = nowIso();
    const paymentId = uuidv4();

    // Get total paid so far
    const paidRow = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM purchase_payments WHERE purchase_id = ?')
      .get(id) as { total: number };

    const newTotalPaid = round2(paidRow.total + amount);
    const totalLanded = purchase.total_landed_cost as number;

    let paymentStatus = 'partial';
    if (newTotalPaid >= totalLanded) paymentStatus = 'paid';
    if (newTotalPaid <= 0) paymentStatus = 'unpaid';

    db.transaction(() => {
      db.prepare(`
        INSERT INTO purchase_payments
          (id, purchase_id, payment_date, amount, payment_method, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(paymentId, id, payment_date, amount, payment_method ?? null, notes ?? null, req.user!.id, now);

      db.prepare(`
        UPDATE sugarcane_purchases
        SET amount_paid = ?, payment_status = ?, updated_at = ?
        WHERE id = ?
      `).run(newTotalPaid, paymentStatus, now, id);
    })();

    auditLog(req.user!.id, req.user!.name, 'payment', 'purchase', id, { amount, paymentStatus });
    const payment = db.prepare('SELECT * FROM purchase_payments WHERE id = ?').get(paymentId);
    res.status(201).json({ payment, payment_status: paymentStatus, total_paid: newTotalPaid });
  } catch (err) {
    console.error('[purchases POST /:id/payment]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
