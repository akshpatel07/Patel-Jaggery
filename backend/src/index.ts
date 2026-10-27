/**
 * index.ts
 * Main SweetHarvest backend Express server.
 * Connects SQLite, mounts all REST API routes, and serves production frontend.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/database.js';

// Route imports
import authRoutes from './routes/auth.js';
import suppliersRoutes from './routes/suppliers.js';
import customersRoutes from './routes/customers.js';
import purchasesRoutes from './routes/purchases.js';
import rawMaterialsRoutes from './routes/raw-materials.js';
import labourRoutes from './routes/labour.js';
import electricityRoutes from './routes/electricity.js';
import productionRoutes from './routes/production.js';
import finishedGoodsRoutes from './routes/finished-goods.js';
import salesRoutes from './routes/sales.js';
import expensesRoutes from './routes/expenses.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Initialize SQLite database
initializeDatabase();

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/raw-materials', rawMaterialsRoutes);
app.use('/api/labour', labourRoutes);
app.use('/api/electricity', electricityRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/finished-goods', finishedGoodsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'SweetHarvest', time: new Date().toISOString() });
});

// Serve frontend build in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('SweetHarvest API is running. Frontend build not found.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🌾 SweetHarvest backend is running on http://localhost:${PORT}`);
});

export default app;

