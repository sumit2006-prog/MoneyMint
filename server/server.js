import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const financeTimeZone = process.env.FINANCIAL_TIMEZONE || 'Asia/Kolkata';
try { new Intl.DateTimeFormat('en', { timeZone: financeTimeZone }); process.env.TZ = financeTimeZone; }
catch { console.error('FINANCIAL_TIMEZONE must be a valid IANA timezone.'); process.exit(1); }
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budgets.js';
import analyticsRoutes from './routes/analytics.js';
import importRoutes from './routes/imports.js';
import categoryRoutes from './routes/categories.js';
import reportRoutes from './routes/reports.js';
import integrationRoutes from './routes/integrations.js';
import recurringRoutes from './routes/recurring.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => { if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {}; next(); });
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/income', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', analyticsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/integrations', integrationRoutes);
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} was not found.` }));
app.use((err, _req, res, _next) => {
  const isUploadError = err.name === 'MulterError';
  const status = err.status || (isUploadError || err instanceof SyntaxError && err.status === 400 ? 400 : 500);
  if (status >= 500) console.error(`[MoneyMint API] ${err.name || 'Error'} (${status})`);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Statement files must be 8 MB or smaller.' : isUploadError ? 'The uploaded statement could not be accepted.' : err instanceof SyntaxError && err.status === 400 ? 'Request body must contain valid JSON.' : status >= 500 ? 'Something went wrong. Please try again.' : err.message;
  res.status(status).json({ message });
});

const port = process.env.PORT || 4000;
const missingDatabaseUri = !process.env.MONGODB_URI;
const invalidJwtSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32;
if (missingDatabaseUri || invalidJwtSecret) {
  const missing = [missingDatabaseUri && 'MONGODB_URI', invalidJwtSecret && 'JWT_SECRET (at least 32 characters)'].filter(Boolean);
  console.error(`MoneyMint cannot start: configure ${missing.join(' and ')}. Copy the repository-root .env.example to .env, set a reachable MongoDB URI, and replace JWT_SECRET with a private random value of at least 32 characters.`);
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, () => console.log(`MoneyMint API listening on http://localhost:${port}`)))
  .catch((err) => {
    const code = err.code ? ` (${err.code})` : '';
    console.error(`MongoDB connection failed${code}. Check MONGODB_URI and make sure that database is reachable.`);
    process.exit(1);
  });
