/**
 * sales.ts (routes)
 * Sales management: CRUD, confirmation with COGS, payments, invoice data.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import {
  nowIso, round2, auditLog, generateInvoiceNumber,
  getFinishedGoodsStock, getFinishedGoodsWeightedAvgCost,
} from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sales
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { customer_id, from, to, status, payment_status } = req.query as {
      customer_id?: string; from?: string; to?: string;
      status?: string; payment_status?: string;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (customer_id) { conditions.push('s.customer_id = ?'); params.push(customer_id); }
    if (from) { conditions.push('s.sale_date >= ?'); params.push(from); }
    if (to)   { conditions.push('s.sale_date <= ?'); params.push(to); }
    if (status) { conditions.push('s.status = ?'); params.push(status); }
    if (payment_status) { conditions.push('s.payment_status = ?'); params.push(payment_status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sales = db
      .prepare(
        `SELECT s.*, c.name AS customer_name
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         ${where}
         ORDER BY s.sale_date DESC`,
      )
      .all(...params);

    res.json({ sales });
  } catch (err) {
    console.error('[sales GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sales — create draft sale
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      sale_date, customer_id, item_id, quantity_kg, price_per_kg,
      discount = 0, tax_amount = 0, delivery_charges = 0,
      payment_method, notes,
    } = req.body as {
      sale_date?: string; customer_id?: string; item_id?: string;
      quantity_kg?: number; price_per_kg?: number;
      discount?: number; tax_amount?: number; delivery_charges?: number;
      payment_method?: string; notes?: string;
    };

    if (!sale_date) { res.status(400).json({ error: 'sale_date is required.' }); return; }
    if (!item_id) { res.status(400).json({ error: 'item_id is required.' }); return; }
    if (!quantity_kg || quantity_kg <= 0) {
      res.status(400).json({ error: 'quantity_kg must be > 0.' }); return;
    }
    if (!price_per_kg || price_per_kg <= 0) {
      res.status(400).json({ error: 'price_per_kg must be > 0.' }); return;
    }

    const db = getDb();
    const fgItem = db.prepare('SELECT * FROM finished_goods_items WHERE id = ?').get(item_id) as
      | { id: string; name: string } | undefined;
    if (!fgItem) { res.status(404).json({ error: 'Finished goods item not found.' }); return; }

    const subtotal = round2(quantity_kg * price_per_kg);
    const invoice_total = round2(subtotal - (discount ?? 0) + (tax_amount ?? 0) + (delivery_charges ?? 0));

    const now = nowIso();
    const id = uuidv4();
    const invoiceNumber = generateInvoiceNumber();

    db.prepare(`
      INSERT INTO sales
        (id, invoice_number, sale_date, customer_id, item_id, item_name,
         quantity_kg, price_per_kg, subtotal, discount, tax_amount, delivery_charges,
         invoice_total, amount_paid, payment_status, payment_method, cost_of_goods_sold,
         status, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, NULL, 'draft', ?, ?, ?, ?)
    `).run(
      id, invoiceNumber, sale_date, customer_id ?? null, item_id, fgItem.name,
      quantity_kg, price_per_kg, subtotal, discount, tax_amount, delivery_charges,
      invoice_total, payment_method ?? null, notes ?? null, req.user!.id, now, now,
    );

    auditLog(req.user!.id, req.user!.name, 'create', 'sale', id, { invoiceNumber, quantity_kg, invoice_total });
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    res.status(201).json({ sale });
  } catch (err) {
    console.error('[sales POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sales/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const sale = db
      .prepare(
        `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone,
                c.address AS customer_address, c.gstin AS customer_gstin
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.id = ?`,
      )
      .get(id);
    if (!sale) { res.status(404).json({ error: 'Sale not found.' }); return; }

    const payments = db
      .prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY payment_date ASC')
      .all(id);

    const fgMovement = db
      .prepare("SELECT * FROM finished_goods_movements WHERE reference_id = ? AND reference_type = 'sale'")
      .get(id);

    res.json({ sale, payments, fgMovement });
  } catch (err) {
    console.error('[sales GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/sales/:id — update draft sale
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Sale not found.' }); return; }
    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft sales can be updated.' }); return;
    }

    const {
      sale_date, customer_id, item_id, quantity_kg, price_per_kg,
      discount = 0, tax_amount = 0, delivery_charges = 0, payment_method, notes,
    } = req.body as {
      sale_date?: string; customer_id?: string; item_id?: string;
      quantity_kg?: number; price_per_kg?: number;
      discount?: number; tax_amount?: number; delivery_charges?: number;
      payment_method?: string; notes?: string;
    };

    if (!sale_date) { res.status(400).json({ error: 'sale_date is required.' }); return; }
    if (!item_id) { res.status(400).json({ error: 'item_id is required.' }); return; }
    if (!quantity_kg || quantity_kg <= 0) {
      res.status(400).json({ error: 'quantity_kg must be > 0.' }); return;
    }
    if (!price_per_kg || price_per_kg <= 0) {
      res.status(400).json({ error: 'price_per_kg must be > 0.' }); return;
    }

    const fgItem = db.prepare('SELECT * FROM finished_goods_items WHERE id = ?').get(item_id) as
      | { id: string; name: string } | undefined;
    if (!fgItem) { res.status(404).json({ error: 'Finished goods item not found.' }); return; }

    const subtotal = round2(quantity_kg * price_per_kg);
    const invoice_total = round2(subtotal - (discount ?? 0) + (tax_amount ?? 0) + (delivery_charges ?? 0));

    db.prepare(`
      UPDATE sales
      SET sale_date = ?, customer_id = ?, item_id = ?, item_name = ?,
          quantity_kg = ?, price_per_kg = ?, subtotal = ?, discount = ?,
          tax_amount = ?, delivery_charges = ?, invoice_total = ?,
          payment_method = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      sale_date, customer_id ?? null, item_id, fgItem.name,
      quantity_kg, price_per_kg, subtotal, discount, tax_amount, delivery_charges,
      invoice_total, payment_method ?? null, notes ?? null, nowIso(), id,
    );

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    res.json({ sale });
  } catch (err) {
    console.error('[sales PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sales/:id/confirm
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!sale) { res.status(404).json({ error: 'Sale not found.' }); return; }
    if (sale.status !== 'draft') {
      res.status(400).json({ error: `Sale is already ${sale.status}.` }); return;
    }

    const itemId = sale.item_id as string;
    const quantityKg = sale.quantity_kg as number;

    // ── Step 1: Check finished goods stock ────────────────────────────────
    const currentStock = getFinishedGoodsStock(itemId);
    if (currentStock < quantityKg) {
      res.status(400).json({
        error: `Insufficient stock. Available: ${currentStock} kg, Required: ${quantityKg} kg.`,
      });
      return;
    }

    // ── Step 2: COGS using weighted average ───────────────────────────────
    const avgCostPerKg = getFinishedGoodsWeightedAvgCost(itemId);
    const cogs = round2(quantityKg * avgCostPerKg);

    const now = nowIso();

    db.transaction(() => {
      // ── Step 3: Deduct finished goods stock ───────────────────────────
      db.prepare(`
        INSERT INTO finished_goods_movements
          (id, item_id, batch_id, movement_date, movement_type, quantity,
           unit_cost, total_cost, reference_id, reference_type, notes, created_by, created_at)
        VALUES (?, ?, NULL, ?, 'sale', ?, ?, ?, ?, 'sale', ?, ?, ?)
      `).run(
        uuidv4(), itemId, sale.sale_date as string,
        -quantityKg,                // negative = out
        avgCostPerKg, cogs,
        id, `Invoice ${sale.invoice_number as string}`, req.user!.id, now,
      );

      // ── Step 4: Update sale ────────────────────────────────────────────
      db.prepare(`
        UPDATE sales
        SET cost_of_goods_sold = ?, status = 'confirmed', updated_at = ?
        WHERE id = ?
      `).run(cogs, now, id);
    })();

    auditLog(req.user!.id, req.user!.name, 'confirm', 'sale', id, {
      invoice_number: sale.invoice_number,
      quantity_kg: quantityKg,
      cogs,
    });

    const confirmedSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    res.json({ sale: confirmedSale });
  } catch (err) {
    console.error('[sales POST /:id/confirm]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sales/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!sale) { res.status(404).json({ error: 'Sale not found.' }); return; }
    if (sale.status === 'cancelled') {
      res.status(400).json({ error: 'Sale is already cancelled.' }); return;
    }

    const now = nowIso();

    if (sale.status === 'confirmed') {
      const fgMovement = db
        .prepare("SELECT * FROM finished_goods_movements WHERE reference_id = ? AND reference_type = 'sale'")
        .get(id) as { id: string; item_id: string; quantity: number; unit_cost: number } | undefined;

      db.transaction(() => {
        if (fgMovement) {
          // Reverse the sale movement
          db.prepare(`
            INSERT INTO finished_goods_movements
              (id, item_id, batch_id, movement_date, movement_type, quantity,
               unit_cost, total_cost, reference_id, reference_type, notes, created_by, created_at)
            VALUES (?, ?, NULL, ?, 'return', ?, ?, ?, ?, 'sale_cancellation', ?, ?, ?)
          `).run(
            uuidv4(), fgMovement.item_id, sale.sale_date as string,
            -fgMovement.quantity,     // reverse: negative of negative = positive
            fgMovement.unit_cost, round2(-fgMovement.quantity * fgMovement.unit_cost),
            id, `Reversal: invoice ${sale.invoice_number as string} cancelled`, req.user!.id, now,
          );
        }
        db.prepare("UPDATE sales SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, id);
      })();
    } else {
      // Draft — just cancel
      db.prepare("UPDATE sales SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, id);
    }

    auditLog(req.user!.id, req.user!.name, 'cancel', 'sale', id, { invoice_number: sale.invoice_number });
    res.json({ message: 'Sale cancelled.' });
  } catch (err) {
    console.error('[sales POST /:id/cancel]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/sales/:id/payment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/payment', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
      | Record<string, unknown> | undefined;
    if (!sale) { res.status(404).json({ error: 'Sale not found.' }); return; }
    if (sale.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot record payment on a cancelled sale.' }); return;
    }

    const { payment_date, amount, payment_method, notes } = req.body as {
      payment_date?: string; amount?: number; payment_method?: string; notes?: string;
    };

    if (!payment_date) { res.status(400).json({ error: 'payment_date is required.' }); return; }
    if (!amount || amount <= 0) { res.status(400).json({ error: 'amount must be > 0.' }); return; }

    const now = nowIso();
    const paymentId = uuidv4();

    const paidRow = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM sale_payments WHERE sale_id = ?')
      .get(id) as { total: number };

    const newTotalPaid = round2(paidRow.total + amount);
    const invoiceTotal = sale.invoice_total as number;

    let paymentStatus = 'partial';
    if (newTotalPaid >= invoiceTotal) paymentStatus = 'paid';
    if (newTotalPaid <= 0) paymentStatus = 'unpaid';

    db.transaction(() => {
      db.prepare(`
        INSERT INTO sale_payments
          (id, sale_id, payment_date, amount, payment_method, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(paymentId, id, payment_date, amount, payment_method ?? null, notes ?? null, req.user!.id, now);

      db.prepare(`
        UPDATE sales SET amount_paid = ?, payment_status = ?, updated_at = ? WHERE id = ?
      `).run(newTotalPaid, paymentStatus, now, id);
    })();

    auditLog(req.user!.id, req.user!.name, 'payment', 'sale', id, { amount, paymentStatus });
    const payment = db.prepare('SELECT * FROM sale_payments WHERE id = ?').get(paymentId);
    res.status(201).json({ payment, payment_status: paymentStatus, total_paid: newTotalPaid });
  } catch (err) {
    console.error('[sales POST /:id/payment]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/sales/:id/invoice — invoice data for printing
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/invoice', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const sale = db
      .prepare(
        `SELECT s.*,
                c.name AS customer_name, c.business_name AS customer_business,
                c.phone AS customer_phone, c.email AS customer_email,
                c.address AS customer_address, c.gstin AS customer_gstin
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!sale) { res.status(404).json({ error: 'Sale not found.' }); return; }

    const payments = db
      .prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY payment_date ASC')
      .all(id);

    const businessSetting = db
      .prepare("SELECT value FROM settings WHERE key = 'business_name'")
      .get() as { value: string } | undefined;

    const totalPaid = payments.reduce((s: number, p: Record<string, unknown>) => s + (p.amount as number), 0);
    const balanceDue = round2((sale.invoice_total as number) - totalPaid);

    res.json({
      invoice: {
        ...sale,
        total_paid: round2(totalPaid),
        balance_due: balanceDue,
        payments,
        business_name: businessSetting?.value ?? 'SweetHarvest',
      },
    });
  } catch (err) {
    console.error('[sales GET /:id/invoice]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
