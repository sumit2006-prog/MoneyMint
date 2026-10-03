import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import { normalizeMoney } from '../lib/money.js';

const normalizeLabel = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function transactionSignatures(item) {
  const date = new Date(item.date);
  const amount = normalizeMoney(item.amount);
  if (Number.isNaN(date.valueOf()) || amount === null || !['income', 'expense'].includes(item.type)) return [];
  const day = date.toISOString().slice(0, 10);
  const base = `${day}|${Math.round(amount * 100)}|${item.type}|`;
  const labels = [
    ...new Set([
      normalizeLabel(item.description),
      normalizeLabel(item.merchant),
    ].filter(Boolean)),
  ];
  const signatures = labels.map((label) => `${base}${label}`);
  const transactionId = String(item.transactionId || '').trim().toLowerCase();
  if (transactionId) signatures.push(`id|${transactionId}`);
  return signatures;
}

export async function validateTransactionReferences(user, transaction) {
  const category = await Category.findOne({ userId: user._id, name: String(transaction.category || '').trim() }).lean();
  if (!category) return 'Choose a category from your account.';
  if (category.type !== 'both' && category.type !== transaction.type) return 'Choose a category that matches this transaction type.';
  const paymentMethod = String(transaction.paymentMethod || user.paymentMethods?.[0] || 'Other').trim();
  if (!user.paymentMethods?.includes(paymentMethod)) return 'Choose a payment method from your settings.';
  return null;
}

export async function findDuplicateTransaction(userId, candidate, excludeId) {
  const transactionId = String(candidate.transactionId || '').trim();
  if (transactionId) {
    const byId = await Transaction.findOne({ userId, transactionId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select('_id').lean();
    if (byId) return byId;
  }

  const amount = normalizeMoney(candidate.amount);
  const date = new Date(candidate.date);
  if (amount === null || Number.isNaN(date.valueOf())) return null;
  const day = date.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.valueOf() + 86_400_000);
  const possible = await Transaction.find({
    userId,
    type: candidate.type,
    amount,
    date: { $gte: start, $lt: end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('_id description merchant').lean();
  const labels = new Set([candidate.description, candidate.merchant].map(normalizeLabel).filter(Boolean));
  return possible.find((item) => [item.description, item.merchant].map(normalizeLabel).some((label) => label && labels.has(label))) || null;
}

export const isDuplicateKeyError = (error) => error?.code === 11000;
