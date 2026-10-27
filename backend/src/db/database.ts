/**
 * database.ts
 * Initializes the SQLite database using Node's built-in node:sqlite (DatabaseSync),
 * creates all tables, and seeds default data.
 * Zero external native compilation dependencies required.
 */

import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.NODE_ENV === 'production'
    ? '/home/data/sweetharvest.db'
    : path.join(__dirname, '..', '..', 'sweetharvest.db'));

export interface AppDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): any[];
    get(...params: unknown[]): any;
    run(...params: unknown[]): any;
  };
  transaction<T>(fn: () => T): () => T;
}

let _dbInstance: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!_dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _dbInstance;
}

export function initializeDatabase(): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const rawDb = new DatabaseSync(DB_PATH);

  // Enable WAL mode & foreign keys
  rawDb.exec('PRAGMA journal_mode = WAL;');
  rawDb.exec('PRAGMA foreign_keys = ON;');

  // Create database wrapper compatible with better-sqlite3 API
  _dbInstance = {
    exec(sql: string) {
      rawDb.exec(sql);
    },
    prepare(sql: string) {
      const stmt = (rawDb as any).prepare(sql);
      return {
        all(...params: unknown[]) {
          return stmt.all(...(params as any[])) as any[];
        },
        get(...params: unknown[]) {
          return stmt.get(...(params as any[])) as any;
        },
        run(...params: unknown[]) {
          return stmt.run(...(params as any[])) as any;
        },
      };
    },
    transaction<T>(fn: () => T) {
      return () => {
        rawDb.exec('BEGIN TRANSACTION;');
        try {
          const res = fn();
          rawDb.exec('COMMIT;');
          return res;
        } catch (err) {
          rawDb.exec('ROLLBACK;');
          throw err;
        }
      };
    },
  };

  // Run schema creation
  _dbInstance.exec(SCHEMA_SQL);

  // Seed default configuration & user
  seedDefaultData(_dbInstance);

  console.log(`[DB] Connected SQLite via node:sqlite → ${DB_PATH}`);
}

function seedDefaultData(db: AppDatabase): void {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. Default admin user
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sweetharvest.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && (!adminPassword || adminPassword.length < 12)) {
    throw new Error('ADMIN_PASSWORD must be configured with at least 12 characters in production.');
  }
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword || `${uuidv4()}-${uuidv4()}`, 12);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(uuidv4(), 'Admin', adminEmail, passwordHash, 'owner', now, now);
    console.log(`[DB] Seeded initial admin user: ${adminEmail}`);
  }

  // 2. Default settings
  const defaultSettings: Record<string, string> = {
    business_name:              'SweetHarvest',
    monthly_fixed_expense:      '30000',
    default_labour_rate:        '200',
    financial_year_start:       '04-01',
    default_electricity_method: 'fixed',
    valuation_method:           'weighted_average',
    invoice_prefix:             'SH',
    currency:                   'INR',
  };

  const upsertSetting = db.prepare(`
    INSERT INTO settings (id, key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  for (const [key, value] of Object.entries(defaultSettings)) {
    upsertSetting.run(uuidv4(), key, value, now, 'system');
  }

  // 3. Raw materials
  const defaultMaterials = [
    { name: 'Sugarcane',            unit: 'tonne',  is_sugarcane: 1 },
    { name: 'Sugar',                unit: 'kg',     is_sugarcane: 0 },
    { name: 'Lime',                 unit: 'kg',     is_sugarcane: 0 },
    { name: 'Packaging Materials',  unit: 'piece',  is_sugarcane: 0 },
  ];

  const insertMaterial = db.prepare(`
    INSERT INTO raw_material_items (id, name, unit, is_sugarcane, min_stock_level, is_active, created_at)
    VALUES (?, ?, ?, ?, 0, 1, ?)
  `);

  for (const m of defaultMaterials) {
    const exists = db.prepare('SELECT id FROM raw_material_items WHERE name = ?').get(m.name);
    if (!exists) {
      insertMaterial.run(uuidv4(), m.name, m.unit, m.is_sugarcane, now);
    }
  }

  // 4. Finished goods
  const defaultGoods = [
    { name: 'Jaggery Blocks',  unit: 'kg' },
    { name: 'Jaggery Powder',  unit: 'kg' },
  ];

  for (const g of defaultGoods) {
    const exists = db.prepare('SELECT id FROM finished_goods_items WHERE name = ?').get(g.name);
    if (!exists) {
      db.prepare(`
        INSERT INTO finished_goods_items (id, name, unit, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(uuidv4(), g.name, g.unit, now);
    }
  }

  // 5. Default labour rate
  const existingRate = db.prepare('SELECT id FROM labour_rates LIMIT 1').get();
  if (!existingRate) {
    db.prepare(`
      INSERT INTO labour_rates (id, rate_per_100kg, effective_date, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 200, today, 'Default labour rate', 'system', now);
    console.log('[DB] Seeded default labour rate: ₹200/100kg');
  }

  // 6. Default fixed expense (₹30,000 monthly)
  const existingFixedExp = db.prepare('SELECT id FROM fixed_expenses LIMIT 1').get();
  if (!existingFixedExp) {
    db.prepare(`
      INSERT INTO fixed_expenses (id, name, amount, category, start_date, end_date, notes, is_active, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      uuidv4(),
      'Factory & Admin Expenses',
      30000,
      'overhead',
      today,
      null,
      'Default monthly fixed overhead',
      'system',
      now,
    );
    console.log('[DB] Seeded default fixed expense: ₹30,000/month');
  }
}
