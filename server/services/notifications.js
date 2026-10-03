import User from '../models/User.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { fromPaise, mongoPaiseSum } from '../lib/money.js';

export async function notifyBudgetCrossings(userId, transaction) {
  if (transaction.type !== 'expense' || !process.env.TELEGRAM_BOT_TOKEN) return;
  const now = new Date(); const transactionDate = new Date(transaction.date);
  if (transactionDate < new Date(now.getFullYear(), now.getMonth(), 1) || transactionDate > now) return;
  const [user, budget, preference] = await Promise.all([
    User.findById(userId).select('telegramChatId'),
    Budget.findOne({ userId, type: 'monthly', category: '' }).lean(),
    NotificationPreference.findOne({ userId }).lean()
  ]);
  if (!user?.telegramChatId || !budget || !preference?.budgetAlerts || !preference?.telegramNotifications) return;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await Transaction.aggregate([{ $match: { userId, type: 'expense', date: { $gte: start, $lte: now } } }, { $group: { _id: null, totalPaise: mongoPaiseSum() } }]);
  const spent = fromPaise(result[0]?.totalPaise || 0); const previous = fromPaise(Math.round((spent - transaction.amount) * 100));
  const crossed = (budget.alertThresholds || [50, 75, 90, 100]).filter((threshold) => previous < budget.limit * threshold / 100 && spent >= budget.limit * threshold / 100);
  if (!crossed.length) return;
  const threshold = Math.max(...crossed);
  const copy = threshold >= 100 ? 'Your monthly budget has been exceeded.' : threshold >= 90 ? 'You are close to your monthly spending limit.' : `You have used ${threshold}% of your monthly budget.`;
  const remaining = Math.max(0, budget.limit - spent);
  try {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: user.telegramChatId, text: `⚠️ ${copy}\n₹${spent.toLocaleString('en-IN')} / ₹${budget.limit.toLocaleString('en-IN')} used\nRemaining: ₹${remaining.toLocaleString('en-IN')}` }) });
  } catch (error) { console.error('Telegram budget alert failed:', error.message); }
}
