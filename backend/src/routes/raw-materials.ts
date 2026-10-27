/**
 * raw-materials.ts (routes)
 * Raw material items, stock levels, and movement history.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog, getRawMaterialStock } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/raw-materials/stock  — current stock for all items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const items = db
      .prepare('SELECT * FROM raw_material_items WHERE is_active = 1 ORDER BY name ASC')
      .all() as { id: string; name: string; unit: string; min_stock_level: number }[];

    const stock = items.map((item) => ({
      ...item,
      current_stock: getRawMaterialStock(item.id),
      below_min: getRawMaterialStock(item.id) < item.min_stock_level,
    }));

    res.json({ stock });
  } catch (err) {
    console.error('[raw-materials GET /stock]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/raw-materials — list items with current stock
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { active } = req.query;
    const where = active === 'false' ? '' : 'WHERE is_active = 1';

    const items = db
      .prepare(`SELECT * FROM raw_material_items ${where} ORDER BY name ASC`)
      .all() as { id: string; name: string; unit: string; min_stock_level: number; is_active: number }[];

    const enriched = items.map((item) => ({
      ...item,
      current_stock: getRawMaterialStock(item.id),
    }));

    res.json({ items: enriched });
  } catch (err) {
    console.error('[raw-materials GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/raw-materials — create item
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireRole('owner', 'production_manager'), (req: Request, res: Response): void => {
  try {
    const { name, unit, is_sugarcane, min_stock_level } = req.body as {
      name?: string; unit?: string; is_sugarcane?: boolean; min_stock_level?: number;
    };

    if (!name?.trim()) { res.status(400).json({ error: 'name is required.' }); return; }
    if (!unit?.trim()) { res.status(400).json({ error: 'unit is required.' }); return; }

    const db = getDb();
    const id = uuidv4();
    const now = nowIso();

    db.prepare(`
      INSERT INTO raw_material_items (id, name, unit, is_sugarcane, min_stock_level, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, name.trim(), unit.trim(), is_sugarcane ? 1 : 0, min_stock_level ?? 0, now);

    const item = db.prepare('SELECT * FROM raw_material_items WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'create', 'raw_material_item', id, { name });
    res.status(201).json({ item });
  } catch (err) {
    console.error('[raw-materials POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/raw-materials/:id — update item
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('owner', 'production_manager'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM raw_material_items WHERE id = ?').get(id);
    if (!existing) { res.status(404).json({ error: 'Raw material not found.' }); return; }

    const { name, unit, min_stock_level, is_active } = req.body as {
      name?: string; unit?: string; min_stock_level?: number; is_active?: boolean;
    };

    if (!name?.trim()) { res.status(400).json({ error: 'name is required.' }); return; }
    if (!unit?.trim()) { res.status(400).json({ error: 'unit is required.' }); return; }

    db.prepare(`
      UPDATE raw_material_items
      SET name = ?, unit = ?, min_stock_level = ?, is_active = ?
      WHERE id = ?
    `).run(name.trim(), unit.trim(), min_stock_level ?? 0, is_active !== false ? 1 : 0, id);

    const item = db.prepare('SELECT * FROM raw_material_items WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'update', 'raw_material_item', id, { name });
    res.json({ item });
  } catch (err) {
    console.error('[raw-materials PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/raw-materials/movements — movement history
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
      SELECT m.*, i.name AS material_name
      FROM raw_material_movements m
      JOIN raw_material_items i ON i.id = m.material_id
      ${where}
      ORDER BY m.movement_date DESC, m.created_at DESC
    `).all(...params);
    res.json({ movements });
  } catch (err) {
    console.error('[raw-materials GET /movements]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/raw-materials/:id/movements — movement history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/movements', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { from, to, type } = req.query as { from?: string; to?: string; type?: string };

    const item = db.prepare('SELECT * FROM raw_material_items WHERE id = ?').get(id);
    if (!item) { res.status(404).json({ error: 'Raw material not found.' }); return; }

    const conditions: string[] = ['material_id = ?'];
    const params: unknown[] = [id];
    if (from) { conditions.push('movement_date >= ?'); params.push(from); }
    if (to)   { conditions.push('movement_date <= ?'); params.push(to); }
    if (type) { conditions.push('movement_type = ?'); params.push(type); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const movements = db
      .prepare(`SELECT * FROM raw_material_movements ${where} ORDER BY movement_date DESC, created_at DESC`)
      .all(...params);

    const currentStock = getRawMaterialStock(id as string);
    res.json({ item, movements, current_stock: currentStock });
  } catch (err) {
    console.error('[raw-materials GET /:id/movements]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/raw-materials/adjustment — manual stock adjustment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adjustment', requireRole('owner', 'production_manager'), (req: Request, res: Response): void => {
  try {
    const { material_id, movement_date, quantity, unit_cost, movement_type, notes } = req.body as {
      material_id?: string; movement_date?: string; quantity?: number;
      unit_cost?: number; movement_type?: string; notes?: string;
    };

    if (!material_id) { res.status(400).json({ error: 'material_id is required.' }); return; }
    if (!movement_date) { res.status(400).json({ error: 'movement_date is required.' }); return; }
    if (quantity === undefined || quantity === null) {
      res.status(400).json({ error: 'quantity is required.' }); return;
    }

    const allowedTypes = ['adjustment', 'return', 'wastage'];
    const mvtType = movement_type ?? 'adjustment';
    if (!allowedTypes.includes(mvtType)) {
      res.status(400).json({ error: `movement_type must be one of: ${allowedTypes.join(', ')}` });
      return;
    }

    const db = getDb();
    const item = db.prepare('SELECT * FROM raw_material_items WHERE id = ?').get(material_id);
    if (!item) { res.status(404).json({ error: 'Raw material not found.' }); return; }

    const id = uuidv4();
    const now = nowIso();
    const total_cost = unit_cost !== undefined ? round2(Math.abs(quantity) * unit_cost) : null;

    db.prepare(`
      INSERT INTO raw_material_movements
        (id, material_id, movement_date, movement_type, quantity, unit_cost, total_cost,
         reference_id, reference_type, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'adjustment', ?, ?, ?)
    `).run(id, material_id, movement_date, mvtType, quantity, unit_cost ?? null, total_cost, notes ?? null, req.user!.id, now);

    auditLog(req.user!.id, req.user!.name, 'adjustment', 'raw_material', material_id, { quantity, mvtType });
    const movement = db.prepare('SELECT * FROM raw_material_movements WHERE id = ?').get(id);
    res.status(201).json({ movement, current_stock: getRawMaterialStock(material_id) });
  } catch (err) {
    console.error('[raw-materials POST /adjustment]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
