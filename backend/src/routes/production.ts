/**
 * production.ts (routes)
 * Production batch management — the most critical module.
 *
 * Key rules enforced here:
 *  - Stock computed from movements (never a running total)
 *  - Weighted average sugarcane cost at the time of confirmation
 *  - Fixed overhead allocated proportionally by kg output for the month
 *  - All stock deductions happen atomically in a transaction
 *  - Cancellation reverses all movements (only if stock allows)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import {
  nowIso, today, round2, auditLog,
  generateBatchNumber, getSugarcaneCostPerTonne,
  getRawMaterialStock, getFinishedGoodsStock,
  getMonthlyFixedExpenses, getCurrentLabourRate,
} from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/production — list batches
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { status, from, to } = req.query as { status?: string; from?: string; to?: string };

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (from) { conditions.push('production_date >= ?'); params.push(from); }
    if (to)   { conditions.push('production_date <= ?'); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const batches = db
      .prepare(`SELECT * FROM production_batches ${where} ORDER BY production_date DESC`)
      .all(...params);

    res.json({ batches });
  } catch (err) {
    console.error('[production GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/production — create draft batch
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      production_date, description,
      sugarcane_consumed_tonnes,
      finished_quantity_kg,
      electricity_method, electricity_amount, electricity_bill_id,
      production_days, fuel_cost, packaging_cost, other_direct_cost, notes,
    } = req.body as {
      production_date?: string; description?: string;
      sugarcane_consumed_tonnes?: number; finished_quantity_kg?: number;
      electricity_method?: string; electricity_amount?: number; electricity_bill_id?: string;
      production_days?: number; fuel_cost?: number; packaging_cost?: number;
      other_direct_cost?: number; notes?: string;
    };

    if (!production_date) { res.status(400).json({ error: 'production_date is required.' }); return; }
    if (!sugarcane_consumed_tonnes || sugarcane_consumed_tonnes <= 0) {
      res.status(400).json({ error: 'sugarcane_consumed_tonnes must be > 0.' }); return;
    }

    const db = getDb();
    const now = nowIso();
    const id = uuidv4();
    const batchNumber = generateBatchNumber();
    const labourRate = getCurrentLabourRate();
    // Compute sugarcane cost at draft creation (will be recalculated at confirmation)
    const scCostPerTonne = getSugarcaneCostPerTonne();
    const sugarcane_cost = round2(sugarcane_consumed_tonnes * scCostPerTonne);

    db.prepare(`
      INSERT INTO production_batches
        (id, batch_number, production_date, description,
         sugarcane_consumed_tonnes, sugarcane_cost,
         finished_quantity_kg, labour_rate_per_100kg, labour_cost,
         electricity_method, electricity_amount, electricity_bill_id,
         production_days, fuel_cost, packaging_cost, other_direct_cost,
         total_ingredient_cost, total_direct_cost, allocated_overhead,
         total_cost, cost_per_kg, yield_percentage,
         status, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL, NULL, NULL,
              'draft', ?, ?, ?, ?)
    `).run(
      id, batchNumber, production_date, description ?? null,
      sugarcane_consumed_tonnes, sugarcane_cost,
      finished_quantity_kg ?? null,
      labourRate,
      electricity_method ?? 'fixed',
      electricity_amount ?? 0,
      electricity_bill_id ?? null,
      production_days ?? 1,
      fuel_cost ?? 0,
      packaging_cost ?? 0,
      other_direct_cost ?? 0,
      notes ?? null, req.user!.id, now, now,
    );

    auditLog(req.user!.id, req.user!.name, 'create', 'production_batch', id, { batchNumber });
    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
    res.status(201).json({ batch });
  } catch (err) {
    console.error('[production POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/production/:id — full batch detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
    if (!batch) { res.status(404).json({ error: 'Batch not found.' }); return; }

    const ingredients = db
      .prepare('SELECT * FROM batch_ingredients WHERE batch_id = ?')
      .all(id);

    const finishedMovements = db
      .prepare("SELECT * FROM finished_goods_movements WHERE batch_id = ?")
      .all(id);

    const rawMovements = db
      .prepare("SELECT * FROM raw_material_movements WHERE reference_id = ? AND reference_type = 'batch'")
      .all(id);

    const electricityAllocations = db
      .prepare('SELECT * FROM batch_electricity_allocations WHERE batch_id = ?')
      .all(id);

    res.json({ batch, ingredients, finishedMovements, rawMovements, electricityAllocations });
  } catch (err) {
    console.error('[production GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/production/:id — update draft batch only
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Batch not found.' }); return; }
    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft batches can be updated.' }); return;
    }

    const {
      production_date, description, sugarcane_consumed_tonnes, finished_quantity_kg,
      electricity_method, electricity_amount, electricity_bill_id,
      production_days, fuel_cost, packaging_cost, other_direct_cost, notes,
    } = req.body as {
      production_date?: string; description?: string;
      sugarcane_consumed_tonnes?: number; finished_quantity_kg?: number;
      electricity_method?: string; electricity_amount?: number; electricity_bill_id?: string;
      production_days?: number; fuel_cost?: number; packaging_cost?: number;
      other_direct_cost?: number; notes?: string;
    };

    if (!production_date) { res.status(400).json({ error: 'production_date is required.' }); return; }
    if (!sugarcane_consumed_tonnes || sugarcane_consumed_tonnes <= 0) {
      res.status(400).json({ error: 'sugarcane_consumed_tonnes must be > 0.' }); return;
    }

    const scCostPerTonne = getSugarcaneCostPerTonne();
    const sugarcane_cost = round2(sugarcane_consumed_tonnes * scCostPerTonne);

    db.prepare(`
      UPDATE production_batches
      SET production_date = ?, description = ?, sugarcane_consumed_tonnes = ?, sugarcane_cost = ?,
          finished_quantity_kg = ?, electricity_method = ?, electricity_amount = ?,
          electricity_bill_id = ?, production_days = ?, fuel_cost = ?, packaging_cost = ?,
          other_direct_cost = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      production_date, description ?? null, sugarcane_consumed_tonnes, sugarcane_cost,
      finished_quantity_kg ?? null, electricity_method ?? 'fixed', electricity_amount ?? 0,
      electricity_bill_id ?? null, production_days ?? 1, fuel_cost ?? 0,
      packaging_cost ?? 0, other_direct_cost ?? 0, notes ?? null, nowIso(), id,
    );

    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
    res.json({ batch });
  } catch (err) {
    console.error('[production PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/production/:id/ingredients — set/replace ingredients for draft
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/ingredients', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!batch) { res.status(404).json({ error: 'Batch not found.' }); return; }
    if (batch.status !== 'draft') {
      res.status(400).json({ error: 'Can only set ingredients on draft batches.' }); return;
    }

    const { ingredients } = req.body as {
      ingredients?: {
        material_id: string; quantity: number; unit_cost: number;
      }[];
    };

    if (!ingredients || !Array.isArray(ingredients)) {
      res.status(400).json({ error: 'ingredients array is required.' }); return;
    }

    db.transaction(() => {
      // Clear existing ingredients
      db.prepare('DELETE FROM batch_ingredients WHERE batch_id = ?').run(id);

      let totalIngredientCost = 0;

      for (const ing of ingredients) {
        const mat = db
          .prepare('SELECT id, name, unit FROM raw_material_items WHERE id = ?')
          .get(ing.material_id) as { id: string; name: string; unit: string } | undefined;
        if (!mat) throw new Error(`Material ${ing.material_id} not found.`);

        const total_cost = round2(ing.quantity * ing.unit_cost);
        totalIngredientCost += total_cost;

        db.prepare(`
          INSERT INTO batch_ingredients
            (id, batch_id, material_id, material_name, quantity, unit, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), id, mat.id, mat.name, ing.quantity, mat.unit, ing.unit_cost, total_cost);
      }

      // Update total_ingredient_cost on the batch
      db.prepare('UPDATE production_batches SET total_ingredient_cost = ?, updated_at = ? WHERE id = ?')
        .run(round2(totalIngredientCost), nowIso(), id);
    })();

    const updatedBatch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
    const updatedIngredients = db.prepare('SELECT * FROM batch_ingredients WHERE batch_id = ?').all(id);
    res.json({ batch: updatedBatch, ingredients: updatedIngredients });
  } catch (err: unknown) {
    console.error('[production POST /:id/ingredients]', err);
    const msg = err instanceof Error ? err.message : 'Internal server error.';
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/production/:id/confirm — CONFIRM a batch (critical path)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!batch) { res.status(404).json({ error: 'Batch not found.' }); return; }
    if (batch.status !== 'draft') {
      res.status(400).json({ error: `Batch is already ${batch.status}.` }); return;
    }

    // ── Step 1: Validate finished_quantity_kg ─────────────────────────────
    const finishedQty = batch.finished_quantity_kg as number | null;
    if (!finishedQty || finishedQty <= 0) {
      res.status(400).json({ error: 'finished_quantity_kg must be set and > 0 before confirming.' });
      return;
    }

    const sugarcane_consumed = batch.sugarcane_consumed_tonnes as number;
    const production_date = batch.production_date as string;
    const production_days = batch.production_days as number;

    // ── Step 2: Check sugarcane stock ─────────────────────────────────────
    const scMat = db
      .prepare("SELECT id FROM raw_material_items WHERE is_sugarcane = 1 LIMIT 1")
      .get() as { id: string } | undefined;

    if (!scMat) {
      res.status(500).json({ error: 'Sugarcane raw material not configured.' }); return;
    }

    const scStock = getRawMaterialStock(scMat.id);
    if (scStock < sugarcane_consumed) {
      res.status(400).json({
        error: `Insufficient sugarcane stock. Available: ${scStock} tonnes, Required: ${sugarcane_consumed} tonnes.`,
      });
      return;
    }

    // ── Step 3: Check other ingredient stocks ─────────────────────────────
    const ingredients = db
      .prepare('SELECT * FROM batch_ingredients WHERE batch_id = ?')
      .all(id) as {
        id: string; material_id: string; material_name: string;
        quantity: number; unit: string; unit_cost: number; total_cost: number;
      }[];

    for (const ing of ingredients) {
      const stock = getRawMaterialStock(ing.material_id);
      if (stock < ing.quantity) {
        res.status(400).json({
          error: `Insufficient stock for ${ing.material_name}. Available: ${stock} ${ing.unit}, Required: ${ing.quantity} ${ing.unit}.`,
        });
        return;
      }
    }

    // ── Step 4: Compute costs ─────────────────────────────────────────────
    // Recalculate sugarcane cost using weighted average at this moment
    const scCostPerTonne = getSugarcaneCostPerTonne();
    const sugarcane_cost = round2(sugarcane_consumed * scCostPerTonne);

    const labourRate = batch.labour_rate_per_100kg as number;
    const labour_cost = round2((finishedQty / 100) * labourRate);

    // ── Step 5: Electricity amount ────────────────────────────────────────
    let electricity_amount = batch.electricity_amount as number;
    const electricity_method = batch.electricity_method as string;

    if (electricity_method === 'fixed') {
      // Use the value already set on the batch (manually entered)
      electricity_amount = electricity_amount ?? 0;
    } else if (electricity_method === 'per_day') {
      // electricity_amount stores per-day cost; multiply by production_days
      electricity_amount = round2(electricity_amount * production_days);
    } else if (electricity_method === 'bill_allocation') {
      // electricity_amount is already set via the allocation endpoint; leave as-is
    }

    const total_ingredient_cost = round2(ingredients.reduce((s, i) => s + i.total_cost, 0));
    const fuel_cost = batch.fuel_cost as number;
    const packaging_cost = batch.packaging_cost as number;
    const other_direct_cost = batch.other_direct_cost as number;

    // ── Step 6: Total direct cost ─────────────────────────────────────────
    const total_direct_cost = round2(
      sugarcane_cost + total_ingredient_cost + labour_cost +
      electricity_amount + fuel_cost + packaging_cost + other_direct_cost,
    );

    // ── Step 7: Yield percentage ──────────────────────────────────────────
    const yield_percentage = round2((finishedQty / (sugarcane_consumed * 1000)) * 100);

    // ── Step 11 (pre-step): Compute fixed overhead allocation ─────────────
    // Use year-month from production_date
    const yearMonth = production_date.slice(0, 7);
    const monthlyFixed = getMonthlyFixedExpenses(yearMonth);

    // Total confirmed kg for this month (including this batch once confirmed)
    const currentMonthKgRow = db
      .prepare(
        `SELECT COALESCE(SUM(finished_quantity_kg), 0) AS total_kg
         FROM production_batches
         WHERE status = 'confirmed'
           AND SUBSTR(production_date, 1, 7) = ?`,
      )
      .get(yearMonth) as { total_kg: number };

    const otherMonthKg = currentMonthKgRow.total_kg;
    const thisMonthTotalKg = otherMonthKg + finishedQty; // include this batch

    const allocated_overhead = thisMonthTotalKg > 0
      ? round2(monthlyFixed * (finishedQty / thisMonthTotalKg))
      : 0;

    // ── Step 12: Total cost and cost/kg ───────────────────────────────────
    const total_cost = round2(total_direct_cost + allocated_overhead);
    const cost_per_kg = round2(total_cost / finishedQty);
    const unit_cost_fg = round2(total_direct_cost / finishedQty); // for inventory valuation

    const now = nowIso();

    // ── Run everything in a single transaction ────────────────────────────
    db.transaction(() => {
      // ── Step 8: Deduct sugarcane ─────────────────────────────────────
      db.prepare(`
        INSERT INTO raw_material_movements
          (id, material_id, movement_date, movement_type, quantity, unit_cost, total_cost,
           reference_id, reference_type, notes, created_by, created_at)
        VALUES (?, ?, ?, 'production_consumption', ?, ?, ?, ?, 'batch', ?, ?, ?)
      `).run(
        uuidv4(), scMat.id, production_date,
        -sugarcane_consumed,          // negative = out
        scCostPerTonne, sugarcane_cost,
        id, `Batch ${batch.batch_number as string}`, req.user!.id, now,
      );

      // ── Step 9: Deduct each ingredient ─────────────────────────────
      for (const ing of ingredients) {
        db.prepare(`
          INSERT INTO raw_material_movements
            (id, material_id, movement_date, movement_type, quantity, unit_cost, total_cost,
             reference_id, reference_type, notes, created_by, created_at)
          VALUES (?, ?, ?, 'production_consumption', ?, ?, ?, ?, 'batch', ?, ?, ?)
        `).run(
          uuidv4(), ing.material_id, production_date,
          -ing.quantity,               // negative = out
          ing.unit_cost, ing.total_cost,
          id, `Batch ${batch.batch_number as string}`, req.user!.id, now,
        );
      }

      // ── Step 10: Add to finished goods ─────────────────────────────
      // Default to first active finished goods item (Jaggery Blocks)
      const fgItem = db
        .prepare("SELECT id FROM finished_goods_items WHERE is_active = 1 LIMIT 1")
        .get() as { id: string } | undefined;

      if (fgItem) {
        db.prepare(`
          INSERT INTO finished_goods_movements
            (id, item_id, batch_id, movement_date, movement_type, quantity,
             unit_cost, total_cost, reference_id, reference_type, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, 'production', ?, ?, ?, ?, 'batch', ?, ?, ?)
        `).run(
          uuidv4(), fgItem.id, id, production_date, finishedQty,
          unit_cost_fg,
          round2(unit_cost_fg * finishedQty),
          id, `Batch ${batch.batch_number as string}`, req.user!.id, now,
        );
      }

      // ── Update the batch record ─────────────────────────────────────
      db.prepare(`
        UPDATE production_batches
        SET sugarcane_cost = ?, labour_cost = ?, electricity_amount = ?,
            total_ingredient_cost = ?, total_direct_cost = ?,
            allocated_overhead = ?, total_cost = ?, cost_per_kg = ?,
            yield_percentage = ?, status = 'confirmed', updated_at = ?
        WHERE id = ?
      `).run(
        sugarcane_cost, labour_cost, electricity_amount,
        total_ingredient_cost, total_direct_cost,
        allocated_overhead, total_cost, cost_per_kg,
        yield_percentage, now, id,
      );
    })();

    auditLog(req.user!.id, req.user!.name, 'confirm', 'production_batch', id, {
      batchNumber: batch.batch_number,
      finished_quantity_kg: finishedQty,
      cost_per_kg,
      total_cost,
    });

    const confirmedBatch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
    res.json({ batch: confirmedBatch });
  } catch (err) {
    console.error('[production POST /:id/confirm]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/production/:id/cancel — cancel a batch and reverse movements
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!batch) { res.status(404).json({ error: 'Batch not found.' }); return; }
    if (batch.status === 'cancelled') {
      res.status(400).json({ error: 'Batch is already cancelled.' }); return;
    }

    const now = nowIso();

    if (batch.status === 'confirmed') {
      const finishedQty = batch.finished_quantity_kg as number;

      // Check if we have enough finished goods to reverse (may have been sold)
      const fgMovement = db
        .prepare("SELECT * FROM finished_goods_movements WHERE batch_id = ? AND movement_type = 'production' LIMIT 1")
        .get(id) as { item_id: string; quantity: number } | undefined;

      if (fgMovement) {
        const currentFgStock = getFinishedGoodsStock(fgMovement.item_id);
        if (currentFgStock < fgMovement.quantity) {
          res.status(400).json({
            error: `Cannot cancel: only ${currentFgStock} kg of finished goods remain in stock, but ${fgMovement.quantity} kg were produced by this batch and some may have been sold.`,
          });
          return;
        }
      }

      db.transaction(() => {
        // Reverse all raw material movements for this batch
        const rawMovements = db
          .prepare("SELECT * FROM raw_material_movements WHERE reference_id = ? AND reference_type = 'batch'")
          .all(id) as { id: string; material_id: string; quantity: number; unit_cost: number; total_cost: number }[];

        for (const mv of rawMovements) {
          // Insert a reversal movement (negate the quantity)
          db.prepare(`
            INSERT INTO raw_material_movements
              (id, material_id, movement_date, movement_type, quantity, unit_cost, total_cost,
               reference_id, reference_type, notes, created_by, created_at)
            VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, 'batch_cancellation', ?, ?, ?)
          `).run(
            uuidv4(), mv.material_id, today(),
            -mv.quantity,              // reverse the movement
            mv.unit_cost, mv.total_cost ? -mv.total_cost : null,
            id, `Reversal: batch ${batch.batch_number as string} cancelled`, req.user!.id, now,
          );
        }

        // Reverse finished goods movement
        if (fgMovement) {
          db.prepare(`
            INSERT INTO finished_goods_movements
              (id, item_id, batch_id, movement_date, movement_type, quantity, unit_cost, total_cost,
               reference_id, reference_type, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, 'adjustment', ?, NULL, NULL, ?, 'batch_cancellation', ?, ?, ?)
          `).run(
            uuidv4(), fgMovement.item_id, id, today(),
            -fgMovement.quantity,
            id, `Reversal: batch ${batch.batch_number as string} cancelled`, req.user!.id, now,
          );
        }

        db.prepare("UPDATE production_batches SET status = 'cancelled', updated_at = ? WHERE id = ?")
          .run(now, id);
      })();
    } else {
      // Draft — just cancel
      db.prepare("UPDATE production_batches SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .run(now, id);
    }

    auditLog(req.user!.id, req.user!.name, 'cancel', 'production_batch', id, {
      batchNumber: batch.batch_number,
    });
    res.json({ message: 'Batch cancelled and movements reversed.' });
  } catch (err) {
    console.error('[production POST /:id/cancel]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
