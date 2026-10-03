import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import authenticate from '../middleware/auth.js';
import { parseDateBoundary, parseTransactionDate, validateTransaction } from '../middleware/validate.js';
import { notifyBudgetCrossings } from '../services/notifications.js';
import { normalizeMoney } from '../lib/money.js';
import { findDuplicateTransaction, isDuplicateKeyError, validateTransactionReferences } from '../services/transactionChecks.js';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const { type, category, method, search, start, end, sort = 'date', order = 'desc', page = 1, limit = 20 } = req.query;
    const query = { userId: req.user._id };
    if (req.baseUrl.endsWith('/income')) query.type = 'income'; else if (['income', 'expense'].includes(type)) query.type = type;
    if (category) query.category = category;
    if (method) query.paymentMethod = method;
    if (start || end) {
      const from = start ? parseDateBoundary(String(start)) : null;
      const through = end ? parseDateBoundary(String(end), true) : null;
      if ((start && !from) || (end && !through) || (from && through && from > through)) return res.status(400).json({ message: 'Choose a valid transaction date range.' });
      query.date = { ...(from ? { $gte: from } : {}), ...(through ? { $lte: through } : {}) };
    }
    if (search) {
      const safe = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      query.$or = [{ description: regex }, { merchant: regex }, { category: regex }, { amount: Number.isFinite(Number(search)) ? Number(search) : -1 }];
    }
    const pageNo = Math.max(1, Math.min(10000, Number(page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 20));
    const sortKey = ['date', 'amount', 'createdAt', 'category'].includes(sort) ? sort : 'date';
    const [items, total] = await Promise.all([
      Transaction.find(query).sort({ [sortKey]: order === 'asc' ? 1 : -1 }).skip((pageNo - 1) * pageSize).limit(pageSize).lean(),
      Transaction.countDocuments(query)
    ]);
    res.json({ transactions: items, pagination: { page: pageNo, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (req.baseUrl.endsWith('/income') && body.type !== 'income') return res.status(400).json({ message: 'Income entries must use the income transaction type.' });
    const validation = validateTransaction(body);
    if (validation) return res.status(400).json({ message: validation });
    const date = parseTransactionDate(body.date);
    const paymentMethod = String(body.paymentMethod || req.user.paymentMethods?.[0] || 'Other').trim();
    const referencesError = await validateTransactionReferences(req.user, { ...body, paymentMethod });
    if (referencesError) return res.status(400).json({ message: referencesError });
    const input = {
      userId: req.user._id,
      amount: normalizeMoney(body.amount),
      type: body.type,
      category: String(body.category).trim(),
      description: String(body.description || '').trim(),
      merchant: String(body.merchant || '').trim(),
      date,
      paymentMethod,
      source: 'manual',
      notes: String(body.notes || '').trim(),
      ...(String(body.transactionId || '').trim() ? { transactionId: String(body.transactionId).trim() } : {}),
      recurring: Boolean(body.recurring),
    };
    if (await findDuplicateTransaction(req.user._id, input)) return res.status(409).json({ code: 'DUPLICATE_TRANSACTION', message: 'A transaction with the same date, amount, type, and description or merchant already exists.' });
    let transaction;
    try { transaction = await Transaction.create(input); }
    catch (err) { if (isDuplicateKeyError(err)) return res.status(409).json({ code: 'DUPLICATE_TRANSACTION', message: 'This transaction identifier has already been recorded.' }); throw err; }
    await notifyBudgetCrossings(req.user._id, transaction);
    res.status(201).json({ transaction });
  } catch (err) { next(err); }
});
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found.' });
    const body = req.body || {};
    if (req.baseUrl.endsWith('/income') && body.type !== 'income') return res.status(400).json({ message: 'Income entries must use the income transaction type.' });
    const validation = validateTransaction(body);
    if (validation) return res.status(400).json({ message: validation });
    const current = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!current) return res.status(404).json({ message: 'Transaction not found.' });
    const date = parseTransactionDate(body.date);
    const paymentMethod = String(body.paymentMethod || current.paymentMethod || req.user.paymentMethods?.[0] || 'Other').trim();
    const referencesError = await validateTransactionReferences(req.user, { ...body, paymentMethod });
    if (referencesError) return res.status(400).json({ message: referencesError });
    const update = {
      amount: normalizeMoney(body.amount),
      type: body.type,
      category: String(body.category).trim(),
      description: String(body.description || '').trim(),
      merchant: String(body.merchant || '').trim(),
      date,
      paymentMethod,
      notes: String(body.notes || '').trim(),
      recurring: Boolean(body.recurring),
      ...(body.transactionId !== undefined ? { transactionId: String(body.transactionId || '').trim() || undefined } : {}),
    };
    if (await findDuplicateTransaction(req.user._id, update, current._id)) return res.status(409).json({ code: 'DUPLICATE_TRANSACTION', message: 'Another transaction with the same date, amount, type, and description or merchant already exists.' });
    try { current.set(update); await current.save(); }
    catch (err) { if (isDuplicateKeyError(err)) return res.status(409).json({ code: 'DUPLICATE_TRANSACTION', message: 'This transaction identifier has already been recorded.' }); throw err; }
    const transaction = current;
    res.json({ transaction });
  } catch (err) { next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Transaction not found.' });
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
export default router;
