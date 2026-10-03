import { Router } from 'express';
import crypto from 'node:crypto';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import NotificationPreference from '../models/NotificationPreference.js';
import RecurringTransaction from '../models/RecurringTransaction.js';
import { validateTransaction } from '../middleware/validate.js';
import { notifyBudgetCrossings } from '../services/notifications.js';
import { fromPaise, mongoPaiseSum } from '../lib/money.js';
import { findDuplicateTransaction, isDuplicateKeyError, validateTransactionReferences } from '../services/transactionChecks.js';

const router = Router();
const sendTelegram = async (chatId, text) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Telegram could not deliver a message.');
};
const parseMessage = (raw) => {
  const message = String(raw || '').trim();
  const amountMatch = message.match(/(?:₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replaceAll(',', ''));
  const income = /\b(received|income|salary|credited|got|earned|deposit)\b/i.test(message);
  const categories = [
    ['Food', /food|dinner|lunch|breakfast|zomato|swiggy|restaurant/i], ['Travel', /travel|uber|ola|taxi|metro|fuel|petrol|auto/i],
    ['Rent / Hostel', /rent|hostel|room/i], ['Bills', /bill|recharge|airtel|jio|wifi/i], ['Shopping', /shopping|amazon|flipkart/i],
    ['Entertainment', /netflix|movie|spotify|entertainment/i], ['Fitness', /gym|fitness/i], ['Medical', /medical|doctor|medicine|pharmacy/i],
    ['Parents', /parent|allowance/i], ['Salary', /salary/i], ['Scholarship', /scholarship/i], ['Freelancing', /freelance/i]
  ];
  const category = categories.find(([, match]) => match.test(message))?.[0] || (income ? 'Parents' : 'Other');
  const date = /yesterday/i.test(message) ? new Date(Date.now() - 86400000) : new Date();
  const description = message.replace(/(?:₹\s*)?\d[\d,]*(?:\.\d{1,2})?/, '').replace(/\b(spent|spend|expense|received|income|from|on|yesterday|today)\b/ig, '').trim() || category;
  return { amount, type: income ? 'income' : 'expense', category, description: description.slice(0, 160), date, paymentMethod: 'UPI', source: 'telegram' };
};
const budgetStatus = async (userId) => {
  const now = new Date(); const since = new Date(now.getFullYear(), now.getMonth(), 1);
  const [aggregate, budget] = await Promise.all([
    Transaction.aggregate([{ $match: { userId, type: 'expense', date: { $gte: since, $lte: now } } }, { $group: { _id: null, totalPaise: mongoPaiseSum() } }]),
    Budget.findOne({ userId, type: 'monthly', category: '' }).lean()
  ]);
  return { spent: fromPaise(aggregate[0]?.totalPaise || 0), limit: budget?.limit || null };
};
const periodStart = (period) => {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') { const day = (now.getDay() + 6) % 7; const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0); return start; }
  return new Date(now.getFullYear(), now.getMonth(), 1);
};
const summaryFor = async (userId, period) => {
  const start = periodStart(period);
  const now = new Date();
  const rows = await Transaction.aggregate([
    { $match: { userId, date: { $gte: start, $lte: now } } },
    { $group: { _id: { type: '$type', category: '$category' }, amountPaise: mongoPaiseSum() } },
    { $sort: { amountPaise: -1 } }
  ]);
  const income = fromPaise(rows.filter((r) => r._id.type === 'income').reduce((a, r) => a + r.amountPaise, 0));
  const expenses = fromPaise(rows.filter((r) => r._id.type === 'expense').reduce((a, r) => a + r.amountPaise, 0));
  const categories = rows.filter((r) => r._id.type === 'expense').slice(0, 6).map((r) => `${r._id.category} ₹${fromPaise(r.amountPaise).toLocaleString('en-IN')}`);
  const periodName = period === 'today' ? "Today's" : period === 'week' ? "This week's" : "This month's";
  return `${periodName} MoneyMint summary\n${categories.length ? categories.join('\n') : 'No expenses recorded.'}\n\nTotal spent: ₹${expenses.toLocaleString('en-IN')}${income ? `\nIncome: ₹${income.toLocaleString('en-IN')}` : ''}`;
};

const saveTelegramTransaction = async (user, transaction, updateId) => {
  const eventId = /^\d{1,30}$/.test(String(updateId ?? '')) ? `telegram:${updateId}` : '';
  const paymentMethod = user.paymentMethods?.[0] || 'Other';
  const input = { ...transaction, userId: user._id, paymentMethod, ...(eventId ? { transactionId: eventId } : {}) };
  const referenceError = await validateTransactionReferences(user, input);
  if (referenceError) return { error: referenceError };
  if (await findDuplicateTransaction(user._id, input)) return { duplicate: true };
  try {
    const saved = await Transaction.create(input);
    await notifyBudgetCrossings(user._id, saved);
    return { transaction: saved };
  } catch (error) {
    if (isDuplicateKeyError(error)) return { duplicate: true };
    throw error;
  }
};

router.post('/telegram/webhook', async (req, res, next) => {
  try {
    const provided = String(req.headers['x-telegram-bot-api-secret-token'] || '');
    const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
    if (!expected || provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return res.status(401).json({ message: 'Unauthorized webhook.' });
    const message = req.body?.message;
    if (!message?.chat?.id || !message?.text || !process.env.TELEGRAM_BOT_TOKEN) return res.status(200).json({ ok: true });
    const chatId = String(message.chat.id); const text = String(message.text).trim();
    if (message.chat.type !== 'private') { await sendTelegram(chatId, 'For your privacy, MoneyMint works with private bot chats only.'); return res.json({ ok: true }); }
    const user = await User.findOne({ telegramChatId: chatId });
    if (!user) { await sendTelegram(chatId, `Welcome to MoneyMint! Open Settings in your MoneyMint account and add this Telegram chat ID: ${chatId}`); return res.json({ ok: true }); }
    if (/^\/help/i.test(text)) { await sendTelegram(chatId, 'Try “spent 150 food” or “received 5000 from parents”. Commands: /balance, /today, /week, /month, /budget, /history, /report, /upcoming, /undo, /help'); return res.json({ ok: true }); }
    if (/^\/undo/i.test(text)) {
      const latest = await Transaction.findOneAndDelete({ userId: user._id, source: 'telegram' }).sort({ createdAt: -1 });
      await sendTelegram(chatId, latest ? `↩️ Removed your latest entry: ₹${latest.amount.toLocaleString('en-IN')} · ${latest.description || latest.category}` : 'There is no recent Telegram entry to undo.');
      return res.json({ ok: true });
    }
    if (/^\/upcoming/i.test(text)) {
      const upcoming = await RecurringTransaction.find({ userId: user._id, active: true }).sort({ nextOccurrence: 1 }).limit(5).lean();
      await sendTelegram(chatId, upcoming.length ? upcoming.map((item) => `${new Date(item.nextOccurrence).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${item.type === 'income' ? '+' : '−'}₹${item.amount.toLocaleString('en-IN')} ${item.description || item.category}`).join('\n') : 'No upcoming recurring items.');
      return res.json({ ok: true });
    }
    if (/^\/(today|week|month|budget|balance|history|report)/i.test(text)) {
      const status = await budgetStatus(user._id);
      if (/^\/budget/i.test(text)) await sendTelegram(chatId, status.limit ? `Monthly budget: ₹${status.spent.toLocaleString('en-IN')} / ₹${status.limit.toLocaleString('en-IN')}\nRemaining: ₹${Math.max(0, status.limit - status.spent).toLocaleString('en-IN')}` : 'No monthly budget yet. Add one in MoneyMint → Budgets.');
      else if (/^\/balance/i.test(text)) {
        const sums = await Transaction.aggregate([{ $match: { userId: user._id } }, { $group: { _id: '$type', amountPaise: mongoPaiseSum() } }]);
        const balance = fromPaise((sums.find((s) => s._id === 'income')?.amountPaise || 0) - (sums.find((s) => s._id === 'expense')?.amountPaise || 0));
        await sendTelegram(chatId, `Your recorded balance: ₹${balance.toLocaleString('en-IN')}`);
      } else if (/^\/history/i.test(text)) {
        const recent = await Transaction.find({ userId: user._id }).sort({ date: -1 }).limit(5).lean();
        await sendTelegram(chatId, recent.length ? recent.map((t) => `${t.type === 'income' ? '+' : '−'}₹${t.amount.toLocaleString('en-IN')} · ${t.description || t.category}`).join('\n') : 'No transactions recorded yet.');
      } else {
        const period = /^\/today/i.test(text) ? 'today' : /^\/week/i.test(text) ? 'week' : 'month';
        await sendTelegram(chatId, await summaryFor(user._id, period));
      }
      return res.json({ ok: true });
    }
    const transaction = parseMessage(text);
    if (!transaction) { await sendTelegram(chatId, 'I couldn’t find an amount. Try “spent 150 food” or “received ₹5,000 from parents”.'); return res.json({ ok: true }); }
    const invalid = validateTransaction(transaction);
    if (invalid) { await sendTelegram(chatId, invalid); return res.json({ ok: true }); }
    const result = await saveTelegramTransaction(user, transaction, req.body?.update_id);
    if (result.error) { await sendTelegram(chatId, result.error); return res.json({ ok: true }); }
    if (result.duplicate) { await sendTelegram(chatId, 'That transaction appears to have already been recorded.'); return res.json({ ok: true }); }
    const status = await budgetStatus(user._id);
    const spentLabel = status.limit ? `\nThis month's budget: ₹${status.spent.toLocaleString('en-IN')} / ₹${status.limit.toLocaleString('en-IN')}` : '';
    await sendTelegram(chatId, `✅ ${transaction.type === 'income' ? 'Income' : 'Expense'} added\n₹${transaction.amount.toLocaleString('en-IN')} → ${transaction.category}${spentLabel}`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/telegram/process', async (req, res, next) => {
  try {
    const supplied = String(req.headers['x-telegram-webhook-secret'] || '');
    const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
    if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ message: 'Invalid automation credential.' });
    const chatId = String(req.body.chatId || '');
    const text = String(req.body.text || '').trim();
    if (req.body.chatType !== 'private') return res.status(400).json({ message: 'For your privacy, connect MoneyMint through a private Telegram chat.' });
    const user = await User.findOne({ telegramChatId: chatId });
    if (!user && /^\/start/i.test(text)) return res.json({ reply: `Welcome to MoneyMint! In your MoneyMint account, open Settings and add this Telegram chat ID: ${chatId}` });
    if (!user) return res.status(404).json({ message: 'Connect this chat ID in MoneyMint Settings first.' });
    if (/^\/help/i.test(text)) return res.json({ reply: 'Try “spent 150 food” or “received 5000 from parents”. Commands: /balance, /today, /week, /month, /budget, /history, /report, /upcoming, /undo, /help' });
    if (/^\/undo/i.test(text)) {
      const latest = await Transaction.findOneAndDelete({ userId: user._id, source: 'telegram' }).sort({ createdAt: -1 });
      return res.json({ reply: latest ? `↩️ Removed your latest entry: ₹${latest.amount.toLocaleString('en-IN')} · ${latest.description || latest.category}` : 'There is no recent Telegram entry to undo.' });
    }
    if (/^\/upcoming/i.test(text)) {
      const upcoming = await RecurringTransaction.find({ userId: user._id, active: true }).sort({ nextOccurrence: 1 }).limit(5).lean();
      return res.json({ reply: upcoming.length ? upcoming.map((item) => `${new Date(item.nextOccurrence).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${item.type === 'income' ? '+' : '−'}₹${item.amount.toLocaleString('en-IN')} ${item.description || item.category}`).join('\n') : 'No upcoming recurring items.' });
    }
    if (/^\/(today|week|month|budget|balance|history|report)/i.test(text)) {
      const status = await budgetStatus(user._id);
      if (/^\/budget/i.test(text)) return res.json({ reply: status.limit ? `Monthly budget: ₹${status.spent.toLocaleString('en-IN')} / ₹${status.limit.toLocaleString('en-IN')}\nRemaining: ₹${Math.max(0, status.limit - status.spent).toLocaleString('en-IN')}` : 'No monthly budget yet. Add one in MoneyMint → Budgets.' });
      if (/^\/balance/i.test(text)) {
        const sums = await Transaction.aggregate([{ $match: { userId: user._id } }, { $group: { _id: '$type', amountPaise: mongoPaiseSum() } }]);
        const balance = fromPaise((sums.find((s) => s._id === 'income')?.amountPaise || 0) - (sums.find((s) => s._id === 'expense')?.amountPaise || 0));
        return res.json({ reply: `Your recorded balance: ₹${balance.toLocaleString('en-IN')}` });
      }
      if (/^\/history/i.test(text)) {
        const recent = await Transaction.find({ userId: user._id }).sort({ date: -1 }).limit(5).lean();
        return res.json({ reply: recent.length ? recent.map((t) => `${t.type === 'income' ? '+' : '−'}₹${t.amount.toLocaleString('en-IN')} · ${t.description || t.category}`).join('\n') : 'No transactions recorded yet.' });
      }
      const period = /^\/today/i.test(text) ? 'today' : /^\/week/i.test(text) ? 'week' : 'month';
      return res.json({ reply: await summaryFor(user._id, period) });
    }
    const transaction = parseMessage(text);
    if (!transaction) return res.status(400).json({ message: 'No amount found. Try “spent 150 food”.' });
    const invalid = validateTransaction(transaction);
    if (invalid) return res.status(400).json({ message: invalid });
    const result = await saveTelegramTransaction(user, transaction, req.body?.updateId);
    if (result.error) return res.status(400).json({ message: result.error });
    if (result.duplicate) return res.json({ duplicate: true, reply: 'That transaction appears to have already been recorded.' });
    res.status(201).json({ transaction: result.transaction, reply: `✅ ${transaction.type === 'income' ? 'Income' : 'Expense'} added\n₹${transaction.amount.toLocaleString('en-IN')} → ${transaction.category}` });
  } catch (err) { next(err); }
});

router.post('/telegram/summary', async (req, res, next) => {
  try {
    const supplied = String(req.headers['x-telegram-webhook-secret'] || ''); const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
    if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ message: 'Invalid automation credential.' });
    const user = await User.findOne({ telegramChatId: String(req.body.chatId || '') });
    if (!user) return res.status(404).json({ message: 'Connect this chat ID in MoneyMint Settings first.' });
    const period = ['today', 'week', 'month'].includes(req.body.period) ? req.body.period : 'today';
    const pref = await NotificationPreference.findOne({ userId: user._id }).lean();
    const enabled = Boolean(pref?.telegramNotifications && pref?.[`${period === 'today' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'}Summary`]);
    res.json({ enabled, chatId: user.telegramChatId, period, text: await summaryFor(user._id, period) });
  } catch (err) { next(err); }
});

router.post('/telegram/summaries', async (req, res, next) => {
  try {
    const supplied = String(req.headers['x-telegram-webhook-secret'] || ''); const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
    if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ message: 'Invalid automation credential.' });
    const period = ['today', 'week', 'month'].includes(req.body.period) ? req.body.period : 'today';
    const preferenceKey = period === 'today' ? 'dailySummary' : period === 'week' ? 'weeklySummary' : 'monthlySummary';
    const preferences = await NotificationPreference.find({ [preferenceKey]: true, telegramNotifications: true }).select('userId').lean();
    const users = await User.find({ _id: { $in: preferences.map((p) => p.userId) }, telegramChatId: { $nin: ['', null] } }).select('_id telegramChatId').lean();
    const summaries = await Promise.all(users.map(async (user) => ({ chatId: user.telegramChatId, text: await summaryFor(user._id, period) })));
    res.json({ summaries, period });
  } catch (err) { next(err); }
});

router.get('/status', authenticate, async (req, res) => res.json({ telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET), n8nConfigured: Boolean(process.env.N8N_WEBHOOK_URL), telegramChatId: req.user.telegramChatId || '' }));
export default router;
