/**
 * helpers.ts
 * Shared utility functions used across routes.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

/**
 * Returns today's date as YYYY-MM-DD string.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns current UTC ISO timestamp.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Rounds a number to 2 decimal places.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates the next sequential invoice number.
 * Format: {prefix}-{YYYY}-{NNN}  e.g., SH-2024-001
 */
export function generateInvoiceNumber(): string {
  const db = getDb();

  const prefixSetting = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get() as
    | { value: string }
    | undefined;
  const prefix = prefixSetting?.value ?? 'SH';

  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  // Find the highest existing number for this year prefix
  const row = db
    .prepare(
      `SELECT invoice_number FROM sales
       WHERE invoice_number LIKE ?
       ORDER BY invoice_number DESC
       LIMIT 1`,
    )
    .get(`${yearPrefix}%`) as { invoice_number: string } | undefined;

  let nextSeq = 1;
  if (row) {
    const parts = row.invoice_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${yearPrefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Generates the next sequential batch number.
 * Format: BATCH-YYYYMMDD-NNN
 */
export function generateBatchNumber(): string {
  const db = getDb();
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `BATCH-${datePart}-`;

  const row = db
    .prepare(
      `SELECT batch_number FROM production_batches
       WHERE batch_number LIKE ?
       ORDER BY batch_number DESC
       LIMIT 1`,
    )
    .get(`${prefix}%`) as { batch_number: string } | undefined;

  let nextSeq = 1;
  if (row) {
    const parts = row.batch_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Writes an entry to the audit_log table.
 */
export function auditLog(
  userId: string | undefined,
  userName: string | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    userId ?? null,
    userName ?? null,
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    nowIso(),
  );
}

/**
 * Calculates the current weighted-average cost per tonne for sugarcane.
 * Uses only purchase in-movements and their recorded total_cost.
 */
export function getSugarcaneCostPerTonne(): number {
  const db = getDb();

  const mat = db
    .prepare("SELECT id FROM raw_material_items WHERE is_sugarcane = 1 LIMIT 1")
    .get() as { id: string } | undefined;

  if (!mat) return 0;

  const purchases = db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0)   AS total_qty,
              COALESCE(SUM(total_cost), 0) AS total_cost
       FROM raw_material_movements
       WHERE material_id = ? AND movement_type = 'purchase' AND quantity > 0`,
    )
    .get(mat.id) as { total_qty: number; total_cost: number };

  if (purchases.total_qty <= 0) return 0;
  return round2(purchases.total_cost / purchases.total_qty);
}

/**
 * Returns the current stock level for a raw material (sum of all movements).
 */
export function getRawMaterialStock(materialId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS stock
       FROM raw_material_movements
       WHERE material_id = ?`,
    )
    .get(materialId) as { stock: number };
  return round2(row.stock);
}

/**
 * Returns the current stock level for a finished goods item.
 */
export function getFinishedGoodsStock(itemId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) AS stock
       FROM finished_goods_movements
       WHERE item_id = ?`,
    )
    .get(itemId) as { stock: number };
  return round2(row.stock);
}

/**
 * Calculates the weighted-average cost per kg for a finished goods item.
 * Only in-movements (quantity > 0) are used for the average.
 */
export function getFinishedGoodsWeightedAvgCost(itemId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(quantity),   0) AS total_qty,
              COALESCE(SUM(total_cost), 0) AS total_cost
       FROM finished_goods_movements
       WHERE item_id = ? AND quantity > 0`,
    )
    .get(itemId) as { total_qty: number; total_cost: number };

  if (row.total_qty <= 0) return 0;
  return round2(row.total_cost / row.total_qty);
}

/**
 * Returns the current labour rate (most recent effective date <= today).
 */
export function getCurrentLabourRate(): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT rate_per_100kg FROM labour_rates
       WHERE effective_date <= ?
       ORDER BY effective_date DESC
       LIMIT 1`,
    )
    .get(today()) as { rate_per_100kg: number } | undefined;
  return row?.rate_per_100kg ?? 200;
}

/**
 * Returns the total monthly fixed expenses applicable to a given year-month.
 * @param yearMonth - e.g., '2024-03'
 */
export function getMonthlyFixedExpenses(yearMonth: string): number {
  const db = getDb();
  const monthStart = `${yearMonth}-01`;
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM fixed_expenses
       WHERE is_active = 1
         AND start_date <= ?
         AND (end_date IS NULL OR end_date >= ?)`,
    )
    .get(monthEnd, monthStart) as { total: number };
  return round2(row.total);
}
