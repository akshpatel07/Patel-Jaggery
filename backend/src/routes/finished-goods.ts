/**
 * finished-goods.ts (routes)
 * Finished goods inventory: stock levels, movement history, adjustments.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  nowIso, round2, auditLog,
  getFinishedGoodsStock, getFinishedGoodsWeightedAvgCost,
} from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/finished-goods/stock — current stock levels
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const items = db
      .prepare('SELECT * FROM finished_goods_items WHERE is_active = 1 ORDER BY name ASC')
      .all() as { id: string; name: string; unit: string }[];

    const stock = items.map((item) => {
      const currentStock = getFinishedGoodsStock(item.id);
      const avgCost = getFinishedGoodsWeightedAvgCost(item.id);
      return {
        ...item,
        current_stock: currentStock,
        avg_cost_per_unit: avgCost,
        stock_value: round2(currentStock * avgCost),
      };
    });

    res.json({ stock });
  } catch (err) {
    console.error('[finished-goods GET /stock]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/finished-goods — list items with current stock and value
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { active } = req.query;
    const where = active === 'false' ? '' : 'WHERE is_active = 1';

    const items = db
      .prepare(`SELECT * FROM finished_goods_items ${where} ORDER BY name ASC`)
      .all() as { id: string; name: string; unit: string; is_active: number }[];

    const enriched = items.map((item) => {
      const currentStock = getFinishedGoodsStock(item.id);
      const avgCost = getFinishedGoodsWeightedAvgCost(item.id);
      return {
        ...item,
        current_stock: currentStock,
        avg_cost_per_unit: avgCost,
        stock_value: round2(currentStock * avgCost),
      };
    });

    res.json({ items: enriched });
  } catch (err) {
    console.error('[finished-goods GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/finished-goods/movements
// ─────────────────────────────────────────────────────────────────────────────
router.get('/movements', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to, type } = req.query as { from?: string; to?: string; type?: string };
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (from) { conditions.push('m.movement_date >= ?'); params.push(from); }
    if (to) { conditions.push('m.movement_date <= ?'); params.push(to); }
    if (type) { conditions.push('m.movement_type = ?'); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const movements = db.prepare(`
      SELECT m.*, i.name AS item_name
      FROM finished_goods_movements m
      JOIN finished_goods_items i ON i.id = m.item_id
      ${where}
      ORDER BY m.movement_date DESC, m.created_at DESC
    `).all(...params);
    res.json({ movements });
  } catch (err) {
    console.error('[finished-goods GET /movements]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/finished-goods/:id/movements
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/movements', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { from, to, type } = req.query as { from?: string; to?: string; type?: string };

    const item = db.prepare('SELECT * FROM finished_goods_items WHERE id = ?').get(id);
    if (!item) { res.status(404).json({ error: 'Item not found.' }); return; }

    const conditions: string[] = ['item_id = ?'];
    const params: unknown[] = [id];
    if (from) { conditions.push('movement_date >= ?'); params.push(from); }
    if (to)   { conditions.push('movement_date <= ?'); params.push(to); }
    if (type) { conditions.push('movement_type = ?'); params.push(type); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const movements = db
      .prepare(`SELECT * FROM finished_goods_movements ${where} ORDER BY movement_date DESC, created_at DESC`)
      .all(...params);

    res.json({ item, movements, current_stock: getFinishedGoodsStock(id as string) });
  } catch (err) {
    console.error('[finished-goods GET /:id/movements]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/finished-goods/adjustment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adjustment', requireRole('owner', 'production_manager'), (req: Request, res: Response): void => {
  try {
    const { item_id, movement_date, quantity, movement_type, unit_cost, notes } = req.body as {
      item_id?: string; movement_date?: string; quantity?: number;
      movement_type?: string; unit_cost?: number; notes?: string;
    };

    if (!item_id) { res.status(400).json({ error: 'item_id is required.' }); return; }
    if (!movement_date) { res.status(400).json({ error: 'movement_date is required.' }); return; }
    if (quantity === undefined || quantity === null) {
      res.status(400).json({ error: 'quantity is required.' }); return;
    }

    const allowedTypes = ['adjustment', 'damage', 'return'];
    const mvtType = movement_type ?? 'adjustment';
    if (!allowedTypes.includes(mvtType)) {
      res.status(400).json({ error: `movement_type must be one of: ${allowedTypes.join(', ')}` });
      return;
    }

    const db = getDb();
    const item = db.prepare('SELECT * FROM finished_goods_items WHERE id = ?').get(item_id);
    if (!item) { res.status(404).json({ error: 'Finished goods item not found.' }); return; }

    const id = uuidv4();
    const now = nowIso();
    const total_cost = unit_cost !== undefined ? round2(Math.abs(quantity) * unit_cost) : null;

    db.prepare(`
      INSERT INTO finished_goods_movements
        (id, item_id, batch_id, movement_date, movement_type, quantity,
         unit_cost, total_cost, reference_id, reference_type, notes, created_by, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, NULL, 'adjustment', ?, ?, ?)
    `).run(id, item_id, movement_date, mvtType, quantity, unit_cost ?? null, total_cost, notes ?? null, req.user!.id, now);

    auditLog(req.user!.id, req.user!.name, 'adjustment', 'finished_goods', item_id, { quantity, mvtType });
    const movement = db.prepare('SELECT * FROM finished_goods_movements WHERE id = ?').get(id);
    res.status(201).json({ movement, current_stock: getFinishedGoodsStock(item_id) });
  } catch (err) {
    console.error('[finished-goods POST /adjustment]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
