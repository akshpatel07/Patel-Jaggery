/**
 * reports.ts (routes)
 * Comprehensive financial, cost, production, and profitability reports.
 * Includes CSV/Excel export capabilities.
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { round2 } from '../utils/helpers.js';

const router = Router();
router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
//  1. PROFIT & LOSS REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profit-loss', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const dateConditionsSales: string[] = ["status = 'confirmed'"];
    const dateConditionsProd: string[] = ["status = 'confirmed'"];
    const dateConditionsExp: string[] = [];
    const paramsSales: unknown[] = [];
    const paramsProd: unknown[] = [];
    const paramsExp: unknown[] = [];

    if (from) {
      dateConditionsSales.push('sale_date >= ?');
      paramsSales.push(from);
      dateConditionsProd.push('production_date >= ?');
      paramsProd.push(from);
      dateConditionsExp.push('expense_date >= ?');
      paramsExp.push(from);
    }
    if (to) {
      dateConditionsSales.push('sale_date <= ?');
      paramsSales.push(to);
      dateConditionsProd.push('production_date <= ?');
      paramsProd.push(to);
      dateConditionsExp.push('expense_date <= ?');
      paramsExp.push(to);
    }

    const whereSales = `WHERE ${dateConditionsSales.join(' AND ')}`;
    const whereExp = dateConditionsExp.length > 0 ? `WHERE ${dateConditionsExp.join(' AND ')}` : '';

    // Net Sales Revenue & COGS
    const salesData = db
      .prepare(
        `SELECT
           COALESCE(SUM(subtotal), 0)         AS gross_sales,
           COALESCE(SUM(discount), 0)         AS total_discounts,
           COALESCE(SUM(delivery_charges), 0) AS total_delivery,
           COALESCE(SUM(tax_amount), 0)       AS total_tax,
           COALESCE(SUM(invoice_total), 0)    AS net_revenue,
           COALESCE(SUM(cost_of_goods_sold), 0) AS cogs,
           COALESCE(SUM(quantity_kg), 0)      AS total_sold_kg
         FROM sales
         ${whereSales}`,
      )
      .get(...paramsSales) as {
        gross_sales: number;
        total_discounts: number;
        total_delivery: number;
        total_tax: number;
        net_revenue: number;
        cogs: number;
        total_sold_kg: number;
      };

    const netSales = round2(salesData.net_revenue);
    const cogs = round2(salesData.cogs);
    const grossProfit = round2(netSales - cogs);
    const grossMargin = netSales > 0 ? round2((grossProfit / netSales) * 100) : 0;

    // Operating expenses by category (excluding direct production costs allocated to batches)
    const expensesByCategory = db
      .prepare(
        `SELECT
           category,
           classification,
           COALESCE(SUM(amount), 0) AS total
         FROM other_expenses
         ${whereExp}
         GROUP BY category, classification
         ORDER BY total DESC`,
      )
      .all(...paramsExp) as { category: string; classification: string; total: number }[];

    let totalOperatingExpenses = 0;
    const expenseBreakdown = expensesByCategory.map((e) => {
      const amt = round2(e.total);
      totalOperatingExpenses += amt;
      return { category: e.category, classification: e.classification, amount: amt };
    });

    totalOperatingExpenses = round2(totalOperatingExpenses);
    const netProfit = round2(grossProfit - totalOperatingExpenses);
    const netMargin = netSales > 0 ? round2((netProfit / netSales) * 100) : 0;

    res.json({
      period: { from: from || 'All Time', to: to || 'Present' },
      revenue: {
        gross_sales: round2(salesData.gross_sales),
        discounts: round2(salesData.total_discounts),
        delivery_charges: round2(salesData.total_delivery),
        tax_amount: round2(salesData.total_tax),
        net_sales: netSales,
        total_sold_kg: round2(salesData.total_sold_kg),
      },
      cost_of_goods_sold: cogs,
      gross_profit: grossProfit,
      gross_margin_percent: grossMargin,
      operating_expenses: {
        items: expenseBreakdown,
        total: totalOperatingExpenses,
      },
      net_operating_profit: netProfit,
      net_margin_percent: netMargin,
    });
  } catch (err) {
    console.error('[reports GET /profit-loss]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. PRODUCTION COST REPORT (Batch-by-batch breakdown)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/production-cost', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('production_date >= ?'); params.push(from); }
    if (to)   { conditions.push('production_date <= ?'); params.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const batches = db
      .prepare(
        `SELECT
           id, batch_number, production_date,
           sugarcane_consumed_tonnes, sugarcane_cost,
           total_ingredient_cost, labour_rate_per_100kg, labour_cost,
           electricity_amount, fuel_cost, packaging_cost, other_direct_cost,
           total_direct_cost, allocated_overhead, total_cost,
           finished_quantity_kg, cost_per_kg, yield_percentage
         FROM production_batches
         ${where}
         ORDER BY production_date DESC`,
      )
      .all(...params);

    const summary = db
      .prepare(
        `SELECT
           COALESCE(SUM(finished_quantity_kg), 0)       AS total_output_kg,
           COALESCE(SUM(sugarcane_consumed_tonnes), 0)  AS total_sugarcane_tonnes,
           COALESCE(SUM(sugarcane_cost), 0)             AS total_sugarcane_cost,
           COALESCE(SUM(total_ingredient_cost), 0)      AS total_ingredient_cost,
           COALESCE(SUM(labour_cost), 0)                AS total_labour_cost,
           COALESCE(SUM(electricity_amount), 0)         AS total_electricity_cost,
           COALESCE(SUM(fuel_cost + packaging_cost + other_direct_cost), 0) AS total_other_direct,
           COALESCE(SUM(total_direct_cost), 0)          AS total_direct_cost,
           COALESCE(SUM(allocated_overhead), 0)         AS total_overhead,
           COALESCE(SUM(total_cost), 0)                 AS total_mfg_cost
         FROM production_batches
         ${where}`,
      )
      .get(...params) as Record<string, number>;

    const totalOutput = round2(summary.total_output_kg || 0);
    const avgDirectCostPerKg = totalOutput > 0 ? round2(summary.total_direct_cost / totalOutput) : 0;
    const avgTotalCostPerKg = totalOutput > 0 ? round2(summary.total_mfg_cost / totalOutput) : 0;

    res.json({
      batches,
      summary: {
        ...summary,
        avg_direct_cost_per_kg: avgDirectCostPerKg,
        avg_total_cost_per_kg: avgTotalCostPerKg,
      },
    });
  } catch (err) {
    console.error('[reports GET /production-cost]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. SALES BY CUSTOMER
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sales-by-customer', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["s.status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('s.sale_date >= ?'); params.push(from); }
    if (to)   { conditions.push('s.sale_date <= ?'); params.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const customers = db
      .prepare(
        `SELECT
           c.id, c.name, c.business_name, c.phone,
           COUNT(s.id)                            AS invoice_count,
           COALESCE(SUM(s.quantity_kg), 0)       AS total_qty_kg,
           COALESCE(SUM(s.invoice_total), 0)     AS total_sales,
           COALESCE(SUM(s.amount_paid), 0)       AS total_paid,
           COALESCE(SUM(s.invoice_total - s.amount_paid), 0) AS outstanding,
           COALESCE(SUM(s.cost_of_goods_sold), 0) AS total_cogs,
           COALESCE(SUM(s.invoice_total - s.cost_of_goods_sold), 0) AS gross_profit
         FROM customers c
         INNER JOIN sales s ON s.customer_id = c.id
         ${where}
         GROUP BY c.id
         ORDER BY total_sales DESC`,
      )
      .all(...params);

    res.json({ customers });
  } catch (err) {
    console.error('[reports GET /sales-by-customer]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. SALES BY PRODUCT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sales-by-product', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["s.status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('s.sale_date >= ?'); params.push(from); }
    if (to)   { conditions.push('s.sale_date <= ?'); params.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const products = db
      .prepare(
        `SELECT
           s.item_name,
           COUNT(s.id)                        AS orders_count,
           COALESCE(SUM(s.quantity_kg), 0)   AS total_qty_kg,
           COALESCE(AVG(s.price_per_kg), 0)  AS avg_price_per_kg,
           COALESCE(SUM(s.invoice_total), 0) AS total_revenue,
           COALESCE(SUM(s.cost_of_goods_sold), 0) AS total_cogs,
           COALESCE(SUM(s.invoice_total - s.cost_of_goods_sold), 0) AS gross_profit
         FROM sales s
         ${where}
         GROUP BY s.item_name
         ORDER BY total_revenue DESC`,
      )
      .all(...params);

    res.json({ products });
  } catch (err) {
    console.error('[reports GET /sales-by-product]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. STOCK VALUATION
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock-valuation', (_req: Request, res: Response): void => {
  try {
    const db = getDb();

    // Raw Materials
    const rawMaterials = db
      .prepare(
        `SELECT
           r.id, r.name, r.unit, r.is_sugarcane,
           COALESCE(SUM(m.quantity), 0) AS stock,
           COALESCE(
             SUM(CASE WHEN m.quantity > 0 THEN m.total_cost ELSE 0 END) /
             NULLIF(SUM(CASE WHEN m.quantity > 0 THEN m.quantity ELSE 0 END), 0),
             0
           ) AS avg_unit_cost
         FROM raw_material_items r
         LEFT JOIN raw_material_movements m ON m.material_id = r.id
         WHERE r.is_active = 1
         GROUP BY r.id`,
      )
      .all() as { id: string; name: string; unit: string; is_sugarcane: number; stock: number; avg_unit_cost: number }[];

    const rawValuation = rawMaterials.map((r) => {
      const stock = round2(r.stock);
      const unitCost = round2(r.avg_unit_cost);
      return {
        id: r.id,
        name: r.name,
        unit: r.unit,
        stock,
        unit_cost: unitCost,
        total_value: round2(stock * unitCost),
      };
    });

    // Finished Goods
    const finishedGoods = db
      .prepare(
        `SELECT
           g.id, g.name, g.unit,
           COALESCE(SUM(m.quantity), 0) AS stock,
           COALESCE(
             SUM(CASE WHEN m.quantity > 0 THEN m.total_cost ELSE 0 END) /
             NULLIF(SUM(CASE WHEN m.quantity > 0 THEN m.quantity ELSE 0 END), 0),
             0
           ) AS avg_unit_cost
         FROM finished_goods_items g
         LEFT JOIN finished_goods_movements m ON m.item_id = g.id
         WHERE g.is_active = 1
         GROUP BY g.id`,
      )
      .all() as { id: string; name: string; unit: string; stock: number; avg_unit_cost: number }[];

    const finValuation = finishedGoods.map((g) => {
      const stock = round2(g.stock);
      const unitCost = round2(g.avg_unit_cost);
      return {
        id: g.id,
        name: g.name,
        unit: g.unit,
        stock,
        unit_cost: unitCost,
        total_value: round2(stock * unitCost),
      };
    });

    const totalRawValue = round2(rawValuation.reduce((acc, r) => acc + r.total_value, 0));
    const totalFinValue = round2(finValuation.reduce((acc, g) => acc + g.total_value, 0));

    res.json({
      raw_materials: rawValuation,
      finished_goods: finValuation,
      total_raw_material_value: totalRawValue,
      total_finished_goods_value: totalFinValue,
      total_combined_stock_value: round2(totalRawValue + totalFinValue),
    });
  } catch (err) {
    console.error('[reports GET /stock-valuation]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. LABOUR & ELECTRICITY REPORTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/labour', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('production_date >= ?'); params.push(from); }
    if (to)   { conditions.push('production_date <= ?'); params.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const monthlyLabour = db
      .prepare(
        `SELECT
           strftime('%Y-%m', production_date) AS month,
           COUNT(id) AS batch_count,
           COALESCE(SUM(finished_quantity_kg), 0) AS total_kg,
           COALESCE(SUM(labour_cost), 0) AS total_labour_cost,
           COALESCE(SUM(labour_cost) / NULLIF(SUM(finished_quantity_kg), 0), 0) AS labour_cost_per_kg
         FROM production_batches
         ${where}
         GROUP BY strftime('%Y-%m', production_date)
         ORDER BY month DESC`,
      )
      .all(...params);

    res.json({ monthly_labour: monthlyLabour });
  } catch (err) {
    console.error('[reports GET /labour]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/electricity', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions: string[] = ["status = 'confirmed'"];
    const params: unknown[] = [];
    if (from) { conditions.push('production_date >= ?'); params.push(from); }
    if (to)   { conditions.push('production_date <= ?'); params.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const monthlyElectricity = db
      .prepare(
        `SELECT
           strftime('%Y-%m', production_date) AS month,
           COUNT(id) AS batch_count,
           COALESCE(SUM(finished_quantity_kg), 0) AS total_kg,
           COALESCE(SUM(electricity_amount), 0) AS total_electricity_cost,
           COALESCE(SUM(electricity_amount) / NULLIF(SUM(finished_quantity_kg), 0), 0) AS electricity_cost_per_kg
         FROM production_batches
         ${where}
         GROUP BY strftime('%Y-%m', production_date)
         ORDER BY month DESC`,
      )
      .all(...params);

    res.json({ monthly_electricity: monthlyElectricity });
  } catch (err) {
    console.error('[reports GET /electricity]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  7. CSV EXPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { type = 'production' } = req.query as { type?: string };

    if (type === 'production') {
      const rows = db
        .prepare(
          `SELECT
             batch_number, production_date, sugarcane_consumed_tonnes,
             sugarcane_cost, finished_quantity_kg, labour_cost,
             electricity_amount, total_direct_cost, allocated_overhead,
             total_cost, cost_per_kg, yield_percentage, status
           FROM production_batches
           ORDER BY production_date DESC`,
        )
        .all() as Record<string, unknown>[];

      if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=production_report.csv');
        res.send('No data');
        return;
      }

      const headers = Object.keys(rows[0]).join(',');
      const csvLines = rows.map((r) => Object.values(r).join(','));
      const csv = [headers, ...csvLines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=production_report.csv');
      res.send(csv);
    } else if (type === 'sales') {
      const rows = db
        .prepare(
          `SELECT
             invoice_number, sale_date, item_name, quantity_kg,
             price_per_kg, invoice_total, amount_paid, payment_status, status
           FROM sales
           ORDER BY sale_date DESC`,
        )
        .all() as Record<string, unknown>[];

      if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.csv');
        res.send('No data');
        return;
      }

      const headers = Object.keys(rows[0]).join(',');
      const csvLines = rows.map((r) => Object.values(r).join(','));
      const csv = [headers, ...csvLines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.csv');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Invalid export type. Options: production, sales' });
    }
  } catch (err) {
    console.error('[reports GET /export]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

