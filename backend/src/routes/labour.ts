/**
 * labour.ts (routes)
 * Labour rate management and labour cost reports.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { nowIso, today, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/labour/rates
// ─────────────────────────────────────────────────────────────────────────────
router.get('/rates', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const rates = db
      .prepare('SELECT * FROM labour_rates ORDER BY effective_date DESC')
      .all();
    res.json({ rates });
  } catch (err) {
    console.error('[labour GET /rates]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/labour/rates
// ─────────────────────────────────────────────────────────────────────────────
router.post('/rates', (req: Request, res: Response): void => {
  try {
    const { rate_per_100kg, effective_date, notes } = req.body as {
      rate_per_100kg?: number; effective_date?: string; notes?: string;
    };

    if (!rate_per_100kg || rate_per_100kg <= 0) {
      res.status(400).json({ error: 'rate_per_100kg must be > 0.' }); return;
    }
    if (!effective_date) {
      res.status(400).json({ error: 'effective_date is required.' }); return;
    }

    const db = getDb();
    const id = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO labour_rates (id, rate_per_100kg, effective_date, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, rate_per_100kg, effective_date, notes ?? null, req.user!.id, now);

    auditLog(req.user!.id, req.user!.name, 'create', 'labour_rate', id, { rate_per_100kg, effective_date });
    const rate = db.prepare('SELECT * FROM labour_rates WHERE id = ?').get(id);
    res.status(201).json({ rate });
  } catch (err) {
    console.error('[labour POST /rates]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/labour/current-rate
// ─────────────────────────────────────────────────────────────────────────────
router.get('/current-rate', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { date } = req.query as { date?: string };
    const asOf = date ?? today();

    const rate = db
      .prepare(
        `SELECT * FROM labour_rates
         WHERE effective_date <= ?
         ORDER BY effective_date DESC
         LIMIT 1`,
      )
      .get(asOf);

    if (!rate) {
      res.status(404).json({ error: 'No labour rate defined.' });
      return;
    }
    res.json({ rate });
  } catch (err) {
    console.error('[labour GET /current-rate]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/labour/reports
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('production_date >= ?'); params.push(from); }
    if (to)   { conditions.push('production_date <= ?'); params.push(to); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    // Per-batch labour costs
    const batches = db
      .prepare(
        `SELECT batch_number, production_date, finished_quantity_kg,
                labour_rate_per_100kg, labour_cost,
                ROUND(labour_cost / NULLIF(finished_quantity_kg, 0), 2) AS labour_per_kg
         FROM production_batches
         ${where}
         ORDER BY production_date DESC`,
      )
      .all(...params) as Record<string, unknown>[];

    // Monthly aggregation
    const monthly = db
      .prepare(
        `SELECT SUBSTR(production_date, 1, 7) AS month,
                SUM(finished_quantity_kg) AS total_kg,
                SUM(labour_cost) AS total_labour_cost,
                ROUND(SUM(labour_cost) / NULLIF(SUM(finished_quantity_kg), 0), 2) AS avg_labour_per_kg
         FROM production_batches
         ${where}
         GROUP BY month
         ORDER BY month DESC`,
      )
      .all(...params);

    const totals = batches.reduce(
      (acc: { total_quantity_kg: number; total_labour_cost: number }, b: any) => {
        acc.total_quantity_kg += (b.finished_quantity_kg as number) ?? 0;
        acc.total_labour_cost += (b.labour_cost as number) ?? 0;
        return acc;
      },
      { total_quantity_kg: 0, total_labour_cost: 0 },
    );

    res.json({
      batches,
      monthly,
      totals: {
        ...totals,
        avg_labour_per_kg: totals.total_quantity_kg > 0
          ? round2(totals.total_labour_cost / totals.total_quantity_kg)
          : 0,
      },
    });
  } catch (err) {
    console.error('[labour GET /reports]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
