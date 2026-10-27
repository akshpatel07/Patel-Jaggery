/**
 * customers.ts (routes)
 * CRUD for customers, outstanding balance, and customer statements.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { nowIso, round2, auditLog } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/customers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { active } = req.query;
    const whereClause = active === 'false' ? '' : 'WHERE c.is_active = 1';

    const customers = db
      .prepare(
        `SELECT c.*,
           COALESCE(SUM(s.invoice_total), 0)
             - COALESCE(SUM(sp.amount), 0)
             + c.opening_balance AS outstanding_balance,
           COUNT(DISTINCT s.id) AS total_sales
         FROM customers c
         LEFT JOIN sales s
           ON s.customer_id = c.id AND s.status = 'confirmed'
         LEFT JOIN sale_payments sp ON sp.sale_id = s.id
         ${whereClause}
         GROUP BY c.id
         ORDER BY c.name ASC`,
      )
      .all() as Record<string, unknown>[];

    res.json({ customers });
  } catch (err) {
    console.error('[customers GET /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/customers
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const {
      name, business_name, phone, email, address,
      gstin, credit_terms_days, opening_balance, notes,
    } = req.body as {
      name?: string; business_name?: string; phone?: string; email?: string;
      address?: string; gstin?: string; credit_terms_days?: number;
      opening_balance?: number; notes?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }

    const db = getDb();
    const now = nowIso();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO customers
        (id, name, business_name, phone, email, address, gstin,
         credit_terms_days, opening_balance, notes, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id, name.trim(), business_name?.trim() ?? null, phone?.trim() ?? null,
      email?.trim() ?? null, address?.trim() ?? null, gstin?.trim() ?? null,
      credit_terms_days ?? 0, opening_balance ?? 0, notes?.trim() ?? null, now, now,
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'create', 'customer', id, { name });
    res.status(201).json({ customer });
  } catch (err) {
    console.error('[customers POST /]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const sales = db
      .prepare(
        `SELECT s.*, COALESCE(SUM(sp.amount), 0) AS amount_paid_total
         FROM sales s
         LEFT JOIN sale_payments sp ON sp.sale_id = s.id
         WHERE s.customer_id = ?
         GROUP BY s.id
         ORDER BY s.sale_date DESC`,
      )
      .all(id);

    const payments = db
      .prepare(
        `SELECT sp.* FROM sale_payments sp
         JOIN sales s ON sp.sale_id = s.id
         WHERE s.customer_id = ?
         ORDER BY sp.payment_date DESC`,
      )
      .all(id);

    res.json({ customer, sales, payments });
  } catch (err) {
    console.error('[customers GET /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireRole('owner', 'accountant'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const {
      name, business_name, phone, email, address,
      gstin, credit_terms_days, opening_balance, notes,
    } = req.body as {
      name?: string; business_name?: string; phone?: string; email?: string;
      address?: string; gstin?: string; credit_terms_days?: number;
      opening_balance?: number; notes?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }

    db.prepare(`
      UPDATE customers
      SET name = ?, business_name = ?, phone = ?, email = ?, address = ?,
          gstin = ?, credit_terms_days = ?, opening_balance = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name.trim(), business_name?.trim() ?? null, phone?.trim() ?? null,
      email?.trim() ?? null, address?.trim() ?? null, gstin?.trim() ?? null,
      credit_terms_days ?? 0, opening_balance ?? 0, notes?.trim() ?? null, nowIso(), id,
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    auditLog(req.user!.id, req.user!.name, 'update', 'customer', id, { name });
    res.json({ customer });
  } catch (err) {
    console.error('[customers PUT /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/customers/:id  (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('owner'), (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    db.prepare('UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
    auditLog(req.user!.id, req.user!.name, 'deactivate', 'customer', id, {});
    res.json({ message: 'Customer deactivated.' });
  } catch (err) {
    console.error('[customers DELETE /:id]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/customers/:id/statement
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/statement', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    let dateFilter = '';
    const params: (string | undefined)[] = [id];
    if (from) { dateFilter += ' AND s.sale_date >= ?'; params.push(from); }
    if (to)   { dateFilter += ' AND s.sale_date <= ?'; params.push(to); }

    const invoices = db
      .prepare(
        `SELECT s.id, s.invoice_number, s.sale_date, s.invoice_total,
                COALESCE(SUM(sp.amount), 0) AS amount_paid,
                s.invoice_total - COALESCE(SUM(sp.amount), 0) AS balance_due,
                s.payment_status, s.status
         FROM sales s
         LEFT JOIN sale_payments sp ON sp.sale_id = s.id
         WHERE s.customer_id = ? AND s.status = 'confirmed'
         ${dateFilter}
         GROUP BY s.id
         ORDER BY s.sale_date ASC`,
      )
      .all(...params) as Record<string, unknown>[];

    const totals = invoices.reduce(
      (acc: { total_invoiced: number; total_paid: number; total_outstanding: number }, inv: any) => {
        acc.total_invoiced += (inv.invoice_total as number) ?? 0;
        acc.total_paid += (inv.amount_paid as number) ?? 0;
        acc.total_outstanding += (inv.balance_due as number) ?? 0;
        return acc;
      },
      { total_invoiced: 0, total_paid: 0, total_outstanding: 0 },
    );

    res.json({
      customer,
      invoices,
      summary: {
        ...totals,
        opening_balance: customer.opening_balance,
        net_outstanding: round2(
          (totals.total_outstanding as number) + (customer.opening_balance as number),
        ),
      },
    });
  } catch (err) {
    console.error('[customers GET /:id/statement]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
