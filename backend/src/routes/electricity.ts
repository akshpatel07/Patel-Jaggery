/**
 * electricity.ts (routes)
 * Electricity bill management and batch cost allocation.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/electricity/bills
// ─────────────────────────────────────────────────────────────────────────────
router.get('/bills', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (from) { conditions.push('bill_date >= ?'); params.push(from); }
    if (to)   { conditions.push('bill_date <= ?'); params.push(to); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const bills = db
      .prepare(`SELECT * FROM electricity_bills ${where} ORDER BY bill_date DESC`)
      .all(...params);
    res.json({ bills });
  } catch (err) {
    console.error('[electricity GET /bills]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/electricity/bills
// ─────────────────────────────────────────────────────────────────────────────
router.post('/bills', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const {
      bill_date, bill_number, total_amount, period_from, period_to,
      allocation_basis, notes,
    } = req.body as {
      bill_date?: string; bill_number?: string; total_amount?: number;
      period_from?: string; period_to?: string; allocation_basis?: string; notes?: string;
    };

    if (!bill_date) { res.status(400).json({ error: 'bill_date is required.' }); return; }
    if (!total_amount || total_amount <= 0) {
      res.status(400).json({ error: 'total_amount must be > 0.' }); return;
    }

    const db = getDb();
    const id = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO electricity_bills
        (id, bill_date, bill_number, total_amount, period_from, period_to,
         allocation_basis, allocated_amount, unallocated_amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      id, bill_date, bill_number ?? null, total_amount, period_from ?? null,
      period_to ?? null, allocation_basis ?? 'manual', total_amount, notes ?? null, now,
    );

    auditLog(req.user!.id, req.user!.name, 'create', 'electricity_bill', id, { total_amount });
    const bill = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(id);
    res.status(201).json({ bill });
  } catch (err) {
    console.error('[electricity POST /bills]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/electricity/bills/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/bills/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Bill not found.' }); return; }

    const {
      bill_date, bill_number, total_amount, period_from, period_to,
      allocation_basis, notes,
    } = req.body as {
      bill_date?: string; bill_number?: string; total_amount?: number;
      period_from?: string; period_to?: string; allocation_basis?: string; notes?: string;
    };

    if (!bill_date) { res.status(400).json({ error: 'bill_date is required.' }); return; }
    if (!total_amount || total_amount <= 0) {
      res.status(400).json({ error: 'total_amount must be > 0.' }); return;
    }

    const allocatedAmount = existing.allocated_amount as number;
    const unallocatedAmount = round2(total_amount - allocatedAmount);

    db.prepare(`
      UPDATE electricity_bills
      SET bill_date = ?, bill_number = ?, total_amount = ?, period_from = ?, period_to = ?,
          allocation_basis = ?, unallocated_amount = ?, notes = ?
      WHERE id = ?
    `).run(
      bill_date, bill_number ?? null, total_amount, period_from ?? null, period_to ?? null,
      allocation_basis ?? 'manual', unallocatedAmount, notes ?? null, id,
    );

    const bill = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(id);
    res.json({ bill });
  } catch (err) {
    console.error('[electricity PUT /bills/:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/electricity/bills/:id/allocations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/bills/:id/allocations', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const bill = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(id);
    if (!bill) { res.status(404).json({ error: 'Bill not found.' }); return; }

    const allocations = db
      .prepare(
        `SELECT bea.*, pb.batch_number, pb.production_date, pb.finished_quantity_kg
         FROM batch_electricity_allocations bea
         JOIN production_batches pb ON bea.batch_id = pb.id
         WHERE bea.bill_id = ?
         ORDER BY bea.created_at ASC`,
      )
      .all(id);

    res.json({ bill, allocations });
  } catch (err) {
    console.error('[electricity GET /bills/:id/allocations]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/electricity/allocate — allocate bill amount to batches
// ─────────────────────────────────────────────────────────────────────────────
router.post('/allocate', requireRole('owner', 'production_manager'), (req: Request, res: Response): void => {
  try {
    const { bill_id, allocations } = req.body as {
      bill_id?: string;
      allocations?: { batch_id: string; allocated_amount: number; allocation_basis_value?: number }[];
    };

    if (!bill_id) { res.status(400).json({ error: 'bill_id is required.' }); return; }
    if (!allocations || allocations.length === 0) {
      res.status(400).json({ error: 'allocations array is required.' }); return;
    }

    const db = getDb();
    const bill = db.prepare('SELECT * FROM electricity_bills WHERE id = ?').get(bill_id) as
      | Record<string, unknown> | undefined;
    if (!bill) { res.status(404).json({ error: 'Bill not found.' }); return; }

    const totalAllocating = round2(allocations.reduce((s, a) => s + a.allocated_amount, 0));
    const billTotal = bill.total_amount as number;

    if (totalAllocating > billTotal) {
      res.status(400).json({
        error: `Cannot allocate ₹${totalAllocating} — bill total is ₹${billTotal}.`,
      });
      return;
    }

    const now = nowIso();

    db.transaction(() => {
      // Remove existing allocations for this bill (replace strategy)
      db.prepare('DELETE FROM batch_electricity_allocations WHERE bill_id = ?').run(bill_id);

      // Reset batch electricity amounts for this bill
      db.prepare(`
        UPDATE production_batches
        SET electricity_amount = electricity_amount -
          COALESCE((
            SELECT allocated_amount FROM batch_electricity_allocations
            WHERE bill_id = ? AND batch_id = production_batches.id
          ), 0)
        WHERE electricity_bill_id = ?
      `).run(bill_id, bill_id);

      let totalAllocatedSoFar = 0;

      for (const alloc of allocations) {
        const batch = db.prepare("SELECT id, status FROM production_batches WHERE id = ?").get(alloc.batch_id) as
          | { id: string; status: string } | undefined;
        if (!batch) throw new Error(`Batch ${alloc.batch_id} not found.`);

        db.prepare(`
          INSERT INTO batch_electricity_allocations
            (id, bill_id, batch_id, allocated_amount, allocation_basis_value, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), bill_id, alloc.batch_id, alloc.allocated_amount, alloc.allocation_basis_value ?? null, now);

        // Update batch electricity_amount and electricity_bill_id
        db.prepare(`
          UPDATE production_batches
          SET electricity_amount = ?, electricity_bill_id = ?
          WHERE id = ?
        `).run(alloc.allocated_amount, bill_id, alloc.batch_id);

        totalAllocatedSoFar += alloc.allocated_amount;
      }

      // Update bill allocated / unallocated
      db.prepare(`
        UPDATE electricity_bills
        SET allocated_amount = ?, unallocated_amount = ?
        WHERE id = ?
      `).run(round2(totalAllocatedSoFar), round2(billTotal - totalAllocatedSoFar), bill_id);
    })();

    auditLog(req.user!.id, req.user!.name, 'allocate', 'electricity_bill', bill_id, { totalAllocating });
    res.json({ message: 'Allocation saved.', total_allocated: totalAllocating });
  } catch (err: unknown) {
    console.error('[electricity POST /allocate]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    res.status(500).json({ error: msg });
  }
});

export default router;
