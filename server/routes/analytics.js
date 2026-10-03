import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { fromPaise, mongoPaiseSum, sumMoney } from '../lib/money.js';

const router = Router();
router.use(authenticate);
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const range = String(req.query.range || '30d');
    const days = ({ '7d': 7, '30d': 30, '6m': 183, '1y': 365 })[range] || 30;
    const from = new Date(now); from.setDate(from.getDate() - days + 1); from.setHours(0, 0, 0, 0);
    const userId = req.user._id;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [transactions, monthTx, priorTx, allTime, lifetimeSums] = await Promise.all([
      Transaction.find({ userId, date: { $gte: from, $lte: now } }).sort({ date: 1 }).lean(),
      Transaction.find({ userId, date: { $gte: monthStart, $lte: now } }).lean(),
      Transaction.find({ userId, date: { $gte: previousStart, $lt: monthStart } }).lean(),
      Transaction.find({ userId }).sort({ date: -1 }).limit(10000).lean(),
      Transaction.aggregate([{ $match: { userId } }, { $group: { _id: '$type', amountPaise: mongoPaiseSum() } }])
    ]);
    const sum = (arr, type) => sumMoney(arr.filter((t) => t.type === type).map((t) => t.amount));
    const spendByCategory = (items) => {
      const values = new Map();
      items.filter((t) => t.type === 'expense').forEach((t) => values.set(t.category, [...(values.get(t.category) || []), t.amount]));
      const map = Object.fromEntries([...values].map(([category, amounts]) => [category, sumMoney(amounts)]));
      return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    };
    const byDay = {};
    transactions.filter((t) => t.type === 'expense').forEach((t) => { const key = startOfDay(new Date(t.date)).toISOString(); byDay[key] = sumMoney([byDay[key] || 0, t.amount]); });
    const dailyTrend = days <= 31 ? Array.from({ length: days }, (_, index) => {
      const date = new Date(from); date.setDate(from.getDate() + index);
      return { date: date.toISOString(), amount: byDay[startOfDay(date).toISOString()] || 0 };
    }) : (() => {
      const buckets = new Map();
      transactions.filter((t) => t.type === 'expense').forEach((t) => { const date = new Date(t.date); const key = new Date(date.getFullYear(), date.getMonth(), 1).toISOString(); buckets.set(key, sumMoney([buckets.get(key) || 0, t.amount])); });
      const count = days <= 200 ? 7 : 13;
      return Array.from({ length: count }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1); const key = date.toISOString(); return { date: key, amount: buckets.get(key) || 0 }; });
    })();
    const monthMap = new Map();
    allTime.forEach((t) => {
      const d = new Date(t.date); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = monthMap.get(key) || { month: key, income: 0, expenses: 0 };
      const target = t.type === 'income' ? 'income' : 'expenses'; row[target] = sumMoney([row[target], t.amount]); monthMap.set(key, row);
    });
    const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    const categoryNow = spendByCategory(monthTx); const categoryPrior = spendByCategory(priorTx);
    const budget = await Budget.findOne({ userId, type: 'monthly', category: '' }).lean();
    const expenses = sum(monthTx, 'expense'); const income = sum(monthTx, 'income');
    const daySpend = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => { const key = startOfDay(new Date(t.date)).toISOString(); daySpend[key] = sumMoney([daySpend[key] || 0, t.amount]); });
    const highestDay = Object.entries(daySpend).sort((a, b) => b[1] - a[1])[0];
    const previousExpenses = sum(priorTx, 'expense');
    const insights = [];
    if (categoryNow[0]) insights.push({ icon: 'sparkles', title: `${categoryNow[0].category} is your biggest expense`, text: `You spent ${categoryNow[0].amount} on ${categoryNow[0].category.toLowerCase()} this month.`, tone: 'mint' });
    if (priorTx.length) {
      const diff = expenses - previousExpenses;
      insights.push({ icon: diff > 0 ? 'trending-up' : 'trending-down', title: diff > 0 ? 'Spending increased' : 'Spending decreased', text: `You spent ${Math.abs(diff)} ${diff > 0 ? 'more' : 'less'} than last month.`, tone: diff > 0 ? 'gold' : 'mint' });
    }
    if (budget) {
      const remaining = budget.limit - expenses;
      insights.push({ icon: 'target', title: remaining >= 0 ? 'Monthly budget status' : 'Monthly budget exceeded', text: remaining >= 0 ? `${remaining} remains in your monthly budget.` : `You are ${Math.abs(remaining)} over your monthly budget.`, tone: remaining >= 0 ? 'mint' : 'rose' });
    }
    if (income > 0) {
      const savingsRate = Math.round(((income - expenses) / income) * 100);
      insights.push({ icon: 'piggy-bank', title: savingsRate >= 0 ? 'Savings this month' : 'Spending exceeded income', text: savingsRate >= 0 ? `You saved ${savingsRate}% of your income.` : `Expenses were ${Math.abs(savingsRate)}% higher than your income.`, tone: savingsRate >= 0 ? 'mint' : 'rose' });
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateString = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    res.json({
      range, period: { from, to: now },
      totals: { balance: fromPaise((lifetimeSums.find((s) => s._id === 'income')?.amountPaise || 0) - (lifetimeSums.find((s) => s._id === 'expense')?.amountPaise || 0)), income, expenses, savings: fromPaise(Math.round((income - expenses) * 100)), transactionCount: monthTx.length, averageDaily: fromPaise(Math.round(expenses * 100 / Math.max(1, now.getDate()))), highestDay: highestDay ? { date: dateString(highestDay[0]), dayName: dayNames[new Date(highestDay[0]).getDay()], amount: highestDay[1] } : null, highestCategory: categoryNow[0]?.category || null, savingsRate: income ? Math.round(((income - expenses) / income) * 100) : 0 },
      categories: categoryNow.map((row) => ({ ...row, percent: expenses ? Math.round(row.amount / expenses * 100) : 0 })),
      previousCategories: categoryPrior.map((row) => ({ ...row, percent: previousExpenses ? Math.round(row.amount / previousExpenses * 100) : 0 })),
      dailyTrend, monthly, insights, recent: allTime.slice(0, 5)
    });
  } catch (err) { next(err); }
});
export default router;
