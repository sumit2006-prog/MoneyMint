import { Router } from 'express';
import mongoose from 'mongoose';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import authenticate from '../middleware/auth.js';
import { fromPaise, mongoPaiseSum, normalizeMoney } from '../lib/money.js';
const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const budgets = await Budget.find({ userId: req.user._id }).sort({ type: 1, category: 1 }).lean();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0);
    const bounds = { daily: dayStart, weekly: weekStart, monthly: monthStart };
    const totals = await Promise.all(budgets.map(async (b) => {
      const period = b.type === 'category' ? 'monthly' : b.type;
      const match = { userId: req.user._id, type: 'expense', date: { $gte: bounds[period] || monthStart, $lte: now } };
      if (b.type === 'category') match.category = b.category;
      const aggregate = await Transaction.aggregate([{ $match: match }, { $group: { _id: null, amountPaise: mongoPaiseSum() } }]);
      const spent = fromPaise(aggregate[0]?.amountPaise || 0);
      return { ...b, spent, percent: b.limit ? Math.round((spent / b.limit) * 100) : 0, period };
    }));
    res.json({ budgets: totals });
  } catch (err) { next(err); }
});
router.post('/', async (req, res, next) => {
  try {
    const { type, category = '', alertThresholds = [50, 75, 90, 100] } = req.body || {};
    const limit = normalizeMoney(req.body?.limit);
    const validType = ['daily', 'weekly', 'monthly', 'category'].includes(type);
    if (!validType || limit === null || limit <= 0) return res.status(400).json({ message: 'Enter a valid budget type and a positive limit with no more than two decimal places.' });
    if (type === 'category' && !category) return res.status(400).json({ message: 'Choose a category for this budget.' });
    if (type === 'category' && !await Category.exists({ userId: req.user._id, name: String(category).trim(), type: { $in: ['expense', 'both'] } })) return res.status(400).json({ message: 'Choose an expense category from your account.' });
    const budget = await Budget.findOneAndUpdate({ userId: req.user._id, type, category: type === 'category' ? String(category).trim() : '' }, { $set: { type, limit, category: type === 'category' ? String(category).trim() : '', period: type === 'category' ? 'monthly' : type, alertThresholds: Array.isArray(alertThresholds) ? alertThresholds.filter((x) => [50, 75, 90, 100].includes(Number(x))).map(Number) : [50, 75, 90, 100] } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json({ budget });
  } catch (err) { next(err); }
});
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Budget not found.' });
    const updates = {};
    if (req.body?.limit !== undefined) updates.limit = normalizeMoney(req.body.limit);
    if (Array.isArray(req.body.alertThresholds)) updates.alertThresholds = req.body.alertThresholds.map(Number).filter((x) => [50, 75, 90, 100].includes(x));
    if ((updates.limit === null || !Number.isFinite(updates.limit) || updates.limit <= 0) && req.body.limit !== undefined) return res.status(400).json({ message: 'Enter a positive budget limit with no more than two decimal places.' });
    const budget = await Budget.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true, runValidators: true });
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });
    res.json({ budget });
  } catch (err) { next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Budget not found.' });
    const result = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!result) return res.status(404).json({ message: 'Budget not found.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});
export default router;
