/**
 * schema.ts
 * Defines all SQLite table creation DDL statements for SweetHarvest.
 * All monetary values are stored as REAL (rupees, not paise).
 * All dates stored as TEXT in ISO format YYYY-MM-DD.
 */

export const SCHEMA_SQL = `
-- ─────────────────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL CHECK(role IN ('owner','accountant','production_manager','staff')),
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  SETTINGS  (key/value store for app-wide configuration)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         TEXT PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);

-- ─────────────────────────────────────────────────────────
--  SUPPLIERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  business_name   TEXT,
  phone           TEXT,
  address         TEXT,
  gstin           TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  CUSTOMERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  business_name     TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  gstin             TEXT,
  credit_terms_days INTEGER NOT NULL DEFAULT 0,
  opening_balance   REAL NOT NULL DEFAULT 0,
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  SUGARCANE PURCHASES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sugarcane_purchases (
  id                   TEXT PRIMARY KEY,
  purchase_date        TEXT NOT NULL,
  supplier_id          TEXT REFERENCES suppliers(id),
  reference_number     TEXT,
  quantity_tonnes      REAL NOT NULL,
  rate_per_tonne       REAL NOT NULL,
  base_cost            REAL NOT NULL,      -- quantity_tonnes × rate_per_tonne
  transport_cost       REAL NOT NULL DEFAULT 0,
  loading_charges      REAL NOT NULL DEFAULT 0,
  other_expenses       REAL NOT NULL DEFAULT 0,
  total_landed_cost    REAL NOT NULL,      -- base_cost + all extra charges
  amount_paid          REAL NOT NULL DEFAULT 0,
  payment_status       TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','partial','paid')),
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
  created_by           TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  RAW MATERIAL ITEMS  (master list)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_material_items (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL,           -- tonne / kg / litre / piece
  is_sugarcane    INTEGER NOT NULL DEFAULT 0,
  min_stock_level REAL NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  RAW MATERIAL MOVEMENTS  (ledger; never store running total)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_material_movements (
  id             TEXT PRIMARY KEY,
  material_id    TEXT NOT NULL REFERENCES raw_material_items(id),
  movement_date  TEXT NOT NULL,
  movement_type  TEXT NOT NULL CHECK(movement_type IN
                   ('purchase','production_consumption','adjustment','return','wastage')),
  quantity       REAL NOT NULL,   -- positive = in, negative = out
  unit_cost      REAL,
  total_cost     REAL,
  reference_id   TEXT,            -- purchase_id or batch_id
  reference_type TEXT,
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  LABOUR RATES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labour_rates (
  id             TEXT PRIMARY KEY,
  rate_per_100kg REAL NOT NULL,
  effective_date TEXT NOT NULL,
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  ELECTRICITY BILLS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS electricity_bills (
  id                TEXT PRIMARY KEY,
  bill_date         TEXT NOT NULL,
  bill_number       TEXT,
  total_amount      REAL NOT NULL,
  period_from       TEXT,
  period_to         TEXT,
  allocation_basis  TEXT CHECK(allocation_basis IN
                      ('production_days','machine_hours','meter_reading','manual')),
  allocated_amount  REAL NOT NULL DEFAULT 0,
  unallocated_amount REAL,
  notes             TEXT,
  created_at        TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  PRODUCTION BATCHES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_batches (
  id                        TEXT PRIMARY KEY,
  batch_number              TEXT UNIQUE NOT NULL,
  production_date           TEXT NOT NULL,
  description               TEXT,
  sugarcane_consumed_tonnes REAL NOT NULL,
  sugarcane_cost            REAL NOT NULL,        -- weighted avg cost at time of confirmation
  finished_quantity_kg      REAL,                 -- filled before confirmation
  labour_rate_per_100kg     REAL NOT NULL,
  labour_cost               REAL,                 -- (finished_quantity_kg / 100) × rate
  electricity_method        TEXT CHECK(electricity_method IN ('fixed','per_day','bill_allocation')),
  electricity_amount        REAL NOT NULL DEFAULT 0,
  electricity_bill_id       TEXT REFERENCES electricity_bills(id),
  production_days           INTEGER NOT NULL DEFAULT 1,
  fuel_cost                 REAL NOT NULL DEFAULT 0,
  packaging_cost            REAL NOT NULL DEFAULT 0,
  other_direct_cost         REAL NOT NULL DEFAULT 0,
  total_ingredient_cost     REAL NOT NULL DEFAULT 0,  -- sum of batch_ingredients costs
  total_direct_cost         REAL,                     -- set at confirmation
  allocated_overhead        REAL NOT NULL DEFAULT 0,  -- fixed expense share
  total_cost                REAL,                     -- total_direct_cost + allocated_overhead
  cost_per_kg               REAL,
  yield_percentage          REAL,
  status                    TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','cancelled')),
  notes                     TEXT,
  created_by                TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  BATCH INGREDIENTS  (non-sugarcane raw materials per batch)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_ingredients (
  id            TEXT PRIMARY KEY,
  batch_id      TEXT NOT NULL REFERENCES production_batches(id),
  material_id   TEXT NOT NULL REFERENCES raw_material_items(id),
  material_name TEXT NOT NULL,
  quantity      REAL NOT NULL,
  unit          TEXT NOT NULL,
  unit_cost     REAL NOT NULL,
  total_cost    REAL NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  BATCH ELECTRICITY ALLOCATIONS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_electricity_allocations (
  id                     TEXT PRIMARY KEY,
  bill_id                TEXT NOT NULL REFERENCES electricity_bills(id),
  batch_id               TEXT NOT NULL REFERENCES production_batches(id),
  allocated_amount       REAL NOT NULL,
  allocation_basis_value REAL,
  created_at             TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  FINISHED GOODS ITEMS  (master list)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finished_goods_items (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT NOT NULL DEFAULT 'kg',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  FINISHED GOODS MOVEMENTS  (ledger; stock = SUM of quantities)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finished_goods_movements (
  id             TEXT PRIMARY KEY,
  item_id        TEXT NOT NULL REFERENCES finished_goods_items(id),
  batch_id       TEXT REFERENCES production_batches(id),
  movement_date  TEXT NOT NULL,
  movement_type  TEXT NOT NULL CHECK(movement_type IN
                   ('production','sale','return','adjustment','damage')),
  quantity       REAL NOT NULL,   -- positive = in (production/return), negative = out (sale/damage)
  unit_cost      REAL,
  total_cost     REAL,
  reference_id   TEXT,
  reference_type TEXT,            -- 'batch' / 'sale' / 'adjustment'
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  SALES
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               TEXT PRIMARY KEY,
  invoice_number   TEXT UNIQUE NOT NULL,
  sale_date        TEXT NOT NULL,
  customer_id      TEXT REFERENCES customers(id),
  item_id          TEXT NOT NULL REFERENCES finished_goods_items(id),
  item_name        TEXT NOT NULL,
  quantity_kg      REAL NOT NULL,
  price_per_kg     REAL NOT NULL,
  subtotal         REAL NOT NULL,           -- quantity × price
  discount         REAL NOT NULL DEFAULT 0,
  tax_amount       REAL NOT NULL DEFAULT 0,
  delivery_charges REAL NOT NULL DEFAULT 0,
  invoice_total    REAL NOT NULL,           -- subtotal - discount + tax + delivery
  amount_paid      REAL NOT NULL DEFAULT 0,
  payment_status   TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','partial','paid')),
  payment_method   TEXT,
  cost_of_goods_sold REAL,                 -- COGS calculated at confirmation via weighted avg
  status           TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','cancelled')),
  notes            TEXT,
  created_by       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  SALE PAYMENTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_payments (
  id             TEXT PRIMARY KEY,
  sale_id        TEXT NOT NULL REFERENCES sales(id),
  payment_date   TEXT NOT NULL,
  amount         REAL NOT NULL,
  payment_method TEXT,
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  PURCHASE PAYMENTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_payments (
  id             TEXT PRIMARY KEY,
  purchase_id    TEXT NOT NULL REFERENCES sugarcane_purchases(id),
  payment_date   TEXT NOT NULL,
  amount         REAL NOT NULL,
  payment_method TEXT,
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  FIXED EXPENSES  (recurring monthly overhead)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  category   TEXT,
  start_date TEXT NOT NULL,
  end_date   TEXT,
  notes      TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  OTHER EXPENSES  (one-off / miscellaneous)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS other_expenses (
  id             TEXT PRIMARY KEY,
  expense_date   TEXT NOT NULL,
  category       TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount         REAL NOT NULL,
  vendor         TEXT,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  classification TEXT CHECK(classification IN ('direct','overhead','selling','admin','other')),
  batch_id       TEXT REFERENCES production_batches(id),
  notes          TEXT,
  created_by     TEXT,
  created_at     TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────
--  AUDIT LOG
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  user_name   TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  details     TEXT,             -- JSON string snapshot
  created_at  TEXT NOT NULL
);
`;
