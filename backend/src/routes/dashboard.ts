/**
 * dashboard.ts (routes)
 * Aggregates real-time business KPIs, chart series, and active business alerts.
 * Strictly calculates all metrics from recorded transactions (no dummy data).
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { round2 } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

function getDateRange(period?: string, from?: string, to?: string): { start: string; end: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (period === 'today') {
    return { start: todayStr, end: todayStr };
  } else if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const startOfWeek = new Date(now.setDate(diff)).toISOString().slice(0, 10);
    return { start: startOfWeek, end: todayStr };
  } else if (period === 'month') {
    const startOfMonth = `${todayStr.slice(0, 7)}-01`;
    return { start: startOfMonth, end: todayStr };
  } else if (period === 'year') {
    // Indian Financial Year: April 1 to March 31
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    return { start: `${startYear}-04-01`, end: todayStr };
  } else if (from && to) {
    return { start: from, end: to };
  }

  // Default to this month
  const startOfMonth = `${todayStr.slice(0, 7)}-01`;
  return { start: startOfMonth, end: todayStr };
}

// GET /api/dashboard/summary
router.get('/summary', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    // 1. Sugarcane purchased in period
    const purchaseRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(quantity_tonnes), 0)   AS tonnes,
           COALESCE(SUM(total_landed_cost), 0) AS total_cost
         FROM sugarcane_purchases
         WHERE status = 'confirmed' AND purchase_date >= ? AND purchase_date <= ?`,
      )
      .get(start, end) as { tonnes: number; total_cost: number };

    // 2. Sugarcane consumed in period (from confirmed batches)
    const consumedRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(sugarcane_consumed_tonnes), 0) AS tonnes
         FROM production_batches
         WHERE status = 'confirmed' AND production_date >= ? AND production_date <= ?`,
      )
      .get(start, end) as { tonnes: number };

    // 3. Current raw sugarcane stock (all-time movements)
    const caneItem = db
      .prepare('SELECT id FROM raw_material_items WHERE is_sugarcane = 1 LIMIT 1')
      .get() as { id: string } | undefined;

    let sugarcane_stock_tonnes = 0;
    if (caneItem) {
      const stockRow = db
        .prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM raw_material_movements WHERE material_id = ?')
        .get(caneItem.id) as { stock: number };
      sugarcane_stock_tonnes = round2(stockRow.stock);
    }

    // 4. Jaggery produced in period (confirmed batches)
    const prodRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(finished_quantity_kg), 0) AS kg,
           COALESCE(SUM(total_cost), 0)           AS total_mfg_cost,
           COALESCE(SUM(total_direct_cost), 0)    AS total_direct_cost
         FROM production_batches
         WHERE status = 'confirmed' AND production_date >= ? AND production_date <= ?`,
      )
      .get(start, end) as { kg: number; total_mfg_cost: number; total_direct_cost: number };

    const jaggery_produced_kg = round2(prodRow.kg);
    const total_manufacturing_cost = round2(prodRow.total_mfg_cost);
    const avg_cost_per_kg = jaggery_produced_kg > 0 ? round2(total_manufacturing_cost / jaggery_produced_kg) : 0;

    // 5. Jaggery sold & Sales revenue in period (confirmed sales)
    const salesRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(quantity_kg), 0)         AS kg,
           COALESCE(SUM(invoice_total), 0)       AS revenue,
           COALESCE(SUM(cost_of_goods_sold), 0)  AS cogs,
           COALESCE(SUM(amount_paid), 0)         AS collected
         FROM sales
         WHERE status = 'confirmed' AND sale_date >= ? AND sale_date <= ?`,
      )
      .get(start, end) as { kg: number; revenue: number; cogs: number; collected: number };

    const jaggery_sold_kg = round2(salesRow.kg);
    const total_sales_revenue = round2(salesRow.revenue);
    const cost_of_goods_sold = round2(salesRow.cogs);
    const gross_profit = round2(total_sales_revenue - cost_of_goods_sold);

    // 6. Current finished jaggery stock (all-time movements)
    const finStockRow = db
      .prepare('SELECT COALESCE(SUM(quantity), 0) AS stock FROM finished_goods_movements')
      .get() as { stock: number };
    const current_finished_jaggery_stock_kg = round2(finStockRow.stock);

    // 7. Other business expenses in period
    const expRow = db
      .prepare(
        `SELECT
           COALESCE(SUM(amount), 0) AS total_other_exp,
           COALESCE(SUM(CASE WHEN classification IN ('overhead','selling','admin','other') THEN amount ELSE 0 END), 0) AS opex
         FROM other_expenses
         WHERE expense_date >= ? AND expense_date <= ?`,
      )
      .get(start, end) as { total_other_exp: number; opex: number };

    // 8. Fixed expenses (monthly setting or active fixed_expenses)
    const fixedRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM fixed_expenses
         WHERE is_active = 1`,
      )
      .get() as { total: number };
    const monthly_fixed_expenses = round2(fixedRow.total);

    // Net profit = Gross profit - Operating expenses not in COGS
    const net_profit = round2(gross_profit - expRow.opex);

    // 9. Outstanding Customer Payments (all-time)
    const custOutRow = db
      .prepare(
        `SELECT COALESCE(SUM(invoice_total - amount_paid), 0) AS outstanding
         FROM sales
         WHERE status = 'confirmed' AND payment_status != 'paid'`,
      )
      .get() as { outstanding: number };

    // 10. Outstanding Supplier Payments (all-time)
    const suppOutRow = db
      .prepare(
        `SELECT COALESCE(SUM(total_landed_cost - amount_paid), 0) AS outstanding
         FROM sugarcane_purchases
         WHERE status = 'confirmed' AND payment_status != 'paid'`,
      )
      .get() as { outstanding: number };

    res.json({
      period_range: { start, end },
      total_sugarcane_purchased_tonnes: round2(purchaseRow.tonnes),
      total_sugarcane_consumed_tonnes: round2(consumedRow.tonnes),
      current_sugarcane_stock_tonnes: sugarcane_stock_tonnes,
      total_jaggery_produced_kg: jaggery_produced_kg,
      total_jaggery_sold_kg: jaggery_sold_kg,
      current_finished_jaggery_stock_kg,
      total_sales_revenue,
      total_manufacturing_cost,
      average_manufacturing_cost_per_kg: avg_cost_per_kg,
      cost_of_goods_sold,
      gross_profit,
      estimated_net_profit: net_profit,
      outstanding_customer_payments: round2(custOutRow.outstanding),
      outstanding_supplier_payments: round2(suppOutRow.outstanding),
      monthly_fixed_expenses,
      other_business_expenses: round2(expRow.total_other_exp),
    });
  } catch (err) {
    console.error('[dashboard GET /summary]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/charts
router.get('/charts', (_req: Request, res: Response): void => {
  try {
    const db = getDb();

    // 1. Daily production (past 30 days)
    const dailyProduction = db
      .prepare(
        `SELECT
           production_date AS date,
           COALESCE(SUM(finished_quantity_kg), 0) AS quantity_kg,
           COALESCE(AVG(cost_per_kg), 0) AS avg_cost_per_kg
         FROM production_batches
         WHERE status = 'confirmed'
           AND production_date >= date('now', '-30 days')
         GROUP BY production_date
         ORDER BY production_date ASC`,
      )
      .all();

    // 2. Monthly production (past 12 months)
    const monthlyProduction = db
      .prepare(
        `SELECT
           strftime('%Y-%m', production_date) AS month,
           COALESCE(SUM(finished_quantity_kg), 0) AS quantity_kg,
           COALESCE(SUM(total_cost), 0) AS total_cost
         FROM production_batches
         WHERE status = 'confirmed'
           AND production_date >= date('now', '-12 months')
         GROUP BY strftime('%Y-%m', production_date)
         ORDER BY month ASC`,
      )
      .all();

    // 3. Sales revenue over time (monthly)
    const salesRevenue = db
      .prepare(
        `SELECT
           strftime('%Y-%m', sale_date) AS month,
           COALESCE(SUM(invoice_total), 0) AS revenue,
           COALESCE(SUM(quantity_kg), 0) AS quantity_kg
         FROM sales
         WHERE status = 'confirmed'
           AND sale_date >= date('now', '-12 months')
         GROUP BY strftime('%Y-%m', sale_date)
         ORDER BY month ASC`,
      )
      .all();

    // 4. Manufacturing cost per kg trend (by batch)
    const costPerKgTrend = db
      .prepare(
        `SELECT
           batch_number,
           production_date,
           cost_per_kg,
           yield_percentage
         FROM production_batches
         WHERE status = 'confirmed' AND cost_per_kg IS NOT NULL
         ORDER BY production_date ASC, created_at ASC
         LIMIT 25`,
      )
      .all();

    // 5. Expense breakdown (category-wise)
    const expenseBreakdown = db
      .prepare(
        `SELECT
           category,
           COALESCE(SUM(amount), 0) AS amount
         FROM other_expenses
         GROUP BY category
         ORDER BY amount DESC`,
      )
      .all();

    // 6. Production vs Sales comparison (monthly)
    const months = db
      .prepare(
        `SELECT DISTINCT month FROM (
           SELECT strftime('%Y-%m', production_date) AS month FROM production_batches WHERE status='confirmed'
           UNION
           SELECT strftime('%Y-%m', sale_date) AS month FROM sales WHERE status='confirmed'
         )
         ORDER BY month DESC
         LIMIT 6`,
      )
      .all() as { month: string }[];

    const prodVsSales = months.reverse().map(({ month }) => {
      const prod = db
        .prepare(
          `SELECT COALESCE(SUM(finished_quantity_kg), 0) AS produced_kg
           FROM production_batches
           WHERE status = 'confirmed' AND strftime('%Y-%m', production_date) = ?`,
        )
        .get(month) as { produced_kg: number };

      const sale = db
        .prepare(
          `SELECT COALESCE(SUM(quantity_kg), 0) AS sold_kg
           FROM sales
           WHERE status = 'confirmed' AND strftime('%Y-%m', sale_date) = ?`,
        )
        .get(month) as { sold_kg: number };

      return {
        month,
        produced_kg: round2(prod.produced_kg),
        sold_kg: round2(sale.sold_kg),
      };
    });

    res.json({
      daily_production: dailyProduction,
      monthly_production: monthlyProduction,
      sales_revenue: salesRevenue,
      cost_per_kg_trend: costPerKgTrend,
      expense_breakdown: expenseBreakdown,
      prod_vs_sales: prodVsSales,
    });
  } catch (err) {
    console.error('[dashboard GET /charts]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/dashboard/alerts
router.get('/alerts', (_req: Request, res: Response): void => {
  try {
    const db = getDb();

    // Low raw material stock
    const lowRawMaterials = db
      .prepare(
        `SELECT
           i.id, i.name, i.unit, i.min_stock_level,
           COALESCE(SUM(m.quantity), 0) AS current_stock
         FROM raw_material_items i
         LEFT JOIN raw_material_movements m ON m.material_id = i.id
         WHERE i.is_active = 1
         GROUP BY i.id
         HAVING current_stock <= i.min_stock_level AND i.min_stock_level > 0`,
      )
      .all();

    // Low finished goods stock
    const lowFinishedGoods = db
      .prepare(
        `SELECT
           g.id, g.name, g.unit,
           COALESCE(SUM(m.quantity), 0) AS current_stock
         FROM finished_goods_items g
         LEFT JOIN finished_goods_movements m ON m.item_id = g.id
         WHERE g.is_active = 1
         GROUP BY g.id
         HAVING current_stock < 100`, // Alert if less than 100kg
      )
      .all();

    // Unpaid customer invoices
    const unpaidSales = db
      .prepare(
        `SELECT
           s.id, s.invoice_number, s.sale_date, s.invoice_total,
           s.amount_paid, (s.invoice_total - s.amount_paid) AS balance,
           c.name AS customer_name
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.status = 'confirmed' AND s.payment_status != 'paid'
         ORDER BY s.sale_date ASC
         LIMIT 10`,
      )
      .all();

    // Unpaid supplier bills
    const unpaidPurchases = db
      .prepare(
        `SELECT
           p.id, p.reference_number, p.purchase_date, p.total_landed_cost,
           p.amount_paid, (p.total_landed_cost - p.amount_paid) AS balance,
           s.name AS supplier_name
         FROM sugarcane_purchases p
         LEFT JOIN suppliers s ON p.supplier_id = s.id
         WHERE p.status = 'confirmed' AND p.payment_status != 'paid'
         ORDER BY p.purchase_date ASC
         LIMIT 10`,
      )
      .all();

    // Draft / incomplete batches
    const draftBatches = db
      .prepare(
        `SELECT id, batch_number, production_date, sugarcane_consumed_tonnes, created_at
         FROM production_batches
         WHERE status = 'draft'
         ORDER BY production_date ASC`,
      )
      .all();

    res.json({
      low_raw_material: lowRawMaterials,
      low_finished_stock: lowFinishedGoods,
      unpaid_invoices: unpaidSales,
      unpaid_supplier_bills: unpaidPurchases,
      draft_batches: draftBatches,
    });
  } catch (err) {
    console.error('[dashboard GET /alerts]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
