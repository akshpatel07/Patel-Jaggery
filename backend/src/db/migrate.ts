/**
 * migrate.ts
 * Standalone migration script — run with: npm run db:migrate
 * Simply initialises the database (creates tables + seeds data).
 */

import { initializeDatabase } from './database.js';

initializeDatabase();
console.log('[migrate] Database migration complete.');
process.exit(0);
