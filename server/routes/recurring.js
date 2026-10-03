import { Router } from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/auth.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Transaction from '../models/Transaction.js';
import { parseTransactionDate, validateTransaction } from '../middleware/validate.js';
import { notifyBudgetCrossings } from '../services/notifications.js';
import { normalizeMoney } from '../lib/money.js';
import { validateTransactionReferences } from '../services/transactionChecks.js';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try { const recurring = await RecurringTransaction.find({ userId: req.user._id }).sort({ nextOccurrence: 1 }).lean(); res.json({ recurring }); }
  catch (err) { next(err); }
});
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const amount = normalizeMoney(body.amount); const type = body.type; const category = String(body.category || '').trim();
    const frequency = body.frequency || 'monthly'; const startDate = parseTransactionDate(body.startDate); const nextOccurrence = parseTransactionDate(body.nextOccurrence || body.startDate);
    if (amount === null || amount <= 0 || !['income', 'expense'].includes(type) || !category || !['weekly', 'monthly', 'yearly'].includes(frequency) || !startDate || !nextOccurrence) return res.status(400).json({ message: 'Enter a valid recurring transaction with a positive amount and start date.' });
    const referenceError = await validateTransactionReferences(req.user, { type, category, paymentMethod: req.user.paymentMethods?.[0] || 'Other' });
    if (referenceError) return res.status(400).json({ message: referenceError });
    const recurring = await RecurringTransaction.create({ userId: req.user._id, amount, type, category, description: String(req.body.description || '').slice(0, 160), frequency, startDate, nextOccurrence, active: true });
    res.status(201).json({ recurring });
  } catch (err) { next(err); }
});
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Recurring item not found.' });
    const updates = {};
    if (req.body?.active !== undefined) { if (typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'Choose whether this recurring item is active.' }); updates.active = req.body.active; }
    if (req.body?.amount !== undefined) { updates.amount = normalizeMoney(req.body.amount); if (updates.amount === null || updates.amount <= 0) return res.status(400).json({ message: 'Enter a positive recurring amount with no more than two decimal places.' }); }
    if (req.body?.nextOccurrence !== undefined) { updates.nextOccurrence = parseTransactionDate(req.body.nextOccurrence); if (!updates.nextOccurrence) return res.status(400).json({ message: 'Enter a valid next occurrence date.' }); }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Choose a recurring item field to update.' });
    const recurring = await RecurringTransaction.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true, runValidators: true });
    if (!recurring) return res.status(404).json({ message: 'Recurring item not found.' });
    res.json({ recurring });
  } catch (err) { next(err); }
});
router.post('/:id/record', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Recurring item not found.' });
    const recurring = await RecurringTransaction.findOne({ _id: req.params.id, userId: req.user._id, active: true });
    if (!recurring) return res.status(404).json({ message: 'This recurring item is paused or no longer available.' });
    const date = parseTransactionDate(req.body?.date || recurring.nextOccurrence);
    const input = { amount: recurring.amount, type: recurring.type, category: recurring.category, description: recurring.description, date, paymentMethod: req.body?.paymentMethod || req.user.paymentMethods?.[0] || 'Other', source: 'manual' };
    const invalid = validateTransaction(input); if (invalid) return res.status(400).json({ message: invalid });
    const referenceError = await validateTransactionReferences(req.user, input);
    if (referenceError) return res.status(400).json({ message: referenceError });
    const transaction = await Transaction.create({ ...input, userId: req.user._id });
    await notifyBudgetCrossings(req.user._id, transaction);
    const next = new Date(recurring.nextOccurrence);
    const advance = () => { if (recurring.frequency === 'weekly') next.setDate(next.getDate() + 7); else if (recurring.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1); else next.setMonth(next.getMonth() + 1); };
    do { advance(); } while (next <= new Date());
    recurring.nextOccurrence = next; await recurring.save();
    res.status(201).json({ transaction, recurring });
  } catch (err) { next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Recurring item not found.' });
    const recurring = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!recurring) return res.status(404).json({ message: 'Recurring item not found.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
export default router;
